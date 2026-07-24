"use client";

import { useState } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, CheckCircle2, Lock } from "lucide-react";
import SaathiLogo from "@/components/SaathiLogo";

type PlanId = "plus_monthly" | "plus_yearly";

const PLAN_UI: Record<PlanId, { title: string; base: string; total: string; period: string }> = {
  plus_monthly: { title: "Saathi Plus · Monthly", base: "₹99", total: "₹117", period: "/month" },
  plus_yearly: { title: "Saathi Plus · Yearly", base: "₹999", total: "₹1,179", period: "/year" },
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutClient() {
  const params = useSearchParams();
  const plan = (params.get("plan") as PlanId) || "plus_yearly";
  const uid = params.get("uid") ?? undefined;
  const email = params.get("email") ?? undefined;
  const name = params.get("name") ?? undefined;
  const returnTo = params.get("return") ?? undefined;

  const ui = PLAN_UI[plan] ?? PLAN_UI.plus_yearly;
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function pay() {
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId: uid }),
      });
      if (!orderRes.ok) {
        const j = await orderRes.json().catch(() => ({}));
        throw new Error(j?.error || "order failed");
      }
      const order = await orderRes.json();

      if (!window.Razorpay) throw new Error("Razorpay load nahi hua");

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Saathi",
        description: order.label,
        prefill: { email, name },
        theme: { color: "#C25A37" },
        handler: async (resp: Record<string, string>) => {
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...resp, plan, userId: uid }),
          });
          if (verifyRes.ok) {
            setStatus("done");
            if (returnTo) setTimeout(() => (window.location.href = returnTo), 1500);
          } else {
            setStatus("error");
            setError("Payment verify nahi hua. Support se baat karo.");
          }
        },
        modal: {
          ondismiss: () => setStatus("idle"),
        },
      });
      rzp.open();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Kuch gadbad ho gayi");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="w-full max-w-md rounded-4xl border border-line bg-surface p-7 shadow-warm sm:p-8">
        <div className="flex items-center gap-2.5">
          <SaathiLogo size={46} className="rounded-2xl shadow-warm" />
          <span className="font-display text-xl font-semibold">Saathi</span>
        </div>

        {status === "done" ? (
          <div className="mt-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage text-white">
              <CheckCircle2 size={32} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-semibold">
              Payment ho gaya! 🎉
            </h1>
            <p className="mt-2 text-ink-soft">
              Saathi Plus activate ho gaya. Ab app mein wapas jao.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-semibold">
              {ui.title}
            </h1>
            <div className="mt-4 rounded-2xl border border-line bg-cream-deep/30 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-ink-soft">
                    {ui.base} + 18% GST
                  </p>
                  <p className="font-display text-3xl font-semibold">
                    {ui.total}
                    <span className="text-base font-normal text-ink-soft">
                      {ui.period}
                    </span>
                  </p>
                </div>
                <ShieldCheck size={26} className="text-sage" />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm font-medium text-terracotta-dark">
                {error}
              </p>
            )}

            <button
              onClick={pay}
              disabled={status === "loading"}
              className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-70"
            >
              {status === "loading" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Lock size={16} />
                  Securely pay {ui.total}
                </>
              )}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
              <Lock size={12} />
              Razorpay se secure payment · UPI, card, netbanking
            </p>
          </>
        )}
      </div>
    </div>
  );
}
