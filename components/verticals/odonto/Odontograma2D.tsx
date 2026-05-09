// ============================================================
// AURA. — Odontograma 2D v5 (PR42, atualizado 2026-04-29)
//
// Anatomia clinica realista (referencia Dentrix/Eaglesoft):
// - Raizes com curvatura natural e taper
// - CEJ visivel separando coroa branca de raiz creme
// - Vista DUAL fixa: vestibular + oclusal por arcada
// - 4 tipos de dente com paths anatomicos sem bolinhas
//
// PR43.7 (2026-04-29): import trocado de react-native-svg pra ./_svgShim
// FIX-22 (2026-05-09): arcada superior vestibular recebe scaleY:-1
// (orientação clínica correta — coroas voltadas para o plano oclusal).
// ============================================================

import React, { useMemo } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import Svg, {
  Path,
  Rect,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Ellipse,
} from "./_svgShim";
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
// FDI ordering (clinical order)
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
// Color resolver
// ============================================================
const findingFillId: Record<FindingType, string> = {
  higido: "enamel",
  carie: "gradCarie",
  restauracao_antiga: "gradRestAnt",
  coroa_antiga: "gradCoroaAnt",
  faceta_antiga: "gradRestAnt",
  endodontia_tratada: "gradEndo",
  implante: "gradImplante",
  fratura: "gradFratura",
  mancha_branca: "enamel",
  mobilidade: "enamel",
  atrito: "gradErosao",
  abfracao: "gradErosao",
  erosao: "gradErosao",
  ausente: "enamel",
  nao_erupcionado: "enamel",
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
// SVG Defs (gradientes anatomicos premium)
// ============================================================
function SvgDefs() {
  return (
    <Defs>
      <LinearGradient id="enamel" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#ffffff" />
        <Stop offset="40%" stopColor="#f8fafc" />
        <Stop offset="80%" stopColor="#e8eef5" />
        <Stop offset="100%" stopColor="#d6dfeb" />
      </LinearGradient>
      <RadialGradient id="enamelHi" cx="40%" cy="30%" rx="70%" ry="70%">
        <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
        <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.05" />
      </RadialGradient>
      <LinearGradient id="root" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#fef9e7" />
        <Stop offset="40%" stopColor="#f5e6c0" />
        <Stop offset="100%" stopColor="#c8a878" />
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
    </Defs>
  );
}

// ============================================================
// VESTIBULAR PATHS — anatomia v5
// ============================================================
type ToothSvgProps = { finding?: FindingType };

function IncisivoVest({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Ellipse cx="25" cy="38" rx="12" ry="3" fill="#000" opacity={0.08} />
      <Path d="M12 8 Q12 5 15 4 Q20 3 25 3 Q30 3 35 4 Q38 5 38 8 L37 22 Q36 32 33 38 Q29 42 25 42 Q21 42 17 38 Q14 32 13 22 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.3" />
      <Path d="M12 8 Q12 5 15 4 Q20 3 25 3 Q30 3 35 4 Q38 5 38 8 L37 22 Q25 18 13 22 Z" fill="url(#enamelHi)" opacity={0.7} />
      <Path d="M16 5 Q19 7 22 5 Q25 7 28 5 Q31 7 34 5" fill="none" stroke={stroke} strokeWidth="0.4" opacity={0.4} />
      <Path d="M14 42 Q17 40 25 40 Q33 40 36 42" fill="none" stroke={stroke} strokeWidth="0.6" opacity={0.5} />
      <Path d="M14 42 Q13 50 14 60 Q15 75 19 85 Q22 91 25 92 Q28 91 31 85 Q35 75 36 60 Q37 50 36 42 Q33 40 25 40 Q17 40 14 42 Z" fill="url(#root)" stroke={stroke} strokeWidth="0.8" />
      <Path d="M14 42 Q13 50 14 60 Q15 75 19 85 L18 85 Q14 75 13 60 Q12 50 13 42 Z" fill={stroke} opacity={0.15} />
      <Path d="M36 42 Q37 50 36 60 Q35 75 31 85 L32 85 Q36 75 37 60 Q38 50 37 42 Z" fill={stroke} opacity={0.15} />
    </>
  );
}

function CaninoVest({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Ellipse cx="25" cy="40" rx="13" ry="3" fill="#000" opacity={0.08} />
      <Path d="M12 18 Q13 12 16 9 L21 5 Q23 3 25 2.5 Q27 3 29 5 L34 9 Q37 12 38 18 L37 28 Q36 38 32 42 Q28 44 25 44 Q22 44 18 42 Q14 38 13 28 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.3" />
      <Path d="M14 18 Q15 12 18 9 L23 5 Q25 3 27 5 L32 9 Q35 12 36 18 L35 24 Q25 21 15 24 Z" fill="url(#enamelHi)" opacity={0.7} />
      <Path d="M25 4 L25 36" fill="none" stroke={stroke} strokeWidth="0.5" opacity={0.3} />
      <Path d="M14 44 Q18 42 25 42 Q32 42 36 44" fill="none" stroke={stroke} strokeWidth="0.6" opacity={0.5} />
      <Path d="M14 44 Q12 54 13 66 Q14 80 17 90 Q20 96 25 96 Q30 96 33 90 Q36 80 37 66 Q38 54 36 44 Q32 42 25 42 Q18 42 14 44 Z" fill="url(#root)" stroke={stroke} strokeWidth="0.8" />
      <Path d="M14 44 Q12 54 13 66 Q14 80 17 90 L16 90 Q12 80 11 66 Q11 54 12 44 Z" fill={stroke} opacity={0.15} />
      <Path d="M36 44 Q38 54 37 66 Q36 80 33 90 L34 90 Q38 80 39 66 Q39 54 38 44 Z" fill={stroke} opacity={0.15} />
    </>
  );
}

function PreMolarVest({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Ellipse cx="25" cy="42" rx="14" ry="3" fill="#000" opacity={0.08} />
      <Path d="M10 14 Q10 6 18 4 Q25 3 32 4 Q40 6 40 14 L38 32 Q36 42 30 44 Q25 45 20 44 Q14 42 12 32 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.3" />
      <Path d="M11 14 Q11 6 18 5 Q25 4 32 5 Q39 6 39 14 L37 24 Q25 21 13 24 Z" fill="url(#enamelHi)" opacity={0.65} />
      <Path d="M25 6 L25 30" fill="none" stroke={stroke} strokeWidth="0.5" opacity={0.3} />
      <Path d="M11 14 Q11 6 18 5 L20 24 Q15 25 11 22 Z" fill={stroke} opacity={0.06} />
      <Path d="M39 14 Q39 6 32 5 L30 24 Q35 25 39 22 Z" fill={stroke} opacity={0.06} />
      <Path d="M14 44 Q18 43 25 43 Q32 43 36 44" fill="none" stroke={stroke} strokeWidth="0.6" opacity={0.5} />
      <Path d="M14 44 Q12 54 14 64 Q15 78 19 86 Q22 90 25 90 Q28 90 31 86 Q35 78 36 64 Q38 54 36 44 Q32 43 25 43 Q18 43 14 44 Z" fill="url(#root)" stroke={stroke} strokeWidth="0.8" />
      <Path d="M14 44 Q12 54 14 64 Q15 78 19 86 L18 86 Q13 78 12 64 Q11 54 13 44 Z" fill={stroke} opacity={0.15} />
      <Path d="M36 44 Q38 54 36 64 Q35 78 31 86 L32 86 Q37 78 38 64 Q39 54 37 44 Z" fill={stroke} opacity={0.15} />
    </>
  );
}

function MolarVest({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente") return <ToothAusenteSvg />;
  if (finding === "nao_erupcionado") return <ToothNaoErupSvg />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Ellipse cx="25" cy="48" rx="16" ry="3" fill="#000" opacity={0.1} />
      <Path d="M5 16 Q5 6 14 4 Q25 2 36 4 Q45 6 45 16 L44 36 Q42 46 36 50 Q31 52 25 52 Q19 52 14 50 Q8 46 6 36 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.3" />
      <Path d="M6 16 Q6 6 14 5 Q25 3 36 5 Q44 6 44 16 L42 28 Q25 25 8 28 Z" fill="url(#enamelHi)" opacity={0.6} />
      <Path d="M6 36 Q8 46 14 50 L14 38 Z" fill={stroke} opacity={0.08} />
      <Path d="M44 36 Q42 46 36 50 L36 38 Z" fill={stroke} opacity={0.08} />
      <Path d="M6 16 Q6 6 14 5 L14 24 Q9 26 6 22 Z" fill={stroke} opacity={0.07} />
      <Path d="M44 16 Q44 6 36 5 L36 24 Q41 26 44 22 Z" fill={stroke} opacity={0.07} />
      <Path d="M25 6 L25 24" fill="none" stroke={stroke} strokeWidth="0.4" opacity={0.2} />
      <Path d="M8 52 Q14 51 25 51 Q36 51 42 52" fill="none" stroke={stroke} strokeWidth="0.6" opacity={0.5} />
      <Path d="M9 52 Q7 60 8 70 Q9 82 13 90 Q15 94 17 94 Q19 94 19 90 L19 60 Q18 54 16 52 Z" fill="url(#root)" stroke={stroke} strokeWidth="0.7" />
      <Path d="M21 52 Q21 62 22 74 Q23 86 25 90 Q27 86 28 74 Q29 62 29 52 Q27 51 25 51 Q23 51 21 52 Z" fill="url(#root)" stroke={stroke} strokeWidth="0.7" />
      <Path d="M31 52 Q32 54 31 60 L31 90 Q31 94 33 94 Q35 94 37 90 Q41 82 42 70 Q43 60 41 52 Z" fill="url(#root)" stroke={stroke} strokeWidth="0.7" />
      <Path d="M9 52 Q7 60 8 70 L7 70 Q7 60 8 52 Z" fill={stroke} opacity={0.18} />
      <Path d="M41 52 Q43 60 42 70 L43 70 Q43 60 42 52 Z" fill={stroke} opacity={0.18} />
    </>
  );
}

// ============================================================
// OCLUSAL PATHS
// ============================================================
function IncisivoOcc({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente" || finding === "nao_erupcionado") return <ToothOccDashed />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Ellipse cx="25" cy="25" rx="14" ry="6" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.2" />
      <Ellipse cx="25" cy="23" rx="13" ry="4" fill="url(#enamelHi)" opacity={0.6} />
      <Path d="M14 25 Q17 27 19 25 Q21 27 23 25 Q25 27 27 25 Q29 27 31 25 Q33 27 36 25" fill="none" stroke={stroke} strokeWidth="0.5" opacity={0.5} />
    </>
  );
}

function CaninoOcc({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente" || finding === "nao_erupcionado") return <ToothOccDashed />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Path d="M14 28 Q14 18 18 14 L25 8 L32 14 Q36 18 36 28 L33 36 Q29 40 25 40 Q21 40 17 36 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.2" />
      <Path d="M16 26 Q16 18 19 15 L25 11 L31 15 Q34 18 34 24 Q25 22 16 26 Z" fill="url(#enamelHi)" opacity={0.6} />
      <Ellipse cx="25" cy="11" rx="2" ry="2" fill={stroke} opacity={0.2} />
      <Path d="M25 11 L20 30 M25 11 L30 30" fill="none" stroke={stroke} strokeWidth="0.5" opacity={0.4} />
    </>
  );
}

function PreMolarOcc({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente" || finding === "nao_erupcionado") return <ToothOccDashed />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Path d="M9 16 Q9 10 14 8 Q25 5 36 8 Q41 10 41 16 L40 36 Q34 42 25 42 Q16 42 10 36 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.2" />
      <Path d="M11 16 Q11 10 16 8 Q21 7 24 9 L24 25 Q19 27 12 25 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="0.6" opacity={0.5} />
      <Path d="M12 16 Q12 11 17 9 Q22 8 24 10 L24 22 Q19 24 13 22 Z" fill="url(#enamelHi)" opacity={0.5} />
      <Path d="M39 16 Q39 10 34 8 Q29 7 26 9 L26 25 Q31 27 38 25 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="0.6" opacity={0.5} />
      <Path d="M38 16 Q38 11 33 9 Q28 8 26 10 L26 22 Q31 24 37 22 Z" fill="url(#enamelHi)" opacity={0.5} />
      <Path d="M25 8 Q24.5 24 25 42" fill="none" stroke={stroke} strokeWidth="0.7" opacity={0.6} />
    </>
  );
}

function MolarOcc({ finding = "higido" }: ToothSvgProps) {
  if (finding === "ausente" || finding === "nao_erupcionado") return <ToothOccDashed />;
  const fillId = findingFillId[finding];
  const stroke = findingStroke[finding];
  return (
    <>
      <Path d="M5 14 Q5 6 13 5 Q25 3 37 5 Q45 6 45 14 L44 38 Q42 44 36 46 Q25 48 14 46 Q8 44 6 38 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="1.2" />
      <Path d="M6 14 Q6 6 13 5 Q21 5 23 9 L23 24 Q15 26 6 24 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="0.5" opacity={0.5} />
      <Path d="M7 14 Q7 7 14 6 Q20 6 22 10 L22 20 Q15 22 8 20 Z" fill="url(#enamelHi)" opacity={0.5} />
      <Path d="M44 14 Q44 6 37 5 Q29 5 27 9 L27 24 Q35 26 44 24 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="0.5" opacity={0.5} />
      <Path d="M43 14 Q43 7 36 6 Q30 6 28 10 L28 20 Q35 22 42 20 Z" fill="url(#enamelHi)" opacity={0.5} />
      <Path d="M6 38 Q6 44 14 46 Q21 47 23 42 L23 28 Q15 26 6 28 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="0.5" opacity={0.5} />
      <Path d="M7 38 Q7 43 14 45 Q20 46 22 41 L22 30 Q15 28 8 30 Z" fill="url(#enamelHi)" opacity={0.5} />
      <Path d="M44 38 Q44 44 36 46 Q29 47 27 42 L27 28 Q35 26 44 28 Z" fill={`url(#${fillId})`} stroke={stroke} strokeWidth="0.5" opacity={0.5} />
      <Path d="M43 38 Q43 43 36 45 Q30 46 28 41 L28 30 Q35 28 42 30 Z" fill="url(#enamelHi)" opacity={0.5} />
      <Path d="M25 4 Q24 14 23 24 Q24 26 25 26 Q26 26 27 24 Q26 14 25 4" fill={stroke} opacity={0.3} />
      <Path d="M5 25 Q15 26 22 26 Q25 26 28 26 Q35 26 45 25" fill="none" stroke={stroke} strokeWidth="0.7" opacity={0.5} />
      <Path d="M25 26 L23 46" fill="none" stroke={stroke} strokeWidth="0.6" opacity={0.4} />
    </>
  );
}

// ============================================================
// Casos especiais
// ============================================================
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

function ToothOccDashed() {
  return <Rect x="6" y="14" width="38" height="22" rx="11" fill="none" stroke="#475569" strokeWidth="1.2" strokeDasharray="2 3" />;
}

// ============================================================
// Tooth composite
// ============================================================
type ToothViewMode = "vest" | "occ";
type ToothProps = {
  state: ToothState;
  view: ToothViewMode;
  selected?: boolean;
  onPress?: () => void;
};

function Tooth({ state, view, selected, onPress }: ToothProps) {
  const num = state.tooth;
  const type = getToothType(num);
  const finding = (state.condition[0]?.finding_type as FindingType) || "higido";
  const hasPlanned = state.planned.length > 0;
  const hasCompleted = state.completed.length > 0;

  const VestComp =
    type === "incisivo" ? IncisivoVest :
    type === "canino" ? CaninoVest :
    type === "premolar" ? PreMolarVest : MolarVest;
  const OccComp =
    type === "incisivo" ? IncisivoOcc :
    type === "canino" ? CaninoOcc :
    type === "premolar" ? PreMolarOcc : MolarOcc;

  const viewBox = view === "occ" ? "0 0 50 50" : "0 0 50 100";
  const Comp = view === "occ" ? OccComp : VestComp;
  const overlayHeight = view === "occ" ? 46 : 96;

  return (
    <Pressable
      onPress={onPress}
      style={[
        view === "occ" ? styles.toothOcc : styles.toothVest,
        selected && styles.toothSelected,
      ]}
    >
      <Svg viewBox={viewBox} width="100%" height="100%">
        <SvgDefs />
        <Comp finding={finding} />
        {hasPlanned && !hasCompleted && (
          <Rect x="2" y="2" width="46" height={overlayHeight} rx="6" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" opacity={0.85} />
        )}
        {hasCompleted && (
          <Rect x="2" y="2" width="46" height={overlayHeight} rx="6" fill="none" stroke="#2563eb" strokeWidth="2" opacity={0.7} />
        )}
      </Svg>
      {view === "vest" && (
        <>
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
        </>
      )}
    </Pressable>
  );
}

// ============================================================
// Odontograma2D — vista DUAL (vestibular + oclusal)
// FIX-22: renderRow aceita flipped para inverter arcada superior
// ============================================================
export default function Odontograma2D({
  chart,
  selectedTooth,
  onToothSelect,
}: Props) {
  const teethById = useMemo(() => {
    const m = new Map<number, ToothState>();
    for (const t of chart) m.set(t.tooth, t);
    return m;
  }, [chart]);

  // flipped=true aplica scaleY:-1 (orientação clínica: coroa para baixo)
  const renderRow = (numbers: number[], view: ToothViewMode, flipped = false) => (
    <View style={[styles.archRow, flipped && styles.archRowFlipped]}>
      {numbers.map((n) => {
        const state =
          teethById.get(n) ||
          ({ tooth: n, condition: [], planned: [], completed: [] } as ToothState);
        return (
          <Tooth
            key={`${view}-${n}`}
            state={state}
            view={view}
            selected={selectedTooth === n}
            onPress={() => onToothSelect?.(n)}
          />
        );
      })}
    </View>
  );

  const renderNumberRow = (numbers: number[]) => (
    <View style={styles.archRow}>
      {numbers.map((n) => (
        <View key={`num-${n}`} style={styles.numCell}>
          <Text
            style={[styles.numText, selectedTooth === n && styles.numTextSelected]}
          >
            {n}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* FIX-22: superior vestibular — flipped=true (coroas para baixo) */}
      <Text style={styles.archLabel}>SUPERIOR · VESTIBULAR</Text>
      {renderRow(FDI_SUPERIOR, "vest", true)}
      {renderNumberRow(FDI_SUPERIOR)}
      {renderRow(FDI_SUPERIOR, "occ")}
      <Text style={styles.archLabel}>SUPERIOR · OCLUSAL</Text>

      <View style={styles.archDivider} />

      <Text style={styles.archLabel}>INFERIOR · OCLUSAL</Text>
      {renderRow(FDI_INFERIOR, "occ")}
      {renderNumberRow(FDI_INFERIOR)}
      {renderRow(FDI_INFERIOR, "vest")}
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
    paddingVertical: 24,
    paddingHorizontal: 14,
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
    gap: 4,
    alignItems: "flex-end",
  },
  // FIX-22: flip vertical para orientação clínica da arcada superior
  archRowFlipped: {
    transform: [{ scaleY: -1 }],
  },
  archDivider: {
    height: 1,
    backgroundColor: DentalColors.border,
    marginVertical: 16,
    opacity: 0.4,
  },
  toothVest: {
    flex: 1,
    aspectRatio: 50 / 100,
    position: "relative",
    cursor: "pointer" as any,
  },
  toothOcc: {
    flex: 1,
    aspectRatio: 50 / 50,
    position: "relative",
    cursor: "pointer" as any,
  },
  toothSelected: {
    transform: [{ translateY: -2 }],
  },
  numCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  numText: {
    fontSize: 9,
    color: DentalColors.ink3,
    fontWeight: "600",
  },
  numTextSelected: {
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
