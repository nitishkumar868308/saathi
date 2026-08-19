# Phase 21 — AIProvider + Gemini adapter + story→scenes + reviewable diff

**STATUS:** code done — asli Gemini call `GEMINI_API_KEY` par ruki hai
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 21 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 12 complete

**Goal:** AI **optional layer** — story se editable timeline. AI sirf JSON likhta hai, render
nahi karta, aur meri editing kabhi chupchaap overwrite nahi karta.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 21.1 `ai/types.ts`: `AIProvider` interface, sab structured output (zod).
      → 5 methods, sab zod schema ke saath. Free-text kahin nahi.
- [x] 21.2 `mock` provider — bina network, deterministic.
      → `MockAiProvider`. Uska `isConfigured()` **`false`** deta hai (jaan-boojhkar): wo kaam
        karta hai par **AI nahi hai**, aur UI ko yahi sach dikhana chahiye. `true` lauta dene
        par user ko lagta ki uske scenes AI ke hain, jabki wo sirf uski apni kahani ke tukde
        hain.
      → Uske scenes **registry ke asli types** se bante hain (input se aate hain), apne banaye
        naamon se nahi — isliye wo usi raaste se guzarta hai jis se Gemini ka output.
- [x] 21.3 `gemini` adapter — `web/lib/translate.ts` ka pattern, original file chhui nahi.
      → `studio/lib/ai/gemini.ts` + `app/api/ai/generate/route.ts`.
      → ⚠️ **Key browser me kabhi nahi aati.** Call ek API route se jaati hai. `NEXT_PUBLIC_`
        wale env var bundle me chale jaate hain — wahi galti sabse zyada dohrayi jaati hai.
- [x] 21.4 Free tier: ek reel = 1–2 call. Retry sirf invalid JSON par (max 1).
      → Script aur scenes **ek hi** structured call me. Repair sirf ek baar — do-teen baar me
        aksar wahi jawab dobara aata hai aur kota do-teen guna kharch ho jaata hai.
      → Quota (429) par saaf message aur **koi retry nahi** — kota retry se wapas nahi aata.
- [x] 21.5 Prompt me scene types **runtime par** (registry se), hardcoded list nahi.
      → `sceneTypesForPrompt()`. Iska apna test hai: registry me ek naya type daal kar dekha
        gaya ki wo apne aap prompt ki list me aa jaata hai.
- [x] 21.6 zod se parse; ek repair call; phir bhi fail ho to **raw output dikhao**.
      → `parseWithRepair()`. Panel me raw jawab ek `<details>` me dikhta hai — "AI ne galat
        jawab diya" padh kar koi kuch nahi kar sakta; asli output dekh kar prompt sudhaara ja
        sakta hai.
- [x] 21.7 Scene JSON → doc: **wahi** `addScene` op jo manual flow use karta hai.
      → `applyProposal()`. AI ke liye koi alag code path nahi. Iska test: AI se bane scene par
        `moveItems` aur `splitAtFrame` waise ke waise chalte hain.
- [x] 21.8 Asset mapping: AI **naam/role** deta hai, id nahi. Na mile to slot khaali.
      → Test: `character:rahul` na mile to scene banta hi nahi aur wajah `skipped` me aati
        hai; naam milte hi bilkul ban jaata hai. **AI kabhi asset "bana" nahi sakta.**
- [x] 21.9 Reviewable diff — AI ka output seedha doc me nahi jaata.
      → `buildProposal()` doc ko **chhoota bhi nahi** (iska apna test hai). Har entry par
        accept/reject; jo manzoor ho wahi `replaceDoc` op se lagta hai (Ctrl+Z chalta hai).
      → Default mode `"append"` hai — `"replace"` default hone par ek galti se dabaya hua
        "Generate" poora project mita deta.
- [x] 21.10 AI panel UI: story, language, tone, duration → proposal → diff → apply. Usage counter.
      → `AiPanel.tsx` (naya "AI" tab). Har entry par slots aur wajah dikhti hai; usage me
        calls, tokens aur waqt.
      → **browser me nahi dekha.**
- [ ] 21.11 Usage + cost DB me, aur "AI usage" screen.
      → **Aadha.** Har call ka usage (`calls`, tokens, ms) `AiUsage` me aata hai aur panel me
        dikhta hai. DB me likhna aur alag screen **nahi** bani — uske liye ek nayi table
        chahiye aur wo tabhi kaam ki hai jab asli calls ho rahi hon (key ke saath).
- [x] 21.12 **Zero-AI-in-editing guard** — spy se count 0.
      → Do taale: ek spy provider jo har call ginta hai (10 aam edits ke baad count **0**),
        aur ek jaanch ki `OPS` me koi AI wala op hai hi nahi.
      → ⚠️ Doosra check pehle `/ai/` regex se tha aur wo `repairScenes` par jhoothi galti
        deta tha. Ab naam shabdon me toda jaata hai — jhoothi galti do-teen baar dikhne ke baad
        log test hata dete hain.
- [x] 21.13 Key-off: AI panel saaf bole "AI off", baaki editor normal chale.
      → `npm run check` me naya `check-ai.ts` — route ko **sach me bulaya** jaata hai. Asli
        output neeche.
- [ ] 21.14 Asli flow: story → scenes → diff → reject → apply → reorder → export.
      → **Nahi chalaya.** Iske do hisse hain: (a) mock ke saath poora flow — uske core wale
        kadam test se pakke hain (proposal, reject, apply, phir move/split); (b) asli Gemini
        se scenes — uske liye `GEMINI_API_KEY` chahiye, jo abhi nahi hai.
- [x] 21.15 `npm run typecheck` clean. Commit.

## Jo galat nikla

**`/ai|gemini|llm/i` ne `repairScenes` ko AI ka op samajh liya.**

Zero-AI guard ka doosra check ops ke naam me "ai" dhoondhta tha — aur `repairScenes` me bhi
"ai" hai (**rep-ai-rScenes**). Wo ek bilkul aam op hai. Aisa test **jhoothi galti** dikhata hai,
aur do-teen baar ke baad log use hata dete hain — yaani wo taala jo AI ko editing me ghusne se
rokta tha, wo hi khul jaata. Ab naam camelCase se shabdon me toda jaata hai aur poora shabd
`"ai"` hone par hi pakda jaata hai.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 tests, 0 fail    # studio
ALL PASS: 7 tests, 0 fail                            # studio AI (naya)
ALL PASS: 472 assertions groups, 0 fail              # core (+14 naye Phase 21 ke)

$ npm run build:studio
✓ Compiled successfully
├ ƒ /api/ai/generate    0 B
└ ƒ /project/[id]       164 kB    325 kB
```

### 21.13 — key ke bina kya hota hai (sach me chalaya gaya)

```
$ npx tsx studio/scripts/check-ai.ts

key ke bina (21.13)
  ok   GET saaf batata hai ki AI band hai
  ok   POST 503 deta hai aur wajah likhta hai
  ok   key set hone par GET configured batata hai
  ok   khaali prompt par 400, network par jaane se pehle hi

mock provider (21.2)
  ok   mock bina network ke script deta hai
  ok   mock ke scenes registry ke asli types se hain
  ok   mock do baar bulane par bilkul wahi jawab deta hai

ALL PASS: 7 tests, 0 fail
```

Route ko yahan **sach me bulaya** jaata hai (import karke), uske jawab ka andaaza nahi lagaya
jaata. "Key ke bina sab chalta hai" ek daawa hai — ye uska saboot hai.

### 21.12 — editing me ek bhi AI call nahi

Spy provider har call ginta hai. Uske saamne 10 aam edits chalayi gayi — move, trim (dono
taraf), split, transition, volume, duplicate, delete, keyframe, effect — aur uske baad export
ki poori jaanch bhi. **Count: 0.**

Ye "AI optional hai" ka saboot hai. Ek din koi `moveItems` ke andar "AI se poochh lo ki ye
theek lag raha hai" jaisa kuch daal de — ye test usi din laal ho jaayega.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 21.14 ka asli Gemini wala hissa | `GEMINI_API_KEY` nahi hai (aapka kaam). Mock ke saath poora raasta test se pakka hai. |
| 21.11 ka DB + usage screen | Nayi table chahiye, aur wo tabhi kaam ki hai jab asli calls ho rahi hon. Usage abhi panel me dikhta hai. |
| 21.10 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |
| `suggestAssets` ka UI | Provider me hai aur test se guzarta hai, par panel me uska button abhi nahi — asset library se match karne ka flow Phase 22/23 ke saath behtar baithega. |

## Done when

Story se editable timeline banti hai (same JSON as manual), diff se accept/reject hota hai,
AI editing me kabhi call nahi karta, aur key ke bina editor poora chalta hai.

→ Doosra, teesra aur chautha **naap liye gaye**. Pehla mock ke saath naapa gaya (scenes bante
  hain aur unpar aam ops chalte hain); asli Gemini se wo key aane par hi naapa ja sakta hai.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 21.1–21.10, 21.12, 21.13, 21.15 done; 21.11 aadha, 21.14 key par ruka. Ek asli bug pakda: zero-AI guard `repairScenes` ko AI ka op samajh raha tha (jhoothi galti), ab naam shabdon me tootta hai. Naya check script `check-ai.ts` (7/7) — route sach me bulaya gaya. Spy ke saamne 10 edits: 0 AI calls. |
