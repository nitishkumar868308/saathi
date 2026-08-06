import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay, ScreenLoader } from "@/components/loader";
import { resolveDocUri, type DocFile } from "@/lib/doc-cache";
import { saveDocumentToDevice } from "@/lib/save-to-device";
import { shareDocument } from "@/lib/share";
import { renewalFor, type RenewalGuide } from "@/lib/renewal";
import { useToast } from "@/components/toast";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";

export default function DocumentView() {
  const tc = useColors();
  const styles = useStyles();
  const { documents: d } = useT();
  const { locale } = useLocale();
  const toast = useToast();
  const { id, uri, path, mime, name, type } = useLocalSearchParams<{
    id?: string;
    uri?: string;
    path?: string;
    mime?: string;
    name?: string;
    type?: string;
  }>();
  const { width, height } = Dimensions.get("window");
  const [busy, setBusy] = useState<null | "share" | "save">(null);

  /**
   * Router se sab kuch string me aata hai — usse wahi minimum shape banate hain
   * jo file dhoondhne ke liye chahiye. `id` hi cache ki chaabi hai, isliye wo
   * sabse zaroori param hai.
   */
  const doc: DocFile = {
    id: id ?? "",
    file_uri: uri || null,
    file_path: path || null,
    mime_type: mime || null,
  };

  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // ⚠️ Yahan pehle sirf `uri` param dekha jaata tha aur na hone par signed URL
    // banaya jaata tha — yaani offline me screen hamesha khaali rehti thi, aur
    // naye phone par to kabhi kuch dikhta hi nahi tha (`file_uri` us purane
    // phone ka rasta hota hai). Ab `resolveDocUri` pehle offline cache dekhta
    // hai, phir isi phone ki file, aur aakhir me cloud.
    resolveDocUri(doc)
      .then((u) => alive && setResolved(u))
      .catch(() => alive && setResolved(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, uri, path, mime]);

  async function onShare() {
    if (busy) return;
    setBusy("share");
    try {
      const ok = await shareDocument({ ...doc, name: name || "Document" });
      if (!ok) toast.show(d.shareFailed, "error");
    } catch {
      toast.show(d.shareFailed, "error");
    } finally {
      setBusy(null);
    }
  }

  /**
   * "Renew kaise karein" — expiry ke baad ka asli sawaal.
   *
   * Ye guide server se aata hai aur offline cache hota hai, kyunki sarkari link
   * aur process badalte rehte hain — code me hardcode karne ka matlab hota ki
   * wo kabhi update hi na hon.
   */
  const [guide, setGuide] = useState<RenewalGuide | null>(null);
  /**
   * Guide dhoondhna khatam ho gaya (mila ho ya na mila ho).
   *
   * ⚠️ Iske bina "abhi dhoondh rahe hain" aur "hai hi nahi" ek jaise dikhte
   * the — dono me `guide === null` hota hai. Isliye pehle jab kisi doc_type ka
   * guide nahi hota tha, us document par renewal ka poora hissa CHUP-CHAAP
   * gayab ho jaata tha. User ko expiry ka alert milta tha, wo document kholta
   * tha, aur "ab karun kya?" ka koi jawab hi nahi milta — na guide, na ye baat
   * ki jawab abhi banaya ja raha hai. Ab wo saaf likha jaata hai.
   */
  const [guideLoaded, setGuideLoaded] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    let alive = true;
    setGuideLoaded(false);
    void renewalFor(type || "other", locale).then((g) => {
      if (!alive) return;
      setGuide(g);
      setGuideLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [type, locale]);

  async function onSave() {
    if (busy) return;
    setBusy("save");
    try {
      const res = await saveDocumentToDevice(doc);
      if (res === "saved") toast.show(d.savedToDevice, "success");
      else if (res === "denied") toast.show(d.saveNeedsPermission, "info");
      else if (res === "nofile") toast.show(d.noFileSaved, "error");
      // "failed" me aksar purana build hota hai — user ko Share ka raasta
      // batana hi sabse kaam ka jawab hai.
      else toast.show(d.saveFailedUseShare, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={tc.ink} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {name || "Document"}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ScreenLoader />
        ) : resolved ? (
          <Image
            source={{ uri: resolved }}
            style={{ width: width - 32, height: height * 0.45 }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={tc.inkSoft} />
            <Text style={styles.emptyText}>{d.noFileSaved}</Text>
          </View>
        )}

        {/**
         * Is document type ka guide abhi bana hi nahi — "jald aa raha hai".
         *
         * ⚠️ Pehle yahan kuch bhi nahi tha: guide na hone par renewal ka poora
         * hissa chup-chaap gayab ho jaata tha. User ko expiry ka alert milta,
         * wo document kholta, aur "ab karun kya?" ka jawab kahin nahi hota —
         * na guide, na ye baat ki jawab banaya ja raha hai. Use lagta tha app
         * adhoori hai. Saaf keh dena hamesha behtar hai.
         *
         * `guideLoaded` ki shart zaroori hai, warna load hone tak har document
         * par ek pal ke liye "coming soon" chamak jaata.
         */}
        {guideLoaded && !guide && (
          <View style={styles.renewCard}>
            <View style={styles.renewHead}>
              <View style={styles.renewIcon}>
                <Ionicons name="time-outline" size={17} color={tc.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.renewTitle}>{d.renewSoonTitle}</Text>
              </View>
            </View>
            <Text style={styles.renewSoonBody}>{d.renewSoonBody}</Text>
          </View>
        )}

        {/* Renew kaise karein — document dikhne ke theek neeche, kyunki expiry
            dekhne ke baad ka pehla sawaal yahi hota hai. */}
        {!!guide && (
          <View style={styles.renewCard}>
            <View style={styles.renewHead}>
              <View style={styles.renewIcon}>
                <Ionicons name="refresh" size={17} color={tc.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.renewTitle}>{guide.text.title}</Text>
                {!!guide.authority && (
                  <Text style={styles.renewAuthority}>{guide.authority}</Text>
                )}
              </View>
            </View>

            {/* Link ho to sabse upar — wahi sabse chhota raasta hai. */}
            {!!guide.url && (
              <Pressable
                onPress={() => Linking.openURL(guide.url as string).catch(() => {})}
                style={({ pressed }) => [styles.renewLink, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="open-outline" size={17} color={tc.white} />
                <Text style={styles.renewLinkText}>{d.renewOpenSite}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setShowSteps((v) => !v)}
              style={styles.renewToggle}
            >
              <Text style={styles.renewToggleText}>
                {showSteps ? d.renewHideSteps : d.renewShowSteps}
              </Text>
              <Ionicons
                name={showSteps ? "chevron-up" : "chevron-down"}
                size={16}
                color={tc.terracotta}
              />
            </Pressable>

            {showSteps && (
              <View style={styles.steps}>
                {guide.text.steps.map((s, i) => (
                  <View key={i} style={styles.step}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{s}</Text>
                  </View>
                ))}

                {!!guide.text.note && (
                  <View style={styles.note}>
                    <Ionicons name="bulb-outline" size={15} color={tc.amber} />
                    <Text style={styles.noteText}>{guide.text.note}</Text>
                  </View>
                )}

                {/*
                 * ⚠️ Ye line jaan-boojh ke dikhti hai. Do soorat me ye zaroori
                 * hai: (a) guide AI ne banaya hai aur kisi insaan ne jaancha
                 * nahi, ya (b) guide "har desh" wala aam jawab hai, user ke
                 * apne desh ka nahi. Dono me jaankari kaam ki hai par aakhri
                 * sach nahi — aur sarkari process me galat salah se user ka
                 * waqt aur paisa dono jaata hai. Isse chhupana galat hoga.
                 */}
                {(!guide.reviewed || guide.country === "*") && (
                  <Text style={styles.verifyNote}>{d.renewVerifyNote}</Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Download aur Share — dono tabhi jab file sach me mil chuki ho. */}
      {!loading && !!resolved && (
        <View style={styles.actions}>
          <Pressable
            onPress={onSave}
            disabled={!!busy}
            style={({ pressed }) => [styles.btn, (pressed || !!busy) && { opacity: 0.85 }]}
          >
            <Ionicons name="download-outline" size={19} color={tc.white} />
            <Text style={styles.btnText}>{d.download}</Text>
          </Pressable>
          <Pressable
            onPress={onShare}
            disabled={!!busy}
            style={({ pressed }) => [styles.btnAlt, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="share-outline" size={19} color={tc.ink} />
            <Text style={styles.btnAltText}>{d.share}</Text>
          </Pressable>
        </View>
      )}

      <LoaderOverlay visible={!!busy} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
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
    color: c.ink,
  },
  body: { alignItems: "center", padding: 16, paddingBottom: 8, gap: 16 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 15, color: c.inkSoft, textAlign: "center" },

  renewCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 16,
    gap: 12,
  },
  renewHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  renewIcon: {
    height: 38,
    width: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  renewTitle: { fontSize: 15.5, fontWeight: "700", color: c.ink },
  renewAuthority: { marginTop: 2, fontSize: 12.5, color: c.inkSoft },
  renewSoonBody: { marginTop: 12, fontSize: 13.5, lineHeight: 20, color: c.inkSoft },
  renewLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: c.terracotta,
  },
  renewLinkText: { fontSize: 14.5, fontWeight: "800", color: c.white },
  renewToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  renewToggleText: { fontSize: 13.5, fontWeight: "700", color: c.terracotta },
  steps: { gap: 11 },
  step: { flexDirection: "row", gap: 10 },
  stepNum: {
    height: 22,
    width: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.creamDeep,
  },
  stepNumText: { fontSize: 11.5, fontWeight: "800", color: c.inkSoft },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21, color: c.ink },
  note: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "rgba(224,164,88,0.12)",
    padding: 12,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 20, color: c.ink },
  verifyNote: {
    fontSize: 12,
    lineHeight: 18,
    color: c.inkSoft,
    fontStyle: "italic",
  },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.terracotta,
  },
  btnText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  btnAlt: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  btnAltText: { fontSize: 15.5, fontWeight: "700", color: c.ink },
}));
