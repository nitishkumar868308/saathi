import { useEffect, useRef } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";

import { makeStyles } from "@/theme/theme";
import { ScreenLoader } from "@/components/loader";
import { supabase } from "@/lib/supabase";
import { getParams, pendingPasswordReset } from "@/lib/auth";

/**
 * Deep-link ka ek hi darwaza — do alag maqsad.
 *
 * Yahan do tarah ke link aate hain aur dono ka pehla kaam ek hi hai (token se
 * session banana), par uske BAAD ka raasta bilkul alag hai:
 *
 *   • Google login   → seedha app me.
 *   • Password reset → naya password poochna hai. Supabase apne recovery link
 *     par `type=recovery` bhejta hai, aur usi se ye farak pata chalta hai.
 *
 * ⚠️ `type` ko anadekha karna sabse chupa hua bug hota: reset link par tap
 * karke user seedha app me pahunch jaata, kabhi naya password set hi na karta,
 * aur agli baar login par phir wahi purana (bhoola hua) password maanga jaata.
 * Usse lagta ki reset chala hi nahi.
 *
 * ── Tokens QUERY me nahi, FRAGMENT me aate hain ─────────────────────────
 *
 * ⚠️ Yahi wo ek line thi jiski wajah se "Forgot password ka link kaam nahi
 * karta" wali shikayat aayi. Pehle sab kuch sirf `useLocalSearchParams()` se
 * padha jaata tha — aur wo QUERY STRING padhta hai, hash fragment ko poori
 * tarah gira deta hai.
 *
 * Supabase ka client implicit flow par hai (`lib/supabase.ts`), aur us flow me
 * recovery link aisa aata hai:
 *
 *     saathi://auth#access_token=…&refresh_token=…&type=recovery
 *              ↑ sab kuch YAHAN se, aur router ise dekhta hi nahi tha
 *
 * Natija: link par tap karo, app khule, aur kuch na ho. Na session, na naya
 * password ka sawaal — screen chup-chaap home par chali jaati thi. Ab poora URL
 * padha jaata hai (`getParams` query aur fragment dono se leta hai).
 */
export default function AuthCallback() {
  const styles = useStyles();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    type?: string;
    /** Supabase ne mana kar diya — token khatam/istemaal ho chuka. */
    error?: string;
    error_code?: string;
  }>();
  /**
   * Poora deep-link URL — fragment ke saath.
   *
   * Ye pehle render par `null` ho sakta hai (link app ke jaagne ke baad pahunchta
   * hai), isliye neeche ek chhota intezaar bhi hai.
   */
  const url = Linking.useURL();
  const router = useRouter();
  /** Ek hi baar chalna hai — `url` badalne par dobara nahi. */
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    // Query se jo mila (PKCE wale providers) + fragment se jo mila (Supabase ka
    // implicit flow). Fragment baad me padha jaata hai, isliye wahi aakhri sach.
    const fromUrl = url ? getParams(url) : {};
    const code = String(params.code ?? fromUrl.code ?? "");
    const access = String(params.access_token ?? fromUrl.access_token ?? "");
    const refresh = String(params.refresh_token ?? fromUrl.refresh_token ?? "");
    const type = String(params.type ?? fromUrl.type ?? "");
    /**
     * Supabase ne saaf-saaf MANA kiya hai — token khatam/istemaal ho chuka.
     *
     * ⚠️ Ye padhna zaroori hai, aur iske bina "reset link kaam hi nahi karta"
     * wali shikayat ka jawab kabhi nahi milta tha. Us soorat me link par tokens
     * hote hi nahi; uski jagah error aata hai:
     *
     *     saathi://auth#error=access_denied&error_code=otp_expired&error_description=…
     *
     * Purana code sirf tokens dhoondta tha, kuch na milne par chup-chaap `/` par
     * chala jaata tha, aur bina session ke gate use login par phenk deta tha.
     * User ke liye wo bilkul aisa dikhta tha jaise link ne kuch kiya hi nahi —
     * na koi wajah, na agla kadam.
     *
     * Sabse aam wajah ye hai ki email ka apna scanner (Gmail/Outlook) link ko
     * user se PEHLE khol chuka hota hai, aur recovery ka token ek hi baar chalta
     * hai. Poori list `lib/auth.ts` ke `verifyPasswordResetCode()` par likhi hai
     * — wahin uska ilaaj bhi hai (6-ank wala code).
     */
    const linkError = String(
      fromUrl.error_code ?? fromUrl.error ?? params.error_code ?? params.error ?? "",
    );

    const haveSomething = !!code || (!!access && !!refresh);

    /**
     * Abhi kuch nahi mila, par URL bhi abhi aaya hi nahi — thoda ruk jao.
     *
     * ⚠️ Bina is shart ke screen pehle hi render par "kuch nahi mila" maan ke
     * home bhej deti, aur fragment wale tokens do milli-second baad aakar bekaar
     * chale jaate — yaani bug theek karke bhi wahi bug rehta.
     *
     * Timeout isliye ki link sach me khaali bhi ho sakta hai (user ne app ko
     * kisi aur tarah se `saathi://auth` par bhej diya). Us soorat me yahan hamesha
     * ke liye atak jaana sabse bura hoga.
     */
    if (!haveSomething && !linkError && !url) {
      const t = setTimeout(() => {
        if (!handled.current) {
          handled.current = true;
          router.replace("/");
        }
      }, 2500);
      return () => clearTimeout(t);
    }

    handled.current = true;
    void (async () => {
      let ok = false;
      try {
        if (supabase && code) {
          await supabase.auth.exchangeCodeForSession(code);
          ok = true;
        } else if (supabase && access && refresh) {
          await supabase.auth.setSession({
            access_token: access,
            refresh_token: refresh,
          });
          ok = true;
        }
      } catch {
        // ignore — neeche wala faisla ise "link nahi chala" hi maanta hai
      }
      // Recovery ka session ban gaya — ab naya password poocho.
      if (ok && type === "recovery") {
        router.replace("/new-password" as never);
        return;
      }

      /**
       * Link se session bana hi nahi — user ko WAJAH aur agla kadam do.
       *
       * ⚠️ Yahan pehle seedha `router.replace("/")` tha, aur wahi "reset ka link
       * kaam nahi karta, app bas login maang leti hai" wali poori shikayat thi.
       * Bina session ke gate use login par bhej deta tha, aur user ke paas na
       * wajah hoti thi na koi doosra raasta — wo bas dobara link dabata rehta,
       * jo (ek baar chalne wale token ki wajah se) kabhi chalne wala hi nahi tha.
       *
       * `type` par bharosa nahi kiya ja sakta: jab Supabase mana karta hai to
       * jawab me sirf `error…` aata hai, `type=recovery` nahi. Isliye shart ye
       * hai — "recovery tha, YA link ne saaf mana kiya, YA kuch mila hi nahi" —
       * aur teenon soorat me sahi jagah ek hi hai: reset wali screen, khuli hui
       * wajah ke saath.
       *
       * Jinke paas session PEHLE SE hai (Google se login kiye hue) unke liye ye
       * raasta khulta hi nahi — unka `code`/`access_token` chal jaata hai aur wo
       * upar hi nikal jaate hain.
       */
      /**
       * ⚠️ `type` par akele bharosa nahi kiya ja sakta. Jab Supabase mana karta
       * hai to jawab me sirf `error…` aata hai, `type=recovery` nahi — yaani us
       * error ko dekh ke ye bataya hi nahi ja sakta ki link RESET ka tha ya
       * Google login ka. Isliye doosra saboot phone ke apne nishaan se aata hai
       * (`pendingPasswordReset`, poori wajah `lib/auth.ts` par likhi hai).
       */
      if (type === "recovery" || (await pendingPasswordReset())) {
        router.replace({
          pathname: "/forgot-password",
          // `expired` = "wo link ab nahi chalega" — screen isi se wajah wala box
          // kholti hai, jahan code wala doosra raasta bhi maujood hai.
          params: { expired: "1" },
        } as never);
        return;
      }
      router.replace("/");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <View style={styles.center}>
      <ScreenLoader />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.cream,
  },
}));
