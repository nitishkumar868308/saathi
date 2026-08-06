import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { makeStyles } from "@/theme/theme";
import { ScreenLoader } from "@/components/loader";
import { supabase } from "@/lib/supabase";

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
 */
export default function AuthCallback() {
  const styles = useStyles();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    type?: string;
  }>();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      let ok = false;
      try {
        if (supabase && params.code) {
          await supabase.auth.exchangeCodeForSession(String(params.code));
          ok = true;
        } else if (supabase && params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: String(params.access_token),
            refresh_token: String(params.refresh_token),
          });
          ok = true;
        }
      } catch {
        // ignore — gate login pe wapas bhej dega
      }
      // Recovery ka session ban gaya — ab naya password poocho.
      if (ok && String(params.type ?? "") === "recovery") {
        router.replace("/new-password" as never);
        return;
      }
      router.replace("/");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
