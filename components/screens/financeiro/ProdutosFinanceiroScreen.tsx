// ============================================================
// AURA. — "Produtos que mais dão dinheiro" (curva ABC), tela inteira.
//
// F4 (24/08/2026): o AbcCurveCard saiu do meio da aba Receitas e ganhou a
// tela toda (donut, filtros A/B/C, seletor de período próprio, tabela
// paginada e CSV). O deep-link antigo (/financeiro?tab=receitas&focus=abc,
// do SalesAnalyticsCard do Painel) continua valendo: financeiro.tsx
// redireciona pra cá.
//
// 24/10/2026: a rota morava em app/financeiro/produtos.tsx, FORA do grupo
// (tabs) — abria sem a barra lateral e sem a casca do app, e o Voltar caía
// no Painel. Agora a tela é este componente, montado por:
//   - app/(tabs)/financeiro/produtos.tsx      → /financeiro/produtos
//   - app/studio/(estudio)/gestao/financeiro/produtos.tsx
//                                             → /studio/gestao/financeiro/produtos
// Subtela do Financeiro, não tela nova: não tem item de menu nem `mod`
// próprio. A barra lateral marca Financeiro porque a rota fica embaixo de
// /financeiro (isA em app/(tabs)/_layout.tsx; matchActiveRoute no
// StudioShell), o mesmo que já vale para /crediario/settings.
// ============================================================
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { AbcCurveCard } from "@/components/screens/financeiro/v2/AbcCurveCard";

// Abas do Financeiro que aceitam ?tab= (TAB_KEY_TO_INDEX em
// app/(tabs)/financeiro.tsx, sem os aliases retirada/cupons, que
// redirecionam para outras rotas).
const ABAS_DO_FINANCEIRO = ["visao", "receitas", "despesas", "lancamentos"];

export type DestinoDoVoltar = { tipo: "back" } | { tipo: "replace"; href: string };

// Decide para onde o Voltar leva. Regra:
//   - a tela anterior na pilha é o Financeiro → router.back(), que devolve
//     a aba em que o usuário estava (o Financeiro mantém ?tab= na URL via
//     setParams ao trocar de aba);
//   - qualquer outro caso (link direto do relatório semanal, histórico
//     vazio, ou o atalho do Painel, que faz replace do Financeiro por esta
//     tela e deixaria o Painel como anterior) → replace para o Financeiro,
//     na aba de origem quando o link a informa (?de=receitas).
export function destinoDoVoltar(opts: {
  rotaAnterior?: string | null;
  rotaFinanceiro: string;
  hrefFinanceiro: string;
  de?: string | null;
}): DestinoDoVoltar {
  if (opts.rotaAnterior && opts.rotaAnterior === opts.rotaFinanceiro) return { tipo: "back" };
  const aba = opts.de && ABAS_DO_FINANCEIRO.indexOf(opts.de) >= 0 ? opts.de : null;
  return { tipo: "replace", href: aba ? opts.hrefFinanceiro + "?tab=" + aba : opts.hrefFinanceiro };
}

type Props = {
  // Nome da rota do Financeiro no navegador que monta esta tela (o mesmo
  // Slot): "financeiro" em (tabs), "gestao/financeiro" no Studio.
  rotaFinanceiro: string;
  // Para onde ir quando não dá para voltar na pilha.
  hrefFinanceiro: string;
};

export function ProdutosFinanceiroScreen({ rotaFinanceiro, hrefFinanceiro }: Props) {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ de?: string }>();
  const de = typeof params.de === "string" ? params.de : null;

  function voltar() {
    let rotaAnterior: string | null = null;
    try {
      const state: any = navigation.getState?.();
      if (state && typeof state.index === "number" && state.index > 0) {
        rotaAnterior = state.routes?.[state.index - 1]?.name ?? null;
      }
    } catch {
      rotaAnterior = null;
    }
    const destino = destinoDoVoltar({ rotaAnterior, rotaFinanceiro, hrefFinanceiro, de });
    if (destino.tipo === "back" && router.canGoBack()) router.back();
    else router.replace((destino.tipo === "replace" ? destino.href : hrefFinanceiro) as any);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Pressable
          onPress={voltar}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar para o Financeiro"
          testID="produtos-financeiro-voltar"
          hitSlop={8}
        >
          <Icon name="chevron_left" size={14} color={Colors.violet3} />
          <Text style={s.backText}>Voltar</Text>
        </Pressable>
      </View>

      <Text style={s.pageTitle}>Produtos que mais dão dinheiro</Text>
      <Text style={s.pageSubtitle}>
        Seus produtos ordenados pelo quanto realmente entra de dinheiro com cada um.
        Poucos costumam responder pela maior parte do faturamento — são esses que não
        podem faltar no estoque.
      </Text>

      <AbcCurveCard />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 1100, alignSelf: "center", width: "100%" },
  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18, marginBottom: 22, maxWidth: 620 },
});
