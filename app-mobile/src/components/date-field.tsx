import { useState } from "react";
import { View, Text, Pressable, Platform, type ViewStyle, type StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

import { makeStyles, useColors } from "@/theme/theme";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { formatDate, fromIsoDate, toIsoDate } from "@/utils/date-format";

/**
 * Date chunne ka khaana — **type karke nahi, chun ke.**
 *
 * ⚠️ Ye component ek asli, aur poori duniya me failne wali, galti ko band karta
 * hai. Pehle expiry ek saada `TextInput` tha jiska placeholder `YYYY-MM-DD` tha,
 * aur user se wahi likhwaya jaata tha. Uske teen nuksan the:
 *
 *   1. **ISO koi nahi likhta.** India me log 15/08/2029 likhte hain, America me
 *      08/15/2029, Europe me 15.08.2029. `YYYY-MM-DD` sirf computer ki shakl
 *      hai. App sirf India ke liye nahi hai, aur wahan bhi ye ajeeb hi tha.
 *
 *   2. **Aadhi-adhoori date chup-chaap galat baith jaati thi.** "03/11" ka
 *      matlab India me 3 November hai aur America me 11 March. Ek galat expiry
 *      sabse mehngi galti hai — us document ka reminder galat din bajta hai aur
 *      kisi ko pata bhi nahi chalta ki wo kahan se aayi.
 *
 *   3. **29 Feb jaisi namumkin date.** Typing me wo aa jaati thi aur poore
 *      client se nikal ke Postgres par jaake girti thi. Picker me wo din maujood
 *      hi nahi hota — galti ho hi nahi sakti.
 *
 * Andar sab kuch ISO hi rehta hai (`value`/`onChange` dono `YYYY-MM-DD`), kyunki
 * DB, sorting aur cron usi par chalte hain. Bahar user ko hamesha uske PHONE ki
 * apni shakl dikhti hai.
 */
export function DateField({
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  style,
  invalid,
}: {
  /** 'YYYY-MM-DD' ya khaali string. */
  value: string;
  /** Nayi date 'YYYY-MM-DD' me. */
  onChange: (iso: string) => void;
  placeholder: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: StyleProp<ViewStyle>;
  /** Laal border — jaise beeti hui expiry. */
  invalid?: boolean;
}) {
  const tc = useColors();
  const styles = useStyles();
  const { common: c } = useT();
  const { locale } = useLocale();
  /** iOS par picker inline khulta hai (Android khud ka dialog dikhata hai). */
  const [iosOpen, setIosOpen] = useState(false);

  /**
   * Picker kis date par khule.
   *
   * Khaali khaane par AAJ — aur ye soch samajh ke hai. Expiry hamesha aage ki
   * hoti hai, aur user ko 1970 se scroll karwana sabse chidhchida raasta hai.
   */
  const current = fromIsoDate(value) ?? new Date();

  function pick(d?: Date) {
    if (!d) return;
    // ⚠️ `toIsoDate` (local) — `toISOString()` NAHI. Wo UTC me badalta hai aur
    // India me raat 12 se 5:30 ke beech chuni gayi date ek din peeche chali
    // jaati hai. Poori wajah `utils/date-format.ts` me likhi hai.
    onChange(toIsoDate(d));
  }

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        minimumDate,
        maximumDate,
        onChange: (_e, d) => pick(d),
      });
    } else {
      setIosOpen((v) => !v);
    }
  }

  return (
    <View>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.field,
          invalid && styles.fieldInvalid,
          pressed && { opacity: 0.85 },
          style,
        ]}
        accessibilityRole="button"
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={value ? tc.terracotta : tc.inkSoft}
        />
        <Text style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDate(value, locale) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={tc.inkSoft} />
      </Pressable>

      {iosOpen && Platform.OS === "ios" && (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={current}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_e, d) => pick(d)}
          />
          <Pressable onPress={() => setIosOpen(false)} style={styles.iosDone}>
            <Text style={styles.iosDoneText}>{c.done}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    // Height wahi jo TextInput ki thi — form ki lay na toote.
    paddingVertical: 15,
  },
  fieldInvalid: { borderColor: c.danger, backgroundColor: "rgba(178,59,59,0.07)" },
  text: { flex: 1, fontSize: 15, color: c.ink, fontWeight: "600" },
  placeholder: { color: c.inkSoft, fontWeight: "400" },
  iosPicker: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingBottom: 8,
  },
  iosDone: { alignSelf: "flex-end", paddingHorizontal: 18, paddingVertical: 10 },
  iosDoneText: { fontSize: 15, fontWeight: "700", color: c.terracotta },
}));
