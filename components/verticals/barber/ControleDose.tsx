import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-20: ControleDose — Fractional stock control (ml, g, dose)

export interface StockUsage { id: string; product_name: string; professional_name?: string; quantity_used: number; unit: string; used_at: string; notes?: string; }
export interface FractionProduct { id: string; name: string; stock_fraction: number; fraction_unit: string; total_used: number; }

interface Props { usage: StockUsage[]; products: FractionProduct[]; onRegisterUsage?: () => void; }

export function ControleDose({ usage, products, onRegisterUsage }: Props) {
  const lowStock = products.filter(p => p.stock_fraction < 100 && p.fraction_unit);
  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{products.length}</Text><Text style={s.kpiLbl}>Produtos fracionados</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{lowStock.length}</Text><Text style={s.kpiLbl}>Estoque baixo</Text></View>
      </View>
      <View style={s.header}><Text style={s.title}>Controle por dose/grama</Text>{onRegisterUsage && <Pressable onPress={onRegisterUsage} style={s.addBtn}><Text style={s.addBtnT}>+ Registrar uso</Text></Pressable>}</View>
      <Text style={s.subTitle}>Estoque fracionado</Text>
      {products.map(p => {
        const pct = p.stock_fraction > 0 ? Math.min(100, p.stock_fraction / (p.total_used + p.stock_fraction) * 100) : 0;
        const isLow = p.stock_fraction < 100;
        return (
          <View key={p.id} style={s.prodRow}>
            <View style={{ flex: 1, gap: 2 }}><Text style={s.prodName}>{p.name}</Text><Text style={s.prodInfo}>Estoque: {p.stock_fraction} {p.fraction_unit} | Usado total: {p.total_used} {p.fraction_unit}</Text></View>
            <View style={s.barCol}><View style={s.bar}><View style={[s.barFill, { width: pct + "%", backgroundColor: isLow ? "#EF4444" : "#10B981" }]} /></View>{isLow && <Text style={s.lowText}>Baixo</Text>}</View>
          </View>
        );
      })}
      {usage.length > 0 && <Text style={s.subTitle}>Uso recente</Text>}
      {usage.slice(0, 10).map(u => (
        <View key={u.id} style={s.usageRow}>
          <Text style={s.usageDate}>{new Date(u.used_at).toLocaleDateString("pt-BR")}</Text>
          <Text style={s.usageProd}>{u.product_name}</Text>
          <Text style={s.usagePro}>{u.professional_name || ""}</Text>
          <Text style={s.usageQty}>{u.quantity_used} {u.unit}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border, gap: 2 },
  kpiVal: { fontSize: 18, fontWeight: "800" }, kpiLbl: { fontSize: 8, color: Colors.ink3, textTransform: "uppercase" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  subTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  prodRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, backgroundColor: Colors.bg3 },
  prodName: { fontSize: 13, fontWeight: "600", color: Colors.ink }, prodInfo: { fontSize: 10, color: Colors.ink3 },
  barCol: { alignItems: "flex-end", gap: 2 }, bar: { width: 60, height: 4, borderRadius: 2, backgroundColor: Colors.bg4 }, barFill: { height: 4, borderRadius: 2 }, lowText: { fontSize: 8, color: "#EF4444", fontWeight: "600" },
  usageRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  usageDate: { fontSize: 10, color: Colors.ink3, width: 55 }, usageProd: { fontSize: 12, color: Colors.ink, flex: 1 }, usagePro: { fontSize: 11, color: Colors.ink3, width: 70 }, usageQty: { fontSize: 12, fontWeight: "600", color: "#F59E0B", width: 60, textAlign: "right" },
});

export default ControleDose;
