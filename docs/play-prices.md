# Play Console ka price — app, web aur admin, teeno par ek jaisa

## Ek hi maalik

Saathi Plus ka daam **sirf Play Console me set hota hai**. Aur kahin nahi.

```
                    Play Console
                    (aap yahan daam badalte ho)
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
  Play Billing                     Play Developer API
  (seedha, app ke andar)           (server roz padhta hai)
        │                                   │
        ▼                                   ▼
      APP                            play_prices table
                                            │
                                    ┌───────┴───────┐
                                    ▼               ▼
                                WEBSITE          ADMIN
```

App ko beech ke raaste ki zaroorat hi nahi — wo Play se **seedha** daam padhti
hai (`product.priceString`), aur wahi daam kata bhi jaata hai. Website aur admin
par Play Billing hota hi nahi, isliye unke liye server Play Developer API se
daam laata hai.

**Daam badalne ka tareeka:** Play Console me badlo → Admin > Pricing → **"Sync
now"**. Bas. Admin panel me naya daam turant dikhta hai; website ek minute ke
andar (uska cache utna hi hai).

### Admin panel se daam kyun nahi badalta

Ye jaan-boojh ke hai. `subscriptions.patch` se API se daam badalna technically
ho sakta hai, par:

- ek galat call **190 desh** ke price ek saath bigaad deti hai, aur undo aasan
  nahi hai;
- purane subscribers ka daam badalne ka Google ka apna consent flow hai (user ko
  notify hota hai, wo accept ya cancel karta hai) — use API se aadha chalana
  ulta pad jaata hai;
- do jagah daam set hone ka natija hamesha ek hi hota hai: ek din website ₹99
  dikhati hai aur Play ₹149 kaat leta hai. Ye sirf bharosa todne wali baat nahi
  — **Play ki policy** bhi yahi maangti hai ki jo dikhe wahi kate, aur uspar app
  reject hoti hai.

Isliye admin panel ka Play wala hissa poori tarah **read-only** hai.

---

## Setup (ek baar ka kaam)

### 1. Google Cloud — API enable karo

[console.cloud.google.com](https://console.cloud.google.com) → apna project
chuno (ya naya banao) → **APIs & Services → Library** → **"Google Play Android
Developer API"** dhoondho → **Enable**.

### 2. Service account banao

**IAM & Admin → Service Accounts → Create service account**

- Naam: `play-price-reader` (kuch bhi chalega)
- Role ki zaroorat nahi — access Play Console se milega, GCP se nahi. Is step
  par **Continue** dabakar aage badh jao.
- Ban jane ke baad us account par click → **Keys → Add key → Create new key →
  JSON** → file download ho jayegi.

⚠️ Ye file ek baar hi milti hai. Isme aapke Play Console ka access hai — ise
repo me commit mat karna.

### 3. Play Console me access do

[play.google.com/console](https://play.google.com/console) → **Users and
permissions → Invite new users**

- Email: JSON file ke `client_email` wala pata
  (`play-price-reader@…iam.gserviceaccount.com`)
- **App permissions** me sirf Apka Saathi chuno
- Permission: **View app information (read-only)** — bas itna. Financial data ya
  release wala access dene ki koi zaroorat nahi.

⚠️ Ye step bhoolne par Google **403** deta hai, chahe key bilkul sahi ho. Admin
panel me poora message dikhta hai.

⚠️ Invite bhejne ke baad Play Console ko permission lagne me kuch minute lag
sakte hain. Turant 403 aaye to thodi der baad "Sync now" dobara dabao.

### 4. Env bharo

Vercel → Project Settings → Environment Variables (aur local me `.env.local`):

```
GOOGLE_PLAY_SA_JSON=<JSON file ka poora content, ya uska base64>
GOOGLE_PLAY_PACKAGE_NAME=com.apkasaathi.app
CRON_SECRET=<jo pehle se set hai>
```

Base64 wali shakal Vercel ke liye behtar hai — JSON ke andar (`private_key` me)
newline hote hain aur wo dashboard/CLI me aksar toot jaate hain:

```bash
base64 -w0 sa.json          # Linux
base64 -i sa.json           # macOS
```

Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("sa.json"))
```

Code dono shakal khud pehchan leta hai — raw JSON bhi chalti hai, base64 bhi.

Subscription id `plus_monthly` / `plus_yearly` se alag hon to:

```
PLAY_PRODUCT_MONTHLY=<console wala id>
PLAY_PRODUCT_YEARLY=<console wala id>
```

⚠️ App ka code bhi yahi id dhoondhta hai
([upgrade.tsx](../app-mobile/src/app/upgrade.tsx) → `packageFor`). Badlo to dono
jagah dekhna.

### 5. SQL chalao

Supabase → SQL Editor:

- `supabase/play-prices.sql` — `play_prices` + `play_price_sync` table
- `supabase/cron-play-prices.sql` — roz ka sync (`<CRON_SECRET>` apni value se
  badalna mat bhoolna)

### 6. Chala ke dekho

Admin → **Pricing** → **"Sync now"**. Kaamyab hone par upar wali table me har
desh ka daam aa jayega aur "Aakhri sync: abhi" dikhega.

---

## Kaise pata chale ki sab theek chal raha hai

Admin > Pricing ke sabse upar wala card sab bata deta hai:

| Kya dikhta hai | Matlab |
|---|---|
| "Aakhri sync: 2 ghante pehle" + desh ki ginti | Sab theek. |
| "Play price sync band hai" + wajah | Env adhoora hai. Wajah wahin likhi hoti hai. |
| Laal warning + Google ka message | Env to hai, par Google ne mana kiya. Aksar step 3 (Play Console access) reh jaata hai. |
| "Aakhri kaamyab sync 3 din se zyada purana hai" | Cron chalna band ho gaya. `select * from cron.job;` dekho. |

Sync fail ho to **purana daam mit'ta nahi** — website chalti rehti hai, bas daam
purana rehta hai. Isi wajah se ye warning zaroori hai: uske bina ek band pada
sync hafton tak sahi lagta rehta hai.

---

## Kaunsa daam kahan se aata hai

| Jagah | Pehla sahara | Doosra | Teesra |
|---|---|---|---|
| **App** | Store ka `priceString` (Play khud deta hai) | `play_prices` | manual hisaab |
| **Website** | `play_prices` us desh ka | `play_prices` India ka | manual hisaab |
| **Admin** | `play_prices` (read-only table) | — | manual table alag se dikhti hai |

App me pehla sahara sirf tab milta hai jab RevenueCat ka native module aur key
dono hon — yaani asli build me. Expo Go me ya `PLAY_BILLING_ENABLED` off hone
par doosra sahara chalta hai, jo daam phir bhi Play Console ka hi hai (bas
server ke raaste aata hai). Isliye app aur website par hamesha ek hi number
dikhta hai.

Purana manual hisaab (`country_pricing`: base × multiplier × conversion_rate)
hataya nahi gaya — wo ab sirf **aakhri fallback** hai, taaki daam kabhi khaali
na dikhe.

---

## Yaad rakhne laayak baatein

- **Country IP se aati hai, charge account se.** Website `x-vercel-ip-country`
  (ya `cf-ipcountry`) header se desh pehchanti hai. Play paisa user ke **Google
  account wale desh** se kaatta hai. Iska matlab VPN se sasta daam _dikh_ to
  sakta hai, _mil_ nahi sakta — isiliye IP par bharosa karna yahan surakshit hai.

- **India me Play ka daam tax-inclusive hai.** Console me ₹99 likha hai to user
  ₹99 hi deta hai. Website par "+18% GST" jaisi koi line mat jodna, warna dono
  number alag ho jaayenge. (Isi wajah se code me GST wala hissa comment kiya
  hua hai.)

- **`play_prices` me kabhi haath se mat likhna.** Wo Play ki nakal hai, uska
  maalik nahi. Agli sync par aapka likha hua mit jayega — aur us beech me wahi
  purani bimari lautegi jo is poore kaam ne theek ki hai.

- **DRAFT base plan nahi aate.** Sync sirf `ACTIVE` base plan padhta hai. Console
  me naya plan banaya hai par launch nahi kiya, to wo yahan nahi dikhega — aur
  yahi sahi hai, kyunki wo daam kisi user ko dikhta bhi nahi.
