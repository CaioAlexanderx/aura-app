import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// D-16: ConvenioManager — Dental insurance + TUSS codes

export interface Insurance { id: string; name: string; registration?: string; ans_code?: string; contact_phone?: string; default_discount_pct: number; payment_deadline_days: number; is_active: boolean; procedures_count: number; }
export interface TussCode { code: string; description: string; specialty: string; default_price: number; }
export interface InsuranceProcedure { id: string; tuss_code: string; tuss_description?: string; covered_price: number; requires_auth: boolean; }

interface Props { insurances: Insurance[]; tussSearch?: TussCode[]; selectedInsurance?: Insurance; procedures?: InsuranceProcedure[]; onAddInsurance?: () => void; onSelectInsurance?: (id: string) => void; onAddProcedure?: (insId: string) => void; onSearchTuss?: (term: string) => void; }

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }

export function ConvenioManager({ insurances, selectedInsurance, procedures = [], onAddInsurance, onSelectInsurance, onAddProcedure }: Props) {
  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.title}>Conv\u00eanios ({insurances.length})</Text>{onAddInsurance && <Pressable onPress={onAddInsurance} style={s.addBtn}><Text style={s.addBtnT}>+ Cadastrar conv\u00eanio</Text></Pressable>}</View>
      <View style={s.listRow}>
        {insurances.map(ins => (
          <Pressable key={ins.id} onPress={() => onSelectInsurance?.(ins.id)} style={[s.insCard, selectedInsurance?.id === ins.id && s.insCardActive]}>
            <Text style={s.insName}>{ins.name}</Text>
            {ins.ans_code && <Text style={s.insAns}>ANS: {ins.ans_code}</Text>}
            <Text style={s.insInfo}>{ins.procedures_count} procedimentos | Prazo: {ins.payment_deadline_days}d</Text>
            <View style={[s.statusDot, { backgroundColor: ins.is_active ? "#10B981" : "#EF4444" }]} />
          </Pressable>
        ))}
      </View>
      {selectedInsurance && (
        <View style={s.procSection}>
          <View style={s.procHeader}><Text style={s.procTitle}>Tabela: {selectedInsurance.name}</Text>{onAddProcedure && <Pressable onPress={() => onAddProcedure(selectedInsurance.id)} style={s.addProcBtn}><Text style={s.addProcBtnT}>+ Procedimento</Text></Pressable>}</View>
          <View style={s.tableH}><Text style={[s.th, { width: 80 }]}>TUSS</Text><Text style={[s.th, { flex: 1 }]}>Descricao</Text><Text style={[s.th, { width: 80 }]}>Valor</Text><Text style={[s.th, { width: 50 }]}>Autoriz.</Text></View>
          {procedures.map(p => (
            <View key={p.id} style={s.tr}>
              <Text style={[s.td, { width: 80, fontFamily: "monospace" }]}>{p.tuss_code}</Text>
              <Text style={[s.td, { flex: 1 }]}>{p.tuss_description || p.tuss_code}</Text>
              <Text style={[s.td, { width: 80, textAlign: "right", fontWeight: "600" }]}>{fmt(p.covered_price)}</Text>
              <Text style={[s.td, { width: 50, textAlign: "center" }]}>{p.requires_auth ? "Sim" : "Nao"}</Text>
            </View>
          ))}
          {procedures.length === 0 && <Text style={s.emptyT}>Nenhum procedimento cadastrado neste conv\u00eanio.</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  addBtn: { backgroundColor: "#06B6D4", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  listRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  insCard: { minWidth: 180, padding: 14, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 4, position: "relative" },
  insCardActive: { borderColor: "#06B6D4", backgroundColor: "rgba(6,182,212,0.06)" },
  insName: { fontSize: 14, fontWeight: "700", color: Colors.ink }, insAns: { fontSize: 10, color: "#06B6D4", fontFamily: "monospace" },
  insInfo: { fontSize: 10, color: Colors.ink3 }, statusDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  procSection: { gap: 8 }, procHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  procTitle: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  addProcBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5, borderColor: "#06B6D4" }, addProcBtnT: { fontSize: 10, color: "#06B6D4", fontWeight: "600" },
  tableH: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 6 },
  th: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", fontWeight: "600" },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 6, alignItems: "center" },
  td: { fontSize: 12, color: Colors.ink }, emptyT: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
});

export default ConvenioManager;
