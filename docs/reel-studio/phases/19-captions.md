# Phase 19 — Captions system (manual + SRT/VTT + styles)

**STATUS:** code done — browser wala hissa baaki (dev server nahi chala)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 19 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 17 complete (auto-captions Phase 23 me)

**Goal:** captions bina AI ke bhi poora kaam karein — haath se banao ya SRT/VTT import karo.
Hamesha editable text rahe, kabhi burned-in asset nahi.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 19.1 `subtitle` item type: `{ cues[], style, position }`, cue me `words?[]`.
      → Naya item type (text se alag). Text item ki zindagi ek content par tiki hai, subtitle
        ki waqt ke saath badalte cues par — ek hi type me dono rakhne par har jagah "cues hain
        ya nahi" poochhna padta.
      → Cue ke frames **item-local** hain (keyframes ki tarah): subtitle item khiskane par
        saari cues apne aap saath chalti hain.
      → Roop (`text` field) dono me ek hi schema se — font/size/rang ka code do jagah nahi.
- [x] 19.2 Caption editor: cue list, inline edit, timing, split at playhead, lambai ki hint.
      → `CaptionsPanel.tsx` (naya "Captions" tab) + 7 ops.
      → Lambai ki hint **rukavat nahi** hai. Kabhi-kabhi lambi line hi sahi hoti hai; batana
        aur rokna do alag cheezein hain.
      → **browser me nahi dekha.**
- [ ] 19.3 Timeline par caption track: har cue ek chhota block, drag se timing.
      → **Nahi bana.** Subtitle item timeline par ek clip ki tarah dikhta hai (jo sach hai),
        par uske andar ke cues ke apne block nahi bane. Panel se timing badalna chalta hai.
        Wajah neeche table me.
- [x] 19.4 SRT + VTT import; BOM aur Hindi text sambhalna.
      → Ek hi parser dono ke liye — do rakhne par ek din SRT me bug theek hota aur VTT me
        wahi bug pada rehta.
      → BOM ka apna test hai (Windows ke tools se aayi har doosri file me hota hai; uske
        rehte **pehla cue chup-chaap gayab** ho jaata tha).
      → Devanagari ka apna test hai — parser me bhi aur render me bhi.
- [x] 19.5 SRT + VTT export.
      → Round-trip test: import → export → import me timing **bilkul wahi** aati hai.
- [x] 19.6 Caption styles registry: normal, bold, highlight-word, karaoke, pop, typewriter, boxed.
      → `CAPTION_STYLES` — saat styles. Har style ka jawab ek plain object hai (React element
        nahi), kyunki `@reel/core` me React nahi aata.
- [x] 19.7 Style params: font, size, rang, active-word rang, stroke, shadow, box, position.
      → Text ka roop `TextSpecSchema` se (wahi jo text item use karta hai); style ke apne
        params registry me. Safe-area: caption neeche ka 12% chhod deti hai — Instagram ka
        apna UI wahan baithta hai.
- [x] 19.8 Word timing na ho to andaaza, **aur UI me saaf batao ki ye andaaza hai**.
      → `estimateWords()` — har shabd ko uski lambai ke hisaab se waqt. Har shabd ko barabar
        waqt dena kharab hota: "aur" aur "vyavastha" ko ek jitna dene par highlight saaf
        peeche chalta dikhta hai.
      → Panel me amber patti me saaf likha hai ki ye andaaza hai aur asli timing Phase 23 se
        aayegi.
- [x] 19.9 Brand tokens captions me bhi.
      → Style ke rang bhi token ho sakte hain (`brand.accent` default hai) aur renderer unhe
        `useToken()` se resolve karta hai — wahi raasta jo Phase 17 me bana.
- [x] 19.10 Multi-language: ek item me ek language, do items = do languages.
      → `subtitle.language`. Ek hi item me do bhasha rakhne par har cue par "ye kaun si
        bhasha hai" ka sawaal aata aur on/off karna namumkin ho jaata; do item hone se
        `hidden` toggle hi kaafi hai.
- [x] 19.11 Preview = render: text metrics dono jagah ek jaisi.
      → Shabd **hamesha** alag `<span>` me jaate hain, chahe style ko per-word kuch karna ho
        ya na ho. Do alag layout code hone par unka line-break alag padta hai — nateeja: style
        badalte hi caption ek line se do line par kood jaati.
      → Font ka raasta Phase 9 wala hi hai (render ko fonts `inputProps` se jaate hain).
- [x] 19.12 Test: cues, karaoke, SRT round-trip, render, Devanagari.
      → `npm run render:captions` — 10 checks, sab pass. Asli output aur ek frame neeche.
- [x] 19.13 `npm run typecheck` clean. Commit.

## Jo galat nikla

**`" 00:00:03,500".split(/\s+/)[0]` khaali string deta hai.**

Timing line ko `-->` par todne ke baad daayein hisse me ek space bacha rehta hai. Uspar seedha
`split(/\s+/)` karne par pehla tukda **khaali string** aata hai (JavaScript me `" a".split(/\s+/)`
= `["", "a"]`). Nateeja: har SRT file "timing padhi nahi ja saki" bankar reject ho jaati thi —
poori file, ek bhi cue nahi. Test ne turant pakad liya. Ab `trim()` pehle chalta hai.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 tests, 0 fail    # studio
ALL PASS: 427 assertions groups, 0 fail              # core (+36 naye Phase 19 ke)

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    159 kB    316 kB
```

### 19.12 — captions, MP4 se naapi hui

```
$ npm run render:captions --workspace @reel/worker

1. SRT round-trip (19.5 / 19.12)
  ok   SRT padhi gayi
  ok   import -> export -> import me timing bilkul wahi

4. cue sahi waqt par aata aur jaata hai
  .. text ke pixels: 0 (0.2s) -> 10938 (1.5s) -> 0 (5.8s)
  ok   pehle cue se pehle koi caption nahi — 0 px
  ok   cue ke dauraan caption dikhti hai — 10938 px
  ok   aakhri cue ke baad caption chali jaati hai — 0 px

5. karaoke ka highlight sach me badalta hai (19.12)
  .. 0.7s: highlight 998 px, beech 272
  .. 1.2s: highlight 1489 px, beech 323
  .. 1.7s: highlight 3006 px, beech 480
  .. 2.2s: highlight 3505 px, beech 533
  .. 2.7s: highlight 4578 px, beech 533
  ok   har sample par highlight mila — 5/5
  ok   highlight ek jagah atka nahi — sabse door do jagah 261px alag (frame 1080px chauda)

6. Devanagari (19.12)
  .. Devanagari text ke pixels: 16987
  ok   Devanagari render me aaya (khaali ya tofu nahi)

ALL PASS: 10 checks, 0 fail  (captions)
```

**Highlight ki jagah naapi jaati hai, sirf uska hona nahi.** "Karaoke laga diya" ka koi matlab
nahi hota agar highlight ek hi shabd par atka rahe — aur wo galti dekh kar bhi pakadni mushkil
hai (video chalti rehti hai, bas ek rang nahi hilta). Yahan highlight ka beech 272 se 533 tak
gaya, yaani wo sach me baayein se daayein chala.

### Devanagari — aankh se bhi dekha gaya

Naap (16987 px) sirf itna keh sakti hai ki "kuch to bana"; wo ye nahi keh sakti ki akshar sahi
hain. Isliye frame nikaal kar dekha bhi gaya:

```
$ ffmpeg -i render-out/captions/devanagari.mp4 -ss 2.0 -frames:v 1 -vf "crop=1080:340:0:1560" hindi.png
```

Frame me **"आपका साथी — मुफ़्त में"** saaf likha aaya — nukta (फ़) aur maatra (में) dono sahi
jagah. Tofu (□□□) hota to naap bhi kam aati aur dikhta bhi.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 19.3 timeline par har cue ka apna block | Subtitle item timeline par ek clip ki tarah dikhta hai (jo sach hai). Cue-level blocks ke liye clip ke andar ek nayi lane chahiye — wo `KeyframeLane` jaisa kaam hai aur uske bina bhi timing panel se badalti hai. |
| 19.2 / 19.4 / 19.5 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta. Import/export ka poora ganit test se pakka hai; sirf file-drop aur download browser me hi naape ja sakte hain. |
| Asli word timing | Phase 23 (auto-captions). Abhi andaaza hai aur wo UI me saaf likha hai. |

## Done when

Captions haath se ban jaati hain, SRT/VTT round-trip exact hai, karaoke/highlight render me
sach me chalta hai, Devanagari sahi render hota hai, aur captions editable rehti hain.

→ Chaaron naap liye gaye. Aakhri ("editable rehti hain") sabse pakka hai: caption ek aam item
  hai jispar har op waise ka waisa chalta hai, aur cues doc me plain text hain — kahin koi
  burned-in asset nahi banta.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 19.1–19.2, 19.4–19.13 done; 19.3 nahi bana (wajah upar). Ek asli bug pakda gaya (`split(/\s+/)[0]` khaali string deta tha, isliye **har** SRT file reject ho rahi thi). Naya script `render:captions` — 10/10. Karaoke ka highlight 272 se 533 px tak chala; Devanagari frame nikaal kar aankh se bhi dekha. |
