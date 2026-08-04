# Documents bina internet ke (Phase 2)

**Date:** 2026-08-04
**Scope:** `app-mobile` — documents list, view, share, download
**Phase:** 5 me se doosra. Pehla (network status) ho chuka.

---

## Ek line me

Document dekhna, share karna aur download karna — teenon bina internet ke chalein,
har phone par, chahe document kisi aur phone se daala gaya ho.

## Aaj kya toota hua hai

**File to phone par hai, uska pata nahi hai.** `add-document.tsx:34-42` file ko
`documentDirectory/documents/` me copy karta hai — wo permanent hai. Par uska
rasta (`file_uri`) **database** me pada hai, aur `listDocuments()`
(`documents.ts:69`) seedha Supabase hit karta hai. Net na ho to list khaali aati
hai + error toast. File maujood hoti hai, par app ko pata hi nahi chalta ki
kahan.

**Naye phone par file bhi nahi hoti.** `file_uri` us phone ka rasta hai jisne
document banaya tha. Naya phone / dobara install = wo rasta khaali. Sirf cloud
copy (`file_path`) bachti hai, jise dekhne ko internet chahiye.

**Download hai hi nahi.** Sirf Share hai.

**Ek chhupa hua kaanta:** `listDocuments()` `supabase.auth.getUser()` call karta
hai. Wo **network par jaata hai** (JWT server se verify hota hai). Yaani offline
me hum query tak pahunchte hi nahi — uid nikaalte waqt hi gir jaate hain. Isliye
sirf query ko cache karna kaafi nahi hota; uid bhi local se lena padega.

## Design

### Naya: `lib/doc-cache.ts`

Do cheezein cache hoti hain, dono device par:

| Kya | Kahan | Kyun |
|---|---|---|
| List (metadata) | AsyncStorage `saathi-docs:<uid>` | Documents tab offline bhara dikhe |
| Files | `documentDirectory/doccache/<docId>.<ext>` | Har device par khule, offline bhi |

**File cache `file_uri` se ALAG kyun hai** — `file_uri` us ek phone ka purana
rasta hai. Document-id se cache karne par wahi cache har phone par banta hai, aur
"naya phone" wali dikkat apne aap khatam ho jaati hai. Ext `file_path`/`mime_type`
se nikalta hai, isliye rasta bina kisi manifest ke pehle se pata hota hai.

### File dhoondhne ka ek hi raasta

```
resolveDocUri(doc)
  1. cache          → mila to wahi (offline bhi chalta hai)
  2. doc.file_uri   → isi phone ka document, cache bharne se pehle bhi milta hai
  3. signed URL     → sirf net ke saath; download karke cache bhi bhar deta hai
```

`document-view`, `share`, aur `download` — teenon isi ek function se guzrenge.
Abhi teenon ka apna-apna aadha-adhoora logic hai.

### `listDocuments()` cache-first

```
try  → server se lao → cache me likho → background sync chalao → return
catch→ cache se return (khaali nahi, error nahi)
```

Cache bhi na ho tabhi error jaata hai. Screens me koi badlav nahi chahiye —
Documents tab, Home aur chat ka context, sab apne aap offline kaam karne lagte
hain.

uid ab `getSession()` se aayega, `getUser()` se nahi — wo local storage se padhta
hai, network par nahi jaata. RLS server par waise bhi lagta hai, isliye suraksha
me koi farq nahi padta.

### Background sync — "smooth and fast" wali shart

List aane ke BAAD chalta hai, kabhi UI block nahi karta:

- **Nayi 50** (created_at se) apne aap utarti hain
- Jo pehle se cached hain, chhod di jaati hain
- **Ek waqt me 2 file** — poori bandwidth kha ke baaki app ko dheema nahi karta
- Locked documents (free plan ki limit ke baad wale) bilkul nahi
- Fail chup-chaap — agli baar phir koshish ho jaayegi

50 ki chhat isliye: 200 documents wale Plus user ka ~400 MB phone me chala
jaata. Us 50 se purani koi document jab user KHOLTA hai, tab wo cache ho jaati
hai aur uske baad hamesha offline rehti hai.

### Download — Gallery/Downloads me

Naya package `expo-media-library` (57.0.3). `MediaLibrary.saveToLibraryAsync()`
se file phone ki Gallery me chali jaati hai, jahan se user use kisi bhi app me
khol sakta hai.

⚠️ **Ye native module hai — naya build (`eas build`) chahiye.** Baaki sab kuch
(offline list, view, share) purane build par bhi chalega.

Permission na mile to saaf batao aur Share ka raasta khula rakho — Share bina
kisi permission ke chalta hai.

### Safai

- Document delete → uski cached file bhi hatao, metadata cache se bhi nikaalo
- Settings me "Offline documents — 42 MB" + "cache khaali karo"
- Logout par cache hatao (doosre user ka data isi phone par na bache)

## Files

| File | Badlav |
|---|---|
| `src/lib/doc-cache.ts` | **naya** — metadata + file cache, resolve, sync, size/clear |
| `src/lib/documents.ts` | cache-first list, `getSession()`, delete par cache safai |
| `src/lib/share.ts` | cache se resolve (apna logic hata ke) |
| `src/app/document-view.tsx` | cache se resolve + Download button |
| `src/app/(tabs)/documents.tsx` | delete par cached file bhi hatao |
| `src/app/(tabs)/settings.tsx` | offline storage row |
| `src/lib/i18n/dictionaries.ts` | naye strings × 3 bhasha |
| `app.json` | media-library plugin + permission |

## Testing

1. Documents daalo, phir **airplane mode** → list dikhe, document khule, share chale
2. **Naya login / app data clear** → net ke saath list aaye, files background me
   utrein; phir airplane mode → sab khule
3. Download dabao → file Gallery me dikhe
4. Permission mana karo → saaf message, Share phir bhi chale
5. Document delete → cached file bhi hate (Settings me size ghate)
6. 60+ documents → sirf 50 apne aap utrein; 51vi kholne par wo bhi cache ho
7. Sync ke dauraan app smooth rahe — scroll na atke
8. Teeno bhasha me naye strings

## Jo is phase me NAHI hai

- Renew links (Phase 3)
- Dark mode (Phase 4)
- Notification/WhatsApp audit (Phase 5)
- PDF documents — abhi app sirf image documents leti hai
- Web par offline — shikayat sirf mobile ki hai
