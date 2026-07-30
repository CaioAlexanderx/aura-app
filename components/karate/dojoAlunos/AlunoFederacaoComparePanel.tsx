// ============================================================
// AlunoFederacaoComparePanel — conferência ANTES de gravar (F5b)
//
// Renderiza o resultado de karateDojoStudentsApi.previewFederateByNumber
// (Aura-backend#447 + migration 262) e deixa o sensei escolher, campo a
// campo, quem vale (dojô × federação) ANTES de confirmar. Substitui o
// antigo painel "Confirme o vínculo" (pós-fato — o backend já tinha
// gravado; achado em prod: aluna de 12 anos vinculada a praticante
// nascido em 2020, CPF diferente, sem aviso nenhum).
//
// Sub-componente inline (nunca modal aninhado — mesmo racional do
// GuardianPicker/AlunoAssinaturaSection), renderizado por
// AlunoFederacaoSection.tsx dentro do painel "Já tem número FPKT".
//
// Layout campo a campo: cada opção (dojô/federação) é um cartão que
// cresce/encolhe num container com flexWrap (mesmo idioma de
// dojoTurmas/TurmasList.tsx) — em vez de um breakpoint fixo de janela.
// A ficha do aluno roda dentro de um modal com largura máxima (~560),
// então o que importa é a LARGURA DO CONTAINER, não a da janela; os
// cartões empilham sozinhos quando não cabem duas colunas, tanto no
// celular quanto numa janela desktop estreita.
//
// Campos que NÃO divergem (iguais ou vazios dos dois lados — regra da
// casa "dado faltante não é divergência") ficam recolhidos por padrão
// (Collapsible) pra não poluir a tela; só o que diverge fica em
// evidência. Se nada diverge, a tela avisa e libera a confirmação direta.
//
// can_link:false esconde o botão de confirmar — os `blockers` aparecem
// com a mensagem do servidor, sem inventar um caminho de "confirmar
// assim mesmo" (ex.: CPF_CONFLITANTE não tem override).
// ============================================================
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Collapsible } from "@/components/anim/Collapsible";
import {
  FederatePreviewResult,
  FederationCompareSide,
  FederationComparisonField,
  FederationResolution,
} from "@/services/karateDojoStudentsApi";

interface Props {
  preview: FederatePreviewResult;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (resolution: FederationResolution) => void;
}

function displayValue(v: string | null | undefined): string {
  const t = (v ?? "").toString().trim();
  return t || "—";
}

function ValueOption({
  title,
  value,
  checked,
  onPress,
}: {
  title: string;
  value: string | null;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.option, checked && styles.optionOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
    >
      <View style={[styles.radio, checked && styles.radioOn]}>
        {checked && <View style={styles.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionValue} numberOfLines={3}>{displayValue(value)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FieldCard({
  field,
  selected,
  onSelect,
}: {
  field: FederationComparisonField;
  selected: FederationCompareSide;
  onSelect: (side: FederationCompareSide) => void;
}) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <View style={styles.fieldOptions}>
        <ValueOption title="No dojô" value={field.dojo_value} checked={selected === "dojo"} onPress={() => onSelect("dojo")} />
        <ValueOption title="Na federação" value={field.federation_value} checked={selected === "federation"} onPress={() => onSelect("federation")} />
      </View>
    </View>
  );
}

export function AlunoFederacaoComparePanel({ preview, busy, error, onCancel, onConfirm }: Props) {
  const comparison = preview.comparison ?? [];
  const diverging = useMemo(() => comparison.filter((f) => f.diverges), [comparison]);
  const rest = useMemo(() => comparison.filter((f) => !f.diverges), [comparison]);

  const [selection, setSelection] = useState<FederationResolution>(() => {
    const init: FederationResolution = {};
    for (const f of diverging) init[f.field] = f.suggested ?? "dojo";
    return init;
  });
  const [restOpen, setRestOpen] = useState(false);

  const blockers = preview.blockers ?? [];
  const hasCpfBlocker = blockers.some((b) => b.code === "CPF_CONFLITANTE");

  const setField = (field: string, side: FederationCompareSide) =>
    setSelection((p) => ({ ...p, [field]: side }));

  const handleConfirm = () => onConfirm(selection);

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Icon name="user" size={15} color={KarateColors.primary} />
        <Text style={styles.headerTitle} numberOfLines={1}>{preview.practitioner.name}</Text>
      </View>
      <Text style={styles.headerMeta}>
        FPKT {preview.practitioner.fpkt_number}
        {preview.practitioner.dojo_name ? ` · atualmente em ${preview.practitioner.dojo_name}` : ""}
      </Text>

      {preview.is_transfer && (
        <View style={styles.transferBox}>
          <Icon name="alert" size={13} color={KarateColors.warn} />
          <Text style={styles.transferTxt}>
            Este praticante já é federado em {preview.practitioner.dojo_name || "outro dojô"}. Vincular aqui transfere o praticante para o seu dojô.
          </Text>
        </View>
      )}

      {blockers.length > 0 && (
        <View style={styles.blockersBox}>
          {blockers.map((b, i) => (
            <View key={`${b.code}-${i}`} style={styles.blockerRow}>
              <Icon name="alert_circle" size={13} color={KarateColors.danger} />
              <Text style={styles.blockerTxt}>{b.message}</Text>
            </View>
          ))}
          {hasCpfBlocker && (
            <Text style={styles.blockerHint}>
              Não é possível sobrescrever o CPF — corrija o cadastro do aluno ou do praticante, ou use outro número FPKT.
            </Text>
          )}
        </View>
      )}

      {diverging.length === 0 ? (
        <Text style={styles.hint}>
          Nada diverge entre o cadastro do dojô e o da federação — pode confirmar direto.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>
            {diverging.length === 1 ? "1 campo diferente — escolha o que vale" : `${diverging.length} campos diferentes — escolha o que vale em cada um`}
          </Text>
          {diverging.map((f) => (
            <FieldCard
              key={f.field}
              field={f}
              selected={selection[f.field] ?? "dojo"}
              onSelect={(side) => setField(f.field, side)}
            />
          ))}
        </View>
      )}

      {rest.length > 0 && (
        <View style={{ gap: 4 }}>
          <TouchableOpacity
            style={styles.restToggle}
            onPress={() => setRestOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: restOpen }}
          >
            <Icon name={restOpen ? "chevron_up" : "chevron_down"} size={14} color={KarateColors.ink3} />
            <Text style={styles.restToggleTxt}>
              {restOpen ? "Ocultar" : "Ver"} campos iguais ou sem informação ({rest.length})
            </Text>
          </TouchableOpacity>
          <Collapsible open={restOpen}>
            <View style={styles.restBox}>
              {rest.map((f) => (
                <View key={f.field} style={styles.restRow}>
                  <Text style={styles.restLabel}>{f.label}</Text>
                  <Text style={styles.restValue}>{displayValue(f.dojo_value ?? f.federation_value)}</Text>
                </View>
              ))}
            </View>
          </Collapsible>
        </View>
      )}

      <Text style={styles.consentTxt}>
        {preview.can_link
          ? `Depois de confirmar, o cadastro de ${preview.practitioner.name} na federação passa a ser mantido por este dojô.`
          : "A confirmação está indisponível enquanto o bloqueio acima não for resolvido."}
      </Text>

      {!!error && <Text style={styles.err}>{error}</Text>}

      <View style={styles.actions}>
        <KarateButton label="Voltar" variant="ghost" size="sm" onPress={onCancel} disabled={busy} style={{ flex: 1 }} />
        {preview.can_link && (
          <KarateButton label="Confirmar vínculo" variant="sumi" size="sm" onPress={handleConfirm} loading={busy} style={{ flex: 1 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10, marginTop: 2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.glass2, padding: 12 } as ViewStyle,
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  headerTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  headerMeta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  transferBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: KarateColors.warn, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.warnSoft, padding: 10 } as ViewStyle,
  transferTxt: { flex: 1, fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,
  blockersBox: { gap: 6, borderWidth: 1, borderColor: KarateColors.danger, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.dangerSoft, padding: 10 } as ViewStyle,
  blockerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 } as ViewStyle,
  blockerTxt: { flex: 1, fontSize: 12.5, fontWeight: "600", color: KarateColors.danger, lineHeight: 17 } as TextStyle,
  blockerHint: { fontSize: 11.5, color: KarateColors.ink2, lineHeight: 16 } as TextStyle,
  hint: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  sectionLabel: { fontSize: 11, fontWeight: "800", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.3 } as TextStyle,
  fieldCard: { gap: 6, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: "#fff", padding: 10 } as ViewStyle,
  fieldLabel: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  fieldOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  option: { flexDirection: "row", alignItems: "flex-start", gap: 8, flexGrow: 1, flexBasis: 140, minWidth: 140, borderWidth: 1.5, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 9, backgroundColor: KarateColors.surface } as ViewStyle,
  optionOn: { borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  radio: { width: 16, height: 16, marginTop: 1, borderRadius: 999, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  radioOn: { borderColor: KarateColors.primary } as ViewStyle,
  radioDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: KarateColors.primary } as ViewStyle,
  optionTitle: { fontSize: 10.5, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.2 } as TextStyle,
  optionValue: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink, marginTop: 1 } as TextStyle,
  restToggle: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 } as ViewStyle,
  restToggleTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  restBox: { gap: 5, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: "#fff", padding: 10, marginTop: 2 } as ViewStyle,
  restRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 } as ViewStyle,
  restLabel: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
  restValue: { fontSize: 11.5, fontWeight: "600", color: KarateColors.ink2, flexShrink: 1, textAlign: "right" } as TextStyle,
  consentTxt: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16, fontStyle: "italic" } as TextStyle,
  err: { fontSize: 12, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  actions: { flexDirection: "row", gap: 8, marginTop: 2 } as ViewStyle,
});

export default AlunoFederacaoComparePanel;
