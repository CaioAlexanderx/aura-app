// app/financeiro/produtos.tsx
//
// F4 (24/08/2026) — "Produtos que mais dão dinheiro" (ex-Curva ABC).
//
// O AbcCurveCard e uma mini-tela inteira: donut, filtros A/B/C, seletor de
// periodo PROPRIO (que ignorava o periodo global da tela) e tabela paginada
// de 25 itens com export CSV. Empilhado no meio da aba Receitas ele era o
// maior fator de scroll da aba e confundia com dois seletores de periodo
// concorrentes na mesma tela.
//
// Aqui ele tem a tela toda. O deep-link antigo
// (/financeiro?tab=receitas&focus=abc, vindo do SalesAnalyticsCard do Painel)
// continua funcionando: financeiro.tsx redireciona pra ca.

import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { AbcCurveCard } from "@/components/screens/financeiro/v2/AbcCurveCard";

export default function ProdutosFinanceiroScreen() {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Pressable
          onPress={function() {
            // Alcancada por deep-link (router.replace, historico vazio), o
            // back() e no-op silencioso e o usuario fica preso numa tela sem
            // navegacao — estas rotas ficam fora do shell com a sidebar.
            if (router.canGoBack()) router.back();
            else router.replace("/financeiro" as any);
          }}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar para o Financeiro"
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

var s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 1100, alignSelf: "center", width: "100%" },
  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18, marginBottom: 22, maxWidth: 620 },
});
