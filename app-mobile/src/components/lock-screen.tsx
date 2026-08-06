import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import SaathiLogo from "@/components/saathi-logo";
import { ConfirmModal } from "@/components/confirm-modal";
import { signOut } from "@/lib/auth";
import {
  PIN_LENGTH,
  checkPin,
  getLockState,
  markUnlocked,
  pinAttemptsLeft,
  resetGrace,
  unlockWithBiometric,
} from "@/lib/app-lock";

/**
 * Lock screen — poore app ke UPAR.
 *
 * Biometric khud hi try hota hai (mount hote hi): jab wo chal jaata hai to user
 * ko kuch karna hi nahi padta, aur wahi is feature ka poora maza hai. Uske
 * peeche PIN hamesha khada rehta hai — ungli na padhe, dhoop me face na chale,
 * ya phone khud PIN maang le, teeno soorat me raasta band nahi hota.
 *
 * ⚠️ Yahan koi "Forgot PIN → reset" wala button nahi hai, aur ye jaan-boojh ke
 * hai. PIN sirf is phone par hai — server par uska koi nishaan hi nahi, isliye
 * use "reset" karne ka koi tareeka ho hi nahi sakta. Aur ek aisa button jo asal
 * me sirf lock hata deta ho, lock ko poora dikhawa bana deta: jiske haath phone
 * lagta wo bas wahi button dabata.
 *
 * Iski jagah ek IMAANDAAR raasta hai — Logout. Wo lock hatata nahi, wo session
 * hi khatam kar deta hai: uske baad login screen aati hai, aur bina email/Google
 * ke andar kuch nahi dikhta. Asli user apne hi account se dobara login karke
 * saara data wapas paa leta hai; kisi aur ke liye wo button bekaar hai. Pehle
 * yahan kuch bhi nahi tha aur PIN bhoolne wale ko app UNINSTALL karni padti thi.
 */
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const tc = useColors();
  const styles = useStyles();
  const { lock: l, common: c } = useT();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [checking, setChecking] = useState(false);
  const [askSignOut, setAskSignOut] = useState(false);
  /** Brute-force rok ka baaki intezaar (second). 0 = koi rok nahi. */
  const [wait, setWait] = useState(0);

  // Intezaar ki ulti ginti — user ko dikhna chahiye ki kab tak rukna hai,
  // warna wo baar-baar wahi PIN daalta rehta hai aur kuch hota nahi dikhta.
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => {
      const next = pinAttemptsLeft();
      setWait(next.blocked ? next.waitSeconds : 0);
    }, 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function done() {
    markUnlocked();
    onUnlocked();
  }

  // Mount hote hi biometric — user ne on kiya ho to.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const st = await getLockState();
      if (!alive) return;
      setBioOn(st.biometricOn);
      if (!st.biometricOn) return;
      const ok = await unlockWithBiometric(l.biometricPrompt, l.enterPin);
      // Fail hone par kuch nahi dikhate — PIN wala raasta neeche khula hi hai.
      // Yahan error dikhana user ko dara deta hai jabki kuch toota nahi.
      if (alive && ok) done();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(value: string) {
    setChecking(true);
    const ok = await checkPin(value);
    setChecking(false);
    setPin("");
    if (ok) {
      done();
      return;
    }
    // Ye koshish hadd paar kar gayi? Tab rok ka message dikhao, "PIN galat"
    // nahi — user ko pata hona chahiye ki ab wo daal hi nahi sakta.
    const st = pinAttemptsLeft();
    if (st.blocked) {
      setWait(st.waitSeconds);
      setError(null);
      return;
    }
    setError(l.wrongPin);
  }

  function onChange(v: string) {
    // Rok chal rahi hai — kuch type hi mat hone do.
    if (wait > 0) return;
    const digits = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError(null);
    // Poore ank aate hi khud check — 4 ank ke baad "OK" dabwana ek bekaar tap hai.
    if (digits.length === PIN_LENGTH) void submit(digits);
  }

  /**
   * Logout — PIN bhool jaane ka imaandaar raasta.
   *
   * `resetGrace()` zaroori hai: uske bina purani "abhi-abhi khola tha" wali
   * haalat memory me padi reh jaati aur agla user bina lock ke andar aa jaata.
   */
  async function doSignOut() {
    setAskSignOut(false);
    setChecking(true);
    try {
      resetGrace();
      await signOut();
    } catch {
      // Net na ho to bhi local session chala jaata hai — AuthProvider ise
      // pakad ke login screen par bhej dega.
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <SaathiLogo size={64} radius={22} />
        <Text style={styles.title}>{l.unlockTitle}</Text>
        <Text style={styles.sub}>{l.unlockSub}</Text>

        {/* Asli input chhupa hua hai; dikhne wale dots neeche hain. Isse har
            platform par apne aap secure keyboard aur paste-block milta hai,
            bina apna keypad likhe. */}
        <Pressable style={styles.dots} onPress={() => {}}>
          <TextInput
            value={pin}
            onChangeText={onChange}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            editable={!checking}
            maxLength={PIN_LENGTH}
            style={styles.hiddenInput}
            caretHidden
          />
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
          ))}
        </Pressable>

        {wait > 0 ? (
          <Text style={styles.err}>{tpl(l.tooManyPin, { s: wait })}</Text>
        ) : (
          !!error && <Text style={styles.err}>{error}</Text>
        )}

        {bioOn && wait === 0 && (
          <Pressable
            onPress={() =>
              void unlockWithBiometric(l.biometricPrompt, l.enterPin).then(
                (ok) => ok && done(),
              )
            }
            style={({ pressed }) => [styles.bioBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="finger-print" size={19} color={tc.terracotta} />
            <Text style={styles.bioText}>{l.useBiometric}</Text>
          </Pressable>
        )}

        {/* PIN bhool gaye ka ek hi imaandaar raasta — logout. Ye lock hatata
            nahi, session khatam karta hai: uske baad login screen aati hai
            aur bina account ke andar kuch nahi dikhta. */}
        <Pressable
          onPress={() => setAskSignOut(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.forgotText}>{l.signOutInstead}</Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={askSignOut}
        title={l.signOutAsk}
        message={l.signOutBody}
        confirmLabel={l.signOutAsk}
        cancelLabel={c.cancel}
        icon="log-out-outline"
        destructive
        onConfirm={() => void doSignOut()}
        onCancel={() => setAskSignOut(false)}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  title: { marginTop: 22, fontSize: 22, fontWeight: "800", color: c.ink },
  sub: { marginTop: 7, fontSize: 14, color: c.inkSoft, textAlign: "center" },
  dots: { marginTop: 30, flexDirection: "row", gap: 16, alignItems: "center" },
  // Input dikhta nahi par tappable rehna chahiye — warna keyboard band hone ke
  // baad wapas laane ka koi raasta hi nahi bachta.
  hiddenInput: { position: "absolute", opacity: 0, height: 48, width: "100%" },
  dot: {
    height: 15,
    width: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  dotOn: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  err: { marginTop: 18, fontSize: 13.5, fontWeight: "700", color: c.terracottaDark },
  bioBtn: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.32)",
    backgroundColor: "rgba(194,90,55,0.07)",
  },
  bioText: { fontSize: 14, fontWeight: "700", color: c.terracotta },
  forgot: { marginTop: 26, paddingVertical: 6, paddingHorizontal: 10 },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
    color: c.inkSoft,
    textAlign: "center",
    textDecorationLine: "underline",
  },
}));
