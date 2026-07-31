import { supabase } from "./supabase";
import { WEB_URL } from "./plan";
import { timed } from "./network";
import { reportError } from "./report-error";

/**
 * Support tickets — app ki taraf ka hissa.
 *
 * Do alag raaste, jaan-boojh ke:
 *
 *   PADHNA  — seedha Supabase se (RLS user ko sirf uske apne ticket dikhati
 *             hai). Ye tez hai aur web server par nirbhar nahi.
 *   LIKHNA  — web ke `/api/support` se. Wajah: ticket banne ke saath hi do
 *             email jaani hoti hain (admin ko khabar, user ko rasid), aur email
 *             sirf server bhej sakta hai. Do alag call karne par aadha kaam
 *             hone ka khatra rehta — ticket ban jaata par kisi ko pata na chalta.
 *
 * Likhne wali call me user ka apna access token jaata hai; server usse Supabase
 * se verify karke hi kuch karta hai.
 */

export type TicketStatus = "open" | "answered" | "closed";

export type Ticket = {
  id: string;
  ticket_no: string;
  subject: string;
  status: TicketStatus;
  last_message_at: string;
  created_at: string;
};

export type TicketMessage = {
  id: number;
  ticket_id: string;
  sender: "user" | "admin";
  body: string;
  seen_at: string | null;
  created_at: string;
};

/** Server ne kya kaha — screen isi se tay karti hai kya dikhana hai. */
export class SupportError extends Error {
  constructor(
    message: string,
    /** `true` = migration/config baaki hai, user ki galti nahi. */
    readonly setupMissing = false,
  ) {
    super(message);
    this.name = "SupportError";
  }
}

/* ------------------------------- padhna ------------------------------- */

export async function listTickets(): Promise<Ticket[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id,ticket_no,subject,status,last_message_at,created_at")
    .order("last_message_at", { ascending: false })
    .limit(50);
  if (error) {
    // Table hi na ho (migration baaki) — ye "koi ticket nahi" jaisa hi dikhna
    // chahiye, error screen nahi. Par Logs me nishaan rehna chahiye.
    reportError(error, { screen: "support", action: "list" }, "warn");
    return [];
  }
  return (data ?? []) as Ticket[];
}

export async function listMessages(ticketId: string): Promise<TicketMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("support_messages")
    .select("id,ticket_id,sender,body,seen_at,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) {
    reportError(error, { screen: "support", action: "messages" }, "warn");
    return [];
  }
  return (data ?? []) as TicketMessage[];
}

/** Admin ke jawab ko "dekh liya" mark karo — unread ka nishaan hatane ke liye. */
export async function markSeen(ticketId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc("mark_support_seen", { p_ticket_id: ticketId });
  } catch {
    /* best-effort — nishaan agli baar hat jayega */
  }
}

/** Kitne jawab abhi padhe nahi gaye — Settings me laal bindi ke liye. */
export async function unreadCount(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender", "admin")
    .is("seen_at", null);
  if (error) return 0;
  return count ?? 0;
}

/* ------------------------------- likhna ------------------------------- */

async function post(body: Record<string, unknown>): Promise<{ ticketNo?: string }> {
  if (!supabase) throw new SupportError("offline", true);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // Bina token ke server kuch nahi karega — yahan ruk jaana behtar hai, warna
  // user ko "bhej diya" dikhta aur kahin kuch pahunchta hi nahi.
  if (!token) throw new SupportError("auth");

  const res = await timed(
    fetch(`${WEB_URL}/api/support`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }),
  );

  const out = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    ticketNo?: string;
    error?: string;
    needsMigration?: boolean;
  };
  if (!res.ok || out.error) {
    throw new SupportError(out.error ?? `HTTP ${res.status}`, !!out.needsMigration);
  }
  return { ticketNo: out.ticketNo };
}

/** Naya ticket. Lautata hai us ka number — user ko turant dikhana hai. */
export async function createTicket(
  subject: string,
  message: string,
): Promise<string | null> {
  const out = await post({ subject, message });
  return out.ticketNo ?? null;
}

/** Usi baatcheet me aur kuch. */
export async function replyToTicket(ticketId: string, message: string): Promise<void> {
  await post({ ticketId, message });
}
