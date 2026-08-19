/**
 * Property-path get/set — `"transform.scale"`, `"audio.volume"`, `"text.fontSize"`.
 *
 * Ye poore product ka ek chhota par bahut zaroori tukda hai: keyframes,
 * properties panel, aur `setItemProperty` teeno property ko *string path* se
 * address karte hain. Isi wajah se koi bhi nayi property apne aap keyframable
 * aur editable ban jaati hai — per-property code likhna nahi padta.
 */

export function parsePath(path: string): string[] {
  if (!path) throw new Error("parsePath: empty path");
  return path.split(".");
}

export function getByPath(target: unknown, path: string): unknown {
  let current: unknown = target;
  for (const key of parsePath(path)) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Path par value set karo. Beech ke missing objects bana diye jaate hain, par
 * kisi non-object (string/number) ko chupchaap object me nahi badalte — wo
 * hamesha ek bug hota hai, isliye throw karte hain.
 */
export function setByPath(target: unknown, path: string, value: unknown): void {
  const keys = parsePath(path);
  const last = keys[keys.length - 1] as string;

  let current = target as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i] as string;
    const next = current[key];
    if (next === undefined || next === null) {
      current[key] = {};
    } else if (typeof next !== "object") {
      throw new Error(
        `setByPath: "${keys.slice(0, i + 1).join(".")}" object nahi hai (${typeof next}) — path "${path}" galat hai`,
      );
    }
    current = current[key] as Record<string, unknown>;
  }
  current[last] = value;
}

export function hasPath(target: unknown, path: string): boolean {
  return getByPath(target, path) !== undefined;
}
