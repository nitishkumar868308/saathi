import { logServerError } from "@/lib/errors-server";

/**
 * "Is user ko WhatsApp/email kyun NAHI gaya" — admin > Logs me, saaf shabdon me.
 *
 * ── Ye kyun bana ────────────────────────────────────────────────────────
 *
 * ⚠️ Shikayat: "error aur logs me admin panel me show kar do taaki samajh aaye
 * ki kyun nahi gaya".
 *
 * Baat bilkul sahi thi, aur khaali jagah asli thi. Delivery ke fail hone ki
 * khabar teen jagah bikhri hui thi, aur teenon me se koi bhi wo sawaal nahi
 * uthata tha jo sach me poochha jaata hai:
 *
 *   • **Cron ka HTTP jawab** — `{ whatsapp: 0, email: 0, errors: [...] }`. Ye
 *     tabhi dikhta hai jab koi us URL ko KHUD khole, us minute. Cron har minute
 *     chalta hai aur uska jawab kahin bachta hi nahi. Yaani sabse zaroori
 *     jaankari sabse jaldi gum ho jaati thi.
 *   • **`service_usage`** — wahan sirf wo ginti jaati hai jab call sach me
 *     Twilio/SMTP tak PAHUNCHTI hai. Jo raaste uske PEHLE ruk jaate hain (Plus
 *     nahi hai, number verify nahi hua, env set hi nahi hai) — yaani asli
 *     wajahon me se zyadatar — wahan kabhi dikhte hi nahi the.
 *   • **`delivery-check`** — poori jaanch, par wo PULL hai: admin ko pehle
 *     shak hona chahiye, phir us user ko dhoondhna chahiye, tab jawab milta
 *     hai. Jab tak user khud shikayat na kare, kisi ko pata hi nahi chalta.
 *
 * Ab har chhooti hui delivery ek line ban ke Logs me baith jaati hai. AdminLogs
 * ek jaise message ek row me jodta hai (×N), isliye "12 logon ko WhatsApp nahi
 * gaya — number verify nahi hua" ek hi nazar me dikh jaata hai.
 *
 * ⚠️ `message` me kabhi user ka naam/id mat daalna. Wahi grouping ki jaan hai:
 * message ek jaisa rahega to 200 users ek row me aayenge; usme uid ghusaate hi
 * wo 200 alag rows ban jaayenge aur page bekaar ho jaayega. Kis-kiska ruka, wo
 * `context` me jaata hai (row kholne par dikhta hai).
 */

/** Kis raaste par ruka. */
export type DeliveryChannel = "whatsapp" | "email";

/** Kis cheez ki khabar ruki. */
export type DeliveryKind = "reminder" | "document";

/**
 * Kyun ruka.
 *
 * ⚠️ Ye wahi list hai jo `lib/delivery-check.ts` ke `DeliveryBlocker` me hai —
 * jaan-boojh ke. Dono jagah ek hi shabdawali honi chahiye, warna admin panel do
 * alag bhasha bolne lagta hai ("phone_unverified" ek jagah, "number galat"
 * doosri jagah) aur wahi uljhan wapas aa jaati hai jise ye theek kar raha hai.
 */
export type DeliveryReason =
  /** Number daala hi nahi gaya. */
  | "no_phone"
  /** Number hai par OTP se verify nahi hua — cron aise number par kuch nahi bhejta. */
  | "phone_unverified"
  /** Profile me email hi nahi. */
  | "no_email"
  /** Twilio ka env poore server par set nahi hai. */
  | "twilio_off"
  /** SMTP ka env poore server par set nahi hai. */
  | "smtp_off"
  /** Twilio/SMTP tak baat pahunchi par unhone mana kar diya. */
  | "send_failed";

/**
 * Har wajah ka seedha matlab — Logs me yahi line dikhti hai.
 *
 * Hinglish me, kyunki admin panel isi bhasha me hai. Har line do baatein kehti
 * hai: kya ruka, aur uska ilaaj kahan hai — taaki row dekhte hi agla kadam pata
 * ho, dobara dhoondhna na pade.
 */
const REASON_LINE: Record<DeliveryReason, string> = {
  no_phone: "number daala hi nahi gaya (You > Meri details)",
  phone_unverified: "number verify nahi hua (user ko OTP se verify karna hoga)",
  no_email: "profile me email hi nahi hai",
  twilio_off: "Twilio ka env server par set nahi hai",
  smtp_off: "SMTP ka env server par set nahi hai",
  send_failed: "bhejne par fail hua (neeche context dekho)",
};

const CHANNEL_LINE: Record<DeliveryChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
};

const KIND_LINE: Record<DeliveryKind, string> = {
  reminder: "reminder",
  document: "document expiry",
};

/**
 * Ek chhooti hui delivery Logs me daal do.
 *
 * Best-effort — `logServerError` khud kabhi throw nahi karta, isliye ye cron ko
 * kabhi nahi rok sakta. Ye baat zaroori hai: khabar rakhne ki koshish khud
 * khabar bhejne se zyada zaroori nahi ho sakti.
 */
export function logDeliverySkip(opts: {
  channel: DeliveryChannel;
  kind: DeliveryKind;
  reason: DeliveryReason;
  /** Kis user ka — sirf `context` me, message me kabhi nahi (upar wajah likhi hai). */
  userId?: string | null;
  /** Reminder/document ki id — usi row tak pahunchne ke liye. */
  itemId?: string | null;
  /** Twilio/SMTP ka apna jawab, ya koi aur tafseel. */
  detail?: string;
}): void {
  const line =
    `${CHANNEL_LINE[opts.channel]} nahi gaya (${KIND_LINE[opts.kind]}) — ` +
    REASON_LINE[opts.reason];

  void logServerError(
    new Error(line),
    {
      screen: "cron",
      action: `${opts.kind}-${opts.channel}`,
      reason: opts.reason,
      userId: opts.userId ?? null,
      itemId: opts.itemId ?? null,
      ...(opts.detail ? { detail: opts.detail.slice(0, 500) } : {}),
    },
    {
      /**
       * ⚠️ `source: "delivery"` — `web` nahi.
       *
       * Iske bina ye lines app/web ki asli crashes ke saath ghul-mil jaati aur
       * dono taraf nuksan hota: crash dhoondhna mushkil ho jaata, aur delivery
       * ki dikkat crash ke shor me dab jaati. Ab Logs page par iska apna filter
       * hai.
       */
      source: "delivery",
      /**
       * `warn` — `error` nahi. In me se zyadatar (number verify nahi hua, email
       * nahi hai) app ka TOOTNA nahi hai; wo user ke apne data ki kami hai. Unhe
       * error batana har roz ka error-digest email jhoothe alarm se bhar dega,
       * aur phir usi email ko log dekhna band kar diya jaata hai.
       */
      level: "warn",
    },
  );
}
