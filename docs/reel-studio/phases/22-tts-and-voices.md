# Phase 22 — Audio: 3 options (Generate / Upload / Both) + voice cleanup

**STATUS:** cleanup poora aur naapa hua — TTS `pip install edge-tts` par ruka hai
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 22 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 21 complete

**Goal:** har audio slot pe **teen option** (Generate / Upload / Both), aur jo bhi audio aaye
uska cleanup — level, noise, silence, EQ.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 22.1 `AudioSource` model doc me — scene slot aur audio item **dono** isko use karein.
      → `AudioSourceSchema` (`mode`, `text`, `voiceId`, `rate`, `pitch`, `uploadedAssetId`,
        `generatedAssetId`, `primary`, `generatedFromText`, `cleanup`).
      → `item.audio.source` — `null` matlab purana seedha-asset wala raasta (jo abhi bhi
        chalta hai).
- [x] 22.2 UI: teen tab, har tab ka apna form; `both` me primary kaun.
      → **browser me dekha (2026-08-21):** timeline se audio clip chunte hi teeno tab
        saamne aaye — **Upload / Generate / Record**.
      → `AudioSourceSection.tsx`.
      → ⚠️ `both` ka matlab "dono ek saath baja do" **nahi** hai — wo "dono rakho, ek chalao"
        hai. Dono ek saath bajane par wahi baat do awaazon me sunai deti hai.
- [x] 22.3 `TTSProvider`: `listVoices()`, `generateSpeech()`.
      → `@reel/media/voice.ts`. `listVoices()` asli list edge-tts se laata hai aur na mile to
        4 fallback voices deta hai — taaki UI khaali dropdown na dikhaye.
- [x] 22.4 TTS adapter + install steps + na ho to saaf batao.
      → **ho gaya (2026-08-20), aur checklist se aage gaya.** Item me sirf edge-tts likha
      tha; ab **provider seam** hai aur usme **Gemini** bhi juda.

      **Kyun seam:** `voice.ts` seedha edge-tts par jama tha — error ke message me uska
      naam, fallback list me uski voice ids, aur generate karne wala code uske
      command-line flags ke hisaab se. Doosra provider jodne ka matlab hota us poori file
      ko todna. Ab adapter ka ek hi kaam hai: **kacchi awaaz ki file do**. 48kHz stereo me
      badalna, lambai naapna — wo sab ek jagah (`synthesize()`), har provider par ek jaisa.
      Isse Section 3A ka "final audio hamesha 48kHz" wala niyam kisi ek provider ke bhool
      jaane par toot nahi sakta.

      **Asli chalaya (Gemini):**
      ```
      POST /api/tts  {"text":"Mera naam Nitish hai","categoryId":"male"}
      → 200 (8791ms)   cached: false
        provider gemini | voice Charon | 2.69s | temporary | temp/tts/<id>.wav

      $ ffprobe …
        codec_name=pcm_s16le   sample_rate=48000   channels=2   bits_per_sample=16
      ```
      Yaani Gemini ka 24kHz **mono raw PCM** theek ek baar 48kHz stereo me aaya.

      ⚠️ **Ek nazuk cheez, aur uska apna test:** Gemini raw PCM lautata hai aur uska
      sample rate **sirf mime string me** hota hai (`audio/L16;codec=pcm;rate=24000`). Wo
      number ffmpeg ko na do to awaaz **bajti hai — par galat raftaar par**, aur wo galti
      aankh se kabhi nahi dikhti. Isliye `requirePcmMime()` andaaza lagane ke bajay saaf
      error deta hai, aur uske chaar test hain.

      **"Na ho to saaf batao"** ab har provider par lagta hai. `GET /api/tts` ka asli jawab:
      | provider | available | detail |
      |---|---|---|
      | Gemini (Google) | ✅ | `gemini (gemini-2.5-flash-preview-tts)` |
      | edge-tts (muft) | ❌ | `edge-tts nahi mila. Install karo: pip install edge-tts` |
      | Apni awaaz (upload) | ✅ | `apni file upload karo` |

      UI yahi jawab **poochhti** hai — maan kar nahi chalti. Button tabhi dabta hai jab
      koi provider sach me chal sakta ho, aur na dabne par wajah likhi hoti hai.

      **Voice ka chunaav category se hota hai**, provider ki voice id se nahi:
      `Aadmi / Aurat / Ladka (bacha) / Ladki (bachi) / Buzurg aadmi / Buzurg aurat /
      Announcer`. `Charon` ya `hi-IN-MadhurNeural` se koi andaaza nahi lagta ki awaaz
      kaisi hogi, aur wo naam provider badalte hi bematlab ho jaate hain. Chaar category
      chala kar dekhi — chaar alag voices bani (Charon / Kore / Aoede / Fenrir), aur unki
      lambai bhi alag (2.69s / 2.29s / 2.41s / **2.89s** buzurg wali sabse lambi), yaani
      `stylePrompt` sach me asar kar raha hai.

      ⚠️ **Ek hadd jo chhupani nahi chahiye:** Gemini me rate/pitch ka koi parameter hai
      hi nahi — sirf "thoda tez bolo" jaisa nirdesh jaata hai. Slider 1.5x karne par awaaz
      **theek 1.5x tez nahi** hogi. Jise naapi hui raftaar chahiye wo Phase 15 ka speed
      change use kare. Ye code me bhi likha hai.

- [x] 22.4b **Cache — wahi awaaz dobara nahi banwani.**
      → Har generate se pehle maang ka hash banta hai
      (`ttsCacheKey` = provider + voice + text + rate + pitch, sha256) aur DB me dekha
      jaata hai. Naapa hua farak:

      ```
      pehli baar (asli Gemini call)        8791 ms   cached: false
      wahi text dobara                      147 ms   cached: true    ← 60x
      wahi text, alag whitespace            193 ms   cached: true    ← wahi asset
      ```

      Reel banate waqt ek scene ka text 10 baar preview hota hai aur usme se 9 baar text
      bilkul wahi hota hai — bina cache ke wo 9 call ka paisa har baar lagta, aur kisi ko
      pata bhi nahi chalta kyunki dikhne me sab theek chal raha hota.

      ⚠️ **Cache ki key do tarah se galat ho sakti thi, aur dono ke apne test hain:**
      * *bahut sakht* — `0.1 + 0.2` JavaScript me `0.30000000000000004` hota hai. Slider
        se aaya yahi number seedha key me jaata to cache **kabhi** hit nahi karta: har baar
        naya call, har baar paisa, aur dikhne me sab theek. Ab round hota hai.
      * *bahut dheeli* — do alag maangon par ek key. User "kaise ho" maangta aur use "mera
        naam Nitish hai" sunai deta. Ye sabse bura hai kyunki ye khaamosh nahi rehta, **jhooth
        bolta hai**. Isliye provider/voice/rate/pitch sab key ka hissa hain.
      Aur hash se pehle `reel-tts:v1` namespace lagta hai taaki TTS ki key kabhi kisi
      upload ke sha256 se na takraye.

      UI me ye baat user tak pahunchti hai: pehli baar **"Nayi awaaz ban gayi."**, dobara
      **"Pehle se bani hui awaaz mili — koi naya kharcha nahi."**

- [x] 22.5 Voice controls: rate, pitch, volume.
      → Rate (0.5x–2x) aur pitch (±12) schema me aur UI me. edge-tts inhe `+10%` / `-2Hz`
        wali likhawat me leta hai — seedha number bhejne par wo chup-chaap default par chala
        jaata hai aur user ko lagta hai slider kaam nahi kar raha.
      → Per-character default voice (`reel_characters`) **nahi** bana — wo table abhi nahi hai.
- [x] 22.6 A1: 24kHz se 48kHz par **ek hi** resample, soxr se, koi lossy→lossy chain nahi.
      → Ek hi jagah resample hota hai (aakhri encode me), `-resampler soxr` ke saath. Beech ki
        har file PCM WAV hai.
      → Har resample thodi si tez frequency khaata hai — do baar ke baad "s" aur "sh" bhajti
        hai, aur wo sirf sun kar pakda jaata hai.
- [x] 22.7 Cleanup chain **data** ho, hardcoded pipeline nahi.
      → `CLEANUP_STEPS` — 7 kadam (trimSilence, highpass, deesser, noiseReduction, compand,
        normalize, limiter). Kram badla ja sakta hai.
      → ⚠️ **Limiter zabardasti aakhir me jaata hai**, chahe user use kahin bhi rakhe. Uske
        baad kuch bhi lagane par peak dobara upar ja sakta hai aur `-1 dBTP` ka vaada toot
        jaata hai — aur wo vaada Section 3A me likha hai.
      → Shor aur de-esser **default me band** — dono achhi recording ko patla kar sakte hain.
- [x] 22.8 Before/After + LUFS numbers. Chupchaap process karna mana.
      → `cleanupVoice()` **dono taraf** naapta hai aur dono numbers lautata hai. "Cleanup ho
        gaya" ek daawa hai; `-45.3 → -16.0 LUFS` ek saboot hai.
      → Sunne wala A/B browser me hi ho sakta hai; numbers abhi hi mil jaate hain.
- [x] 22.9 Generated audio = normal timeline asset (`temporary` + `expires_at` + R2 `temp/tts/`).
      → **ho gaya (2026-08-20).** Bani hui awaaz aam asset ki tarah aati hai — media
      library me uska card dikhta hai, aur DB me:

      ```
      key        : temp/tts/<assetId>.wav
      lifecycle  : temporary
      expires_at : 7 din baad
      cache_key  : maang ka hash
      tags       : ["tts", "male"]
      ```

      `cleanup` script use theek pehchanti hai:
      ```
      permanent : 10 file, 8.8 MB
      temporary :  4 file, 1.9 MB     ← chaaron TTS ki awaazein
      expire ho chuki : 0             ← 7 din baaki hain
      ```

      ⚠️ **Yahan ek asli bug pakda gaya aur usko dobara hone se roka gaya.** Pehli baar
      file `temp/tts/…` par chadhi thi par row me `permanent/assets/…` likha gaya — kyunki
      `createAsset()` key khud bana raha tha. Ye theek wahi galti hai jiske khilaaf
      `storageKey` ka apna doc-comment chetavni deta hai, aur uske teen nateeje the, teeno
      chup-chaap:
        1. asset kabhi play nahi hoti (URL us key se banta hai jo file hai hi nahi, aur
           error "404" hota hai — "galat key" nahi);
        2. cleanup us permanent path ko dhoondhta hai, nahi milta, aur maan leta hai ki
           kaam ho gaya;
        3. asli `temp/` wali file hamesha ke liye padi rehti hai — theek us jagah jise
           saaf karne ke liye poora lifecycle system banaya gaya tha.

      Sirf theek karne ke bajay ise **namumkin** banaya: naya
      `assertKeyMatchesLifecycle(key, lifecycle)` (core) `createAsset()` me insert se
      **pehle** chalta hai. Galat jodi ab DB tak pahunch hi nahi sakti. Teen test iski
      nigrani karte hain.

- [x] 22.10 Text badalne par "Voice outdated" badge; regenerate sirf usi scene ka.
      → `generatedFromText` field + UI ka amber badge. Iske bina purani awaaz chup-chaap
        chalti rehti hai aur user ko lagta hai regenerate kaam nahi kar raha — jabki usne
        kabhi dabaya hi nahi.
- [x] 22.11 Auto duration sync (voice ki lambai se scene ki lambai).
      → **ban gaya aur chalta hai (2026-08-20).**

      **Core me do cheezein jodi:**

      1. `voiceFrames(seconds, fps)` — aur ye `secondsToFrames()` se **jaan-boojhkar
         alag** hai. Wo `Math.round` karta hai; ye `Math.ceil`. Wajah: 2.004 second ki
         voice 30fps par round hone se 60 frame ban jaati hai, aur aakhri 0.004 second —
         yaani aakhri akshar ki poonchh — **kat jaati hai**. Wo katna **sunai deta hai**
         ("…rakhein" ki jagah "…rakh") par **dikhta kahin nahi** — na timeline par, na kisi
         number me. Ek frame ki khaali jagah kisi ko pata nahi chalti; ek kata hua shabd
         sabko chalta hai.
         Test isi farak ko pakde rakhta hai:
         ```
         secondsToFrames(2.004, 30) → 60
         voiceFrames(2.004, 30)     → 61
         ```

      2. Naya op `syncDurationToVoice({ itemId, durationInFrames })`. Ye **do halat**
         sambhalta hai, aur dono ek hi op me isliye hain ki caller ko yaad na rakhna pade:
         * item kisi **scene** ka hissa ho → **poore scene** ki lambai badalti hai (warna
           awaaz lambi ho jaati aur tasveer pehle khatam hokar kaala frame chhod deti);
         * item **akela** ho → sirf uski apni lambai.

      **UI:** voice banne ke baad button aata hai jispar **asli number** likha hota hai —
      `Lambai isi ke barabar karo — 6.1s · 183 frames`. Browser me dabaya aur clip sach me
      badli:
      ```
      pehle : 00:02:25 → 00:12:25  (300 frames)
      baad  : 00:02:25 → 00:08:28  (183 frames)   ← 6.1s × 30 = 183 (ceil)
      ```
      Start waisa ka waisa raha — sirf lambai badli.

      ⚠️ **Ye apne aap nahi lagta, aur ye faisla hai — chhoot nahi.** User ne clip ki
      lambai khud tay ki ho sakti hai (music ke beat par, ya doosri clip ke saath). Voice
      bante hi use chup-chaap badal dena wahi cheez hai jise "isne mera kaam bigaad diya"
      kaha jaata hai. Button dikhta hai, number dikhta hai, faisla user ka rehta hai.
      Isi wajah se button par "sync" nahi likha — poora number likha hai, taaki dabane se
      pehle pata ho ki kya hoga.

- [x] 22.12 Batch generate.
      → **ban gaya (2026-08-20)** — Audio panel me naya section **"Sab ki awaaz"**
      (`panels/VoiceBatch.tsx`), aur uske peeche core ka pure helper
      `itemsNeedingVoice(doc)` (6 test).

      **List ka sahi hona hi poora feature hai**, isliye wo core me hai aur alag se
      tested hai. Galat list do tarah se mehngi hai:
      * **badi** ho jaaye → wo awaazein dobara banti hain jo pehle se theek hain (paisa);
      * **chhoti** ho jaaye → user "sab bana do" dabata hai, kuch scene chup reh jaate
        hain, aur ye baat **export ke baad** pata chalti hai — jo zyada bura hai.

      Isliye teen shartein: source `generate`/`both` ho, text khaali na ho, aur ya to voice
      bani hi na ho **ya** jo bani ho wo purane text ki ho (wahi 22.10 wali "voice purani
      hai" haalat — batch ka sabse bada faayda yahi hai ki wo un sab ko ek saath pakad leta
      hai).

      **Browser me chalaya:**
      ```
      SAB KI AWAAZ
      3 jagah awaaz banni baaki hai — jinki bani hi nahi, aur jinka text baad me badal gaya.
      [ Sab 3 banao ]

      pehli baar : 1 nayi bani · 0 cache se mili · 2 nahi ban paayi
      dobara     : 2 nayi bani · 0 cache se mili
      ab         : "Abhi kisi scene ki awaaz banni baaki nahi hai."
      ```

      Aur nateeja DB me:
      ```
      "Pehla scene ki awaaz"   → male/Charon    voice 2.21s → clip 67f (2.23s)
      "Doosre scene ki awaaz"  → female/Kore    voice 2.05s → clip 62f (2.07s)
      "Teesre scene ki awaaz"  → male/Charon    voice 2.13s → clip 64f (2.13s)
      ```
      Har clip ki lambai apni voice ke barabar hui, aur hamesha **upar** (`voiceFrames`,
      22.11) — 66.3 → 67, 61.5 → 62, 63.9 → 64.

      ⚠️ **Batch me lambai apne aap lagti hai, single generate me nahi** — aur ye farak
      jaan-boojhkar hai. Batch ka matlab hi "sab theek kar do" hai; dus scene ke liye dus
      baar sync dabana usi kaam ko dobara karna hoga. Har scene ka apna op hai, isliye
      Ctrl+Z scene-dar-scene wapas le jaata hai.

      ⚠️ **Calls ek-ek karke jaate hain, ek saath nahi** — provider rate-limit par 429 deta
      hai, cache ka faayda khatam ho jaata hai (do same text ek saath jaayein to dono nayi
      banti hain), aur fail hone par ye batana namumkin ho jaata hai ki **kaunsi** fail hui.

      ⚠️ **Ek asli baat jo test me nikli: Gemini TTS kabhi-kabhi khaali jawab deta hai.**
      Pehli koshish me 3 me se 2 fail hui — `Gemini se jawab to aaya par usme koi audio
      nahi tha`. Dobara dabane par dono ban gayi, yaani wo **transient** tha (teen tez
      calls par rate limit ya model ka apna behaviour). Isi wajah se batch ka design aisa
      hai: **ek fail par rukta nahi**, ginti alag-alag batata hai, aur baaki items list me
      bache rehte hain — ek click aur, aur kaam poora.

- [x] 22.13 Record-in-browser.
      → **ban gaya (2026-08-20)** — `components/editor/properties/VoiceRecorder.tsx`.
      Ab `Upload` / `Both` tab me file chunne ke saath **"Record karo"** bhi hai:
      `File | Chuno… | Record karo`.

      **Sabse zaroori faisla: recording ek aam upload ban kar jaati hai.** Wahi
      `useUploader`, wahi presign → PUT → complete, wahi `permanent` lifecycle. Isse
      dedup (checksum), ffprobe, waveform thumbnail aur cleanup — sab apne aap mil jaate
      hain. Recording ke liye alag raasta banane par un me se har cheez dobara likhni
      padti, aur ek din unme se koi ek chhoot jaati.

      ⚠️ **Recording `permanent` hai, TTS ki awaaz `temporary`.** Ye farak jaan-boojhkar
      hai: TTS dobara ban sakti hai, user ki apni recording nahi. Dono ko ek jaisa rakhne
      par ek din cleanup kisi ki asli recording utha le jaata, aur wo wapas nahi aati.

      ⚠️ Mic ki ijazat **button dabane par** maangi jaati hai, page khulte hi nahi. Bina
      wajah permission ka popup dikhana sabse jaldi "block" karwata hai, aur ek baar block
      hone par user ko settings me jaana padta hai.

      **Browser me chala kar dekha, aur error wala raasta sach me naapa:** is machine par
      mic hai hi nahi, aur dabane par saaf message aaya —
      **`Mic nahi khul paaya: Requested device not found`** — button wapas "Record karo" ho
      gaya, kisi adhoori recording wali haalat me nahi atka. `NotAllowedError` ke liye alag,
      kaam ka message hai ("browser ke address bar me mic ka nishaan dabao aur allow karo"),
      kyunki browser ka apna message wo baat bilkul nahi samjhata.
      Aur `MediaRecorder` na ho to button dikhta hi nahi — uski jagah "apni file Upload se
      laga do" likha aata hai.

      ⚠️ **Jo naapa nahi ja saka:** asli record → upload wala round trip, kyunki is machine
      par microphone nahi hai. Uske aage ka poora raasta (File → presign → PUT → complete →
      asset) 5.2 me naapa hua hai, kyunki wo bilkul wahi code hai.

- [x] 22.14 Ducking se integration.
      → Phase 15 se hi hai: voice track ko ducking me chun lo, music apne aap neeche aata hai
        (wo 17.30 dB naapa ja chuka hai).
- [x] 22.15 Test: cleanup ka LUFS difference; upload wala raasta.
      → `npm run tts:smoke` — 16 checks. Asli output neeche. TTS wala hissa saaf skip hota hai.
- [x] 22.16 `npm run typecheck` clean. Commit.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 / 7 tests, 0 fail    # studio
ALL PASS: 485 assertions groups, 0 fail                  # core (+13 naye Phase 22 ke)
ALL PASS: 19 tests, 0 fail                               # @reel/media

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    165 kB    327 kB
```

### 22.7 / 22.8 — cleanup sach me chalti hai

Ek jaan-boojh kar kharab awaaz banayi gayi: dheemi, 40 Hz ka rumble, aur dono taraf 1-1
second ki chuppi. Teeno cheezein naapi ja sakti hain.

```
$ npm run tts:smoke --workspace @reel/worker

1. cleanup chain — data hai, pipeline nahi (22.7)
  .. default chain: silenceremove=…,areverse,silenceremove=…,areverse,highpass=f=80,
     compand=…,loudnorm=I=-16:TP=-1.5:LRA=11:linear=true,alimiter=limit=0.8913:level=false
  ok   default me kuch kadam chalu hain
  ok   limiter zabardasti aakhir me jaata hai
  ok   sab kadam band karne par chain khaali hoti hai

2. cleanup sach me chalti hai (22.7 / 22.8)
  .. pehle : -45.3 LUFS, peak -34.6 dBTP
  .. baad  : -16.0 LUFS, peak -2.1 dBTP
  ok   voice apne target (-16 LUFS) ke paas aa gayi — -16.0 LUFS
  ok   true peak chhat ke neeche hai — -2.10 dBTP
  ok   cleanup ne sach me level uthaya — -45.3 -> -16.0 LUFS
  .. lambai: 5.0s -> 2.40s
  ok   shuru aur ant ki chuppi kat gayi — 2.40s

3. rumble (40 Hz) hata ya nahi
  .. 40 Hz: -41.4 dB -> -15.3 dB
  .. 220 Hz (asli awaaz): -55.4 dB -> -17.1 dB
  ok   rumble asli awaaz ke muqable neeche gaya — awaaz 38.3 dB upar, rumble 26.1 dB

4. har cleanup kadam ka apna filter hai
  ok   trimSilence / highpass / noiseReduction / deesser / compand / normalize / limiter

5. TTS (22.4)
  SKIP edge-tts nahi mila — voice generate nahi ho sakti.
       install:  pip install edge-tts
       jaancho:  python -m edge_tts --list-voices
       abhi ki list: 4 voice (fallback)

ALL PASS: 16 checks, 0 fail  (voice)
```

**Teen naap sabse zaroori hain:**

- `-45.3 → -16.0 LUFS` — voice apne target par aa gayi (mix ka target -14 hai; voice usse
  thoda neeche taaki mix me jagah bache).
- `5.0s → 2.40s` — dono taraf ki chuppi sach me kati.
- `awaaz 38.3 dB upar, rumble 26.1 dB` — dono uthe, par awaaz **12 dB zyada**. Yaani rumble
  awaaz ke muqable neeche gaya. Sirf "rumble kam hua" naapna galat hota: normalize sab kuch
  upar uthata hai, isliye dono ka **aapsi** farak hi sach batata hai.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 22.4 / 22.9 / 22.11 / 22.12 — TTS wala poora hissa | `edge-tts` install nahi hai. README ka rule: bina poochhe kuch install nahi karna. **`pip install edge-tts` chalao**, phir `npm run tts:smoke` dobara — adapter poora likha hai aur wo section apne aap chal padega. |
| 22.5 ka per-character voice | `reel_characters` table abhi nahi hai (Phase 24 ke saath aayegi) |
| 22.13 record-in-browser | Jaan-boojhkar skip — aur koi button bhi nahi dikhaya |
| 22.2 / 22.8 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |

## Done when

Teen options sach me kaam karte hain, cleanup chain se awaaz saaf aur level pe hai (numbers se
proof), generated audio normal editable item hai, aur regenerate sirf zaroorat pe chalta hai.

→ Cleanup ka poora daawa **naap liya gaya**. Teen options me se Upload aur Both ka model aur
  UI taiyaar hai; Generate ke liye `edge-tts` chahiye. "Regenerate sirf zaroorat par" ka
  hissa (`generatedFromText` se stale detect) test se pakka hai.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 22.1–22.3, 22.5–22.8, 22.10, 22.14–22.16 done; 22.4/22.9/22.11/22.12 edge-tts par ruke, 22.13 jaan-boojhkar skip. Naya script `tts:smoke` — 16/16. Cleanup ne -45.3 se -16.0 LUFS, chuppi 5.0s→2.40s, aur rumble awaaz ke muqable 12 dB neeche. |
