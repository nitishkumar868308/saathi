# Phase 23 — Auto captions (local whisper, free)

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 23 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 19, 22 complete

**Goal:** audio se captions khud ban jaayein — **local, free, offline**. Aur banne ke baad
poori tarah editable rahein (Phase 19 ka system reuse).

## Checklist

- [ ] 23.1 `TranscribeProvider` interface: `transcribe({audioPath, language}) ->
      { cues[], words[] }` with per-word timings.
- [ ] 23.2 Local adapter: `faster-whisper` (Python) ya `whisper.cpp` — jo Windows pe bina GPU
      theek chale. Model size choose karo (`small`/`medium`) aur mujhe accuracy vs time ka
      asli measurement do (30s Hindi audio pe kitna time).
- [ ] 23.3 Install steps mujhe do; available na ho to UI me saaf "Auto captions off —
      setup needed" (fake button nahi).
- [ ] 23.4 Hindi/Hinglish handling: language auto-detect + manual override. Hinglish me
      Devanagari vs Latin script ka option (reels me Latin Hinglish zyada chalta hai) —
      dono try karke mujhe sample dikhao.
- [ ] 23.5 TTS shortcut: agar audio humne TTS se banaya hai to **text already hai** —
      whisper chalane ki zaroorat nahi. Text + audio duration se word timing align karo
      (forced-alignment-lite), aur whisper sirf uploaded/recorded audio pe chale.
      Ye time aur CPU bachata hai.
- [ ] 23.6 Output → Phase 19 ke `subtitle` item me cues + `words[]` (asli word timing,
      estimate nahi) → karaoke/highlight styles sach me sahi chalein.
- [ ] 23.7 Post-processing: punctuation, line splitting (max chars/lines config se),
      cue merge/split heuristics, filler word removal (optional toggle).
- [ ] 23.8 Editing after generation: sab kuch editable (Phase 19 editor), aur "re-transcribe"
      option jo purani manual edits ko overwrite karne se pehle poochhe.
- [ ] 23.9 Confidence: low-confidence words highlight karo taaki mai ek nazar me theek kar saku.
- [ ] 23.10 Worker job: transcription bhi ek job type ho (`reel_render_jobs` me `kind` column
      ya alag `reel_jobs` — decide karke batao), progress ke saath, taaki UI block na ho.
- [ ] 23.11 Test: ek 30s Hindi voiceover pe auto captions chalao — time, accuracy, aur
      generated SRT mujhe dikhao. Do galtiyan haath se theek karo, karaoke style lagao,
      render karo, 6 frames dikhao.
- [ ] 23.12 TTS-path test: TTS se bani audio pe captions (whisper ke bina) — timing kitni
      sahi aayi, batao.
- [ ] 23.13 `npm run typecheck` clean. Commit: "reel-studio: phase 23 — auto captions".

## Verify (asli output paste karna)

```
npx tsx worker/scripts/transcribe-smoke.ts --audio voice.wav --lang hi
# time + generated cues paste karo
npm run dev:studio     # captions edit + render
```

## Done when

Auto captions local, free, aur editable hain; word timing se karaoke sahi chalta hai;
aur TTS-generated audio pe whisper ki zaroorat nahi padti.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
