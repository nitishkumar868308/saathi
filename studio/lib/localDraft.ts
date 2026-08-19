"use client";

import type { Doc } from "@reel/core";

/**
 * Local draft — crash/offline se kaam bachane wali jaal (16.14).
 *
 * ⚠️ Ye autosave ka **badal nahi** hai, uska jaal hai. Autosave Supabase me
 * likhta hai; ye har badlav par browser ke apne IndexedDB me likhta hai. Jab
 * autosave fail ho (net gaya, token expire hua, tab crash hua) tab bhi kaam
 * yahin bacha rehta hai.
 *
 * localStorage kyun nahi:
 *  - uski hadd 5 MB hai aur ek bada project usse aage nikal jaata hai
 *  - wo **synchronous** hai, yaani har save par UI ka thread ruk jaata hai
 *
 * IndexedDB dono se bach jaata hai. Yahan sirf ek object store hai aur usme ek
 * hi row per project — history nahi, kyunki history ka kaam Supabase ke versions
 * karte hain (Phase 4). Do jagah history rakhna matlab do jagah galat sach.
 */

const DB_NAME = "reel-studio";
const DB_VERSION = 1;
const STORE = "drafts";

export interface LocalDraft {
  projectId: string;
  doc: Doc;
  /** Draft kis waqt likha gaya (ms). */
  at: number;
  /**
   * Ye draft kis server-version ke upar bana tha.
   *
   * Recover ke waqt yahi batata hai ki draft server se aage hai ya peeche —
   * bina iske hum user ko purana kaam "recover" karwa dete.
   */
  baseUpdatedAt: string | null;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Private mode / band ki hui storage. Draft na bachna bura hai, par editor
      // ka ruk jaana bahut zyada bura hai.
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "projectId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Doosra tab DB ko upgrade ke liye block kar sakta hai — tab bhi ruko mat.
    request.onblocked = () => resolve(null);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    let request: IDBRequest<T>;
    try {
      request = run(db.transaction(STORE, mode).objectStore(STORE));
    } catch {
      db.close();
      resolve(null);
      return;
    }
    request.onsuccess = () => {
      resolve(request.result);
      db.close();
    };
    request.onerror = () => {
      resolve(null);
      db.close();
    };
  });
}

export async function saveLocalDraft(draft: LocalDraft): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft) as IDBRequest<IDBValidKey>);
}

export async function readLocalDraft(projectId: string): Promise<LocalDraft | null> {
  const value = await withStore<LocalDraft | undefined>("readonly", (store) =>
    store.get(projectId) as IDBRequest<LocalDraft | undefined>,
  );
  return value ?? null;
}

export async function clearLocalDraft(projectId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(projectId) as IDBRequest<undefined>);
}

/**
 * Ye draft recover karne layak hai? (16.14)
 *
 * ⚠️ Sirf "draft maujood hai" kaafi nahi hai — wo har baar hota hai. Poochhna
 * tabhi chahiye jab draft me **sach me kuch aisa** ho jo server par nahi pahuncha.
 *
 * Do shart:
 *  1. Draft us server-version ke upar bana ho jo abhi bhi latest hai. Server aage
 *     nikal chuka ho (kisi doosri machine se save hua) to draft ko chupchaap
 *     jodna ek chhupa hua conflict hai — aur wo Phase 4 ke conflict wale raaste
 *     se guzarna chahiye, is jaal se nahi.
 *  2. Draft ka doc server ke doc se alag ho. Barabar ho to kuch bacha hi nahi.
 */
export function shouldOfferDraft(
  draft: LocalDraft | null,
  server: { doc: Doc; updatedAt: string | null },
): boolean {
  if (!draft) return false;
  if (draft.baseUpdatedAt !== server.updatedAt) return false;
  return JSON.stringify(draft.doc) !== JSON.stringify(server.doc);
}

/** Draft kitna purana hai, insaani bhasha me. */
export function draftAge(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds} second pehle`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute pehle`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ghante pehle`;
  return `${Math.round(hours / 24)} din pehle`;
}
