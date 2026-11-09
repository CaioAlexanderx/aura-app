// ============================================================================
// AURA. — Página Black Friday · "vendidos na promoção" (p-93, 08/11/2026)
//
// Mockup aprovado: https://claude.ai/artifact/UHRfmosodr9VCqHUt11Yhf
// Três cartões (itens vendidos, faturamento, desconto dado) no bloco "no ar"
// e na promoção encerrada. Zerado: frase gentil e, pequeno, que a contagem
// começou em 09/11. Sem acesso (403/404) ou falha: some, sem erro na tela.
// A seção é por empresa (no consolidado ela nem monta estes cartões).
// ============================================================================
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { ItemDaLista } from "@/services/promocoesApi";
import { useVendidosNaPromocao } from "@/hooks/useVendidosNaPromocao";
import { brl } from "./regrasDePor";
import { DIA_DO_INICIO_DA_CONTAGEM, contagemComecou, qtdTxt } from "./janelaVendidos";

type Props = { companyId: string; lista: ItemDaLista[]; status: "ativa" | "encerrada" };

export function VendidosNaPromocao({ companyId, lista, status }: Props) {
  var v = useVendidosNaPromocao(companyId, lista, status);
  if (!v.dados || !v.janela) return null;
  var r = v.dados.resumo;
  var desde = (contagemComecou(new Date(Date.now())) ? "As vendas na promoção são contadas desde " : "As vendas na promoção começam a ser contadas em ") + DIA_DO_INICIO_DA_CONTAGEM + ".";

  if (r.itens_vendidos <= 0 && r.vendas <= 0) {
    return (
      <View style={s.zero} testID={"promo-vendidos-zero-" + status}>
        <Text style={s.zeroTxt}>{status === "ativa" ? "Ainda sem vendas na promoção." : "Nenhuma venda na promoção."}</Text>
        <Text style={s.mini}>{desde}</Text>
      </View>
    );
  }

  return (
    <View style={s.wrap} testID={"promo-vendidos-" + status}>
      <Text style={s.lab}>Vendido na promoção</Text>
      <View style={s.kp}>
        <View style={s.kpBox}>
          <Text style={s.kpN} testID={"promo-vendidos-itens-" + status}>{qtdTxt(r.itens_vendidos)}</Text>
          <Text style={s.t}>{r.itens_vendidos === 1 ? "item vendido" : "itens vendidos"}</Text>
        </View>
        <View style={s.kpBox}>
          <Text style={s.kpN} testID={"promo-vendidos-faturamento-" + status}>{brl(r.faturamento)}</Text>
          <Text style={s.t}>faturamento</Text>
        </View>
        <View style={s.kpBox}>
          <Text style={s.kpN} testID={"promo-vendidos-desconto-" + status}>{brl(r.desconto_dado)}</Text>
          <Text style={s.t}>desconto dado</Text>
        </View>
      </View>
      {v.janela.cortada && <Text style={s.mini} testID={"promo-vendidos-desde-" + status}>{desde}</Text>}
    </View>
  );
}

var s = StyleSheet.create({
  wrap: { gap: 6, flexBasis: "100%" as any },
  lab: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  kp: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpBox: { flexGrow: 1, flexBasis: 140, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: Colors.bg2 },
  kpN: { fontSize: 19, fontWeight: "700", color: Colors.ink },
  t: { fontSize: 12.5, color: Colors.ink3 },
  zero: { gap: 2, flexBasis: "100%" as any },
  zeroTxt: { fontSize: 13, color: Colors.ink },
  mini: { fontSize: 11.5, color: Colors.ink3 },
});

export default VendidosNaPromocao;
