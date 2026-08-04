// ============================================================
// GraduacaoAlunoRow — Aura Karatê (dojô) · F10
//
// Uma linha do lote de lançamento do exame de faixa: os três quesitos
// (Kihon/Kata/Kumite), o RESULTADO (decisão explícita do sensei — nunca
// derivado dos quesitos), a faixa de destino (só quando aprovado, lista
// já vem filtrada ao teto do sensei — preta nunca aparece aqui) e o
// pedido de certificado da federação (aluno não federado também
// gradua; o certificado é que fica indisponível pra ele).
//
// StyleSheet: todos os top-level são objetos (WeakMap safe).
// ============================================================
import React from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateColors as C, KarateFonts as F, KarateRadius as R, KarateBelts, resolveBeltKey } from "@/constants/karateTheme";
import { BeltLadderStep, DojoBeltExamResultValue, QuesitoValue } from "@/services/karateDojoBeltExamApi";
import { QuesitoPicker } from "./QuesitoPicker";
import { resultErrorLabel } from "./helpers";

export interface GraduacaoRowState {
  kihon: QuesitoValue | null;
  kata: QuesitoValue | null;
  kumite: QuesitoValue | null;
  result: DojoBeltExamResultValue | null;
  toStep: BeltLadderStep | null;
  requestCertificate: boolean;
  notes: string;
}

export function emptyGraduacaoRow(): GraduacaoRowState {
  return { kihon: null, kata: null, kumite: null, result: null, toStep: null, requestCertificate: false, notes: "" };
}

interface RowStudent {
  id: string;
  full_name: string;
  belt_label: string | null;
  federated: boolean;
}

interface Props {
  student: RowStudent;
  value: GraduacaoRowState;
  onChange: (patch: Partial<GraduacaoRowState>) => void;
  onRemove?: () => void;
  ladder: BeltLadderStep[];
  errors?: { code: string; message: string }[];
  disabled?: boolean;
}

export function GraduacaoAlunoRow({ student, value, onChange, onRemove, ladder, errors, disabled }: Props) {
  const beltKey = student.belt_label ? resolveBeltKey(student.belt_label) : null;
  const isMarrom = value.toStep?.level === "marrom";

  return (
    <View style={[styles.card, errors && errors.length > 0 && styles.cardError]}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{student.full_name}</Text>
          <View style={styles.metaRow}>
            {!!student.belt_label && (
              <View style={styles.beltPill}>
                <View style={[styles.beltDot, { backgroundColor: beltKey ? KarateBelts[beltKey].color : C.ink4 }]} />
                <Text style={styles.beltPillTxt}>{student.belt_label}</Text>
              </View>
            )}
            <View style={[styles.fedPill, student.federated ? styles.fedPillOn : styles.fedPillOff]}>
              <Icon name={student.federated ? "check" : "info"} size={11} color={student.federated ? C.ok : C.ink3} />
              <Text style={[styles.fedPillTxt, { color: student.federated ? C.ok : C.ink3 }]}>
                {student.federated ? "Federado" : "Não federado"}
              </Text>
            </View>
          </View>
        </View>
        {!!onRemove && (
          <Pressable onPress={disabled ? undefined : onRemove} hitSlop={8} accessibilityLabel={`Remover ${student.full_name} do lote`}>
            <Icon name="x" size={16} color={C.ink3} />
          </Pressable>
        )}
      </View>

      <View style={styles.quesitosRow}>
        <QuesitoPicker label="Kihon" value={value.kihon} onChange={(v) => onChange({ kihon: v })} disabled={disabled} />
        <QuesitoPicker label="Kata" value={value.kata} onChange={(v) => onChange({ kata: v })} disabled={disabled} />
        <QuesitoPicker label="Kumite" value={value.kumite} onChange={(v) => onChange({ kumite: v })} disabled={disabled} />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Resultado</Text>
        <View style={styles.resultRow}>
          <ResultChip
            label="Aprovado"
            icon="check"
            active={value.result === "approved"}
            tone="ok"
            onPress={() => onChange({ result: value.result === "approved" ? null : "approved" })}
            disabled={disabled}
          />
          <ResultChip
            label="Reprovado"
            icon="x"
            active={value.result === "failed"}
            tone="danger"
            onPress={() => onChange({ result: value.result === "failed" ? null : "failed", toStep: value.result === "failed" ? value.toStep : null, requestCertificate: false })}
            disabled={disabled}
          />
        </View>
      </View>

      {value.result === "approved" && (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Faixa de destino</Text>
          <View style={styles.ladderWrap}>
            {ladder.map((step) => {
              const active = value.toStep?.level === step.level && value.toStep?.kyu === step.kyu;
              const key = resolveBeltKey(step.level);
              return (
                <Pressable
                  key={`${step.level}-${step.kyu ?? "x"}`}
                  onPress={disabled ? undefined : () => onChange({ toStep: step })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.ladderChip, active && styles.ladderChipActive]}
                >
                  <View style={[styles.beltDot, { backgroundColor: key ? KarateBelts[key].color : C.ink4 }]} />
                  <Text style={[styles.ladderChipTxt, active && styles.ladderChipTxtActive]}>{step.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {isMarrom && (
            <Text style={styles.grauNote}>Marrom tem três graus — escolhido: {value.toStep?.label}.</Text>
          )}

          <Pressable
            onPress={disabled ? undefined : () => onChange({ requestCertificate: !value.requestCertificate })}
            style={[styles.certRow, value.requestCertificate && styles.certRowActive]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.requestCertificate }}
          >
            <View style={[styles.checkbox, value.requestCertificate && styles.checkboxOn]}>
              {value.requestCertificate && <Icon name="check" size={11} color="#fff" />}
            </View>
            <Text style={styles.certTxt}>Pedir certificado da federação</Text>
          </Pressable>
          {!student.federated && (
            <Text style={styles.certHint}>
              Aluno não federado: gradua normalmente no dojô, mas certificado da federação exige vínculo federativo.
            </Text>
          )}
        </View>
      )}

      <View style={styles.block}>
        <TextInput
          style={styles.notesInput}
          value={value.notes}
          onChangeText={(v) => onChange({ notes: v })}
          placeholder="Observações do exame (opcional)"
          placeholderTextColor={P.ink4}
          editable={!disabled}
        />
      </View>

      {!!errors && errors.length > 0 && (
        <View style={styles.errBox}>
          {errors.map((e, i) => (
            <Text key={i} style={styles.errTxt}>
              {resultErrorLabel(e.code)} — {e.message}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ResultChip({ label, icon, active, tone, onPress, disabled }: {
  label: string; icon: string; active: boolean; tone: "ok" | "danger"; onPress: () => void; disabled?: boolean;
}) {
  const color = tone === "ok" ? C.ok : C.danger;
  const bg = tone === "ok" ? C.okSoft : C.dangerSoft;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      style={[styles.resultChip, active && { backgroundColor: bg, borderColor: color }]}
    >
      <Icon name={icon as any} size={13} color={active ? color : P.ink3} />
      <Text style={[styles.resultChipTxt, active && { color, fontWeight: "800" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.lg, padding: 14, gap: 12 } as ViewStyle,
  cardError: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,

  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 } as ViewStyle,
  name: { fontFamily: F.body, fontSize: 14.5, fontWeight: "800", color: P.ink } as TextStyle,
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,

  beltPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  beltDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: "rgba(43,38,32,0.15)" } as ViewStyle,
  beltPillTxt: { fontFamily: F.body, fontSize: 11, color: P.ink2, fontWeight: "600" } as TextStyle,

  fedPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1 } as ViewStyle,
  fedPillOn: { backgroundColor: C.okSoft, borderColor: C.okLine } as ViewStyle,
  fedPillOff: { backgroundColor: P.glass2, borderColor: P.line2 } as ViewStyle,
  fedPillTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  quesitosRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" } as ViewStyle,

  block: { gap: 8 } as ViewStyle,
  blockLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3, color: P.ink3, textTransform: "uppercase" } as TextStyle,

  resultRow: { flexDirection: "row", gap: 8 } as ViewStyle,
  resultChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 } as ViewStyle,
  resultChipTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.ink2 } as TextStyle,

  ladderWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  ladderChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  ladderChipActive: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  ladderChipTxt: { fontFamily: F.body, fontSize: 11.5, color: P.ink2, fontWeight: "600" } as TextStyle,
  ladderChipTxtActive: { color: P.red, fontWeight: "800" } as TextStyle,
  grauNote: { fontFamily: F.body, fontSize: 11, color: P.ink3, fontStyle: "italic" } as TextStyle,

  certRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" } as ViewStyle,
  certRowActive: {} as ViewStyle,
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: P.line2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  checkboxOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  certTxt: { fontFamily: F.body, fontSize: 12.5, color: P.ink, fontWeight: "600" } as TextStyle,
  certHint: { fontFamily: F.body, fontSize: 11, color: P.ink3, lineHeight: 15 } as TextStyle,

  notesInput: { fontFamily: F.body, fontSize: 12.5, color: P.ink, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8 } as TextStyle,

  errBox: { backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: R.sm, padding: 9, gap: 3 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 11.5, color: P.red2, lineHeight: 15 } as TextStyle,
});
