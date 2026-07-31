import { NextResponse } from "next/server";

import {
  userFromRequest,
  userRpc,
  adminGet,
  supportConfigured,
  type Ticket,
} from "@/lib/support-server";
import { sendNewTicketEmails, sendTicketReplyToAdmin } from "@/lib/email";
import { logServerError } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * App ka support — naya ticket banana aur usi baatcheet me aage likhna.
 *
 * App yahan apna Supabase access token bhejti hai. Ticket banta bhi user ke us
 * hi token se hai (service-role se nahi), taaki SQL ke andar `auth.uid()` sahi
 * rahe aur koi kisi aur ke naam par ticket na bana sake.
 *
 * ⚠️ Email bhejna ticket banne ke BAAD hota hai aur uska fail hona ticket ko
 * nahi girata. Pehle ye ulta hota to SMTP down hone par user ka poora sawaal
 * gum ho jaata — jabki uska asli ghar database hai, email sirf khabar hai.
 */

type Body = { subject?: string; message?: string; ticketId?: string };

export async function POST(request: Request) {
  if (!supportConfigured()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const uid = await userFromRequest(request);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (message.length < 3) {
    return NextResponse.json({ error: "message too short" }, { status: 400 });
  }

  /* ----------------------- purane ticket par jawab ----------------------- */

  if (body.ticketId) {
    const res = await userRpc<{ ok?: boolean; error?: string }>(
      request,
      "add_support_message",
      { p_ticket_id: body.ticketId, p_body: message },
    );
    if (!res || res.error) {
      return NextResponse.json({ error: res?.error ?? "failed" }, { status: 400 });
    }

    // Admin ko khabar. Ticket ka number/subject chahiye — wo user ke apne
    // token se hi padha ja sakta hai, par yahan service-role se padhna theek
    // hai kyunki upar wali RPC pehle hi maalik hona verify kar chuki hai.
    try {
      const [t] = await adminGet<Ticket>(
        `support_tickets?select=*&id=eq.${body.ticketId}&limit=1`,
      );
      if (t) {
        await sendTicketReplyToAdmin({
          ticketNo: t.ticket_no,
          subject: t.subject,
          message,
          name: t.name,
          email: t.email,
        });
      }
    } catch (e) {
      void logServerError(e, { where: "support", step: "reply email" });
    }

    return NextResponse.json({ ok: true });
  }

  /* ----------------------------- naya ticket ----------------------------- */

  const subject = (body.subject ?? "").trim();
  if (subject.length < 3) {
    return NextResponse.json({ error: "subject too short" }, { status: 400 });
  }

  const created = await userRpc<{
    id?: string;
    ticket_no?: string;
    subject?: string;
    status?: string;
    created_at?: string;
    error?: string;
  }>(request, "create_support_ticket", { p_subject: subject, p_message: message });

  if (!created || created.error || !created.ticket_no) {
    return NextResponse.json(
      { error: created?.error ?? "failed", needsMigration: !created },
      { status: 400 },
    );
  }

  try {
    const [t] = await adminGet<Ticket>(
      `support_tickets?select=*&id=eq.${created.id}&limit=1`,
    );
    await sendNewTicketEmails({
      ticketNo: created.ticket_no,
      subject,
      message,
      name: t?.name ?? null,
      email: t?.email ?? null,
    });
  } catch (e) {
    // Ticket ban chuka hai — user ko safal hi dikhega. Email ka fail sirf Logs
    // me jaata hai, warna user dobara bhejta aur do ticket ban jaate.
    void logServerError(e, { where: "support", step: "new ticket email" });
  }

  return NextResponse.json({
    ok: true,
    id: created.id,
    ticketNo: created.ticket_no,
  });
}
