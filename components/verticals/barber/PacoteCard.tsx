import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// B-09: PacoteCard — Service packages with sessions tracking

export interface Package { id: string; name: string; description?: string; services: { service_name: string; quantity: number }[]; total_sessions: number; price: number; original_price?: number; validity_days: number; is_active: boolean; sold_count: number; }
export interface PackagePurchase { id: string; package_id: string; customer_name?: string; sessions_used: number; sessions_total: number; amount_paid: number; purchased_at: string; expires_at?: string; status: string; }

interface Props { packages: Package[]; purchases?: PackagePurchase[]; onCreatePackage?: () => void; onSellPackage?: (pkgId: string) => void; onUseSession?: (purchaseId: string) => void; }

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); }

export function PacoteCard({ packages, purchases = [], onCreatePackage, onSellPackage, onUseSession }: Props) {
  const activePurchases = purchases.filter(p => p.status === "ativo");
  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{packages.filter(p => p.is_active).length}</Text><Text style={s.kpiLbl}>Pacotes ativos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{activePurchases.length}</Text><Text style={s.kpiLbl}>Vendidos ativos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{fmt(purchases.reduce((s, p) => s + Number(p.amount_paid), 0))}</Text><Text style={s.kpiLbl}>Receita pacotes</Text></View>
      </View>
      <View style={s.header}><Text style={s.title}>Pacotes de servico</Text>{onCreatePackage && <Pressable onPress={onCreatePackage} style={s.addBtn}><Text style={s.addBtnT}>+ Criar pacote</Text></Pressable>}</View>
      {packages.map(pkg => {
        const discount = pkg.original_price ? Math.round((1 - pkg.price / pkg.original_price) * 100) : 0;
        return (
          <View key={pkg.id} style={s.card}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={s.nameRow}><Text style={s.name}>{pkg.name}</Text>{discount > 0 && <View style={s.discBadge}><Text style={s.discText}>-{discount}%</Text></View>}</View>
              {pkg.description && <Text style={s.desc}>{pkg.description}</Text>}
              <Text style={s.sessions}>{pkg.total_sessions} sessoes | Validade: {pkg.validity_days} dias</Text>
              <View style={s.svcList}>{(pkg.services || []).map((sv, i) => <Text key={i} style={s.svcItem}>{sv.quantity}x {sv.service_name}</Text>)}</View>
            </View>
            <View style={s.priceCol}>
              {pkg.original_price && <Text style={s.oldPrice}>{fmt(pkg.original_price)}</Text>}
              <Text style={s.price}>{fmt(pkg.price)}</Text>
              <Text style={s.sold}>{pkg.sold_count} vendidos</Text>
              {onSellPackage && <Pressable onPress={() => onSellPackage(pkg.id)} style={s.sellBtn}><Text style={s.sellBtnT}>Vender</Text></Pressable>}
            </View>
          </View>
        );
      })}
      {activePurchases.length > 0 && (
        <View style={s.purchasesSection}>
          <Text style={s.subTitle}>Pacotes vendidos ativos</Text>
          {activePurchases.map(p => (
            <View key={p.id} style={s.purchaseRow}>
              <View style={{ flex: 1 }}><Text style={s.purchaseName}>{p.customer_name || "Cliente"}</Text><Text style={s.purchaseInfo}>{p.sessions_used}/{p.sessions_total} sessoes usadas</Text></View>
              <View style={s.progressBar}><View style={[s.progressFill, { width: (p.sessions_used / p.sessions_total * 100) + "%" }]} /></View>
              {onUseSession && <Pressable onPress={() => onUseSession(p.id)} style={s.useBtn}><Text style={s.useBtnT}>Usar</Text></Pressable>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8 }, kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" }, kpiVal: { fontSize: 18, fontWeight: "700" }, kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" }, addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  card: { flexDirection: "row", padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333", gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" }, discBadge: { backgroundColor: "rgba(16,185,129,0.12)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, discText: { fontSize: 10, fontWeight: "600", color: "#10B981" },
  desc: { fontSize: 12, color: Colors.ink2 || "#aaa" }, sessions: { fontSize: 11, color: Colors.ink3 || "#888" }, svcList: { gap: 2 }, svcItem: { fontSize: 11, color: "#F59E0B" },
  priceCol: { alignItems: "flex-end", gap: 4 }, oldPrice: { fontSize: 12, color: Colors.ink3 || "#888", textDecorationLine: "line-through" }, price: { fontSize: 18, fontWeight: "700", color: "#F59E0B" }, sold: { fontSize: 10, color: Colors.ink3 || "#888" },
  sellBtn: { backgroundColor: "#F59E0B", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 }, sellBtnT: { color: "#fff", fontSize: 11, fontWeight: "600" },
  purchasesSection: { gap: 6, marginTop: 4 }, subTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" },
  purchaseRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, backgroundColor: Colors.bg2 || "#1a1a2e" },
  purchaseName: { fontSize: 13, fontWeight: "600", color: Colors.ink || "#fff" }, purchaseInfo: { fontSize: 11, color: Colors.ink3 || "#888" },
  progressBar: { width: 60, height: 4, borderRadius: 2, backgroundColor: Colors.bg4 || "#333" }, progressFill: { height: 4, borderRadius: 2, backgroundColor: "#F59E0B" },
  useBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 0.5, borderColor: "#10B981" }, useBtnT: { fontSize: 10, fontWeight: "600", color: "#10B981" },
});

export default PacoteCard;
