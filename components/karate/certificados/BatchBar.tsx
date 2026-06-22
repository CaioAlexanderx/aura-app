// ============================================================
// BatchBar — Track J (Certificados)
//
// Barra de ações em lote: contagem, seletor "Avançar para",
// Aplicar, Recusar e limpar seleção.
// Reskin Shoji; comportamento idêntico ao bloco inline original.
// ============================================================
import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors as C } from "@/constants/karateTheme";
import { CertOrderStatus } from "@/components/karate/EstadoSelo";
import { cs, ADVANCE_OPTIONS } from "./shared";

export function BatchBar({
  count, batchTarget, onSetTarget, onApply, onRefuse, onClear,
}: {
  count: number;
  batchTarget: CertOrderStatus;
  onSetTarget: (s: CertOrderStatus) => void;
  onApply: () => void;
  onRefuse: () => void;
  onClear: () => void;
}) {
  return (
    <View style={cs.batchBar}>
      <Text style={cs.batchCount}>{count}</Text>
      <Text style={cs.batchLabel}>selecionado(s) — processar em lote</Text>
      <View style={{ flex: 1 }} />
      <Text style={cs.batchForLabel}>Avançar para</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {ADVANCE_OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.value}
            style={[cs.batchOpt, batchTarget === opt.value && cs.batchOptSel]}
            onPress={() => onSetTarget(opt.value)}
          >
            <Text style={[cs.batchOptText, batchTarget === opt.value && cs.batchOptTextSel]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={cs.btnPrimary} onPress={onApply}>
        <Text style={cs.btnPrimaryText}>Aplicar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={cs.btnGhost} onPress={onRefuse}>
        <Text style={cs.btnGhostText}>Recusar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClear}>
        <Ionicons name="close" size={18} color={C.ink3} />
      </TouchableOpacity>
    </View>
  );
}
