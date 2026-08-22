# Phase 25 — Cloud render worker (GitHub Actions)

**STATUS:** code taiyaar — setup baaki (neeche Step 1 ka checklist)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 25 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 11 (export pipeline) complete

**Goal:** reel bina PC chalu rakhe ban jaaye — bina koi server kiraye par liye.

---

## 0. Pehle ye saaf kar lo: "Supabase me worker chal raha hai" ek galatfehmi hai

`supabase/cron-setup.sql` padhne par lagta hai ki kaam Supabase me ho raha hai. Nahi ho raha.
Wahan sirf ghadi hai:

```
Supabase (pg_cron)  →  pg_net se HTTP call  →  Vercel ka /api/cron/… route
                                               (asli kaam yahan hota hai)
```

Supabase time par Vercel ko phone kar deta hai, bas. Web/app ke kaam (reminders, plan expiry,
prices) halke hain — ek DB update, ek email — isliye Vercel ka function unhe 10 second me
nipta deta hai.

**Reel render alag jaanwar hai.** Use Chrome Headless (~150MB, Remotion har frame ka
screenshot isi se leta hai) aur ffmpeg chahiye, aur wo minute bhar chalta hai. Vercel ke
function me wo fit hi nahi hota. Isliye wahi pg_cron wala pattern yahan **kaam nahi karega** —
ghadi to bajegi, par uthane wala koi nahi hoga.

## Isliye: GitHub Actions

Repo GitHub par pehle se hai. `ubuntu-latest` runner me **ffmpeg aur Chrome dono pehle se
installed** aate hain, ek job 6 ghante tak chal sakti hai, aur alag se koi server nahi paalna
padta.

```
Studio me user Export dabata hai
       ↓
job reel_render_jobs table me   (ye pehle se hota tha — isme koi badlav nahi)
       ↓
studio khud GitHub ko phone karti hai  (repository_dispatch)
       ↓
GitHub Actions runner: worker --once mode me
       ↓  Chromium + ffmpeg se render
R2 par upload  →  Supabase me job "completed"
```

⚠️ **Ghadi (pg_cron) is raaste me hai hi nahi, aur wo jaan-boojhkar hai.** Do wajah:

1. Ghadi ka matlab intezaar hai. 5 minute wale cron par user Export ke baad ausatan 2.5 minute
   khaali baitha rehta — jabki job usi second queue me pahunch chuki hoti hai.
2. Private repo par Actions ke **2000 minute/month** hain. Har 15 minute ka khaali check bhi
   mahine ke ~2880 minute kha jaata: budget khatam, aur badle me ek bhi reel nahi.

pg_cron sirf ek **safety net** ki tarah lagta hai (25.5), aur wo bhi tabhi kuch karta hai jab
queue me sach me kaam pada ho.

---

## Step 1 — Setup checklist (ek baar ka kaam)

### 25.1 GitHub secrets

Repo → Settings → Secrets and variables → Actions → **New repository secret**. Ye 6:

| Secret | Kahan se |
|---|---|
| `SUPABASE_URL` | `worker/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | `worker/.env` |
| `R2_ACCOUNT_ID` | `worker/.env` |
| `R2_ACCESS_KEY_ID` | `worker/.env` |
| `R2_SECRET_ACCESS_KEY` | `worker/.env` |
| `R2_BUCKET` | `worker/.env` (aksar `apkasaathi-storage`) |

⚠️ **`REEL_STORAGE_DRIVER` secret me mat daalo.** Wo workflow me `r2` hardcoded hai, aur
hona bhi chahiye: runner ki disk run khatam hote hi mit jaati hai. `local` driver par reel ban
kar **usi lamhe gayab** ho jaayegi aur DB me job "completed" likhi reh jaayegi — user ko poori
hui job dikhegi jiska download 404 deta hai. Worker shuru me hi ye jaanch karta hai aur galat
setting par saaf mana kar deta hai.

- [ ] 25.1 chhe secrets set

### 25.2 GitHub PAT (studio ko dispatch bhejne ke liye)

GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate.

- Repository access: **Only select repositories** → `saathi`
- Permissions → Repository permissions → **Contents: Read and write**
- Expiration: jitna lamba de sake (expire hote hi dispatch chup-chaap band ho jaayega)

⚠️ Access na hone par GitHub **404** deta hai, 403 nahi — private repo ka wajood wo
jaan-boojhkar nahi batata. Isliye 404 aaye to pehle token dekho, repo ka naam baad me.
(`studio/lib/dispatch.ts` ye baat error message me hi likh deta hai.)

Phir studio ke Vercel project me (Settings → Environment Variables):

```
REEL_DISPATCH_REPO   = nitishkumar868308/saathi
REEL_DISPATCH_TOKEN  = github_pat_…
```

⚠️ Env badalne ke baad **naya deploy** chahiye — Vercel purane build me nayi env nahi ghusata.

- [ ] 25.2 PAT bana, studio me dono env set, redeploy hua

### 25.3 Pehli baar chala kar dekho

Ye order jaan-boojhkar hai — sabse chhoti cheez pehle:

1. **Sirf workflow:** repo → Actions → `reel-render` → **Run workflow**. Queue khaali hogi to
   run ~1-2 minute me green ho jaayega aur log me `queue khaali hai — drain poora` likha
   aayega. Iska matlab: secrets sahi hain, R2 pahunch raha hai, ffmpeg mila.
2. **Phir dispatch:** studio me Export dabao. Actions tab me naya run apne aap dikhna chahiye.
3. **Phir reel:** run poora hone par studio ke Renders panel me job `completed` aur download
   chalu.

- [ ] 25.3 teeno step pass

### 25.4 Storage — **ye sabse zaroori step hai, aur ye chhoot gaya tha**

⚠️ Cloud par jaate hi ek baat badal jaati hai: **asset ab runner ko dikhne chahiye.**

Ab tak studio `REEL_STORAGE_DRIVER=local` par thi, yaani har upload `render-out/media/` me —
tumhare apne disk par. Local worker ke liye wo bilkul theek tha, wo usi machine par tha.
**GitHub ka runner us disk ko kabhi nahi dekh sakta.**

Aur ye khaami sabse buri shakl me saamne aati: job queue me jaati, runner uthta, npm ci chalti,
Chrome utarta — aur uske baad "asset nahi mili" par render marta. Do minute aur poora setup,
sirf ye pata karne ke liye ki file wahan kabhi thi hi nahi.

⚠️ **Sirf `REEL_STORAGE_DRIVER=r2` kar dena kaafi NAHI hai.** Wo sirf aage ke upload ka rasta
badalta hai; purani files disk par padi rehti hain, aur DB me unka `r2_key` maujood hone ki
wajah se studio me sab theek dikhta rehta hai.

Isliye tarteeb yahi hai, aur ulti nahi ho sakti:

```
# 1. pehle dekho kya-kya chadhega (kuch upload nahi hoga)
npm run migrate:r2 --workspace @reel/worker -- --dry-run

# 2. phir sach me chadhao
npm run migrate:r2 --workspace @reel/worker
```

Script local se kuch **delete nahi** karti — galat migration ke baad local copy hi wo cheez hai
jisse sab wapas laaya ja sakta hai. Tasalli ke baad `render-out/` khud hata dena.

Uske baad studio ke **dono** jagah (`studio/.env.local` aur Vercel ke studio project) ye:

```
REEL_STORAGE_DRIVER = r2
R2_ACCOUNT_ID       = …
R2_ACCESS_KEY_ID    = …
R2_SECRET_ACCESS_KEY= …
R2_BUCKET           = apkasaathi-storage
```

Studio ko R2 sirf upload ke liye nahi chahiye — **download link bhi wahi banati hai**
(`/api/render/[id]/url`). Studio `local` par rahi aur worker ne R2 par chadha diya, to reel ban
to jaayegi par uska download 404 dega.

⚠️ Ab ye galti chup-chaap nahi ho sakti: cloud mode + local driver par Renders panel me **laal**
chetavni aati hai (`/api/worker` ka `storageMismatch`). Ye jaanch waha hai jahan sabse sasti
hai — render se pehle, render ke baad nahi.

- [ ] 25.4 migration chali, dono jagah driver `r2`, laal chetavni gayab

### 25.5 Safety net (optional, par lagane layak)

⚠️ Iske liye studio ke Vercel project me `CRON_SECRET` bhi hona chahiye — bina uske
har call 401 hoti hai aur wo 401 kahin dikhti nahi.

`supabase/cron-reel-dispatch.sql` — usme `v_secret` (studio ka `CRON_SECRET`) aur `v_base`
(studio ka production domain) bhar kar Supabase SQL Editor me Run karo. Studio ke Vercel env me
`CRON_SECRET` bhi wahi daalna hoga.

Ye har 15 minute par dekhta hai ki **queue me kaam pada hai aur worker chup hai** — tabhi
dispatch bhejta hai. Queue khaali ho to ek DB query par baat khatam, koi runner nahi uthta.

Iske bina bhi sab chalta hai; ye sirf us job ke liye hai jo dispatch fail hone ki wajah se
queue me atak gayi ho.

- [ ] 25.5 cron laga (ya "abhi nahi" ka faisla likha)

---

## Step 2 — Kya-kya badla (code ka naksha)

| File | Kya |
|---|---|
| `.github/workflows/reel-render.yml` | runner: checkout → node 20 → cache → npm ci → worker `--once` |
| `worker/src/index.ts` | drain mode (`--once`), `REEL_WORKER_KINDS`, R2 ki jaanch, fail-fast, shutdown ka heartbeat fix |
| `studio/lib/dispatch.ts` | GitHub ko phone (`repository_dispatch`) — kabhi throw nahi karta |
| `studio/app/api/render/route.ts` | job banne ke **baad** dispatch, jawab me `dispatched` |
| `studio/app/api/transcribe/route.ts` | wahi, aur whisper ka sawaal sahi machine se |
| `studio/app/api/worker/route.ts` | `mode: "cloud" \| "local"` — UI ke liye |
| `studio/app/api/cron/reel-dispatch/route.ts` | safety net |
| `worker/scripts/migrate-local-to-r2.ts` | purani local media R2 par chadhane wali script |
| `studio/components/editor/…` | "Worker offline" cloud par jhooth na bole |

### Teen baatein jo dhyan se likhi gayi hain

**1. Drain mode turant exit nahi karta (20 second rukta hai).**
User aksar ek ke baad ek do-teen reel export karta hai. Pehli poori hote hi nikal jaane par
doosri ke liye poora runner dobara khada hota — checkout + npm ci + Chrome, yaani 2-3 minute
sirf shuruaat me. 20 second ruk jaana us poore setup se sasta hai.

**2. Galat secret 40 second me pakda jaata hai, 80 minute me nahi.**
Drain mode me DB se lagataar 10 baar baat na ho paaye to worker run ko **fail** kar deta hai.
Ye stub ke saath chalate hue hi saamne aaya: bina is hadd ke galat `SUPABASE_URL` par worker
chupchaap `fetch failed` ka loop chalata rehta tha jab tak 80 minute ki hadd na aa jaaye —
yaani ek galat secret ke badle 80 Actions minute, aur run ke ant me bhi "successful" dikhta.
Tumhare PC wale worker par ye hadd laagu nahi (wahan Wi-Fi ka aana-jaana aam hai).

**3. Runner sirf `render` job uthata hai, `transcribe` nahi** (`REEL_WORKER_KINDS=render`).
Transcribe ko faster-whisper chahiye, jo runner me nahi hota — pip install + model download har
run me ~1-2 minute. Bina is filter ke ek transcribe job us runner par ja girti jahan whisper
hai hi nahi, aur "faster-whisper is machine par nahi hai" keh kar fail hoti — jabki wahi job
tumhare PC par bilkul chal jaati. **Wo job uthni hi nahi chahiye thi.**

Cloud par auto-captions chahiye to studio dispatch ke saath `whisper: true` bhejti hai (sirf
tab jab text pehle se pata na ho), aur workflow us par pip install kar leta hai.

---

## Step 3 — Kharcha (private repo, free plan)

**2000 Actions minute/month.** Ek run ka hisaab:

| Hissa | Waqt |
|---|---|
| checkout + node setup | ~15s |
| `npm ci` (sirf worker + packages, studio nahi) | ~30-45s |
| Chrome Headless Shell | cache lagne par ~5s, warna ~45s |
| Remotion bundle | ~13s (har run me — bundle cache sirf process ke andar hai) |
| **render** | 30s ki reel ≈ 3-4 minute (runner 2-core hai) |
| drain ka 20s + upload | ~30s |

Yaani **ek reel ≈ 5-6 minute**, aur mahine me lagbhag **330-400 reel** free me.

⚠️ Runner 2-core hai — tumhara laptop 6-core. Yaani cloud render **tez nahi, dheema** hoga
(24.4 me yahi baat VPS ke liye likhi hai, aur wo yahan bhi utni hi sach hai). Cloud ka faayda
speed nahi hai; faayda ye hai ki **PC chalu rakhna zaroori nahi**.

⚠️ Ek run me kai reel banna is hisaab ko kaafi behtar kar deta hai — setup ka ~1.5 minute ek
hi baar lagta hai. Isliye drain mode ka 20 second wala sabra sirf suvidha nahi, paisa bhi hai.

Minute kahan gaye, ye dekhne ki jagah: GitHub → Settings → Billing → Plans and usage.

---

## Progress log

- **2026-08-22** — code likha. Typecheck saaf (`worker` + `studio` + `web`).

  Drain mode ek nakli PostgREST ke saamne chala kar naapa gaya:
  - queue khaali → worker khud ruka, **exit 0**, ~6s (idle hadd 4s rakhi thi)
  - DB hi na mile → 10 koshish ke baad **exit 1** saaf message ke saath, ~8s
    (poll 300ms par; runner ke default 2000ms par ye ~40s hoga)

  R2 ki jaanch bhi chala kar dekhi: `REEL_WORKER_ONCE=1` + `REEL_STORAGE_DRIVER=local`
  par worker shuru hi nahi hota.

  ⚠️ **Asli GitHub runner par abhi kuch nahi chala** — 25.1-25.4 ka setup baaki hai,
  isliye ek bhi box tick nahi kiya gaya.
