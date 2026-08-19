/**
 * Autosave scheduler ka check.
 *
 * Ye wahi logic hai jiske tootne par "kaam kho gaya" hota hai, aur wo tootna
 * screen par kabhi dikhta nahi — isliye ise haath se aazmana bharosemand nahi.
 * Har assert yahan ek asli behaviour naapta hai:
 *
 *   1. debounce — teen edits, ek save
 *   2. max wait — lagataar edits par bhi save rukti nahi
 *   3. in-flight ke dauraan aayi edit chhootti nahi
 *   4. conflict par retry **band** ho jaata hai
 *   5. network fail par backoff ke saath dobara koshish
 *   6. flush() turant save karta hai
 *
 * Chalane ka tarika:  npm run check --workspace @reel/studio
 */

import assert from "node:assert/strict";

import { createSaveScheduler, type SaveOutcome, type SaveStatus } from "../lib/autosave";

let passed = 0;
const failures: { name: string; error: string }[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ name, error: message });
    console.log(`  FAIL ${name}\n       ${message.split("\n").join("\n       ")}`);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Har test apna chhota harness banata hai — asli timer, chhote number. */
function harness(options: {
  outcome?: (call: number) => SaveOutcome;
  saveDelayMs?: number;
  debounceMs?: number;
  maxWaitMs?: number;
}) {
  const calls: number[] = [];
  const statuses: SaveStatus[] = [];
  const started = Date.now();

  const scheduler = createSaveScheduler({
    debounceMs: options.debounceMs ?? 30,
    maxWaitMs: options.maxWaitMs ?? 120,
    onStatus: (status) => statuses.push(status),
    save: async () => {
      calls.push(Date.now() - started);
      if (options.saveDelayMs) await sleep(options.saveDelayMs);
      return options.outcome ? options.outcome(calls.length) : { kind: "saved" };
    },
  });

  return { scheduler, calls, statuses };
}

/*
 * Sab kuch ek `main()` ke andar hai, top-level await nahi: `studio/package.json`
 * me `"type": "module"` nahi hai (Next ko iski zaroorat nahi), isliye ye file
 * CJS ki tarah chalti hai aur wahan top-level await hai hi nahi.
 */
async function main(): Promise<void> {
  console.log("autosave scheduler (4.9)");

  await test("teen jaldi-jaldi edits = ek hi save (debounce)", async () => {
    const { scheduler, calls, statuses } = harness({});
    scheduler.schedule();
    await sleep(5);
    scheduler.schedule();
    await sleep(5);
    scheduler.schedule();

    await sleep(80);
    assert.equal(calls.length, 1, `1 save chahiye tha, ${calls.length} hue`);
    assert.deepEqual(statuses.slice(-2), ["saving", "saved"]);
    scheduler.dispose();
  });

  await test("lagataar edits par bhi max wait par save hoti hai", async () => {
    // debounce 30ms, max wait 60ms — har 15ms par edit karte raho.
    const { scheduler, calls } = harness({ debounceMs: 30, maxWaitMs: 60 });
    const stop = Date.now() + 150;
    while (Date.now() < stop) {
      scheduler.schedule();
      await sleep(15);
    }
    // Sirf debounce hota to ek bhi save nahi hoti — edits usko aage khiskate rehte.
    assert.ok(calls.length >= 2, `max wait ke bawajood sirf ${calls.length} save hui`);
    scheduler.dispose();
  });

  await test("save ke dauraan aayi edit chhootti nahi (queue)", async () => {
    const { scheduler, calls } = harness({ saveDelayMs: 60 });
    scheduler.schedule();
    await sleep(45); // save shuru ho chuki hai
    assert.equal(calls.length, 1);

    scheduler.schedule(); // in-flight ke dauraan nayi edit
    await sleep(150);
    assert.equal(calls.length, 2, "in-flight ke dauraan aayi edit ke liye doosra save hona tha");
    scheduler.dispose();
  });

  await test("conflict par retry band — dobara bhejna doosri tab ka kaam mitana hai", async () => {
    const { scheduler, calls, statuses } = harness({ outcome: () => ({ kind: "conflict" }) });
    scheduler.schedule();
    await sleep(80);
    assert.equal(calls.length, 1);
    assert.equal(statuses.at(-1), "conflict");

    scheduler.schedule(); // conflict ke baad aur edits
    await sleep(80);
    assert.equal(calls.length, 1, "conflict ke baad chupchaap dobara save nahi hona chahiye");

    // reset() ke baad hi dobara chalu (user ne faisla le liya).
    scheduler.reset();
    scheduler.schedule();
    await sleep(80);
    assert.equal(calls.length, 2, "reset ke baad save dobara chalni chahiye");
    scheduler.dispose();
  });

  await test("network fail par dobara koshish (backoff)", async () => {
    const { scheduler, calls, statuses } = harness({
      outcome: (call) => (call === 1 ? { kind: "retry", message: "network gaya" } : { kind: "saved" }),
    });
    scheduler.schedule();
    await sleep(80);
    assert.equal(calls.length, 1);
    assert.equal(statuses.at(-1), "retrying");

    // Pehla backoff AUTOSAVE_RETRY_BASE_MS (1s) hai — utna ruk kar dekho.
    await sleep(1_300);
    assert.equal(calls.length, 2, "retry hona chahiye tha");
    assert.equal(statuses.at(-1), "saved");
    scheduler.dispose();
  });

  await test("fatal (400) par retry nahi — sirf error", async () => {
    const { scheduler, calls, statuses } = harness({
      outcome: () => ({ kind: "fatal", message: "doc galat hai" }),
    });
    scheduler.schedule();
    await sleep(80);
    assert.equal(statuses.at(-1), "error");
    await sleep(1_300);
    assert.equal(calls.length, 1, "fatal ke baad dobara koshish bekaar hai");
    scheduler.dispose();
  });

  await test("flush() turant save karta hai (Ctrl+S / tab band)", async () => {
    const { scheduler, calls } = harness({ debounceMs: 5_000, maxWaitMs: 10_000 });
    scheduler.schedule();
    assert.equal(calls.length, 0);
    await scheduler.flush();
    assert.equal(calls.length, 1, "flush ke baad save ho jaani chahiye thi");
    assert.equal(scheduler.hasPendingWork(), false);
    scheduler.dispose();
  });

  await test("kuch badla hi nahi to flush khaali ghoomta hai", async () => {
    const { scheduler, calls } = harness({});
    await scheduler.flush();
    assert.equal(calls.length, 0);
    scheduler.dispose();
  });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} tests, 0 fail`);
}

void main();
