import { NextResponse } from "next/server";

import { adminSession, canSee, type AdminSession } from "@/lib/admin";
import type { AdminMenu } from "@/lib/admin-menus";

/**
 * Har admin API route ka pehla do-line wala pehra.
 *
 *     const g = await guard("users");
 *     if (!g.ok) return g.res;
 *     // …aage g.session me pata hai ki ye kaun hai
 *
 * ⚠️ Sidebar se menu chhupa dena permission NAHI hai — wo sirf ek button chhupa
 * deta hai. Route ka URL abhi bhi wahi hai, aur `fetch` koi bhi kar sakta hai.
 * Asli rok yahi hai. Isliye har naye admin route par ye lagana zaroori hai,
 * warna wo menu dikhta band ho jaata hai par khulta rehta hai.
 *
 * `menu` null do to sirf "login hai ya nahi" dekha jaata hai (jaise /me).
 */
export type GuardResult =
  | { ok: true; session: AdminSession }
  | { ok: false; res: NextResponse };

export async function guard(menu: AdminMenu | AdminMenu[] | null): Promise<GuardResult> {
  const session = await adminSession();
  if (!session) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  if (menu) {
    // Array = "in me se koi ek bhi ho to chalega". Kuch routes do menu ke beech
    // saanjhe hote hain (jaise config, jise Pricing aur Rewards dono padhte hain).
    const wanted = Array.isArray(menu) ? menu : [menu];
    if (!wanted.some((m) => canSee(session, m))) {
      return {
        ok: false,
        res: NextResponse.json({ error: "is menu ki permission nahi hai" }, { status: 403 }),
      };
    }
  }

  return { ok: true, session };
}

/** Sirf master — team/roles badalna, member invite karna waghera. */
export async function guardMaster(): Promise<GuardResult> {
  const g = await guard("team");
  if (!g.ok) return g;
  if (!g.session.isMaster) {
    return {
      ok: false,
      res: NextResponse.json({ error: "sirf master admin kar sakta hai" }, { status: 403 }),
    };
  }
  return g;
}
