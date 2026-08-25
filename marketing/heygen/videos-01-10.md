# Apka Saathi — HeyGen Ready Prompts | Videos 01–10

> Pehle `00-GLOBAL-SPEC.md` padho. Wahan brand kit, voice, safe-zone, end-card sab locked hai.
> Yahan sirf per-video content hai.
> **LOCAL ONLY.**

**Har video me kya milega:**
1. `MASTER PROMPT` — HeyGen ke AI/prompt box me sidha paste karne ke liye
2. `SCENE TABLE` — manual build ke liye shot-by-shot
3. `SCRIPT — HI` — HeyGen script box me paste (voiceover)
4. `SCRIPT — EN` — global/NRI variant
5. `ON-SCREEN TEXT` — overlays
6. `CINEMATIC PROMPT` — agar Veo/Kling/Sora se real footage banana ho

---
---

# VIDEO 01 — "Papa Ka Phone"
**Angle:** Father–son emotional | **Length:** 25s (22s VO + 3s card) | **Voice:** V-NARRATOR + V-ELDER cameo
**Target:** India Hindi belt + NRI (ye NRI pe sabse strong perform karega)

> ⚠️ **Ye video pehle face-drift se fail hua tha** (Rahul shuru me sahi, beech me badal gaya).
> Wajah: har shot text-prompt se alag generate ho raha tha. Neeche wala structure
> **shot-by-shot reference lock** karta hai. `00-GLOBAL-SPEC.md` ka **§5A CHARACTER LOCK**
> pehle padho — bina uske ye video dobara fail hoga.

### CAST LOCK (har generation me attach karo)

| Role | ID | Reference file | Kaunse shots me |
|---|---|---|---|
| Rahul | `RAHUL-01` | `cast/RAHUL-01-hero.png` | 1, 3 |
| Papa | `PAPA-01` | `cast/PAPA-01-hero.png` | 2 |
| Dono | two-shot | `cast/TWOSHOT-RAHUL-PAPA.png` | 6 |

**Shot 6 (balcony) hi wo jagah hai jahan drift sabse pehle aata hai** — kyunki wahan
pehli baar dono ek frame me hain. Use **kabhi text se mat banao**. Ya to approved
two-shot reference use karo, ya §5A STEP 4 ka Option B (shot-reverse-shot) le lo.

### MASTER PROMPT (HeyGen — project-level settings)
```
Create a 25-second vertical 9:16 emotional Indian storytelling reel, 1080x1920, 30fps.

STORY: A 30-year-old Indian working professional (Rahul) is at his office desk. His
62-year-old father calls to say his driving licence has expired. Rahul feels a quiet
guilt — his father remembered every date of his life, and he forgot one of his father's.
That night Rahul stores all his father's documents in the Apka Saathi app and sets
expiry reminders.

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

ROLES: RAHUL-01 is the son; PAPA-01 is his father.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

LOOK: Realistic Indian lifestyle, cinematic, 50mm shallow depth of field, handheld subtle.
Office scenes cool desaturated blue-grey. Home scenes warm golden. Shift from cool to
warm exactly when the app opens.

VOICE: Hindi-Hinglish, warm male narrator, age 30-35, slow emotional storytelling pace
(speed 0.92). Add a 0.5s pause after every emotional line.

CAPTIONS: Burned-in, Poppins Bold white with dark stroke, active-word highlight #C25A37,
positioned in the middle-lower safe band (never below y=1440).

MUSIC: Solo piano, soft, melancholic turning hopeful. Keep 24dB below the voice.

END CARD (3s): Deep teal #125156 background, Apka Saathi logo, wordmark, tagline
"Never Forget What Matters" in #C25A37, then a "Download Apka Saathi" pill in #C25A37.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### PER-SHOT GENERATION PROMPTS (ek-ek karke, reference attach karke)

**Shot 1 — Rahul, office, phone at ear** · reference: `RAHUL-01-hero.png`
```
Same person as the reference image, unchanged face. Indian man at a glass-walled
office desk, phone held to his right ear, expression shifting from casual to quiet
guilt, shoulders dropping slightly. Light blue formal shirt with sleeves folded twice,
black office ID lanyard. Cool desaturated blue-grey grade, overhead office light.
50mm, shallow depth of field, subtle handheld. Medium close-up, chest up.

IDENTITY LOCK: identical face to the reference — same oval face, same jawline, same
straight nose, same 3-day stubble, same small mole on the left cheekbone, same
side-parted hair. Do not restyle, do not age, do not beautify.
```

**Shot 2 — Papa, home, holding licence** · reference: `PAPA-01-hero.png`
```
Same person as the reference image, unchanged face. Elderly Indian man seated at home
near a window, holding a small plastic driving licence card in both hands, looking down
at it, tired and gentle. Cream cotton kurta. Warm golden afternoon light through a
window grille, soft shadows. 50mm, shallow depth of field. Medium shot.

IDENTITY LOCK: identical face to the reference — same square face, same full silver-grey
hair combed back, same thick black rectangular glasses, same grey moustache, same small
scar above the right eyebrow, same deep-set eyes. Do not restyle, do not de-age.
```

**Shot 3 — Rahul, hands go still** · reference: `RAHUL-01-hero.png`
```
Same person as the reference image, unchanged face. Close-up of the same Indian man at
his office desk, hands going completely still on the keyboard, eyes unfocused, staring
past the monitor. Light blue formal shirt, sleeves folded, lanyard visible. Cool
desaturated blue-grey grade. 50mm, very shallow depth of field, slow push-in.

IDENTITY LOCK: identical face to the reference — same mole on the left cheekbone, same
stubble length, same hairline. Must be recognisably the exact same man as Shot 1.
```

**Shot 6 — balcony two-shot** · reference: `TWOSHOT-RAHUL-PAPA.png`
```
Same two people as the reference image, both faces unchanged. Indian father and adult
son standing together on an apartment balcony at dusk, holding tea cups, a small quiet
genuine smile between them. Son in a light blue shirt, father in a cream kurta. Warm
golden dusk light, soft city bokeh behind. 50mm, shallow depth of field. Wide-medium,
both faces visible.

IDENTITY LOCK: the younger man is identical to RAHUL-01 (mole on left cheekbone,
3-day stubble, side-parted black hair). The older man is identical to PAPA-01 (full
silver hair, thick black rectangular glasses, grey moustache). Keep them clearly two
distinct people — do not blend their features, do not age the son, do not de-age
the father.
```

**Negative prompt — chaaron shots me paste karo:**
```
different person, face swap, changed facial features, inconsistent identity,
younger face, older face, different hairline, added glasses, removed glasses,
different beard style, beautified skin, plastic skin, western features,
two people merged, extra fingers, distorted hands, text, watermark, logo
```

### SCENE TABLE
| # | Time | Visual (source + reference lock) | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.5 | **Photo Avatar `RAHUL-01`** (office bg) close-up, phone at ear, face falls | "Beta… license expire ho gaya." *(V-ELDER, muffled phone filter)* | — |
| 2 | 3.5–7.0 | AI-gen ← ref `PAPA-01-hero.png` — father at home holding a licence card, window light | "Papa ki awaaz thodi dheemi thi." | — |
| 3 | 7.0–12.0 | AI-gen ← ref `RAHUL-01-hero.png` — stops typing, stares at nothing | "Jinhone humari har date yaad rakhi… unki ek date main bhool gaya." | `Unki ek date.` |
| 4 | 12.0–16.0 | **Your screen recording**: Apka Saathi opens, "Add Document" → Driving Licence | "Us raat maine Apka Saathi khola. Papa ke saare documents — ek jagah." | `Sab documents. Ek jagah.` |
| 5 | 16.0–19.5 | Screen recording: notification `🔔 Driving Licence expires in 30 days` | "Har expiry ka reminder, waqt se pehle." | `30 din pehle reminder` |
| 6 | 19.5–22.0 | AI-gen ← ref `TWOSHOT-RAHUL-PAPA.png` — balcony, warm, quiet smile | "Ab Papa ko yaad rakhne ki zarurat nahi padti. Apka Saathi yaad rakhta hai." | — |
| 7 | 22.0–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

> **Note:** Shot 4 aur 5 screen recording hain — wahan koi face nahi hai. Isliye
> face continuity ka test yahi hai: **Shot 3 ka Rahul aur Shot 6 ka Rahul same lagne
> chahiye**, beech me 7 second ka gap hone ke bawajood. Export se pehle dono ka
> ek-ek frame side-by-side rakh ke check karo.

### SCRIPT — HI (paste into HeyGen)
```
Beta license expire ho gaya. Papa ki awaaz thodi dheemi thi.

Jinhone humari har date yaad rakhi... unki ek date main bhool gaya.

Us raat maine Apka Saathi kholi. Papa ke saare documents — ek jagah.

Har expiry ka reminder, waqt se pehle.

Ab Papa ko yaad rakhne ki zarurat nahi padti. Apka Saathi yaad rakhta hai.

Apka Saathi.
```
*(63 words ≈ 22s @ 0.92 speed)*

### SCRIPT — EN (NRI / Global)
```
Son... my licence has expired.

Dad's voice was quieter than usual.

The man who remembered every date of my life... I forgot one of his.

That night I opened Apka Saathi. All his documents, in one place.

Every expiry, reminded well in time.

Now Dad never has to make that call.

Apka Saathi.
```

### CINEMATIC PROMPT (Veo 3 / Kling — agar real footage chahiye)
```
Cinematic 9:16 vertical, 25 seconds, realistic Indian lifestyle drama, 50mm anamorphic,
shallow depth of field, natural window light, subtle film grain.

CHARACTER REFERENCES (attach both, keep faces identical in every shot):
- RAHUL-01 → cast/RAHUL-01-hero.png
- PAPA-01  → cast/PAPA-01-hero.png

Shot 1: RAHUL-01, 30, light blue shirt at a glass-walled office desk, phone to ear,
expression shifting from casual to quiet guilt. Cool blue-grey grade. 3s.
Shot 2: PAPA-01, 62, cream kurta and thick black rectangular glasses at home, holding an
expired driving licence, soft golden afternoon light through a window grille. 3s.
Shot 3: Close-up of RAHUL-01's hands going still on the keyboard. 3s.
Shot 4: Night, warm lamp light, RAHUL-01 on a sofa using a phone, calm relief. 4s.
Shot 5: RAHUL-01 and PAPA-01 on a balcony at dusk, sharing tea, small genuine smile. 3s.

IDENTITY LOCK: RAHUL-01 and PAPA-01 must be the exact same two people in every shot —
same faces, same hair, same glasses on the father, same mole on the son's left cheekbone.
Do not regenerate or reinterpret either face between shots.
No text, no logos, no on-screen graphics.
```

**Veo 3 / Kling me:** har shot ko **alag clip** ki tarah generate karo, aur har clip me
reference image dobara attach karo. Ek hi lambe prompt se 5 shots maangoge to tool
beech me face badal dega — bilkul wahi problem jo pehle aayi thi.

---
---

# VIDEO 02 — "Koi Baat Nahi Beta"
**Angle:** Mother's birthday missed | **Length:** 25s | **Voice:** V-NARRATOR
**Target:** India metro + NRI (guilt hook — highest save-rate ka format)

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 emotional Indian reel, 1080x1920.

STORY: A 30-year-old Indian professional is in a busy office meeting. His phone buzzes —
a cousin has posted "Happy Birthday Aunty". It is his mother's birthday and he forgot.
She only says "koi baat nahi beta" — and that hurts more than anger would. Now Apka
Saathi reminds him three days in advance.

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

[MAA-01]
  Indian woman, exactly 55 years old, round face with soft full cheeks, wheatish
  skin, black hair with visible grey at the temples pulled back into a low bun with a
  centre parting, small maroon round bindi, thin gold hoop earrings, soft
  double-lidded brown eyes, deep gentle smile lines around the mouth, a small mole on
  the right side of the chin, no glasses, small build, height 5 feet 1 inch.
  Wardrobe: Simple cotton saree in soft teal or mustard, cotton blouse, thin gold
  mangalsutra. When reading: thin gold-rimmed reading glasses.

ROLES: RAHUL-01 is the son; MAA-01 is his mother.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

LOOK: Realistic, cinematic, handheld. Meeting room = cool fluorescent grey. Mother's
scene = warm domestic golden light.

VOICE: Hindi-Hinglish, warm male narrator, slow emotional pace, speed 0.92, 0.5s pause
after each line.

CAPTIONS: Poppins Bold white, highlight #C25A37, middle-lower safe band.
MUSIC: Gentle piano with a single sustained string note. 24dB under voice.
END CARD: standard Apka Saathi teal card with "Never Forget What Matters".

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.0 | **Avatar/Stock:** meeting room, man half-listening, phone face-down buzzing | "Meeting chal rahi thi. Phone vibrate hua." | — |
| 2 | 3.0–6.5 | Phone screen macro: WhatsApp notif "🎂 Happy Birthday Aunty ji" | "Cousin ka message — Happy Birthday Maa." | — |
| 3 | 6.5–11.0 | Man's face drops, pushes chair back, walks out of frame | "Aaj Maa ka janamdin tha… aur main bhool gaya." | `Aur main bhool gaya.` |
| 4 | 11.0–15.0 | Warm home: mother on phone call, gentle smile, no complaint | "Maa ne bas kaha — koi baat nahi beta." | — |
| 5 | 15.0–18.0 | Back to son, phone at ear, eyes down | "Wahi *koi baat nahi* sabse zyada chubhta hai." | `"Koi baat nahi" — sabse zyada chubhta hai` |
| 6 | 18.0–22.0 | **Screen recording:** Apka Saathi → Birthday reminder → "3 days before" toggle | "Ab Apka Saathi teen din pehle yaad dila deta hai." | `3 din pehle reminder` |
| 7 | 22.0–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Meeting chal rahi thi. Phone vibrate hua.

Cousin ka message — Happy Birthday Maa.

Aaj Maa ka janamdin tha... aur main bhool gaya.

Maa ne bas kaha — koi baat nahi beta.

Wahi "koi baat nahi" sabse zyada chubhta hai.

Ab Apka Saathi teen din pehle yaad dila deta hai.

Apka Saathi.
```

### SCRIPT — EN
```
Mid-meeting. My phone buzzed.

A cousin's post — "Happy Birthday, Aunty."

It was my mother's birthday... and I had forgotten.

All she said was, "It's okay, beta."

That "it's okay" is what hurts the most.

Now Apka Saathi reminds me three days early.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, realistic Indian corporate drama. Shot 1: busy glass meeting room,
6 Indian professionals, one man 30 in blue shirt distracted, phone buzzing face-down,
cool fluorescent grade, 35mm handheld, 3s. Shot 2: extreme macro of a phone screen
lighting up in a dim room, 2s. Shot 3: same man walking into an empty office corridor,
guilt on his face, rack focus, 3s. Shot 4: Indian mother 55 in a cotton saree at home,
warm golden light, holding a phone to her ear, smiling gently, 4s. Shot 5: son on the
phone, eyes lowered, small sad smile, 3s. No text, no graphics.
```

---
---

# VIDEO 03 — "Kal Interview Hai"
**Angle:** Career / motivational | **Length:** 20s | **Voice:** V-YOUNG
**Target:** India Tier-2/3, students, 22–28

### MASTER PROMPT (HeyGen)
```
Create a 20-second vertical 9:16 motivational Indian reel, 1080x1920.

STORY: 11 PM. A 25-year-old Indian professional is preparing for tomorrow's job
interview in a small rented room. Anxious — are the documents ready? The phone buzzes:
Apka Saathi has a reminder with a full document checklist. The panic dissolves.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[AMAN-01]
  Indian male, exactly 21 years old, thin narrow face, medium-brown skin, thick messy
  black hair falling over the forehead, sparse patchy stubble on the chin only, thin
  eyebrows, bright dark eyes, slightly prominent front teeth visible when smiling, a
  small mole on the right jawline, no glasses, thin lanky build, height 5 feet 10
  inches.
  Wardrobe: Oversized grey hoodie or plain black t-shirt, wired earphones around the
  neck, canvas backpack.

ROLES: AMAN-01 is the job candidate.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
AMAN-01 in the final shot must be recognisably the SAME PERSON as AMAN-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

LOOK: Realistic, warm tungsten lamp light against cool night window, cinematic 50mm.
VOICE: Hindi-Hinglish, young male 22-25, motivational and reassuring, speed 1.0.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Minimal ambient pulse building to a hopeful resolve.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.0 | Night room, wall clock 11:00, young man at desk, laptop glow | "Raat ke gyarah baje. Kal interview hai." | `11:00 PM` |
| 2 | 3.0–6.5 | Quick cuts: folder, certificates scattered, hand searching | "Documents ready? Certificates? Address proof?" | — |
| 3 | 6.5–9.0 | Phone lights up on the table — notification banner | "Phone buzz karta hai — Apka Saathi." | `🔔` |
| 4 | 9.0–13.0 | **Screen recording:** reminder card + document checklist, all ticked | "Kal 10 baje interview. Documents checklist ready hai." | `Interview • 10:00 AM ✅ Checklist ready` |
| 5 | 13.0–16.0 | Man exhales, leans back, small smile, closes laptop | "Ek notification… aur poori raat ki tension khatam." | — |
| 6 | 16.0–17.0 | Morning: he walks out confident, folder in hand | "Mehnat aapki. Yaad rakhna humara." | `Mehnat aapki. Yaad rakhna humara.` |
| 7 | 17.0–20.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Raat ke gyarah baje. Kal interview hai.

Documents ready? Certificates? Address proof?

Phone buzz karta hai — Apka Saathi.

Kal das baje interview. Documents checklist ready hai.

Ek notification... aur poori raat ki tension khatam.

Mehnat aapki. Yaad rakhna humara.

Apka Saathi.
```

### SCRIPT — EN
```
11 PM. Interview tomorrow.

Documents ready? Certificates? Address proof?

The phone buzzes — Apka Saathi.

"Interview at 10 AM. Your document checklist is ready."

One notification... and the whole night's panic is gone.

The hard work is yours. Remembering is ours.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 20s. Shot 1: small Indian rented room at night, 25-year-old man at a
study table, warm desk lamp, cool blue window behind, laptop glow on his face, 3s.
Shot 2: macro of hands sorting through certificates and a document folder, anxious, 3s.
Shot 3: phone screen lighting up on a wooden table, shallow focus, 2s.
Shot 4: the man exhales and leans back in the chair, relief, small smile, 4s.
Shot 5: morning, same man in a formal shirt walking out of a doorway with a folder,
confident, golden light, 3s. No text, no graphics.
```

---
---

# VIDEO 04 — "Har Saal Wahi Sawaal"
**Angle:** Couple / insurance renewal / trust | **Length:** 25s | **Voice:** V-NARRATOR (trust tone)
**Target:** India 28–45 married, Gulf NRI

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 warm, trustworthy Indian family reel, 1080x1920.

STORY: Sunday morning at home. An Indian husband (35) and wife are having tea, going
through an old file of insurance papers. The wife asks — "the renewal date hasn't passed,
has it?" The same anxious question every year. This time Apka Saathi had already flagged
it: "Health insurance renewal — 12 days left." Their family cover is never late again.

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

[PRIYA-01]
  Indian woman, exactly 29 years old, heart-shaped face, fair-wheatish skin,
  shoulder-length straight dark-brown hair worn loose with a side parting, arched
  thin eyebrows, large dark eyes with long lashes, small pointed chin, a faint dimple
  on the right cheek when she smiles, small silver stud earrings only, no bindi, no
  other jewellery, slim build, height 5 feet 4 inches.
  Wardrobe: Plain cotton kurti in mustard or rust, churidar, thin silver bangle on
  the left wrist.

ROLES: RAHUL-01 and PRIYA-01 are husband and wife.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

LOOK: Warm Sunday morning light, cream and terracotta tones, cinematic 50mm, calm pacing.
VOICE: Hindi-Hinglish, male narrator, calm and trustworthy, speed 0.92.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Soft acoustic guitar, warm and safe.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Sunday morning living room, two chai cups, old document file opened | "Ravivar ki subah. Chai. Aur ek purani file." | — |
| 2 | 4.0–8.0 | Wife looks up, concerned; husband flipping papers | "Suniye… insurance ki date nikal to nahi gayi?" | — |
| 3 | 8.0–11.5 | Papers spread on the table, hands searching | "Do minute ki tension. Har saal wahi sawaal." | `Har saal. Wahi sawaal.` |
| 4 | 11.5–16.0 | **Screen recording:** Apka Saathi notification card | "Is baar phone pe pehle se reminder tha — Apka Saathi se." | `🔔 Health Insurance renewal — 12 din baaki` |
| 5 | 16.0–19.0 | Screen: "Renew" tapped → ✅ done state | — | `Renewed ✅` |
| 6 | 19.0–22.0 | Couple relaxed, husband hands wife her cup, both smile | "Family ki suraksha, ab kabhi late nahi hoti." | `Family ki suraksha — kabhi late nahi` |
| 7 | 22.0–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Ravivar ki subah. Chai. Aur ek purani file.

Suniye... insurance ki date nikal to nahi gayi?

Do minute ki tension. Har saal wahi sawaal.

Is baar phone pe pehle se reminder tha — Apka Saathi se.

Health insurance renewal — baarah din baaki.

Family ki suraksha, ab kabhi late nahi hoti.

Apka Saathi.
```

### SCRIPT — EN
```
Sunday morning. Tea. And an old file.

"Listen... the insurance date hasn't passed, has it?"

The same anxious question. Every single year.

This time the reminder came first — from Apka Saathi.

"Health insurance renewal — 12 days left."

Your family's cover is never late again.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, warm realistic Indian home. Shot 1: Sunday morning living room,
two steel cups of chai on a table, an old worn document folder being opened, soft window
light, 50mm shallow, 4s. Shot 2: Indian wife 30 in a kurti looking up with mild concern,
husband 35 flipping through insurance papers, 4s. Shot 3: overhead of documents spread
across a table, hands searching, 3s. Shot 4: the couple relaxing back on the sofa,
husband passing her the tea cup, both smiling, warm golden tone, 4s. No text, no graphics.
```

---
---

# VIDEO 05 — "Woh File Kahan Hai?"
**Angle:** Document storage / product demo | **Length:** 30s | **Voice:** V-NARRATOR (friendly)
**Target:** India broad — ye sabse "shareable" utility video hai

### MASTER PROMPT (HeyGen)
```
Create a 30-second vertical 9:16 relatable Indian product-story reel, 1080x1920.

STORY: A 30-year-old Indian man is tearing his house apart looking for a PAN card file —
the steel almirah, the drawer, an old bag, his phone gallery. Half an hour later he finds
it. It happens every single time. So he puts everything into Apka Saathi: Aadhaar, PAN,
driving licence, insurance — all secure, all in one place. And when an expiry approaches,
the reminder finds him. He no longer searches. He just opens the app.

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

ROLES: RAHUL-01 at home, in his charcoal t-shirt.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

SETTING: Realistic middle-class Indian home — steel almirah, wooden drawer, plastic
document folders, a cluttered shelf.

LOOK: Start slightly cool and cluttered, end warm and calm. Handheld for the search
sequence, locked-off tripod for the app section.
VOICE: Hindi-Hinglish, friendly and conversational, speed 0.95.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Light percussive, playful during the search, resolving to calm.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.5 | Man mid-room, hands on head, papers everywhere | "Woh PAN card wali file kahan rakhi thi?" | `Woh file kahan hai?` |
| 2 | 3.5–8.0 | **Fast cuts (0.7s each):** almirah → drawer → old bag → phone gallery | "Almari. Drawer. Purana bag. Phone gallery." | `Almari` `Drawer` `Bag` `Gallery` |
| 3 | 8.0–11.5 | Clock cut 4:00 → 4:30. He holds up the file, exhausted | "Aadhe ghante baad — mila. Har baar yahi hota hai." | `30 min ⏱` |
| 4 | 11.5–17.0 | **Screen recording:** upload flow — camera scan → document saved | "Phir maine sab kuch Apka Saathi me daal diya." | `Scan karo. Save ho gaya.` |
| 5 | 17.0–22.0 | Screen: document grid — Aadhaar, PAN, Licence, Insurance tiles | "Aadhaar, PAN, license, insurance — sab safe, sab ek jagah." | `🔒 Encrypted & safe` |
| 6 | 22.0–25.0 | Screen: expiry reminder banner slides in | "Aur jaise hi koi expiry paas aati hai — reminder khud aa jata hai." | `🔔 Expiry se pehle` |
| 7 | 25.0–27.0 | Man on sofa, calm, opens app in 2 seconds, smiles | "Ab dhoondhna nahi padta. Bas kholna padta hai." | `Dhoondhna nahi. Kholna.` |
| 8 | 27.0–30.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Woh PAN card wali file kahan rakhi thi?

Almari. Drawer. Purana bag. Phone gallery.

Aadhe ghante baad — mila. Har baar yahi hota hai.

Phir maine sab kuch Apka Saathi me daal diya.

Aadhaar, PAN, license, insurance — sab safe, sab ek jagah.

Aur jaise hi koi expiry paas aati hai, reminder khud aa jata hai.

Ab dhoondhna nahi padta. Bas kholna padta hai.

Apka Saathi.
```
*(76 words ≈ 27s)*

### SCRIPT — EN
```
"Where did I keep that PAN card file?"

Cupboard. Drawer. Old bag. Phone gallery.

Half an hour later — found it. Every single time.

So I put everything into Apka Saathi.

Aadhaar, PAN, licence, insurance — all safe, all in one place.

And the moment an expiry gets close, the reminder finds me.

No more searching. Just open it.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 30s, realistic Indian middle-class home. Shot 1: 30-year-old Indian man
standing in a cluttered room, hands on his head, documents scattered, handheld, 3s.
Shot 2: rapid montage — pulling open a steel almirah, rifling a wooden drawer, emptying
an old canvas bag, scrolling a phone photo gallery. Each 1s, quick whip transitions, 4s.
Shot 3: the man sitting on the floor holding up a plastic document folder, exhausted
relief, 3s. Shot 4: same man on a sofa in warm evening light, calm, using a phone,
locked-off tripod, shallow focus, 4s. No text, no graphics.
```

---
---

# VIDEO 06 — "Tumhe Yaad Tha?"
**Angle:** Anniversary saved | **Length:** 25s | **Voice:** V-NARRATOR (warm)
**Target:** India 28–40 married + NRI couples

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 warm emotional Indian couple reel, 1080x1920.

STORY: 7 PM, the office is empty but a 30-year-old man's laptop is still open. His phone
lights up: "Today is your wedding anniversary." He shuts the laptop instantly. Flowers on
the way home. His wife opens the door, surprised and smiling: "You remembered?" He didn't.
Apka Saathi did.

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

[PRIYA-01]
  Indian woman, exactly 29 years old, heart-shaped face, fair-wheatish skin,
  shoulder-length straight dark-brown hair worn loose with a side parting, arched
  thin eyebrows, large dark eyes with long lashes, small pointed chin, a faint dimple
  on the right cheek when she smiles, small silver stud earrings only, no bindi, no
  other jewellery, slim build, height 5 feet 4 inches.
  Wardrobe: Plain cotton kurti in mustard or rust, churidar, thin silver bangle on
  the left wrist.

ROLES: RAHUL-01 and PRIYA-01 are husband and wife.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

LOOK: Office = cool blue evening. Street = amber city lights. Home = warm golden.
The grade must visibly warm up across the video.
VOICE: Hindi-Hinglish, warm male narrator, gentle, speed 0.92.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Soft piano with light strings, romantic but not cheesy.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.5 | Empty office, one desk lamp, man still typing, wall clock 7:00 | "Shaam ke saat baj gaye. Laptop abhi bhi khula tha." | `7:00 PM` |
| 2 | 3.5–8.0 | **Screen recording:** notification slides in | "Phone chamka — Aaj aapki shaadi ki saalgirah hai." | `🔔 Aaj aapki shaadi ki saalgirah hai` |
| 3 | 8.0–11.0 | He freezes, then snaps the laptop shut, grabs his bag | "Ek second… aur maine laptop band kar diya." | — |
| 4 | 11.0–15.0 | Street at night, roadside flower stall, he buys roses, amber lights | "Raaste me phool." | — |
| 5 | 15.0–19.0 | Door opens, wife sees flowers, hand to mouth, laughs | "Ghar pe woh, muskurati hui. Tumhe yaad tha?" | `"Tumhe yaad tha?"` |
| 6 | 19.0–22.0 | His face, small honest smile | "Mujhe nahi. Apka Saathi ko tha." | `Mujhe nahi. Apka Saathi ko tha.` |
| 7 | 22.0–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Shaam ke saat baj gaye. Laptop abhi bhi khula tha.

Phone chamka — aaj aapki shaadi ki saalgirah hai.

Ek second... aur maine laptop band kar diya.

Raaste me phool. Ghar pe woh, muskurati hui.

Tumhe yaad tha?

Mujhe nahi. Apka Saathi ko tha.

Apka Saathi.
```

### SCRIPT — EN
```
7 PM. The laptop was still open.

The phone lit up — "Today is your wedding anniversary."

One second... and I shut the laptop.

Flowers on the way. Her smile at the door.

"You remembered?"

I didn't. Apka Saathi did.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s. Shot 1: nearly empty Indian office at night, one desk lamp, a
30-year-old man in a loosened tie still typing, cool blue grade, 3s. Shot 2: macro of a
phone screen lighting up beside a keyboard, 2s. Shot 3: he closes the laptop abruptly and
picks up his bag, 2s. Shot 4: night street, warm amber sodium lights, a roadside flower
vendor, he buys a bunch of roses, handheld, 4s. Shot 5: an apartment door opens, Indian
woman 29 in a kurti sees the flowers, genuine surprise and laughter, warm golden interior
light, 4s. No text, no graphics.
```

---
---

# VIDEO 07 — "Papa Ki Dawai"
**Angle:** Elderly parent care / medicine | **Length:** 25s | **Voice:** V-NARRATOR (tender)
**Target:** India 28–45 + NRI (jo parents se door hain — ye unke liye killer hai)

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 tender Indian family reel, 1080x1920.

STORY: An elderly Indian father takes three medicines a day — morning, afternoon, night.
He forgets. And he never mentions it. His 30-year-old son sets the reminders for him in
Apka Saathi. Now the phone rings at exactly 9 every day. Yesterday the father said,
"Good thing you set it up." A small thing for the son. A big one for the father.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[PAPA-01]
  Indian male, exactly 62 years old, square face with prominent cheekbones, wheatish
  skin, full silver-grey hair combed straight back from a high forehead, thick black
  rectangular-framed glasses, bushy grey eyebrows, deep-set warm brown eyes with
  heavy crow's feet, prominent nasolabial folds, clean-shaven cheeks with a neat
  trimmed grey moustache, a small vertical scar above the right eyebrow, slight
  forward stoop, medium build.
  Wardrobe: Cream cotton kurta, brown leather sandals. In winter: brown shawl over
  the shoulder.

[RAHUL-01]
  Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
  skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
  the front, thick straight eyebrows, dark brown almond-shaped eyes with mild
  under-eye shadows, straight medium-width nose, close-trimmed 3-day stubble beard
  connected to a thin moustache, a small dark mole on the left cheekbone below the
  eye, no glasses, lean build, height 5 feet 9 inches.
  Wardrobe: Light blue formal shirt, sleeves folded twice to the forearm, dark grey
  trousers, black office ID lanyard. At home: plain charcoal t-shirt, same face.

ROLES: PAPA-01 is the father; RAHUL-01 is his son.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

SETTING: Realistic Indian home — medicine strips on a side table, a steel water glass,
an old wooden chair by a window.

LOOK: Soft warm daylight, gentle, unhurried. 50mm shallow focus. Very few cuts, longer holds.
VOICE: Hindi-Hinglish, warm male narrator, tender and slow, speed 0.90.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Single sustained piano, very sparse. Almost silence.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Macro: three medicine strips + a steel glass on a side table, morning light | "Papa ko teen dawaiyan chalti hain. Subah, dopahar, raat." | — |
| 2 | 4.5–8.0 | Father in a chair, looks at the strips, uncertain, then looks away | "Wo bhool jaate hain. Aur bolte nahi." | `Aur bolte nahi.` |
| 3 | 8.0–13.0 | **Screen recording:** son adds "Papa — Dawai" reminder, daily 9:00 AM | "Maine Apka Saathi me unke liye reminder laga diya." | `Papa — Dawai • Daily 9:00 AM` |
| 4 | 13.0–16.5 | Father's phone rings on the table, he picks it up, reads, nods | "Ab har din theek nau baje phone bajta hai." | `🔔 9:00 AM` |
| 5 | 16.5–21.0 | Father to son, hand on his shoulder, small warm smile | "Kal Papa ne kaha — accha hua tune laga diya." | `"Accha hua tune laga diya."` |
| 6 | 21.0–22.5 | Wide: both sitting quietly by the window | "Chhoti si cheez thi. Unke liye badi thi." | — |
| 7 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Papa ko teen dawaiyan chalti hain. Subah, dopahar, raat.

Wo bhool jaate hain. Aur bolte nahi.

Maine Apka Saathi me unke liye reminder laga diya.

Ab har din theek nau baje phone bajta hai.

Kal Papa ne kaha — accha hua tune laga diya.

Chhoti si cheez thi. Unke liye badi thi.

Apka Saathi.
```

### SCRIPT — EN
```
Dad takes three medicines. Morning, afternoon, night.

He forgets. And he never says so.

I set his reminders in Apka Saathi.

Now the phone rings at nine. Every single day.

Yesterday he told me — "Good thing you set that up."

A small thing for me. A big one for him.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, quiet realistic Indian home drama, soft natural daylight, 50mm,
long holds, minimal camera movement. Shot 1: macro of three medicine blister strips and
a steel water glass on a wooden side table, dust motes in the light, 4s. Shot 2: Indian
man 62 with thick glasses in a cream kurta sitting in an old wooden chair by a window
grille, looking at the strips uncertainly, 4s. Shot 3: close-up of a phone screen lighting
up on the table beside him, 3s. Shot 4: the father places a hand on his 30-year-old son's
shoulder, both seated, warm gentle smile, shallow focus, 5s. Shot 5: wide two-shot of
father and son sitting quietly by the window, 4s. No text, no graphics.
```

---
---

# VIDEO 08 — "Validity: 4 Months"
**Angle:** Travel / passport expiry | **Length:** 25s | **Voice:** V-NARRATOR (modern)
**Target:** NRI + India metro travellers + Gulf

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 modern cinematic Indian travel reel, 1080x1920.

STORY: A young Indian couple has packed their bags, booked the tickets, confirmed the
hotel. Then he opens the passport — validity: 4 months. Most countries require six. The
trip could have died right there. But Apka Saathi had flagged it 90 days earlier and the
passport was already renewed.

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

[PRIYA-01]
  Indian woman, exactly 29 years old, heart-shaped face, fair-wheatish skin,
  shoulder-length straight dark-brown hair worn loose with a side parting, arched
  thin eyebrows, large dark eyes with long lashes, small pointed chin, a faint dimple
  on the right cheek when she smiles, small silver stud earrings only, no bindi, no
  other jewellery, slim build, height 5 feet 4 inches.
  Wardrobe: Plain cotton kurti in mustard or rust, churidar, thin silver bangle on
  the left wrist.

ROLES: RAHUL-01 and PRIYA-01 are the travelling couple.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

SETTING: Bright modern bedroom, open suitcase, folded clothes, camera, sunglasses, passports.

LOOK: Bright, airy, high-key, slightly cool clean grade. Faster cutting than the family
films. Some overhead flat-lay shots.
VOICE: Hindi-Hinglish, male narrator, modern and upbeat but not shouty, speed 1.0.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Light travel percussion with a plucked-string motif.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Overhead flat-lay: suitcase packing timelapse, clothes, camera, sunglasses | "Bags pack ho chuke the. Tickets book. Hotel confirm." | `Bags ✅ Tickets ✅ Hotel ✅` |
| 2 | 4.0–7.5 | He opens a passport, close-up on the data page | "Aur phir — passport khola." | — |
| 3 | 7.5–11.0 | Macro: expiry date. **Freeze + red pulse ring** | "Validity: chaar mahine." | `Validity: 4 months ⚠️` |
| 4 | 11.0–14.5 | Both look at each other, smiles drop | "Bahut se countries chhe mahine maangte hain." | `Most countries need 6` |
| 5 | 14.5–19.5 | **Screen recording:** rewind wipe → old notification, 90 days prior | "Par nabbe din pehle Apka Saathi ne bata diya tha." | `🔔 90 din pehle` |
| 6 | 19.5–22.0 | New passport in hand, both grin, high-five, bag zips shut | "Renew ho chuka tha. Sapne plan karo — dates hum yaad rakhenge." | `Sapne aapke. Dates humari.` |
| 7 | 22.0–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Bags pack ho chuke the. Tickets book. Hotel confirm.

Aur phir — passport khola.

Validity: chaar mahine.

Bahut se countries chhe mahine maangte hain.

Par nabbe din pehle Apka Saathi ne bata diya tha.

Renew ho chuka tha.

Sapne plan karo. Dates hum yaad rakhenge.

Apka Saathi.
```

### SCRIPT — EN
```
Bags packed. Tickets booked. Hotel confirmed.

Then I opened the passport.

Validity: four months.

Most countries want six.

But Apka Saathi had flagged it ninety days earlier.

It was already renewed.

You plan the dreams. We'll remember the dates.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, bright modern travel lifestyle. Shot 1: overhead flat-lay timelapse
of a young Indian couple packing an open suitcase — folded clothes, a camera, sunglasses,
passports — bright airy bedroom, high-key, 4s. Shot 2: close-up of hands opening a navy
passport to the data page, shallow focus, 3s. Shot 3: extreme macro of the expiry date
line on the passport, 2s. Shot 4: the couple looking at each other, smiles fading into
worry, 3s. Shot 5: the man holding up a new passport, both grinning and high-fiving,
zipping the suitcase shut, energetic handheld, 4s. No text, no graphics.
```

---
---

# VIDEO 09 — "Shutter Se Shutter Tak"
**Angle:** Small business owner | **Length:** 25s | **Voice:** V-NARRATOR (grounded, trustworthy)
**Target:** India Tier-2/3 kirana, retail, SME — B2B-ish lekin emotional

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 realistic Indian small-business reel, 1080x1920.

STORY: An Indian shop owner (40) opens his shutter at 7 AM and closes it at 10 PM. In
between: GST filing dates, licence renewals, supplier payments, his son's school fees.
All of it lives in his head, and something always slips. Now it all lives in Apka Saathi.
He runs the shop; the app runs the dates.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[RAVI-01]
  Indian male, exactly 45 years old, oval face with a heavy jaw, dark-brown weathered
  skin, thick black hair with grey only at the sideburns, side-parted, a thick full
  black moustache with no beard, tired warm eyes with deep lower-lid creases, a small
  mole on the left side of the neck, no glasses, sturdy build, height 5 feet 8
  inches.
  Wardrobe: Half-sleeve checked shirt in blue or brown, dark trousers, a pen clipped
  in the shirt pocket.

ROLES: RAVI-01 is the shop owner.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAVI-01 in the final shot must be recognisably the SAME PERSON as RAVI-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

SETTING: Authentic Indian kirana / hardware / mobile-accessory shop — stacked shelves,
a billing counter, a small ledger book, a calculator, a wall calendar.

LOOK: Natural shop lighting, warm tungsten mixed with daylight from the shutter. Slight
documentary handheld feel. Grounded and honest, not polished.
VOICE: Hindi-Hinglish, male narrator, grounded and trustworthy, speed 0.95.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Simple tabla/percussion groove, understated.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Shutter rolls up at dawn → hard cut → shutter rolls down at night | "Subah saat baje shutter uthta hai. Raat das baje girta hai." | `7:00 AM` → `10:00 PM` |
| 2 | 4.5–10.5 | **4 quick cuts (1.2s):** GST notice, licence paper, supplier bill, school fee slip | "Beech me — GST ki date, license renewal, supplier ka payment, bete ki fees." | `GST` `License` `Payment` `Fees` |
| 3 | 10.5–13.5 | He rubs his forehead at the counter, ledger open, calculator | "Sab dimaag me. Kuch na kuch chhoot hi jata hai." | `Sab dimaag me.` |
| 4 | 13.5–19.0 | **Screen recording:** reminder list — all 4 items as cards with dates | "Ab sab Apka Saathi me hai." | `GST • 15 Aug` `License • 2 Sep` `Fees • 5 Sep` |
| 5 | 19.0–22.0 | He serves a customer confidently, phone in shirt pocket, calm | "Dukaan main sambhalta hoon. Dates ye sambhalta hai." | `Dukaan aapki. Dates humari.` |
| 6 | 22.0–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Subah saat baje shutter uthta hai. Raat das baje girta hai.

Beech me — GST ki date, license renewal, supplier ka payment, bete ki fees.

Sab dimaag me. Kuch na kuch chhoot hi jata hai.

Ab sab Apka Saathi me hai.

Dukaan main sambhalta hoon. Dates ye sambhalta hai.

Apka Saathi.
```

### SCRIPT — EN
```
The shutter goes up at seven. It comes down at ten.

In between — GST dates, licence renewals, supplier payments, school fees.

All of it in my head. Something always slips.

Now it's all in Apka Saathi.

I run the shop. It runs the dates.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, documentary-realistic Indian retail. Shot 1: a metal shop shutter
rolling up at dawn, dust and early light, low angle, 2s. Shot 2: the same shutter rolling
down at night under a tube light, 2s. Shot 3: rapid montage of a GST notice, a licence
paper, a supplier bill, a school fee slip on a cluttered billing counter, each 1.2s.
Shot 4: an Indian shop owner, 40, moustache, half-sleeve checked shirt, rubbing his
forehead beside an open ledger and a calculator, warm tungsten light, 3s. Shot 5: the
same man handing a packet to a customer with an easy confident smile, handheld, natural
shop lighting, 4s. No text, no graphics.
```

---
---

# VIDEO 10 — "Koi Laaparwah Nahi Hai"
**Angle:** Brand introduction / manifesto | **Length:** 30s | **Voice:** V-NARRATOR (deep, cinematic)
**Target:** SAB — ye pinned profile video banega. Highest production value.

### MASTER PROMPT (HeyGen)
```
Create a 30-second vertical 9:16 premium cinematic Indian brand film, 1080x1920.

STORY: Three quick portraits of ordinary Indians who missed something important — a
student who missed an exam form deadline, an employee who forgot his own anniversary,
parents whose insurance quietly lapsed. Nobody here is careless. Life is just fast. That
is why Apka Saathi exists: your documents, your dates, your reminders — one place, fully
secure. Because some things should never be forgotten.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[AMAN-01]
  Indian male, exactly 21 years old, thin narrow face, medium-brown skin, thick messy
  black hair falling over the forehead, sparse patchy stubble on the chin only, thin
  eyebrows, bright dark eyes, slightly prominent front teeth visible when smiling, a
  small mole on the right jawline, no glasses, thin lanky build, height 5 feet 10
  inches.
  Wardrobe: Oversized grey hoodie or plain black t-shirt, wired earphones around the
  neck, canvas backpack.

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

ROLES: AMAN-01 the student, RAHUL-01 the professional, PAPA-01 and MAA-01 the
parents.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

LOOK: Premium startup brand-film grade. Each vignette a distinct colour temperature —
student cool blue, professional neutral steel, parents warm amber — then all resolve into
one unified warm terracotta grade for the final section. Slow push-ins, shallow 85mm,
elegant. Fewer cuts, longer holds. This one should feel expensive.
VOICE: Hindi-Hinglish, deep warm male narrator, cinematic and unhurried, speed 0.88.
Long deliberate pauses between the three portraits.
CAPTIONS: Poppins Bold white, highlight #C25A37, minimal — let the visuals breathe.
MUSIC: Solo piano, strings entering at the turn, building to a full warm resolve at the logo.
END CARD: standard Apka Saathi card, hold the tagline slightly longer.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Hostel room, student staring at a laptop, "Registration Closed" | "Ek student — jiska exam form ka last date nikal gaya." | — |
| 2 | 4.0–8.0 | Office at night, man alone, phone in hand, empty desk | "Ek employee — jo apni hi anniversary bhool gaya." | — |
| 3 | 8.0–12.0 | Elderly couple at a table, an old file open between them, worried | "Ek maa-baap — jinka insurance lapse ho gaya." | — |
| 4 | 12.0–16.0 | **Slow-motion faces**, all three, looking straight down the lens | "Koi laaparwah nahi hai. Bas zindagi tez hai." | `Koi laaparwah nahi hai.` |
| 5 | 16.0–19.0 | Grade shifts warm. Logo mark forms from light | "Isliye humne Apka Saathi banaya." | — |
| 6 | 19.0–24.0 | **Screen recording:** three quick feature beats — Documents / Reminders / AI | "Aapke documents. Aapki dates. Aapke reminders. Sab ek jagah. Sab surakshit." | `Documents` `Dates` `Reminders` |
| 7 | 24.0–27.0 | All three characters, now calm, phone in hand, warm light | "Kyunki kuch cheezein bhoolni nahi chahiye." | `Kuch cheezein bhoolni nahi chahiye.` |
| 8 | 27.0–30.0 | **END CARD** (hold tagline 1.2s) | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Ek student — jiska exam form ka last date nikal gaya.

Ek employee — jo apni hi anniversary bhool gaya.

Ek maa-baap — jinka insurance lapse ho gaya.

Koi laaparwah nahi hai. Bas zindagi tez hai.

Isliye humne Apka Saathi banaya.

Aapke documents. Aapki dates. Aapke reminders.

Sab ek jagah. Sab surakshit.

Kyunki kuch cheezein bhoolni nahi chahiye.

Apka Saathi.
```
*(74 words ≈ 27s @ 0.88 speed)*

### SCRIPT — EN
```
A student — who missed the exam form deadline.

An employee — who forgot his own anniversary.

Parents — whose insurance quietly lapsed.

Nobody here is careless. Life is just fast.

That is why we built Apka Saathi.

Your documents. Your dates. Your reminders.

One place. Fully secure.

Because some things should never be forgotten.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 30s, premium brand film, 85mm shallow depth of field, slow push-ins,
elegant long holds, subtle film grain.
Shot 1: Indian college student, 20, in a hostel room lit by a laptop screen, cool blue
grade, staring at the screen with dawning realisation, slow push-in, 4s.
Shot 2: Indian professional, 30, alone in a dark office at night, phone in hand, neutral
steel grade, quiet regret, 4s.
Shot 3: Indian couple, 58, at a dining table with an old document file open between them,
warm amber lamp light, worried, 4s.
Shot 4: slow-motion portrait close-ups of all three, each looking directly into the lens,
neutral expressions, shallow focus, 4s.
Shot 5: the same three people, now calm and at ease, each holding a phone, unified warm
terracotta golden grade, soft rim light, 4s.
No text, no logos, no on-screen graphics.
```

---
---

## Production checklist (10 videos)

- [ ] Ek baar: brand voice clone karo HeyGen me (V-NARRATOR)
- [ ] Ek baar: 20s app screen recording banao (home → add reminder → upload doc → notification)
- [ ] Ek baar: end-card 3s video export karo (After Effects / Canva / HeyGen)
- [ ] Ek baar: Rahul avatar lock karo — saare videos me same face
- [ ] Per video: Hindi master banao → export
- [ ] Per video: HeyGen Translate → English (NRI cut) → export
- [ ] Captions check: safe band ke andar (y 260–1440), neeche nahi
- [ ] Audio check: VO -6dB, music -24dB
- [ ] Thumbnail: video ka sabse emotional frame + 3-word Hinglish text

## Posting order (recommend)
`10` (pinned brand film) → `01` → `05` → `07` → `02` → `06` → `08` → `04` → `03` → `09`

Reason: pehle brand film pin karo, phir 01 (papa) sabse strong emotional hook hai — wo
reach lata hai. 05 (document search) sabse zyada **share** hota hai. 07 (dawai) sabse
zyada **save** hota hai.
