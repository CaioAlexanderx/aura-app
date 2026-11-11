// ============================================================
// AURA. — Resumo do checkout (p-104, 11/11/2026)
//
// Linhas claras, nesta ordem:
//   Plano X (mensal | anual, cobrado por mês)          R$ x
//   N acessos extras de equipe (só se a conta tem)     R$ y
//   Cupom CÓDIGO · 1ª mensalidade                     − R$ z
//   Total hoje                                  (serif 30) R$ t
//   "Depois, R$ w por mês. Desconto só na primeira mensalidade."
// Valor combinado pela equipe: o selo e só o valor combinado (nada de conta
// de tabela nem de acessos extras, que já estão dentro dele).
// p-106 (acessos de funcionário escolhidos no checkout) entra como mais uma
// linha depois do plano — a mesma `linhaDosAcessos`.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { fmtBRL } from "@/components/billing/couponText";
import { Ck } from "@/components/billing/estiloDoCheckout";
import { ROTULO_VALOR_COMBINADO, textoValorPorMes } from "@/utils/valorCombinado";

type Props = {
  rotuloDoPlano: string;
  valorDoPlano: number;
  combinado: boolean;
  /** Linha dos acessos extras já liberados na conta (null = não mostra). */
  linhaDosAcessos?: { rotulo: string; valor: number } | null;
  linhaDoCupom?: { rotulo: string; valor: number } | null;
  rotuloDoTotal: string;
  total: number;
  depois?: string | null;
};

export function ResumoDoCheckout(p: Props) {
  return (
    <View testID="checkout-resumo" style={s.card}>
      {p.combinado ? (
        <View testID="checkout-valor-combinado" style={s.combinado}>
          <View style={s.combinadoSelo}><Text style={s.combinadoSeloTxt}>{ROTULO_VALOR_COMBINADO}</Text></View>
          <Text style={s.combinadoTxt}>{textoValorPorMes(p.valorDoPlano)}</Text>
        </View>
      ) : null}
      <View style={s.linha}>
        <Text style={s.rotulo}>{p.rotuloDoPlano}</Text>
        <Text style={s.valor}>{fmtBRL(p.valorDoPlano)}</Text>
      </View>
      {p.linhaDosAcessos ? (
        <View testID="checkout-resumo-acessos" style={s.linha}>
          <Text style={s.rotulo}>{p.linhaDosAcessos.rotulo}</Text>
          <Text style={s.valor}>{fmtBRL(p.linhaDosAcessos.valor)}</Text>
        </View>
      ) : null}
      {p.linhaDoCupom ? (
        <View testID="checkout-resumo-cupom" style={s.linha}>
          <Text style={[s.rotulo, { color: Ck.ok }]}>{p.linhaDoCupom.rotulo}</Text>
          <Text style={[s.valor, { color: Ck.ok }]}>{"− " + fmtBRL(p.linhaDoCupom.valor)}</Text>
        </View>
      ) : null}
      <View style={[s.linha, s.totalLinha]}>
        <Text style={s.totalRotulo}>{p.rotuloDoTotal}</Text>
        <Text testID="checkout-total" style={s.total}>{fmtBRL(p.total)}</Text>
      </View>
      {p.depois ? <Text testID="checkout-depois" style={s.depois}>{p.depois}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 20, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, backgroundColor: Colors.bg3, padding: 16 },
  combinado: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  combinadoSelo: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Ck.vidroBorda },
  combinadoSeloTxt: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase" as any, color: Colors.violet3 },
  combinadoTxt: { fontSize: 12.5, color: Colors.ink3, fontWeight: "600" },
  linha: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingVertical: 4 },
  rotulo: { flex: 1, minWidth: 0, fontSize: 14, color: Colors.ink2 },
  valor: { fontSize: 14, fontWeight: "600", color: Colors.ink, textAlign: "right" },
  totalLinha: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 12 },
  totalRotulo: { fontSize: 14, color: Colors.ink2 },
  total: { fontFamily: Fonts.heading, fontSize: 30, lineHeight: 32, color: Colors.ink },
  depois: { fontSize: 12, color: Colors.ink3, marginTop: 4, lineHeight: 17 },
});
