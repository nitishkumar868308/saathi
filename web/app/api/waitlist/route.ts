import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Waitlist ab band hai — app live hai, log seedha download karte hain.
 * Pehle 1000 signups ko 3 mahine Plus free (ye ab DB me `claim_first_n_reward()`
 * se hota hai, waitlist se nahi).
 *
 * NOTE: `waitlist` table aur uska purana data **delete nahi kiya** —
 * admin dashboard me legacy data abhi bhi dikhta hai. Bas ye endpoint band hai.
 */

function gone() {
  return NextResponse.json(
    { error: "waitlist closed — app Play Store pe available hai" },
    { status: 410 },
  );
}

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}
