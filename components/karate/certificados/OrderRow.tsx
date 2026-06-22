// ============================================================
// OrderRow — Track J (Certificados)
//
// Uma linha da caixa de certificados: checkbox de seleção,
// avatar, nome/meta, EstadoSelo e botão Detalhe.
// Reskin Shoji; comportamento idêntico ao bloco inline original.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors as C } from "@/constants/karateTheme";
import { EstadoSelo, normalizeCertStatus } from "@/components/karate/EstadoSelo";
import { Avatar } from "@/components/karate/shoji";
import { CertOrder } from "@/services/karateApi";
import { cs, fmtDate } from "./shared";

export function OrderRow({
  order, selected, onToggle, onDetail,
}: {
  order: CertOrder;
  selected: boolean;
  onToggle: (id: string) => void;
  onDetail: (order: CertOrder) => void;
}) {
  return (
    <View style={[cs.orderRow, selected && cs.orderRowSel]}>
      <TouchableOpacity onPress={() => onToggle(order.id)} style={cs.checkbox}>
        <View style={[cs.checkboxBox, selected && cs.checkboxBoxSel]}>
          {selected ? <Ionicons name="checkmark" size={11} color="#fdf8f2" /> : null}
        </View>
      </TouchableOpacity>
      <Avatar name={order.nome_impresso} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={cs.name}>{order.nome_impresso}</Text>
        <Text style={cs.orderMeta}>{order.belt_name} · {fmtDate(order.created_at)}</Text>
      </View>
      <EstadoSelo status={normalizeCertStatus(order.status)} />
      <TouchableOpacity onPress={() => onDetail(order)} style={cs.detailBtn}>
        <Text style={cs.detailBtnText}>Detalhe</Text>
      </TouchableOpacity>
    </View>
  );
}
