import { View, Text, Image, Pressable, StyleSheet, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";

export default function DocumentView() {
  const { uri, name } = useLocalSearchParams<{ uri?: string; name?: string }>();
  const { width, height } = Dimensions.get("window");
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {name || "Document"}
        </Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.body}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: width - 32, height: height * 0.72 }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={colors.inkSoft} />
            <Text style={styles.emptyText}>Is document ki file save nahi hai.</Text>
          </View>
        )}
      </View>
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
