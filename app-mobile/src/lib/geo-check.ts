import { countryFromTimezone } from "./tz-country";

/**
 * "IP badalke sasta price le lo" — is par nazar.
 *
 * Price IP se tay hota hai (`pricing.ts`), aur IP badalna VPN se ek tap ka kaam
 * hai. Isliye do cheezein milaate hain:
 *
 *   IP kya kehta hai        — VPN se badal jaata hai
 *   Phone ki ghadi kya kehti hai — VPN se NAHI badalti
 *
 * Dono alag desh bata rahe hain to jagah chhupayi ja rahi hai.
 *
 * ⚠️ Ye "pakka VPN" nahi batata — batata hai ki "kuch mel nahi kha raha".
 * Sach me alag hone ki wajahein hoti hain: koi videsh me ghoom raha ho, ya
 * office ka corporate VPN chal raha ho, ya us zone ke do desh hon. Isliye
 * hum user ko rokte NAHI — bas saaf keh dete hain ki price kis hisaab se lagega
 * (`geo-alert-modal.tsx`).
 *
 * ⚠️ Aur ye bhi yaad rahe: paisa Google Play user ke ACCOUNT-COUNTRY se katta
 * hai, IP se nahi. Yaani VPN se sirf DIKHNE WALA price badalta hai, asli charge
 * nahi. Isliye ye check dhokha rokne se zyada is liye hai ki user ko baad me
 * "alag paisa kyun kata" wala jhatka na lage.
 */

export type GeoMismatch = {
  /** IP se aaya country ("US"). */
  ipCountry: string;
  /** Phone ke timezone se aaya country ("IN"). */
  deviceCountry: string;
};

/**
 * Dono country milaao.
 *
 * `null` = koi shak nahi (ya pata hi nahi chala — dono ek hi baat hai, kyunki
 * bina pakke saboot ke user ko kuch dikhana galat hoga).
 */
export function checkGeoMismatch(ipCountry: string | null | undefined): GeoMismatch | null {
  const ip = ipCountry?.toUpperCase();
  if (!ip || !/^[A-Z]{2}$/.test(ip)) return null;

  const device = countryFromTimezone();
  if (!device) return null;

  return device === ip ? null : { ipCountry: ip, deviceCountry: device };
}
