import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { makeStyles, useColors } from "@/theme/theme";
import { ImageViewer } from "@/components/image-viewer";
import { LoaderOverlay, ScreenLoader } from "@/components/loader";
import { resolveDocUri, type DocFile } from "@/lib/doc-cache";
import { listVersions, versionDocFile, type DocVersion } from "@/lib/doc-versions";
import { getDocument, type Document } from "@/lib/documents";
import { useDataChanged } from "@/lib/data-events";
import { formatDate, toIsoDate } from "@/utils/date-format";
import { tpl } from "@/lib/i18n/dictionaries";
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
  const { id, uri, path, mime, name, type, expiry } = useLocalSearchParams<{
    id?: string;
    uri?: string;
    path?: string;
    mime?: string;
    name?: string;
    type?: string;
    /**
     * ⚠️ `expiry` yahan sirf ye tay karne ke liye hai ki renew wale button par
     * kya likha jaaye — "nayi expiry daalo" ya "expiry add karo". Asli document
     * `document-renew` khud DB/cache se padhta hai, isliye ye param purana ho
     * jaye to bhi kuch galat save nahi ho sakta.
     */
    expiry?: string;
  }>();
  /**
   * ⚠️ `useWindowDimensions` — `Dimensions.get()` nahi.
   *
   * `Dimensions.get()` ek baar padhta hai aur phir kabhi nahi badalta. Poori app
   * me har jagah `useWindowDimensions` hai; sirf yahi screen chhoot gayi thi, aur
   * yahan uska asar sabse zyada dikhta hai kyunki document ki image ki naap
   * seedhe isi se banti hai.
   *
   * Jo tootta tha: phone ghumate hi (ya foldable kholte hi, ya split-screen me)
   * image purani naap par chipki reh jaati thi — landscape me screen se bahar
   * nikal jaati, aur tablet par aadhi screen khaali chhod deti. User ko lagta ki
   * document theek se scan hi nahi hua.
   */
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState<null | "share" | "save">(null);

  /**
   * DB/cache se aayi taaza row — router ke params se HAMESHA upar.
   *
   * ⚠️ Iske bina renew ke baad ye screen jhooth bolti thi. Params us waqt jam
   * jaate hain jab user list se yahan aaya tha, aur `document-renew` unhe chhoo
   * hi nahi sakta — wo bas `router.back()` karta hai. Nateeja bilkul wahi tha jo
   * sabse zyada chubhta hai: user ne abhi-abhi nayi photo aur nayi date daali,
   * "ho gaya" dekha, wapas aaya — aur yahan purani photo, purani date, aur
   * button par ab bhi "Expiry date add karo" likha mila. Uske liye iska ek hi
   * matlab hai: "app ne kuch save hi nahi kiya."
   *
   * `null` = abhi padha nahi (ya mila nahi) — tab params hi sahi hain, kyunki wo
   * kam se kam list wala sach to hain.
   */
  const [fresh, setFresh] = useState<Document | null>(null);

  /**
   * Router se sab kuch string me aata hai — usse wahi minimum shape banate hain
   * jo file dhoondhne ke liye chahiye. `id` hi cache ki chaabi hai, isliye wo
   * sabse zaroori param hai.
   *
   * ⚠️ Taaza row mile to POORI wahi chalti hai, mila-jula nahi. `fresh?.x ?? param`
   * likhna yahan ek chupa hua bug hota: renew me photo hata di jaye to `file_path`
   * sach me `null` hota hai, aur `??` use "khaali" maan ke purana param wapas le
   * aata — yaani hataayi hui photo phir se dikhne lagti.
   */
  const doc: DocFile = fresh
    ? {
        id: fresh.id,
        file_uri: fresh.file_uri,
        file_path: fresh.file_path,
        mime_type: fresh.mime_type,
      }
    : {
        id: id ?? "",
        file_uri: uri || null,
        file_path: path || null,
        mime_type: mime || null,
      };

  /** Jo screen dikhati hai — taaza row se, warna params se. */
  const docName = fresh?.name || name || "Document";
  const docType = fresh?.type || type || "other";
  const docExpiry = fresh ? fresh.expiry : expiry || null;

  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Poori screen wala viewer — kaunsi photo khuli hai.
   *
   * ⚠️ Ek hi state, current aur purane version dono ke liye. Do alag state
   * rakhne par dono ek saath khul sakte the (list me tap + upar wali photo par
   * tap), aur upar wala hamesha jeet jaata — user ne purana version maanga hota
   * aur use current dikhta.
   */
  const [zoom, setZoom] = useState<{ uri: string; title: string } | null>(null);

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
    // Taaza row ke file wale khaane badalte hi photo dobara dhoondhi jaati hai —
    // renew ke baad nayi file ka rasta hi alag hota hai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.file_uri, doc.file_path, doc.mime_type]);

  async function onShare() {
    if (busy) return;
    setBusy("share");
    try {
      const ok = await shareDocument({ ...doc, name: docName });
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
    void renewalFor(docType, locale).then((g) => {
      if (!alive) return;
      setGuide(g);
      setGuideLoaded(true);
    });
    return () => {
      alive = false;
    };
    // `docType` — param wala `type` nahi. Taaza row aane par guide bhi usi
    // hisaab se dobara aana chahiye.
  }, [docType, locale]);

  /* ------------------------- purane versions ------------------------- */

  /**
   * Renew se PEHLE wale document — photo aur us waqt ki expiry.
   *
   * ⚠️ Ye pehle bachte hi nahi the: renew nayi photo ko usi R2 key par chadha
   * deta tha, isliye purani hamesha ke liye mit jaati thi. Par purana document
   * renew ke baad bekaar nahi hota — purana passport visa ke record ke liye
   * maanga jaata hai, purani policy claim ke waqt chahiye hoti hai, aur "renew
   * se pehle wali date kya thi?" wo sawaal hai jo log har saal poochhte hain.
   *
   * Ab har renew ek version chhod jaata hai (`supabase/document-versions.sql`).
   */
  const [versions, setVersions] = useState<DocVersion[]>([]);
  /** Band hi rehta hai — ye upar wali cheez hai, asli document neeche nahi dabna chahiye. */
  const [showVersions, setShowVersions] = useState(false);
  /** Har version ki file ka rasta. `undefined` = abhi dhoondh rahe hain, `null` = nahi mili. */
  const [versionUris, setVersionUris] = useState<Record<string, string | null>>({});
  /** Kis version ki photo poori khuli hai (ek waqt me ek). */
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  /**
   * Taaza row + versions dobara padho.
   *
   * ⚠️ `useDataChanged` isi ke liye hai. `document-renew` save ke baad
   * `emitDataChanged()` chalata hai aur PHIR `router.back()` — aur ye screen us
   * waqt stack me mount hi rehti hai, isliye ye listener wahin chal jaata hai.
   * `useFocusEffect` par bharosa karna yahan kaafi nahi tha: renew ek alag
   * screen hai, par reminder/expiry ka alert MODAL hai jo kisi screen ko chhodta
   * hi nahi (poori wajah `lib/data-events.ts` ke upar likhi hai).
   *
   * ⚠️ `getDocument()` hai, `listDocuments()` NAHI. Dekhne me dono ek hi kaam
   * karte hain, par `listDocuments()` poori table utaarta hai, cache likhta hai,
   * saari files utarna shuru karta hai aur upload kataar bhi flush karta hai. Ye
   * listener har `emitDataChanged()` par jaagta hai — reminder save hone par bhi,
   * alert modal band hone par bhi — yaani wo poora sync ek aisi screen se chhidta
   * tha jise user us waqt dekh bhi nahi raha hota. Offline dono ek jaise hain:
   * `getDocument()` bhi fail par usi cache se padhta hai.
   */
  const reload = useCallback(() => {
    if (!id) return;
    void getDocument(id)
      .then(setFresh)
      .catch(() => {});
    void listVersions(id).then(setVersions);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useDataChanged(reload);

  /**
   * Photo tabhi utaaro jab user ne section khola ho.
   *
   * ⚠️ Ye jaan-boojh ke lazy hai. Purani versions R2 se aati hain (`file_uri`
   * unka hota hi nahi — wo is phone par kabhi thi hi nahi), yaani har ek ek
   * signed URL aur ek download hai. 5 saal purane passport wale user ke liye wo
   * screen kholte hi 5 bekaar download ban jaate — jabki wo aksar sirf current
   * document dekhne aaya hai.
   *
   * Ek-ek karke (`for` loop, saath-saath nahi): dheeme net par 5 saath ke
   * download poori screen ko atka dete hain, aur pehli photo bhi tab tak nahi
   * dikhti.
   */
  useEffect(() => {
    if (!showVersions || versions.length === 0) return;
    let alive = true;
    void (async () => {
      for (const v of versions) {
        if (!alive) return;
        // Ek baar dhoondh chuke (mili ya nahi mili) — dobara nahi.
        if (v.id in versionUris) continue;
        const u = await resolveDocUri(versionDocFile(v)).catch(() => null);
        if (!alive) return;
        setVersionUris((m) => ({ ...m, [v.id]: u }));
      }
    })();
    return () => {
      alive = false;
    };
    // `versionUris` jaan-boojh ke bahar hai — wo har set par badalta hai aur
    // dep me hone par ye effect apne aap ko bina rukhe dobara chalata rehta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVersions, versions]);

  async function onSave() {
    if (busy) return;
    setBusy("save");
    try {
      // Naam bhi bhejte hain — SAF wali file ka naam isi se banta hai. Bina
      // iske har download "document.jpg" ban jaata aur user ke phone me kuch
      // pehchana hi nahi jaata.
      const res = await saveDocumentToDevice({ ...doc, name: docName });
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
          {docName}
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
          /**
           * Photo par tap = poori screen + zoom.
           *
           * ⚠️ Neeche "Bada karke dekho" ki patti jaan-boojh ke hai. Sirf tap
           * chalne se koi faayda nahi hota agar user ko pata hi na ho ki photo
           * tappable hai — aur is app ke user photo par tap karne ki koshish
           * karte hi nahi. Ek chhoti si saaf line usse poora feature khol deti
           * hai.
           */
          <Pressable
            onPress={() => setZoom({ uri: resolved, title: docName })}
            style={({ pressed }) => [styles.photoTap, pressed && { opacity: 0.9 }]}
            accessibilityRole="imagebutton"
            accessibilityLabel={docName}
          >
            <Image
              source={{ uri: resolved }}
              style={{ width: width - 32, height: height * 0.45 }}
              resizeMode="contain"
            />
            <View style={styles.zoomHint}>
              <Ionicons name="expand-outline" size={14} color={tc.white} />
              <Text style={styles.zoomHintText}>{d.zoomHint}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={40} color={tc.inkSoft} />
            <Text style={styles.emptyText}>{d.noFileSaved}</Text>
          </View>
        )}

        {/**
         * Renew — expiry (aur chaho to photo) badalne ka raasta.
         *
         * ⚠️ Ye pehle THA HI NAHI, aur uski kami is app ke sabse aam kaam par
         * padti thi: document renew ho gaya, nayi date daalni hai — aur ek hi
         * raasta tha, "pehle delete karo, phir poori photo dobara kheencho, phir
         * dobara scan karo". Delete karte hi cloud ki file bhi jaati thi, yaani
         * photo sach me dobara kheenchni padti thi.
         *
         * Naam "Edit" JAAN-BOOJH KE nahi hai. Wo screen naam/type badalne deti
         * hi nahi (wajah `document-renew.tsx` ke upar poori likhi hai), aur
         * button ka naam bhi wahi kehna chahiye jo wo sach me karta hai.
         *
         * Bina expiry wale document par bhi dikhta hai — wahan "Expiry date add
         * karo" ban jaata hai. AI ka scan aksar expiry miss kar deta hai, aur
         * uske baad wahi purana lamba raasta bachta tha.
         *
         * `id` na ho to nahi dikhta: uske bina renew screen document dhoondh hi
         * nahi sakti, aur ek aisa button dikhana jo kuch na kare sabse bura hai.
         */}
        {!!id && (
          <Pressable
            onPress={() =>
              // `as never` — bilkul waise hi jaise is file ke baaki push. Expo ka
              // typed-routes list build ke waqt banti hai, aur nayi screen usme
              // agle generate tak nahi hoti.
              router.push({ pathname: "/document-renew", params: { id } } as never)
            }
            style={({ pressed }) => [styles.renewBtn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="refresh-circle" size={20} color={tc.terracotta} />
            <Text style={styles.renewBtnText}>
              {docExpiry ? d.renewUpdate : d.addExpiry}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={tc.terracotta} />
          </Pressable>
        )}

        {/**
         * Purane versions — renew se pehle wali photo aur expiry.
         *
         * ⚠️ Band shuru hota hai, aur ye soch samajh ke hai. Screen ka asli kaam
         * ABHI wala document dikhana hai; history uske neeche ek jagah hai jahan
         * user tab jaata hai jab use sach me zaroorat ho. Khula rakhne par purana
         * passport naye ke saath hi dikhta, aur "kaunsa wala asli hai" wali
         * uljhan sabse bura nateeja hoti.
         *
         * Kuch bhi na ho to poora hissa dikhta hi nahi — khaali "Purane versions"
         * dikhana user ko wo cheez dhoondhne bhejta hai jo hai hi nahi.
         */}
        {versions.length > 0 && (
          <View style={styles.versionsBox}>
            <Pressable
              onPress={() => setShowVersions((s) => !s)}
              style={styles.versionsHead}
              hitSlop={6}
            >
              <Ionicons name="time-outline" size={18} color={tc.ink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.versionsTitle}>{d.versionsTitle}</Text>
                <Text style={styles.versionsSub}>
                  {tpl(d.versionsCount, { n: versions.length })}
                </Text>
              </View>
              <Ionicons
                name={showVersions ? "chevron-up" : "chevron-down"}
                size={18}
                color={tc.inkSoft}
              />
            </Pressable>

            {showVersions &&
              versions.map((v) => {
                const uri = versionUris[v.id];
                const open = openVersion === v.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setOpenVersion(open ? null : v.id)}
                    style={styles.versionRow}
                  >
                    <View style={styles.versionRowTop}>
                      {/**
                       * Chhoti photo — `uri` abhi na aayi ho to jagah phir bhi
                       * ghere rehti hai, warna list har download par hilti hai.
                       */}
                      <View style={styles.versionThumb}>
                        {uri ? (
                          <Image
                            source={{ uri }}
                            style={styles.versionThumbImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons
                            name={uri === null ? "cloud-offline-outline" : "image-outline"}
                            size={18}
                            color={tc.inkSoft}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.versionLabel}>
                          {tpl(d.versionLabel, { n: v.version })}
                        </Text>
                        <Text style={styles.versionMeta}>
                          {v.expiry
                            ? tpl(d.versionExpiry, { date: formatDate(v.expiry, locale) })
                            : d.versionNoExpiry}
                        </Text>
                        {/**
                         * "Kab tak chala" — `created_at` wo lamha hai jab renew
                         * hua, yaani ye version tab tak current tha.
                         *
                         * ⚠️ `toIsoDate(new Date(...))` — seedha `slice(0,10)`
                         * NAHI. `created_at` UTC me aata hai, aur India me raat
                         * 12 se 5:30 ke beech ka renew us tarah ek din PEECHE
                         * dikhta.
                         */}
                        <Text style={styles.versionMeta}>
                          {tpl(d.versionUntil, {
                            date: formatDate(toIsoDate(new Date(v.created_at)), locale),
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name={open ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={tc.inkSoft}
                      />
                    </View>

                    {open &&
                      (uri ? (
                        // Purani version ki photo bhi utni hi zaroori hoti hai
                        // (purana passport, purani policy) — wahi zoom yahan bhi.
                        <Pressable
                          onPress={() =>
                            setZoom({ uri, title: tpl(d.versionLabel, { n: v.version }) })
                          }
                          style={({ pressed }) => [styles.photoTap, pressed && { opacity: 0.9 }]}
                          accessibilityRole="imagebutton"
                        >
                          <Image
                            source={{ uri }}
                            style={{ width: width - 64, height: height * 0.35, marginTop: 10 }}
                            resizeMode="contain"
                          />
                          <View style={styles.zoomHint}>
                            <Ionicons name="expand-outline" size={14} color={tc.white} />
                            <Text style={styles.zoomHintText}>{d.zoomHint}</Text>
                          </View>
                        </Pressable>
                      ) : (
                        // `undefined` = abhi utar rahi hai, `null` = nahi mili.
                        // Dono par ek hi line thodi galat hoti, par yahan wo line
                        // "abhi nahi khul payi" hai — jo dono me sach hai.
                        <Text style={styles.versionEmpty}>{d.versionNoFile}</Text>
                      ))}
                  </Pressable>
                );
              })}
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
            dekhne ke baad ka pehla sawaal yahi hota hai.

            ⚠️ Yahan ka dhaancha ab CODE me tay nahi hai. Pehle sirf teen cheezein
            dikh sakti thi — heading, steps, note — kyunki wo teen naam yahin
            likhe the. Ab admin jitne khaane banata hai (Fees, Kagaz, Chetavni…)
            utne dikhte hain, usi tarteeb me jo usne master me tay ki. */}
        {!!guide && (
          <View style={styles.renewCard}>
            <View style={styles.renewHead}>
              <View style={styles.renewIcon}>
                <Ionicons name="refresh" size={17} color={tc.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                {/* Admin `title` khaana band kar sakta hai — tab card ka header
                    khaali reh jaata. Wo bina heading wale ek dabbe jaisa dikhta
                    hai, isliye app ki apni line par gir jaate hain. */}
                <Text style={styles.renewTitle}>{guide.title || d.renewShowSteps}</Text>
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

            {/* Baaki sab khaane toggle ke peeche — card chhota rehta hai, aur
                jise sach me padhna hai wahi kholta hai. */}
            {guide.parts.length > 0 && (
              <Pressable onPress={() => setShowSteps((v) => !v)} style={styles.renewToggle}>
                <Text style={styles.renewToggleText}>
                  {showSteps ? d.renewHideSteps : d.renewShowSteps}
                </Text>
                <Ionicons
                  name={showSteps ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={tc.terracotta}
                />
              </Pressable>
            )}

            {showSteps && (
              <View style={styles.steps}>
                {guide.parts.map((p) => {
                  if (p.kind === "list") {
                    return (
                      <View key={p.key} style={styles.partBlock}>
                        {/* Ek hi list ho to uska label bekaar shor hai — "Steps"
                            likhne se koi baat nahi banti. Do ya zyada hon tab
                            label hi batata hai ki ye kis cheez ki list hai. */}
                        {guide.parts.filter((x) => x.kind === "list").length > 1 && (
                          <Text style={styles.partLabel}>{p.label}</Text>
                        )}
                        {p.items.map((s, i) => (
                          <View key={i} style={styles.step}>
                            <View style={styles.stepNum}>
                              <Text style={styles.stepNumText}>{i + 1}</Text>
                            </View>
                            <Text style={styles.stepText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  }

                  if (p.kind === "note") {
                    return (
                      <View key={p.key} style={styles.note}>
                        <Ionicons
                          // Icon master se aata hai — admin ne kuch aisa likh
                          // diya jo hai hi nahi to Ionicons khaali jagah
                          // chhod deta hai, crash nahi karta.
                          name={(p.icon || "bulb-outline") as never}
                          size={15}
                          color={tc.amber}
                        />
                        <Text style={styles.noteText}>{p.value}</Text>
                      </View>
                    );
                  }

                  if (p.kind === "link") {
                    return (
                      <Pressable
                        key={p.key}
                        onPress={() => Linking.openURL(p.value).catch(() => {})}
                        style={({ pressed }) => [styles.partLink, pressed && { opacity: 0.7 }]}
                      >
                        <Ionicons
                          name={(p.icon || "open-outline") as never}
                          size={15}
                          color={tc.terracotta}
                        />
                        <Text style={styles.partLinkText} numberOfLines={2}>
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  }

                  // text / longtext
                  return (
                    <View key={p.key} style={styles.partBlock}>
                      <Text style={styles.partLabel}>{p.label}</Text>
                      <Text style={styles.partText}>{p.value}</Text>
                    </View>
                  );
                })}

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

      {/* Poori screen par photo — pinch, double-tap, aur +/− ke button. */}
      <ImageViewer
        visible={!!zoom}
        uri={zoom?.uri ?? null}
        title={zoom?.title}
        onClose={() => setZoom(null)}
      />
    </SafeAreaView>
  );
}

/**
 * Chaudi screen (tablet / foldable / landscape) par sab kuch beech me.
 *
 * ⚠️ Baaki har screen par ye pehle se hai; document-view chhoot gaya tha, aur
 * yahan uski kami sabse zyada dikhti hai — photo ki chaudai seedhe screen se
 * banti hai (`width - 32`), isliye 10-inch tablet par ek passport ka page poori
 * screen ghere hue, dhundhla khincha hua dikhta tha.
 */
const CONTENT = { width: "100%", maxWidth: 640, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...CONTENT,
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
  /** Photo ka poora dabba — `relative` taaki patti uske kone me baith sake. */
  photoTap: { position: "relative", alignItems: "center", justifyContent: "center" },
  /**
   * "Bada karke dekho" — photo ke kone par.
   *
   * ⚠️ Rang yahan tay hai (theme se nahi aata) aur ye jaan-boojh ke hai: ye
   * patti PHOTO ke upar baithti hai, page ke upar nahi. Photo kaali bhi ho
   * sakti hai aur ujli bhi, isliye ek gehra parda + safed text hi dono par
   * padha jaata hai. Theme ka rang yahan aadhe documents par gayab ho jaata.
   */
  zoomHint: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  zoomHintText: { fontSize: 11.5, fontWeight: "700", color: "#FFFFFF" },
  empty: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 15, color: c.inkSoft, textAlign: "center" },

  /**
   * Renew ka button — bhara hua nahi, kinare wala.
   *
   * Neeche Download/Share pehle se bhare hue button hain. Teesra bhara hua
   * button teenon ko ek jaisa bana deta aur user ko chunna mushkil ho jaata;
   * ye alag dikhta hai par kam zaroori nahi lagta.
   */
  renewBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: c.terracotta,
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  renewBtnText: { flex: 1, fontSize: 15, fontWeight: "700", color: c.terracotta },

  /* --------------------------- purane versions --------------------------- */
  versionsBox: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  versionsHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  versionsTitle: { fontSize: 15, fontWeight: "700", color: c.ink },
  versionsSub: { marginTop: 2, fontSize: 12.5, color: c.inkSoft },
  versionRow: {
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  versionRowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  versionThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  versionThumbImg: { width: "100%", height: "100%" },
  versionLabel: { fontSize: 14.5, fontWeight: "700", color: c.ink },
  versionMeta: { marginTop: 1, fontSize: 12.5, color: c.inkSoft },
  versionEmpty: {
    marginTop: 10,
    fontSize: 13,
    color: c.inkSoft,
    textAlign: "center",
  },

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
  /* Master ka ek khaana — label + uska matn. */
  partBlock: { gap: 8 },
  partLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.inkSoft,
  },
  partText: { fontSize: 14, lineHeight: 21, color: c.ink },
  partLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  partLinkText: { flex: 1, fontSize: 13.5, fontWeight: "700", color: c.terracotta },
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
