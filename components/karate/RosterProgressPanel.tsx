// ============================================================
// RosterProgressPanel — Aura Karatê (federação) · Shoji
//
// Painel da federação (G1 item 8): andamento do pedido de atualização
// cadastral em TODOS os dojôs — não abriu / em andamento / validado, e
// quantos praticantes ainda estão sem contato. Sem isso, pedir a
// atualização é "pedido no vácuo": a federação nunca sabe quem ainda não
// mexeu no link.
//
// Self-contained: busca os próprios dados (GET /federation/:id/dojos/
// roster-progress), não depende de nenhum estado da tela host — só recebe
// `federationId` (estável entre renders), então é seguro plugar dentro do
// header memoizado da lista de dojôs sem repetir o bug de foco perdido
// (ListHeaderComponent com identidade instável).
//
// Falha silenciosa: se o endpoint não responder (schema pendente/erro),
// o painel some sem quebrar a tela — mesmo padrão do RosterValidationBanner.
// ============================================================
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { Card, SectionHead, Mono, RowPressable } from "@/components/karate/shoji";
import { karateApi, DojoRosterProgress, RosterProgressStatus } from "@/services/karateApi";

const STATUS_VIEW: Record<RosterProgressStatus, { label: string; color: string; bg: string; icon: string }> = {
  nao_aberto:   { label: "Não abriu",     color: P.neutral, bg: P.neutralWash, icon: "close-circle" },
  em_andamento: { label: "Em andamento",  color: P.warn,    bg: P.warnWash,    icon: "time" },
  validado:     { label: "Validado",      color: P.ok,      bg: P.okWash,      icon: "checkmark-circle" },
};

function StatusPill({ status }: { status: RosterProgressStatus }) {
  const v = STATUS_VIEW[status];
  return (
    <View style={[st.statusPill, { backgroundColor: v.bg }]}>
      <Icon name={v.icon} size={11} color={v.color} />
      <Text style={[st.statusPillTxt, { color: v.color }]}>{v.label}</Text>
    </View>
  );
}

export function RosterProgressPanel({ federationId }: { federationId: string }) {
  const router = useRouter();
  const [data, setData] = useState<DojoRosterProgress[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    if (!federationId) return;
    setLoading(true);
    karateApi.getRosterProgress(federationId)
      .then((res) => setData(res.data || []))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const rows = data || [];
    return {
      naoAberto: rows.filter((r) => r.status === "nao_aberto").length,
      emAndamento: rows.filter((r) => r.status === "em_andamento").length,
      validado: rows.filter((r) => r.status === "validado").length,
      semContato: rows.reduce((acc, r) => acc + (r.praticantes_sem_contato || 0), 0),
    };
  }, [data]);

  // Dojôs que precisam de atenção: ainda não abriram ou estão em
  // andamento, ordenados por quem tem mais gente sem contato primeiro —
  // é a fila de cobrança da federação (quem empurrar primeiro).
  const pending = useMemo(() => {
    return (data || [])
      .filter((r) => r.status !== "validado" && (r.requested_at || r.essenciais_faltando > 0))
      .sort((a, b) => b.essenciais_faltando - a.essenciais_faltando);
  }, [data]);

  if (!loading && (!data || data.length === 0)) return null;

  const visiblePending = expanded ? pending : pending.slice(0, 5);

  return (
    <Card style={{ marginTop: SP[4], marginBottom: SP[6] }}>
      <SectionHead
        title="Atualização cadastral — andamento"
        sub="Quantos dojôs já abriram o link do sensei e confirmaram o quadro."
      />
      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <ActivityIndicator color={P.ink3} size="small" />
        </View>
      ) : (
        <>
          <View style={st.summaryRow}>
            <SummaryCell label="Não abriu" value={summary.naoAberto} color={P.neutral} />
            <SummaryCell label="Em andamento" value={summary.emAndamento} color={P.warn} />
            <SummaryCell label="Validado" value={summary.validado} color={P.ok} />
            <SummaryCell label="Sem contato" value={summary.semContato} color={P.red} />
          </View>

          {pending.length > 0 && (
            <View style={{ marginTop: 14 }}>
              {visiblePending.map((r) => (
                <RowPressable
                  key={r.dojo_id}
                  onPress={() => router.push(`/karate/dojos/${r.dojo_id}` as any)}
                  style={st.dojoRow}
                  accessibilityLabel={`Ver ${r.dojo_nome}`}
                >
                  <Text style={st.dojoName} numberOfLines={1}>{r.dojo_nome}</Text>
                  <View style={st.dojoMeta}>
                    {r.essenciais_faltando > 0 && (
                      <Mono style={st.dojoCount}>{r.essenciais_faltando} essencial{r.essenciais_faltando !== 1 ? "is" : ""}</Mono>
                    )}
                    <StatusPill status={r.status} />
                  </View>
                </RowPressable>
              ))}
              {pending.length > 5 && (
                <RowPressable onPress={() => setExpanded((e) => !e)} style={st.moreRow} accessibilityLabel={expanded ? "Ver menos" : "Ver todos"}>
                  <Text style={st.moreTxt}>{expanded ? "Ver menos" : `Ver todos os ${pending.length}`}</Text>
                  <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} color={C.ink3} />
                </RowPressable>
              )}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={st.summaryCell}>
      <Text style={[st.summaryVal, { color }]}>{value}</Text>
      <Text style={st.summaryLabel}>{label}</Text>
    </View>
  );
}

export default RosterProgressPanel;

const st = StyleSheet.create({
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 6 } as ViewStyle,
  summaryCell: { minWidth: 88 } as ViewStyle,
  summaryVal: { fontFamily: F.heading, fontSize: 24, fontWeight: "600" } as TextStyle,
  summaryLabel: { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 2 } as TextStyle,
  dojoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: P.line, gap: 10 } as ViewStyle,
  dojoName: { flex: 1, fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  dojoMeta: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  dojoCount: { fontSize: 11, color: C.ink3 } as TextStyle,
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: R.pill } as ViewStyle,
  statusPillTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,
  moreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 4 } as ViewStyle,
  moreTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
});
