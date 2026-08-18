# Phase 22 — Audio: 3 options (Generate / Upload / Both) + voice cleanup

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 22 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 21 complete (Phase 15 ka audio system chahiye)

**Goal:** har audio slot pe **teen option** ho (ye tumhara requirement hai, locked):
1. **Generate** — text likho, awaaz ban jaaye (TTS)
2. **Upload** — apni recording/audio file do
3. **Both** — dono use karo (e.g. apni recording + generated lines mix, ya generated ko
   reference/fallback rakho)

Aur jo bhi audio aaye — generated ho ya uploaded — uska **cleanup/makeup** ho: level,
noise, silence, EQ. Voice quality me samjhauta nahi.

## Checklist

- [ ] 22.1 `AudioSource` model doc me: `{ mode: 'generate'|'upload'|'both', text?, voiceId?,
      uploadedAssetId?, generatedAssetId?, mix? , cleanup: {...} }`.
      Scene ka audio slot aur audio item dono isko use karein — do jagah do model nahi.
- [ ] 22.2 UI: audio slot pe teen tab (Generate / Upload / Both). Har tab ka apna form.
      `Both` me: primary kaun (uploaded ya generated), doosre ka role (mix at X% / alternate
      take / fallback), aur dono ke levels.
- [ ] 22.3 `TTSProvider` interface: `listVoices()`, `generateSpeech({text, voiceId, rate,
      pitch, volume, language}) -> asset`. Providers registry se, env se choose.
- [ ] 22.4 **edge-tts adapter (free)**: local Python `edge-tts` se generate. Install steps
      mujhe do (`pip install edge-tts`), aur agar available na ho to UI me saaf batao
      (fake button nahi). Hindi/Hinglish voices: `hi-IN-MadhurNeural`, `hi-IN-SwaraNeural`,
      `en-IN-PrabhatNeural`, `en-IN-NeerjaNeural` — list `listVoices()` se dynamic aaye.
- [ ] 22.5 Voice controls: rate, pitch, volume (edge-tts ke params), aur per-character
      default voice (`reel_characters` + `reel_voices` tables se).
- [ ] 22.6 **A1 voice quality:** TTS output 24kHz+ se aaye to 48kHz pe resample **ek hi baar**
      (high-quality resampler, `soxr`), mono→stereo sahi tarike se, koi lossy→lossy chain nahi
      (intermediate WAV/PCM me rakho, mp3 me nahi).
- [ ] 22.7 **Cleanup / "makeup" chain** (dono modes pe applicable, config se on/off per item):
      `trimSilence` (start/end + long gaps), `highpass` (~80Hz rumble), `deesser` (optional),
      `noiseReduction` (FFmpeg `afftdn` / `arnndn` if model available — jo free me mile),
      `normalize` (loudnorm target, default voice -16 LUFS), `limiter` (true peak -1dBTP),
      `compand` (halka compression taaki awaaz bhari lage).
      Ye chain **data** ho (steps list), hardcoded pipeline nahi — order badla ja sake.
- [ ] 22.8 Cleanup preview: "Before / After" sunne ka option + waveform + LUFS numbers.
      Chupchaap process karna mana hai — mujhe farak dikhna chahiye.
- [ ] 22.9 Generated audio = normal timeline asset: `temporary` lifecycle + `expires_at`,
      R2 `temp/tts/`, aur timeline pe normal audio item (uske baad trim/split/fade sab chale).
      "Keep permanently" button jo lifecycle promote kare.
- [ ] 22.10 Text→scene link: scene ka dialogue text badalne pe "Regenerate voice" button
      (sirf usi scene ka, poori reel ka nahi — cost control). Stale detect karo: text badla par
      audio purana hai to saaf badge "Voice outdated".
- [ ] 22.11 Auto duration sync: generated audio ki duration se scene/item duration adjust ho
      (option: fit scene to voice, ya fit voice to scene via rate change).
- [ ] 22.12 Batch generate: ek click me saare scenes ki voice (jinme text hai), sequential,
      progress ke saath, aur failure pe kis scene pe ruka.
- [ ] 22.13 Record-in-browser (optional, agar aasan ho): MediaRecorder se apni awaaz record
      karke seedha upload. Na bane to button mat dikhao.
- [ ] 22.14 Ducking se integration (Phase 15): voice item auto "voice track" mark ho taaki
      music khud duck ho.
- [ ] 22.15 Test: ek scene me text likho → Hindi voice generate → cleanup on/off ka LUFS
      difference paste karo. Doosre scene me apna wav upload karo → cleanup karo.
      Teesre scene me `both` mode chalao. Poori reel export karo aur
      `ffmpeg -af ebur128` output paste karo (voice ~-16 LUFS, mix ~-14 LUFS, no clipping).
- [ ] 22.16 `npm run typecheck` clean. Commit: "reel-studio: phase 22 — audio 3-mode + tts + cleanup".

## Verify (asli output paste karna)

```
pip show edge-tts
npx tsx worker/scripts/tts-smoke.ts --text "Papa, zaroori documents" --voice hi-IN-MadhurNeural
ffmpeg -i voice.wav -af ebur128=peak=true -f null -
ffmpeg -i out.mp4  -af ebur128=peak=true -f null -
```

## Done when

Teen options (Generate / Upload / Both) sach me kaam karte hain, cleanup chain se awaaz saaf
aur level pe hai (numbers se proof), generated audio normal editable item hai, aur regenerate
sirf zaroorat pe chalta hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
