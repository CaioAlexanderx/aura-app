import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// D-17: TissGuide — TISS/GTO guide management

export interface TissGuide { id: string; guide_number: string; guide_type: string; status: string; patient_name: string; insurance_name: string; procedures: { tuss_code: string; description: string; tooth?: string; value: number }[]; total_value: number; authorized_value?: number; denied_reason?: string; sent_at?: string; authorized_at?: string; created_at: string; }
export interface TissStats { status: string; count: number; total: number; }

interface Props { guides: TissGuide[]; stats: TissStats[]; onCreateGuide?: () => void; onSendGuide?: (id: string) => void; onUpdateStatus?: (id: string, status: string) => void; onExportPdf?: (id: string) => void; }

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }

const ST: Record<string, { bg: string; color: string; label: string }> = {
  rascunho: { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Rascunho" },
  enviada: { bg: "rgba(6,182,212,0.12)", color: "#06B6D4", label: "Enviada" },
  autorizada: { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Autorizada" },
  parcial: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Parcial" },
  negada: { bg: "rgba(239,68,68,0.12)", color: "#EF4444", label: "Negada" },
  executada: { bg: "rgba(124,58,237,0.12)", color: "#7C3AED", label: "Executada" },
  glosada: { bg: "rgba(239,68,68,0.12)", color: "#EF4444", label: "Glosada" },
};

export function TissGuideManager({ guides, stats, onCreateGuide, onSendGuide, onUpdateStatus, onExportPdf }: Props) {
  const totalValue = stats.reduce((s, st) => s + Number(st.total), 0);
  const authorized = stats.find(s => s.status === "autorizada");
  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        {stats.slice(0, 4).map(st => { const stl = ST[st.status] || ST.rascunho; return (
          <View key={st.status} style={s.kpi}><Text style={[s.kpiVal, { color: stl.color }]}>{st.count}</Text><Text style={s.kpiLbl}>{stl.label}</Text><Text style={s.kpiSub}>{fmt(Number(st.total))}</Text></View>
        ); })}
      </View>
      <View style={s.header}><Text style={s.title}>Guias TISS / GTO</Text>{onCreateGuide && <Pressable onPress={onCreateGuide} style={s.addBtn}><Text style={s.addBtnT}>+ Nova guia</Text></Pressable>}</View>
      {guides.map(g => { const st = ST[g.status] || ST.rascunho; return (
        <View key={g.id} style={s.card}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={s.cardTop}><Text style={s.guideNum}>{g.guide_number}</Text><View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeT, { color: st.color }]}>{st.label}</Text></View></View>
            <Text style={s.patient}>{g.patient_name}</Text>
            <Text style={s.insurance}>{g.insurance_name} | {g.procedures.length} procedimentos</Text>
            {g.denied_reason && <Text style={s.denied}>Motivo: {g.denied_reason}</Text>}
          </View>
          <View style={s.cardRight}>
            <Text style={s.total}>{fmt(g.total_value)}</Text>
            {g.authorized_value != null && <Text style={s.authorized}>Autoriz: {fmt(g.authorized_value)}</Text>}
            <View style={s.actions}>
              {g.status === "rascunho" && onSendGuide && <Pressable onPress={() => onSendGuide(g.id)} style={s.actBtn}><Text style={s.actBtnT}>Enviar</Text></Pressable>}
              {onExportPdf && <Pressable onPress={() => onExportPdf(g.id)} style={s.actBtn}><Text style={s.actBtnT}>PDF</Text></Pressable>}
            </View>
          </View>
        </View>
      ); })}
      {guides.length === 0 && <Text style={s.emptyT}>Nenhuma guia TISS criada.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  kpi: { flex: 1, minWidth: 80, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border, gap: 2 },
  kpiVal: { fontSize: 20, fontWeight: "800" }, kpiLbl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase" }, kpiSub: { fontSize: 10, color: Colors.ink3 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  addBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  card: { flexDirection: "row", padding: 14, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 }, guideNum: { fontSize: 13, fontWeight: "700", color: "#06B6D4", fontFamily: "monospace" },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, badgeT: { fontSize: 9, fontWeight: "600" },
  patient: { fontSize: 14, fontWeight: "600", color: Colors.ink }, insurance: { fontSize: 11, color: Colors.ink3 }, denied: { fontSize: 10, color: "#EF4444" },
  cardRight: { alignItems: "flex-end", gap: 4 }, total: { fontSize: 16, fontWeight: "700", color: Colors.ink }, authorized: { fontSize: 11, color: "#10B981" },
  actions: { flexDirection: "row", gap: 4 }, actBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 0.5, borderColor: "#06B6D4" }, actBtnT: { fontSize: 9, fontWeight: "600", color: "#06B6D4" },
  emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
});

export default TissGuideManager;
