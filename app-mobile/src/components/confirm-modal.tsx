import { useEffect, useRef } from "react";
import { View, Text, Pressable, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";

/**
 * App ka apna confirm modal — OS ke bhadde native Alert ki jagah.
 * Branded, animated, do saaf buttons. Delete/confirm jaise kaamo ke liye.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  icon = "help-circle",
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tc = useColors();
  const styles = useStyles();
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.92);
    Animated.timing(scale, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [visible, scale]);

  const accent = destructive ? tc.danger : tc.terracotta;

  return (
    <Modal statusBarTranslucent transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Animated.View style={{ transform: [{ scale }], width: "100%", maxWidth: 360 }}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.iconWrap, { backgroundColor: destructive ? "rgba(178,59,59,0.12)" : "rgba(194,90,55,0.12)" }]}>
              <Ionicons name={icon} size={26} color={accent} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
            <View style={styles.btnRow}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [styles.btnAlt, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.btnAltText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => [styles.btn, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.btnText}>{confirmLabel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    alignItems: "center",
    borderRadius: 26,
    backgroundColor: c.surface,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  iconWrap: {
    height: 60,
    width: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 16,
    fontSize: 19,
    fontWeight: "800",
    color: c.ink,
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontSize: 14.5,
    lineHeight: 21,
    color: c.inkSoft,
    textAlign: "center",
  },
  btnRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 24 },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 15,
  },
  btnText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  btnAlt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  btnAltText: { fontSize: 15, fontWeight: "700", color: c.inkSoft },
}));

export default ConfirmModal;
