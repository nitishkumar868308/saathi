import { createSign } from "node:crypto";

/**
 * Firebase Cloud Messaging (HTTP v1) — phone par push bhejne wala.
 *
 * ⚠️ Purana `fcm.googleapis.com/fcm/send` wala "server key" tareeka Google ne
 * band kar diya hai. Ab v1 hi chalta hai, aur usme har request ke saath ek
 * OAuth access token chahiye jo service-account se banta hai.
 *
 * Iske liye `google-auth-library` daalne ki zaroorat nahi — poora kaam Node ke
 * apne `crypto` se ho jaata hai: ek JWT banao, usse Google se access token
 * badlo, ek ghante tak use karte raho.
 *
 * Env (Vercel me — kabhi app me nahi):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY      (service-account JSON ki "private_key" value)
 *
 * Teenon me se ek bhi na ho to sab kuch chup-chaap `{ sent: 0, skipped }` lauta
 * deta hai — email bhejna isse kabhi nahi rukna chahiye.
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const RAW_KEY = process.env.FIREBASE_PRIVATE_KEY;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/**
 * App ka notification channel — `app-mobile/src/lib/notifications.ts` wala.
 *
 * ⚠️ Ye naam wahi hona chahiye. Galat channel id par Android notification ko
 * default (LOW importance) channel me daal deta hai — na awaaz, na screen par
 * dikhna. User ko lagta hai notification aayi hi nahi.
 */
const CHANNEL_ID = "reminders-fs";

export function isFcmConfigured(): boolean {
  return !!(PROJECT_ID && CLIENT_EMAIL && RAW_KEY);
}

/* --------------------------- access token --------------------------- */

// Access token ek ghante chalta hai. Har notification par naya maangna Google ki
// ek extra round-trip hai — 500 users ke broadcast me wo 500 baar hota.
let cached: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Env var me newline `\n` ban ke aata hai.
 *
 * Vercel/`.env` me multi-line value nahi jaati, isliye private key hamesha ek hi
 * line me `-----BEGIN...\nMIIE...\n-----END...` shakal me hoti hai. Bina isse
 * wapas asli newline banaye `createSign` "invalid PEM" phenk deta hai.
 */
function privateKey(): string {
  return (RAW_KEY ?? "").replace(/\\n/g, "\n");
}

async function accessToken(): Promise<string> {
  // 60 second ka margin — request bhejte-bhejte token expire na ho jaye.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = base64url(signer.sign(privateKey()));
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`fcm auth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

/* ------------------------------- send ------------------------------- */

export type PushResult = {
  sent: number;
  failed: number;
  /** Ab kaam ke nahi — DB se hata dene chahiye (app uninstall / token expire). */
  deadTokens: string[];
  errors: string[];
  /** Kis send row par kaam bana/bigda — tracking status isse bharta hai. */
  bySend: Map<string, { sent: number; failed: number }>;
};

/**
 * Ek phone ka pata + (agar tracking on hai to) uska `message_sends` row id.
 *
 * `sendId` isliye har token ke saath jaata hai, ek jagah nahi: ek hi user ke do
 * phone ho sakte hain, aur dono ka tap ek hi row par ginna chahiye — par ek user
 * ka tap doosre user ki row par kabhi nahi.
 */
export type PushTarget = { token: string; sendId?: string | null };

/**
 * Ek token par push bhejo.
 *
 * `notification` + `data` dono jaan-boojh ke bhejte hain:
 *   - `notification` se app BAND hone par bhi Android khud tray me dikha deta
 *     hai (koi JS chalane ki zaroorat nahi),
 *   - `data` se app KHULI ho to hum khud notifee se apni shakal me dikhate hain
 *     (`src/lib/push.ts`) — warna foreground me kuch dikhta hi nahi.
 *
 * Lautata hai: "ok" | "dead" (token bekaar) | error message.
 */
async function sendOne(
  bearer: string,
  target: PushTarget,
  title: string,
  body: string,
  extra?: Record<string, string>,
): Promise<"ok" | "dead" | string> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: target.token,
          notification: { title, body },
          // ⚠️ FCM ka `data` sirf strings leta hai — number/null daalte hi poori
          // request 400 ho jaati hai aur ek bhi notification nahi jaati.
          data: {
            kind: "admin",
            title,
            body,
            // Caller ka apna data (jaise support ticket ka id) — `kind` ko bhi
            // badal sakta hai, isliye ye phaila ke aakhir me nahi, yahan aata
            // hai aur neeche `...extra` use overwrite kar sakta hai.
            ...(extra ?? {}),
            // Notification par tap hone par app isi id se batata hai ki kisne
            // khola (`record_push_open`). Tracking band ho to bhejte hi nahi.
            ...(target.sendId ? { send_id: target.sendId } : {}),
          },
          android: {
            // Doze me bhi turant pahunche — broadcast aksar zaroori baat hoti hai.
            priority: "HIGH",
            notification: {
              channel_id: CHANNEL_ID,
              sound: "default",
            },
          },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default", "interruption-level": "time-sensitive" } },
          },
        },
      }),
      cache: "no-store",
    },
  );

  if (res.ok) return "ok";

  const text = await res.text();
  // 404 UNREGISTERED = app uninstall ho gayi ya token expire.
  // 400 INVALID_ARGUMENT = token hi galat shakal ka hai.
  // Dono soorat me token rakhna bekaar hai — har broadcast me fail ginta rahega.
  if (
    res.status === 404 ||
    text.includes("UNREGISTERED") ||
    text.includes("INVALID_ARGUMENT")
  ) {
    return "dead";
  }
  return `${res.status}: ${text.slice(0, 160)}`;
}

/** Ek saath kitne push chalne dein — Google ko ek jhatke me 500 request bhejna theek nahi. */
const BATCH = 50;

/**
 * Kai tokens par ek hi notification.
 *
 * Batch me chalta hai: 500 users ko ek-ek karke bhejne me serverless function ka
 * time khatam ho jaata hai, aur sab ek saath chhodne par Google rate-limit karta
 * hai. 50 ka jhund dono se bachata hai.
 */
export async function sendPush(
  targets: PushTarget[],
  title: string,
  body: string,
  /**
   * Notification ke saath jaane wala extra data — sirf strings.
   *
   * ⚠️ FCM ka `data` sirf string values leta hai. Number ya null daalte hi poori
   * request 400 ho jaati hai aur ek bhi notification nahi jaati.
   */
  extra?: Record<string, string>,
): Promise<PushResult> {
  const out: PushResult = {
    sent: 0,
    failed: 0,
    deadTokens: [],
    errors: [],
    bySend: new Map(),
  };
  if (!isFcmConfigured() || targets.length === 0) return out;

  /** Ek token ka natija us user ke send row par bhi gino. */
  const tally = (t: PushTarget, ok: boolean) => {
    if (!t.sendId) return;
    const cur = out.bySend.get(t.sendId) ?? { sent: 0, failed: 0 };
    if (ok) cur.sent++;
    else cur.failed++;
    out.bySend.set(t.sendId, cur);
  };

  let bearer: string;
  try {
    bearer = await accessToken();
  } catch (e) {
    out.errors.push(String(e));
    out.failed = targets.length;
    targets.forEach((t) => tally(t, false));
    return out;
  }

  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map((t) =>
        sendOne(bearer, t, title, body, extra).catch((e) => String(e)),
      ),
    );
    results.forEach((r, idx) => {
      const t = slice[idx];
      if (r === "ok") {
        out.sent++;
        tally(t, true);
        return;
      }
      out.failed++;
      tally(t, false);
      if (r === "dead") out.deadTokens.push(t.token);
      else if (out.errors.length < 5) out.errors.push(r);
    });
  }

  return out;
}
