# Apka Saathi — HeyGen Ready Prompts | Videos 51–60

> Pehle `00-GLOBAL-SPEC.md` padho. **LOCAL ONLY.**

**Is batch me do sabse important videos hain jo abhi tak miss ho rahe the:**
**V51 — privacy/trust** (document app ka sabse bada objection, 50 videos me kisi ne
address nahi kiya) aur **V57 — role reversal** (jab aap apne maa-baap ke maa-baap ban
jaate ho). Baaki 8 me se har ek ko ek naya reframe diya hai.

---
---

# VIDEO 51 — "Safe Hai Kya?"
**Angle:** **Privacy / trust — objection handling** | **Length:** 30s | **Voice:** V-NARRATOR (calm, direct)
**Target:** SAB. **Commercially ye poore set ka sabse zaroori video hai.**

> ### 🛑 ROKO — ye video banane se pehle padho
> Is video me maine jo claims likhe hain (encryption, sirf aap dekh sakte ho, data nahi
> bechte, one-button delete) — **wo tab tak mat bolna jab tak app me sach na ho.**
>
> Document storage app ke liye privacy claim **legal claim** hai, marketing line nahi.
> Jhoothi claim par Play Store / App Store listing hat sakti hai, aur India me DPDP Act
> ke tehat problem ho sakti hai.
>
> **Banane se pehle ye verify karo:**
> - [ ] Documents **at rest** encrypted hain? (Supabase storage encryption + client-side?)
> - [ ] Kya sach me **sirf user** dekh sakta hai? Admin panel se koi document dikhta to nahi?
> - [ ] Data kisi third party ko jaata to nahi (analytics, AI provider)?
> - [ ] **Delete account + delete all data** ka button app me hai? Kaam karta hai?
>
> Jo point sach nahi hai, **usko script se hata do** — poori video mat chhodo. Baaki
> lines pe bhi ye video kaam karegi. Aur jo sach hai use **dikhao**, sirf bolo mat.

> **Repetition guard:** 50 videos me kisi ne ye sawaal nahi poocha. Har koi maan ke chal
> raha tha ki user documents upload kar dega. Asal me **yahi sabse bada objection hai** —
> "mera Aadhaar tumhare server pe kyun rakhun?" Jab tak iska jawab nahi hoga, baaki 89
> videos ka install-rate dabega.

### MASTER PROMPT (HeyGen)
```
Create a 30-second vertical 9:16 premium Indian technology trust film, 1080x1920.

STORY: The first question everyone asks — "My Aadhaar, my passport... is it actually safe
inside an app?" You should ask that. So, plainly: your documents are encrypted, only you
can see them, we don't sell them or show them to anyone, and whenever you want you can
delete everything with one button. Asking for trust is easy. Earning it isn't. So we
don't just say it — we show it.

TONE — CRITICAL: This film must feel HONEST, not slick. No hype, no exaggeration, no
dramatic music swells. The credibility comes from restraint. If it looks like an ad, it
fails; if it looks like a straight answer, it works. Treat the viewer's suspicion as
reasonable, never as an obstacle.

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

ROLES: RAHUL-01 speaking straight to the lens.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

SETTING: Clean, minimal, well-lit. Neutral. No home clutter, no office bustle.

LOOK: Premium but restrained. Cream #F7F2E9 and deep teal #125156 palette. Clean
composition, plenty of whitespace, steady locked camera. Show the actual privacy UI —
the encryption indicator, the delete-data screen — as real screen recordings.
VOICE: Hindi-Hinglish, male narrator, calm, level and direct. No salesmanship at all.
Speed 0.92.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Minimal, low, steady. No build, no swell. Almost absent.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.5 | Him looking at his phone, a document in hand, hesitating | "Sabse pehla sawaal jo aata hai —" | — |
| 2 | 3.5–8.0 | Close on the Aadhaar card in his hand, thumb over the number | "Mera Aadhaar, mera passport… app me rakhna safe hai?" | `Safe hai kya?` |
| 3 | 8.0–11.0 | **Direct to camera**, calm | "Sawaal poochna chahiye. Bilkul poochna chahiye." | `Poochna chahiye.` |
| 4 | 11.0–13.0 | Clean cut to a neutral frame | "Isliye seedhi baat —" | — |
| 5 | 13.0–17.0 | **Screen recording:** encryption indicator on a stored document | "Aapke documents encrypted hain. Sirf aap dekh sakte ho." | `🔒 Encrypted • Sirf aap` |
| 6 | 17.0–21.0 | Clean graphic: data NOT flowing outward | "Hum inhe kisi ko bechte nahi. Kisi ko dikhate nahi." | `Bechte nahi. Dikhate nahi.` |
| 7 | 21.0–25.0 | **Screen recording:** Settings → Delete all data → confirm → empty state | "Aur jab chaho, sab delete kar sakte ho — ek button me." | `Delete all — 1 button` |
| 8 | 25.0–27.0 | Direct to camera again | "Bharosa maangna aasaan hai. Kamana mushkil. Isliye hum sirf kehte nahi — dikhate hain." | `Kehte nahi. Dikhate hain.` |
| 9 | 27.0–30.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Sabse pehla sawaal jo aata hai —

Mera Aadhaar, mera passport... app me rakhna safe hai?

Sawaal poochna chahiye. Bilkul poochna chahiye.

Isliye seedhi baat —

Aapke documents encrypted hain. Sirf aap dekh sakte ho.

Hum inhe kisi ko bechte nahi. Kisi ko dikhate nahi.

Aur jab chaho, sab delete kar sakte ho — ek button me.

Bharosa maangna aasaan hai. Kamana mushkil.

Isliye hum sirf kehte nahi — dikhate hain.

Apka Saathi.
```
*(78 words ≈ 28s)*

### SCRIPT — EN
```
The first question everyone asks —

"My Aadhaar, my passport... is it actually safe inside an app?"

You should ask that. You absolutely should.

So, plainly —

Your documents are encrypted. Only you can see them.

We don't sell them. We don't show them to anyone.

And whenever you want, you can delete everything — with one button.

Asking for trust is easy. Earning it isn't.

So we don't just say it — we show it.

Apka Saathi.
```

---

### 🟢 SAFE VERSION — agar abhi verify nahi kar sakte to YE banao

Upar wala version 4 claims karta hai (encryption, sirf aap, nahi bechte, delete-all).
Agar ek bhi confirm nahi hai, to **ye version banao** — isme koi aisi baat nahi hai jo
kisi bhi document app ke liye sach na ho. Impact lagbhag utna hi hai, risk zero.

**SCRIPT — HI (safe)**
```
Sabse pehla sawaal jo aata hai —

Mera Aadhaar, mera passport... app me rakhna safe hai?

Sawaal poochna chahiye. Bilkul poochna chahiye.

Isliye ek baat saaf kar dete hain —

Ye aapke documents hain. Aapke account me. Aapke control me.

Jo aap daalte ho, wahi rehta hai. Jo aap hatate ho, wo chala jata hai.

Hum aapse kabhi nahi poochenge ki aap kya rakh rahe ho.

Bharosa maangna aasaan hai. Kamana mushkil.

Isliye hum sirf kehte nahi — dikhate hain.

Apka Saathi.
```

**SCRIPT — EN (safe)**
```
The first question everyone asks —

"My Aadhaar, my passport... is it safe inside an app?"

You should ask that. You absolutely should.

So let's be clear about one thing —

These are your documents. In your account. Under your control.

What you put in stays. What you remove is gone.

We will never ask you what you're keeping.

Asking for trust is easy. Earning it isn't.

So we don't just say it — we show it.

Apka Saathi.
```

**Scene table me sirf 3 badlav:**
- Scene 5 caption `🔒 Encrypted • Sirf aap` → **`Aapka account. Aapka control.`**
- Scene 6 visual "data NOT flowing outward" → **user ke account ka ek simple diagram**
- Scene 7 "Delete all data" recording → **ek document delete karke gayab hote hue dikhao**
  (ye har app me sach hai — poora account delete karne ka claim mat karo jab tak button na ho)

> Jaise hi tum upar wali checklist verify kar lo, **full version** shoot kar lena. Tab tak
> safe version chalao — kyunki ye video Wave 1 me hai aur iske bina log documents upload
> hi nahi karenge.

---

### CINEMATIC PROMPT
```
Cinematic 9:16, 30s, clean minimal premium interior, cream and deep teal palette, locked
steady camera, soft even lighting, generous negative space, 50mm.
Shot 1: a 32-year-old Indian man in a plain shirt sitting at a clean table, holding an ID
card in one hand and a phone in the other, hesitating, 4s.
Shot 2: macro of the ID card, his thumb deliberately covering the number, 4s.
Shot 3: medium shot of the same man looking directly into the lens, calm and level, no
performance, 4s.
Shot 4: a clean empty tabletop with only a phone on it, soft light, 4s.
Shot 5: the man setting the phone down and sitting back, unhurried and settled, 5s.
No text, no graphics, no UI mockups.
```

---
---

# VIDEO 52 — "Sunday Sham, Das Minute"
**Angle:** **Weekly ritual** — aadat, ek-baar ka setup nahi | **Length:** 25s | **Voice:** V-NARRATOR (calm confident)
**Target:** India metro professionals 28–40. Aspirational lifestyle.

> **Repetition guard:** V33 = **ek baar ka** 5-minute setup (saal me ek baar).
> V48 = **teen mahine** aage dekhna. **V52 = har hafte ki aadat** — Sunday sham, das minute.
> Teeno alag time-horizon hain: saal / quarter / hafta. Confusion mat karo.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 calm aspirational Indian lifestyle reel, 1080x1920.

STORY: Every Sunday evening, ten minutes. He sits down with a cup of chai and opens his
phone. He looks at what next week holds — just once. Two meetings, one bill, his
daughter's school function, Dad's check-up. He sets it all up. Monday morning he already
knows what the week is. The whole week stays calm — because of ten minutes.

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

ROLES: RAHUL-01 on an unhurried Sunday.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

SETTING: A pleasant Sunday-evening home — a balcony or a window seat, warm light, chai,
a plant, the sound of a quiet neighbourhood.

LOOK: Warm, golden, tranquil. Slow camera, long holds. Sunday-evening light is the whole
mood — that specific soft amber hour before dark. Uncluttered frames.
VOICE: Hindi-Hinglish, male narrator, calm and quietly confident, speed 0.92.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Soft acoustic guitar, warm and slow. Sunday-afternoon energy.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Balcony, golden hour, he sits down with chai | "Har Sunday sham ko, das minute." | `Sunday • 10 min` |
| 2 | 4.0–7.0 | He opens his phone, relaxed posture | "Chai leke baithta hoon, phone kholta hoon." | — |
| 3 | 7.0–10.0 | **Screen recording:** next-week view | "Agle hafte me kya hai — ek baar dekh leta hoon." | `Agla hafta` |
| 4 | 10.0–15.0 | **Screen:** four items added one after another | "Do meeting. Ek bill. Beti ka function. Papa ka checkup." | `2 meetings` `1 bill` `Function` `Checkup` |
| 5 | 15.0–17.5 | He puts the phone down. Done. Sips chai | "Sab set kar deta hoon." | — |
| 6 | 17.5–20.5 | Monday morning: he walks out the door, calm, no rush | "Monday subah pata hota hai kya karna hai." | `MONDAY` |
| 7 | 20.5–22.5 | Week montage, all calm, no panic anywhere | "Poora hafta shaant nikal jata hai — sirf das minute ki wajah se." | `Das minute. Poora hafta.` |
| 8 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Har Sunday sham ko, das minute.

Chai leke baithta hoon, phone kholta hoon.

Agle hafte me kya hai — ek baar dekh leta hoon.

Do meeting. Ek bill. Beti ka function. Papa ka checkup.

Sab set kar deta hoon.

Monday subah pata hota hai kya karna hai.

Poora hafta shaant nikal jata hai — sirf das minute ki wajah se.

Apka Saathi.
```

### SCRIPT — EN
```
Every Sunday evening, ten minutes.

I sit down with a cup of chai and open my phone.

I look at what next week holds — just once.

Two meetings. One bill. My daughter's school function. Dad's check-up.

I set it all up.

Monday morning, I already know what the week is.

The whole week stays calm — because of ten minutes.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, warm tranquil Indian home at Sunday golden hour, slow camera, long
holds, 85mm shallow, soft amber light.
Shot 1: a 34-year-old Indian man in comfortable home clothes settling into a balcony
chair with a cup of chai, warm low sun, 5s.
Shot 2: close-up of his hands around the cup, phone resting on his knee, unhurried, 4s.
Shot 3: his face in the golden light, calm and content, looking down at the phone, 4s.
Shot 4: he sets the phone face-down on a side table and leans back, 4s.
Shot 5: Monday morning, the same man stepping out of his front door unhurried, bag on
shoulder, cool morning light, 4s.
Shot 6: wide of the empty balcony chair with the sun setting behind it, 4s.
No text, no graphics.
```

---
---

# VIDEO 53 — "Us Box Ka Aakhri Din"
**Angle:** **Paper ko izzat ke saath vidaai** | **Length:** 28s | **Voice:** V-NARRATOR (reverent)
**Target:** India + NRI 30–50. Emotional transformation.

> **Repetition guard:** V12 = Maa ki almari scan karna. V17 = Papa ki diary app me daalna.
> **V53 alag hai kyunki ye purane system ko izzat deta hai** — mazaak nahi udata. Steel box
> tees saal se ghar ka sabse zaroori kona tha. Wo hero hai, villain nahi. Ye emotional
> register poore set me pehli baar aa raha hai.

### MASTER PROMPT (HeyGen)
```
Create a 28-second vertical 9:16 reverent Indian transformation film, 1080x1920.

STORY: There was a steel box in the house. For thirty years it held everything — every
paper, every proof, every memory. Dad guarded it more carefully than himself. Today they
emptied it. Every paper scanned, every date moved into the app. The box is still in the
cupboard, empty now. Dad ran his hand over it and said, "let it rest now." The paper
changed. The responsibility didn't.

TONE — CRITICAL: The old system is treated with RESPECT, never as a joke. The steel box is
a character with dignity, not an outdated embarrassment. The film is a graceful handover,
not an upgrade pitch. This restraint is what makes it land.

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

[VIKRAM-01]
  Indian male, exactly 36 years old, broad rectangular face, wheatish skin, thick
  black hair combed back with a slightly receding hairline at the temples, heavy dark
  eyebrows, narrow dark eyes, a full but neatly trimmed black beard covering the jaw,
  a small horizontal scar on the left side of the chin under the beard, no glasses,
  solid medium-heavy build, height 5 feet 11 inches.
  Wardrobe: Well-fitted white or pale-grey shirt, sleeves rolled to the elbow, no
  tie, brown leather strap watch on the left wrist.

ROLES: PAPA-01 the father, quiet and dignified; VIKRAM-01 his son, careful and
reverent.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

SETTING: An Indian bedroom with a steel almirah, an old trunk or godrej box, string-tied
files, faded envelopes, a bedsheet spread out to sort on.

LOOK: Warm, textured, nostalgic. Heavy macro on paper grain, rust on the box hinge, old
handwriting, a rubber band that has gone brittle. Slow, quiet, unhurried. Beautiful.
VOICE: Hindi-Hinglish, male narrator, quiet and reverent, speed 0.90. Long pauses.
CAPTIONS: Poppins Bold white, highlight #C25A37. Minimal.
MUSIC: A single sustained piano note with a distant harmonium texture. Very sparse.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Macro: an old steel box in an almirah, rust on the hinge, dust | "Hamare ghar me ek steel ka box tha." | — |
| 2 | 4.5–10.0 | Lid opens. Files, envelopes, ribbons, an old photo slipped in among them | "Tees saal se usme sab kuch tha — sab kagaz, sab sabooot, sab yaadein." | `30 saal` |
| 3 | 10.0–13.0 | Father's hands resting protectively on the open box | "Papa use apni jaan se zyada sambhalte the." | — |
| 4 | 13.0–15.5 | Wide: bedsheet spread, everything laid out, both sitting | "Aaj usko khaali kiya." | — |
| 5 | 15.5–20.0 | **Screen recording:** paper after paper scanned, dates entered | "Har kagaz scan hua. Har date app me gayi." | `Scan → Save → Reminder` |
| 6 | 20.0–23.5 | The empty box back in the almirah, lid closed | "Box ab bhi almari me hai. Khaali hai." | — |
| 7 | 23.5–26.0 | Father's hand passes over the lid. Small pause. He smiles | "Papa ne haath phera aur bole — ab isko aaram karne do." | `"Ab isko aaram karne do."` |
| 8 | 26.0–26.5 | Two-shot, both looking at the almirah | "Kagaz badla. Zimmedari wahi rahi." | `Kagaz badla. Zimmedari wahi.` |
| 9 | 26.5–28.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Hamare ghar me ek steel ka box tha.

Tees saal se usme sab kuch tha — sab kagaz, sab sabooot, sab yaadein.

Papa use apni jaan se zyada sambhalte the.

Aaj usko khaali kiya.

Har kagaz scan hua. Har date app me gayi.

Box ab bhi almari me hai. Khaali hai.

Papa ne haath phera aur bole — ab isko aaram karne do.

Kagaz badla. Zimmedari wahi rahi.

Apka Saathi.
```
*(72 words ≈ 26s)*

### SCRIPT — EN
```
There was a steel box in our house.

For thirty years it held everything — every paper, every proof, every memory.

Dad guarded it more carefully than he guarded himself.

Today we emptied it.

Every paper scanned. Every date moved into the app.

The box is still in the cupboard. Empty now.

Dad ran his hand across the lid and said — "let it rest now."

The paper changed. The responsibility didn't.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 28s, warm textured nostalgic Indian bedroom, heavy macro work, soft
window light, very slow camera, 85mm and macro.
Shot 1: macro of an old steel storage box inside a Godrej almirah, rust on the hinge,
dust on the lid, 5s.
Shot 2: the lid opening to reveal string-tied files, faded envelopes and an old
photograph tucked among them, 5s.
Shot 3: an Indian father's weathered hands, 65, resting protectively on the open box, 4s.
Shot 4: wide of a bedsheet spread on a bed with all the documents laid out, father and
35-year-old son seated on either side, 5s.
Shot 5: macro of a hand smoothing a creased old document flat, paper grain visible, 4s.
Shot 6: the closed empty box back on the almirah shelf, soft light across it, 4s.
Shot 7: the father's hand passing slowly across the closed lid, then lifting away, 5s.
No text, no graphics.
```

---
---

# VIDEO 54 — "Chaar Notification"
**Angle:** **Anti-attention-economy** — app aapka waqt nahi khaati | **Length:** 25s | **Voice:** V-NARRATOR (relatable)
**Target:** India metro 25–45. **Ye har doosri app ke khilaf positioning hai.**

> **Repetition guard:** har app "zyada engagement" bechti hai. **V54 ulta bechta hai —
> kam.** Poore din me sirf chaar notification. Ye differentiator marketing me bahut
> powerful hai, aur 53 videos me kisi ne nahi bola. Iska tone bhi alag: koi emotion nahi,
> sirf ek observation.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 relatable Indian day-in-the-life reel, 1080x1920.

STORY: Yesterday, across the entire day, the app interrupted him exactly four times.
Morning — "take your medicine." Eleven — "call the client." Four — "pick up your daughter
from school." Night — "the bill is due tomorrow." Four notifications, that's it. He never
had to keep checking his phone. A good app doesn't take your time. It gives it back.

POSITIONING — CRITICAL: This film argues AGAINST attention-grabbing apps. The phone is
shown face-down, in a pocket, ignored for most of the film. The person is present in his
own life, not staring at a screen. Show the app being USEFUL by showing it being ABSENT.

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

[CHOTU-01]
  Indian boy, exactly 12 years old, round chubby face, medium-brown skin, short black
  hair cut neatly with a side parting, thick eyebrows, big dark eyes, a visible gap
  between the two upper front teeth, a small mole on the right cheek, no glasses,
  small slight build.
  Wardrobe: School uniform (white shirt, navy shorts), or a bright red t-shirt at
  home.

ROLES: RAHUL-01 through one full day, with PRIYA-01 his wife and CHOTU-01 their
child.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

SETTING: One full day — a bedroom, an office, a school gate, an evening living room.

LOOK: Natural, warm, unforced documentary realism. Handheld. The phone should be visually
minor in almost every frame — small, face-down, in a pocket. Only four moments in the
whole film feature the screen.
VOICE: Hindi-Hinglish, male narrator, plain and observational, speed 0.95.
CAPTIONS: Poppins Bold white, highlight #C25A37. Time stamps for each notification.
MUSIC: Light, unobtrusive, warm. Should almost disappear.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Day-long timelapse of a room, phone face-down on a table the whole time | "Kal poore din me app ne mujhe sirf chaar baar tokka." | `4 baar. Bas.` |
| 2 | 4.0–8.0 | Morning: notification, he takes his medicine, phone goes back down | "Subah — dawai le lo." | `8:00 AM 🔔` |
| 3 | 8.0–11.5 | Office: quick glance, he picks up the desk phone and calls | "Gyarah baje — client ko call karna hai." | `11:00 AM 🔔` |
| 4 | 11.5–15.5 | School gate: he's already there, daughter runs out | "Chaar baje — beti ko school se lena hai." | `4:00 PM 🔔` |
| 5 | 15.5–19.0 | Night: sofa, quick tap, bill paid, phone down again | "Raat — bill kal aakhri din hai." | `9:00 PM 🔔` |
| 6 | 19.0–21.0 | Family at dinner, phone nowhere in frame | "Chaar notification. Bas. Din bhar phone nahi dekhna pada." | — |
| 7 | 21.0–22.5 | Wide: him on the floor playing with his daughter | "Achhi app wo hoti hai jo aapka waqt le nahi — bachaye." | `Waqt le nahi — bachaye.` |
| 8 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Kal poore din me app ne mujhe sirf chaar baar tokka.

Subah — dawai le lo.

Gyarah baje — client ko call karna hai.

Chaar baje — beti ko school se lena hai.

Raat — bill kal aakhri din hai.

Chaar notification. Bas.

Din bhar phone nahi dekhna pada.

Achhi app wo hoti hai jo aapka waqt le nahi — bachaye.

Apka Saathi.
```

### SCRIPT — EN
```
Yesterday, across the whole day, the app interrupted me exactly four times.

Morning — "take your medicine."

Eleven — "call the client."

Four — "pick up your daughter from school."

Night — "the bill is due tomorrow."

Four notifications. That's it.

I never once had to keep checking my phone.

A good app doesn't take your time. It gives it back.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, natural warm documentary realism across one full day, handheld,
35mm. The phone must be visually minor in almost every frame.
Shot 1: a day-long timelapse of a living room with changing light, a phone lying
face-down on a table throughout, 4s.
Shot 2: morning bedroom, a 36-year-old Indian man taking a tablet with a glass of water,
soft light, 4s.
Shot 3: an office desk, the man mid-phone-call on a landline, relaxed, 3s.
Shot 4: a school gate in the afternoon, the man already waiting as his daughter runs out
towards him, warm daylight, 5s.
Shot 5: an evening living room, family at dinner together, no phone visible anywhere in
the frame, 5s.
Shot 6: the same man sitting on the floor playing with his daughter, phone nowhere in
sight, warm lamp light, 5s. No text, no graphics.
```

---
---

# VIDEO 55 — "Paanch App"
**Angle:** **App clutter → consolidation** | **Length:** 25s | **Voice:** V-NARRATOR (simple)
**Target:** India + global 25–45. Practical comparison.

> **Repetition guard:** V22 = ek document dhoondhna (phone ke andar).
> **V55 = poora system bikhra hua hona** — 5 apps, 5 jagah, kuch bhi juda nahi. Problem
> alag hai: dhoondhna nahi, **fragmentation.** Iska visual bhi alag: app icons, screens,
> switching — ghar nahi, log nahi.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 clean practical Indian comparison reel, 1080x1920.

STORY: Meetings in the calendar. Lists in Notes. Documents in Drive. Family things in
WhatsApp. Medicine timing in the alarm clock. Five apps, five places — and none of them
talk to each other. So something always fell through the gaps. Now there's one place:
everything, together, on one screen. Fewer apps, less confusion, less forgetting.

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

ROLES: RAHUL-01, mostly hands and a screen-lit face. The phone is the subject.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
RAHUL-01 in the final shot must be recognisably the SAME PERSON as RAHUL-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

FORMAT: This is primarily a screen-led film. The struggle is shown as app-switching — the
thumb swiping between five different apps, each holding one fragment of a life. The
resolution is one screen holding all five.

SETTING: Anywhere neutral — a desk, a sofa, a cafe.

LOOK: Clean, modern, slightly cool for the fragmented section, warming for the resolution.
Heavy over-the-shoulder and macro phone-screen work. Fast app-switching motion, then a
deliberate calm stillness at the end.
VOICE: Hindi-Hinglish, male narrator, plain and clear, speed 0.98.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: A slightly jittery, fragmented rhythm that resolves into a single clean tone.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | **Screen:** calendar app, then a hard switch to a notes app | "Meeting calendar me. List notes me." | `Calendar` `Notes` |
| 2 | 4.0–7.5 | **Screen:** a cloud drive folder, then a chat thread | "Documents Drive me. Family ki baatein WhatsApp me." | `Drive` `WhatsApp` |
| 3 | 7.5–10.0 | **Screen:** a clock app alarm labelled "dawai" | "Dawai ka time alarm me." | `Alarm` |
| 4 | 10.0–14.0 | Fast switching between all five, thumb moving faster and faster | "Paanch app. Paanch jagah. Aur koi ek doosre se juda nahi." | `5 apps. 5 jagah. 0 connection.` |
| 5 | 14.0–16.5 | The thumb stops. One item visibly slips between two screens | "Isliye kuch na kuch beech me gir jata tha." | — |
| 6 | 16.5–21.5 | **Screen recording:** one app, all five categories on one screen | "Ab ek hi jagah hai — sab kuch, ek saath, ek screen pe." | `1 app. 1 screen.` |
| 7 | 21.5–22.5 | Phone set down calmly, person leans back | "Kam apps. Kam confusion. Kam bhoolna." | `Kam apps. Kam bhoolna.` |
| 8 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Meeting calendar me. List notes me.

Documents Drive me. Family ki baatein WhatsApp me.

Dawai ka time alarm me.

Paanch app. Paanch jagah. Aur koi ek doosre se juda nahi.

Isliye kuch na kuch beech me gir jata tha.

Ab ek hi jagah hai — sab kuch, ek saath, ek screen pe.

Kam apps. Kam confusion. Kam bhoolna.

Apka Saathi.
```

### SCRIPT — EN
```
Meetings in the calendar. Lists in Notes.

Documents in Drive. Family things in WhatsApp.

Medicine timing in the alarm clock.

Five apps. Five places. And not one of them talks to the others.

So something always fell through the gaps.

Now there's one place — everything, together, on one screen.

Fewer apps. Less confusion. Less forgetting.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, clean modern neutral setting, cool grade warming at the end, heavy
over-the-shoulder and macro phone work, 50mm.
Shot 1: extreme macro of a thumb swiping rapidly between app screens, the motion
accelerating, 5s.
Shot 2: a 30-year-old Indian person's face lit only by a phone screen, eyes moving fast,
faint frustration, 4s.
Shot 3: the thumb stopping mid-swipe, hovering, 3s.
Shot 4: the same person setting the phone down on a table and leaning back, shoulders
dropping, warmer light, 6s.
Shot 5: a still wide of the person relaxed with the phone face-down beside them, 5s.
No text, no graphics, no UI mockups.
```

---
---

# VIDEO 56 — "Kal Ke Main Ko"
**Angle:** **Reminder = khud ko bheja gaya message** | **Length:** 25s | **Voice:** V-NARRATOR (warm)
**Target:** SAB. **Ye poore product ka sabse pyaara reframe hai.**

> **Repetition guard:** V48 = aage dekhna (visibility). V23 = taalna (procrastination).
> **V56 alag hai kyunki ye product ko hi redefine karta hai** — reminder ek alert nahi,
> **aaj ke aap se kal ke aap ko bheja gaya message** hai. Ye ek emotional reframe hai,
> feature nahi. Isliye ye video hamesha kaam karegi, feature badalne pe bhi.

### MASTER PROMPT (HeyGen)
```
Create a 25-second vertical 9:16 warm reflective Indian reel, 1080x1920.

CONCEPT: What is a reminder, really? It's today's you sending a message to tomorrow's
you. "Hey — the bill is due." "Call Dad." "The insurance date is here." Today's you
knows; tomorrow's you will forget. So today's you writes it down. Every reminder is a
small favour you do for yourself.

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

ROLES: KAVYA-01, the same person at night and in the morning.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
KAVYA-01 in the final shot must be recognisably the SAME PERSON as KAVYA-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

VISUAL IDEA — CRITICAL: Show the SAME actor as "today's me" and "tomorrow's me" in the
same frame where possible — one setting the reminder, one receiving it. Use a split
frame, a mirror, or a match-cut across a day. The audience should feel that the reminder
is a message between two versions of one person, not a robotic alert.

SETTING: One home, shown at two times of day — night (setting) and morning (receiving).

LOOK: Warm and intimate. Night side = soft lamp light, blue window. Morning side = golden
daylight. Same framing at both times so the audience reads them as a pair. Gentle camera.
VOICE: Hindi-Hinglish, warm male narrator, thoughtful and affectionate, speed 0.92.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: Soft warm piano with a light melodic motif. Gentle throughout.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–3.5 | Night, lamp light, they hold a phone, thinking | "Reminder banana kya hota hai?" | — |
| 2 | 3.5–8.0 | **Split frame:** night self on the left, morning self on the right, same chair | "Aaj ka main, kal ke main ko ek message bhej raha hai." | `Aaj ka main → Kal ka main` |
| 3 | 8.0–13.5 | **Screen recording:** three reminders typed, each read as a message | "Bhai, bill bharna hai. Papa ko phone karna hai. Insurance ki date aa gayi." | `"Bill bharna hai"` `"Papa ko phone"` `"Insurance"` |
| 4 | 13.5–17.0 | Night self sets the phone down. **Match-cut** to morning self picking it up | "Aaj ka main jaanta hai. Kal ka main bhool jayega." | — |
| 5 | 17.0–20.0 | Morning: notification arrives, they smile faintly at it | "Isliye aaj hi likh deta hoon." | `🔔 Bill bharna hai` |
| 6 | 20.0–22.5 | Morning self does the task, easy, unhurried | "Har reminder khud ke liye ek chhota sa ehsaan hai." | `Khud ke liye ek chhota ehsaan` |
| 7 | 22.5–25.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Reminder banana kya hota hai?

Aaj ka main, kal ke main ko ek message bhej raha hai.

Bhai, bill bharna hai.

Papa ko phone karna hai.

Insurance ki date aa gayi.

Aaj ka main jaanta hai. Kal ka main bhool jayega.

Isliye aaj hi likh deta hoon.

Har reminder khud ke liye ek chhota sa ehsaan hai.

Apka Saathi.
```

### SCRIPT — EN
```
What is a reminder, really?

It's today's me sending a message to tomorrow's me.

"Hey — the bill is due."

"Call Dad."

"The insurance date is here."

Today's me knows. Tomorrow's me will forget.

So today's me writes it down.

Every reminder is a small favour you do for yourself.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 25s, warm intimate home interior shown at two times of day with identical
framing, 50mm shallow.
NIGHT LOOK: soft lamp light, cool blue window behind.
MORNING LOOK: warm golden daylight through the same window.
Shot 1: a 30-year-old Indian person sitting in an armchair at night, lamp beside them,
phone in hand, thoughtful, 5s.
Shot 2: identical framing, same chair, same person, now in warm morning light with a cup
of tea, 5s.
Shot 3: close-up of hands setting a phone face-down on a side table at night, 4s.
Shot 4: match-cut — the same hands picking up the same phone from the same table in
morning light, 4s.
Shot 5: their face reading the screen and breaking into a small private smile, warm
daylight, 5s.
Shot 6: they set the phone down and get on with the morning, unhurried, 5s.
No text, no graphics.
```

---
---

# VIDEO 57 — "Ek Umar Aati Hai"
**Angle:** **Role reversal** — jab aap apne maa-baap ke maa-baap ban jaate ho | **Length:** 30s | **Voice:** V-NARRATOR (deep, tender)
**Target:** India + NRI 30–50. **Poore set ka sabse gehra emotional beat.**

> **Repetition guard:** V07/V12/V17/V24/V34 sab parents ke saath the — par sab **kaam** ke
> baare me the (dawai, documents, diary, sharing). **V57 kaam ke baare me nahi hai — us
> shift ke baare me hai** jab zimmedari palat jaati hai. Ye emotional beat 56 videos me
> ek baar bhi nahi aaya.
>
> ⚠️ **Tone:** ye video **udaas nahi honi chahiye.** Parents budhe/laachaar nahi dikhne
> chahiye. Ye pyaar aur garv ka moment hai, taras ka nahi. Papa-Maa active, healthy,
> dignified — bas ab beta unke liye track kar raha hai.

### MASTER PROMPT (HeyGen)
```
Create a 30-second vertical 9:16 deeply emotional but dignified Indian family film,
1080x1920.

CONCEPT: There comes an age when everything reverses. The ones who held your finger while
you learnt to walk — now you hold their hand. The ones who remembered every date of yours
— now you remember theirs. Dad's check-up. Mom's medicine. Both their insurances. Nobody
teaches you this; one day the responsibility is simply there. Now it all lives in Apka
Saathi, under their names. They raised us. Now it's our turn.

TONE — CRITICAL: This is about LOVE and duty, not decline. The parents must read as
active, healthy and dignified — walking, laughing, capable. They are not helpless and the
film must never invite pity. The emotion is the son's quiet realisation, not the parents'
frailty. If the parents look frail, the film has failed.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[VIKRAM-01]
  Indian male, exactly 36 years old, broad rectangular face, wheatish skin, thick
  black hair combed back with a slightly receding hairline at the temples, heavy dark
  eyebrows, narrow dark eyes, a full but neatly trimmed black beard covering the jaw,
  a small horizontal scar on the left side of the chin under the beard, no glasses,
  solid medium-heavy build, height 5 feet 11 inches.
  Wardrobe: Well-fitted white or pale-grey shirt, sleeves rolled to the elbow, no
  tie, brown leather strap watch on the left wrist.

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

ROLES: VIKRAM-01 the son; PAPA-01 and MAA-01 his parents, sprightly and independent.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

SETTING: A family home and a short walk outside — a park path, a morning street.

LOOK: Warm, golden, dignified. Use one deliberate visual rhyme: a shot of a child's hand
in an adult's hand, echoed later by an adult's hand in an older adult's hand. That single
rhyme carries the whole idea without a word.
VOICE: Hindi-Hinglish, deep warm male narrator, tender and steady, speed 0.90. Long pauses.
CAPTIONS: Poppins Bold white, highlight #C25A37. Minimal.
MUSIC: Solo piano with strings entering at "kisi ne sikhaya nahi". Warm, never mournful.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.5 | Wide, morning, three of them walking a park path together | "Ek umar aati hai jab sab palat jata hai." | — |
| 2 | 4.5–11.0 | **Visual rhyme:** child's hand in a father's hand → cut → son's hand supporting father's | "Jo aapko ungli pakad ke chalate the — ab aap unka haath pakadte ho." | — |
| 3 | 11.0–16.0 | Old photo of the father writing in a diary → cut → son typing on a phone | "Jo aapki har date yaad rakhte the — ab aap unki rakhte ho." | — |
| 4 | 16.0–20.5 | **Screen recording:** reminders tagged under "Papa" and "Maa" | "Papa ka checkup. Maa ki dawai. Dono ka insurance." | `Papa` `Maa` |
| 5 | 20.5–24.0 | Son alone for a beat, looking at his parents laughing ahead of him | "Kisi ne sikhaya nahi. Bas ek din zimmedari aa gayi." | `Kisi ne sikhaya nahi.` |
| 6 | 24.0–26.5 | **Screen:** their names on the reminder list | "Ab sab Apka Saathi me hai — unke naam se." | — |
| 7 | 26.5–27.5 | All three together again, warm, laughing | "Unhone humein bada kiya. Ab hamari baari hai." | `Ab hamari baari hai.` |
| 8 | 27.5–30.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Ek umar aati hai jab sab palat jata hai.

Jo aapko ungli pakad ke chalate the — ab aap unka haath pakadte ho.

Jo aapki har date yaad rakhte the — ab aap unki rakhte ho.

Papa ka checkup. Maa ki dawai. Dono ka insurance.

Kisi ne sikhaya nahi. Bas ek din zimmedari aa gayi.

Ab sab Apka Saathi me hai — unke naam se.

Unhone humein bada kiya. Ab hamari baari hai.

Apka Saathi.
```
*(68 words ≈ 27s @ 0.90 speed)*

### SCRIPT — EN
```
There comes an age when everything reverses.

The ones who held your finger while you learnt to walk — now you hold their hand.

The ones who remembered every date of yours — now you remember theirs.

Dad's check-up. Mom's medicine. Both their insurances.

Nobody teaches you this. One day the responsibility is simply there.

Now it all lives in Apka Saathi — under their names.

They raised us. Now it's our turn.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 30s, warm dignified Indian family film, golden morning light, 85mm
shallow, slow deliberate camera.
IMPORTANT: the elderly parents must appear active, healthy and independent — walking
easily, laughing, capable. No frailty, no pity.
Shot 1: wide of an Indian father 66, mother 62 and son 36 walking together along a park
path in morning light, all three at an easy pace, 5s.
Shot 2: archival-style shot — a small child's hand held inside an adult man's hand,
warm nostalgic grain, 3s.
Shot 3: present day — the 36-year-old son's hand steadying his father's arm on a step,
same composition as the previous shot, 4s.
Shot 4: an old photograph of a man writing in a diary at a desk, 3s.
Shot 5: present day — the son at a table typing on a phone, same composition, 3s.
Shot 6: the son standing still for a moment watching his parents walking and laughing
ahead of him, slight distance between them, 5s.
Shot 7: all three together on a bench, warm light, genuine laughter, 6s.
No text, no graphics.
```

---
---

# VIDEO 58 — "Hum Aise Hi Chalte Hain"
**Angle:** **Gen-Z self-portrait** — AI claim nahi | **Length:** 22s | **Voice:** V-YOUNG (energetic)
**Target:** India 20–28.

> ⚠️ **Ye chautha AI video NAHI hai.** AI trilogy (V19 speed / V42 natural bhasha /
> V44 hands-free) locked hai — chautha claim add karoge to teeno kamzor ho jayenge.
> **V58 ka claim alag hai: zero learning curve.** Ye generation manual nahi padhti.
> "Kholo — samajh aa gaya." Ye onboarding-simplicity ka argument hai, AI ka nahi.

### MASTER PROMPT (HeyGen)
```
Create a 22-second vertical 9:16 energetic Indian Gen-Z reel, 1080x1920.

STORY: Fifteen tabs open. Six chats running. Three deadlines overhead. And somehow we're
still functioning. We don't need a tutorial, we don't need a manual — open it and you get
it, say it and it's made. If something takes more than two seconds, we don't use it. This
takes two seconds.

CLAIM — IMPORTANT: This film is about ZERO LEARNING CURVE, not about AI. Do not turn it
into another voice-assistant demo. The argument is: this generation will not read
instructions, and they don't have to.

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

ROLES: AMAN-01, confident and slightly wry.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
AMAN-01 in the final shot must be recognisably the SAME PERSON as AMAN-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

SETTING: A hostel room, a co-working corner, a cafe table. Cluttered but alive.

LOOK: Bright, saturated, contemporary. Fast cuts but not frantic. Screen-heavy — show real
tab clutter and chat notifications. Then a hard tonal drop to calm and clean for the app
section. That contrast is the pitch.
VOICE: Hindi-Hinglish, young, energetic and confident, speed 1.05.
CAPTIONS: Poppins Bold white, highlight #C25A37, punchy.
MUSIC: Modern lo-fi beat with a light drop at "do second".
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Laptop screen: 15 tabs crammed into the bar, 6 chat badges | "Pandrah tab khule hain. Chhe chat chal rahi hain." | `15 tabs` `6 chats` |
| 2 | 4.0–6.5 | Three deadline notifications stacking up | "Teen deadline sar pe hain." | `3 deadlines` |
| 3 | 6.5–9.0 | They lean back, earphones in, entirely unbothered | "Aur phir bhi hum chal rahe hain." | `Aur phir bhi — chal rahe hain` |
| 4 | 9.0–12.5 | Quick cut: a thick manual tossed aside, a "skip tutorial" tap | "Humein tutorial nahi chahiye. Manual nahi chahiye." | `Skip →` |
| 5 | 12.5–16.5 | **Screen recording:** app opens, first reminder made without any guidance | "Kholo — samajh aa gaya. Bolo — ban gaya." | `Kholo. Samajh aa gaya.` |
| 6 | 16.5–19.0 | They shrug at the camera | "Jo cheez do second se zyada leti hai, hum use use nahi karte." | `>2 sec = delete` |
| 7 | 19.0–19.5 | Beat | "Ye app do second leti hai." | `2 sec ✅` |
| 8 | 19.5–22.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI (V-YOUNG)
```
Pandrah tab khule hain. Chhe chat chal rahi hain.

Teen deadline sar pe hain.

Aur phir bhi hum chal rahe hain.

Humein tutorial nahi chahiye. Manual nahi chahiye.

Kholo — samajh aa gaya. Bolo — ban gaya.

Jo cheez do second se zyada leti hai, hum use use nahi karte.

Ye app do second leti hai.

Apka Saathi.
```
*(57 words ≈ 19s @ 1.05 speed)*

### SCRIPT — EN
```
Fifteen tabs open. Six chats running.

Three deadlines overhead.

And somehow, we're still functioning.

We don't need a tutorial. We don't need a manual.

Open it — you get it. Say it — it's made.

If something takes more than two seconds, we don't use it.

This takes two seconds.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 22s, bright saturated contemporary Indian youth space, fast but controlled
cutting, handheld, 35mm.
Shot 1: over-the-shoulder of a laptop screen crammed with browser tabs and chat
notifications, sticker-covered lid, 4s.
Shot 2: a 23-year-old Indian person in a hoodie leaning back in a chair with earphones
in, completely unbothered by the chaos on screen, 4s.
Shot 3: a thick printed manual being tossed onto a table, 2s.
Shot 4: close-up of a thumb making a couple of quick confident taps on a phone, 4s.
Shot 5: the same person shrugging directly at the camera with a wry confident expression,
4s.
Shot 6: them putting the phone away and going back to the laptop, unhurried, 4s.
No text, no graphics, no UI mockups.
```

---
---

# VIDEO 59 — "Kuch Nahi Hua"
**Angle:** **Anti-drama** — bachao itna jaldi aaya ki drama hua hi nahi | **Length:** 28s | **Voice:** V-NARRATOR (steady)
**Target:** India professionals 28–45.

> **Repetition guard:** V39 = **race against time** (do ghante bache the, cab, 6:55 pe form).
> **V59 uska ulta hai** — koi race hi nahi hui. Reminder itna pehle aaya ki drama ka
> mauka hi nahi mila. **"Kuch nahi hua. Aur wahi sabse badi baat hai."**
> Ye ek advanced idea hai: achha system wo hai jiska **pata hi na chale.**
> Stakes bhi alag hain — V39 personal tha (bete ka admission), V59 professional hai (tender).

### MASTER PROMPT (HeyGen)
```
Create a 28-second vertical 9:16 calm, understated Indian professional reel, 1080x1920.

STORY: Last month there was a tender deadline. He didn't remember it. But a reminder came
twenty days early. Then seven days. Then one. He filed it calmly — no rush, no panic.
Nothing happened. No drama, no running around, no apologies to make. And that is the
entire point. A good system is one you never notice.

TONE — CRITICAL: This film deliberately has NO tension arc. Nothing goes wrong, nothing is
nearly lost, nobody runs. It is the anti-drama film of the series, and the flatness is the
message. Resist every instinct to add jeopardy — jeopardy would destroy the point.

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

[VIKRAM-01]
  Indian male, exactly 36 years old, broad rectangular face, wheatish skin, thick
  black hair combed back with a slightly receding hairline at the temples, heavy dark
  eyebrows, narrow dark eyes, a full but neatly trimmed black beard covering the jaw,
  a small horizontal scar on the left side of the chin under the beard, no glasses,
  solid medium-heavy build, height 5 feet 11 inches.
  Wardrobe: Well-fitted white or pale-grey shirt, sleeves rolled to the elbow, no
  tie, brown leather strap watch on the left wrist.

ROLES: VIKRAM-01, composed throughout — the steadiness is the performance.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
VIKRAM-01 in the final shot must be recognisably the SAME PERSON as VIKRAM-01 in the
first shot — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
description above before generating each new shot.

SETTING: An office, a document counter, a home evening.

LOOK: Even, neutral, uneventful. Steady tripod camera, balanced compositions, consistent
lighting from start to finish — no grade shift, no build. Visually calm on purpose.
VOICE: Hindi-Hinglish, male narrator, level and matter-of-fact, speed 0.95.
CAPTIONS: Poppins Bold white, highlight #C25A37.
MUSIC: A single steady low tone throughout. No build, no resolve, no swell.
END CARD: standard Apka Saathi card.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Office desk, a tender document among many papers | "Pichle mahine ek tender ki last date thi." | — |
| 2 | 4.0–6.5 | Him working on something else entirely, unaware | "Mujhe yaad nahi tha." | `Mujhe yaad nahi tha.` |
| 3 | 6.5–13.0 | **Screen recording:** three reminders, 20 / 7 / 1 days out, calmly stacking | "Par bees din pehle reminder aaya. Phir saat din pehle. Phir ek din pehle." | `20 din` `7 din` `1 din` |
| 4 | 13.0–17.5 | Counter, he hands over the file, no hurry, no clock in frame | "Maine aaram se file kiya. Bina jaldi ke. Bina tension ke." | — |
| 5 | 17.5–20.0 | He walks out, ordinary day, nothing remarkable | "Kuch nahi hua." | `Kuch nahi hua.` |
| 6 | 20.0–24.0 | Evening at home, dinner, completely normal | "Koi drama nahi. Koi bhaag-daud nahi. Koi maafi nahi maangni padi." | `Koi drama nahi.` |
| 7 | 24.0–25.5 | Close on him, unchanged expression | "Aur wahi sabse badi baat hai. Achha system wo hai jiska pata hi na chale." | `Achha system — jiska pata hi na chale` |
| 8 | 25.5–28.0 | **END CARD** | "Apka Saathi." | Locked end-card |

### SCRIPT — HI
```
Pichle mahine ek tender ki last date thi.

Mujhe yaad nahi tha.

Par bees din pehle reminder aaya. Phir saat din pehle. Phir ek din pehle.

Maine aaram se file kiya. Bina jaldi ke. Bina tension ke.

Kuch nahi hua.

Koi drama nahi. Koi bhaag-daud nahi. Koi maafi nahi maangni padi.

Aur wahi sabse badi baat hai.

Achha system wo hai jiska pata hi na chale.

Apka Saathi.
```
*(72 words ≈ 26s)*

### SCRIPT — EN
```
Last month there was a tender deadline.

I didn't remember it.

But a reminder came twenty days early. Then seven. Then one.

I filed it calmly. No rush. No panic.

Nothing happened.

No drama. No running around. No apologies to make.

And that is the entire point.

A good system is one you never notice.

Apka Saathi.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 28s, even neutral lighting held constant throughout, locked tripod,
balanced symmetrical compositions, 35mm. Deliberately uneventful.
Shot 1: an office desk with a tender document among ordinary paperwork, flat even light,
4s.
Shot 2: a 38-year-old Indian professional working calmly on something unrelated,
composed, 4s.
Shot 3: a document submission counter, a file being handed across without hurry, no
clocks visible anywhere in frame, 5s.
Shot 4: the same man walking out of a building at an ordinary pace, ordinary daylight, 5s.
Shot 5: an evening dinner table at home, completely normal family evening, 5s.
Shot 6: close-up of the man's face, calm and entirely unchanged from the first shot, 5s.
No dramatic angles, no tension, no text, no graphics.
```

---
---

# VIDEO 60 — "Kaun Yaad Rakhta Hai?"
**Angle:** **Brand film #6** — aapke liye kaun yaad rakhega? | **Length:** 30s | **Voice:** V-NARRATOR (deepest)
**Target:** SAB. **Poore 60 videos ka sabse achha closing statement.**

> **Repetition guard — chhah brand films, chhah alag spine:**
> **V10** problem manifesto · **V20** day-in-life · **V30** naam ka matlab ·
> **V36** tareekhon ki poetry · **V50** launch elaan · **V60** = **"aapke liye kaun?"**
>
> V60 ka insight sabse gehra hai: zindagi bhar koi na koi aapke liye yaad rakhta raha —
> Maa, teacher, dost. Phir aap bade ho gaye aur ab **aap sabke liye** yaad rakhte ho.
> Par aapke liye kaun? **Brand ka jawab yahi hai.** Ye V30 ("saathi ka matlab") ka
> emotional partner hai — dono ko kabhi ek hafte me mat post karna.

### MASTER PROMPT (HeyGen)
```
Create a 30-second vertical 9:16 premium emotional Indian brand film, 1080x1920.

CONCEPT: As a child, your mother remembered — the tiffin, the homework, the sweater. At
school, a teacher remembered — your name, your weakest subject. In college, a friend
remembered — your birthday, the exam, the time for chai. All your life, someone remembered
for you. Then one day you grew up. Now you are the one who remembers for everyone. But who
remembers for you?

CAST — LOCKED IDENTITIES. Generate exactly these people, from these exact
descriptions. Do NOT reinterpret, restyle, re-age or beautify them, and do NOT
invent a new face when the scene, location, outfit or lighting changes. If a
reference image is attached for a character, that image overrides this text.

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

[KAVYA-01]
  Indian woman, exactly 32 years old, long face with a strong jaw, wheatish skin,
  dark brown hair tied back into a neat low ponytail with a centre parting, defined
  straight eyebrows, sharp dark eyes, high cheekbones, a small scar on the left side
  of the upper lip, thin black-framed rectangular glasses always worn, medium build,
  height 5 feet 5 inches.
  Wardrobe: Charcoal or navy blazer over a plain shirt, minimal steel wristwatch on
  the left wrist.

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

ROLES: MAA-01 with CHOTU-01 her child, KAVYA-01 the schoolteacher, AMAN-01 with a
college friend, then RAHUL-01 the adult carrying it all alone.

SHOT-TO-SHOT CONSISTENCY — the single most important rule in this prompt:
Every character above must be recognisably the SAME PERSON in the final shot as in
the first — same face, same hair, same distinguishing marks — even if the location,
outfit, time of day or lighting changes completely in between. Re-read the identity
descriptions above before generating each new shot. Where two of them share a frame,
keep them clearly distinct people and never blend their features into each other.

STRUCTURE: Three warm nostalgic vignettes (mother, teacher, friend), then a turn into the
present where the adult is the one carrying everyone. Then the question, held in silence.
Then the brand as the answer.

LOOK: The three memories are warm, soft, slightly hazy and grainy — memory texture. The
present-day section is sharper, cooler, quieter, and noticeably emptier in the frame:
the adult has more space around him and fewer people in it. That emptiness is the argument.
Then a final warm resolve.
VOICE: Hindi-Hinglish, deepest warmest male narrator, unhurried, speed 0.88. A full
1.5-second silence before "Par aapke liye kaun yaad rakhega?"
CAPTIONS: Poppins Bold white, highlight #C25A37. Very minimal.
MUSIC: Solo piano across the memories, strings entering at the turn, complete silence for
the question, full warm resolve at the logo.
END CARD: standard Apka Saathi card; narrator speaks the tagline aloud on this one.

NEGATIVE — avoid entirely: a different person between shots, face swap, changed facial
features, inconsistent identity, drifting age, different hairline, glasses appearing or
disappearing, changed beard style, beautified or plastic skin, western features, two
characters blended into one, extra fingers, distorted hands, text, watermark, logo.
```

### SCENE TABLE
| # | Time | Visual | VO line | On-screen text |
|---|---|---|---|---|
| 1 | 0.0–6.0 | **Memory grade:** mother packing a tiffin, straightening a sweater on a small child | "Bachpan me Maa yaad rakhti thi — tiffin, homework, sweater." | — |
| 2 | 6.0–11.0 | **Memory grade:** a classroom, teacher calling a name from a register | "School me teacher yaad rakhti thi — aapka naam, aapki kamzori." | — |
| 3 | 11.0–16.0 | **Memory grade:** two friends at a tea stall, one handing over a wrapped gift | "College me dost yaad rakhta tha — birthday, exam, chai ka waqt." | — |
| 4 | 16.0–19.5 | All three memories dissolving together, warm | "Zindagi bhar koi na koi aapke liye yaad rakhta raha." | — |
| 5 | 19.5–22.0 | **Grade shifts.** Present day, adult alone in a wide empty frame | "Phir ek din aap bade ho gaye." | — |
| 6 | 22.0–25.0 | Him juggling everyone's needs — parents, child, work, all around him | "Ab aap sabke liye yaad rakhte ho." | `Ab aap sabke liye.` |
| 7 | 25.0–27.5 | **1.5s silence.** He stands still. Camera holds | "Par aapke liye kaun yaad rakhega?" | `Par aapke liye kaun?` |
| 8 | 27.5–30.0 | **END CARD** — warm resolve | "Apka Saathi. Never Forget What Matters." | Locked end-card |

### SCRIPT — HI
```
Bachpan me Maa yaad rakhti thi — tiffin, homework, sweater.

School me teacher yaad rakhti thi — aapka naam, aapki kamzori.

College me dost yaad rakhta tha — birthday, exam, chai ka waqt.

Zindagi bhar koi na koi aapke liye yaad rakhta raha.

Phir ek din aap bade ho gaye.

Ab aap sabke liye yaad rakhte ho.

Par aapke liye kaun yaad rakhega?

Apka Saathi.

Never Forget What Matters.
```
*(72 words ≈ 28s @ 0.88 speed)*

### SCRIPT — EN
```
As a child, Mom remembered — the tiffin, the homework, the sweater.

At school, a teacher remembered — your name, your weakest subject.

In college, a friend remembered — your birthday, the exam, the time for chai.

All your life, someone remembered for you.

Then one day you grew up.

Now you're the one who remembers for everyone.

But who remembers for you?

Apka Saathi.

Never Forget What Matters.
```

### CINEMATIC PROMPT
```
Cinematic 9:16, 30s, premium emotional brand film, two distinct visual worlds.
MEMORY LOOK: warm, soft, slightly hazy, visible film grain, gentle over-exposure, 85mm.
PRESENT LOOK: sharper, cooler, quieter, wider framing with noticeably more empty space
around the subject.
Shot 1 (memory): an Indian mother packing a steel tiffin box and straightening a sweater
on a small child at a doorway, warm morning light, 6s.
Shot 2 (memory): a school classroom, a teacher reading names from a register, rows of
children, dusty sunlight through windows, 5s.
Shot 3 (memory): two college friends at a roadside tea stall, one handing the other a
clumsily wrapped gift, golden hour, 5s.
Shot 4 (present): a 34-year-old Indian man standing alone in a wide, sparsely furnished
room, significant empty space around him, cooler light, 4s.
Shot 5 (present): the same man in a series of quick beats caring for others — handing
medicine to a parent, packing a child's bag, taking a work call, 5s.
Shot 6 (present): the man standing completely still, alone, camera holding on him without
moving, 5s. No text, no graphics.
```

---
---

## Batch notes (51–60)

### 🛑 Video 51 — sabse pehle ye settle karo
Ye batch ka sabse zaroori video hai **aur** sabse risky. Privacy claim ek **legal claim**
hai. Banane se pehle app me verify karo:

- [ ] Documents at-rest encrypted hain?
- [ ] Admin panel se koi user ka document dikhta to nahi?
- [ ] Third party (analytics, AI provider) ko koi document data jaata to nahi?
- [ ] "Delete all data" button hai aur sach me kaam karta hai?

Jo point sach nahi hai **use script se hata do** — video baaki lines pe bhi chalegi.
Jhoothi privacy claim Play Store listing hata sakti hai aur DPDP Act ke tehat problem
kar sakti hai. Ye ek marketing decision nahi hai, compliance decision hai.

### Naye positioning arguments (pehli baar)
| Argument | Video | Kyun powerful |
|---|---|---|
| **Privacy / trust** | 51 | Sabse bada objection. Iske bina baaki 89 videos ka install-rate dabta hai |
| **Kam notification** | 54 | Har app "zyada engagement" bechti hai — hum **kam** bech rahe hain |
| **Zero learning curve** | 58 | Youth manual nahi padhti. "Kholo — samajh aa gaya" |
| **Anti-drama** | 59 | Achha system wo hai jiska **pata hi na chale** |
| **Reminder = khud ko message** | 56 | Product ka emotional redefinition — feature badle to bhi ye video chalti rahegi |
| **Role reversal** | 57 | Set ka sabse gehra emotional beat |

### Time-horizon confusion mat karo
Teen videos "planning" ke baare me hain par teeno ka horizon alag hai — editing me
inhe alag rakho:
- **V33** = saal me **ek baar**, 5 minute ka setup
- **V52** = har **hafte**, Sunday sham, 10 minute
- **V48** = agle **teen mahine** ka view

### Naye screen recordings chahiye
- [ ] **Encryption indicator** on a stored document (V51)
- [ ] **Settings → Delete all data → confirm → empty state** (V51) — ye sach me record karo
- [ ] Next-week view (V52)
- [ ] Reminders tagged under parent names — "Papa", "Maa" (V57)
- [ ] 20 / 7 / 1 day multi-stage reminders stacking calmly (V59)
- [ ] First reminder created **bina kisi guidance ke**, ek take me (V58)

### ⚠️ V57 aur V60 — do tone warnings
**V57:** parents **budhe/laachaar nahi** dikhne chahiye. Wo chalte hain, haste hain,
independent hain. Emotion bete ka ehsaas hai, parents ki kamzori nahi. Agar parents frail
lage to video taras maangne lagegi — aur wo backfire karti hai.

**V60:** ye **V30 ka emotional partner** hai. V30 poochta hai "saathi ka matlab kya hai",
V60 poochta hai "aapka saathi kaun hai". Dono ek hi hafte me mat post karna — impact
baant jayega.

### Updated posting order (01–60)
```
Pinned  : 60  ← 30 se badla. V60 sabse strong brand statement hai
Week 1  : 27 → 14 → 51 → 01 → 22      ← 51 jaldi: trust pehle, warna install nahi hoga
Week 2  : 05 → 34 → 07 → 47 → 26
Week 3  : 21 → 39 → 46 → 33 → 19
Week 4  : 57 → 31 → 28 → 06 → 35      ← 57 (role reversal) week 4 ka anchor
Week 5  : 32 → 49 → 38 → 56 → 11
Week 6  : 13 → 42 → 53 → 43 → 52
Week 7  : 54 → 44 → 08 → 48 → 55
Week 8  : 30 → 12 → 59 → 58 → 41      ← 30 aur 60 ke beech 7 hafte ka gap
Week 9  : 18 → 03 → 09 → 02 → 40
Paid    : 50 (launch), 51 (trust — retargeting), 20, 25, 29, 45 (App Store)
Festive : 36 (Diwali / New Year), 37 (milestone), 60 (Mother's/Father's Day)
```
**Sabse bada badlav — `51` week 1 me aa gaya.** Logic seedha hai: agar log documents app
me daalne se darte hain, to baaki 89 emotional videos kitni bhi achhi hon, install ke
baad **upload nahi hoga** — aur bina upload ke app dead hai. Trust pehle, kahani baad me.
