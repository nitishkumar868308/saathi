import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import { reportError } from "@/lib/report-error";
import { addDocument, DocLimitError, uploadDocumentImage } from "@/lib/documents";
import { ensureNotifPermission, scheduleDocumentExpiry } from "@/lib/notifications";
import { checkReferralQualification } from "@/lib/plan";
import { scanDocumentAI } from "@/lib/ai";
import { withoutLock } from "@/lib/app-lock";
import { logEvent } from "@/lib/analytics";
import { markFirstDocument } from "@/lib/reviews";
import { isPastDate, isValidDate } from "@/utils/expiry";
import { iconForType, labelForType } from "@/theme/status";
import { useToast } from "@/components/toast";
import { PermissionModal } from "@/components/permission-modal";
import { shouldShowReliabilityPrompt } from "@/lib/reliability";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

async function persistImage(cacheUri: string): Promise<string> {
  const dir = FileSystem.documentDirectory + "documents/";
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* already exists */
  }
  const ext = (cacheUri.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
  const dest = `${dir}${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
  await FileSystem.copyAsync({ from: cacheUri, to: dest });
  return dest;
}

export default function AddDocument() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { addDocument: d } = useT();
  const { locale } = useLocale();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [type, setType] = useState("other");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  /**
   * Bhari hui expiry beet chuki hai?
   *
   * ⚠️ State me hai, render me hisaab lagakar nahi — bilkul `note-reminder.tsx`
   * ki tarah, aur usi do wajah se: `Date.now()` render me impure hai
   * (`react-hooks/purity` isse pakadta hai), aur aadhi raat paar karte hi
   * chetavni apne aap aa jaani chahiye.
   *
   * Interval yahan 60 second ka hai (reminder wale 20 ke muqable) — ye DIN ki
   * baat hai, minute ki nahi. Ise sirf aadhi raat wali soorat sambhalni hai.
   */
  const [expiryPast, setExpiryPast] = useState(false);
  useEffect(() => {
    const check = () => setExpiryPast(isPastDate(expiry));
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [expiry]);
  /** AI scan ka poora samajh — DB me save hota hai. */
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  /**
   * Reminder-reliability modal khula hai kya.
   *
   * ⚠️ Ye screen par tha hi nahi, aur document ke liye wo utna hi zaroori
   * hai jitna reminder ke liye. Expiry wala document APNI notification
   * lagata hai (7 din pehle / 1 din pehle / us din) — wahi teen khabrein
   * jinke liye user ne document daala hi tha. Permission ya exact-alarm
   * baaki ho to un teenon me se ek bhi nahi aati, aur user ko sirf ek
   * chhota sa toast milta tha jo wo padhta bhi nahi.
   */
  const [permModal, setPermModal] = useState(false);

  async function pickImage(source: "camera" | "gallery") {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        base64: true,
        quality: 0.4,
        allowsEditing: true,
      };
      /**
       * ⚠️ Camera/gallery ke poore waqt lock band rehta hai.
       *
       * Yahi wo jagah hai jahan shikayat sabse zyada thi: document ki photo
       * lene camera kholo, wapas aao — aur app PIN maang rahi hai. Camera app
       * ke bahar khulta hai, yaani Saathi background me chali jaati hai; par
       * user ne app CHHODI nahi hai, app hi use bahar bhej rahi hai. Scan me
       * aksar 30-60 second lagte hain (photo lena, crop karna), to purani 60
       * second wali khidki har baar hi kat jaati thi.
       */
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast.show(d.cameraPermission, "info");
        result = await withoutLock(() => ImagePicker.launchCameraAsync(opts));
      } else {
        result = await withoutLock(() => ImagePicker.launchImageLibraryAsync(opts));
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      setImageUri(asset.uri);
      try {
        setSavedUri(await persistImage(asset.uri));
      } catch {
        setSavedUri(asset.uri);
      }
      if (!asset.base64) return;

      setScanning(true);
      try {
        let rType = "other";
        let rName = "";
        let rExpiry: string | null = null;

        /**
         * Document sirf AI (Gemini vision) padhta hai.
         *
         * ⚠️ Yahan pehle ek local OCR fallback tha (OCR.space + keyword matching)
         * jo AI fail hone par chal jaata tha. Wo hata diya gaya. Wajah: wo aksar
         * galat naam aur galat expiry nikaalta tha, aur user ko wo bilkul AI ke
         * jawab jaisa hi dikhta tha. Ek galat expiry date sabse mehngi galti hai
         * — us document ka reminder galat din bajta hai, aur kisi ko pata bhi
         * nahi chalta ki wo kahan se aayi thi.
         *
         * AI na chale to hum khaali chhod dete hain aur user khud bhar leta hai.
         * Khaali khaana galat khaane se hamesha behtar hai.
         */
        const scan = await scanDocumentAI(asset.base64, locale);

        /**
         * ── Fail hua to WAJAH batao ──────────────────────────────────────
         *
         * ⚠️ Pehle yahan paanch bilkul alag halaat ek hi line dikhati thi:
         * "Padha, par saaf nahi — details khud daal do". Net band ho, net dheema
         * ho, Gemini bhara ho, server ki dikkat ho, ya AI ne sach me kuch na
         * dhoondha ho — user ke liye sab ek jaisa tha.
         *
         * Pehli chaar soorat me wo line JHOOTH thi: AI ne kuch padha hi nahi
         * tha. Aur wo jhooth mehnga tha — user "saaf nahi" padh kar photo dobara
         * kheenchta tha, behtar roshni me, ek aur baar… jabki dikkat photo ki
         * thi hi nahi, net ki thi.
         *
         * `add-reminder.tsx` me ye pehle se theek hai (`tellWhyAiFailed`) —
         * yahan wahi baat, usi tarah.
         */
        if (!scan.ok) {
          setScanned(true);
          if (scan.failure === "offline") toast.show(d.ocrOffline, "info");
          else if (scan.failure === "busy" || scan.failure === "slow") {
            toast.show(d.ocrBusy, "info");
          } else if (scan.failure === "unclear") {
            // Ek hi soorat jisme AI SACH ME chala tha — yahan "khud bhar do"
            // kehna sahi hai.
            toast.show(d.ocrUnclear, "info");
          } else toast.show(d.ocrFailed, "error");
          return;
        }

        const ai = scan.data;
        if (ai.name || ai.expiry || (ai.type && ai.type !== "other")) {
          rType = ai.type || "other";
          rName = ai.name || "";
          rExpiry = ai.expiry && isValidDate(ai.expiry) ? ai.expiry : null;
          // AI ka poora samajh save karo (DB me jaayega).
          if (ai.summary) setSummary(ai.summary);
        }

        setType(rType);
        if (rName) setName(rName);
        if (rExpiry) setExpiry(rExpiry);
        setScanned(true);

        const bits: string[] = [];
        if (rName) bits.push(rName);
        if (rExpiry) bits.push(d.ocrExpiryFound);
        toast.show(
          bits.length ? tpl(d.ocrReadTpl, { bits: bits.join(" · ") }) : d.ocrUnclear,
          bits.length ? "success" : "info",
        );
      } catch {
        toast.show(d.ocrFailed, "error");
      } finally {
        setScanning(false);
      }
    } catch {
      toast.show(d.imageFailed, "error");
    }
  }

  async function save() {
    if (saving) return;
    if (!name.trim()) return toast.show(d.nameRequired, "info");
    if (expiry && !isValidDate(expiry)) {
      return toast.show(d.badDate, "error");
    }
    try {
      setSaving(true);
      const doc = await addDocument({
        name: name.trim(),
        type,
        expiry: expiry || null,
        summary: summary.trim() || null,
        file_uri: savedUri,
      });

      /**
       * Cloud backup — document image Cloudflare R2 me (private).
       *
       * ⚠️ Ye ab "chalao aur bhool jao" nahi hai. `uploadDocumentImage` pehle
       * file ko kataar me daalta hai aur uske BAAD upload ki koshish karta hai —
       * yaani net na ho (ya beech me toot jaye) to bhi wo kataar me padi rehti
       * hai aur app khulne/net aane par apne aap chali jaati hai.
       *
       * Pehle yahan seedha upload tha aur uska `.catch(() => {})` fail ko
       * chup-chaap nigal jaata tha: document HAMESHA ke liye sirf us phone par
       * reh jaata tha. Phone kho jaye to backup ka poora waada wahin toot-ta tha,
       * aur kisi ko pata bhi nahi chalta tha.
       */
      if (savedUri) {
        uploadDocumentImage(doc.id, savedUri).catch(() => {});
      }

      /**
       * Expiry ke liye notification (7 din pehle, 1 din pehle, aur us din).
       * Permission tabhi maango jab expiry hai — warna prompt bekaar lagta hai.
       *
       * ⚠️ Aur beeti hui expiry par bhi nahi. Us par koi notification lag hi
       * nahi sakti (teenon qadam — 7 din pehle, 1 din pehle, us din — sab beet
       * chuke hote hain), to permission maangna user se aisi cheez maangna hai
       * jiska yahan koi kaam hi nahi. Pehle prompt aata tha, user allow karta
       * tha, aur phir bhi kabhi kuch nahi bajta tha.
       */
      const expired = !!doc.expiry && isPastDate(doc.expiry);
      let notifOk = true;
      if (doc.expiry && !expired) {
        notifOk = await ensureNotifPermission();
        if (notifOk) await scheduleDocumentExpiry(doc.id, doc.name, doc.expiry);
      }

      logEvent("document_added", { type: doc.type });
      // Referral reward unlock ho sakta hai (document + reminder dono hone pe).
      checkReferralQualification().catch(() => {});
      // Review popup ka padav — document + reminder dono ho jaayein to poochho.
      markFirstDocument().catch(() => {});
      // Beeti hui expiry wali baat sabse upar — user ne form par chetavni dekhi
      // thi, aur "add ho gaya 🎉" uske theek ulta paigham deta hai.
      toast.show(
        expired ? d.addedExpired : notifOk ? d.added : d.addedNoNotif,
        expired || !notifOk ? "info" : "success",
      );

      /**
       * Expiry wale document par wahi reliability check jo reminder par hai.
       *
       * Sirf `doc.expiry` hone par — bina expiry ke document ki koi notification
       * hoti hi nahi, to wahan permission maangna bekaar aur chidhchida hoga.
       *
       * Sab allow ho to modal khulta hi nahi aur screen seedha band ho jaati
       * hai; ek bhi step baaki ho to pehle modal, band karne par wapas.
       */
      // `!expired` bhi: ye modal notification ko bharosemand banane ke liye hai,
      // aur beeti hui expiry par koi notification hai hi nahi.
      if (doc.expiry && !expired && (await shouldShowReliabilityPrompt())) {
        setPermModal(true);
        return;
      }
      router.back();
    } catch (e) {
      if (e instanceof DocLimitError) {
        toast.show(d.limitReached, "info");
        router.push("/upgrade" as never);
      } else {
        reportError(e, { screen: "add-document", action: "save" });
        toast.show(d.saveFailed, "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{d.title}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={tc.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo scan — primary */}
          <View style={styles.scanBox}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.scanIcon}>
                <Ionicons name="scan" size={30} color={tc.terracotta} />
              </View>
            )}

            {scanning ? null : (
              <>
                <Text style={styles.scanTitle}>{scanned ? d.doneTitle : d.photoTitle}</Text>
                <Text style={styles.scanSub}>{scanned ? d.doneSub : d.photoSub}</Text>
              </>
            )}

            <View style={styles.scanBtns}>
              <Pressable
                onPress={() => pickImage("camera")}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtn, pressed && styles.pressed]}
              >
                <Ionicons name="camera" size={18} color={tc.white} />
                <Text style={styles.sBtnText}>{d.camera}</Text>
              </Pressable>
              <Pressable
                onPress={() => pickImage("gallery")}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtnAlt, pressed && styles.pressed]}
              >
                <Ionicons name="images" size={18} color={tc.terracotta} />
                <Text style={styles.sBtnAltText}>{d.gallery}</Text>
              </Pressable>
            </View>
          </View>

          {/* Detected type (read-only) */}
          {scanned && (
            <View style={styles.detected}>
              <View style={styles.detIcon}>
                <Ionicons name={iconForType(type) as any} size={20} color={tc.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detLabel}>{d.detectedLabel}</Text>
                <Text style={styles.detType}>{labelForType(type)}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={tc.sage} />
            </View>
          )}

          {/* Saathi ne document se jo samjha — poora dynamic (jo bhi mila). */}
          {scanned && !!summary.trim() && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHead}>
                <Ionicons name="sparkles" size={14} color={tc.terracotta} />
                <Text style={styles.summaryHeadText}>{d.summaryLabel}</Text>
              </View>
              <Text style={styles.summaryText}>{summary.trim()}</Text>
            </View>
          )}

          {/* Name (editable) */}
          <Text style={styles.label}>
            {d.name} {scanned && <Text style={styles.editHint}>{d.editHint}</Text>}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={d.namePlaceholder}
            placeholderTextColor={tc.inkSoft}
            style={[styles.input, scanned && name ? styles.inputFilled : null]}
          />

          {/* Expiry (editable) */}
          <Text style={styles.label}>{d.expiry}</Text>
          <TextInput
            value={expiry}
            onChangeText={setExpiry}
            placeholder={d.expiryPlaceholder}
            placeholderTextColor={tc.inkSoft}
            style={[
              styles.input,
              scanned && expiry ? styles.inputFilled : null,
              expiryPast ? styles.inputPast : null,
            ]}
            keyboardType="numbers-and-punctuation"
          />
          {/**
           * Beeti hui expiry — chetavni yahin, turant.
           *
           * ⚠️ Ye ROK nahi hai, aur wo jaan-boojh ke hai: expire ho chuka
           * document daalna bilkul theek hai (app me uske liye "expired" filter
           * aur poora renewal-guide hai). Rok se wo feature hi mar jaata.
           *
           * Par chup rehna usse bhi bura tha. Beeti hui date par `schedule()`
           * kuch lagata hi nahi, aur user ko "Document add ho gaya 🎉" dikhta
           * tha — wo maan leta tha ki reminder lag gaya hai. Wahi ek chup-chaap
           * fail tha jise pakadna namumkin hota hai.
           *
           * Yahan dikhane ka ek aur faayda: 2025 vs 2026 jaisa typo user ko
           * Save dabane se PEHLE hi dikh jaata hai.
           */}
          {expiryPast ? (
            <View style={styles.pastWarn}>
              <Ionicons name="alert-circle" size={15} color={tc.danger} />
              <Text style={styles.pastWarnText}>{d.expiryPast}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => [styles.save, (pressed || saving) && { opacity: 0.85 }]}
      >
        <Text style={styles.saveText}>{d.save}</Text>
      </Pressable>

      {/* Scan + save — dono ke liye wahi ek center overlay loader. */}
      <LoaderOverlay visible={scanning || saving} />

      {/* Expiry ki khabar sach me pahunche iske liye — notification, exact
          alarm, full-screen alert, battery aur OEM auto-start, ek hi jagah.
          Band karte hi screen bhi band, kyunki document save ho chuka hai. */}
      <PermissionModal
        visible={permModal}
        onClose={() => {
          setPermModal(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    ...CONTENT,
  },
  title: { fontSize: 22, fontWeight: "700", color: c.ink },
  close: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  content: { padding: 20, paddingBottom: 20, ...CONTENT },
  scanBox: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  scanIcon: {
    height: 60,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  preview: {
    height: 120,
    width: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
  },
  scanningRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  scanningText: { fontSize: 14, fontWeight: "600", color: c.terracotta },
  scanTitle: { marginTop: 12, fontSize: 17, fontWeight: "700", color: c.ink },
  scanSub: {
    marginTop: 3,
    fontSize: 13,
    color: c.inkSoft,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  scanBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  sBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    backgroundColor: c.terracotta,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sBtnText: { color: c.white, fontWeight: "700", fontSize: 14 },
  sBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.terracotta,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sBtnAltText: { color: c.terracotta, fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.8 },
  detected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.sage,
    backgroundColor: "rgba(124,138,107,0.08)",
    padding: 14,
  },
  detIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  detLabel: { fontSize: 12, color: c.inkSoft, fontWeight: "600" },
  detType: { fontSize: 16, fontWeight: "700", color: c.ink, marginTop: 1 },
  summaryCard: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 16,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  summaryHeadText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: c.terracotta,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryText: { fontSize: 14.5, lineHeight: 21, color: c.ink },
  label: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
    color: c.ink,
  },
  editHint: { fontSize: 12, fontWeight: "500", color: c.inkSoft },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: c.ink,
    fontSize: 15,
  },
  inputFilled: { borderColor: c.sage, backgroundColor: "rgba(124,138,107,0.08)" },
  /**
   * Beeti hui expiry — `inputFilled` ke BAAD lagta hai, isliye AI ka bhara hua
   * hara border bhi ismein dhak jaata hai. Wahi sahi hai: AI ne bhi agar beeti
   * hui date padhi ho to wo "sab theek hai" wala hara nahi dikhna chahiye.
   *
   * Rang `c.danger` hai (token), hardcoded #B23B3B nahi — wo dark page par
   * 3.4:1 par gir jaata hai. Token dark me halka ujla shade deta hai.
   */
  inputPast: { borderColor: c.danger, backgroundColor: "rgba(178,59,59,0.07)" },
  pastWarn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  pastWarnText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: "600", color: c.danger },
  save: {
    margin: 20,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 18,
    backgroundColor: c.terracotta,
    ...CONTENT,
  },
  saveText: { color: c.white, fontWeight: "700", fontSize: 16 },
}));
