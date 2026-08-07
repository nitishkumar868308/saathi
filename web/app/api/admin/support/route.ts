import { NextResponse } from "next/server";

import { guard } from "@/lib/admin-guard";
import {
  adminGet,
  adminPost,
  adminPatch,
  supportConfigured,
  tokensForUser,
  type Ticket,
  type TicketMessage,
} from "@/lib/support-server";
import { sendTicketAnswerEmail, type EmailLocale } from "@/lib/email";
import { localeForUser } from "@/lib/user-locale";
import { isFcmConfigured, sendPush } from "@/lib/fcm";
import { logServerError } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Support ke jawab wali notification ka title — user ki bhasha me. */
function ticketAnswerPushTitle(locale: EmailLocale, ticketNo: string): string {
  if (locale === "hi") return `टिकट ${ticketNo} — जवाब आ गया`;
  if (locale === "en") return `Ticket ${ticketNo} — we've replied`;
  return `Ticket ${ticketNo} — jawab aa gaya`;
}

/**
 * Admin panel ka Support — saare ticket, aur unka jawab.
 *
 * Jawab dete hi teen cheezein hoti hain:
 *   1. Message DB me (app me wahi baatcheet khul jaati hai),
 *   2. User ko email,
 *   3. User ke phone par notification.
 *
 * Teeno alag-alag fail ho sakti hain. Sabse zaroori pehli hai — wo fail ho to
 * poora request fail hota hai. Email/push best-effort hain: unka fail hona
 * admin ko "jawab nahi gaya" dikhana galat hoga, jabki app me jawab pahunch
 * chuka hai.
 */

const MAX_TICKETS = 500;

export async function GET(request: Request) {
  const g = await guard("support");
  if (!g.ok) return g.res;
  if (!supportConfigured()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId");

  try {
    if (ticketId) {
      const [ticket] = await adminGet<Ticket>(
        `support_tickets?select=*&id=eq.${ticketId}&limit=1`,
      );
      const messages = await adminGet<TicketMessage>(
        `support_messages?select=*&ticket_id=eq.${ticketId}&order=created_at.asc`,
      );
      return NextResponse.json({ ticket: ticket ?? null, messages });
    }

    const tickets = await adminGet<Ticket>(
      `support_tickets?select=*&order=last_message_at.desc&limit=${MAX_TICKETS}`,
    );

    // Har ticket ke saath uski aakhri line — list me wahi sabse kaam ki hai
    // ("kis baare me tha" subject se hamesha pata nahi chalta).
    let last: Record<string, { body: string; sender: string; at: string }> = {};
    if (tickets.length) {
      const ids = tickets.slice(0, 200).map((t) => t.id);
      const rows = await adminGet<TicketMessage>(
        `support_messages?select=ticket_id,sender,body,created_at` +
          `&ticket_id=in.(${ids.join(",")})&order=created_at.desc`,
      ).catch(() => []);
      // Nayi se purani aa rahi hain — pehli baar jo mile wahi aakhri line hai.
      last = rows.reduce<typeof last>((acc, m) => {
        if (!acc[m.ticket_id]) {
          acc[m.ticket_id] = { body: m.body, sender: m.sender, at: m.created_at };
        }
        return acc;
      }, {});
    }

    return NextResponse.json({ tickets, last });
  } catch (e) {
    // Migration na chali ho to table hi nahi hai — ye sabse aam soorat hai aur
    // ise "sab toot gaya" dikhana galat hoga.
    return NextResponse.json(
      { error: "fetch failed", detail: String(e), needsMigration: true },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  const g = await guard("support");
  if (!g.ok) return g.res;
  if (!supportConfigured()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  let body: { ticketId?: string; message?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const ticketId = (body.ticketId ?? "").trim();
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId chahiye" }, { status: 400 });
  }

  /* --------------------- sirf status badalna (bina jawab) --------------------- */

  const reply = (body.message ?? "").trim();
  const wantsStatus =
    body.status === "open" || body.status === "answered" || body.status === "closed"
      ? body.status
      : null;

  if (!reply && wantsStatus) {
    try {
      await adminPatch(`support_tickets?id=eq.${ticketId}`, { status: wantsStatus });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (reply.length < 1) {
    return NextResponse.json({ error: "jawab khaali hai" }, { status: 400 });
  }

  let ticket: Ticket | undefined;
  try {
    [ticket] = await adminGet<Ticket>(`support_tickets?select=*&id=eq.${ticketId}&limit=1`);
    if (!ticket) {
      return NextResponse.json({ error: "ticket nahi mila" }, { status: 404 });
    }

    await adminPost("support_messages", [
      { ticket_id: ticketId, sender: "admin", body: reply.slice(0, 4000) },
    ]);
    await adminPatch(`support_tickets?id=eq.${ticketId}`, {
      status: wantsStatus ?? "answered",
      last_message_at: new Date().toISOString(),
    });
  } catch (e) {
    void logServerError(e, { where: "admin/support", step: "save reply" });
    return NextResponse.json({ error: "jawab save nahi hua", detail: String(e) }, { status: 500 });
  }

  /* --------------------------- khabar (best-effort) --------------------------- */

  const notify: { email: boolean; push: number } = { email: false, push: 0 };

  // Email aur notification dono usi bhasha me jaayein jo user ne app me chuni
  // hai. Ek hi baar padho — dono jagah wahi chahiye.
  const userLocale = await localeForUser(ticket.user_id);

  if (ticket.email) {
    try {
      await sendTicketAnswerEmail({
        ticketNo: ticket.ticket_no,
        subject: ticket.subject,
        answer: reply,
        name: ticket.name,
        email: ticket.email,
        locale: userLocale,
      });
      notify.email = true;
    } catch (e) {
      void logServerError(e, { where: "admin/support", step: "answer email" });
    }
  }

  if (isFcmConfigured()) {
    try {
      const tokens = await tokensForUser(ticket.user_id);
      if (tokens.length) {
        const res = await sendPush(
          tokens.map((token) => ({ token })),
          // ⚠️ Ye line hardcoded Hinglish thi — phone par aane wali notification
          // hi wo pehli cheez hai jo user dekhta hai, aur wahi uski bhasha
          // chhod deti thi.
          ticketAnswerPushTitle(userLocale, ticket.ticket_no),
          reply.slice(0, 160),
          // Tap karte hi app usi baatcheet me khul jaati hai. Bina in do fields
          // ke user ko notification to dikhti, par jawab dhoondhne ke liye use
          // khud Settings → Support tak jaana padta.
          { kind: "support", ticket_id: ticket.id },
        );
        notify.push = res.sent;
      }
    } catch (e) {
      void logServerError(e, { where: "admin/support", step: "answer push" });
    }
  }

  return NextResponse.json({ ok: true, notify });
}
