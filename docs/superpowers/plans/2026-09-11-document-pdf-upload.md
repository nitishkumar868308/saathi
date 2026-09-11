# Document upload — PDF, ek picker, "pehle R2 phir device" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document upload ab PDF bhi leta hai (AI poora padhta hai), ek hi picker se, bematlab photo aur 5MB se badi file rukti hai, aur file pehle R2 par jaati hai — device par baad me.

**Architecture:** Faisle ka saara logic ek shudh module (`src/utils/doc-intake.ts`) me jaata hai jisme na React hai na expo — isliye wo `scripts/check-logic.mjs` me seedha Node par jaanch liya jaata hai (wahi tareeka jo `reminder-bucket` par pehle se hai). Screen sirf us faisle ko dikhati hai. Upload ki tarteeb `lib/documents.ts` me palat-ti hai: R2 pehle, `primeCachedFile` uske baad.

**Tech Stack:** Expo (React Native), TypeScript, Supabase edge function (Gemini), Cloudflare R2. Nayi dependency: `expo-document-picker`, `expo-image-manipulator`.

**Spec:** `docs/superpowers/specs/2026-09-11-document-pdf-upload-design.md`

---

## File Structure

| File | Zimmedari |
|---|---|
| `app-mobile/src/utils/doc-intake.ts` | **Naya.** Shudh faisla: file leni hai ya nahi, PDF hai ya nahi, hadd se badi to nahi. Na React, na expo. |
| `app-mobile/scripts/check-logic.mjs` | Upar wale module ki jaanch (Section 3 jodna hai). |
| `app-mobile/src/lib/open-file.ts` | **Naya.** Local file phone ke apne app me kholna (PDF). |
| `app-mobile/src/lib/i18n/dictionaries.ts` | Nayi lines — teenon bhasha (`hinglish`, `hi`, `en`). |
| `app-mobile/src/lib/documents.ts` | Upload ki nayi tarteeb: `uploadDocumentFile` (R2 pehle) aur `keepOnPhone`. |
| `app-mobile/src/app/add-document.tsx` | Ek picker, PDF ka rasta, dono rok, upload-fail wala sawaal. |
| `app-mobile/src/app/document-renew.tsx` | Wahi sab, renew ke raste par. |
| `app-mobile/src/app/document-view.tsx` | PDF ka card + "Kholo". "Sirf is phone par" ka nishaan. |
| `app-mobile/src/components/offline-screen.tsx` | Uske apne Modal viewer me PDF ka card. |
| `app-mobile/src/components/doc-card.tsx` | "Sirf is phone par" ka chhota badge. |

---

## Task 1: Faisle ka shudh module

**Files:**
- Create: `app-mobile/src/utils/doc-intake.ts`
- Modify: `app-mobile/scripts/check-logic.mjs`

- [ ] **Step 1: Jaanch pehle likho (ye abhi FAIL hogi)**

`app-mobile/scripts/check-logic.mjs` me sabse neeche, `fails` chhapne wale hisse se PEHLE ye jodo:

```js
/* ══════════════════ 3. Document lene ka faisla ══════════════════ */

const { intakeVerdict, isPdf, MAX_FILE_BYTES } = await load("src/utils/doc-intake.ts");

const OK = { bytes: 1000, failure: null };

// ── Selfie: AI chala, kuch mila hi nahi -> ROK.
eq("unclear -> rok", intakeVerdict({ ...OK, failure: "unclear" }), {
  save: false,
  note: "noDocument",
});

// ── Net nahi: AI chala hi nahi -> save hone do. Yahan rokna sabse bada nuksan.
eq("offline -> save", intakeVerdict({ ...OK, failure: "offline" }), {
  save: true,
  note: "offline",
});

// ── Gemini bhara / dheema -> save hone do.
eq("busy -> save", intakeVerdict({ ...OK, failure: "busy" }), { save: true, note: "busy" });
eq("slow -> save", intakeVerdict({ ...OK, failure: "slow" }), { save: true, note: "busy" });

// ── Server ki dikkat -> save hone do.
eq("server -> save", intakeVerdict({ ...OK, failure: "server" }), {
  save: true,
  note: "failed",
});

// ── AI ne theek padha.
eq("ok -> save", intakeVerdict(OK), { save: true, note: "none" });

// ── 5MB SAKHT hadd — theek 5MB chalta hai, usse ek byte upar nahi.
eq("5MB theek", intakeVerdict({ bytes: MAX_FILE_BYTES, failure: null }), {
  save: true,
  note: "none",
});
eq("5MB+1 -> rok", intakeVerdict({ bytes: MAX_FILE_BYTES + 1, failure: null }), {
  save: false,
  note: "tooBig",
});

// ── Badi file par size ki baat PEHLE aati hai — AI to us par chala hi nahi tha.
eq("badi file, unclear -> tooBig", intakeVerdict({ bytes: MAX_FILE_BYTES + 1, failure: "unclear" }), {
  save: false,
  note: "tooBig",
});

// ── PDF pehchano.
eq("pdf", isPdf("application/pdf"), true);
eq("pdf with charset", isPdf("application/pdf; charset=binary"), true);
eq("jpeg pdf nahi", isPdf("image/jpeg"), false);
eq("khaali pdf nahi", isPdf(null), false);
```

- [ ] **Step 2: Chalao aur dekho ki fail hoti hai**

Run: `cd app-mobile && node scripts/check-logic.mjs`

Expected: FAIL — `Cannot find module` ya `ENOENT` (`src/utils/doc-intake.ts` hai hi nahi).

- [ ] **Step 3: Module likho**

`app-mobile/src/utils/doc-intake.ts`:

```ts
/**
 * Document lene ka faisla — ek hi jagah, bina React aur bina expo.
 *
 * ⚠️ Ye file jaan-boojh ke bilkul shudh hai. Wahi wajah jo `reminder-bucket` ke
 * hisaab par likhi hai: iska toota hona CHUP hota hai. Na crash, na error — bas
 * ek selfie R2 par chadh jaati hai, ya net kharab hone par asli Aadhaar rok diya
 * jaata hai. `tsc` in me se ek bhi nahi pakadta, isliye inki jaanch
 * `scripts/check-logic.mjs` se hoti hai.
 */

/**
 * Isse badi koi bhi file na AI ko jaati hai, na R2 par.
 *
 * ⚠️ Ye sirf AI ki hadd nahi hai — upload ki bhi hai. Do wajah ek saath: base64
 * file ko ~33% mota kar deta hai aur edge function ka request utna bada nahi
 * jaata; aur R2 ka free tier 10GB hai, jise ek-do badi file bahut jaldi kha
 * jaati hai.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** AI kis wajah se nahi chala / kya nahi mila. */
export type ScanFailure = "unclear" | "offline" | "busy" | "slow" | "server";

export type IntakeInput = {
  /** File ka size. */
  bytes: number;
  /** AI ka jawab. `null` = theek padha. */
  failure: ScanFailure | null;
};

/**
 * `note` sirf ye batata hai ki screen par kaun si baat kehni hai — rok ka
 * faisla `save` par hai. Dono alag rakhe gaye hain kyunki "save hone do" ke teen
 * alag kaaran hain aur teenon ki baat alag honi chahiye.
 */
export type IntakeNote = "none" | "noDocument" | "tooBig" | "offline" | "busy" | "failed";

export type IntakeVerdict = { save: boolean; note: IntakeNote };

/**
 * Do rok hain, aur unka kram maayne rakhta hai.
 *
 * 1. **Size** sabse pehle. Badi file par AI chala hi nahi tha, isliye uske
 *    `failure` ki baat karna jhooth hoga — user ko "document nahi mila" dikhta
 *    aur wo saaf photo dobara kheenchta rehta, jabki dikkat size ki thi.
 *
 * 2. **`unclear`** — iklauti soorat jisme AI sach me chala aur usne kuch nahi
 *    dhoondha, yaani wo selfie/photo hai.
 *
 * ⚠️ Baaki har soorat me AI chala hi nahi (net gaya, Gemini bhara). Un par rok
 * lagane ka matlab hota ki kharab signal me user ka ASLI document ruk jaye — aur
 * storage wahan bach bhi nahi raha, kyunki wo asli document tha.
 */
export function intakeVerdict(input: IntakeInput): IntakeVerdict {
  if (input.bytes > MAX_FILE_BYTES) return { save: false, note: "tooBig" };
  switch (input.failure) {
    case null:
      return { save: true, note: "none" };
    case "unclear":
      return { save: false, note: "noDocument" };
    case "offline":
      return { save: true, note: "offline" };
    case "busy":
    case "slow":
      return { save: true, note: "busy" };
    default:
      return { save: true, note: "failed" };
  }
}

/** PDF hai kya. `mime` me `; charset=...` laga ho sakta hai, isliye startsWith. */
export function isPdf(mime: string | null | undefined): boolean {
  return (mime ?? "").toLowerCase().startsWith("application/pdf");
}
```

- [ ] **Step 4: Chalao aur dekho ki paas hoti hai**

Run: `cd app-mobile && node scripts/check-logic.mjs`

Expected: saari lines paas, `fails` khaali.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/src/utils/doc-intake.ts app-mobile/scripts/check-logic.mjs
git commit -m "feat(documents): lene ka faisla ek shudh module me — aur uski jaanch"
```

---

## Task 2: Teenon bhasha ki nayi lines

**Files:**
- Modify: `app-mobile/src/lib/i18n/dictionaries.ts`

- [ ] **Step 1: Dekho ki `gallery` key aur kahan use hoti hai**

Run: `cd app-mobile && grep -rn "\.gallery\b" src --include=*.tsx --include=*.ts`

`add-document.tsx` / `document-renew.tsx` ke alawa kahin use ho rahi ho to `gallery` key **mat hatao** — neeche `pickFile` alag key ban rahi hai.

- [ ] **Step 2: Type me nayi keys jodo**

`dictionaries.ts` ke `addDocument` **type** block me (jahan `gallery: string;` line ~497 par hai, uske paas):

```ts
    pickFile: string;
    ocrNoDocument: string;
    fileTooBig: string;
    uploadFailedTitle: string;
    uploadFailedMsg: string;
    uploadRetry: string;
    uploadKeepOnPhone: string;
    onlyOnPhone: string;
    openFile: string;
    openFailed: string;
```

- [ ] **Step 3: `hinglish` ki lines bharo**

`hinglish` ke `addDocument` block me (`gallery: "Gallery",` ke paas):

```ts
    pickFile: "Chuno",
    ocrNoDocument:
      "Isme koi document nahi mila. Saaf photo ya PDF dobara daalo — Saathi documents aur unki expiry ke liye hai.",
    fileTooBig: "File 5MB se badi hai. Isse chhoti file daalo — ya kam page wali PDF.",
    uploadFailedTitle: "Cloud par nahi ja paya",
    uploadFailedMsg:
      "Net kamzor hai. Sirf is phone par rakh lein? Net aate hi apne aap cloud par chala jaayega.",
    uploadRetry: "Dobara koshish",
    uploadKeepOnPhone: "Phone par rakho",
    onlyOnPhone: "Sirf is phone par",
    openFile: "Kholo",
    openFailed: "Koi app nahi mila jo ise khol sake",
```

- [ ] **Step 4: `hi` ki lines bharo**

```ts
    pickFile: "चुनें",
    ocrNoDocument:
      "इसमें कोई डॉक्यूमेंट नहीं मिला। साफ़ फ़ोटो या PDF दोबारा डालिए — साथी डॉक्यूमेंट और उनकी expiry के लिए है।",
    fileTooBig: "फ़ाइल 5MB से बड़ी है। इससे छोटी फ़ाइल डालिए — या कम पेज वाली PDF।",
    uploadFailedTitle: "क्लाउड पर नहीं जा पाया",
    uploadFailedMsg:
      "नेट कमज़ोर है। सिर्फ़ इसी फ़ोन पर रख लें? नेट आते ही अपने आप क्लाउड पर चला जाएगा।",
    uploadRetry: "दोबारा कोशिश",
    uploadKeepOnPhone: "फ़ोन पर रखें",
    onlyOnPhone: "सिर्फ़ इसी फ़ोन पर",
    openFile: "खोलें",
    openFailed: "इसे खोलने वाला कोई ऐप नहीं मिला",
```

- [ ] **Step 5: `en` ki lines bharo**

```ts
    pickFile: "Choose",
    ocrNoDocument:
      "No document found in this. Try a clear photo or PDF — Saathi is for documents and their expiry.",
    fileTooBig: "This file is larger than 5MB. Please pick a smaller file — or a PDF with fewer pages.",
    uploadFailedTitle: "Couldn't reach the cloud",
    uploadFailedMsg:
      "Your connection is weak. Keep it on this phone only? It'll upload by itself once you're back online.",
    uploadRetry: "Try again",
    uploadKeepOnPhone: "Keep on phone",
    onlyOnPhone: "On this phone only",
    openFile: "Open",
    openFailed: "No app found that can open this",
```

- [ ] **Step 6: Jaancho ki teenon bhasha poori hain**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

Expected: koi error nahi. (Ek bhasha me key chhoot jaye to TypeScript wahin pakad lega — isi liye type pehle likha.)

- [ ] **Step 7: Commit**

```bash
git add app-mobile/src/lib/i18n/dictionaries.ts
git commit -m "feat(i18n): document upload ki nayi lines — teenon bhasha me"
```

---

## Task 3: Ek hi picker — camera aur "Chuno"

**Files:**
- Modify: `app-mobile/package.json` (do nayi dependency)
- Modify: `app-mobile/src/app/add-document.tsx`

- [ ] **Step 1: Dono library install karo**

Run: `cd app-mobile && npx expo install expo-document-picker expo-image-manipulator`

Expected: dono `package.json` ke `dependencies` me aa jaayein.

⚠️ `expo-image-manipulator` kyun chahiye: abhi gallery ki photo `ImagePicker` ke `quality: 0.4` se dab kar aati hai. `DocumentPicker` aisa kuch nahi karta — bina ise jode 8MB ki phone photo 5MB wali rok me atak jaati aur user apni hi photo daal na paata.

- [ ] **Step 2: Import jodo**

`add-document.tsx` ke upar, `import * as ImagePicker from "expo-image-picker";` ke paas:

```ts
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { intakeVerdict, isPdf, type IntakeVerdict } from "@/utils/doc-intake";
```

(`expo-file-system` pehle se import hai — `persistImage` use karta hai. Dobara mat likhna.)

- [ ] **Step 3: Nayi state jodo**

`const [savedUri, setSavedUri] = useState<string | null>(null);` ke paas:

```ts
  /** Picker se aayi file — app ke apne folder me copy NAHI hoti (Task 5). */
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  /** Aakhri scan ka faisla — Save yahi dekh kar rukta ya chalta hai. */
  const [verdict, setVerdict] = useState<IntakeVerdict | null>(null);
```

- [ ] **Step 4: `pickImage` ka andar wala hissa `intake()` me nikaalo**

`pickImage` me `const asset = result.assets[0];` ke baad wala SAARA hissa (scan chalana, fail ki wajah batana, fields bharna) ek naye function me le jao:

```ts
  /**
   * Chuni hui file ko lena — camera aur "Chuno", dono yahin aate hain.
   *
   * ⚠️ `bytes` yahin dekha jaata hai, save par nahi. Wajah: badi file par AI
   * chalana bekaar ka kharcha hai (Gemini har page ka alag paisa leta hai) aur
   * user ko rok ki khabar abhi milni chahiye — naam aur expiry bharne ke baad
   * nahi.
   */
  async function intake(uri: string, mime: string, bytes: number) {
    setImageUri(uri);
    setPickedUri(uri);

    const sizeVerdict = intakeVerdict({ bytes, failure: null });
    if (!sizeVerdict.save) {
      setVerdict(sizeVerdict);
      setScanned(true);
      toast.show(d.fileTooBig, "error");
      return;
    }

    setScanning(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      const scan = await scanDocumentAI(base64, locale, mime);

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
      // ...yahan purana "fields bharna" wala hissa jyon ka tyon aata hai
      //    (`const ai = scan.data;` se le kar aakhri `toast.show(...)` tak).
    } catch {
      toast.show(d.ocrFailed, "error");
    } finally {
      setScanning(false);
    }
  }
```

⚠️ `base64` ab hamesha `FileSystem` se aata hai, `asset.base64` se nahi — kyunki `DocumentPicker` base64 deta hi nahi. Isliye `ImagePicker` ke `opts` se `base64: true` **hata do**; wo ab bekaar ka kaam hai aur badi photo par yaad (memory) khaata hai.

⚠️ `d.ocrUnclear` ab yahan **nahi** aata. Purani line ("Padha, par saaf nahi — details khud daal do") user se kehti thi ki wo khud bhar le — ab us soorat me hum save hi nahi kar rahe, isliye wahi line jhooth ban jaati. `d.ocrNoDocument` seedha batata hai ki dobara kya karna hai.

- [ ] **Step 5: Camera ka rasta `intake` par le jao**

`pickImage` ke ant me, `result.assets[0]` milne ke baad (purane `setSavedUri(...)` aur scan wale hisse ki jagah):

```ts
      const asset = result.assets[0];
      const info = await FileSystem.getInfoAsync(asset.uri);
      await intake(asset.uri, "image/jpeg", info.exists ? (info.size ?? 0) : 0);
```

- [ ] **Step 6: `pickFile()` likho**

`pickImage` ke neeche:

```ts
  /**
   * Ek hi picker — photo bhi, PDF bhi.
   *
   * ⚠️ `DocumentPicker` phone ka apna picker kholta hai (Photos + Downloads +
   * Drive, sab ek jagah) — wahi jo WhatsApp/Gmail me attach karte waqt dikhta
   * hai. Alag "PDF" button banane ka koi matlab nahi tha: user ko pehle se pata
   * nahi hota ki uski cheez kis daraaz me padi hai.
   *
   * ⚠️ Image aane par use dabaya jaata hai. `ImagePicker` ye `quality: 0.4` se
   * khud karta tha; `DocumentPicker` nahi karta. Bina ise kiye phone ki aam 8MB
   * wali photo 5MB ki rok me atak jaati — yaani user apni hi asli photo daal na
   * paata. PDF ko haath nahi lagate.
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
      const mime =
        asset.mimeType ??
        (asset.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

      if (isPdf(mime)) {
        const info = await FileSystem.getInfoAsync(asset.uri);
        return intake(asset.uri, mime, info.exists ? (info.size ?? 0) : 0);
      }

      const small = await ImageManipulator.manipulateAsync(asset.uri, [], {
        compress: 0.4,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const info = await FileSystem.getInfoAsync(small.uri);
      return intake(small.uri, "image/jpeg", info.exists ? (info.size ?? 0) : 0);
    } catch {
      toast.show(d.imageFailed, "error");
    }
  }
```

- [ ] **Step 7: Button badlo**

`add-document.tsx` ke `onPress={() => pickImage("gallery")}` ko:

```tsx
                onPress={pickFile}
```

aur uske andar wali `<Text style={styles.sBtnAltText}>{d.gallery}</Text>` ko:

```tsx
                <Text style={styles.sBtnAltText}>{d.pickFile}</Text>
```

- [ ] **Step 8: Type check**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

Expected: koi error nahi. (`savedUri` abhi bhi maujood hai — wo Task 5 me hatega.)

- [ ] **Step 9: Commit**

```bash
git add app-mobile/package.json app-mobile/package-lock.json app-mobile/src/app/add-document.tsx
git commit -m "feat(documents): ek hi picker — photo aur PDF, dono ek jagah se"
```

---

## Task 4: Dono rok — `save()` me

**Files:**
- Modify: `app-mobile/src/app/add-document.tsx`

- [ ] **Step 1: `save()` ke shuru me rok lagao**

`save()` me purani `if (!savedUri) return toast.show(d.photoRequired, "info");` line ko isse **badal do**:

```ts
    if (!pickedUri) return toast.show(d.photoRequired, "info");
    /**
     * ⚠️ Yahi wo rok hai jiske liye ye poora kaam hua.
     *
     * `save: false` do soorat me aata hai: file 5MB se badi hai, ya AI ne use
     * padha aur usme kuch mila hi nahi (selfie, ghar ki photo). Dono me na R2
     * par kuch jaata hai, na `documents` me row banti hai.
     *
     * Net/Gemini wali soorat me ye kabhi nahi rokta — wahan file asli document
     * hoti hai aur AI chala hi nahi tha.
     */
    if (verdict && !verdict.save) {
      return toast.show(verdict.note === "tooBig" ? d.fileTooBig : d.ocrNoDocument, "error");
    }
```

- [ ] **Step 2: Save button ka dim hona `pickedUri` par le jao**

`!savedUri && { opacity: 0.55 }` ko:

```tsx
            !pickedUri && { opacity: 0.55 },
```

- [ ] **Step 3: Type check**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

Expected: koi error nahi.

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/app/add-document.tsx
git commit -m "feat(documents): selfie aur 5MB se badi file ab save hi nahi hoti"
```

---

## Task 5: Pehle R2, uske baad device

**Files:**
- Modify: `app-mobile/src/lib/documents.ts`
- Modify: `app-mobile/src/app/add-document.tsx`

- [ ] **Step 1: `documents.ts` me purana `uploadDocumentImage` hata kar do naye likho**

```ts
/**
 * File pehle R2 par, device par uske BAAD.
 *
 * ⚠️ Ye tarteeb palti hai — pehle ulta tha (`queueUpload` -> `primeCachedFile`
 * -> `flushUploads`). Purani tarteeb ki wajah asli thi: user document tab daalta
 * hai jab wo saamne hota hai — bank ke bahar, RTO ke bahar — jahan signal
 * aata-jaata rehta hai.
 *
 * Par usme ek chhupa hua chhed tha: upload baar-baar fail hota rahe to document
 * HAMESHA ke liye sirf us phone par reh jaata tha, aur user ko khabar hi nahi
 * hoti thi. Admin me wo "Sirf device" pada rehta tha — jo asal me "hum ise kho
 * chuke hain" ka doosra naam hai. Phone gaya, document gaya.
 *
 * Ab fail hone par hum device par CHUPCHAAP kuch nahi rakhte — `false` lautate
 * hain aur screen user se poochhti hai (`keepOnPhone`).
 */
export async function uploadDocumentFile(
  docId: string,
  localUri: string,
  version?: number,
): Promise<boolean> {
  const mime = mimeFromUri(localUri);
  try {
    await uploadDocument(docId, localUri, mime, version);
  } catch {
    return false;
  }
  // R2 par chadh gayi — ab offline ke liye copy rakho.
  await primeCachedFile(docId, localUri, mime, version);
  return true;
}

/**
 * User ne "Phone par rakho" chuna.
 *
 * Qatar me daalo (net aane par apne aap chali jaayegi) aur offline copy bhi
 * rakho. `file_path` tab tak `null` rehta hai — wahi "Sirf is phone par" wale
 * nishaan ki jaan hai.
 */
export async function keepOnPhone(
  docId: string,
  localUri: string,
  version?: number,
): Promise<void> {
  const mime = mimeFromUri(localUri);
  await queueUpload(docId, localUri, mime, version);
  await primeCachedFile(docId, localUri, mime, version);
  await flushUploads();
}
```

- [ ] **Step 2: Purane naam ke istemaal dhoondo**

Run: `cd app-mobile && grep -rn "uploadDocumentImage" src`

Expected: `add-document.tsx` aur `document-renew.tsx` — dono agle steps / Task 9 me badal rahe hain.

- [ ] **Step 3: `add-document.tsx` se `persistImage` aur `savedUri` hatao**

`persistImage` function poora hata do, `savedUri` state hata do, aur uski jagah wajah likh do (`intake()` ke upar):

```ts
/**
 * ⚠️ Yahan pehle `persistImage()` tha — file app ke apne folder me copy hoti
 * thi, upload se PEHLE. Wo ab nahi hai.
 *
 * Ab offline copy `primeCachedFile()` banata hai, aur wo R2 par chadhne ke BAAD
 * chalta hai (`uploadDocumentFile`). Yaani device par file tabhi baithti hai jab
 * wo cloud par pahunch chuki ho — ya jab user ne khud "Phone par rakho" kaha ho.
 * Picker ki file OS ke apne temp cache me rehti hai; use copy karne ki zaroorat
 * hi nahi thi.
 */
```

- [ ] **Step 4: `save()` ka upload wala hissa badlo**

`addDocument({...})` ke call me `file_uri: savedUri` ko `file_uri: null` karo, aur uske baad wale `if (savedUri) { uploadDocumentImage(...).catch(() => {}); }` block ko isse badlo:

```ts
      const ok = await uploadDocumentFile(doc.id, pickedUri);
      if (!ok) {
        // Screen abhi band mat karo — user ka jawab chahiye.
        setPendingDoc({ id: doc.id, uri: pickedUri });
        return;
      }
```

- [ ] **Step 5: Upload-fail wala sawaal jodo**

State (baaki `useState` ke paas):

```ts
  /** Upload fail hua — user se poochhna hai ki phone par rakhein ya nahi. */
  const [pendingDoc, setPendingDoc] = useState<{ id: string; uri: string } | null>(null);
```

JSX me, `<PermissionModal ... />` ke paas:

```tsx
      <ConfirmModal
        visible={!!pendingDoc}
        icon="cloud-offline"
        title={d.uploadFailedTitle}
        message={d.uploadFailedMsg}
        confirmLabel={d.uploadKeepOnPhone}
        cancelLabel={d.uploadRetry}
        onConfirm={async () => {
          if (!pendingDoc) return;
          await keepOnPhone(pendingDoc.id, pendingDoc.uri);
          setPendingDoc(null);
          router.back();
        }}
        onCancel={async () => {
          if (!pendingDoc) return;
          const ok = await uploadDocumentFile(pendingDoc.id, pendingDoc.uri);
          if (ok) {
            setPendingDoc(null);
            router.back();
          }
          // Phir fail hua to modal khula hi rehta hai — user dobara chun sakta hai.
        }}
      />
```

Import badlo:

```ts
import { ConfirmModal } from "@/components/confirm-modal";
import { addDocument, DocLimitError, uploadDocumentFile, keepOnPhone } from "@/lib/documents";
```

- [ ] **Step 6: Type check**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

Expected: `add-document.tsx` me koi error nahi. `document-renew.tsx` me `uploadDocumentImage` ka error aayega — wo Task 9 me hatega.

- [ ] **Step 7: Commit**

```bash
git add app-mobile/src/lib/documents.ts app-mobile/src/app/add-document.tsx
git commit -m "feat(documents): file pehle R2 par, device par uske baad"
```

---

## Task 6: "Sirf is phone par" ka nishaan

**Files:**
- Modify: `app-mobile/src/components/doc-card.tsx`
- Modify: `app-mobile/src/app/document-view.tsx`

- [ ] **Step 1: `doc-card.tsx` me badge jodo**

`<Text style={styles.exp}>{locked ? d.lockedSub : label}</Text>` ke theek neeche:

```tsx
        {!doc.file_path && (
          <View style={styles.phoneOnly}>
            <Ionicons name="phone-portrait-outline" size={10} color={tc.inkSoft} />
            <Text style={styles.phoneOnlyText}>{d.onlyOnPhone}</Text>
          </View>
        )}
```

`useStyles` me:

```ts
  phoneOnly: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  phoneOnlyText: { fontSize: 11, color: tc.inkSoft },
```

⚠️ Nishaan `file_path` par hai, kisi naye column par nahi. `file_path` server tabhi bharta hai jab file sach me R2 par pahunch jaye (`commit`), isliye ye khud hi sach bolta hai — upload hote hi nishaan apne aap hat jaata hai.

`useT()` se `addDocument` ka block chahiye — `doc-card.tsx` me pehle se `const { documents: d, common: c } = useT();` hai, isliye `onlyOnPhone` ko `documents` block me rakho (dono jagah wahi text) ya `useT()` se `addDocument` bhi le lo. **Ek hi jagah rakhna** — dono me copy mat karna.

- [ ] **Step 2: `document-view.tsx` me wahi baat**

Document ke naam wale hisse ke neeche:

```tsx
        {!doc.file_path && <Text style={styles.phoneOnlyLine}>{d.onlyOnPhone}</Text>}
```

`useStyles` me:

```ts
  phoneOnlyLine: { fontSize: 12, color: tc.inkSoft, marginTop: 4 },
```

- [ ] **Step 3: Type check aur commit**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

```bash
git add app-mobile/src/components/doc-card.tsx app-mobile/src/app/document-view.tsx app-mobile/src/lib/i18n/dictionaries.ts
git commit -m "feat(documents): jo document abhi sirf phone par hai, wo ab dikhta hai"
```

---

## Task 7: `document-view` me PDF

**Files:**
- Create: `app-mobile/src/lib/open-file.ts`
- Modify: `app-mobile/src/app/document-view.tsx`

- [ ] **Step 1: PDF kholne wala helper banao**

`app-mobile/src/lib/open-file.ts`:

```ts
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";

/**
 * Local file ko phone ke apne app me kholo.
 *
 * ⚠️ App ke andar PDF viewer jaan-boojh ke nahi banaya. Android ka WebView PDF
 * khud nahi dikhata — wo Google ke viewer par bhejta hai, aur hamari file
 * private signed URL par hai; use bahar bhejna theek nahi. Phone me PDF kholne
 * wala app pehle se hota hai.
 *
 * ⚠️ Android par `file://` seedha nahi diya ja sakta — doosre app ko uski
 * ijaazat nahi hoti. `getContentUriAsync` use `content://` me badal deta hai,
 * aur `flags: 1` (FLAG_GRANT_READ_URI_PERMISSION) use padhne ki ijaazat deta hai.
 *
 * File local hai, isliye ye bina net ke bhi chalta hai — yahi is poore raste ki
 * sabse zaroori baat hai.
 */
export async function openLocalFile(uri: string, mime: string): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      const content = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: content,
        type: mime,
        flags: 1,
      });
      return true;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: mime, UTI: "com.adobe.pdf" });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: `document-view.tsx` me `<Image>` ko do raste do**

`<Image source={{ uri: resolved }} ... />` wale hisse ko isse badlo (`...` ki jagah purani props jyon ki tyon rakho):

```tsx
            {isPdf(doc.mime_type) ? (
              <Pressable
                style={styles.pdfCard}
                onPress={async () => {
                  if (!resolved) return;
                  const ok = await openLocalFile(resolved, "application/pdf");
                  if (!ok) toast.show(d.openFailed, "error");
                }}
              >
                <Ionicons name="document-text-outline" size={40} color={tc.inkSoft} />
                <Text style={styles.pdfName} numberOfLines={2}>
                  {docName}
                </Text>
                <View style={styles.pdfOpen}>
                  <Ionicons name="open-outline" size={14} color={tc.white} />
                  <Text style={styles.pdfOpenText}>{d.openFile}</Text>
                </View>
              </Pressable>
            ) : (
              <Image source={{ uri: resolved }} ... />
            )}
```

⚠️ Zoom wala `onPress={() => setZoom(...)}` PDF par **nahi** lagega — `ImageViewer` PDF nahi dikha sakta, aur khaali kaala screen sabse uljhan wali cheez hoti hai.

- [ ] **Step 3: Purane versions ki list me bhi**

`{uri ? (<Image source={{ uri }} ... />) : (<Ionicons name={...} />)}` wale hisse ko:

```tsx
                        {uri && !isPdf(v.mime_type) ? (
                          <Image source={{ uri }} ... />
                        ) : (
                          <Ionicons
                            name={
                              isPdf(v.mime_type)
                                ? "document-text-outline"
                                : uri === null
                                  ? "cloud-offline-outline"
                                  : "image-outline"
                            }
                            ...
                          />
                        )}
```

- [ ] **Step 4: Style aur import jodo**

```ts
import { isPdf } from "@/utils/doc-intake";
import { openLocalFile } from "@/lib/open-file";
```

`useStyles` me:

```ts
  pdfCard: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 32 },
  pdfName: { fontSize: 14, color: tc.ink, textAlign: "center", paddingHorizontal: 24 },
  pdfOpen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: tc.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pdfOpenText: { color: tc.white, fontSize: 13, fontWeight: "600" },
```

- [ ] **Step 5: Type check aur commit**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

```bash
git add app-mobile/src/lib/open-file.ts app-mobile/src/app/document-view.tsx
git commit -m "feat(documents): PDF ab document-view me khulta hai — phone ke apne app me"
```

---

## Task 8: Offline screen me PDF

**Files:**
- Modify: `app-mobile/src/components/offline-screen.tsx`

- [ ] **Step 1: Modal ke `<Image>` ko badlo**

`{!!viewing && (<Image source={{ uri: viewing.uri }} ... />)}` wale hisse ko:

```tsx
            {!!viewing &&
              (isPdf(viewing.doc.mime_type) ? (
                <Pressable
                  style={styles.pdfCard}
                  onPress={async () => {
                    const ok = await openLocalFile(viewing.uri, "application/pdf");
                    if (!ok) toast.show(ad.openFailed, "error");
                  }}
                >
                  <Ionicons name="document-text-outline" size={44} color={tc.inkSoft} />
                  <Text style={styles.pdfName} numberOfLines={2}>
                    {viewing.doc.name}
                  </Text>
                  <View style={styles.pdfOpen}>
                    <Ionicons name="open-outline" size={14} color={tc.white} />
                    <Text style={styles.pdfOpenText}>{ad.openFile}</Text>
                  </View>
                </Pressable>
              ) : (
                <Image source={{ uri: viewing.uri }} ... />
              ))}
```

Import aur `useT()` badlo:

```ts
import { isPdf } from "@/utils/doc-intake";
import { openLocalFile } from "@/lib/open-file";
```

```ts
  const { network: t, documents: d, addDocument: ad } = useT();
```

`pdfCard`, `pdfName`, `pdfOpen`, `pdfOpenText` — chaaron style is file ke `useStyles` me bhi jodo (Task 7 wali copy).

⚠️ Ye sabse zaroori jaanch hai: file local cache me hai, isliye **bina net ke bhi khulni chahiye**. Offline screen ka poora waada yahi ek cheez hai.

- [ ] **Step 2: Type check aur commit**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

```bash
git add app-mobile/src/components/offline-screen.tsx
git commit -m "feat(documents): offline screen par bhi PDF khulta hai"
```

---

## Task 9: `document-renew` par wahi sab

⚠️ Yahan upload screen me **nahi** hota — wo `updateDocument()` ke andar hai
(`documents.ts:398`), aur wahan fail `.catch(() => {})` me chupchaap nigal liya
jaata hai. Isliye pehla badlav us function me hai, screen me nahi.

**Files:**
- Modify: `app-mobile/src/lib/documents.ts`
- Modify: `app-mobile/src/app/document-renew.tsx`

- [ ] **Step 1: `updateDocument` ab batayega ki file chadhi ya nahi**

`documents.ts` me `updateDocument` ke upar naya return type:

```ts
export type UpdateResult = {
  doc: Document;
  /** File R2 par chadh gayi. Nayi file thi hi nahi, tab bhi `true`. */
  uploadOk: boolean;
  /** `keepOnPhone` ko wahi number chahiye jo upload ne use kiya tha. */
  version?: number;
};
```

`updateDocument` ka signature `Promise<Document>` se `Promise<UpdateResult>` karo.

`const row: { expiry: string | null; file_uri?: string } = ...` wali line ke paas:

```ts
  let uploadOk = true;
```

`documents.ts:398` wali line ko badlo:

```ts
    /**
     * ⚠️ Fail ab CHUP nahi hai.
     *
     * Pehle yahan `.catch(() => {})` tha — upload na chadhne par renew ki nayi
     * file hamesha ke liye sirf us phone par reh jaati thi, aur screen "save ho
     * gaya" keh kar band ho jaati thi. Purani file cloud par padi rehti (jo ab
     * history hai) aur NAYI kahin nahi. Ab ye baat upar jaati hai aur
     * `document-renew` user se poochhta hai.
     */
    uploadOk = await uploadDocumentFile(doc.id, patch.file_uri, nextVersion);
```

Aur aakhir me `return latest;` ko:

```ts
  return { doc: latest, uploadOk, version: nextVersion };
```

- [ ] **Step 2: Screen me naya return padho**

`document-renew.tsx:276` ke `const updated = await updateDocument(doc, {...});` ko:

```ts
      const { doc: updated, uploadOk, version } = await updateDocument(doc, {
        expiry: next,
        ...(newPhoto ? { file_uri: newPhoto } : {}),
      });
```

Aur us `try` block ke ant me, screen band karne se **pehle**:

```ts
      if (!uploadOk && newPhoto) {
        setPendingDoc({ id: doc.id, uri: newPhoto, version });
        return;
      }
```

- [ ] **Step 3: Wahi picker, wahi rok**

`document-renew.tsx` me Task 3 aur Task 4 ke badlav lagao. Yahan `savedUri` nahi, `newPhoto` hai — isliye:

- `intake(uri, mime, bytes)` likho (Task 3 Step 4 wala, bas `setPickedUri` ki jagah `setNewPhoto`).
- `pickFile()` likho (Task 3 Step 6 wala, jyon ka tyon).
- `document-renew.tsx:507` ke `onPress={() => pickImage("gallery")}` ko `onPress={pickFile}`, aur uske `<Text>` me `{d.pickFile}`.
- `pickImage` ka camera wala rasta `intake()` par le jao (Task 3 Step 5).
- `save()` me, `if (saving || !doc) return;` ke theek baad:

```ts
    if (verdict && !verdict.save) {
      return toast.show(verdict.note === "tooBig" ? a.fileTooBig : a.ocrNoDocument, "error");
    }
```

(Yahan `a` = `addDocument` wala dictionary block — is file me wo pehle se `a` naam se aata hai.)

- [ ] **Step 4: `ConfirmModal` jodo**

State:

```ts
  const [pendingDoc, setPendingDoc] = useState<
    { id: string; uri: string; version?: number } | null
  >(null);
```

JSX (Task 5 Step 5 jaisa, bas `version` ke saath):

```tsx
      <ConfirmModal
        visible={!!pendingDoc}
        icon="cloud-offline"
        title={a.uploadFailedTitle}
        message={a.uploadFailedMsg}
        confirmLabel={a.uploadKeepOnPhone}
        cancelLabel={a.uploadRetry}
        onConfirm={async () => {
          if (!pendingDoc) return;
          await keepOnPhone(pendingDoc.id, pendingDoc.uri, pendingDoc.version);
          setPendingDoc(null);
          router.back();
        }}
        onCancel={async () => {
          if (!pendingDoc) return;
          const ok = await uploadDocumentFile(pendingDoc.id, pendingDoc.uri, pendingDoc.version);
          if (ok) {
            setPendingDoc(null);
            router.back();
          }
        }}
      />
```

⚠️ `version` **dono** call me jaana zaroori hai. Bina uske cache ka naam
`<id>.<ext>` banta hai jabki `file_path` `<id>-v3.<ext>` ho jaata hai, aur
abhi-abhi rakhi hui file agli baar "mili hi nahi" gini jaati. Poori wajah
`doc-cache.ts` ke `cachePath()` par likhi hai.

- [ ] **Step 5: Purane naam bache to nahi**

Run: `cd app-mobile && grep -rn "uploadDocumentImage\|persistImage\|savedUri" src`

Expected: khaali.

- [ ] **Step 6: Type check**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

Expected: poore project me koi error nahi.

- [ ] **Step 7: Commit**

```bash
git add app-mobile/src/app/document-renew.tsx
git commit -m "feat(documents): renew par bhi PDF, rok, aur pehle-R2 wali tarteeb"
```

---

## Task 10: Poori jaanch

**Files:** koi badlav nahi — sirf chalana.

- [ ] **Step 1: Logic ki jaanch**

Run: `cd app-mobile && node scripts/check-logic.mjs`

Expected: saari lines paas, `fails` khaali.

- [ ] **Step 2: Type check**

Run: `cd app-mobile && npx tsc --noEmit -p tsconfig.json`

Expected: koi error nahi.

- [ ] **Step 3: Lint**

Run: `cd app-mobile && npm run lint`

Expected: koi nayi warning nahi.

- [ ] **Step 4: Phone par haath se jaancho**

Har ek apni aankh se:

1. **Camera se image** — aaj jaisa hi chale, AI naam/expiry bhare.
2. **"Chuno" se image** — wahi, aur file R2 par dabi hui (5MB se chhoti) chadhe.
3. **3-page PDF** — AI teenon page padhe.
4. **6MB PDF** — save **na** ho, "File 5MB se badi hai" dikhe, R2 par kuch **na** jaaye.
5. **Selfie** — save **na** ho, "Isme koi document nahi mila" dikhe, `documents` me row **na** bane.
6. **Flight mode on karke** — OfflineScreen khule, purana PDF wahan se khul jaaye.
7. **Kamzor signal** — "Cloud par nahi ja paya" wala sawaal aaye; "Phone par rakho" par document bane aur uspar "Sirf is phone par" dikhe; net aane par nishaan khud hat jaye.
8. **Purana image document** — jaisa tha waisa hi khule, kuch toota na ho.
9. **Teenon bhasha** (`hinglish`, `hi`, `en`) — har nayi line apni bhasha me aaye, koi angrezi line beech me na chamke.

- [ ] **Step 5: Aakhri safai**

Run: `git status`

Expected: kuch bacha na ho.
