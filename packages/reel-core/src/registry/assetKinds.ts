/**
 * ASSET_KINDS — media ki kism (image / video / audio / font / other).
 *
 * `reel_assets.kind` me yahi id jaati hai. DB me jaan-boojhkar koi check
 * constraint nahi hai (dekho `supabase/reel-studio.sql`), taaki nayi kism jodne
 * ke liye migration na likhni pade — sach yahan hai, DB me nahi.
 *
 * Ye entries jaan-boojhkar `RegistryEntry` **nahi** extend karti. Us shape me
 * `schema`, `defaults`, `controls`, `keyframable` hote hain — item types ke liye
 * wo sab matlab rakhte hain, asset kind ke liye ek bhi nahi. Khaali `controls: []`
 * bhar dena sirf dikhawa hota, aur padhne wale ko dhoka deta ki yahan bhi panel
 * banta hai.
 *
 * Nayi kism jodna = yahan ek entry. Upload ka mime filter, library ke tab, aur
 * probe/thumbnail ka tarika — teeno isi se aate hain.
 */

import { createRegistry, type Registry } from "./types";

/** Upload ke baad thumbnail kaise banega. */
export type ThumbnailStrategy = "resize" | "frame" | "waveform" | "none";

export interface AssetKindEntry {
  id: string;
  label: string;
  /** lucide-react icon ka naam (core me React nahi aata, isliye sirf string). */
  icon: string;
  /** `image/` jaisa prefix — mime se kind pehchanne ka pehla tarika. */
  mimePrefixes: readonly string[];
  /** Jab mime bharosemand na ho (kai browser `.mkv` ko khaali mime dete hain). */
  extensions: readonly string[];
  /** `<input accept>` ke liye. */
  accept: readonly string[];
  /** Is kind ki ek file kitni badi ho sakti hai (bytes). */
  maxBytes: number;
  /** ffprobe se asli metadata nikal sakte hain? */
  probeable: boolean;
  thumbnail: ThumbnailStrategy;
  /** Timeline par isse kaunsa item banta hai (Phase 7 ka drag). Null = koi nahi. */
  itemType: string | null;
  /** Kya is kind ki quality naapi ja sakti hai (pixels se)? Phase 20 bhi yahi dekhta hai. */
  hasPixels: boolean;
}

const MB = 1024 * 1024;

export const BUILTIN_ASSET_KINDS: readonly AssetKindEntry[] = [
  {
    id: "image",
    label: "Image",
    icon: "Image",
    mimePrefixes: ["image/"],
    extensions: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
    accept: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
    maxBytes: 64 * MB,
    probeable: true,
    thumbnail: "resize",
    itemType: "image",
    hasPixels: true,
  },
  {
    id: "video",
    label: "Video",
    icon: "Video",
    mimePrefixes: ["video/"],
    // `.mkv` aur `.mov` par kai browser khaali ya galat mime dete hain, isliye
    // extension bhi dekhi jaati hai — warna screen recording upload hi nahi hoti.
    extensions: ["mp4", "mov", "webm", "mkv", "m4v"],
    accept: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
    maxBytes: 2048 * MB,
    probeable: true,
    thumbnail: "frame",
    itemType: "video",
    hasPixels: true,
  },
  {
    id: "audio",
    label: "Audio",
    icon: "Music",
    mimePrefixes: ["audio/"],
    extensions: ["mp3", "wav", "m4a", "aac", "ogg", "opus", "flac"],
    accept: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/ogg", "audio/flac"],
    maxBytes: 512 * MB,
    probeable: true,
    thumbnail: "waveform",
    itemType: "audio",
    hasPixels: false,
  },
  {
    id: "font",
    label: "Font",
    icon: "Type",
    mimePrefixes: ["font/"],
    extensions: ["woff2", "ttf", "otf"],
    accept: ["font/woff2", "font/ttf", "font/otf"],
    maxBytes: 16 * MB,
    probeable: false,
    thumbnail: "none",
    // Font timeline par item nahi banta — wo text item ki property hai (Phase 9).
    itemType: null,
    hasPixels: false,
  },
];

export const ASSET_KINDS: Registry<AssetKindEntry> = createRegistry<AssetKindEntry>("ASSET_KINDS");

export function registerAssetKind(entry: AssetKindEntry): void {
  ASSET_KINDS.register(entry);
}

export function listAssetKinds(): readonly AssetKindEntry[] {
  return ASSET_KINDS.list();
}

export function getAssetKind(id: string): AssetKindEntry | undefined {
  return ASSET_KINDS.get(id);
}

export function requireAssetKind(id: string): AssetKindEntry {
  return ASSET_KINDS.require(id);
}

/**
 * Mime (aur zaroorat pade to filename) se kind pehchano.
 *
 * ⚠️ Mime par akela bharosa nahi kiya ja sakta: Windows par `.mkv` ka mime
 * khaali aata hai, aur kabhi-kabhi browser `application/octet-stream` de deta
 * hai. Isliye pehle mime, phir extension. Dono na milein to `null` — aur upload
 * saaf-saaf mana ho jaata hai, chupchaap "other" me nahi girta.
 */
export function assetKindForFile(mime: string, filename?: string): AssetKindEntry | null {
  const cleanMime = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (cleanMime) {
    for (const kind of ASSET_KINDS.list()) {
      if (kind.mimePrefixes.some((prefix) => cleanMime.startsWith(prefix))) return kind;
    }
  }

  const at = filename?.lastIndexOf(".") ?? -1;
  if (filename && at > 0) {
    const ext = filename.slice(at + 1).toLowerCase();
    for (const kind of ASSET_KINDS.list()) {
      if (kind.extensions.includes(ext)) return kind;
    }
  }
  return null;
}

/** `<input accept="...">` ki poori string — registry se banti hai, likhi nahi jaati. */
export function acceptAttribute(kinds: readonly AssetKindEntry[] = ASSET_KINDS.list()): string {
  const parts = new Set<string>();
  for (const kind of kinds) {
    for (const mime of kind.accept) parts.add(mime);
    for (const ext of kind.extensions) parts.add(`.${ext}`);
  }
  return [...parts].join(",");
}

export interface UploadRejection {
  reason: "unknown-kind" | "too-big" | "empty";
  message: string;
}

/**
 * Ye file upload ho sakti hai ya nahi — ek hi jagah, dono taraf.
 *
 * Client isse pehle poochhta hai (turant jawab), aur server dobara (kyunki
 * client par lagi rok sirf soojh-boojh hai, deewar nahi).
 */
export function checkUploadable(
  file: { name: string; type: string; size: number },
): { ok: true; kind: AssetKindEntry } | { ok: false; error: UploadRejection } {
  const kind = assetKindForFile(file.type, file.name);
  if (!kind) {
    return {
      ok: false,
      error: {
        reason: "unknown-kind",
        message: `"${file.name}" kis kism ki file hai samajh nahi aaya (${file.type || "koi mime nahi"})`,
      },
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: { reason: "empty", message: `"${file.name}" khaali hai` } };
  }
  if (file.size > kind.maxBytes) {
    return {
      ok: false,
      error: {
        reason: "too-big",
        message: `"${file.name}" ${formatBytes(file.size)} ka hai; ${kind.label} ki hadd ${formatBytes(kind.maxBytes)} hai`,
      },
    };
  }
  return { ok: true, kind };
}

/** `1536000` -> `"1.5 MB"`. UI aur error message dono yahi use karte hain. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "?";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/* --------------------------------------------------------------- lifecycle */

export const ASSET_LIFECYCLES = ["permanent", "temporary"] as const;
export type AssetLifecycle = (typeof ASSET_LIFECYCLES)[number];

/**
 * Humare banaye hue asset (TTS ki awaaz, render ka beech ka maal) kitne din baad
 * saaf hone layak hain. User ka upload hamesha `permanent` rehta hai — uski
 * marzi ke bina kabhi delete nahi.
 */
export const TEMPORARY_ASSET_TTL_DAYS = 7;

export function temporaryExpiryIso(now: number, ttlDays = TEMPORARY_ASSET_TTL_DAYS): string {
  return new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

/* ------------------------------------------------------------ library tabs */

/**
 * Media library ke tab — **data**, aur inhi se filter banta hai.
 *
 * `kinds` DB ke `kind` par filter karta hai; `tag` `tags` array par. Dono
 * declarative hain (function nahi) taaki inhe seedha query me badla ja sake —
 * client par 500 assets chhaanne ki koi zaroorat nahi.
 *
 * "Music" aur "Screen recording" tag par chalte hain, andaaze par nahi. Filename
 * me "screen" dhoondhna aasan tha, par wo ek din galat nikalta aur poore tab par
 * se bharosa chala jaata.
 */
export interface LibraryTabEntry {
  id: string;
  label: string;
  icon: string;
  /** Khaali = har kind. */
  kinds: readonly string[];
  /** Set ho to asset ke `tags` me ye hona chahiye. */
  tag: string | null;
  /** Is tab se upload karne par naye asset par ye tag apne aap lag jaata hai. */
  appliesTagOnUpload: boolean;
}

export const LIBRARY_TABS: readonly LibraryTabEntry[] = [
  { id: "all", label: "Sab", icon: "LayoutGrid", kinds: [], tag: null, appliesTagOnUpload: false },
  { id: "images", label: "Images", icon: "Image", kinds: ["image"], tag: null, appliesTagOnUpload: false },
  { id: "videos", label: "Videos", icon: "Video", kinds: ["video"], tag: null, appliesTagOnUpload: false },
  { id: "audio", label: "Audio", icon: "Mic", kinds: ["audio"], tag: null, appliesTagOnUpload: false },
  {
    id: "music",
    label: "Music",
    icon: "Music",
    kinds: ["audio"],
    tag: "music",
    appliesTagOnUpload: true,
  },
  {
    id: "screen",
    label: "Screen recordings",
    icon: "MonitorPlay",
    kinds: ["video"],
    tag: "screen-recording",
    appliesTagOnUpload: true,
  },
];

export function getLibraryTab(id: string): LibraryTabEntry | undefined {
  return LIBRARY_TABS.find((tab) => tab.id === id);
}

/** Jo tag kisi tab me use hote hain — detail panel me yahi chips dikhte hain. */
export function libraryTags(): readonly string[] {
  return [...new Set(LIBRARY_TABS.map((tab) => tab.tag).filter((tag): tag is string => !!tag))];
}
