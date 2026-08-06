import type { ReactNode } from "react";
import { View, Text, Pressable, Modal, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles } from "@/theme/theme";

/**
 * Neeche se uthne wala sheet — poore app me ek hi.
 *
 * ⚠️ Pehle har screen apna sheet khud likhti thi, aur teenon me bilkul wahi
 * teen bug the:
 *
 *  1. **Phone ke button sheet ko kha jaate the.** `paddingBottom` ek tay 34px
 *     tha. Un phones par jinme 3-button wala navigation bar hai (Samsung ka
 *     ||| ○ < ), wo bar hi ~48px ka hota hai — yaani aakhri option us bar ke
 *     NEECHE chala jaata tha. "Bhasha" wale sheet me "English" is tarah aadha
 *     kata hua dikhta tha, aur use dabana namumkin tha. Gesture-nav wale phone
 *     par kabhi dikha hi nahi, isliye ye bug bahut der tak chhupa raha. Ab
 *     bottom padding `useSafeAreaInsets()` se aati hai — har phone apna sach
 *     khud batata hai.
 *
 *  2. **Lambi list ke liye koi scroll nahi tha.** Sheet jitna chahe utna lamba
 *     ho jaata tha aur upar se bahar nikal jaata. Chhoti screen (ya bada font
 *     size, ya landscape) par upar ke options pahunch se hi bahar the. Ab
 *     sheet screen ki 80% oonchai par ruk jaata hai aur andar scroll hota hai.
 *
 *  3. **Parda theme ke hisaab se nahi tha.** `rgba(46,40,35,0.5)` hardcoded
 *     tha, jo dark mode me gehre page par bilkul dikhta hi nahi tha — sheet
 *     hawa me tairta hua lagta tha.
 *
 * Aur `statusBarTranslucent` + `navigationBarTranslucent` dono zaroori hain:
 * inke bina Android par parda status bar aur nav bar ke neeche nahi jaata, aur
 * sheet ke upar-neeche do bhadde safed/kaale patte dikhte hain.
 */
export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              // Phone ke navigation bar ke UPAR khatam ho. 16 = normal padding;
              // inset uske upar. Gesture-nav par inset ~0-24, 3-button par ~48.
              paddingBottom: 16 + insets.bottom,
              // Screen ki 85% se zyada kabhi nahi — warna lambi list upar se
              // bahar nikal jaati hai aur pehle option tak pahunch hi nahi.
              maxHeight: height * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
          <ScrollView
            showsVerticalScrollIndicator={false}
            // Sheet ke andar ka content chhota ho to scroll ki zaroorat nahi —
            // ye use apni oonchai lene deta hai (warna wo poori maxHeight ghere
            // rakhta aur teen option wala sheet aadhi screen kha jaata).
            bounces={false}
            contentContainerStyle={styles.body}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    // Theme-aware — light par 45% garam-kaala, dark par 72%.
    backgroundColor: c.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line,
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: c.ink },
  sub: { marginTop: 4, fontSize: 13.5, color: c.inkSoft, lineHeight: 19 },
  /**
   * Andar ke content ke beech ka faasla yahan se NAHI aata (`gap` nahi hai).
   *
   * Callers apne option rows par pehle se `marginTop` lagate hain; yahan gap
   * jodne par dono jud ke dogna faasla ban jaata hai aur sheet bekaar me lamba
   * ho jaata hai. Spacing ka maalik ek hi hona chahiye — wo caller hai.
   */
  body: { paddingTop: 4, paddingBottom: 4 },
}));

export default BottomSheet;
