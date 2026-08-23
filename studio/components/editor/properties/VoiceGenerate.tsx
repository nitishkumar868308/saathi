"use client";

import { voiceFrames, type AudioSource } from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AudioPreview } from "@/components/media/AudioPreview";
import { forgetAssetMeta } from "@/lib/assetMeta";

/**
 * Voice generate ka hissa (22.4 / 22.5 / 22.9 / 22.x).
 *
 * ⚠️ **Yahan kuch bhi maan kar nahi chala jaata.** Kaun sa provider is machine
 * par sach me chal sakta hai, ye `GET /api/tts` se **poochha** jaata hai. Bina
 * poochhe button dikhane par user use dabata hai, kuch nahi hota, aur wo sochta
 * hai app toota hua hai — jabki sirf ek key ya ek `pip install` baaki tha.
 *
 * ⚠️ Voice ka chunaav **category** se hota hai (Aadmi / Aurat / Ladka …), kisi
 * `Charon` ya `hi-IN-MadhurNeural` jaise naam se nahi. Un naamon se koi andaaza
 * nahi lagta ki awaaz kaisi hogi, aur wo provider badalte hi bematlab ho jaate
 * hain. Category har provider par kuch na kuch matlab rakhti hai.
 */

interface ProviderInfo {
  id: string;
  label: string;
  hint: string;
  kind: "cloud" | "local" | "manual";
  available: boolean;
  detail: string;
}

interface CategoryInfo {
  id: string;
  label: string;
  hint: string;
}

interface TtsStatus {
  providers: ProviderInfo[];
  categories: CategoryInfo[];
}

/** Ek hi baar poochho — har clip chunne par dobara poochhna bekaar hai. */
let cache: TtsStatus | null = null;
let inflight: Promise<TtsStatus> | null = null;

async function loadStatus(): Promise<TtsStatus> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const response = await fetch("/api/tts");
    if (!response.ok) throw new Error(`TTS status nahi mila (HTTP ${response.status})`);
    cache = (await response.json()) as TtsStatus;
    inflight = null;
    return cache;
  })();
  return inflight;
}

export function VoiceGenerate({
  source,
  itemId,
  fps,
  onChange,
  onSyncDuration,
}: {
  source: NonNullable<AudioSource>;
  itemId: string;
  fps: number;
  onChange(patch: Partial<NonNullable<AudioSource>>, label: string): void;
  /** Voice ki lambai clip/scene par lagao (22.11). */
  onSyncDuration(durationInFrames: number): void;
}) {
  const [status, setStatus] = useState<TtsStatus | null>(cache);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /*
   * Aakhri bani hui awaaz ki lambai — "Lambai isi ke barabar karo" wala button
   * isi par tikka hai.
   *
   * ⚠️ Ye **apne aap nahi lagti**, aur ye jaan-boojhkar hai. User ne clip ki
   * lambai khud tay ki ho sakti hai (music ke beat par, ya doosri clip ke saath);
   * usse chup-chaap badal dena wahi cheez hai jise "isne mera kaam bigaad diya"
   * kaha jaata hai. Button dikhta hai, faisla user ka rehta hai.
   */
  const [lastSeconds, setLastSeconds] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadStatus()
      .then((next) => { if (alive) setStatus(next); })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { alive = false; };
  }, []);

  if (!status) {
    return <p className="text-[11px] text-chalk-500">TTS ka haal poochha ja raha hai…</p>;
  }

  const usable = status.providers.filter((p) => p.kind !== "manual");
  const ready = usable.filter((p) => p.available);
  const chosenId = source.providerId || ready[0]?.id || "";
  const chosen = usable.find((p) => p.id === chosenId) ?? null;
  const categoryId = source.categoryId || status.categories[0]?.id || "";

  /*
   * Button tabhi dabta hai jab teeno cheezein sach me maujood hon. Har rok ka
   * apna saaf jawab hai (`blockedWhy`) — disabled button bina wajah ke sabse
   * chidhane wali cheez hoti hai.
   */
  const blockedWhy =
    ready.length === 0
      ? "Koi provider chalne layak nahi — neeche dekho"
      : !source.text.trim()
        ? "Pehle upar likho ki kya bolna hai"
        : chosen && !chosen.available
          ? `${chosen.label}: ${chosen.detail}`
          : null;

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: source.text,
          categoryId,
          providerId: chosenId || undefined,
          rate: source.rate,
          pitch: source.pitch,
        }),
      });
      const json = (await response.json()) as {
        asset?: { id: string; durationMs?: number | null };
        cached?: boolean;
        voiceId?: string;
        providerId?: string;
        error?: string;
        reason?: string;
      };
      if (!response.ok || !json.asset) {
        throw new Error(json.reason || json.error || `HTTP ${response.status}`);
      // Nayi asset bani — list taaza karo (nahi to Export "asset nahi mila" bolega).
      forgetAssetMeta();
      }

      onChange(
        {
          generatedAssetId: json.asset.id,
          // Iske bina "voice purani hai" kabhi pakda nahi jaata (22.10).
          generatedFromText: source.text,
          providerId: json.providerId ?? chosenId,
          categoryId,
          voiceId: json.voiceId ?? "",
        },
        "Voice generate",
      );

      /*
       * Cache se aayi ya nayi bani — ye user ko batana zaroori hai. Warna
       * "generate" dabane par turant jawab aana ajeeb lagta hai, aur ye bhi
       * pata nahi chalta ki is click ka paisa laga ya nahi.
       */
      setNote(json.cached ? "Pehle se bani hui awaaz mili — koi naya kharcha nahi." : "Nayi awaaz ban gayi.");
      const ms = json.asset.durationMs;
      setLastSeconds(typeof ms === "number" && ms > 0 ? ms / 1000 : null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[11px] text-chalk-500">
        <span className="w-14 shrink-0">Awaaz</span>
        <select
          value={categoryId}
          onChange={(event) => onChange({ categoryId: event.target.value }, "Voice category")}
          className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-chalk-200 outline-none focus:border-terracotta"
        >
          {status.categories.map((category) => (
            <option key={category.id} value={category.id} title={category.hint}>
              {category.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-[11px] text-chalk-500">
        <span className="w-14 shrink-0">Kahan se</span>
        <select
          value={chosenId}
          onChange={(event) => onChange({ providerId: event.target.value }, "TTS provider")}
          className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-chalk-200 outline-none focus:border-terracotta"
        >
          {usable.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
              {provider.available ? "" : " — setup chahiye"}
            </option>
          ))}
        </select>
      </label>

      {/*
       * ⚠️ "Text bahar jaayega" wali baat **generate dabane se pehle** dikhni
       * chahiye, baad me nahi. Cloud provider par ye chhupana user ka faisla
       * uske haath se chheen lena hai.
       */}
      {chosen?.kind === "cloud" ? (
        <p className="text-[10px] leading-snug text-chalk-500">{chosen.hint}</p>
      ) : null}

      <button
        type="button"
        disabled={busy || blockedWhy !== null}
        onClick={() => void generate()}
        title={blockedWhy ?? "Text se awaaz banao"}
        className={clsx(
          "flex w-full items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
          blockedWhy === null && !busy
            ? "border-terracotta bg-terracotta/15 text-chalk-200 hover:bg-terracotta/25"
            : "cursor-not-allowed border-ink-600 text-chalk-500",
        )}
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
        {busy ? "Ban rahi hai…" : "Voice banao"}
      </button>

      {blockedWhy && !busy ? (
        <p className="text-[10px] leading-snug text-chalk-500">{blockedWhy}</p>
      ) : null}

      {note ? <p className="text-[10px] leading-snug text-sage">{note}</p> : null}

      {/*
       * Bani hui awaaz yahin sunn lo — timeline par lagane se pehle. Iske bina
       * "sahi voice bani ya nahi" ka jawab poori reel preview kiye bina milta
       * hi nahi tha, aur wo sabse aam sawaal hai.
       */}
      {source.generatedAssetId ? (
        <AudioPreview assetId={source.generatedAssetId} />
      ) : null}

      {/*
       * 22.11 — voice ki lambai clip/scene par lagao.
       *
       * ⚠️ Button par **asli number** likha hai ("2.7s · 81 frames"), sirf "sync"
       * nahi. Bina number ke user ko dabane se pehle pata hi nahi chalta ki uski
       * clip kitni lambi ho jaayegi — aur wo seedha Ctrl+Z wali surat hai.
       */}
      {lastSeconds !== null ? (
        <button
          type="button"
          onClick={() => onSyncDuration(voiceFrames(lastSeconds, fps))}
          title="Clip (ya scene) ki lambai is awaaz ke barabar kar do"
          className="w-full rounded border border-ink-600 px-2 py-1 text-[11px] text-chalk-400 transition-colors hover:border-terracotta hover:text-chalk-200"
        >
          Lambai isi ke barabar karo — {lastSeconds.toFixed(1)}s ·{" "}
          {voiceFrames(lastSeconds, fps)} frames
        </button>
      ) : null}

      {error ? (
        <p className="flex items-start gap-1 rounded border border-amber/40 bg-amber/10 px-1.5 py-1 text-[10px] leading-snug text-amber">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {/*
       * Jo provider abhi chal nahi sakte unka kaaran yahin likha hai — taaki
       * "setup chahiye" padhne ke baad user ko dhoondhna na pade ki kya karna hai.
       */}
      {ready.length < usable.length ? (
        <details className="text-[10px] text-chalk-500">
          <summary className="cursor-pointer">Kuch provider abhi chal nahi sakte</summary>
          <ul className="mt-1 space-y-0.5 pl-3">
            {usable
              .filter((p) => !p.available)
              .map((p) => (
                <li key={p.id} className="list-disc">
                  <span className="text-chalk-400">{p.label}</span> — {p.detail}
                </li>
              ))}
          </ul>
        </details>
      ) : null}

      {/* itemId sirf coalesce keys ke liye upar use hoti hai; yahan kuch nahi. */}
      <span className="hidden" data-item={itemId} />
    </div>
  );
}
