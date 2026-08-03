import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/admin";
import {
  getReviews,
  setReviewStatus,
  REVIEW_STATUSES,
  RewardsNotConfigured,
  type ReviewStatus,
} from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const reviews = await getReviews();
    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[admin/reviews]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "read failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}

/**
 * Review approve / reject karo.
 *
 * Sirf `status` badalta hai. User ki anumati (`allow_display`) admin ke haath me
 * nahi hai — wo app se sirf user khud badal sakta hai.
 */
export async function PATCH(req: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { id?: unknown; status?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "id chahiye" }, { status: 400 });
    }
    if (!REVIEW_STATUSES.includes(body.status as ReviewStatus)) {
      return NextResponse.json(
        { error: `status pending | approved | rejected me se ek chahiye` },
        { status: 400 },
      );
    }
    await setReviewStatus(id, body.status as ReviewStatus);

    /**
     * Home page ko turant taaza karo.
     *
     * ⚠️ Iske bina approve karne ke baad admin website kholta aur review wahan
     * nahi hota — `app/page.tsx` par `revalidate = 600` hai, yaani 10 minute tak
     * purana HTML hi milta. Us intezaar me hamesha yahi lagta hai ki approve hua
     * hi nahi, aur log dobara-tibara click karte hain.
     */
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/reviews PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "update failed" },
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
