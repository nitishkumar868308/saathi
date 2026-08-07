import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Main kaun hoon aur mujhe kya dikhna chahiye?"
 *
 * Dashboard khulte hi yahi call hota hai. Ye jaan-boojh ke kisi menu ke pehre
 * ke bina hai — warna jis admin ke paas Contacts nahi hai, wo login hi nahi kar
 * paata (pehle dashboard `/api/admin/data` se auth check karta tha, aur wo
 * Contacts ka route hai).
 */
export async function GET() {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ session });
}
