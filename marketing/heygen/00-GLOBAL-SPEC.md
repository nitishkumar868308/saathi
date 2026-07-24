# Apka Saathi — HeyGen Reel Production Spec (GLOBAL)

> Ye file **sirf ek baar** padho. Har video prompt isi spec ko reference karta hai,
> isliye per-video block chhota rehta hai.
> **LOCAL ONLY** — ise kahin upload / publish mat karo.

---

## 0. HeyGen ke baare me ek honest baat (padhna zaroori hai)

HeyGen ek **avatar + scene** platform hai, Veo/Sora jaisa full cinematic film generator **nahi**.
Matlab: "office me beta, ghar pe papa, emotional cut" — ye pura HeyGen akela realistic nahi banayega.

**Isliye har video 3-layer hybrid me bana hai** (ye HeyGen me 100% possible hai):

| Layer | Kya | HeyGen me kahan se |
|---|---|---|
| **A. Face/Hook** | Character camera ko dekh ke bolta hai (UGC style) | HeyGen Avatar / Photo Avatar (Avatar IV) |
| **B. Story B-roll** | Ghar, office, papa, documents ke shots | HeyGen Stock Library + HeyGen AI image/video generate (prompt diya hua hai) |
| **C. Product** | App screen, notification, logo end-card | Tumhari **apni screen recording** (Expo app se) — ye upload karo |

Layer C tum khud banao — 15-20 sec ki screen recording:
`Home → Reminder add → Document upload → Notification aata hua → Logo`
Ek baar bana lo, saare 90 videos me reuse hoga.

> Agar tumhe **pura cinematic** chahiye (real actors jaisa), to har video ke neeche
> `CINEMATIC PROMPT` block bhi diya hai — wo Veo 3 / Kling / Sora me paste karna.
> HeyGen se sirf voice + avatar + captions lena.

---

## 1. Brand Kit (repo se nikale gaye actual values)

| Token | Hex | Use |
|---|---|---|
| Primary / Terracotta | `#C25A37` | CTA button, logo, key text highlight |
| Terracotta Light | `#D8734D` | Gradient top, hover |
| Terracotta Deep | `#9C4227` | Gradient bottom |
| Deep Teal | `#125156` | App icon bg, dark end-card bg |
| Cream | `#F7F2E9` | Light bg, subtitle plate |
| Ink | `#2E2823` | Body text on light |
| Muted | `#6B5F54` | Secondary text |

**Logo:** `web/public/icon-square.png` (AS monogram + do log + handshake)
**Wordmark:** "Apka Saathi"
**Tagline (locked, kabhi mat badlo):** `Never Forget What Matters`
**Hindi tagline (optional 2nd line):** `Jo zaroori hai, wo yaad rahega`

**Fonts**
- Heading / on-screen text: **Poppins SemiBold** (fallback: Montserrat SemiBold)
- Subtitles: **Inter Bold** / Poppins Bold, 62-68px, white, 2px dark stroke + 40% shadow
- Devanagari (agar use karo): **Mukta Bold** ya **Noto Sans Devanagari Bold**

---

## 2. Canvas & Safe Zone (Instagram / YouTube Shorts)

- Resolution: **1080 × 1920**, 9:16, 30fps (agar option ho to 24fps for cinematic feel)
- **Safe text band: y = 260px se y = 1440px**
  - Top 260px → IG profile/handle overlay
  - Bottom 480px → caption, CTA, audio strip
- Logo end-card: center, y ≈ 860
- Subtitles: baseline y ≈ 1350 (safe band ke andar, neeche nahi)

---

## 3. Voice Setup (ek baar karo, 90 videos me chalega)

**Recommendation: HeyGen me apni brand voice CLONE karo.** Kyun:
stock TTS har video me alag lagega → brand recall nahi banega.

| Voice slot | Kiske liye | Setting |
|---|---|---|
| **V-NARRATOR (main)** | 70% videos — storytelling | Male, 30-35, warm, low pitch, **Speed 0.92**, Emotion: *Serious/Warm* |
| **V-FEMALE** | Videos 13, 14, 45, 56 etc. | Female, 28-32, calm confident, Speed 0.95 |
| **V-YOUNG** | Student/AI reels (3,16,58,88) | Male 22-25, energetic, Speed 1.05 |
| **V-ELDER** | Papa ki lines | Male 58-65, slower, Speed 0.85 |

**Agar clone nahi karna** → HeyGen Voice Library me filter: `Language = Hindi (India)` →
male "warm/narration" tag wala pick karo. Ek baar pick karke **saare videos me wahi** use karo.

**Pause control (HeyGen script box me):**
- Comma = short breath
- HeyGen ka `[pause 0.5s]` / `...` = dramatic beat
- Emotional line ke baad **hamesha 0.4-0.6s pause** — warna impact mar jata hai

---

## 4. Language & Country Matrix

Har video ka **ek Hindi-Hinglish master** banao, phir HeyGen **Video Translate**
(lip-sync ON) se variants nikalo. Same video, 6 markets.

| # | Market | Audio | Burned-in Subtitle | Kyun |
|---|---|---|---|---|
| 1 | **India — Hindi belt** (UP, MP, BR, RJ, DL, HR, UK, JH, CG) | Hindi-Hinglish | **Roman Hinglish** | Devanagari padhne me slow, Roman fast scroll me readable |
| 2 | **India — Metro Tier-1** (MH, KA, TS, GJ) | Hindi-Hinglish | **English** | Mixed audience |
| 3 | **India — South** (TN, KL, AP, KA) | **English (Indian accent)** | English | Hindi resistance; dub Tamil/Telugu tabhi jab budget ho |
| 4 | **NRI — US / UK / Canada / Australia** | **English (Indian accent, warm)** | English | Emotion same, language English. NRI ko "papa ke documents" hook sabse zyada lagta hai |
| 5 | **UAE / Saudi / Qatar** (Gulf Indians) | Hindi-Hinglish | **English + Arabic** | 35 lakh+ Indian diaspora, high intent |
| 6 | **Global / paid ads** | English (neutral) | English | Brand-agnostic cut, "Indian" reference hatao |

**Regional dub priority (jab scale karo):** Tamil → Telugu → Marathi → Bengali → Gujarati → Kannada

**Rule:** Tagline `Never Forget What Matters` **har language me English hi rahegi**. Translate mat karo.

---

## 5. Style Bible (har video pe apply)

**Grade / Look**
- Office / problem scenes → cool, desaturated, `#8FA3AD` tint, 
- Ghar / family / solution scenes → warm, golden hour, `#E8B27A` tint
- **Transition point** = jab app open hoti hai → cool se warm shift. Ye emotional "relief" sell karta hai.
- Film grain 4%, slight vignette, no heavy LUT

**Camera**
- 85% shots: handheld subtle, 35mm/50mm, shallow DOF (f/2.0)
- Product shot: locked tripod, clean
- No zoom-in gimmicks; **slow push-in** allowed on emotional beat

**Casting rules (consistency ke liye)**
- Rahul (main male, 30): light blue formal shirt, sleeves folded, clean beard, lanyard ID
- Papa (60): white/cream kurta ya check shirt, thick-frame glasses, silver hair
- Maa (55): simple cotton saree ya salwar, small bindi
- Wife (28-30): kurti, minimal jewellery
- **Har video me same look rakho** → 90 reels ek "series" lagengi, alag-alag ads nahi

**Editing**
- Avg shot length 1.8-2.5s. Hook shot 0-2s me **face + conflict** dono dikhna chahiye
- Cut on VO beat, not on music beat
- Last 3s: logo card, no VO overlap

**Music**
- HeyGen stock / Epidemic Sound. Search: `indian emotional piano`, `soft strings hopeful`, `sitar minimal`
- Level: VO -6 dB, music **-24 dB** (VO ke neeche dabana zaroori hai)
- Emotional videos: solo piano + light strings
- Product/AI videos: minimal electronic pulse

**SFX (chhoti cheez, bada difference)**
- Phone vibrate `brrt-brrt` — problem beat pe
- Notification `ting` — **hamesha app reminder pe, ek signature sound rakho** (audio branding)
- Paper rustle — document scenes

---

## 6. Locked End-Card (saare 90 videos me identical)

```
Duration: 3.0s
BG: Deep Teal #125156, subtle radial glow center
0.0-0.4s : logo icon-square.png scale 0.9 → 1.0, fade in
0.4-1.2s : wordmark "Apka Saathi" — Poppins SemiBold 96px, #F7F2E9
1.2-2.0s : tagline "Never Forget What Matters" — Poppins Medium 46px, #C25A37
2.0-3.0s : CTA pill — "Download Now" — bg #C25A37, text #F7F2E9, radius 40px
           + chhota text: "Play Store • App Store" 32px #F7F2E9 70% opacity
VO: sirf "Apka Saathi." (0.0-1.0s), phir silence — tagline ko padhne do
```

---

## 7. HeyGen me build karne ka exact flow

1. **New Project → Blank → Portrait 9:16**
2. Scene 1 me **Avatar** daalo (hook line) — baaki scenes me avatar OFF, sirf VO
3. Har scene me: Media tab → Stock search (keyword diya hua hai) **ya** AI-generate (prompt diya hua hai)
4. Script box me **Hindi-Hinglish script** paste karo → Voice select → Generate
5. **Captions ON** → Style: Poppins Bold, White, Highlight color `#C25A37`, position **Middle-Lower**
6. Text overlay add karo (per-video diya hua hai) — Poppins SemiBold
7. Music add → volume 15-20%
8. Last scene me apna **end-card** (upload as image/video)
9. Export 1080p
10. **Translate:** Project → Translate → language pick → Lip-sync ON → export

---

## 8. Caption / Hashtag template (Instagram)

```
[Hook line video se, Hinglish]

Apka Saathi — aapke documents, dates aur reminders, sab ek jagah.
📄 Documents safe
🔔 Expiry se pehle reminder
🤖 AI se bolke reminder banao

Download link bio me 👇

#ApkaSaathi #NeverForgetWhatMatters #ReminderApp #DocumentSafe
#IndianFamily #Hinglish #DesiParents #ProductivityIndia #MadeInIndia
```
NRI cut ke liye add: `#NRI #IndiansInUSA #IndiansInUK #IndiansInDubai #DesiAbroad`

---

## 9. Quick reference — script word budget

Hindi-Hinglish TTS ≈ **2.5 words/sec** (emotional pace, pauses included)

| Video length | Hindi words | English words |
|---|---|---|
| 20s | 48-52 | 45-50 |
| 25s | 60-65 | 55-62 |
| 30s | 72-78 | 68-75 |
| 35s | 85-90 | 80-88 |

**End-card ke 3s isme se minus karo** — yaani 25s video = 22s VO + 3s card.
