import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Employee } from "./types";
import { STATUS_MAP, fmt } from "./types";

type Props = {
  emp: Employee;
  onCalc: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function EmployeeCard({ emp, onCalc, onEdit, onDelete }: Props) {
  const st = STATUS_MAP[emp.status];
  return (
    <View style={s.card}>
      <View style={s.top}>
        <View style={s.avatar}><Text style={s.avatarText}>{emp.name.charAt(0)}</Text></View>
        <View style={s.info}><Text style={s.name}>{emp.name}</Text><Text style={s.role}>{emp.role}</Text></View>
        <View style={[s.statusBadge, { backgroundColor: st.c + "18" }]}><Text style={[s.statusText, { color: st.c }]}>{st.l}</Text></View>
      </View>
      <View style={s.details}>
        <View style={s.detail}><Text style={s.detailLabel}>Salario bruto</Text><Text style={s.detailValue}>{fmt(emp.salary)}</Text></View>
        <View style={s.detail}><Text style={s.detailLabel}>Admissao</Text><Text style={s.detailValue}>{emp.admDate || "---"}</Text></View>
      </View>
      <View style={s.actions}>
        <Pressable onPress={onCalc} style={s.calcBtn}><Text style={s.calcText}>Ver holerite</Text></Pressable>
        {onEdit && (
          <Pressable onPress={onEdit} style={s.editBtn}>
            <Icon name="settings" size={13} color={Colors.ink3} />
            <Text style={s.editText}>Editar</Text>
          </Pressable>
        )}
        {onDelete && (
          <Pressable onPress={onDelete} style={s.deleteBtn}>
            <Icon name="x" size={13} color={Colors.red} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  role: { fontSize: 12, color: Colors.ink3 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "600" },
  details: { flexDirection: "row", gap: 20, marginBottom: 12 },
  detail: { gap: 2 },
  detailLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  calcBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  calcText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.bg4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  editText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.red + "33", marginLeft: "auto" },
});

export default EmployeeCard;
