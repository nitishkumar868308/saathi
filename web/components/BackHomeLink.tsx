"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

export default function BackHomeLink({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition hover:text-terracotta ${className}`}
    >
      <ArrowLeft size={16} />
      {t.nav.backHome}
    </Link>
  );
}
