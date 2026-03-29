import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

export default function ClientesScreen() {
  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.icon}>U</Text>
        <Text style={s.title}>Clientes</Text>
        <Text style={s.sub}>Em desenvolvimento</Text>
        <Text style={s.hint}>CRM com ficha completa, ranking e retencao.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 40, alignItems: "center", borderWidth: 1, borderColor: Colors.border, maxWidth: 400, width: "100%" },
  icon: { fontSize: 40, marginBottom: 16, color: Colors.violet3 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", marginBottom: 8 },
  sub: { fontSize: 14, color: Colors.violet3, fontWeight: "500", marginBottom: 8 },
  hint: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
});
