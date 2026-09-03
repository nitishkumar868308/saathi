import type { FitSize } from "./fitPlan";

/**
 * Kai tasveerein jod kar ek — **sirf hisaab, koi canvas nahi**.
 *
 * ⚠️ Kaunsi tasveer kahan baithegi, ye ek ginti ka sawaal hai, aur uska ek hi
 * sahi jawab hota hai. Ise browser ke component me likhne par wo sirf aankh se
 * jaancha ja sakta tha — yaani har badlav par teen tasveerein chun kar dekhna,
 * jo koi nahi karta. Yahan hone se ise ek script se naapa ja sakta hai.
 *
 * ⚠️ Har tasveer apne khaane me **crop** hoti hai (cover), simti hui nahi. Ek
 * jude hue collage me khaali kinare sabse zyada khatakte hain: teen tasveerein
 * ek saath dikhti hain aur unke beech safed pattiyan aa jaati hain, jo poore
 * collage ko toota hua dikhata hai.
 */

/** Tasveerein kis tarah baithengi. */
export type CollageLayout = "rows" | "columns" | "grid";

export interface CollageLayoutDef {
  id: CollageLayout;
  label: string;
  hint: string;
}

export const COLLAGE_LAYOUTS: readonly CollageLayoutDef[] = [
  { id: "rows", label: "Upar-neeche", hint: "Ek ke neeche ek — khadi reel me sabse aam" },
  { id: "columns", label: "Bagal-bagal", hint: "Ek ke bagal me ek — pehle/baad dikhane ke liye" },
  { id: "grid", label: "Jaali", hint: "Chaukor me — chaar ya usse zyada tasveeron par" },
] as const;

export function getCollageLayout(id: string): CollageLayoutDef | undefined {
  return COLLAGE_LAYOUTS.find((entry) => entry.id === id);
}

/** Ek tasveer ka khaana — pixel me, upar-baayen kone se. */
export interface CollageSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Do tasveeron ke beech ki lakeer kitni moti (frame ki chhoti taraf ka anupaat). */
export const COLLAGE_GAP = 0.006;

/**
 * Kitni tasveerein, kis tarah, kitne bade frame me — har ek ka khaana.
 *
 * Khaali list ka matlab hai "aisa collage ban hi nahi sakta" (ek se kam tasveer,
 * ya galat naap), aur bulane wale ko wo saaf dikhana chahiye.
 */
export function collageSlots(args: {
  count: number;
  layout: CollageLayout;
  frame: FitSize;
}): CollageSlot[] {
  const { count, layout, frame } = args;
  if (!Number.isInteger(count) || count < 1) return [];
  if (frame.width <= 0 || frame.height <= 0) return [];

  const gap = Math.round(Math.min(frame.width, frame.height) * COLLAGE_GAP);

  if (layout === "rows") {
    const height = (frame.height - gap * (count - 1)) / count;
    if (height <= 0) return [];
    return Array.from({ length: count }, (_, at) => ({
      x: 0,
      y: Math.round(at * (height + gap)),
      width: frame.width,
      height: Math.round(height),
    }));
  }

  if (layout === "columns") {
    const width = (frame.width - gap * (count - 1)) / count;
    if (width <= 0) return [];
    return Array.from({ length: count }, (_, at) => ({
      x: Math.round(at * (width + gap)),
      y: 0,
      width: Math.round(width),
      height: frame.height,
    }));
  }

  /*
   * Jaali — jitni chaukor ho sake utni.
   *
   * ⚠️ Aakhri qatar bachi hui tasveeron me **poori chaudai** baant leti hai, ek
   * khaali khaana nahi chhodti. Teen tasveeron par 2x2 ki jaali me ek khaana
   * khaali reh jaata hai, aur wo khaali chaukor collage me ek chhed jaisa dikhta
   * hai — jise dekhne wala "kuch load nahi hua" samajhta hai.
   */
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const rowHeight = (frame.height - gap * (rows - 1)) / rows;
  if (rowHeight <= 0) return [];

  const slots: CollageSlot[] = [];
  for (let row = 0; row < rows; row += 1) {
    const inThisRow = row === rows - 1 ? count - cols * (rows - 1) : cols;
    const colWidth = (frame.width - gap * (inThisRow - 1)) / inThisRow;
    if (colWidth <= 0) return [];

    for (let col = 0; col < inThisRow; col += 1) {
      slots.push({
        x: Math.round(col * (colWidth + gap)),
        y: Math.round(row * (rowHeight + gap)),
        width: Math.round(colWidth),
        height: Math.round(rowHeight),
      });
    }
  }
  return slots;
}

/**
 * Ek tasveer apne khaane me **crop** ho kar kaise baithegi.
 *
 * Lauta hua chaukor source ke apne pixel me hai — yaani "source ka ye hissa
 * lena hai". Isse `drawImage` seedha chal jaata hai.
 */
export function coverCrop(source: FitSize, slot: FitSize): CollageSlot | null {
  if (source.width <= 0 || source.height <= 0) return null;
  if (slot.width <= 0 || slot.height <= 0) return null;

  const sourceAspect = source.width / source.height;
  const slotAspect = slot.width / slot.height;

  /*
   * Source khaane se chaudi hai to daayen-baayen se kaato, warna upar-neeche se.
   * Beech me se kaata jaata hai — kisi bhi tasveer me kaam ki cheez aksar beech
   * me hoti hai, aur kinare se kaatna aadhe chehre kaat deta hai.
   */
  if (sourceAspect > slotAspect) {
    const width = source.height * slotAspect;
    return { x: (source.width - width) / 2, y: 0, width, height: source.height };
  }
  const height = source.width / slotAspect;
  return { x: 0, y: (source.height - height) / 2, width: source.width, height };
}
