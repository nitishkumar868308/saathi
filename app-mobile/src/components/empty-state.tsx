import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";

/**
 * "Yahan abhi kuch nahi" — poore app me EK hi shakal.
 *
 * ⚠️ Pehle har screen apna empty state khud likhti thi, aur teenon alag nikle.
 * Sabse saaf farak yahi tha jo shikayat me aaya ("kahin center me, kahin start
 * se shuru"):
 *
 *   • Documents ka `emptyTitle` par `textAlign` tha hi nahi. Parent par
 *     `alignItems: "center"` hone se EK line wala title center dikhta tha, par
 *     jaise hi wo do line me tootta (lambi bhasha — Hindi me aksar, ya bade
 *     font size par) doosri line BAAYIN taraf se shuru ho jaati thi. Notes ka
 *     wahi title poora center rehta tha, kyunki wahan `textAlign: "center"`
 *     laga hua tha.
 *   • Title ka size aur weight bhi alag the — Notes 17/700, Documents 18/600.
 *   • Padding alag: Notes `paddingTop: 70`, Documents `paddingVertical: 48`.
 *
 * `alignItems: "center"` aur `textAlign: "center"` DO ALAG cheezein hain, aur
 * yahi galti sabse aam hai. Pehla box ko beech me rakhta hai; doosra box ke
 * ANDAR ki lines ko. Ek line wale text me dono ek jaise dikhte hain — isliye ye
 * bug tabhi pakda jaata hai jab text wrap kare.
 *
 * Ab teenon screen isi component se aati hain, to aisa farak dobara ban hi
 * nahi sakta.
 */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** Ek line samjhane ko. Optional — search ke khaali nateeje par bekaar hai. */
  body?: string;
  /** Neeche ka action button (jaise "Document add karo"). */
  children?: ReactNode;
}) {
  const tc = useColors();
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={29} color={tc.terracotta} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!body && <Text style={styles.body}>{body}</Text>}
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 30,
  },
  icon: {
    height: 66,
    width: 66,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  title: {
    marginTop: 16,
    fontSize: 17.5,
    fontWeight: "700",
    color: c.ink,
    // ⚠️ Parent ka `alignItems` kaafi NAHI hai — wo box ko center karta hai,
    // lines ko nahi. Do line wala title iske bina baayin taraf se shuru hota
    // hai. Yahi wo farak tha jo Documents me dikhta tha aur Notes me nahi.
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: c.inkSoft,
    textAlign: "center",
    // Bahut lambi line padhne me mushkil hoti hai — tablet par ye zaroori hai,
    // warna text poori chaudai me phail jaata hai.
    maxWidth: 320,
  },
}));

export default EmptyState;
