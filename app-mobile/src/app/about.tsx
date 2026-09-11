import LegalScreen, { type LegalSection } from "@/components/legal-screen";
import { useLocale } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

type Content = { intro: string; sections: LegalSection[] };

const CONTENT: Record<Locale, Content> = {
  hinglish: {
    intro: "Aapka Saathi, jo kuch nahi bhoolta. 🙂",
    sections: [
      { icon: "sparkles-outline", h: "Kya hai Apka Saathi?", p: "Ek AI companion jo aapke zaroori documents ki expiry, dates aur roz ke kaam bina pooche yaad rakhta hai. Passport, insurance, FASTag, warranty, EMI — sab yaad, taaki aap bhoolo na." },
      { icon: "compass-outline", h: "Humara maksad", p: "Zindagi ki bhaag-daud me hum sab kuch na kuch bhool jaate hain. Saathi wo dost hai jo sab yaad rakhta hai aur sahi waqt par bina pooche yaad dila deta hai — ek samajhdar saathi ki tarah." },
      { icon: "language-outline", h: "Aapki bhasha me", p: "Hindi, Hinglish ya English — jaise aap comfortable ho. Saathi aapki chuni hui bhasha me baat karta hai." },
      { icon: "business-outline", h: "Saathi kaun banata hai", p: "Saathi ko RAHVIAN TECHNOLOGIES PRIVATE LIMITED banati aur chalati hai — India me registered ek private limited company. Plus kharidne par aapke bank ya UPI statement me bhi yahi naam aata hai." },
    ],
  },
  hi: {
    intro: "आपका साथी, जो कुछ नहीं भूलता। 🙂",
    sections: [
      { icon: "sparkles-outline", h: "Apka Saathi क्या है?", p: "एक AI साथी जो आपके ज़रूरी डॉक्युमेंट्स की एक्सपायरी, तारीख़ें और रोज़ के काम बिना पूछे याद रखता है। पासपोर्ट, बीमा, FASTag, वारंटी, EMI — सब याद, ताकि आप न भूलें।" },
      { icon: "compass-outline", h: "हमारा मकसद", p: "ज़िंदगी की भाग-दौड़ में हम सब कुछ न कुछ भूल जाते हैं। साथी वो दोस्त है जो सब याद रखता है और सही समय पर बिना पूछे याद दिला देता है — एक समझदार साथी की तरह।" },
      { icon: "language-outline", h: "आपकी भाषा में", p: "हिंदी, हिंग्लिश या अंग्रेज़ी — जैसे आप सहज हों। साथी आपकी चुनी हुई भाषा में बात करता है।" },
      { icon: "business-outline", h: "साथी को बनाता कौन है", p: "साथी को RAHVIAN TECHNOLOGIES PRIVATE LIMITED बनाती और चलाती है — भारत में रजिस्टर्ड एक प्राइवेट लिमिटेड कंपनी। Plus ख़रीदने पर आपके बैंक या UPI स्टेटमेंट में भी यही नाम आता है।" },
    ],
  },
  en: {
    intro: "Your Saathi, who never forgets. 🙂",
    sections: [
      { icon: "sparkles-outline", h: "What is Apka Saathi?", p: "An AI companion that remembers your important document expiries, dates and everyday tasks — without you asking. Passport, insurance, FASTag, warranty, EMI — all remembered, so you never miss them." },
      { icon: "compass-outline", h: "Our purpose", p: "In the rush of life we all forget things. Saathi is the friend who remembers everything and nudges you at the right time — like a thoughtful companion." },
      { icon: "language-outline", h: "In your language", p: "Hindi, Hinglish or English — whatever you're comfortable with. Saathi talks to you in your chosen language." },
      { icon: "business-outline", h: "Who builds Saathi", p: "Saathi is built and operated by RAHVIAN TECHNOLOGIES PRIVATE LIMITED, a private limited company registered in India. If you buy Plus, this is also the name that appears on your bank or UPI statement." },
    ],
  },
};

const TITLE: Record<Locale, string> = { hinglish: "About Us", hi: "हमारे बारे में", en: "About Us" };

export default function About() {
  const { locale } = useLocale();
  const c = CONTENT[locale] ?? CONTENT.hinglish;
  return (
    <LegalScreen
      title={TITLE[locale] ?? "About Us"}
      heroIcon="people-outline"
      intro={c.intro}
      sections={c.sections}
      contactEmail="info@apkasaathi.com"
      contactLabel="info@apkasaathi.com"
    />
  );
}
