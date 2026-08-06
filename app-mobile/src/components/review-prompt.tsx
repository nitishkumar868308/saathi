import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/components/auth-provider";
import {
  shouldShowReview,
  submitReview,
  snoozeReview,
  markReviewDone,
  markFirstOpen,
  onMilestone,
  PLAY_STORE_URL,
} from "@/lib/reviews";
import { logEvent } from "@/lib/analytics";

/**
 * Rating/review popup — root me mount, session ho tabhi chalta hai.
 *
 * Do mauke par poochta hai (item 4):
 *   1. Jab user register ke baad pehla document AUR pehla reminder dono bana
 *      le — yahi wo lamha hai jab usne app ko kaam karte dekha hai.
 *   2. Warna 1 hafte baad.
 *
 * Ek baar submit/dismiss ke baad dobara nahi. "Baad me" par 2 din ka aaram.
 */
export function ReviewPrompt() {
  const tc = useColors();
  const styles = useStyles();
  const { review: r } = useT();
  const { session } = useAuth();
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [allow, setAllow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    let alive = true;

    const check = async (delay: number) => {
      // Turant nahi — thoda ruk ke, taaki dakhal na lage. Reminder banne ke
      // baad wala toast/permission modal pehle nikal jaana chahiye.
      setTimeout(async () => {
        if (alive && (await shouldShowReview())) setVisible(true);
      }, delay);
    };

    (async () => {
      await markFirstOpen();
      await check(2500);
    })();

    // Padav abhi-abhi pura hua (document + reminder dono) — usi waqt poochho,
    // agli launch ka intezaar nahi.
    const off = onMilestone(() => void check(1800));

    return () => {
      alive = false;
      off();
    };
  }, [session?.user?.id]);

  async function onSubmit() {
    if (rating === 0 || saving) return;
    setSaving(true);
    try {
      await submitReview({ rating, text, allowDisplay: allow });
      logEvent("review_submitted", { rating, allow_display: allow });
      await markReviewDone();
      setThanks(true);
    } finally {
      setSaving(false);
    }
  }

  async function onLater() {
    await snoozeReview();
    setVisible(false);
  }

  async function onRate() {
    Linking.openURL(PLAY_STORE_URL).catch(() => {});
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Modal statusBarTranslucent transparent animationType="fade" visible onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {thanks ? (
            <>
              <Text style={styles.heart}>❤️</Text>
              <Text style={styles.thanksTitle}>{r.thanksTitle}</Text>
              <Text style={styles.thanksSub}>{r.thanksSub}</Text>
              <Pressable onPress={onRate} style={styles.primary}>
                <Ionicons name="star" size={18} color={tc.white} />
                <Text style={styles.primaryText}>{r.rateBtn}</Text>
              </Pressable>
              <Pressable onPress={() => setVisible(false)} style={styles.laterBtn}>
                <Text style={styles.laterText}>{r.later}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.sub}>{r.sub}</Text>

              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <Ionicons
                      name={n <= rating ? "star" : "star-outline"}
                      size={38}
                      color={n <= rating ? tc.amber : tc.inkSoft}
                    />
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={r.placeholder}
                placeholderTextColor={tc.inkSoft}
                style={styles.input}
                multiline
              />

              <Pressable style={styles.consentRow} onPress={() => setAllow((v) => !v)}>
                <View style={[styles.box, allow && styles.boxOn]}>
                  {allow && <Ionicons name="checkmark" size={14} color={tc.white} />}
                </View>
                <Text style={styles.consentText}>{r.consent}</Text>
              </Pressable>

              <Pressable
                onPress={onSubmit}
                disabled={rating === 0 || saving}
                style={({ pressed }) => [
                  styles.primary,
                  (pressed || rating === 0 || saving) && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.primaryText}>{r.submit}</Text>
              </Pressable>
              <Pressable onPress={onLater} style={styles.laterBtn}>
                <Text style={styles.laterText}>{r.later}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <LoaderOverlay visible={saving} />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    backgroundColor: c.surface,
    padding: 24,
    alignItems: "center",
  },
  title: { fontSize: 21, fontWeight: "800", color: c.ink, textAlign: "center" },
  sub: {
    marginTop: 6,
    fontSize: 14,
    color: c.inkSoft,
    textAlign: "center",
    lineHeight: 20,
  },
  stars: { flexDirection: "row", gap: 8, marginTop: 18, marginBottom: 6 },
  input: {
    alignSelf: "stretch",
    minHeight: 74,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    padding: 14,
    color: c.ink,
    fontSize: 15,
    textAlignVertical: "top",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 14,
  },
  box: {
    height: 22,
    width: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  consentText: { flex: 1, fontSize: 12.5, color: c.inkSoft, lineHeight: 17 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    height: 52,
    borderRadius: 16,
    backgroundColor: c.terracotta,
    marginTop: 18,
  },
  primaryText: { fontSize: 16, fontWeight: "800", color: c.white },
  laterBtn: { marginTop: 12, paddingVertical: 6 },
  laterText: { fontSize: 14, fontWeight: "600", color: c.inkSoft },
  heart: { fontSize: 46 },
  thanksTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
    color: c.ink,
    textAlign: "center",
  },
  thanksSub: {
    marginTop: 8,
    fontSize: 14.5,
    color: c.inkSoft,
    textAlign: "center",
    lineHeight: 21,
  },
}));
