import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router/js-stack";
import { useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/theme/colors";
import { ToastProvider } from "@/components/toast";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { syncNotifications } from "@/lib/notifications";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    const inAuthFlow = first === "login" || first === "auth";
    if (!session && !inAuthFlow) router.replace("/login");
    else if (session && first === "login") router.replace("/");
  }, [session, loading, segments, router]);

  // Reminders + document expiries OS me dobara schedule karo. Zaroori hai kyunki
  // scheduled notifications reinstall ke baad nahi bachti, aur doosre device pe
  // banaye gaye data ke liye kabhi bani hi nahi thi.
  const uid = session?.user?.id;
  useEffect(() => {
    if (uid) void syncNotifications();
  }, [uid]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="add-document" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-reminder" options={{ presentation: "modal" }} />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
