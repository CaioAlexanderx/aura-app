// ============================================================
// ConsultaOdontogramaPanel — Odontograma do Modo Consulta
//
// PR43 (2026-04-29): atualizado para usar Odontograma2D v5
// (vista dual vest+oclusal + anatomia clinica refinada).
// Mantem a interface antiga `teeth: ToothData[]` pra nao quebrar
// o ConsultaShell — adapta internamente pra ToothState[].
// ============================================================

import { View, Text, ScrollView } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import Odontograma2D, {
  type ToothState,
  type FindingType,
  type ChartEntry,
} from "@/components/verticals/odonto/Odontograma2D";
import type {
  ToothData,
  ToothStatus,
} from "@/components/verticals/odonto/OdontogramaSVG";

interface Props {
  teeth: ToothData[];
  onToothSelect: (tooth: ToothData) => void;
  selectedTooth?: number | null;
  highlightTeeth?: number[]; // recently changed
}

// ── Adapters: ToothData (legado) -> ToothState (3 axes) ──
function statusToFinding(s?: ToothStatus | null): FindingType {
  if (s === "carie") return "carie";
  if (s === "restaurado") return "restauracao_antiga";
  if (s === "ausente") return "ausente";
  return "higido";
}

function adaptToothDataToState(t: ToothData): ToothState {
  const condition: ChartEntry[] = [
    {
      axis: "condition",
      tooth_number: t.number,
      finding_type: statusToFinding(t.status),
      notes: t.notes || null,
    },
  ];
  const planned: ChartEntry[] =
    t.status === "planejado"
      ? [
          {
            axis: "treatment_planned",
            tooth_number: t.number,
            procedure_type: "restauracao",
            procedure_name: t.procedure_name || null,
          },
        ]
      : [];
  return { tooth: t.number, condition, planned, completed: [] };
}

export function ConsultaOdontogramaPanel({
  teeth,
  onToothSelect,
  selectedTooth,
  highlightTeeth,
}: Props) {
  const chart = teeth.map(adaptToothDataToState);

  const handleToothSelect = (n: number) => {
    const t =
      teeth.find((td) => td.number === n) ||
      ({ number: n, status: "higido" as ToothStatus } as ToothData);
    onToothSelect(t);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: DentalColors.bg }}
      contentContainerStyle={{ padding: 14 }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            color: DentalColors.ink3,
            fontWeight: "700",
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          ODONTOGRAMA · clique pra anotar
        </Text>
        {highlightTeeth && highlightTeeth.length > 0 ? (
          <Text
            style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700" }}
          >
            {highlightTeeth.length} alteração(ões) nesta sessão
          </Text>
        ) : null}
      </View>
      <View
        style={{
          backgroundColor: DentalColors.bg2,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: DentalColors.border,
        }}
      >
        <Odontograma2D
          chart={chart}
          onToothSelect={handleToothSelect}
          selectedTooth={selectedTooth || null}
          editable
        />
      </View>
    </ScrollView>
  );
}
