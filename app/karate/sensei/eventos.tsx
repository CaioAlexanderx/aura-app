// ============================================================
// Painel do Sensei — Eventos (DESIGN-23)
// Próximos exames e cursos ABERTOS da federação (dados reais via
// GET /federation/:id/dojo/events). A inscrição passa pela federação.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, SenseiEvent, SenseiEventsResponse } from "@/services/karateApi";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Formata 'YYYY-MM-DD' sem cair no bug de -1 dia (parse manual, sem Date UTC).
function fmtDataLonga(iso: string | null): string {
  if (!iso) return "Data a definir";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return String(iso);
  return `${parseInt(d, 10)} de ${MESES[mi]} de ${y}`;
}

function fmtTaxa(v: number | null): string | null {
  if (v == null) return null;
  if (v === 0) return "Gratuito";
  return `Taxa: ${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por aluno`;
}

function tipoLabel(examType: string): string {
  return examType === "curso" ? "Curso / seminário" : "Exame de faixa";
}

export default function SenseiEventos() {
  const { federationId } = useKarateFederation();
  const [showHow, setShowHow] = useState(false);
  const [data, setData] = useState<SenseiEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listSenseiEvents(federationId);
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const eventos: SenseiEvent[] = data?.events ?? [];
  const fed = data?.federation ?? null;
  const contatoEmail = fed?.email || "eventos@fpkt.org.br";
  const contatoFone = fed?.phone || null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Abertos ao seu dojô</Text>
        <Text style={styles.title}>Próximos eventos</Text>
        <Text style={styles.lead}>Exames e cursos da federação. Para inscrever seus alunos, envie a lista para a federação — ela cuida do resto.</Text>
      </View>

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.stateBox}>
          <Icon name="alert-circle-outline" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Não foi possível carregar os eventos.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && eventos.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="calendar-outline" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhum evento aberto no momento.</Text>
          <Text style={styles.stateSub}>Quando a federação abrir exames ou cursos, eles aparecem aqui.</Text>
        </View>
      )}

      {!loading && !error && eventos.map((e) => {
        const taxa = fmtTaxa(e.fee_amount);
        return (
          <View key={e.id} style={styles.card}>
            <Text style={styles.evEyebrow}>{tipoLabel(e.exam_type)}</Text>
            <Text style={styles.evTipo}>{e.name}</Text>
            <View style={styles.metaRow}><Icon name="calendar-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta}>{fmtDataLonga(e.event_date)}</Text></View>
            {!!e.location && (
              <View style={styles.metaRow}><Icon name="location-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta} numberOfLines={1}>{e.location}</Text></View>
            )}
            {!!taxa && (
              <View style={styles.metaRow}><Icon name="pricetag-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta}>{taxa}</Text></View>
            )}
            <TouchableOpacity style={styles.askBtn} onPress={() => setShowHow(true)} accessibilityRole="button">
              <Icon name="paper-plane-outline" size={14} color={KarateColors.primary} />
              <Text style={styles.askTxt}>Solicitar inscrição</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Modal visible={showHow} transparent animationType="fade" onRequestClose={() => setShowHow(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Como inscrever seus alunos</Text>
              <TouchableOpacity onPress={() => setShowHow(false)} accessibilityLabel="Fechar"><Icon name="close" size={22} color={KarateColors.ink} /></TouchableOpacity>
            </View>
            <Text style={styles.sheetBody}>Envie a lista de alunos que vão participar para a federação{fed?.name ? ` (${fed.name})` : ""}. Ela confirma as vagas e a taxa, e faz a inscrição para você.</Text>
            <View style={styles.contactRow}><Icon name="mail-outline" size={16} color={KarateColors.primary} /><Text style={styles.contact}>{contatoEmail}</Text></View>
            {!!contatoFone && (
              <View style={styles.contactRow}><Icon name="logo-whatsapp" size={16} color={KarateColors.ok} /><Text style={styles.contact}>{contatoFone}</Text></View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 12, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 320 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 5 } as ViewStyle,
  evEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  evTipo: { fontSize: 15, fontWeight: "700", color: KarateColors.ink, marginBottom: 2 } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  askBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  askTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 380, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 20, gap: 10 } as ViewStyle,
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  sheetTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetBody: { fontSize: 13, color: KarateColors.ink2, lineHeight: 19 } as TextStyle,
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, padding: 11 } as ViewStyle,
  contact: { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
});
