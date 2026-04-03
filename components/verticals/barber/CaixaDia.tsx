import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// B-04: CaixaDia — Daily cash register
// Open/close, movements timeline, sangria/suprimento
// ============================================================

export interface CashMovement {
  id: string;
  type: "venda" | "sangria" | "suprimento" | "gorjeta" | "produto" | "ajuste";
  amount: number;
  payment_method?: string;
  description?: string;
  professional_name?: string;
  created_at: string;
}

export interface CashRegister {
  id: string;
  status: "open" | "closed";
  opening_amount: number;
  closing_amount?: number;
  expected_amount?: number;
  difference?: number;
  opened_at: string;
  closed_at?: string;
  opened_by_name?: string;
  current_balance?: number;
}

interface Props {
  register: CashRegister | null;
  movements: CashMovement[];
  summary?: { sales: number; tips: number; products: number; sangria: number; suprimento: number };
  onOpenCash?: (amount: number) => void;
  onCloseCash?: (amount: number) => void;
  onSangria?: () => void;
  onSuprimento?: () => void;
}

const TYPE_MAP: Record<string, { bg: string; color: string; label: string; sign: "+" | "-" }> = {
  venda:      { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Venda",     sign: "+" },
  gorjeta:    { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Gorjeta",   sign: "+" },
  produto:    { bg: "rgba(124,58,237,0.12)",  color: "#7C3AED", label: "Produto",   sign: "+" },
  suprimento: { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Suprimento",sign: "+" },
  sangria:    { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Sangria",   sign: "-" },
  ajuste:     { bg: "rgba(156,163,175,0.12)",  color: "#9CA3AF", label: "Ajuste",    sign: "+" },
};

const PAY_MAP: Record<string, { bg: string; color: string; label: string }> = {
  pix:      { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Pix" },
  cartao:   { bg: "rgba(124,58,237,0.12)",  color: "#7C3AED", label: "Cartao" },
  dinheiro: { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", label: "Dinheiro" },
  debito:   { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", label: "Debito" },
};

function fmt(v: number): string {
  return "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CaixaDia({ register, movements, summary, onOpenCash, onCloseCash, onSangria, onSuprimento }: Props) {
  const isOpen = register?.status === "open";
  const totalIn = (summary?.sales || 0) + (summary?.tips || 0) + (summary?.products || 0) + (summary?.suprimento || 0);
  const totalOut = summary?.sangria || 0;
  const balance = (register?.opening_amount || 0) + totalIn - totalOut;

  return (
    <View style={s.container}>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(totalIn)}</Text><Text style={s.kpiLbl}>Entradas</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#EF4444" }]}>{fmt(totalOut)}</Text><Text style={s.kpiLbl}>Saidas</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{fmt(summary?.tips || 0)}</Text><Text style={s.kpiLbl}>Gorjetas</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { fontWeight: "700" }]}>{fmt(balance)}</Text><Text style={s.kpiLbl}>Saldo</Text></View>
      </View>

      {/* Status + actions */}
      <View style={s.header}>
        <Text style={s.title}>Caixa do dia</Text>
        {isOpen ? (
          <View style={s.headerBtns}>
            {onCloseCash && <Pressable onPress={() => onCloseCash(balance)} style={s.btnFill}><Text style={s.btnFillText}>Fechar caixa</Text></Pressable>}
            {onSangria && <Pressable onPress={onSangria} style={s.btnOut}><Text style={s.btnOutText}>Sangria</Text></Pressable>}
            {onSuprimento && <Pressable onPress={onSuprimento} style={s.btnOut}><Text style={s.btnOutText}>Suprimento</Text></Pressable>}
          </View>
        ) : (
          onOpenCash && <Pressable onPress={() => onOpenCash(0)} style={s.btnFill}><Text style={s.btnFillText}>Abrir caixa</Text></Pressable>
        )}
      </View>

      {/* Movements timeline */}
      {movements.length > 0 && (
        <View style={s.movList}>
          <Text style={s.movHeader}>Ultimas movimentacoes</Text>
          {movements.slice(0, 20).map(m => {
            const typeInfo = TYPE_MAP[m.type] || TYPE_MAP.ajuste;
            const payInfo = m.payment_method ? (PAY_MAP[m.payment_method] || PAY_MAP.dinheiro) : null;
            const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

            return (
              <View key={m.id} style={s.movRow}>
                <Text style={s.movTime}>{time}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.movDesc}>{m.description || typeInfo.label}</Text>
                  {m.professional_name && <Text style={s.movPro}>{m.professional_name}</Text>}
                </View>
                {payInfo && (
                  <View style={[s.badge, { backgroundColor: payInfo.bg }]}>
                    <Text style={[s.badgeText, { color: payInfo.color }]}>{payInfo.label}</Text>
                  </View>
                )}
                <Text style={[s.movAmount, { color: typeInfo.sign === "+" ? "#10B981" : "#EF4444" }]}>
                  {typeInfo.sign}{fmt(m.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {!isOpen && movements.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyText}>Caixa fechado. Abra para registrar movimentacoes.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 16, fontWeight: "600", color: Colors.ink || "#fff" },
  kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" },
  headerBtns: { flexDirection: "row", gap: 6 },
  btnFill: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnFillText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  btnOut: { borderWidth: 0.5, borderColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btnOutText: { fontSize: 12, color: "#F59E0B", fontWeight: "500" },
  movList: { gap: 0 },
  movHeader: { fontSize: 11, color: Colors.ink3 || "#888", marginBottom: 6 },
  movRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, borderBottomWidth: 0.5,
    borderBottomColor: Colors.border || "#222",
  },
  movTime: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: "600", width: 40 },
  movDesc: { fontSize: 13, fontWeight: "500", color: Colors.ink || "#fff" },
  movPro: { fontSize: 11, color: Colors.ink3 || "#888" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: "600" },
  movAmount: { fontSize: 13, fontWeight: "600", minWidth: 70, textAlign: "right" },
  empty: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default CaixaDia;
