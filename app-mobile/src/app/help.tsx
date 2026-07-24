import LegalScreen from "@/components/legal-screen";

const sections = [
  {
    h: "Document kaise add karun?",
    p: "Documents tab me neeche '+' button dabao → photo khincho ya gallery se chuno. Saathi AI se document padh ke naam aur expiry apne aap bhar deta hai. Chahe to edit karke Save karo.",
  },
  {
    h: "Reminder kaise banaun?",
    p: "Reminders tab me '+' dabao → likh ke ya 🎤 mic se bol ke batao (jaise 'kal subah 8 baje paani ka bill'). Saathi time samajh ke reminder laga deta hai.",
  },
  {
    h: "Reminder time par nahi aaya?",
    p: "Settings → 'Reminders reliable' (Android) me battery optimization off karo, aur notifications allow rakho. Isse reminders bina delay ke aate hain.",
  },
  {
    h: "Saathi Plus kya hai?",
    p: "Free plan me kuch limits hoti hain. Plus me unlimited reminders, documents aur AI — sab unlock. Settings → 'Saathi Plus' me dekho.",
  },
  {
    h: "Data delete karna hai?",
    p: "Settings → 'Sab data delete' se apne documents aur reminders hata sakte ho. Privacy ke baare me 'Privacy & Data' screen padho.",
  },
  {
    h: "Aur madad chahiye?",
    p: "Hum yahan hain — info@apkasaathi.com par email karo. Jitni jaldi ho sake, jawab denge.",
  },
];

export default function Help() {
  return (
    <LegalScreen
      title="Help & Support"
      intro="Aksar poochhe jaane wale sawaal. Kuch aur ho to email zaroor karna."
      sections={sections}
    />
  );
}
