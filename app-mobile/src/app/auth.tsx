import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors } from "@/theme/colors";
import { ScreenLoader } from "@/components/loader";
import { supabase } from "@/lib/supabase";

// Google login ke baad yahan aata hai — token le ke session set karta hai.
export default function AuthCallback() {
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        if (supabase && params.code) {
          await supabase.auth.exchangeCodeForSession(String(params.code));
        } else if (supabase && params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: String(params.access_token),
            refresh_token: String(params.refresh_token),
          });
        }
      } catch {
        // ignore — gate login pe wapas bhej dega
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
});
