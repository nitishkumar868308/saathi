# Phase 24 — Optional / heavy (lip-sync, batch, hosting, multi-user)

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 24 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 23 complete (yaani poora product chalu ho)

**Goal:** yahan koi cheez apne aap nahi banegi. Pehle **imaandaar cost/benefit**, phir mai
chunuga, phir sirf wahi banega.

## Step 1 — Pehle mujhe ye report do (code likhne se pehle)

- [ ] 24.1 **Lip-sync**: mere paas GPU nahi hai. Options:
      (a) local Wav2Lip / SadTalker CPU pe — 10 second audio pe asli time measure karke batao;
      (b) paid API — asli per-minute price;
      (c) skip — zoom + Ken Burns + head-bob animation + achhi voiceover.
      Har option ka quality sample dikhao ya honest description do. Recommendation ek line me.
- [ ] 24.2 **Batch generation**: ek list (CSV/JSON) se N reels — kitna kaam, kya risk.
- [ ] 24.3 **Reusable scene library**: scene save karke kisi bhi project me daalna.
- [ ] 24.4 **Hosting**: studio + worker kahin deploy karna — asli monthly cost (VPS with
      2-4 vCPU for rendering), vs local rehna. Render time ka farak bhi batao.
- [ ] 24.5 **Multi-user**: Supabase auth + RLS + per-user assets — kitna kaam, kab zaroori.
- [ ] 24.6 **Advanced masks/overlays**: image mask, animated mask, blend modes ka baaki hissa.
- [ ] 24.7 **Auto-editing ideas**: beat detection se cuts, silence auto-trim, auto b-roll
      placement — konsa free me sach me possible hai.

## Step 2 — Sirf jo mai chunu wo implement karo

- [ ] 24.8 Chosen item(s) ka chhota plan mujhe do (checklist ke saath), phir implement karo.
- [ ] 24.9 Har chosen feature ke liye: interface pehle (`LipSyncProvider` jaisa), mock provider,
      phir asli adapter. Editor uske bina bhi chalta rahe.
- [ ] 24.10 Test + `ffprobe`/measurement proof + commit.

## Rules jo yahan bhi lagu hain

- Koi paid service mere confirm ke bina nahi.
- Lip-sync scene ban jaane ke baad **normal timeline asset** ki tarah behave kare
  (trim/split/move sab chale) — special case nahi.
- Jo na bane uska button UI me na ho.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
