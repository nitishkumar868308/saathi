import { NextResponse } from "next/server";

import { guard, guardMaster } from "@/lib/admin-guard";
import { generatePassword } from "@/lib/admin-password";
import {
  createRole,
  deleteMember,
  deleteRole,
  inviteMember,
  listMembers,
  listRoles,
  setMemberPassword,
  TeamNotConfigured,
  teamDbConfigured,
  updateMember,
  updateRole,
  type AdminStatus,
} from "@/lib/admin-team";
import { sendAdminInviteEmail, sendAdminPasswordEmail, emailConfigured } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com";
const ADMIN_URL = `${SITE_URL.replace(/\/+$/, "")}/admin`;

function fail(err: unknown) {
  console.error("[admin/team]", err);
  const msg = err instanceof Error ? err.message : "kuch galat ho gaya";
  // "SQL abhi run nahi hui" server ki khraabi nahi, ek adhoora setup hai —
  // isliye 503, taaki UI use "kuch toot gaya" ki tarah na dikhaye.
  const setup = err instanceof TeamNotConfigured || msg.includes("admin-team.sql");
  return NextResponse.json({ error: msg }, { status: setup ? 503 : 500 });
}

/* ---------------------------------- GET ----------------------------------- */

/**
 * Roles + members ki poori list.
 *
 * Padhne ke liye "team" menu kaafi hai (master ise kisi ko de sakta hai taaki
 * wo dekh sake ki team me kaun hai). BADALNE ke liye master hona zaroori hai —
 * dekho neeche `guardMaster`.
 */
export async function GET() {
  const g = await guard("team");
  if (!g.ok) return g.res;

  if (!teamDbConfigured()) {
    return NextResponse.json({ error: new TeamNotConfigured().message }, { status: 503 });
  }

  try {
    const [roles, members] = await Promise.all([listRoles(), listMembers()]);
    return NextResponse.json({
      roles,
      members,
      // UI ise dikhata hai — email band ho to invite bhejne se pehle hi pata
      // chal jaye, baad me "member bana par mail nahi gaya" ke bajaye.
      emailReady: emailConfigured(),
      canEdit: g.session.isMaster,
    });
  } catch (err) {
    return fail(err);
  }
}

/* ---------------------------------- POST ---------------------------------- */

/**
 * Sab kuch badalne wale kaam — sirf MASTER.
 *
 * ⚠️ Ye jaan-boojh ke sirf master ke paas hai. Jis kisi ke paas team badalne ka
 * haq hoga, wo apne aap ko har menu de sakta hai — yaani "role" ki poori
 * deewar ek click me girayi ja sakti hai. Isliye ye taala env wale password par
 * hi rehta hai.
 *
 * action:
 *   role.create   { name, menus }
 *   role.update   { id, name, menus }
 *   role.delete   { id }
 *   member.invite { email, name, roleId, menusExtra, menusDenied }
 *   member.update { id, name?, roleId?, menusExtra?, menusDenied?, status? }
 *   member.password { id }            -> naya password bana kar mail
 *   member.delete { id }
 */
export async function POST(request: Request) {
  const g = await guardMaster();
  if (!g.ok) return g.res;

  if (!teamDbConfigured()) {
    return NextResponse.json({ error: new TeamNotConfigured().message }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const id = String(body.id ?? "");

  try {
    switch (action) {
      /* ------------------------------- roles ------------------------------ */
      case "role.create": {
        const name = String(body.name ?? "").trim();
        if (!name) return NextResponse.json({ error: "role ka naam do" }, { status: 400 });
        await createRole(name, body.menus);
        return NextResponse.json({ ok: true });
      }
      case "role.update": {
        const name = String(body.name ?? "").trim();
        if (!name) return NextResponse.json({ error: "role ka naam do" }, { status: 400 });
        await updateRole(id, name, body.menus);
        return NextResponse.json({ ok: true });
      }
      case "role.delete": {
        await deleteRole(id);
        return NextResponse.json({ ok: true });
      }

      /* ------------------------------ members ----------------------------- */
      case "member.invite": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const name = String(body.name ?? "").trim();
        const roleId = body.roleId ? String(body.roleId) : null;

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: "email theek nahi hai" }, { status: 400 });
        }

        const password = generatePassword();
        const member = await inviteMember(
          {
            email,
            name,
            roleId,
            menusExtra: body.menusExtra,
            menusDenied: body.menusDenied,
            createdBy: g.session.email,
          },
          password,
        );

        // ⚠️ Mail ka fail hona invite ko nakaam nahi banata — member DB me ban
        // chuka hai. Isliye UI ko saaf-saaf batate hain ki mail gaya ya nahi,
        // taaki master password haath se bhej sake (ya "Naya password" se
        // dobara try kare). Chup rehna sabse bura hota: member bana pada rehta
        // aur kisi ko pata hi na chalta ki uske paas login pahuncha hi nahi.
        const mail = await sendAdminInviteEmail({
          name,
          email,
          password,
          adminUrl: ADMIN_URL,
          roleName: member.roleName,
          pending: true,
        }).catch(() => ({ sent: false }));

        return NextResponse.json({
          ok: true,
          member,
          emailSent: Boolean(mail?.sent),
          // Mail na jaa saka to hi password wapas bhejte hain — warna wo bina
          // wajah browser aur network log dono me pad jaata hai.
          password: mail?.sent ? undefined : password,
        });
      }

      case "member.update": {
        const status = body.status === undefined ? undefined : String(body.status);
        if (status && !["pending", "active", "disabled"].includes(status)) {
          return NextResponse.json({ error: "bad status" }, { status: 400 });
        }
        await updateMember(id, {
          name: body.name === undefined ? undefined : String(body.name),
          roleId: body.roleId === undefined ? undefined : body.roleId ? String(body.roleId) : null,
          menusExtra: body.menusExtra,
          menusDenied: body.menusDenied,
          status: status as AdminStatus | undefined,
        });
        return NextResponse.json({ ok: true });
      }

      case "member.password": {
        const members = await listMembers();
        const member = members.find((m) => m.id === id);
        if (!member) return NextResponse.json({ error: "member nahi mila" }, { status: 404 });

        const password = generatePassword();
        await setMemberPassword(id, password);

        const mail = await sendAdminPasswordEmail({
          name: member.name,
          email: member.email,
          password,
          adminUrl: ADMIN_URL,
        }).catch(() => ({ sent: false }));

        return NextResponse.json({
          ok: true,
          emailSent: Boolean(mail?.sent),
          password: mail?.sent ? undefined : password,
        });
      }

      case "member.delete": {
        await deleteMember(id);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (err) {
    return fail(err);
  }
}
