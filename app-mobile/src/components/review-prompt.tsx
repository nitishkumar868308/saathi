import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { Loader } from "@/components/loader";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/components/auth-provider";
import {
  shouldShowReview,
  submitReview,
  snoozeReview,
  markReviewDone,
  markFirstOpen,
  PLAY_STORE_URL,
} from "@/lib/reviews";
import { logEvent } from "@/lib/analytics";

/**
 * 1 hafte baad ek baar rating/review popup (#9). Root me mount hai. Session ho
 * tabhi check karta hai. Submit pe DB me save + Play Store nudge.
 */
export function ReviewPrompt() {
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
    (async () => {
      await markFirstOpen();
      // App khulte hi turant nahi — thoda ruk ke, taaki dakhal na lage.
      setTimeout(async () => {
        if (alive && (await shouldShowReview())) setVisible(true);
      }, 2500);
    })();
    return () => {
      alive = false;
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
    <Modal transparent animationType="fade" visible onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {thanks ? (
            <>
              <Text style={styles.heart}>❤️</Text>
              <Text style={styles.thanksTitle}>{r.thanksTitle}</Text>
              <Text style={styles.thanksSub}>{r.thanksSub}</Text>
              <Pressable onPress={onRate} style={styles.primary}>
                <Ionicons name="star" size={18} color={colors.white} />
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
                      color={n <= rating ? colors.amber : colors.inkSoft}
                    />
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={r.placeholder}
                placeholderTextColor={colors.inkSoft}
                style={styles.input}
                multiline
              />

              <Pressable style={styles.consentRow} onPress={() => setAllow((v) => !v)}>
                <View style={[styles.box, allow && styles.boxOn]}>
                  {allow && <Ionicons name="checkmark" size={14} color={colors.white} />}
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
                {saving ? (
                  <Loader size={30} color={colors.white} />
                ) : (
                  <Text style={styles.primaryText}>{r.submit}</Text>
                )}
              </Pressable>
              <Pressable onPress={onLater} style={styles.laterBtn}>
                <Text style={styles.laterText}>{r.later}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: "center",
  },
  title: { fontSize: 21, fontWeight: "800", color: colors.ink, textAlign: "center" },
  sub: {
    marginTop: 6,
    fontSize: 14,
    color: colors.inkSoft,
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
    borderColor: colors.line,
    backgroundColor: colors.cream,
    padding: 14,
    color: colors.ink,
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
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  consentText: { flex: 1, fontSize: 12.5, color: colors.inkSoft, lineHeight: 17 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.terracotta,
    marginTop: 18,
  },
  primaryText: { fontSize: 16, fontWeight: "800", color: colors.white },
  laterBtn: { marginTop: 12, paddingVertical: 6 },
  laterText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  heart: { fontSize: 46 },
  thanksTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  thanksSub: {
    marginTop: 8,
    fontSize: 14.5,
    color: colors.inkSoft,
    textAlign: "center",
    lineHeight: 21,
  },
});
