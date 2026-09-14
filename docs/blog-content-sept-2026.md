# Blog content — September 2026 (v2)

Ye file sirf is project me hai (local). Isme:

1. **2 galat blog delete karne ka tareeka**
2. **Google ke hisaab se research — kya kiya aur kyun**
3. **10 naye blog — Field aur Value ke hisaab se, copy-paste ready**
4. **Website ke baaki galat daave** (blog ke alawa)
5. **Fact sheet** — blog ki har app-baat ka source

Blog English me hain (website ke baaki blog bhi English me hain aur page `en-IN` ke roop me Google ko jaata hai).

---

## 1. Ye 2 blog delete karo

| Blog | Slug | Kyun |
|---|---|---|
| Documents You Should Never Let Expire: A Complete Checklist | `documents-you-should-never-let-expire-a-complete-checklist` | Asli content hai hi nahi — har section me "Explain…", "Discuss…" jaise likhne ke nirdesh publish ho gaye |
| Never Miss Important Document Expiry Dates Again | `document-expiry` | "Choose when you want to be reminded" galat (documents par app khud 7/1/0 din yaad dilati hai), aur "PAN card related deadlines" (PAN expire nahi hota) |

Is topic ki kami naye **Blog 1** (Important Documents Checklist) se poori ho jaati hai — wo sahi, poora content hai.

### Tareeka A — Admin panel se (yahi karo)
1. Website Admin → **Blog**
2. List me upar wala blog dhoondho
3. Uske saamne **delete (🗑️)** dabao
4. Dusre blog ke liye bhi yahi

Admin se delete karne par website ka blog page, sitemap aur "Read next" **turant** update ho jaate hain.

### Tareeka B — SQL se (sirf agar admin na khule)
Supabase → SQL Editor:
```sql
delete from public.blog_posts
 where slug in ('documents-you-should-never-let-expire-a-complete-checklist', 'document-expiry');
```
⚠️ SQL se delete karne par website ka cache 10 minute tak purana dikha sakta hai — uske baad khud theek ho jaata hai.

### Delete ke baad Google ka kya hoga
Delete kiye blog ka link ab "page nahi mila" (404) dega. Google ke apne documentation ke hisaab se 404 site ko nuksaan nahi karta, aur Google dobara crawl karke us page ko apne aap search se hata deta hai. Jaldi hatwana ho to Google Search Console → **Removals** me dono URL daal sakte ho (optional).

---

## 2. Research — Google ke liye kya dhyan rakha

| Niyam | Source | Blog me kaise lagaya |
|---|---|---|
| Title saaf, chhota aur har page ka alag ho; keyword baar-baar mat bharo | [Google: Title links](https://developers.google.com/search/docs/appearance/title-link) | Har title ~40–55 akshar, main search phrase shuru me, koi repeat nahi |
| Description har page ki alag ho aur page ka asli saar bataye; lambi ho to Google kaat deta hai | [Google: Meta descriptions](https://developers.google.com/search/docs/appearance/snippet) | Har description ~140–160 akshar, alag-alag |
| Content logon ki madad ke liye ho, sirf ranking ke liye nahi (E-E-A-T, trust sabse zaroori) | [Google: Helpful, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Asli steps, app ka asli flow, koi jhootha daava nahi; sarkari niyam par "official source check karo" |
| FAQ rich results Google ne band kar diye (2026) | [Search Engine Journal](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/), [Google 2023 notice](https://developers.google.com/search/blog/2023/08/howto-faq-changes) | FAQ schema ke peeche nahi bhaage; par headings sawaal ki shakal me rakhe ("Why are reminders late?") — log aise hi search karte hain |
| Deleted page 404 dena theek hai | [Google: Do 404s hurt my site?](https://developers.google.com/search/blog/2011/05/do-404s-hurt-my-site) | Upar delete wala hissa |

**Topic ki research (Google par kya milta hai):**
- "document expiry reminder app India" — bahut saari apps (DocuAlert, Doc Reminder, Expiry Reminder…). Farak dikhane wali cheezein: **Hinglish/Hindi me bol ke reminder**, **photo/PDF se expiry khud padhna**, **bada full-screen alert**, **WhatsApp reminder**. Blog inhi par tike hain.
- "medicine reminder app for elderly parents India" — search me family/caregiver wale sawaal aate hain. Blog me saaf likha hai ki app me family sharing nahi hai (sach), aur sahi tareeka kya hai.
- "android reminders late" — log "Alarms & reminders" aur battery optimization ke baare me dhoondhte hain. Official Android docs se pakka kiya:
  - Android 12+ par reminder apps ko **"Alarms & reminders"** permission chahiye; bina exact alarm ke system alarm ko der se chala sakta hai ([Android: Schedule alarms](https://developer.android.com/develop/background-work/services/alarms))
  - Android 14 me naye install par exact alarm permission **default se band** hoti hai ([Android 14 changes](https://developer.android.com/about/versions/14/behavior-changes-all))
  - Android 14 me **full-screen alert** default se sirf calling/alarm apps ko milta hai; user khud on kar sakta hai ([Android 14 changes for apps targeting 14](https://developer.android.com/about/versions/14/behavior-changes-14))
- "health insurance renewal grace period" — IRDAI ki official FAQ ki paribhasha li: grace period me premium bharne se continuity benefits (jaise waiting period) nahi tootte, par jitne samay premium nahi aaya us samay ka cover nahi hota ([IRDAI FAQ](https://irdai.gov.in/faqs-on-health-insurance-regulations)). **Din ka number jaan-boojh ke nahi likha** — policy aur payment mode par alag hota hai.

**Blog me jaan-boojh ke NAHI likha** (admin se badal sakta hai ya pakka nahi): Plus ka price, free plan ki exact limit, referral ke exact din, sarkari fine/validity ka number, "encrypted"/"100% private", family sharing.

---

## 3. Admin panel me kaise daalna hai

Website Admin → **Blog** → **New post**. Har blog ke neeche **Field → Value** diya hai.

- **Section heading / Section body** wale field ke liye admin me **"Add section"** dabao, har section ka heading aur body alag box me.
- **Section body** me paragraph ke beech **ek khaali line** — wahi naya paragraph banta hai (value me waise hi diya hai, seedha copy karo).
- **Tags** comma se alag, exact wahi spelling — "Read next" usi tag se judta hai.
- Pehle **Published** untick karke save karo, website par ek baar dekh lo, phir tick karke save.
- Ek din me sab mat daalo — har 2–3 din me ek (neeche date sirf sujhaav).

---

## 4. 10 naye blog

### Blog 1 — Important documents checklist

| Field | Value |
|---|---|
| Title | `Important Documents Checklist: Expiry Dates to Track` |
| Slug | `important-documents-expiry-checklist` |
| Description | `A practical checklist of important documents with expiry or renewal dates, from driving licence and insurance to passport and warranties, and how to track them.` |
| Heading | `Important documents checklist: expiry dates you should track` |
| Intro | `Most important documents stay valid for years, so their expiry dates quietly slip out of mind. This checklist covers the documents worth tracking, what to note for each one, and a simple way to get reminded before any date arrives.` |
| Tags | `document expiry, document reminder, important documents` |
| Reading minutes | `6` |
| Published at | `2026-09-15` |
| Published | ✅ |

**Section 1 heading**
```
Why expiry dates are easy to miss
```
**Section 1 body**
```
A document with a date years away does not feel urgent. It goes into a drawer or a folder, and nothing reminds you about it until the day you need it.

When a document lapses, the result can range from a rejected application or a delayed trip to a fine or a gap in insurance cover. The exact consequence depends on the document and the rules that apply, which is why acting before the date is always safer.
```

**Section 2 heading**
```
Driving licence
```
**Section 2 body**
```
A driving licence is valid only up to the date printed on it. Note that date and plan the renewal before it arrives.

Check the current renewal process and fees on the official transport portal, because requirements can change.
```

**Section 3 heading**
```
Vehicle insurance, registration and PUC
```
**Section 3 body**
```
Motor insurance runs for a fixed policy period, and a missed renewal can leave your vehicle without the cover you expect.

A Pollution Under Control (PUC) certificate is valid only for the period printed on it, so it needs regular renewal. Keep your registration details, insurance policy and latest PUC together, with their dates noted.
```

**Section 4 heading**
```
Passport
```
**Section 4 body**
```
Passports are valid for many years, which is why their expiry is so easy to forget. Some destinations and airlines look at how much validity is left, not only whether the passport has expired.

Check the expiry date before you plan international travel, and leave enough time for renewal if the date is close.
```

**Section 5 heading**
```
Health and life insurance
```
**Section 5 body**
```
Every insurance policy has its own renewal date and terms. Renewing on time helps you keep your cover continuous.

Terms such as grace periods differ between policies, so read your policy document or ask your insurer instead of assuming.
```

**Section 6 heading**
```
Warranties, certificates and subscriptions
```
**Section 6 body**
```
Product warranties, professional certificates, memberships and subscriptions also begin and end on specific dates.

A warranty that ends before you notice a fault is a claim you can no longer make, so these dates are worth tracking too.
```

**Section 7 heading**
```
What about Aadhaar and PAN?
```
**Section 7 body**
```
Aadhaar and PAN do not have an expiry date, so there is nothing to renew. It is still worth keeping their details up to date, such as the mobile number and address linked to Aadhaar.

You can save them in the same place as your other documents for easy access, and set your own reminder if you want to review the details from time to time.
```

**Section 8 heading**
```
How to track all these dates in one place
```
**Section 8 body**
```
In Apka Saathi you add a photo or a PDF of a document, and Saathi tries to read its name and expiry date for you. You check the details and save.

Saathi then reminds you 7 days before the expiry date, 1 day before, and on the day itself, at 9 in the morning. Documents without an expiry date are saved without reminders.
```

**Section 9 heading**
```
Quick checklist
```
**Section 9 body**
```
Driving licence. Vehicle insurance. PUC certificate. Registration details. Passport. Health and life insurance policies. Product warranties. Certificates and memberships.

For each one: note the expiry or renewal date, keep a digital copy in one place, and set a reminder before the date. Update the date as soon as you renew.
```

---

### Blog 2 — Reminder app in Hindi (voice)

| Field | Value |
|---|---|
| Title | `Reminder App in Hindi: Set Reminders by Voice` |
| Slug | `reminder-app-in-hindi-voice-reminders` |
| Description | `Set reminders just by speaking in Hindi, English or Hinglish. Here is how voice reminders work in Apka Saathi, with examples you can say and tips for accuracy.` |
| Heading | `Reminder app in Hindi: set reminders just by speaking` |
| Intro | `Most reminders never get set because typing them feels like a chore. Speaking takes a few seconds, and if you naturally think in a mix of Hindi and English, your reminder app should understand you exactly that way.` |
| Tags | `reminders, voice reminders, hindi reminder app` |
| Reading minutes | `4` |
| Published at | `2026-09-17` |
| Published | ✅ |

**Section 1 heading**
```
Why voice reminders work better
```
**Section 1 body**
```
A reminder only helps if you actually create it. When setting one means opening an app, finding the right field and typing a sentence, the moment passes and the task is forgotten.

Speaking removes that friction. You say the task the way you would tell a family member, and you are done.
```

**Section 2 heading**
```
What can you say?
```
**Section 2 body**
```
Plain, everyday sentences work, for example "Kal subah 8 baje bijli ka bill bharna hai", "Roz raat 9 baje dawai lena" or "30 minute baad chai band karni hai".

You can also say how often it should repeat, such as "roz", "har hafte" or "90 din tak", and Saathi will try to understand that as well.
```

**Section 3 heading**
```
How to set a reminder by voice in Apka Saathi
```
**Section 3 body**
```
Open the Reminders tab, tap the + button and tap the mic. Speak your reminder in Hindi, English or Hinglish.

Saathi fills in the task, the date and the time from what you said. If it understood a repeat, that is shown too. If the date or time was not clear, you simply pick it yourself. Check the details and tap Save.
```

**Section 4 heading**
```
Or tell Saathi in chat
```
**Section 4 body**
```
Open the Saathi tab, tap the mic and speak. The message is sent on its own about two seconds after you finish, and you can tap Stop if you want to change something first.

If something is missing, such as the day or the time, Saathi asks you for it and sets the reminder once it has everything.
```

**Section 5 heading**
```
Tips for accurate voice reminders
```
**Section 5 body**
```
Voice typing needs an internet connection and uses your phone's speech service, so voice typing should be enabled on the phone.

Speak close to the phone in a quiet place. If a word comes out wrong, correct the text before saving.
```

**Section 6 heading**
```
When the reminder rings
```
**Section 6 body**
```
At the time you set, you get a notification with the full reminder text, and a large full-screen alert if you have allowed it.

Tap "Haan, ho gaya" when the task is done, or "5 min baad" to be reminded again in five minutes.
```

---

### Blog 3 — Android reminders late

| Field | Value |
|---|---|
| Title | `Android Reminders Not Working on Time? How to Fix It` |
| Slug | `android-reminders-not-working-on-time` |
| Description | `Reminders arriving late on your Android phone? Learn why Android delays alarms to save battery, and which settings to turn on so reminders ring on time.` |
| Heading | `Android reminders not working on time? Here is how to fix it` |
| Intro | `You set a reminder for 8:00 and it arrives at 8:10, or only when you unlock the phone. The reminder app is usually not the real problem. Android holds back alarms and notifications to save battery unless an app is allowed to ring on time.` |
| Tags | `reminders, android reminders, notifications` |
| Reading minutes | `5` |
| Published at | `2026-09-19` |
| Published | ✅ |

**Section 1 heading**
```
Why does Android delay reminders?
```
**Section 1 body**
```
To save battery, Android groups background work and runs it later, especially when the phone has been idle for a while. For many apps that is fine, but for a reminder it means the alert can arrive late.

Many phone brands add their own, stricter battery saving on top of Android's.
```

**Section 2 heading**
```
Allow "Alarms & reminders"
```
**Section 2 body**
```
Since Android 12, apps need the "Alarms & reminders" permission to ring at an exact time. Without it, Android can treat the reminder like an ordinary alarm and deliver it later.

On Android 14 and newer, this permission is switched off by default for many newly installed apps, so you may need to allow it once.
```

**Section 3 heading**
```
Turn off battery optimisation for the app
```
**Section 3 body**
```
Battery optimisation can pause an app in the background. Setting the reminder app's battery usage to unrestricted stops the phone from holding its reminders back.
```

**Section 4 heading**
```
Allow notifications and full-screen alerts
```
**Section 4 body**
```
Without notification permission, a reminder is not shown at all.

A full-screen alert shows the reminder large in the middle of the screen instead of a small notification at the top, which is much harder to miss. On Android 14 and newer, full-screen alerts are not switched on by default for most apps, but you can turn them on for the app yourself.
```

**Section 5 heading**
```
Fix it in one place in Apka Saathi
```
**Section 5 body**
```
Open the You tab and tap "Reminders reliable banao". Notifications, alarms and reminders, the full-screen alert and battery settings are listed together, each with an Allow button. Tap them one by one. It is a one-time job.

The app also offers this setup when you create a reminder and something is still missing.
```

**Section 6 heading**
```
Test that it works
```
**Section 6 body**
```
Use the test alarm in the app. If you can see and hear the test alarm, your real reminders will work the same way.

You can also choose how alerts sound, ring, vibrate or silent, under "Alert ki awaaz" in the You tab.
```

---

### Blog 4 — Medicine reminder for elderly parents

| Field | Value |
|---|---|
| Title | `Medicine Reminder for Elderly Parents: Easy Setup` |
| Slug | `medicine-reminder-for-elderly-parents` |
| Description | `A simple medicine reminder setup for elderly parents: clear medicine names, daily repeats, a large full-screen alert and Hindi support on their own phone.` |
| Heading | `Medicine reminder for elderly parents: an easy setup` |
| Intro | `Many of us look after a parent's medicines from a distance. Buying the medicine is the easy part. Making sure the right tablet is taken at the right time, every day, without constant phone calls, is the hard part.` |
| Tags | `reminders, medicine reminders, daily reminders` |
| Reading minutes | `5` |
| Published at | `2026-09-21` |
| Published | ✅ |

**Section 1 heading**
```
Why ordinary alarms fail older users
```
**Section 1 body**
```
A plain alarm only says that it is time for something. For someone taking several medicines, that is not enough, and an alarm dismissed by mistake is easily forgotten.

A good medicine reminder says clearly which medicine to take and is hard to miss.
```

**Section 2 heading**
```
Write the full medicine name and routine
```
**Section 2 body**
```
Instead of "Dawai", write "BP ki goli, nashte ke baad" or "Sugar ki dawai, raat ke khane se pehle". The reminder shows this full text when it rings, so there is no confusion.

Always follow the doctor's instructions for the dose and timing. The app only reminds; it does not give medical advice.
```

**Section 3 heading**
```
Set it up on your parent's own phone
```
**Section 3 body**
```
Reminders ring on the phone where the Apka Saathi account is active. So for a parent's medicines, install the app on their phone and set it up with their own account.

The app can be used in Hindi, which many older users find easier than English.
```

**Section 4 heading**
```
Make each dose a daily reminder
```
**Section 4 body**
```
Speak or type the reminder with a repeat, for example "Roz subah 8 baje BP ki goli". For a fixed course you can add an end, such as "15 din tak".

Speaking in Hindi or Hinglish is often quicker than typing on a small screen.
```

**Section 5 heading**
```
A large alert with two simple buttons
```
**Section 5 body**
```
When full-screen alerts are allowed, the reminder appears large on the screen with its full text. Your parent taps "Haan, ho gaya" after taking the medicine, or "5 min baad" to be reminded again in five minutes.

Open "Reminders reliable banao" in the You tab once on their phone, so alerts arrive on time.
```

**Section 6 heading**
```
A second reminder on WhatsApp
```
**Section 6 body**
```
On Saathi Plus, reminders are also sent on WhatsApp and email. WhatsApp reminders go to the phone number verified on that account, so verify the number that has WhatsApp.
```

---

### Blog 5 — Daily / repeating reminders

| Field | Value |
|---|---|
| Title | `Daily Reminder App: Set Repeating Reminders Easily` |
| Slug | `daily-repeating-reminders` |
| Description | `Set daily, weekly or every-few-days reminders once and let them repeat. Learn how repeats, end dates and marking done work in Apka Saathi.` |
| Heading | `Daily reminders: how to set repeating reminders easily` |
| Intro | `A one-time reminder suits a one-time task. Medicines, walks, plant watering and weekly chores come back again and again, and setting a new reminder every time is exactly how routines break.` |
| Tags | `reminders, daily reminders, repeating reminders` |
| Reading minutes | `4` |
| Published at | `2026-09-23` |
| Published | ✅ |

**Section 1 heading**
```
When should a reminder repeat?
```
**Section 1 body**
```
Use a repeating reminder for anything with a regular rhythm: a daily medicine, an evening walk, a weekly call to a relative, or a routine that lasts a fixed number of days.

The goal is to set it once and let it keep coming back.
```

**Section 2 heading**
```
How often can it repeat?
```
**Section 2 body**
```
A reminder can repeat every day, every week or every few days, for example every 2 days or every 15 days.

If you say "har mahine" (every month), it repeats every 30 days. Months are not all 30 days long, so the date shifts slightly over time. For something tied to a fixed calendar date, check the date now and then.
```

**Section 3 heading**
```
Add an end date
```
**Section 3 body**
```
A repeat can run until you switch it off, or stop on its own. Say the end when you create it, such as "90 din tak" or "31 December tak".

This helps with a course of medicine or a short-term routine, so you do not have to remember to turn it off.
```

**Section 4 heading**
```
How to create a repeating reminder
```
**Section 4 body**
```
In the Reminders tab, type or speak the reminder with its rhythm, for example "Roz subah 8 baje BP ki dawai", or tell Saathi in chat. When Saathi understands a repeat, it is shown before you save.

Reminders added from a note offer simple choices too: once, daily or weekly.
```

**Section 5 heading**
```
What happens when you mark it done?
```
**Section 5 body**
```
Tapping "Ho gaya" on a repeating reminder completes only today's occurrence. The next one still comes at its usual time.

For a one-time reminder, "Ho gaya" completes the whole reminder.
```

**Section 6 heading**
```
If you miss one
```
**Section 6 body**
```
If you are busy when it rings, tap "5 min baad" and it reminds you again in five minutes.

Reminders whose time passed without being completed appear under "Chhoot gaye" in the Reminders tab, so nothing disappears silently.
```

---

### Blog 6 — Warranty expiry reminder

| Field | Value |
|---|---|
| Title | `Warranty Expiry Reminder: Never Miss a Warranty Claim` |
| Slug | `warranty-expiry-reminder` |
| Description | `Keep your bill and warranty card in one place, save the warranty end date, and get reminded before it ends so you never miss a free repair or replacement.` |
| Heading | `Warranty expiry reminder: never miss a warranty claim` |
| Intro | `A fridge, phone or washing machine develops a fault, and only then do you start searching for the bill. By the time you find it, the warranty may already be over. Warranties get wasted simply because nothing reminds you they exist.` |
| Tags | `warranties, document reminder, document expiry` |
| Reading minutes | `4` |
| Published at | `2026-09-25` |
| Published | ✅ |

**Section 1 heading**
```
Why warranties get wasted
```
**Section 1 body**
```
A warranty runs quietly in the background from the start date in its terms. The bill goes into a drawer or an inbox, and the end date is forgotten.

When a fault appears, the two things you need, proof of purchase and the warranty end date, are often the hardest to find.
```

**Section 2 heading**
```
What should you keep?
```
**Section 2 body**
```
Keep the purchase bill or invoice and, if the product came with one, the warranty card. Read the warranty terms, because the period and conditions differ between brands and products.

If you bought an extended warranty, keep that document too, with its own end date. Registering the product on the brand's official website can also help with service.
```

**Section 3 heading**
```
Save it in Apka Saathi
```
**Section 3 body**
```
In the Docs tab, tap + and take a photo of the bill or warranty card, or choose a photo or PDF up to 5 MB. Saathi tries to read the document and fill in its name and date.

Set the expiry date as the date the warranty ends. If it is not printed, work it out from the warranty terms and enter it yourself.
```

**Section 4 heading**
```
Get reminded before the warranty ends
```
**Section 4 body**
```
Once the end date is saved, Saathi reminds you 7 days before, 1 day before, and on the day, at 9 in the morning. That leaves time to check the product and raise a claim while it is still covered.
```

**Section 5 heading**
```
When you need to make a claim
```
**Section 5 body**
```
Open the document in the app to view it, share it with the service centre, or download a copy to your phone.

If the warranty is extended, open the document and update its expiry date so the reminders move to the new end date.
```

---

### Blog 7 — Health insurance renewal

| Field | Value |
|---|---|
| Title | `Health Insurance Renewal Reminder: Avoid a Policy Lapse` |
| Slug | `health-insurance-renewal-reminder` |
| Description | `Health insurance renews once a year and is easy to forget. Understand the grace period, why renewing on time matters, and how to get reminded early.` |
| Heading | `Health insurance renewal reminder: how to avoid a policy lapse` |
| Intro | `You rarely think about health insurance until you need it, and that is exactly what makes the renewal date risky. It arrives quietly, often in a busy week, and a late renewal can leave a gap when cover matters most.` |
| Tags | `insurance, health insurance, renewal reminders` |
| Reading minutes | `5` |
| Published at | `2026-09-27` |
| Published | ✅ |

**Section 1 heading**
```
Why renewal dates slip
```
**Section 1 body**
```
Most health insurance policies renew once a year. A yearly date is the hardest to remember, because nothing reminds you about it for the other eleven months.

Renewal messages from the insurer can land in spam, go to an old email address or get lost among other messages.
```

**Section 2 heading**
```
Where to find your renewal date
```
**Section 2 body**
```
Your policy document or policy schedule shows the policy period, including the date the cover ends. That is the date to track.
```

**Section 3 heading**
```
What is a grace period?
```
**Section 3 body**
```
According to the insurance regulator IRDAI, a grace period is the time right after the premium due date during which you can pay to renew or continue the policy without losing continuity benefits, such as waiting periods and coverage of pre-existing diseases.

IRDAI also notes that coverage is not available for the period for which no premium has been received. The length of the grace period and how it applies can depend on your policy and how you pay, so check your policy wording or ask your insurer instead of relying on it.
```

**Section 4 heading**
```
Why you should renew before the due date
```
**Section 4 body**
```
Renewing before the due date avoids any doubt about cover and gives you time to review your plan, update family members on the policy and complete the payment without rushing.
```

**Section 5 heading**
```
Get reminded in Apka Saathi
```
**Section 5 body**
```
In the Docs tab, tap + and add the policy as a photo or PDF. Saathi tries to read the policy name and expiry date. Check the date and save.

Saathi then reminds you 7 days before the expiry date, 1 day before, and on the day, at 9 in the morning. On Saathi Plus the reminder also comes by email and WhatsApp.
```

**Section 6 heading**
```
After you renew
```
**Section 6 body**
```
Open the policy in the app and tap "Renew ho gaya? Nayi expiry daalo". Add a photo of the new policy if you like, and enter the new end date.

The earlier version is kept under older versions, and the reminders move to the new date.
```

---

### Blog 8 — Update document after renewal

| Field | Value |
|---|---|
| Title | `Renewed a Document? Update Its Expiry Date` |
| Slug | `update-document-expiry-after-renewal` |
| Description | `Renewed your licence, policy or passport? Update the new expiry date so your reminders move to the right date, and keep the old version for reference.` |
| Heading | `Renewed a document? Update its expiry date in seconds` |
| Intro | `Tracking an expiry date is only half the job. The moment you renew a document, the old date becomes wrong, and reminders based on a wrong date are almost as bad as having no reminders at all.` |
| Tags | `document reminder, renewal reminders, document management` |
| Reading minutes | `4` |
| Published at | `2026-09-29` |
| Published | ✅ |

**Section 1 heading**
```
Why updating the date matters
```
**Section 1 body**
```
If you renew a document but keep the old expiry date, you either get reminders for something already done, or no reminder before the new date.

Updating the date right after renewal keeps your reminders useful for the next cycle.
```

**Section 2 heading**
```
How to update the expiry date
```
**Section 2 body**
```
In Apka Saathi, open the document and tap "Renew ho gaya? Nayi expiry daalo".

Enter the new expiry date. You can also add a photo of the renewed document, and Saathi tries to read the new date from it. The document's name and type stay the same, because it is still the same document.
```

**Section 3 heading**
```
Your old version is kept
```
**Section 3 body**
```
When you save, the earlier version is kept under older versions, with its old expiry date, so you can still see the document as it was before renewal.
```

**Section 4 heading**
```
Reminders move to the new date
```
**Section 4 body**
```
After you save, reminders are set for the new expiry date: 7 days before, 1 day before and on the day.

If you remove the expiry date, the app tells you that no reminder will come for that document.
```

**Section 5 heading**
```
Where to find renewal steps
```
**Section 5 body**
```
For some documents the app shows general renewal steps and a link to the official website. Processes and fees change, so always confirm the details on the official site before you start.
```

**Section 6 heading**
```
When it is a different document
```
**Section 6 body**
```
If you received a completely different document rather than a renewed version of the same one, add it as a new document. That keeps each document's history clear.
```

---

### Blog 9 — Keep documents safe on your phone

| Field | Value |
|---|---|
| Title | `How to Keep Important Documents Safe on Your Phone` |
| Slug | `keep-important-documents-safe-on-phone` |
| Description | `Photos of your ID, policies and certificates should not sit in an open gallery. Keep them in one place behind a PIN or fingerprint lock on your phone.` |
| Heading | `How to keep important documents safe on your phone` |
| Intro | `Many people keep photos of their licence, passport and insurance policies in the phone gallery, mixed with family pictures and forwarded messages. It is convenient, but anyone holding your unlocked phone can scroll straight to them.` |
| Tags | `document management, important documents, app lock` |
| Reading minutes | `5` |
| Published at | `2026-10-01` |
| Published | ✅ |

**Section 1 heading**
```
The problem with keeping documents in the gallery
```
**Section 1 body**
```
A gallery is built for sharing and scrolling, not for sensitive documents. Documents get lost among hundreds of photos and are visible to anyone using your phone.

Keeping important documents in a separate, locked place solves both problems.
```

**Section 2 heading**
```
Lock the app with a PIN or fingerprint
```
**Section 2 body**
```
Apka Saathi has an App lock. Turn it on from the You tab and set a 4-digit PIN. On phones that support it, you can also unlock with your fingerprint or face.

After that, the app does not open without your PIN or biometric unlock.
```

**Section 3 heading**
```
What if you forget the PIN?
```
**Section 3 body**
```
Tap "PIN bhool gaye? Email se badlo". A 6-digit code is sent to your account's email address, and after entering it you can set a new PIN.
```

**Section 4 heading**
```
Your documents stay with your account
```
**Section 4 body**
```
Documents you add are saved to your account, not only to one phone. If you change phones, log in with the same account and your documents are there.

If an upload cannot finish on a weak connection, the app can keep the document on the phone and upload it automatically when the internet is back.
```

**Section 5 heading**
```
A new phone needs your approval
```
**Section 5 body**
```
When your account is used on a new phone, the app asks for approval with a code sent to your email. Reminders for one account ring on one phone at a time, so the same reminder does not go off on two devices.
```

**Section 6 heading**
```
Share only what you choose
```
**Section 6 body**
```
When someone needs a copy, open that document and share or download just that file. You can also select a few documents and share them together, without handing over your whole gallery.
```

---

### Blog 10 — WhatsApp and email reminders

| Field | Value |
|---|---|
| Title | `WhatsApp Reminders: Get Alerts on WhatsApp and Email` |
| Slug | `whatsapp-reminders-and-email-alerts` |
| Description | `Phone notifications get swiped away. See how Saathi Plus sends your reminders and document expiry alerts on WhatsApp and email, and how to set it up.` |
| Heading | `WhatsApp reminders: get your alerts on WhatsApp and email` |
| Intro | `A phone notification is easy to miss. The phone is in another room, the alert gets swiped away, or it arrives during a meeting. For things that really matter, a second place to see the reminder makes all the difference.` |
| Tags | `reminders, whatsapp reminders, saathi plus` |
| Reading minutes | `4` |
| Published at | `2026-10-03` |
| Published | ✅ |

**Section 1 heading**
```
Why a second channel helps
```
**Section 1 body**
```
You check WhatsApp and email many times a day. A reminder waiting there is still visible later, even if you missed the moment the phone notification came.

That matters most for document expiry dates, where a missed alert can mean a missed renewal.
```

**Section 2 heading**
```
What the free plan includes
```
**Section 2 body**
```
Apka Saathi is free to start. The free plan includes reminders on your phone, voice and text reminders, and document expiry reminders, with a limit on how many active reminders and documents you can keep.
```

**Section 3 heading**
```
What Saathi Plus adds
```
**Section 3 body**
```
Saathi Plus gives you unlimited reminders and documents, AI Saathi with smart chat and a daily brief, and reminders on email and WhatsApp in addition to phone notifications.

Both your reminders and your document expiry alerts are sent on these channels.
```

**Section 4 heading**
```
How to set up WhatsApp reminders
```
**Section 4 body**
```
WhatsApp reminders go only to a verified phone number. Open You, then "Meri details", enter the number that has WhatsApp, and verify it with the code sent by SMS.

One wrong digit would send your reminders to someone else, which is why the number is verified first.
```

**Section 5 heading**
```
How to get Saathi Plus
```
**Section 5 body**
```
Open You and then Saathi Plus in the app. Choose a monthly or yearly plan; the yearly plan includes two months free. Payment goes through Google Play using UPI, card or netbanking.

The price is shown in the app based on your Google Play country.
```

**Section 6 heading**
```
Earn Plus by inviting friends
```
**Section 6 body**
```
With Refer & Earn, when a friend joins with your code, adds their first document and sets a reminder, both of you get free days of Saathi Plus. Find your code under You, then Refer & Earn.
```

---

## 5. Website par blog ke alawa galat daave (code / admin me)

| Kahan | Kya likha hai | Sach |
|---|---|---|
| Homepage "Document expiry reminders" — `web/lib/i18n/dictionaries.ts` line 457 (Hinglish), 1653 (English) | "14 din, 3 din aur usi din" | **7 din, 1 din, usi din** (subah 9 baje) |
| Wahi block | Passport, **Aadhaar**… "expiry date khud padh leta hai" | Aadhaar ki expiry nahi hoti |
| `web/app/layout.tsx` line 46, 144 | "before your passport, **Aadhaar**… **expires**" | Aadhaar expire nahi hota |
| Admin → SEO → `/` description | Wahi Aadhaar line | Admin se badlo |
| `web/app/blog/page.tsx` line 16 | "**Aadhaar renewals**" | "Aadhaar updates" |
| Homepage badge | "100% private" | Saabit karna mushkil — "Private by design" behtar |
| `web/lib/blog.ts` (seed, DB khaali hone par hi dikhta) | "fourteen days… three days" | 7 / 1 / 0 din |
| `web/lib/i18n/dictionaries.ts` kai jagah | `â` toota akshar | `—` hona chahiye |

Bolo to code wale main theek kar dunga.

---

## 6. Fact sheet — blog ki har app-baat ka source

| Daava | Kahan se pakka kiya |
|---|---|
| Document expiry reminder: 7 din, 1 din, usi din, subah 9 baje | `app-mobile/src/utils/expiry.ts` (`EXPIRY_LEAD_DAYS = [7, 1, 0]`, `NOTIFY_HOUR = 9`); `web/app/api/cron/document-expiry/route.ts` |
| Photo ya PDF, 5 MB tak; Saathi naam + expiry padhta hai | `add-document.tsx`; dictionary `fileTooBig`, `photoSub` |
| Aadhaar/PAN ki expiry nahi — bina expiry reminder nahi | App dictionary `noExpiryBody` |
| Voice: mic, internet, phone ki voice typing | Dictionary `voice` |
| Chat me bola message ~2 sec me jaata hai, "Roko" | `chat.tsx` `VOICE_SEND_DELAY_MS = 2200` |
| Repeat: roz, har hafte, har N din; "har mahine" = 30 din; end date | AI prompt; `repeat-label.ts`; `repeatFields` |
| Note se reminder: ek baar / roz / har hafte | Dictionary `noteReminder` |
| Roz wale par "Ho gaya" sirf aaj | `complete_reminder` |
| "5 min baad"; "Chhoot gaye" | Dictionary `alertLater`, `reminders.missed` |
| Reliable setup + test alarm + Alert ki awaaz | Dictionary `reliability`, `settings.alertMode`; `permission-modal.tsx` |
| Full-screen alert (app me hai, user ek baar allow kare) | `plugins/with-fullscreen-notifications.js`, `reminder-alert.tsx`, dictionary `stepFsi` |
| App lock: 4 ank PIN, fingerprint/face, email 6 ank code | Dictionary `lock` |
| Naya phone email code se; ek waqt ek phone | `device-approval-gate.tsx` |
| Kamzor net par "Phone par rakho", baad me upload | Dictionary `uploadFailedMsg`; `doc-upload-queue.ts` |
| Share / download / kai documents share | Dictionary `documents.*` |
| Renew: "Renew ho gaya? Nayi expiry daalo", purane versions, official site steps | Dictionary `renewDoc`, `documents.versions*`, `renewVerifyNote` |
| Plus: unlimited, AI Saathi (chat + brief), email + WhatsApp | Dictionary `upgrade.plusFeatures`; cron `send-reminders` |
| WhatsApp ke liye number verify (SMS OTP) | Dictionary `whatsappSetup`, `profileDetails.verifyWhy` |
| Mahina/saal, saal me 2 mahine free, Google Play (UPI, card, netbanking) | Dictionary `upgrade.yearlyTab`, `payNote` |
| Refer & Earn: code + pehla document + ek reminder = dono ko Plus din | Dictionary `referral.heroSub` |
| Hindi me app | App dictionary `hi` locale |
