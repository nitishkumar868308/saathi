import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { deleteObject, listObjects, r2Configured, r2Key } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Account delete requests — dekhna aur poora karna, dono yahin se.
 *
 * ⚠️ Pehle ye request `contact_messages` me ek prefix ke saath padi rehti thi.
 * Admin use sirf PADH sakta tha — na status, na koi action. Play Store ki
 * data-deletion shart ke liye request lena kaafi nahi hai; use poora karna bhi
 * padta hai, aur uska saboot rakhna bhi.
 *
 * Do raaste, jaan-boojh ke alag:
 *
 *   hide  (soft) — `profiles.deleted_at` set. Data DB me rehta hai par RLS use
 *                  user side par band kar deti hai. Wapas laaya ja sakta hai.
 *   purge (hard) — sab kuch sach me delete: storage ki files, har table ki rows,
 *                  aur aakhir me auth user. Wapas nahi aata.
 *
 * Hamesha hide pehle, purge baad me — user aksar do din baad wapas aa jaata hai,
 * aur purge ke baad uske paas kuch nahi bachta.
 */

/**
 * User ka data kahan-kahan pada hai.
 *
 * ⚠️ Ye list is poore feature ka dil hai. Ek bhi table chhoot gayi to "delete"
 * jhoot ban jaata hai — user ka data kahin na kahin pada rehta hai jabki hum
 * keh chuke hote hain ki hata diya. Nayi table jodo to ise bhi jodna.
 *
 * `label` admin ko dikhta hai, isliye technical naam nahi — wo cheez jo user
 * samajhta hai.
 */
const USER_TABLES: { table: string; col: string; label: string }[] = [
  { table: "documents", col: "user_id", label: "Documents" },
  { table: "reminders", col: "user_id", label: "Reminders" },
  { table: "notes", col: "user_id", label: "Notes" },
  { table: "messages", col: "user_id", label: "Saathi chat" },
  { table: "support_tickets", col: "user_id", label: "Support tickets" },
  { table: "reviews", col: "user_id", label: "Reviews" },
  { table: "payments", col: "user_id", label: "Payments" },
  { table: "user_details", col: "user_id", label: "Profile details" },
  { table: "device_tokens", col: "user_id", label: "Notification tokens" },
  { table: "device_users", col: "user_id", label: "Device logins" },
  { table: "analytics_events", col: "user_id", label: "Analytics events" },
  { table: "service_usage", col: "user_id", label: "AI / WhatsApp usage" },
  { table: "message_sends", col: "user_id", label: "Broadcast messages" },
  { table: "app_errors", col: "user_id", label: "Error logs" },
  // Phone verification ke bheje hue OTP ka hisaab (`supabase/phone-otp.sql`).
  // Isme user ka phone number hai, isliye purge me shaamil hona zaroori hai.
  { table: "phone_otp", col: "user_id", label: "SMS OTP history" },
  { table: "referrals", col: "referrer_id", label: "Referrals made" },
  { table: "referrals", col: "referee_id", label: "Referred by" },
  // Profile sabse aakhir me — baaki sab uske hisaab se dikhta hai.
  { table: "profiles", col: "id", label: "Profile" },
];

/** Documents ki asli files yahan padi hain (private bucket). */
const DOC_BUCKET = "documents";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * `user_id` / `id` body se aate hain aur seedha PostgREST ke URL me chipakte
 * hain — `profiles?id=eq.<uid>`, `documents?user_id=eq.<uid>`, aur (sabse
 * zaroori) DELETE wale filter me.
 *
 * ⚠️ Ye route service_role se chalta hai, yaani us request ke paas poora DB
 * hai. Guard peeche khada hai (sirf `deleteRequests` menu wala admin), par jo
 * request 20 table par DELETE chalati ho uske filter ko bina jaanche URL me
 * jodna theek nahi — ek `&` ya `,` filter ka matlab badal sakta hai, aur us
 * galti ko wapas nahi laaya ja sakta.
 *
 * Shakal ki jaanch sabse sasta taala hai: dono asli me UUID hain.
 */
function badId(v: string): boolean {
  return !UUID.test(v);
}

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Har handler ka pehla pehra — 401/403/503 ka response, ya null (sab theek). */
async function denied(): Promise<NextResponse | null> {
  const g = await guard("deleteRequests");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  return null;
}

/**
 * Ek table me is user ki kitni rows hain.
 *
 * `head=true` + `count=exact` se rows aati hi nahi, sirf ginti aati hai —
 * 5000 documents wale user par bhi ye halka rehta hai. Table hi na ho (koi SQL
 * file nahi chalayi) to `null`, taaki UI use "0" na dikha de: dono baaton me
 * bada fark hai.
 */
async function countRows(table: string, col: string, uid: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${uid}&select=${col}&limit=0`,
      { headers: headers({ Prefer: "count=exact" }), cache: "no-store" },
    );
    if (!res.ok) return null;
    // content-range: "0-0/42"
    const total = res.headers.get("content-range")?.split("/")[1];
    const n = Number(total);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Is user ki PURANI storage files (Supabase ke documents bucket me `<uid>/…`).
 *
 * ⚠️ Ye sirf legacy files hain — naye upload R2 par jaate hain (neeche
 * `listR2Files`). Bucket hi na ho (4xx) to "koi file nahi" maante hain, par 5xx
 * ya net ka fail `error` me aata hai: us haal me "0 files" kehna jhooth hota.
 */
async function listUserFiles(uid: string): Promise<{ files: string[]; error: string | null }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${DOC_BUCKET}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ prefix: `${uid}/`, limit: 1000 }),
      cache: "no-store",
    });
    if (!res.ok) {
      return { files: [], error: res.status >= 500 ? `legacy storage list: HTTP ${res.status}` : null };
    }
    const rows = (await res.json()) as { name?: string }[];
    return {
      files: rows.map((r) => `${uid}/${r.name}`).filter((p) => !p.endsWith("/")),
      error: null,
    };
  } catch (e) {
    return { files: [], error: `legacy storage list: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Is user ki R2 files — documents (har version) aur profile photo.
 *
 * ⚠️ Pehle purge yahan dekhta hi nahi tha. Asli files R2 par hain, aur purge
 * sirf purana Supabase bucket saaf karke "deleted" likh deta tha — user ka
 * passport R2 me pada rehta tha. `documents/<uid>/` prefix se list isliye ki
 * DB ki rows par bharosa nahi kar sakte: renew wale purane versions, adhoore
 * upload — sab isi folder me hote hain par har ek ki row nahi hoti.
 *
 * R2 set hi nahi (`r2Configured()` false) to `skipped` — us haal me R2 par kuch
 * ho hi nahi sakta.
 */
async function listR2Files(
  uid: string,
): Promise<{ keys: string[]; skipped: boolean; error: string | null }> {
  if (!r2Configured()) return { keys: [], skipped: true, error: null };
  try {
    const docs = await listObjects(r2Key.documentPath(`${uid}/`));
    // Avatar ka folder bhi prefix se — `avatar.jpg` ke alawa kuch pada ho to wo bhi.
    const avatarDir = r2Key.avatar(uid).replace(/[^/]+$/, "");
    const avatars = await listObjects(avatarDir);
    return { keys: [...docs, ...avatars], skipped: false, error: null };
  } catch (e) {
    return {
      keys: [],
      skipped: false,
      error: `R2 list: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Kai keys hata do — thodi-thodi ek saath, taaki 500 files me timeout na ho. */
async function deleteR2Keys(keys: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i += 8) {
    const slice = keys.slice(i, i + 8);
    const results = await Promise.all(
      slice.map((k) => deleteObject(k).catch(() => false)),
    );
    results.forEach((ok, j) => {
      if (!ok) failed.push(slice[j]);
    });
  }
  return failed;
}

type DeleteRequestRow = { id: string; user_id: string | null; email: string };

async function getRequest(id: string): Promise<DeleteRequestRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/account_delete_requests?id=eq.${id}&select=id,user_id,email`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`account_delete_requests: ${res.status}`);
  const rows = (await res.json()) as DeleteRequestRow[];
  return rows[0] ?? null;
}

async function profileEmail(uid: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=email`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`profiles: ${res.status}`);
  const rows = (await res.json()) as { email: string | null }[];
  return rows[0]?.email ?? null;
}

/**
 * Hide/purge se pehle: ye uid sach me isi request ka hai?
 *
 * ⚠️ Pehle request me `user_id` form me likhe EMAIL se apne aap jud jaata tha.
 * Koi bhi kisi ka email daal ke uske account ki delete request bana sakta tha,
 * aur admin ko wo bilkul asli jaisi dikhti thi. Ab `user_id` sirf tab judta hai
 * jab request login token ke saath aayi ho (email verified). Bina uske admin ko
 * email se mila account "suggested" dikhta hai — aur us par kaam tabhi hota hai
 * jab admin ne alag se `unverified_ok` diya ho (UI me ek aur pushti).
 *
 * `null` = theek hai. Warna wo error jo admin ko dikhana hai.
 */
async function checkOwnership(
  id: string,
  uid: string,
  unverifiedOk: boolean,
): Promise<string | null> {
  const req = await getRequest(id);
  if (!req) return "request nahi mili";
  if (req.user_id) return req.user_id === uid ? null : "user_id is request ka nahi hai";
  if (!unverifiedOk) return "email verified nahi hai — pehle alag se pushti chahiye";
  const email = await profileEmail(uid);
  if (!email || email.trim().toLowerCase() !== req.email.trim().toLowerCase()) {
    return "is account ka email request ke email se nahi milta";
  }
  return null;
}

export async function GET() {
  const bad = await denied();
  if (bad) return bad;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/account_delete_requests?select=*&order=created_at.desc&limit=200`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const requests = (await res.json()) as {
      id: string;
      user_id: string | null;
      email: string | null;
    }[];

    /**
     * Bina `user_id` wali (email verified NAHI) requests ke liye email se mila
     * account — sirf SUJHAAV.
     *
     * ⚠️ Ye request par likha nahi jaata. Form me koi bhi kisi ka email daal
     * sakta hai; is sujhaav par kaam tabhi hota hai jab admin alag se pushti de
     * (`unverified_ok`, upar `checkOwnership` dekho).
     */
    const suggested: Record<string, string> = {};
    const unlinked = requests.filter((r) => !r.user_id && r.email);
    if (unlinked.length > 0) {
      const emails = Array.from(
        new Set(
          unlinked.flatMap((r) => {
            const e = String(r.email).trim().replace(/"/g, "");
            return [e, e.toLowerCase()];
          }),
        ),
      );
      const list = emails.map((e) => `"${e}"`).join(",");
      const er = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?email=in.(${encodeURIComponent(list)})&select=id,email`,
        { headers: headers(), cache: "no-store" },
      );
      if (er.ok) {
        const rows = (await er.json()) as { id: string; email: string | null }[];
        const byEmail = new Map(
          rows.filter((p) => p.email).map((p) => [String(p.email).toLowerCase(), p.id]),
        );
        for (const r of unlinked) {
          const hit = byEmail.get(String(r.email).trim().toLowerCase());
          if (hit) suggested[r.id] = hit;
        }
      }
    }

    /**
     * Har pending request ke user ka profile — taaki admin ko dikhe ki account
     * abhi chalu hai ya pehle se hidden. Bina iske admin ko pata hi nahi chalta
     * ki uska pichhla "hide" laga bhi tha ya nahi.
     */
    const uids = Array.from(
      new Set([
        ...(requests.map((r) => r.user_id).filter(Boolean) as string[]),
        ...Object.values(suggested),
      ]),
    );
    let profiles: Record<string, { deleted_at: string | null; email: string | null }> = {};
    if (uids.length > 0) {
      const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${uids.join(",")})&select=id,email,deleted_at`,
        { headers: headers(), cache: "no-store" },
      );
      if (pr.ok) {
        const rows = (await pr.json()) as {
          id: string;
          email: string | null;
          deleted_at: string | null;
        }[];
        profiles = Object.fromEntries(
          rows.map((p) => [p.id, { deleted_at: p.deleted_at, email: p.email }]),
        );
      }
    }

    return NextResponse.json({ requests, profiles, suggested });
  } catch (err) {
    console.error("[admin/delete-requests GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}

/**
 * Ek user ka poora hisaab — kya-kya, kitna.
 *
 * Admin ko delete dabane se PEHLE ye dikhta hai. "42 documents, 130 reminders"
 * dekh kar wo soch samajh ke dabata hai; ek khaali "Delete" button par wo
 * bharosa nahi ho sakta.
 */
async function inventory(uid: string) {
  const items = await Promise.all(
    USER_TABLES.map(async (t) => ({
      ...t,
      count: await countRows(t.table, t.col, uid),
    })),
  );
  const legacy = await listUserFiles(uid);
  const r2 = await listR2Files(uid);
  return {
    items,
    // R2 + purana bucket — dono milake. List fail hui to `filesError` me, taaki
    // UI "0 files" ka jhootha sukoon na de.
    files: legacy.files.length + r2.keys.length,
    filesError: legacy.error ?? r2.error,
  };
}

export async function POST(request: Request) {
  const bad = await denied();
  if (bad) return bad;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const id = String(body.id ?? "").trim();
  const uid = String(body.user_id ?? "").trim();
  // Bina verified email wali request par kaam — admin ki alag pushti ke baad hi.
  const unverifiedOk = body.unverified_ok === true;

  // Shakal pehle — dono aage URL filter me jaate hain (upar `badId` dekho).
  if (uid && badId(uid)) {
    return NextResponse.json({ error: "bad user_id" }, { status: 400 });
  }
  if (id && badId(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  try {
    /* ---- kya-kya delete hoga (sirf dikhane ke liye) ---- */
    if (action === "inventory") {
      if (!uid) return NextResponse.json({ error: "user_id chahiye" }, { status: 400 });
      return NextResponse.json(await inventory(uid));
    }

    /* ---- soft: user side band, data DB me safe ---- */
    if (action === "hide" || action === "unhide") {
      if (!uid) return NextResponse.json({ error: "user_id chahiye" }, { status: 400 });
      if (id) {
        const bad = await checkOwnership(id, uid, unverifiedOk);
        if (bad) return NextResponse.json({ error: bad }, { status: 409 });
      }
      const deleted_at = action === "hide" ? new Date().toISOString() : null;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ deleted_at }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`profiles: ${res.status} ${await res.text()}`);

      if (id) await setStatus(id, action === "hide" ? "hidden" : "pending", null);
      return NextResponse.json({ ok: true });
    }

    /* ---- admin ne mana kiya ---- */
    if (action === "reject") {
      if (!id) return NextResponse.json({ error: "id chahiye" }, { status: 400 });
      await setStatus(id, "rejected", null, String(body.note ?? "") || null);
      return NextResponse.json({ ok: true });
    }

    /* ---- hard: sab kuch sach me mita do ---- */
    if (action === "purge") {
      if (!uid) return NextResponse.json({ error: "user_id chahiye" }, { status: 400 });
      if (id) {
        const bad = await checkOwnership(id, uid, unverifiedOk);
        if (bad) return NextResponse.json({ error: bad }, { status: 409 });
      }

      const removed: Record<string, number> = {};
      /**
       * ⚠️ Pehle har fail chup-chaap nigal liya jaata tha — file delete na ho,
       * table ki DELETE 500 de, auth user na hate — aur aakhir me request
       * "deleted" mark ho jaati thi. Yaani Play Store ki shart ke saamne hum
       * "sab hata diya" ka saboot rakh rahe the jabki data pada tha.
       *
       * Ab har fail yahan jama hota hai. Ek bhi ho to status NAHI badalta
       * (DB ka check constraint sirf pending/hidden/deleted/rejected maanta hai,
       * "partial" jaisa koi status hai hi nahi) — admin ko poori list dikhti hai
       * aur wo dobara purge chala sakta hai. Purge dobara chalana safe hai: jo
       * hat chuka wo 0 ginta hai.
       */
      const failures: string[] = [];

      // 1. Storage ki files. Rows se PEHLE — rows chali gayi to file ka rasta
      //    hi nahi bachta aur wo bucket me hamesha ke liye padi reh jaati hai.
      //
      // 1a. R2 — asli files yahin hain.
      const r2 = await listR2Files(uid);
      if (r2.error) failures.push(r2.error);
      if (r2.keys.length > 0) {
        const failed = await deleteR2Keys(r2.keys);
        const done = r2.keys.length - failed.length;
        if (done > 0) removed["Files (R2)"] = done;
        if (failed.length > 0) {
          failures.push(`R2 delete: ${failed.length} file nahi hati (${failed.slice(0, 3).join(", ")})`);
        }
      }

      // 1b. Purana Supabase bucket — legacy files.
      const legacy = await listUserFiles(uid);
      if (legacy.error) failures.push(legacy.error);
      if (legacy.files.length > 0) {
        try {
          const del = await fetch(`${SUPABASE_URL}/storage/v1/object/${DOC_BUCKET}`, {
            method: "DELETE",
            headers: headers(),
            body: JSON.stringify({ prefixes: legacy.files }),
            cache: "no-store",
          });
          if (del.ok) removed["files"] = legacy.files.length;
          else failures.push(`legacy storage delete: HTTP ${del.status}`);
        } catch (e) {
          failures.push(`legacy storage delete: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      /**
       * ⚠️ Storage adhoori hai to yahin ruko — rows aur login ko haath mat lagao.
       *
       * Files ki key uid se banti hai, isliye dobara purge unhe phir dhoondh
       * leta hai. Par agar yahan se aage badh ke auth user hata dete to request
       * ka `user_id` (on delete set null) khaali ho jaata, aur admin ke paas
       * dobara chalane ko uid hi na bachta — bachi hui files anaath reh jaatin.
       */
      if (failures.length > 0) {
        return NextResponse.json(
          { ok: false, partial: true, removed, failures },
          { status: 502 },
        );
      }

      // 2. Har table ki rows. Ginti pehle le lete hain — delete ke baad ginne
      //    ko kuch bachta hi nahi, aur `removed` hi ekmatra saboot hota hai.
      for (const t of USER_TABLES) {
        const before = await countRows(t.table, t.col, uid);
        if (before === null) continue; // table hi nahi hai — chhod do
        if (before === 0) continue;
        try {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/${t.table}?${t.col}=eq.${uid}`,
            { method: "DELETE", headers: headers({ Prefer: "return=minimal" }), cache: "no-store" },
          );
          if (res.ok) removed[t.label] = (removed[t.label] ?? 0) + before;
          else failures.push(`${t.table}.${t.col}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
        } catch (e) {
          failures.push(`${t.table}.${t.col}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // 3. Aakhir me auth user. Iske baad login ka koi raasta nahi bachta.
      //
      // ⚠️ Sirf tab jab upar sab saaf hua ho — wajah wahi jo storage wale
      // return par likhi hai (login hatte hi request ka user_id khaali).
      if (failures.length === 0) {
        try {
          const au = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
            method: "DELETE",
            headers: headers(),
            cache: "no-store",
          });
          // 404 = pehle hi hat chuka (dobara purge) — wo fail nahi hai.
          if (au.ok) removed["Login"] = 1;
          else if (au.status !== 404) failures.push(`auth user: HTTP ${au.status}`);
        } catch (e) {
          failures.push(`auth user: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (failures.length > 0) {
        return NextResponse.json(
          { ok: false, partial: true, removed, failures },
          { status: 502 },
        );
      }

      if (id) await setStatus(id, "deleted", removed);
      return NextResponse.json({ ok: true, removed });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[admin/delete-requests POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "action failed" },
      { status: 500 },
    );
  }
}

async function setStatus(
  id: string,
  status: string,
  removed: Record<string, number> | null,
  note?: string | null,
) {
  const patch: Record<string, unknown> = {
    status,
    handled_at: status === "pending" ? null : new Date().toISOString(),
  };
  if (removed) patch.removed = removed;
  if (note !== undefined) patch.note = note;

  // ⚠️ Pehle iska jawab dekha hi nahi jaata tha — status na bache to bhi UI
  // "ho gaya" dikhata. Fail par throw, taaki admin ko error dikhe.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/account_delete_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`status save nahi hua: ${res.status} ${await res.text()}`);
}
