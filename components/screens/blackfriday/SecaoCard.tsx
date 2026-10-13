// ============================================================
// AURA. — Cartão de seção da página Black Friday (13/10/2026)
//
// Todas as seções têm o mesmo desenho: número, título, uma linha de "por
// que agora" e o conteúdo. A linha existe para o dono entender por que
// aquilo está na página AGORA — não é descrição da função.
// Mockup: docs/mockups/black-friday.html.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  numero: number;
  titulo: string;
  porQueAgora: string;
  testID: string;
  children: React.ReactNode;
};

export function SecaoCard({ numero, titulo, porQueAgora, testID, children }: Props) {
  return (
    <View style={s.card} testID={testID}>
      <View style={s.titulo}>
        <View style={s.numero}><Text style={s.numeroTxt}>{numero}</Text></View>
        <Text style={s.tituloTxt} accessibilityRole="header">{titulo}</Text>
      </View>
      <Text style={s.porQue} testID={testID + "-por-que"}>
        <Text style={s.porQueRotulo}>Por que agora: </Text>{porQueAgora}
      </Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, backgroundColor: Colors.bg3, padding: 20, marginBottom: 18 },
  titulo: { flexDirection: "row", alignItems: "center", gap: 10 },
  numero: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violetD },
  numeroTxt: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  tituloTxt: { fontSize: 19, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2, flexShrink: 1 },
  porQue: { fontSize: 13, color: Colors.ink3, lineHeight: 19, marginTop: 6, marginBottom: 16, maxWidth: 720 },
  porQueRotulo: { color: Colors.violet3, fontWeight: "600" },
});
