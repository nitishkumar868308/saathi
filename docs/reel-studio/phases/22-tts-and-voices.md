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
      → `AudioSourceSection.tsx`.
      → ⚠️ `both` ka matlab "dono ek saath baja do" **nahi** hai — wo "dono rakho, ek chalao"
        hai. Dono ek saath bajane par wahi baat do awaazon me sunai deti hai.
      → **browser me nahi dekha.**
- [x] 22.3 `TTSProvider`: `listVoices()`, `generateSpeech()`.
      → `@reel/media/voice.ts`. `listVoices()` asli list edge-tts se laata hai aur na mile to
        4 fallback voices deta hai — taaki UI khaali dropdown na dikhaye.
- [ ] 22.4 edge-tts adapter (free) + install steps + na ho to saaf batao.
      → **Adapter poora likha hai par chalaya nahi** — `edge-tts` install nahi hai.
      → Install: `pip install edge-tts`, phir `python -m edge_tts --list-voices`.
      → `ttsAvailable()` pehle **poochhta** hai, maan nahi leta. Smoke test usi jawab se skip
        hota hai aur install ka tarika chapta hai (neeche asli output).
      → UI me **koi Generate button nahi dikhaya** — aisa button jo dabane par kuch na kare,
        sabse bura hota hai.
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
- [ ] 22.9 Generated audio = normal timeline asset (`temporary` + `expires_at` + R2 `temp/tts/`).
      → **Nahi bana** — uske liye asli TTS output chahiye, jo abhi nahi hai. Schema me jagah
        hai (`generatedAssetId`), aur cleanup ka poora raasta taiyaar hai.
- [x] 22.10 Text badalne par "Voice outdated" badge; regenerate sirf usi scene ka.
      → `generatedFromText` field + UI ka amber badge. Iske bina purani awaaz chup-chaap
        chalti rehti hai aur user ko lagta hai regenerate kaam nahi kar raha — jabki usne
        kabhi dabaya hi nahi.
- [ ] 22.11 Auto duration sync (voice ki lambai se scene ki lambai).
      → `generateSpeech()` lambai lautata hai, par use scene par lagane wala op nahi bana —
        wo tabhi test ho sakta hai jab asli voice ban rahi ho.
- [ ] 22.12 Batch generate.
      → **Nahi bana** — TTS ke bina uska koi matlab nahi.
- [ ] 22.13 Record-in-browser.
      → **Nahi bana, aur koi button bhi nahi dikhaya.** Checklist khud kehti hai "na bane to
        button mat dikhao".
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
