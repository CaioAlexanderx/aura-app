// ============================================================
// CampaignResultSummary — números REAIS de POST /campaign ou /batch
// (created/skipped/errors). Compartilhado entre o passo 4 do CampaignWizard
// e o BatchLaunchModal (multi-seleção da tabela) — mesmo motor no backend,
// mesmo resumo na UI.
//
// Erro parcial NÃO é falha do lote: cada alvo roda sob SAVEPOINT no
// backend, então um erro isolado não derruba os demais. Este componente
// deixa isso explícito em vez de só listar números frios.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import type { AnnuityCampaignResult } from "@/services/karateApi";
import { fmtMoney } from "./types";

const SKIP_REASON_LABEL: Record<string, string> = {
  already_has_annuity_this_season: "já tinha cobrança lançada nesta temporada",
};

function skipLabel(reason: string): string {
  return SKIP_REASON_LABEL[reason] || reason;
}

// F2 (migration 226) — 'plano_indefinido' é o motivo mais comum de erro
// aqui quando o alvo veio de fora do CampaignWizard (ex.: BatchLaunchModal,
// que lança direto sem passar pelo preview/Step3Review — não tem como
// avisar ANTES de confirmar). Mensagem em português explica o que fazer.
const ERROR_REASON_LABEL: Record<string, string> = {
  plano_indefinido: "sem plano de anuidade definido — cadastre o plano do dojô (Anual/Semestral/Trimestral) e tente de novo",
};

function errorLabel(reason: string): string {
  return ERROR_REASON_LABEL[reason] || reason;
}

export function CampaignResultSummary({ result }: { result: AnnuityCampaignResult }) {
  const createdTotal = result.created.reduce((s, c) => s + Number(c.total || 0), 0);
  const hasErrors = result.errors.length > 0;
  const hasSkipped = result.skipped.length > 0;

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.metricsRow}>
        <View style={[styles.metric, styles.metricOk]}>
          <Icon name="checkmark-circle" size={16} color={P.ok} />
          <Text style={[styles.metricValue, { color: P.ok }]}>{result.created.length}</Text>
          <Text style={styles.metricLabel}>criadas{createdTotal > 0 ? ` · ${fmtMoney(createdTotal)}` : ""}</Text>
        </View>
        <View style={[styles.metric, styles.metricWarn]}>
          <Icon name="time" size={16} color={P.warn} />
          <Text style={[styles.metricValue, { color: P.warn }]}>{result.skipped.length}</Text>
          <Text style={styles.metricLabel}>puladas (já tinham cobrança)</Text>
        </View>
        <View style={[styles.metric, hasErrors ? styles.metricDanger : styles.metricNeutral]}>
          <Icon name={hasErrors ? "warning" : "ellipse-outline"} size={16} color={hasErrors ? P.danger : C.ink4} />
          <Text style={[styles.metricValue, { color: hasErrors ? P.danger : C.ink4 }]}>{result.errors.length}</Text>
          <Text style={styles.metricLabel}>com erro</Text>
        </View>
      </View>

      {hasErrors && (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            {result.created.length > 0
              ? "Erro parcial não invalida o lote: as cobranças criadas acima já estão lançadas normalmente. Reveja os itens com erro abaixo e tente novamente só para eles."
              : "Nenhuma cobrança foi criada — reveja os itens com erro abaixo antes de tentar novamente."}
          </Text>
        </View>
      )}

      {result.created.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Criadas</Text>
          {result.created.map((c) => (
            <View key={`${c.type}-${c.id}`} style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.rowMeta}>{fmtMoney(c.total)}</Text>
            </View>
          ))}
        </View>
      )}

      {hasSkipped && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Puladas</Text>
          {result.skipped.map((s) => (
            <View key={`${s.type}-${s.id}`} style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
              <Text style={[styles.rowMeta, { color: P.warn }]}>{skipLabel(s.reason)}</Text>
            </View>
          ))}
        </View>
      )}

      {hasErrors && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Com erro</Text>
          {result.errors.map((e, idx) => (
            <View key={`${e.type}-${e.id}-${idx}`} style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>{e.name || "—"}</Text>
              <Text style={[styles.rowMeta, { color: P.danger }]} numberOfLines={2}>{errorLabel(e.reason)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  metric: { flexGrow: 1, flexBasis: 140, alignItems: "center", gap: 4, paddingVertical: 14, borderRadius: R.lg, borderWidth: 1 } as ViewStyle,
  metricOk: { backgroundColor: P.okWash, borderColor: P.okLine } as ViewStyle,
  metricWarn: { backgroundColor: P.warnWash, borderColor: "rgba(156,111,46,0.3)" } as ViewStyle,
  metricDanger: { backgroundColor: P.dangerWash, borderColor: P.redLine } as ViewStyle,
  metricNeutral: { backgroundColor: P.glass2, borderColor: C.line2 } as ViewStyle,
  metricValue: { fontFamily: F.heading, fontSize: 26, fontWeight: "400" } as TextStyle,
  metricLabel: { fontFamily: F.body, fontSize: 11, color: C.ink3, textAlign: "center", paddingHorizontal: 8 } as TextStyle,

  note: { backgroundColor: P.warnWash, borderWidth: 1, borderColor: "rgba(156,111,46,0.3)", borderRadius: R.md, padding: 12 } as ViewStyle,
  noteText: { fontFamily: F.body, fontSize: 12.5, lineHeight: 18, color: C.ink2 } as TextStyle,

  group: { gap: 6 } as ViewStyle,
  groupTitle: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  rowName: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink } as TextStyle,
  rowMeta: { fontFamily: F.mono, fontSize: 11.5, color: C.ink2, textAlign: "right", maxWidth: 220 } as TextStyle,
});
