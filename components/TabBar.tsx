import { ScrollView, StyleSheet, Pressable, Text } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  tabs: string[];
  active: number;
  onSelect: (i: number) => void;
};

export function TabBar({ tabs, active, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scroll} contentContainerStyle={s.row}>
      {tabs.map((tab, i) => (
        <Pressable key={tab} onPress={() => onSelect(i)} style={[s.tab, active === i && s.tabActive]}>
          <Text style={[s.label, active === i && s.labelActive]}>{tab}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 20 },
  row: { flexDirection: "row", gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  labelActive: { color: "#fff", fontWeight: "600" },
});
