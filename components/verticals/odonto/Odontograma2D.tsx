// ============================================================
// AURA. — Odontograma 2D (PR42, 2026-04-28)
//
// Reescrita do odontograma usando react-native-svg + anatomia premium
// (incisivo cinzel, canino pentagonal, pre-molar bicuspide, molar 4 cuspides).
// SEM "bolinhas" sobrepostas — cuspides sugeridas via gradient + sulcos sutis.
//
// Arquitetura 3 axes:
//   - condition: estado atual do dente (achados clinicos)
//   - planned: tratamentos planejados (borda vermelha tracejada pulsante)
//   - completed: procedimentos realizados nesta consulta (borda azul solida)
//
// Notacao FDI completa (32 dentes permanentes).
// ============================================================

import React, { useMemo } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import Svg, {
  Path,
  Rect,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// Types
// ============================================================
export type ToothFace = "M" | "D" | "O" | "V" | "L";

export type FindingType =
  | "higido"
  | "carie"
  | "restauracao_antiga"
  | "coroa_antiga"
  | "faceta_antiga"
  | "endodontia_tratada"
  | "implante"
  | "fratura"
  | "mancha_branca"
  | "mobilidade"
  | "atrito"
  | "abfracao"
  | "erosao"
  | "ausente"
  | "nao_erupcionado";

export type ProcedureType =
  | "restauracao"
  | "endodontia"
  | "coroa"
  | "faceta"
  | "implante"
  | "extracao"
  | "profilaxia"
  | "selante"
  | "clareamento";

export type ChartAxis = "condition" | "treatment_planned" | "treatment_completed";

export type ChartEntry = {
  id?: string;
  axis: ChartAxis;
  tooth_number: number;
  face?: ToothFace | null;
  finding_type?: FindingType | null;
  procedure_type?: ProcedureType | null;
  material?: string | null;
  black_class?: string | null;
  estimated_value?: number | null;
  notes?: string | null;
  recorded_at?: string;
  completed_at?: string | null;
  performed_by_name?: string | null;
  procedure_name?: string | null;
};

export type ToothState = {
  tooth: number;
  condition: ChartEntry[];
  planned: ChartEntry[];
  completed: ChartEntry[];
};

type Props = {
  chart: ToothState[];
  selectedTooth?: number | null;
  onToothSelect?: (tooth: number) => void;
  editable?: boolean;
};

// ============================================================
// FDI ordering (clinical order: upper-right then upper-left, lower-right then lower-left)
// ============================================================
export const FDI_SUPERIOR: number[] = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
];
export const FDI_INFERIOR: number[] = [
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

export function getToothType(
  num: number
): "incisivo" | "canino" | "premolar" | "molar" {
  const last = num % 10;
  if (last <= 2) return "incisivo";
  if (last === 3) return "canino";
  if (last <= 5) return "premolar";
  return "molar";
}

export function getToothName(num: number): string {
  const type = getToothType(num);
  const arch = num < 30 ? "superior" : "inferior";
  const side = [11, 12, 13, 14, 15, 16, 17, 18, 41, 42, 43, 44, 45, 46, 47, 48].includes(num)
    ? "direito"
    : "esquerdo";
  const labels: Record<string, string> = {
    incisivo: num % 10 === 1 ? "incisivo central" : "incisivo lateral",
    canino: "canino",
    premolar: num % 10 === 4 ? "primeiro pré-molar" : "segundo pré-molar",
    molar:
      num % 10 === 6
        ? "primeiro molar"
        : num % 10 === 7
        ? "segundo molar"
        : "terceiro molar (siso)",
  };
  return `${labels[type]} ${arch} ${side}`;
}

// ============================================================
// Color palette (alinhada à convenção mundial)
// ============================================================
const findingFillId: Record<FindingType, string> = {
  higido: "gradHigido",
  carie: "gradCarie",
  restauracao_antiga: "gradRestAnt",
  coroa_antiga: "gradCoroaAnt",
  faceta_antiga: "gradRestAnt",
  endodontia_tratada: "gradEndo",
  implante: "gradImplante",
  fratura: "gradFratura",
  mancha_branca: "gradHigido",
  mobilidade: "gradHigido",
  atrito: "gradErosao",
  abfracao: "gradErosao",
  erosao: "gradErosao",
  ausente: "gradHigido",
  nao_erupcionado: "gradHigido",
};

const findingStroke: Record<FindingType, string> = {
  higido: "#94a3b8",
  carie: "#c2410c",
  restauracao_antiga: "#0284c7",
  coroa_antiga: "#b45309",
  faceta_antiga: "#0284c7",
  endodontia_tratada: "#6b21a8",
  implante: "#0f766e",
  fratura: "#a16207",
  mancha_branca: "#94a3b8",
  mobilidade: "#94a3b8",
  atrito: "#1e293b",
  abfracao: "#1e293b",
  erosao: "#1e293b",
  ausente: "#475569",
  nao_erupcionado: "#475569",
};

// ============================================================
// SVG Defs (gradientes compartilhados)
// ============================================================
function SvgDefs() {
  return (
    <Defs>
      <LinearGradient id="gradHigido" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#ffffff" />
        <Stop offset="60%" stopColor="#f1f5f9" />
        <Stop offset="100%" stopColor="#cbd5e1" />
      </LinearGradient>
      <LinearGradient id="gradCarie" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#fed7aa" />
        <Stop offset="60%" stopColor="#fb923c" />
        <Stop offset="100%" stopColor="#c2410c" />
      </LinearGradient>
      <LinearGradient id="gradRestAnt" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#e0f2fe" />
        <Stop offset="60%" stopColor="#7dd3fc" />
        <Stop offset="100%" stopColor="#0284c7" />
      </LinearGradient>
      <LinearGradient id="gradCoroaAnt" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#fde68a" />
        <Stop offset="60%" stopColor="#fbbf24" />
        <Stop offset="100%" stopColor="#b45309" />
      </LinearGradient>
      <LinearGradient id="gradEndo" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#e9d5ff" />
        <Stop offset="60%" stopColor="#a855f7" />
        <Stop offset="100%" stopColor="#6b21a8" />
      </LinearGradient>
      <LinearGradient id="gradImplante" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#99f6e4" />
        <Stop offset="60%" stopColor="#2dd4bf" />
        <Stop offset="100%" stopColor="#0f766e" />
      </LinearGradient>
      <LinearGradient id="gradFratura" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#fef08a" />
        <Stop offset="60%" stopColor="#facc15" />
        <Stop offset="100%" stopColor="#a16207" />
      </LinearGradient>
      <LinearGradient id="gradErosao" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#94a3b8" />
        <Stop offset="100%" stopColor="#1e293b" />
      </LinearGradient>
      <LinearGradient id="gradRoot" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#cbd5e1" />
        <Stop offset="100%" stopColor="#475569" />
      </LinearGradient>
      <LinearGradient id="gradEnamelHi" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
        <Stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
      </LinearGradient>
    </Defs>
  );
}

// ============================================================
// Tooth SVG paths (anatomia v4 — sem bolinhas)
// ============================================================
type ToothSvgProps = {
  finding?: FindingType;
};

function ToothIncisivoSvg({ finding = "higido" }: ToothSvgProps) {
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  return (
    <>
      <Path d="M11 8 Q11 4 14 4 L36 4 Q39 4 39 8 L37 32 Q35 42 25 42 Q15 42 13 32 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.4" />
      <Path d="M14 5 Q17 7 20 5 Q23 7 25 5 Q27 7 30 5 Q33 7 36 5" fill="none" stroke={stroke} strokeWidth="0.4" opacity={0.5} />
      <Path d="M13 8 Q13 6 16 6 L34 6 Q37 6 37 8 L36 18 Q25 14 14 18 Z" fill="url(#gradEnamelHi)" opacity={0.4} />
      <Path d="M14 42 Q25 40 36 42" fill="none" stroke={stroke} strokeWidth="0.4" opacity={0.4} />
      <Path d="M15 42 Q14 50 18 70 Q22 78 25 78 Q28 78 32 70 Q36 50 35 42 Z" fill="url(#gradRoot)" stroke={stroke} strokeWidth="0.8" />
    </>
  );
}

function ToothCaninoSvg({ finding = "higido" }: ToothSvgProps) {
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  return (
    <>
      <Path d="M12 18 L20 6 Q25 3 28 6 L38 14 L36 32 Q33 44 25 44 Q17 44 14 32 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.4" />
      <Path d="M22 7 Q25 3 28 7 L25 12 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="0.8" />
      <Path d="M25 6 L25 36" stroke={stroke} strokeWidth="0.4" opacity={0.35} fill="none" />
      <Path d="M14 18 L21 8 Q25 5 28 8 L37 16 L34 24 Q25 20 16 24 Z" fill="url(#gradEnamelHi)" opacity={0.4} />
      <Path d="M15 44 Q25 42 35 44" fill="none" stroke={stroke} strokeWidth="0.4" opacity={0.4} />
      <Path d="M15 44 Q13 52 16 72 Q20 82 25 82 Q30 82 34 72 Q37 52 35 44 Z" fill="url(#gradRoot)" stroke={stroke} strokeWidth="0.8" />
    </>
  );
}

function ToothPreMolarSvg({ finding = "higido" }: ToothSvgProps) {
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  return (
    <>
      <Path d="M9 12 Q9 4 25 4 Q41 4 41 12 L39 36 Q34 44 25 44 Q16 44 11 36 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.4" />
      <Path d="M25 6 L25 26" stroke={stroke} strokeWidth="0.7" opacity={0.45} fill="none" />
      <Path d="M11 12 Q11 6 17 6 L17 24 Q14 24 11 22 Z" fill={stroke} opacity={0.08} />
      <Path d="M39 12 Q39 6 33 6 L33 24 Q36 24 39 22 Z" fill={stroke} opacity={0.08} />
      <Path d="M11 12 Q11 5 25 5 Q39 5 39 12 L37 24 Q25 21 13 24 Z" fill="url(#gradEnamelHi)" opacity={0.3} />
      <Path d="M14 44 Q25 42 36 44" fill="none" stroke={stroke} strokeWidth="0.4" opacity={0.4} />
      <Path d="M16 44 Q15 50 17 68 Q21 76 25 76 Q29 76 33 68 Q35 50 34 44 Z" fill="url(#gradRoot)" stroke={stroke} strokeWidth="0.8" />
    </>
  );
}

function ToothMolarSvg({ finding = "higido" }: ToothSvgProps) {
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  return (
    <>
      <Path d="M5 14 Q5 4 25 4 Q45 4 45 14 L43 40 Q39 50 25 50 Q11 50 7 40 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.4" />
      <Path d="M25 8 L25 46" stroke={stroke} strokeWidth="0.6" opacity={0.5} fill="none" />
      <Path d="M7 24 L43 24" stroke={stroke} strokeWidth="0.6" opacity={0.5} fill="none" />
      <Path d="M7 14 Q7 6 14 5 L14 22 Q11 22 7 18 Z" fill={stroke} opacity={0.08} />
      <Path d="M43 14 Q43 6 36 5 L36 22 Q39 22 43 18 Z" fill={stroke} opacity={0.08} />
      <Path d="M9 38 Q11 44 14 46 L14 30 Q11 32 9 36 Z" fill={stroke} opacity={0.08} />
      <Path d="M41 38 Q39 44 36 46 L36 30 Q39 32 41 36 Z" fill={stroke} opacity={0.08} />
      <Path d="M7 14 Q7 5 25 5 Q43 5 43 14 L41 26 Q25 22 9 26 Z" fill="url(#gradEnamelHi)" opacity={0.3} />
      <Path d="M11 50 Q25 48 39 50" fill="none" stroke={stroke} strokeWidth="0.4" opacity={0.4} />
      <Path d="M11 50 Q9 56 11 70 Q14 76 18 76 Q19 76 19 50 Z" fill="url(#gradRoot)" stroke={stroke} strokeWidth="0.7" />
      <Path d="M21 50 Q21 60 22 70 Q24 76 26 76 Q28 76 28 70 Q29 60 29 50 Z" fill="url(#gradRoot)" stroke={stroke} strokeWidth="0.7" />
      <Path d="M31 50 Q31 56 32 70 Q34 76 38 76 Q40 76 41 70 Q41 56 39 50 Z" fill="url(#gradRoot)" stroke={stroke} strokeWidth="0.7" />
    </>
  );
}

function ToothAusenteSvg() {
  return (
    <>
      <Rect x="6" y="6" width="38" height="60" rx="6" fill="none" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 3" />
      <Path d="M14 14 L36 56 M36 14 L14 56" stroke="#475569" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function ToothNaoErupSvg() {
  return <Rect x="6" y="6" width="38" height="60" rx="6" fill="none" stroke="#475569" strokeWidth="1.2" strokeDasharray="1 3" />;
}

// ============================================================
// Tooth (composite)
// ============================================================
type ToothProps = {
  state: ToothState;
  selected?: boolean;
  onPress?: () => void;
};

function Tooth({ state, selected, onPress }: ToothProps) {
  const num = state.tooth;
  const type = getToothType(num);
  const finding = (state.condition[0]?.finding_type as FindingType) || "higido";
  const hasPlanned = state.planned.length > 0;
  const hasCompleted = state.completed.length > 0;

  const ToothInner =
    type === "incisivo"
      ? ToothIncisivoSvg
      : type === "canino"
      ? ToothCaninoSvg
      : type === "premolar"
      ? ToothPreMolarSvg
      : ToothMolarSvg;

  return (
    <Pressable onPress={onPress} style={[styles.tooth, selected && styles.toothSelected]}>
      <Svg viewBox="0 0 50 86" width="100%" height="100%">
        <SvgDefs />
        <ToothInner finding={finding} />
        {hasPlanned && !hasCompleted && (
          <Rect x="2" y="2" width="46" height="80" rx="6" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" opacity={0.85} />
        )}
        {hasCompleted && (
          <Rect x="2" y="2" width="46" height="80" rx="6" fill="none" stroke="#2563eb" strokeWidth="2" opacity={0.7} />
        )}
      </Svg>
      <View style={styles.toothNumWrapper}>
        <Text style={[styles.toothNum, selected && styles.toothNumSelected]}>{num}</Text>
      </View>
      {hasPlanned && !hasCompleted && (
        <View style={[styles.toothBadge, styles.badgePlanned]}>
          <Text style={styles.toothBadgeText}>!</Text>
        </View>
      )}
      {hasCompleted && (
        <View style={[styles.toothBadge, styles.badgeCompleted]}>
          <Text style={styles.toothBadgeText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

// ============================================================
// Odontograma2D
// ============================================================
export default function Odontograma2D({ chart, selectedTooth, onToothSelect }: Props) {
  const teethById = useMemo(() => {
    const m = new Map<number, ToothState>();
    for (const t of chart) m.set(t.tooth, t);
    return m;
  }, [chart]);

  const renderRow = (numbers: number[]) => (
    <View style={styles.archRow}>
      {numbers.map((n) => {
        const state =
          teethById.get(n) ||
          ({ tooth: n, condition: [], planned: [], completed: [] } as ToothState);
        return (
          <Tooth
            key={n}
            state={state}
            selected={selectedTooth === n}
            onPress={() => onToothSelect?.(n)}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.archLabel}>SUPERIOR · VESTIBULAR</Text>
      {renderRow(FDI_SUPERIOR)}
      <View style={styles.archDivider} />
      {renderRow(FDI_INFERIOR)}
      <Text style={styles.archLabel}>INFERIOR · VESTIBULAR</Text>
    </View>
  );
}

// ============================================================
// Helpers exposed
// ============================================================
export function emptyToothState(tooth: number): ToothState {
  return { tooth, condition: [], planned: [], completed: [] };
}

export function buildChartFromEntries(entries: ChartEntry[]): ToothState[] {
  const byTooth = new Map<number, ToothState>();
  for (const e of entries) {
    if (!byTooth.has(e.tooth_number)) {
      byTooth.set(e.tooth_number, emptyToothState(e.tooth_number));
    }
    const t = byTooth.get(e.tooth_number)!;
    if (e.axis === "condition") t.condition.push(e);
    else if (e.axis === "treatment_planned") t.planned.push(e);
    else if (e.axis === "treatment_completed") t.completed.push(e);
  }
  return Array.from(byTooth.values());
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: DentalColors.bg,
    borderRadius: 16,
  },
  archLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: DentalColors.ink3,
    textAlign: "center",
    marginVertical: 8,
    fontWeight: "700",
  },
  archRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-end",
  },
  archDivider: {
    height: 1,
    backgroundColor: DentalColors.border,
    marginVertical: 18,
    opacity: 0.4,
  },
  tooth: {
    flex: 1,
    aspectRatio: 50 / 86,
    position: "relative",
    cursor: "pointer" as any,
  },
  toothSelected: {
    transform: [{ translateY: -3 }],
  },
  toothNumWrapper: {
    position: "absolute",
    bottom: -16,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toothNum: {
    fontSize: 9,
    color: DentalColors.ink3,
    fontWeight: "600",
  },
  toothNumSelected: {
    color: DentalColors.cyan,
    fontWeight: "800",
  },
  toothBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: DentalColors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  toothBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#fff",
  },
  badgePlanned: {
    backgroundColor: "#ef4444",
  },
  badgeCompleted: {
    backgroundColor: "#2563eb",
  },
});
