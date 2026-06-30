// ============================================================
// Conexão do dojô — Aura Karatê (federação)
//
// Selo de situação + aviso quando precisa + "o que chegou do dojô"
// em linguagem humana, a partir dos eventos REAIS de sync. O bloco
// técnico fica recolhido (suporte). Sem mock: loading → spinner,
// falha → ErrorState.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateConnectionsApi, ConnectionDetail, SyncEvent } from "@/services/karateConnectionsApi";

type Vibe = "ok" | "manual" | "down" | "empty";

// Rótulos amigáveis para os tipos de evento de sync conhecidos.
const EVENT_LABEL: Record<string, { label: string; icon: string }> = {
  "practitioner.created":  { label: "Novo aluno cadastrado no dojô", icon: "people" },
  "practitioner.updated":  { label: "Cadastro de aluno atualizado", icon: "person" },
  "attendance.recorded":   { label: "Presenças registradas no treino", icon: "checkmark-circle" },
  "belt.updated":          { label: "Faixa de aluno atualizada", icon: "ribbon" },
  "annuity.paid":          { label: "Anuidade do dojô paga", icon: "wallet" },
  "exam.enrolled":         { label: "Inscrição em exame de faixa", icon: "trophy" },
};
function humanize(ev: SyncEvent): { icon: string; text: string; warn: boolean } {
  const known = EVENT_LABEL[ev.event_type];
  return {
    icon: ev.status === "failed" ? "alert-circle" : (known?.icon ?? "sync"),
    text: known?.label ?? ev.event_type.replace(/[._]/g, " "),
    warn: ev.status === "failed",
  };
}

function fmtAgo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return "agora mesmo";
  if (mins < 60) return `há ${mins} minutos`;
  const h = Math.round(mins / 60);
  if (h < 24) return `há ${h} ${h === 1 ? "hora" : "horas"}`;
  const dias = Math.round(h / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export default function ConexaoDojoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const connId = String(id || "");

  const [conn, setConn] = useState<ConnectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!connId) return;
    setLoading(true);
    setError(false);
    karateConnectionsApi.getConnection(federationId, connId)
      .then(setConn)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, connId]);
  useEffect(() => { load(); }, [load]);

  const reconnect = async () => {
    setBusy(true);
    try {
      await karateConnectionsApi.reconnect(federationId, connId);
      setShowTech(false);
      load();
    } catch (e: any) {
      Alert.alert("Não foi possível reconectar", e?.message ?? "Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  const rotateKey = async () => {
    try {
      await karateConnectionsApi.rotateKey(federationId, connId);
      Alert.alert("Nova chave gerada", "A conexão foi protegida com uma nova chave.");
    } catch (e: any) {
      Alert.alert("Não foi possível gerar a chave", e?.message ?? "Tente novamente.");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg }}>
        <ActivityIndicator size="large" color={KarateColors.primary} style={{ marginTop: 48 }} />
      </View>
    );
  }
  if (error || !conn) return <KarateErrorState onRetry={load} />;

  const vibe: Vibe =
    conn.status === "error" ? "down" :
    conn.via === "manual" ? "manual" :
    conn.last_sync_at == null && conn.via === "native" ? "empty" : "ok";

  const events = conn.recent_events ?? [];

  const HERO: Record<Vibe, { tone: ViewStyle; icon: any; color: string; t: string; sub: string }> = {
    ok:     { tone: styles.heroOk,   icon: "checkmark-circle", color: KarateColors.ok,     t: `Conectado · atualizado ${fmtAgo(conn.last_sync_at)}`, sub: "Tudo chega sozinho. Você não precisa fazer nada aqui." },
    manual: { tone: styles.heroNeu,  icon: "shield-checkmark", color: KarateColors.ink3,   t: "A federação cuida deste dojô", sub: "O dojô não usa sistema. Os cadastros e lançamentos são feitos pela federação." },
    down:   { tone: styles.heroBad,  icon: "alert-circle",     color: KarateColors.danger,  t: "Conexão caiu", sub: "O dojô parou de conversar com a federação. Veja o aviso abaixo para reconectar." },
    empty:  { tone: styles.heroNeu,  icon: "time",             color: KarateColors.ink3,   t: "Conexão ligada", sub: "Esperando o dojô enviar as primeiras informações. Não precisa fazer nada." },
  };
  const h = HERO[vibe];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button">
        <Icon name="chevron-back" size={18} color={KarateColors.primary} />
        <Text style={styles.backText}>Conexões</Text>
      </TouchableOpacity>

      <View>
        <Text style={styles.eyebrow}>{conn.dojo_name} · {conn.fpkt_affiliation_id}</Text>
        <Text style={styles.title}>Conexão do dojô</Text>
        <Text style={styles.lead}>As informações do dojô chegam sozinhas. Você só precisa olhar aqui se algo precisar de atenção.</Text>
      </View>

      {/* Aviso proativo (só quando caiu) */}
      {vibe === "down" && (
        <View style={styles.alertCard}>
          <View style={styles.alertHead}>
            <Icon name="warning" size={18} color={KarateColors.danger} />
            <Text style={styles.alertTitle}>A conexão com o {conn.dojo_name} caiu</Text>
          </View>
          <Text style={styles.alertBody}>Enquanto isso, o que o dojô registra (alunos novos, presenças, pagamentos) não está chegando à federação. Reconectar costuma resolver na hora.</Text>
          <View style={styles.alertActions}>
            <KarateButton label="Reconectar" variant="primary" size="sm" onPress={reconnect} loading={busy} />
          </View>
        </View>
      )}

      {/* Selo */}
      <View style={[styles.hero, h.tone]}>
        <View style={[styles.heroIco, { borderColor: h.color }]}>
          <Icon name={h.icon} size={24} color={h.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroT, { color: h.color }]}>{h.t}</Text>
          <Text style={styles.heroSub}>{h.sub}</Text>
        </View>
      </View>

      {/* O que chegou do dojô (eventos reais) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>O que chegou do dojô</Text>
        <Text style={styles.cardSub}>Atividade recente · mais novo primeiro</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyTxt}>Ainda não chegou nada. Assim que o dojô registrar alunos, presenças ou pagamentos, eles aparecem aqui automaticamente.</Text>
        ) : (
          events.map((ev) => {
            const e = humanize(ev);
            return (
              <View key={ev.id} style={styles.actRow}>
                <View style={[styles.actIco, e.warn && styles.actIcoWarn]}>
                  <Icon name={e.icon as any} size={16} color={e.warn ? KarateColors.danger : KarateColors.ink3} />
                </View>
                <Text style={styles.actT}>
                  {e.text}{e.warn ? <Text style={styles.actFlag}>  falhou</Text> : null}
                </Text>
                <Text style={styles.actWhen}>{fmtAgo(ev.created_at)}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Ver detalhes técnicos (recolhido · suporte) */}
      <TouchableOpacity style={styles.techToggle} onPress={() => setShowTech((v) => !v)} accessibilityRole="button">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="settings-outline" size={15} color={KarateColors.ink3} />
          <Text style={styles.techToggleText}>Ver detalhes técnicos</Text>
        </View>
        <Icon name={showTech ? "chevron-up" : "chevron-down"} size={16} color={KarateColors.ink3} />
      </TouchableOpacity>
      {showTech && (
        <View style={styles.techBody}>
          <Text style={styles.techNote}>Esta área é para o suporte da Aura. No dia a dia você não precisa mexer aqui — a conexão se cuida sozinha.</Text>
          <View style={styles.techRow}><Text style={styles.techK}>Chave de conexão</Text><Text style={styles.techV}>{conn.sync_token_masked ?? "—"}</Text></View>
          <View style={styles.techRow}><Text style={styles.techK}>Última verificação</Text><Text style={styles.techV}>{fmtAgo(conn.last_sync_at)}</Text></View>
          <View style={styles.techActions}>
            <KarateButton label="Tentar atualizar agora" variant="ghost" size="sm" onPress={reconnect} loading={busy} />
            <KarateButton label="Gerar nova chave" variant="ghost" size="sm" onPress={rotateKey} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40, maxWidth: 760, width: "100%", alignSelf: "center" } as ViewStyle,
  back: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,
  title: { fontFamily: KarateFonts.heading, fontSize: 23, fontWeight: "400", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  alertCard: { backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 14 } as ViewStyle,
  alertHead: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  alertTitle: { fontSize: 15, fontWeight: "800", color: KarateColors.ink, flex: 1 } as TextStyle,
  alertBody: { fontSize: 13, color: KarateColors.ink2, lineHeight: 19, marginTop: 6 } as TextStyle,
  alertActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 } as ViewStyle,
  hero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: KarateRadius.lg, borderWidth: 1, padding: 18 } as ViewStyle,
  heroOk: { backgroundColor: KarateColors.okSoft, borderColor: KarateColors.ok } as ViewStyle,
  heroNeu: { backgroundColor: KarateColors.surface, borderColor: KarateColors.border } as ViewStyle,
  heroBad: { backgroundColor: KarateColors.dangerSoft, borderColor: KarateColors.danger } as ViewStyle,
  heroIco: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  heroT: { fontSize: 16, fontWeight: "800" } as TextStyle,
  heroSub: { fontSize: 13, color: KarateColors.ink2, marginTop: 3, lineHeight: 18 } as TextStyle,
  card: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2, marginBottom: 6 } as TextStyle,
  emptyTxt: { fontSize: 13, color: KarateColors.ink3, lineHeight: 19, paddingVertical: 8 } as TextStyle,
  actRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  actIco: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.surface } as ViewStyle,
  actIcoWarn: { backgroundColor: KarateColors.dangerSoft } as ViewStyle,
  actT: { flex: 1, fontSize: 14, color: KarateColors.ink } as TextStyle,
  actFlag: { fontSize: 12, fontWeight: "700", color: KarateColors.danger } as TextStyle,
  actWhen: { fontSize: 12, color: KarateColors.ink4, marginLeft: 6 } as TextStyle,
  techToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  techToggleText: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  techBody: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, marginTop: -6, gap: 8 } as ViewStyle,
  techNote: { fontSize: 12.5, color: KarateColors.ink3, lineHeight: 18, marginBottom: 4 } as TextStyle,
  techRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  techK: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  techV: { fontSize: 12, color: KarateColors.ink2, fontFamily: KarateFonts.mono } as TextStyle,
  techActions: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" } as ViewStyle,
});
