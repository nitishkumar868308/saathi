"use client";

import { checkUploadable, sha256HexFromStream, type AssetKindEntry } from "@reel/core";
import { useCallback, useRef, useState } from "react";

import { probeFileInBrowser, type BrowserProbe } from "@/lib/upload/probeInBrowser";

/**
 * Upload ka poora raasta — ek file ke liye chaar padav:
 *
 *   hashing -> presign -> uploading -> complete
 *
 * ⚠️ **`fetch` nahi, `XMLHttpRequest`.** Ye purana lagta hai par wajah asli hai:
 * `fetch` upload ka progress deta hi nahi. 200MB ki screen recording bina
 * progress ke chadhana matlab do minute tak "kuch ho bhi raha hai ya atak gaya"
 * ka koi jawab nahi. XHR `upload.onprogress` deta hai, aur `abort()` bhi.
 *
 * ⚠️ Ek waqt me `MAX_PARALLEL` hi chadhte hain. Saare ek saath chhod dene se
 * ek dusre ka bandwidth khaate hain aur har ek ka progress rengta dikhta hai —
 * kaam jaldi nahi hota, sirf dikhna bura ho jaata hai.
 */

export type UploadPhase =
  | "waiting"
  | "hashing"
  | "uploading"
  | "finishing"
  | "done"
  | "duplicate"
  | "error"
  | "cancelled";

export interface UploadTask {
  id: string;
  file: File;
  /** Reject hui file ke liye `null` — uska card sirf wajah dikhane ke liye hota hai. */
  kind: AssetKindEntry | null;
  phase: UploadPhase;
  /** 0-1. hashing aur uploading dono isi ko bharte hain. */
  progress: number;
  error: string | null;
  /** Ban jaane par asset — duplicate par purana wala asset. */
  assetId: string | null;
  probe: BrowserProbe;
}

const MAX_PARALLEL = 2;

/** Har upload ka apna XHR — cancel ke liye ise pakad kar rakhna padta hai. */
type Live = { xhr: XMLHttpRequest | null; cancelled: boolean };

let taskCounter = 0;

export interface UseUploaderOptions {
  /** Naye asset par tag (jaise "music" tab se upload karne par). */
  tags?: readonly string[];
  /** Ek file poori hone par — library refresh karne ke liye. */
  onFinished?: (result: { assetId: string; duplicate: boolean }) => void;
}

export interface Uploader {
  tasks: UploadTask[];
  addFiles(files: readonly File[]): void;
  cancel(taskId: string): void;
  retry(taskId: string): void;
  /** Poore ho chuke (ya cancel/duplicate) tasks list se hata do. */
  clearFinished(): void;
  busy: boolean;
}

export function useUploader(options: UseUploaderOptions = {}): Uploader {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const live = useRef(new Map<string, Live>());
  const running = useRef(0);
  const queue = useRef<string[]>([]);
  const taskData = useRef(new Map<string, UploadTask>());
  // Callbacks ref me — warna har render par pump() dobara banta hai aur
  // chal rahe upload ke beech me purana closure reh jaata hai.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const patch = useCallback((taskId: string, changes: Partial<UploadTask>) => {
    const current = taskData.current.get(taskId);
    if (!current) return;
    const next = { ...current, ...changes };
    taskData.current.set(taskId, next);
    setTasks((list) => list.map((task) => (task.id === taskId ? next : task)));
  }, []);

  const pump = useCallback(() => {
    while (running.current < MAX_PARALLEL && queue.current.length > 0) {
      const taskId = queue.current.shift() as string;
      const task = taskData.current.get(taskId);
      if (!task || task.phase !== "waiting") continue;

      running.current += 1;
      const entry = live.current.get(taskId);
      if (!entry) {
        running.current -= 1;
        continue;
      }
      void runTask(task, patch, entry, optionsRef.current).finally(() => {
        running.current -= 1;
        pump();
      });
    }
  }, [patch]);

  const addFiles = useCallback(
    (files: readonly File[]) => {
      const added: UploadTask[] = [];

      for (const file of files) {
        const allowed = checkUploadable({ name: file.name, type: file.type, size: file.size });
        taskCounter += 1;
        const id = `up_${taskCounter}`;

        const task: UploadTask = allowed.ok
          ? {
              id,
              file,
              kind: allowed.kind,
              phase: "waiting",
              progress: 0,
              error: null,
              assetId: null,
              probe: {},
            }
          : {
              id,
              file,
              // Reject hui file ka bhi card dikhta hai — chupchaap gira dene se
              // user ko lagta hai drag hi kaam nahi kiya.
              kind: null,
              phase: "error",
              progress: 0,
              error: allowed.error.message,
              assetId: null,
              probe: {},
            };

        taskData.current.set(id, task);
        live.current.set(id, { xhr: null, cancelled: false });
        added.push(task);
        if (task.phase === "waiting") queue.current.push(id);
      }

      setTasks((list) => [...list, ...added]);
      pump();
    },
    [pump],
  );

  const cancel = useCallback(
    (taskId: string) => {
      const entry = live.current.get(taskId);
      if (entry) {
        entry.cancelled = true;
        entry.xhr?.abort();
      }
      queue.current = queue.current.filter((id) => id !== taskId);
      patch(taskId, { phase: "cancelled", error: null });
    },
    [patch],
  );

  const retry = useCallback(
    (taskId: string) => {
      const task = taskData.current.get(taskId);
      if (!task) return;
      live.current.set(taskId, { xhr: null, cancelled: false });
      patch(taskId, { phase: "waiting", progress: 0, error: null });
      queue.current.push(taskId);
      pump();
    },
    [patch, pump],
  );

  const clearFinished = useCallback(() => {
    const keep = new Set(["waiting", "hashing", "uploading", "finishing", "error"]);
    setTasks((list) => list.filter((task) => keep.has(task.phase)));
  }, []);

  return {
    tasks,
    addFiles,
    cancel,
    retry,
    clearFinished,
    busy: tasks.some((task) =>
      ["waiting", "hashing", "uploading", "finishing"].includes(task.phase),
    ),
  };
}

/* --------------------------------------------------------------- ek upload */

async function runTask(
  task: UploadTask,
  patch: (taskId: string, changes: Partial<UploadTask>) => void,
  entry: Live,
  options: UseUploaderOptions,
): Promise<void> {
  /*
   * `task` yahan **snapshot** hai, aur wahi chahiye: `file` aur `kind` kabhi
   * badalte nahi. Jo badalta hai (phase, progress) wo `patch()` se jaata hai,
   * React state se padha nahi jaata — upload render ke bahar chalta hai, isliye
   * kisi purane render ki copy padhna hamesha peechhe reh jaata.
   */
  const taskId = task.id;
  if (entry.cancelled || !task.kind) return;

  try {
    // 1. Checksum — file stream se, poori file memory me laaye bina.
    patch(taskId, { phase: "hashing", progress: 0 });
    const checksum = await sha256HexFromStream(task.file.stream(), {
      onProgress: (bytes) => patch(taskId, { progress: bytes / Math.max(1, task.file.size) }),
      signal: { get aborted() {
        return entry.cancelled;
      } },
    });
    if (entry.cancelled) return;

    // 2. Browser me metadata (server ke probe se pehle wali jhalak).
    const probe = await probeFileInBrowser(task.file, task.kind.id);
    patch(taskId, { probe });
    if (entry.cancelled) return;

    // 3. Presign — server duplicate bhi yahin pakad leta hai.
    const presign = await postJson("/api/assets/presign", {
      filename: task.file.name,
      mime: task.file.type,
      bytes: task.file.size,
      checksum,
    });

    if (presign.duplicate) {
      const asset = presign.asset as { id: string };
      patch(taskId, { phase: "duplicate", progress: 1, assetId: asset.id });
      options.onFinished?.({ assetId: asset.id, duplicate: true });
      return;
    }

    const assetId = presign.assetId as string;
    const upload = presign.upload as { url: string; method: string; headers: Record<string, string> };

    // 4. Asli bytes — seedha storage par, studio ke server se hokar nahi.
    patch(taskId, { phase: "uploading", progress: 0, assetId });
    await putWithProgress(upload.url, upload.headers, task.file, entry, (fraction) =>
      patch(taskId, { progress: fraction }),
    );
    if (entry.cancelled) return;

    // 5. Complete — server file ko sach me dekhta hai, row banata hai, probe chalata hai.
    patch(taskId, { phase: "finishing", progress: 1 });
    const completed = await postJson(`/api/assets/${assetId}/complete`, {
      filename: task.file.name,
      mime: task.file.type,
      checksum,
      ...(probe.width ? { width: probe.width } : {}),
      ...(probe.height ? { height: probe.height } : {}),
      ...(probe.durationMs ? { durationMs: probe.durationMs } : {}),
      ...(probe.fps ? { fps: probe.fps } : {}),
      ...(options.tags && options.tags.length > 0 ? { tags: [...options.tags] } : {}),
    });

    const asset = completed.asset as { id: string };
    patch(taskId, {
      phase: completed.duplicate ? "duplicate" : "done",
      progress: 1,
      assetId: asset.id,
    });
    options.onFinished?.({ assetId: asset.id, duplicate: Boolean(completed.duplicate) });
  } catch (error) {
    if (entry.cancelled) {
      patch(taskId, { phase: "cancelled" });
      return;
    }
    patch(taskId, {
      phase: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      (data.reason as string | undefined) ?? (data.error as string | undefined) ?? `${response.status}`,
    );
  }
  return data;
}

function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  entry: Live,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const xhr = new XMLHttpRequest();
    entry.xhr = xhr;

    xhr.open("PUT", url, true);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      entry.xhr = null;
      if (xhr.status >= 200 && xhr.status < 300) resolvePromise();
      else rejectPromise(new Error(`upload ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
    };
    xhr.onerror = () => {
      entry.xhr = null;
      /*
       * ⚠️ `onerror` par browser hume **kuch nahi** batata — na status, na body.
       * Isliye "network toot gaya" likhna aasan tha aur gumraah karta tha: sabse
       * aam wajah network nahi, **R2 bucket par CORS ka na hona** hai.
       *
       * Wo halat theek aisi hi dikhti hai: file browser se seedha R2 par PUT
       * hoti hai, R2 preflight ko 403 deta hai bina `access-control-allow-origin`
       * ke, aur browser request ko hi gira deta hai. Internet bilkul theek chal
       * raha hota hai, aur aadmi apna Wi-Fi dekhta rehta hai.
       *
       * (Ye tab shuru hota hai jab REEL_STORAGE_DRIVER `local` se `r2` hota hai —
       * `local` par upload apne hi server par jaata tha, isliye CORS ka sawaal
       * hi nahi uthta tha.)
       */
      rejectPromise(
        new Error(
          "Upload nahi ja saki. Sabse aam wajah: R2 bucket par CORS set nahi hai " +
            "(browser seedha R2 par bhejta hai). Cloudflare > R2 > bucket > Settings > " +
            "CORS Policy me is site ka origin allow karo. Warna network dekho.",
        ),
      );
    };
    xhr.onabort = () => {
      entry.xhr = null;
      rejectPromise(new Error("upload cancel ho gaya"));
    };

    xhr.send(file);
  });
}
