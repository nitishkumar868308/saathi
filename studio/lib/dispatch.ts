/**
 * Cloud worker ko jagao — `repository_dispatch` se (Phase 25).
 *
 * ⚠️ **Render Vercel par nahi ho sakta, aur ye koi tuning ki baat nahi hai.**
 * Remotion har frame ka screenshot Chrome Headless (~150MB) se leta hai aur
 * aakhir me ffmpeg chalta hai — dono serverless me hote hi nahi. Uske upar ek
 * reel minute bhar leti hai, jabki function 10-60 second me kat jaata hai.
 *
 * Isliye kaam GitHub Actions ke runner par hota hai (`.github/workflows/
 * reel-render.yml`), aur ye file sirf uska ghanta bajati hai.
 *
 * ── Cron kyun nahi ───────────────────────────────────────────────────────
 *
 * Baaki saare periodic kaam (reminders, plan expiry, prices) Supabase ke pg_cron
 * se chalte hain: ghadi bajti hai, Vercel ka route uthata hai. Wahi pattern
 * yahan **jaan-boojhkar nahi** liya gaya, do wajah se:
 *
 *   1. Ghadi ka matlab intezaar hai. 5 minute wale cron par user Export dabane
 *      ke baad ausatan 2.5 minute khaali baitha rehta — jabki job usi second queue
 *      me pahunch chuki hoti hai.
 *   2. Private repo par Actions ke 2000 minute/month hain. Har 15 minute ka
 *      khaali check bhi mahine ke ~2880 minute kha jaata — budget khatam, aur
 *      badle me ek bhi reel nahi.
 *
 * Yahan ghanta usi lamhe bajta hai jab kaam sach me aaya ho.
 *
 * ── Fail hona render nahi rokta ─────────────────────────────────────────
 *
 * ⚠️ Ye call **kabhi throw nahi karti**. Job DB me daali ja chuki hoti hai; wahi
 * ek sach hai. GitHub ek minute ke liye down ho, PAT expire ho gaya ho — export
 * ko us par nahi girna chahiye. Job queue me sabra se padi rehti hai aur Actions
 * tab ke "Run workflow" se ya agle export ke dispatch se uth jaati hai (drain
 * mode wala worker queue ki **saari** job nipta kar hi rukta hai).
 *
 * Iski keemat saaf hai aur wo yahin likhi hai: dispatch chup-chaap fail ho to
 * user ko sirf "queue me hai" dikhega. Isiliye har fail server log me poore
 * jawab ke saath jaati hai, aur `dispatchConfigured()` UI ko batata hai ki cloud
 * worker set hai bhi ya nahi.
 */

/** GitHub API ko itni der se zyada nahi rokna. */
const TIMEOUT_MS = 6000;

/** `owner/repo` — jahan workflow rehta hai. */
function repo(): string {
  return (process.env.REEL_DISPATCH_REPO ?? "").trim();
}

function token(): string {
  return (process.env.REEL_DISPATCH_TOKEN ?? "").trim();
}

/** Cloud worker set hai? UI isse tay karti hai ki kya likhna hai. */
export function dispatchConfigured(): boolean {
  return Boolean(repo() && token());
}

export interface DispatchInput {
  /** Log me dikhta hai — kis wajah se jagaya. */
  reason: string;
  /**
   * Runner par faster-whisper install karna hai?
   *
   * ⚠️ Sirf us transcribe job ke liye jiska text pehle se pata nahi hai. pip
   * install + model download har run me ~1-2 minute khaata hai, isliye har
   * render par ye `false` rehta hai.
   */
  whisper?: boolean;
}

export interface DispatchResult {
  ok: boolean;
  /** Kya hua — log aur (zaroorat par) UI ke liye. */
  detail: string;
}

export async function dispatchRenderWorker(input: DispatchInput): Promise<DispatchResult> {
  const target = repo();
  const pat = token();

  if (!target || !pat) {
    return {
      ok: false,
      detail:
        "REEL_DISPATCH_REPO / REEL_DISPATCH_TOKEN set nahi hai — cloud worker nahi jagaya gaya.",
    };
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${target}/dispatches`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${pat}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        // Workflow ka `types: [reel-render]` isi naam se sunta hai.
        event_type: "reel-render",
        client_payload: { reason: input.reason, whisper: input.whisper === true },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    /*
     * ⚠️ 204 hi kaamyabi hai — GitHub is API par koi body nahi lautata. 404 ka
     * matlab aksar "repo nahi mila" nahi hota: PAT ke paas is repo ka access na
     * ho to bhi 404 hi aata hai (GitHub jaan-boojhkar private repo ka wajood
     * nahi batata). Isliye 404 par wo baat saaf likhi jaati hai — warna ghanton
     * repo ka naam dekha jaata hai jabki galti token me hoti hai.
     */
    if (response.status === 204) {
      return { ok: true, detail: `cloud worker jagaya (${target})` };
    }

    const body = (await response.text()).slice(0, 300);
    if (response.status === 404) {
      return {
        ok: false,
        detail:
          `GitHub ne 404 diya. Ya to REEL_DISPATCH_REPO ("${target}") galat hai, ` +
          `ya PAT ke paas is repo ka access nahi (private repo par dono ki shakal 404 hi hoti hai). ` +
          `Token ko "Contents: read and write" chahiye. ${body}`,
      };
    }
    return { ok: false, detail: `GitHub ne HTTP ${response.status} diya: ${body}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: `dispatch nahi ja saki: ${message}` };
  }
}

/**
 * Jagao, par raaste me mat khade raho.
 *
 * Route isse `await` karta hai (varna Vercel function response ke baad kaam
 * kaat deta hai — background promise wahan bharosemand nahi), par ye kabhi
 * throw nahi karti aur 6 second se zyada nahi rokti.
 */
export async function wakeWorker(input: DispatchInput): Promise<DispatchResult> {
  const result = await dispatchRenderWorker(input);
  if (result.ok) console.log(`[reel-dispatch] ${result.detail} — ${input.reason}`);
  else console.error(`[reel-dispatch] ⚠️ ${result.detail} — ${input.reason}`);
  return result;
}
