// ============================================================
// Conexões — Aura Karatê Fase 5 (DESIGN-22, linguagem simples)
//
// Como cada dojô se conecta à federação: ou usa o Aura Karatê (tudo
// se atualiza sozinho), ou a federação cuida de tudo. Caixa de pedidos
// + lista de dojôs + "Conectar dojô". Dados reais; estados honestos.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { ConectarDojoModal } from "@/components/karate/ConectarDojoModal";
import { karateConnectionsApi, Connection } from "@/services/karateConnectionsApi";

export function connView(c: Connection): { label: string; tone: "ok" | "warn" | "alert" | "neutral" } {
  if (c.status === "connected" && c.via === "native") return { label: "Conectado · atualiza sozinho", tone: "ok" };
  if (c.status === "connected" && c.via === "manual") return { label: "A federação cuida", tone: "neutral" };
  if (c.status === "pending") return { label: "Esperando o dojô aceitar", tone: "warn" };
  if (c.status === "error") return { label: "Conexão caiu", tone: "alert" };
  return { label: "Desligado", tone: "neutral" };
}

export default function ConexoesIndex() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [requests, setRequests] = useState<Connection[]>([]);
  const [conns, setConns] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const [list, reqs] = await Promise.all([
        karateConnectionsApi.listConnections(federationId),
        karateConnectionsApi.listRequests(federationId),
      ]);
      setConns((list?.data ?? []).filter((c) => c.status !== "pending"));
      setRequests(reqs ?? []);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  const accept = async (c: Connection) => {
    try {
      await karateConnectionsApi.approve(federationId, c.id);
      load(true);
    } catch (e: any) {
      Alert.alert("Não foi possível aceitar", e?.message ?? "Tente novamente.");
    }
  };
  const refuse = async (c: Connection) => {
    try {
      await karateConnectionsApi.reject(federationId, c.id);
      setRequests((p) => p.filter((r) => r.id !== c.id));
    } catch (e: any) {
      Alert.alert("Não foi possível recusar", e?.message ?? "Tente novamente.");
    }
  };

  if (error) return <KarateErrorState onRetry={() => load()} />;

  const connected = conns.filter((c) => c.status === "connected").length;
  const problems = conns.filter((c) => c.status === "error").length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Dojôs da federação</Text>
          <Text style={styles.title}>Conexões</Text>
          <Text style={styles.lead}>Cada dojô se conecta de um jeito: ou usa o Aura Karatê e tudo se atualiza sozinho, ou a federação cuida de tudo.</Text>
        </View>
        <KarateButton label="Conectar dojô" variant="primary" size="md" onPress={() => setShowConnect(true)} />
      </View>

      {/* Aviso proativo se algum dojô caiu */}
      {problems > 0 && (
        <View style={styles.alert}>
          <Ionicons name="warning" size={18} color={KarateColors.danger} />
          <Text style={styles.alertText}>
            {problems === 1 ? "1 dojô parou de enviar atualizações" : `${problems} dojôs pararam de enviar atualizações`}. Abra o dojô e toque em Reconectar.
          </Text>
        </View>
      )}

      {/* Caixa de pedidos */}
      {requests.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="mail-unread-outline" size={16} color={KarateColors.primary} />
            <Text style={styles.cardTitle}>Dojôs querendo entrar na plataforma</Text>
          </View>
          <Text style={styles.cardSub}>Esperando você aceitar.</Text>
          {requests.map((r) => (
            <View key={r.id} style={styles.reqRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dojoName}>{r.dojo_name}</Text>
                <Text style={styles.dojoMeta}>{r.fpkt_affiliation_id}{r.notes ? ` · ${r.notes}` : ""}</Text>
              </View>
              <View style={styles.reqActions}>
                <KarateButton label="Aceitar" variant="primary" size="sm" onPress={() => accept(r)} />
                <TouchableOpacity onPress={() => refuse(r)} style={styles.refuseBtn} accessibilityLabel={`Recusar ${r.dojo_name}`}>
                  <Text style={styles.refuseText}>Recusar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Lista de dojôs conectados */}
      <Text style={styles.sectionTitle}>Dojôs conectados <Text style={styles.countMuted}>· {connected}</Text></Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" color={KarateColors.primary} />
      ) : conns.length === 0 ? (
        <KarateEmptyState icon="link-outline" title="Nenhum dojô conectado ainda" subtitle="Use “Conectar dojô” para começar." style={{ paddingVertical: 28 }} />
      ) : (
        conns.map((c) => {
          const v = connView(c);
          return (
            <TouchableOpacity key={c.id} style={styles.connRow}
              onPress={() => router.push(`/karate/conexoes/${c.id}` as any)}
              accessibilityRole="button" accessibilityLabel={`${c.dojo_name} — ${v.label}`}>
              <View style={styles.avatar}><Ionicons name="home" size={16} color={KarateColors.ink3} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dojoName}>{c.dojo_name}</Text>
                <Text style={styles.dojoMeta}>{c.fpkt_affiliation_id}</Text>
              </View>
              <Badge status={v.tone} label={v.label} />
              <Ionicons name="chevron-forward" size={16} color={KarateColors.ink4} />
            </TouchableOpacity>
          );
        })
      )}

      <ConectarDojoModal visible={showConnect} onClose={() => setShowConnect(false)} federationId={federationId} onDone={load} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  alert: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  alertText: { flex: 1, fontSize: 13, color: KarateColors.ink, lineHeight: 18 } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "center", gap: 7 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2, marginBottom: 8 } as TextStyle,
  reqRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  reqActions: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  refuseBtn: { paddingVertical: 6, paddingHorizontal: 4 } as ViewStyle,
  refuseText: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, marginTop: 4 } as TextStyle,
  countMuted: { fontWeight: "600", color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  connRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  avatar: { width: 34, height: 34, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  dojoName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  dojoMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 1, fontFamily: "monospace" } as TextStyle,
});
