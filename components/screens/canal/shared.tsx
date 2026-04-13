import { View, Text, StyleSheet, TextInput, Pressable, Dimensions, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
export const TABS = ["Meu Site", "Vitrine", "Entrega"];
export const COLOR_PRESETS = ["#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb", "#db2777", "#0891b2", "#374151"];

export function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={cs.field}>
      <Text style={cs.fieldLabel}>{label}</Text>
      <TextInput style={[cs.input, multiline && cs.textarea]} value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={Colors.ink3} multiline={multiline} numberOfLines={multiline ? 3 : 1} />
    </View>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text style={cs.sectionTitle}>{title}</Text>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active: { label: "Ativo", bg: Colors.greenD, color: Colors.green },
    pending_dns: { label: "Aguardando DNS", bg: Colors.amberD, color: Colors.amber },
    none: { label: "Sem dominio", bg: Colors.bg4, color: Colors.ink3 },
  };
  const st = map[status] || map.none;
  return <View style={[cs.badge, { backgroundColor: st.bg }]}><Text style={[cs.badgeText, { color: st.color }]}>{st.label}</Text></View>;
}

export const cs = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  sectionTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700", marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  switchLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  switchHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.border },
  infoText: { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 16 },
  hint: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 12 },
  colorRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 16, flexWrap: "wrap" },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff", transform: [{ scale: 1.15 }] },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  filterText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  filterTextActive: { color: Colors.violet3, fontWeight: "600" },
});
