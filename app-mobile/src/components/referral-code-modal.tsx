import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { Loader } from "@/components/loader";
import { useKeyboardPad } from "@/components/keyboard-view";
import { applyReferralCode } from "@/lib/plan";
import { useToast } from "@/components/toast";
import { useLocale } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

type RefCopy = {
  title: string;
  sub: string;
  placeholder: string;
  apply: string;
  notNow: string;
  needCode: string;
  msg: Record<string, string>;
};

const COPY: Record<Locale, RefCopy> = {
  hinglish: {
    title: "Referral code hai?",
    sub: "Kisi dost ne bheja hai? Yahan daalo — dono ko free Saathi Plus din milenge.",
    placeholder: "CODE",
    apply: "Apply karo",
    notNow: "Abhi nahi",
    needCode: "Poora code daalo",
    msg: {
      applied: "Referral code lag gaya! 🎉 Ek document + ek reminder add karo — dono ko free Plus din milenge.",
      invalid_code: "Ye code sahi nahi lag raha — dobara check karo.",
      already_referred: "Aap pehle se referred ho — referral ek hi baar lagta hai.",
      self: "Apna hi code nahi laga sakte 🙂",
      // Ek hi phone, do account. Baat saaf keh dena hi theek hai — warna user 15
      // din ka intezaar karta rehta aur aakhir me use wajah bhi nahi milti.
      same_device: "Ye code isi phone ke kisi account ka hai — referral do alag logon ke liye hai 🙂",
      disabled: "Referral abhi band hai.",
      no_auth: "Pehle login karo.",
      error: "Kuch gadbad ho gayi — thodi der baad try karo.",
    },
  },
  hi: {
    title: "रेफरल कोड है?",
    sub: "किसी दोस्त ने भेजा है? यहाँ डालें — दोनों को फ्री Saathi Plus दिन मिलेंगे।",
    placeholder: "CODE",
    apply: "अप्लाई करें",
    notNow: "अभी नहीं",
    needCode: "पूरा कोड डालें",
    msg: {
      applied: "रेफरल कोड लग गया! 🎉 एक डॉक्युमेंट + एक रिमाइंडर जोड़ें — दोनों को फ्री Plus दिन मिलेंगे।",
      invalid_code: "ये कोड सही नहीं लग रहा — दोबारा चेक करें।",
      already_referred: "आप पहले से रेफर्ड हैं — रेफरल एक ही बार लगता है।",
      self: "अपना ही कोड नहीं लगा सकते 🙂",
      same_device: "यह कोड इसी फ़ोन के किसी अकाउंट का है — रेफरल दो अलग लोगों के लिए है 🙂",
      disabled: "रेफरल अभी बंद है।",
      no_auth: "पहले लॉगिन करें।",
      error: "कुछ गड़बड़ हो गई — थोड़ी देर बाद ट्राई करें।",
    },
  },
  en: {
    title: "Have a referral code?",
    sub: "A friend sent you one? Enter it here — you both get free Saathi Plus days.",
    placeholder: "CODE",
    apply: "Apply",
    notNow: "Not now",
    needCode: "Enter the full code",
    msg: {
      applied: "Referral code applied! 🎉 Add one document + one reminder — you both get free Plus days.",
      invalid_code: "That code doesn't look right — please check again.",
      already_referred: "You're already referred — a referral applies only once.",
      self: "You can't use your own code 🙂",
      same_device: "This code belongs to an account on this same phone — a referral is for two different people 🙂",
      disabled: "Referrals are off right now.",
      no_auth: "Please log in first.",
      error: "Something went wrong — try again in a bit.",
    },
  },
};

/** Referral code daalne ka modal — dashboard (auto) aur profile (manual) dono me. */
export function ReferralCodeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const tc = useColors();
  const styles = useStyles();
  const toast = useToast();
  const { locale } = useLocale();
  const copy = COPY[locale] ?? COPY.hinglish;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * Keyboard ke liye jagah — card usi hisaab se upar khisak jaata hai.
   *
   * ⚠️ Card screen ke theek beech me hai aur usme ek TextInput hai. Code par tap
   * karte hi keyboard uske NEECHE ka poora hissa dhak leta tha — "Apply" ka
   * button aur "Abhi nahi" dono. Yaani code daal ke aage badhne ka koi raasta hi
   * nahi bachta tha. Wahi ek tareeka jo `otp-modal` par hai (poori wajah
   * `lib/use-keyboard.ts` par likhi hai).
   */
  const kbPad = useKeyboardPad(12);

  async function apply() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return toast.show(copy.needCode, "info");
    setLoading(true);
    const res = await applyReferralCode(c);
    setLoading(false);
    toast.show(copy.msg[res] ?? copy.msg.error, res === "applied" ? "success" : "info");
    // In cases me modal band kar do (dobara try karne layak nahi).
    if (
      res === "applied" ||
      res === "already_referred" ||
      res === "self" ||
      // Wahi phone hai — dobara try karne se kuch nahi badlega, sirf uljhan badhegi.
      res === "same_device"
    ) {
      setCode("");
      onClose();
    }
  }

  return (
    <Modal statusBarTranslucent visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: 24 + kbPad }]}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="gift" size={26} color={tc.terracotta} />
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.sub}>{copy.sub}</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder={copy.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholderTextColor={tc.inkSoft}
            style={styles.input}
          />
          <Pressable
            onPress={apply}
            disabled={loading}
            style={({ pressed }) => [styles.apply, (pressed || loading) && { opacity: 0.85 }]}
          >
            {loading ? (
              <Loader size={26} />
            ) : (
              <Text style={styles.applyText}>{copy.apply}</Text>
            )}
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
            <Text style={styles.closeText}>{copy.notNow}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: c.surface,
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
  },
  iconWrap: {
    height: 54,
    width: 54,
    borderRadius: 18,
    backgroundColor: "rgba(194,90,55,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: "800", color: c.ink },
  sub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: c.inkSoft,
    textAlign: "center",
  },
  input: {
    marginTop: 18,
    width: "100%",
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    color: c.ink,
  },
  apply: {
    marginTop: 14,
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: c.white, fontWeight: "700", fontSize: 16 },
  close: { marginTop: 14, padding: 4 },
  closeText: { color: c.inkSoft, fontSize: 14, fontWeight: "600" },
}));
