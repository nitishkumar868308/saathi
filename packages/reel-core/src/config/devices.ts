/**
 * Phone frames — **sirf data** (18.1).
 *
 * Naya device jodna yahan ek entry hai, aur bas. `PhoneFrame` component in
 * numbers se apne aap SVG banata hai — koi PNG asset nahi (18.3). PNG rakhne ka
 * matlab hota ki wo file render ke bundle me chahiye, aur ek din wo miss ho
 * jaati aur video me phone ki jagah khaali dabba aata.
 *
 * Saare naap **screen ki chaudai ke hisaab se** hain, pixels me nahi. Isliye
 * ek hi frame har size par sahi baithta hai: 1080-chaudi screen par bezel 3.2%
 * hai aur 540-chaudi par bhi 3.2%.
 */

export interface DeviceEntry {
  id: string;
  label: string;
  /** Screen ka aspect — `width / height`. */
  screenAspect: number;
  /** Bezel ki motai, screen ki chaudai ka hissa. */
  bezelRatio: number;
  /** Bahar ke kone ka radius, screen ki chaudai ka hissa. */
  outerRadiusRatio: number;
  /** Andar (screen) ke kone ka radius. */
  screenRadiusRatio: number;
  /**
   * Upar ka cut — `"notch"` (chaudi patti), `"island"` (goli), ya `"none"`.
   *
   * Ye sirf dikhawa hai aur screen ke pixels ko **nahi** kaat'ta. Kaat dene par
   * user ka apna recording upar se kat jaata, jo kabhi koi nahi chahta.
   */
  cutout: "notch" | "island" | "none";
  /** Cutout ki chaudai, screen ki chaudai ka hissa. */
  cutoutWidthRatio: number;
  /** Frame ke rang ke vikalp — pehla default hai. */
  colors: readonly { id: string; label: string; body: string; edge: string }[];
}

const DARK_COLORS = [
  { id: "graphite", label: "Graphite", body: "#1C1C1E", edge: "#3A3A3C" },
  { id: "silver", label: "Silver", body: "#D9D9DE", edge: "#F2F2F5" },
  { id: "gold", label: "Gold", body: "#C9A227", edge: "#E8CE72" },
] as const;

export const BUILTIN_DEVICES: readonly DeviceEntry[] = [
  {
    id: "phone-tall",
    label: "Phone (19.5:9)",
    // Aaj ke zyadातर phone — 1080x2340 / 1170x2532 jaisi screens.
    screenAspect: 1080 / 2340,
    bezelRatio: 0.032,
    outerRadiusRatio: 0.13,
    screenRadiusRatio: 0.1,
    cutout: "island",
    cutoutWidthRatio: 0.3,
    colors: DARK_COLORS,
  },
  {
    id: "phone-notch",
    label: "Phone (notch)",
    screenAspect: 1125 / 2436,
    bezelRatio: 0.034,
    outerRadiusRatio: 0.14,
    screenRadiusRatio: 0.11,
    cutout: "notch",
    cutoutWidthRatio: 0.46,
    colors: DARK_COLORS,
  },
  {
    id: "phone-classic",
    label: "Phone (16:9)",
    // Purane phone — bade bezel, seedhe kone. Bharat me abhi bhi bahut chalte hain.
    screenAspect: 1080 / 1920,
    bezelRatio: 0.055,
    outerRadiusRatio: 0.06,
    screenRadiusRatio: 0.02,
    cutout: "none",
    cutoutWidthRatio: 0,
    colors: DARK_COLORS,
  },
  {
    id: "tablet",
    label: "Tablet (4:3)",
    screenAspect: 1536 / 2048,
    bezelRatio: 0.045,
    outerRadiusRatio: 0.05,
    screenRadiusRatio: 0.02,
    cutout: "none",
    cutoutWidthRatio: 0,
    colors: DARK_COLORS,
  },
];

export function findDevice(id: string): DeviceEntry | undefined {
  return BUILTIN_DEVICES.find((device) => device.id === id);
}

export function requireDevice(id: string): DeviceEntry {
  const device = findDevice(id);
  if (!device) {
    throw new Error(
      `Device "${id}" nahi mila. Maujood: ${BUILTIN_DEVICES.map((entry) => entry.id).join(", ")}`,
    );
  }
  return device;
}

export const DEFAULT_DEVICE_ID = "phone-tall";

/**
 * Asset ke aspect se sabse milta-julta device chuno (18.9).
 *
 * ⚠️ Sabse paas wala chunte hain, "bilkul barabar" nahi — barabar shayad hi
 * kabhi hota hai (1080x2400 ka aspect kisi bhi list me theek nahi milega). Agar
 * yahan barabar maanga jaata, to har recording par "koi device nahi mila" aata
 * aur ye feature kabhi chalta hi nahi.
 */
export function deviceForAspect(width: number, height: number): DeviceEntry {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return requireDevice(DEFAULT_DEVICE_ID);
  }
  const aspect = width / height;

  let best = BUILTIN_DEVICES[0] as DeviceEntry;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const device of BUILTIN_DEVICES) {
    const gap = Math.abs(device.screenAspect - aspect);
    if (gap < bestGap) {
      bestGap = gap;
      best = device;
    }
  }
  return best;
}

/**
 * Frame ka poora naap — screen ki chaudai se.
 *
 * Sab kuch ek jagah se nikalta hai, taaki preview aur render me ek hi ganit
 * chale aur bezel kabhi aadha-adhoora na dikhe.
 */
export function frameGeometry(
  device: DeviceEntry,
  screenWidth: number,
): {
  screenWidth: number;
  screenHeight: number;
  bezel: number;
  outerWidth: number;
  outerHeight: number;
  outerRadius: number;
  screenRadius: number;
  cutoutWidth: number;
  cutoutHeight: number;
} {
  const bezel = screenWidth * device.bezelRatio;
  const screenHeight = screenWidth / device.screenAspect;

  return {
    screenWidth,
    screenHeight,
    bezel,
    outerWidth: screenWidth + bezel * 2,
    outerHeight: screenHeight + bezel * 2,
    outerRadius: screenWidth * device.outerRadiusRatio,
    screenRadius: screenWidth * device.screenRadiusRatio,
    cutoutWidth: screenWidth * device.cutoutWidthRatio,
    // Notch chaudi aur patli hoti hai, island chhoti aur moti.
    cutoutHeight:
      device.cutout === "notch" ? screenWidth * 0.055 : screenWidth * device.cutoutWidthRatio * 0.3,
  };
}
