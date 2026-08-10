/**
 * Aakhri sahara — jab Play se daam kahin se bhi na mile.
 *
 * ── Ye "manual price" nahi hai ────────────────────────────────────────────
 * Pehle admin panel me ek editable base price (₹99/₹999) aur 250 desh ki
 * conversion-rate table thi. Wo poori cheez hata di gayi, aur jaan-boojh ke:
 * daam do jagah set hone ka natija hamesha ek hi hota tha — website ek number
 * dikhati aur Play doosra kaat leta. Ab daam ka ek hi maalik hai, Play Console.
 *
 * Ye constant us jagah ki bhaari-bharkam nakal nahi hai. Iski ek hi naukri hai:
 * pehli deploy par, jab sync abhi ek baar bhi nahi chala, price ka khaana khaali
 * na dikhe. `play_prices` DB me rehta hai aur sync fail hone par mit'ta nahi,
 * isliye normal chalte hue system me ye kabhi dikhta hi nahi.
 *
 * ⚠️ Ise admin se editable mat banana. Editable hote hi wahi purani bimari
 *    lautegi — do maalik, aur ek din dono alag.
 *
 * Client component (Pricing.tsx) bhi isse import karta hai, isliye ye file
 * jaan-boojh ke bilkul khaali rakhi gayi hai: koi env nahi, koi node import
 * nahi. `lib/pricing.ts` import karte hi poora Play/Google stack browser bundle
 * me ghusne lagta.
 */
export const DEFAULT_PRICE = {
  code: "IN",
  currency: "INR",
  symbol: "₹",
  monthly: 99,
  yearly: 999,
  monthlyLabel: "₹99",
  yearlyLabel: "₹999",
} as const;
