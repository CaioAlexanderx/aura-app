import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

export function DemoBanner() {
  const { isDemo } = useAuthStore();
  if (!isDemo) return null;
  return (
    <View style={s.banner}>
      <Text style={s.text}>Modo demonstrativo - dados ilustrativos</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  text: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
