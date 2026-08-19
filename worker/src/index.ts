// Render worker ka entry point.
//
// Phase 0 me ye sirf ye sabit karta hai ki toolchain chal raha hai — poll loop,
// job claim aur Remotion render Phase 3 me aayenge. Abhi bolke exit ho jaata hai.
console.log("[reel-worker] skeleton chal gaya — abhi koi job nahi uthata (Phase 3 me aayega).");
process.exit(0);
