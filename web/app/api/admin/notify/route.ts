import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { sendMail, renderEmail, emailParagraph, escapeHtml } from "@/lib/email";
import { isFcmConfigured, sendPush } from "@/lib/fcm";
import { logServerError } from "@/lib/errors-server";
import {
  createBatch,
  createSends,
  markSend,
  markSendsBulk,
  trackedEmailBody,
  type SendRow,
} from "@/lib/message-track";
import { translateConfigured, translateMessage, type Message } from "@/lib/translate";
import type { Loc } from "@/lib/reminder-channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_RECIPIENTS = 1000;

type Profile = {
  id: string;
  email: string | null;
  language: string | null;
  full_name?: string | null;
  created_at?: string | null;
};

function sbHeaders() {
  return { apikey: SERVICE as string, Authorization: `Bearer ${SERVICE}` };
}

async function sbGet<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: sbHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  return (await res.json()) as T[];
}

/**
 * Kaun "active" hai — jisne kabhi ek bhi reminder ya document banaya.
 *
 * Sirf sign-up kar lena active hona nahi hai: yahi log wo hain jinhe wapas
 * bulane wala email bhejna hota hai.
 */
async function activeUserIds(): Promise<Set<string>> {
  const [rem, docs] = await Promise.all([
    sbGet<{ user_id: string | null }>("reminders?select=user_id"),
    sbGet<{ user_id: string | null }>("documents?select=user_id"),
  ]);
  const active = new Set<string>();
  [...rem, ...docs].forEach((r) => r.user_id && active.add(r.user_id));
  return active;
}

/** Jin users ka kam se kam ek phone register hai — unhi tak push ja sakti hai. */
async function usersWithDevice(): Promise<Set<string>> {
  const rows = await sbGet<{ user_id: string | null }>(
    "device_tokens?select=user_id",
  ).catch(() => [] as { user_id: string | null }[]);
  const out = new Set<string>();
  rows.forEach((r) => r.user_id && out.add(r.user_id));
  return out;
}

/**
 * Bhejne se PEHLE poori list dikhane ke liye (item 8).
 *
 * ⚠️ Pehle admin sirf "sab" ya "inactive" chun sakta tha aur mail seedha chala
 * jaata tha — kis-kis ko gaya ye baad me bhi pata nahi chalta tha. Ek galat
 * click par active users ko bhi "wapas aa jao" wala mail chala jaata. Ab UI
 * pehle ye list mangata hai, admin us par nishaan lagata hai, aur POST me wahi
 * chune hue ids jaati hain.
 */
export async function GET() {
  const g = await guard("message");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  try {
    const [profiles, active, withDevice] = await Promise.all([
      sbGet<Profile>("profiles?select=id,email,full_name,language,created_at&order=created_at.desc"),
      activeUserIds(),
      // ⚠️ Ye pehle nahi aata tha, aur usi wajah se sabse uljhan wala sawaal
      // bina jawab ke reh jaata tha: "email to gaya, notification kyun nahi?"
      // Jawab hamesha yahi hota hai — us user ka koi phone register hi nahi
      // hai. Ab bhejne se PEHLE dikh jaata hai.
      usersWithDevice(),
    ]);

    // Bina email wale bhej hi nahi sakte — list me dikhana bhi galat sandesh
    // dega ("inhe kyun nahi gaya?").
    const users = profiles
      .filter((p) => !!p.email)
      .map((p) => ({
        id: p.id,
        email: p.email,
        name: p.full_name ?? null,
        language: p.language ?? null,
        joinedAt: p.created_at ?? null,
        active: active.has(p.id),
        hasDevice: withDevice.has(p.id),
      }));

    // UI ko batana zaroori hai ki push ka option dikhaye ya nahi. Bina Firebase
    // env ke "Notification bhejo" button dikhana jhooth hoga — admin dabata aur
    // kuch jaata hi nahi.
    // `translateReady` bhi yahin se: GEMINI_API_KEY na ho to UI me "user ki
    // bhasha me bhejo" wala toggle dikhana jhooth hoga — admin use on rakhta
    // aur message phir bhi ek hi bhasha me jaata.
    return NextResponse.json({
      users,
      pushReady: isFcmConfigured(),
      translateReady: translateConfigured(),
    });
  } catch (e) {
    return NextResponse.json({ error: "fetch failed", detail: String(e) }, { status: 500 });
  }
}

/**
 * Chune hue users ke saare device tokens (ek user ke kai phone ho sakte hain).
 *
 * ⚠️ Ab `user_id` bhi laata hai. Pehle sirf token ki list thi, isliye ye kabhi
 * pata nahi chalta tha ki kis token par kiska message gaya — aur usi wajah se
 * notification ka koi per-user hisaab nahi ban sakta tha.
 */
async function tokensFor(userIds: string[]): Promise<{ token: string; userId: string }[]> {
  if (userIds.length === 0) return [];
  const seen = new Set<string>();
  const out: { token: string; userId: string }[] = [];
  // PostgREST ka `in.(...)` URL me jaata hai — bahut lambi list URL todd deti
  // hai. 200 ke jhund me poochte hain.
  for (let i = 0; i < userIds.length; i += 200) {
    const slice = userIds.slice(i, i + 200);
    const rows = await sbGet<{ token: string; user_id: string | null }>(
      `device_tokens?select=token,user_id&user_id=in.(${slice.join(",")})`,
    ).catch(() => []);
    rows.forEach((r) => {
      if (!r.token || !r.user_id || seen.has(r.token)) return;
      seen.add(r.token);
      out.push({ token: r.token, userId: r.user_id });
    });
  }
  return out;
}

/**
 * Email ke do CTA button ka text — user ki apni bhasha me.
 *
 * Ye button sirf sajawat nahi hain: inhi se pata chalta hai ki user email se
 * **app** par gaya ya **web** par. Ek hi link se ye kabhi pata nahi chal sakta.
 */
function emailCta(language: string | null | undefined): { app: string; web: string } {
  if (language === "hi") return { app: "ऐप खोलें", web: "वेबसाइट देखें" };
  if (language === "en") return { app: "Open the app", web: "Visit website" };
  // Hinglish default — app ki apni default bhasha bhi yahi hai.
  return { app: "App kholo", web: "Website dekho" };
}

/** `profiles.language` ka jo bhi ho — hamesha teen me se ek. */
function toLoc(language: string | null | undefined): Loc {
  return language === "hi" || language === "en" ? language : "hinglish";
}

/** FCM ne jo tokens "mare hue" bataye, unhe DB se hata do. */
async function dropDeadTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_device_tokens`, {
    method: "POST",
    headers: { ...sbHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ p_tokens: tokens }),
    cache: "no-store",
  }).catch(() => {
    /* best-effort — agli baar phir koshish ho jaayegi */
  });
}

/**
 * Admin se registered users ko email bhejo — sabko ya sirf "inactive"
 * (registered hue par kabhi reminder/document nahi banaya).
 *
 * POST body: { subject, message, audience: "all" | "inactive" }
 */
export async function POST(request: Request) {
  const g = await guard("message");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  let body: {
    subject?: string;
    message?: string;
    audience?: string;
    userIds?: unknown;
    channel?: string;
    /** false = jaisa likha hai waisa hi bhejo, bina anuvaad ke. */
    translate?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  const audience = body.audience === "inactive" ? "inactive" : "all";
  if (!subject || !message) {
    return NextResponse.json({ error: "subject aur message dono chahiye" }, { status: 400 });
  }

  // Email, phone ki notification, ya dono. Purane callers (jinme `channel` nahi
  // hai) ke liye default "email" — unka vyavhaar bilkul waisa hi rehta hai.
  const channel = body.channel === "push" || body.channel === "both" ? body.channel : "email";
  const wantsEmail = channel !== "push";
  const wantsPush = channel !== "email";
  if (wantsPush && !isFcmConfigured()) {
    return NextResponse.json(
      { error: "Firebase set nahi hai — push nahi ja sakta (FIREBASE-SETUP.md dekho)" },
      { status: 503 },
    );
  }

  // Admin ne list me se khud kuch log chune hain? Tab audience bekaar hai —
  // ye chuni hui list hi sach hai. Yahi wo raasta hai jisse galti se active
  // users ko mail nahi jaata (item 8).
  const picked = Array.isArray(body.userIds)
    ? new Set(body.userIds.filter((v): v is string => typeof v === "string" && !!v))
    : null;
  if (picked && picked.size === 0) {
    return NextResponse.json({ error: "kam se kam ek user chuno" }, { status: 400 });
  }

  // Targets nikaalo.
  let profiles: Profile[];
  try {
    profiles = await sbGet<Profile>("profiles?select=id,email,language");
  } catch (e) {
    return NextResponse.json({ error: "profiles fetch failed", detail: String(e) }, { status: 500 });
  }

  // Sirf push bhej rahe hain to email na hona koi rukawat nahi — us user ke
  // phone par notification phir bhi ja sakti hai.
  let targets = wantsEmail ? profiles.filter((p) => !!p.email) : profiles;

  if (picked) {
    targets = targets.filter((p) => picked.has(p.id));
  } else if (audience === "inactive") {
    // Active = jinhone koi reminder ya document banaya. Baaki inactive.
    try {
      const active = await activeUserIds();
      targets = targets.filter((p) => !active.has(p.id));
    } catch (e) {
      return NextResponse.json({ error: "activity fetch failed", detail: String(e) }, { status: 500 });
    }
  }

  targets = targets.slice(0, MAX_RECIPIENTS);

  /* --------------------------- anuvaad (item) --------------------------- */
  //
  // ⚠️ Ab tak admin ka likha hua text JAISA KA WAISA sabko chala jaata tha.
  // Har user ki bhasha `profiles.language` me pehle se padi thi — email ke CTA
  // button (`emailCta`) tak usi se bante the — par message ka asli matn hamesha
  // ek hi bhasha me jaata tha. Hindi chunne wale user ko email me button
  // "ऐप खोलें" dikhta tha aur upar poora message English me.
  //
  // Ek hi call me sirf UTNI bhashayein maangte hain jitni is bhej me sach me
  // chahiye: sab Hinglish wale hain to koi anuvaad hota hi nahi.
  //
  // Anuvaad fail ho jaye to `translateMessage` original hi lauta deta hai —
  // isliye neeche kahin `null` handle karne ki zaroorat nahi, aur message kabhi
  // rukta nahi.
  const original: Message = { subject, message };
  const wantsTranslate = body.translate !== false && translateConfigured();
  const langs = Array.from(new Set(targets.map((p) => toLoc(p.language))));
  const texts: Record<Loc, Message> = wantsTranslate
    ? await translateMessage(original, langs)
    : ({ hinglish: original, hi: original, en: original } as Record<Loc, Message>);
  const textFor = (language: string | null | undefined): Message =>
    texts[toLoc(language)] ?? original;

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  /**
   * Tracking ke saare write yahan jama hote hain aur response se PEHLE await
   * kiye jaate hain.
   *
   * ⚠️ Serverless function response bhejte hi maar diya jaata hai. `void promise`
   * chhod dene par wo update aksar server tak pahunchta hi nahi — report me har
   * row hamesha "sent" dikhti aur "kisko nahi gaya" ka sach kabhi save hi nahi
   * hota.
   */
  const tracking: Promise<void>[] = [];

  /* ---------------------------- tracking rows ---------------------------- */
  //
  // Bhejne se PEHLE rows banti hain — email ke andar us row ka id chahiye (pixel
  // aur har link usi par tike hain). Ye poora hissa best-effort hai: batch na
  // bane (migration na chali ho, Supabase down ho) to `batchId` null rehta hai
  // aur mail bilkul waise hi jaata hai jaise pehle jaata tha, bas bina hisaab ke.

  const batchId = await createBatch({
    subject,
    body: message,
    channel,
    audience: picked ? "picked" : audience,
    total: targets.length,
  });

  const sendRows: SendRow[] = [];
  if (batchId) {
    if (wantsEmail) {
      targets
        .filter((p) => !!p.email)
        .forEach((p) => sendRows.push({ userId: p.id, email: p.email, channel: "email" }));
    }
    if (wantsPush) {
      targets.forEach((p) => sendRows.push({ userId: p.id, email: p.email, channel: "push" }));
    }
  }
  const sendIds = batchId ? await createSends(batchId, sendRows) : new Map<string, string>();
  const sendIdFor = (userId: string, ch: "email" | "push") =>
    sendIds.get(`${userId}:${ch}`) ?? null;

  /* ------------------------------ email ------------------------------ */

  if (wantsEmail) {
    /**
     * Har bhasha ka apna HTML — ek baar bana ke rakh liya jaata hai.
     *
     * Pehle ye do line poore bhej me ek hi baar chalti thi (ek `inner`, ek
     * `plainHtml`). Ab text bhasha ke hisaab se badalta hai, par bhashayein
     * teen se zyada ho nahi sakti — isliye per-user dobara banane ke bajaye
     * per-LANGUAGE ek baar. 1000 user par ye 1000 nahi, 3 baar chalta hai.
     */
    const shells = new Map<Loc, { inner: string; plain: string }>();
    const shellFor = (loc: Loc) => {
      const cached = shells.get(loc);
      if (cached) return cached;
      const text = texts[loc] ?? original;
      // Admin-composed message ko branded shell me daalo. Newlines -> paragraphs.
      const inner = escapeHtml(text.message)
        .split(/\n{2,}/)
        .map((para) => emailParagraph(para.replace(/\n/g, "<br/>")))
        .join("");
      // Tracking off ho to purana raasta — ek hi HTML us bhasha ke sab users ke liye.
      const made = { inner, plain: renderEmail(text.subject, inner, text.subject) };
      shells.set(loc, made);
      return made;
    };

    // Status ek jaisa hone wali rows ko ek saath update karte hain (neeche) —
    // per-row PATCH 1000 users par serverless function ka time kha jaata hai.
    const mailed: string[] = [];
    const notMailed: string[] = [];

    for (const p of targets) {
      if (!p.email) continue;
      const sendId = sendIdFor(p.id, "email");
      const loc = toLoc(p.language);
      const shell = shellFor(loc);
      const text = texts[loc] ?? original;
      // Har user ka apna HTML banta hai kyunki pixel aur link me USI ka send id
      // hota hai. Bina iske sab ka open ek hi row par ginta — aur "kisne khola"
      // ka jawab hi khatam ho jaata.
      const html = sendId
        ? renderEmail(
            text.subject,
            trackedEmailBody(shell.inner, sendId, emailCta(p.language)),
            text.subject,
          )
        : shell.plain;
      try {
        const res = await sendMail({
          to: p.email,
          subject: text.subject,
          html,
          fromName: "Apka Saathi",
        });
        if (res.sent) sent++;
        else skipped++;
        if (sendId) (res.sent ? mailed : notMailed).push(sendId);
      } catch (e) {
        errors.push(`${p.email}: ${String(e)}`);
        // Fail virle hote hain aur har ek ka apna karan hota hai — inhe alag se.
        if (sendId) tracking.push(markSend(sendId, { status: "failed", error: String(e) }));
        void logServerError(e, { where: "admin/notify", step: "email", to: p.email });
      }
    }

    tracking.push(markSendsBulk(mailed, { status: "sent" }));
    tracking.push(
      markSendsBulk(notMailed, {
        status: "skipped",
        error: "email bheja nahi ja saka (SMTP set nahi ya pata galat)",
      }),
    );
  }

  /* ------------------------------- push ------------------------------- */

  let push: { sent: number; failed: number; devices: number } | null = null;

  if (wantsPush) {
    const tokens = await tokensFor(targets.map((p) => p.id)).catch((e) => {
      void logServerError(e, { where: "admin/notify", step: "device_tokens fetch" });
      return [] as { token: string; userId: string }[];
    });

    /**
     * Push bhi user ki apni bhasha me.
     *
     * ⚠️ `sendPush` ek hi title/body sab tokens par bhejta hai, isliye tokens ko
     * BHASHA ke hisaab se baant ke bhejna padta hai. Teen se zyada jhund kabhi
     * ho hi nahi sakte, aur har jhund apne aap me poora batch hai — yaani ek hi
     * bhasha wale users ke liye ye pehle jaisa hi ek call hai.
     *
     * Pehle yahan email ka `subject`/`message` seedha jaata tha, isliye email
     * user ki bhasha me pahunchta aur usi cheez ki notification kisi aur bhasha
     * me — ek hi baat, do bhashayein, ek hi phone par.
     */
    const langOf = new Map(targets.map((p) => [p.id, toLoc(p.language)] as const));
    const byLang = new Map<Loc, { token: string; sendId: string | null }[]>();
    for (const t of tokens) {
      const loc = langOf.get(t.userId) ?? "hinglish";
      const list = byLang.get(loc) ?? [];
      list.push({ token: t.token, sendId: sendIdFor(t.userId, "push") });
      byLang.set(loc, list);
    }

    const res = {
      sent: 0,
      failed: 0,
      deadTokens: [] as string[],
      errors: [] as string[],
      bySend: new Map<string, { sent: number; failed: number }>(),
    };
    // `Array.from` isliye ki tsconfig ka target Map ko seedha iterate karne
    // nahi deta (downlevelIteration off hai) — poore repo ka target badalne se
    // behtar hai yahan ek copy bana lena, list teen se lambi hoti hi nahi.
    for (const [loc, list] of Array.from(byLang.entries())) {
      const text = texts[loc] ?? original;
      const part = await sendPush(list, text.subject, text.message);
      res.sent += part.sent;
      res.failed += part.failed;
      res.deadTokens.push(...part.deadTokens);
      res.errors.push(...part.errors);
      // ⚠️ `bySend` ki keys send-row ki id hain, jo har user ki apni hai — do
      // bhasha-jhund me ek hi id kabhi nahi aa sakti. Isliye seedha jodna safe
      // hai; jodne ki bajaye replace karna bhi wahi natija deta, par yahan saaf
      // rakhna behtar hai.
      part.bySend.forEach((v, k) => {
        const cur = res.bySend.get(k) ?? { sent: 0, failed: 0 };
        res.bySend.set(k, { sent: cur.sent + v.sent, failed: cur.failed + v.failed });
      });
    }

    push = { sent: res.sent, failed: res.failed, devices: tokens.length };
    errors.push(...res.errors);

    // Har user ka push status uski apni row par. Jinke paas ek bhi phone nahi
    // tha unki row "skipped" ho jaati hai — aur yahi wo jawab hai jo admin
    // baar-baar poochta hai: "isko notification kyun nahi gayi?"
    if (batchId) {
      const noDevice: string[] = [];
      const failedAll: string[] = [];
      // devices ki ginti alag-alag hoti hai, isliye "gaya" wale ko ginti ke
      // hisaab se jhund me baantte hain (aksar sab ke paas 1 hi phone hota hai).
      const okByCount = new Map<number, string[]>();

      for (const p of targets) {
        const sendId = sendIdFor(p.id, "push");
        if (!sendId) continue;
        const tally = res.bySend.get(sendId);
        if (!tally) {
          noDevice.push(sendId);
        } else if (tally.sent > 0) {
          const n = tally.sent + tally.failed;
          const list = okByCount.get(n) ?? [];
          list.push(sendId);
          okByCount.set(n, list);
        } else {
          failedAll.push(sendId);
        }
      }

      tracking.push(
        markSendsBulk(noDevice, {
          status: "skipped",
          error: "koi device token nahi (app install/login nahi)",
          devices: 0,
        }),
      );
      tracking.push(
        markSendsBulk(failedAll, {
          status: "failed",
          error: "FCM ne sabhi device par mana kar diya",
        }),
      );
      okByCount.forEach((ids, n) => {
        tracking.push(markSendsBulk(ids, { status: "sent", devices: n, error: null }));
      });
    }

    // ⚠️ Ye logging pehle nahi thi, aur usi wajah se push fail hone par admin ko
    // kuch pata hi nahi chalta tha: error sirf HTTP response me jaata tha, aur
    // Logs screen khaali rehti thi. Ab har fail wahan dikhega.
    if (res.errors.length) {
      void logServerError(new Error(`push failed: ${res.errors[0]}`), {
        where: "admin/notify",
        channel,
        devices: tokens.length,
        sent: res.sent,
        failed: res.failed,
        allErrors: res.errors,
      });
    }
    // "Ek bhi device nahi mila" bhi batane laayak hai — ye fail nahi hai, par
    // admin ko lagta hai push toot gayi. Warning level isi ke liye.
    if (tokens.length === 0) {
      void logServerError(new Error("push: koi device token nahi mila"), {
        where: "admin/notify",
        channel,
        users: targets.length,
        hint: "users ne push wali nayi app install/login nahi ki",
      });
    }

    // App uninstall ho chuki / token expire — DB se hata do, warna har broadcast
    // me ye tokens fail ginte rahenge aur list kachre se bharti jaayegi.
    await dropDeadTokens(res.deadTokens);
  }

  // Response ke baad function marr jaata hai — tracking ke writes yahin nipta lo.
  await Promise.all(tracking).catch(() => {
    /* tracking adhoori reh jaye to bhi message to ja hi chuka hai */
  });

  return NextResponse.json({
    audience: picked ? "picked" : audience,
    channel,
    total: targets.length,
    sent,
    skipped,
    push,
    // UI ise leke seedha "Report" tab me is bhejne ka hisaab khol sakta hai.
    batchId,
    errors: errors.slice(0, 5),
  });
}
