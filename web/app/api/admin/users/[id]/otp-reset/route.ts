import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { otpResetUser, otpStatus } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is user ki SMS-OTP ginti kitni hai (aur wo block to nahi).
 *
 * Admin ko reset dabane se PEHLE ye dikhna chahiye. Bina iske faisla andhere me
 * hota hai: jo user aaj 3 SMS mangwa chuka hai aur jo 15 mangwa chuka hai,
 * dono ki ticket bilkul ek jaisi padhti hai ("mera number verify nahi ho
 * raha"). Doosre par reset dena aksar galti hoti hai.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ status: await otpStatus(params.id) });
  } catch (err) {
    console.error("[admin/users/:id/otp-reset] GET", err);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

/**
 * Is user ki OTP ginti saaf karo — wo turant dobara code mangwa sakta hai.
 *
 * User support me ticket raise karta hai ("OTP limit reset karo" — app profile
 * screen se wahi subject pehle se bhara hua aata hai), admin uski history dekh
 * ke ye dabata hai, aur baat khatam. Koi SQL nahi, koi wait nahi.
 *
 * ⚠️ Rows delete nahi hoti, `ignored` flag lagta hai (`otp_reset_user`). Wahi
 * rows fraud dekhne ka ekmatra record hain: agli baar reset maangne par admin
 * ko dikhna chahiye ki ye user pichhle mahine bhi teen baar reset karwa chuka
 * hai. Delete kar dene par har baar slate saaf dikhti — jo theek us aadmi ke
 * liye faydemand hai jise rokna tha.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const cleared = await otpResetUser(params.id);
    return NextResponse.json({ ok: true, cleared, status: await otpStatus(params.id) });
  } catch (err) {
    console.error("[admin/users/:id/otp-reset] POST", err);
    return NextResponse.json({ error: "reset failed" }, { status: 500 });
  }
}
