import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getContacts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard("contacts");
  if (!g.ok) return g.res;

  const contacts = await getContacts();
  return NextResponse.json({ contacts });
}
