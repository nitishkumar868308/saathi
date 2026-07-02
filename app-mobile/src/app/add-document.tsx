import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { colors } from "@/theme/colors";
import { addDocument } from "@/lib/documents";
import { ocrImage } from "@/lib/ocr";
import { dateAfterMonths, isValidDate } from "@/utils/expiry";
import { extractExpiry } from "@/utils/extract-expiry";
import { detectDocType, guessName } from "@/utils/detect-doc";
import { iconForType, labelForType } from "@/theme/status";
import { useToast } from "@/components/toast";

const quick = [
  { label: "+6 mahine", months: 6 },
  { label: "+1 saal", months: 12 },
  { label: "+2 saal", months: 24 },
  { label: "+3 saal", months: 36 },
];

export default function AddDocument() {
  const router = useRouter();
  const toast = useToast();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [type, setType] = useState("other");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  async function pickImage(source: "camera" | "gallery") {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        base64: true,
        quality: 0.4,
        allowsEditing: true,
      };
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast.show("Camera permission chahiye", "info");
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      setImageUri(asset.uri);
      if (!asset.base64) return;

      setScanning(true);
      try {
        const text = await ocrImage(asset.base64);
        const det = detectDocType(text);
        const exp = extractExpiry(text);
        const nm = det.name !== "Document" ? det.name : guessName(text);

        setType(det.type);
        if (nm) setName(nm);
        if (exp) setExpiry(exp);
        setScanned(true);

        const bits: string[] = [];
        if (nm) bits.push(nm);
        if (exp) bits.push("expiry mil gayi");
        toast.show(
          bits.length ? `Padh liya: ${bits.join(" · ")} ✨` : "Padha, par saaf nahi — details khud daal do",
          bits.length ? "success" : "info",
        );
      } catch {
        toast.show("Photo padhne mein dikkat — details khud daal do", "error");
      } finally {
        setScanning(false);
      }
    } catch {
      toast.show("Image select nahi hui", "error");
    }
  }

  async function save() {
    if (saving) return;
    if (!name.trim()) return toast.show("Naam daalo (ya photo scan karo)", "info");
    if (expiry && !isValidDate(expiry)) {
      return toast.show("Date format: YYYY-MM-DD", "error");
    }
    try {
      setSaving(true);
      await addDocument({ name: name.trim(), type, expiry: expiry || null });
      toast.show("Document add ho gaya 🎉", "success");
      router.back();
    } catch {
      toast.show("Save nahi ho paya", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Document add karo</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo scan — primary */}
          <View style={styles.scanBox}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.scanIcon}>
                <Ionicons name="scan" size={30} color={colors.terracotta} />
              </View>
            )}

            {scanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color={colors.terracotta} />
                <Text style={styles.scanningText}>Samajh raha hoon...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.scanTitle}>
                  {scanned ? "Ho gaya! Neeche check karo ✨" : "Photo daalo"}
                </Text>
                <Text style={styles.scanSub}>
                  {scanned
                    ? "Saathi ne document khud samajh liya"
                    : "Document ki photo daalo — kaunsa hai aur kab expire hai, Saathi khud samajh lega"}
                </Text>
              </>
            )}

            <View style={styles.scanBtns}>
              <Pressable
                onPress={() => pickImage("camera")}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtn, pressed && styles.pressed]}
              >
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={styles.sBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                onPress={() => pickImage("gallery")}
                disabled={scanning}
                style={({ pressed }) => [styles.sBtnAlt, pressed && styles.pressed]}
              >
                <Ionicons name="images" size={18} color={colors.terracotta} />
                <Text style={styles.sBtnAltText}>Gallery</Text>
              </Pressable>
            </View>
          </View>

          {/* Detected type (read-only) */}
          {scanned && (
            <View style={styles.detected}>
              <View style={styles.detIcon}>
                <Ionicons name={iconForType(type) as any} size={20} color={colors.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detLabel}>Saathi ke hisaab se</Text>
                <Text style={styles.detType}>{labelForType(type)}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={colors.sage} />
            </View>
          )}

          {/* Name (editable) */}
          <Text style={styles.label}>Naam {scanned && <Text style={styles.editHint}>(theek kar sakte ho)</Text>}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Photo scan karo, ya naam khud daalo"
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, scanned && name ? styles.inputFilled : null]}
          />

          {/* Expiry (editable) */}
          <Text style={styles.label}>Expiry date</Text>
          <TextInput
            value={expiry}
            onChangeText={setExpiry}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, scanned && expiry ? styles.inputFilled : null]}
            keyboardType="numbers-and-punctuation"
          />
          <View style={styles.quickRow}>
            {quick.map((q) => (
              <Pressable
                key={q.label}
                onPress={() => setExpiry(dateAfterMonths(q.months))}
                style={styles.quickChip}
              >
                <Text style={styles.quickText}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => [styles.save, (pressed || saving) && { opacity: 0.85 }]}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveText}>Save karo</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    ...CONTENT,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  close: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  content: { padding: 20, paddingBottom: 20, ...CONTENT },
  scanBox: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  scanIcon: {
    height: 60,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  preview: {
    height: 120,
    width: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scanningRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  scanningText: { fontSize: 14, fontWeight: "600", color: colors.terracotta },
  scanTitle: { marginTop: 12, fontSize: 17, fontWeight: "700", color: colors.ink },
  scanSub: {
    marginTop: 3,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  scanBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  sBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    backgroundColor: colors.terracotta,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sBtnText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  sBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.terracotta,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  sBtnAltText: { color: colors.terracotta, fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.8 },
  detected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.sage,
    backgroundColor: "rgba(124,138,107,0.08)",
    padding: 14,
  },
  detIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  detLabel: { fontSize: 12, color: colors.inkSoft, fontWeight: "600" },
  detType: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 1 },
  label: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  editHint: { fontSize: 12, fontWeight: "500", color: colors.inkSoft },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15,
  },
  inputFilled: { borderColor: colors.sage, backgroundColor: "rgba(124,138,107,0.08)" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickText: { fontSize: 13, fontWeight: "600", color: colors.terracotta },
  save: {
    margin: 20,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
    ...CONTENT,
  },
  saveText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
