import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";

export default function TabsLayout() {
  const tc = useColors();
  const { tabs } = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: tc.terracotta,
        tabBarInactiveTintColor: tc.inkSoft,
        tabBarStyle: {
          backgroundColor: tc.surface,
          borderTopColor: tc.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tabs.home,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: tabs.saathi,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: tabs.docs,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: tabs.alerts,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alarm" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: tabs.you,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
