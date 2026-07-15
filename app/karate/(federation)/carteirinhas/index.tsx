// ============================================================
// Carteirinhas — Federação (sisteminha de gestão de impressão) · Shoji
//
// Breadcrumb: FPKT / Carteirinhas
//
// Onde a tela mora — decisão: item de MENU PRÓPRIO (não sub-tab de
// Certificados, onde vivia antes como CarteirinhaBatchTab / PR #386).
// Justificativa: o Caio chamou isso de "sisteminha de gestão" — um
// workflow completo com três estágios, ações que mutam estado, e
// histórico de vias. Isso é maior que uma aba de impressão dentro de uma
// tela sobre certificados de graduação (assunto diferente). Convenção do
// app (CLAUDE.md #3): toda tela nova ganha módulo próprio — aqui,
// entrada dedicada em KarateShell.NAV_ITEMS (rota /karate/carteirinhas),
// visível a todos os papéis (mesma visibilidade de Praticantes/Dojôs;
// staff/sensei também lida com a fila de impressão no dia a dia).
//
// Deep-link por query param (mesmo padrão de Dojôs/Anuidades):
//   ?tab=printed|delivered   — abre direto numa etapa
//   ?dojo=<dojo_id>          — já filtra por dojô
// (lidos dentro de CarteirinhaQueue via useLocalSearchParams)
// ============================================================
import React from "react";
import { ScrollView, StyleSheet, ViewStyle } from "react-native";
import { ShojiBackground, PageHead } from "@/components/karate/shoji";
import { KarateSpacing as SP } from "@/constants/karateTheme";
import { CarteirinhaQueue } from "@/components/karate/carteirinha/CarteirinhaQueue";

export default function CarteirinhasScreen() {
  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PageHead
          eyebrow="Federação · Operação"
          title="Carteirinhas"
          sub="Fila de impressão — do pedido até a entrega na mão do praticante."
        />
        <CarteirinhaQueue />
      </ScrollView>
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
});
