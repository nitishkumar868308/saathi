import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/components/auth-provider";
import { getUserDetails } from "@/lib/user-details";
import { getPlan } from "@/lib/plan";
import { onMilestone } from "@/lib/reviews";

/**
 * "WhatsApp par message chahiye? Pehle number verify karo."
 *
 * ── Ye kyun chahiye tha ────────────────────────────────────────────────────
 *
 * ⚠️ Plus ka sabse bada waada yahi hai: reminder aur document expiry ka message
 * WhatsApp aur email par bhi aayega. Email apne aap chala jaata hai (account ka
 * email pehle se maujood hai), par WhatsApp ke liye ek shart hai — profile me
 * number VERIFY hona chahiye (`supabase/phone-verify.sql`), aur wo number wahi
 * hona chahiye jispar WhatsApp chalta ho.
 *
 * Wo shart kahin likhi hi nahi thi. Nateeja bilkul chup-chaap fail tha:
 *
 *   • User Plus kharidta tha.
 *   • Reminder lagata tha, document daalta tha.
 *   • WhatsApp par kabhi kuch nahi aata tha.
 *   • Kahin koi error nahi, koi hint nahi. Uske liye ye "feature kaam hi nahi
 *     karta" tha — aur wo bilkul sahi tha, kyunki usse kabhi bataya hi nahi gaya
 *     ki karna kya hai.
 *
 * Cron ka code bilkul theek hai: wo `phone_verified_at` null hone par WhatsApp
 * bhejta hi nahi (aur ye theek hai — ek digit ki galti reminder kisi ajnabi ke
 * paas bhej deti hai). Kami sirf batane ki thi.
 *
 * ⚠️ Ye modal login par NAHI khulta. Wo teen-modal wali bheed wapas le aata (jo
 * abhi-abhi theek ki gayi hai). Ye tabhi khulta hai jab user ne abhi-abhi ek
 * reminder ya document banaya ho — theek us pal jab "iska message kahan aayega"
 * sabse zyada matlab rakhta hai.
 */

const SEEN_PREFIX = "saathi-whatsapp-setup-seen:";

export function WhatsAppSetupModal() {
  const tc = useColors();
  const styles = useStyles();
  const { whatsappSetup: w, common: c } = useT();
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user?.id;

  const [show, setShow] = useState(false);
  const [scale] = useState(() => new Animated.Value(0.94));

  const check = useCallback(async () => {
    if (!uid) {
      setShow(false);
      return;
    }
    // Free plan par WhatsApp jaata hi nahi — wahan ye poochna bekaar hai (aur
    // ek chhupa hua upsell jaisa lagta hai).
    const plan = await getPlan().catch(() => null);
    if (!plan?.isPlus) return;

    // Details hamesha taaza chahiye: user abhi-abhi profile me verify karke
    // laut sakta hai, aur cache use purana bata dega.
    const details = await getUserDetails(true).catch(() => null);
    // Pehle se verify hai — kehne ko kuch hai hi nahi.
    if (details?.phone_verified_at) return;

    const seen = await AsyncStorage.getItem(`${SEEN_PREFIX}${uid}`).catch(() => null);
    if (seen === "1") return;

    setShow(true);
  }, [uid]);

  /**
   * Sirf tab jab user ne abhi-abhi kuch banaya ho.
   *
   * ⚠️ Ye login par JAAN-BOOJH KE nahi khulta. Wahan ye teesra/chautha modal ban
   * jaata aur wahi bheed wapas aa jaati jo abhi-abhi khatm ki gayi hai. Reminder
   * ya document banane ka lamha hi wo lamha hai jab "iska message kahan aayega"
   * sach me matlab rakhta hai.
   *
   * `onMilestone` chat, add-reminder, note-reminder aur add-document — chaaron
   * raaston se aata hai, isliye har jagah alag se kuch jodna nahi padta.
   */
  useEffect(() => onMilestone(() => void check()), [check]);

  useEffect(() => {
    if (!show) return;
    scale.setValue(0.94);
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [show, scale]);

  /**
   * "Dekh liya" DONO jawab par likhte hain — "Abhi nahi" par bhi.
   *
   * Warna ye har reminder par khulta rehta, aur wahi cheez ban jaata jisse
   * bachna hai: ek popup jise log bina padhe band karne lagte hain.
   */
  async function remember() {
    if (!uid) return;
    await AsyncStorage.setItem(`${SEEN_PREFIX}${uid}`, "1").catch(() => {});
  }

  async function later() {
    await remember();
    setShow(false);
  }

  async function go() {
    await remember();
    setShow(false);
    router.push("/profile-details" as never);
  }

  if (!show) return null;

  return (
    <Modal statusBarTranslucent transparent animationType="fade" visible onRequestClose={() => void later()}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="logo-whatsapp" size={26} color={tc.sage} />
            </View>
            <Text style={styles.title}>{w.title}</Text>
            <Text style={styles.body}>{w.body}</Text>

            <View style={styles.note}>
              <Ionicons name="information-circle" size={15} color={tc.terracotta} />
              <Text style={styles.noteText}>{w.note}</Text>
            </View>

            <Pressable
              onPress={() => void go()}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>{w.cta}</Text>
            </Pressable>
            <Pressable
              onPress={() => void later()}
              style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ghostText}>{c.no}</Text>
            </Pressable>
          </View>
        </Animated.View>
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
    padding: 18,
  },
  cardWrap: { width: "100%", maxWidth: 420 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: c.line,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  iconWrap: {
    height: 58,
    width: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,138,107,0.14)",
  },
  title: { marginTop: 15, fontSize: 20, fontWeight: "800", color: c.ink, lineHeight: 27 },
  body: { marginTop: 9, fontSize: 14, lineHeight: 21, color: c.inkSoft },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.28)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: "600", color: c.ink },
  cta: {
    marginTop: 18,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 15, fontWeight: "800", color: c.white },
  ghost: {
    marginTop: 9,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  ghostText: { fontSize: 14, fontWeight: "700", color: c.inkSoft },
}));
