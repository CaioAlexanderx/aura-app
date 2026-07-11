// ============================================================
// CampaignWizard · Passo 2 — Valores e vencimento
//
// Valores da vigência = SOMENTE LEITURA aqui (link pra "Valores e planos"
// pra quem quiser editar) — mudar o valor da fee não é escopo deste
// wizard. O campo editável é só o vencimento: a federação pode adiantar/
// atrasar a data que a rodada vai usar (due_date override do backend).
//
// Quando o vencimento natural do plano já passou (comum: hoje é julho, o
// plano vence em maio), o backend usa por padrão o ÚLTIMO DIA DO MÊS
// CORRENTE (a cobrança nasce "a vencer", nunca atrasada no instante em que
// é criada) e marca due_date_ajustada=true — este passo precisa deixar
// isso claro em linguagem simples, não só um badge técnico.
// ============================================================
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import type { AnnuityFeePlan, AnnuityCampaignScope } from "@/services/karateApi";
import { fmtDueDateLong, fmtMoney } from "./types";

type Props = {
  year: string;
  scope: AnnuityCampaignScope;
  fees: AnnuityFeePlan[];
  feesLoading: boolean;
  dueDateIso: string | null;      // vencimento efetivo que o backend VAI usar (default ou override)
  dueDateAdjusted: boolean;
  dueDateOverrideBr: string;      // texto do input (dd/mm/aaaa) — "" = sem override, usa o default
  onChangeDueDateOverride: (br: string) => void;
  dueDateInvalid: boolean;
  onOpenPlans: () => void;
};

export function Step2ValuesDueDate({
  year, scope, fees, feesLoading, dueDateIso, dueDateAdjusted,
  dueDateOverrideBr, onChangeDueDateOverride, dueDateInvalid, onOpenPlans,
}: Props) {
  const dojoFee = fees.find((f) => f.fee_type === "dojo" && f.plan === "anual") || null;
  const cpfFee = fees.find((f) => f.fee_type === "cpf" && f.plan === "anual") || null;
  const showDojo = scope !== "practitioners";
  const showCpf = scope !== "dojos";

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Valores da vigência</Text>
          <Pressable onPress={onOpenPlans} accessibilityRole="button" accessibilityLabel="Ver em Valores e planos">
            <Text style={styles.linkOut}>Ver em Valores e planos →</Text>
          </Pressable>
        </View>
        <View style={styles.feeRow}>
          {showDojo && (
            <View style={styles.feeCard}>
              <Text style={styles.feeLabel}>Dojô · Anual</Text>
              <Text style={styles.feeValue}>{feesLoading ? "—" : dojoFee ? fmtMoney(dojoFee.amount) : "não configurado"}</Text>
            </View>
          )}
          {showCpf && (
            <View style={styles.feeCard}>
              <Text style={styles.feeLabel}>Praticante (faixa-preta) · Anual</Text>
              <Text style={styles.feeValue}>{feesLoading ? "—" : cpfFee ? fmtMoney(cpfFee.amount) : "não configurado"}</Text>
            </View>
          )}
        </View>
        <Text style={styles.feeHint}>Somente leitura aqui — para alterar o valor, use a área "Valores e planos".</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vencimento desta rodada</Text>
        <Text style={styles.sectionSub}>
          Vale para todas as cobranças que a campanha for lançar agora. Deixe em branco pra usar o vencimento
          sugerido abaixo.
        </Text>

        <View style={styles.dueBox}>
          <Icon name="calendar" size={16} color={dueDateAdjusted ? P.warn : C.ink2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dueLabel}>Vencimento que será usado</Text>
            <Text style={[styles.dueValue, dueDateAdjusted && { color: P.warn }]}>{fmtDueDateLong(dueDateIso)}</Text>
          </View>
        </View>

        {dueDateAdjusted && (
          <View style={styles.adjustNote}>
            <Icon name="info" size={14} color={P.warn} />
            <Text style={styles.adjustNoteText}>
              O vencimento original do plano da temporada {year} já passou. Para a cobrança não nascer
              atrasada, ela vai usar o último dia do mês atual como vencimento — a menos que você escolha
              outra data abaixo.
            </Text>
          </View>
        )}

        <Text style={styles.inputLabel}>Escolher outro vencimento (opcional)</Text>
        <TextInput
          style={[styles.input, dueDateInvalid && styles.inputBad]}
          value={dueDateOverrideBr}
          onChangeText={(v) => onChangeDueDateOverride(maskBrDate(v))}
          keyboardType="numeric"
          placeholder={dueDateIso ? formatIsoToBr(dueDateIso) : "dd/mm/aaaa"}
          placeholderTextColor={C.ink4}
          maxLength={10}
          accessibilityLabel="Vencimento desta rodada"
        />
        {dueDateInvalid && (
          <Text style={styles.errInline}>
            {dueDateOverrideBr.length === 10 && !parseBrDate(dueDateOverrideBr)
              ? "Data inválida."
              : `A data precisa ser do ano ${year}.`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 } as ViewStyle,
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 } as ViewStyle,
  sectionTitle: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink, textTransform: "uppercase", letterSpacing: 0.6 } as TextStyle,
  sectionSub: { fontFamily: F.body, fontSize: 12, color: C.ink3, lineHeight: 17 } as TextStyle,
  linkOut: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: P.red } as TextStyle,

  feeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  feeCard: { flexGrow: 1, flexBasis: 180, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12 } as ViewStyle,
  feeLabel: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  feeValue: { fontFamily: F.mono, fontSize: 16, fontWeight: "700", color: C.ink, marginTop: 4 } as TextStyle,
  feeHint: { fontFamily: F.body, fontSize: 10.5, color: C.ink4, fontStyle: "italic" } as TextStyle,

  dueBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 14 } as ViewStyle,
  dueLabel: { fontFamily: F.body, fontSize: 10.5, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5 } as TextStyle,
  dueValue: { fontFamily: F.heading, fontSize: 18, color: C.ink, marginTop: 2 } as TextStyle,

  adjustNote: { flexDirection: "row", gap: 8, backgroundColor: P.warnWash, borderWidth: 1, borderColor: "rgba(156,111,46,0.3)", borderRadius: R.md, padding: 12 } as ViewStyle,
  adjustNoteText: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.ink2 } as TextStyle,

  inputLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.ink2, marginTop: 4 } as TextStyle,
  input: { fontFamily: F.mono, fontSize: 14, color: C.ink, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 11, maxWidth: 180 } as TextStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  errInline: { fontFamily: F.body, fontSize: 11, color: P.red } as TextStyle,
});
