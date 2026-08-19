/**
 * Studio ke tuning numbers — ek hi jagah.
 *
 * Component ke andar `1500` likhna sabse aasan hai aur sabse mehnga bhi: 6 mahine
 * baad "autosave kitni der me chalti hai" ka jawab dhoondhne ke liye poora repo
 * grep karna padta hai. Yahan sab naam ke saath hai.
 */

/** Aakhri keystroke ke baad itna ruk kar save. */
export const AUTOSAVE_DEBOUNCE_MS = 1_500;

/**
 * Lagataar type karte rehne par bhi itni der se zyada bina save ke nahi rehna.
 * Bina iske debounce hamesha aage khisakti rehti hai aur 10 minute ka kaam
 * ek crash me chala jaata hai.
 */
export const AUTOSAVE_MAX_WAIT_MS = 10_000;

/** Network/5xx par retry ka pehla intezaar — har baar dugna, chhat tak. */
export const AUTOSAVE_RETRY_BASE_MS = 1_000;
export const AUTOSAVE_RETRY_MAX_MS = 30_000;

/** Version snapshot ki policy: itne save par ek, ya itni der me ek. */
export const SNAPSHOT_EVERY_SAVES = 10;
export const SNAPSHOT_MAX_INTERVAL_MS = 5 * 60_000;

/** Project list me ek baar me kitne cards. */
export const PROJECT_LIST_LIMIT = 200;

/** Version list me kitni entries dikhein. */
export const VERSION_LIST_LIMIT = 50;

/** Undo history kitni gehri (reel-core ka default 50 hai — yahan saaf likha hai). */
export const HISTORY_LIMIT = 50;

/** Editor ke panel ki jagah localStorage me is key ke neeche yaad rehti hai. */
export const LAYOUT_STORAGE_KEY = "reel-studio.layout.v1";

/** Panel ki chaudai/oonchai ki hadd (px) — resize inhi ke beech clamp hoti hai. */
export const PANEL_LIMITS = {
  left: { min: 180, max: 460, initial: 248 },
  right: { min: 200, max: 520, initial: 300 },
  timeline: { min: 120, max: 520, initial: 220 },
} as const;

export type PanelName = keyof typeof PANEL_LIMITS;
