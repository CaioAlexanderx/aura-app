// app/financeiro/retirada.tsx
//
// F6 (24/08/2026) — "Quanto posso retirar?" saiu das abas do Financeiro.
//
// O conteudo e bom, mas e uma FERRAMENTA (uma calculadora que voce abre
// quando vai fazer a retirada do mes), nao um painel que se acompanha. Como
// aba permanente ocupava um dos seis slots de navegacao e empurrava o que se
// usa todo dia. Agora e um card-link no fim da Visao Geral.
//
// O deep-link antigo (/financeiro?tab=retirada) continua valendo — a tela do
// Financeiro redireciona pra ca.

import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useTransactionsApi } from "@/hooks/useTransactions";
import { TabRetirada } from "@/components/screens/financeiro/TabRetirada";

export default function RetiradaScreen() {
  // Usa o mesmo hook da tela principal, fixado no mes — a simulacao de
  // retirada so faz sentido sobre o mes corrente.
  var { transactions, isLoading, isError, refetch, isDemo } = useTransactionsApi("month");

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

      <Text style={s.pageTitle}>Quanto posso retirar este mês?</Text>
      <Text style={s.pageSubtitle}>
        Simulação com base no que entrou e saiu no mês corrente, no seu regime tributário
        e no que precisa ficar em caixa. É uma estimativa para te orientar — não substitui
        seu contador.
      </Text>

      {isLoading && <ListSkeleton rows={3} showCards />}

      {!isLoading && isError && (
        <EmptyState
          icon="alert"
          iconColor={Colors.amber}
          title="Não conseguimos carregar seus dados"
          subtitle="Verifique sua conexão e tente de novo."
          actionLabel="Tentar de novo"
          onAction={refetch}
        />
      )}

      {/* FIX (QA pos-F7): em demo, isLoading e isError sao ambos false e a
          condicao !isDemo derrubava o unico bloco de conteudo — sobrava titulo
          e subtitulo numa pagina em branco, sem explicacao. */}
      {!isLoading && !isError && isDemo && (
        <EmptyState
          icon="calculator"
          iconColor={Colors.violet3}
          title="Simulação indisponível no modo demonstração"
          subtitle="Entre com a sua conta para simular a retirada com os números reais do seu negócio."
        />
      )}

      {!isLoading && !isError && !isDemo && <TabRetirada transactions={transactions} hideHeading />}
    </ScrollView>
  );
}

var s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 900, alignSelf: "center", width: "100%" },
  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18, marginBottom: 22, maxWidth: 620 },
});
