import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import SaathiLogo from "@/components/saathi-logo";
import {
  PIN_LENGTH,
  checkPin,
  getLockState,
  markUnlocked,
  pinAttemptsLeft,
  unlockWithBiometric,
} from "@/lib/app-lock";
import { resetPinWithCode, sendLockResetCode, type LockResetError } from "@/lib/app-lock-reset";

/**
 * Lock screen — poore app ke UPAR.
 *
 * Biometric khud hi try hota hai (mount hote hi): jab wo chal jaata hai to user
 * ko kuch karna hi nahi padta, aur wahi is feature ka poora maza hai. Uske
 * peeche PIN hamesha khada rehta hai — ungli na padhe, dhoop me face na chale,
 * ya phone khud PIN maang le, teeno soorat me raasta band nahi hota.
 *
 * ── "PIN bhool gaye" ab sach me kaam karta hai ──────────────────────────
 *
 * ⚠️ Pehle yahan sirf **Logout** tha. Wo us waqt imaandaar tha kyunki PIN sirf
 * is phone par hota tha — logout karte hi wo apne aap chala jaata tha.
 *
 * Ab PIN account ka hissa hai (`supabase/app-lock.sql`), isliye logout se lock
 * hatta hi nahi: dobara login karo to wo wapas aa jaata hai. Us badlaav ke saath
 * ek zimmedari aati hai — PIN bhoolne wale ke paas KOI raasta hona chahiye,
 * warna lock use uske apne documents se hamesha ke liye bahar kar deta hai.
 *
 * Wo raasta ab account ke EMAIL par ek 6 ank ka code hai. Ye lock ko kamzor
 * nahi karta: wo email usi user ka hai jisse wo login bhi karta hai, aur jiske
 * haath phone laga hai uske paas wo email nahi hoga.
 */

/** Screen abhi kya poochh rahi hai. */
type Mode = "pin" | "resetCode" | "resetNew";

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const tc = useColors();
  const styles = useStyles();
  const { lock: l, common: c } = useT();
  const { width, height } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [checking, setChecking] = useState(false);
  /** Brute-force rok ka baaki intezaar (second). 0 = koi rok nahi. */
  const [wait, setWait] = useState(0);

  /* ── reset (email OTP) ── */
  const [sending, setSending] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  /**
   * Asli input ka haath.
   *
   * ⚠️ Pehle yahan `autoFocus` tha aur wahi DO shikayaton ki jad thi:
   *
   *   • **Fingerprint do baar lagana padta tha.** Android ka BiometricPrompt ek
   *     alag window hai. `autoFocus` mount hote hi keyboard khol deta hai, aur
   *     wo keyboard prompt se focus chheen leta hai — prompt wahin cancel ho
   *     jaata hai. User ko lagta tha ungli padhi hi nahi; wo dobara button
   *     dabata tha aur tab (keyboard pehle se khula hone ki wajah se) chal jaata
   *     tha.
   *   • **"PIN daalo" par keyboard nahi aata tha.** Prompt ka negative button
   *     (`cancelLabel = PIN daalo`) dabane par sirf `false` milta tha aur uske
   *     baad koi kuch karta hi nahi tha — keyboard pehle hi cancel ho chuka
   *     hota tha aur use wapas laane ka koi raasta hi nahi tha (dots wala
   *     Pressable ka `onPress` khaali `() => {}` tha).
   *
   * Ab focus HUM dete hain, aur hamesha biometric ka faisla ho jaane ke BAAD.
   */
  const pinRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);

  /** Biometric ek hi baar chale — effect dobara chal jaye tab bhi. */
  const bioTried = useRef(false);

  /* ─────────────────────────── entry animation ─────────────────────────── */

  /**
   * Logo peeche se aage aata hai, aur naam do taraf se aa ke jud jaata hai.
   *
   * ⚠️ Teenon cheezein (perspective + rotateX + scale) ek saath chahiye. Inme se
   * `perspective` hataane par `rotateX` sirf ek flat squeeze dikhta hai, aur
   * poori cheez 3D ki jagah "dabi hui" lagti hai.
   *
   * Travel (naam kitni door se aata hai) screen ki chaudai se nikalta hai, tay
   * number se nahi — chhote phone par 120px ka safar naam ko screen ke bahar le
   * jaata hai aur wo ek pal ke liye kat-ta hua dikhta hai.
   */
  const enter = useRef(new Animated.Value(0)).current;
  const travel = Math.min(140, Math.max(60, width * 0.32));
  const compact = height < 700;
  const logoSize = Math.round(Math.min(104, Math.max(66, width * 0.22)));

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter]);

  /** Naam logo ke thoda BAAD aata hai — dono ek saath aayein to bhaari lagta hai. */
  const word = enter.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });

  /* ──────────────────────────── countdowns ──────────────────────────── */

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

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  function done() {
    markUnlocked();
    onUnlocked();
  }

  /* ─────────────────────────────── unlock ─────────────────────────────── */

  /**
   * Mount hote hi biometric — user ne on kiya ho to.
   *
   * Faisla ho jaane ke baad (chala ya nahi chala) keyboard kholte hain. Ye
   * tarteeb hi upar wali dono shikayaton ka ilaaj hai.
   */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const st = await getLockState();
      if (!alive) return;
      setBioOn(st.biometricOn);
      /**
       * Pichhli baar ka intezaar abhi chal raha ho to wo TURANT dikhna chahiye.
       *
       * ⚠️ Galat koshishon ki ginti ab app band hone par bhi bachi rehti hai
       * (`app-lock.ts` par poori wajah likhi hai). Bina in do line ke wo rok
       * chupi rehti: user app kholta, PIN daalta, aur bina koi wajah dekhe
       * "galat PIN" jaisa suna-suna kuch paata — jabki asal me use sirf rukna
       * tha. Ulti ginti dikha dena hi wo ek cheez hai jo use rukna samjhati hai.
       */
      const guard = pinAttemptsLeft();
      if (guard.blocked) setWait(guard.waitSeconds);
      if (!st.biometricOn) {
        focusPin();
        return;
      }
      if (bioTried.current) return;
      bioTried.current = true;
      const ok = await unlockWithBiometric(l.biometricPrompt, l.enterPin);
      if (!alive) return;
      // Fail hone par kuch nahi dikhate — PIN wala raasta neeche khula hi hai.
      // Yahan error dikhana user ko dara deta hai jabki kuch toota nahi.
      if (ok) done();
      else focusPin();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Keyboard laao.
   *
   * `setTimeout` jaan-boojh ke: BiometricPrompt band hone ke turant baad diya
   * gaya focus Android chup-chaap gira deta hai (window abhi wapas nahi aayi
   * hoti). Ek frame ka intezaar ise pakka kar deta hai.
   */
  function focusPin() {
    setTimeout(() => pinRef.current?.focus(), 120);
  }

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
    focusPin();
  }

  function onChangePin(v: string) {
    // Rok chal rahi hai — kuch type hi mat hone do.
    if (wait > 0) return;
    const digits = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError(null);
    // Poore ank aate hi khud check — 4 ank ke baad "OK" dabwana ek bekaar tap hai.
    if (digits.length === PIN_LENGTH) void submit(digits);
  }

  /* ──────────────────────────── PIN bhool gaye ──────────────────────────── */

  /** Server ki galti ka seedha matlab — har ek ka alag ilaaj hai. */
  function resetLine(e: LockResetError): string {
    switch (e) {
      case "no_email":
        return l.resetErrNoEmail;
      case "not_configured":
        return l.resetErrNotConfigured;
      case "cooldown":
      case "too_many":
        return l.resetErrTooMany;
      case "wrong_code":
        return l.resetErrWrongCode;
      case "expired":
        return l.resetErrExpired;
      case "locked":
        return l.resetErrLocked;
      case "network":
        return l.resetErrNoNet;
      default:
        return l.resetErrFailed;
    }
  }

  async function askForCode() {
    if (sending || resendIn > 0) return;
    setSending(true);
    setError(null);
    const res = await sendLockResetCode();
    setSending(false);
    if (!res.ok) {
      setError(resetLine(res.error));
      return;
    }
    setMaskedEmail(res.email);
    setResendIn(res.retryAfter || 60);
    setCode("");
    setMode("resetCode");
    setTimeout(() => codeRef.current?.focus(), 150);
  }

  function onChangeCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === 6) {
      // Code sahi hai ya nahi, ye server naya PIN ke SAATH hi batata hai (ek hi
      // call — `app-lock-reset.ts` me wajah likhi hai). Isliye yahan seedha agla
      // qadam: naya PIN.
      setPin("");
      setMode("resetNew");
      setTimeout(() => pinRef.current?.focus(), 150);
    }
  }

  async function onChangeNewPin(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError(null);
    if (digits.length !== PIN_LENGTH) return;

    setChecking(true);
    const err = await resetPinWithCode(code, digits);
    setChecking(false);
    setPin("");
    if (!err) {
      done();
      return;
    }
    setError(resetLine(err));
    // Code hi galat/expire tha — wapas code wale qadam par. Naye PIN par
    // atkaaye rakhna bekaar hai, wahan se kuch chalega hi nahi.
    if (err === "wrong_code" || err === "expired" || err === "locked") {
      setCode("");
      setMode("resetCode");
      setTimeout(() => codeRef.current?.focus(), 150);
    } else {
      focusPin();
    }
  }

  function backToPin() {
    setMode("pin");
    setCode("");
    setPin("");
    setError(null);
    focusPin();
  }

  /* ──────────────────────────────── UI ──────────────────────────────── */

  const isCodeStep = mode === "resetCode";
  const slots = isCodeStep ? 6 : PIN_LENGTH;
  const filled = isCodeStep ? code.length : pin.length;

  const title =
    mode === "pin" ? l.unlockTitle : mode === "resetCode" ? l.resetTitle : l.resetNewPin;
  const sub =
    mode === "pin"
      ? l.unlockSub
      : mode === "resetCode"
        ? tpl(l.resetSentTo, { email: maskedEmail })
        : l.resetNewSub;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/*
          ⚠️ ScrollView jaan-boojh ke, chahe content chhota hi ho.

          Keyboard khulte hi Android window ko chhota kar deta hai, aur ek
          `justifyContent: center` wale View me se upar ka text seedha kat jaata
          hai — user ne theek yahi pakda tha ("keyboard aata hai to text chhup
          jata hai"). Scroll me wahi content sirf khisak jaata hai, kat-ta nahi,
          aur chhoti screen (compact) par bhi poora padha ja sakta hai.
        */}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingVertical: compact ? 16 : 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo: peeche se aage aata hua ── */}
          <Animated.View
            style={{
              opacity: enter,
              transform: [
                { perspective: 800 },
                {
                  rotateX: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["16deg", "0deg"],
                  }),
                },
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
              ],
            }}
          >
            <View style={styles.logoTile}>
              <SaathiLogo size={logoSize} radius={Math.round(logoSize * 0.32)} />
            </View>
          </Animated.View>

          {/* ── Naam: "Apka" baayen se, "Saathi" daayen se ── */}
          <View style={styles.wordRow}>
            <Animated.Text
              style={[
                styles.wordLeft,
                {
                  opacity: word,
                  transform: [
                    {
                      translateX: word.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-travel, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              Apka
            </Animated.Text>
            <Animated.Text
              style={[
                styles.wordRight,
                {
                  opacity: word,
                  transform: [
                    {
                      translateX: word.interpolate({
                        inputRange: [0, 1],
                        outputRange: [travel, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              Saathi
            </Animated.Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>

          {/*
            Asli input chhupa hua hai; dikhne wale dots neeche hain. Isse har
            platform par apne aap secure keyboard aur paste-block milta hai,
            bina apna keypad likhe.

            ⚠️ `onPress` ab sach me kuch karta hai — pehle wo `() => {}` tha,
            yaani keyboard ek baar band ho jaye to use wapas laane ka koi raasta
            hi nahi bachta tha.
          */}
          <Pressable
            style={styles.dots}
            onPress={() => (isCodeStep ? codeRef.current : pinRef.current)?.focus()}
            hitSlop={16}
          >
            <TextInput
              ref={pinRef}
              value={pin}
              onChangeText={mode === "resetNew" ? onChangeNewPin : onChangePin}
              keyboardType="number-pad"
              secureTextEntry
              editable={!checking && !isCodeStep}
              maxLength={PIN_LENGTH}
              style={styles.hiddenInput}
              caretHidden
            />
            <TextInput
              ref={codeRef}
              value={code}
              onChangeText={onChangeCode}
              keyboardType="number-pad"
              editable={isCodeStep}
              maxLength={6}
              style={styles.hiddenInput}
              caretHidden
            />
            {Array.from({ length: slots }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, isCodeStep && styles.dotSmall, i < filled && styles.dotOn]}
              />
            ))}
          </Pressable>

          {wait > 0 ? (
            <Text style={styles.err}>{tpl(l.tooManyPin, { s: wait })}</Text>
          ) : (
            !!error && <Text style={styles.err}>{error}</Text>
          )}

          {mode === "pin" && bioOn && wait === 0 && (
            <Pressable
              onPress={() =>
                void unlockWithBiometric(l.biometricPrompt, l.enterPin).then((ok) =>
                  ok ? done() : focusPin(),
                )
              }
              style={({ pressed }) => [styles.bioBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="finger-print" size={19} color={tc.terracotta} />
              <Text style={styles.bioText}>{l.useBiometric}</Text>
            </Pressable>
          )}

          {/* PIN bhool gaye — email par code. Lock hatata nahi, PIN badalta hai. */}
          {mode === "pin" && (
            <Pressable
              onPress={() => void askForCode()}
              disabled={sending}
              hitSlop={8}
              style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.forgotText}>{sending ? l.resetSending : l.forgotPin}</Text>
            </Pressable>
          )}

          {isCodeStep && (
            <>
              <Pressable
                onPress={() => void askForCode()}
                disabled={resendIn > 0 || sending}
                hitSlop={8}
                style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.forgotText, resendIn > 0 && { opacity: 0.5 }]}>
                  {resendIn > 0 ? tpl(l.resetResendIn, { s: resendIn }) : l.resetResend}
                </Text>
              </Pressable>
              <Pressable onPress={backToPin} hitSlop={8} style={styles.cancel}>
                <Text style={styles.cancelText}>{c.cancel}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    // Chaudi screen (tablet) par sab kuch beech me hi rehna chahiye.
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  // Logo ke peeche halka sa uthaav — 3D wali entry ke baad wo apni jagah par
  // "khada" isi se lagta hai. Bina iske animation khatam hote hi flat ho jaata.
  logoTile: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderRadius: 30,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  wordLeft: { fontSize: 22, fontWeight: "600", color: c.inkSoft, letterSpacing: -0.3 },
  wordRight: { fontSize: 24, fontWeight: "800", color: c.ink, letterSpacing: -0.4 },
  title: { marginTop: 20, fontSize: 21, fontWeight: "800", color: c.ink, textAlign: "center" },
  sub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: c.inkSoft,
    textAlign: "center",
  },
  dots: {
    marginTop: 28,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    justifyContent: "center",
    // Tap ka nishana bada — chhote dots par ungli aksar chook jaati hai aur
    // keyboard wapas nahi aata.
    paddingVertical: 10,
  },
  // Input dikhta nahi par tappable rehna chahiye — warna keyboard band hone ke
  // baad wapas laane ka koi raasta hi nahi bachta.
  hiddenInput: { position: "absolute", opacity: 0, height: 48, width: "100%" },
  /**
   * ⚠️ 15px se 21px.
   *
   * Shikayat seedhi thi: "OOOO circle thoda bada hona chahiye, lock page par
   * dabana mushkil hai". Tap ka nishana pehle hi theek kar diya gaya tha
   * (`hitSlop` + `onPress` jo sach me keyboard laata hai), par asli baat wo thi
   * hi nahi — baat DIKHNE ki thi. 15px par ye batana hi mushkil ho jaata hai ki
   * kitne ank pad chuke hain, aur ye app un logon ke liye bani hai jinki nazar
   * kamzor hai.
   */
  dot: {
    height: 21,
    width: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  // 6 ank ke code me 4 wale naap se pankti chhoti screen par bahar nikal jaati.
  /** 6-ank wala reset code — utne dots ek line me aane chahiye, isliye thode chhote. */
  dotSmall: { height: 17, width: 17, borderRadius: 9 },
  dotOn: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  err: {
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: "700",
    color: c.terracottaDark,
    textAlign: "center",
  },
  bioBtn: {
    marginTop: 24,
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
  forgot: { marginTop: 22, paddingVertical: 6, paddingHorizontal: 10 },
  forgotText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: c.inkSoft,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  cancel: { marginTop: 6, padding: 8 },
  cancelText: { fontSize: 14, fontWeight: "700", color: c.inkSoft },
}));
