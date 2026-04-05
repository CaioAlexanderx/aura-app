import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// D-19: Periograma — Periodontal probing chart

const TEETH_UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const TEETH_LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

export interface PerioChart {
  id: string; exam_date: string; measurements: Record<string, { buccal: number[]; lingual: number[]; recession: number[]; mobility: number; furcation: number; bleeding: boolean[] }>;
  bleeding_sites: number; total_sites: number; bleeding_index: number; plaque_index: number; diagnosis?: string; notes?: string;
}

interface Props { charts: PerioChart[]; patientName?: string; onAddExam?: () => void; onViewChart?: (chartId: string) => void; }

function depthColor(d: number): string { if (d <= 3) return "#10B981"; if (d <= 5) return "#F59E0B"; return "#EF4444"; }

export function Periograma({ charts, patientName, onAddExam, onViewChart }: Props) {
  const latest = charts[0];

  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.title}>Periograma{patientName ? " \u2014 " + patientName : ""}</Text>{onAddExam && <Pressable onPress={onAddExam} style={s.addBtn}><Text style={s.addBtnT}>+ Novo exame</Text></Pressable>}</View>
      {latest && (
        <View style={s.latestCard}>
          <View style={s.kpiRow}>
            <View style={s.kpi}><Text style={[s.kpiVal, { color: latest.bleeding_index > 20 ? "#EF4444" : "#10B981" }]}>{latest.bleeding_index}%</Text><Text style={s.kpiLbl}>Sangramento</Text></View>
            <View style={s.kpi}><Text style={[s.kpiVal, { color: latest.plaque_index > 30 ? "#F59E0B" : "#10B981" }]}>{latest.plaque_index}%</Text><Text style={s.kpiLbl}>Placa</Text></View>
            <View style={s.kpi}><Text style={s.kpiVal}>{latest.bleeding_sites}/{latest.total_sites}</Text><Text style={s.kpiLbl}>Sites sangrantes</Text></View>
            <View style={s.kpi}><Text style={[s.kpiVal, { fontSize: 12 }]}>{new Date(latest.exam_date).toLocaleDateString("pt-BR")}</Text><Text style={s.kpiLbl}>Data exame</Text></View>
          </View>
          {latest.diagnosis && <Text style={s.diagnosis}>Diagnostico: {latest.diagnosis}</Text>}
          {/* Mini tooth grid */}
          <Text style={s.gridLabel}>Arcada superior (vestibular)</Text>
          <View style={s.toothRow}>
            {TEETH_UPPER.map(t => {
              const key = `tooth_${t}`;
              const data = latest.measurements[key];
              const maxDepth = data ? Math.max(...data.buccal) : 0;
              return (
                <View key={t} style={s.toothCell}>
                  <Text style={s.toothNum}>{t}</Text>
                  {data ? (
                    <View style={s.depthRow}>{data.buccal.map((d, i) => <View key={i} style={[s.depthDot, { backgroundColor: depthColor(d) }]}><Text style={s.depthVal}>{d}</Text></View>)}</View>
                  ) : <Text style={s.noData}>-</Text>}
                </View>
              );
            })}
          </View>
          <View style={s.divider} />
          <Text style={s.gridLabel}>Arcada inferior (vestibular)</Text>
          <View style={s.toothRow}>
            {TEETH_LOWER.map(t => {
              const key = `tooth_${t}`;
              const data = latest.measurements[key];
              return (
                <View key={t} style={s.toothCell}>
                  <Text style={s.toothNum}>{t}</Text>
                  {data ? (
                    <View style={s.depthRow}>{data.buccal.map((d, i) => <View key={i} style={[s.depthDot, { backgroundColor: depthColor(d) }]}><Text style={s.depthVal}>{d}</Text></View>)}</View>
                  ) : <Text style={s.noData}>-</Text>}
                </View>
              );
            })}
          </View>
          <View style={s.legend}>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: "#10B981" }]} /><Text style={s.legendT}>1-3mm (normal)</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: "#F59E0B" }]} /><Text style={s.legendT}>4-5mm (moderado)</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: "#EF4444" }]} /><Text style={s.legendT}>6mm+ (severo)</Text></View>
          </View>
        </View>
      )}
      {/* History */}
      {charts.length > 1 && (<View style={s.history}><Text style={s.histTitle}>Historico ({charts.length} exames)</Text>
        {charts.slice(1).map(c => (
          <Pressable key={c.id} onPress={() => onViewChart?.(c.id)} style={s.histRow}>
            <Text style={s.histDate}>{new Date(c.exam_date).toLocaleDateString("pt-BR")}</Text>
            <Text style={s.histBi}>Sangr: {c.bleeding_index}%</Text>
            <Text style={s.histPi}>Placa: {c.plaque_index}%</Text>
          </Pressable>
        ))}
      </View>)}
      {charts.length === 0 && <Text style={s.emptyT}>Nenhum periograma registrado.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  addBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  latestCard: { padding: 16, borderRadius: 14, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8 }, kpi: { flex: 1, alignItems: "center", gap: 2 },
  kpiVal: { fontSize: 18, fontWeight: "800", color: Colors.ink }, kpiLbl: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase" },
  diagnosis: { fontSize: 12, color: "#06B6D4", fontWeight: "500" },
  gridLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  toothRow: { flexDirection: "row", gap: 1, justifyContent: "center", flexWrap: "wrap" },
  toothCell: { alignItems: "center", width: 28, gap: 1 }, toothNum: { fontSize: 8, color: Colors.ink3, fontWeight: "600" },
  depthRow: { flexDirection: "row", gap: 1 }, depthDot: { width: 8, height: 8, borderRadius: 2, alignItems: "center", justifyContent: "center" }, depthVal: { fontSize: 6, color: "#fff", fontWeight: "700" },
  noData: { fontSize: 8, color: Colors.ink3 }, divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  legend: { flexDirection: "row", gap: 12, justifyContent: "center" }, legendItem: { flexDirection: "row", alignItems: "center", gap: 4 }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendT: { fontSize: 9, color: Colors.ink3 },
  history: { gap: 4 }, histTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  histRow: { flexDirection: "row", gap: 12, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  histDate: { fontSize: 12, color: Colors.ink, fontWeight: "500", width: 70 }, histBi: { fontSize: 11, color: Colors.ink3 }, histPi: { fontSize: 11, color: Colors.ink3 },
  emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 20 },
});

export default Periograma;
