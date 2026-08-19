import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  AUTOSAVE_RETRY_BASE_MS,
  AUTOSAVE_RETRY_MAX_MS,
} from "@/lib/config";

/**
 * Autosave ka dimaag — React se bilkul alag.
 *
 * Yahan chaar cheezein ek saath sambhalni hoti hain, aur inme se kisi ek ko
 * bhool jaana hi wo bug banta hai jisme "kaam kho gaya":
 *
 *  1. **Debounce + max wait.** Har keystroke par save karna DB ko peeta hai;
 *     sirf debounce rakhna aur bhi khatarnak hai — lagataar type karte rehne se
 *     wo aage khisakti rehti hai aur 10 minute ka kaam ek crash me chala jaata
 *     hai. Isliye dono: 1.5s chup rehne par, ya har haal me 10s me ek baar.
 *  2. **In-flight ke dauraan queue.** Save chalte waqt aayi edit chhoot nahi
 *     sakti — flag rakh kar save khatam hote hi dobara chala dete hain.
 *  3. **Retry with backoff** — network gaya to har baar dugna intezaar, chhat tak.
 *  4. **Conflict par retry NAHI.** 409 ka matlab hai koi aur aage nikal gaya;
 *     dobara wahi bhejna sirf uska kaam mitane ki koshish hai. Wahan rukna aur
 *     poochhna hi imaandaar jawab hai.
 *
 * Ye class doc ko haath nahi lagati — `save()` callback store se taaza doc uthata
 * hai. Isi wajah se "queue" ka matlab hamesha *aakhri* haalat hoti hai, koi
 * purani copy nahi.
 */

export type SaveOutcome =
  | { kind: "saved" }
  | { kind: "conflict" }
  /** Dobara koshish karne layak (network, 5xx). */
  | { kind: "retry"; message: string }
  /** Dobara koshish bekaar hai (400, 404) — rukna hi theek hai. */
  | { kind: "fatal"; message: string };

export type SaveStatus =
  | "saved"
  | "dirty"
  | "saving"
  | "retrying"
  | "conflict"
  | "error";

export interface SchedulerOptions {
  save(): Promise<SaveOutcome>;
  onStatus(status: SaveStatus, detail: { message?: string; attempt?: number }): void;
  debounceMs?: number;
  maxWaitMs?: number;
}

export interface SaveScheduler {
  /** Doc badal gaya. */
  schedule(): void;
  /** Abhi save karo (Ctrl+S, ya tab band hone se pehle). */
  flush(): Promise<void>;
  /** Timer band, pending bhool jao (project chhodte waqt). */
  dispose(): void;
  /** Conflict resolve hone ke baad dobara chalu. */
  reset(): void;
  hasPendingWork(): boolean;
  /** `dispose()` ho chuka? Store isse dekhta hai ki kahin autosave mari to nahi. */
  isDisposed(): boolean;
}

export function createSaveScheduler(options: SchedulerOptions): SaveScheduler {
  const debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? AUTOSAVE_MAX_WAIT_MS;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstDirtyAt: number | null = null;
  let inFlight: Promise<void> | null = null;
  let queued = false;
  let attempt = 0;
  let stopped = false;
  let disposed = false;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function arm(delay: number): void {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  }

  function schedule(): void {
    if (disposed || stopped) return;
    if (firstDirtyAt === null) firstDirtyAt = Date.now();

    if (inFlight) {
      // Save chal raha hai — isko queue me daal do, warna ye edit chhoot jaayegi.
      queued = true;
      return;
    }

    options.onStatus("dirty", {});
    const waited = Date.now() - firstDirtyAt;
    arm(Math.max(0, Math.min(debounceMs, maxWaitMs - waited)));
  }

  async function run(): Promise<void> {
    if (disposed || stopped) return;
    if (inFlight) {
      queued = true;
      return inFlight;
    }

    clearTimer();
    queued = false;
    firstDirtyAt = null;
    options.onStatus("saving", {});

    inFlight = (async () => {
      let outcome: SaveOutcome;
      try {
        outcome = await options.save();
      } catch (error) {
        outcome = {
          kind: "retry",
          message: error instanceof Error ? error.message : String(error),
        };
      }

      inFlight = null;
      if (disposed) return;

      switch (outcome.kind) {
        case "saved":
          attempt = 0;
          if (queued) {
            queued = false;
            firstDirtyAt = Date.now();
            schedule();
          } else {
            options.onStatus("saved", {});
          }
          return;

        case "conflict":
          // Yahan rukna zaroori hai — dobara bhejna doosri tab ka kaam mitana hai.
          stopped = true;
          queued = false;
          options.onStatus("conflict", {});
          return;

        case "fatal":
          stopped = true;
          options.onStatus("error", { message: outcome.message });
          return;

        case "retry": {
          attempt += 1;
          const delay = Math.min(AUTOSAVE_RETRY_MAX_MS, AUTOSAVE_RETRY_BASE_MS * 2 ** (attempt - 1));
          firstDirtyAt = Date.now();
          options.onStatus("retrying", { message: outcome.message, attempt });
          arm(delay);
          return;
        }
      }
    })();

    return inFlight;
  }

  return {
    schedule,

    async flush() {
      if (disposed || stopped) return;
      // Pehle se chal rahe save ka intezaar karo, phir queue bachi ho to ek aur.
      if (inFlight) await inFlight;
      if (queued || firstDirtyAt !== null || timer !== null) await run();
    },

    dispose() {
      disposed = true;
      clearTimer();
    },

    reset() {
      stopped = false;
      attempt = 0;
      queued = false;
      firstDirtyAt = null;
      clearTimer();
    },

    hasPendingWork() {
      return queued || firstDirtyAt !== null || timer !== null || inFlight !== null;
    },

    isDisposed() {
      return disposed;
    },
  };
}
