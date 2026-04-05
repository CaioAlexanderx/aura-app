import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-15: EstoqueInterno — Service materials / internal stock consumption

export interface ServiceMaterial { service_id: string; service_name: string; product_id: string; product_name: string; quantity_per_use: number; unit: string; current_stock: number; auto_debit: boolean; }

interface Props { materials: ServiceMaterial[]; onLink?: () => void; onUnlink?: (serviceId: string, productId: string) => void; }

export function EstoqueInterno({ materials, onLink, onUnlink }: Props) {
  const lowStock = materials.filter(m => m.current_stock < m.quantity_per_use * 5);
  const byService = materials.reduce((acc, m) => { if (!acc[m.service_name]) acc[m.service_name] = []; acc[m.service_name].push(m); return acc; }, {} as Record<string, ServiceMaterial[]>);

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{materials.length}</Text><Text style={s.kpiLbl}>Vinculos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{lowStock.length}</Text><Text style={s.kpiLbl}>Estoque baixo</Text></View>
      </View>
      <View style={s.header}><Text style={s.title}>Consumo por servico</Text>{onLink && <Pressable onPress={onLink} style={s.addBtn}><Text style={s.addBtnT}>+ Vincular</Text></Pressable>}</View>
      {Object.entries(byService).map(([svcName, mats]) => (
        <View key={svcName} style={s.svcSection}>
          <Text style={s.svcName}>{svcName}</Text>
          {mats.map(m => {
            const isLow = m.current_stock < m.quantity_per_use * 5;
            return (
              <View key={m.product_id} style={s.matRow}>
                <View style={{ flex: 1 }}><Text style={s.prodName}>{m.product_name}</Text><Text style={s.matInfo}>{m.quantity_per_use} {m.unit}/uso | Estoque: {m.current_stock} {m.unit}{m.auto_debit ? " | Auto-debito" : ""}</Text></View>
                {isLow && <View style={s.lowBadge}><Text style={s.lowText}>Baixo</Text></View>}
              </View>
            );
          })}
        </View>
      ))}
      {materials.length === 0 && <View style={s.empty}><Text style={s.emptyT}>Nenhum material vinculado a servicos. Vincule produtos para debito automatico do estoque.</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8 }, kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" }, kpiVal: { fontSize: 18, fontWeight: "700" }, kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" }, addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  svcSection: { gap: 4 }, svcName: { fontSize: 13, fontWeight: "600", color: "#F59E0B" },
  matRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, backgroundColor: Colors.bg2 || "#1a1a2e" },
  prodName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" }, matInfo: { fontSize: 10, color: Colors.ink3 || "#888", marginTop: 2 },
  lowBadge: { backgroundColor: "rgba(239,68,68,0.12)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }, lowText: { fontSize: 9, fontWeight: "600", color: "#EF4444" },
  empty: { alignItems: "center", paddingVertical: 24 }, emptyT: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", maxWidth: 280 },
});

export default EstoqueInterno;
