// ============================================================
// ConsultaOdontogramaPanel — Odontograma + popover anotacao.
//
// Reusa OdontogramaSVG existente. Quando o dentista clica num
// dente, o pai abre o ToothPopover (renderizado como overlay
// no Shell). Aqui so cuidamos do render e do callback.
// ============================================================

import { View, Text, ScrollView } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { OdontogramaSVG, type ToothData } from "@/components/verticals/odonto/OdontogramaSVG";

interface Props {
  teeth: ToothData[];
  onToothSelect: (tooth: ToothData) => void;
  selectedTooth?: number | null;
  highlightTeeth?: number[]; // recently changed
}

export function ConsultaOdontogramaPanel({ teeth, onToothSelect, selectedTooth, highlightTeeth }: Props) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: DentalColors.bg }} contentContainerStyle={{ padding: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{
          fontSize: 9, color: DentalColors.ink3, fontWeight: "700",
          letterSpacing: 1.4, textTransform: "uppercase",
        }}>
          ODONTOGRAMA · clique pra anotar
        </Text>
        {highlightTeeth && highlightTeeth.length > 0 ? (
          <Text style={{ fontSize: 9, color: DentalColors.cyan, fontWeight: "700" }}>
            {highlightTeeth.length} alteracao(oes) nesta sessao
          </Text>
        ) : null}
      </View>
      <View style={{
        backgroundColor: DentalColors.bg2, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: DentalColors.border,
      }}>
        <OdontogramaSVG
          teeth={teeth}
          onToothSelect={onToothSelect}
          selectedTooth={selectedTooth || null}
          editable
        />
      </View>
    </ScrollView>
  );
}
