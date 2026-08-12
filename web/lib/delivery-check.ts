import { adminGet } from "@/lib/support-server";
import { emailConfigured } from "@/lib/email";
import { twilioConfigured, waTemplateState, type WaTemplateState } from "@/lib/twilio";
import {
  PROFILE_SELECT,
  toReminderProfile,
  type Loc,
  type ProfileRow,
} from "@/lib/reminder-channels";

/**
 * "Is user ko reminder ka WhatsApp/email jayega ya nahi — aur nahi to KYUN?"
 *
 * ⚠️ Ye isliye bana kyunki support par sabse aam shikayat ka jawab kahin se
 * milta hi nahi tha. User kehta "mujhe WhatsApp par reminder nahi aa raha", aur
 * admin ke paas dekhne ko kuch nahi tha: cron sirf ginti lautata hai
 * ("whatsapp: 3, email: 5, skippedFreePlan: 12") — wo bhi tabhi jab koi us URL
 * ko khud khole. Kis user ka kyun ruka, ye us ginti me kahin nahi hota.
 *
 * Isliye ek-ek karke roz yahi andaza lagana padta tha: Plus hai? number verify
 * hua? SMTP chalu hai? Har sawaal ke liye alag jagah dekho — aur aksar asli
 * wajah (number verify nahi hua) sabse aakhir me pata chalti thi.
 *
 * ⚠️ Sabse zaroori baat: eligibility ka hisaab yahan DOBARA nahi likha gaya.
 * `PROFILE_SELECT` + `toReminderProfile` wahi hain jo dono cron use karte hain,
 * aur verified-phone ki shart bhi wahi (`phone` + `phone_verified_at`). Agar
 * yahan apna hisaab likh dete to sabse bura nateeja nikalta: admin panel kehta
 * "jayega" aur cron kuch aur karta — yaani jaanch khud hi jhoot bolne lagti.
 */

export type DeliveryBlocker =
  /** Plus nahi hai — email/WhatsApp dono Plus ka feature hain. */
  | "not_plus"
  /** Profile me email hi nahi. */
  | "no_email"
  /** Number daala hi nahi gaya. */
  | "no_phone"
  /** Number hai par verify nahi hua — cron aise number par kuch nahi bhejta. */
  | "phone_unverified"
  /** SMTP env set nahi hai (poore server ke liye, is user ke liye nahi). */
  | "smtp_off"
  /** Twilio env set nahi hai (poore server ke liye). */
  | "twilio_off"
  /** Kisi bhasha ka WhatsApp template hi nahi — production me kuch nahi jaata. */
  | "wa_template_missing";

export type DeliveryCheck = {
  /** Wahi bhasha jisme message jayega (`profiles.language`). */
  language: Loc;
  isPlus: boolean;
  email: {
    present: boolean;
    /** Server par SMTP set hai? */
    smtp: boolean;
    willSend: boolean;
  };
  whatsapp: {
    phonePresent: boolean;
    verified: boolean;
    twilio: boolean;
    /** Is user ki bhasha me template ki haalat. */
    template: WaTemplateState;
    willSend: boolean;
  };
  /**
   * Jo kuch rok raha hai — sabse pehle sabse badi wajah.
   *
   * Khaali list = dono raaste khule hain. Us soorat me agli jagah dekhni chahiye
   * (cron chal raha hai ya nahi), isliye khaali hona bhi ek jawab hai.
   */
  blockers: DeliveryBlocker[];
};

type PhoneRow = { phone: string | null; phone_verified_at: string | null };

/**
 * Ek user ki delivery haalat. Kuch bhi na mile to bhi jawab deta hai — admin
 * panel ka ek block iske liye poora page tod nahi sakta.
 */
export async function getDeliveryCheck(uid: string): Promise<DeliveryCheck> {
  const [profRows, phoneRows] = await Promise.all([
    adminGet<ProfileRow>(`profiles?id=eq.${uid}&select=${PROFILE_SELECT}&limit=1`).catch(
      () => [] as ProfileRow[],
    ),
    adminGet<PhoneRow>(
      `user_details?user_id=eq.${uid}&select=phone,phone_verified_at&limit=1`,
    ).catch(() => [] as PhoneRow[]),
  ]);

  const p = toReminderProfile(profRows[0]);
  const phone = phoneRows[0];

  const smtp = emailConfigured();
  const twilio = twilioConfigured();
  const template = waTemplateState("reminder", p.language);

  const emailPresent = Boolean(p.email);
  const phonePresent = Boolean(phone?.phone);
  // Cron ki shart, akshar ke liye akshar: number ho AUR verify hua ho.
  const verified = Boolean(phone?.phone && phone.phone_verified_at);

  const emailWill = p.isPlus && emailPresent && smtp;
  const waWill = p.isPlus && verified && twilio && template !== "none";

  /**
   * Wajah ki tarteeb maayne rakhti hai.
   *
   * Plus sabse pehle: free user par baaki sab jaanchna bekaar hai (aur "SMTP
   * off" jaisi baat dikhana ulta bhataka deta hai — wo asli wajah nahi thi).
   */
  const blockers: DeliveryBlocker[] = [];
  if (!p.isPlus) {
    blockers.push("not_plus");
  } else {
    if (!emailPresent) blockers.push("no_email");
    else if (!smtp) blockers.push("smtp_off");

    if (!phonePresent) blockers.push("no_phone");
    else if (!verified) blockers.push("phone_unverified");
    else if (!twilio) blockers.push("twilio_off");
    else if (template === "none") blockers.push("wa_template_missing");
  }

  return {
    language: p.language,
    isPlus: p.isPlus,
    email: { present: emailPresent, smtp, willSend: emailWill },
    whatsapp: { phonePresent, verified, twilio, template, willSend: waWill },
    blockers,
  };
}
