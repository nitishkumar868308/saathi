# CAST ROSTER — 12 locked characters, 90 videos

**LOCAL ONLY.** Kahin publish mat karna.

Pehle `00-GLOBAL-SPEC.md` → **§5A CHARACTER LOCK** padho.

---

## Kyun sirf 12?

Pehle har video apna naya character invent karta tha — 36 alag umar/look (30, 25, 35, 40,
20, 55, 62, 28, 32, 33, 34, 36, 38, 42, 44, 45, 24, 27, 29, 31, 66, 68, 65, 63, 75, 52,
48, 12, 16, 17, 19, 22, 60, 58, 54, 50…). Do nuksaan the:

1. **Credits jal rahe the** — har video me naye faces generate ho rahe the
2. **Series nahi ban rahi thi** — 90 alag-alag ads lag rahe the, ek brand nahi

Ab 12 characters hain. **Hero still ek baar banao → 90 videos me reuse.**
Generation cost 90 videos ka nahi, sirf 12 stills ka hai.

Ye 12 ek hi duniya ke log hain — ek parivaar aur uske aas-paas. Isliye jab
audience 5-6 reels dekhega, wo **pehchan** jayega. Yahi brand recall hai.

---

## Roster

Counts asli hain — 90 prompts se ginke nikale gaye hain.

| ID | Kaun | Umar | Kis tarah ke videos me | Videos |
|---|---|---|---|---|
| `RAHUL-01` | Main lead, office professional | 30 | Har "male 27-34" role | **59** |
| `PAPA-01` | Rahul ke papa | 62 | Har "father 58-68" role | **21** |
| `MAA-01` | Rahul ki maa | 55 | Har "mother 48-58" role | **20** |
| `AMAN-01` | Chhota bhai, student | 21 | Har "student / male 20-25" role | **16** |
| `VIKRAM-01` | Business owner / senior colleague | 36 | Har "male 35-40" role | **14** |
| `RAVI-01` | Tier-2 dukaandaar / bada father | 45 | Har "male 42-55" role | **10** |
| `PRIYA-01` | Rahul ki wife | 29 | Couple / ghar ke videos | **9** |
| `KAVYA-01` | Senior professional woman | 32 | Har "female 30-34" role | **9** |
| `NEHA-01` | Young working woman | 26 | Har "female 25-28" role | **5** |
| `CHOTU-01` | Bachcha | 12 | Child roles | **4** |
| `ANJALI-01` | Beti / school student | 17 | Har "16-19" role | **3** |
| `DADI-01` | Dadi | 74 | Grandmother role | **1** |

**Rishta map** (stories likhte waqt kaam aayega):
PAPA-01 + MAA-01 → RAHUL-01 (bada beta) aur AMAN-01 (chhota beta).
RAHUL-01 + PRIYA-01 → CHOTU-01. DADI-01 = PAPA-01 ki maa.
RAVI-01 = ANJALI-01 ke papa. VIKRAM-01, NEHA-01, KAVYA-01 = Rahul ke colleagues/dost.

---

## Locked identity strings

Ye jaan-boojh ke **hyper-specific** hain. Kapde nahi — **chehre ki geometry aur
distinctive marks** lock karte hain. Mole/scar/gap jaise nishaan AI ko sabse strong
anchor dete hain, kyunki wo "average face" se hat ke hote hain.

**Ek shabd mat badalna.** Ye strings har video ke MASTER PROMPT me already paste hain.

### `RAHUL-01` — male, 30 — main lead
```
Indian male, exactly 30 years old, oval face with a defined jawline, medium-brown
skin (Fitzpatrick IV), short black side-parted hair with a slight natural wave at
the front, thick straight eyebrows, dark brown almond-shaped eyes with mild under-eye
shadows, straight medium-width nose, close-trimmed 3-day stubble beard connected to
a thin moustache, a small dark mole on the left cheekbone below the eye, no glasses,
lean build, height 5 feet 9 inches.
```
**Wardrobe:** Light blue formal shirt, sleeves folded twice to the forearm, dark grey
trousers, black office ID lanyard. *Ghar pe:* plain charcoal t-shirt, same face.

### `PRIYA-01` — female, 29 — Rahul ki wife
```
Indian woman, exactly 29 years old, heart-shaped face, fair-wheatish skin, shoulder-
length straight dark-brown hair worn loose with a side parting, arched thin eyebrows,
large dark eyes with long lashes, small pointed chin, a faint dimple on the right
cheek when she smiles, small silver stud earrings only, no bindi, no other jewellery,
slim build, height 5 feet 4 inches.
```
**Wardrobe:** Plain cotton kurti in mustard or rust, churidar, thin silver bangle on
the left wrist.

### `PAPA-01` — male, 62 — father
```
Indian male, exactly 62 years old, square face with prominent cheekbones, wheatish
skin, full silver-grey hair combed straight back from a high forehead, thick black
rectangular-framed glasses, bushy grey eyebrows, deep-set warm brown eyes with heavy
crow's feet, prominent nasolabial folds, clean-shaven cheeks with a neat trimmed grey
moustache, a small vertical scar above the right eyebrow, slight forward stoop,
medium build.
```
**Wardrobe:** Cream cotton kurta, brown leather sandals. *Sardi me:* brown shawl over
the shoulder.

### `MAA-01` — female, 55 — mother
```
Indian woman, exactly 55 years old, round face with soft full cheeks, wheatish skin,
black hair with visible grey at the temples pulled back into a low bun with a centre
parting, small maroon round bindi, thin gold hoop earrings, soft double-lidded brown
eyes, deep gentle smile lines around the mouth, a small mole on the right side of the
chin, no glasses, small build, height 5 feet 1 inch.
```
**Wardrobe:** Simple cotton saree in soft teal or mustard, cotton blouse, thin gold
mangalsutra. *Padhte waqt:* thin gold-rimmed reading glasses.

### `AMAN-01` — male, 21 — chhota bhai / student
```
Indian male, exactly 21 years old, thin narrow face, medium-brown skin, thick messy
black hair falling over the forehead, sparse patchy stubble on the chin only, thin
eyebrows, bright dark eyes, slightly prominent front teeth visible when smiling, a
small mole on the right jawline, no glasses, thin lanky build, height 5 feet 10 inches.
```
**Wardrobe:** Oversized grey hoodie or plain black t-shirt, wired earphones around the
neck, canvas backpack.

### `NEHA-01` — female, 26 — young working woman
```
Indian woman, exactly 26 years old, oval face, medium-brown skin, straight black hair
cut to shoulder length with a blunt fringe, thin arched eyebrows, wide dark-brown eyes,
small straight nose with a tiny silver nose stud on the left nostril, full lips, a
small mole above the left eyebrow, no glasses, slim build, height 5 feet 3 inches.
```
**Wardrobe:** Smart-casual — plain white or pale-pink formal shirt with dark trousers,
plain black tote bag, no jewellery except the nose stud.

### `KAVYA-01` — female, 32 — senior professional
```
Indian woman, exactly 32 years old, long face with a strong jaw, wheatish skin, dark
brown hair tied back into a neat low ponytail with a centre parting, defined straight
eyebrows, sharp dark eyes, high cheekbones, a small scar on the left side of the upper
lip, thin black-framed rectangular glasses always worn, medium build, height 5 feet
5 inches.
```
**Wardrobe:** Charcoal or navy blazer over a plain shirt, minimal steel wristwatch on
the left wrist.

### `VIKRAM-01` — male, 36 — business owner / senior colleague
```
Indian male, exactly 36 years old, broad rectangular face, wheatish skin, thick black
hair combed back with a slightly receding hairline at the temples, heavy dark eyebrows,
narrow dark eyes, a full but neatly trimmed black beard covering the jaw, a small
horizontal scar on the left side of the chin under the beard, no glasses, solid
medium-heavy build, height 5 feet 11 inches.
```
**Wardrobe:** Well-fitted white or pale-grey shirt, sleeves rolled to the elbow, no
tie, brown leather strap watch on the left wrist.

### `RAVI-01` — male, 45 — tier-2 dukaandaar / bada father
```
Indian male, exactly 45 years old, oval face with a heavy jaw, dark-brown weathered
skin, thick black hair with grey only at the sideburns, side-parted, a thick full
black moustache with no beard, tired warm eyes with deep lower-lid creases, a small
mole on the left side of the neck, no glasses, sturdy build, height 5 feet 8 inches.
```
**Wardrobe:** Half-sleeve checked shirt in blue or brown, dark trousers, a pen clipped
in the shirt pocket.

### `ANJALI-01` — female, 17 — beti / school student
```
Indian girl, exactly 17 years old, small round face, fair-wheatish skin, long straight
black hair worn in a single side braid, thin straight eyebrows, large bright dark eyes,
small round nose, a light scattering of freckles across the nose and upper cheeks,
braces on the upper teeth, no glasses, slight build, height 5 feet 2 inches.
```
**Wardrobe:** School uniform (white shirt, navy skirt or trousers) or a plain t-shirt
with jeans at home.

### `DADI-01` — female, 74 — dadi
```
Indian woman, exactly 74 years old, thin lined face with hollow cheeks, pale wheatish
skin, thin fully white hair pulled into a small tight bun, deeply creased forehead and
eye corners, small cloudy-brown eyes, thin lips, thick round gold-rimmed reading glasses,
a small dark mole on the left temple, frail small build, slight stoop.
```
**Wardrobe:** Plain white or off-white cotton saree, thin white shawl, small gold studs.

### `CHOTU-01` — male, 12 — bachcha
```
Indian boy, exactly 12 years old, round chubby face, medium-brown skin, short black
hair cut neatly with a side parting, thick eyebrows, big dark eyes, a visible gap
between the two upper front teeth, a small mole on the right cheek, no glasses,
small slight build.
```
**Wardrobe:** School uniform (white shirt, navy shorts) or a bright red t-shirt at home.

---

## Files banane hain (ek baar ka kaam)

Har character ka **hero still**. Front-facing, neutral expression, even soft light,
plain mid-grey background, chest-up framing.

| File | Status |
|---|---|
| `RAHUL-01-hero.png` | ⬜ |
| `RAHUL-01-profile.png` (3/4 angle) | ⬜ |
| `PRIYA-01-hero.png` | ⬜ |
| `PAPA-01-hero.png` | ⬜ |
| `PAPA-01-profile.png` | ⬜ |
| `MAA-01-hero.png` | ⬜ |
| `AMAN-01-hero.png` | ⬜ |
| `NEHA-01-hero.png` | ⬜ |
| `KAVYA-01-hero.png` | ⬜ |
| `VIKRAM-01-hero.png` | ⬜ |
| `RAVI-01-hero.png` | ⬜ |
| `ANJALI-01-hero.png` | ⬜ |
| `DADI-01-hero.png` | ⬜ |
| `CHOTU-01-hero.png` | ⬜ |

**Two-shots** (jahan do log ek frame me chahiye — ek baar banao, hamesha reuse):

| File | Kis ke liye |
|---|---|
| `TWOSHOT-RAHUL-PAPA.png` | Sabse zyada use hone wala — ~14 videos |
| `TWOSHOT-RAHUL-PRIYA.png` | Couple videos |
| `TWOSHOT-PAPA-MAA.png` | Maa-baap saath |
| `TWOSHOT-RAHUL-MAA.png` | Maa-beta |

---

## Priority order (credits bachane ka sahi tarika)

Sab ek saath mat banao. Is order me banao — har step ke baad batao ki kitne videos
unlock ho gaye:

| Step | Banao | Kitne videos unlock |
|---|---|---|
| 1 | `RAHUL-01-hero.png` | **59** videos |
| 2 | `PAPA-01-hero.png` + `TWOSHOT-RAHUL-PAPA.png` | +21 |
| 3 | `MAA-01-hero.png` | +20 |
| 4 | `AMAN-01-hero.png` | +16 |
| 5 | `VIKRAM-01-hero.png` | +14 |
| 6 | `RAVI-01-hero.png`, `PRIYA-01-hero.png`, `KAVYA-01-hero.png` | +28 |
| 7 | `NEHA-01`, `CHOTU-01`, `ANJALI-01`, `DADI-01` | +13 |

**Sirf pehla still (`RAHUL-01`) 59 videos ka lead hai** — usme sabse zyada time lagao.
Wo perfect hona chahiye. Baaki 11 usse kam important hain.

`DADI-01` sirf Video 69 me hai — wo sabse aakhir me banao, ya Video 69 skip kar do
agar credits bachane hain.

---

## Rule

Ek baar image approve ho gayi → **kabhi mat badalna**. Naya video banate waqt naya
face generate mat karna — yahi file attach karna. Har still ke liye 10-15 attempt
lagenge, ye normal hai. Ye ek baar ka kharcha hai jo 90 videos me bat jata hai.
