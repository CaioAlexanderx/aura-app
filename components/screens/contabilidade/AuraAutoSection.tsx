import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { AutoFeature } from "./types";

type Props = { features: AutoFeature[] };

export function AuraAutoSection({ features }: Props) {
  if (features.length === 0) return null;
  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.dot} />
        <Text style={s.title}>A Aura cuida automaticamente</Text>
      </View>
      <View style={s.card}>
        {features.map((f, i) => (
          <View key={f.name} style={[s.row, i < features.length - 1 && s.rowBorder]}>
            <View style={s.iconWrap}><Text style={s.icon}>{f.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{f.name}</Text>
              <Text style={s.desc}>{f.desc}</Text>
            </View>
            <Text style={s.active}>Ativo</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.green },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: Colors.green + "33" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 14, fontWeight: "800", color: Colors.green },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  desc: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginTop: 2 },
  active: { fontSize: 10, color: Colors.green, fontWeight: "700", textTransform: "uppercase" },
});

export default AuraAutoSection;
