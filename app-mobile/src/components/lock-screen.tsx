import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { KeyboardView } from "@/components/keyboard-view";
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
   * Asli input ka haath — EK, do nahi.
   *
   * ⚠️ Yahan pehle DO TextInput the (`pinRef` aur `codeRef`), dono
   * `position: absolute` par ek doosre ke UPAR, aur dono dots wale Pressable ke
   * andar. Wahi shikayat ki jad thi: "wo dot jaha pe pin daalna h waha click
   * karte h to ek baar me sahi se nhi hota".
   *
   * Hota ye tha ki upar wala (code wala) input PIN wale mode me
   * `editable={false}` hota tha — par wo Android par tap phir bhi kha jaata tha.
   * Yaani pehli ungli us mari hui input par padti thi: na focus, na keyboard,
   * kuch nahi. Doosri tap kabhi-kabhi Pressable tak pahunch jaati thi.
   *
   * Ab ek hi input hai (mode ke hisaab se `key` badal ke naya banta hai), aur wo
   * hamesha `editable` hai. Ab dono raaste chalte hain, aur DONO ka chalna
   * jaan-boojh ke hai — ye screen wo ek jagah hai jahan kuch toota to user apne
   * hi documents se bahar reh jaata hai:
   *
   *   • Ungli dots ke BEECH padi        -> seedha input par, native focus.
   *   • Ungli kisi dot ke UPAR padi     -> dot chhoota nahi, tap Pressable tak
   *                                        pahunchta hai, aur wo `focus()` karta hai.
   *
   * ⚠️ Yahan `pointerEvents="none"` mat lagana. Wo saaf lagta hai (tap ka ek hi
   * raasta) par uske saath ek anjaan khatra aata hai: us haal me keyboard SIRF
   * `focus()` se khulta hai, aur agar kisi OEM par wo call na chale to PIN
   * daalne ka koi raasta hi nahi bachta. Do raaste rakhna yahan sasta beema hai.
   *
   * ⚠️ Pehle `autoFocus` bhi tha aur wo DO aur shikayaton ki jad thi:
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
  const inputRef = useRef<TextInput>(null);

  /** Biometric ek hi baar chale — effect dobara chal jaye tab bhi. */
  const bioTried = useRef(false);

  /* ─────────────────────────── entry animation ─────────────────────────── */

  /**
   * Poori SCREEN ki entry — sirf logo ki nahi.
   *
   * ⚠️ Shikayat seedhi thi: "logo ke saath 3D animation chaiye wo pura screen
   * animation me do". Pehle sirf logo ka chhota sa tile ghoomta tha aur baaki
   * screen (naam, title, dots) bina kisi harkat ke, ek dam se, wahin chipak
   * jaati thi. Ek chalta hua hissa aur baaki sab jam gaya — wo animation lagta
   * hi nahi, wo ek jhatka lagta hai.
   *
   * Ab teen parat ek hi ghadi (`enter`) par chalti hain, thodi-thodi der aage-
   * peeche:
   *
   *   1. **Aura** — screen bhar ka do naram gol, peeche se khulta hua. Yahi wo
   *      cheez hai jo animation ko "poori screen ka" banati hai; iske bina
   *      background bilkul mara hua rehta hai.
   *   2. **Logo** — perspective + rotateX + rotateY + scale. Chaaron ek saath
   *      chahiye: `perspective` hataane par `rotateX` sirf ek flat squeeze
   *      dikhta hai, aur `rotateY` ke bina wo palat-ta hua nahi, bas jhukta hua
   *      lagta hai.
   *   3. **Naam aur neeche ka sab** — logo ke BAAD, warna sab ek saath aane par
   *      bhaari lagta hai.
   *
   * ⚠️ Har transform `useNativeDriver: true` par hai. Lock screen app ka pehla
   * frame hai — us waqt JS thread booting me busy hota hai, aur JS-driven
   * animation wahin latak jaati hai (user ko wo "app hang ho gaya" dikhta hai).
   *
   * Travel (naam kitni door se aata hai) screen ki chaudai se nikalta hai, tay
   * number se nahi — chhote phone par 120px ka safar naam ko screen ke bahar le
   * jaata hai aur wo ek pal ke liye kat-ta hua dikhta hai.
   */
  const enter = useRef(new Animated.Value(0)).current;
  const travel = Math.min(140, Math.max(60, width * 0.32));
  const compact = height < 700;
  const logoSize = Math.round(Math.min(104, Math.max(66, width * 0.22)));
  /** Aura ka naap — screen ke bade kinare se bhi bada, taaki wo bhare hue lage. */
  const auraSize = Math.round(Math.max(width, height) * 1.15);

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      // 620 se 780 — poori screen ki harkat ko saans lene ki jagah chahiye.
      // Isse tez rakhne par aura "phaila" nahi, "chamak ke bujha" lagta hai.
      duration: 780,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter]);

  /** Naam logo ke thoda BAAD aata hai — dono ek saath aayein to bhaari lagta hai. */
  const word = enter.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });
  /** Neeche ka sab (title, dots, buttons) — naam ke bhi thoda baad. */
  const rest = enter.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

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
    setTimeout(() => inputRef.current?.focus(), 120);
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
    setTimeout(() => inputRef.current?.focus(), 150);
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
      setTimeout(() => inputRef.current?.focus(), 150);
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
      setTimeout(() => inputRef.current?.focus(), 150);
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
      {/**
       * ── Poori screen ka aura ──────────────────────────────────────────
       *
       * ScrollView ke BAHAR aur `pointerEvents="none"` par — dono zaroori hain.
       * Andar rakhne par ye scroll ke saath khisakta (aur wo background nahi,
       * content lagta), aur bina `pointerEvents` ke ye poori screen ke tap kha
       * jaata — yaani dots par ungli lagti hi nahi.
       */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[
            styles.aura,
            {
              height: auraSize,
              width: auraSize,
              borderRadius: auraSize / 2,
              marginLeft: -auraSize / 2,
              marginTop: -auraSize / 2,
              opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              transform: [
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.auraInner,
            {
              height: auraSize * 0.55,
              width: auraSize * 0.55,
              borderRadius: (auraSize * 0.55) / 2,
              marginLeft: -(auraSize * 0.55) / 2,
              marginTop: -(auraSize * 0.55) / 2,
              opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              transform: [
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
              ],
            },
          ]}
        />
      </View>

      <KeyboardView>
        {/*
          ⚠️ ScrollView jaan-boojh ke, chahe content chhota hi ho.

          Keyboard khulte hi content ke UPAR aa jaata hai (Android edge-to-edge —
          poori wajah `components/keyboard-view.tsx` par likhi hai), aur ek
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
          {/* ── Logo: peeche se, ghoomta hua aage aata hua ── */}
          <Animated.View
            style={{
              opacity: enter,
              transform: [
                { perspective: 800 },
                {
                  rotateX: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["24deg", "0deg"],
                  }),
                },
                {
                  rotateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-28deg", "0deg"],
                  }),
                },
                { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) },
                { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
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

          {/* Title se neeche ka sab ek saath, logo/naam ke thoda baad. */}
          <Animated.View
            style={{
              alignSelf: "stretch",
              alignItems: "center",
              opacity: rest,
              transform: [
                { translateY: rest.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              ],
            }}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{sub}</Text>

            {/*
              Asli input chhupa hua hai; dikhne wale dots neeche hain. Isse har
              platform par apne aap secure keyboard aur paste-block milta hai,
              bina apna keypad likhe.

              ⚠️ Input par `pointerEvents="none"` — poori wajah `inputRef` ke
              upar likhi hai. Chhoti si baat lagti hai par yahi wo cheez thi
              jiski wajah se pehli tap par keyboard nahi aata tha.
            */}
            <Pressable
              style={styles.dots}
              onPress={() => inputRef.current?.focus()}
              hitSlop={20}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <TextInput
                // `key` — mode badalne par naya input. Ek hi input ka
                // `secureTextEntry` beech me badalna Android par IME ko uljha
                // deta hai (kabhi keyboard hi nahi aata).
                key={isCodeStep ? "code" : "pin"}
                ref={inputRef}
                value={isCodeStep ? code : pin}
                onChangeText={
                  isCodeStep ? onChangeCode : mode === "resetNew" ? onChangeNewPin : onChangePin
                }
                keyboardType="number-pad"
                secureTextEntry={!isCodeStep}
                editable={!checking}
                maxLength={slots}
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
                hitSlop={10}
                style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
              >
                <Ionicons name="mail-outline" size={15} color={tc.inkSoft} />
                <Text style={styles.linkBtnText}>
                  {sending ? l.resetSending : l.forgotPin}
                </Text>
              </Pressable>
            )}

            {isCodeStep && (
              <>
                <Pressable
                  onPress={() => void askForCode()}
                  disabled={resendIn > 0 || sending}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.linkBtn,
                    resendIn > 0 && { opacity: 0.5 },
                    pressed && styles.linkBtnPressed,
                  ]}
                >
                  <Ionicons name="refresh" size={15} color={tc.inkSoft} />
                  <Text style={styles.linkBtnText}>
                    {resendIn > 0 ? tpl(l.resetResendIn, { s: resendIn }) : l.resetResend}
                  </Text>
                </Pressable>
                <Pressable onPress={backToPin} hitSlop={10} style={styles.cancel}>
                  <Text style={styles.cancelText}>{c.cancel}</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  /**
   * Screen bhar ka naram gol — entry animation ka "poori screen" wala hissa.
   *
   * ⚠️ Rang jaan-boojh ke bahut halka hai (5% / 8%). Yahan tez rang daalne par
   * lock screen ek rangeen poster ban jaati hai aur uska asli kaam — 4 dots
   * saaf dikhna — dab jaata hai. Ye ek ehsaas hai, ek design nahi.
   *
   * `top/left: "50%"` + ulta margin = beech me. RN me `transform: translate(-50%)`
   * chalta nahi (percentage transform nahi hote), isliye margin se centre karte
   * hain aur naap component me nikalti hai.
   */
  aura: {
    position: "absolute",
    top: "42%",
    left: "50%",
    backgroundColor: "rgba(194,90,55,0.05)",
  },
  auraInner: {
    position: "absolute",
    top: "42%",
    left: "50%",
    backgroundColor: "rgba(194,90,55,0.08)",
  },
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
  /**
   * Dots ka poora patta — ab ek asli, dikhne wala tap-target.
   *
   * ⚠️ Pehle ye ek khaali row thi. User ko dikhta hi nahi tha ki "dabana kahan
   * hai" — sirf chaar chhote gol the, aur unke beech ki khaali jagah bhi tap ka
   * hissa thi ye kisi ko pata nahi chalta tha. Ab ek halka sa patta hai jo saaf
   * kehta hai "yahan dabao", aur uski oonchai (68) angoothe ke liye kaafi hai.
   */
  dots: {
    marginTop: 28,
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    justifyContent: "center",
    // Tap ka nishana bada — chhote dots par ungli aksar chook jaati hai aur
    // keyboard wapas nahi aata.
    minHeight: 68,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  /**
   * Input dikhta nahi — aur tap bhi nahi leta.
   *
   * ⚠️ `pointerEvents="none"` component me lagta hai (yahan style me nahi), aur
   * wahi is screen ka asli fix hai. Poori wajah `inputRef` ke upar likhi hai.
   */
  hiddenInput: { position: "absolute", opacity: 0, height: 60, width: "100%" },
  /**
   * ⚠️ 15px → 21px → 26px.
   *
   * Shikayat do baar aayi, aur doosri baar bhi wahi thi: "wo thoda bada karo".
   * Tap ka nishana pehle hi theek ho chuka tha; baat hamesha DIKHNE ki thi. 26px
   * par ek nazar me ginta ja sakta hai ki kitne ank pad chuke hain — aur ye app
   * un logon ke liye bani hai jinki nazar kamzor hai.
   */
  dot: {
    height: 26,
    width: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: c.line,
    backgroundColor: c.cream,
  },
  // 6 ank ke code me 4 wale naap se pankti chhoti screen par bahar nikal jaati.
  /** 6-ank wala reset code — utne dots ek line me aane chahiye, isliye thode chhote. */
  dotSmall: { height: 20, width: 20, borderRadius: 10 },
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
  /**
   * "PIN bhool gaye" / "Dobara bhejo" — link nahi, BUTTON.
   *
   * ⚠️ Shikayat: "bahut jaha jo h anchor tag jaisa lag raha h app me jaise pin
   * screen me jo h pin bhool gaye ho otp daalo". Wo bilkul sahi tha — yahan ek
   * underline wala neela-jaisa text pada tha, seedha web ke `<a>` jaisa. Phone
   * par underline wala text ek link ki tarah padha hi nahi jaata; wo ya to
   * galti lagta hai ya us par ungli hi nahi padti (nishana sirf akshar jitna
   * hota hai).
   *
   * Ab ye ek saaf, chhui ja sakne wali cheez hai: icon + text, 44px se ooncha
   * (Android/iOS dono ka minimum tap-target), apne kinare ke saath.
   */
  linkBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  linkBtnPressed: { backgroundColor: c.creamDeep },
  linkBtnText: { fontSize: 13.5, fontWeight: "700", color: c.inkSoft, textAlign: "center" },
  cancel: { marginTop: 10, minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  cancelText: { fontSize: 14, fontWeight: "700", color: c.inkSoft },
}));
