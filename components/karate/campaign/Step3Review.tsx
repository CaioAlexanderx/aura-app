// ============================================================
// CampaignWizard · Passo 3 — Revisão
//
// Lista os alvos do preview (já filtrados pelo escopo do passo 1), com
// opção de excluir linha a linha — alimenta `exclude.dojo_ids` /
// `exclude.practitioner_ids` de POST /campaign. Resumo no topo: N
// cobranças, R$ previsto, vencimento — recalculado no cliente a partir
// das linhas NÃO excluídas (o preview já traz o valor por linha).
//
// Lista renderizada DIRETO dentro do ScrollView do wizard (mesmo padrão do
// Step2Returns do TrocaModal) — sem FlatList/ScrollView aninhado aqui.
// Evita de propósito o bug de RN Web "item flex não encolhe abaixo do
// conteúdo" (que exigiria flex:1+minHeight:0): não há um segundo scroller
// encaixado dentro de um pai flex:1, então não há nada pra encolher. Listas
// de 18+ alvos rolam junto com o resto do passo, dentro do único
// ScrollView do CampaignWizard.
// ============================================================
import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import type { AnnuityCampaignPreviewDojo, AnnuityCampaignPreviewPractitioner, AnnuityFeeCatalogEntry, AnnuityPlan } from "@/services/karateApi";
import {
  amountSum, fmtDueDateLong, fmtMoney,
  ANNUITY_PLAN_LABELS, ANNUITY_PLANS, effectiveDojoAmount, effectiveDojoInstallments, effectiveDojoPlan,
} from "./types";

type Props = {
  dojos: AnnuityCampaignPreviewDojo[];
  practitioners: AnnuityCampaignPreviewPractitioner[];
  excludedDojoIds: Set<string>;
  excludedPractitionerIds: Set<string>;
  onToggleDojo: (id: string) => void;
  onTogglePractitioner: (id: string) => void;
  dueDateIso: string | null;
  dueDateAdjusted: boolean;
  /** Catálogo dos 3 planos (valor/parcelas reais) — vem do MESMO preview
   *  (plan_catalog), usado para mostrar números reais nos dojôs sem plano
   *  definido (ver effectiveDojoAmount/Installments em ./types). */
  planCatalog: AnnuityFeeCatalogEntry[];
  /** { [dojo_id]: plan } — escolha do gestor pra dojôs plano_indefinido
   *  (default sugerido 'anual' quando ainda não escolheu nada). */
  dojoPlanOverrides: Record<string, AnnuityPlan>;
  onChangeDojoPlan: (dojoId: string, plan: AnnuityPlan) => void;
};

export function Step3Review({
  dojos, practitioners, excludedDojoIds, excludedPractitionerIds,
  onToggleDojo, onTogglePractitioner, dueDateIso, dueDateAdjusted,
  planCatalog, dojoPlanOverrides, onChangeDojoPlan,
}: Props) {
  const includedDojos = dojos.filter((d) => !excludedDojoIds.has(d.dojo_id));
  const includedPracts = practitioners.filter((p) => !excludedPractitionerIds.has(p.practitioner_id));
  const totalCount = includedDojos.length + includedPracts.length;
  const totalAmount = Math.round(
    (includedDojos.reduce((s, d) => s + effectiveDojoAmount(d, dojoPlanOverrides, planCatalog), 0) +
      amountSum(includedPracts)) * 100
  ) / 100;
  const indefinidoCount = includedDojos.filter((d) => d.plano_indefinido).length;

  return (
    <View style={{ gap: 18 }}>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalCount}</Text>
          <Text style={styles.summaryLabel}>{totalCount === 1 ? "cobrança" : "cobranças"}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{fmtMoney(totalAmount)}</Text>
          <Text style={styles.summaryLabel}>previsto</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, dueDateAdjusted && { color: P.warn }]}>{fmtDueDateLong(dueDateIso)}</Text>
          <Text style={styles.summaryLabel}>vencimento{dueDateAdjusted ? " · ajustado" : ""}</Text>
        </View>
      </View>

      {totalCount === 0 && (
        <View style={styles.emptyBox}>
          <Icon name="info" size={16} color={C.ink3} />
          <Text style={styles.emptyText}>Todos os alvos foram excluídos desta rodada — nada será lançado.</Text>
        </View>
      )}

      {indefinidoCount > 0 && (
        <View style={styles.warnBox}>
          <Icon name="warning" size={16} color={P.warn} />
          <Text style={styles.warnText}>
            {indefinidoCount === 1 ? "1 dojô está" : `${indefinidoCount} dojôs estão`} sem plano de anuidade definido —
            {indefinidoCount === 1 ? " vai usar" : " vão usar"} <Text style={{ fontWeight: "700" }}>Anual</Text> por
            padrão. Toque no plano de cada linha marcada abaixo para escolher outro antes de confirmar.
          </Text>
        </View>
      )}

      {dojos.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Dojôs ({includedDojos.length}/{dojos.length})</Text>
          {dojos.map((d) => {
            const excluded = excludedDojoIds.has(d.dojo_id);
            const effPlan = effectiveDojoPlan(d, dojoPlanOverrides);
            const effAmount = effectiveDojoAmount(d, dojoPlanOverrides, planCatalog);
            const effInstallments = effectiveDojoInstallments(d, dojoPlanOverrides, planCatalog);
            const parcelasLabel = effInstallments > 1 ? `${effInstallments}x` : "1x";
            return (
              <View key={d.dojo_id} style={[styles.row, excluded && styles.rowExcluded, d.plano_indefinido && !excluded && styles.rowIndefinido]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.rowName, excluded && styles.rowNameExcluded]} numberOfLines={1}>{d.name}</Text>
                    <View style={[styles.planBadge, d.plano_indefinido && styles.planBadgeWarn]}>
                      {d.plano_indefinido && <Icon name="warning" size={9} color={P.warn} />}
                      <Text style={[styles.planBadgeTxt, d.plano_indefinido && { color: P.warn }]}>
                        {ANNUITY_PLAN_LABELS[effPlan]} · {parcelasLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowMeta}>
                    {fmtMoney(effAmount)}{effInstallments > 1 ? ` no ano` : ""} · vence {fmtDueDateLong(d.due_date)}
                  </Text>
                  {d.plano_indefinido && !excluded && (
                    <View style={styles.planPickRow}>
                      <Text style={styles.planPickLabel}>Sem plano definido — usará {ANNUITY_PLAN_LABELS[effPlan]}. Trocar:</Text>
                      <View style={styles.planPickChips}>
                        {ANNUITY_PLANS.map((p) => {
                          const on = p === effPlan;
                          return (
                            <Pressable
                              key={p}
                              onPress={() => onChangeDojoPlan(d.dojo_id, p)}
                              style={[styles.planChip, on && styles.planChipOn]}
                              accessibilityRole="button"
                              accessibilityLabel={`Definir plano ${ANNUITY_PLAN_LABELS[p]} para ${d.name}`}
                            >
                              <Text style={[styles.planChipTxt, on && styles.planChipTxtOn]}>{ANNUITY_PLAN_LABELS[p]}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => onToggleDojo(d.dojo_id)}
                  style={[styles.excludeBtn, excluded && styles.excludeBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={excluded ? `Reincluir ${d.name}` : `Excluir ${d.name}`}
                >
                  <Icon name={excluded ? "refresh" : "x"} size={12} color={excluded ? P.ok : P.red} />
                  <Text style={[styles.excludeLabel, { color: excluded ? P.ok : P.red }]}>{excluded ? "Reincluir" : "Excluir"}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {practitioners.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Praticantes ({includedPracts.length}/{practitioners.length})</Text>
          {practitioners.map((p) => {
            const excluded = excludedPractitionerIds.has(p.practitioner_id);
            return (
              <View key={p.practitioner_id} style={[styles.row, excluded && styles.rowExcluded]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, excluded && styles.rowNameExcluded]} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.rowMeta}>
                    {p.karate_registration_number ? `${p.karate_registration_number} · ` : ""}
                    {fmtMoney(p.amount)} · vence {fmtDueDateLong(p.due_date)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onTogglePractitioner(p.practitioner_id)}
                  style={[styles.excludeBtn, excluded && styles.excludeBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={excluded ? `Reincluir ${p.name}` : `Excluir ${p.name}`}
                >
                  <Icon name={excluded ? "refresh" : "x"} size={12} color={excluded ? P.ok : P.red} />
                  <Text style={[styles.excludeLabel, { color: excluded ? P.ok : P.red }]}>{excluded ? "Reincluir" : "Excluir"}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, paddingVertical: 14 } as ViewStyle,
  summaryItem: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 6 } as ViewStyle,
  summaryValue: { fontFamily: F.heading, fontSize: 18, color: C.ink, textAlign: "center" } as TextStyle,
  summaryLabel: { fontFamily: F.body, fontSize: 10.5, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" } as TextStyle,
  summaryDivider: { width: 1, alignSelf: "stretch", backgroundColor: C.line2 } as ViewStyle,

  emptyBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12 } as ViewStyle,
  emptyText: { flex: 1, fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,

  group: { gap: 6 } as ViewStyle,
  groupTitle: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  rowExcluded: { opacity: 0.55 } as ViewStyle,
  rowName: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  rowNameExcluded: { textDecorationLine: "line-through" } as TextStyle,
  rowMeta: { fontFamily: F.mono, fontSize: 10.5, color: C.ink3, marginTop: 2 } as TextStyle,

  excludeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 9, borderRadius: R.sm, borderWidth: 1, borderColor: P.redLine, backgroundColor: P.redWash, flexShrink: 0 } as ViewStyle,
  excludeBtnActive: { borderColor: P.okLine, backgroundColor: P.okWash } as ViewStyle,
  excludeLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  // ── F2 (migration 226) — plano de anuidade indefinido no dojô ──────────
  warnBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.warnWash, borderWidth: 1, borderColor: "rgba(156,111,46,0.3)", borderRadius: R.md, padding: 12 } as ViewStyle,
  warnText: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.ink2 } as TextStyle,

  rowIndefinido: { backgroundColor: P.warnWash, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: R.sm, borderBottomColor: "transparent" } as ViewStyle,

  planBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 999, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2 } as ViewStyle,
  planBadgeWarn: { backgroundColor: "transparent", borderColor: "rgba(156,111,46,0.4)" } as ViewStyle,
  planBadgeTxt: { fontFamily: F.body, fontSize: 9.5, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.3 } as TextStyle,

  planPickRow: { marginTop: 6, gap: 5 } as ViewStyle,
  planPickLabel: { fontFamily: F.body, fontSize: 10.5, color: P.warn, fontWeight: "600" } as TextStyle,
  planPickChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" } as ViewStyle,
  planChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.line2, backgroundColor: "#fff" } as ViewStyle,
  planChipOn: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  planChipTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  planChipTxtOn: { color: P.red } as TextStyle,
});
