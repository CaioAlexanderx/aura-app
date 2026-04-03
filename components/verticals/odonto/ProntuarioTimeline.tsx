import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-04: ProntuarioTimeline — Visual patient history
// Shows chronological timeline of appointments, procedures,
// prescriptions, and notes
// ============================================================

export type TimelineEntryType = "appointment" | "procedure" | "prescription" | "note" | "image";

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  date: string;
  title: string;
  subtitle?: string;
  professional?: string;
  status?: "concluido" | "agendado" | "cancelado" | "em_andamento";
  tooth?: number | null;
  amount?: number;
  notes?: string;
}

interface Props {
  entries: TimelineEntry[];
  patientName?: string;
  totalVisits?: number;
  totalInvested?: number;
  patientSince?: string;
  onEntryPress?: (entry: TimelineEntry) => void;
  onNewPrescription?: () => void;
  onNewAtestado?: () => void;
  onViewImages?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  concluido:    { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Concluido" },
  agendado:     { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Agendado" },
  cancelado:    { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Cancelado" },
  em_andamento: { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Em andamento" },
};

const TYPE_ICONS: Record<TimelineEntryType, string> = {
  appointment: "\uD83D\uDCC5",
  procedure: "\uD83E\uDE77",
  prescription: "\uD83D\uDCDD",
  note: "\uD83D\uDCAC",
  image: "\uD83D\uDCF7",
};

function KpiCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={[s.kpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export function ProntuarioTimeline({
  entries, patientName, totalVisits = 0, totalInvested = 0,
  patientSince, onEntryPress, onNewPrescription, onNewAtestado, onViewImages,
}: Props) {
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <View style={s.container}>
      {/* Header KPIs */}
      {patientName && (
        <View>
          <Text style={s.title}>Prontuario \u2014 {patientName}</Text>
          <View style={s.kpiRow}>
            <KpiCard value={String(totalVisits)} label="Consultas" color="#06B6D4" />
            <KpiCard value={`R$ ${totalInvested.toLocaleString("pt-BR")}`} label="Investido" color="#10B981" />
            {patientSince && <KpiCard value={patientSince} label="Paciente desde" color="#F59E0B" />}
          </View>
        </View>
      )}

      {/* Quick actions */}
      {(onNewPrescription || onNewAtestado || onViewImages) && (
        <View style={s.actionsRow}>
          {onNewPrescription && (
            <Pressable onPress={onNewPrescription} style={s.actionBtn}>
              <Text style={s.actionBtnText}>Receita</Text>
            </Pressable>
          )}
          {onNewAtestado && (
            <Pressable onPress={onNewAtestado} style={s.actionBtn}>
              <Text style={s.actionBtnText}>Atestado</Text>
            </Pressable>
          )}
          {onViewImages && (
            <Pressable onPress={onViewImages} style={s.actionBtn}>
              <Text style={s.actionBtnText}>Imagens</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Timeline */}
      <View style={s.timeline}>
        {sorted.map((entry, i) => {
          const statusInfo = entry.status ? STATUS_COLORS[entry.status] : null;
          const isFuture = entry.status === "agendado";

          return (
            <Pressable
              key={entry.id}
              onPress={() => onEntryPress?.(entry)}
              style={s.entry}
            >
              {/* Timeline line + dot */}
              <View style={s.dotCol}>
                <View style={[
                  s.dot,
                  entry.status === "concluido" && s.dotDone,
                  isFuture && s.dotFuture,
                ]} />
                {i < sorted.length - 1 && <View style={s.line} />}
              </View>

              {/* Content */}
              <View style={s.entryContent}>
                <Text style={s.entryDate}>
                  {new Date(entry.date).toLocaleDateString("pt-BR")}
                  {entry.professional ? ` \u2014 ${entry.professional}` : ""}
                </Text>
                <View style={s.entryTitleRow}>
                  <Text style={s.entryIcon}>{TYPE_ICONS[entry.type] || ""}</Text>
                  <Text style={s.entryTitle}>{entry.title}</Text>
                  {entry.tooth && <Text style={s.entryTooth}>#{entry.tooth}</Text>}
                </View>
                {entry.subtitle && <Text style={s.entrySub}>{entry.subtitle}</Text>}
                {entry.notes && <Text style={s.entryNotes}>{entry.notes}</Text>}
                {statusInfo && (
                  <View style={[s.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[s.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {sorted.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyText}>Nenhum registro no prontuario</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink || "#fff", marginBottom: 8 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: {
    flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e",
    borderRadius: 10, padding: 12, alignItems: "center",
  },
  kpiValue: { fontSize: 16, fontWeight: "700", color: Colors.ink || "#fff" },
  kpiLabel: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 0.5, borderColor: "#06B6D4",
  },
  actionBtnText: { fontSize: 12, color: "#06B6D4", fontWeight: "500" },
  timeline: { paddingLeft: 4 },
  entry: { flexDirection: "row", gap: 12, minHeight: 60 },
  dotCol: { alignItems: "center", width: 16 },
  dot: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 2,
    borderColor: "#06B6D4", backgroundColor: "transparent",
  },
  dotDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
  dotFuture: { borderColor: "#06B6D4", borderStyle: "dashed" },
  line: { width: 1, flex: 1, backgroundColor: Colors.border || "#333", marginVertical: 2 },
  entryContent: { flex: 1, paddingBottom: 16, gap: 3 },
  entryDate: { fontSize: 11, color: Colors.ink3 || "#888" },
  entryTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  entryIcon: { fontSize: 12 },
  entryTitle: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 },
  entryTooth: { fontSize: 11, color: "#06B6D4", fontWeight: "600" },
  entrySub: { fontSize: 12, color: Colors.ink2 || "#aaa" },
  entryNotes: { fontSize: 11, color: Colors.ink3 || "#888", fontStyle: "italic" },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: "600" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default ProntuarioTimeline;
