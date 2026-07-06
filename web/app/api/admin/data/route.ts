import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { getWaitlist, getContacts } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [waitlist, contacts] = await Promise.all([
    getWaitlist(),
    getContacts(),
  ]);

  return NextResponse.json({
    waitlist,
    contacts,
    stats: { waitlist: waitlist.length, contacts: contacts.length },
  });
}
