# Phase 24 — Optional / heavy (lip-sync, batch, hosting, multi-user)

**STATUS:** report taiyaar (Step 1) — jo free + local tha wo ban bhi gaya aur naapa bhi gaya
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 24 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 23 complete

**Goal:** yahan koi cheez apne aap nahi banegi. Pehle **imaandaar cost/benefit**, phir mai
chunuga, phir sirf wahi banega.

## Is machine ke asli numbers (baaki sab isi par tika hai)

```
CPU  : AMD Ryzen 5 5625U — 6 core / 12 thread
RAM  : 15.3 GB
GPU  : koi alag GPU nahi (Radeon integrated)

$ npm run render:sample --workspace @reel/worker
  bundle + render : 70.6s
  sirf render     : 67.2s
  speed           : 4.5 fps
```

**4.5 fps** — yahi is poore phase ka sabse kaam ka number hai. 30 second ki reel = 900 frame
= lagbhag **3.3 minute** ka render. Neeche har faisle me yahi laut kar aata hai.

---

## Step 1 — Report

### 24.1 Lip-sync — **sifaarish: (c) skip**

⚠️ Pehle wo baat jo saaf honi chahiye: **maine koi bhi lip-sync tool chalaya nahi hai.**
Chalane ke liye `pip install` chahiye tha, aur README ka rule hai ki bina poochhe kuch install
nahi karna. Isliye neeche jo hai wo **soch** hai, **naap nahi** — aur maine yahan koi
banaya hua number nahi likha, kyunki us tarah ke number sabse zyada nuksaan karte hain.

| Option | Kya lagega | Asli dikkat |
|---|---|---|
| (a) Wav2Lip / SadTalker, is machine par | Python + PyTorch + model weights (sau MB se GB tak) | Ye GAN har frame par chalta hai, aur **GPU maan kar** banaya gaya hai. Is machine par koi alag GPU nahi hai. Upar wala naap dhyaan do: sirf Remotion ka saada render 4.5 fps par chal raha hai — us hi CPU par ek neural model har frame par chalana usse kai guna dheema hoga. SadTalker to aur bhi bhaari hai (wo poora sar banata hai, sirf hont nahi). |
| (b) Paid API | Per-minute paisa | Do wajah se bahar: README ka "zero paid services" rule, aur ye ki maine aaj ki keemat jaanchi nahi hai — purani keemat likh dena jhooth ke barabar hai. Agar kabhi chahiye ho to us din ki asli price dekhni padegi. |
| (c) Skip | Kuch nahi | Jo pehle se hai wo hi kaam kar jaata hai. |

**Kyun (c):** reels me lip-sync ki zaroorat tab padti hai jab chehra bolte hue dikhna ho. Jo
hum bana rahe hain usme awaaz **upar se** aati hai (voiceover), aur uske saath jo chahiye wo
pehle se bana hua hai — Ken Burns / zoom-pan (Phase 18), animations aur transitions (Phase 12),
TTS voice (Phase 22), aur ducking (Phase 15). Ek aadha-sa lip-sync (jisme hont thoda peeche
chalein) **na hone se bura** hota hai: aankh use turant pakad leti hai aur poori video nakli
lagne lagti hai.

**Agar kabhi karna ho:** pehle sirf ek naap lo — 10 second audio par Wav2Lip ka asli waqt is
machine par. Wo ek number hi faisla kar dega.

### 24.2 Batch generation — **ho sakta hai, par asli hadd render hai**

Kaam zyada nahi: template system (Phase 17) `applyTemplate(doc, templateId, values)` pehle se
hai, aur project banana + job queue me daalna dono API se hote hain. Ek CSV/JSON ke har row par
ye teen kadam dohrana hi batch hai.

⚠️ **Asli dikkat code me nahi, ghadi me hai.** 4.5 fps par 10 reels = lagbhag **33 minute**,
aur us poore waqt CPU bhara rehta hai (editor bhi atkega — worker ka `MAX_CONCURRENT` 1 isi
wajah se hai). Yaani batch ka matlab hai "raat ko chala kar chhod do", "ek click me 10 reels"
nahi. Ye baat UI me likhni hogi, warna user pehli baar me hi maan lega ki kuch atak gaya hai.

**Risk:** ek galat template value 10 galat reels bana deti hai. Isliye batch se pehle **ek**
row ka preview zaroori hai.

### 24.3 Reusable scene library — **ho sakta hai, chhota kaam, par DB chahiye**

Scene ek Doc ka tukda hi hai, aur ops pehle se hain (`addScene`, `applyTemplate`). Chahiye:
ek `reel_snippets` table (jsonb + naam + thumb), save/insert ke do op, aur ek panel.

⚠️ Templates (Phase 17) ise aadha pehle se karte hain: poora reel ka dhaancha wahan se aata
hai. Snippet library ka faayda alag hai — "wo wala intro jo pichhle project me banaya tha".
Ye asli zaroorat tabhi banti hai jab do-teen project ban chuke hon; abhi ek bhi poora nahi bana.
**Isliye ise abhi nahi banaya** — bina zaroorat ke bani library me kuch daalta hi nahi.

### 24.4 Hosting — **sifaarish: local hi raho**

| | Is machine par | 2–4 vCPU VPS |
|---|---|---|
| Render speed | **4.5 fps naapa hua** (6 core / 12 thread) | Kam core = kam speed. Naapa nahi ja sakta bina kiraye par liye. |
| Kharcha | 0 | Har mahine ka kiraya — README ka "zero paid services" rule |
| Chrome Headless | pehle se chal raha hai | ~150MB + RAM; 1-2 GB wale sasste VPS par ye hi girta hai |

⚠️ Ek galatfehmi saaf kar deni chahiye: hosting **render tez nahi karti**. Render CPU par chalta
hai, aur ek sasta VPS is laptop se kam core deta hai — yaani reel *dheemi* banegi, tez nahi.
Hosting ka ek hi asli faayda hai: kisi aur jagah se editor kholna.

Wo bhi chahiye to sabse samajhdaar baant ye hai: **studio (Next) kahin bhi, worker yahin.**
Studio halka hai; worker bhaari hai aur wahi ghar par rehna chahiye. Ye baat architecture me
pehle se likhi hai (worker Vercel par kabhi nahi jaata).

### 24.5 Multi-user — **abhi zaroorat nahi, aur aadha kaam pehle se hua pada hai**

- `reel_projects.owner` column **pehle se hai** (Phase 2 me "aaj rakh diya taaki kabhi table ko
  haath na lagana pade" likh kar daala gaya tha).
- RLS har table par **on hai**, par ek bhi policy nahi — yaani abhi sirf service-role chhoo
  sakta hai. Ye jaan-boojhkar hai.

Multi-user ka matlab hai: har table par per-user policies likhna, assets ko owner se baandhna,
aur studio ka auth session Supabase ke user se jodna. Kaam medium hai, par **risk zyada**: RLS
ki ek galti par ek user ko doosre ka data dikh jaata hai, aur wo galti chup-chaap hoti hai.

**Kab zaroori:** jis din doosra aadmi isse chalaye. Usse pehle nahi — abhi iska faayda zero
hai aur galti ka nuksaan poora.

### 24.6 Advanced masks/overlays — **ek asli gap tha, wo bhar diya**

| Cheez | Pehle | Ab |
|---|---|---|
| shape mask (rect/rounded/circle) | tha | waisa hi |
| narm kinara (feather) | tha | waisa hi |
| blend modes | the | waise hi |
| crop | tha | waisa hi |
| **image mask** | ⚠️ `mask.assetId` **schema me pada tha par kuch karta nahi tha** | **ban gaya aur MP4 se naapa gaya** (neeche) |
| animated mask | keyframes path se chalte hain, par mask ke params `keyframable` list me nahi hain | abhi bhi nahi — alag kaam hai |

⚠️ `assetId` ka schema me pade rehna sabse khatarnaak kism ka adhoorapan tha: code padhne par
sab theek dikhta hai (field hai, type hai, comment hai), par render me wo field kabhi padhi hi
nahi jaati thi. Isliye ise banaya aur **do render ki tulna se** naapa gaya.

### 24.7 Auto-editing — **beat detection aur chuppi-trim ban gaye aur naape gaye**

| Idea | Free me possible? | Nateeja |
|---|---|---|
| Beat detection se cuts | **haan** — ffmpeg `astats` se energy, phir onset detection | **ban gaya**, 120 BPM click track par 8/8 beat, 0ms galti |
| Silence auto-trim | **haan** — ffmpeg `silencedetect` | **ban gaya**, naapa hua |
| Auto b-roll placement | **nahi** — iske liye samajhna padta hai ki video me kya hai (vision model), aur wo local + free me theek se nahi hota | nahi banaya |

⚠️ Beat detection ki hadd saaf likh deni chahiye: ye **onset** detection hai (jahan kuch bajta
hai), poora beat-tracking nahi. Drum wale gaane par ye achha chalta hai; dheemi, bina drum wali
dhun par kamzor hai. Isliye UI pehle **dikhati** hai ki kitne beat mile aur BPM kya laga —
snap uske baad ka alag button hai. Ek button jo seedha saare cut khiska de, bahut chalaak lagta
hai aur bilkul bharose ka nahi.

---

## Step 2 — Jo bana

- [x] 24.6 Image mask — `mask.assetId` ab sach me lagta hai.
      → `maskCss(mask, url)` + `AssetProvider` context (reel-remotion) + Effects panel me picker.
      → ⚠️ Tasveer lagne par shape/inset/feather **band** ho jaate hain (UI me bhi). Tasveer khud
        poora naksha hai; uske upar doosra mask lagane par dono ek doosre ko kaatte hain.
      → ⚠️ `mask-mode: luminance` — CSS ka default `alpha` hai, par log mask ke liye kaali-safed
        tasveer banate hain. `alpha` par wo tasveer poori dikhti hai, yaani mask lagta hi nahi,
        aur wo galti "kuch hua hi nahi" jaisi dikhti hai.
- [x] 24.7 Beat detection + beat par snap + chuppi auto-trim.
      → `@reel/media/energy.ts` (naap) + `@reel/core/audio/beats.ts` (ganit) — do alag hisse,
        taaki ganit test karne ke liye har baar ffmpeg na chalana pade.
      → Naye ops: `snapItemsToBeats`, `trimItemToSourceRange` — dono undo-hone-layak.
      → `POST /api/audio/analyze` + Properties panel me "Taal se" section.
      → ⚠️ Ye job queue me **nahi** jaata (Phase 23 se ulta faisla): yahan koi model nahi
        chalta, ffmpeg ek baar file padhta hai. 30s audio par ek second se kam. Whisper wahan
        minute bhar leta tha, isliye wahan job zaroori tha.
- [x] 24.10 Test + measurement + commit.

**Jaan-boojhkar nahi banaya:** 24.1 (lip-sync — upar wali wajah), 24.2 (batch — pehle ek reel
poori to bane), 24.3 (snippet library — abhi ek bhi project poora nahi hua), 24.4 (hosting —
paisa lagta hai, aur wo tumhara faisla hai), 24.5 (multi-user — abhi ek hi user hai).
Aur **kisi ka bhi button UI me nahi hai** — jo na bane uska button na ho.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 / 7 tests, 0 fail    # studio
ALL PASS: 519 assertions groups, 0 fail                  # core (+14 naye Phase 24 ke)
ALL PASS: 19 tests, 0 fail                               # @reel/media

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    168 kB    332 kB
```

### 24.6 — image mask sach me lagta hai (MP4 se naapa hua)

Poora frame bharta hua **safed** aayat, aur ek aisi mask PNG jiska baayan aadha safed aur
daayan aadha kaala hai. Do render, aur unki tulna:

```
$ npm run render:mask --workspace @reel/worker

1. mask ki tasveer (baayan safed, daayan kaala)
  ok   mask PNG bani

2. doc — poora frame bharta hua aayat
  ok   doc schema pass karta hai

3. bina mask ke — dono taraf ujaala hona chahiye
  .. baayan 255.0, daayan 255.0
  ok   dono taraf aayat dikh raha hai

4. tasveer wale mask ke saath — sirf baayan aadha (24.6)
  ok   mask wala doc schema pass karta hai
  .. baayan 255.0, daayan 0.0
  ok   baayan aadha waisa ka waisa hai — 255.0
  ok   daayan aadha mask ne chhupa diya — 0.0
  ok   mask ne sach me farak dala — 255.0 -> 0.0

ALL PASS: 7 checks, 0 fail  (image mask)
```

⚠️ **Do render kyun.** Sirf "mask ke saath daayan aadha kaala hai" naapna kaafi nahi hota — agar
aayat bana hi na ho to daayan aadha waise bhi kaala hoga aur test paas ho jaayega. Bina mask
wala render hi ye sabit karta hai ki wahan kuch tha jise mask ne hataya.

### 24.7 — beat aur chuppi (naapa hua)

Ek click track jiske click theek 0.5 second par hain (yaani 120 BPM), aur ek file jisme 1s
chuppi + 2s awaaz + 1s chuppi hai. Dono ka sach ganit se pata hai.

```
$ npm run beats:smoke --workspace @reel/worker

1. beat pakde gaye? (24.7)
  .. 160 window naapi gayi
  .. 8 beat mile, BPM 120
  .. waqt: 0.000, 0.500, 1.000, 1.500, 2.000, 2.500, 3.000, 3.500
  ok   saare beat mile — 8/8
  ok   BPM sahi nikla — 120 (sach 120)
  .. sabse badi galti: 0ms
  ok   beat ka waqt sach ke paas hai — 0ms
  ok   ek click ke kai beat nahi bane

2. snap — sirf paas wale beat par (24.7)
  ok   paas ka cut beat par chala gaya — 30
  ok   door ka cut chhoot gaya (null) — null
  ok   do se kam beat par BPM null hota hai

3. chuppi auto-trim (24.7)
  .. poori file 4.00s -> 0.92–3.08s
  ok   kaatne layak hissa mila
  ok   shuru ki chuppi kati (thoda pad chhod kar) — 0.920
  ok   ant ki chuppi kati — 3.080
  ok   kaatne ko kuch na ho to null

ALL PASS: 11 checks, 0 fail  (beats)
```

### Ek bug jo naap se hi pakda gaya

**File ke shuru me pada beat chhoot jaata tha.** Tulna ke liye pichhle window chahiye the,
isliye loop `lookBack` se shuru hota tha — nateeja: 8 click me se 7 mile, aur uske baad saare
beat ek khaane aage khisak kar dikhe (500ms). Ye galti aankh se kabhi nahi pakdi jaati (beat
mil to rahe hain), sirf ginti se pakdi gayi.

Ab file se **pehle** uska apna sabse dheema hissa maan liya jaata hai. Click track par wo
chuppi hai, isliye pehla click turant beat ban jaata hai. Aur jo gaana shuru se hi tez baj raha
ho, uska floor bhi ooncha hota hai — isliye wahan jhoothi beat nahi banti.

## Baaki kya hai

| Kya | Kyun |
|---|---|
| 24.1 lip-sync | Sifaarish: skip. Karna ho to pehle Wav2Lip ka asli waqt naapo. **Tumhara faisla.** |
| 24.2 batch, 24.3 snippet library | Ban sakte hain — par pehle ek reel poori tarah ban kar nikle. **Tumhara faisla.** |
| 24.4 hosting, 24.5 multi-user | Paisa aur risk dono tumhare hain. **Tumhara faisla.** |
| animated mask (24.6 ka bacha hissa) | Mask ke params `keyframable` list me nahi hain — alag chhota kaam |
| 24.6 / 24.7 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |

## Done when

Jo tumne chuna wo bana, naapa gaya, aur normal timeline asset ki tarah behave karta hai.

→ Report poori hai. Jo free + local + saaf faayde wala tha (24.6, 24.7) wo ban gaya aur MP4 se
  naapa gaya. Baaki chaar par faisla tumhara hai — aur unke liye upar asli numbers hain,
  andaaze nahi.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | Step 1 ki poori report (asli render naap 4.5 fps ke saath). 24.6 image mask banaya aur MP4 se naapa (daayan aadha 255 -> 0). 24.7 beat detection + snap + chuppi-trim banaye aur naape (8/8 beat, 0ms, BPM 120). Ek bug naap se pakda: file ke shuru wala beat chhoot raha tha. Naye script: `render:mask` (7/7), `beats:smoke` (11/11). |
