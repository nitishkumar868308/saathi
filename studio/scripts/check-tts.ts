/**
 * TTS ke do pehre (26.29).
 *
 * ⚠️ Ye script isliye alag hai ki iska ek hissa **paisa kharch karta hai**, aur
 * isliye ye `npm run check` ki qatar me nahi hai. Baaki check chup-chaap chalte
 * hain; ye tab chalta hai jab TTS ko chhua gaya ho:
 *
 *     npm run check:tts          — sirf muft wale pehre
 *     npm run check:tts -- --live — ek asli call bhi (~₹0.17)
 *
 * ⚠️ Ye do galtiyon ke liye likha gaya hai jo **dono baar** typecheck, lint aur
 * har doosre check se saaf nikal gayi thi — kyunki dono me code bilkul theek
 * dikhta tha:
 *
 *   1. `temperature: 0` — awaaz banni band ho gayi, par error kahin nahi tha.
 *      Model bas jawab dena band kar deta tha, aur browser me wo "atak gaya"
 *      jaisa dikhta tha. 45s baad ek timeout ka message aata tha jo wajah bhi
 *      galat batata tha.
 *   2. `GEMINI_TTS_MODEL` env — sab kuch theek chalta tha, awaaz achhi banti
 *      thi, koi error nahi. Farak sirf bill me tha: ₹393.81 me 9 call.
 *
 * Dono me "chal raha hai ya nahi" poochhna kaafi nahi tha. Isliye yahan wo
 * poochha jaata hai jo sach me galat ho sakta hai: **kaunsa number** aur
 * **kaunsa model**.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  GEMINI_MIN_TEMPERATURE,
  GEMINI_TEMPERATURE,
  getTtsAdapter,
  pickTtsModel,
} from "@reel/media";

let passed = 0;
const failures: { name: string; error: string }[] = [];

async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ name, error: message });
    console.log(`  FAIL ${name}\n       ${message.split("\n")[0]}`);
  }
}

/** Env ko chhoo kar wapas wahi chhod dena — warna agla test jhootha ho jaata hai. */
function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
  const before: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    before[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/**
 * `.env.local` khud padh lo — sirf `--live` ke liye.
 *
 * ⚠️ Next apne aap ye file padhta hai, par `tsx` nahi. Bina iske `--live` par
 * "GEMINI_API_KEY set nahi hai" aata hai, jabki wo file me pada hota hai — aur
 * wo message aadmi ko galat cheez theek karne bhejta hai.
 */
function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    // Jo pehle se set hai wo jeeta rahe — shell se diya hua chunav upar hai.
    if (key && process.env[key] === undefined) {
      process.env[key] = value?.trim().replace(/^["']|["']$/g, "") ?? "";
    }
  }
}

async function main(): Promise<void> {
  console.log("\ntemperature (26.29)");

  await test("temperature us hadd se upar hai jahan model atakta hai", () => {
    assert.ok(
      GEMINI_TEMPERATURE >= GEMINI_MIN_TEMPERATURE,
      `temperature ${GEMINI_TEMPERATURE} hai, aur ${GEMINI_MIN_TEMPERATURE} se neeche Gemini ` +
        `jawab dena band kar deta hai (0.1 par 2/2 call kabhi nahi lauti, 0.35 par 1/4). ` +
        `Ye galti error ki tarah nahi dikhti — awaaz bas banni band ho jaati hai.`,
    );
  });

  console.log("\nmehnga model (26.29)");

  await test("GEMINI_TTS_MODEL khaali ho to sasta wala chalta hai", () => {
    withEnv({ GEMINI_TTS_MODEL: undefined, GEMINI_TTS_ALLOW_COSTLY: undefined }, () => {
      assert.equal(pickTtsModel(), "gemini-2.5-flash-preview-tts");
    });
  });

  await test("₹44/call wala model env se chup-chaap nahi aa sakta", () => {
    withEnv(
      { GEMINI_TTS_MODEL: "gemini-3.1-flash-tts-preview", GEMINI_TTS_ALLOW_COSTLY: undefined },
      () => {
        assert.equal(
          pickTtsModel(),
          "gemini-2.5-flash-preview-tts",
          "3.1 wala model env se chal gaya — 24 Aug 2026 ko yahi ₹393.81 ka bill tha.",
        );
      },
    );
  });

  await test("likh kar maanga jaaye to mehnga model chalta hai", () => {
    withEnv(
      { GEMINI_TTS_MODEL: "gemini-3.1-flash-tts-preview", GEMINI_TTS_ALLOW_COSTLY: "yes" },
      () => {
        assert.equal(pickTtsModel(), "gemini-3.1-flash-tts-preview");
      },
    );
  });

  await test("koi aur model env se seedha chalta hai", () => {
    withEnv({ GEMINI_TTS_MODEL: "gemini-2.5-pro-preview-tts" }, () => {
      assert.equal(pickTtsModel(), "gemini-2.5-pro-preview-tts");
    });
  });

  /*
   * ⚠️ Yahan se neeche paisa lagta hai, isliye ye maanga jaata hai — chalta nahi
   * hai. Aur ye hissa hi wo ek cheez pakadta hai jo baaki koi check nahi pakad
   * sakta: call **lautti hai ya nahi**.
   */
  if (process.argv.includes("--live")) {
    console.log("\nasli call (--live, ~₹0.17)");
    loadEnvLocal();

    await test("Gemini 30s ke andar awaaz lauta deta hai", async () => {
      const adapter = getTtsAdapter("gemini");
      const check = await adapter.available();
      assert.ok(check.ok, `Gemini chal nahi sakta: ${check.detail.split("\n")[0]}`);

      const scratch = await mkdtemp(resolve(tmpdir(), "tts-check-"));
      const startedAt = Date.now();
      const raced = await Promise.race([
        adapter
          .synthesize({
            voiceId: "Charon",
            text: "Ye ek jaanch hai — awaaz theek se ban rahi hai ya nahi.",
            rate: 1,
            pitch: 0,
            scratchDir: scratch,
            stylePrompt: "Ek aadmi ki awaaz.",
          })
          .then(() => "aayi" as const),
        new Promise<"atak gaya">((done) => setTimeout(() => done("atak gaya"), 30_000)),
      ]);

      assert.equal(
        raced,
        "aayi",
        `call 30s me nahi lauti. Aam call 5-8s ki hai. Sabse pehle GEMINI_TEMPERATURE dekho ` +
          `(${GEMINI_TEMPERATURE}) — neeche jaane par model atak jaata hai.`,
      );
      console.log(`       ${Date.now() - startedAt}ms me aayi`);
    });
  } else {
    console.log("\nasli call chhod di — chalani ho to:  npm run check:tts -- --live");
  }

  console.log(`\n${passed} ok, ${failures.length} fail`);
  if (failures.length > 0) process.exit(1);
}

void main();
