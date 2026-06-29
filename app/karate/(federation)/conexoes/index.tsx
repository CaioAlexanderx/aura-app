// ============================================================
// Conexões — Aura Karatê (federação) · Shoji
// Como cada dojô se conecta à federação. Dados reais; estados honestos.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert as RNAlert,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SectionHead, Card, ShojiBadge, ShojiButton, Avatar, Mono, Body,
} from "@/components/karate/shoji";
import { ConectarDojoModal } from "@/components/karate/ConectarDojoModal";
import { karateConnectionsApi, Connection } from "@/services/karateConnectionsApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

export function connView(c: Connection): { label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  if (c.status === "connected" && c.via === "native") return { label: "Conectado · atualiza sozinho", tone: "ok" };
  if (c.status === "connected" && c.via === "manual") return { label: "A federação cuida", tone: "neutral" };
  if (c.status === "pending") return { label: "Esperando o dojô aceitar", tone: "warn" };
  if (c.status === "error") return { label: "Conexão caiu", tone: "danger" };
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
      const [list, reqs] = await Promise.all([karateConnectionsApi.listConnections(federationId), karateConnectionsApi.listRequests(federationId)]);
      setConns((list?.data ?? []).filter((c) => c.status !== "pending")); setRequests(reqs ?? []);
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  const accept = async (c: Connection) => { try { await karateConnectionsApi.approve(federationId, c.id); load(true); } catch (e: any) { RNAlert.alert("Não foi possível aceitar", e?.message ?? "Tente novamente."); } };
  const refuse = async (c: Connection) => { try { await karateConnectionsApi.reject(federationId, c.id); setRequests((p) => p.filter((r) => r.id !== c.id)); } catch (e: any) { RNAlert.alert("Não foi possível recusar", e?.message ?? "Tente novamente."); } };

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;
  const connected = conns.filter((c) => c.status === "connected").length;
  const problems = conns.filter((c) => c.status === "error").length;

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <PageHead
          eyebrow="Dojôs da federação"
          title="Conexões"
          sub="Cada dojô se conecta de um jeito: ou usa o Aura Karatê e tudo se atualiza sozinho, ou a federação cuida de tudo."
          actions={<ShojiButton label="Conectar dojô" icon="link-outline" variant="sumi" onPress={() => setShowConnect(true)} />}
        />

        {problems > 0 && (
          <View style={styles.warn}>
            <Icon name="warning" size={18} color={P.red} />
            <Body style={{ flex: 1, color: C.ink }}>{problems === 1 ? "1 dojô parou de enviar atualizações" : `${problems} dojôs pararam de enviar atualizações`}. Abra o dojô e toque em Reconectar.</Body>
          </View>
        )}

        {requests.length > 0 && (
          <Card style={{ marginTop: SP[4] }}>
            <SectionHead title="Dojôs querendo entrar" sub="Esperando você aceitar." />
            {requests.map((r) => (
              <View key={r.id} style={styles.reqRow}>
                <Avatar name={r.dojo_name ?? "Dojô"} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dojoName}>{r.dojo_name}</Text>
                  <Body muted style={{ fontSize: 11.5 }}>{r.fpkt_affiliation_id}{r.notes ? ` · ${r.notes}` : ""}</Body>
                </View>
                <ShojiButton label="Aceitar" variant="sumi" onPress={() => accept(r)} />
                <TouchableOpacity onPress={() => refuse(r)} style={{ paddingHorizontal: 6, paddingVertical: 8 }}><Text style={styles.refuse}>Recusar</Text></TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        <View style={styles.section}>
          <SectionHead title="Dojôs conectados" sub={`${connected} conectado(s)`} />
          {loading ? <ActivityIndicator style={{ marginTop: 24 }} size="large" color={P.red} />
            : conns.length === 0 ? <Card><KarateEmptyState icon="link-outline" title="Nenhum dojô conectado ainda" subtitle="Use “Conectar dojô” para começar." style={{ paddingVertical: 28 }} /></Card>
            : conns.map((c) => {
              const v = connView(c);
              return (
                <TouchableOpacity key={c.id} onPress={() => router.push(`/karate/conexoes/${c.id}` as any) } activeOpacity={0.85}>
                  <Card style={{ marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar name={c.dojo_name ?? "Dojô"} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dojoName}>{c.dojo_name}</Text>
                      <Mono style={{ fontSize: 10, color: P.red, marginTop: 1 }}>{c.fpkt_affiliation_id}</Mono>
                    </View>
                    <ShojiBadge status={v.tone} label={v.label} />
                    <Icon name="chevron-forward" size={16} color={C.ink4} />
                  </Card>
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>
      <ConectarDojoModal visible={showConnect} onClose={() => setShowConnect(false)} federationId={federationId} onDone={() => load(true)} />
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: 1000, width: "100%", alignSelf: "center" } as ViewStyle,
  warn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, padding: 14, marginTop: SP[4] } as ViewStyle,
  section: { marginTop: SP[8] } as ViewStyle,
  reqRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  dojoName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  refuse: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink3 } as TextStyle,
});
