// ============================================================
// AURA. — ToothInspector (PR42 F3, 2026-05-09)
//
// Painel direito do mockup v4 — substitui o ToothPopover legado.
// Layout:
//   Header   : numero + nome anatomico + botao VOZ
//   FaceWheel: SVG 220x220 com 5 faces clicaveis (V,L,M,D,O)
//   Estado   : lista compacta (condition + planned + completed) com remove
//   CTAs     : 3 botoes progressivos (Achado / Planejar / Realizar)
//              expandem inline com steps Tipo -> Modificador -> Face -> Valor
//   Footer   : acoes secundarias (Exportar PDF, Foto, Historico)
//
// Paleta convencao mundial (eixo semantico):
//   condition           = laranja/coral (achado base)
//   treatment_planned   = vermelho      (a fazer)
//   treatment_completed = azul escuro   (realizado)
// ============================================================

import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Platform, StyleSheet } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { DentalColors } from "@/constants/dental-tokens";
import {
  type ChartAxis,
  type ChartEntry,
  type FindingType,
  type ProcedureType,
  type ToothFace,
  type ToothState,
  getToothName,
} from "./Odontograma2D";

// ─── Constantes ────────────────────────────────────────────

const AXIS_COLORS: Record<ChartAxis, { primary: string; bg: string; ring: string }> = {
  condition:           { primary: "#ea580c", bg: "rgba(234,88,12,0.10)",  ring: "rgba(234,88,12,0.35)" }, // laranja
  treatment_planned:   { primary: "#dc2626", bg: "rgba(220,38,38,0.10)",  ring: "rgba(220,38,38,0.35)" }, // vermelho
  treatment_completed: { primary: "#1e40af", bg: "rgba(30,64,175,0.12)",  ring: "rgba(30,64,175,0.40)" }, // azul
};

const AXIS_LABEL: Record<ChartAxis, string> = {
  condition: "Achado clínico",
  treatment_planned: "Planejar tratamento",
  treatment_completed: "Registrar realizado",
};

const AXIS_ICON: Record<ChartAxis, string> = {
  condition: "🦷",
  treatment_planned: "🔴",
  treatment_completed: "🔵",
};

const AXIS_CONFIRM_LABEL: Record<ChartAxis, string> = {
  condition: "✓ Adicionar achado",
  treatment_planned: "🔴 Planejar tratamento",
  treatment_completed: "🔵 Marcar realizado",
};

const FINDING_OPTIONS: { value: FindingType; label: string; whole?: boolean }[] = [
  { value: "carie",               label: "Cárie" },
  { value: "restauracao_antiga",  label: "Restauração antiga" },
  { value: "coroa_antiga",        label: "Coroa antiga", whole: true },
  { value: "faceta_antiga",       label: "Faceta antiga" },
  { value: "endodontia_tratada",  label: "Endodontia tratada", whole: true },
  { value: "implante",            label: "Implante", whole: true },
  { value: "fratura",             label: "Fratura" },
  { value: "mancha_branca",       label: "Mancha branca" },
  { value: "mobilidade",          label: "Mobilidade", whole: true },
  { value: "atrito",              label: "Atrito" },
  { value: "abfracao",            label: "Abfração" },
  { value: "erosao",              label: "Erosão" },
  { value: "ausente",             label: "Ausente", whole: true },
  { value: "nao_erupcionado",     label: "Não erupcionado", whole: true },
];

const PROCEDURE_OPTIONS: { value: ProcedureType; label: string; whole?: boolean }[] = [
  { value: "restauracao",  label: "Restauração" },
  { value: "endodontia",   label: "Endodontia",   whole: true },
  { value: "coroa",        label: "Coroa",        whole: true },
  { value: "faceta",       label: "Faceta" },
  { value: "implante",     label: "Implante",     whole: true },
  { value: "extracao",     label: "Extração",     whole: true },
  { value: "profilaxia",   label: "Profilaxia",   whole: true },
  { value: "selante",      label: "Selante" },
  { value: "clareamento",  label: "Clareamento",  whole: true },
];

const BLACK_CLASSES = ["I", "II", "III", "IV", "V", "VI"];

const MATERIAIS = [
  { value: "resina_composta", label: "Resina" },
  { value: "amalgama",        label: "Amálgama" },
  { value: "ceramica",        label: "Cerâmica" },
  { value: "ouro",            label: "Ouro" },
  { value: "ionomero",        label: "Ionômero" },
];

const FACES: { value: ToothFace; label: string; full: string }[] = [
  { value: "V", label: "V", full: "Vestibular" },
  { value: "L", label: "L", full: "Lingual" },
  { value: "M", label: "M", full: "Mesial" },
  { value: "D", label: "D", full: "Distal" },
  { value: "O", label: "O", full: "Oclusal" },
];

// ─── Helpers ────────────────────────────────────────────

function findingLabel(v?: FindingType | null): string {
  if (!v) return "—";
  return FINDING_OPTIONS.find((f) => f.value === v)?.label || v;
}

function procedureLabel(v?: ProcedureType | null): string {
  if (!v) return "—";
  return PROCEDURE_OPTIONS.find((p) => p.value === v)?.label || v;
}

function materialLabel(v?: string | null): string {
  if (!v) return "";
  return MATERIAIS.find((m) => m.value === v)?.label || v;
}

function faceLabel(v?: ToothFace | null): string {
  if (!v) return "";
  return FACES.find((f) => f.value === v)?.full || v;
}

function fmtBRL(v?: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function entryDescription(e: ChartEntry): string {
  if (e.axis === "condition") {
    const base = findingLabel(e.finding_type);
    const cls = e.black_class ? ` classe ${e.black_class}` : "";
    return `${base}${cls}`;
  }
  const base = procedureLabel(e.procedure_type);
  const mat = e.material ? ` ${materialLabel(e.material)}` : "";
  return `${base}${mat}`;
}

// ─── Sub-componente: Face wheel SVG ────────────────────────

function FaceWheel({
  selectedFace,
  onFaceSelect,
  axis,
}: {
  selectedFace: ToothFace | null;
  onFaceSelect: (f: ToothFace) => void;
  axis: ChartAxis;
}) {
  const colors = AXIS_COLORS[axis];
  const SIZE = 220;
  const C = SIZE / 2;
  const OUTER_R = 96;
  const INNER_R = 38;
  // 4 quadrantes externos (V/L/M/D) + centro (O)
  // Top = V, Bottom = L, Left = M, Right = D
  const quadrants: { face: ToothFace; pathD: string; cx: number; cy: number }[] = [
    {
      face: "V",
      pathD: `M ${C} ${C} L ${C - OUTER_R * 0.7} ${C - OUTER_R * 0.7} A ${OUTER_R} ${OUTER_R} 0 0 1 ${C + OUTER_R * 0.7} ${C - OUTER_R * 0.7} Z`,
      cx: C,
      cy: C - OUTER_R * 0.62,
    },
    {
      face: "L",
      pathD: `M ${C} ${C} L ${C + OUTER_R * 0.7} ${C + OUTER_R * 0.7} A ${OUTER_R} ${OUTER_R} 0 0 1 ${C - OUTER_R * 0.7} ${C + OUTER_R * 0.7} Z`,
      cx: C,
      cy: C + OUTER_R * 0.62,
    },
    {
      face: "M",
      pathD: `M ${C} ${C} L ${C - OUTER_R * 0.7} ${C + OUTER_R * 0.7} A ${OUTER_R} ${OUTER_R} 0 0 1 ${C - OUTER_R * 0.7} ${C - OUTER_R * 0.7} Z`,
      cx: C - OUTER_R * 0.62,
      cy: C,
    },
    {
      face: "D",
      pathD: `M ${C} ${C} L ${C + OUTER_R * 0.7} ${C - OUTER_R * 0.7} A ${OUTER_R} ${OUTER_R} 0 0 1 ${C + OUTER_R * 0.7} ${C + OUTER_R * 0.7} Z`,
      cx: C + OUTER_R * 0.62,
      cy: C,
    },
  ];
  return (
    <View style={[s.wheelWrap, { width: SIZE, height: SIZE }]}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* anel externo */}
        <Circle cx={C} cy={C} r={OUTER_R + 4} fill="rgba(255,255,255,0.02)" stroke={DentalColors.border} strokeWidth={1} />
        {quadrants.map((q) => {
          const active = selectedFace === q.face;
          return (
            <Path
              key={q.face}
              d={q.pathD}
              fill={active ? colors.bg : "rgba(255,255,255,0.03)"}
              stroke={active ? colors.primary : DentalColors.border}
              strokeWidth={active ? 2 : 1}
            />
          );
        })}
        {/* circulo central O */}
        <Circle
          cx={C}
          cy={C}
          r={INNER_R}
          fill={selectedFace === "O" ? colors.bg : "rgba(255,255,255,0.04)"}
          stroke={selectedFace === "O" ? colors.primary : DentalColors.border}
          strokeWidth={selectedFace === "O" ? 2 : 1}
        />
        {/* labels */}
        {quadrants.map((q) => (
          <SvgText
            key={`l-${q.face}`}
            x={q.cx}
            y={q.cy + 4}
            fontSize={13}
            fontWeight="700"
            fill={selectedFace === q.face ? colors.primary : DentalColors.ink2}
            textAnchor="middle"
          >
            {q.face}
          </SvgText>
        ))}
        <SvgText
          x={C}
          y={C + 5}
          fontSize={15}
          fontWeight="700"
          fill={selectedFace === "O" ? colors.primary : DentalColors.ink}
          textAnchor="middle"
        >
          O
        </SvgText>
      </Svg>
      {/* hit areas (Pressables overlaid) */}
      {[
        { face: "V" as ToothFace, top: 8,         left: SIZE / 2 - 36, w: 72, h: 56 },
        { face: "L" as ToothFace, top: SIZE - 64, left: SIZE / 2 - 36, w: 72, h: 56 },
        { face: "M" as ToothFace, top: SIZE / 2 - 28, left: 8, w: 56, h: 56 },
        { face: "D" as ToothFace, top: SIZE / 2 - 28, left: SIZE - 64, w: 56, h: 56 },
        { face: "O" as ToothFace, top: SIZE / 2 - INNER_R, left: SIZE / 2 - INNER_R, w: INNER_R * 2, h: INNER_R * 2 },
      ].map((hit) => (
        <Pressable
          key={`hit-${hit.face}`}
          onPress={() => onFaceSelect(hit.face)}
          style={[s.faceHit, { top: hit.top, left: hit.left, width: hit.w, height: hit.h }]}
          {...(Platform.OS === "web" ? { title: FACES.find((f) => f.value === hit.face)?.full } : {})}
        />
      ))}
    </View>
  );
}

// ─── Sub-componente: lista do estado atual ────────────────

function StateList({
  entries,
  onRemove,
}: {
  entries: ChartEntry[];
  onRemove: (id: string) => void;
}) {
  if (!entries.length) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyTxt}>Nenhuma marcação registrada neste dente</Text>
      </View>
    );
  }
  return (
    <View style={s.stateList}>
      {entries.map((e) => {
        const colors = AXIS_COLORS[e.axis];
        return (
          <View key={e.id || `${e.axis}-${e.recorded_at}`} style={[s.stateRow, { borderLeftColor: colors.primary }]}>
            <View style={[s.stateDot, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.stateTitle}>
                {entryDescription(e)}
                {e.axis === "treatment_planned" && e.estimated_value
                  ? ` · ${fmtBRL(e.estimated_value)}`
                  : ""}
              </Text>
              <Text style={s.stateMeta}>
                {[
                  e.face ? faceLabel(e.face).toLowerCase() : null,
                  e.axis === "treatment_planned" ? "planejado" : null,
                  e.axis === "treatment_completed" ? "realizado" : null,
                  fmtDate(e.recorded_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            {e.id ? (
              <Pressable
                onPress={() => onRemove(e.id!)}
                style={s.removeBtn}
                {...(Platform.OS === "web" ? { title: "Remover marcação" } : {})}
              >
                <Text style={s.removeIcon}>×</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ─── Sub-componente: CTA expandivel (3 eixos) ─────────────

type DraftEntry = {
  axis: ChartAxis;
  type: FindingType | ProcedureType | null;
  face: ToothFace | null;
  blackClass: string | null;
  material: string | null;
  estimatedValue: string;
};

const EMPTY_DRAFT: DraftEntry = {
  axis: "condition",
  type: null,
  face: null,
  blackClass: null,
  material: null,
  estimatedValue: "",
};

function CtaSection({
  axis,
  expanded,
  onToggle,
  onSubmit,
  isAdding,
}: {
  axis: ChartAxis;
  expanded: boolean;
  onToggle: () => void;
  onSubmit: (draft: DraftEntry) => Promise<void>;
  isAdding: boolean;
}) {
  const colors = AXIS_COLORS[axis];
  const [draft, setDraft] = useState<DraftEntry>({ ...EMPTY_DRAFT, axis });
  const isCondition = axis === "condition";
  const options = isCondition
    ? FINDING_OPTIONS
    : PROCEDURE_OPTIONS;
  const selectedOpt = options.find((o) => o.value === draft.type);
  const isWholeTooth = !!selectedOpt?.whole;
  const showBlackClass = isCondition && draft.type === "carie";
  const showMaterial =
    !isCondition && (draft.type === "restauracao" || draft.type === "faceta" || draft.type === "coroa");
  const showFace = !isWholeTooth;
  const showValor = axis === "treatment_planned";

  const canSubmit =
    !!draft.type &&
    (!showFace || !!draft.face) &&
    (!showBlackClass || !!draft.blackClass) &&
    !isAdding;

  function reset() {
    setDraft({ ...EMPTY_DRAFT, axis });
  }

  async function handleConfirm() {
    if (!canSubmit) return;
    await onSubmit(draft);
    reset();
  }

  return (
    <View
      style={[
        s.cta,
        expanded && { borderColor: colors.primary, backgroundColor: colors.bg },
      ]}
    >
      {/* header pressionavel */}
      <Pressable onPress={onToggle} style={s.ctaHeader}>
        <Text style={[s.ctaIcon, { fontSize: 14 }]}>{AXIS_ICON[axis]}</Text>
        <Text style={[s.ctaLabel, expanded && { color: colors.primary, fontWeight: "700" }]}>
          {AXIS_LABEL[axis]}
        </Text>
        <Text style={[s.ctaCaret, expanded && { color: colors.primary }]}>{expanded ? "▴" : "▾"}</Text>
      </Pressable>

      {expanded && (
        <View style={s.ctaBody}>
          {/* Step 1: Tipo */}
          <Text style={s.stepLbl}>Tipo</Text>
          <View style={s.optionsGrid}>
            {options.map((opt) => {
              const active = draft.type === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      type: opt.value as any,
                      // se mudou pra status whole-tooth, limpa face
                      face: opt.whole ? null : draft.face,
                    })
                  }
                  style={[
                    s.optionPill,
                    active && {
                      backgroundColor: colors.bg,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text style={[s.optionTxt, active && { color: colors.primary, fontWeight: "700" }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Step 2: Black class (cárie) */}
          {showBlackClass && (
            <>
              <Text style={s.stepLbl}>Classificação Black</Text>
              <View style={s.optionsGrid}>
                {BLACK_CLASSES.map((cls) => {
                  const active = draft.blackClass === cls;
                  return (
                    <Pressable
                      key={cls}
                      onPress={() => setDraft({ ...draft, blackClass: cls })}
                      style={[
                        s.optionPill,
                        s.optionPillSm,
                        active && { backgroundColor: colors.bg, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[s.optionTxt, active && { color: colors.primary, fontWeight: "700" }]}>
                        {cls}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setDraft({ ...draft, blackClass: "sem_class" })}
                  style={[
                    s.optionPill,
                    s.optionPillSm,
                    draft.blackClass === "sem_class" && { backgroundColor: colors.bg, borderColor: colors.primary },
                  ]}
                >
                  <Text style={s.optionTxt}>Sem class.</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Step 2.b: Material (restauração / faceta / coroa) */}
          {showMaterial && (
            <>
              <Text style={s.stepLbl}>Material</Text>
              <View style={s.optionsGrid}>
                {MATERIAIS.map((m) => {
                  const active = draft.material === m.value;
                  return (
                    <Pressable
                      key={m.value}
                      onPress={() => setDraft({ ...draft, material: m.value })}
                      style={[
                        s.optionPill,
                        active && { backgroundColor: colors.bg, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[s.optionTxt, active && { color: colors.primary, fontWeight: "700" }]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Step 3: Face (a menos que whole-tooth) */}
          {showFace && (
            <>
              <Text style={s.stepLbl}>Face</Text>
              <View style={s.optionsGrid}>
                {FACES.map((f) => {
                  const active = draft.face === f.value;
                  return (
                    <Pressable
                      key={f.value}
                      onPress={() => setDraft({ ...draft, face: f.value })}
                      style={[
                        s.optionPill,
                        s.optionPillSm,
                        active && { backgroundColor: colors.bg, borderColor: colors.primary },
                      ]}
                      {...(Platform.OS === "web" ? { title: f.full } : {})}
                    >
                      <Text style={[s.optionTxt, active && { color: colors.primary, fontWeight: "700" }]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Step 4: Valor (apenas planejar) */}
          {showValor && (
            <>
              <Text style={s.stepLbl}>Valor estimado (opcional)</Text>
              <TextInput
                value={draft.estimatedValue}
                onChangeText={(t) => setDraft({ ...draft, estimatedValue: t.replace(/[^0-9,.]/g, "") })}
                placeholder="0,00"
                placeholderTextColor={DentalColors.ink3}
                keyboardType="decimal-pad"
                style={s.valorInput}
              />
            </>
          )}

          {/* Confirmar */}
          <Pressable
            onPress={handleConfirm}
            disabled={!canSubmit}
            style={[
              s.confirmBtn,
              { backgroundColor: canSubmit ? colors.primary : "rgba(148,163,184,0.25)" },
            ]}
          >
            <Text style={[s.confirmTxt, { color: canSubmit ? "#fff" : DentalColors.ink3 }]}>
              {isAdding ? "Salvando..." : AXIS_CONFIRM_LABEL[axis]}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────

type Props = {
  toothNumber: number;
  state: ToothState;
  onAdd: (entry: Omit<ChartEntry, "id" | "recorded_at">) => Promise<void>;
  onRemove: (entryId: string) => Promise<void>;
  onExportPdf?: () => void;
  onCapturePhoto?: () => void;
  onShowHistory?: () => void;
  onVoice?: () => void;
  isAdding?: boolean;
};

export function ToothInspector({
  toothNumber,
  state,
  onAdd,
  onRemove,
  onExportPdf,
  onCapturePhoto,
  onShowHistory,
  onVoice,
  isAdding,
}: Props) {
  const [openAxis, setOpenAxis] = useState<ChartAxis | null>(null);
  const [selectedFace, setSelectedFace] = useState<ToothFace | null>(null);

  const allEntries: ChartEntry[] = useMemo(() => {
    return [...state.condition, ...state.planned, ...state.completed].sort((a, b) => {
      const ta = a.recorded_at ? new Date(a.recorded_at).getTime() : 0;
      const tb = b.recorded_at ? new Date(b.recorded_at).getTime() : 0;
      return tb - ta;
    });
  }, [state]);

  function toggleAxis(a: ChartAxis) {
    setOpenAxis((cur) => (cur === a ? null : a));
  }

  // pre-fill da face selecionada via wheel pra dentro do CTA aberto
  async function handleCtaSubmit(draft: DraftEntry) {
    const entry: Omit<ChartEntry, "id" | "recorded_at"> = {
      axis: draft.axis,
      tooth_number: toothNumber,
      face: draft.face ?? selectedFace ?? null,
      finding_type: draft.axis === "condition" ? (draft.type as FindingType) : null,
      procedure_type: draft.axis === "condition" ? null : (draft.type as ProcedureType),
      material: draft.material ?? null,
      black_class: draft.blackClass ?? null,
      estimated_value:
        draft.axis === "treatment_planned" && draft.estimatedValue
          ? parseFloat(draft.estimatedValue.replace(",", "."))
          : null,
    };
    await onAdd(entry);
    setOpenAxis(null);
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text style={s.toothNumber}>{toothNumber}</Text>
            <Text style={s.toothName}>{getToothName(toothNumber)}</Text>
          </View>
        </View>
        {onVoice && (
          <Pressable onPress={onVoice} style={s.voiceBtn} {...(Platform.OS === "web" ? { title: "Ditar marcação por voz" } : {})}>
            <Text style={s.voiceTxt}>🎤 VOZ</Text>
          </Pressable>
        )}
      </View>

      {/* Face wheel */}
      <View style={s.wheelSection}>
        <FaceWheel
          axis={openAxis ?? "condition"}
          selectedFace={selectedFace}
          onFaceSelect={(f) => setSelectedFace((cur) => (cur === f ? null : f))}
        />
      </View>

      {/* Estado atual */}
      <Text style={s.sectionLbl}>Estado atual</Text>
      <StateList entries={allEntries} onRemove={onRemove} />

      {/* CTAs */}
      <Text style={s.sectionLbl}>Adicionar marcação</Text>
      <View style={s.ctasWrap}>
        {(["condition", "treatment_planned", "treatment_completed"] as ChartAxis[]).map((axis) => (
          <CtaSection
            key={axis}
            axis={axis}
            expanded={openAxis === axis}
            onToggle={() => toggleAxis(axis)}
            onSubmit={handleCtaSubmit}
            isAdding={!!isAdding}
          />
        ))}
      </View>

      {/* Footer actions */}
      <View style={s.footer}>
        {onExportPdf && (
          <Pressable onPress={onExportPdf} style={s.footerBtn}>
            <Text style={s.footerTxt}>📄 Exportar PDF</Text>
          </Pressable>
        )}
        {onCapturePhoto && (
          <Pressable onPress={onCapturePhoto} style={s.footerBtn}>
            <Text style={s.footerTxt}>📷 Foto</Text>
          </Pressable>
        )}
        {onShowHistory && (
          <Pressable onPress={onShowHistory} style={s.footerBtn}>
            <Text style={s.footerTxt}>📋 Histórico</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

export default ToothInspector;

// ─── Estilos ────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: DentalColors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DentalColors.border,
    gap: 12,
  },
  toothNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: DentalColors.cyan,
    letterSpacing: -0.5,
  },
  toothName: {
    fontSize: 12,
    color: DentalColors.ink2,
    fontWeight: "500",
    flexShrink: 1,
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.30)",
  },
  voiceTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a78bfa",
    letterSpacing: 0.4,
  },
  wheelSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  wheelWrap: {
    position: "relative",
  },
  faceHit: {
    position: "absolute",
  },
  sectionLbl: {
    fontSize: 10,
    color: DentalColors.ink3,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 8,
  },
  emptyState: {
    paddingVertical: 14,
    alignItems: "center",
  },
  emptyTxt: {
    fontSize: 12,
    color: DentalColors.ink3,
    fontStyle: "italic",
  },
  stateList: {
    gap: 6,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: DentalColors.border,
    borderLeftWidth: 3,
    gap: 10,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateTitle: {
    fontSize: 12,
    color: DentalColors.ink,
    fontWeight: "600",
  },
  stateMeta: {
    fontSize: 10,
    color: DentalColors.ink3,
    fontWeight: "500",
  },
  removeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  removeIcon: {
    fontSize: 14,
    color: DentalColors.ink3,
    fontWeight: "700",
    lineHeight: 16,
  },
  ctasWrap: {
    gap: 8,
  },
  cta: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DentalColors.border,
    backgroundColor: "rgba(255,255,255,0.025)",
    overflow: "hidden",
  },
  ctaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  ctaIcon: {
    width: 18,
    textAlign: "center",
  },
  ctaLabel: {
    flex: 1,
    fontSize: 13,
    color: DentalColors.ink2,
    fontWeight: "600",
  },
  ctaCaret: {
    fontSize: 12,
    color: DentalColors.ink3,
    fontWeight: "700",
  },
  ctaBody: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: DentalColors.border,
    gap: 6,
  },
  stepLbl: {
    fontSize: 10,
    color: DentalColors.ink3,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 4,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  optionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: DentalColors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  optionPillSm: {
    minWidth: 38,
    alignItems: "center",
  },
  optionTxt: {
    fontSize: 11,
    color: DentalColors.ink2,
    fontWeight: "500",
  },
  valorInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: DentalColors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: DentalColors.ink,
  } as any,
  confirmBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTxt: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DentalColors.border,
  },
  footerBtn: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DentalColors.border,
    backgroundColor: "rgba(255,255,255,0.025)",
    alignItems: "center",
  },
  footerTxt: {
    fontSize: 11,
    color: DentalColors.ink2,
    fontWeight: "600",
  },
});
