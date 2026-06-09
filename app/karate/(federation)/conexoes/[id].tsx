// ============================================================
// Conexão do dojô — Aura Karatê Fase 5 (DESIGN-24, revisado)
//
// A atualização é automática e invisível. Esta tela mostra um selo
// simples + aviso só quando precisa + "o que chegou do dojô" em
// linguagem humana. O técnico fica recolhido (para o suporte).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateConnectionsApi, ConnectionDetail } from "@/services/karateConnectionsApi";

type Vibe = "ok" | "manual" | "down" | "empty";

const MOCK_DETAIL: ConnectionDetail = {
  id: "c1", federation_id: "", dojo_id: "d10", dojo_name: "Academia Musashi",
  fpkt_affiliation_id: "FPKT-001", via: "native", status: "connected",
  sync_token_masked: "••••", token_rotated_at: null, connected_at: "2026-05-01",
  last_sync_at: "2026-06-09T14:30:00Z", last_sync_status: "ok", notes: null,
  recent_events: [],
};

function humanActivity(vibe: Vibe) {
  const base = [
    { icon: "people", t: "2 alunos novos vieram do dojô", when: "há 10 minutos", warn: false },
    { icon: "checkmark-circle", t: "23 presenças registradas no treino de hoje", when: "há 1 hora", warn: false },
    { icon: "ribbon", t: "A faixa do João Mendes foi atualizada para Roxa", when: "hoje, 09:40", warn: false },
    { icon: "wallet", t: "Anuidade do dojô paga — R$ 1.450", when: "ontem", warn: false },
    { icon: "trophy", t: "5 alunos inscritos no Exame de Faixa de junho", when: "ontem", warn: false },
  ];
  if (vibe === "down") {
    base.unshift({ icon: "alert-circle", t: "Os 4 alunos novos do dojô ainda não chegaram aqui", when: "desde ontem", warn: true });
  }
  return base;
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

  const [conn, setConn] = useState<ConnectionDetail>(MOCK_DETAIL);
  const [showTech, setShowTech] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await karateConnectionsApi.getConnection(federationId, connId);
      if (d?.id) setConn(d);
    } catch { /* [MOCK fallback] */ }
  }, [federationId, connId]);
  useEffect(() => { load(); }, [load]);

  const vibe: Vibe =
    conn.status === "error" ? "down" :
    conn.via === "manual" ? "manual" :
    conn.last_sync_at == null && conn.via === "native" ? "empty" : "ok";

  const reconnect = async () => {
    try { await karateConnectionsApi.reconnect(federationId, connId); } catch { /* mock */ }
    setConn((c) => ({ ...c, status: "connected", last_sync_status: "ok", last_sync_at: new Date().toISOString() }));
    setShowTech(false);
  };

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
        <Ionicons name="chevron-back" size={18} color={KarateColors.primary} />
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
            <Ionicons name="warning" size={18} color={KarateColors.danger} />
            <Text style={styles.alertTitle}>A conexão com o {conn.dojo_name} caiu</Text>
          </View>
          <Text style={styles.alertBody}>Enquanto isso, o que o dojô registra (alunos novos, presenças, pagamentos) não está chegando à federação. Reconectar costuma resolver na hora.</Text>
          <View style={styles.alertActions}>
            <KarateButton label="Reconectar" variant="primary" size="sm" onPress={reconnect} />
            <TouchableOpacity style={styles.ghostBtn}><Text style={styles.ghostText}>Falar com o dojô</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Selo */}
      <View style={[styles.hero, h.tone]}>
        <View style={[styles.heroIco, { borderColor: h.color }]}>
          <Ionicons name={h.icon} size={24} color={h.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroT, { color: h.color }]}>{h.t}</Text>
          <Text style={styles.heroSub}>{h.sub}</Text>
        </View>
      </View>

      {/* O que chegou do dojô */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>O que chegou do dojô</Text>
        <Text style={styles.cardSub}>Atividade recente · mais novo primeiro</Text>
        {vibe === "empty" ? (
          <Text style={styles.emptyTxt}>Ainda não chegou nada. Assim que o dojô registrar alunos, presenças ou pagamentos, eles aparecem aqui automaticamente.</Text>
        ) : (
          humanActivity(vibe).map((e, i) => (
            <View key={i} style={styles.actRow}>
              <View style={[styles.actIco, e.warn && styles.actIcoWarn]}>
                <Ionicons name={e.icon} size={16} color={e.warn ? KarateColors.danger : KarateColors.ink3} />
              </View>
              <Text style={styles.actT}>
                {e.t}{e.warn ? <Text style={styles.actFlag}>  ainda não chegou</Text> : null}
              </Text>
              <Text style={styles.actWhen}>{e.when}</Text>
            </View>
          ))
        )}
      </View>

      {/* Ver detalhes técnicos (recolhido · suporte) */}
      <TouchableOpacity style={styles.techToggle} onPress={() => setShowTech((v) => !v)} accessibilityRole="button">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="settings-outline" size={15} color={KarateColors.ink3} />
          <Text style={styles.techToggleText}>Ver detalhes técnicos</Text>
        </View>
        <Ionicons name={showTech ? "chevron-up" : "chevron-down"} size={16} color={KarateColors.ink3} />
      </TouchableOpacity>
      {showTech && (
        <View style={styles.techBody}>
          <Text style={styles.techNote}>Esta área é para o suporte da Aura. No dia a dia você não precisa mexer aqui — a conexão se cuida sozinha.</Text>
          <View style={styles.techRow}><Text style={styles.techK}>Chave de conexão</Text><Text style={styles.techV}>•••••••• (protegida)</Text></View>
          <View style={styles.techRow}><Text style={styles.techK}>Última verificação</Text><Text style={styles.techV}>{fmtAgo(conn.last_sync_at)}</Text></View>
          <View style={styles.techActions}>
            <KarateButton label="Tentar atualizar agora" variant="ghost" size="sm" onPress={reconnect} />
            <KarateButton label="Gerar nova chave" variant="ghost" size="sm" onPress={() => karateConnectionsApi.rotateKey(federationId, connId).catch(() => {})} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  back: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 22, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  alertCard: { backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 14 } as ViewStyle,
  alertHead: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  alertTitle: { fontSize: 15, fontWeight: "800", color: KarateColors.ink, flex: 1 } as TextStyle,
  alertBody: { fontSize: 13, color: KarateColors.ink2, lineHeight: 19, marginTop: 6 } as TextStyle,
  alertActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 } as ViewStyle,
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 4 } as ViewStyle,
  ghostText: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  hero: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: KarateRadius.lg, borderWidth: 1, padding: 18 } as ViewStyle,
  heroOk: { backgroundColor: KarateColors.okSoft, borderColor: KarateColors.ok } as ViewStyle,
  heroNeu: { backgroundColor: KarateColors.surface, borderColor: KarateColors.border } as ViewStyle,
  heroBad: { backgroundColor: KarateColors.dangerSoft, borderColor: KarateColors.danger } as ViewStyle,
  heroIco: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  heroT: { fontSize: 16, fontWeight: "800" } as TextStyle,
  heroSub: { fontSize: 13, color: KarateColors.ink2, marginTop: 3, lineHeight: 18 } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2, marginBottom: 6 } as TextStyle,
  emptyTxt: { fontSize: 13, color: KarateColors.ink3, lineHeight: 19, paddingVertical: 8 } as TextStyle,
  actRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  actIco: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.bg2 } as ViewStyle,
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
  techV: { fontSize: 12, color: KarateColors.ink2, fontFamily: "monospace" } as TextStyle,
  techActions: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" } as ViewStyle,
});
