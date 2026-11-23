// ============================================================
// AURA. — PDV · VendasPorForma
//
// 23/11/2026 (pedido do Caio): antes de fechar o caixa, a pessoa via só o
// dinheiro da gaveta; Pix e cartões apareciam depois de fechar, no
// resultado e no relatório. Este bloco mostra, já no passo 1 (e no resumo
// da conferência), cada forma usada no período e o total, com as mesmas
// formas, rótulos e ordem do relatório (utils/formasDoFechamento.ts).
//
// Fonte: totais_ao_vivo do status, que o backend calcula com a mesma conta
// do /fechar (calcularTotais). O total é o "Total de entradas" do
// relatório (totais.geral). Só o dinheiro entra na conta da gaveta: o
// bloco "Dinheiro na gaveta" continua igual.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import type { CaixaTotais } from "@/services/caixaApi";
import { formasDePagamento, ordemDoRelatorio } from "@/utils/formasDoFechamento";

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

const fmt = (v: unknown) => "R$ " + toNum(v).toFixed(2).replace(".", ",");

type Props = {
  totais: Partial<CaixaTotais> | null | undefined;
  testID?: string;
};

export function VendasPorForma({ totais, testID = "caixa-formas" }: Props) {
  const formas = ordemDoRelatorio(formasDePagamento(totais));
  const soma = formas.reduce((a, f) => a + f.amount, 0);
  // Como no relatório: o total é o das entradas (geral), com o somatório
  // das formas quando o backend não manda o geral.
  const total = totais && totais.geral != null ? toNum(totais.geral) : soma;

  return (
    <View testID={testID}>
      <Text style={s.titulo}>Vendas por forma de pagamento</Text>
      <View style={s.caixa}>
        {formas.length === 0 ? (
          <Text style={s.vazio} testID={testID + "-vazio"}>Ainda não há vendas nesta sessão.</Text>
        ) : (
          <>
            {formas.map((f) => (
              <View key={f.label} style={s.linha} testID={testID + "-" + f.label}>
                <Text style={s.rotulo}>{f.label}</Text>
                <Text style={s.valor}>{fmt(f.amount)}</Text>
              </View>
            ))}
            <View style={[s.linha, s.linhaTotal]} testID={testID + "-total"}>
              <Text style={[s.rotulo, s.total]}>Total de entradas</Text>
              <Text style={[s.valor, s.total]}>{fmt(total)}</Text>
            </View>
          </>
        )}
      </View>
      <Text style={s.ajuda}>
        Só o dinheiro entra na conta da gaveta. Pix, cartões e as outras formas aparecem aqui para você conferir, sem precisar contar.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  titulo: {
    fontFamily: Fonts.body,
    fontSize: 11, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4,
  },
  caixa: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  linha: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.08)",
  },
  linhaTotal: { borderBottomWidth: 0, paddingTop: 7 },
  rotulo: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3 },
  valor: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink, fontWeight: "600" },
  total: { fontWeight: "700", color: Colors.ink },
  vazio: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, paddingVertical: 4 },
  ajuda: { fontFamily: Fonts.body, fontSize: 11, color: Colors.ink3, lineHeight: 15, marginTop: 4 },
});
