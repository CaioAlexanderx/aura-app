import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { DemoBanner } from "@/components/DemoBanner";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { useVerticalSections } from "@/hooks/useVerticalSections";
import { VerticalContextBar } from "@/components/VerticalContextBar";
import { VerticalEmptyState } from "@/components/VerticalEmptyState";

const TABS = ["Agenda", "Horários", "Configurações"];
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

type Appointment = {
  id: string;
  client: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: "confirmed" | "pending" | "done" | "cancelled";
  employee?: string;
  price: number;
};

const MOCK_APPOINTMENTS: Appointment[] = [
  { id: "1", client: "Marcos Oliveira", service: "Corte Masculino", date: "01/04/2026", time: "09:00", duration: 30, status: "confirmed", employee: "Carlos Silva", price: 45 },
  { id: "2", client: "Fernanda Lima", service: "Corte + Barba", date: "01/04/2026", time: "09:30", duration: 60, status: "confirmed", employee: "Carlos Silva", price: 65 },
  { id: "3", client: "Ana Beatriz", service: "Hidratação Capilar", date: "01/04/2026", time: "10:00", duration: 45, status: "pending", employee: "Ana Costa", price: 55 },
  { id: "4", client: "Ricardo Santos", service: "Barba Completa", date: "01/04/2026", time: "11:00", duration: 30, status: "done", employee: "Carlos Silva", price: 30 },
  { id: "5", client: "Juliana Pereira", service: "Corte Feminino", date: "01/04/2026", time: "14:00", duration: 60, status: "pending", employee: "Julia Santos", price: 80 },
  { id: "6", client: "Pedro Costa", service: "Corte Masculino", date: "02/04/2026", time: "08:00", duration: 30, status: "confirmed", employee: "Carlos Silva", price: 45 },
  { id: "7", client: "Camila Rodrigues", service: "Corte + Hidratação", date: "02/04/2026", time: "10:00", duration: 90, status: "confirmed", employee: "Ana Costa", price: 100 },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Confirmado", color: Colors.green, bg: Colors.greenD },
  pending: { label: "Pendente", color: Colors.amber, bg: Colors.amberD },
  done: { label: "Concluído", color: Colors.violet3, bg: Colors.violetD },
  cancelled: { label: "Cancelado", color: Colors.red, bg: Colors.redD },
};

const WORK_HOURS = {
  start: "08:00",
  end: "19:00",
  interval: 30,
  daysOff: [0], // domingo
};

function AppointmentCard({ apt, onConfirm, onCancel }: { apt: Appointment; onConfirm: () => void; onCancel: () => void }) {
  const st = STATUS_MAP[apt.status];
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  return (
    <Pressable
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[ac.card, hovered && ac.cardHover, isWeb && { transition: "all 0.2s ease" } as any]}
    >
      <View style={ac.top}>
        <View style={ac.timeWrap}>
          <Text style={ac.time}>{apt.time}</Text>
          <Text style={ac.dur}>{apt.duration}min</Text>
        </View>
        <View style={ac.info}>
          <Text style={ac.client}>{apt.client}</Text>
          <Text style={ac.service}>{apt.service}</Text>
          {apt.employee && <Text style={ac.emp}>{apt.employee}</Text>}
        </View>
        <View style={ac.right}>
          <View style={[ac.badge, { backgroundColor: st.bg }]}>
            <Text style={[ac.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
          <Text style={ac.price}>{fmt(apt.price)}</Text>
        </View>
      </View>
      {apt.status === "pending" && (
        <View style={ac.actions}>
          <Pressable onPress={onConfirm} style={ac.confirmBtn}>
            <Icon name="check" size={12} color="#fff" />
            <Text style={ac.confirmText}>Confirmar</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={ac.cancelBtn}>
            <Text style={ac.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
const ac = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  cardHover: { borderColor: Colors.violet2, transform: [{ translateY: -2 }] },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timeWrap: { alignItems: "center", gap: 2, minWidth: 50 },
  time: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  dur: { fontSize: 10, color: Colors.ink3 },
  info: { flex: 1, gap: 2 },
  client: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  service: { fontSize: 12, color: Colors.ink3 },
  emp: { fontSize: 11, color: Colors.violet3, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  price: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  confirmBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.green, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  confirmText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { fontSize: 12, color: Colors.red, fontWeight: "500" },
});

function DayView({ appointments }: { appointments: Appointment[] }) {
  const today = appointments.filter(a => a.date === "01/04/2026");
  const totalRevenue = today.filter(a => a.status !== "cancelled").reduce((s, a) => s + a.price, 0);
  const confirmed = today.filter(a => a.status === "confirmed").length;
  const pending = today.filter(a => a.status === "pending").length;

  return (
    <View>
      <View style={dv.kpis}>
        <View style={dv.kpi}><Text style={dv.kv}>{today.length}</Text><Text style={dv.kl}>Agendamentos</Text></View>
        <View style={dv.kpi}><Text style={[dv.kv, { color: Colors.green }]}>{confirmed}</Text><Text style={dv.kl}>Confirmados</Text></View>
        <View style={dv.kpi}><Text style={[dv.kv, { color: Colors.amber }]}>{pending}</Text><Text style={dv.kl}>Pendentes</Text></View>
        <View style={dv.kpi}><Text style={[dv.kv, { color: Colors.green }]}>{fmt(totalRevenue)}</Text><Text style={dv.kl}>Receita estimada</Text></View>
      </View>
      <Text style={dv.dayTitle}>Hoje — 01/04/2026</Text>
      {today.map(apt => (
        <AppointmentCard
          key={apt.id}
          apt={apt}
          onConfirm={() => toast.success(apt.client + " confirmado!")}
          onCancel={() => toast.error("Agendamento cancelado")}
        />
      ))}
      <Text style={[dv.dayTitle, { marginTop: 20 }]}>Amanhã — 02/04/2026</Text>
      {appointments.filter(a => a.date === "02/04/2026").map(apt => (
        <AppointmentCard
          key={apt.id}
          apt={apt}
          onConfirm={() => toast.success(apt.client + " confirmado!")}
          onCancel={() => toast.error("Agendamento cancelado")}
        />
      ))}
    </View>
  );
}
const dv = StyleSheet.create({
  kpis: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: IS_WIDE ? 120 : "45%", backgroundColor: Colors.bg3, borderRadius: 14, padding: IS_WIDE ? 16 : 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kv: { fontSize: IS_WIDE ? 20 : 16, fontWeight: "700", color: Colors.ink },
  kl: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  dayTitle: { fontSize: 14, fontWeight: "600", color: Colors.ink, marginBottom: 10 },
});

function TimeSlots() {
  const [selectedDay, setSelectedDay] = useState(0);
  return (
    <View>
      <Text style={ts.title}>Horários disponíveis</Text>
      <Text style={ts.sub}>Selecione o dia para ver os horários livres</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        <VerticalContextBar />
        {DAYS.map((d, i) => (
          <Pressable key={d} onPress={() => setSelectedDay(i)} style={[ts.dayChip, selectedDay === i && ts.dayChipActive]}>
            <Text style={[ts.dayText, selectedDay === i && ts.dayTextActive]}>{d}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {selectedDay === 6 ? (
        <View style={ts.offDay}><Icon name="calendar" size={24} color={Colors.ink3} /><Text style={ts.offText}>Domingo — sem atendimento</Text></View>
      ) : (
        <View style={ts.grid}>
          {HOURS.map(h => {
            const busy = Math.random() > 0.5;
            return (
              <Pressable key={h} onPress={() => !busy && toast.success("Horário " + h + " selecionado!")} style={[ts.slot, busy && ts.slotBusy]}>
                <Text style={[ts.slotText, busy && ts.slotTextBusy]}>{h}</Text>
                <Text style={[ts.slotLabel, busy && { color: Colors.red }]}>{busy ? "Ocupado" : "Livre"}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
const ts = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  sub: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  dayChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  dayChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  dayText: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  dayTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: { width: IS_WIDE ? "15%" : "28%", backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 2 },
  slotBusy: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  slotText: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  slotTextBusy: { color: Colors.red },
  slotLabel: { fontSize: 10, color: Colors.green, fontWeight: "500" },
  offDay: { alignItems: "center", paddingVertical: 40, gap: 8 },
  offText: { fontSize: 13, color: Colors.ink3 },
});

function ScheduleConfig() {
  return (
    <View>
      <HoverCard style={cfg.card}>
        <Text style={cfg.title}>Horário de funcionamento</Text>
        <View style={cfg.row}><Text style={cfg.label}>Abertura</Text><Text style={cfg.value}>{WORK_HOURS.start}</Text></View>
        <View style={cfg.row}><Text style={cfg.label}>Fechamento</Text><Text style={cfg.value}>{WORK_HOURS.end}</Text></View>
        <View style={cfg.row}><Text style={cfg.label}>Intervalo mínimo</Text><Text style={cfg.value}>{WORK_HOURS.interval} min</Text></View>
        <View style={cfg.row}><Text style={cfg.label}>Dia de folga</Text><Text style={cfg.value}>Domingo</Text></View>
      </HoverCard>
      <HoverCard style={cfg.card}>
        <Text style={cfg.title}>Notificações</Text>
        <View style={cfg.row}><Text style={cfg.label}>Lembrete para o cliente</Text><Text style={[cfg.value, { color: Colors.green }]}>Ativo — 24h antes</Text></View>
        <View style={cfg.row}><Text style={cfg.label}>Confirmação automática</Text><Text style={[cfg.value, { color: Colors.green }]}>Ativo via WhatsApp</Text></View>
        <View style={cfg.row}><Text style={cfg.label}>Aviso de cancelamento</Text><Text style={[cfg.value, { color: Colors.green }]}>Ativo</Text></View>
      </HoverCard>
      <HoverCard style={cfg.card}>
        <Text style={cfg.title}>Serviços disponíveis para agendamento</Text>
        <View style={cfg.services}>
          {["Corte Masculino (30min)", "Corte + Barba (60min)", "Hidratação (45min)", "Barba Completa (30min)", "Corte Feminino (60min)"].map(s => (
            <View key={s} style={cfg.serviceRow}><View style={cfg.dot} /><Text style={cfg.serviceText}>{s}</Text></View>
          ))}
        </View>
      </HoverCard>
    </View>
  );
}
const cfg = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: 13, color: Colors.ink3 },
  value: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  services: { gap: 8 },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.violet },
  serviceText: { fontSize: 13, color: Colors.ink },
});

export default function AgendamentoScreen() {

  // CONN-23: Fetch real appointments
  const { company, token, isDemo } = useAuthStore();
  const { data: apiAppointments } = useQuery({
    queryKey: ["appointments", company?.id],
    queryFn: () => request(`/companies/${company!.id}/barbershop/appointments`),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1,
    staleTime: 15000,
  });
  const [tab, setTab] = useState(0);

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="Agendamento" />
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {tab === 0 && <DayView appointments={MOCK_APPOINTMENTS} />}
      {tab === 1 && <TimeSlots />}
      {tab === 2 && <ScheduleConfig />}
      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
});
