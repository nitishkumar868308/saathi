import { handle, ok } from "@/lib/api";
import { workerStatus } from "@/lib/renders";

/**
 * `GET /api/worker` — worker zinda hai ya nahi (11.13).
 *
 * ⚠️ Ye **heartbeat se** aata hai, andaaze se nahi. Iske bina UI ke paas do hi
 * raaste bachte aur dono jhooth hote: hamesha "chal raha hai" dikhana (job
 * queue me atki rehti aur user samajh hi nahi paata ki kyun kuch nahi ho raha),
 * ya job ke queue me hone se andaaza lagana (worker abhi shuru hua ho to wo bhi
 * galat).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => ok({ worker: await workerStatus() }));
}
