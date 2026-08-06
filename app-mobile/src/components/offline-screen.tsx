import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Modal,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { Loader } from "@/components/loader";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/components/auth-provider";
import { isReachable } from "@/lib/network";
import { readCachedDocs, resolveDocUri } from "@/lib/doc-cache";
import { saveDocumentToDevice } from "@/lib/save-to-device";
import { shareDocument } from "@/lib/share";
import { iconForType } from "@/theme/status";
import type { Document } from "@/lib/documents";

/**
 * Net nahi hai — poori app ki jagah SIRF ye screen.
 *
 * ⚠️ Soch ye hai ki aadhi-adhoori chalti hui app sabse bura anubhav hai. Offline
 * me app ka lagbhag kuch bhi kaam nahi karta: reminder save nahi hota, AI jawab
 * nahi deta, list refresh nahi hoti, upgrade nahi khulta. Phir bhi saari screens
 * khuli rehti thi — user tap karta rehta, har jagah ek alag error milta, aur use
 * lagta ki app hi tooti hui hai. Wo bharosa wapas nahi aata.
 *
 * Isliye ab ek hi saaf baat: "internet nahi hai", aur uske saath wahi EK cheez
 * jo sach me bina net ke chalti hai — pehle se save kiye hue documents. Unhe
 * dekha, download aur share kiya ja sakta hai, kyunki file phone par hi padi hai
 * (`doc-cache`), server par nahi.
 *
 * ⚠️ Document ki file `resolveDocUri` se aati hai — wo pehle offline cache
 * dekhta hai. Jis document ki file cache me nahi hai (user ne use kabhi khola hi
 * nahi), uspar hum saaf keh dete hain; chup-chaap khaali screen dikhana sabse
 * uljhan wali baat hoti.
 */
export function OfflineScreen() {
  const tc = useColors();
  const styles = useStyles();
  const toast = useToast();
  const { network: t, documents: d } = useT();
  const { session } = useAuth();
  const uid = session?.user?.id;
  const { width, height } = useWindowDimensions();

  const [docs, setDocs] = useState<Document[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** Khula hua document — apna chhota viewer (router yahan chalta hi nahi). */
  const [viewing, setViewing] = useState<{ doc: Document; uri: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const list = uid ? await readCachedDocs(uid) : null;
      if (alive) setDocs(list ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  /**
   * "Dobara jaancho".
   *
   * Ye khud kuch nahi badalta — `useNetworkStatus` apne probe se offline flag
   * hatata hai aur screen apne aap chali jaati hai. Button ka kaam sirf ek
   * turant probe chalana hai, taaki user ko 5 second wale agle cycle ka
   * intezaar na karna pade.
   */
  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      await isReachable();
    } finally {
      setChecking(false);
    }
  }, []);

  async function open(doc: Document) {
    if (busy) return;
    setBusy(doc.id);
    try {
      const uri = await resolveDocUri(doc);
      if (!uri) return toast.show(t.offNoFile, "info");
      setViewing({ doc, uri });
    } finally {
      setBusy(null);
    }
  }

  async function download(doc: Document) {
    if (busy) return;
    setBusy(doc.id);
    try {
      const res = await saveDocumentToDevice(doc);
      if (res === "saved") toast.show(d.savedToDevice, "success");
      else if (res === "denied") toast.show(d.saveNeedsPermission, "info");
      else if (res === "nofile") toast.show(t.offNoFile, "info");
      else toast.show(d.saveFailedUseShare, "error");
    } finally {
      setBusy(null);
    }
  }

  async function share(doc: Document) {
    if (busy) return;
    setBusy(doc.id);
    try {
      const ok = await shareDocument({ ...doc, name: doc.name });
      if (!ok) toast.show(t.offNoFile, "info");
    } catch {
      toast.show(d.shareFailed, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="cloud-offline-outline" size={30} color={tc.terracotta} />
          </View>
          <Text style={styles.title}>{t.offTitle}</Text>
          <Text style={styles.body}>{t.offBody}</Text>
          <Pressable
            onPress={() => void recheck()}
            disabled={checking}
            style={({ pressed }) => [styles.retry, pressed && { opacity: 0.85 }]}
          >
            {checking ? (
              <Loader size={18} />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color={tc.terracotta} />
                <Text style={styles.retryText}>{t.offRetry}</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.section}>{t.offDocsTitle}</Text>

        {docs === null ? (
          <View style={styles.center}>
            <Loader size={40} />
          </View>
        ) : docs.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={t.offEmpty}
            body={t.offEmptyBody}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {docs.map((doc) => (
              <View key={doc.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardIcon}>
                    <Ionicons
                      // `iconForType` `string` lautata hai (map se), isliye
                      // cast — baaki app me bhi yahi idiom hai.
                      name={iconForType(doc.type) as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={tc.terracotta}
                    />
                  </View>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {doc.name}
                  </Text>
                  {busy === doc.id && <Loader size={18} />}
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void open(doc)}
                    style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="eye-outline" size={16} color={tc.terracotta} />
                    <Text style={styles.actionText}>{t.offView}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void download(doc)}
                    style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="download-outline" size={16} color={tc.terracotta} />
                    <Text style={styles.actionText}>{t.offDownload}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void share(doc)}
                    style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="share-social-outline" size={16} color={tc.terracotta} />
                    <Text style={styles.actionText}>{t.offShare}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Apna chhota viewer — `/document-view` route is screen ke peeche band
          pada hai, isliye router se kholna yahan kaam nahi karta. */}
      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.viewerBackdrop}>
          <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
            <View style={styles.viewerHead}>
              <Text style={styles.viewerName} numberOfLines={1}>
                {viewing?.doc.name}
              </Text>
              <Pressable onPress={() => setViewing(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color={tc.onInk} />
              </Pressable>
            </View>
            {!!viewing && (
              <Image
                source={{ uri: viewing.uri }}
                style={{ width: width - 24, height: height * 0.7, alignSelf: "center" }}
                resizeMode="contain"
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: { padding: 20, paddingBottom: 40, ...CONTENT },
  hero: { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  heroIcon: {
    height: 68,
    width: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  title: { marginTop: 16, fontSize: 22, fontWeight: "800", color: c.ink, textAlign: "center" },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: c.inkSoft,
    textAlign: "center",
    maxWidth: 340,
  },
  retry: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minWidth: 150,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.32)",
    backgroundColor: "rgba(194,90,55,0.07)",
  },
  retryText: { fontSize: 14, fontWeight: "700", color: c.terracotta },
  section: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 12.5,
    fontWeight: "800",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  center: { alignItems: "center", paddingVertical: 40 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 14,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  cardIcon: {
    height: 38,
    width: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  cardName: { flex: 1, fontSize: 15, fontWeight: "700", color: c.ink },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
  },
  actionText: { fontSize: 12.5, fontWeight: "700", color: c.terracotta },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(8,6,5,0.94)" },
  viewerHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  viewerName: { flex: 1, fontSize: 15.5, fontWeight: "700", color: c.onInk },
}));

export default OfflineScreen;
