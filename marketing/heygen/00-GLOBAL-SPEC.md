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

**Casting rules** → ab poora system hai, dekho **§5A. CHARACTER LOCK** (neeche).
Sirf kapde likhne se face consistent nahi hota. §5A follow karna **mandatory** hai.

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

## 5A. CHARACTER LOCK — face badalne ki problem ka fix

> Ye section **sabse zyada important** hai. Video 1 me jo hua — shuru me Rahul ka face
> sahi, beech me badal gaya — uska poora ilaaj yahan hai.

### Kyun badalta hai (asli wajah)

HeyGen (aur har AI image/video tool) **har scene ko zero se, alag generate karta hai.**
Scene 1 aur Scene 6 ke beech koi memory nahi hoti.

Matlab jab tum likhte ho *"Indian male, 30, light blue shirt, trimmed beard"* —
wo description **crore log** pe fit hoti hai. Tool har baar us range me se ek naya
random face utha leta hai. Isliye:

| Galti | Kya hota hai |
|---|---|
| Har scene text-prompt se generate karna | Har scene me naya insaan |
| Description loose (`male, 30, beard`) | Tool ko koi lock nahi mila → random face |
| Ek hi prompt me 2 characters (Rahul + Papa) | Tool dono ko blend kar deta hai, ya swap |
| Har shot ka seed alag | Same prompt bhi alag face dega |

### Fix ka usool: **ek baar cast karo, 90 videos me wahi chehra**

Face ko **description se nahi, reference image se** lock karna hai.
Text kabhi consistent nahi hoga — image hamesha hoga.

---

### STEP 1 — Hero stills banao (ye sirf EK BAAR ka kaam hai)

Har character ka **ek** clean portrait generate karo. Isme time lagao —
ye 90 reels ka foundation hai. 10-15 attempts lagenge, theek hai.

Kahan se: HeyGen AI Image, ya Midjourney/Flux (behtar quality), ya koi bhi tool.
Sirf shart: **front-facing, neutral expression, even light, plain background.**

Generate karne ke baad **local folder me save karo**:

```
marketing/heygen/cast/
  RAHUL-01-hero.png      ← front, neutral, plain grey bg   [59 videos]
  RAHUL-01-profile.png   ← 3/4 angle, same face
  PAPA-01-hero.png                                          [21 videos]
  MAA-01-hero.png                                           [20 videos]
  AMAN-01-hero.png                                          [16 videos]
  VIKRAM-01-hero.png                                        [14 videos]
  ... baaki 7 + two-shots → cast/ROSTER.md me poori list hai
  TWOSHOT-RAHUL-PAPA.png ← dono saath, ek hi image me (neeche STEP 4 dekho)
```

**Order matters:** `RAHUL-01` pehle banao aur usme sabse zyada time do — wo akela
59 videos ka lead hai. Poora priority order `cast/ROSTER.md` me hai.

> Ye folder **local rakhna**. Kahin upload/publish mat karna — sirf HeyGen ke
> apne asset library me, kaam ke liye.

---

### STEP 2 — Locked identity strings

**Poori roster yahan hai → [`cast/ROSTER.md`](cast/ROSTER.md)**

Wo file **single source of truth** hai. 12 characters, har ek ki hyper-specific
identity string. Kapde nahi — **chehre ki geometry aur distinctive marks** lock
karte hain (mole, scar, daanton ka gap). Ye nishaan AI ko sabse strong anchor
dete hain, kyunki ye "average face" se hat ke hote hain.

| ID | Kaun | Umar | Videos |
|---|---|---|---|
| `RAHUL-01` | Main lead, office professional | 30 | **59** |
| `PAPA-01` | Papa | 62 | **21** |
| `MAA-01` | Maa | 55 | **20** |
| `AMAN-01` | Chhota bhai / student | 21 | **16** |
| `VIKRAM-01` | Business owner / senior colleague | 36 | **14** |
| `RAVI-01` | Tier-2 dukaandaar / bada father | 45 | **10** |
| `PRIYA-01` | Rahul ki wife | 29 | **9** |
| `KAVYA-01` | Senior professional woman | 32 | **9** |
| `NEHA-01` | Young working woman | 26 | **5** |
| `CHOTU-01` | Bachcha | 12 | **4** |
| `ANJALI-01` | Beti / school student | 17 | **3** |
| `DADI-01` | Dadi | 74 | **1** |

> Pehle har video apna naya character invent karta tha — 36 alag umar/look.
> Do nuksaan the: **credits jal rahe the** (har video me naye faces), aur
> **series nahi ban rahi thi** (90 alag ads lag rahe the, ek brand nahi).
> Ab ye 12 hi hain, aur inki identity strings **saare 90 MASTER PROMPTs me
> already paste hain** — tumhe kuch copy nahi karna, sidha prompt uthao aur chalao.

**Sabse pehle sirf `RAHUL-01` ka hero still banao — wo akela 59 videos ka lead hai.**

---

### STEP 3 — Har scene **image-to-video** banao, text-to-video kabhi nahi

Ye **sabse critical rule** hai. Ek baar hero still ban gaya, uske baad
**kabhi bhi** khaali text se character generate mat karna.

HeyGen me:
1. **Avatars → Photo Avatar → Create** → `RAHUL-01-hero.png` upload → naam do `RAHUL-01`
2. Wahi baaki 11 characters ke liye karo (`cast/ROSTER.md` ke priority order me)
3. Har scene me us saved avatar ko **select** karo — dobara generate mat karo
4. Jahan AI se naya shot chahiye: **Media → AI Generate → Reference image** me
   `RAHUL-01-hero.png` attach karo, phir shot ka prompt likho

Midjourney/Flux/Kling me: `--cref <image-url> --cw 100` (character reference, full weight)
ya "reference image" slot me hero still daalo.

**Per-shot prompt ka template:**
```
[Reference image: RAHUL-01-hero.png — keep this exact face, unchanged]

Same person as the reference image. <shot description>.
<wardrobe>. <lighting/grade>. 50mm, shallow depth of field, handheld.

IDENTITY LOCK: identical face to the reference — same jawline, same nose,
same eyes, same mole on the left cheekbone, same hairline. Do not restyle,
do not age, do not beautify.
```

---

### STEP 4 — Ek generation me **ek hi character** (do-shot ka alag tarika)

Ek prompt me do log dene se tool unke features mila deta hai — Papa jawan lagne
lagte hain, Rahul ke baal safed aa jaate hain.

**Rule:** har generation me sirf ek character. Do log ek frame me chahiye
(jaise Video 01 ka balcony shot) to inme se ek karo:

- **A (best):** `TWOSHOT-RAHUL-PAPA.png` **ek baar** banao — dono hero stills ko
  reference me daal ke. Wo approve ho jaye to **usi ek image ko** har two-shot ka
  reference banao. Naya two-shot kabhi text se mat banana.
- **B:** Do alag shots — Rahul ka close-up, Papa ka close-up — aur edit me
  shot-reverse-shot ki tarah cut karo. Ye emotionally aur strong lagta hai,
  aur consistency 100% rehti hai.
- **C:** Over-the-shoulder — foreground wala insaan back se / out of focus.
  Sirf ek face frame me → koi blend nahi.

---

### STEP 5 — Negative prompt (har generation me paste karo)

```
different person, face swap, changed facial features, inconsistent identity,
younger face, older face, different hairline, added glasses, removed glasses,
different beard style, beautified skin, plastic skin, western features,
two people merged, extra fingers, distorted hands, text, watermark, logo
```

---

### STEP 6 — Seed lock

Jis tool me seed field ho (Flux, SDXL, Kling), ek seed fix karo aur **saare
90 videos me wahi** use karo:

| Character | Seed |
|---|---|
| RAHUL-01 | `770301` |
| PAPA-01 | `770362` |
| MAA-01 | `770355` |
| AMAN-01 | `770321` |
| VIKRAM-01 | `770336` |
| RAVI-01 | `770345` |
| PRIYA-01 | `770329` |
| KAVYA-01 | `770332` |
| NEHA-01 | `770326` |
| CHOTU-01 | `770312` |
| ANJALI-01 | `770317` |
| DADI-01 | `770374` |

Seed alone kaafi nahi hai — reference image ke **saath** use karo. Dono milke lock bante hain.

---

### STEP 7 — QA gate (export se pehle har video pe)

Video export karne se pehle ye 6 check karo. Ek bhi fail → wo shot dobara banao.

- [ ] Har shot me Rahul ka face **same** hai (mole left cheekbone pe hai?)
- [ ] Papa ke glasses **har shot me black rectangular** hain (round/rimless nahi ho gaye?)
- [ ] Papa ke baal har shot me **poore silver** hain (kahin kaale to nahi?)
- [ ] Rahul ki shirt har shot me **light blue** hai, sleeves folded
- [ ] Beard length har shot me same (3-day stubble — kahin clean-shave ya full beard nahi)
- [ ] Two-shot me dono alag-alag log lag rahe hain (blend nahi hue)

**Tez tareeka:** timeline se har shot ka ek frame nikaalo, sabko ek grid me side-by-side
rakho. Face drift 2 second me dikh jayega — video chala ke dhoondne se nahi milta.

---

### Ek line me poora fix

> **Face ko text se describe mat karo — reference image se lock karo.
> Ek baar cast karo, har generation me wahi image attach karo, ek frame me ek hi character.**

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

> **Pehli baar:** §5A ka STEP 1 + STEP 2 kar lo (hero stills + Photo Avatars).
> Ye ek baar ka setup hai; uske baad har video me sirf select karna hai.

1. **New Project → Blank → Portrait 9:16**
2. Scene 1 me **Avatar** daalo — Photo Avatar list se `RAHUL-01` (naya generate mat karna).
   Baaki scenes me avatar OFF, sirf VO
3. Har scene me: Media tab → Stock search (keyword diya hua hai) **ya** AI-generate.
   AI-generate me **hamesha reference image attach karo** (`cast/` folder se) —
   warna face badal jayega. §5A STEP 3 dekho.
4. Script box me **Hindi-Hinglish script** paste karo → Voice select → Generate
5. **Captions ON** → Style: Poppins Bold, White, Highlight color `#C25A37`, position **Middle-Lower**
6. Text overlay add karo (per-video diya hua hai) — Poppins SemiBold
7. Music add → volume 15-20%
8. Last scene me apna **end-card** (upload as image/video)
9. **QA gate — §5A STEP 7 ki 6 checks chalao.** Face drift mile to wo shot dobara banao
10. Export 1080p
11. **Translate:** Project → Translate → language pick → Lip-sync ON → export

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
