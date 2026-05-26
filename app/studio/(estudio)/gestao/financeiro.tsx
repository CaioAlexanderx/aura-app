// ============================================================
// AURA STUDIO · Gestão / Financeiro
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o FinanceiroScreen completo do Aura Varejo (todas as 6 abas:
// Visão Geral, Receitas, Despesas, Lançamentos, Retirada, Cupons + DRE +
// fluxo de caixa + comparativos) com uma barra contextual Studio no topo.
//
// 26/05/2026 (residual): substituído o eyebrowBar simples por
// StudioPageHeader canônico + banner de contexto magenta + wrapper visual
// (border navy + bgSoft) ao redor do FinanceiroScreen pra reforçar a
// identidade Studio. NÃO envolvemos em AccentTheme — isso impactaria
// o Canal Digital varejo que compartilha o provider. Só TELA admin.
//
// Por que não retematizar o body: o Financeiro é 22KB + 7 sub-componentes
// (TabVisaoGeral, TabLancamentos, etc) que somam ~100KB. Refatorar pra
// tokens Studio é trabalho de outra sessão. Por ora, vendas/transações
// do Studio entram no caixa unificado e aparecem aqui mesmo, etiquetadas
// como "Personalizado" nos lançamentos.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import StudioPageHeader from "@/components/studio/StudioPageHeader";
import Icon from "@/components/Icon";
import FinanceiroScreen from "@/app/(tabs)/financeiro";

export default function StudioGestaoFinanceiro() {
  const t = useStudioTokens();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.headerWrap}>
        <StudioPageHeader
          eyebrow="GESTÃO · FINANCEIRO"
          title="Financeiro do estúdio"
          subtitle="Sua receita Studio entra automaticamente no caixa unificado. Use abaixo as mesmas ferramentas do Aura Varejo."
          marginBottom={12}
        />

        <View style={[s.contextBanner, { backgroundColor: t.primarySoft }]}>
          <Icon name="info" size={12} color={t.primary} />
          <Text style={[s.contextBannerTxt, { color: t.primary }]}>
            Vendas Studio aparecem etiquetadas como "Personalizado" nos lançamentos.
          </Text>
        </View>
      </View>

      <View
        style={[
          s.bodyWrap,
          {
            backgroundColor: t.bgSoft,
            borderColor: StudioColors.primaryBorder,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <FinanceiroScreen />
        </View>
      </View>

      <Text style={[s.residualHint, { color: t.ink4 }]}>
        Você está em modo Studio · vendas personalizadas aparecem com badge
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 14,
  },
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    alignSelf: "flex-start",
    maxWidth: 720,
  },
  contextBannerTxt: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    flexShrink: 1,
  },
  bodyWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  residualHint: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 2,
  },
});
