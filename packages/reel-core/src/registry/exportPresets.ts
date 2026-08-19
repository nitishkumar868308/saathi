/**
 * EXPORT_PRESETS — README Section 3A ka quality bar, data ke roop me.
 *
 * ⚠️ Ye Phase 11/20 ka registry hai, par Phase 3 me hi bhar diya gaya kyunki
 * renderer ko CRF kahin se to lena hi tha — aur "abhi ke liye 18 likh dete hain"
 * bilkul wahi magic number hai jisse bachna hai. Phase 11 isme aur entries jodega
 * (jaise "draft" tez preview ke liye), badlega nahi.
 *
 * Section 3A ke jo rule yahan bandhe gaye hain:
 *  - H.264 High profile, `yuv420p`, **CRF <= 18**; sabse achhe preset par 16
 *  - audio 48kHz stereo AAC, 192-320 kbps
 *  - GOP ~2 second (`gopSizeSeconds`) — social players isse tez seek karte hain
 *  - colour space bt709 ke tags, taaki rang player-dar-player na badlein
 *  - **kabhi upscale nahi** — isliye har preset ka `scaleTo` null hai. "4K" ka
 *    label lagakar upscaled 1080p dena mana hai, isliye `uhd` khud resize nahi
 *    karta; wo tabhi matlab rakhta hai jab project pehle se 4K ho.
 */

/**
 * x264 ke apne preset naam. Ye x264 ki list hai, Remotion ki nahi — isliye ise
 * core me rakhna theek hai (core me Remotion ka koi import nahi aata).
 */
export const X264_PRESETS = [
  "ultrafast",
  "superfast",
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
  "slower",
  "veryslow",
  "placebo",
] as const;

export type X264PresetName = (typeof X264_PRESETS)[number];

export interface ExportPresetEntry {
  id: string;
  label: string;
  hint: string;
  /** Chhota = behtar quality, bada file. Section 3A ki chhat 18 hai. */
  crf: number;
  /** x264 ka speed/quality tradeoff. Dheema = chhoti file, wahi quality. */
  x264Preset: X264PresetName;
  audioBitrateKbps: number;
  /**
   * Render ke baad resize. **Hamesha null** — upscale karna mana hai aur
   * downscale project ki size badalkar hona chahiye, export me chupke se nahi.
   */
  scaleTo: { width: number; height: number } | null;
  /**
   * Is preset ka matlab tabhi hai jab project itna bada ho. Phase 20 ki
   * validation isse "4K preset par 1080p project" wali galti pakdegi.
   */
  requiresMinHeight: number | null;
  /**
   * Quality tier (20.6).
   *
   * `"strict"` me **warnings bhi export rok deti hain**, sirf errors nahi. Yahi
   * Strict ka poora matlab hai: "mujhe pakka pata hona chahiye ki kuch bhi
   * dhundhla ya adhoora nahi hai". Baaki tiers me warning dikhti hai aur
   * "Export anyway" chalta hai — kyunki aksar user ko pata hota hai ki wo
   * warning uske liye maayne nahi rakhti.
   */
  tier: "normal" | "strict";
}

export const DEFAULT_EXPORT_PRESET_ID = "standard";

/**
 * GOP (keyframe interval) seconds me — frames me nahi, kyunki fps 24/25/30/50/60
 * kuch bhi ho sakta hai. Engine ise `fps` se guna karke frames banata hai.
 */
export const GOP_SECONDS = 2;

/** Section 3A: sahi colour tags, warna rang har player me thoda alag dikhta hai. */
export const COLOR_SPACE = "bt709";

export const BUILTIN_EXPORT_PRESETS: readonly ExportPresetEntry[] = [
  {
    /*
     * Draft — Phase 11 me juda.
     *
     * ⚠️ Ye Section 3A ka apwaad **nahi** hai: CRF 23 quality bar se neeche hai,
     * isliye iska naam hi "Draft" hai aur UI use saaf batata hai. Wajah asli
     * hai — 30 second ki reel `high` par kai minute leti hai, aur "text thoda
     * neeche karna hai" jaisi ek chhoti si baat check karne ke liye utna
     * intezaar karna kaam rok deta hai. Isse banayi hui file share karne ke
     * liye nahi hai, aur export dialog me yahi likha rehta hai.
     */
    id: "draft",
    label: "Draft (tez, share ke liye nahi)",
    hint: "Sirf khud dekhne ke liye — quality kam hai par render kai guna tez.",
    crf: 23,
    x264Preset: "veryfast",
    audioBitrateKbps: 128,
    scaleTo: null,
    requiresMinHeight: null,
    tier: "normal",
  },
  {
    id: "standard",
    label: "Standard",
    hint: "Instagram / Shorts ke liye kaafi. Sabse tez.",
    crf: 18,
    x264Preset: "medium",
    audioBitrateKbps: 192,
    scaleTo: null,
    requiresMinHeight: null,
    tier: "normal",
  },
  {
    id: "high",
    label: "High",
    hint: "Thodi behtar quality, thoda dheema render aur badi file.",
    crf: 16,
    x264Preset: "slow",
    audioBitrateKbps: 256,
    scaleTo: null,
    requiresMinHeight: null,
    tier: "normal",
  },
  {
    id: "uhd",
    label: "4K",
    hint: "Sirf tab jab project khud 4K ho — upscale karke '4K' likhna mana hai.",
    crf: 16,
    x264Preset: "slow",
    audioBitrateKbps: 320,
    scaleTo: null,
    requiresMinHeight: 2160,
    tier: "normal",
  },
  {
    /*
     * Strict — quality ka darwaza (20.6).
     *
     * ⚠️ Ye ek **alag preset** hai, `high` par ek checkbox nahi. Wajah: tier doc
     * me save hota hai (`exportPresetId`), isliye "maine strict me export kiya
     * tha" baad me bhi pata chalta hai. Checkbox hone par wo baat kahin darj hi
     * nahi hoti.
     */
    id: "strict",
    label: "Strict Quality",
    hint: "Koi bhi chetavni ho to export rukega — client ko bhejne wali reel ke liye.",
    crf: 16,
    x264Preset: "slow",
    audioBitrateKbps: 256,
    scaleTo: null,
    requiresMinHeight: null,
    tier: "strict",
  },
];
