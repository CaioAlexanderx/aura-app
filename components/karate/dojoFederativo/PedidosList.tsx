// ============================================================
// PedidosList — "Meus pedidos" de certificado (F5b), com filtro por
// status e EstadoSelo (mesmo componente de estado usado desde a Track J).
//
// StyleSheet: todos os top-level são objetos (WeakMap safe).
// ============================================================
import React from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { EstadoSelo, normalizeCertStatus } from "@/components/karate/EstadoSelo";
import { DojoCertOrderRow, DojoCertOrderStatus } from "@/services/karateDojoFederativoApi";
import { fmtDataCurta } from "./helpers";

const FILTERS: { key: DojoCertOrderStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "requested", label: "Solicitado" },
  { key: "in_production", label: "Em produção" },
  { key: "printed", label: "Impresso" },
  { key: "shipped", label: "Enviado" },
  { key: "refused", label: "Recusado" },
];

interface Props {
  orders: DojoCertOrderRow[];
  loading: boolean;
  statusFilter: DojoCertOrderStatus | "all";
  onChangeFilter: (f: DojoCertOrderStatus | "all") => void;
}

export function PedidosList({ orders, loading, statusFilter, onChangeFilter }: Props) {
  return (
    <View style={{ gap: 12 }}>
      <View style={st.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[st.chip, statusFilter === f.key && st.chipOn]}
            onPress={() => onChangeFilter(f.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: statusFilter === f.key }}
          >
            <Text style={[st.chipTxt, statusFilter === f.key && st.chipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={st.card}>
        {loading ? (
          <ActivityIndicator color={KarateColors.primary} />
        ) : orders.length === 0 ? (
          <View style={st.empty}>
            <Icon name="mail" size={28} color={KarateColors.ink4} />
            <Text style={st.emptyText}>
              {statusFilter === "all" ? "Nenhum pedido ainda" : "Nenhum pedido neste status"}
            </Text>
          </View>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={st.orderRow}>
              <View style={st.av}>
                <Text style={st.avText}>
                  {o.student_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{o.student_name}</Text>
                <Text style={st.belt}>{o.belt_label ?? "—"} · {fmtDataCurta(o.created_at)}</Text>
              </View>
              <EstadoSelo status={normalizeCertStatus(o.status)} />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  card: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 4 } as ViewStyle,
  empty: { alignItems: "center", paddingVertical: 28, gap: 8 } as ViewStyle,
  emptyText: { fontSize: 13, color: KarateColors.ink4, fontWeight: "600", textAlign: "center" } as TextStyle,
  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  av: { width: 38, height: 38, borderRadius: 19, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  avText: { fontSize: 13, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  name: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  belt: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
});
