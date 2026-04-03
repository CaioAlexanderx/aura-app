import { useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-11: AgendaOnline — Online booking management
// Admin view: booking config + pending requests
// ============================================================

export interface BookingConfig {
  is_active: boolean;
  slug: string;
  welcome_msg: string;
  slot_duration_min: number;
  start_hour: number;
  end_hour: number;
  available_days: number[];
  require_phone: boolean;
  min_advance_hours: number;
  max_advance_days: number;
}

export interface BookingRequest {
  id: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  preferred_date: string;
  preferred_time: string;
  chief_complaint?: string;
  status: "pendente" | "confirmado" | "recusado";
  created_at: string;
}

interface Props {
  config: BookingConfig | null;
  requests: BookingRequest[];
  bookingUrl?: string;
  onToggleActive?: (active: boolean) => void;
  onUpdateConfig?: (config: Partial<BookingConfig>) => void;
  onConfirmRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  pendente:   { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Pendente" },
  confirmado: { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Confirmado" },
  recusado:   { bg: "rgba(239,68,68,0.12)",  color: "#EF4444", label: "Recusado" },
};

export function AgendaOnline({ config, requests, bookingUrl, onToggleActive, onUpdateConfig, onConfirmRequest, onRejectRequest }: Props) {
  const pending = requests.filter(r => r.status === "pendente");

  return (
    <View style={s.container}>
      {/* Status + link */}
      <View style={s.statusCard}>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: config?.is_active ? "#10B981" : "#EF4444" }]} />
          <Text style={s.statusText}>
            Agendamento online {config?.is_active ? "ativo" : "desativado"}
          </Text>
          {onToggleActive && (
            <Pressable
              onPress={() => onToggleActive(!config?.is_active)}
              style={[s.toggleBtn, config?.is_active ? { borderColor: "#EF4444" } : { borderColor: "#10B981" }]}
            >
              <Text style={[s.toggleText, config?.is_active ? { color: "#EF4444" } : { color: "#10B981" }]}>
                {config?.is_active ? "Desativar" : "Ativar"}
              </Text>
            </Pressable>
          )}
        </View>
        {bookingUrl && config?.is_active && (
          <View style={s.linkBox}>
            <Text style={s.linkLabel}>Link para pacientes:</Text>
            <Text style={s.linkUrl}>{bookingUrl}</Text>
          </View>
        )}
      </View>

      {/* Config */}
      {config && (
        <View style={s.configCard}>
          <Text style={s.title}>Configuracao</Text>
          <View style={s.configGrid}>
            <View style={s.configItem}><Text style={s.configLabel}>Duracao consulta</Text><Text style={s.configVal}>{config.slot_duration_min} min</Text></View>
            <View style={s.configItem}><Text style={s.configLabel}>Horario</Text><Text style={s.configVal}>{config.start_hour}h - {config.end_hour}h</Text></View>
            <View style={s.configItem}><Text style={s.configLabel}>Antecedencia min.</Text><Text style={s.configVal}>{config.min_advance_hours}h</Text></View>
            <View style={s.configItem}><Text style={s.configLabel}>Max dias futuro</Text><Text style={s.configVal}>{config.max_advance_days} dias</Text></View>
          </View>
          <Text style={s.configLabel}>Dias disponiveis</Text>
          <View style={s.daysRow}>
            {DAYS.map((d, i) => (
              <View key={i} style={[s.dayChip, config.available_days.includes(i) && s.dayChipActive]}>
                <Text style={[s.dayText, config.available_days.includes(i) && s.dayTextActive]}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Pending requests */}
      <View style={s.requestsSection}>
        <Text style={s.title}>Solicitacoes ({pending.length} pendentes)</Text>
        {requests.map(req => {
          const st = STATUS_MAP[req.status] || STATUS_MAP.pendente;
          return (
            <View key={req.id} style={s.reqCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.reqName}>{req.patient_name}</Text>
                <Text style={s.reqDate}>
                  {new Date(req.preferred_date).toLocaleDateString("pt-BR")} as {req.preferred_time}
                </Text>
                {req.patient_phone && <Text style={s.reqPhone}>{req.patient_phone}</Text>}
                {req.chief_complaint && <Text style={s.reqComplaint}>{req.chief_complaint}</Text>}
              </View>
              <View style={[s.reqBadge, { backgroundColor: st.bg }]}>
                <Text style={[s.reqBadgeText, { color: st.color }]}>{st.label}</Text>
              </View>
              {req.status === "pendente" && (
                <View style={s.reqActions}>
                  {onConfirmRequest && <Pressable onPress={() => onConfirmRequest(req.id)} style={[s.reqBtn, { borderColor: "#10B981" }]}><Text style={[s.reqBtnText, { color: "#10B981" }]}>Confirmar</Text></Pressable>}
                  {onRejectRequest && <Pressable onPress={() => onRejectRequest(req.id)} style={[s.reqBtn, { borderColor: "#EF4444" }]}><Text style={[s.reqBtnText, { color: "#EF4444" }]}>Recusar</Text></Pressable>}
                </View>
              )}
            </View>
          );
        })}
        {requests.length === 0 && <Text style={s.emptyText}>Nenhuma solicitacao recebida.</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  statusCard: { padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333", gap: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 0.5 },
  toggleText: { fontSize: 11, fontWeight: "600" },
  linkBox: { backgroundColor: "rgba(6,182,212,0.06)", borderRadius: 8, padding: 10, gap: 4 },
  linkLabel: { fontSize: 10, color: Colors.ink3 || "#888" },
  linkUrl: { fontSize: 12, color: "#06B6D4", fontWeight: "500", fontFamily: "monospace" },
  configCard: { padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333", gap: 10 },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" },
  configGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  configItem: { minWidth: 100, gap: 2 },
  configLabel: { fontSize: 10, color: Colors.ink3 || "#888", textTransform: "uppercase", fontWeight: "600" },
  configVal: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  daysRow: { flexDirection: "row", gap: 4, marginTop: 4 },
  dayChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.border || "#333" },
  dayChipActive: { backgroundColor: "rgba(6,182,212,0.12)", borderColor: "#06B6D4" },
  dayText: { fontSize: 11, color: Colors.ink3 || "#888" },
  dayTextActive: { color: "#06B6D4", fontWeight: "600" },
  requestsSection: { gap: 8 },
  reqCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10, backgroundColor: Colors.bg2 || "#1a1a2e",
    borderWidth: 0.5, borderColor: Colors.border || "#333",
  },
  reqName: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  reqDate: { fontSize: 12, color: "#06B6D4", marginTop: 2 },
  reqPhone: { fontSize: 11, color: Colors.ink2 || "#aaa", marginTop: 1 },
  reqComplaint: { fontSize: 11, color: Colors.ink3 || "#888", fontStyle: "italic", marginTop: 2 },
  reqBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reqBadgeText: { fontSize: 10, fontWeight: "600" },
  reqActions: { gap: 4 },
  reqBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5 },
  reqBtnText: { fontSize: 10, fontWeight: "600" },
  emptyText: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", paddingVertical: 16 },
});

export default AgendaOnline;
