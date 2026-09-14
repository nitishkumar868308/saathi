import { useRef } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Chipkaaye/aaye hue text me se code nikaalo.
 *
 * ⚠️ Sirf saare ank jod dena kaafi nahi: "+91 98xxx ka OTP 123456 hai" jaisa
 * SMS copy karke chipkaane par phone number ke ank aage aa jaate aur code galat
 * banta. Isliye pehle theek `length` ank ka lagataar tukda dhoondhte hain; na
 * mile tabhi saare ank jodte hain (jaise "123 456").
 */
function extractCode(text: string, length: number): string {
  const run = text.match(new RegExp(`(?:^|\\D)(\\d{${length}})(?:\\D|$)`));
  if (run) return run[1];
  return text.replace(/\D/g, "").slice(0, length);
}

/**
 * 6 ank ka code — ek jaisa, har jagah.
 *
 * ── Ye kyun bana ────────────────────────────────────────────────────────
 *
 * ⚠️ Shikayat: "jab wo modal ka popup aata h ki kisi aur device pe ho to waha
 * pe bhi sahi OTP wala aana chaiye — saare screen ka design aur layout sahi se
 * check karo".
 *
 * Wo bilkul sahi tha. App me code teen alag jagah maanga jaata hai — phone ka
 * OTP (`otp-modal`), naye phone ka approval (`device-approval-gate`), aur PIN
 * reset (`lock-screen`) — aur teenon alag dikhte the:
 *
 *   • `otp-modal` me ek chaudi input thi jisme `letterSpacing: 8` se ank
 *     "alag-alag" dikhne ki koshish ki gayi thi. Wo trick sirf tab chalti hai
 *     jab saare 6 ank pade hon; aadha bhara hua code beech me latakta hai aur
 *     ye batata hi nahi ki ab kaunse ank ki baari hai.
 *   • `device-approval-gate` me `letterSpacing: 10` wali doosri nakal.
 *   • `lock-screen` me gol dots.
 *
 * Ab ek hi component: 6 saaf khaane, jis khaane ki baari hai wo highlight, aur
 * peeche ek chhupi hui input jo SMS ka autofill bhi le leti hai.
 *
 * ⚠️ Tap ke DO raaste hain aur dono ka chalna jaan-boojh ke hai: khaanon ke
 * beech ungli seedha (dikhti na hone wali) input par padti hai aur native focus
 * ho jaata hai; kisi khaane ke UPAR padti hai to tap bahar wale Pressable tak
 * pahunchta hai aur wo `focus()` karta hai.
 *
 * ⚠️ Yahan input ko `pointerEvents="none"` mat karna aur ek se zyada input mat
 * rakhna. Do input ek doosre ke upar rakhna hi wo bug tha jo lock screen par
 * tha ("ek baar me sahi se nhi hota"): upar wala mara hua input tap kha jaata
 * tha aur kuch hota hi nahi tha.
 *
 * ⚠️ Shikayat: "otp dalne ka time aaya to copy & paste nahi kar paya". Do
 * wajah thi:
 *   • Input dikhti hi nahi (`opacity: 0`), isliye long-press par paste ka menu
 *     kabhi khulta hi nahi tha.
 *   • `maxLength` native hai — chipkaaya hua "Your OTP is 123456" JS tak
 *     pahunchne se PEHLE hi "Your O" me kat jaata tha, aur ank bachte hi nahi.
 * Ab `maxLength` nahi hai (kaatna `onChange` me hota hai), khaanon par
 * long-press se paste hota hai, aur neeche ek saaf "Paste" button hai.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  editable = true,
  /** SMS se apne aap bharne ke liye. Email wale code par `false`. */
  fromSms = true,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  editable?: boolean;
  fromSms?: boolean;
}) {
  const styles = useStyles();
  const tc = useColors();
  const t = useT();
  const ref = useRef<TextInput>(null);

  async function paste() {
    if (!editable) return;
    const text = await Clipboard.getStringAsync().catch(() => "");
    const code = extractCode(text ?? "", length);
    if (code) onChange(code);
  }

  return (
    <View style={styles.outer}>
      <Pressable
        onPress={() => ref.current?.focus()}
        onLongPress={() => void paste()}
        style={styles.wrap}
        hitSlop={12}
        accessibilityRole="button"
      >
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(txt) => {
            // ⚠️ Keyboard se paste pehle se bhare ank ke AAGE judta hai: "12" +
            // "123456" = "12123456", jo kaat ke "121234" (galat) ban jaata.
            // Isliye ek saath 2+ akshar aaye to sirf naya hissa dekhte hain.
            const added = txt.startsWith(value) ? txt.slice(value.length) : txt;
            onChange(extractCode(added.length > 1 ? added : txt, length));
          }}
          keyboardType="number-pad"
          editable={editable}
          autoFocus={autoFocus}
          // Android/iOS dono SMS se code khud bhar dete hain — ek bhi tap bachana
          // yahan sach me kaam ka hai.
          autoComplete={fromSms ? "sms-otp" : "off"}
          textContentType={fromSms ? "oneTimeCode" : "none"}
          style={styles.hidden}
          caretHidden
        />
        {Array.from({ length }).map((_, i) => {
          const ch = value[i];
          // "Abhi is khaane ki baari hai" — sirf tab jab code adhoora ho, warna
          // poora bhar jaane par ek khaana bevajah alag chamakta rehta hai.
          const active = i === value.length && value.length < length;
          return (
            <View key={i} style={[styles.cell, active && styles.cellActive, !!ch && styles.cellFull]}>
              <Text style={styles.digit}>{ch ?? ""}</Text>
            </View>
          );
        })}
      </Pressable>
      {editable && (
        <Pressable
          onPress={() => void paste()}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pasteBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="clipboard-outline" size={14} color={tc.terracotta} />
          <Text style={styles.pasteText}>{t.common.paste}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  outer: { alignItems: "center", gap: 10 },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    // ⚠️ 8, isse zyada nahi. 6 khaane + 5 gap chhote phone (320dp) par bhi ek
    // line me aane chahiye; gap bada karte hi aakhri khaana bahar nikal jaata
    // hai aur code adhoora dikhta hai.
    gap: 8,
  },
  hidden: { position: "absolute", opacity: 0, height: 56, width: "100%" },
  cell: {
    // `flex: 1` + `maxWidth` — chhoti screen par khaane sikud jaate hain, badi
    // screen (tablet) par bevajah phailte nahi.
    flex: 1,
    maxWidth: 54,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFull: { borderColor: c.terracotta, backgroundColor: c.surface },
  cellActive: { borderColor: c.terracotta, borderWidth: 2 },
  digit: { fontSize: 22, fontWeight: "800", color: c.ink },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pasteText: { fontSize: 13, fontWeight: "700", color: c.terracotta },
}));

export default OtpInput;
