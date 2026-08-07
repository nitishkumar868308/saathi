import { cleanMenus, effectiveMenus, type AdminMenu } from "@/lib/admin-menus";
import { hashPassword } from "@/lib/admin-password";

/**
 * Admin team — roles aur members (service_role se).
 *
 * Tables `supabase/admin-team.sql` me hain. RLS ON hai aur koi policy nahi, to
 * inhe sirf yahi layer chhoo sakti hai.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function teamDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export class TeamNotConfigured extends Error {
  constructor() {
    super("Supabase env missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    this.name = "TeamNotConfigured";
  }
}

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sb<T>(query: string, init?: RequestInit): Promise<T> {
  if (!teamDbConfigured()) throw new TeamNotConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    ...init,
    headers: headers(init?.headers as Record<string, string>),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    // Table na bani ho — sabse aam galti, isliye naam se batao.
    if (res.status === 404 || txt.includes("does not exist")) {
      throw new Error("admin_roles / admin_users table nahi mili — supabase/admin-team.sql run karo");
    }
    throw new Error(`admin team query fail: ${res.status} ${txt}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* ---------------------------------- Roles ---------------------------------- */

export type AdminRole = {
  id: string;
  name: string;
  menus: AdminMenu[];
  createdAt: string;
  /** Kitne member is role par hain. */
  memberCount: number;
};

type RoleRow = { id: string; name: string; menus: string[] | null; created_at: string };

export async function listRoles(): Promise<AdminRole[]> {
  const [roles, members] = await Promise.all([
    sb<RoleRow[]>("admin_roles?select=id,name,menus,created_at&order=name.asc"),
    sb<{ role_id: string | null }[]>("admin_users?select=role_id"),
  ]);
  const counts = new Map<string, number>();
  for (const m of members) {
    if (m.role_id) counts.set(m.role_id, (counts.get(m.role_id) ?? 0) + 1);
  }
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    menus: cleanMenus(r.menus),
    createdAt: r.created_at,
    memberCount: counts.get(r.id) ?? 0,
  }));
}

export async function createRole(name: string, menus: unknown): Promise<void> {
  await sb("admin_roles", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{ name: name.trim(), menus: cleanMenus(menus) }]),
  });
}

export async function updateRole(id: string, name: string, menus: unknown): Promise<void> {
  if (!UUID.test(id)) throw new Error("bad role id");
  await sb(`admin_roles?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ name: name.trim(), menus: cleanMenus(menus) }),
  });
}

/**
 * Role hatao.
 *
 * Members ka `role_id` DB me `on delete set null` se apne aap khaali ho jaata
 * hai — wo log bane rehte hain, bas unke paas koi menu nahi bachta. Unhe chup
 * chaap uda dena galat hota: kisi ke andar aane ka raasta ek role delete karne
 * se nahi jaana chahiye.
 */
export async function deleteRole(id: string): Promise<void> {
  if (!UUID.test(id)) throw new Error("bad role id");
  await sb(`admin_roles?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

/* --------------------------------- Members --------------------------------- */

export type AdminStatus = "pending" | "active" | "disabled";

export type AdminMember = {
  id: string;
  email: string;
  name: string;
  roleId: string | null;
  roleName: string | null;
  menusExtra: AdminMenu[];
  menusDenied: AdminMenu[];
  /** Jo sach me milta hai — role + extra − denied. */
  menus: AdminMenu[];
  status: AdminStatus;
  createdAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
};

type MemberRow = {
  id: string;
  email: string;
  name: string;
  role_id: string | null;
  menus_extra: string[] | null;
  menus_denied: string[] | null;
  status: AdminStatus;
  created_at: string;
  created_by: string | null;
  last_login_at: string | null;
  admin_roles?: { name: string; menus: string[] | null } | null;
};

const MEMBER_SELECT =
  "id,email,name,role_id,menus_extra,menus_denied,status,created_at,created_by,last_login_at,admin_roles(name,menus)";

function toMember(r: MemberRow): AdminMember {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    roleId: r.role_id,
    roleName: r.admin_roles?.name ?? null,
    menusExtra: cleanMenus(r.menus_extra),
    menusDenied: cleanMenus(r.menus_denied),
    menus: effectiveMenus(r.admin_roles?.menus ?? [], r.menus_extra, r.menus_denied),
    status: r.status,
    createdAt: r.created_at,
    createdBy: r.created_by,
    lastLoginAt: r.last_login_at,
  };
}

export async function listMembers(): Promise<AdminMember[]> {
  const rows = await sb<MemberRow[]>(
    `admin_users?select=${MEMBER_SELECT}&order=created_at.desc`,
  );
  return rows.map(toMember);
}

/** Login ke liye — email se member (password hash ke saath). */
export async function findMemberForLogin(
  email: string,
): Promise<(AdminMember & { passwordHash: string }) | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const rows = await sb<(MemberRow & { password_hash: string })[]>(
    `admin_users?select=${MEMBER_SELECT},password_hash&email=eq.${encodeURIComponent(clean)}`,
  );
  const r = rows?.[0];
  if (!r) return null;
  return { ...toMember(r), passwordHash: r.password_hash };
}

/** Session banate waqt — id se member. */
export async function findMemberById(id: string): Promise<AdminMember | null> {
  if (!UUID.test(id)) return null;
  const rows = await sb<MemberRow[]>(`admin_users?select=${MEMBER_SELECT}&id=eq.${id}`);
  return rows?.[0] ? toMember(rows[0]) : null;
}

export type InviteInput = {
  email: string;
  name: string;
  roleId: string | null;
  menusExtra?: unknown;
  menusDenied?: unknown;
  createdBy: string;
};

/**
 * Naya member — `pending` par. Uska ek baar ka password lautata hai (email me
 * bhejne ke liye); hash hi DB me jaata hai, plain password kahin save nahi hota.
 */
export async function inviteMember(
  input: InviteInput,
  password: string,
): Promise<AdminMember> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email theek nahi hai");
  if (input.roleId && !UUID.test(input.roleId)) throw new Error("bad role id");

  const rows = await sb<MemberRow[]>("admin_users?select=" + MEMBER_SELECT, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        email,
        name: input.name.trim().slice(0, 80),
        role_id: input.roleId,
        menus_extra: cleanMenus(input.menusExtra),
        menus_denied: cleanMenus(input.menusDenied),
        password_hash: await hashPassword(password),
        status: "pending",
        created_by: input.createdBy,
      },
    ]),
  });
  const r = rows?.[0];
  if (!r) throw new Error("member add nahi hua");
  return toMember(r);
}

export async function updateMember(
  id: string,
  patch: {
    name?: string;
    roleId?: string | null;
    menusExtra?: unknown;
    menusDenied?: unknown;
    status?: AdminStatus;
  },
): Promise<void> {
  if (!UUID.test(id)) throw new Error("bad member id");
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name.trim().slice(0, 80);
  if (patch.roleId !== undefined) {
    if (patch.roleId && !UUID.test(patch.roleId)) throw new Error("bad role id");
    body.role_id = patch.roleId;
  }
  if (patch.menusExtra !== undefined) body.menus_extra = cleanMenus(patch.menusExtra);
  if (patch.menusDenied !== undefined) body.menus_denied = cleanMenus(patch.menusDenied);
  if (patch.status !== undefined) body.status = patch.status;
  if (!Object.keys(body).length) return;

  await sb(`admin_users?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

/** Naya password set karo (bhejne ke liye plain wapas nahi aata — caller ke paas hai). */
export async function setMemberPassword(id: string, password: string): Promise<void> {
  if (!UUID.test(id)) throw new Error("bad member id");
  await sb(`admin_users?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ password_hash: await hashPassword(password) }),
  });
}

export async function deleteMember(id: string): Promise<void> {
  if (!UUID.test(id)) throw new Error("bad member id");
  await sb(`admin_users?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function touchLogin(id: string): Promise<void> {
  try {
    await sb(`admin_users?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    });
  } catch {
    // Login isliye nahi rukna chahiye ki "aakhri login" likha nahi ja saka.
  }
}
