import { NextResponse } from "next/server";

import { guard } from "@/lib/admin-guard";
import { logServerError } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin > Devices — "kaun sa user kaun se phone se chal raha hai".
 *
 * GET  ?q=&uid=&limit=&offset=   → list
 * POST { userId, deviceId }      → us phone ko chaalu kar do (support ka raasta)
 *
 * ⚠️ POST ek BHAARI kaam hai, GET jaisa nahi. Wo us user ke saare reminder aur
 * alert is phone par le aata hai aur uske purane phone par band kar deta hai.
 * Isliye wo `admin_device_approve` se hota hai — jo service_role-only hai — aur
 * app ke paas iska koi raasta nahi hai. Ye ek AADMI ka faisla hai (support par
 * baat karke), isliye sirf yahan.
 *
 * ⚠️ Device ki asli hardware id yahan kabhi nahi aati. Wo server par jaati hi
 * nahi — sirf uska salted hash jaata hai, aur wo bhi sirf referral anti-fraud ke
 * liye (dekho app-mobile/src/lib/device.ts). Admin ko platform aur brand/model
 * wala fingerprint dikhta hai, jo support ke liye kaafi hai.
 */

function headers() {
  return {
    apikey: SERVICE as string,
    Authorization: `Bearer ${SERVICE}`,
    "content-type": "application/json",
  };
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!SUPABASE_URL || !SERVICE) throw new Error("supabase env missing");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc ${name} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function GET(request: Request) {
  const g = await guard("devices");
  if (!g.ok) return g.res;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  try {
    const data = await rpc<{ rows: unknown[]; total: number }>("admin_device_list", {
      p_uid: url.searchParams.get("uid") || null,
      p_q: url.searchParams.get("q") || null,
      p_limit: Number.isFinite(limit) ? limit : 50,
      p_offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json(data);
  } catch (err) {
    void logServerError(err, { where: "admin/devices", step: "list" });
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const g = await guard("devices");
  if (!g.ok) return g.res;

  let userId = "";
  let deviceId = "";
  try {
    const body = await request.json();
    userId = String(body?.userId ?? "").trim();
    deviceId = String(body?.deviceId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!userId || !deviceId) {
    return NextResponse.json({ error: "userId aur deviceId dono chahiye" }, { status: 400 });
  }

  try {
    const ok = await rpc<boolean>("admin_device_approve", {
      p_uid: userId,
      p_id: deviceId,
    });
    if (!ok) return NextResponse.json({ error: "device nahi mila" }, { status: 404 });
  } catch (err) {
    void logServerError(err, { where: "admin/devices", step: "approve", userId, deviceId });
    return NextResponse.json({ error: "approve failed" }, { status: 500 });
  }

  /**
   * Kisne kiya, kiske liye — ye log ho jaana chahiye.
   *
   * Ye wo kaam hai jispar baad me sawaal uth sakta hai ("mere reminder kisi aur
   * phone par kyun chale gaye"), aur uska jawab tabhi milta hai jab kahin likha
   * ho ki kis admin ne kab ye kiya tha.
   */
  void logServerError(new Error(`device approved by admin (${g.session.email})`), {
    where: "admin/devices",
    action: "approve",
    userId,
    deviceId,
    admin: g.session.email,
  });

  return NextResponse.json({ ok: true });
}
