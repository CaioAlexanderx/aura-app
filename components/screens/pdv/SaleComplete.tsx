import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import type { SaleResult } from "@/hooks/useCart";
import { PAYMENTS } from "@/hooks/useCart";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function SaleComplete({ sale, onNewSale, onEmitNfe }: { sale: SaleResult; onNewSale: () => void; onEmitNfe: () => void }) {
  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.checkCircle}><Text style={s.checkIcon}>OK</Text></View>
        <Text style={s.title}>Venda registrada!</Text>
        <Text style={s.saleId}>#{sale.id}</Text>
        <View style={s.row}><Text style={s.label}>Total</Text><Text style={s.value}>{fmt(sale.total)}</Text></View>
        <View style={s.row}><Text style={s.label}>Pagamento</Text><Text style={s.meta}>{PAYMENTS.find(p => p.key === sale.payment)?.label}</Text></View>
        <View style={s.row}><Text style={s.label}>Itens</Text><Text style={s.meta}>{sale.items.reduce((s, i) => s + i.qty, 0)} produtos</Text></View>
        <View style={s.divider} />
        <View style={s.actions}>
          <Pressable onPress={onEmitNfe} style={s.secondaryBtn}><Text style={s.secondaryText}>Emitir NF-e</Text></Pressable>
          <Pressable onPress={onNewSale} style={s.primaryBtn}><Text style={s.primaryText}>Nova venda</Text></Pressable>
        </View>
        <View style={s.links}>
          <Pressable><Text style={s.linkText}>Imprimir cupom</Text></Pressable>
          <Pressable><Text style={s.linkText}>Enviar por WhatsApp</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, maxWidth: 420, width: "100%" },
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2, borderColor: Colors.green },
  checkIcon: { fontSize: 20, color: Colors.green, fontWeight: "800" },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  saleId: { fontSize: 12, color: Colors.ink3, marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8 },
  label: { fontSize: 13, color: Colors.ink3 },
  value: { fontSize: 18, color: Colors.green, fontWeight: "800" },
  meta: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  divider: { height: 1, backgroundColor: Colors.border, width: "100%", marginVertical: 16 },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  secondaryBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  secondaryText: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  primaryBtn: { flex: 1, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  primaryText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  links: { flexDirection: "row", gap: 16, marginTop: 16 },
  linkText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
});

export default SaleComplete;
