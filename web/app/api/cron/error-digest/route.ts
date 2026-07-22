import { NextResponse } from "next/server";
import { sendMail, renderEmail, ERROR_ALERT_TO } from "@/lib/email";
import { getUnmailedErrors, markErrorsMailed } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Naye errors ka email digest. pg_cron / Vercel cron isse har 30 min call kare.
 * Ek error ka email sirf ek baar (mailed_at se dedupe) — inbox spam nahi hota.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const errors = await getUnmailedErrors(50);
  if (!errors.length) return NextResponse.json({ sent: 0 });

  const rows = errors
    .map(
      (e) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E5DBC9;vertical-align:top;">
        <div style="font-weight:700;color:#2E2823;">${esc(e.message)}</div>
        <div style="font-size:12px;color:#6B5F54;margin-top:3px;">
          ${esc(e.source)} · ${esc(e.platform ?? "—")} · v${esc(e.appVersion ?? "—")}
          · ${new Date(e.createdAt).toLocaleString("en-IN")}
        </div>
        ${
          e.context
            ? `<div style="font-size:12px;color:#6B5F54;margin-top:3px;">${esc(
                JSON.stringify(e.context),
              )}</div>`
            : ""
        }
        ${
          e.stack
            ? `<pre style="margin:6px 0 0;padding:8px;background:#F7F2E9;border-radius:8px;font-size:11px;color:#6B5F54;white-space:pre-wrap;">${esc(
                e.stack.slice(0, 900),
              )}</pre>`
            : ""
        }
      </td>
    </tr>`,
    )
    .join("");

  try {
    await sendMail({
      to: ERROR_ALERT_TO,
      subject: `⚠️ Apka Saathi — ${errors.length} naye error`,
      html: renderEmail(
        "Naye errors",
        `<p style="margin:0 0 14px;">Pichhle kuch samay me <b>${errors.length}</b> error aaye. Poori list admin → Logs me hai.</p>
         <table style="width:100%;border-collapse:collapse;">${rows}</table>`,
        `${errors.length} naye error`,
      ),
      fromName: "Saathi Alerts",
    });
    await markErrorsMailed(errors.map((e) => e.id));
    return NextResponse.json({ sent: errors.length });
  } catch (err) {
    console.error("[cron/error-digest]", err);
    return NextResponse.json({ error: "mail failed" }, { status: 500 });
  }
}
