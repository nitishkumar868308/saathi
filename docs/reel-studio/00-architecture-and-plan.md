# AI Reel Studio — Architecture, Honest Review & Phase Plan

> **Status:** planning only. Zero code written yet (2026-08-18).
> **Rule for every phase:** sab kuch LOCAL. Koi naya paid service nahi. Koi fake button nahi.

---

## A. Current repository — what actually exists

| Area | Reality |
|---|---|
| `web/` | Next.js 14 + React 18 + Tailwind. Package name `saathi-landing`. Public marketing site + `/admin` + ~20 API routes. Deps tiny (supabase-js, framer-motion, lucide, nodemailer). |
| `app-mobile/` | Expo / React Native app (the real Apka Saathi product). Unrelated to video. |
| `supabase/` | ~60 hand-written `.sql` files (no migration tool). Project already linked. |
| `web/lib/r2.ts` | **Cloudflare R2 already working** — own SigV4 signer, presigned URLs, private bucket `apkasaathi-storage`. Reusable as-is. |
| `web/lib/translate.ts` | **Gemini already wired** — `GEMINI_API_KEY`, `GEMINI_MODEL`, batched JSON calls, usage logged via `logServiceUsage("gemini", ...)`. This is the AI we reuse. |
| `web/lib/admin-guard.ts`, `admin-password.ts` | Existing admin gate — reuse to protect the studio. |
| Video stack | **Nothing.** No Remotion, no FFmpeg, no queue, no editor code. Building from scratch. |

**Local machine:** Node v22.18, npm 10.9, Python 3.10, **FFmpeg not installed**, **no NVIDIA GPU**.

---

## B. Honest verdict — is this the right thing to build?

### The direction is correct
"Project JSON = single source of truth; timeline engine first; AI is an optional layer that only *writes* JSON; renderer only renders JSON" — ye architecture bilkul sahi hai. Isi ek decision se AI-generated reel editable rehta hai. **Locked.**

### But the 44-section spec is over-scoped
Full spec = a team's 6–12 month product. Tumhara asli maksad chhota hai: **Apka Saathi ke marketing reels, sasta aur dohraane laayak (repeatable)**.

So answer this before Milestone 2 (Phase 12+):

> Mahine me kitne reels? Kitne unme same shape ke?

- **20+ reels/month, same shape** (Rahul + Papa + app screen recording + CTA) → tool banana bahut faayda deta hai. Template pe click, text/audio badlo, export. CapCut me wahi cheez har baar 40 min.
- **2–3 reels total** → tool banane se sasta hai haath se CapCut me banana. Ye sach hai, chhupa nahi raha.

**Derisk:** Milestone 1 (Phase 0-11) pehle. Usse ek asli MP4 nikalta hai. Tab decide karo aage badhna hai ya nahi. Poore 44 section ka commitment aaj zaroori nahi.

### What I am cutting from the spec (and why)

| Spec says | My call | Reason |
|---|---|---|
| Redis + BullMQ | **Cut.** `render_jobs` table + `FOR UPDATE SKIP LOCKED`. | Managed Redis = paisa. Ek moving part kam. Ek hi worker hai — Postgres queue kaafi. |
| Deploy studio to Vercel | **Cut for Milestone 1-2.** Studio `localhost` pe tumhare PC pe. | Rs 0, FFmpeg available, media tumhare disk pe, no cold start. Deploy tab jab koi doosra use kare. |
| Lip-sync | **Interface banega, feature nahi.** Phase 24 me decide. | Is machine me GPU nahi. CPU Wav2Lip = ghanton. Paid API = mehnga. Reels me zoom + Ken Burns + achhi voiceover se kaam chal jaata hai. |
| 4K export | **Config flag, default 1080x1920.** | Instagram/Shorts sab re-encode karte hain — 4K ka fayda nahi, sirf render 4–8x slow. |
| `tracks` / `timeline_items` / `scenes` as separate SQL tables | **Cut.** Poora doc `projects.doc jsonb` me + `project_versions` snapshots. | Editor ek session me sau baar items badalta hai. Normalized rows me autosave + undo dard ban jaate hain. 30s reel JSON <100KB. |
| Multi-user auth + RLS | **Cut.** Single user, admin-password gate. | Sirf tum ho. Auth baad me add karna sasta; galat abstraction hatana mehnga. |
| Separate NestJS/Express | Already ruled out by you — agreed. | Next route handlers + ek local worker script kaafi. |

### The one real future cost: Remotion license
Remotion open-source hai par ek size/usage ke baad **company license** chahiye hoti hai (individual / very small team free). Aaj solo ho → free. Par:
- License terms **khud padho** Phase 3 se pehle: https://remotion.dev/license
- Isliye renderer ek `RenderEngine` interface ke peeche rahega, taaki baad me pure-FFmpeg engine se badla ja sake.

**Why Remotion despite that:** same React components preview *aur* final render dono chalate hain (`@remotion/player` + `@remotion/renderer`). Spec §32 "preview aur render same rahe" sirf isi tarike se sach me hota hai. Pure-DOM preview + FFmpeg render = do alag dimaag = hamesha mismatch.

### Zero-cost stack (all Rs 0)

| Need | Free choice | Note |
|---|---|---|
| DB | Supabase free tier | already linked |
| Media storage | R2 free (10GB, free egress) | `web/lib/r2.ts` ready to copy |
| Composition | Remotion (solo/free tier) | verify license |
| Media ops | FFmpeg | `winget install Gyan.FFmpeg` — needed |
| Script/scene AI | **Gemini** (already in repo) | free tier plenty for a few reels/day |
| Voiceover (TTS) | **edge-tts** (Microsoft Edge voices, Python) | free; good Hindi `hi-IN-MadhurNeural`, `hi-IN-SwaraNeural`. Replaces ElevenLabs |
| Captions | faster-whisper / whisper.cpp local | CPU fine for 30s audio |
| Queue | Postgres table | no Redis |
| Worker | tumhara PC | Rs 0 |

Paid only if later: hosted worker VPS (Rs 500–1500/mo), lip-sync API, Remotion company license.

### Risks I will not hide
1. Browser preview **2–3 video layers pe hakla sakta hai** (video decode limit). Images + audio + text reels — tumhara actual use case — smooth chalte hain.
2. Render on CPU: 30s @1080x1920 ≈ 1–4 min. Theek hai. 4K ≈ 10–25 min.
3. Windows + FFmpeg + Chromium paths me kharab din aate hain. Phase 0 ka poora maksad yahi risk pehle maarna hai.
4. No GPU ⇒ AI video generation / lip-sync / face animation ka koi free raasta nahi. Accept it.

---

## C. Proposed architecture

```
                     ┌──────────────────────────────┐
  Story ──► Gemini ──┤        PROJECT JSON          ├──◄── Template factory
  (optional AI)      │   (single source of truth)   │
                     └───┬──────────────────────┬───┘
                         │                      │
               Timeline Editor            Render Worker (your PC)
              (studio, localhost)         poll -> claim job
              zustand + immer + undo      Remotion renderMedia
                         │                FFmpeg post-process
                 autosave (debounced)     upload to R2
                         │                      │
                Supabase projects.doc     render_jobs.status/progress
```

Everything converges on Project JSON. AI writes it, templates write it, hand-editing mutates it, renderer reads it. Nothing else.

### Folder structure (npm workspaces; `web/` and `app-mobile/` untouched)

```
saathi/
├─ package.json                 # NEW: workspaces ["studio","packages/*","worker"]
├─ studio/                      # NEW Next.js app (local-first editor)
│  ├─ app/
│  │  ├─ page.tsx                       # project list
│  │  ├─ project/[id]/page.tsx          # THE editor
│  │  └─ api/
│  │     ├─ assets/presign/route.ts     # R2 upload URL
│  │     ├─ projects/[id]/route.ts      # load/save doc
│  │     ├─ render/route.ts             # enqueue job
│  │     ├─ render/[jobId]/route.ts     # status/progress
│  │     └─ ai/...                      # Phase 21+ only
│  ├─ components/editor/
│  │  ├─ TopBar.tsx  LeftSidebar.tsx  Preview.tsx  RightSidebar.tsx
│  │  ├─ timeline/{Timeline,Track,Clip,Playhead,Ruler}.tsx
│  │  └─ scenes/SceneCards.tsx          # beginner mode (Phase 12)
│  └─ lib/{supabase.ts,r2.ts,store.ts}  # r2.ts copied from web/lib/r2.ts
├─ packages/reel-core/          # NEW: pure TS, no React, no DOM
│  ├─ schema/{project.ts,zod.ts,migrate.ts}
│  ├─ timeline/{ops.ts,snap.ts,history.ts,select.ts}
│  ├─ keyframes/{interpolate.ts,easing.ts}
│  └─ validate/quality.ts               # validateProjectQuality etc.
├─ packages/reel-remotion/      # NEW: React comps used by BOTH player + renderer
│  ├─ Root.tsx  ReelComposition.tsx
│  ├─ items/{ImageItem,VideoItem,AudioItem,TextItem,ShapeItem}.tsx
│  ├─ transitions/{fade,crossfade,slide,zoom,blur}.tsx
│  ├─ effects/applyEffects.tsx
│  └─ mockups/PhoneFrame.tsx            # Phase 18
├─ packages/reel-media/         # NEW (Phase 5): ffmpeg/ffprobe wrapper, Node-only
│  ├─ ffmpeg.ts                          # run/probe/remux — pehle worker/src/ffmpeg.ts tha
│  ├─ probe.ts                           # ffprobe -> asset metadata (rotation aware)
│  └─ thumbnails.ts                      # image resize / video frame / audio waveform
├─ worker/                      # NEW: plain Node, runs on your PC
│  ├─ index.ts                          # poll -> claim -> render -> upload -> update
│  ├─ engines/remotion.ts                # RenderEngine impl (swappable)
│  └─ providers/{tts-edge.ts,captions-whisper.ts,lipsync-noop.ts}  # Phase 22-24
├─ supabase/reel-studio.sql     # NEW: follows existing plain-.sql convention
└─ docs/reel-studio/            # this plan + phase prompts
```

**Why not inside `web/`:** `web/` tumhari live marketing site hai Vercel pe. Usme Remotion/Chromium daalna = heavy build + live site ka risk. Alag app, shared helpers copy karke.

### Project JSON — canonical format (frames, not seconds)

Timing **integer frames** me, seconds me nahi. Frame-accurate cut/split ka yahi imaandaar tarika hai; float seconds me split karne se hamesha 1-frame gap/overlap aate hain.

```jsonc
{
  "version": 1,
  "project": { "id":"p_1", "name":"Rahul + Papa", "width":1080, "height":1920,
               "fps":30, "durationInFrames":900, "background":"#000000" },

  "tracks": [ { "id":"tr_v1", "type":"video", "name":"Video 1", "order":0,
                "muted":false, "hidden":false, "locked":false } ],

  "items": [{
    "id":"it_1", "trackId":"tr_v1", "type":"image", "sceneId":"sc_1",
    "startFrame":0, "durationInFrames":150,          // position on timeline
    "trimStartFrame":0, "playbackRate":1,            // NON-DESTRUCTIVE trim into source
    "assetId":"as_rahul",
    "transform":{ "x":0,"y":0,"scale":1,"rotation":0,"opacity":1,
                  "anchor":[0.5,0.5],"crop":null },
    "animations":[ {"type":"kenburns","from":1,"to":1.12,"easing":"ease-in-out"} ],
    "keyframes":{ "transform.scale":[ {"frame":0,"value":1,"easing":"ease-out"},
                                      {"frame":150,"value":1.12} ] },
    "effects":[ {"type":"blur","amount":0,"enabled":false} ],
    "audio":{ "volume":1,"muted":false,"fadeInFrames":0,"fadeOutFrames":0 },
    "transitionIn":{ "type":"fade","durationInFrames":15 },
    "transitionOut":{ "type":"none","durationInFrames":0 },
    "text":null
  }],

  "scenes": [ { "id":"sc_1", "name":"Rahul intro", "order":0,
                "itemIds":["it_1","it_2"] } ],

  "brand": { "presetId":"apka_saathi" },
  "meta":  { "createdBy":"manual|ai|template", "sourceStory":null }
}
```

**Key unification:** `scenes` sirf items ka **grouping** hai. Beginner "Scene Card" edit karta hai → wo items ko mutate karta hai. Advanced timeline wahi items dikhata hai. Ek truth, do views. AI aur manual dono yahi likhte hain — **do alag editor kabhi nahi**.

Non-destructive proof: trim = `trimStartFrame` + `durationInFrames` badalna. Split = ek item ko do items me todna, dono ka `trimStartFrame` alag. Original media file kabhi touch nahi hoti.

### Database schema (`supabase/reel-studio.sql`)

```sql
projects         (id, owner, name, doc jsonb, doc_version int, updated_at, created_at)
project_versions (id, project_id, doc jsonb, label, created_at)  -- snapshots / history
assets           (id, owner, kind, r2_key, filename, mime, bytes,
                  width, height, duration_ms, fps, sample_rate, channels,
                  lifecycle 'permanent'|'temporary', expires_at, checksum, created_at)
render_jobs      (id, project_id, doc jsonb,      -- FROZEN snapshot at export time
                  preset 'standard'|'high'|'uhd', status, progress int, error,
                  output_r2_key, output_bytes, duration_ms,
                  worker_id, claimed_at, started_at, finished_at, created_at)
templates        (id, name, thumbnail_r2_key, doc jsonb, tags text[])
brand_presets    (id, name, colors jsonb, fonts jsonb, logo_asset_id, watermark jsonb, cta jsonb)
characters       (id, name, image_asset_id, voice_id, notes)
voices           (id, provider 'edge'|'piper'|'upload', voice_key, language, gender, sample_asset_id)
```

Job claim — this replaces BullMQ entirely:

```sql
update render_jobs set status='processing', worker_id=$1, claimed_at=now()
where id = ( select id from render_jobs where status='queued'
             order by created_at limit 1 for update skip locked )
returning *;
```

`doc` job pe **freeze** hota hai — export ke baad editing karne se chal raha render nahi badalta.

### Timeline state architecture

- **zustand + immer** store; one slice = the Project JSON doc.
- Every mutation goes through a named op in `reel-core/timeline/ops.ts` (`splitItem`, `trimItem`, `moveItem`, `duplicateItem`, `deleteItems`, `setProperty`, `addScene`, `reorderScenes`…). UI **never** mutates the doc inline — ops only. Yahi undo/redo, AI, aur templates ko ek jaisa banata hai.
- **History:** immer patches (`produceWithPatches`), bounded ring buffer (50 entries). Patch-based = memory light, aur drag ke dauraan coalescing easy (ek hi undo entry).
- **Autosave:** local state instant → debounce 1.5s + max-wait 10s → `PATCH /api/projects/[id]` with `doc_version` optimistic check → periodic `project_versions` snapshot.
- Selection / playhead / zoom = **separate UI slice**, doc ke andar nahi (warna undo playhead bhi hilayega).

### Rendering architecture

```
Export click
  └─ validateExportSettings + validateProjectQuality  (block if Strict & critical)
  └─ POST /api/render  → insert render_jobs (doc frozen)
       └─ worker (your PC) claims job → resolves assets (R2 presigned / local cache)
            └─ Remotion renderMedia(ReelComposition, inputProps = doc)
                 onProgress → update render_jobs.progress
            └─ optional FFmpeg pass (loudness normalize, +faststart, thumbnail)
            └─ upload MP4 → R2 permanent/reels/<id>.mp4
            └─ status = completed → UI shows download
```

Preview uses **the same** `ReelComposition` via `@remotion/player`. One codebase, zero drift.
Output: H.264 MP4, 1080x1920 @30fps default; 16:9 and 1:1 via project config.

### Dependencies to add (Phase 0-3)

- `studio/`: `next react react-dom tailwindcss @supabase/supabase-js zustand immer zod remotion @remotion/player clsx lucide-react @dnd-kit/core`
- `packages/reel-remotion`: `remotion @remotion/transitions @remotion/media-utils`
- `worker/`: `@remotion/renderer @remotion/bundler @supabase/supabase-js tsx dotenv`
- System: **FFmpeg** (`winget install Gyan.FFmpeg`); Python `edge-tts` (Phase 22 only).

---

## D. Phase plan

**Ab phases alag files me hain (25 chhote phases, checklist ke saath):**
- [README.md](README.md) — phase list, one-line prompts, resume protocol
- [phases/](phases/) — har phase ki apni file + checkboxes + verify commands

Milestone mapping:

| Milestone | Phases | Kya milta hai |
|---|---|---|
| **M1 — Manual editor + real MP4** | 0-11 | timeline, cut/trim/split, text, animation, transition, export |
| **M2 — Depth + reel superpowers** | 12-20 | scenes/scene-cards, keyframes, effects, audio+ducking, tracks, templates+brand, phone mockup, captions, quality validation |
| **M3 — AI optional layer** | 21-23 | Gemini story to scenes (reviewable diff), TTS 3-mode audio, auto captions |
| **M4 — Optional heavy** | 24 | lip-sync decision, batch, hosting, multi-user |

Teen aur binding rule-sets README me hain aur har phase pe lagu hote hain:
**Section 3A - A1 Quality bar** (CRF <=18, single encode, 48kHz AAC, -14 LUFS, no fake 4K),
**Section 3B - Size & Fit** (default Reel 1080x1920 + saari sizes + custom; fit modes
cover/contain/fill/custom with blurred background), aur
**Section 3C - Audio 3 options** (Generate / Upload / Both + cleanup chain).

## E. Locked decisions (do not re-litigate in later phases)

1. Timing unit = **integer frames**; `fps` lives on the project.
2. Project JSON is the **only** source of truth; `version` field + `migrate.ts` from day one.
3. All doc mutations via named ops in `reel-core/timeline/ops.ts`.
4. Preview and render share **the same** Remotion components.
5. Queue = Postgres `render_jobs` + `SKIP LOCKED`. No Redis, no BullMQ.
6. Worker runs locally. Long renders never touch Vercel.
7. Doc stored as `jsonb`; history via `project_versions` snapshots.
8. Trim / split always non-destructive.
9. AI never renders and never silently mutates — it proposes a reviewable patch.
10. Editor must fully work with `GEMINI_API_KEY` unset.
11. `web/` and `app-mobile/` are **not modified** by this project.
