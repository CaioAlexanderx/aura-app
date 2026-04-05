import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-14: RecorrenciaCliente — Fixed weekly/recurring appointments

const DAYS = ["Domingo","Segunda","Terca","Quarta","Quinta","Sexta","Sabado"];

export interface RecurringAppointment { id: string; customer_name: string; professional_name?: string; professional_color?: string; service_name?: string; day_of_week: number; time_slot: string; is_active: boolean; }

interface Props { recurring: RecurringAppointment[]; onAdd?: () => void; onRemove?: (recId: string) => void; }

export function RecorrenciaCliente({ recurring, onAdd, onRemove }: Props) {
  const grouped = DAYS.map((day, i) => ({ day, items: recurring.filter(r => r.day_of_week === i) })).filter(g => g.items.length > 0);
  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.title}>Clientes fixos ({recurring.length})</Text>{onAdd && <Pressable onPress={onAdd} style={s.addBtn}><Text style={s.addBtnT}>+ Adicionar</Text></Pressable>}</View>
      {grouped.map(g => (
        <View key={g.day} style={s.daySection}>
          <Text style={s.dayTitle}>{g.day}</Text>
          {g.items.map(r => (
            <View key={r.id} style={s.row}>
              <View style={[s.dot, { backgroundColor: r.professional_color || "#F59E0B" }]} />
              <Text style={s.time}>{r.time_slot}</Text>
              <View style={{ flex: 1 }}><Text style={s.name}>{r.customer_name}</Text>{r.service_name && <Text style={s.svc}>{r.service_name}</Text>}</View>
              <Text style={s.pro}>{r.professional_name || ""}</Text>
              {onRemove && <Pressable onPress={() => onRemove(r.id)} style={s.removeBtn}><Text style={s.removeT}>\u00D7</Text></Pressable>}
            </View>
          ))}
        </View>
      ))}
      {recurring.length === 0 && <View style={s.empty}><Text style={s.emptyT}>Nenhum cliente fixo configurado. Adicione recorrencias para preencher automaticamente a agenda.</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" },
  addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  daySection: { gap: 4 }, dayTitle: { fontSize: 13, fontWeight: "600", color: "#F59E0B" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, backgroundColor: Colors.bg2 || "#1a1a2e" },
  dot: { width: 8, height: 8, borderRadius: 4 }, time: { fontSize: 12, fontWeight: "600", color: Colors.ink || "#fff", width: 45 },
  name: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" }, svc: { fontSize: 10, color: Colors.ink3 || "#888" }, pro: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  removeBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 0.5, borderColor: "#EF4444", alignItems: "center", justifyContent: "center" }, removeT: { fontSize: 14, color: "#EF4444" },
  empty: { alignItems: "center", paddingVertical: 24 }, emptyT: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", maxWidth: 280 },
});

export default RecorrenciaCliente;
