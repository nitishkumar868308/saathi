# Phase 21 — AIProvider + Gemini adapter + story→scenes + reviewable diff

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 21 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 12 complete (Milestone 2 ke baad best)

**Goal:** AI **optional layer** — story se editable timeline. AI sirf JSON likhta hai, render
nahi karta, aur meri editing kabhi chupchaap overwrite nahi karta.
Editor `GEMINI_API_KEY` ke bina bhi 100% chalna chahiye — ye is phase me prove karna hai.

## Checklist

- [ ] 21.1 `packages/reel-core/ai/types.ts`: `AIProvider` interface —
      `generateScript(input)`, `generateScenes(input)`, `suggestAssets(doc)`,
      `suggestAnimations(doc)`, `suggestTransitions(doc)`, `suggestCaptions(text)`.
      Sab structured output (zod), free-text nahi.
- [ ] 21.2 `mock` provider: bina network, deterministic output — offline development aur
      testing ke liye. Ye default rahega jab key na ho.
- [ ] 21.3 `gemini` adapter: `web/lib/translate.ts` ka pattern **copy** karo (same env
      `GEMINI_API_KEY` / `GEMINI_MODEL`, JSON response discipline, `logServiceUsage`
      style usage logging). Original file edit nahi.
- [ ] 21.4 Free tier discipline: ek reel = **1–2 calls max** (script + scenes ek hi structured
      call me batch karo). Retry sirf invalid JSON pe (max 1 repair retry). Rate limit /
      quota error pe saaf message, chup-chaap loop nahi.
- [ ] 21.5 Prompt design: input = `{ story, language (hi/hinglish/en), durationSeconds,
      aspect, characters[], availableAssets[], brand, tone }`.
      Output = **scene list** jisme har scene ka `type` (SCENE_TYPES registry se hi),
      dialogue, suggested asset slot, animation, transition, duration.
      Registry list prompt me runtime pe inject karo — hardcoded list nahi (naya scene type
      add ho to AI ko khud pata chale).
- [ ] 21.6 Validation: output ko zod se parse karo; fail ho to ek repair call; phir bhi fail
      ho to saaf error (aur raw output mujhe dikhao, chhupao nahi).
- [ ] 21.7 Scene JSON → doc: **wahi** `SCENE_TYPES.build()` + `addScene` ops use karo jo manual
      flow use karta hai (Phase 12). AI ke liye alag code path **bilkul nahi**.
- [ ] 21.8 Asset mapping: AI asset ka **naam/role** deta hai (`character:rahul`,
      `screen_recording:reminders`), fir hum library se match karte hain (character table,
      filename, tags). Match na mile to placeholder item + "Yahan asset daalo" badge.
      AI kabhi asset "bana" nahi sakta.
- [ ] 21.9 **Reviewable diff (hard requirement):** AI ka output seedha doc me nahi jaata.
      Ek proposal banta hai; UI scene-by-scene diff dikhata hai (naya / badla / hataya),
      har scene pe Accept / Reject / Edit; accept karne pe normal ops se apply ho (undo works).
      Existing project pe AI chalao to meri manual editing safe rahe.
- [ ] 21.10 AI panel UI: story textarea, language, duration, tone, character picker,
      "Generate" → proposal → diff → apply. Progress + token/cost counter dikhe.
- [ ] 21.11 Usage + cost visibility: har call ka model, tokens, time log ho (DB me),
      aur UI me "AI usage" screen. Free tier ke against counter.
- [ ] 21.12 **Zero-AI-in-editing guard:** ek test likho jo prove kare ki move/trim/split/
      transition/text-edit/volume/export me koi AI call nahi hoti (provider ko spy se wrap
      karke count 0 assert karo).
- [ ] 21.13 Key-off test: `GEMINI_API_KEY` hatao, app restart karo — AI panel saaf bole
      "AI off — key set nahi hai", aur baaki poora editor + export normal chale. Ye dikhao.
- [ ] 21.14 Test (asli flow): `"Rahul explains Apka Saathi to Papa"` 30s, Hinglish →
      scenes generate → diff me ek scene reject karo → apply → timeline me 2 scenes reorder
      karo → ek dialogue badlo → export karo. `ffprobe` paste karo.
- [ ] 21.15 `npm run typecheck` clean. Commit: "reel-studio: phase 21 — ai provider + scenes".

## Verify (asli output paste karna)

```
npx tsx packages/reel-core/scripts/check.ts     # zero-AI-in-editing test
npm run dev:studio                               # story -> diff -> apply -> export
# phir GEMINI_API_KEY hata kar dobara chalao
```

## Done when

Story se editable timeline banti hai (same JSON as manual), diff se accept/reject hota hai,
AI editing me kabhi call nahi karta, aur key ke bina editor poora chalta hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
