import { getLibraryTab } from "@reel/core";

import { fail, handle, ok } from "@/lib/api";
import { listAssets } from "@/lib/assets";

/**
 * `GET /api/assets` — media library ki list.
 *
 * Filter **tab id** se aata hai (`?tab=music`), aur tab ki paribhasha
 * `LIBRARY_TABS` registry me hai. Isliye naya tab jodne par yahan kuch nahi
 * badalta — na kind ki list, na tag ka naam.
 *
 * Chhanni DB me hoti hai, client par nahi: 500 assets browser me bhej kar wahan
 * filter karna sirf pehli baar theek lagta hai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const tabId = params.get("tab") ?? "all";
    const tab = getLibraryTab(tabId);
    if (!tab) return fail("bad request", 400, `"${tabId}" naam ka koi tab nahi hai`);

    const sortParam = params.get("sort");
    const sort =
      sortParam === "name" || sortParam === "size" || sortParam === "recent"
        ? sortParam
        : "recent";

    const assets = await listAssets({
      kinds: tab.kinds,
      tag: tab.tag,
      search: params.get("q"),
      sort,
    });

    return ok({ assets });
  });
}
