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
| 0 | complete | 2026-08-19 |
| 1 | complete | 2026-08-19 |
| 2 | complete | 2026-08-19 |
| 3 | complete | 2026-08-19 |
| 4 | complete | 2026-08-19 |
| 5 | in progress — 5.1/5.4-5.9 verified; 5.2/5.3/5.10/5.11/5.12 sirf `studio/.env.local` par ruke hain | 2026-08-19 |
| 6 | in progress — 6.1/6.3/6.10/6.12 verified; baaki browser par (6.13 ka render aadha ho chuka) | 2026-08-19 |
| 7 | in progress — 7.1/7.2/7.5/7.7/7.9 verified; baaki browser par (38 test pass) | 2026-08-19 |
| 8 | in progress — core poora + naapa hua (8.4/8.5/8.6/8.9/8.11/8.13/8.14/8.16 verified); UI ka pointer wala hissa baaki | 2026-08-19 |
| 9 | in progress — panel poora + naapa hua (9.1/9.2/9.3/9.5/9.6/9.6b/9.6c/9.8/9.9/9.11/9.12 verified); browser wala hissa baaki | 2026-08-19 |
| 10 | in progress — registry+renderer poore aur naape hue (10.1-10.6, 10.8-10.12 verified); 10.7/10.13 browser par | 2026-08-20 |
| 11 | in progress — pipeline poora likha; quality ke dono bar naape gaye; poora chakkar `studio/.env.local` par ruka | 2026-08-20 |
| 12 | in progress — scene engine poora aur naapa hua (12.1-12.5, 12.8, 12.14 verified); UI browser par | 2026-08-20 |
| 13 | in progress — engine poora aur asli MP4 se naapa hua (13.1-13.6, 13.10-13.15 verified; do bug pakde gaye aur theek hue); 13.7 Phase 15 par, UI browser par | 2026-08-20 |
| 14 | in progress — effects registry poori aur asli MP4 se naapi hui (14.1-14.14 verified; do bug pakde gaye); mask/blend ka browser wala hissa baaki | 2026-08-20 |
| 15 | in progress — audio engine poora aur asli MP4 se naapa hua (ducking 17.30 dB, loudness -13.70 LUFS); teen bug pakde gaye; pan/reverse-button/crop-handles baaki (wajah doc me) | 2026-08-20 |
| 16 | in progress — tracks/shortcuts/markers/groups poore; hide render me bhi lagta hai (MP4 se naapa); 40 shortcuts bina takraav; browser wala hissa baaki | 2026-08-20 |
| 17 | in progress — template engine + brand tokens poore, render se naape gaye (brand badalne par rang ka fasla 215.5); ek bada bug pakda (render tokens padhta hi nahi tha); SQL/browser baaki | 2026-08-20 |
| 18 | in progress — phone frame + zoom-pan poore, MP4 se naape gaye (2x zoom par pixels me 1.99x); over-zoom par exact numbers; tap indicator jaan-boojhkar skip | 2026-08-20 |
| 19 | in progress — captions poore (SRT/VTT round-trip exact, 7 styles); MP4 se naapa: karaoke ka highlight 272→533 px chala, Devanagari sahi bana; 19.3 (cue blocks) nahi bana | 2026-08-20 |
| 20 | in progress — validator registry poora (17 rules, teen darwaze), Strict tier, cleanup ka faisla test se pakka; ek jhoothi-chetavni wala bug pakda; cleanup ka asli chalna worker/.env par ruka | 2026-08-20 |
| 21 | in progress — AI provider + mock + Gemini adapter + reviewable diff; zero-AI guard (10 edits, 0 calls) aur key-off dono sach me chalaye gaye; asli Gemini call GEMINI_API_KEY par ruki | 2026-08-20 |
| 22 | not started | — |
| 23 | not started | — |
| 24 | not started | — |

---

## 7. MILESTONE 1 ka summary (Phase 0-11) — 2026-08-20

Ye section jaan-boojhkar **do hisson** me hai. Pehla wo jo chal chuka hai aur naapa ja
chuka hai; doosra wo jo likha hua hai par abhi tak sirf compile hua hai. Beech ki koi
line nahi — "lagbhag kaam kar raha hai" jaisi baat is poore project me sabse mehngi hai.

### Jo sach me chalta hai (naapa gaya hai)

| Cheez | Saboot |
|---|---|
| **Asli MP4 banti hai** | `npm run render:sample` → 29/29 checks. h264 High / yuv420p / 1080×1920@30 / aac 48kHz 2ch, faststart, bt709 tags |
| **Ken Burns sach me chalta hai** | Rendered frames ke pixels se naapa: 312 / 360 / 408 px (expected 312.0 / 360.0 / 408.0 — farak 0px) |
| **Audio A1 bar par hai** | `@reel/media` check: normalize ke baad LUFS target ke 1.5 ke andar, true peak 0 se neeche |
| **Double-encode nahi hota** | Loudness pass ke pehle aur baad video ki frame ginti bilkul barabar |
| **Asset probe asli hai** | ffprobe se: rotated phone video par stored 640×480, dikhne wala 480×640 |
| **Thumbnail upscale nahi karti** | 120×90 image ka thumbnail 120×90 hi rehta hai |
| **Timeline ka poora ganit** | 55 test — zoom, ruler (24/25/30/60 fps), virtualization, marquee, snapping, ghost = drop |
| **Editing ke ops** | 213 assertion groups — cut/keep range, ripple delete, split + keyframes, overlap policy, 30 ops → 30 undo → deep equal |
| **Panel registry se banta hai** | Ek banawati item type register karke saabit: uske controls, section, `when`, default — sab bina naye code ke |
| **Naya animation = ek entry** | `grep rotateIn` poore repo me sirf registry entry + 2 test lines dikhata hai |

Kul: **`npm run check`** → studio 8/9/32/55/20, core 213, media 16 — sab 0 fail.
**`npm run typecheck`** → 6 workspaces, exit 0. **`npm run build:studio`** → pass.

### Jo likha hua hai par abhi chalaya nahi gaya

Ek hi wajah se — **`studio/.env.local` nahi hai**, isliye dev server uth hi nahi sakta:

- poora studio UI (media library, preview player, timeline ka drag/trim, properties panel,
  export dialog, render history)
- upload ka chakkar (browser probe → presign → R2/local → server probe → thumbnail)
- worker ka loop (job claim, render, upload, cancel, retry)
- preview vs render ka frame comparison (6.13, 9.14, 10.13)

Ye "shayad kaam karega" wali list hai, "kaam karta hai" wali nahi. Har phase ke doc me
har box ke neeche saaf likha hai ki uska kya saboot hai aur kya baaki hai.

### Milestone 1 ki line paar karne ke liye kya chahiye

1. `cp studio/.env.local.example studio/.env.local` aur asli values (STUDIO_PASSWORD,
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2 keys ya `REEL_STORAGE_DRIVER=local`)
2. Supabase SQL editor me do file chalao: `supabase/reel-studio-assets.sql` aur
   `supabase/reel-studio-render.sql`
3. `npm run dev:worker` (ek terminal) + `npm run dev:studio` (doosra)
4. Phir 11.14 ka test: 30s reel banao, `high` par export, aur `ffprobe` + `ebur128` ka
   output paste karo

**Agent:** phase khatam karte waqt is table me apni row update karna (`complete` /
`in progress — next 8.4`) aur date daalna.
