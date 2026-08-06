import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/components/auth-provider";
import { getLockState } from "@/lib/app-lock";

/**
 * "Saathi ko lock kar lo?" — login ke baad, ek hi baar.
 *
 * ⚠️ Ye poochna zaroori hai, warna app lock ka koi matlab nahi rehta: jo cheez
 * Settings ke andar teen tap door padi ho use koi nahi dhoondhta, aur documents
 * bina kisi rok ke us har phone par khule rehte hain jispar app install hai.
 *
 * Ek baar hi poochte hain (har user ke apne key par). Baar-baar poochna is
 * sawaal ko ek bekaar popup me badal deta hai jise log bina padhe band karne
 * lagte hain — aur tab ye kabhi kaam nahi karega.
 */

const SEEN_PREFIX = "saathi-lock-offer-seen:";

export function LockOffer() {
  const tc = useColors();
  const styles = useStyles();
  const { lock: l } = useT();
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user?.id;

  const [show, setShow] = useState(false);
  const [scale] = useState(() => new Animated.Value(0.94));

  const check = useCallback(async () => {
    if (!uid) return;
    // Lock pehle se laga hua hai — poochne ki baat hi nahi.
    const st = await getLockState();
    if (st.enabled) return;
    const seen = await AsyncStorage.getItem(`${SEEN_PREFIX}${uid}`).catch(() => null);
    if (seen === "1") return;
    setShow(true);
  }, [uid]);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    if (!show) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [show, scale]);

  /**
   * "Dekh liya" dono jawab par likhte hain — "Abhi nahi" par bhi.
   *
   * Warna app har baar khulne par yahi poochta rehta, aur user ko lagta ki
   * "Abhi nahi" ka koi asar hi nahi hua. Lock ab bhi Settings me hamesha
   * maujood hai — raasta band nahi hota, sirf sawaal band hota hai.
   */
  async function remember() {
    if (!uid) return;
    await AsyncStorage.setItem(`${SEEN_PREFIX}${uid}`, "1").catch(() => {});
  }

  async function yes() {
    await remember();
    setShow(false);
    router.push("/app-lock" as never);
  }

  async function no() {
    await remember();
    setShow(false);
  }

  if (!show) return null;

  return (
    <Modal statusBarTranslucent transparent animationType="fade" visible onRequestClose={() => void no()}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-closed" size={24} color={tc.terracotta} />
            </View>
            <Text style={styles.title}>{l.offerTitle}</Text>
            <Text style={styles.body}>{l.offerBody}</Text>

            <Pressable
              onPress={() => void yes()}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>{l.offerYes}</Text>
            </Pressable>
            <Pressable
              onPress={() => void no()}
              style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ghostText}>{l.offerNo}</Text>
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
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  title: { marginTop: 15, fontSize: 20, fontWeight: "800", color: c.ink, lineHeight: 27 },
  body: { marginTop: 9, fontSize: 14, lineHeight: 21, color: c.inkSoft },
  cta: {
    marginTop: 20,
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
