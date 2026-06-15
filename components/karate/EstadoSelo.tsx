// ============================================================
// EstadoSelo — Track J (Certificados)
//
// Componente de estado reutilizável para pedidos de certificado.
// 5 estados: solicitado → em_producao → impresso → enviado | recusado
//
// Shoji palette. Aparece na ficha do dojô, na caixa da federação
// e nos e-mails de notificação (descrito no mockup J_selo.html).
//
// StyleSheet.create seguro: todos os top-level entries são objetos
// (evita WeakMap pitfall documentado em armadilha 08/06).
// ============================================================
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";

export type CertOrderStatus =
  | "requested"
  | "in_production"
  | "printed"
  | "shipped"
  | "refused";

interface SeloConfig {
  label: string;
  icon: "mail-outline" | "cog-outline" | "print-outline" | "send-outline" | "close-circle-outline";
  fg: string;
  bg: string;
  border: string;
  dot: string;
}

const SELO_MAP: Record<CertOrderStatus, SeloConfig> = {
  requested:     { label: "Solicitado",  icon: "mail-outline",         fg: ShojiPalette.ink3,   bg: "rgba(43,38,32,0.05)",   border: "rgba(43,38,32,0.16)",  dot: "#9b9180" },
  in_production: { label: "Em produção", icon: "cog-outline",          fg: "#876721",            bg: "rgba(207,170,72,0.14)", border: "rgba(207,170,72,0.48)", dot: "#c79a35" },
  printed:       { label: "Impresso",    icon: "print-outline",        fg: ShojiPalette.ink2,   bg: "rgba(122,78,48,0.10)",  border: "rgba(122,78,48,0.36)",  dot: "#7a4e30" },
  shipped:       { label: "Enviado",     icon: "send-outline",         fg: "#3f6b3d",            bg: "rgba(74,122,72,0.10)",  border: "rgba(74,122,72,0.34)",  dot: "#4a7a48" },
  refused:       { label: "Recusado",    icon: "close-circle-outline", fg: "#a23c31",            bg: "rgba(184,70,58,0.08)",  border: "rgba(184,70,58,0.42)",  dot: "#b8463a" },
};

export function EstadoSelo({
  status,
  showLabel = true,
}: {
  status: CertOrderStatus;
  showLabel?: boolean;
}) {
  const cfg = SELO_MAP[status] ?? SELO_MAP.requested;
  return (
    <View
      style={[
        st.pill,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
      ]}
      accessibilityLabel={cfg.label}
    >
      <View style={[st.dot, { backgroundColor: cfg.dot }]}>
        <Ionicons name={cfg.icon} size={9} color="#fff" />
      </View>
      {showLabel && (
        <Text style={[st.label, { color: cfg.fg }]}>{cfg.label}</Text>
      )}
    </View>
  );
}

// Mapeia status da API (strings) para CertOrderStatus
export function normalizeCertStatus(raw: string): CertOrderStatus {
  const map: Record<string, CertOrderStatus> = {
    requested: "requested",
    in_production: "in_production",
    printed: "printed",
    shipped: "shipped",
    refused: "refused",
  };
  return map[raw] ?? "requested";
}

const st = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  } as ViewStyle,
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as ViewStyle,
  label: {
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 14,
  } as TextStyle,
});
