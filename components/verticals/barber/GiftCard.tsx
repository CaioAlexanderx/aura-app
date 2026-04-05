import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { useState } from "react";
import { Colors } from "@/constants/colors";

// B-11: GiftCard — Gift card management

export interface GiftCardData { id: string; code: string; initial_amount: number; balance: number; buyer_name?: string; recipient_name?: string; message?: string; expires_at?: string; status: string; created_at: string; }

interface Props { giftCards: GiftCardData[]; onCreateCard?: () => void; onRedeemCard?: (code: string, amount: number) => void; }

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }

const ST: Record<string, { bg: string; color: string; label: string }> = {
  ativo: { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Ativo" },
  usado: { bg: "rgba(156,163,175,0.12)", color: "#9CA3AF", label: "Usado" },
  expirado: { bg: "rgba(239,68,68,0.12)", color: "#EF4444", label: "Expirado" },
};

export function GiftCard({ giftCards, onCreateCard, onRedeemCard }: Props) {
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemAmount, setRedeemAmount] = useState("");
  const active = giftCards.filter(g => g.status === "ativo");
  const totalBalance = active.reduce((s, g) => s + Number(g.balance), 0);
  const totalSold = giftCards.reduce((s, g) => s + Number(g.initial_amount), 0);

  return (
    <View style={s.container}>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#F59E0B" }]}>{active.length}</Text><Text style={s.kpiLbl}>Ativos</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#10B981" }]}>{fmt(totalBalance)}</Text><Text style={s.kpiLbl}>Saldo total</Text></View>
        <View style={s.kpi}><Text style={[s.kpiVal, { color: "#06B6D4" }]}>{fmt(totalSold)}</Text><Text style={s.kpiLbl}>Vendidos</Text></View>
      </View>
      <View style={s.header}><Text style={s.title}>Vale-presente</Text>{onCreateCard && <Pressable onPress={onCreateCard} style={s.addBtn}><Text style={s.addBtnT}>+ Criar gift card</Text></Pressable>}</View>
      {/* Redeem section */}
      {onRedeemCard && (
        <View style={s.redeemBox}>
          <TextInput value={redeemCode} onChangeText={setRedeemCode} placeholder="Codigo (ex: AURA-A1B2C3D4)" placeholderTextColor={Colors.ink3 || "#888"} style={s.redeemInput} />
          <TextInput value={redeemAmount} onChangeText={setRedeemAmount} placeholder="Valor" placeholderTextColor={Colors.ink3 || "#888"} keyboardType="numeric" style={[s.redeemInput, { width: 80 }]} />
          <Pressable onPress={() => { if (redeemCode && redeemAmount) onRedeemCard(redeemCode, parseFloat(redeemAmount)); }} style={s.redeemBtn}><Text style={s.redeemBtnT}>Resgatar</Text></Pressable>
        </View>
      )}
      {/* Cards list */}
      {giftCards.map(gc => {
        const st = ST[gc.status] || ST.ativo;
        const pctUsed = gc.initial_amount > 0 ? Math.round((1 - gc.balance / gc.initial_amount) * 100) : 0;
        return (
          <View key={gc.id} style={s.card}>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={s.codeRow}><Text style={s.code}>{gc.code}</Text><View style={[s.statusBadge, { backgroundColor: st.bg }]}><Text style={[s.statusText, { color: st.color }]}>{st.label}</Text></View></View>
              {gc.recipient_name && <Text style={s.recipient}>Para: {gc.recipient_name}</Text>}
              {gc.buyer_name && <Text style={s.buyer}>De: {gc.buyer_name}</Text>}
              {gc.message && <Text style={s.message}>"{gc.message}"</Text>}
            </View>
            <View style={s.balCol}>
              <Text style={s.balance}>{fmt(gc.balance)}</Text>
              <Text style={s.initial}>de {fmt(gc.initial_amount)}</Text>
              <View style={s.bar}><View style={[s.barFill, { width: (100 - pctUsed) + "%" }]} /></View>
            </View>
          </View>
        );
      })}
      {giftCards.length === 0 && <View style={s.empty}><Text style={s.emptyT}>Nenhum gift card criado.</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, kpiRow: { flexDirection: "row", gap: 8 }, kpi: { flex: 1, backgroundColor: Colors.bg2 || "#1a1a2e", borderRadius: 10, padding: 10, alignItems: "center" }, kpiVal: { fontSize: 18, fontWeight: "700" }, kpiLbl: { fontSize: 9, color: Colors.ink3 || "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" }, addBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }, addBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  redeemBox: { flexDirection: "row", gap: 6, padding: 10, borderRadius: 10, backgroundColor: "rgba(245,158,11,0.06)", borderWidth: 0.5, borderColor: "rgba(245,158,11,0.2)" },
  redeemInput: { flex: 1, backgroundColor: Colors.bg4 || "#222", borderRadius: 8, padding: 10, fontSize: 13, color: Colors.ink || "#fff" },
  redeemBtn: { backgroundColor: "#F59E0B", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" }, redeemBtnT: { color: "#fff", fontSize: 12, fontWeight: "600" },
  card: { flexDirection: "row", padding: 12, borderRadius: 10, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333", gap: 10 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 6 }, code: { fontSize: 14, fontWeight: "700", color: "#F59E0B", fontFamily: "monospace" },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }, statusText: { fontSize: 9, fontWeight: "600" },
  recipient: { fontSize: 12, color: Colors.ink || "#fff" }, buyer: { fontSize: 11, color: Colors.ink3 || "#888" }, message: { fontSize: 11, color: Colors.ink2 || "#aaa", fontStyle: "italic" },
  balCol: { alignItems: "flex-end", gap: 2 }, balance: { fontSize: 16, fontWeight: "700", color: "#10B981" }, initial: { fontSize: 10, color: Colors.ink3 || "#888" },
  bar: { width: 50, height: 3, borderRadius: 2, backgroundColor: Colors.bg4 || "#333" }, barFill: { height: 3, borderRadius: 2, backgroundColor: "#10B981" },
  empty: { alignItems: "center", paddingVertical: 24 }, emptyT: { fontSize: 13, color: Colors.ink3 || "#888" },
});

export default GiftCard;
