// ============================================================
// AURA STUDIO · Gestão / Financeiro
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o FinanceiroScreen completo do Aura Varejo (todas as 6 abas:
// Visão Geral, Receitas, Despesas, Lançamentos, Retirada, Cupons + DRE +
// fluxo de caixa + comparativos) com uma barra contextual Studio no topo.
//
// Por que não retematizar o body: o Financeiro é 22KB + 7 sub-componentes
// (TabVisaoGeral, TabLancamentos, etc) que somam ~100KB. Refatorar pra
// tokens Studio é trabalho de outra sessão. Por ora, vendas/transações
// do Studio entram no caixa unificado e aparecem aqui mesmo.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";
import FinanceiroScreen from "@/app/(tabs)/financeiro";

export default function StudioGestaoFinanceiro() {
  return (
    <View style={{ flex: 1, backgroundColor: StudioColors.bg }}>
      <View style={s.eyebrowBar}>
        <Text style={s.eyebrow}>GESTÃO · FINANCEIRO</Text>
        <Text style={s.contextHint}>
          Sua receita Studio entra automaticamente no caixa unificado. Use abaixo as mesmas ferramentas do Aura Varejo.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <FinanceiroScreen />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrowBar: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: StudioColors.ink5,
    backgroundColor: StudioColors.paperCardElev,
  },
  eyebrow: {
    fontSize: 11,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  contextHint: {
    fontSize: 12,
    color: StudioColors.ink3,
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 720,
  },
});
