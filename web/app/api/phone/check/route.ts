import { NextResponse } from "next/server";

import { appUserId } from "@/lib/app-auth";
import { logServerError } from "@/lib/errors-server";
import { isE164, phoneTakenByOther } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Ye number available hai?" — SIRF DB, koi SMS nahi.
 *
 * ⚠️ Ye route isliye bana kyunki wahi jaanch pehle sirf `send-otp` ke ANDAR
 * hoti thi. Nateeja user ke liye ulta dikhta tha: wo "Verify karo" dabata, OTP
 * ka modal khul jaata — poore "+91… par code bheja hai" ke saath — aur usi modal
 * me neeche laal me likha aata "ye number kisi aur account me verified hai".
 * Screen ek saath do ulti baatein keh rahi thi, aur user 6 ank ka intezaar karta
 * baitha rehta tha jo kabhi aane hi nahi the.
 *
 * ⚠️ Aur ek asli kharcha bhi tha, jo user ne khud pakda: `send-otp` par jaane ka
 * matlab hai `otp_issue` chalna — yaani us number par cooldown aur din/ghante ki
 * ginti kharch ho jaana, ek aise number par jispar SMS kabhi jaana hi nahi tha.
 * Do-teen aisi koshishon ke baad asli number verify karne ki hadd bhi khatam.
 *
 * Ab shakal aur duplicate, dono modal khulne se PEHLE jaanch liye jaate hain.
 * Twilio tak baat tabhi jaati hai jab sach me SMS bhejna ho.
 *
 * Jawab me sirf haan/na jaata hai — kabhi ye nahi ki number KISKA hai. Wo bata
 * dena kisi ko bhi ye jaanne ka tareeka de deta ki koi number is app par
 * registered hai ya nahi.
 */
export async function POST(request: Request) {
  const userId = await appUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let phone = "";
  try {
    const body = await request.json();
    phone = String(body?.phone ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!isE164(phone)) {
    return NextResponse.json({ error: "bad_number" }, { status: 400 });
  }

  try {
    const taken = await phoneTakenByOther(userId, phone);
    return NextResponse.json({ available: !taken });
  } catch (e) {
    /**
     * Jaanch na chal paaye to ROKNA galat hoga.
     *
     * Asli rok DB ka unique index hai (`phone-verify.sql`), jo race me bhi kabhi
     * nahi toot-ta, aur `send-otp` bhi apni taraf se dobara jaanchta hai. Yahan
     * fail hone par user ko rok dena ek asli, khaali number par bhi verification
     * band kar dega.
     */
    void logServerError(e, { where: "phone/check", userId });
    return NextResponse.json({ available: true, unchecked: true });
  }
}
