import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-12: AgendaOnlineBarber — Booking config + pending requests

export interface BarberBookingConfig { is_active: boolean; slug: string; welcome_msg: string; start_hour: number; end_hour: number; available_days: number[]; allow_professional_choice: boolean; deposit_required: boolean; deposit_amount: number; }
export interface BarberBookingRequest { id: string; customer_name: string; customer_phone?: string; service_name?: string; professional_id?: string; preferred_date: string; preferred_time: string; status: string; created_at: string; }

interface Props { config: BarberBookingConfig | null; requests: BarberBookingRequest[]; bookingUrl?: string; onToggle?: (active: boolean) => void; onConfirm?: (reqId: string) => void; onReject?: (reqId: string) => void; }

const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];

export function AgendaOnlineBarber({ config, requests, bookingUrl, onToggle, onConfirm, onReject }: Props) {
  const pending = requests.filter(r => r.status === "pendente");
  return (
    <View style={s.container}>
      <View style={s.statusCard}>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: config?.is_active ? "#10B981" : "#EF4444" }]} />
          <Text style={s.statusText}>Agendamento online {config?.is_active ? "ativo" : "desativado"}</Text>
          {onToggle && <Pressable onPress={() => onToggle(!config?.is_active)} style={[s.toggleBtn, { borderColor: config?.is_active ? "#EF4444" : "#10B981" }]}><Text style={[s.toggleText, { color: config?.is_active ? "#EF4444" : "#10B981" }]}>{config?.is_active ? "Desativar" : "Ativar"}</Text></Pressable>}
        </View>
        {bookingUrl && config?.is_active && <View style={s.linkBox}><Text style={s.linkLabel}>Link para clientes:</Text><Text style={s.linkUrl}>{bookingUrl}</Text></View>}
        {config && (
          <View style={s.configGrid}>
            <Text style={s.configItem}>Horario: {config.start_hour}h - {config.end_hour}h</Text>
            <Text style={s.configItem}>Escolher profissional: {config.allow_professional_choice ? "Sim" : "Nao"}</Text>
            {config.deposit_required && <Text style={s.configItem}>Deposito: R$ {config.deposit_amount}</Text>}
          </View>
        )}
        {config && <View style={s.daysRow}>{DAYS.map((d, i) => <View key={i} style={[s.dayChip, config.available_days.includes(i) && s.dayActive]}><Text style={[s.dayText, config.available_days.includes(i) && s.dayActiveText]}>{d}</Text></View>)}</View>}
      </View>
      <Text style={s.title}>Solicitacoes ({pending.length} pendentes)</Text>
      {requests.map(req => (
        <View key={req.id} style={[s.reqCard, req.status === "pendente" && { borderLeftWidth: 3, borderLeftColor: "#F59E0B" }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.reqName}>{req.customer_name}</Text>
            <Text style={s.reqDate}>{new Date(req.preferred_date).toLocaleDateString("pt-BR")} as {req.preferred_time}</Text>
            {req.service_name && <Text style={s.reqSvc}>{req.service_name}</Text>}
          </View>
          {req.status === "pendente" && (
            <View style={s.reqActions}>
              {onConfirm && <Pressable onPress={() => onConfirm(req.id)} style={[s.reqBtn, { borderColor: "#10B981" }]}><Text style={[s.reqBtnT, { color: "#10B981" }]}>Confirmar</Text></Pressable>}
              {onReject && <Pressable onPress={() => onReject(req.id)} style={[s.reqBtn, { borderColor: "#EF4444" }]}><Text style={[s.reqBtnT, { color: "#EF4444" }]}>Recusar</Text></Pressable>}
            </View>
          )}
        </View>
      ))}
      {requests.length === 0 && <Text style={s.emptyT}>Nenhuma solicitacao recebida.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, statusCard: { padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333", gap: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 }, dot: { width: 10, height: 10, borderRadius: 5 }, statusText: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 0.5 }, toggleText: { fontSize: 11, fontWeight: "600" },
  linkBox: { backgroundColor: "rgba(245,158,11,0.06)", borderRadius: 8, padding: 10, gap: 4 }, linkLabel: { fontSize: 10, color: Colors.ink3 || "#888" }, linkUrl: { fontSize: 12, color: "#F59E0B", fontWeight: "500", fontFamily: "monospace" },
  configGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, configItem: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  daysRow: { flexDirection: "row", gap: 4 }, dayChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.border || "#333" }, dayActive: { backgroundColor: "rgba(245,158,11,0.12)", borderColor: "#F59E0B" }, dayText: { fontSize: 11, color: Colors.ink3 || "#888" }, dayActiveText: { color: "#F59E0B", fontWeight: "600" },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" },
  reqCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333" },
  reqName: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" }, reqDate: { fontSize: 12, color: "#F59E0B", marginTop: 2 }, reqSvc: { fontSize: 11, color: Colors.ink2 || "#aaa" },
  reqActions: { gap: 4 }, reqBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5 }, reqBtnT: { fontSize: 10, fontWeight: "600" },
  emptyT: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", paddingVertical: 16 },
});

export default AgendaOnlineBarber;
