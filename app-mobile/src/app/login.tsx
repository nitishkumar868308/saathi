import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import SaathiLogo from "@/components/saathi-logo";
import { signInEmail, signUpEmail, signInGoogle } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { savePendingReferral } from "@/lib/referral-pending";
import { useOffers } from "@/lib/use-offers";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { deviceOwner, type DeviceOwner } from "@/lib/device";

/**
 * Owner-warning card ka ek point — icon, heading, aur wajah.
 *
 * Login ke BAAD wale modal (`components/device-owner-warning.tsx`) me bilkul
 * yahi dikhta hai. Dono ek hi dictionary se padhte hain, isliye baat kabhi do
 * jagah do tarah se nahi likhi jaati.
 */
function OwnerPoint({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const tc = useColors();
  const styles = useStyles();
  return (
    <View style={styles.ownerPoint}>
      <View style={styles.ownerPointIcon}>
        <Ionicons name={icon} size={16} color={tc.terracotta} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ownerPointTitle}>{title}</Text>
        <Text style={styles.ownerPointBody}>{body}</Text>
      </View>
    </View>
  );
}

/** Password ki hadd. */
const MIN_PASSWORD = 6;
/**
 * ⚠️ 72 ki hadd Supabase/bcrypt ki hai, hamari pasand nahi.
 *
 * bcrypt 72 BYTE ke baad sab kuch chup-chaap kaat deta hai. Pehle yahan koi rok
 * hi nahi thi, aur uska natija ye tha ki 80 character ka password banane wala
 * baad me apne pehle 72 character se bhi login kar jaata — bina kisi ko pata
 * chale ki aakhri 8 kabhi gine hi nahi gaye.
 */
const MAX_PASSWORD = 72;

/**
 * Password ki asli lambai — BYTE me, character me nahi.
 *
 * ⚠️ Ye farak yahan sirf ilmi baat nahi hai. bcrypt 72 **byte** par kaat-ta hai,
 * par `pw.length` **character** ginta hai, aur UTF-8 me dono ek jaise sirf
 * angrezi me hote hain:
 *
 *   • "abcd"     → 4 character, 4 byte
 *   • "पासवर्ड"   → 7 character, 21 byte  (har akshar 3 byte)
 *   • "🔑"        → 2 character, 4 byte
 *
 * Yaani 30 akshar ka Hindi password 90 byte ka hota hai — bcrypt uske aakhri 18
 * byte chup-chaap phenk deta hai, aur wo rok jo iske liye hi likhi gayi thi
 * (`password.length > MAX_PASSWORD`) kabhi chalti hi nahi thi. Wahi baat
 * `maxLength={MAX_PASSWORD}` par bhi lagti thi: wo 72 AKSHAR par rokta tha,
 * yaani 216 byte tak aaram se jaane deta tha.
 *
 * Aur ye app Hindi/Hinglish bolne walon ke liye hi bani hai, isliye ye soorat
 * virli nahi — aam hai.
 *
 * ⚠️ Yahan `new Blob([pw]).size` JAAN-BOOJH KE nahi hai, jabki wo sabse chhota
 * likhne ka tareeka hota. Do wajah:
 *
 *   • React Native ka `Blob` sirf JS ka object nahi hai — wo `NativeBlobModule`
 *     ko bula kar data NATIVE memory me registry ke andar rakh deta hai. Yaani
 *     user ka poora password, saaf shakl me, ek aur jagah pad jaata — sirf uski
 *     lambai naapne ke liye. Password ki har extra copy ek bekaar khatra hai.
 *   • Wo native module par tikta hai (`invariant(NativeBlobModule)`), aur ek
 *     saadhi si ginti ko kisi native cheez par tikana bilkul zaroori nahi.
 *
 * `for...of` string ko CODE POINT se ghumta hai (`for (i...)` ki tarah UTF-16
 * unit se nahi), isliye emoji jaise surrogate pair bhi ek hi baar, poore 4 byte
 * gine jaate hain.
 */
function passwordBytes(pw: string): number {
  let n = 0;
  for (const ch of pw) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/** apkasaathi.com/r/CODE ya koi bhi ?ref=CODE se code nikalta hai. */
function referralFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const { path, queryParams } = Linking.parse(url);
    const q = queryParams?.ref;
    if (typeof q === "string" && q.trim()) return q.trim().toUpperCase();
    const m = path?.match(/^r\/([A-Za-z0-9]+)$/);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Password ki takat: 0 = kamzor, 1 = theek, 2 = majboot. */
function passwordScore(pw: string): 0 | 1 | 2 {
  if (pw.length < MIN_PASSWORD) return 0;
  /**
   * Ginti "kitni tarah ke character hain" par hai, kisi lambi rule-list par
   * nahi — aur ye soch samajh ke hai.
   *
   * Ye app bujurg logon ke liye bani hai. "Ek capital, ek number aur ek symbol
   * ZAROORI hai" jaisi rok wahan sabse ulta asar deti hai: log haar ke
   * "Password@123" jaisa kuch likh dete hain, jo yaad bhi nahi rehta aur
   * majboot bhi nahi hota. Isliye yahan ROK nahi hai — sirf ek imaandaar
   * naap, aur ek line jo batati hai ki behtar kaise karein.
   */
  const kinds =
    (/[a-z]/.test(pw) ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  /**
   * Lambai apne aap me sabse badi takat hai — 14+ ka passphrase har "Abc@1" se
   * behtar hai, chahe usme ek hi tarah ke character hon.
   *
   * ⚠️ Ye line theek yahi kehti thi, par code iske ULTA chalta tha: shart
   * `pw.length >= 14 && kinds >= 2` thi, yaani "ek hi tarah ke character hon"
   * wali soorat me hi wo shart fail ho jaati. Neeche ki dono line bhi `kinds`
   * maangti hain, isliye `chaipatti sardiyon me` jaisa 20 akshar ka passphrase
   * — jo is app ke user ke liye sabse acha password HAI — seedha 0 par gir kar
   * "Kamzor" dikhta tha.
   *
   * Aur wo sirf ek label nahi tha: user ko "Kamzor" dikha kar hum use theek us
   * "Password@123" ki taraf dhakel rahe the jise ye poora function jaan-boojh ke
   * rokna chahta hai (upar wali wajah dekho).
   */
  if (pw.length >= 14) return 2;
  if (kinds >= 3 && pw.length >= 10) return 2;
  if (kinds >= 2 && pw.length >= 8) return 1;
  /**
   * Lamba, par ek hi tarah ke character.
   *
   * Bina is line ke 13 akshar ka passphrase "Kamzor" (0) hota aur 14 akshar ka
   * seedha "Majboot" (2) — ek akshar par do darje ki chhalang, jo user ko sirf
   * uljhati hai. Ab beech ka rasta bhi hai.
   */
  if (pw.length >= 10) return 1;
  return 0;
}

export default function Login() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const offers = useOffers();
  const { login: l, deviceOwner: d } = useT();
  const [mode, setMode] = useState<"login" | "signup">("login");
  /**
   * Ye phone pehle se kisi ke naam par set hai kya.
   *
   * Login se pehle poochna zaroori hai: baad me batane par banda apni ID daal
   * chuka hota hai, aur usi lamhe purane user ki notification band ho jaati hai.
   * Fail ho to `null` — chetavni na dikhna login rokne se kahin behtar hai.
   */
  const [owner, setOwner] = useState<DeviceOwner | null>(null);
  /** Patti par tap — poori baat wala card. */
  const [ownerDetails, setOwnerDetails] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Password hamesha chhupa hua shuru hota hai — user khud aankh dabaye to dikhe.
  const [showPassword, setShowPassword] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const pwScore = passwordScore(password);

  useEffect(() => {
    let alive = true;
    void deviceOwner().then((o) => {
      // `isMe` yahan kabhi sach nahi hota (login screen par session hai hi
      // nahi), par guard rakha hai — logout ke turant baad ka lamha bhi isi
      // screen par guzarta hai.
      if (alive && o && !o.isMe) setOwner(o);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Share-link (apkasaathi.com/r/CODE) se app khule to code apne aap bhar do.
  const url = Linking.useURL();
  useEffect(() => {
    const code = referralFromUrl(url);
    if (code) {
      setRefCode(code);
      setMode("signup");
    }
  }, [url]);

  async function submit() {
    if (loading) return;
    if (mode === "signup" && name.trim().length < 2) {
      return toast.show(l.nameRequired, "info");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return toast.show(l.badEmail, "info");
    }
    if (password.length < MIN_PASSWORD) {
      return toast.show(l.shortPassword, "info");
    }
    // Byte me — bcrypt bhi byte hi ginta hai (upar `passwordBytes` par wajah).
    if (passwordBytes(password) > MAX_PASSWORD) {
      return toast.show(l.longPassword, "info");
    }
    try {
      setLoading(true);
      if (mode === "signup") {
        // Login hone ke baad auth-provider isko apply karega.
        await savePendingReferral(refCode);
        const { needsConfirm } = await signUpEmail(email.trim(), password, name.trim());
        if (needsConfirm) {
          toast.show(l.confirmSent, "success");
        } else {
          toast.show(l.welcomeNew, "success");
        }
      } else {
        await signInEmail(email.trim(), password);
        toast.show(l.welcomeBackToast, "success");
      }
    } catch (e: any) {
      toast.show(e?.message || l.somethingWrong, "error");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    if (googleLoading) return;
    try {
      setGoogleLoading(true);
      // Referral code ho to hamesha save karo — naya Google user chahe "login"
      // dabaye, uska referral + welcome (server-side) miss na ho.
      if (refCode.trim()) await savePendingReferral(refCode);
      await signInGoogle();
    } catch (e: any) {
      if (e?.message !== "cancelled") {
        // Google flow ke technical errors user ko localized dikhao — lib ke
        // raw (Hinglish) messages leak na ho.
        toast.show(l.googleFailed, "error");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logo}>
            <SaathiLogo size={72} radius={24} />
          </View>
          <Text style={styles.title}>
            {mode === "login" ? `${l.welcomeBack} 🙂` : l.signupTitle}
          </Text>
          <Text style={styles.sub}>{mode === "login" ? l.loginSub : l.signupSub}</Text>

          {/*
            Ye phone pehle se kisi aur ke naam par set hai — login se PEHLE.

            ⚠️ Ye patti pehle ek saada `View` thi, aur uska text kehta tha "tap
            karke poori baat padho" — jabki tap par kuch hota hi nahi tha. User
            dabata tha, kuch nahi hota tha, aur wo baat ek bekaar si chetavni
            bankar reh jaati thi (wahi jo screenshot me dikhi). Ab wo sach me
            khulti hai: wahi teen baatein jo login ke BAAD wala modal dikhata
            hai, yahan login se PEHLE — jo asal me sahi waqt hai, kyunki uske
            baad banda apni ID daal chuka hota hai aur nuksaan ho chuka hota hai.
          */}
          {!!owner && (
            <Pressable
              onPress={() => setOwnerDetails(true)}
              style={({ pressed }) => [styles.ownerNote, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <View style={styles.ownerIcon}>
                <Ionicons name="phone-portrait" size={17} color={tc.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerTitle}>{d.bannerTitle}</Text>
                <Text style={styles.ownerBody}>
                  {tpl(d.bannerBody, { who: owner.email ?? owner.name ?? "" })}
                </Text>
                <View style={styles.ownerMore}>
                  <Text style={styles.ownerMoreText}>{d.bannerMore}</Text>
                  <Ionicons name="chevron-forward" size={13} color={tc.terracotta} />
                </View>
              </View>
            </Pressable>
          )}

          {/* Poori baat — wahi teen point jo login ke baad wala modal dikhata
              hai. Ek hi dictionary se, taaki dono jagah ek hi baat rahe. */}
          <Modal
            visible={ownerDetails}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setOwnerDetails(false)}
          >
            <View style={styles.ownerBackdrop}>
              <View style={styles.ownerCard}>
                <View style={styles.ownerCardIcon}>
                  <Ionicons name="phone-portrait" size={24} color={tc.terracotta} />
                </View>
                <Text style={styles.ownerCardTitle}>{d.title}</Text>
                <ScrollView
                  style={{ flexShrink: 1 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.ownerCardBody}>
                    {owner?.name
                      ? tpl(d.intro, { name: owner.name, email: owner.email ?? "" })
                      : tpl(d.introNoName, { email: owner?.email ?? "" })}
                  </Text>
                  <OwnerPoint icon="notifications" title={d.notifTitle} body={d.notifBody} />
                  <OwnerPoint icon="sparkles" title={d.aiTitle} body={d.aiBody} />
                  <OwnerPoint icon="gift" title={d.rewardTitle} body={d.rewardBody} />
                  <View style={styles.ownerAdvice}>
                    <Ionicons name="bulb" size={16} color={tc.terracotta} />
                    <Text style={styles.ownerAdviceText}>{d.advice}</Text>
                  </View>
                </ScrollView>
                <Pressable
                  onPress={() => setOwnerDetails(false)}
                  style={({ pressed }) => [styles.ownerCardBtn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.ownerCardBtnText}>{d.ok}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          {/* name (signup only) */}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>{l.name}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={l.namePlaceholder}
                placeholderTextColor={tc.inkSoft}
                autoCapitalize="words"
                style={styles.input}
              />
            </>
          )}

          {/* email */}
          <Text style={styles.label}>{l.email}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={l.emailPlaceholder}
            placeholderTextColor={tc.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
          />

          {/* password — default chhupa hua, aankh dabao to dikhta hai */}
          <Text style={styles.label}>{l.password}</Text>
          <View style={styles.passWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={l.passwordPlaceholder}
              placeholderTextColor={tc.inkSoft}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              /**
               * ⚠️ Signup par `new-password` — `current-password` nahi.
               *
               * Iske bina Android ka autofill naye account ke form me bhi purana
               * SAVED password thop deta tha. User ne kuch bhara nahi hota tha
               * aur khaana bhara hua milta tha — theek wahi "apne aap bhar
               * jaata hai" wala shak.
               */
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              textContentType={mode === "signup" ? "newPassword" : "password"}
              /**
               * ⚠️ Ye sirf ek motі chhat hai, asli rok NAHI.
               *
               * `maxLength` AKSHAR ginta hai aur bcrypt BYTE — Hindi me ek akshar
               * teen byte ka hota hai, isliye ye 72 aksharon me 216 byte tak jaane
               * de sakta hai. Asli jaanch `submit()` me `passwordBytes()` se hoti
               * hai, jahan user ko saaf message bhi milta hai. Ise yahan se ghata
               * dena galat hoga: tab 72 akshar ka angrezi password — jo bilkul
               * theek hai — bina kuch kahe kat jaata.
               */
              maxLength={MAX_PASSWORD}
              style={[styles.input, styles.passInput]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? l.hidePassword : l.showPassword}
              style={({ pressed }) => [styles.eye, pressed && { opacity: 0.6 }]}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={tc.inkSoft}
              />
            </Pressable>
          </View>

          {/**
           * Password kitna majboot hai — sirf SIGNUP par.
           *
           * ⚠️ Ye ek ROK nahi hai, aur wo jaan-boojh ke hai. Ye app bujurg logon
           * ke liye bani hai; "ek capital, ek number aur ek symbol ZAROORI hai"
           * jaisi shart wahan ulta asar deti hai — log haar ke "Password@123"
           * likh dete hain, jo na yaad rehta hai na majboot hota hai.
           *
           * Isliye sirf ek imaandaar naap aur ek line jo raasta batati hai.
           * Login par nahi dikhata: wahan password pehle se bana hua hai, aur
           * uspar ab "kamzor" likhna sirf chidhana hai — user kuch kar bhi nahi
           * sakta.
           */}
          {mode === "signup" && password.length > 0 && (
            <View style={styles.pwWrap}>
              <View style={styles.pwBar}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.pwSeg,
                      i <= pwScore && {
                        backgroundColor:
                          pwScore === 0 ? tc.danger : pwScore === 1 ? tc.amber : tc.sage,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                style={[
                  styles.pwLabel,
                  { color: pwScore === 0 ? tc.danger : pwScore === 1 ? tc.amber : tc.sage },
                ]}
              >
                {pwScore === 0 ? l.pwWeak : pwScore === 1 ? l.pwOk : l.pwStrong}
              </Text>
            </View>
          )}
          {mode === "signup" && password.length > 0 && pwScore < 2 && (
            <Text style={styles.pwHint}>{l.pwHint}</Text>
          )}

          {/**
           * "Password bhool gaye?" — sirf login par.
           *
           * ⚠️ Ye link pehle tha hi nahi, aur uska matlab ye tha ki email se
           * bana account password bhoolte hi HAMESHA ke liye band ho jaata
           * tha. Google wale phir bhi andar aa jaate the; email wale apne hi
           * documents aur reminders se bahar khade reh jaate the, aur support
           * bhi kuch nahi kar sakta tha (password Supabase ke paas hashed hai,
           * hum use dekh hi nahi sakte).
           *
           * Signup par nahi dikhata — wahan abhi koi password hai hi nahi.
           */}
          {mode === "login" && (
            <Pressable
              onPress={() => router.push("/forgot-password" as never)}
              hitSlop={8}
              style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.forgotText}>{l.forgot}</Text>
            </Pressable>
          )}

          {/* referral code (signup only, optional; referrals band ho to nahi) */}
          {mode === "signup" && offers.referralsEnabled && (
            <>
              <Text style={styles.label}>
                {l.referralCode} <Text style={styles.optional}>({l.referralOptional})</Text>
              </Text>
              <TextInput
                value={refCode}
                onChangeText={(txt) => setRefCode(txt.toUpperCase())}
                placeholder={tpl(l.referralPlaceholderTpl, { d: offers.referralDays })}
                placeholderTextColor={tc.inkSoft}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
                style={styles.input}
              />
              <Text style={styles.refHint}>{l.referralHint}</Text>
            </>
          )}

          <Pressable
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.btn, (pressed || loading) && { opacity: 0.85 }]}
          >
            <Text style={styles.btnText}>{mode === "login" ? l.loginBtn : l.signupBtn}</Text>
          </Pressable>

          {/* divider */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>{l.or}</Text>
            <View style={styles.line} />
          </View>

          {/* google */}
          <Pressable
            onPress={google}
            disabled={googleLoading}
            style={({ pressed }) => [styles.googleBtn, (pressed || googleLoading) && { opacity: 0.85 }]}
          >
            {(
              <>
                <Ionicons name="logo-google" size={19} color="#DB4437" />
                <Text style={styles.googleText}>{l.google}</Text>
              </>
            )}
          </Pressable>

          {/* toggle */}
          <Pressable
            onPress={() => {
              /**
               * ⚠️ Mode badalte hi khaane SAAF — aur ye seedhi shikayat ka jawab
               * hai ("nayi registration me login details apne aap bhar jaate
               * hain, trust issue lagta hai").
               *
               * Pehle `setMode` sirf mode badalta tha aur `email`/`password`
               * waise ke waise pade rehte the. Yaani login form bhar ke "Naya
               * account banao" dabao — aur naye account ke form me kisi AUR ka
               * (ya apna purana) email-password bhara mile. User ke liye wo app
               * ka apne aap kuch bhar dena hai, aur wahi sabse zyada shak
               * paida karta hai.
               */
              setMode(mode === "login" ? "signup" : "login");
              setEmail("");
              setPassword("");
              setName("");
              setShowPassword(false);
            }}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {mode === "login" ? `${l.noAccount} ` : `${l.haveAccount} `}
              <Text style={styles.toggleLink}>
                {mode === "login" ? l.createAccount : l.loginInstead}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Login / Google — dono ke liye ek hi center overlay loader. */}
      <LoaderOverlay visible={loading || googleLoading} />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 440, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: { padding: 28, paddingTop: 48, flexGrow: 1, justifyContent: "center", ...CONTENT },
  logo: {
    height: 72,
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: c.terracotta,
    marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: "800", color: c.ink },
  sub: { marginTop: 8, fontSize: 15, color: c.inkSoft, lineHeight: 22 },
  ownerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  ownerIcon: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.14)",
  },
  ownerTitle: { fontSize: 14, fontWeight: "800", color: c.ink },
  ownerBody: { marginTop: 3, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },
  ownerMore: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 7 },
  ownerMoreText: { fontSize: 12.5, fontWeight: "800", color: c.terracotta },

  ownerBackdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  ownerCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "86%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 22,
  },
  ownerCardIcon: {
    height: 56,
    width: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  ownerCardTitle: {
    marginTop: 14,
    marginBottom: 10,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    color: c.ink,
  },
  ownerCardBody: { fontSize: 14, lineHeight: 21, color: c.inkSoft },
  ownerPoint: {
    flexDirection: "row",
    gap: 11,
    marginTop: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    padding: 12,
  },
  ownerPointIcon: {
    height: 32,
    width: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  ownerPointTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
  ownerPointBody: { marginTop: 3, fontSize: 12.5, lineHeight: 18.5, color: c.inkSoft },
  ownerAdvice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  ownerAdviceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: c.ink,
  },
  ownerCardBtn: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  ownerCardBtnText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: c.ink,
  },
  optional: { fontWeight: "500", color: c.inkSoft },
  refHint: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },
  forgot: { alignSelf: "flex-end", marginTop: 10, paddingVertical: 4 },
  forgotText: { fontSize: 13.5, fontWeight: "700", color: c.terracotta },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: c.ink,
    fontSize: 15,
  },
  pwWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  pwBar: { flexDirection: "row", gap: 4, flex: 1 },
  pwSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.line },
  pwLabel: { fontSize: 12, fontWeight: "800", minWidth: 62, textAlign: "right" },
  pwHint: { marginTop: 7, fontSize: 12, lineHeight: 17, color: c.inkSoft },

  passWrap: { position: "relative", justifyContent: "center" },
  // Text aankh ke neeche na chala jaaye.
  passInput: { paddingRight: 52 },
  eye: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    marginTop: 24,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  btnText: { color: c.white, fontWeight: "700", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: c.line },
  or: { fontSize: 13, color: c.inkSoft, fontWeight: "600" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  googleText: { fontSize: 15, fontWeight: "700", color: c.ink },
  toggle: { marginTop: 24, alignItems: "center" },
  toggleText: { fontSize: 14.5, color: c.inkSoft },
  toggleLink: { color: c.terracotta, fontWeight: "700" },
}));
