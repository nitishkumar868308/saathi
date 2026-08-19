import { isBrandToken } from "../config/brand";
import { DEFAULT_BACKGROUND } from "../config/presets";
import type { Doc, Item } from "../schema/project";

/**
 * Manual color overrides (17.11).
 *
 * ⚠️ Yahan koi "override flag" nahi hai, aur ye ek soch-samajh kar liya faisla
 * hai — is poore phase ka sabse saaf faisla.
 *
 * Doc me rang do hi tarah ke ho sakte hain:
 *  - `"brand.primary"` — token, yaani "jo brand kahe"
 *  - `"#C25A37"`       — pakka rang, yaani "maine khud chuna"
 *
 * Isliye override apne aap **pehchana jaata hai**: jo token nahi hai wo override
 * hai. Aur isi wajah se brand preset badalne par override apne aap bach jaate
 * hain — unhe bachane ke liye kuch karna hi nahi padta.
 *
 * Alag `overriddenBy` flag rakhne par do sach ban jaate: ek rang khud, aur ek
 * flag jo batata ki wo rang kahan se aaya. Wo dono ek din alag ho jaate (koi op
 * rang badal deta par flag nahi), aur tab "brand badla par ye ek text kaala hi
 * raha" jaisi galti aati hai jiski wajah kabhi samajh nahi aati.
 */

/** Ek jagah jahan rang likha ja sakta hai. */
export interface ColorSite {
  itemId: string;
  itemName: string;
  /** `"text.color"`, `"shape.fill"`, `"text.stroke.color"`… */
  path: string;
  value: string;
}

/** Item ke andar har wo jagah jahan rang baith sakta hai. */
function colorSites(item: Item): ColorSite[] {
  const sites: ColorSite[] = [];
  const push = (path: string, value: unknown) => {
    if (typeof value === "string" && value.length > 0) {
      sites.push({ itemId: item.id, itemName: item.name, path, value });
    }
  };

  push("text.color", item.text?.color);
  push("text.background.color", item.text?.background?.color ?? null);
  push("text.stroke.color", item.text?.stroke?.color ?? null);
  push("shape.fill", item.shape?.fill);
  push("shape.stroke.color", item.shape?.stroke?.color ?? null);

  /*
   * Fit ka background bhi rang hai — aur wo aksar chhoot jaata hai. `contain`
   * wale video ke peeche ka rang brand ka hissa hai, aur brand badalne par uska
   * bhi badalna chahiye.
   */
  if (item.fit.background.kind === "color" || item.fit.background.kind === "brand") {
    push("fit.background.value", item.fit.background.value);
  }

  // Effects ke apne rang (vignette, border, dropShadow).
  item.effects.forEach((effect, index) => {
    for (const [key, value] of Object.entries(effect as Record<string, unknown>)) {
      if (key === "color") push(`effects.${index}.color`, value);
    }
  });

  return sites;
}

export interface BrandOverrideReport {
  /** Jitni jagah pakka rang likha hai (yaani token nahi). */
  overrides: ColorSite[];
  /** Jitni jagah token hai — yahi brand badalne par badlengi. */
  tokenSites: ColorSite[];
}

export function brandOverrides(doc: Doc): BrandOverrideReport {
  const overrides: ColorSite[] = [];
  const tokenSites: ColorSite[] = [];

  for (const item of doc.items) {
    for (const site of colorSites(item)) {
      if (isBrandToken(site.value)) tokenSites.push(site);
      else overrides.push(site);
    }
  }

  /*
   * Project ka apna background bhi ginti me — wo poori reel ka rang hai.
   *
   * ⚠️ Par **default kaala override nahi hai**, aur ye farak zaroori hai. Naye
   * project ka background `#000000` hota hai — video ke liye ye jaan-boojhkar
   * hai (letterbox kaala hi dikhna chahiye), user ka chuna hua nahi. Use
   * override ginne par har naye project par "1 override" dikhta, aur do-teen
   * baar dekhne ke baad user us ginti par bharosa karna hi chhod deta.
   */
  const background = doc.project.background;
  const projectSite: ColorSite = {
    itemId: doc.project.id,
    itemName: "Project background",
    path: "project.background",
    value: background,
  };
  if (isBrandToken(background)) tokenSites.push(projectSite);
  else if (background !== DEFAULT_BACKGROUND) overrides.push(projectSite);

  return { overrides, tokenSites };
}

/**
 * Sab overrides ko token par wapas le aao (17.11).
 *
 * ⚠️ Ye ek **alag button** hai, brand badalne ka hissa nahi. Brand badalte waqt
 * chup-chaap overrides mita dena sabse buri baat hoti: user ne wo rang jaan-
 * boojhkar chune the aur wo bina bataye chale jaate.
 *
 * Sirf wo paths lautaye jaate hain jinhe badalna hai; asli badlav `setItemsProperty`
 * jaise ops se hota hai, taaki undo waise ka waisa chale.
 */
export function overridesToTokens(
  doc: Doc,
  mapping: Record<string, string>,
): { itemId: string; path: string; from: string; to: string }[] {
  const patches: { itemId: string; path: string; from: string; to: string }[] = [];

  for (const site of brandOverrides(doc).overrides) {
    const token = mapping[site.value.toLowerCase()];
    if (!token) continue;
    patches.push({ itemId: site.itemId, path: site.path, from: site.value, to: token });
  }
  return patches;
}

/**
 * Preset ke rangon se ek "hex -> token" naksha banao.
 *
 * Isse "mere overrides me se kaun se asal me brand ke hi rang hain" pata chalta
 * hai — aur wahi wo overrides hain jinhe token banana bilkul safe hai.
 */
export function tokenByColor(tokens: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [token, value] of Object.entries(tokens)) {
    if (!token.startsWith("brand.") || !value.startsWith("#")) continue;
    // Pehla jeetta hai — do token ek hi rang par hon to `brand.primary` jaisa
    // seedha naam `brand.primaryDark` se behtar hai.
    if (!(value.toLowerCase() in map)) map[value.toLowerCase()] = token;
  }
  return map;
}
