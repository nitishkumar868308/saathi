import LegalScreen, { type LegalSection } from "@/components/legal-screen";
import { useLocale } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

type Content = { title: string; intro: string; sections: LegalSection[] };

const CONTENT: Record<Locale, Content> = {
  hinglish: {
    title: "Help & Support",
    intro: "Aksar poochhe jaane wale sawaal. Kuch aur ho to email zaroor karna — hum yahin hain.",
    sections: [
      { icon: "document-attach-outline", h: "Document kaise add karun?", p: "Documents tab me neeche '+' dabao → photo khincho ya gallery se chuno. Saathi AI se document padh ke naam aur expiry apne aap bhar deta hai. Chahe to edit karke Save karo." },
      { icon: "alarm-outline", h: "Reminder kaise banaun?", p: "Reminders tab me '+' dabao → likh ke ya 🎤 mic se bol ke batao (jaise 'kal subah 8 baje paani ka bill'). Ya seedha Saathi se chat me bolo — wo puchega aur bana dega." },
      { icon: "battery-charging-outline", h: "Reminder time par nahi aaya?", p: "Settings → 'Reminders reliable' (Android) me battery optimization off karo, aur notifications allow rakho. Isse reminders bina delay ke aate hain." },
      { icon: "star-outline", h: "Saathi Plus kya hai?", p: "Free plan me kuch limits hoti hain. Plus me unlimited reminders, documents aur AI — sab unlock. Settings → 'Saathi Plus' me dekho." },
      { icon: "chatbubble-ellipses-outline", h: "Saathi se kaise baat karun?", p: "Saathi tab kholo aur likho ya bolo — reminders, documents ya app ke baare me pucho. Wo aapki chuni hui bhasha me jawab dega." },
    ],
  },
  hi: {
    title: "मदद और सहायता",
    intro: "अक्सर पूछे जाने वाले सवाल। कुछ और हो तो ईमेल ज़रूर करें — हम यहीं हैं।",
    sections: [
      { icon: "document-attach-outline", h: "डॉक्युमेंट कैसे जोड़ें?", p: "Documents टैब में नीचे '+' दबाएँ → फ़ोटो खींचें या गैलरी से चुनें। साथी AI से डॉक्युमेंट पढ़कर नाम और एक्सपायरी खुद भर देता है। चाहें तो एडिट करके Save करें।" },
      { icon: "alarm-outline", h: "रिमाइंडर कैसे बनाएँ?", p: "Reminders टैब में '+' दबाएँ → लिखकर या 🎤 माइक से बोलकर बताएँ (जैसे 'कल सुबह 8 बजे पानी का बिल')। या सीधे साथी से चैट में कहें — वो पूछेगा और बना देगा।" },
      { icon: "battery-charging-outline", h: "रिमाइंडर समय पर नहीं आया?", p: "Settings → 'Reminders reliable' (Android) में बैटरी ऑप्टिमाइज़ेशन ऑफ करें, और नोटिफ़िकेशन allow रखें। इससे रिमाइंडर बिना देरी आते हैं।" },
      { icon: "star-outline", h: "Saathi Plus क्या है?", p: "फ्री प्लान में कुछ लिमिट होती हैं। Plus में अनलिमिटेड रिमाइंडर, डॉक्युमेंट्स और AI — सब अनलॉक। Settings → 'Saathi Plus' में देखें।" },
      { icon: "chatbubble-ellipses-outline", h: "साथी से कैसे बात करें?", p: "Saathi टैब खोलें और लिखें या बोलें — रिमाइंडर, डॉक्युमेंट्स या ऐप के बारे में पूछें। वो आपकी चुनी भाषा में जवाब देगा।" },
    ],
  },
  en: {
    title: "Help & Support",
    intro: "Frequently asked questions. If you need anything else, do email us — we're right here.",
    sections: [
      { icon: "document-attach-outline", h: "How do I add a document?", p: "In the Documents tab tap '+' → take a photo or pick from gallery. Saathi's AI reads it and fills the name and expiry automatically. Edit if needed, then Save." },
      { icon: "alarm-outline", h: "How do I set a reminder?", p: "In the Reminders tab tap '+' → type or speak with the 🎤 mic (e.g. 'water bill tomorrow 8 am'). Or just tell Saathi in chat — it'll ask and set it for you." },
      { icon: "battery-charging-outline", h: "Reminder didn't arrive on time?", p: "Settings → 'Reminders reliable' (Android): turn off battery optimization and keep notifications allowed. Reminders then arrive without delay." },
      { icon: "star-outline", h: "What is Saathi Plus?", p: "The free plan has some limits. Plus unlocks unlimited reminders, documents and AI. See Settings → 'Saathi Plus'." },
      { icon: "chatbubble-ellipses-outline", h: "How do I talk to Saathi?", p: "Open the Saathi tab and type or speak — ask about reminders, documents or the app. It replies in your chosen language." },
    ],
  },
};

export default function Help() {
  const { locale } = useLocale();
  const c = CONTENT[locale] ?? CONTENT.hinglish;
  return (
    <LegalScreen
      title={c.title}
      heroIcon="help-buoy-outline"
      intro={c.intro}
      sections={c.sections}
      contactEmail="info@apkasaathi.com"
      contactLabel="info@apkasaathi.com"
    />
  );
}
