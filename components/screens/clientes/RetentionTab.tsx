import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

export function RetentionTab() {
  return (
    <View style={s.card}>
      <Text style={s.title}>Composição da base</Text>
      <Text style={s.desc}>As estatísticas de retenção serão calculadas automaticamente conforme você cadastrar clientes e registrar vendas.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  title: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 16 },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
});

export default RetentionTab;
