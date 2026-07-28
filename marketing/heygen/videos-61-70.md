# Apka Saathi — HeyGen Ready Prompts | Videos 61–70

> Pehle `00-GLOBAL-SPEC.md` padho. **LOCAL ONLY.**

**Seedhi baat:** brief me ye batch 90 me sabse zyada repeat wala tha — do launch video
(61, 64), do download video (62, 65), ek aur before/after (67), do AI video (66, 68),
ek aur family (69), ek aur brand film (70). Agar seedha bana dete to 10 me se 7 videos
pehle wale 60 ki copy lagti.

Isliye maine har ek ko **naya kaam** diya hai — aur is baar do videos me **app ke asli
numbers** use kiye hain (repo se nikale gaye), taaki CTA jhoothi na lage.

---

## ✅ Repo se verify kiye gaye facts (V61, V62, V65 me use hue hain)

`app-mobile/src/lib/plan.ts` aur `referral-code-modal.tsx` se:

| Fact | Value |
|---|---|
| Free plan | **5 active reminders, 3 documents.** AI + premium locked |
| Plus plan | **₹99/mahina**, **₹999/saal** — sab unlimited |
| Referral | Code lagao → **1 document + 1 reminder** add karo → **dono** ko free Plus days |
| Referral limit | Ek hi baar lagta hai per user |
| Web | apkasaathi.com |

> ⚠️ Ye numbers `app_config` se aate hain aur admin badal sakta hai. **Video banane se
> pehle live values confirm kar lo.** Agar pricing badle to V65 dobara record karna
> padega — isliye V65 ko aakhir me banao.

---
---

# VIDEO 61 — "Colleague Ne Bataya"
**Angle:** **Referral / word-of-mouth** — asli growth loop | **Length:** 28s | **Voice:** V-NARRATOR
**Target:** SAB. **Commercially is batch ka sabse valuable video.**

> **Repetition guard:** V50 = launch elaan (brand bolta hai). V29 = install flow.
> **V61 alag hai kyunki isme brand bolta hi nahi** — ek colleague bolta hai. Ye app ka
> asli referral feature bechta hai, jo abhi tak 60 videos me ek baar bhi nahi aaya.
> Aur ye growth loop hai: har viewer ek naya referrer ban sakta hai.

### MASTER PROMPT (HeyGen)
```
Create a 28-second vertical 9:16 authentic Indian word-of-mouth reel, 1080x1920.

STORY: He didn't find the app through an ad. A colleague at work told him — "yaar, just
try this." The colleague shared his referral code. He downloaded it, entered the code,
added one document and made one reminder — and they both got free Plus. Now he passes his
own code to other people. Good things get told, not sold.

TONE — CRITICAL: This must feel like a real recommendation between two colleagues, not an
advertisement. Understated, everyday, believable. No enthusiasm performance. The moment
one of them oversells it, the video dies.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

[VIKRAM-01]
  Indian male, exactly 36 years old, broad rectangular face, wheatish skin, thick
  black hair combed back with a slightly receding hairline at the temples, heavy dark
  eyebrows, narrow dark eyes, a full but neatly trimmed black beard covering the jaw,
  a small horizontal scar on the left side of the chin under the beard, no glasses,
  solid medium-heavy build, height 5 feet 11 inches.
  Wardrobe: Well-fitted white or pale-grey shirt, sleeves rolled to the elbow, no
  tie, brown leather strap watch on the left wrist.

ROLES: RAHUL-01 and VIKRAM-01 are long-time colleagues.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

SETTING: A real office — a canteen table, a stairwell landing, a desk cluster. Not a
glossy boardroom.

LOOK: Natural, warm, documentary-realistic. Handheld, mid-shots, ambient office sound.
Deliberately less polished than the brand films — the roughness reads as honesty.
VOICE: Hindi-Hinglish, male narrator, casual and matter-of-fact, speed 0.98.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Light, warm, minimal. Almost background.
END CARD: standard Apka Saathi card, plus a "Referral code lagao" line.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Office canteen, two colleagues with chai, ordinary conversation | "Mujhe kisi ad se pata nahi chala." | — |
| 2 | 4.0–8.0 | One shows the other his phone, casual shrug | "Office me ek colleague ne bataya — yaar ye try kar." | `"Yaar ye try kar."` |
| 3 | 8.0–11.0 | **Screen recording:** referral code being shared/copied | "Usne apna referral code diya." | `Referral code` |
| 4 | 11.0–16.0 | **Screen:** install → code entered → confirmation | "Maine app download ki, code laga di." | `Code lag gaya 🎉` |
| 5 | 16.0–20.5 | **Screen:** one document uploaded, one reminder created | "Ek document daala. Ek reminder banaya." | `1 document + 1 reminder` |
| 6 | 20.5–24.0 | Both phones side by side, both showing free Plus days | "Dono ko free Plus mil gaya — mujhe bhi, usko bhi." | `Dono ko free Plus ✅` |
| 7 | 24.0–25.5 | He shares his own code with a third colleague | "Ab main apna code doosron ko deta hoon. Achhi cheez batayi jaati hai. Bechi nahi." | `Batayi jaati hai. Bechi nahi.` |
| 8 | 25.5–28.0 | **END CARD + referral line** | "Apka Saathi." | `Referral code lagao — dono ko Plus` |

### SCRIPT — HI
```
Mujhe kisi ad se pata nahi chala.

Office me ek colleague ne bataya — yaar ye try kar.

Usne apna referral code diya.

Maine app download ki, code laga di.

Ek document daala. Ek reminder banaya.

Dono ko free Plus mil gaya — mujhe bhi, usko bhi.

Ab main apna code doosron ko deta hoon.

Achhi cheez batayi jaati hai. Bechi nahi.

Apka Saathi.
```
*(66 words ≈ 25s)*

### SCRIPT — EN
```
I didn't find it through an ad.

A colleague at work told me — "yaar, just try this."

He gave me his referral code.

I downloaded the app and entered it.

Added one document. Made one reminder.

We both got free Plus — him and me.

Now I pass my own code to other people.

Good things get told, not sold.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 28s, natural documentary-realistic Indian office, handheld, ambient light,
35mm. Deliberately less polished than a brand film.
Shot 1: two Indian colleagues, 30 and 33, standing at an office canteen counter with
paper cups of chai, mid-conversation, easy familiarity, 5s.
Shot 2: one of them turning his phone towards the other with a casual shrug, 4s.
Shot 3: close-up of two hands, two phones held side by side, 4s.
Shot 4: the younger colleague back at his desk, tapping at his phone, unremarkable
everyday moment, 5s.
Shot 5: the same man later showing his phone to a third colleague in a stairwell, the same
casual gesture repeating, 6s.
No text, no graphics, no UI mockups.
```

---
---

# VIDEO 62 — "Pehle Din Khali Thi"
**Angle:** **30-din ka safar** — install nahi, aadat | **Length:** 25s | **Voice:** V-NARRATOR (warm)
**Target:** India broad. Retention message, acquisition nahi.

> **Repetition guard:** V29 = **install ka lamha** (40 second, OTP, pehla reminder).
> **V62 uske baad ka mahina hai.** Empty state se bhari hui zindagi tak. Ye retention
> bechta hai — "app chhodoge nahi, kyunki ek mahine baad wo tumhari zindagi ban jaati hai."
> Isliye ye video **naye users ko dobara laane** ke liye best hai, pehli baar laane ke liye nahi.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 warm Indian product-journey reel, 1080x1920.

STORY: On day one the app was completely empty. He made one reminder — the electricity
bill. Day two — Mom's birthday. Within a week — passport, insurance, two meetings. A month
later he opened it and realised: this isn't an app, it's a list of his life. It starts
with an empty screen. All it needs is one reminder.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

ROLES: RAHUL-01 revisited across a month; his clothes change day to day but his face
never does.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

VISUAL SPINE: The app screen FILLING UP over time is the story. Show the same screen at
day 1, day 2, day 7 and day 30, in the same framing, so the growth is unmistakable. That
progression is the film.

SETTING: The same corner of the same home, revisited across a month at different times of
day.

LOOK: Warm, consistent, gently progressing. Identical framing for every app screen shot.
Light shifts subtly across the month to signal time passing.
VOICE: Hindi-Hinglish, male narrator, warm and reflective, speed 0.95.
CAPTIONS: Poppins Bold white, highlight #C25A37. Day counters.
MUSIC: A simple motif that adds one instrument layer with each stage — the music fills up
alongside the screen.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | **Screen:** completely empty state, one "+" button | "Pehle din app bilkul khali thi." | `Din 1` |
| 2 | 4.0–7.0 | **Screen:** one card appears | "Ek reminder banaya — bijli ka bill." | `1 reminder` |
| 3 | 7.0–10.0 | **Screen, same framing:** two cards | "Doosre din — Maa ka birthday." | `Din 2` |
| 4 | 10.0–14.5 | **Screen, same framing:** six cards, categories appearing | "Hafte bhar me — passport, insurance, do meetings." | `Din 7` |
| 5 | 14.5–19.0 | **Screen, same framing:** a full, organised, living list | "Ek mahine baad kholi to laga…" | `Din 30` |
| 6 | 19.0–21.5 | He looks at it, small realisation, warm light | "ye app nahi hai. Ye meri zindagi ki list hai." | `Ye meri zindagi ki list hai.` |
| 7 | 21.5–22.5 | Cut back to the empty day-1 screen for one beat | "Khali screen se shuru hota hai. Bas ek reminder chahiye." | `Bas ek reminder.` |
| 8 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Pehle din app bilkul khali thi.

Ek reminder banaya — bijli ka bill.

Doosre din — Maa ka birthday.

Hafte bhar me — passport, insurance, do meetings.

Ek mahine baad kholi to laga...

ye app nahi hai. Ye meri zindagi ki list hai.

Khali screen se shuru hota hai. Bas ek reminder chahiye.

Apka Saathi.
```

### SCRIPT — EN
```
On day one, the app was completely empty.

I made one reminder — the electricity bill.

Day two — Mom's birthday.

Within a week — passport, insurance, two meetings.

A month later I opened it and realised...

this isn't an app. It's a list of my life.

It starts with an empty screen. All it needs is one reminder.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, warm consistent home interior revisited across a month, identical
framing throughout, 50mm.
Shot 1: a 29-year-old Indian man sitting in a specific corner of a room — a chair by a
window — holding a phone, early morning light, 5s.
Shot 2: same framing, same chair, same man in different clothes, midday light, 4s.
Shot 3: same framing, evening light, a cup of chai now on the side table, 4s.
Shot 4: same framing, a month later — the space slightly more lived-in, warm lamp light,
the man relaxed, 6s.
Shot 5: close-up of his face looking down at the phone with a small warm realisation, 6s.
The repeated identical framing across changing light is the entire visual idea.
No text, no graphics, no UI mockups.
```

---
---

# VIDEO 63 — "Teesri List"
**Angle:** **Apni list hamesha aakhir me aati hai** | **Length:** 25s | **Voice:** V-NARRATOR (reflective)
**Target:** India 28–45. Emotionally sharp, quietly relatable.

> **Repetition guard:** V25 = kaam + ghar (do zindagiyan). **V63 me teesri list hai — apni.**
> Doctor, gym, wo course, wo call jo aap teen mahine se taal rahe ho. Ye insight 62 videos
> me nahi aaya, aur ye sabse chupke se lagne wali baat hai.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 reflective Indian reel, 1080x1920.

STORY: Every person carries three lists. One — the boss's list; that one comes first. Two
— the home's list; that one matters most. Three — your own list: the doctor, the gym, that
course, that call. The third list is the shortest, and the most ignored. Now all three
live in one place. And the third one gets remembered too.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[KAVYA-01]
  Indian woman, exactly 32 years old, long face with a strong jaw, wheatish skin,
  dark brown hair tied back into a neat low ponytail with a centre parting, defined
  straight eyebrows, sharp dark eyes, high cheekbones, a small scar on the left side
  of the upper lip, thin black-framed rectangular glasses always worn, medium build,
  height 5 feet 5 inches.
  Wardrobe: Charcoal or navy blazer over a plain shirt, minimal steel wristwatch on
  the left wrist.

ROLES: KAVYA-01, capable but always last in her own queue.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
KAVYA-01 in the final shot must be recognisably the SAME PERSON as KAVYA-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

VISUAL IDEA: Represent the three lists physically — three actual pieces of paper, or three
sections of a screen. The third one should be visibly smaller, thinner, pushed aside.
When the app appears, all three become equal in size. That equalisation is the payoff.

SETTING: An office desk, a home kitchen, and one small personal space (a folded yoga mat,
an unopened book, a gym bag by the door).

LOOK: Neutral and honest. The first two lists shot in busy, full frames. The third list
shot in quieter, emptier frames with more space — visually neglected. Then unify.
VOICE: Hindi-Hinglish, reflective, gentle, speed 0.92.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Soft piano, one warm lift when the third list is finally remembered.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.0 | Three sheets of paper laid on a table, third one visibly smaller | "Har aadmi ke paas teen list hoti hai." | `3 lists` |
| 2 | 3.0–7.0 | Office: a full inbox, tasks, a manager talking | "Ek — boss ki list. Wo sabse pehle hoti hai." | `1. Boss ki list` |
| 3 | 7.0–11.0 | Home: fees, gas, a child's schoolbag, groceries | "Do — ghar ki list. Wo sabse zaroori hoti hai." | `2. Ghar ki list` |
| 4 | 11.0–15.5 | Quiet frames: a folded yoga mat, an unopened book, an unmade doctor's call | "Teen — apni list. Doctor, gym, wo course, wo call." | `3. Apni list` |
| 5 | 15.5–18.5 | The third sheet slides under the other two, out of sight | "Teesri list sabse chhoti hoti hai. Aur sabse zyada ignore hoti hai." | `Sabse chhoti. Sabse ignored.` |
| 6 | 18.5–22.0 | **Screen recording:** all three categories, equal weight on one screen | "Ab teeno ek jagah hain." | `Teeno ek jagah` |
| 7 | 22.0–23.0 | Notification: "Doctor appointment". They actually go | "Aur teesri wali bhi yaad aati hai." | `Teesri wali bhi.` |
| 8 | 23.0–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Har aadmi ke paas teen list hoti hai.

Ek — boss ki list. Wo sabse pehle hoti hai.

Do — ghar ki list. Wo sabse zaroori hoti hai.

Teen — apni list. Doctor, gym, wo course, wo call.

Teesri list sabse chhoti hoti hai. Aur sabse zyada ignore hoti hai.

Ab teeno ek jagah hain.

Aur teesri wali bhi yaad aati hai.

Apka Saathi.
```

### SCRIPT — EN
```
Every person carries three lists.

One — the boss's list. That one comes first.

Two — the home's list. That one matters most.

Three — your own list. The doctor, the gym, that course, that call.

The third list is the shortest. And the most ignored.

Now all three live in one place.

And the third one gets remembered too.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, honest neutral realism, natural light, 35mm.
FRAMING RULE: lists one and two are shot in busy, crowded, full frames. List three is shot
in quiet, sparse frames with lots of empty space — visually neglected.
Shot 1: overhead of three sheets of paper on a table, the third noticeably smaller and
partly slid under the others, 3s.
Shot 2: a crowded office desk, a manager mid-sentence, an inbox on screen, busy frame, 4s.
Shot 3: a home kitchen counter crowded with a fee slip, a gas booking note, groceries and
a child's schoolbag, 4s.
Shot 4: a folded yoga mat in an empty corner of a room, wide sparse frame, 3s.
Shot 5: an unopened book on a bedside table, dust on the cover, sparse frame, 3s.
Shot 6: a 34-year-old Indian person sitting alone on the edge of a bed, phone in hand,
lots of empty space around them, 5s.
Shot 7: the same person walking into a clinic doorway in daylight, calm, 5s.
No text, no graphics.
```

---
---

# VIDEO 64 — "Sab Use Kar Rahe Hain"
**Angle:** **Occupation roll-call** — ye sirf office walon ke liye nahi | **Length:** 25s | **Voice:** V-NARRATOR (energetic warm)
**Target:** India Tier-2/3 expansion. **Naya casting territory.**

> **Repetition guard:** V30 = chaar portrait, premium, still. V20 = teen log, ek din.
> **V64 alag hai kyunki isme bilkul naye log hain** — nurse, delivery partner, teacher.
> Ab tak 63 videos me sirf professional / student / parents / shopkeeper dikhe hain.
> Ye video **audience widen** karta hai, aur Tier-2/3 me relatability laata hai.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 warm energetic Indian roll-call reel, 1080x1920.

STORY: This app isn't just for office people. A nurse — medicine reminders through a night
shift. A delivery partner — the vehicle insurance. A teacher — parent meetings and result
dates. A shopkeeper — GST and supplier payments. A mother — every date in the house. A
student — the exam form. Everyone has to remember something.

SETTINGS: A hospital corridor, a city street on a delivery bike, a school staff room, a
shop counter, a home kitchen, a study desk. Six locations, one beat each.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[NEHA-01]
  Indian woman, exactly 26 years old, oval face, medium-brown skin, straight black
  hair cut to shoulder length with a blunt fringe, thin arched eyebrows, wide
  dark-brown eyes, small straight nose with a tiny silver nose stud on the left
  nostril, full lips, a small mole above the left eyebrow, no glasses, slim build,
  height 5 feet 3 inches.
  Wardrobe: Plain white or pale-pink formal shirt with dark trousers, plain black
  tote bag, no jewellery except the nose stud.

[AMAN-01]
  Indian male, exactly 21 years old, thin narrow face, medium-brown skin, thick messy
  black hair falling over the forehead, sparse patchy stubble on the chin only, thin
  eyebrows, bright dark eyes, slightly prominent front teeth visible when smiling, a
  small mole on the right jawline, no glasses, thin lanky build, height 5 feet 10
  inches.
  Wardrobe: Oversized grey hoodie or plain black t-shirt, wired earphones around the
  neck, canvas backpack.

[KAVYA-01]
  Indian woman, exactly 32 years old, long face with a strong jaw, wheatish skin,
  dark brown hair tied back into a neat low ponytail with a centre parting, defined
  straight eyebrows, sharp dark eyes, high cheekbones, a small scar on the left side
  of the upper lip, thin black-framed rectangular glasses always worn, medium build,
  height 5 feet 5 inches.
  Wardrobe: Charcoal or navy blazer over a plain shirt, minimal steel wristwatch on
  the left wrist.

ROLES: Deliberately non-office occupations: NEHA-01 as a nurse, AMAN-01 as a delivery
rider, KAVYA-01 as a schoolteacher.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

LOOK: Warm, real, energetic. Each person gets one clean portrait-style beat with their
work environment visible behind them. Handheld, natural light, honest. Cut on the beat —
brisk but not frantic.
VOICE: Hindi-Hinglish, male narrator, warm and energetic, speed 1.0.
CAPTIONS: Poppins Bold white, highlight #C25A37. Occupation labels.
MUSIC: Uplifting Indian percussion with a bright melodic motif. Communal, celebratory.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.5 | Fast wide of many different Indians going about their days | "Ye app sirf office wale logon ke liye nahi hai." | — |
| 2 | 3.5–7.0 | Hospital corridor at night, nurse checks her phone between rounds | "Ek nurse — night shift ke dawai reminders." | `Nurse` |
| 3 | 7.0–10.0 | Delivery rider parked at a corner, helmet on the arm, checking phone | "Ek delivery partner — gaadi ka insurance." | `Delivery partner` |
| 4 | 10.0–13.0 | School staff room, teacher with a register and a phone | "Ek teacher — parent meeting aur result date." | `Teacher` |
| 5 | 13.0–16.0 | Shop counter, owner between customers | "Ek dukaandaar — GST aur supplier payment." | `Dukaandaar` |
| 6 | 16.0–19.0 | Kitchen, mother mid-work, phone propped on a shelf | "Ek maa — poore ghar ki dates." | `Maa` |
| 7 | 19.0–21.5 | Study desk, student, books open | "Ek student — exam form." | `Student` |
| 8 | 21.5–22.5 | Quick grid of all six faces together | "Yaad rakhna sabko padta hai." | `Sabko padta hai.` |
| 9 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Ye app sirf office wale logon ke liye nahi hai.

Ek nurse — night shift ke dawai reminders.

Ek delivery partner — gaadi ka insurance.

Ek teacher — parent meeting aur result date.

Ek dukaandaar — GST aur supplier payment.

Ek maa — poore ghar ki dates.

Ek student — exam form.

Yaad rakhna sabko padta hai.

Apka Saathi.
```

### SCRIPT — EN
```
This app isn't just for office people.

A nurse — medicine reminders through a night shift.

A delivery partner — the vehicle insurance.

A teacher — parent meetings and result dates.

A shopkeeper — GST and supplier payments.

A mother — every date in the house.

A student — the exam form.

Everyone has something to remember.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, warm energetic realistic India, handheld, natural light, 35mm.
Cast real-looking working people, not models. Each subject gets one clean beat with their
work environment clearly visible behind them.
Shot 1: an Indian nurse in scrubs in a quiet hospital corridor at night, checking her
phone between rounds, cool fluorescent light, 4s.
Shot 2: an Indian delivery rider parked at a street corner, helmet resting on his arm,
looking at his phone, warm evening city light, 3s.
Shot 3: an Indian schoolteacher in a staff room with an attendance register open beside
her, phone in hand, dusty afternoon sunlight, 3s.
Shot 4: an Indian shopkeeper, 40, at a busy counter, glancing at his phone between
customers, 3s.
Shot 5: an Indian mother in a kitchen, phone propped against a shelf while she works, 3s.
Shot 6: an Indian student at a study desk surrounded by open books, phone beside the
notes, 3s.
Shot 7: a fast series of all six faces looking straight into the lens, warm and confident,
one second each, 6s. No text, no graphics.
```

---
---

# VIDEO 65 — "Teen Sawaal"
**Angle:** **Objection-crushing CTA** — install se pehle ke 3 doubts | **Length:** 22s | **Voice:** V-NARRATOR (direct, friendly)
**Target:** Retargeting — jo profile dekh chuke par install nahi kiya

> ### ⚠️ Ye video sabse aakhir me banao
> Isme **asli pricing** hai (`plan.ts` se): Free = 5 reminders + 3 documents,
> Plus = ₹99/mahina. Ye values `app_config` se aati hain aur **admin badal sakta hai.**
> Agar pricing badli to ye video dobara record karni padegi. Isliye ise **last** banao,
> jab pricing final ho chuki ho.
>
> Aur **"ad nahi aayenge"** wali line tabhi rakho jab app me sach me ads nahi hain aur
> aage bhi plan nahi hai.

> **Repetition guard:** V29 = install ka **process** (kitna aasaan). **V65 = install se
> pehle ke doubts** (kitna paisa, ad, jhanjhat). Do alag cheezein hain: V29 kehta hai
> "aasaan hai", V65 kehta hai "sasta hai, saaf hai, jaldi hai." V65 retargeting ke liye
> hai — jo pehle se interested hai par jhijhak raha hai.

### MASTER PROMPT (HeyGen)
```
Create a 22-second vertical 9:16 direct, friendly Indian CTA reel, 1080x1920.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

ROLES: RAHUL-01 speaking directly to camera.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

FORMAT: A rapid FAQ. Three real questions people ask before downloading an app, answered
plainly and immediately. No story, no emotion, no drama — just clean straight answers.

SCRIPT CONTENT: One — what does it cost? Starting is free: five reminders, three
documents. Need more, Plus is ninety-nine rupees a month. Two — will there be ads? No, not
one. Three — how painful is signing up? Your number and an OTP, that's it. Any questions
left?

TONE — CRITICAL: Confident and plain, never defensive and never boastful. The credibility
comes from answering directly, including the limits of the free plan. Saying "five
reminders, three documents" out loud — rather than just "free" — is what makes the viewer
believe the rest.

SETTING: Clean, minimal, well-lit. Neutral background.

LOOK: Bright, clean, simple. Locked camera. Each answer gets its own clean full-width text
card so it can be read in a silent scroll. This video must work with the sound OFF.
VOICE: Hindi-Hinglish, male, direct and friendly, speed 1.0.
CAPTIONS: Poppins Bold, large. Numbers get the biggest treatment on screen.
MUSIC: Clean, light, forward-moving.
END CARD: standard Apka Saathi card, hold the Download pill the full 3s.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.0 | Direct to camera, friendly | "Download karne se pehle teen sawaal aate hain." | `3 sawaal` |
| 2 | 3.0–5.0 | Clean card | "Ek — kitne ka hai?" | `1. Kitne ka hai?` |
| 3 | 5.0–9.5 | **Screen:** free plan limits shown honestly | "Shuru karna free hai. Paanch reminder, teen document." | `FREE — 5 reminders, 3 documents` |
| 4 | 9.5–12.5 | **Screen:** Plus plan screen | "Zyada chahiye to Plus — ninety-nine rupaye mahina." | `PLUS — ₹99/mahina` |
| 5 | 12.5–14.5 | Clean card | "Do — ad aayenge?" | `2. Ad aayenge?` |
| 6 | 14.5–16.0 | App scrolling, visibly ad-free | "Nahi. Ek bhi nahi." | `Nahi. Ek bhi nahi.` |
| 7 | 16.0–18.0 | Clean card | "Teen — sign up ka jhanjhat?" | `3. Sign up?` |
| 8 | 18.0–19.5 | **Screen:** number → OTP → in | "Number aur OTP. Bas." | `Number + OTP` |
| 9 | 19.5–20.0 | Direct to camera, small smile | "Ab koi sawaal bacha?" | `Ab koi sawaal? 👇` |
| 10 | 20.0–22.0 | **END CARD** (Download pill full 3s) | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Download karne se pehle teen sawaal aate hain.

Ek — kitne ka hai?

Shuru karna free hai. Paanch reminder, teen document.

Zyada chahiye to Plus — ninety-nine rupaye mahina.

Do — ad aayenge?

Nahi. Ek bhi nahi.

Teen — sign up ka jhanjhat?

Number aur OTP. Bas.

Ab koi sawaal bacha?

Apka Saathi.
```

### SCRIPT — EN
```
Three questions come up before you download.

One — what does it cost?

Starting is free. Five reminders, three documents.

Need more? Plus is ninety-nine rupees a month.

Two — will there be ads?

No. Not one.

Three — how painful is signing up?

Your number and an OTP. That's it.

Any questions left?

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 22s, bright clean minimal setting, locked camera, even soft lighting,
neutral uncluttered background, 50mm.
Shot 1: a 30-year-old Indian man in a plain shirt seated against a clean background,
looking directly into the lens, friendly and straightforward, 5s.
Shot 2: same framing, he gestures once as he answers, relaxed, 5s.
Shot 3: close-up of his hands holding a phone at chest height, screen towards camera, 5s.
Shot 4: same framing as shot 1, he finishes with a small confident smile and a slight
nod, 5s.
Deliberately simple — no camera movement, no set dressing, no atmosphere.
No text, no graphics, no UI mockups.
```

---
---

# VIDEO 66 — "Ek Mahine Baad"
**Angle:** **Results retrospective** — numbers, feeling nahi | **Length:** 25s | **Voice:** V-NARRATOR (confident)
**Target:** India professionals. Proof-led, emotion-led nahi.

> ⚠️ **Ye chautha AI video NAHI hai.** AI trilogy (19/42/44) + V68 (form-filling) locked hai.
> **V66 ka claim numbers hai** — ek mahine ka hisaab. Isme AI ka zikr tak mat karo.

> **Repetition guard:** har video ne "feeling" bechi — halka lagta hai, tension nahi hai.
> **V66 pehla video hai jo ginti dikhata hai.** 55 set, 52 done, 3 aage badhaye, 0 bhoole.
> Skeptical viewers ke liye ye sabse convincing format hai.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 confident Indian results-retrospective reel, 1080x1920.

STORY: One month with Apka Saathi, then he looked back. Fifty-five reminders set.
Fifty-two done. Three he deliberately moved forward himself. Not one forgotten. The
workload was always this much — now he simply knows what's when. The work didn't change.
The visibility did.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

ROLES: RAHUL-01, reviewing rather than celebrating.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

FORMAT: This film is built on NUMBERS, not feelings. Every claim is a figure on screen.
It exists for the sceptical viewer who is tired of emotional app ads.

IMPORTANT — HONESTY: Note that 3 out of 55 were deliberately pushed forward. Showing an
imperfect number (52 out of 55, not 55 out of 55) is what makes the whole video credible.
Do not round it up to a perfect score.

SETTING: A clean desk, evening, a month-end review moment.

LOOK: Clean, data-forward, premium. Numbers animate in with weight and precision. Deep
teal #125156 and terracotta #C25A37 on cream. Calm camera, no drama.
VOICE: Hindi-Hinglish, male, confident and factual, speed 0.98.
CAPTIONS: Poppins Bold. The numbers are the hero — make them large and clean.
MUSIC: Clean minimal electronic with precise ticks landing on each figure.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Desk at evening, he opens the app, month-end | "Ek mahina Apka Saathi use kiya. Phir peeche mud ke dekha." | `1 mahina` |
| 2 | 4.5–8.0 | **Big number animates in** | "Pachpan reminder set kiye." | `55 set` |
| 3 | 8.0–11.0 | **Second number** | "Bavan poore hue." | `52 done` |
| 4 | 11.0–15.0 | **Third number, with a nuance card** | "Teen main khud aage badha gaya — soch samajh ke." | `3 moved — by choice` |
| 5 | 15.0–17.5 | **Fourth number, held** | "Ek bhi bhoola nahi." | `0 forgotten` |
| 6 | 17.5–21.0 | He closes the app, leans back, unremarkable evening | "Pehle bhi itna hi kaam tha. Bas ab pata hota hai kya kab." | — |
| 7 | 21.0–22.5 | Close, calm | "Farak kaam me nahi aaya. Farak nazar me aaya." | `Farak nazar me aaya.` |
| 8 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Ek mahina Apka Saathi use kiya. Phir peeche mud ke dekha.

Pachpan reminder set kiye.

Bavan poore hue.

Teen main khud aage badha gaya — soch samajh ke.

Ek bhi bhoola nahi.

Pehle bhi itna hi kaam tha. Bas ab pata hota hai kya kab.

Farak kaam me nahi aaya. Farak nazar me aaya.

Apka Saathi.
```

### SCRIPT — EN
```
One month with Apka Saathi. Then I looked back.

Fifty-five reminders set.

Fifty-two done.

Three I moved forward myself — deliberately.

Not one forgotten.

The workload was always this much. Now I just know what's when.

The work didn't change. The visibility did.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, clean premium desk environment at evening, calm camera, precise
composition, cream and deep teal palette, 50mm.
Shot 1: a clean uncluttered desk at evening with a single warm lamp, a 34-year-old Indian
man sitting down and picking up his phone, 5s.
Shot 2: close-up of his face lit by the screen, analytical rather than emotional, 5s.
Shot 3: over-the-shoulder of the phone held steady, 5s.
Shot 4: he sets the phone down, leans back in the chair, entirely unremarkable evening,
5s.
Shot 5: wide of the calm desk with the lamp on and the man relaxed in the chair, 5s.
No drama, no celebration, no text, no graphics.
```

---
---

# VIDEO 67 — "Sach Bataun?"
**Angle:** **Raw UGC testimonial** — poore set ka ekmatra unproduced video | **Length:** 25s | **Voice:** **on-camera, narrator nahi**
**Target:** India broad. **Format hi differentiator hai.**

> **Repetition guard:** V41 = split-screen before/after (highly produced).
> **V67 wahi baat bilkul ulte tarike se kehta hai** — ek banda, phone camera, ek take,
> koi music nahi, koi grade nahi. Instagram pe ye format cinematic ads se **behtar
> perform karta hai**, kyunki ad nahi lagta.
>
> ⚠️ **Ye video HeyGen avatar se mat banao.** Avatar polished lagta hai — aur polish hi
> is video ka dushman hai. Ise **asli insaan, asli phone se** shoot karo. Agar HeyGen
> use karna hi hai to sabse casual photo-avatar lo aur music bilkul mat lagao.

### MASTER PROMPT (HeyGen / production brief)
```
Create a 25-second vertical 9:16 raw UGC-style testimonial, 1080x1920.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[PRIYA-01]
  Indian woman, exactly 29 years old, heart-shaped face, fair-wheatish skin,
  shoulder-length straight dark-brown hair worn loose with a side parting, arched
  thin eyebrows, large dark eyes with long lashes, small pointed chin, a faint dimple
  on the right cheek when she smiles, small silver stud earrings only, no bindi, no
  other jewellery, slim build, height 5 feet 4 inches.
  Wardrobe: Plain cotton kurti in mustard or rust, churidar, thin silver bangle on
  the left wrist.

ROLES: PRIYA-01, completely ordinary — she should read as a real user, not talent.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
PRIYA-01 in the final shot must be recognisably the SAME PERSON as PRIYA-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

FORMAT — CRITICAL: This must NOT look like an advertisement. Shot on a phone front camera,
handheld, one continuous take, natural room light, no music, no colour grade, no
transitions, no graphics. Slightly imperfect framing is GOOD. If it looks produced, it
has failed.

SCRIPT (spoken to camera, first person): "Honestly? I used to forget a lot. Bills, dates,
someone's birthday — all of it. And then I'd feel bad about it. Embarrassed. A friend told
me about this app. I thought, great, another app. It's been a month. I don't forget any
more. That's the only difference. But it isn't a small difference. Try it. Starting is
free."

SETTING: A real home — an unmade bed corner, a kitchen, a balcony. Visible everyday
clutter is fine and desirable.

LOOK: No look. Natural light only. Phone camera. One take.
VOICE: On-camera speech, not narration. Conversational Hindi-Hinglish, normal speaking
pace, natural pauses.
CAPTIONS: Auto-style captions, simple white, exactly as spoken including the hesitations.
MUSIC: NONE. Silence except the room tone. This is deliberate.
END CARD: minimal — just the logo and tagline for 2s. No animation, no CTA pill.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | Spoken line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–5.0 | Front camera, handheld, home, natural light. **One take starts** | "Sach bataun? Pehle main bahut bhoolta tha." | *(auto captions)* |
| 2 | 5.0–9.0 | Same take, slight reframe | "Bill, dates, kisi ka birthday — sab." | *(auto captions)* |
| 3 | 9.0–12.5 | Same take | "Aur phir bura lagta tha. Sharminda hota tha." | *(auto captions)* |
| 4 | 12.5–16.0 | Same take, small laugh | "Ek dost ne ye app batayi. Maine socha, ek aur app." | *(auto captions)* |
| 5 | 16.0–20.0 | Same take | "Ek mahina ho gaya. Ab bhoolta nahi. Bas itna hi farak hai." | *(auto captions)* |
| 6 | 20.0–23.0 | Same take, direct | "Par ye chhota farak nahi hai. Try kar lo. Free hai shuru karna." | *(auto captions)* |
| 7 | 23.0–25.0 | **Minimal end card**, 2s, no animation | — | Logo + tagline only |

### SCRIPT — HI (bola jaaye, padha na jaaye)
```
Sach bataun? Pehle main bahut bhoolta tha.

Bill, dates, kisi ka birthday — sab.

Aur phir bura lagta tha. Sharminda hota tha.

Ek dost ne ye app batayi. Maine socha, ek aur app.

Ek mahina ho gaya.

Ab bhoolta nahi. Bas itna hi farak hai.

Par ye chhota farak nahi hai.

Try kar lo. Free hai shuru karna.
```
> **Delivery note:** ise **rehearse mat karo.** Ek-do baar padh lo, phir camera on karke
> apne shabdon me bolo. Chhoti si hesitation, ek "umm", ek repeat — sab rehne do.

### SCRIPT — EN
```
Honestly? I used to forget a lot.

Bills, dates, someone's birthday — all of it.

And then I'd feel bad about it. Embarrassed.

A friend told me about this app. I thought, great, another app.

It's been a month.

I don't forget any more. That's the only difference.

But it isn't a small difference.

Try it. Starting is free.
```

### CINEMATIC PROMPT
```
NOT APPLICABLE — do not generate this one.

This video must be shot on a real phone, front camera, by a real person, in one take,
with no music and no grade. Any AI-generated or cinematically lit version defeats the
entire purpose of the format.
```

---
---

# VIDEO 68 — "Form Bharna Band Karo"
**Angle:** **AI #4 — form-filling khatam** | **Length:** 25s | **Voice:** V-NARRATOR (modern premium)
**Target:** India + global, tech-aware 25–40.

> **AI videos ab chaar hain. Chaaron ka claim alag hona zaroori hai:**
> | | Claim |
> |---|---|
> | **V19** | Speed — 8 second me ho gaya |
> | **V42** | Natural bhasha — theek se bolna zaroori nahi |
> | **V44** | Hands-free — jab type kar hi nahi sakte |
> | **V68** | **Form khatam — 7 field bharne ki zaroorat nahi** |
>
> V68 ka dushman **doosri apps ka UX** hai, aapki apni memory nahi. Isliye iska tone bhi
> alag hai: comparison, emotion nahi.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 premium technology comparison reel, 1080x1920.

STORY: In other apps, to make one reminder you type a title, pick a date, set a time,
choose a category, set a repeat, pick a notification and hit save. Seven steps for one
small thing you want to remember. Here? Write one line, or just say it. The app works out
the rest. Stop filling forms. Just tell it.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

ROLES: Only RAHUL-01's hands and screen-lit face appear. The interface is the
subject.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

VISUAL IDEA — THE WHOLE FILM: A long, tedious form with seven fields, shown filling in
one field at a time with visible effort. Then the entire form COLLAPSES and DISSOLVES into
a single line of text. That collapse is the film's one big moment — spend the budget there.

SETTING: Clean, dark, premium tech environment. Deep teal #125156 background with
terracotta #C25A37 accents.

LOOK: Futuristic-premium but restrained — no sci-fi holograms, no neon clichés. Dark
background, floating UI, precise motion, shallow depth of field. This should look like a
flagship phone launch film, not a stock AI video.
VOICE: Hindi-Hinglish, male narrator, modern and assured, speed 0.98. Slightly weary on
the seven-step list, then crisp on the resolution.
CAPTIONS: Poppins Bold white, highlight #C25A37. Step counter visible during the form.
MUSIC: Cold precise electronic ticks during the form, resolving into one clean warm tone
at the collapse.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.0 | Dark frame, an empty form materialises with seven visible fields | "Baaki apps me reminder banane ke liye —" | — |
| 2 | 3.0–7.0 | Fields 1–3 fill one by one, each with a tick and a step counter | "Title bharo. Date chuno. Time set karo." | `Step 1` `Step 2` `Step 3` |
| 3 | 7.0–12.0 | Fields 4–7 fill, the pace deliberately dragging | "Category select karo. Repeat set karo. Notification chuno. Save dabao." | `Step 4` `5` `6` `7` |
| 4 | 12.0–14.5 | The full seven-field form sits there, heavy and cluttered | "Saat step. Ek chhoti si cheez yaad rakhne ke liye." | `7 steps 😐` |
| 5 | 14.5–17.5 | **HERO MOMENT:** the whole form collapses and dissolves into one line | "Yahan? Ek line likho ya bol do." | `1 line` |
| 6 | 17.5–21.5 | **Screen recording:** that one line becoming a complete reminder | "Baaki app khud samajh leti hai." | `📅 ⏰ 🗂 — auto` |
| 7 | 21.5–22.5 | Clean empty frame, one line of text, nothing else | "Form bharna band karo. Bas batao." | `Bas batao.` |
| 8 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Baaki apps me reminder banane ke liye —

Title bharo. Date chuno. Time set karo.

Category select karo. Repeat set karo. Notification chuno. Save dabao.

Saat step. Ek chhoti si cheez yaad rakhne ke liye.

Yahan? Ek line likho ya bol do.

Baaki app khud samajh leti hai.

Form bharna band karo. Bas batao.

Apka Saathi.
```

### SCRIPT — EN
```
In other apps, to create one reminder —

Type a title. Pick a date. Set a time.

Choose a category. Set a repeat. Pick a notification. Hit save.

Seven steps. For one small thing you want to remember.

Here? Write one line, or just say it.

The app works out the rest.

Stop filling forms. Just tell it.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, premium restrained technology film — flagship phone launch aesthetic,
NOT stock sci-fi. Dark deep-teal environment, warm terracotta accent light, floating
interface elements, precise motion, very shallow depth of field, 85mm.
Shot 1: a pair of hands held in a pool of light against a dark background, a phone
between them, 4s.
Shot 2: extreme close-up of a thumb tapping repeatedly and wearily, the same motion over
and over, 5s.
Shot 3: a face lit only by a screen in a dark room, patient but tired, 4s.
Shot 4: the same hands, now making one single relaxed gesture and stopping, 5s.
Shot 5: the phone set down on a dark surface, the screen glow fading gently, 6s.
No holograms, no neon, no futuristic clichés. No text, no graphics, no UI mockups.
```

---
---

# VIDEO 69 — "Sabke Dimaag Me Bahut Kuch Hai"
**Angle:** **Bhoolna kamzori nahi hai** — poore ghar ki pyaari bhulakkadi | **Length:** 28s | **Voice:** V-NARRATOR (warm, amused)
**Target:** India + NRI, SAB. Warm humour.

> **Repetition guard:** V40 = ek ghar, chaar alag zindagiyan (premium ad).
> V46 = WhatsApp group (satire). **V69 alag hai kyunki ye sabko maaf karta hai.**
> Har video ne ab tak bhoolne ko problem dikhaya. **V69 kehta hai bhoolna normal hai** —
> dimaag bhara hua hai, insaan kharab nahi hai. Ye brand ko **dost** banata hai, judge nahi.

### MASTER PROMPT (HeyGen)
```
Create a 28-second vertical 9:16 warm, gently funny Indian family reel, 1080x1920.

STORY: Grandma forgets where she put her glasses. Dad checks twice whether he turned off
the gas. Mom counts the cooker whistles and then loses count. The son never remembers his
homework. And the narrator? He forgets everything. They all live in one house, and every
single one of them forgets something. Forgetting isn't a weakness — your head is just
full. Give some of the load to the app.

TONE — CRITICAL: This film FORGIVES everyone. Every other video in the series treats
forgetting as a problem; this one treats it as normal and human. The humour is affectionate
and observational, never mocking — especially not of the grandmother. This is the film
that makes the brand feel like a friend rather than a judge.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[DADI-01]
  Indian woman, exactly 74 years old, thin lined face with hollow cheeks, pale
  wheatish skin, thin fully white hair pulled into a small tight bun, deeply creased
  forehead and eye corners, small cloudy-brown eyes, thin lips, thick round
  gold-rimmed reading glasses, a small dark mole on the left temple, frail small
  build, slight stoop.
  Wardrobe: Plain white or off-white cotton saree, thin white shawl, small gold
  studs.

[RAVI-01]
  Indian male, exactly 45 years old, oval face with a heavy jaw, dark-brown weathered
  skin, thick black hair with grey only at the sideburns, side-parted, a thick full
  black moustache with no beard, tired warm eyes with deep lower-lid creases, a small
  mole on the left side of the neck, no glasses, sturdy build, height 5 feet 8
  inches.
  Wardrobe: Half-sleeve checked shirt in blue or brown, dark trousers, a pen clipped
  in the shirt pocket.

[MAA-01]
  Indian woman, exactly 55 years old, round face with soft full cheeks, wheatish
  skin, black hair with visible grey at the temples pulled back into a low bun with a
  centre parting, small maroon round bindi, thin gold hoop earrings, soft
  double-lidded brown eyes, deep gentle smile lines around the mouth, a small mole on
  the right side of the chin, no glasses, small build, height 5 feet 1 inch.
  Wardrobe: Simple cotton saree in soft teal or mustard, cotton blouse, thin gold
  mangalsutra. When reading: thin gold-rimmed reading glasses.

[CHOTU-01]
  Indian boy, exactly 12 years old, round chubby face, medium-brown skin, short black
  hair cut neatly with a side parting, thick eyebrows, big dark eyes, a visible gap
  between the two upper front teeth, a small mole on the right cheek, no glasses,
  small slight build.
  Wardrobe: School uniform (white shirt, navy shorts), or a bright red t-shirt at
  home.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

ROLES: One multi-generational household: DADI-01 the grandmother, RAVI-01 the father,
MAA-01 the mother, CHOTU-01 the son, and RAHUL-01 as the narrator.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

SETTING: One house across several rooms — a kitchen, a living room, a bedroom, a doorway.

LOOK: Warm, lived-in, natural. Handheld, close, affectionate framing. Small everyday
details: the cooker, the gas knob, a pair of glasses on a shelf, a schoolbag by the door.
VOICE: Hindi-Hinglish, warm male narrator, amused and affectionate, speed 0.98.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Light warm acoustic with a playful lilt.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Grandmother patting her sari, looking around — glasses are on her head | "Dadi bhool jaati hain chashma kahan rakha." | `Dadi` |
| 2 | 4.5–9.0 | Father at the doorway, comes back, checks the gas knob a second time | "Papa do baar check karte hain gas band ki ya nahi." | `Papa` |
| 3 | 9.0–13.5 | Mother at the cooker, lips moving counting, then a small pause | "Maa cooker ki seeti gin ti hain, phir bhool jaati hain." | `Maa` |
| 4 | 13.5–17.0 | Son opening his schoolbag, blank face | "Bete ko homework yaad nahi rehta." | `Beta` |
| 5 | 17.0–19.5 | Narrator to camera, hands up, guilty grin | "Aur main? Main sab kuch bhool jata hoon." | `Aur main…` |
| 6 | 19.5–23.0 | Wide: everyone in the living room together, easy and warm | "Hum sab ek hi ghar me hain, aur sab kuch na kuch bhoolte hain." | — |
| 7 | 23.0–25.5 | Close, warm, sincere | "Bhoolna kamzori nahi hai. Bas dimaag bhara hua hai." | `Bhoolna kamzori nahi hai.` |
| 8 | 25.5–26.0 | **Screen recording:** shared family list, everyone's items | "Thoda bojh app ko de do." | `Thoda bojh app ko` |
| 9 | 26.0–28.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Dadi bhool jaati hain chashma kahan rakha.

Papa do baar check karte hain gas band ki ya nahi.

Maa cooker ki seeti gin ti hain, phir bhool jaati hain.

Bete ko homework yaad nahi rehta.

Aur main? Main sab kuch bhool jata hoon.

Hum sab ek hi ghar me hain, aur sab kuch na kuch bhoolte hain.

Bhoolna kamzori nahi hai. Bas dimaag bhara hua hai.

Thoda bojh app ko de do.

Apka Saathi.
```
*(76 words ≈ 26s)*

### SCRIPT — EN
```
Grandma forgets where she put her glasses.

Dad checks twice whether he turned the gas off.

Mom counts the cooker whistles, then loses count.

My son never remembers his homework.

And me? I forget everything.

We all live in one house, and every one of us forgets something.

Forgetting isn't a weakness. Your head is just full.

Give some of the load to the app.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 28s, warm lived-in Indian multi-generational home, natural daylight,
handheld, close affectionate framing, 35mm.
Shot 1: an Indian grandmother, 75, patting her sari and looking around a room for
something, her spectacles pushed up on her head, warm and endearing, 5s.
Shot 2: an Indian father, 52, stopping at the front door, coming back into the kitchen and
checking a gas knob a second time, 4s.
Shot 3: an Indian mother, 48, standing at a pressure cooker, lips moving as she counts,
then a small pause of doubt, 4s.
Shot 4: a 12-year-old boy opening a schoolbag at a table with a completely blank
expression, 4s.
Shot 5: a 30-year-old man looking straight into the lens with his hands raised in a
guilty grin, 3s.
Shot 6: a wide of the whole family together in a warm living room, relaxed, talking over
each other, genuine domestic energy, 6s. No text, no graphics.
```

---
---

# VIDEO 70 — "Hum Cheezein Kyun Sambhalte Hain"
**Angle:** **Brand film #7** — documents kagaz nahi, zindagi ka saboot | **Length:** 32s | **Voice:** V-NARRATOR (deepest)
**Target:** SAB. **Poore 70 videos ka sabse gehra brand statement.**

> **Repetition guard — saat brand films, saat alag spine:**
> **V10** problem manifesto · **V20** day-in-life · **V30** naam ka matlab ·
> **V36** tareekhon ki poetry · **V50** launch elaan · **V60** aapke liye kaun ·
> **V70** = **hum cheezein kyun sambhalte hain**
>
> V70 ka insight sabse ooncha hai: hum kagaz isliye nahi rakhte ki zaroorat hai —
> isliye rakhte hain kyunki wo **kuch sabit karte hain.** Ki hum the. Ki humne kiya.
> Ye document-storage feature ko ek **philosophy** bana deta hai.
> **V70 aur V60 dono deep hain — kabhi ek mahine me dono mat post karna.**

### MASTER PROMPT (HeyGen)
```
Create a 32-second vertical 9:16 profound Indian brand film, 1080x1920.

CONCEPT: Every Indian home has one file that never gets thrown away. A ration card from
1994. Grandfather's land papers. A child's first report card. A wedding invitation that
still carries haldi stains. We don't keep these things because we need them — we keep them
because they prove something. That we were here. That we did it. That we held it together.
Documents aren't paperwork. They are the proof of a life.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

[PAPA-01]
  Indian male, exactly 62 years old, square face with prominent cheekbones, wheatish
  skin, full silver-grey hair combed straight back from a high forehead, thick black
  rectangular-framed glasses, bushy grey eyebrows, deep-set warm brown eyes with
  heavy crow's feet, prominent nasolabial folds, clean-shaven cheeks with a neat
  trimmed grey moustache, a small vertical scar above the right eyebrow, slight
  forward stoop, medium build.
  Wardrobe: Cream cotton kurta, brown leather sandals. In winter: brown shawl over
  the shoulder.

[MAA-01]
  Indian woman, exactly 55 years old, round face with soft full cheeks, wheatish
  skin, black hair with visible grey at the temples pulled back into a low bun with a
  centre parting, small maroon round bindi, thin gold hoop earrings, soft
  double-lidded brown eyes, deep gentle smile lines around the mouth, a small mole on
  the right side of the chin, no glasses, small build, height 5 feet 1 inch.
  Wardrobe: Simple cotton saree in soft teal or mustard, cotton blouse, thin gold
  mangalsutra. When reading: thin gold-rimmed reading glasses.

ROLES: Faces appear only in the final beat: RAHUL-01 with PAPA-01 and MAA-01.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

VISUAL APPROACH: Macro-led, object-led. Almost no faces until the very end. Every shot is
a piece of paper photographed with the reverence usually reserved for portraits — visible
grain, folds, fading ink, a haldi stain, a rusted staple, a child's handwriting.

LOOK: The most beautiful film in the series. 85mm macro, extremely shallow depth of field,
warm directional window light with visible dust. Slow dissolves, no hard cuts. A single
consistent warm grade throughout. Objects should look like heirlooms, not stationery.

VOICE: Hindi-Hinglish, deepest warmest male narrator, unhurried and sincere, speed 0.86.
Long pauses between each object. This is the slowest-spoken film in the series.
CAPTIONS: Poppins Bold white, highlight #C25A37. Extremely minimal — 3 to 4 words maximum
at any moment, and none at all during the object sequence.
MUSIC: Solo piano opening, a single cello entering at "kuch sabit karti hain", warm
strings resolving at the tagline. No percussion at any point.
END CARD: standard Apka Saathi card, narrator speaks the tagline aloud, hold 4s.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–5.0 | Macro: an old cloth-bound file being untied, dust in light | "Har Indian ghar me ek file hoti hai jo kabhi nahi phenki jaati." | — |
| 2 | 5.0–9.0 | Macro: a 1994 ration card, faded ink, soft folds | "Unnees sau chaurani ka ration card." | `1994` |
| 3 | 9.0–13.0 | Macro: land papers, an old official stamp, a rusted staple | "Dada ji ke zameen ke kagaz." | — |
| 4 | 13.0–17.0 | Macro: a child's first report card, a teacher's handwriting | "Bete ki pehli report card." | — |
| 5 | 17.0–21.0 | Macro: a wedding invitation with visible haldi stains | "Shaadi ka card, jispe ab bhi haldi ke nishan hain." | — |
| 6 | 21.0–24.5 | Slow pull back — all of them together on one warm table | "Hum ye cheezein zaroorat ke liye nahi rakhte." | — |
| 7 | 24.5–28.0 | Hands resting on the papers | "Hum inhe isliye rakhte hain kyunki ye kuch sabit karti hain." | — |
| 8 | 28.0–30.5 | **First faces of the film** — three generations, brief, warm | "Ki hum the. Ki humne kiya. Ki humne sambhala." | `Ki hum the.` |
| 9 | 30.5–31.5 | A phone among the papers, screen glowing softly | "Documents kagaz nahi hote — ek zindagi ka saboot hote hain." | — |
| 10 | 31.5–32.0+ | **END CARD — hold 4s** | "Apka Saathi. Never Forget What Matters." | Locked end-card |

### SCRIPT — HI
```
Har Indian ghar me ek file hoti hai jo kabhi nahi phenki jaati.

Unnees sau chaurani ka ration card.

Dada ji ke zameen ke kagaz.

Bete ki pehli report card.

Shaadi ka card, jispe ab bhi haldi ke nishan hain.

Hum ye cheezein zaroorat ke liye nahi rakhte.

Hum inhe isliye rakhte hain kyunki ye kuch sabit karti hain.

Ki hum the. Ki humne kiya. Ki humne sambhala.

Documents kagaz nahi hote — ek zindagi ka saboot hote hain.

Apka Saathi.

Never Forget What Matters.
```
*(80 words ≈ 31s @ 0.86 speed)*

### SCRIPT — EN
```
Every Indian home has one file that never gets thrown away.

A ration card from 1994.

Grandfather's land papers.

A child's first report card.

A wedding invitation that still carries haldi stains.

We don't keep these things because we need them.

We keep them because they prove something.

That we were here. That we did it. That we held it together.

Documents aren't paperwork — they're the proof of a life.

Apka Saathi.

Never Forget What Matters.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 32s, macro-led object film, 85mm macro, extremely shallow depth of field,
warm directional window light with visible dust motes, slow dissolves instead of cuts, one
consistent warm grade throughout. Photograph every document with the reverence of a
portrait.
Shot 1: macro of an old cloth-bound file being untied, the string falling away, 5s.
Shot 2: macro of a faded 1990s Indian ration card, soft creases, ink bleeding at the
edges, 4s.
Shot 3: macro of old land documents with an official stamp and a rusted staple, paper
yellowed, 4s.
Shot 4: macro of a child's first school report card, a teacher's handwritten remark in
blue ink, 4s.
Shot 5: macro of a wedding invitation with visible turmeric stains on the paper, 4s.
Shot 6: a slow pull-back revealing all the documents arranged together on a warm wooden
table in window light, 4s.
Shot 7: a pair of older hands resting gently across the papers, 4s.
Shot 8: a brief warm shot of three generations of an Indian family standing together,
soft focus, held only a moment, 4s. No text, no graphics.
```

---
---

## Batch notes (61–70)

### 💰 Do videos me asli app data hai — verify karke banao
| Video | Kya claim hai | Kahan se aaya |
|---|---|---|
| **V61** | Referral: code lagao → 1 document + 1 reminder → **dono** ko free Plus | `referral-code-modal.tsx` |
| **V65** | Free = **5 reminders, 3 documents** · Plus = **₹99/mahina** | `plan.ts` |

Ye values `app_config` se aati hain — admin badal sakta hai. **V65 ko sabse aakhir me
banao**, jab pricing final ho. Aur "ad nahi aayenge" wali line tabhi rakho jab sach ho
aur aage bhi ads ka plan na ho.

### 🤖 AI videos ab CHAAR hain — chaaron ka claim alag rakhna
| | V19 | V42 | V44 | V68 |
|---|---|---|---|---|
| **Claim** | Speed | Natural bhasha | Hands-free | **Form khatam** |
| **Dushman** | Typing ka time | AI ki akkad | Busy haath | **Doosri apps ka UX** |
| **Feel** | "Kitna fast" | "Mujhe theek bolna nahi padta" | "Mere kaam ka hai" | "7 step? Seriously?" |

Paanchvan AI video mat banana — chaar pehle se limit pe hain.

### Naye positioning arguments
| Argument | Video | Kyun naya |
|---|---|---|
| **Referral / word-of-mouth** | 61 | Brand bolta hi nahi — colleague bolta hai. Growth loop |
| **30-din ka safar** | 62 | Retention, acquisition nahi |
| **Apni list aakhir me** | 63 | 62 videos me ye insight nahi aaya |
| **Numbers, feelings nahi** | 66 | Skeptical viewer ke liye |
| **Bhoolna kamzori nahi hai** | 69 | Brand ko **dost** banata hai, judge nahi |
| **Documents = zindagi ka saboot** | 70 | Feature ko philosophy bana deta hai |

### Naya casting (V64) — cast list me add karo
| Character | Look |
|---|---|
| Nurse (28) | Scrubs, hospital corridor, night shift |
| Delivery partner (26) | Helmet, jacket, street |
| Teacher (38) | Saree/salwar, staff room, register |

Ab tak 63 videos me sirf professional / student / parents / shopkeeper the. **V64 audience
widen karta hai** — Tier-2/3 me ye relatability badhata hai.

### ⚠️ V67 — HeyGen se mat banao
Ye poore 90 videos ka **ekmatra unproduced video** hai. Asli banda, phone ka front camera,
ek take, **koi music nahi, koi grade nahi.** Instagram pe ye format cinematic ads se behtar
perform karta hai kyunki ad nahi lagta. Avatar use karoge to polish aa jayegi — aur polish
hi is video ka dushman hai. Bolne wale se kaho ki **rehearse na kare**: ek hesitation, ek
"umm" — sab rehne do. Wahi credibility hai.

### Naye screen recordings chahiye
- [ ] **Referral code share + apply + dono ko Plus** milna (V61)
- [ ] **Empty state → din 1 → din 7 → din 30**, same framing me chaar screenshots (V62)
- [ ] Free plan limit screen + Plus plan screen, asli pricing ke saath (V65)
- [ ] Month-end retrospective / stats view (V66) — agar ye feature nahi hai to **banane layak hai**
- [ ] 7-field form ka collapse → ek line (V68) — ye motion design hai, recording nahi

### Updated posting order (01–70)
```
Pinned  : 60
Week 1  : 27 → 14 → 51 → 01 → 22
Week 2  : 05 → 34 → 07 → 47 → 69      ← 69 (sabko maaf) jaldi — brand ko dost banata hai
Week 3  : 21 → 39 → 46 → 33 → 19
Week 4  : 57 → 31 → 63 → 28 → 06
Week 5  : 32 → 49 → 38 → 56 → 67      ← 67 (raw UGC) ke aas-paas sab produced hai, contrast banega
Week 6  : 13 → 42 → 53 → 61 → 52      ← 61 referral, jab audience warm ho chuki ho
Week 7  : 54 → 44 → 64 → 48 → 55
Week 8  : 30 → 12 → 59 → 66 → 41
Week 9  : 70 → 26 → 68 → 62 → 35      ← 70 ko 60 se 4+ hafte door rakha
Week 10 : 18 → 03 → 09 → 02 → 40
Paid    : 50 (launch), 51 (trust), 65 (retargeting), 20, 25, 29, 45 (App Store)
Festive : 36 (Diwali/New Year), 37 (milestone), 60 (Mother's/Father's Day), 70 (Independence Day / family)
```
**Do soch-samajh ke liye gaye faisle:** `69` week 2 me — jaldi hi audience ko batana zaroori
hai ki hum unhe judge nahi kar rahe, warna 20 guilt-based videos ke baad brand nagging
lagne lagega. `70` aur `60` ke beech **chaar hafte ka gap** rakha hai — dono deep brand
films hain, paas-paas post karoge to ek doosre ko kha jayenge.
