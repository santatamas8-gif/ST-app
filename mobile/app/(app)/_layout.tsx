import { Redirect, Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: "Home" }} />
      <Tabs.Screen name="wellness" options={{ title: "Wellness", tabBarLabel: "Wellness" }} />
      <Tabs.Screen name="rpe" options={{ title: "RPE", tabBarLabel: "RPE" }} />
      <Tabs.Screen name="profil" options={{ title: "Profile", tabBarLabel: "Profile" }} />
    </Tabs>
  );
}
