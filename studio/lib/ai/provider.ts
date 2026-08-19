"use client";

import { mockAiProvider, type AIProvider } from "@reel/core";
import { useEffect, useState } from "react";

import { GeminiAiProvider } from "@/lib/ai/gemini";

/**
 * Kaun sa provider chalega (21.2 / 21.13).
 *
 * ⚠️ Key ka pata **server se** aata hai, `NEXT_PUBLIC_` env var se nahi — wo
 * bundle me chala jaata hai aur uska matlab hai key ko sabke haath me de dena.
 * Yahan sirf `true`/`false` aata hai, key kabhi nahi.
 *
 * Key na ho to `mockAiProvider` chalta hai. Wo "AI" hone ka daawa nahi karta
 * (`isConfigured()` `false` deta hai) — panel wahi sach dikhati hai. Par uska
 * output asli scene types se banta hai, isliye story se shuru karne ka raasta
 * band nahi hota.
 */

export interface AiStatus {
  provider: AIProvider;
  /** Server par key hai? */
  configured: boolean;
  model: string;
  /** Abhi pata kar rahe hain. */
  loading: boolean;
}

export function useAiProvider(): AiStatus {
  const [state, setState] = useState<{ configured: boolean; model: string; loading: boolean }>({
    configured: false,
    model: "",
    loading: true,
  });

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const response = await fetch("/api/ai/generate", { method: "GET" });
        const data = (await response.json()) as { configured?: boolean; model?: string };
        if (!alive) return;
        setState({
          configured: Boolean(data.configured),
          model: data.model ?? "",
          loading: false,
        });
      } catch {
        /*
         * Route hi na mile (purana build, ya route hata diya gaya) — tab AI band
         * maana jaata hai. Crash karna galat hoga: AI ek optional parat hai aur
         * uski galti se editor nahi rukna chahiye.
         */
        if (alive) setState({ configured: false, model: "", loading: false });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return {
    provider: state.configured ? new GeminiAiProvider(true) : mockAiProvider,
    configured: state.configured,
    model: state.model,
    loading: state.loading,
  };
}
