import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export function QuickAction({ ic, iconColor, label, onPress }: { ic: string; iconColor: string; label: string; onPress?: () => void }) {
  return (
    <Pressable style={s.btn} onPress={onPress}>
      <View style={[s.iw, { borderColor: iconColor + "33" }]}>
        <Icon name={ic as any} size={22} color={iconColor} />
      </View>
      <Text style={s.lb}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  btn: { alignItems: "center", gap: 8, minWidth: 72 },
  iw: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.bg3, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  lb: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textAlign: "center" },
});
