// ============================================================
// ConexoesTab — aba "Sincronização" — Aura Karatê (federação) · Shoji
//
// Extraído do antigo app/karate/(federation)/conexoes/index.tsx (H3):
// virou aba irmã de FiliacoesTab e SolicitacoesTab ("Praticantes") — ver
// ../index.tsx. Como cada dojô JÁ LINKADO se conecta à federação
// (native/manual). Dados reais; estados honestos.
//
// CONVERGÊNCIA (27/07/2026, migration 255): a investigação confirmou que
// esta tela NÃO é um segundo inbox de filiação — karate_dojo_connections
// é config de MODO DE SINCRONIA para um dojô que JÁ está linkado (o
// próprio picker do antigo botão "Conectar dojô" só listava dojôs com
// karate_dojo_linked_at IS NOT NULL, via GET /federation/:id/dojos, que
// filtra exatamente por isso). A seção "Dojôs querendo entrar" (via
// GET /connections/requests) foi REMOVIDA daqui: era o inbox morto,
// sempre vazio — o inbox de verdade sempre foi karate_affiliation_requests
// (aba Filiações). O botão de ação agora leva pra lá: não existe hoje um
// endpoint que liste "dojôs roteados à federação e ainda não linkados"
// (candidatos a origin='federation') — GET /dojos exclui esses por design
// — então, em vez de inventar um endpoint novo pra um picker, o botão
// abre a aba Filiações (que já tem o formulário de aprovação e, com o
// número/CNPJ em mãos, a federação registra por lá).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
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
import { karateConnectionsApi, Connection } from "@/services/karateConnectionsApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

export function connView(c: Connection): { label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  if (c.status === "connected" && c.via === "native") return { label: "Conectado · atualiza sozinho", tone: "ok" };
  if (c.status === "connected" && c.via === "manual") return { label: "A federação cuida", tone: "neutral" };
  if (c.status === "pending") return { label: "Esperando o dojô aceitar", tone: "warn" };
  if (c.status === "error") return { label: "Conexão caiu", tone: "danger" };
  return { label: "Desligado", tone: "neutral" };
}

interface ConexoesTabProps {
  /** Chamado quando o usuário toca "Abrir filiação" — troca pra aba
   *  Filiações (setActiveTab no container, ver ../index.tsx). Sem
   *  navegação de rota: é uma troca de aba dentro da MESMA tela, então um
   *  callback direto evita depender de re-render por query param. */
  onOpenFiliacoes?: () => void;
}

export function ConexoesTab({ onOpenFiliacoes }: ConexoesTabProps) {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [conns, setConns] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const list = await karateConnectionsApi.listConnections(federationId);
      setConns((list?.data ?? []).filter((c) => c.status !== "pending"));
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;
  const connected = conns.filter((c) => c.status === "connected").length;
  const problems = conns.filter((c) => c.status === "error").length;

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}>
        <PageHead
          eyebrow="Dojôs da federação"
          title="Sincronização"
          sub="Cada dojô se conecta de um jeito: ou usa o Aura Karatê e tudo se atualiza sozinho, ou a federação cuida de tudo. Para conectar um dojô novo, abra um pedido de filiação."
          actions={<ShojiButton label="Abrir filiação" icon="inbox" variant="sumi" onPress={() => onOpenFiliacoes?.()} />}
        />

        {problems > 0 && (
          <View style={styles.warn}>
            <Icon name="warning" size={18} color={P.red} />
            <Body style={{ flex: 1, color: C.ink }}>{problems === 1 ? "1 dojô parou de enviar atualizações" : `${problems} dojôs pararam de enviar atualizações`}. Abra o dojô e toque em Reconectar.</Body>
          </View>
        )}

        <View style={styles.section}>
          <SectionHead title="Dojôs conectados" sub={`${connected} conectado(s)`} />
          {loading ? <ActivityIndicator style={{ marginTop: 24 }} size="large" color={P.red} />
            : conns.length === 0 ? <Card><KarateEmptyState icon="link-outline" title="Nenhum dojô conectado ainda" subtitle="Abra um pedido de filiação na aba Filiações para conectar o primeiro dojô." style={{ paddingVertical: 28 }} /></Card>
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
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: 1000, width: "100%", alignSelf: "center" } as ViewStyle,
  warn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, padding: 14, marginTop: SP[4] } as ViewStyle,
  section: { marginTop: SP[8] } as ViewStyle,
  dojoName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
});
