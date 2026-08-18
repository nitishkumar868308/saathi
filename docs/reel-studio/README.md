# AI Reel Studio — Control Room

Ye file har chat ka **entry point** hai. Naye chat me sirf ek line dena hoti hai:

```
Read docs/reel-studio/README.md, then do Phase 3 of AI Reel Studio.
```

(3 ki jagah jo phase chalu hai wo number.) Agent yahan se sab kuch khud padh lega.

- Architecture / schema / decisions → [00-architecture-and-plan.md](00-architecture-and-plan.md)
- Phase files (checklist ke saath) → [phases/](phases/)

---

## 1. RESUME PROTOCOL — agent ke liye (sabse zaroori)

Ek phase ek chat me poora na ho to agla chat wahin se uthata hai. Isliye:

1. Phase file kholo (`docs/reel-studio/phases/NN-*.md`).
2. Jo boxes `- [x]` hain unhe **maano nahi — verify karo**:
   - file/function sach me exist karta hai?
   - `npx tsc --noEmit` clean hai?
   - jo verify command us item ke saath likhi hai, wo chalao aur output dekho.
3. Koi ticked item galat/adhoora mile → box `- [ ]` pe wapas karo, Progress log me ek line
   likho ki kya toota tha, phir usko theek karo.
4. Phir pehle un-ticked item se kaam shuru karo. Order matter karta hai.
5. Jaise hi ek item sach me kaam kare: box `- [x]` karo **aur** Progress log me date +
   verify proof (command ka output ka ek line) likho. Jhooth se tick karna sabse badi
   galti hai — agla chat us par bharosa karke aage badh jaata hai.
6. Chat khatam hote waqt Progress log me "next: X.Y" likho.
7. Phase ke saare boxes ticked + "Done when" satisfied → phase file ke top pe
   `STATUS: COMPLETE` likho, aur mujhe agle phase ka one-line prompt do.

---

## 2. STANDING RULES (har phase me lagu)

1. `00-architecture-and-plan.md` ka **Section E (locked decisions)** binding hai — usko
   dobara design nahi karna.
2. Sab kuch **LOCAL**. Mera code / media / data kisi bahar ki service ko nahi jaata.
   Allowed outbound: Supabase, Cloudflare R2, aur (Phase 21+ me) Gemini API — wahi key jo
   repo env me already hai. Koi memory file nahi, koi cloud agent nahi, koi artifact publish nahi.
3. **Zero paisa.** Naya paid service / paid API / cloud worker / Redis nahi. Agar kuch free
   me possible nahi hai to **ruk kar** mujhe asli price ke saath options do — apne aap
   koi paid cheez mat chuno.
4. `web/` aur `app-mobile/` ko **touch nahi karna**. Helper chahiye to copy karo, original
   edit nahi.
5. **NO FAKE FEATURES.** Har button kaam kare. Nahi bana hai to button dikhao hi nahi.
   Bina chalaye "kaam kar raha hai" kabhi mat bolo.
6. **Verify before done:** jis package ko chhua wahan `npx tsc --noEmit`, app/render
   chalao, aur asli output paste karo. Video bana ho to `ffprobe` output paste karo.
7. Plan doc me listed dependency ke alawa kuch install karne se pehle **poochho**.
8. Chhote working checkpoints pe commit karo, asli commit message ke saath.
9. Subagent / workflow / background-cloud agent use nahi karna.
10. Mujhse baat **Hinglish** me, code aur comments repo ke existing style me.

---

## 3. DYNAMIC-FIRST RULES (ye main baar baar bolta hoon — inhe todna mana hai)

Sab kuch **data + registry** se chalega, hardcode se nahi. Naya feature add karna = ek
file + ek registry entry, poore codebase me edit nahi.

1. **Registries** (`packages/reel-core/registry/`): `ITEM_TYPES`, `SCENE_TYPES`,
   `TRANSITIONS`, `EFFECTS`, `ANIMATIONS`, `TRACK_TYPES`, `EXPORT_PRESETS`,
   `VALIDATION_RULES`. Har entry = `{ id, label, icon, schema (zod), defaults,
   controls (UI descriptor), component (render ke liye) }`.
2. **Properties panel generated hai** — registry ke `controls` descriptor se banta hai.
   Kisi type ke liye haath se panel likhna mana hai.
3. **Timeline / renderer / sidebar** sab registry se padhte hain. `if (type === 'image')`
   jaisi switch-chain sirf ek jagah (registry lookup) allowed hai.
4. **Koi magic number nahi.** 1080 / 1920 / 30 kabhi code me nahi — hamesha
   `doc.project.width/height/fps`. Aspect + resolution presets ek config list me.
5. **Tracks unlimited aur typed dynamically** — fixed 7 tracks hardcode nahi.
6. **Time math sirf helpers se**: `framesToSeconds`, `secondsToFrames`, `snapFrame`.
   Kahin bhi `/ 30` mat likho.
7. **Keyframes property-path se address hote hain** (`"transform.scale"`), isliye koi bhi
   nayi property automatically keyframable ban jaati hai — per-property code nahi.
8. **Templates = data** (DB ka jsonb + declarative slots), code me hardcoded scenes nahi.
9. **Brand = tokens.** Item me `"#C25A37"` nahi, `"brand.primary"` likho; render time pe
   resolve hota hai. Isliye brand badalne se poori reel badal jaati hai.
10. **Providers interface ke peeche**: `AIProvider`, `TTSProvider`, `LipSyncProvider`,
    `StorageDriver`, `RenderEngine` — env config se choose hote hain, plus ek offline mock.
11. **Validation = rule list**, if-else spaghetti nahi. Nayi check = list me ek entry.
12. **Har doc mutation** `reel-core/timeline/ops.ts` ke named op se — UI seedha doc mutate
    nahi karta (warna undo/redo aur AI patch dono toot jaate hain).

---

## 3A. A1 QUALITY BAR (video + voice) — non-negotiable

Quality me koi kami nahi chalegi. Ye rules render aur audio ke har phase pe lagu hain
(mainly Phase 3, 11, 15, 18, 20, 22).

**Video**
- H.264 High profile, `yuv420p`, **CRF ≤ 18** (high preset), max preset CRF 16.
- **Single encode** — Remotion se seedha final encode. FFmpeg pass sirf remux / faststart /
  audio loudness. Video ko dobara encode karna sirf tab jab bilkul zaroori ho.
- `-movflags +faststart`, GOP ~2s, sahi color range/space tags.
- Scaling `lanczos`. **Source se upar upscale mat karo** — zoom/scale keyframes milakar
  required pixels calculate karo aur zyada ho to warning do (Phase 20 rule).
- Preview aur final render ek hi component se — framing/quality me farak nahi.

**Audio**
- 48kHz stereo, AAC 192–320 kbps.
- Loudness ~**-14 LUFS** (social), true peak **-1 dBTP**, **zero clipping**.
- Voice track ka koi lossy→lossy chain nahi; intermediate hamesha WAV/PCM.
- Resample sirf ek baar, high-quality resampler se.

**Imaandaari:** agar quality problem hai (blurry asset, clipping audio, low-res 4K) to
export se pehle saaf bolna hai. "4K" ka label lagakar upscaled 1080p dena **mana hai**.

---

## 3B. SIZE & FIT — pehli class ka feature

Ye sirf reel app nahi hai. Har jagah **size selector** hona chahiye, aur **default = Reel**.

**Project sizes (config list, code me hardcode nahi):**

| Preset | Size | Kahan |
|---|---|---|
| **Reel / Shorts / Status (default)** | 1080×1920 (9:16) | Instagram, YouTube Shorts, WhatsApp |
| Square | 1080×1080 (1:1) | Feed post |
| Portrait | 1080×1350 (4:5) | Instagram feed |
| Landscape | 1920×1080 (16:9) | YouTube, website |
| Landscape HD+ | 2560×1440 / 3840×2160 | agar zaroorat ho |
| Classic | 1440×1080 (4:3) | rare |
| **Custom** | koi bhi width×height | user type kare |

- Project **banate waqt** size choose ho (default Reel), aur **baad me bhi badla ja sake** —
  badalne pe items ko re-fit karne ka option (safe-area aware), tudna nahi chahiye.
- fps bhi chunne layak: 24 / 25 / 30 / 50 / 60 (default 30).

**Har image/video item ke liye size + fit controls (bahut important):**
- **Fit mode:** `cover` (bhar do, crop ho), `contain` (poora dikhe, khaali jagah),
  `fill/stretch` (aspect toota — warning ke saath), `custom` (manual scale+position).
- **Contain ke background options:** solid color, brand color, **blurred copy of the video**
  (vertical reel me landscape footage ke liye sabse kaam ka), gradient.
- Scale, position (x/y), rotation, anchor, crop — sab per item, sab keyframable.
- **Auto-fit helpers:** "Fit to frame", "Fill frame", "Fit width", "Fit height",
  "Center", "Reset" — ek click me.
- Aspect mismatch pe (16:9 video ko 9:16 me daalne pe) UI khud suggest kare kya karein.
- Quality: fit/zoom ke baad effective resolution check ho (Section 3A ka upscale rule).

---

## 3C. AUDIO — hamesha 3 options

Jahan bhi audio chahiye (scene, character dialogue, voice-over), **teen options** dikhne
chahiye — ye locked requirement hai (poora Phase 22 me):

1. **Generate** — text likho → awaaz ban jaaye (TTS, free edge-tts)
2. **Upload** — apni recording / audio file
3. **Both** — dono (mix, ya ek primary + doosra alternate/fallback)

Aur jo bhi audio ho (generated ya uploaded), uska **cleanup / makeup** available ho:
silence trim, highpass, noise reduction, compression, loudness normalize, limiter —
before/after sunne ke saath. Chupchaap process nahi, numbers ke saath.

Jab tak Phase 22 nahi bana, sirf **Upload** option dikhega — baaki buttons UI me
**honge hi nahi** (fake button mana hai).

---

## 4. Phase list

**Milestone 1 — Manual editor jo asli MP4 deta hai (Phase 0–11)**

| # | Phase | File |
|---|---|---|
| 0 | Toolchain + workspace skeleton | [phases/00-toolchain-and-workspace.md](phases/00-toolchain-and-workspace.md) |
| 1 | Project JSON schema + core types + registries | [phases/01-project-json-and-core.md](phases/01-project-json-and-core.md) |
| 2 | Database + storage drivers | [phases/02-database-and-storage.md](phases/02-database-and-storage.md) |
| 3 | Remotion composition + worker + **first real MP4** | [phases/03-renderer-and-first-mp4.md](phases/03-renderer-and-first-mp4.md) |
| 4 | Studio app shell + project CRUD + autosave | [phases/04-studio-shell-and-projects.md](phases/04-studio-shell-and-projects.md) |
| 5 | Asset upload + media library | [phases/05-assets-and-media-library.md](phases/05-assets-and-media-library.md) |
| 6 | Preview player + transport + playhead | [phases/06-preview-player.md](phases/06-preview-player.md) |
| 7 | Timeline view (ruler, zoom, tracks, clips, selection) | [phases/07-timeline-view.md](phases/07-timeline-view.md) |
| 8 | Timeline editing: move/trim/split/cut/duplicate + undo | [phases/08-timeline-editing-ops.md](phases/08-timeline-editing-ops.md) |
| 9 | Generated properties panel + text items | [phases/09-properties-and-text.md](phases/09-properties-and-text.md) |
| 10 | Animations + transitions registry | [phases/10-animations-and-transitions.md](phases/10-animations-and-transitions.md) |
| 11 | Export pipeline end-to-end → **MILESTONE 1** | [phases/11-export-pipeline.md](phases/11-export-pipeline.md) |

**Milestone 2 — Real editor depth + reel superpowers (Phase 12–20)**

| # | Phase | File |
|---|---|---|
| 12 | Scene system + Add Scene + Scene Cards (beginner mode) | [phases/12-scenes-and-scene-cards.md](phases/12-scenes-and-scene-cards.md) |
| 13 | Keyframe engine + keyframe lanes | [phases/13-keyframe-engine.md](phases/13-keyframe-engine.md) |
| 14 | Effects registry + color pipeline | [phases/14-effects-registry.md](phases/14-effects-registry.md) |
| 15 | Audio depth: fades, curves, ducking, speed/freeze/crop | [phases/15-audio-and-clip-depth.md](phases/15-audio-and-clip-depth.md) |
| 16 | Multi-track manager + keyboard shortcuts + copy/paste | [phases/16-tracks-and-shortcuts.md](phases/16-tracks-and-shortcuts.md) |
| 17 | Templates engine + brand token system | [phases/17-templates-and-brand.md](phases/17-templates-and-brand.md) |
| 18 | Phone mockup + screen recording workflow | [phases/18-mockup-and-screen-recording.md](phases/18-mockup-and-screen-recording.md) |
| 19 | Captions system (manual + SRT/VTT + styles) | [phases/19-captions.md](phases/19-captions.md) |
| 20 | Export quality validation + asset lifecycle cleanup | [phases/20-quality-validation-and-lifecycle.md](phases/20-quality-validation-and-lifecycle.md) |

**Milestone 3 — AI as optional layer (Phase 21–23)**

| # | Phase | File |
|---|---|---|
| 21 | AIProvider + Gemini adapter + story→scenes + reviewable diff | [phases/21-ai-provider-and-scenes.md](phases/21-ai-provider-and-scenes.md) |
| 22 | TTS provider (edge-tts, free) + voices + characters | [phases/22-tts-and-voices.md](phases/22-tts-and-voices.md) |
| 23 | Auto captions via local whisper | [phases/23-auto-captions.md](phases/23-auto-captions.md) |

**Milestone 4 — Optional / heavy (Phase 24)**

| # | Phase | File |
|---|---|---|
| 24 | Lip-sync decision, batch reels, hosting, multi-user | [phases/24-optional-heavy.md](phases/24-optional-heavy.md) |

---

## 5. One-line prompts — bas ye copy karo

Har naye chat me **ek line**. Same line resume ke liye bhi chalti hai (agent khud
checklist verify karke aage badhta hai).

```
Read docs/reel-studio/README.md, then do Phase 0 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 1 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 2 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 3 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 4 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 5 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 6 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 7 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 8 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 9 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 10 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 11 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 12 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 13 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 14 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 15 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 16 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 17 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 18 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 19 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 20 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 21 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 22 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 23 of AI Reel Studio.
Read docs/reel-studio/README.md, then do Phase 24 of AI Reel Studio.
```

Agar phase adhoora chhoot gaya tha to bhi **wahi line** dena — agent Resume Protocol
follow karega. Aur agar tum kuch specific chahte ho to line ke aage jod sakte ho, e.g.
`... then do Phase 8 of AI Reel Studio. Split aur snapping pehle karo.`

---

## 6. Progress board (mai yahan nazar rakhta hoon)

| Phase | Status | Last updated |
|---|---|---|
| 0 | not started | — |
| 1 | not started | — |
| 2 | not started | — |
| 3 | not started | — |
| 4 | not started | — |
| 5 | not started | — |
| 6 | not started | — |
| 7 | not started | — |
| 8 | not started | — |
| 9 | not started | — |
| 10 | not started | — |
| 11 | not started | — |
| 12 | not started | — |
| 13 | not started | — |
| 14 | not started | — |
| 15 | not started | — |
| 16 | not started | — |
| 17 | not started | — |
| 18 | not started | — |
| 19 | not started | — |
| 20 | not started | — |
| 21 | not started | — |
| 22 | not started | — |
| 23 | not started | — |
| 24 | not started | — |

**Agent:** phase khatam karte waqt is table me apni row update karna (`complete` /
`in progress — next 8.4`) aur date daalna.
