import LegalScreen, { type LegalSection } from "@/components/legal-screen";
import { useLocale } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

type Content = { title: string; intro: string; sections: LegalSection[] };

const CONTENT: Record<Locale, Content> = {
  hinglish: {
    title: "Privacy & Data",
    intro: "Aapka data aapka hai. Hum sirf itna rakhte hain jitna Saathi ko madad ke liye chahiye.",
    sections: [
      { icon: "cube-outline", h: "Hum kya collect karte hain", p: "Sirf wahi jo Saathi ko kaam karne ke liye chahiye: aapka email (account ke liye), aur woh documents/reminders jo aap khud add karte ho. Bas itna hi." },
      { icon: "lock-closed-outline", h: "Aapke documents", p: "Aapke documents encrypted storage mein rakhe jaate hain. Hum unhe kisi third-party AI ke memory server par save nahi karte. Document padhne ke baad zaroori info (jaise expiry date) nikaal li jaati hai." },
      { icon: "shield-checkmark-outline", h: "Data kabhi bik-ta nahi", p: "Hum aapka data kabhi kisi ko bechte ya rent par dete nahi. Koi ad-tracking nahi. Aapka data sirf aapki madad ke liye use hota hai." },
      // ⚠️ Ye section tab joda gaya jab admin panel me notes ka poora matn
      // dikhne laga. Isse na likhna do wajah se galat hota: user ne apna note
      // is bharose par likha tha ki wo uska apna hai, aur DPDP/GDPR dono me
      // "kaun aapka data dekh sakta hai" batana zaroori hai.
      { icon: "people-outline", h: "Hamari team kya dekh sakti hai", p: "Saathi ki team ke kuch log support aur dikkat theek karne ke liye aapka account data dekh sakte hain — isme aapke notes aur reminders ka matn bhi shamil hai. Ye sirf zaroorat padne par hota hai, aur sirf un logon ke paas hai jinhe ye permission di gayi ho." },
      { icon: "options-outline", h: "Aapka control", p: "Aap jab chaho apna data dekh, export ya delete kar sakte ho. Kuch bhi hatana ho to Saathi ki madad lo ya hume email karo." },
      { icon: "mail-outline", h: "Email", p: "Aapka email sirf account aur zaroori reminders/updates ke liye. Koi spam nahi." },
    ],
  },
  hi: {
    title: "प्राइवेसी और डेटा",
    intro: "आपका डेटा आपका है। हम सिर्फ़ उतना रखते हैं जितना साथी को मदद के लिए चाहिए।",
    sections: [
      { icon: "cube-outline", h: "हम क्या इकट्ठा करते हैं", p: "सिर्फ़ वही जो साथी को काम करने के लिए चाहिए: आपका ईमेल (अकाउंट के लिए), और वो डॉक्युमेंट्स/रिमाइंडर जो आप खुद जोड़ते हैं। बस इतना ही।" },
      { icon: "lock-closed-outline", h: "आपके डॉक्युमेंट्स", p: "आपके डॉक्युमेंट्स एन्क्रिप्टेड स्टोरेज में रखे जाते हैं। हम उन्हें किसी थर्ड-पार्टी AI के मेमोरी सर्वर पर सेव नहीं करते। पढ़ने के बाद ज़रूरी जानकारी (जैसे एक्सपायरी) निकाल ली जाती है।" },
      { icon: "shield-checkmark-outline", h: "डेटा कभी नहीं बिकता", p: "हम आपका डेटा कभी किसी को बेचते या किराए पर नहीं देते। कोई ऐड-ट्रैकिंग नहीं। आपका डेटा सिर्फ़ आपकी मदद के लिए।" },
      { icon: "people-outline", h: "हमारी टीम क्या देख सकती है", p: "साथी की टीम के कुछ लोग सपोर्ट और दिक़्क़त ठीक करने के लिए आपका अकाउंट डेटा देख सकते हैं — इसमें आपके नोट्स और रिमाइंडर का मतन भी शामिल है। यह सिर्फ़ ज़रूरत पड़ने पर होता है, और सिर्फ़ उन लोगों के पास है जिन्हें यह अनुमति दी गई हो।" },
      { icon: "options-outline", h: "आपका कंट्रोल", p: "आप जब चाहें अपना डेटा देख, एक्सपोर्ट या डिलीट कर सकते हैं। कुछ भी हटाना हो तो साथी की मदद लें या हमें ईमेल करें।" },
      { icon: "mail-outline", h: "ईमेल", p: "आपका ईमेल सिर्फ़ अकाउंट और ज़रूरी रिमाइंडर/अपडेट के लिए। कोई स्पैम नहीं।" },
    ],
  },
  en: {
    title: "Privacy & Data",
    intro: "Your data is yours. We keep only what Saathi needs to help you.",
    sections: [
      { icon: "cube-outline", h: "What we collect", p: "Only what Saathi needs to work: your email (for the account), and the documents/reminders you add yourself. That's it." },
      { icon: "lock-closed-outline", h: "Your documents", p: "Your documents are kept in encrypted storage. We never save them on a third-party AI's memory server. After reading, only the essential info (like the expiry date) is extracted." },
      { icon: "shield-checkmark-outline", h: "Data is never sold", p: "We never sell or rent your data to anyone. No ad-tracking. Your data is used only to help you." },
      { icon: "people-outline", h: "What our team can see", p: "Some people on the Saathi team can see your account data to provide support and fix problems — this includes the text of your notes and reminders. It happens only when needed, and only for staff who have been given that permission." },
      { icon: "options-outline", h: "Your control", p: "You can view, export or delete your data anytime. To remove anything, ask Saathi or email us." },
      { icon: "mail-outline", h: "Email", p: "Your email is only for your account and essential reminders/updates. No spam." },
    ],
  },
};

export default function Privacy() {
  const { locale } = useLocale();
  const c = CONTENT[locale] ?? CONTENT.hinglish;
  return (
    <LegalScreen
      title={c.title}
      heroIcon="shield-checkmark-outline"
      intro={c.intro}
      sections={c.sections}
      contactEmail="info@apkasaathi.com"
      contactLabel="info@apkasaathi.com"
    />
  );
}
