/**
 * @reel/core — poore product ki reedh ki haddi.
 *
 * Pure TypeScript. Yahan React, DOM, ya Node ka koi import nahi aata — kyunki
 * yahi code studio (browser), worker (Node) aur aage chalke tests teeno chalate
 * hain. Ek jagah galat import aur ye teeno me se kahin na kahin toot jaata hai.
 */

// Neenv
export * from "./id";
export * from "./path";
export * from "./time";
export * from "./hash/sha256";

// Config — sab data, koi magic number nahi
export * from "./config/animationPresets";
export * from "./config/audio";
export * from "./config/effectPresets";
export * from "./config/mask";
export * from "./audio/mix";
export * from "./audio/cleanup";
export * from "./config/brand";
export * from "./config/devices";
export * from "./config/easing";
export * from "./config/fit";
export * from "./config/fonts";
export * from "./config/overlap";
export * from "./config/presets";
export * from "./config/safeArea";

// Registries — dynamic-first ka dil
export * from "./registry/index";

// Project JSON
export * from "./schema/project";
export * from "./schema/migrate";
export * from "./schema/factory";

// TTS — cache ki key (asli awaaz banana @reel/media me)
export * from "./tts/cacheKey";
export * from "./tts/pending";
export * from "./scenes/primary";
export * from "./timeline/assetDrop";
export * from "./mockup/taps";
export * from "./ai/cost";

// Keyframes — value nikalna (poora engine Phase 13 me)
export * from "./keyframes/interpolate";

// Quality — Section 3A ka naapne wala hissa (poora validator Phase 20 me)
export * from "./quality/assetQuality";
export * from "./quality/preflight";
export * from "./quality/scale";
export * from "./quality/validate";

// Storage — sirf contract aur key layout (asli drivers @reel/storage me)
export * from "./storage/types";
export * from "./storage/keys";
export * from "./storage/lifecycle";

// Timeline
export * from "./timeline/ops";
export * from "./timeline/history";
export * from "./timeline/select";

/*
 * Brand aur templates sabse aakhir me — aur ye kram maayne rakhta hai.
 *
 * ⚠️ `templates/apply.ts` `timeline/ops` aur `registry/sceneTypes` dono ko
 * import karta hai. Ise upar rakhne par module graph ulta chalta hai:
 * `sceneTypes` aadha bana hota hai jab `registry/index` apna `registerBuiltins()`
 * chalata hai, aur "Cannot access 'BUILTIN_SCENE_TYPES' before initialization"
 * aata hai. Ye galti build me nahi, sirf chalane par dikhti hai.
 */
export * from "./brand/overrides";
export * from "./mockup/zoomPan";
export * from "./captions/srt";
export * from "./captions/cues";
export * from "./captions/transcript";
export * from "./captions/align";
export * from "./captions/translit";
export * from "./audio/beats";
export * from "./templates/schema";
export * from "./templates/apply";
export * from "./templates/builtins";
export * from "./ai/types";
export * from "./ai/mock";
export * from "./ai/proposal";
