"use client";

import LegalPage from "@/components/LegalPage";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Privacy / Terms ka content — chuni hui bhasha se.
 *
 * ⚠️ Ye do page pehle server component the aur unka poora text `app/privacy/
 * page.tsx` aur `app/terms/page.tsx` me hardcoded Hinglish tha. Language
 * switcher unpar kuch nahi karta tha — Hindi chunne ke baad bhi privacy policy
 * Hinglish hi rehti thi, jabki app ke andar wahi page teeno bhasha me tha.
 *
 * `generateMetadata` (SEO title/description) upar wale server page me hi rehta
 * hai — wo crawler ke liye hai, user ki chuni bhasha se uska koi lena-dena
 * nahi.
 */
export default function LegalContent({ kind }: { kind: "privacy" | "terms" }) {
  const { legal } = useT();
  return (
    <LegalPage
      title={kind === "privacy" ? legal.privacyTitle : legal.termsTitle}
      lastUpdatedLabel={legal.lastUpdated}
      sections={kind === "privacy" ? legal.privacy : legal.terms}
    />
  );
}
