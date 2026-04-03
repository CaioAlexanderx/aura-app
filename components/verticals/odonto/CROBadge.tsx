import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-14: CROBadge — CRO display on clinical documents
// Shows professional name + CRO in prontuario, receitas, atestados
// ============================================================

interface Props {
  professionalName: string;
  croNumber?: string;
  croState?: string;
  role?: string;
  compact?: boolean;
}

export function CROBadge({ professionalName, croNumber, croState, role = "Cirurgiao-Dentista", compact = false }: Props) {
  if (compact) {
    return (
      <View style={s.compactRow}>
        <Text style={s.compactName}>{professionalName}</Text>
        {croNumber && <Text style={s.compactCro}>CRO-{croState || "SP"} {croNumber}</Text>}
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.line} />
      <Text style={s.name}>{professionalName}</Text>
      <Text style={s.role}>{role}</Text>
      {croNumber && (
        <Text style={s.cro}>CRO-{croState || "SP"} {croNumber}</Text>
      )}
    </View>
  );
}

// Signature block for PDF/print
export function CROSignatureBlock({ professionalName, croNumber, croState, role = "Cirurgiao-Dentista" }: Props) {
  return (
    <View style={s.sigBlock}>
      <View style={s.sigLine} />
      <Text style={s.sigName}>{professionalName}</Text>
      <Text style={s.sigRole}>{role}</Text>
      {croNumber && <Text style={s.sigCro}>CRO-{croState || "SP"} {croNumber}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  // Inline compact
  compactRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  compactName: { fontSize: 12, fontWeight: "600", color: Colors.ink || "#fff" },
  compactCro: { fontSize: 10, color: "#06B6D4", fontWeight: "500", backgroundColor: "rgba(6,182,212,0.1)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  // Card
  card: { alignItems: "center", gap: 4, paddingVertical: 16 },
  line: { width: 200, height: 1, backgroundColor: Colors.ink3 || "#888", marginBottom: 8, opacity: 0.4 },
  name: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" },
  role: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  cro: { fontSize: 12, color: "#06B6D4", fontWeight: "600" },
  // Signature block
  sigBlock: { alignItems: "center", gap: 4, paddingTop: 40, paddingBottom: 16 },
  sigLine: { width: 240, height: 1, backgroundColor: Colors.ink || "#000", marginBottom: 8 },
  sigName: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#000" },
  sigRole: { fontSize: 11, color: Colors.ink2 || "#666" },
  sigCro: { fontSize: 12, color: "#06B6D4", fontWeight: "600" },
});

export default CROBadge;
