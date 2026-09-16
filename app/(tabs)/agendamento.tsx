import { useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { HoverCard } from "@/components/HoverCard";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAppointments } from "@/hooks/useAppointments";
import { ScreenHero, ScreenTabs, type ScreenTabItem } from "@/components/ScreenHero";
import { SummaryCard } from "@/components/SummaryCard";

const TABS: ScreenTabItem[] = [
  { key: "0", label: "Agenda" },
  { key: "1", label: "Horários" },
  { key: "2", label: "Configurações" },
];
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  agendado: { label: "Agendado", color: Colors.amber, bg: Colors.amberD },
  confirmado: { label: "Confirmado", color: Colors.green, bg: Colors.greenD },
  pendente: { label: "Pendente", color: Colors.amber, bg: Colors.amberD },
  concluido: { label: "Concluido", color: Colors.violet3, bg: Colors.violetD },
  cancelado: { label: "Cancelado", color: Colors.red, bg: Colors.redD },
  confirmed: { label: "Confirmado", color: Colors.green, bg: Colors.greenD },
  pending: { label: "Pendente", color: Colors.amber, bg: Colors.amberD },
  done: { label: "Concluido", color: Colors.violet3, bg: Colors.violetD },
  cancelled: { label: "Cancelado", color: Colors.red, bg: Colors.redD },
};

const WORK_HOURS = { start: "08:00", end: "19:00", interval: 30, daysOff: [0] };

function AppointmentCard({ apt, onConfirm, onCancel }: { apt: any; onConfirm: () => void; onCancel: () => void }) {
  const st = STATUS_MAP[apt.status] || STATUS_MAP.pendente;
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const time = apt.scheduled_at ? new Date(apt.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : apt.time || '--:--';
  const clientName = apt.client_name || apt.customer_name || apt.client || 'Cliente';
  const amount = parseFloat(apt.total_amount) || apt.price || 0;
  return (
    <Pressable onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[ac.card, hovered && ac.cardHover, isWeb && { transition: "all 0.2s ease" } as any]}>
      <View style={ac.top}>
        <View style={ac.timeWrap}><Text style={ac.time}>{time}</Text><Text style={ac.dur}>{apt.duration_min || apt.duration || 30}min</Text></View>
        <View style={ac.info}>
          <Text style={ac.client}>{clientName}</Text>
          {apt.professional_name && <Text style={ac.emp}>{apt.professional_name}</Text>}
          {apt.notes && <Text style={ac.service}>{apt.notes}</Text>}
        </View>
        <View style={ac.right}>
          <View style={[ac.badge, { backgroundColor: st.bg }]}><Text style={[ac.badgeText, { color: st.color }]}>{st.label}</Text></View>
          <Text style={ac.price}>{fmt(amount)}</Text>
        </View>
      </View>
      {(apt.status === 'pendente' || apt.status === 'agendado' || apt.status === 'pending') && (
        <View style={ac.actions}>
          <Pressable onPress={onConfirm} style={ac.confirmBtn}><Icon name="check" size={12} color="#fff" /><Text style={ac.confirmText}>Confirmar</Text></Pressable>
          <Pressable onPress={onCancel} style={ac.cancelBtn}><Text style={ac.cancelText}>Cancelar</Text></Pressable>
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

function DayView({ appointments, onConfirm, onCancel }: { appointments: any[]; onConfirm: (id: string) => void; onCancel: (id: string) => void }) {
  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of appointments) {
      const d = a.scheduled_at ? new Date(a.scheduled_at).toLocaleDateString('pt-BR') : 'Sem data';
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  return (
    <View>
      {grouped.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
          <View style={dv.emptyIcon}><Icon name="calendar" size={22} color={Colors.ink3} /></View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.ink }}>Nenhum agendamento</Text>
          <Text style={{ fontSize: 12, color: Colors.ink3 }}>Os agendamentos aparecerão aqui quando forem criados.</Text>
        </View>
      )}
      {grouped.map(([date, apts]) => (
        <View key={date}>
          <Text style={dv.dayTitle}>{date}</Text>
          {apts.map((apt: any) => (
            <AppointmentCard key={apt.id} apt={apt}
              onConfirm={() => onConfirm(apt.id)}
              onCancel={() => onCancel(apt.id)} />
          ))}
        </View>
      ))}
    </View>
  );
}
const dv = StyleSheet.create({
  // I1.3 — os quatro contadores (Agendamentos/Confirmados/Pendentes/Receita)
  // saíram daqui: viraram a faixa de indicadores padrão (SummaryCard) no
  // cabeçalho, visível em toda a tela, não só na aba Agenda.
  dayTitle: { fontSize: 14, fontWeight: "600", color: Colors.ink, marginBottom: 10, marginTop: 16 },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center",
  },
});

function TimeSlots() {
  const [selectedDay, setSelectedDay] = useState(0);
  return (
    <View>
      <Text style={ts.title}>Horários disponíveis</Text>
      <Text style={ts.sub}>Selecione o dia para ver os horários livres</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {DAYS.map((d, i) => <Pressable key={d} onPress={() => setSelectedDay(i)} style={[ts.dayChip, selectedDay === i && ts.dayChipActive]}><Text style={[ts.dayText, selectedDay === i && ts.dayTextActive]}>{d}</Text></Pressable>)}
      </ScrollView>
      {selectedDay === 6 ? (
        <View style={ts.offDay}><Icon name="calendar" size={24} color={Colors.ink3} /><Text style={ts.offText}>Domingo - sem atendimento</Text></View>
      ) : (
        <View style={ts.grid}>
          {HOURS.map(h => {
            const busy = Math.random() > 0.5;
            return <Pressable key={h} onPress={() => !busy && toast.success("Horário " + h + " selecionado!")} style={[ts.slot, busy && ts.slotBusy]}><Text style={[ts.slotText, busy && ts.slotTextBusy]}>{h}</Text><Text style={[ts.slotLabel, busy && { color: Colors.red }]}>{busy ? "Ocupado" : "Livre"}</Text></Pressable>;
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
        <View style={cfg.row}><Text style={cfg.label}>Lembrete para o cliente</Text><Text style={[cfg.value, { color: Colors.green }]}>Ativo - 24h antes</Text></View>
        <View style={cfg.row}><Text style={cfg.label}>Confirmação automática</Text><Text style={[cfg.value, { color: Colors.green }]}>Ativo via WhatsApp</Text></View>
        <View style={cfg.row}><Text style={cfg.label}>Aviso de cancelamento</Text><Text style={[cfg.value, { color: Colors.green }]}>Ativo</Text></View>
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
});

export default function AgendamentoScreen() {
  const [tab, setTab] = useState(0);
  const { appointments, kpis, isLoading, updateAppointment, cancelAppointment } = useAppointments();

  async function handleConfirm(id: string) {
    try { await updateAppointment(id, { status: 'confirmado' }); } catch {}
  }
  async function handleCancel(id: string) {
    try { await cancelAppointment(id); } catch {}
  }

  // I1.3 — subtítulo com os números, igual ao resto do padrão editorial.
  const heroSub = isLoading
    ? "Carregando a agenda…"
    : `${kpis.total} ${kpis.total === 1 ? "agendamento" : "agendamentos"} nos próximos dias · ${kpis.confirmed} confirmados · ${kpis.pending} pendentes`;

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      {/* I1.3 — mesmo cabeçalho editorial (ScreenHero) das outras telas do
          padrão; era um PageHeader simples sem sobrancelha nem serifa. */}
      <ScreenHero eyebrow="Equipe · horários" title="Agenda" subtitle={heroSub} />

      {/* Faixa de indicadores padrão: os quatro contadores que antes
          viviam soltos dentro da aba Agenda, agora visíveis em toda a
          tela (mesmo SummaryCard que /estoque usa). */}
      <View style={z.kpis}>
        <SummaryCard label="AGENDAMENTOS" value={String(kpis.total)} />
        <SummaryCard label="CONFIRMADOS" value={String(kpis.confirmed)} color={Colors.green} />
        <SummaryCard label="PENDENTES" value={String(kpis.pending)} color={Colors.amber} />
        <SummaryCard label="RECEITA ESTIMADA" value={fmt(kpis.revenue)} color={Colors.green} />
      </View>

      <ScreenTabs tabs={TABS} active={String(tab)} onSelect={(k) => setTab(Number(k))} />
      {tab === 0 && <DayView appointments={appointments} onConfirm={handleConfirm} onCancel={handleCancel} />}
      {tab === 1 && <TimeSlots />}
      {tab === 2 && <ScheduleConfig />}
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
});
