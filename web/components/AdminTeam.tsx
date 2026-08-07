"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import Loader from "@/components/Loader";
import Modal from "@/components/admin/Modal";
import { useAdminT, atpl } from "@/lib/i18n/admin";
import { ADMIN_MENUS, type AdminMenu } from "@/lib/admin-menus";

/**
 * Admin > Team — roles, members aur sidebar ki permissions, sab ek hi menu me.
 *
 * Do hisse hain aur unka rishta seedha hai:
 *   ROLE  me tay hota hai ki us role wale ko kaun se menu dikhenge
 *   MEMBER ek role par baithta hai, aur zarurat pade to uske liye alag se ek
 *          menu khola ya band kiya ja sakta hai
 *
 * Naya member hamesha `pending` par banta hai — email uske paas chala jaata hai
 * par login tab tak nahi chalta jab tak master use approve na kar de.
 */

type Role = {
  id: string;
  name: string;
  menus: AdminMenu[];
  memberCount: number;
};

type Member = {
  id: string;
  email: string;
  name: string;
  roleId: string | null;
  roleName: string | null;
  menusExtra: AdminMenu[];
  menusDenied: AdminMenu[];
  menus: AdminMenu[];
  status: "pending" | "active" | "disabled";
  createdBy: string | null;
  lastLoginAt: string | null;
};

type Data = { roles: Role[]; members: Member[]; emailReady: boolean; canEdit: boolean };

export default function AdminTeam({ meEmail }: { meEmail: string }) {
  const t = useAdminT();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [roleModal, setRoleModal] = useState<Role | "new" | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [overrideFor, setOverrideFor] = useState<Member | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t.team.failed);
      setData(body as Data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.team.failed);
    } finally {
      setLoading(false);
    }
  }, [t.team.failed]);

  useEffect(() => {
    load();
  }, [load]);

  /** Har badalne wala kaam yahin se jaata hai — ek hi jagah error/refresh. */
  const act = useCallback(
    async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      setError("");
      setNote("");
      try {
        const res = await fetch("/api/admin/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out?.error ?? t.team.failed);
        await load();
        return out as Record<string, unknown>;
      } catch (err) {
        setError(err instanceof Error ? err.message : t.team.failed);
        return null;
      }
    },
    [load, t.team.failed],
  );

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader size={36} />
      </div>
    );
  }

  if (error && !data) {
    return <Banner tone="bad">{error}</Banner>;
  }
  if (!data) return null;

  const readOnly = !data.canEdit;

  return (
    <div className="space-y-6">
      {error && <Banner tone="bad">{error}</Banner>}
      {note && <Banner tone="good">{note}</Banner>}
      {readOnly && <Banner tone="warn">{t.team.masterOnly}</Banner>}
      {!data.emailReady && !readOnly && <Banner tone="warn">{t.team.emailOff}</Banner>}

      {/* -------------------------------- Roles ------------------------------- */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t.team.rolesTitle}</h2>
            <p className="mt-0.5 text-sm text-ink-soft">{t.team.rolesSub}</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setRoleModal("new")}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-terracotta px-4 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
            >
              <Plus size={16} />
              {t.team.newRole}
            </button>
          )}
        </div>

        {!data.roles.length ? (
          <p className="mt-5 text-sm text-ink-soft">{t.team.noRoles}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.roles.map((r) => (
              <div key={r.id} className="rounded-2xl border border-line bg-cream-deep/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-semibold text-ink">
                      <Shield size={15} className="shrink-0 text-terracotta" />
                      {r.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {atpl(t.team.memberCount, { n: r.memberCount })}
                    </p>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 gap-1">
                      <IconBtn label={t.team.editRole} onClick={() => setRoleModal(r)}>
                        <Pencil size={14} />
                      </IconBtn>
                      <IconBtn
                        label={t.common.delete}
                        danger
                        onClick={() => {
                          if (confirm(atpl(t.team.deleteRoleConfirm, { name: r.name }))) {
                            act({ action: "role.delete", id: r.id });
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  )}
                </div>
                <MenuChips menus={r.menus} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------- Members ------------------------------ */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t.team.membersTitle}</h2>
            <p className="mt-0.5 text-sm text-ink-soft">{t.team.membersSub}</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-terracotta px-4 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
            >
              <UserPlus size={16} />
              {t.team.invite}
            </button>
          )}
        </div>

        {/* Master hamesha hai, par wo DB me nahi hai — isliye use alag se dikhate
            hain. Warna panel jhooth bolta: "koi member nahi", jabki tum andar ho. */}
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <KeyRound size={15} className="text-terracotta" />
                {t.team.master}
              </p>
              <Tag tone="good">{t.team.statusActive}</Tag>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{t.team.masterNote}</p>
          </div>

          {!data.members.length ? (
            <p className="text-sm text-ink-soft">{t.team.noMembers}</p>
          ) : (
            data.members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                roles={data.roles}
                readOnly={readOnly}
                isMe={m.email === meEmail}
                onAct={act}
                onNote={setNote}
                onOverride={() => setOverrideFor(m)}
              />
            ))
          )}
        </div>
      </section>

      {roleModal && (
        <RoleModal
          role={roleModal === "new" ? null : roleModal}
          onClose={() => setRoleModal(null)}
          onSave={async (name, menus) => {
            const ok = await act(
              roleModal === "new"
                ? { action: "role.create", name, menus }
                : { action: "role.update", id: roleModal.id, name, menus },
            );
            if (ok) setRoleModal(null);
          }}
        />
      )}

      {inviteOpen && (
        <InviteModal
          roles={data.roles}
          onClose={() => setInviteOpen(false)}
          onInvite={async (payload) => {
            const out = await act({ action: "member.invite", ...payload });
            if (!out) return;
            setInviteOpen(false);
            setNote(
              out.emailSent
                ? atpl(t.team.inviteSent, { email: String(payload.email) })
                : `${t.team.inviteNoMail} ${out.password ?? ""}`,
            );
          }}
        />
      )}

      {overrideFor && (
        <OverrideModal
          member={overrideFor}
          onClose={() => setOverrideFor(null)}
          onSave={async (extra, denied) => {
            const ok = await act({
              action: "member.update",
              id: overrideFor.id,
              menusExtra: extra,
              menusDenied: denied,
            });
            if (ok) {
              setOverrideFor(null);
              setNote(t.team.saved);
            }
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------- Member row -------------------------------- */

function MemberRow({
  member,
  roles,
  readOnly,
  isMe,
  onAct,
  onNote,
  onOverride,
}: {
  member: Member;
  roles: Role[];
  readOnly: boolean;
  isMe: boolean;
  onAct: (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  onNote: (s: string) => void;
  onOverride: () => void;
}) {
  const t = useAdminT();
  const [copied, setCopied] = useState("");

  const tone =
    member.status === "active" ? "good" : member.status === "pending" ? "warn" : "bad";
  const statusLabel =
    member.status === "active"
      ? t.team.statusActive
      : member.status === "pending"
        ? t.team.statusPending
        : t.team.statusDisabled;

  return (
    <div className="rounded-2xl border border-line bg-cream-deep/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            {member.name || member.email}
            {isMe && <span className="ml-1.5 text-xs font-normal text-ink-soft">({t.team.you})</span>}
          </p>
          <p className="truncate text-sm text-ink-soft">{member.email}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {member.roleName ?? t.team.noRole} · {t.team.lastLogin}:{" "}
            {member.lastLoginAt
              ? new Date(member.lastLoginAt).toLocaleDateString("en-IN")
              : t.team.never}
          </p>
        </div>
        <Tag tone={tone}>{statusLabel}</Tag>
      </div>

      <MenuChips menus={member.menus} />

      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Role badlo */}
          <select
            value={member.roleId ?? ""}
            onChange={(e) =>
              onAct({ action: "member.update", id: member.id, roleId: e.target.value || null })
            }
            className="h-9 rounded-xl border border-line bg-surface px-2.5 text-sm text-ink outline-none transition focus:border-terracotta"
          >
            <option value="">{t.team.noRole}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {member.status === "pending" && (
            <SmallBtn
              primary
              onClick={() => onAct({ action: "member.update", id: member.id, status: "active" })}
            >
              <Check size={14} />
              {t.team.approve}
            </SmallBtn>
          )}
          {member.status === "active" && (
            <SmallBtn
              onClick={() => onAct({ action: "member.update", id: member.id, status: "disabled" })}
            >
              <Power size={14} />
              {t.team.disable}
            </SmallBtn>
          )}
          {member.status === "disabled" && (
            <SmallBtn
              onClick={() => onAct({ action: "member.update", id: member.id, status: "active" })}
            >
              <Power size={14} />
              {t.team.enable}
            </SmallBtn>
          )}

          <SmallBtn onClick={onOverride}>
            <Shield size={14} />
            {t.team.overrideTitle}
          </SmallBtn>

          <SmallBtn
            onClick={async () => {
              const out = await onAct({ action: "member.password", id: member.id });
              if (!out) return;
              if (out.emailSent) onNote(t.team.newPasswordSent);
              else {
                setCopied(String(out.password ?? ""));
                onNote(`${t.team.inviteNoMail} ${out.password ?? ""}`);
              }
            }}
          >
            <KeyRound size={14} />
            {t.team.newPassword}
          </SmallBtn>

          <SmallBtn
            danger
            onClick={() => {
              if (confirm(atpl(t.team.removeConfirm, { email: member.email }))) {
                onAct({ action: "member.delete", id: member.id });
              }
            }}
          >
            <Trash2 size={14} />
            {t.team.remove}
          </SmallBtn>

          {copied && (
            <button
              onClick={() => navigator.clipboard?.writeText(copied)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 font-mono text-sm text-ink"
            >
              <Copy size={13} />
              {copied}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Modals ---------------------------------- */

function RoleModal({
  role,
  onClose,
  onSave,
}: {
  role: Role | null;
  onClose: () => void;
  onSave: (name: string, menus: AdminMenu[]) => void;
}) {
  const t = useAdminT();
  const [name, setName] = useState(role?.name ?? "");
  const [menus, setMenus] = useState<AdminMenu[]>(role?.menus ?? []);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={role ? t.team.editRole : t.team.newRole}
      subtitle={t.team.menusHint}
      footer={
        <div className="flex justify-end gap-2">
          <GhostBtn onClick={onClose}>{t.common.cancel}</GhostBtn>
          <PrimaryBtn
            disabled={!name.trim() || busy}
            onClick={() => {
              setBusy(true);
              onSave(name, menus);
            }}
          >
            {busy ? t.common.saving : t.common.save}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label={t.team.roleName}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.team.roleNamePh}
          className="h-11 w-full rounded-2xl border border-line bg-cream px-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
        />
      </Field>
      <Field label={t.team.menusLabel}>
        <MenuPicker selected={menus} onChange={setMenus} />
      </Field>
    </Modal>
  );
}

function InviteModal({
  roles,
  onClose,
  onInvite,
}: {
  roles: Role[];
  onClose: () => void;
  onInvite: (payload: Record<string, unknown>) => void;
}) {
  const t = useAdminT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <Modal
      open
      onClose={onClose}
      title={t.team.inviteTitle}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <GhostBtn onClick={onClose}>{t.common.cancel}</GhostBtn>
          <PrimaryBtn
            disabled={!emailOk || busy}
            onClick={() => {
              setBusy(true);
              onInvite({ email: email.trim(), name: name.trim(), roleId: roleId || null });
            }}
          >
            {busy ? t.team.inviting : t.team.inviteBtn}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label={t.team.nameLabel}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.team.namePh}
          className="h-11 w-full rounded-2xl border border-line bg-cream px-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
        />
      </Field>
      <Field label={t.team.emailLabel}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.team.emailPh}
          className="h-11 w-full rounded-2xl border border-line bg-cream px-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
        />
      </Field>
      <Field label={t.team.roleLabel}>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="h-11 w-full rounded-2xl border border-line bg-cream px-3 text-sm outline-none transition focus:border-terracotta"
        >
          <option value="">{t.team.noRole}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}

function OverrideModal({
  member,
  onClose,
  onSave,
}: {
  member: Member;
  onClose: () => void;
  onSave: (extra: AdminMenu[], denied: AdminMenu[]) => void;
}) {
  const t = useAdminT();
  const [extra, setExtra] = useState<AdminMenu[]>(member.menusExtra);
  const [denied, setDenied] = useState<AdminMenu[]>(member.menusDenied);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={t.team.overrideTitle}
      subtitle={`${member.email} — ${t.team.overrideHint}`}
      footer={
        <div className="flex justify-end gap-2">
          <GhostBtn onClick={onClose}>{t.common.cancel}</GhostBtn>
          <PrimaryBtn
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onSave(extra, denied);
            }}
          >
            {busy ? t.common.saving : t.common.save}
          </PrimaryBtn>
        </div>
      }
    >
      <Field label={t.team.extraLabel}>
        <MenuPicker selected={extra} onChange={setExtra} />
      </Field>
      <Field label={t.team.deniedLabel}>
        <MenuPicker selected={denied} onChange={setDenied} tone="deny" />
      </Field>
    </Modal>
  );
}

/* --------------------------------- Bits ------------------------------------ */

function MenuPicker({
  selected,
  onChange,
  tone = "allow",
}: {
  selected: AdminMenu[];
  onChange: (m: AdminMenu[]) => void;
  tone?: "allow" | "deny";
}) {
  const t = useAdminT();
  const on = tone === "deny" ? "bg-terracotta-dark text-white" : "bg-terracotta text-white";
  return (
    <div className="flex flex-wrap gap-1.5">
      {ADMIN_MENUS.map((m) => {
        const active = selected.includes(m);
        return (
          <button
            key={m}
            type="button"
            onClick={() =>
              onChange(active ? selected.filter((x) => x !== m) : [...selected, m])
            }
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? on
                : "border border-line bg-surface text-ink-soft hover:border-terracotta hover:text-terracotta"
            }`}
          >
            {active && (tone === "deny" ? <X size={12} /> : <Check size={12} />)}
            {t.nav[m]}
          </button>
        );
      })}
    </div>
  );
}

function MenuChips({ menus }: { menus: AdminMenu[] }) {
  const t = useAdminT();
  if (!menus.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1">
      {menus.map((m) => (
        <span
          key={m}
          className="rounded-full bg-cream-deep px-2 py-0.5 text-[11px] font-medium text-ink-soft"
        >
          {t.nav[m]}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      {children}
    </div>
  );
}

function Tag({ tone, children }: { tone: "good" | "warn" | "bad"; children: React.ReactNode }) {
  const cls = {
    good: "bg-sage/15 text-sage",
    warn: "bg-amber-warm/25 text-ink",
    bad: "bg-terracotta/15 text-terracotta-dark",
  }[tone];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>
  );
}

function Banner({ tone, children }: { tone: "good" | "warn" | "bad"; children: React.ReactNode }) {
  const cls = {
    good: "border-sage/40 bg-sage/10 text-ink",
    warn: "border-amber-warm/50 bg-amber-warm/10 text-ink",
    bad: "border-terracotta/40 bg-terracotta/10 text-terracotta-dark",
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${cls}`}>{children}</div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface transition ${
        danger ? "text-ink-soft hover:text-terracotta" : "text-ink-soft hover:text-terracotta"
      }`}
    >
      {children}
    </button>
  );
}

function SmallBtn({
  children,
  onClick,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const cls = primary
    ? "bg-terracotta text-white hover:bg-terracotta-dark"
    : danger
      ? "border border-line bg-surface text-terracotta-dark hover:border-terracotta"
      : "border border-line bg-surface text-ink-soft hover:text-terracotta";
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition ${cls}`}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center rounded-2xl bg-terracotta px-5 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
    >
      {children}
    </button>
  );
}
