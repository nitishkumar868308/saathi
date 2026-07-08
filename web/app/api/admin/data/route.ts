import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { getContacts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contacts = await getContacts();
  return NextResponse.json({ contacts });
}
