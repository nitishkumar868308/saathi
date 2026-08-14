import { useRef } from "react";
import { View, Text, TextInput, Pressable } from "react-native";

import { makeStyles } from "@/theme/theme";

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
  const ref = useRef<TextInput>(null);

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      style={styles.wrap}
      hitSlop={12}
      accessibilityRole="button"
    >
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
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
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
}));

export default OtpInput;
