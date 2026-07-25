// ============================================================
// Aura Karatê (dojô) — Certificados (Track J; F1: movida de
// /karate/sensei/certificados para /karate/(dojo)/certificados)
//
// Dojô vê:
//   1. "Praticantes aptos" — aprovados em banca (belt_history) sem pedido ativo
//   2. "Meus pedidos" — solicitações deste dojô com EstadoSelo
//
// Polish QA 25/07 (item 1): o MOCK_APTOS (3 praticantes fictícios em
// produção — Ricardo Sato, Fernanda Oka, Caio Brandão) foi REMOVIDO por
// completo, junto com toda a lógica de "Pedir certificado" que dependia
// dele (não dava pra pedir certificado de um apto de verdade, só do
// mock). A seção "Praticantes aptos" agora é sempre um empty state até
// a F5 trazer o endpoint real — ver TODO abaixo.
//
// Polish QA 25/07 (item 2): cabeçalho padrão (eyebrow + título) igual
// alunos.tsx/mensalidades.tsx, e grid responsivo pronto (2-3 colunas
// desktop / 1 mobile, largura máxima por card) para quando os aptos de
// verdade chegarem — sem isso o card de largura total com o botão
// esticado ficava quebrado em desktop.
//
// StyleSheet: todos top-level são objetos (WeakMap safe). Sem deps novas.
// ============================================================
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { EstadoSelo, normalizeCertStatus } from "@/components/karate/EstadoSelo";
import { karateApi, CertOrder } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";

export default function DojoCertificadosScreen() {
  const { federationId } = useKarateFederation();
  const { dojoName } = useKarateDojo();
  const [orders, setOrders] = useState<CertOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await karateApi.listMyCertOrders(federationId);
      setOrders(res.data || []);
    } catch {
      // sem conexão ou migration pendente — mantém vazio
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.head}>
        <Text style={st.eyebrow}>{dojoName}</Text>
        <Text style={st.title}>Certificados</Text>
      </View>

      {/* Section: Praticantes aptos */}
      <View style={st.sectionHead}>
        <View>
          <Text style={st.h2}>Praticantes aptos</Text>
          <Text style={st.sh}>Aprovados em banca — graduação já consta no histórico</Text>
        </View>
      </View>

      {/*
        TODO(F5): consumir GET /federation/:id/dojo/aptos quando o endpoint
        real existir e renderizar os cards em st.grid/st.cardGridItem
        (já preparados abaixo: 2-3 colunas desktop, 1 mobile, largura
        máxima por card, botão "Pedir certificado" compacto dentro do
        card). Até lá a seção fica sempre no empty state — nada de mock.
      */}
      <View style={st.emptyCard}>
        <Icon name="ribbon" size={32} color={KarateColors.ink4} />
        <Text style={st.emptyText}>Nenhum praticante apto no momento</Text>
        <Text style={st.emptySub}>
          Quando a federação aprovar graduações do seu dojô em banca, os aptos aparecem aqui para você pedir o certificado.
        </Text>
      </View>

      {/* Section: Meus pedidos */}
      <View style={[st.sectionHead, { marginTop: 24 }]}>
        <View>
          <Text style={st.h2}>Meus pedidos</Text>
          <Text style={st.sh}>Solicitações deste dojô — estado atualizado pela federação</Text>
        </View>
        <View style={st.pill}><Text style={st.pillText}>{orders.length} pedidos</Text></View>
      </View>

      <View style={st.card}>
        {loading ? (
          <ActivityIndicator color={KarateColors.primary} />
        ) : orders.length === 0 ? (
          <View style={st.empty}>
            <Icon name="mail-outline" size={28} color={KarateColors.ink4} />
            <Text style={st.emptyText}>Nenhum pedido ainda</Text>
          </View>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={st.orderRow}>
              <View style={st.av}><Text style={st.avText}>{o.nome_impresso.split(" ").map((w: string) => w[0]).join("").slice(0,2)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{o.nome_impresso}</Text>
                <Text style={st.belt}>{o.belt_name}</Text>
              </View>
              <EstadoSelo status={normalizeCertStatus(o.status)} />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, paddingBottom: 48 } as ViewStyle,

  head: { marginBottom: 18 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,

  sectionHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 } as ViewStyle,
  h2: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sh: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  // Grid responsivo pronto para os aptos reais (F5): 2-3 colunas em
  // desktop, 1 em mobile (flexWrap + flexBasis fazem a quebra sozinhos,
  // sem media query), largura máxima por card.
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  cardGridItem: { flexBasis: 280, flexGrow: 1, maxWidth: 380 } as ViewStyle,
  card: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 10 } as ViewStyle,

  personRow: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  av:   { width: 38, height: 38, borderRadius: 19, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  avText: { fontSize: 13, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  name: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  belt: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,

  emptyCard: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 8 } as ViewStyle,
  empty: { alignItems: "center", paddingVertical: 28, gap: 8 } as ViewStyle,
  emptyText: { fontSize: 13, color: KarateColors.ink4, fontWeight: "600", textAlign: "center" } as TextStyle,
  emptySub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 } as TextStyle,

  pill: { backgroundColor: KarateColors.surface, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  pillText: { fontSize: 11, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,

  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 16 } as ViewStyle,
  btnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
});
