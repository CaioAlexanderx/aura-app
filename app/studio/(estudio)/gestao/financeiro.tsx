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
// 26/05/2026 (fix visual): o body do FinanceiroScreen usa Colors do
// varejo (dark navy por default), e o wrapper Studio usava
// StudioColors.bg (claro) → barra clara em cima + card dark embaixo,
// sem continuidade. Migrado wrapper+header pra Colors do varejo
// (bg/bg3/border/ink3) pra herdar o tema do conteúdo. Mantemos
// StudioColors.accent só no texto do eyebrow pra preservar a
// identidade magenta Studio.
//
// Por que não retematizar o body: o Financeiro é 22KB + 7 sub-componentes
// (TabVisaoGeral, TabLancamentos, etc) que somam ~100KB. Refatorar pra
// tokens Studio é trabalho de outra sessão. Por ora, vendas/transações
// do Studio entram no caixa unificado e aparecem aqui mesmo, etiquetadas
// como "Personalizado" nos lançamentos.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { StudioColors } from "@/constants/studio-tokens";
import Icon from "@/components/Icon";
import FinanceiroScreen from "@/app/(tabs)/financeiro";

export default function StudioGestaoFinanceiro() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={s.headerWrap}>
        <Text style={s.eyebrow}>GESTÃO · FINANCEIRO</Text>
        <Text style={s.title}>Financeiro do estúdio</Text>
        <Text style={s.subtitle}>
          Sua receita Studio entra automaticamente no caixa unificado. Use abaixo as mesmas ferramentas do Aura Varejo.
        </Text>

        <View style={s.contextBanner}>
          <Icon name="info" size={12} color={StudioColors.accent} />
          <Text style={s.contextBannerTxt}>
            Vendas Studio aparecem etiquetadas como "Personalizado" nos lançamentos.
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FinanceiroScreen />
      </View>

      <Text style={s.residualHint}>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg3,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.ink3,
    lineHeight: 18,
    maxWidth: 720,
    marginBottom: 4,
  },
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
    maxWidth: 720,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: StudioColors.accent + "55",
  },
  contextBannerTxt: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    flexShrink: 1,
    color: Colors.ink2,
  },
  residualHint: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 2,
    color: Colors.ink4,
  },
});
