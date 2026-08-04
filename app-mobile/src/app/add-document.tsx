import { useState } from "react";
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
import { logEvent } from "@/lib/analytics";
import { markFirstDocument } from "@/lib/reviews";
import { isValidDate } from "@/utils/expiry";
import { iconForType, labelForType } from "@/theme/status";
import { useToast } from "@/components/toast";
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
  /** AI scan ka poora samajh — DB me save hota hai. */
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function pickImage(source: "camera" | "gallery") {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        base64: true,
        quality: 0.4,
        allowsEditing: true,
      };
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast.show(d.cameraPermission, "info");
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(opts);
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
        const ai = await scanDocumentAI(asset.base64, locale);
        if (ai && (ai.name || ai.expiry || (ai.type && ai.type !== "other"))) {
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

      // Cloud backup — document image Supabase Storage me (private). Best-effort:
      // fail ho to local copy to hai hi. Admin/size/cross-device iske liye.
      if (savedUri) {
        uploadDocumentImage(doc.id, savedUri).catch(() => {});
      }

      // Expiry ke liye notification (14 din pehle, 3 din pehle, aur us din).
      // Permission tabhi maango jab expiry hai — warna prompt bekaar lagta hai.
      let notifOk = true;
      if (doc.expiry) {
        notifOk = await ensureNotifPermission();
        if (notifOk) await scheduleDocumentExpiry(doc.id, doc.name, doc.expiry);
      }

      logEvent("document_added", { type: doc.type });
      // Referral reward unlock ho sakta hai (document + reminder dono hone pe).
      checkReferralQualification().catch(() => {});
      // Review popup ka padav — document + reminder dono ho jaayein to poochho.
      markFirstDocument().catch(() => {});
      toast.show(notifOk ? d.added : d.addedNoNotif, notifOk ? "success" : "info");
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
            style={[styles.input, scanned && expiry ? styles.inputFilled : null]}
            keyboardType="numbers-and-punctuation"
          />
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
