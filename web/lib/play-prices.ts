/**
 * Google Play Console ka price laane, rakhne aur padhne ka poora hissa.
 *
 * ── Ek hi sach ─────────────────────────────────────────────────────────────
 * Price sirf Play Console me set hota hai. App wahi price seedha Play se padhti
 * hai. Website aur admin par Play Billing hota hi nahi, isliye unke liye server
 * Play Developer API se price laata hai aur `play_prices` table me rakh deta hai
 * (`supabase/play-prices.sql`).
 *
 *   Play Console  →  Play Developer API  →  play_prices  →  web + admin
 *                 ↘  Play Billing (seedha)              →  app
 *
 * ⚠️ Yahan se price LIKHA nahi jaata, sirf PADHA jaata hai — jaan-boojh ke.
 *    `subscriptions.patch` se daam badalna technically ho sakta hai, par ek
 *    galat call 190 desh ke price bigaad deti hai, aur purane subscribers ka
 *    price badalne ka apna alag consent flow hota hai jise API se aadha chalana
 *    ulta pad jaata hai. Daam badalne ki jagah ek hi hai — Play Console.
 *
 * ── Chalu karne ke liye ────────────────────────────────────────────────────
 *   GOOGLE_PLAY_SA_JSON        service account ki JSON (ya uska base64)
 *   GOOGLE_PLAY_PACKAGE_NAME   com.apkasaathi.app jaisa applicationId
 *   PLAY_PRODUCT_MONTHLY       default 'plus_monthly'
 *   PLAY_PRODUCT_YEARLY        default 'plus_yearly'
 *
 * Aur Play Console > Users and permissions me us service account ko is app ka
 * access dena hoga, warna Google 401/403 deta hai (key sahi hone par bhi).
 */
import { getGoogleAccessToken, googleAuthConfigured, googleAuthStatus } from "@/lib/google-auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() ?? "";

/**
 * Play Console ke subscription id — app ke code se BILKUL milne chahiye.
 * App `plus_monthly` / `plus_yearly` dhoondhti hai
 * (`app-mobile/src/app/upgrade.tsx` → `packageFor`). Console me naam alag ho to
 * yahan env se badlo, dono jagah nahi.
 */
export const PLAY_PRODUCTS = {
  monthly: process.env.PLAY_PRODUCT_MONTHLY?.trim() || "plus_monthly",
  yearly: process.env.PLAY_PRODUCT_YEARLY?.trim() || "plus_yearly",
} as const;

export type PlayPeriod = "monthly" | "yearly";

export type PlayPriceRow = {
  productId: string;
  basePlanId: string;
  /** ISO2, uppercase. */
  region: string;
  currency: string;
  /** 1 unit = 1,000,000 micros. ₹99 = 99000000. */
  micros: number;
  /** Play ka ISO 8601 duration — 'P1M', 'P1Y'. Na mile to null. */
  billingPeriod: string | null;
};

export type PlaySyncMeta = {
  /** Sab env set hain? Na hon to web chup-chaap purane fallback par chalta hai. */
  configured: boolean;
  /** Chalu kyun nahi hai (ya "on"). */
  status: string;
  /** Aakhri KAAMYAB sync. */
  syncedAt: string | null;
  /** Aakhri koshish (fail bhi) — isse pata chalta hai cron chal raha hai ya nahi. */
  attemptedAt: string | null;
  ok: boolean;
  message: string | null;
  rowsCount: number;
};

/* ------------------------------ config ------------------------------ */

export function playPricesConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && PACKAGE_NAME && googleAuthConfigured());
}

/** Ek line me wajah — admin panel isi ko dikhata hai. */
export function playPricesStatus(): string {
  if (!SUPABASE_URL || !SUPABASE_KEY) return "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set nahi hai";
  if (!PACKAGE_NAME) return "GOOGLE_PLAY_PACKAGE_NAME set nahi hai";
  const auth = googleAuthStatus();
  if (auth !== "on") return auth;
  return "on";
}

/* ------------------------------ helpers ------------------------------ */

function sbHeaders(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Play ka `Money` → micros.
 *
 * `units` string me aata hai (bade number JSON me safe rakhne ke liye) aur
 * `nanos` 0–999,999,999 ka hissa hai. ₹99.50 = units "99", nanos 500000000.
 */
function toMicros(price: { units?: string; nanos?: number } | undefined): number | null {
  if (!price) return null;
  const units = Number(price.units ?? 0);
  const nanos = Number(price.nanos ?? 0);
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) return null;
  const micros = units * 1_000_000 + Math.round(nanos / 1000);
  return Number.isFinite(micros) && micros >= 0 ? micros : null;
}

/**
 * micros → dikhane laayak string, us currency ke apne niyam ke saath.
 *
 * `Intl` currency code se khud sahi symbol, sahi jagah aur sahi decimal lagata
 * hai — ₹99, $1.99, 99 kr, ¥990. Isi wajah se `play_prices` me symbol store
 * nahi hota: wo ek aur cheez hoti jo galat ho sakti thi.
 *
 * Decimal tabhi dikhte hain jab sach me hon. Play par daam aksar poore hote
 * hain (₹99), aur "₹99.00" bilkul bekaar lagta hai.
 */
export function formatMicros(currency: string, micros: number, locale = "en-IN"): string {
  const amount = micros / 1_000_000;
  const whole = micros % 1_000_000 === 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  } catch {
    // Currency code hi ajeeb ho (aisa hona nahi chahiye) — kam se kam number to
    // sahi dikhe.
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
}

/** Sirf symbol ("₹", "$") — jahan number alag se chahiye. */
export function symbolFor(currency: string, locale = "en-IN"): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** micros → poora number (₹99 → 99). Sirf jahan purana `number` API chahiye. */
export function microsToAmount(micros: number): number {
  const n = micros / 1_000_000;
  return n >= 20 ? Math.round(n) : Math.round(n * 100) / 100;
}

/* --------------------------- Play API se laao --------------------------- */

type PlayMoney = { currencyCode?: string; units?: string; nanos?: number };

type PlayBasePlan = {
  basePlanId?: string;
  state?: string;
  regionalConfigs?: {
    regionCode?: string;
    newSubscriberAvailability?: boolean;
    price?: PlayMoney;
  }[];
  autoRenewingBasePlanType?: { billingPeriodDuration?: string };
  prepaidBasePlanType?: { billingPeriodDuration?: string };
};

type PlaySubscription = {
  productId?: string;
  basePlans?: PlayBasePlan[];
};

/**
 * Ek subscription ke saare region ka price.
 *
 * Sirf ACTIVE base plan liye jaate hain — DRAFT wo hai jo Console me bana to
 * hai par kabhi launch nahi hua, aur uska price kisi user ko kabhi nahi dikhta.
 * Use uthana yahan sabse mehnga bug hota: website ek aisa daam dikhati jo Play
 * par exist hi nahi karta.
 *
 * Agar EK bhi ACTIVE base plan na mile to hum kuch nahi lautate aur wajah bata
 * dete hain — khaali chhod dena purane (sahi) price ko mita dene se behtar hai.
 */
async function fetchSubscriptionPrices(
  token: string,
  productId: string,
): Promise<{ rows: PlayPriceRow[]; warning: string | null }> {
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(PACKAGE_NAME)}/subscriptions/${encodeURIComponent(productId)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new Error(
        `'${productId}' Play Console me nahi mila (package ${PACKAGE_NAME}). ` +
          `Subscription id bilkul wahi hona chahiye — PLAY_PRODUCT_MONTHLY/YEARLY se badal sakte ho.`,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Play API ne mana kiya (${res.status}). Play Console > Users and permissions me ` +
          `service account ko is app ka access diya? Google Cloud me "Google Play Android ` +
          `Developer API" enable hai? — ${body.slice(0, 200)}`,
      );
    }
    throw new Error(`Play API ${res.status}: ${body.slice(0, 300)}`);
  }

  const sub = (await res.json()) as PlaySubscription;
  const plans = sub.basePlans ?? [];
  const active = plans.filter((p) => String(p.state ?? "").toUpperCase() === "ACTIVE");

  if (!active.length) {
    return {
      rows: [],
      warning:
        `'${productId}' ka koi ACTIVE base plan nahi hai` +
        (plans.length ? ` (${plans.length} base plan hain, par sab DRAFT/INACTIVE).` : "."),
    };
  }

  const rows: PlayPriceRow[] = [];
  for (const plan of active) {
    const basePlanId = String(plan.basePlanId ?? "").trim();
    if (!basePlanId) continue;
    const billingPeriod =
      plan.autoRenewingBasePlanType?.billingPeriodDuration ??
      plan.prepaidBasePlanType?.billingPeriodDuration ??
      null;

    for (const rc of plan.regionalConfigs ?? []) {
      const region = String(rc.regionCode ?? "").toUpperCase();
      const currency = String(rc.price?.currencyCode ?? "").toUpperCase();
      const micros = toMicros(rc.price);
      // Region ka price set hi na ho (base plan wahan available nahi) to us row
      // ka koi matlab nahi — 0 likhna "muft hai" jaisa jhooth ban jaata.
      if (!/^[A-Z]{2}$/.test(region) || !/^[A-Z]{3}$/.test(currency) || micros === null) {
        continue;
      }
      rows.push({ productId, basePlanId, region, currency, micros, billingPeriod });
    }
  }

  return {
    rows,
    warning: rows.length ? null : `'${productId}' ke kisi region me price set nahi hai.`,
  };
}

/* ------------------------------ DB likhna ------------------------------ */

async function upsertRows(rows: PlayPriceRow[], stamp: string): Promise<void> {
  if (!rows.length) return;
  const payload = rows.map((r) => ({
    product_id: r.productId,
    base_plan_id: r.basePlanId,
    region_code: r.region,
    region_currency: r.currency,
    amount_micros: r.micros,
    billing_period: r.billingPeriod,
    synced_at: stamp,
  }));

  // PostgREST ek request me hazaron row le leta hai, par Play ke 190+ region ×
  // 2 product bhi 400 ke aas-paas hi hote hain — ek hi call kaafi hai.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/play_prices?on_conflict=product_id,base_plan_id,region_code`,
    {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404 || /does not exist|schema cache/i.test(body)) {
      throw new Error("play_prices table nahi mila — Supabase me 'supabase/play-prices.sql' run karo.");
    }
    throw new Error(`play_prices write: ${res.status} ${body.slice(0, 300)}`);
  }
}

/**
 * Jo region ab Play par nahi rahe, unhe hatao.
 *
 * ⚠️ Ye SIRF us product ke liye chalta hai jo abhi kaamyabi se aaya hai. Ek
 *    product fail ho aur hum uski purani rows bhi mita dein, to website us
 *    plan ka price dikhana hi band kar deti — sirf isliye ki Google ne us ek
 *    call par 500 de diya tha.
 */
async function deleteStale(productId: string, stamp: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/play_prices` +
      `?product_id=eq.${encodeURIComponent(productId)}&synced_at=lt.${encodeURIComponent(stamp)}`,
    { method: "DELETE", headers: sbHeaders({ Prefer: "return=minimal" }), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`play_prices cleanup: ${res.status} ${body.slice(0, 200)}`);
  }
}

async function writeSyncMeta(meta: {
  ok: boolean;
  message: string | null;
  rowsCount: number;
  syncedAt: string | null;
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  // `synced_at` sirf kaamyabi par badalta hai — fail par purana rehna chahiye,
  // warna "data kitna purana hai" ka jawab hi gum ho jaata hai.
  const row: Record<string, unknown> = {
    id: true,
    ok: meta.ok,
    message: meta.message,
    rows_count: meta.rowsCount,
    attempted_at: new Date().toISOString(),
  };
  if (meta.syncedAt) row.synced_at = meta.syncedAt;

  await fetch(`${SUPABASE_URL}/rest/v1/play_price_sync?on_conflict=id`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([row]),
    cache: "no-store",
  }).catch(() => {
    /* meta likhna fail ho to sync ko fail mat karo — price to aa hi chuka hai */
  });
}

export type SyncResult = {
  ok: boolean;
  rows: number;
  /** Kaunse product se kitne region aaye — admin ko yahi sabse kaam ka hai. */
  products: { productId: string; rows: number; error: string | null }[];
  message: string | null;
  syncedAt: string | null;
};

/**
 * Play Console → `play_prices`. Cron roz chalata hai, admin "Sync now" se turant.
 *
 * Har product apne aap me alag hai: ek fail ho to doosra phir bhi update hota
 * hai. Poora sync tabhi "fail" hai jab EK bhi product na aaya ho.
 */
export async function syncPlayPrices(): Promise<SyncResult> {
  if (!playPricesConfigured()) {
    const message = playPricesStatus();
    await writeSyncMeta({ ok: false, message, rowsCount: 0, syncedAt: null });
    return { ok: false, rows: 0, products: [], message, syncedAt: null };
  }

  const stamp = new Date().toISOString();
  const wanted = Array.from(new Set([PLAY_PRODUCTS.monthly, PLAY_PRODUCTS.yearly]));
  const products: SyncResult["products"] = [];
  const warnings: string[] = [];
  let total = 0;

  let token: string;
  try {
    token = await getGoogleAccessToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSyncMeta({ ok: false, message, rowsCount: 0, syncedAt: null });
    return { ok: false, rows: 0, products: [], message, syncedAt: null };
  }

  for (const productId of wanted) {
    try {
      const { rows, warning } = await fetchSubscriptionPrices(token, productId);
      if (rows.length) {
        await upsertRows(rows, stamp);
        await deleteStale(productId, stamp);
      }
      if (warning) warnings.push(warning);
      total += rows.length;
      products.push({ productId, rows: rows.length, error: warning });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      products.push({ productId, rows: 0, error: message });
      warnings.push(message);
    }
  }

  const ok = total > 0;
  const message = warnings.length ? warnings.join(" | ") : null;
  await writeSyncMeta({ ok, message, rowsCount: total, syncedAt: ok ? stamp : null });
  return { ok, rows: total, products, message, syncedAt: ok ? stamp : null };
}

/* ------------------------------ DB padhna ------------------------------ */

type DbRow = {
  product_id: string;
  base_plan_id: string;
  region_code: string;
  region_currency: string;
  amount_micros: number | string;
  billing_period: string | null;
};

function toRow(r: DbRow): PlayPriceRow {
  return {
    productId: r.product_id,
    basePlanId: r.base_plan_id,
    region: r.region_code,
    currency: r.region_currency,
    // bigint PostgREST se string me bhi aa sakta hai.
    micros: Number(r.amount_micros),
    billingPeriod: r.billing_period,
  };
}

const SELECT = "product_id,base_plan_id,region_code,region_currency,amount_micros,billing_period";

/**
 * Ek desh ka Play price — monthly aur yearly.
 *
 * Us desh ka price na ho to `null`. Caller (`lib/pricing.ts`) tab purane
 * country_pricing wale hisaab par gir jaata hai — website ka price kabhi khaali
 * nahi dikhna chahiye.
 */
export async function getPlayPricesForRegion(
  region: string,
): Promise<Partial<Record<PlayPeriod, PlayPriceRow>> | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const code = region.toUpperCase();
  // Public query se aata hai — ISO2 ke alawa kuch bhi PostgREST ke filter me
  // chipak sakta hai, aur ye service-role key ke saath jaata hai.
  if (!/^[A-Z]{2}$/.test(code)) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/play_prices?region_code=eq.${code}&select=${SELECT}`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        /**
         * 1 minute cache. Play ka daam din me ek baar bhi mushkil se badalta
         * hai, isliye har page-view par DB call bekaar hai.
         *
         * Isse zyada rakhna aasan lagta hai par ek asli dikkat banata hai:
         * admin "Sync now" dabane ke baad website par naya daam dekhna chahta
         * hai, aur 5 minute ka intezar "kaam kiya ya nahi" wala shak paida kar
         * deta hai. (Admin panel khud no-store se padhta hai, isliye wahan
         * hamesha taaza dikhta hai.)
         */
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as DbRow[];
    if (!rows.length) return null;

    const out: Partial<Record<PlayPeriod, PlayPriceRow>> = {};
    for (const raw of rows) {
      const row = toRow(raw);
      const period = periodOf(row);
      if (period && !out[period]) out[period] = row;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/**
 * Ye row monthly hai ya yearly.
 *
 * Pehla sahara `billing_period` hai — wo Play ka apna jawab hai (P1M / P1Y) aur
 * product ke naam se kahin zyada bharosemand. Wo na mile to product id par gir
 * jaate hain, jo hamare apne env se aata hai.
 */
export function periodOf(row: PlayPriceRow): PlayPeriod | null {
  const p = String(row.billingPeriod ?? "").toUpperCase();
  if (p === "P1Y" || p === "P12M") return "yearly";
  if (p === "P1M") return "monthly";
  if (row.productId === PLAY_PRODUCTS.yearly) return "yearly";
  if (row.productId === PLAY_PRODUCTS.monthly) return "monthly";
  return null;
}

/** Saare region (admin table). Naye upar — India hamesha pehle. */
export async function getAllPlayPrices(): Promise<PlayPriceRow[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/play_prices?select=${SELECT}&order=region_code.asc`,
    { headers: sbHeaders(), cache: "no-store" },
  );
  if (!res.ok) return [];
  return ((await res.json()) as DbRow[]).map(toRow);
}

/** Sync ka haal — admin panel ka "kab hua / kyun fail hua". */
export async function getPlaySyncMeta(): Promise<PlaySyncMeta> {
  const base: PlaySyncMeta = {
    configured: playPricesConfigured(),
    status: playPricesStatus(),
    syncedAt: null,
    attemptedAt: null,
    ok: false,
    message: null,
    rowsCount: 0,
  };
  if (!SUPABASE_URL || !SUPABASE_KEY) return base;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/play_price_sync?id=eq.true&select=synced_at,attempted_at,ok,message,rows_count`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return base;
    const rows = (await res.json()) as {
      synced_at: string | null;
      attempted_at: string | null;
      ok: boolean;
      message: string | null;
      rows_count: number;
    }[];
    const r = rows[0];
    if (!r) return base;
    return {
      ...base,
      syncedAt: r.synced_at,
      attemptedAt: r.attempted_at,
      ok: Boolean(r.ok),
      message: r.message,
      rowsCount: Number(r.rows_count ?? 0),
    };
  } catch {
    return base;
  }
}
