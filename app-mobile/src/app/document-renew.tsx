import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay, ScreenLoader } from "@/components/loader";
import { PermissionModal } from "@/components/permission-modal";
import { useToast } from "@/components/toast";
import { reportError } from "@/lib/report-error";
import { listDocuments, updateDocument, type Document } from "@/lib/documents";
import { resolveDocUri } from "@/lib/doc-cache";
import { ensureNotifPermission, scheduleDocumentExpiry } from "@/lib/notifications";
import { shouldShowReliabilityPrompt } from "@/lib/reliability";
import { scanDocumentAI } from "@/lib/ai";
import { withoutLock } from "@/lib/app-lock";
import { logEvent } from "@/lib/analytics";
import { emitDataChanged } from "@/lib/data-events";
import { iconForType, labelForType } from "@/theme/status";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { DateField } from "@/components/date-field";
import { daysInMonth, formatDate, monthName, toIsoDate } from "@/utils/date-format";
import {
  expiryNotifyPlan,
  isImpossibleDay,
  isPastDate,
  isValidDate,
  type ExpiryNotifyStep,
} from "@/utils/expiry";

/**
 * Document RENEW — sirf expiry (aur chaho to nayi photo).
 *
 * ── Ye screen "Edit" kyun nahi hai ──────────────────────────────────────
 *
 * ⚠️ Shikayat seedhi thi: "document renew hone par expiry badalne ka koi rasta
 * hi nahi — pehle delete karo, phir dobara poori photo kheencho, phir dobara
 * scan". Ye is app ka sabse aam kaam hai aur usme sabse lambi mehnat lagti thi.
 *
 * Par uska seedha jawab — ek aam "Edit" screen — apne saath ek bada khatra laata
 * hai: user Passport add kare aur baad me use Driving Licence bana de. Us row par
 * phir kuch bhi sach nahi rehta — photo kisi aur document ki, naam kisi aur ka,
 * aur renewal guide (jo `type` se chunta hai) bilkul galat. Aisi galti ka koi
 * error nahi aata, wo bas chup-chaap galat ho jaati hai.
 *
 * Isliye yahan naam aur type LOCKED hain — dikhte hain, badalte nahi. Rok sirf
 * UI ki nahi hai: `updateDocument()` ke `patch` type me wo khaane hain hi nahi,
 * yaani unhe badalne wala code likha hi nahi ja sakta.
 *
 * ── Bina expiry wale document par bhi ye screen khulti hai ──────────────
 *
 * Wahan naam "Expiry date add karo" ho jaata hai. Ye pehchaan badalna nahi hai,
 * chhooti hui jaankari bharna hai — aur uski asli zaroorat hai: AI ka scan aksar
 * expiry miss kar deta hai, aur uske baad ek hi ilaaj bachta tha (delete karke
 * poori photo dobara). Naam/type wahan bhi utne hi locked hain.
 */
export default function DocumentRenew() {
  const tc = useColors();
  const styles = useStyles();
  const toast = useToast();
  const { renewDoc: r, addDocument: a, documents: dd, common: cm } = useT();
  const { locale } = useLocale();

  const { id } = useLocalSearchParams<{ id?: string }>();

  const [doc, setDoc] = useState<Document | null>(null);
  /**
   * ⚠️ Shuruaati haal `id` se aata hai, hamesha `true` se nahi.
   *
   * Bina `id` ke kuch load hona hi nahi hai. Pehle wo soorat effect ke andar
   * `setLoading(false)` se sambhali ja rahi thi — yaani effect ke pehle hi lamhe
   * me ek aur render, jise React ka lint theek hi pakadta hai
   * (`react-hooks/set-state-in-effect`). Yahan shuru se sach likh dena us poore
   * chakkar ko hata deta hai.
   */
  const [loading, setLoading] = useState(!!id);

  const [expiry, setExpiry] = useState("");
  /** Nayi photo ka local rasta — `null` = purani hi rehne do. */
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permModal, setPermModal] = useState(false);

  const [expiryPast, setExpiryPast] = useState(false);
  const [plan, setPlan] = useState<ExpiryNotifyStep[]>([]);

  /**
   * Purani photo — "pehle ye tha" wale khaane ke liye.
   *
   * `resolveDocUri` pehle offline cache dekhta hai, phir isi phone ki file, aur
   * aakhir me cloud. Isliye ye net ke bina bhi dikh jaati hai — aur renew aksar
   * RTO/bank ke bahar hi hota hai.
   */
  const [oldPhoto, setOldPhoto] = useState<string | null>(null);

  /**
   * Document offline bhi mil jaata hai — `listDocuments()` net na hone par cache
   * se laut aata hai. Renew aksar RTO/bank ke bahar hota hai jahan signal sabse
   * kharab hota hai; wahan ye screen khali nahi rehni chahiye.
   */
  useEffect(() => {
    /**
     * `alive` — unmount ke baad setState na ho.
     *
     * Ye modal user kabhi bhi swipe karke band kar sakta hai, aur wo aksar tab
     * hota hai jab list abhi aa hi rahi hoti hai (net dheema, ya cache se file
     * padhi ja rahi hai). Bina is guard ke wahi warning aati hai jo asal me ek
     * chhota leak hai.
     */
    let alive = true;
    void (async () => {
      if (!id) return;
      try {
        const found = (await listDocuments()).find((x) => x.id === id) ?? null;
        if (!alive) return;
        setDoc(found);
        setExpiry(found?.expiry ?? "");
        // Purani photo peeche-peeche — screen iske intezaar me ruki nahi rehni
        // chahiye, baaki sab pehle se saamne hai.
        if (found) {
          void resolveDocUri(found)
            .then((u) => {
              if (alive) setOldPhoto(u);
            })
            .catch(() => {});
        }
      } catch (e) {
        reportError(e, { screen: "document-renew", action: "load" }, "warn");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /**
   * Chetavni aur "kab yaad dilayenge" — dono `expiry` se, render me nahi.
   *
   * `Date.now()` render me impure hai (`react-hooks/purity` isse pakadta hai),
   * aur aadhi raat paar karte hi ye baatein apne aap sahi ho jaani chahiye —
   * isliye state + interval, bilkul `add-document.tsx` ki tarah.
   */
  useEffect(() => {
    const check = () => {
      setExpiryPast(isPastDate(expiry));
      setPlan(isValidDate(expiry) ? expiryNotifyPlan(expiry) : []);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [expiry]);

  async function pickImage(source: "camera" | "gallery") {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        base64: true,
        quality: 0.4,
        allowsEditing: true,
      };
      // Camera/gallery ke poore waqt lock band — app user ko khud bahar bhej rahi
      // hai, usne app chhodi nahi hai. (Wajah `lib/app-lock.ts` me poori likhi hai.)
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast.show(a.cameraPermission, "info");
        result = await withoutLock(() => ImagePicker.launchCameraAsync(opts));
      } else {
        result = await withoutLock(() => ImagePicker.launchImageLibraryAsync(opts));
      }
      if (result.canceled) return;

      const asset = result.assets[0];
      const dir = FileSystem.documentDirectory + "documents/";
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      } catch {
        /* already exists */
      }
      const ext = (asset.uri.split(".").pop() || "jpg").split("?")[0].slice(0, 5);
      const dest = `${dir}${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
      try {
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        setNewPhoto(dest);
      } catch {
        setNewPhoto(asset.uri);
      }

      if (!asset.base64) return;

      /**
       * ⚠️ Scan se yahan SIRF expiry li jaati hai.
       *
       * `add-document` wahi scan naam aur type bhi bharne ke liye use karta hai —
       * wahan wo sahi hai, kyunki document abhi ban hi raha hai. Yahan wo poore
       * lock ko bekaar kar deta: user Passport ki jagah galti se Licence ki photo
       * kheench le, aur AI naam/type chup-chaap badal de — theek wahi cheez jise
       * rokne ke liye ye screen banayi gayi hai.
       */
      setScanning(true);
      try {
        const scan = await scanDocumentAI(asset.base64, locale);
        if (!scan.ok) {
          if (scan.failure === "offline") toast.show(a.ocrOffline, "info");
          else if (scan.failure === "busy" || scan.failure === "slow") {
            toast.show(a.ocrBusy, "info");
          } else if (scan.failure === "unclear") toast.show(a.ocrUnclear, "info");
          else toast.show(a.ocrFailed, "error");
          return;
        }
        const found = scan.data.expiry;
        if (found && isValidDate(found)) {
          setExpiry(found);
          toast.show(tpl(a.ocrReadTpl, { bits: a.ocrExpiryFound }), "success");
        } else {
          toast.show(a.ocrUnclear, "info");
        }
      } catch {
        toast.show(a.ocrFailed, "error");
      } finally {
        setScanning(false);
      }
    } catch {
      toast.show(a.imageFailed, "error");
    }
  }

  async function save() {
    if (saving || !doc) return;

    const next = expiry.trim() ? expiry.trim() : null;
    // Kuch badla hi nahi — chup-chaap "save ho gaya" kehna jhooth hai.
    if (next === (doc.expiry ?? null) && !newPhoto) {
      return toast.show(r.nothingChanged, "info");
    }

    // Wahi do alag jawab jo `add-document` par hain: namumkin din, aur galat shakl.
    if (next) {
      if (isImpossibleDay(next)) {
        const [y, m] = next.split("-").map(Number);
        if (y && m >= 1 && m <= 12) {
          return toast.show(
            tpl(a.badDateDay, {
              m: monthName(y, m, locale),
              y: String(y),
              d: String(daysInMonth(y, m)),
            }),
            "error",
          );
        }
        return toast.show(a.badDate, "error");
      }
      if (!isValidDate(next)) return toast.show(a.badDate, "error");
    }

    try {
      setSaving(true);
      const updated = await updateDocument(doc, {
        expiry: next,
        ...(newPhoto ? { file_uri: newPhoto } : {}),
      });

      const expired = !!updated.expiry && isPastDate(updated.expiry);

      /**
       * ⚠️ `scheduleDocumentExpiry` ko HAR soorat me bulana zaroori hai — chahe
       * nayi expiry ho, beeti hui ho, ya bilkul hata di gayi ho.
       *
       * Wo apna pehla kaam `cancelDocumentExpiry` karta hai, yaani PURANE alarm
       * hamesha marte hain. Bina iske sabse bura nateeja banta: user expiry 2026
       * se 2028 kar de, aur 2026 wale teen alarm phone me pade rehte — reminder
       * us date par bajta jo ab kahin likhi hi nahi hai.
       *
       * Permission sirf tab maangte hain jab sach me kuch lagne wala ho. Beeti hui
       * ya hata di gayi expiry par prompt dena user se aisi cheez maangna hai
       * jiska yahan koi kaam hi nahi.
       */
      let notifOk = true;
      if (updated.expiry && !expired) notifOk = await ensureNotifPermission();
      await scheduleDocumentExpiry(updated.id, updated.name, updated.expiry);

      logEvent("document_renewed", { type: updated.type });
      // Documents tab, Home ka "Dhyan dena hai" — dono khule pade ho sakte hain.
      emitDataChanged();

      toast.show(
        !updated.expiry
          ? r.savedNoExpiry
          : expired
            ? r.savedExpired
            : notifOk
              ? r.saved
              : r.savedNoNotif,
        !updated.expiry || expired || !notifOk ? "info" : "success",
      );

      // Wahi reliability check jo add-document par hai — nayi expiry ki khabar
      // sach me pahunche, iske liye permission/battery/OEM sab ek jagah.
      if (updated.expiry && !expired && (await shouldShowReliabilityPrompt())) {
        setPermModal(true);
        return;
      }
      router.back();
    } catch (e) {
      reportError(e, { screen: "document-renew", action: "save" });
      toast.show(r.saveFailed, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScreenLoader />
      </SafeAreaView>
    );
  }

  if (!doc) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.missing}>
          <Ionicons name="document-outline" size={40} color={tc.inkSoft} />
          <Text style={styles.missingText}>{r.notFound}</Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.save, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.saveText}>{cm.back}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Comparison card ke liye — kya sach me badla hai.
   *
   * ⚠️ `doc` ke null check ke BAAD hi, warna har jagah `doc?.` likhna padta aur
   * "kuch badla ya nahi" ka hisaab do jagah alag ho jaata.
   */
  const nextExpiry = expiry.trim();
  const expiryChanged = (nextExpiry || null) !== (doc.expiry ?? null);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{doc.expiry ? r.title : dd.addExpiry}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={tc.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>{r.sub}</Text>

          {/**
           * Naam + type — dikhte hain, badalte nahi.
           *
           * ⚠️ Ye card ek TextInput ki tarah nahi dikhna chahiye. Agar ye input
           * jaisa lage aur tap par kuch na ho, to user ko lagta hai app tooti
           * hui hai. Isliye tala saaf dikhta hai aur neeche wajah likhi hai.
           */}
          <View style={styles.lockedCard}>
            <View style={styles.lockedRow}>
              <View style={styles.lockedIcon}>
                <Ionicons name={iconForType(doc.type) as never} size={20} color={tc.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockedName} numberOfLines={2}>
                  {doc.name}
                </Text>
                <Text style={styles.lockedType}>{labelForType(doc.type)}</Text>
              </View>
              <Ionicons name="lock-closed" size={16} color={tc.inkSoft} />
            </View>
            <Text style={styles.lockedNote}>{r.lockedNote}</Text>
          </View>

          {/**
           * "Pehle ye tha — ab ye hai" — do khaane, saath-saath.
           *
           * ⚠️ Iske bina ye screen ek khaali form thi. User ek cheez badal raha
           * hai (date, aur kabhi photo), par usse kabhi saamne dikhta hi nahi tha
           * ki purana kya tha aur naya kya ban raha hai. Renew me wahi ek sawaal
           * sabse zyada poocha jaata hai — "sahi date daali kya?" — aur uska
           * jawab yahan ek nazar me mil jaata hai.
           *
           * Dono tarah ke documents par dikhta hai: jiski expiry hai usme date
           * badalti dikhti hai, aur jiski nahi hai (Aadhaar/PAN) usme "Expiry
           * nahi → nayi date" ka safar. Kisi ek ke liye chhupa dena us doosre ko
           * adhoora chhod deta.
           */}
          <Text style={styles.label}>{r.compareTitle}</Text>
          <View style={styles.compareCard}>
            <View style={styles.compareRow}>
              {/* Pehle */}
              <View style={styles.compareCol}>
                <Text style={styles.compareLabel}>{r.beforeLabel}</Text>
                {oldPhoto ? (
                  <Image source={{ uri: oldPhoto }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="document-outline" size={22} color={tc.inkSoft} />
                  </View>
                )}
                <Text style={styles.compareDate} numberOfLines={2}>
                  {doc.expiry ? formatDate(doc.expiry, locale) : r.noExpiryShort}
                </Text>
              </View>

              <View style={styles.arrowWrap}>
                <Ionicons name="arrow-forward" size={16} color={tc.terracotta} />
              </View>

              {/* Renew ke baad */}
              <View style={styles.compareCol}>
                <Text style={[styles.compareLabel, styles.compareLabelNew]}>{r.afterLabel}</Text>
                {newPhoto ? (
                  <Image
                    source={{ uri: newPhoto }}
                    style={[styles.thumb, styles.thumbNew]}
                    resizeMode="cover"
                  />
                ) : oldPhoto ? (
                  /* Nayi photo nahi li — wahi purani chalegi. Use halka rakhte
                     hain, warna do bilkul ek jaisi photo dekh ke user ko lagta
                     hai ki usne kuch badal diya hai. */
                  <Image
                    source={{ uri: oldPhoto }}
                    style={[styles.thumb, styles.thumbSame]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="document-outline" size={22} color={tc.inkSoft} />
                  </View>
                )}
                <Text
                  style={[styles.compareDate, expiryChanged && styles.compareDateNew]}
                  numberOfLines={2}
                >
                  {nextExpiry
                    ? isValidDate(nextExpiry)
                      ? formatDate(nextExpiry, locale)
                      : nextExpiry
                    : r.noExpiryShort}
                </Text>
                {!newPhoto && <Text style={styles.sameTag}>{oldPhoto ? r.samePhoto : r.noPhoto}</Text>}
              </View>
            </View>

            {/* Photo badalne ke button — card ke andar hi, kyunki wo isi
                comparison ka doosra hissa hai. */}
            <View style={styles.photoBtns}>
              <Pressable
                onPress={() => pickImage("camera")}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="camera" size={17} color={tc.white} />
                <Text style={styles.sBtnText}>{a.camera}</Text>
              </Pressable>
              <Pressable
                onPress={() => pickImage("gallery")}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtnAlt, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="images" size={17} color={tc.terracotta} />
                <Text style={styles.sBtnAltText}>{a.gallery}</Text>
              </Pressable>
              {!!newPhoto && (
                <Pressable
                  onPress={() => setNewPhoto(null)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.undo, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="arrow-undo" size={14} color={tc.inkSoft} />
                  <Text style={styles.undoText}>{r.photoUndo}</Text>
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.hint}>{r.scanExpiryOnly}</Text>

          {/* Nayi expiry — is poori screen ki asli baat. */}
          <Text style={styles.label}>{r.expiryLabel}</Text>
          {/* Type nahi, chuno — wajah `components/date-field.tsx` me poori likhi
              hai (ISO har desh me alag padha jaata hai). */}
          <DateField
            value={expiry}
            onChange={setExpiry}
            placeholder={a.expiryPlaceholder}
            invalid={expiryPast}
          />

          {/* Wahi chaar haal jo add-document par hain — ek hi baat do jagah do
              tarah se dikhna sabse zyada uljhata hai. */}
          {!expiry.trim() ? (
            <View style={styles.noteCard}>
              <View style={styles.noteHead}>
                <Ionicons name="information-circle" size={15} color={tc.inkSoft} />
                <Text style={styles.noteHeadText}>{a.noExpiryTitle}</Text>
              </View>
              <Text style={styles.noteBody}>{a.noExpiryBody}</Text>
            </View>
          ) : isImpossibleDay(expiry) ? (
            <View style={styles.pastWarn}>
              <Ionicons name="alert-circle" size={15} color={tc.danger} />
              <Text style={styles.pastWarnText}>{dayError(expiry, locale, a.badDateDay, a.badDate)}</Text>
            </View>
          ) : expiryPast ? (
            <View style={styles.pastWarn}>
              <Ionicons name="alert-circle" size={15} color={tc.danger} />
              <Text style={styles.pastWarnText}>{a.expiryPast}</Text>
            </View>
          ) : plan.length > 0 ? (
            <View style={styles.planCard}>
              <View style={styles.noteHead}>
                <Ionicons name="notifications" size={14} color={tc.terracotta} />
                <Text style={styles.planHeadText}>{a.notifyPlanTitle}</Text>
              </View>
              {plan.map((step) => (
                <View key={step.lead} style={styles.planRow}>
                  <Ionicons
                    name={step.willFire ? "checkmark-circle" : "remove-circle-outline"}
                    size={15}
                    color={step.willFire ? tc.sage : tc.inkSoft}
                  />
                  <Text style={[styles.planText, !step.willFire && styles.planTextOff]}>
                    <Text style={styles.planWhen}>
                      {step.lead === 0
                        ? a.notifyPlanOnDay
                        : tpl(a.notifyPlanLead, { n: String(step.lead) })}
                    </Text>
                    {"  "}
                    {formatDate(toIsoDate(step.at), locale)}
                    {step.willFire ? `, ${a.notifyPlanAtTime}` : ` — ${a.notifyPlanPassed}`}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Expiry galti se lag gayi ho (Aadhaar par koi date) to hatane ka rasta. */}
          {!!expiry.trim() && (
            <Pressable
              onPress={() => setExpiry("")}
              hitSlop={8}
              style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close-circle-outline" size={15} color={tc.inkSoft} />
              <Text style={styles.clearText}>{r.clearExpiry}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        onPress={save}
        disabled={saving || scanning}
        style={({ pressed }) => [styles.save, (pressed || saving) && { opacity: 0.85 }]}
      >
        <Text style={styles.saveText}>{r.save}</Text>
      </Pressable>

      <LoaderOverlay visible={scanning || saving} />

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

/** "2027-02-29" ki asli wajah — format nahi, DIN. (`add-document` me bhi yahi.) */
function dayError(s: string, appLocale: string, tplDay: string, fallback: string): string {
  const [y, m] = s.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return fallback;
  return tpl(tplDay, { m: monthName(y, m, appLocale), y: String(y), d: String(daysInMonth(y, m)) });
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
  title: { flex: 1, fontSize: 22, fontWeight: "700", color: c.ink },
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
  sub: { fontSize: 14, lineHeight: 21, color: c.inkSoft },

  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  missingText: { fontSize: 15, color: c.inkSoft, textAlign: "center" },

  lockedCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 14,
  },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lockedIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  lockedName: { fontSize: 16, fontWeight: "700", color: c.ink },
  lockedType: { marginTop: 2, fontSize: 12.5, color: c.inkSoft, fontWeight: "600" },
  lockedNote: {
    marginTop: 11,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: c.line,
    fontSize: 12.5,
    lineHeight: 18.5,
    color: c.inkSoft,
  },

  label: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
    color: c.ink,
  },
  hint: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },

  compareCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  compareRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  compareCol: { flex: 1, alignItems: "center", gap: 8 },
  compareLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  compareLabelNew: { color: c.terracotta },
  /**
   * Thumbnail — `aspectRatio` se, tay height se nahi. Document ki photo kabhi
   * chaudi hoti hai (licence) aur kabhi lambi (passport ka page); dono ko ek hi
   * chaukor me `cover` karne se wo bhadde tarike se kat-te hain.
   */
  thumb: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 128,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
  },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  /** Nayi photo — hara border, taaki badlaav saaf dikhe. */
  thumbNew: { borderColor: c.sage, borderWidth: 2 },
  /** Wahi purani photo — halki, warna do ek jaisi photo bhram paida karti hain. */
  thumbSame: { opacity: 0.45 },
  compareDate: { fontSize: 13, fontWeight: "700", color: c.inkSoft, textAlign: "center" },
  /** Badli hui date — usi hare rang me jo nayi photo par hai. */
  compareDateNew: { color: c.sage },
  sameTag: { fontSize: 11, color: c.inkSoft, fontStyle: "italic" },
  arrowWrap: {
    height: 30,
    width: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
    marginHorizontal: 6,
  },

  photoBtns: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  sBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 15,
    backgroundColor: c.terracotta,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sBtnText: { color: c.white, fontWeight: "700", fontSize: 14 },
  sBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.terracotta,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sBtnAltText: { color: c.terracotta, fontWeight: "700", fontSize: 14 },
  undo: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12, padding: 4 },
  undoText: { fontSize: 12.5, fontWeight: "700", color: c.inkSoft },

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
  inputPast: { borderColor: c.danger, backgroundColor: "rgba(178,59,59,0.07)" },

  pastWarn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  pastWarnText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: "600", color: c.danger },

  noteHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  noteHeadText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  noteCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 14,
  },
  noteBody: { fontSize: 13, lineHeight: 19.5, color: c.inkSoft },

  planCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.sage,
    backgroundColor: "rgba(124,138,107,0.08)",
    padding: 14,
  },
  planHeadText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: c.terracotta,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  planRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 7 },
  planText: { flex: 1, fontSize: 13, lineHeight: 19, color: c.ink },
  planWhen: { fontWeight: "700" },
  planTextOff: { color: c.inkSoft, textDecorationLine: "line-through" },

  clear: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
    paddingVertical: 8,
  },
  clearText: { fontSize: 13.5, fontWeight: "700", color: c.inkSoft },

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
