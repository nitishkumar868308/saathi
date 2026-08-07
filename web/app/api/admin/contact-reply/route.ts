import { NextResponse } from "next/server";

import { guard } from "@/lib/admin-guard";
import {
  contactReplyReady,
  getContactById,
  markContactReplied,
  usingSupabase,
} from "@/lib/store";
import { emailConfigured, sendContactReplyEmail } from "@/lib/email";
import { asLocale } from "@/lib/user-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin > Contacts se seedha jawab.
 *
 * Pehle yahan sirf ek `mailto:` link tha. Uspe click karne se admin ka apna
 * mail app khulta tha — jawab kisi niji pate se jaata, us par koi branding na
 * hoti, aur (sabse badi baat) kis message ka jawab de diya hai iska koi hisaab
 * hi na rehta. Ab jawab info@apkasaathi.com se jaata hai aur uska nishaan DB
 * me padta hai.
 *
 * POST { id, reply, locale? }
 */
export async function POST(request: Request) {
  const g = await guard("contacts");
  if (!g.ok) return g.res;

  if (!usingSupabase()) {
    return NextResponse.json(
      { error: "Supabase env missing — reply save nahi ho paayega" },
      { status: 503 },
    );
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "email set nahi hai (SMTP env) — jawab bhej nahi sakte" },
      { status: 503 },
    );
  }
  if (!(await contactReplyReady())) {
    return NextResponse.json(
      { error: "contact_messages me reply columns nahi hain — supabase/contact-reply.sql run karo" },
      { status: 503 },
    );
  }

  let id = "";
  let reply = "";
  let locale = asLocale(undefined);
  try {
    const body = await request.json();
    id = String(body?.id ?? "").trim();
    reply = String(body?.reply ?? "").trim();
    locale = asLocale(body?.locale);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (reply.length < 2) {
    return NextResponse.json({ error: "jawab likhiye" }, { status: 400 });
  }
  if (reply.length > 5000) {
    return NextResponse.json({ error: "jawab bahut lamba hai" }, { status: 400 });
  }

  const contact = await getContactById(id);
  if (!contact) return NextResponse.json({ error: "message nahi mila" }, { status: 404 });

  // ⚠️ Email PEHLE, nishaan BAAD me. Ulta karne par SMTP fail hone par message
  // "jawab diya gaya" dikhta rehta aur user ko kuch milta hi nahi — aur admin
  // ko kabhi pata na chalta.
  const sent = await sendContactReplyEmail({
    name: contact.name,
    email: contact.email,
    original: contact.message,
    reply,
    locale,
  });

  if (!sent.sent) {
    return NextResponse.json({ error: "email nahi ja saka — dobara koshish karo" }, { status: 502 });
  }

  const marked = await markContactReplied(id, reply, g.session.email);

  return NextResponse.json({
    ok: true,
    repliedAt: new Date().toISOString(),
    repliedBy: g.session.email,
    // Mail chala gaya par nishaan na lag saka — jhoot mat bolo, warna admin
    // dobara wahi jawab bhej dega.
    warning: marked ? undefined : "jawab chala gaya, par 'replied' nishaan save nahi hua",
  });
}
