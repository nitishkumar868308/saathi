import LegalScreen from "@/components/legal-screen";

const sections = [
  {
    h: "Kya hai Apka Saathi?",
    p: "Ek AI companion jo aapke zaroori documents ki expiry, dates aur roz ke kaam bina pooche yaad rakhta hai. Passport, insurance, FASTag, warranty, EMI — sab yaad, taaki aap bhoolo na.",
  },
  {
    h: "Humara maksad",
    p: "Zindagi ki bhaag-daud me hum sab kuch na kuch bhool jaate hain. Saathi wo dost hai jo sab yaad rakhta hai aur sahi waqt par bina pooche yaad dila deta hai — ek samajhdar saathi ki tarah.",
  },
  {
    h: "Aapki bhasha me",
    p: "Hindi, Hinglish ya English — jaise aap comfortable ho. Saathi aapki chuni hui bhasha me baat karta hai.",
  },
  {
    h: "Sampark",
    p: "Koi sawaal, sujhaav ya feedback? info@apkasaathi.com par likho — hum zaroor sunenge.",
  },
];

export default function About() {
  return (
    <LegalScreen
      title="Apka Saathi ke baare me"
      intro="Aapka Saathi, jo kuch nahi bhoolta. 🙂"
      sections={sections}
    />
  );
}
