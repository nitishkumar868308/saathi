-- Apka Saathi — "ye document renew kaise karein" (har desh ke liye)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
--
-- Soch: user ko sirf ye batana kaafi nahi ki document expire ho raha hai. Uske
-- baad ka sawaal hamesha ek hi hota hai — "ab karun kya?". Ab tak app us sawaal
-- par chup thi.
--
-- ⚠️ Ye content CODE me hardcode nahi ho sakta: sarkari portal ke URL badalte
-- rehte hain, fees badalti hai, aur process har desh me alag hai. Hardcode ka
-- matlab hota har chhote badlaav par poora app release — us soorat me link kabhi
-- update hote hi nahi, aur PURANA link na hone se bhi bura hota hai.
--
-- ⚠️ Aur sabse zaroori: ye SIRF India ke liye nahi hai. App har desh me chalti
-- hai (dekho `country_pricing`), aur "renew kaise karein" ka jawab har us user
-- ko milna chahiye — chahe uske desh ka curated content abhi bana ho ya nahi.
--
-- Isliye do parat:
--
--   country = '<ISO2>'  — us desh ka apna, saaf-suthra content (sabse pehle)
--   country = '*'       — har desh ke liye chalne wala jawab (safety net)
--
-- '*' wale jawab jaan-boojh ke desh-nirpeksh likhe gaye hain: wo kisi sarkari
-- portal ka naam nahi lete, balki wo tareeka batate hain jo har jagah kaam
-- karta hai ("document par likhi sanstha dhoondo, uski official site par jao").
-- Isse pehle hi din se har desh ke user ko kuch na kuch kaam ka milta hai, aur
-- galat (doosre desh ka) link kabhi nahi dikhta.

/* ------------------------------------------------------------------ */
/*  1. Table                                                           */
/* ------------------------------------------------------------------ */

create table if not exists public.document_renewal_guides (
  -- documents.type: car | license | passport | fastag | warranty | health | other
  doc_type   text not null,
  -- ISO2 (IN, US, AE…) ya '*' = har desh.
  country    text not null default '*',

  -- Official renewal link. NULL bilkul theek hai — kai cheezon ka koi ek sarkari
  -- portal hota hi nahi (insurance, warranty). Aise me steps hi poora jawab hain.
  url        text,
  -- Kaun karta hai — "RTO / Parivahan", "Passport Seva". Bharosa isi se aata hai.
  authority  text,

  /*
   * Teeno bhashaon ka matn ek hi jagah:
   *   { "hinglish": { "title": "...", "steps": ["..."], "note": "..." },
   *     "hi": {...}, "en": {...} }
   *
   * Alag row per locale rakhne ka matlab hota admin ko har cheez TEEN baar
   * likhni — aur practice me teesri bhasha hamesha adhoori reh jaati. Admin ek
   * baar likhta hai, save par Gemini baaki do bana deta hai (wahi raasta jo
   * broadcast message ka hai — `web/lib/translate.ts`).
   */
  content    jsonb not null default '{}'::jsonb,

  /*
   * Kisi insaan ne ise dekha hai ya nahi.
   *
   * true  = admin ne khud likha/jaancha — ispar poora bharosa hai
   * false = AI se bana hai, abhi kisi ne verify nahi kiya
   *
   * App dono dikhati hai, par unreviewed ke saath saaf likh deti hai ki ise
   * official site par jaanch lena. Ye baat chhupana galat hoga: galat sarkari
   * process ki salah se user ka waqt aur paisa dono ja sakta hai.
   */
  reviewed   boolean not null default false,

  updated_at timestamptz not null default now(),

  primary key (doc_type, country)
);

create index if not exists renewal_guides_country_idx
  on public.document_renewal_guides (country);

/* ------------------------------------------------------------------ */
/*  2. RLS — sab padh sakte hain, likhna sirf admin                     */
/* ------------------------------------------------------------------ */

-- Content public hai (sarkari process ki aam jaankari), isliye padhne me rok
-- nahi. App ise bina kisi extra permission ke cache kar leti hai.
alter table public.document_renewal_guides enable row level security;

drop policy if exists "read renewal guides" on public.document_renewal_guides;
create policy "read renewal guides"
  on public.document_renewal_guides for select using (true);

-- Likhna sirf service_role (admin API) se — koi client policy nahi.

/* ------------------------------------------------------------------ */
/*  3. HAR DESH ke liye jawab (country = '*')                           */
/* ------------------------------------------------------------------ */

-- Ye sabse zaroori rows hain — 190+ desh me se jiska bhi curated content nahi
-- bana, use YAHI dikhta hai. Isliye teeno bhasha yahin bhar di gayi hain, aur
-- koi bhi step kisi ek desh ki baat nahi karta.

insert into public.document_renewal_guides (doc_type, country, url, authority, reviewed, content) values

('license', '*', null, null, true, '{
 "hinglish":{"title":"Driving licence renew karna",
  "steps":["Licence par dekho use kaunsa transport department ya motor authority ne jaari kiya hai.",
           "Us authority ki OFFICIAL website kholo (search me uska poora naam likho, sirf \"licence renew\" nahi).",
           "Renewal ka form online bharo, ya unka office/centre jaake.",
           "Aksar chahiye hota hai: purana licence, ek photo ID, photo, aur kai jagah medical/eye test.",
           "Fees bhar ke rasid sambhal lo, aur naya licence milte hi uski nayi expiry Saathi me daal do."],
  "note":"Zyadatar deshon me expire hone ke baad thodi mohlat milti hai, par uske baad dobara test dena pad sakta hai. Expiry se pehle karna hamesha sasta aur aasan padta hai."},
 "hi":{"title":"ड्राइविंग लाइसेंस रिन्यू करना",
  "steps":["लाइसेंस पर देखें कि उसे कौन से ट्रांसपोर्ट डिपार्टमेंट या मोटर अथॉरिटी ने जारी किया है।",
           "उस अथॉरिटी की आधिकारिक वेबसाइट खोलें (सर्च में उसका पूरा नाम लिखें, सिर्फ़ \"licence renew\" नहीं)।",
           "रिन्यूअल का फ़ॉर्म ऑनलाइन भरें, या उनके ऑफ़िस/सेंटर जाकर।",
           "अक्सर चाहिए होता है: पुराना लाइसेंस, एक फ़ोटो आईडी, फ़ोटो, और कई जगह मेडिकल/आँखों का टेस्ट।",
           "फ़ीस भरकर रसीद सँभाल लें, और नया लाइसेंस मिलते ही उसकी नई एक्सपायरी साथी में डाल दें।"],
  "note":"ज़्यादातर देशों में एक्सपायर होने के बाद थोड़ी मोहलत मिलती है, पर उसके बाद दोबारा टेस्ट देना पड़ सकता है। एक्सपायरी से पहले करना हमेशा सस्ता और आसान पड़ता है।"},
 "en":{"title":"Renewing your driving licence",
  "steps":["Check the licence to see which transport department or motor authority issued it.",
           "Open that authority''s OFFICIAL website (search their full name, not just \"licence renew\").",
           "Fill in the renewal form online, or visit their office/centre.",
           "You will usually need: your old licence, a photo ID, a photo, and in many places a medical or eye test.",
           "Pay the fee, keep the receipt, and add the new expiry date to Saathi as soon as you get the licence."],
  "note":"Most countries allow a short grace period after expiry, but after that you may have to retake the test. Doing it before expiry is always cheaper and simpler."}}'::jsonb),

('passport', '*', null, null, true, '{
 "hinglish":{"title":"Passport renew karna",
  "steps":["Passport ke andar dekho kis desh ki sarkar ne ise jaari kiya hai.",
           "Us desh ke passport office ya foreign/interior ministry ki OFFICIAL site kholo.",
           "Renewal ya \"re-issue\" ka form bharo aur fees online bharo.",
           "Appointment book karo aur bataye gaye kagaz le ke jao — purana passport, photo, aur address/identity proof.",
           "Doosre desh me raho to apne desh ke embassy/consulate se hota hai."],
  "note":"Expiry se 6-12 mahine PEHLE apply karna theek rehta hai. Kai desh entry ke liye kam se kam 6 mahine ki validity maangte hain — yaani passport \"chalu\" hote hue bhi safar rok sakta hai."},
 "hi":{"title":"पासपोर्ट रिन्यू करना",
  "steps":["पासपोर्ट के अंदर देखें कि किस देश की सरकार ने इसे जारी किया है।",
           "उस देश के पासपोर्ट ऑफ़िस या विदेश/गृह मंत्रालय की आधिकारिक साइट खोलें।",
           "रिन्यूअल या \"री-इशू\" का फ़ॉर्म भरें और फ़ीस ऑनलाइन भरें।",
           "अपॉइंटमेंट बुक करें और बताए गए काग़ज़ ले जाएँ — पुराना पासपोर्ट, फ़ोटो, और पता/पहचान का प्रमाण।",
           "दूसरे देश में रहते हों तो यह अपने देश के दूतावास/वाणिज्य दूतावास से होता है।"],
  "note":"एक्सपायरी से 6-12 महीने पहले आवेदन करना ठीक रहता है। कई देश प्रवेश के लिए कम से कम 6 महीने की वैधता माँगते हैं — यानी पासपोर्ट \"चालू\" होते हुए भी यात्रा रोक सकता है।"},
 "en":{"title":"Renewing your passport",
  "steps":["Look inside the passport to see which government issued it.",
           "Open the OFFICIAL site of that country''s passport office or foreign/interior ministry.",
           "Fill in the renewal or \"re-issue\" form and pay the fee online.",
           "Book an appointment and bring the documents they list — old passport, photos, and proof of identity/address.",
           "If you live abroad, this is handled by your country''s embassy or consulate."],
  "note":"Apply 6-12 months before expiry. Many countries require at least 6 months of validity to let you in — so a passport that is still \"valid\" can stop you travelling."}}'::jsonb),

('car', '*', null, null, true, '{
 "hinglish":{"title":"Vehicle insurance renew karna",
  "steps":["Purani policy nikaalo — usme company ka naam aur policy number hoga.",
           "Usi company ki app/website par policy number se renew karo.",
           "Ya do-teen aur companies se daam compare karo — insurance kabhi bhi badla ja sakta hai.",
           "Agar pichhle saal koi claim nahi kiya, to no-claim discount maangna mat bhoolo.",
           "Nayi policy phone me save karo aur uski expiry Saathi me daal do."],
  "note":"Zyadatar deshon me gaadi ka insurance kanoonan zaroori hai. Beech me gap pad jaye to na sirf jurmana lagta hai, aksar wo no-claim discount bhi chala jaata hai jo saalon me bana tha."},
 "hi":{"title":"गाड़ी का इंश्योरेंस रिन्यू करना",
  "steps":["पुरानी पॉलिसी निकालें — उसमें कंपनी का नाम और पॉलिसी नंबर होगा।",
           "उसी कंपनी की ऐप/वेबसाइट पर पॉलिसी नंबर से रिन्यू करें।",
           "या दो-तीन और कंपनियों से दाम की तुलना करें — इंश्योरेंस कभी भी बदला जा सकता है।",
           "अगर पिछले साल कोई क्लेम नहीं किया, तो नो-क्लेम डिस्काउंट माँगना न भूलें।",
           "नई पॉलिसी फ़ोन में सेव करें और उसकी एक्सपायरी साथी में डालें।"],
  "note":"ज़्यादातर देशों में गाड़ी का इंश्योरेंस क़ानूनन ज़रूरी है। बीच में गैप पड़ जाए तो न सिर्फ़ जुर्माना लगता है, अक्सर वह नो-क्लेम डिस्काउंट भी चला जाता है जो सालों में बना था।"},
 "en":{"title":"Renewing your vehicle insurance",
  "steps":["Find your old policy — it has the insurer''s name and the policy number.",
           "Renew on that insurer''s app or website using the policy number.",
           "Or compare prices with two or three other insurers — you can switch at renewal.",
           "If you made no claim last year, ask for your no-claim discount.",
           "Save the new policy on your phone and add its expiry to Saathi."],
  "note":"Vehicle insurance is legally required in most countries. A gap in cover can mean a fine, and it often wipes out the no-claim discount you built up over years."}}'::jsonb),

('health', '*', null, null, true, '{
 "hinglish":{"title":"Health / life insurance renew karna",
  "steps":["Policy document se company ka naam aur policy number nikaalo.",
           "Unki app/website par login karke renewal premium bhar do.",
           "Renew karte waqt cover ki raqam dobara dekho — ilaaj mehnga hota jaata hai, cover utna hi rehta hai.",
           "Nayi policy copy phone me save karo aur expiry Saathi me daal do."],
  "note":"Sabse badi baat: policy lapse mat hone do. Zyadatar jagah thodi grace period milti hai, par uske baad nayi policy leni padti hai — aur tab purani bimariyon ka waiting period phir se shuru ho sakta hai. Yahi is list ka sabse mehnga nuksan hai."},
 "hi":{"title":"हेल्थ / लाइफ़ इंश्योरेंस रिन्यू करना",
  "steps":["पॉलिसी डॉक्युमेंट से कंपनी का नाम और पॉलिसी नंबर निकालें।",
           "उनकी ऐप/वेबसाइट पर लॉगिन करके रिन्यूअल प्रीमियम भर दें।",
           "रिन्यू करते समय कवर की रक़म दोबारा देखें — इलाज महँगा होता जाता है, कवर उतना ही रहता है।",
           "नई पॉलिसी कॉपी फ़ोन में सेव करें और एक्सपायरी साथी में डालें।"],
  "note":"सबसे बड़ी बात: पॉलिसी लैप्स मत होने दें। ज़्यादातर जगह थोड़ी ग्रेस पीरियड मिलती है, पर उसके बाद नई पॉलिसी लेनी पड़ती है — और तब पुरानी बीमारियों का वेटिंग पीरियड फिर से शुरू हो सकता है। यही इस सूची का सबसे महँगा नुक़सान है।"},
 "en":{"title":"Renewing your health or life insurance",
  "steps":["Get the insurer''s name and policy number from your policy document.",
           "Log in to their app or website and pay the renewal premium.",
           "While renewing, check your cover amount again — treatment gets more expensive, the cover does not grow by itself.",
           "Save the new policy on your phone and add its expiry to Saathi."],
  "note":"The big one: do not let the policy lapse. Most insurers allow a short grace period, but after that you need a new policy — and waiting periods for existing conditions can start all over again. This is the most expensive mistake on this list."}}'::jsonb),

('fastag', '*', null, null, true, '{
 "hinglish":{"title":"Toll tag recharge ya badalna",
  "steps":["Tag ke peeche ya apni app me dekho kis bank/company ne ise jaari kiya.",
           "Usi ki app ya website se balance recharge karo.",
           "Tag purana ho gaya ho ya padhna band kar de, to issuer se naya maango.",
           "Gaadi bech di ho to purana tag band karwana mat bhoolo — warna doosre ka toll aapse katega."],
  "note":"Recharge aur tag badalna do alag baatein hain: balance khatam hona aam hai, tag khud kai saal chalta hai. Adhoori KYC par kai jagah tag block ho jaata hai."},
 "hi":{"title":"टोल टैग रिचार्ज या बदलना",
  "steps":["टैग के पीछे या अपनी ऐप में देखें कि किस बैंक/कंपनी ने इसे जारी किया।",
           "उसी की ऐप या वेबसाइट से बैलेंस रिचार्ज करें।",
           "टैग पुराना हो गया हो या पढ़ना बंद कर दे, तो जारीकर्ता से नया माँगें।",
           "गाड़ी बेच दी हो तो पुराना टैग बंद करवाना न भूलें — वरना दूसरे का टोल आपसे कटेगा।"],
  "note":"रिचार्ज और टैग बदलना दो अलग बातें हैं: बैलेंस ख़त्म होना आम है, टैग ख़ुद कई साल चलता है। अधूरी केवाईसी पर कई जगह टैग ब्लॉक हो जाता है।"},
 "en":{"title":"Topping up or replacing your toll tag",
  "steps":["Check the back of the tag or your app to see which bank or company issued it.",
           "Top up the balance through their app or website.",
           "If the tag is old or stops being read, ask the issuer for a replacement.",
           "If you sold the vehicle, close the old tag — otherwise someone else''s tolls come out of your account."],
  "note":"Topping up and replacing are different things: running out of balance is normal, the tag itself lasts several years. Incomplete KYC gets tags blocked in many places."}}'::jsonb),

('warranty', '*', null, null, true, '{
 "hinglish":{"title":"Warranty khatam ho rahi hai",
  "steps":["Bill aur warranty card dono sambhal ke rakho — claim me dono maange jaate hain.",
           "Koi bhi kharabi hai to warranty khatam hone se PEHLE service centre me claim kar do.",
           "Bade saamaan par brand extended warranty ya service plan bechte hain — expiry se pehle lena hamesha sasta padta hai.",
           "Extended warranty lo to uski nayi expiry Saathi me daal do."],
  "note":"Warranty \"renew\" nahi hoti — wo bas khatam ho jaati hai. Uski jagah extended warranty ya service plan aata hai, aur wo aksar sirf expiry se pehle hi milta hai. Isliye ye reminder aakhri mauka hota hai."},
 "hi":{"title":"वारंटी ख़त्म हो रही है",
  "steps":["बिल और वारंटी कार्ड दोनों सँभालकर रखें — क्लेम में दोनों माँगे जाते हैं।",
           "कोई भी ख़राबी है तो वारंटी ख़त्म होने से पहले सर्विस सेंटर में क्लेम कर दें।",
           "बड़े सामान पर ब्रांड एक्सटेंडेड वारंटी या सर्विस प्लान बेचते हैं — एक्सपायरी से पहले लेना हमेशा सस्ता पड़ता है।",
           "एक्सटेंडेड वारंटी लें तो उसकी नई एक्सपायरी साथी में डालें।"],
  "note":"वारंटी \"रिन्यू\" नहीं होती — वह बस ख़त्म हो जाती है। उसकी जगह एक्सटेंडेड वारंटी या सर्विस प्लान आता है, और वह अक्सर सिर्फ़ एक्सपायरी से पहले ही मिलता है। इसलिए यह रिमाइंडर आख़िरी मौक़ा होता है।"},
 "en":{"title":"Your warranty is ending",
  "steps":["Keep both the bill and the warranty card — claims usually need both.",
           "If anything is faulty, raise the claim BEFORE the warranty ends.",
           "For larger items, brands sell extended warranties or service plans — buying before expiry is almost always cheaper.",
           "If you buy an extension, add its new expiry to Saathi."],
  "note":"A warranty is not renewed — it simply ends. What replaces it is an extended warranty or service plan, and that is often only offered before expiry. So this reminder is your last chance."}}'::jsonb),

('other', '*', null, null, true, '{
 "hinglish":{"title":"Ye document renew karna",
  "steps":["Document par dekho use kis sanstha ne jaari kiya hai — naam aksar upar ya neeche likha hota hai.",
           "Usi sanstha ki OFFICIAL website kholo (search result ka pehla link zaroori nahi ki official ho).",
           "Renewal ka tareeka, fees aur zaroori kagaz waha se padho.",
           "Kagaz pehle se ikattha kar lo — aksar photo, identity proof aur purana document chahiye hota hai.",
           "Naya document milte hi uski nayi expiry Saathi me daal do."],
  "note":"Aise document ka koi ek tay raasta nahi hota. Support me batayein ye kaunsa document hai — hum uska poora tareeka yahan jod denge."},
 "hi":{"title":"यह डॉक्युमेंट रिन्यू करना",
  "steps":["डॉक्युमेंट पर देखें उसे किस संस्था ने जारी किया है — नाम अक्सर ऊपर या नीचे लिखा होता है।",
           "उसी संस्था की आधिकारिक वेबसाइट खोलें (सर्च रिज़ल्ट का पहला लिंक ज़रूरी नहीं कि आधिकारिक हो)।",
           "रिन्यूअल का तरीक़ा, फ़ीस और ज़रूरी काग़ज़ वहीं से पढ़ें।",
           "काग़ज़ पहले से इकट्ठा कर लें — अक्सर फ़ोटो, पहचान प्रमाण और पुराना डॉक्युमेंट चाहिए होता है।",
           "नया डॉक्युमेंट मिलते ही उसकी नई एक्सपायरी साथी में डाल दें।"],
  "note":"ऐसे डॉक्युमेंट का कोई एक तय रास्ता नहीं होता। सपोर्ट में बताएँ यह कौन सा डॉक्युमेंट है — हम उसका पूरा तरीक़ा यहाँ जोड़ देंगे।"},
 "en":{"title":"Renewing this document",
  "steps":["Check the document to see which body issued it — the name is usually at the top or bottom.",
           "Open that body''s OFFICIAL website (the first search result is not always the official one).",
           "Read their renewal process, fees and required documents there.",
           "Gather the paperwork in advance — usually a photo, proof of identity, and the old document.",
           "As soon as you get the new document, add its expiry to Saathi."],
  "note":"There is no single process for documents like this. Tell us in Support which document it is and we will add the full process here."}}'::jsonb)

on conflict (doc_type, country) do nothing;

/* ------------------------------------------------------------------ */
/*  4. India ka apna content (country = 'IN')                           */
/* ------------------------------------------------------------------ */

-- ⚠️ Ye sirf SHURUAAT hai, aakhri sach nahi. Sarkari URL aur process badalte
-- rehte hain — admin panel me ek baar jaanch lena chahiye. `do nothing` isliye
-- ki dobara run karne par admin ka sudhaara content purana na ho jaye.
--
-- Sirf hinglish bhari hai; admin panel ka "Translate" ek click me hi aur en
-- bana deta hai (`web/lib/translate.ts`). App tab tak hinglish par gir jaati hai.

insert into public.document_renewal_guides (doc_type, country, url, authority, reviewed, content) values

('license', 'IN', 'https://parivahan.gov.in/parivahan/', 'Parivahan Sewa / RTO', false, '{
 "hinglish":{"title":"Driving Licence renew karna",
  "steps":["Parivahan Sewa ki site kholo aur apna state chuno.",
           "\"Online Services\" me \"Driving Licence Related Services\" chuno.",
           "Licence number aur date of birth daal ke apna record nikaalo.",
           "\"Apply for DL Renewal\" chuno aur form bharo.",
           "40 saal se upar ho to Form 1A (medical certificate) lagana zaroori hai.",
           "Fees online bharo, slot book karo, aur us din RTO jaake biometric/photo karwao."],
  "note":"Expiry ke 1 saal baad tak aksar bina naye test ke renew ho jaata hai. Uske baad dobara test dena pad sakta hai — isliye der mat karo."}}'::jsonb),

('passport', 'IN', 'https://www.passportindia.gov.in/', 'Passport Seva, Ministry of External Affairs', false, '{
 "hinglish":{"title":"Passport renew karna (re-issue)",
  "steps":["Passport Seva par login karo (naya ho to pehle register karo).",
           "\"Apply for Fresh Passport/Re-issue of Passport\" chuno.",
           "Form me \"Re-issue\" chuno aur wajah me \"Validity Expired\" daalo.",
           "Form bhar ke fees online bharo.",
           "Passport Seva Kendra (PSK) ka appointment book karo.",
           "Appointment wale din purana passport, address proof aur photo le ke jao."],
  "note":"Expiry se 1 saal PEHLE bhi apply kar sakte ho. Bahar jaana ho to dhyan rakho — kai desh 6 mahine se zyada validity maangte hain."}}'::jsonb),

('car', 'IN', null, 'Aapki insurance company', false, '{
 "hinglish":{"title":"Vehicle insurance renew karna",
  "steps":["Purani policy nikaalo — usme insurer ka naam aur policy number hoga.",
           "Usi company ki app/website par policy number se renew karo.",
           "Ya doosri companies se compare karke naya le lo — renewal par insurer badla ja sakta hai.",
           "No Claim Bonus (NCB) zaroor claim karo — usse premium kaafi kam ho jaata hai.",
           "Nayi policy phone me save karo aur Saathi me daal do."],
  "note":"India me Third Party insurance kanoonan zaroori hai. Expire hone ke baad 90 din se zyada gap ho jaye to NCB khatam ho jaata hai."}}'::jsonb),

('fastag', 'IN', null, 'Aapka FASTag issuer (bank / NHAI)', false, '{
 "hinglish":{"title":"FASTag recharge ya badalna",
  "steps":["Dekho FASTag kis bank ya wallet se liya tha (tag ke peeche likha hota hai).",
           "Usi bank ki app, ya My FASTag app se recharge karo.",
           "Tag kai saal baad ya kharab hone par badalna padta hai — tab issuer se naya lo.",
           "Gaadi bech di ho to purana tag band karwana mat bhoolo."],
  "note":"Recharge aur tag badalna alag baatein hain. KYC adhoori ho to tag blacklist ho sakta hai."}}'::jsonb)

on conflict (doc_type, country) do nothing;

/* ------------------------------------------------------------------ */
/*  5. Jaanch                                                          */
/* ------------------------------------------------------------------ */

-- Har doc_type ke liye '*' row honi hi chahiye — wahi safety net hai.
--   select doc_type, count(*) filter (where country = '*') as global
--     from public.document_renewal_guides group by doc_type;
