import { MigrationError } from "@reel/core";
import type { TypeOf, ZodTypeAny } from "zod";

import { SupabaseError } from "@/lib/supabase";

/**
 * Route handlers ka saanjha khol.
 *
 * Har route me try/catch likhne se do cheezein hoti hain: aadhe routes me wo
 * chhoot jaata hai, aur jo likhte hain wo har baar thoda alag error shape
 * lautate hain. Client ko phir har route ke liye alag handling likhni padti.
 * Yahan ek hi shape hai: `{ error, reason? }`.
 */

export function ok<T extends object>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function fail(error: string, status: number, reason?: string): Response {
  return Response.json({ error, ...(reason ? { reason } : {}) }, { status });
}

/**
 * Body padho aur schema se guzaaro. Galat body par 400 — kabhi guess nahi karte.
 *
 * Generic schema par hai, `<T>` par nahi: `.default()` waale schema ka input aur
 * output alag hote hain (`string | undefined` banaam `string`), aur `ZodSchema<T>`
 * likhne par TypeScript input wala uthata hai — phir har call site par bina wajah
 * `undefined` sambhalna padta.
 */
export async function readBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: TypeOf<S> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail("bad request", 400, "body valid JSON nahi hai") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      response: fail(
        "bad request",
        400,
        first ? `${first.path.join(".") || "body"}: ${first.message}` : "body galat hai",
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Handler ko lapet do — ek hi jagah se saare error saaf-saaf bahar aate hain.
 *
 * ⚠️ Error ka message client ko dikhaya jaata hai. Ye local, single-user studio
 * hai; asli wajah chhupa dene se debugging ka koi raasta hi nahi bachta. Jis din
 * studio kisi aur ke saamne khulega, is jagah par chhaanni lagegi — ek jagah.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof MigrationError) {
      return fail("doc migrate nahi hua", 500, error.message);
    }
    if (error instanceof SupabaseError) {
      return fail("database error", 502, `${error.message} ${error.body}`.trim());
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail("server error", 500, message);
  }
}
