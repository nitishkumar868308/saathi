import { createHmac, timingSafeEqual } from "node:crypto";

import { PLAY_STORE_URL } from "@/lib/links";

/**
 * Admin ke bheje hue message ka hisaab — kisko gaya, kisne khola, kaun kahan gaya.
 *
 * ⚠️ Pehle bhejne ke baad kuch bacha hi nahi rehta tha: API ek ginti lauta deti
 * thi ("42 bheja"), wo screen band hote hi gayab. Isliye "isko pichhle mahine
 * kitni baar mail gaya?" ya "kisne khola?" ka jawab kahin se nahi milta tha.
 *
 * Ab har bhejne par `message_batches` + `message_sends` me nishaan banta hai,
 * aur email me do cheezein chipak jaati hain:
 *
 *   1. **Pixel** — 1x1 ki chhoti tasveer. Mail khulte hi wo load hoti hai aur
 *      hume "open" pata chal jaata hai. (Gmail images off rakhne wale users me
 *      ye nahi chalti — isliye click ko bhi open maan lete hain, SQL me.)
 *   2. **Tracked links** — har link pehle apne `/api/t/c` se guzarta hai, wahan
 *      click likh ke aage bhej diya jaata hai. Isi se pata chalta hai ki user
 *      APP par gaya ya WEB par.
 *
 * Har link me raw `send_id` nahi jaata: uske saath ek chhota HMAC hota hai.
 * Bina iske koi bhi uuid badal-badal ke doosron ke stats bigaad deta.
 *
 * Env: `MESSAGE_TRACK_SECRET` (na ho to service-role key se kaam chal jaata hai —
 * wo waise bhi sirf server par hoti hai).
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com"
).replace(/\/$/, "");

const SECRET =
  process.env.MESSAGE_TRACK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "saathi-dev";

function sbHeaders() {
  return {
    apikey: SERVICE as string,
    Authorization: `Bearer ${SERVICE}`,
    "content-type": "application/json",
  };
}

/* ------------------------------ signing ------------------------------ */

function sign(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("base64url").slice(0, 16);
}

/** Link me jaane wala token: `<uuid>.<hmac>`. */
export function trackToken(sendId: string): string {
  return `${sendId}.${sign(sendId)}`;
}

/** Token se send id — hmac galat ho to `null`. */
export function readToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(id);
  // Lambai alag ho to timingSafeEqual throw karta hai — pehle khud check.
  if (mac.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return id;
}

/* ------------------------------- write ------------------------------- */

export type SendRow = {
  userId: string | null;
  email: string | null;
  channel: "email" | "push";
  status?: "sent" | "skipped" | "failed";
  error?: string | null;
  devices?: number;
};

/**
 * Batch banao. Fail ho to `null` — bhejna phir bhi chalta rahega.
 *
 * ⚠️ Tracking ka koi bhi fail message bhejne ko NAHI rok sakta. Migration na
 * chali ho ya Supabase down ho — admin ka mail phir bhi jaana chahiye. Isliye
 * har cheez yahan best-effort hai.
 */
export async function createBatch(input: {
  subject: string;
  body: string;
  channel: string;
  audience: string;
  total: number;
}): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/message_batches`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        subject: input.subject.slice(0, 300),
        body: input.body.slice(0, 4000),
        channel: input.channel,
        audience: input.audience,
        total: input.total,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { id: string }[];
    return rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Har target ka apna send row — pehle se, bhejne se PEHLE.
 *
 * Pehle banane ki wajah: email ke andar us row ka id chahiye (pixel + link usi
 * par tike hain). Isliye pehle rows banti hain, phir mail jaata hai, aur baad me
 * `markSends()` sirf status update karta hai.
 *
 * Lautata hai: userId+channel -> sendId ka naksha.
 */
export async function createSends(
  batchId: string,
  rows: SendRow[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!SUPABASE_URL || !SERVICE || !batchId || rows.length === 0) return out;

  // 500 se badi list ek request me daalne par PostgREST timeout kar deta hai.
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/message_sends`, {
        method: "POST",
        headers: { ...sbHeaders(), Prefer: "return=representation" },
        body: JSON.stringify(
          slice.map((r) => ({
            batch_id: batchId,
            user_id: r.userId,
            email: r.email,
            channel: r.channel,
            status: r.status ?? "sent",
            error: r.error ?? null,
            devices: r.devices ?? 0,
          })),
        ),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const saved = (await res.json()) as {
        id: string;
        user_id: string | null;
        channel: string;
      }[];
      saved.forEach((s) => out.set(`${s.user_id ?? ""}:${s.channel}`, s.id));
    } catch {
      /* best-effort */
    }
  }
  return out;
}

/**
 * Ek jaisa natija paayi hui saari rows ek hi request me update karo.
 *
 * ⚠️ Ek-ek row ka apna PATCH bhejna yahan ka sabse mehnga rasta tha: 1000 users
 * ke broadcast me 1000 extra HTTP round-trip, jinme serverless function ka time
 * hi khatam ho jaata (aur adhoori tracking bach jaati). Status sirf teen tarah
 * ke hote hain, isliye teen request kaafi hain.
 */
export async function markSendsBulk(
  ids: string[],
  patch: { status?: string; error?: string | null; devices?: number },
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE || ids.length === 0) return;
  const body = JSON.stringify({
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.error !== undefined ? { error: patch.error?.slice(0, 400) ?? null } : {}),
    ...(patch.devices !== undefined ? { devices: patch.devices } : {}),
  });
  // `in.(...)` URL me jaata hai — lambi list URL todd deti hai.
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/message_sends?id=in.(${slice.join(",")})`, {
        method: "PATCH",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body,
        cache: "no-store",
      });
    } catch {
      /* best-effort */
    }
  }
}

/** Bhejne ke baad status/error/devices bhar do (ek row). */
export async function markSend(
  sendId: string,
  patch: { status?: string; error?: string | null; devices?: number },
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE || !sendId) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/message_sends?id=eq.${sendId}`, {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.error !== undefined ? { error: patch.error?.slice(0, 400) ?? null } : {}),
        ...(patch.devices !== undefined ? { devices: patch.devices } : {}),
      }),
      cache: "no-store",
    });
  } catch {
    /* best-effort */
  }
}

/** Open/click likho (RPC rollup bhi kar deti hai). */
export async function recordEvent(input: {
  sendId: string;
  type: "open" | "click";
  target?: string | null;
  url?: string | null;
  agent?: string | null;
}): Promise<void> {
  if (!SUPABASE_URL || !SERVICE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_message_event`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        p_send_id: input.sendId,
        p_type: input.type,
        p_target: input.target ?? null,
        p_url: input.url ?? null,
        p_agent: input.agent ?? null,
      }),
      cache: "no-store",
    });
  } catch {
    /* best-effort — ek khoya hua open poori report se zyada zaroori nahi */
  }
}

/* ------------------------------ email html ------------------------------ */

/** Click jahan le ja sakta hai. `url` = admin ke message me likha hua link. */
export type ClickDest = "app" | "web" | "url";

export function clickUrl(sendId: string, dest: ClickDest, url?: string): string {
  const q = new URLSearchParams({ k: trackToken(sendId), d: dest });
  if (dest === "url" && url) q.set("u", url);
  return `${SITE_URL}/api/t/c?${q.toString()}`;
}

export function pixelUrl(sendId: string): string {
  return `${SITE_URL}/api/t/o?k=${trackToken(sendId)}`;
}

/** Play Store link — app wale button ka aakhri padav. */
export const APP_DEST_URL = PLAY_STORE_URL;
export const WEB_DEST_URL = SITE_URL;

/**
 * Admin ke message me jo URL likhe hain unhe clickable + tracked bana do.
 *
 * ⚠️ Ye HTML **escape hone ke BAAD** chalta hai. Yaani yahan aane wale text me
 * `<a href=...>` jaisa kuch ho hi nahi sakta — sirf `https://...` plain text.
 * Isliye seedha regex se badalna yahan surakshit hai; kachhe HTML par ye kaam
 * kabhi mat karna.
 */
function linkify(escapedHtml: string, sendId: string): string {
  return escapedHtml.replace(/https?:\/\/[^\s<)"']+/g, (raw) => {
    // Escape ke baad `&` -> `&amp;` ho chuka hota hai; asli URL wapas chahiye.
    const real = raw.replace(/&amp;/g, "&");
    return `<a href="${clickUrl(sendId, "url", real)}" style="color:#C25A37;text-decoration:underline;">${raw}</a>`;
  });
}

/**
 * Email ke andar tracking chipkao.
 *
 * Do CTA button jaan-boojh ke daale gaye hain — "App kholo" aur "Website kholo".
 * Sirf isi se wo sawaal ka jawab milta hai jo admin sabse zyada poochta hai:
 * **user email se APP par gaya ya WEB par**. Bina do alag button ke ye kabhi
 * pata nahi chal sakta, kyunki ek hi link ke do maqsad nahi hote.
 *
 * Pixel sabse aakhir me — kuch email client shuru ka content pehle kaat dete
 * hain (Gmail ka "…" clipping), par pura mail khulne par pixel phir bhi load
 * hota hai.
 */
export function trackedEmailBody(
  escapedInnerHtml: string,
  sendId: string,
  cta: { app: string; web: string },
): string {
  const button = (href: string, label: string, filled: boolean) =>
    `<a href="${href}" style="display:inline-block;margin:0 6px 10px 0;padding:12px 22px;border-radius:12px;` +
    (filled
      ? `background:#C25A37;color:#ffffff;`
      : `background:#ffffff;color:#C25A37;border:1px solid #C25A37;`) +
    `font-weight:700;font-size:14px;text-decoration:none;">${label}</a>`;

  return (
    linkify(escapedInnerHtml, sendId) +
    `<div style="margin-top:26px;">` +
    button(clickUrl(sendId, "app"), cta.app, true) +
    button(clickUrl(sendId, "web"), cta.web, false) +
    `</div>` +
    // 1x1 — dikhta kuch nahi, bas "khula" bata deta hai.
    `<img src="${pixelUrl(sendId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;" />`
  );
}
