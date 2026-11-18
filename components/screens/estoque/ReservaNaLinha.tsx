// ============================================================
// AURA. — Estoque · reserva do Pedido na linha do produto (A4, p-63d)
//
// Mockup "Pedido separado de venda", parte 1 ("No Estoque"): selo azul
// "N reservado" e "X livres para vender". A quantidade da linha não muda:
// a peça reservada ainda está na prateleira. Sem reserva, nada aparece (o
// componente devolve null e a linha fica a de antes).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { IS_DARK_MODE, Colors } from "@/constants/colors";
import { livresParaVender, TEXTOS_DA_RESERVA as T } from "@/utils/reservaDoPedido";

export function ReservaNaLinha({ estoque, reservado, testID }: { estoque: number; reservado: number; testID?: string }) {
  if (!(reservado > 0)) return null;
  return (
    <View style={s.linha} testID={testID}>
      <View style={s.selo}><Text style={s.seloTxt}>{T.selo(reservado)}</Text></View>
      <Text style={s.livres}>{T.livres(livresParaVender(estoque, reservado))}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 },
  selo: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99, backgroundColor: "rgba(37,99,235,0.16)" },
  seloTxt: { fontSize: 11, fontWeight: "700", color: IS_DARK_MODE ? "#93c5fd" : "#1e40af" },
  livres: { fontSize: 12, color: Colors.ink2 },
});

export default ReservaNaLinha;
