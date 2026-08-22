import { readStorageConfig } from "@reel/storage";

import { handle, ok } from "@/lib/api";
import { dispatchConfigured } from "@/lib/dispatch";
import { workerStatus } from "@/lib/renders";

/**
 * `GET /api/worker` — worker zinda hai ya nahi (11.13).
 *
 * ⚠️ Ye **heartbeat se** aata hai, andaaze se nahi. Iske bina UI ke paas do hi
 * raaste bachte aur dono jhooth hote: hamesha "chal raha hai" dikhana (job
 * queue me atki rehti aur user samajh hi nahi paata ki kyun kuch nahi ho raha),
 * ya job ke queue me hone se andaaza lagana (worker abhi shuru hua ho to wo bhi
 * galat).
 *
 * ⚠️ **`mode` isliye zaroori hai ki "offline" ka matlab dono jagah alag hai (25.3).**
 * Local worker offline hona **galti** hai — kisi ne `npm run dev:worker` chalaya
 * hi nahi, aur job hamesha ke liye queue me padi rahegi. Cloud worker offline
 * hona bilkul **normal** hai — runner tabhi uthta hai jab job aati hai, aur kaam
 * khatam hote hi so jaata hai.
 *
 * Ye farak bataye bina UI ko ek hi chetavni dono halat me dikhani padti, aur wo
 * chetavni cloud par roz-roz jhoothi hoti. Jhoothi chetavni se bura kuch nahi —
 * kuch dinon me use koi padhta hi nahi, aur phir asli wali bhi anpadhi jaati hai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => {
    const cloud = dispatchConfigured();
    const driver = readStorageConfig().driver;

    return ok({
      worker: await workerStatus(),
      mode: cloud ? "cloud" : "local",
      driver,
      /**
       * Cloud worker + local storage = hamesha galat, aur wo bilkul chup-chaap
       * galat hota hai (25.6).
       *
       * ⚠️ Runner tumhare disk ko kabhi nahi dekh sakta. Local driver par asset
       * `render-out/media/` me padi hoti hai, aur DB me uska key maujood hota
       * hai — isliye studio me sab bilkul theek dikhta hai. Galti tab dikhti hai
       * jab runner do minute setup karne ke baad "asset nahi mili" par marta
       * hai, ya (uske aage) reel ban kar runner ki us disk par chali jaati hai
       * jo run khatam hote hi mit jaati hai.
       *
       * Isliye ye jaanch yahan hai, render ke waqt nahi: sabse sasti jagah.
       */
      storageMismatch: cloud && driver !== "r2",
    });
  });
}
