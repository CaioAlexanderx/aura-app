// ============================================================
// AURA Studio · Selo de pagamento na fila de pedidos (26/09/2026)
//
// A1/LJ-30 do QA da lojista: nem o hub de Pedidos nem o resumo da Loja
// Digital distinguiam o Pix ainda não pago do pago, e o pedido com
// comprovante esperando conferência se perdia na lista. Selo discreto,
// só quando há algo a saber do pagamento; a regra mora em
// ./pagamentoDoPedido (seloDoPagamentoNaFila).
// ============================================================
import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { seloDoPagamentoNaFila } from "./pagamentoDoPedido";

type Item = Parameters<typeof seloDoPagamentoNaFila>[0];

export function SeloDoPagamento({ item }: { item: Item }) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const selo = seloDoPagamentoNaFila(item);
  if (!selo) return null;
  const atencao = selo.tom === "atencao";
  return (
    <View
      style={[s.selo, atencao ? { backgroundColor: t.warningSoft } : { backgroundColor: t.bgSoft }]}
      accessibilityLabel={selo.rotulo}
    >
      <Icon name={atencao ? "alert-circle" : "clock"} size={11} color={atencao ? t.warningInk : t.ink3} />
      <Text style={[s.txt, { color: atencao ? t.warningInk : t.ink3 }]}>{selo.rotulo}</Text>
    </View>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    selo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3, alignSelf: "flex-end" },
    txt: { fontSize: 10.5, fontWeight: "700" },
  });
}
