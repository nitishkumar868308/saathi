import { cookies } from "next/headers";

import { handle, ok } from "@/lib/api";
import { STUDIO_COOKIE } from "@/lib/auth";

/** `POST /api/auth/logout` — cookie hata do, bas. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return handle(async () => {
    cookies().delete(STUDIO_COOKIE);
    return ok({ ok: true });
  });
}
