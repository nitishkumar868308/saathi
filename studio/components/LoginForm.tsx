"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string; reason?: string };
      if (!response.ok) {
        setError(data.reason ?? data.error ?? "login nahi hua");
        return;
      }
      // `replace` taaki back button login page par wapas na laaye.
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <input
        type="password"
        value={password}
        autoFocus
        onChange={(event) => setPassword(event.target.value)}
        placeholder="password"
        className="w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-terracotta"
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={busy || !password} className="w-full justify-center">
        {busy ? "Dekh raha hoon…" : "Andar jao"}
      </Button>
    </form>
  );
}
