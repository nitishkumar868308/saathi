import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";
import { LoaderOverlay, ScreenLoader } from "@/components/loader";
import { signedUrl } from "@/lib/storage";
import { shareDocument } from "@/lib/share";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";

export default function DocumentView() {
  const { documents: d } = useT();
  const toast = useToast();
  const { uri, path, name } = useLocalSearchParams<{
    uri?: string;
    path?: string;
    name?: string;
  }>();
  const { width, height } = Dimensions.get("window");
  const [sharing, setSharing] = useState(false);

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const ok = await shareDocument({
        name: name || "Document",
        file_uri: uri || null,
        file_path: path || null,
      });
      if (!ok) toast.show(d.shareFailed, "error");
    } catch {
      toast.show(d.shareFailed, "error");
    } finally {
      setSharing(false);
    }
  }

  // Local uri sabse fast; na ho to private storage se signed URL.
  const [resolved, setResolved] = useState<string | null>(uri || null);
  const [loading, setLoading] = useState(!uri && !!path);

  useEffect(() => {
    let alive = true;
    if (!uri && path) {
      signedUrl("documents", path)
        .then((u) => alive && setResolved(u))
        .finally(() => alive && setLoading(false));
    }
    return () => {
      alive = false;
    };
  }, [uri, path]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {name || "Document"}
        </Text>
        <Pressable onPress={onShare} hitSlop={10} style={styles.back} disabled={sharing}>
          <Ionicons name="share-outline" size={21} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.body}>
        {loading ? (
          <ScreenLoader />
        ) : resolved ? (
          <Image
            source={{ uri: resolved }}
            style={{ width: width - 32, height: height * 0.72 }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={colors.inkSoft} />
            <Text style={styles.emptyText}>{d.noFileSaved}</Text>
          </View>
        )}
      </View>

      {/* Share ban raha hai. */}
      <LoaderOverlay visible={sharing} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  empty: { alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15, color: colors.inkSoft, textAlign: "center" },
});
