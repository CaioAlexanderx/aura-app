// ============================================================
// AURA. — Estoque · reserva do Pedido e peças com clientes na linha (A4, C13)
//
// Mockup "Pedido separado de venda", parte 1 ("No Estoque"): selo azul
// "N reservado" e "X livres para vender". Mockup da Venda condicional: selo
// tracejado azul-petróleo "N com clientes" ao lado. A quantidade da linha não
// muda: a peça reservada ainda está na prateleira e a que está com cliente
// ainda é do estoque. Livres = estoque − com clientes − reservado. Sem reserva
// e sem peça com cliente, nada aparece (devolve null e a linha fica a de antes).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { IS_DARK_MODE, Colors } from "@/constants/colors";
import { livresParaVender, TEXTOS_DA_RESERVA as T } from "@/utils/reservaDoPedido";
import { livresDaPeca } from "@/utils/comClientes";
import { SeloComClientes } from "@/components/screens/pdv/SeloComClientes";
import { SeloParaResolver } from "@/components/screens/pdv/SeloParaResolver";

export function ReservaNaLinha({ estoque, reservado, comClientes = 0, paraResolver = 0, testID }: { estoque: number; reservado: number; comClientes?: number; paraResolver?: number; testID?: string }) {
  const temReserva = reservado > 0;
  const temComClientes = comClientes > 0;
  const temParaResolver = paraResolver > 0;
  if (!temReserva && !temComClientes && !temParaResolver) return null;
  // C16: livres = estoque − com clientes − reservado − para resolver.
  const livres = temComClientes || temParaResolver ? livresDaPeca(estoque, comClientes, reservado, paraResolver) : livresParaVender(estoque, reservado);
  return (
    <View style={s.linha} testID={testID}>
      {temComClientes && <SeloComClientes quantidade={comClientes} testID={testID ? testID.replace("reservado", "com-clientes") : undefined} />}
      {temParaResolver && <SeloParaResolver quantidade={paraResolver} testID={testID ? testID.replace("reservado", "para-resolver") : undefined} />}
      {temReserva && <View style={s.selo}><Text style={s.seloTxt}>{T.selo(reservado)}</Text></View>}
      <Text style={s.livres}>{T.livres(livres)}</Text>
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
