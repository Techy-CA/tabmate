import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { colors } = useTheme();
  // Supabase's getSession() is async — isAuthenticated starts false until it
  // resolves, so redirecting on that alone would bounce an actually-logged-in
  // user back to /welcome on every refresh during that brief window.
  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.bg },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Groups", tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: "Activity", tabBarIcon: ({ color, size }) => <Feather name="activity" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
