// OCR text se document ka TYPE aur NAAM khud pehchanta hai (bina AI, keyword rules).
// Perfect nahi — saaf documents pe zyadatar sahi. User naam edit kar sakta hai.

export type Detected = { type: string; name: string };

export function detectDocType(text: string): Detected {
  const t = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  const has = (...w: string[]) => w.some((x) => t.includes(x));

  if (has("fastag", "fas tag")) return { type: "fastag", name: "FASTag" };

  if (has("passport", "republic of india passport"))
    return { type: "passport", name: "Passport" };

  if (has("driving licence", "driving license", " dl no", "licence to drive"))
    return { type: "license", name: "Driving License" };

  if (has("mediclaim", "health insurance", "sum insured", "hospitalization", "hospitalisation", "cashless"))
    return { type: "health", name: "Health Insurance" };

  if (has("life insurance", " lic ", "life assured"))
    return { type: "health", name: "Life Insurance" };

  if (has("motor insurance", "vehicle insurance", "car insurance", "two wheeler", "private car", "own damage", "third party", "idv"))
    return { type: "car", name: "Vehicle Insurance" };

  if (has("registration certificate", "vehicle registration", " rc no", " reg no"))
    return { type: "car", name: "Vehicle RC" };

  if (has("insurance", "policy", "premium", "insured"))
    return { type: "car", name: "Insurance" };

  if (has("warranty", "guarantee", "warranted"))
    return { type: "warranty", name: "Warranty" };

  if (has("aadhaar", "uidai", "unique identification"))
    return { type: "other", name: "Aadhaar Card" };

  if (has("permanent account number", "income tax department"))
    return { type: "other", name: "PAN Card" };

  return { type: "other", name: "Document" };
}

/** OCR text se ek naam-jaisi line nikalta hai (jab type detect na ho). */
export function guessName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[^a-zA-Z0-9 &.\-/]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const l of lines) {
    const words = l.split(" ").filter((w) => w.length > 1);
    const hasLetters = /[a-zA-Z]/.test(l);
    // 2-6 words, letters ho, pure number na ho
    if (hasLetters && words.length >= 1 && words.length <= 6 && l.length >= 4) {
      return l.slice(0, 40);
    }
  }
  return "";
}
