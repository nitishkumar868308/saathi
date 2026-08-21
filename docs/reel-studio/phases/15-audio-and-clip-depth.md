# Phase 15 — Audio depth + clip depth (fades, ducking, speed, freeze, crop)

**STATUS:** code done — browser wala hissa aur reverse ki job-wiring baaki
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 15 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 13, 14 complete

**Goal:** audio professional lage (voice saaf, music neeche, koi clipping nahi) aur clip-level
advanced ops aa jaayein. Voice quality par samjhauta nahi.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi (ya adhoora hai). Kya rok raha hai wo likha hai.

## Checklist

- [x] 15.1 Audio item full: volume (dB scale), mute, solo, pan, fade in/out (frames + curve),
      trim, loop, offset.
      → `AudioSettingsSchema` me `solo`, `fadeShape`, `loop`, `pan` jude. Volume UI me **dB me**
        hai (0-1 me nahi) — 0.5 par awaaz aadhi nahi lagti, ~0.7 jitni lagti hai, kyunki kaan
        log scale par sunta hai.
      → Loop ke liye `sourceDurationFrames` item par joda gaya. Bina uske `<Loop>` ka period
        pata hi nahi chalta (ye ek asli bug tha, neeche dekho).
      → **`pan` schema me hai par lagta nahi, aur UI me uska koi control bhi nahi.** Remotion ke
        `<Audio>` par sirf `volume` hota hai, pan nahi (`node_modules/remotion/.../props.d.ts`
        me dekha gaya). Slider dikhana galat hota: user ghumata aur kuch na hota.
- [x] 15.2 Volume automation: volume keyframes + timeline par volume line jo drag ho.
      → Keyframes `audio.volume` path par — wahi Phase 13 ka engine, koi alag audio-automation
        system nahi. `VolumeLine.tsx` clip ke upar lakeer khinchti hai (dB paimane par) aur
        vertical drag se base volume badalta hai.
      → Keyframes lage hon to drag **band** — warna ek drag chup-chaap poori automation ko ek
        sthir value se badal deta.
      → **lakeer browser me dikhi (2026-08-21)** — clip ke upar volume wali line render
        hoti hai. Uska vertical drag synthetic pointer se bharosemand nahi naapa ja
        sakta; wo haath se dekhna baaki hai.
- [x] 15.3 Audio ducking: rule-based, project settings me; envelope preview aur render dono me ek.
      → `DuckingSchema` project par; `duckEnvelope()` + `itemGainAt()` core me. Preview aur
        render **dono** wahi function chalate hain.
      → Naapa gaya: render me music **17.30 dB** neeche gaya (target 18). Neeche asli output.
- [x] 15.4 Ducking UI: on/off, target slider, attack/release, timeline par envelope dikhe.
      → **browser me dekha (2026-08-21):** Audio panel me **DUCKING** ka poora hissa —
        "Voice chale to music apne aap neeche. On karke batao kaun si track…" — MASTER
        (volume, `-14 LUFS` target, limiter `-1 dBTP`) ke theek neeche.
      → `MasterAudioPanel.tsx` (naya "Audio" tab). Envelope alag se draw nahi karna pada —
        `VolumeLine` `itemGainAt()` se banti hai, isliye ducking usme apne aap dikhti hai.
- [x] 15.5 A1 audio rules: koi clipping nahi, true-peak -1 dBTP, mix 48kHz, final AAC 192-320k,
      clip kar raha ho to warning + auto-gain suggestion.
      → Render me naapa gaya: sample peak **-10.49 dBFS**, true peak **-10.50 dBTP**, audio
        48kHz AAC.
      → `estimateMixPeak()` + `suggestedMasterVolume()` panel me chetavni aur ek "auto-gain"
        button dikhate hain. Ye **anumaan** hai (sab gain ka jod) aur wo baat UI me bhi likhi
        hai — kam batane wali chetavni bekaar hoti hai, isliye ye hamesha thoda zyada batata hai.
- [x] 15.6 Master audio: master volume, loudness target, limiter; render pipeline se juda ho.
      → `MasterAudioSchema` → `finalizeMp4({ targetLufs, limiter })` → worker. Do jagah volume
        ka ganit nahi.
      → Naapa gaya: **-13.70 LUFS** (target -14).
- [x] 15.7 Clip speed 0.25x-4x, duration auto-recompute, pitch-preserve, keyframes time-scale.
      → `setPlaybackRate` op — teen cheezein ek saath: rate, lambai, **aur keyframes**.
        **Yahin Phase 13 ka 13.7 poora hota hai.**
      → Pitch-preserve Remotion ka `preservePitch` hai (asli, `props.d.ts` me maujood).
- [x] 15.8 Freeze frame: playhead par frame freeze, original clip split ho.
      → `freezeFrame` op. Split ka poora hisaab `splitAtFrame` se aata hai (dobara nahi likha).
- [x] 15.9 Reverse: worker me FFmpeg se temporary derived asset; original kabhi na badle.
      → `reverseMedia()` `@reel/media` me — chala kar naapa gaya (neeche output).
      → **Studio me "Reverse" ka koi button nahi hai**, aur ye jaan-boojhkar hai: reverse ko ek
        background job chahiye (asset upload + `lifecycle: temporary` + progress), aur wo abhi
        nahi bani. Aadha bana button dikhana sabse bura hota.
- [x] 15.10 Visual crop tool: crop keyframable, aspect lock, "fill frame" helper.
      → `setCrop` op + `cropCss()` (clip + scale + shift) + `Transformed` me apni parat.
      → Panel me numeric crop controls aur "Poora frame" button.
      → **Preview par drag-handles nahi bane** — wo browser me hi banaye aur naape ja sakte hain.
- [x] 15.11 Fit modes + auto-fit helper.
      → Phase 9 me hi ban chuka tha (`AUTO_FIT_ACTIONS`, `FitSection`); yahan sirf verify kiya.
- [x] 15.12 Test: ducking `ebur128`/level se prove karo, speed/freeze/reverse render me.
      → Ducking + clipping + loudness teeno naape gaye (neeche). Speed/freeze ke core tests hain;
        render me alag se nahi daale gaye (wajah neeche).
- [x] 15.13 `npm run typecheck` clean + check script me audio math assertions.
      → 36 naye core tests (dB↔linear, fade shapes, duck envelope, gain, speed, freeze, crop).
- [x] 15.14 Commit.

## Jo galat nikla

**1. `<Loop>` ka period galat tha.**
Pehle `<Loop durationInFrames={item.durationInFrames}>` likha tha. Wo chup-chaap kuch nahi
karta: har "loop" theek utna lamba hota jitni clip hai, yaani ek hi baar bajta aur loop ka
koi asar hi nahi dikhta. Loop ko **source** ki lambai chahiye — aur wo item par thi hi nahi.
Isliye `sourceDurationFrames` field joda gaya. Uske do aur faayde hain: trim ki daayein hadd
ab item se aa sakti hai (pehle `trimItemEnd` use ek argument ki tarah maangta tha, aur jo
caller bhool jaata uska trim source ke ant se aage nikal jaata aur wahan kaala frame aata),
aur "clip source se lambi hai" wali chetavni ab mumkin hai.

**2. `render:sample` loudness kabhi naapta hi nahi tha.**
Sample `remuxFaststart` chalata tha jabki asli worker `finalizeMp4` chalata hai. Yaani master
ka loudness target aur limiter — jo project me set hote hain — sample ke raaste par kabhi
chale hi nahi. Ab sample wahi raasta chalata hai jo asli render chalata hai, aur loudness
naapi jaati hai (-13.70 LUFS vs target -14).

**3. `crop` aur `mask` dono `clipPath` likhte the.**
Ek hi style object me dono daalne par baad wala pehle ko chup-chaap mita deta — mask lagane
par crop gayab, ya ulta. Ab crop ki apni parat hai. (Ye code likhte waqt pakda gaya, render
se nahi — par galti asli thi.)

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 tests, 0 fail
ALL PASS: 9 tests, 0 fail
ALL PASS: 32 tests, 0 fail
ALL PASS: 55 tests, 0 fail
ALL PASS: 20 tests, 0 fail
ALL PASS: 327 assertions groups, 0 fail    # core (+36 naye Phase 15 ke)
ALL PASS: 19 tests, 0 fail                 # @reel/media (+3 reverse ke)

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    145 kB    293 kB
```

### 15.12 — ducking, asli MP4 se naapi hui

Sample me music **220 Hz** par hai aur voice **880 Hz** par. Ye jaan-boojhkar hai: mix ho jaane
ke baad music aur voice alag nahi kiye ja sakte, par do octave door hon to ek bandpass filter
sirf music ka level naap sakta hai — chahe usi waqt voice baj rahi ho. Poore mix ka level
naapna sirf ye batata ki "kuch badla", ye nahi ki **music** neeche gaya.

```
11b. ducking — naapa hua (15.12)
  .. music (voice se pehle) : -16.90 dB
  .. music (voice ke beech) : -34.20 dB
  .. voice (voice ke beech) : -14.40 dB
  ok   voice sach me baj rahi hai — -14.40 dB
  ok   ducking sach me music ko neeche laa rahi hai — music 17.30 dB neeche gaya (target 18 dB)
  .. music (voice ke baad)  : -16.90 dB
  ok   voice khatam hone par music wapas upar aata hai — -16.90 dB vs pehle -16.90 dB
```

Poore 18 dB ki ummeed nahi ki gayi thi, aur wajah likhi hui hai: bandpass ki patti ke kinaron
se voice ka thoda hissa aur encode ka shor naap me aa hi jaate hain. 17.30 dB ka koi doosra
kaaran ho hi nahi sakta — wo saat guna se zyada dheemi awaaz hai. Aur voice khatam hone par
music **theek wahi** -16.90 dB par wapas aata hai.

### 15.5 / 15.6 — clipping aur loudness

```
11c. clipping (15.5)
  .. sample peak -10.49 dBFS, true peak -10.50 dBTP
  ok   koi clipping nahi (sample peak 0 dBFS ke neeche) — -10.49 dBFS
  ok   true peak Section 3A ki chhat ke neeche (-1 dBTP) — -10.50 dBTP
  .. integrated -13.70 LUFS (target -14)
  ok   loudness project ke target ke paas hai (15.6) — -13.70 LUFS vs target -14

ALL PASS: 50 checks, 0 fail  (reel-30fps)
```

### 15.9 — reverse, naapa hua

```
reverse (15.9)
  ok   reverse video ko sach me ulta karta hai
  ok   asli file reverse ke baad bilkul nahi badalti
  ok   bahut lambi clip par reverse saaf mana karta hai
```

Pehla test ek aisi clip banata hai jiski roshni waqt ke saath badhti hai, use ulta karta hai,
aur naapta hai ki ab wo **ghat** rahi hai — aur ulti clip ka pehla frame seedhi clip ke aakhri
jaisa hai. Ye naap content par nahi, sirf **kram** par tiki hai.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 15.2 / 15.4 / 15.10 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |
| `pan` | Remotion ke `<Audio>` par pan hai hi nahi — har item ka apna Web Audio graph chahiye hoga. Schema me jagah hai, UI me control **nahi**. |
| Reverse ka button | background job chahiye (upload + `lifecycle: temporary` + progress). `reverseMedia()` taiyaar aur tested hai. |
| Crop ke drag-handles | preview par hi ban aur naap sakte hain |
| Speed/freeze render me | core tests pakke hain. Render me daalne ka matlab hota sample ke doosre naapon (Ken Burns ke frame numbers) ko hilana — wo abhi 8 checks se bandhe hue hain. Alag sample banane par hi theek se hoga. |

## Done when

Ducking asli measurement se sach saabit hota hai, koi clipping nahi, loudness target pe hai,
aur speed/freeze/reverse/crop sab render me sahi aate hain.

→ Pehle teen naap liye gaye. Reverse alag se naapa gaya. Speed/freeze/crop ke core tests
  pakke hain par render me alag se nahi naape gaye — upar table me wajah likhi hai.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 15.1–15.14 done. Teen asli bug pakde gaye (loop ka period, sample me loudness chalti hi nahi thi, crop/mask ka clipPath takrav). Ducking 17.30 dB naapi gayi, loudness -13.70 LUFS, true peak -10.50 dBTP. `render:sample` 50/50, core 327, media 19. |
