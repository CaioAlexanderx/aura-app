import { Tabs } from "expo-router";
import { Colors } from "@/constants/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.bg2, borderTopColor: Colors.border },
        tabBarActiveTintColor:   Colors.violet3,
        tabBarInactiveTintColor: Colors.ink3,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Painel" }} />
    </Tabs>
  );
}
