import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AppState,
  type AppStateStatus,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";
import { isAccountClosed } from "@/lib/account";
import { WEB_URL } from "@/lib/plan";
import { clearDocCache } from "@/lib/doc-cache";
import { signOut } from "@/lib/auth";

/**
 * Admin ne account band (hide) kar diya — poori app ki jagah SIRF ye screen.
 *
 * ⚠️ Iske bina "hide" adhoora reh jaata tha, aur wo user ke liye sabse uljhan
 * wali soorat banti thi. `account-delete-requests.sql` ki RLS har table ko band
 * kar deti hai jaise hi `profiles.deleted_at` bharta hai — yaani app khulti to
 * hai, par har screen khaali: documents 0, reminders 0, chat khaali, profile
 * save nahi hota. Kahin koi wajah nahi likhi hoti. User ko lagta hai app hi
 * toot gayi, aur wo support me "mera saara data gayab ho gaya" likhta hai —
 * jabki data bilkul surakshit hai aur usne khud hi delete maanga tha.
 *
 * Ek hi saaf baat behtar hai: "ye account band kar diya gaya hai", aur nikalne
 * ka ek raasta.
 *
 * ⚠️ Ye jaanch net se hoti hai, isliye "pata nahi" ka matlab hamesha "khula
 * hai" hai — offline hone par account ko band bata dena kayi guna bura hoga.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user?.id;
  /**
   * Kis user ka account band mila — sirf `true/false` nahi.
   *
   * ⚠️ Ye jaan-boojh ke uid ke saath rakha hai. Ek saada boolean do jagah galat
   * ho jaata: logout ke turant baad (jab tak nayi jaanch na chale) purana `true`
   * chipka reh jaata aur login screen ki jagah "account band hai" dikhta; aur
   * jaanch ke beech me user badal jaye to purane user ka jawab naye par lag
   * jaata. `closedFor === uid` dono soorat apne aap sambhal leta hai.
   */
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const closed = !!uid && closedFor === uid;

  const check = useCallback(async () => {
    // Login hi nahi hai — poochhne ko kuch nahi (aur `closed` waise bhi false).
    if (!uid) return;
    const isClosed = await isAccountClosed();
    setClosedFor(isClosed ? uid : null);
  }, [uid]);

  useEffect(() => {
    void check();
  }, [check]);

  /**
   * App wapas saamne aayi — dobara poochho.
   *
   * Dono taraf ke liye zaroori hai: admin abhi-abhi hide kar sakta hai (tab
   * app ko turant rukna chahiye), aur admin unhide bhi kar sakta hai (tab user
   * ko app band karke dobara kholne par majboor nahi karna chahiye).
   */
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [uid, check]);

  if (!closed) return <>{children}</>;
  return <ClosedScreen />;
}

function ClosedScreen() {
  const tc = useColors();
  const styles = useStyles();
  const toast = useToast();
  const { settings: s, support: sup } = useT();
  const { session } = useAuth();

  /**
   * Logout — aur uske baad kahan jaana hai, wo YAHAN se tay nahi hota.
   *
   * ⚠️ Yahan `router.replace()` mat likhna. Is screen ke chalne ka matlab hi ye
   * hai ki `RootNavigator` (aur uska `<Stack>`) mount hi nahi hua — navigate
   * karne ko kuch hai hi nahi. Session null hote hi ye gate khud hat jaata hai,
   * Stack mount hota hai, aur uska apna effect language screen par le jaata hai
   * (wahi raasta jo settings ke logout par chalta hai).
   */
  async function leave() {
    try {
      await clearDocCache(session?.user?.id);
      await signOut();
    } catch {
      toast.show(s.logout + " ✕", "error");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.icon}>
          <Ionicons name="lock-closed-outline" size={30} color={tc.terracotta} />
        </View>
        <Text style={styles.title}>{s.closedTitle}</Text>
        <Text style={styles.body}>{s.closedBody}</Text>

        <Pressable
          onPress={() => void leave()}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.88 }]}
        >
          <Ionicons name="log-out-outline" size={18} color={tc.white} />
          <Text style={styles.btnText}>{s.logout}</Text>
        </Pressable>

        {/*
          Support ka raasta khula rakhna zaroori hai — "galti se hua ho to wapas
          khol sakte hain" wali baat bina raaste ke bekaar hai.

          ⚠️ App ki apni support screen yahan kaam nahi karegi: wo
          `support_tickets` par tiki hai, jise band account me RLS rok deti hai.
          Isliye website ka contact form — wo bina login ke chalta hai.
        */}
        <Pressable
          onPress={() => void Linking.openURL(`${WEB_URL}/contact`)}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="mail-outline" size={15} color={tc.terracotta} />
          <Text style={styles.linkText}>{sup.title}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: {
    padding: 24,
    paddingTop: 60,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "center",
  },
  icon: {
    height: 68,
    width: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  title: {
    marginTop: 18,
    fontSize: 21,
    fontWeight: "800",
    color: c.ink,
    textAlign: "center",
  },
  body: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 22,
    color: c.inkSoft,
    textAlign: "center",
  },
  btn: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    minWidth: 200,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: c.terracotta,
  },
  btnText: { fontSize: 15, fontWeight: "800", color: c.white },
  link: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  linkText: { fontSize: 13.5, fontWeight: "700", color: c.terracotta },
}));
