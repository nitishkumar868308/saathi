import LegalScreen from "@/components/legal-screen";

const sections = [
  {
    h: "1. Hum kya collect karte hain",
    p: "Sirf wahi jo Saathi ko kaam karne ke liye chahiye: aapka email (account ke liye), aur woh documents/reminders jo aap khud add karte ho. Bas itna hi.",
  },
  {
    h: "2. Aapke documents",
    p: "Aapke documents encrypted storage mein rakhe jaate hain. Hum unhe kisi third-party AI ke memory server par save nahi karte. Document padhne ke baad zaroori info (jaise expiry date) nikaal li jaati hai — baaki aapke control mein rehta hai.",
  },
  {
    h: "3. Data kabhi bik-ta nahi",
    p: "Hum aapka data kabhi kisi ko bechte ya rent par dete nahi. Koi ad-tracking nahi. Aapka data sirf aapki madad ke liye use hota hai.",
  },
  {
    h: "4. Aapka control",
    p: "Aap jab chaho apna data dekh, export ya delete kar sakte ho. Settings me 'Sab data delete' se apne documents aur reminders hata sakte ho.",
  },
  {
    h: "5. Email",
    p: "Aapka email sirf account aur zaroori reminders/updates ke liye. Koi spam nahi.",
  },
  {
    h: "6. Sampark",
    p: "Koi sawaal? info@apkasaathi.com par likho — hum khushi se madad karenge.",
  },
];

export default function Privacy() {
  return <LegalScreen title="Privacy & Data" sections={sections} />;
}
