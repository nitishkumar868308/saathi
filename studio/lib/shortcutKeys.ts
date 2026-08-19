/**
 * Shortcut keys ka **shuddh** hissa — combo banana, dikhana, remap, takraav.
 *
 * ⚠️ Ye file `shortcuts.ts` se alag isliye hai ki usme `@/lib/store` aur
 * `@/lib/playback` aate hain, aur wo dono browser ke bina chalte hi nahi
 * (Remotion ka player, React ke hooks). Uska seedha nateeja ye tha ki keys ka
 * ganit **kisi test se guzarta hi nahi tha** — aur wahi wo cheez hai jahan do
 * shortcut ek key par baith jaate hain aur pata bhi nahi chalta.
 *
 * Yahan kuch bhi React ya browser ka nahi hai, isliye ise ek plain script se
 * chalaya ja sakta hai. `shortcuts.ts` inhi ko aage bhej deta hai, taaki
 * import karne walon ke liye ek hi jagah rahe.
 */

/** Ek shortcut ki pehchaan — `run` ke bina, kyunki wo store maangta hai. */
export interface ShortcutMeta {
  id: string;
  keys: string;
  label: string;
  group: "edit" | "transport" | "timeline" | "editing";
}

/**
 * Event ko `"mod+shift+z"` jaisi string me badlo.
 *
 * Space ko `" "` ki jagah `"space"` likha jaata hai — `"mod+ "` jaisi string
 * padhne aur likhne dono me galti karwati hai.
 */
export function eventCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");

  const key = event.key.toLowerCase();
  // `Shift` khud ko key ki tarah bhi bhejta hai — usko combo me mat ginno.
  if (!["control", "meta", "alt", "shift"].includes(key)) {
    parts.push(key === " " ? "space" : key);
  }
  return parts.join("+");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["input", "textarea", "select"].includes(target.tagName.toLowerCase());
}

/**
 * Ye element khud is key ko sambhalta hai kya?
 *
 * Button par focus hote hue Space dabana usi button ko dabata hai. Uske upar se
 * apna play/pause bhi chala dene par ek hi dabane me do cheezein hoti hain —
 * jaise "Loop" dabao aur video bhi chalne lage. Isliye aise mauke par browser
 * ko jeetne dete hain.
 */
export function nativeHandlesKey(target: EventTarget | null, combo: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (combo !== "space") return false;
  const tag = target.tagName.toLowerCase();
  return tag === "button" || tag === "a" || target.getAttribute("role") === "button";
}

/* ------------------------------------------------------------------ remap */

const REMAP_KEY = "reel-studio:shortcuts";

/**
 * Shortcut remap (16.7) — localStorage me, `{ [shortcutId]: combo }`.
 *
 * ⚠️ Ye **machine** ki setting hai, project ki nahi, isliye doc me nahi jaati.
 * Keyboard layout aadmi ka hota hai, project ka nahi: ek hi project do logon ke
 * paas alag-alag keys par khulna chahiye.
 */
export function readRemap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REMAP_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out: Record<string, string> = {};
    for (const [id, combo] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof combo === "string" && combo.length > 0) out[id] = combo;
    }
    return out;
  } catch {
    // Kharab JSON par poora editor nahi rukna chahiye — default keys se chalega.
    return {};
  }
}

export function writeRemap(map: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMAP_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(REMAP_EVENT));
  } catch {
    // Private mode me localStorage bhar sakta hai. Remap kho jaana bura hai,
    // par editor ka ruk jaana bahut zyada bura hai.
  }
}

export const REMAP_EVENT = "reel-studio:shortcuts-changed";

/** Remap lagane ke baad har shortcut ki asli key. */
export function resolvedKeys(shortcut: ShortcutMeta, remap: Record<string, string>): string {
  return remap[shortcut.id] ?? shortcut.keys;
}

/**
 * Do shortcut ek hi key par to nahi baith gaye? (16.7)
 *
 * Remap me ye bahut aasani se hota hai aur uska nateeja bahut confusing hota
 * hai: ek key kabhi ek kaam karti hai kabhi doosra (jo pehle list me mila).
 * Isliye remap UI ise **pehle hi** dikhata hai.
 */
export function conflictingIds(
  shortcuts: readonly ShortcutMeta[],
  remap: Record<string, string>,
): string[] {
  const seen = new Map<string, string>();
  const clashing: string[] = [];

  for (const shortcut of shortcuts) {
    const combo = resolvedKeys(shortcut, remap);
    const first = seen.get(combo);
    if (first) {
      if (!clashing.includes(first)) clashing.push(first);
      clashing.push(shortcut.id);
    } else {
      seen.set(combo, shortcut.id);
    }
  }
  return clashing;
}

/** UI me dikhane layak: `mod+shift+z` -> `Ctrl+Shift+Z` (Mac par `⌘`). */
export function comboLabel(keys: string, isMac = false): string {
  const NAMES: Record<string, string> = {
    space: "Space",
    tab: "Tab",
    escape: "Esc",
    alt: "Alt",
    arrowleft: "←",
    arrowright: "→",
    arrowup: "↑",
    arrowdown: "↓",
    home: "Home",
    end: "End",
    delete: "Del",
    backspace: "Backspace",
  };

  return keys
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl";
      if (NAMES[part]) return NAMES[part] as string;
      if (part.length === 1) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(isMac ? "" : "+");
}
