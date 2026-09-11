import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

import { KeyboardView } from "@/components/keyboard-view";
import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import { reportError } from "@/lib/report-error";
import {
  addDocument,
  DocLimitError,
  keepOnPhone,
  uploadDocumentFile,
} from "@/lib/documents";
import { ConfirmModal } from "@/components/confirm-modal";
import { ensureNotifPermission, scheduleDocumentExpiry } from "@/lib/notifications";
import { checkReferralQualification } from "@/lib/plan";
import { scanDocumentAI } from "@/lib/ai";
import { withoutLock } from "@/lib/app-lock";
import { fileSizeBytes } from "@/lib/storage";
import {
  intakeVerdict,
  isPdf,
  normalizeMime,
  type IntakeVerdict,
} from "@/utils/doc-intake";
import { logEvent } from "@/lib/analytics";
import { markFirstDocument } from "@/lib/reviews";
import {
  expiryCatchUp,
  expiryNotifyPlan,
  isImpossibleDay,
  isPastDate,
  isValidDate,
  type ExpiryNotifyStep,
} from "@/utils/expiry";
import { iconForType, labelForType } from "@/theme/status";
import { useToast } from "@/components/toast";
import { PermissionModal } from "@/components/permission-modal";
import { shouldShowReliabilityPrompt } from "@/lib/reliability";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { DateField } from "@/components/date-field";
import { daysInMonth, formatDate, monthName, toIsoDate } from "@/utils/date-format";

/**
 * "2027-02-29" par asli wajah ke tukde — format nahi, DIN.
 *
 * ⚠️ Ye is screen ki sabse chhupi hui galti thi. Aisi date poore client se nikal
 * jaati thi (JavaScript din ke overflow ko chup-chaap 1 March bana deta hai) aur
 * Postgres ke `date` column par jaake girti thi — jahan hamare paas sirf ek
 * bebuniyad "Save nahi ho paya" bacha tha. User ne sahi format hi likha tha,
 * isliye wo error uske liye bilkul bekaar tha.
 *
 * `null` = mahina hi galat hai (jaise `2027-13-01`). Wo sach me format ki baat
 * hai, isliye wahan purana `badDate` hi theek message hai.
 */
function impossibleDayParts(
  s: string,
  appLocale: string,
): { m: string; y: string; d: string } | null {
  const [y, m] = s.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return {
    m: monthName(y, m, appLocale),
    y: String(y),
    d: String(daysInMonth(y, m)),
  };
}

/**
 * ⚠️ Yahan pehle `persistImage()` tha — file app ke apne folder me copy hoti thi,
 * upload se PEHLE. Wo hata diya gaya.
 *
 * Ab offline copy `primeCachedFile()` banata hai, aur wo R2 par chadhne ke BAAD
 * chalta hai (`uploadDocumentFile`). Yaani device par file tabhi baithti hai jab
 * wo cloud par pahunch chuki ho — ya jab user ne khud "Phone par rakho" kaha ho.
 * Picker ki file OS ke apne cache me padi hi hoti hai; use pehle se copy karne ki
 * zaroorat kabhi thi hi nahi, aur wahi copy "cloud par gaya ya nahi" wale sawaal
 * ko chhupa deti thi.
 */

export default function AddDocument() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { addDocument: d } = useT();
  const { locale } = useLocale();
  const [imageUri, setImageUri] = useState<string | null>(null);
  /**
   * Picker se aayi file — jaisi hai waisi.
   *
   * ⚠️ Yahan pehle `savedUri` tha: file app ke apne folder me copy ho jaati
   * thi (`persistImage`), upload se PEHLE. Ab wo copy R2 par chadhne ke BAAD
   * banti hai (`uploadDocumentFile`), isliye yahan sirf picker ka apna rasta
   * rakha jaata hai.
   */
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState("image/jpeg");
  /** Aakhri scan ka faisla — Save yahi dekh kar rukta ya chalta hai. */
  const [verdict, setVerdict] = useState<IntakeVerdict | null>(null);
  /**
   * Document ban gaya par file cloud par nahi pahunchi — user ka jawab baaki.
   *
   * Jab tak ye bhara hai, screen band nahi hoti. Yahi is poore badlav ki jaan
   * hai: pehle ye soorat CHUP thi aur document chupchaap sirf phone par reh
   * jaata tha.
   */
  const [pendingDoc, setPendingDoc] = useState<{
    id: string;
    uri: string;
    mime: string;
  } | null>(null);
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
  /**
   * Is expiry par khabar kab-kab aayegi — user ko SAVE se pehle dikhane ke liye.
   *
   * ⚠️ Ye poori screen ka sabse bada khaali hissa tha. Document daalne ka maqsad
   * hi ye hai ki "waqt par bata dena", par app kabhi ye batati nahi thi ki
   * "waqt par" ka matlab kya hai. User ko na ye pata chalta tha ki khabar 7 din
   * pehle aayegi, na ye ki subah 9 baje, aur na hi ye ki 3 din baad expire hone
   * wale document par "7 din pehle" wala qadam beet hi chuka hai.
   *
   * Ginti `expiryNotifyPlan()` karta hai — wahi function jise
   * `scheduleDocumentExpiry()` bhi use karta hai. Isliye jo yahan likha hai,
   * phone par theek wahi hota hai.
   */
  const [plan, setPlan] = useState<ExpiryNotifyStep[]>([]);
  /**
   * Ladder ke teenon qadam beet chuke hain, par document AAJ HI expire ho raha
   * hai — Saathi phir bhi bataayega, bas thodi der me.
   *
   * ⚠️ Ye line is screen ki sabse zaroori line hai jab document dopahar ko daala
   * jaata hai. Us soorat me pehle teen KATI hui lines dikhti thi aur bas — user
   * ke liye uska matlab seedha "kuch nahi aayega" tha, aur wo sach bhi tha
   * (alarm sach me ek bhi nahi lagta tha). Ab wo alert lagta hai, aur wo baat
   * yahan Save se PEHLE dikhni chahiye — warna badlaav hone par bhi user ko
   * bharosa wahi purana rahega.
   */
  const [catchUp, setCatchUp] = useState(false);
  useEffect(() => {
    const check = () => {
      setExpiryPast(isPastDate(expiry));
      setPlan(isValidDate(expiry) ? expiryNotifyPlan(expiry) : []);
      // Yahan `addedAt` "abhi" hi hai — document abhi bana nahi hai. Save par
      // asli `created_at` chala jaata hai, aur wo isi lamhe ke aas-paas ka hota
      // hai, isliye screen aur phone ek hi baat kehte hain.
      setCatchUp(isValidDate(expiry) ? expiryCatchUp(expiry) !== null : false);
    };
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

  /**
   * Chuni hui file ko lena — camera aur "Chuno", dono yahin aate hain.
   *
   * ⚠️ Size ki rok YAHIN lagti hai, `save()` par nahi. Do wajah: badi file par AI
   * chalana bekaar ka kharcha hai (Gemini PDF ke har page ka alag paisa leta
   * hai), aur user ko rok ki khabar ABHI milni chahiye — naam aur expiry bhar
   * lene ke baad nahi.
   */
  async function intake(uri: string, mime: string, bytes: number) {
    setImageUri(uri);
    setPickedUri(uri);
    setPickedMime(mime);

    const size = intakeVerdict({ bytes, failure: null });
    if (!size.save) {
      setVerdict(size);
      setScanned(true);
      return toast.show(d.fileTooBig, "error");
    }

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
       *
       * ⚠️ base64 ab FILE se padha jaata hai, picker ke `asset.base64` se nahi.
       * `DocumentPicker` base64 deta hi nahi, aur PDF isi raaste se aati hai.
       * (Isi wajah se `ImagePicker` ka `base64: true` bhi hata diya — wo ab
       * bekaar ka kaam tha aur badi photo par yaad kha jaata tha.)
       */
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      const scan = await scanDocumentAI(base64, locale, mime);

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
       * ⚠️ Aur `unclear` ab sirf ek line nahi — wo ROK hai. Wahi iklauti soorat
       * hai jisme AI SACH ME chala aur usme kuch mila hi nahi, yaani wo selfie
       * ya ghar ki photo hai. Us par "details khud daal do" kehna ab jhooth
       * hota, kyunki hum use save kar hi nahi rahe.
       */
      if (!scan.ok) {
        setScanned(true);
        const v = intakeVerdict({ bytes, failure: scan.failure });
        setVerdict(v);
        if (v.note === "noDocument") toast.show(d.ocrNoDocument, "error");
        else if (v.note === "offline") toast.show(d.ocrOffline, "info");
        else if (v.note === "busy") toast.show(d.ocrBusy, "info");
        else toast.show(d.ocrFailed, "error");
        return;
      }
      setVerdict(intakeVerdict({ bytes, failure: null }));

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

      /**
       * ⚠️ Yahan `d.ocrUnclear` jaan-boojh ke bacha hua hai.
       *
       * Ye wo soorat hai jisme AI ne jawab DIYA (`scan.ok`) par usme naam, expiry
       * aur type — teenon khaali the. Ye upar wali `unclear` rok se ALAG hai:
       * dhundhla par ASLI document aksar yahin girta hai. Use rokna user ka sach
       * me kaam ka document rok dena hota, isliye yahan wahi purani baat rehti
       * hai — "khud bhar do".
       */
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
  }

  async function pickCamera() {
    try {
      /**
       * ⚠️ Camera ke poore waqt lock band rehta hai.
       *
       * Yahi wo jagah hai jahan shikayat sabse zyada thi: document ki photo
       * lene camera kholo, wapas aao — aur app PIN maang rahi hai. Camera app
       * ke bahar khulta hai, yaani Saathi background me chali jaati hai; par
       * user ne app CHHODI nahi hai, app hi use bahar bhej rahi hai. Scan me
       * aksar 30-60 second lagte hain (photo lena, crop karna), to purani 60
       * second wali khidki har baar hi kat jaati thi.
       */
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return toast.show(d.cameraPermission, "info");
      const result = await withoutLock(() =>
        ImagePicker.launchCameraAsync({ quality: 0.4, allowsEditing: true }),
      );
      if (result.canceled) return;
      const asset = result.assets[0];
      await intake(asset.uri, "image/jpeg", await fileSizeBytes(asset.uri));
    } catch {
      toast.show(d.imageFailed, "error");
    }
  }

  /**
   * Ek hi picker — photo bhi, PDF bhi.
   *
   * ⚠️ `DocumentPicker` phone ka apna picker kholta hai (Photos + Downloads +
   * Drive, sab ek jagah) — wahi jo WhatsApp/Gmail me attach karte waqt dikhta
   * hai. Alag "PDF" wala button banane ka koi matlab nahi tha: user ko pehle se
   * pata nahi hota ki uski cheez kis daraaz me padi hai.
   *
   * ⚠️ Image aane par use DABAYA jaata hai. `ImagePicker` ye `quality: 0.4` se
   * khud kar deta tha; `DocumentPicker` nahi karta. Bina ise kiye phone ki aam
   * 8MB wali photo 5MB ki rok me atak jaati — yaani user apna ASLI document daal
   * hi na paata, aur wajah use kabhi samajh na aati. PDF ko haath nahi lagate.
   */
  async function pickFile() {
    try {
      const res = await withoutLock(() =>
        DocumentPicker.getDocumentAsync({
          type: ["image/*", "application/pdf"],
          copyToCacheDirectory: true,
          multiple: false,
        }),
      );
      if (res.canceled) return;
      const asset = res.assets[0];
      /**
       * ⚠️ mime yahin saaf hota hai. `DocumentPicker` use `; charset=...` ke
       * saath de sakta hai, aur `doc-file-name.ts` ka `extForMime()` sirf theek
       * `application/pdf` pehchanta hai — bina saaf kiye PDF cache me `.jpg` naam
       * par baith jaati aur wahan dhoondhi hi nahi jaati.
       */
      const mime =
        normalizeMime(asset.mimeType) ||
        (asset.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

      if (isPdf(mime)) {
        return intake(asset.uri, mime, asset.size ?? (await fileSizeBytes(asset.uri)));
      }

      const ctx = ImageManipulator.manipulate(asset.uri);
      const ref = await ctx.renderAsync();
      const small = await ref.saveAsync({ compress: 0.4, format: SaveFormat.JPEG });
      return intake(small.uri, "image/jpeg", await fileSizeBytes(small.uri));
    } catch {
      toast.show(d.imageFailed, "error");
    }
  }

  async function save() {
    if (saving) return;
    /**
     * Photo ke bina document document hai hi nahi.
     *
     * ⚠️ Ye rok pehle thi hi nahi, aur uska nateeja poore feature ko khokhla kar
     * deta tha: sirf naam aur date bhar ke "document" bann jaata tha. Us row par
     * dekhne ko kuch hota hi nahi — na offline screen par (jo poori tarah save
     * ki hui file par chalti hai), na share/download par, na renew par, aur na
     * admin ke Documents me. Backup ka poora waada (`uploadDocumentImage`) bhi
     * us row par khaali hi baith jaata tha, kyunki bhejne ko kuch tha hi nahi.
     *
     * Aur wo galti chup thi: user ko "Document add ho gaya 🎉" dikhta tha, aur
     * pata mahino baad chalta — theek us din jab use wo document sach me chahiye
     * hota. Jo cheez baad me kabhi bhari nahi ja sakti, use aage badhne se pehle
     * rokna hi sahi hai.
     *
     */
    if (!pickedUri) return toast.show(d.photoRequired, "info");
    /**
     * ⚠️ Yahi wo rok hai jiske liye ye poora kaam hua.
     *
     * `save: false` do soorat me aata hai:
     *
     *   • file 5MB se badi hai, ya
     *   • AI ne use padha aur usme kuch mila hi nahi (selfie, ghar ki photo).
     *
     * Dono me na R2 par kuch jaata hai, na `documents` me row banti hai.
     *
     * ⚠️ Net/Gemini wali soorat me ye KABHI nahi rokta — wahan AI chala hi nahi
     * tha, aur file asli document hoti hai. Wahan rokna user ka apna document
     * use daalne se rok dena hota, aur storage bhi wahan bach nahi raha hota.
     */
    if (verdict && !verdict.save) {
      return toast.show(verdict.note === "tooBig" ? d.fileTooBig : d.ocrNoDocument, "error");
    }
    if (!name.trim()) return toast.show(d.nameRequired, "info");
    /**
     * ⚠️ Do bilkul alag galtiyan, do alag jawab.
     *
     * Pehle dono par "Date format: YYYY-MM-DD" dikhta tha, aur `2027-02-29`
     * wali soorat me wo to yahan tak pahunchti bhi nahi thi — wo chup-chaap paar
     * ho jaati thi aur server par jaake "Save nahi ho paya" banti thi. Ab wajah
     * theek wahi batayi jaati hai jo hai.
     */
    if (expiry.trim()) {
      const parts = isImpossibleDay(expiry) ? impossibleDayParts(expiry, locale) : null;
      if (parts) return toast.show(tpl(d.badDateDay, parts), "error");
      if (!isValidDate(expiry)) return toast.show(d.badDate, "error");
    }
    try {
      setSaving(true);
      const doc = await addDocument({
        name: name.trim(),
        type,
        expiry: expiry || null,
        summary: summary.trim() || null,
        /**
         * ⚠️ Yahan pehle local rasta jaata tha. Ab `null`.
         *
         * Offline copy `uploadDocumentFile()` R2 par chadhne ke BAAD banata
         * hai, aur `resolveDocUri()` sabse pehle wahi cache dekhta hai —
         * isliye `file_uri` ki zaroorat hi nahi rehti. Picker ka temp rasta
         * yahan likh dena ulta nuksan karta: OS us cache ko kabhi bhi saaf
         * kar deta hai, aur DB me ek toota hua rasta pada reh jaata.
         */
        file_uri: null,
      });

      /**
       * Cloud backup — file Cloudflare R2 me (private). PEHLE yahi, device baad me.
       *
       * ⚠️ Ye ab "chalao aur bhool jao" nahi hai, aur na hi chup-chaap kataar me
       * daal kar aage badhna hai. `uploadDocumentFile` seedha chadhata hai aur
       * saaf-saaf batata hai ki chadha ya nahi. Fail hone par hum device par
       * kuch rakhte HI nahi — neeche user se poochha jaata hai.
       *
       * Pehle yahan `.catch(() => {})` tha aur uska nateeja chup tha: document
       * hamesha ke liye sirf us phone par reh jaata tha, aur user ko "add ho gaya"
       * dikh kar khatam. Phone kho jaye to backup ka poora waada wahin toot-ta,
       * aur pata theek us din chalta jab document sach me chahiye hota.
       */
      const uploadOk = await uploadDocumentFile(doc.id, pickedUri, pickedMime);

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
        // `created_at` bhejna zaroori hai — "aaj hi expire" wale document ka
        // catch-up alert usi lamhe se ginta hai (wajah `expiryCatchUp()` par).
        if (notifOk) {
          await scheduleDocumentExpiry(doc.id, doc.name, doc.expiry, doc.created_at);
        }
      }

      logEvent("document_added", { type: doc.type });
      // Referral reward unlock ho sakta hai (document + reminder dono hone pe).
      checkReferralQualification().catch(() => {});
      // Review popup ka padav — document + reminder dono ho jaayein to poochho.
      markFirstDocument().catch(() => {});
      /**
       * Toast wahi kahe jo sach me hua.
       *
       * ⚠️ `addedNoExpiry` yahan naya hai, aur wo ek chup-chaap jhooth ko band
       * karta hai. Bina expiry wale document par `scheduleDocumentExpiry()` kuch
       * lagata hi nahi — par toast phir bhi "Document add ho gaya 🎉" kehta tha,
       * aur user maan leta tha ki ab Saathi khayal rakhega. Aadhaar/PAN par
       * expiry na hona bilkul theek hai; use "sab set hai" bata dena theek nahi.
       *
       * Rok yahan bhi nahi hai — sirf saaf baat.
       */
      /**
       * ⚠️ File cloud par nahi ja payi — yahan RUK jao.
       *
       * Document ban chuka hai aur notification bhi lag chuki hai (wo dono net ke
       * bina bhi sach hain), par file ka thikana abhi tay nahi hua. Isliye "add ho
       * gaya" wala toast yahan jaan-boojh ke nahi dikhta — wo baat modal khud
       * kehta hai, aur screen usi ke jawab par band hoti hai.
       *
       * Reliability wala modal is soorat me chhoot jaata hai. Ye jaan-boojh ke
       * hai: do modal ek ke upar ek sabse uljhan wali cheez hoti hai, aur file ka
       * thikana notification ki jaanch se zyada zaroori hai. Wo jaanch agli baar
       * apne aap aa jaayegi.
       */
      if (!uploadOk) {
        setPendingDoc({ id: doc.id, uri: pickedUri, mime: pickedMime });
        return;
      }

      const noExpiry = !doc.expiry;
      toast.show(
        noExpiry
          ? d.addedNoExpiry
          : expired
            ? d.addedExpired
            : notifOk
              ? d.added
              : d.addedNoNotif,
        noExpiry || expired || !notifOk ? "info" : "success",
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

      <KeyboardView>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo scan — primary */}
          <View style={styles.scanBox}>
            {imageUri && isPdf(pickedMime) ? (
              /**
               * ⚠️ PDF ka preview `<Image>` se nahi ban sakta — wahan sirf ek
               * khaali dabba dikhta hai, aur user ko lagta hai file chuni hi
               * nahi gayi. Wo dobara picker kholta hai, phir dobara… Ek saaf
               * icon aur file ka type usse kahin behtar hai.
               */
              <View style={[styles.preview, styles.pdfPreview]}>
                <Ionicons name="document-text-outline" size={34} color={tc.terracotta} />
                <Text style={styles.pdfPreviewText}>PDF</Text>
              </View>
            ) : imageUri ? (
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
                onPress={pickCamera}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtn, pressed && styles.pressed]}
              >
                <Ionicons name="camera" size={18} color={tc.white} />
                <Text style={styles.sBtnText}>{d.camera}</Text>
              </Pressable>
              <Pressable
                onPress={pickFile}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtnAlt, pressed && styles.pressed]}
              >
                <Ionicons name="images" size={18} color={tc.terracotta} />
                <Text style={styles.sBtnAltText}>{d.pickFile}</Text>
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

          {/**
           * Expiry — ab TYPE nahi hoti, CHUNI jaati hai.
           *
           * ⚠️ Yahan pehle ek `TextInput` tha jiska placeholder `YYYY-MM-DD`
           * tha. Wo shakl sirf computer ki hai: India me log 15/08/2029 likhte
           * hain, America me 08/15/2029, Europe me 15.08.2029 — aur ye app sirf
           * India ke liye nahi hai. Us khaane me "03/11" ka matlab kabhi 3
           * November hota tha aur kabhi 11 March, bina kisi ko pata chale.
           *
           * Picker se wo poora sawaal hi khatam ho jaata hai: user apne phone ki
           * apni shakl me date chunta hai, aur app andar-andar ISO rakhti hai.
           * 29 Feb jaisa namumkin din picker me maujood hi nahi hota.
           */}
          <Text style={styles.label}>{d.expiry}</Text>
          <DateField
            value={expiry}
            onChange={setExpiry}
            placeholder={d.expiryPlaceholder}
            invalid={expiryPast}
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
          {/**
           * Expiry ke chaar haal — aur chaaron ka apna saaf jawab.
           *
           * ⚠️ Pehle yahan sirf EK haal ka jawab tha (beeti hui date). Baaki
           * teen chup the, aur unki chuppi hi asli shikayat thi:
           *
           *   • Khaali expiry — "Aadhaar/PAN add ho gaya 🎉" dikhta tha aur user
           *     maan leta tha ki ab Saathi khayal rakhega. Kuch lagta hi nahi
           *     tha. (Rok yahan bilkul nahi lagayi — Aadhaar/PAN ki expiry hoti
           *     hi nahi, unhe rokna poora feature maar dena hai. Sirf saaf baat.)
           *   • Namumkin din (29 Feb 2027) — Save dabane par bebuniyad "Save
           *     nahi ho paya". Ab wajah yahin, likhte hi.
           *   • Sahi aur aane wali date — app kabhi nahi batati thi ki khabar
           *     kab-kab aayegi. Ab teenon qadam saamne hain.
           */}
          {!expiry.trim() ? (
            <View style={styles.noteCard}>
              <View style={styles.noteHead}>
                <Ionicons name="information-circle" size={15} color={tc.inkSoft} />
                <Text style={styles.noteHeadText}>{d.noExpiryTitle}</Text>
              </View>
              <Text style={styles.noteBody}>{d.noExpiryBody}</Text>
            </View>
          ) : isImpossibleDay(expiry) ? (
            <View style={styles.pastWarn}>
              <Ionicons name="alert-circle" size={15} color={tc.danger} />
              <Text style={styles.pastWarnText}>
                {impossibleDayParts(expiry, locale)
                  ? tpl(d.badDateDay, impossibleDayParts(expiry, locale)!)
                  : d.badDate}
              </Text>
            </View>
          ) : expiryPast ? (
            <View style={styles.pastWarn}>
              <Ionicons name="alert-circle" size={15} color={tc.danger} />
              <Text style={styles.pastWarnText}>{d.expiryPast}</Text>
            </View>
          ) : plan.length > 0 ? (
            <View style={styles.planCard}>
              <View style={styles.noteHead}>
                <Ionicons name="notifications" size={14} color={tc.terracotta} />
                <Text style={styles.planHeadText}>{d.notifyPlanTitle}</Text>
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
                        ? d.notifyPlanOnDay
                        : tpl(d.notifyPlanLead, { n: String(step.lead) })}
                    </Text>
                    {"  "}
                    {formatDate(toIsoDate(step.at), locale)}
                    {step.willFire ? `, ${d.notifyPlanAtTime}` : ` — ${d.notifyPlanPassed}`}
                  </Text>
                </View>
              ))}
              {/**
               * Teenon qadam kate hue hain — par khabar phir bhi aayegi.
               *
               * ⚠️ Iske bina ye card apne hi document par jhooth bolta tha: teen
               * kati hui lines ka matlab user ke liye "kuch nahi aayega" hai,
               * aur wo pehle sach bhi tha. Ab alert lagta hai (`expiryCatchUp`),
               * isliye wo baat yahin dikhni chahiye.
               */}
              {catchUp && (
                <View style={styles.planRow}>
                  <Ionicons name="checkmark-circle" size={15} color={tc.sage} />
                  <Text style={styles.planText}>
                    <Text style={styles.planWhen}>{d.notifyPlanNow}</Text>
                    {"  "}
                    {d.notifyPlanNowSub}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/**
         * ⚠️ Save button `KeyboardView` ke ANDAR — bahar nahi.
         *
         * Bahar hone par wo screen ke sabse neeche baithta tha aur keyboard use
         * poori tarah dhak leta tha. Is screen par ye sabse zyada chubhta hai:
         * document ka naam aur expiry dono yahin type hote hain, yaani keyboard
         * khula hona aam baat hai — aur us poore waqt Save dikhta hi nahi tha.
         * (Wahi tareeka `profile-details`/`contact` par pehle se hai.)
         */}
        {/**
         * ⚠️ Photo na hone par button DIM hai, par `disabled` nahi.
         *
         * Ye farq maayne rakhta hai. Ek mara hua button dabane par kuch nahi
         * hota, aur user ko wajah kabhi pata nahi chalti — wo dobara dabata hai,
         * phir dabata hai, aur maan leta hai ki app hi atak gayi. Dabne par
         * toast saaf keh deta hai ki photo chahiye, aur halka rang wo baat
         * dabane se PEHLE hi ishaare me de deta hai.
         */}
        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [
            styles.save,
            !pickedUri && { opacity: 0.55 },
            (pressed || saving) && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.saveText}>{d.save}</Text>
        </Pressable>
      </KeyboardView>

      {/* Scan + save — dono ke liye wahi ek center overlay loader. */}
      <LoaderOverlay visible={scanning || saving} />

      {/**
        * File cloud par nahi ja payi — faisla user ka.
        *
        * ⚠️ Yahan koi "Radd karo" nahi hai, aur ye jaan-boojh ke hai. Document
        * ban chuka hai; sawaal sirf ye hai ki file kahan rahegi. Teesra button
        * dene ka matlab hota user se poochhna ki wo apna abhi-abhi bana hua
        * document mita de — jo is lamhe me sabse galat sawaal hai.
        */}
      <ConfirmModal
        visible={!!pendingDoc}
        icon="cloud-offline"
        title={d.uploadFailedTitle}
        message={d.uploadFailedMsg}
        confirmLabel={d.uploadKeepOnPhone}
        cancelLabel={d.uploadRetry}
        onConfirm={async () => {
          if (!pendingDoc) return;
          await keepOnPhone(pendingDoc.id, pendingDoc.uri, pendingDoc.mime);
          setPendingDoc(null);
          toast.show(d.onlyOnPhone, "info");
          router.back();
        }}
        onCancel={async () => {
          if (!pendingDoc) return;
          setSaving(true);
          try {
            const ok = await uploadDocumentFile(
              pendingDoc.id,
              pendingDoc.uri,
              pendingDoc.mime,
            );
            if (ok) {
              setPendingDoc(null);
              toast.show(d.added, "success");
              router.back();
            }
            // Phir fail hua to modal khula hi rehta hai — user dobara chun sakta hai.
          } finally {
            setSaving(false);
          }
        }}
      />

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
  pdfPreview: { alignItems: "center", justifyContent: "center", gap: 4 },
  pdfPreviewText: { fontSize: 11, fontWeight: "700", color: c.terracotta, letterSpacing: 0.5 },
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

  /** Sar-naam ki patti — "Expiry nahi di" aur "Saathi kab yaad dilayega", dono. */
  noteHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  noteHeadText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  /**
   * "Expiry nahi di" — chetavni ka rang JAAN-BOOJH KE nahi.
   *
   * Ye galti nahi hai; Aadhaar aur PAN ki expiry hoti hi nahi. Laal border user
   * ko ye lagne deta ki usne kuch galat kiya hai, aur wo isi jhijhak me bekaar
   * ki date bhar deta — jo asli nuksan hai (galat din ka reminder).
   */
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
  /** Beeta hua qadam — dikhta hai, par halka. Chhupana jhooth banta (upar wajah). */
  planTextOff: { color: c.inkSoft, textDecorationLine: "line-through" },
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
