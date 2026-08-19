// ============================================================
// AURA STUDIO · Gestão / Financeiro
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o FinanceiroScreen completo do Aura Varejo (todas as 6 abas:
// Visão Geral, Receitas, Despesas, Lançamentos, Retirada, Cupons + DRE +
// fluxo de caixa + comparativos) com uma barra contextual Studio no topo.
//
// 26/05/2026 (residual): substituído o eyebrowBar simples por
// StudioPageHeader canônico + wrapper visual (border navy + bgSoft) ao
// redor do FinanceiroScreen pra reforçar a identidade Studio. NÃO
// envolvemos em AccentTheme — isso impactaria o Canal Digital varejo
// que compartilha o provider. Só TELA admin.
//
// 26/05/2026 (fix visual): o body do FinanceiroScreen usa Colors do
// varejo (dark navy por default), e o wrapper Studio usava
// StudioColors.bg (claro) → barra clara em cima + card dark embaixo,
// sem continuidade. Migrado wrapper+header pra Colors do varejo
// (bg/bg3/border/ink3) pra herdar o tema do conteúdo. Mantemos
// StudioColors.accent só no texto do eyebrow pra preservar a
// identidade magenta Studio.
//
// 26/05/2026 (limpeza): removido banner de contexto "Vendas Studio
// aparecem etiquetadas como Personalizado nos lançamentos" — info
// não fazia sentido pro lojista (feedback). Styles órfãos removidos.
//
// Por que não retematizar o body: o Financeiro é 22KB + 7 sub-componentes
// (TabVisaoGeral, TabLancamentos, etc) que somam ~100KB. Refatorar pra
// tokens Studio é trabalho de outra sessão.
//
// 19/08/2026 (QA):
//   - item 17: removido o rodapé fixo `residualHint` — não-dismissível,
//     ocupava espaço permanente pra uma info de baixo valor.
//   - item 20: `StudioColors.accent` (estático) trocado por
//     `useStudioTokens().accent` no eyebrow — só esse valor era realmente
//     "hardcoded fora do tema" aqui. Os demais (Colors.bg/bg3/border/ink*)
//     continuam DELIBERADAMENTE ligados ao tema do varejo (não ao Studio):
//     o body do FinanceiroScreen usa Colors do varejo, então o wrapper
//     precisa herdar a mesma fonte de cor pra não voltar a ter barra clara
//     em cima de card escuro (bug corrigido em 26/05/2026, ver comentário
//     acima). Migrar o wrapper pra useStudioTokens() sem migrar o body
//     (fora do escopo desta tela — FinanceiroScreen é arquivo compartilhado)
//     reintroduziria esse bug sempre que o tema Studio e o tema Varejo
//     divergirem (são dois stores de tema independentes).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import FinanceiroScreen from "@/app/(tabs)/financeiro";

export default function StudioGestaoFinanceiro() {
  const t = useStudioTokens();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={s.headerWrap}>
        <Text style={[s.eyebrow, { color: t.accent }]}>GESTÃO · FINANCEIRO</Text>
        <Text style={s.title}>Financeiro do estúdio</Text>
        <Text style={s.subtitle}>
          Receita, despesas e margem do seu estúdio em um só lugar.
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <FinanceiroScreen />
      </View>
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
});
