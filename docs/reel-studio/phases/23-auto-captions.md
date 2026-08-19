# Phase 23 — Auto captions (local whisper, free)

**STATUS:** alignment aur cue-banana naapa hua — whisper `pip install faster-whisper` par ruka
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 23 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 19, 22 complete

**Goal:** audio se captions khud ban jaayein — **local, free, offline**. Aur banne ke baad
poori tarah editable rahein (Phase 19 ka system reuse).

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 23.1 `TranscribeProvider` interface: `transcribe({audioPath, language}) -> { cues[], words[] }`
      with per-word timings.
      → `@reel/media/transcribe.ts` (`transcribe`, `whisperAvailable`, `detectSpeechSegments`)
        aur `@reel/core/captions/transcript.ts` (`TranscriptWord`, `TranscriptResult`).
      → ⚠️ Interface me sab **seconds** me hai, frames me nahi. Transcribe karne wala fps ke
        baare me kuch nahi jaanta; frames me badalna sirf `buildCues()` me hota hai, jahan fps
        aur item ka offset dono maujood hote hain.
- [ ] 23.2 Local adapter: `faster-whisper` + model size ka accuracy vs time measurement.
      → Adapter poora likha hai (`int8` CPU, `word_timestamps=True`, `vad_filter=True`), par
        **chalaya nahi** — `faster-whisper` install nahi hai.
      → Default `small` chuna hai: `medium` Hindi par saaf behtar hai par CPU par teen guna
        waqt leta hai, aur 30 second ki reel ke liye do minute ka intezaar feature ko bekaar
        bana deta hai. **Ye abhi ek faisla hai, naap nahi** — asli numbers install ke baad hi
        aayenge.
      → Naapne ka tarika taiyaar hai: script `elapsedMs` aur `x realtime` dono chapta hai.
- [x] 23.3 Install steps; available na ho to UI me saaf "setup needed" (fake button nahi).
      → `whisperAvailable()` **poochhta** hai, maan nahi leta.
      → UI me button tabhi banta hai jab wo sach me kuch kar sake. Warna uski jagah likha hai:
        `pip install faster-whisper`.
      → ⚠️ Disabled button bhi nahi rakha — wo bhi jhooth ke paas hi hai. User use dabata
        rehta hai aur samajh nahi paata ki kyun kuch nahi ho raha.
- [x] 23.4 Hindi/Hinglish: language auto-detect + manual override; Devanagari vs Latin.
      → `captions/translit.ts` — `devanagariToLatin()` + `CAPTION_SCRIPTS` (auto / देवनागरी /
        Hinglish). Namoone neeche chhape hue hain.
      → ⚠️ Do niyam hain aur dono bolne ke **riwaaz** se aaye hain, vyakaran se nahi:
        aakhri schwa girta hai ("कमल" → kamal, "kamala" nahi), aur shabd ke ant ka "aa" chhota
        ho jaata hai ("रहा" → raha, "rahaa" nahi — par "काम" → kaam, beech wala "aa" rehta hai).
      → ⚠️ Beech ka schwa **nahi** girta ("नमकीन" → "namakeen" aayega, "namkeen" nahi). Wo
        riwaaz se tay hota hai, niyam se nahi. Isliye output editable hai.
- [x] 23.5 TTS shortcut: text pata ho to whisper ki zaroorat nahi — forced-alignment-lite.
      → `captions/align.ts` + ffmpeg `silencedetect`. **Naapa gaya: 1000ms galti → 0ms**
        (neeche).
      → ⚠️ Ye alignment ki jaan hai: shabd pehle **segment** me baante jaate hain, phir segment
        ke andar. Isse ek shabd kabhi chuppi ke aar-paar nahi girta.
- [x] 23.6 Output → Phase 19 ke `subtitle` item me cues + `words[]` (asli timing).
      → `buildCues()` — cue ke frames item-local, `words[]` me har shabd ka apna frame range.
      → `CaptionWordSchema` me `confidence` juda (23.9 ke liye).
- [x] 23.7 Post-processing: line splitting, cue merge/split heuristics, filler removal.
      → Cue tootne ki chaar wajah: chuppi (0.45s), poornviraam, max 2×32 akshar, max 3.5s.
      → Filler **default me band** — `removeFillers()` ka note dekho.
- [x] 23.8 Editing ke baad "re-transcribe" purani manual edits mitane se pehle poochhe.
      → `window.confirm` cue ki ginti ke saath. Auto-captions ka poora matlab hi ye hai ki uske
        baad user haath se sudhare; wo mehnat chup-chaap mita dena sabse badi galti hoti.
      → **browser me nahi dekha** (`studio/.env.local` nahi hai).
- [x] 23.9 Low-confidence words highlight.
      → `LOW_CONFIDENCE_BELOW = 0.6`, `isLowConfidence()`, aur cue ke neeche "Shak wale shabd".
      → ⚠️ `confidence: null` ko "kharab" nahi maana jaata — `null` matlab machine ne bataya hi
        nahi (aligned raaste me hamesha aisa hota hai). Use peela dikhana jhooth hota.
- [x] 23.10 Worker job: transcription bhi ek job type; decide karke batao.
      → **Faisla: usi `reel_render_jobs` me `kind` column, alag table nahi.** Poori wajah
        `supabase/reel-studio-jobs.sql` ke sar par likhi hai: queue, claim, progress, cancel,
        attempts, requeue aur heartbeat — ye sab transcription ko bilkul waise hi chahiye.
        Doosri table matlab ye saara saamaan dobara likhna, aur ek din wo do jagah alag ho
        jaata (ek me `attempts` ka fix lagta, doosri me nahi).
      → Keemat bhi likhi hai: table ka naam ab thoda jhootha lagta hai, aur `doc` ab har job me
        nahi hota (uske liye DB me shart lagi hai).
      → ⚠️ Worker **doc ko haath nahi lagata** — nateeja `result` column me rakhta hai, cues doc
        me UI daalti hai usi `setCues` op se. Warna job chalte waqt user ka abhi kiya hua kaam
        chup-chaap mit jaata, aur undo bhi nahi chalta (undo studio ke andar hai, DB me nahi).
      → **SQL chalayi nahi** — Supabase ka darwaza nahi hai.
- [ ] 23.11 Test: 30s Hindi voiceover pe auto captions — time, accuracy, SRT; do galtiyan haath
      se theek; karaoke style; render; 6 frames.
      → **Nahi hua** — whisper install nahi hai, aur asli Hindi voiceover bhi nahi (edge-tts
        bhi nahi hai). Dono ek hi `pip install` ki door hain.
- [x] 23.12 TTS-path test: TTS se bani audio pe captions (whisper ke bina) — timing kitni sahi.
      → **Naapa gaya**, par TTS se bani awaaz par nahi — ek aisi awaaz par jiska sach humne
        khud banaya (paanch tone, jinke start/end ganit se pata hain).
      → ⚠️ Ye jaan-boojhkar hai. Asli recording par "kitni door gira" naapne ke liye pehle
        kisi insaan ko haath se har shabd ka waqt likhna padta — aur wo naap khud andaaza hoti.
        Tone me sach pakka hai.
      → Nateeja: **0ms** (neeche).
- [x] 23.13 `npm run typecheck` clean. Commit.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 / 7 tests, 0 fail    # studio
ALL PASS: 505 assertions groups, 0 fail                  # core (+20 naye Phase 23 ke)
ALL PASS: 19 tests, 0 fail                               # @reel/media

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    167 kB    331 kB
```

### 23.5 / 23.12 — alignment sach me kitni door girti hai

Ek awaaz banayi gayi jiska **sach pehle se pata hai**: 1 second chuppi, phir paanch tone (har
ek 0.5s, beech me 0.5s ka gap). Yaani har "shabd" ka asli start/end ganit se nikalta hai.

```
$ npm run transcribe:smoke --workspace @reel/worker

1. bolne wale hisse pakde gaye? (23.5)
  .. lambai: 6.00s, 5 segment
  .. 1: 1.000–1.500s   (sach: 1.000–1.500)
  .. 2: 2.000–2.500s   (sach: 2.000–2.500)
  .. 3: 3.000–3.500s   (sach: 3.000–3.500)
  .. 4: 4.000–4.500s   (sach: 4.000–4.500)
  .. 5: 5.000–5.500s   (sach: 5.000–5.500)
  ok   paanch bolne wale hisse mile — 5
  ok   segment ki seemaayein sach ke paas hain — sabse badi galti 0ms

2. alignment — chuppi ka naksha kitna farak laata hai (23.5 / 23.12)
  .. seedhi baant (chuppi nahi dekhi): start 1000ms, end 500ms
  .. chuppi ka naksha lagakar    : start 0ms, end 0ms
  .. ek     1.000–1.500s   (sach: 1.000–1.500)
  .. do     2.000–2.500s   (sach: 2.000–2.500)
  .. teen   3.000–3.500s   (sach: 3.000–3.500)
  .. chaar  4.000–4.500s   (sach: 4.000–4.500)
  .. paanch 5.000–5.500s   (sach: 5.000–5.500)
  ok   chuppi ka naksha lagane se timing sudhri — 1000ms -> 0ms
  ok   har shabd apne hi tone par baitha — sabse badi galti 0ms
  ok   shabd chuppi me nahi gire
  ok   aligned transcript me confidence jhooth nahi bolta

3. shabdon se cues (23.6 / 23.7)
  .. 5 cue bani
  ok   cue bani — 5
  ok   har cue me asli word timing hai (andaaza nahi)
  ok   cue ke andar hi shabd hain
  ok   cue aapas me nahi takraatin
  .. bani hui SRT:
     1
     00:00:01,000 --> 00:00:01,500
     ek

     2
     00:00:02,000 --> 00:00:02,500
     do

     3
     00:00:03,000 --> 00:00:03,500
     teen

     4
     00:00:04,000 --> 00:00:04,500
     chaar

     5
     00:00:05,000 --> 00:00:05,500
     paanch
  ok   filler nikla aur dohraya shabd juda — Papa suno
  ok   kam bharose wale shabd pakde gaye (23.9)

4. Devanagari se Hinglish (23.4)
  .. नमस्ते               -> namaste
  .. कमल                  -> kamal
  .. राम                  -> raam
  .. घर                   -> ghar
  .. दस्तावेज़            -> dastaavez
  .. आज                   -> aaj
  .. क्या                 -> kya
  .. मैं ghar जा रहा हूँ  -> main ghar ja raha hoon
  ok   Hinglish transliteration ke namoone mile — 8/8

5. whisper (23.2 / 23.3)
  SKIP faster-whisper nahi mila — auto captions abhi nahi ban sakti.
       install:  pip install faster-whisper
       jaancho:  python -c "import faster_whisper; print(faster_whisper.__version__)"

ALL PASS: 13 checks, 0 fail  (captions)
```

**Sabse zaroori naap:** `1000ms -> 0ms`. Seedhi baant (poori lambai ko shabdon me baant do)
me shuruaati 1 second ki chuppi bhi baant di jaati hai, isliye har shabd poore ek second aage
khisak jaata hai. Chuppi ka naksha lagane par paanchon shabd apne hi tone par baithte hain.

Ek second ki galti karaoke me saaf dikhti hai — highlight shabd bolne se pehle hi jal jaata
hai. 0ms ka matlab ye nahi ki asli awaaz par bhi 0 hoga (wahan shabd ki seemaayein itni saaf
nahi hoti); iska matlab ye hai ki **hisaab me koi galti nahi bachi**.

### Do bug jo naap se hi pakde gaye

1. **Alignment segment ki seema par phisal rahi thi.** Shabd theek wahin khatam hota hai jahan
   agla shuru hota hai; us ek point ke do matlab hote hain (pichhle segment ka ant, agle ki
   shuruaat). Ek hi hisaab dono ke liye lagane par shabd pichhli chuppi se pehle chala jaata
   tha — naapa gaya: **500ms**, aur wo bhi sirf kuch shabdon par, yaani "kabhi-kabhi" wali
   gadbad jo sabse mushkil se pakdi jaati hai. Ab shabd pehle segment ko diye jaate hain, phir
   segment ke andar baante jaate hain — ab ye ho hi nahi sakta.
2. **"रहा" → "rahaa" aa raha tha.** Matra `ा` ka seedha matlab "aa" hai, par shabd ke ant me
   Hinglish ka chalan "a" ka hai (raha, kya, hua, aaya). Bina is niyam ke har doosra shabd
   thoda videshi lagta aur user har baar haath se theek karta rehta.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 23.2 ka measurement, 23.11 poora | `faster-whisper` install nahi. **`pip install faster-whisper` chalao**, phir `npm run transcribe:smoke -- --audio <file> --lang hi` — adapter poora likha hai aur wo section apne aap chal padega. |
| 23.11 ka Hindi voiceover | `edge-tts` bhi nahi hai (Phase 22), isliye asli awaaz banayi hi nahi ja sakti |
| 23.10 ki SQL | `supabase/reel-studio-jobs.sql` chalayi nahi — Supabase ka darwaza nahi hai. **Ise Supabase SQL Editor me Run karo**, warna transcribe job insert par `kind` column na milne se phategi. |
| 23.8 ka browser wala hissa, 6 frames | `studio/.env.local` nahi hai → dev server nahi chalta |

## Done when

Auto captions local, free, aur editable hain; word timing se karaoke sahi chalta hai; aur
TTS-generated audio pe whisper ki zaroorat nahi padti.

→ **Teesra hissa poora aur naapa hua** — TTS wale raaste par whisper ki zaroorat nahi, aur
  timing ka hisaab 0ms par hai. Pehle do hisse ka poora code taiyaar hai par whisper ke bina
  chalaya nahi ja saka.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 23.1, 23.3–23.10, 23.12, 23.13 done; 23.2 ka measurement aur 23.11 whisper par ruke. Naya script `transcribe:smoke` — 13/13. Alignment ki galti 1000ms se 0ms. Do bug naap se pakde: segment ki seema par phisalna (500ms), aur "rahaa" wali likhawat. Job queue ka faisla: `kind` column, alag table nahi. |
