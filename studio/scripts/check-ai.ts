/**
 * AI ke checks (21.2 / 21.13).
 *
 * ⚠️ Sabse zaroori sawaal: **key ke bina kya hota hai?** Uska jawab "sab kuch
 * theek chalta hai" hona chahiye — aur wo daawa test se hi pakka hota hai.
 *
 * Route ko yahan **sach me bulaya** jaata hai (import karke), uske jawab ka
 * andaaza nahi lagaya jaata. Wo sirf `next/server` import karta hai, isliye
 * Node me chal jaata hai.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { MockAiProvider, listSceneTypes, sceneTypesForPrompt } from "@reel/core";

import { readTokenUsage } from "../lib/ai/usage";

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

function section(title: string): void {
  console.log(`\n${title}`);
}

async function main(): Promise<void> {
  section("key ke bina (21.13)");

  // Env saaf — ye hi wo haalat hai jise naapna hai.
  delete process.env.GEMINI_API_KEY;
  const route = await import("../app/api/ai/generate/route");

  await test("GET saaf batata hai ki AI band hai", async () => {
    const response = await route.GET();
    const body = (await response.json()) as { configured?: boolean };
    assert.equal(response.status, 200, "haalat poochhna hamesha chalna chahiye");
    assert.equal(body.configured, false);
  });

  await test("POST 503 deta hai aur wajah likhta hai", async () => {
    /*
     * 200 ke saath error bhejna aasan hota par galat hai: har caller ko body
     * padh kar sochna padta ki kya hua. 503 ek asli haalat hai — "ye seva abhi
     * hai hi nahi" — aur UI use alag se dikhati hai.
     */
    const response = await route.POST(
      new Request("http://localhost/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: "kuch bhi" }),
      }),
    );
    assert.equal(response.status, 503);

    const body = (await response.json()) as { error?: string };
    assert.ok(body.error?.includes("GEMINI_API_KEY"), `wajah saaf honi chahiye: ${body.error}`);
  });

  await test("key set hone par GET configured batata hai", async () => {
    process.env.GEMINI_API_KEY = "test-key-sirf-is-test-ke-liye";
    const response = await route.GET();
    const body = (await response.json()) as { configured?: boolean; model?: string };
    assert.equal(body.configured, true);
    assert.ok((body.model ?? "").length > 0, "model ka naam bhi aana chahiye");
    delete process.env.GEMINI_API_KEY;
  });

  await test("khaali prompt par 400, network par jaane se pehle hi", async () => {
    // Bekaar call bhejna free tier me seedha nuksan hai.
    process.env.GEMINI_API_KEY = "test-key";
    const response = await route.POST(
      new Request("http://localhost/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: "   " }),
      }),
    );
    assert.equal(response.status, 400);
    delete process.env.GEMINI_API_KEY;
  });

  section("mock provider (21.2)");

  const mock = new MockAiProvider();

  await test("mock bina network ke script deta hai", async () => {
    const result = await mock.generateScript({
      story: "Papa pareshan hain. Rahul app dikhata hai. Kaam ho jaata hai.",
      language: "hinglish",
      durationSeconds: 20,
      aspect: "9:16",
      sceneTypes: sceneTypesForPrompt(),
    });

    assert.ok(result.data.scenes.length >= 3);
    assert.equal(result.usage.calls, 0, "mock koi call nahi karta");
    assert.equal(result.usage.provider, "mock");
  });

  await test("mock ke scenes registry ke asli types se hain", async () => {
    const result = await mock.generateScript({
      story: "Ek line.",
      language: "en",
      durationSeconds: 10,
      aspect: "9:16",
      sceneTypes: sceneTypesForPrompt(),
    });
    const known = new Set(listSceneTypes().map((entry) => entry.id));
    for (const scene of result.data.scenes) {
      assert.ok(known.has(scene.type), `"${scene.type}" registry me nahi`);
    }
  });

  await test("mock do baar bulane par bilkul wahi jawab deta hai", async () => {
    /*
     * Deterministic hona zaroori hai: iske bina koi bhi test jo mock par tika
     * ho, kabhi-kabhi fail hota rehta — aur aisa test dheere-dheere anadekha
     * kar diya jaata hai.
     */
    const input = {
      story: "Do line. Doosri line.",
      language: "hinglish" as const,
      durationSeconds: 15,
      aspect: "9:16",
      sceneTypes: sceneTypesForPrompt(),
    };
    const first = await mock.generateScript(input);
    const second = await mock.generateScript(input);
    assert.deepEqual(first.data, second.data);
  });

  section("token ki ginti (21.11)");

  await test("sochne wale token bhi output me gine jaate hain", () => {
    /*
     * ⚠️ Ye ginti ek asli naap se aayi hai — isi repo se, ek chhoti si call par:
     * prompt 12, candidates 5, thoughts 105, total 122. Sirf `candidates` ginne
     * par jawab 17 aata tha: saat guna kam, aur bilkul bharosemand dikhta hua.
     * Isliye ye test poore number ke saath likha hai, "zyada hona chahiye"
     * jaise dheele daawe ke saath nahi.
     */
    const usage = readTokenUsage({
      promptTokenCount: 12,
      candidatesTokenCount: 5,
      thoughtsTokenCount: 105,
      totalTokenCount: 122,
    });
    assert.equal(usage.inputTokens, 12);
    assert.equal(usage.outputTokens, 110, "candidates + thoughts");
    assert.equal(usage.totalTokens, 122, "Gemini ke apne totalTokenCount se milna chahiye");
  });

  await test("purane jawab (bina thoughts ke) waise ke waise chalte hain", () => {
    const usage = readTokenUsage({ promptTokenCount: 40, candidatesTokenCount: 60 });
    assert.equal(usage.outputTokens, 60);
    assert.equal(usage.totalTokens, 100);
  });

  await test("ginti na aaye to jawab null hai — 0 nahi", () => {
    // 0 ka matlab "kharcha kuch nahi hua" hota hai. Jab provider ne bataya hi
    // nahi, wo likh dena jhooth hai — aur usi jhooth par kharcha gina jaata.
    const usage = readTokenUsage(undefined);
    assert.equal(usage.inputTokens, null);
    assert.equal(usage.outputTokens, null);
    assert.equal(usage.totalTokens, 0, "units 0 theek hai — par tokens null hi rehte hain");
  });

  await test("sirf sochne ke token aayein to bhi output 'pata nahi' rehta", () => {
    const usage = readTokenUsage({ promptTokenCount: 10, thoughtsTokenCount: 99 });
    assert.equal(usage.outputTokens, null);
  });

  await test("route khud token nahi ginta — wahi ginti ek jagah rehti hai", async () => {
    /*
     * ⚠️ Source padha jaata hai, jaan-boojhkar. Sahi ginti ek helper me daal
     * dena aadha kaam hai; doosra aadha ye hai ki koi kal route me wapas
     * `candidatesTokenCount` na likh de. Wo galti chalti rehti hai aur kisi
     * test se pakdi nahi jaati, kyunki number tab bhi aata hai — bas kam.
     */
    const source = await readFile(
      new URL("../app/api/ai/generate/route.ts", import.meta.url),
      "utf8",
    );
    // Comment hata ke dekha jaata hai — wahin us purani galti ki kahani likhi
    // hai, aur usme wahi shabd aata hai jise hum code me dhoondh rahe hain.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    assert.ok(code.includes("readTokenUsage("), "route ko helper hi bulana chahiye");
    assert.ok(
      !code.includes("candidatesTokenCount"),
      "ginti do jagah bat gayi — route me phir se apna hisaab likha hai",
    );
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
