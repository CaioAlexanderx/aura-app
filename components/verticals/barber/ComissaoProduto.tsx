import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-16: ComissaoProduto — Product commission per professional

export interface ProductSale { id: string; product_name: string; professional_name: string; professional_color: string; price: number; commission_pct: number; commission_amount: number; sold_at: string; }

interface Props { sales: ProductSale[]; period?: string; totalRevenue?: number; totalCommissions?: number; }

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }

export function ComissaoProduto({ sales, period, totalRevenue, totalCommissions }: Props) {
  const rev = totalRevenue ?? sales.reduce((s, p) => s + Number(p.price), 0);
  const comm = totalCommissions ?? sales.reduce((s, p) => s + Number(p.commission_amount), 0);
  // Group by professional
  const byPro: Record<string, { name: string; color: string; count: number; revenue: number; commission: number }> = {};
  for (const sale of sales) {
    if (!byPro[sale.professional_name]) byPro[sale.professional_name] = { name: sale.professional_name, color: sale.professional_color, count: 0, revenue: 0, commission: 0 };
    byPro[sale.professional_name].count++;
    byPro[sale.professional_name].revenue += Number(sale.price);
    byPro[sale.professional_name].commission += Number(sale.commission_amount);
  }

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{sales.length}</Text><Text style={s.kpiLbl}>Vendas</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(rev)}</Text><Text style={s.kpiLbl}>Receita</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#7C3AED" }]}>{fmt(comm)}</Text><Text style={s.kpiLbl}>Comissoes</Text></View>
      </View>
      <Text style={s.title}>Comissao sobre produtos{period ? " \u2014 " + period : ""}</Text>
      {/* By professional */}
      {Object.values(byPro).sort((a, b) => b.revenue - a.revenue).map(pro => (
        <View key={pro.name} style={s.proRow}>
          <View style={[s.avatar, { backgroundColor: pro.color }]}><Text style={s.avatarT}>{pro.name.charAt(0)}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.proName}>{pro.name}</Text><Text style={s.proInfo}>{pro.count} vendas | {fmt(pro.revenue)} receita</Text></View>
          <Text style={s.proComm}>{fmt(pro.commission)}</Text>
        </View>
      ))}
      {/* Recent sales */}
      {sales.length > 0 && <Text style={s.subTitle}>Vendas recentes</Text>}
      {sales.slice(0, 10).map(sale => (
        <View key={sale.id} style={s.saleRow}>
          <Text style={s.saleTime}>{new Date(sale.sold_at).toLocaleDateString("pt-BR")}</Text>
          <Text style={s.saleProd}>{sale.product_name}</Text>
          <Text style={s.salePro}>{sale.professional_name}</Text>
          <Text style={s.salePrice}>{fmt(sale.price)}</Text>
          <Text style={s.saleComm}>{fmt(sale.commission_amount)}</Text>
        </View>
      ))}
      {sales.length === 0 && <Text style={s.emptyT}>Nenhuma venda de produto com comissao registrada.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8 }, kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" }, kpiVal: { fontSize: 18, fontWeight: "700" }, kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" }, subTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff", marginTop: 4 },
  proRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, backgroundColor: Colors.bg2 || "#1a1a2e" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }, avatarT: { color: "#fff", fontSize: 12, fontWeight: "700" },
  proName: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" }, proInfo: { fontSize: 10, color: Colors.ink3 || "#888" }, proComm: { fontSize: 14, fontWeight: "600", color: "#7C3AED" },
  saleRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border || "#222" },
  saleTime: { fontSize: 10, color: Colors.ink3 || "#888", width: 60 }, saleProd: { fontSize: 12, color: Colors.ink || "#fff", flex: 1 }, salePro: { fontSize: 11, color: Colors.ink2 || "#aaa", width: 70 }, salePrice: { fontSize: 12, fontWeight: "500", color: Colors.ink || "#fff", width: 60, textAlign: "right" }, saleComm: { fontSize: 12, fontWeight: "500", color: "#7C3AED", width: 60, textAlign: "right" },
  emptyT: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", paddingVertical: 16 },
});

export default ComissaoProduto;
