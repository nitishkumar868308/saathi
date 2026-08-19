import { parseDoc, SCHEMA_VERSION, type Doc } from "./project";

/**
 * Doc migration.
 *
 * Din ek se maujood hai — jaan-boojhkar. Jis din pehla project save hota hai usi
 * din se purane docs ka bojh shuru ho jaata hai; migration baad me add karna
 * hamesha "wo purane 40 projects ab nahi khulte" wali shaam me badalta hai.
 *
 * Naya version add karna ek line ka kaam hona chahiye:
 *   1. `SCHEMA_VERSION` 2 karo (project.ts me),
 *   2. yahan `{ from: 1, to: 2, label, migrate }` daalo.
 * Chain apne aap chal jaayegi.
 */

export interface Migration {
  from: number;
  to: number;
  label: string;
  /** Raw doc andar, raw doc bahar — validation chain ke aakhir me hoti hai. */
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}

/** Abhi v1 hi pehla version hai, isliye chain khaali hai. */
export const MIGRATIONS: readonly Migration[] = [];

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

/** Doc ka version padho, bina poora parse kiye. */
export function readDocVersion(input: unknown): number {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new MigrationError("Doc ek object hona chahiye");
  }
  const version = (input as Record<string, unknown>).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new MigrationError(
      `Doc me valid "version" nahi hai (mila: ${JSON.stringify(version)})`,
    );
  }
  return version;
}

/**
 * Kisi bhi purane doc ko aaj ke shape me lao aur validate karke do.
 *
 * Aage ka doc (version bada) jaan-boojhkar **reject** hota hai — usko chupchaap
 * kholna matlab naye fields chup-chaap gira dena, aur save karte hi user ka kaam
 * kho jaana. Saaf error hi imaandaar jawaab hai.
 */
export function migrateDoc(input: unknown): Doc {
  let version = readDocVersion(input);

  if (version > SCHEMA_VERSION) {
    throw new MigrationError(
      `Ye doc version ${version} ka hai, par ye build sirf ${SCHEMA_VERSION} tak samajhta hai. ` +
        `Studio update karo — warna naye fields kho jaayenge.`,
    );
  }

  let doc = { ...(input as Record<string, unknown>) };

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS.find((migration) => migration.from === version);
    if (!step) {
      throw new MigrationError(
        `Version ${version} se ${SCHEMA_VERSION} tak koi migration nahi hai`,
      );
    }
    doc = step.migrate(doc);
    doc.version = step.to;
    version = step.to;
  }

  return parseDoc(doc);
}

/** `migrateDoc` ka non-throwing version — load screens ke liye. */
export function safeMigrateDoc(
  input: unknown,
): { ok: true; doc: Doc } | { ok: false; error: string } {
  try {
    return { ok: true, doc: migrateDoc(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
