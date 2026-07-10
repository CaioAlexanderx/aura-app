// ============================================================
// AURA. — components/screens/pdv/SaleComplete.tsx
//
// 25/05/2026 — Refatorado: bloco de emissão NFC-e extraído pra
// <NfceActions/> (componente reutilizado também no Step5Success da
// Troca). Zero mudança de UX — mesma tela, mesmos botoes.
// ============================================================
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { toast } from "@/components/Toast";
import type { SaleResult } from "@/hooks/useCart";
import { PAYMENTS } from "@/hooks/useCart";
import { NfceActions, type NfceActionsItem } from "./NfceActions";
import { openPrintWindow } from "@/services/printWindow";
import type { NfcePaymentEntry } from "@/services/nfceApi";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function paymentLabel(key: string): string {
  return PAYMENTS.find(p => p.key === key)?.label || key;
}

function openPrintReceipt(companyId: string, saleId: string, token: string | null) {
  if (!token || !companyId) { toast.error("Sessao expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Impressao disponivel apenas na versao web");
    return;
  }
  // Fix 10/07 (relato Davi): janela abre SINCRONA no clique (printWindow) —
  // window.open depois do await perdia a user activation e o Chrome
  // bloqueava o pop-up de forma intermitente ("nem sempre imprime").
  openPrintWindow(async () => {
    const res = await fetch(`${BASE_URL}/companies/${companyId}/print/receipt/${saleId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false as const, error: "Erro ao gerar cupom" };
    return { ok: true as const, html: await res.text() };
  }).then((r) => {
    if (r === "blocked") toast.error("Pop-up bloqueado. Permita pop-ups para imprimir.");
  });
}

type Props = {
  sale: SaleResult;
  onNewSale: () => void;
  /** Se true, dispara nfceApi.emit() automaticamente no mount.
      Lido de nfce_config.auto_emit_nfce pela tela do PDV. */
  autoEmit?: boolean;
};

export function SaleComplete({ sale, onNewSale, autoEmit }: Props) {
  const { company, token } = useAuthStore();
  const subtotal = sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const hasCoupon = !!(sale.couponCode && sale.couponDiscount && sale.couponDiscount > 0);

  const hasSplit = !!(sale.payments && sale.payments.length > 0);
  const payments: NfcePaymentEntry[] | undefined = hasSplit
    ? sale.payments!.map(p => ({ method: p.method, value: p.value, change: p.change }))
    : undefined;

  const nfceItems: NfceActionsItem[] = sale.items.map(i => ({
    product_id: i.productId,
    product_name: i.name,
    quantity: i.qty,
    unit_price: i.price,
  }));

  function handlePrint() {
    if (!company?.id) return;
    openPrintReceipt(company.id, sale.id, token);
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.checkCircle}><Text style={s.checkIcon}>OK</Text></View>
        <Text style={s.title}>Venda registrada!</Text>
        <Text style={s.saleId}>#{sale.id}</Text>

        {hasCoupon && (
          <View style={s.couponRow}>
            <View style={s.couponBadge}>
              <Text style={s.couponBadgeText}>{sale.couponCode}</Text>
            </View>
            <Text style={s.couponDiscount}>-{fmt(sale.couponDiscount!)}</Text>
          </View>
        )}

        {hasCoupon && (
          <View style={s.row}>
            <Text style={s.label}>Subtotal</Text>
            <Text style={s.metaStrike}>{fmt(subtotal)}</Text>
          </View>
        )}
        <View style={s.row}>
          <Text style={s.label}>Total</Text>
          <Text style={s.value}>{fmt(sale.total)}</Text>
        </View>
        {hasSplit ? (
          <View style={s.splitBox}>
            <Text style={s.splitTitle}>Pagamentos ({payments!.length})</Text>
            {payments!.map((p, i) => (
              <View key={i} style={s.splitLine}>
                <Text style={s.splitMethod}>{paymentLabel(p.method)}</Text>
                <Text style={s.splitValue}>{fmt(p.value)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.row}>
            <Text style={s.label}>Pagamento</Text>
            <Text style={s.meta}>{paymentLabel(sale.payment)}</Text>
          </View>
        )}
        <View style={s.row}>
          <Text style={s.label}>Itens</Text>
          <Text style={s.meta}>{sale.items.reduce((s, i) => s + i.qty, 0)} produtos</Text>
        </View>
        {sale.customerName && (
          <View style={s.row}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.meta}>{sale.customerName}</Text>
          </View>
        )}
        {sale.cpfNaNota && (
          <View style={s.row}>
            <Text style={s.label}>CPF na nota</Text>
            <Text style={s.meta}>{sale.cpfNaNota}</Text>
          </View>
        )}
        {sale.employeeName && (
          <View style={s.row}>
            <Text style={s.label}>Vendedor</Text>
            <Text style={s.meta}>{sale.employeeName}</Text>
          </View>
        )}

        <View style={s.divider} />

        {company?.id && (
          <NfceActions
            companyId={company.id}
            saleId={sale.id}
            items={nfceItems}
            total={sale.total}
            customerName={sale.customerName}
            customerCpf={sale.cpfNaNota}
            customerPhone={sale.customerPhone}
            paymentMethod={sale.payment}
            payments={payments}
            autoEmit={autoEmit}
          />
        )}

        <View style={[s.actions, { marginTop: 14 }]}>
          <Pressable onPress={handlePrint} style={s.secondaryBtn}>
            <Text style={s.secondaryText}>Imprimir cupom</Text>
          </Pressable>
          <Pressable onPress={onNewSale} style={s.primaryBtn}>
            <Text style={s.primaryText}>Nova venda</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, maxWidth: 460, width: "100%" },
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2, borderColor: Colors.green },
  checkIcon: { fontSize: 20, color: Colors.green, fontWeight: "800" },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  saleId: { fontSize: 12, color: Colors.ink3, marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8 },
  label: { fontSize: 13, color: Colors.ink3 },
  value: { fontSize: 18, color: Colors.green, fontWeight: "800" },
  meta: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  metaStrike: { fontSize: 13, color: Colors.ink3, fontWeight: "500", textDecorationLine: "line-through" },
  couponRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.greenD, borderRadius: 10, padding: 10, width: "100%", marginBottom: 8, borderWidth: 1, borderColor: Colors.green + "33" },
  couponBadge: { backgroundColor: Colors.green + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  couponBadgeText: { fontSize: 11, color: Colors.green, fontWeight: "800", letterSpacing: 1 },
  couponDiscount: { fontSize: 14, color: Colors.green, fontWeight: "700", flex: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: Colors.border, width: "100%", marginVertical: 16 },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  secondaryBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  primaryBtn: { flex: 1, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  primaryText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  splitBox: { width: "100%", paddingVertical: 8, gap: 4 },
  splitTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  splitLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  splitMethod: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  splitValue: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
});

export default SaleComplete;
