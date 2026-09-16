// ============================================================
// HistoricoComprasModal — Aura · Clientes (I0.5)
//
// "Ver histórico" na linha expandida do cliente era botão morto. O
// plano Essencial promete "histórico de compras por cliente" na
// vitrine — este modal cumpre a promessa sem precisar da ficha 360º
// completa (essa vem na Fase 1, decisão de produto já tomada).
//
// Dado: salesApi.list(companyId, { customer_id }) já existe e filtra
// vendas por cliente (usado hoje pela tela de Vendas via SalesFilters.
// customer_id) — reaproveitado aqui em vez de duplicar lógica ou
// mandar pra aba Vendas.
// ============================================================
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { salesApi, type SalesListItem } from "@/services/salesApi";
import { fmt } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  companyId: string;
  customerId: string;
  customerName: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", dinheiro: "Dinheiro",
  credit: "Crédito", credito: "Crédito",
  debit: "Débito", debito: "Débito", voucher: "Voucher",
};

function paymentLabel(method: string | null): string | null {
  if (!method) return null;
  return PAYMENT_LABELS[method.toLowerCase()] || method;
}

function fmtSaleDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return ""; }
}

function itemsLabel(count: number): string {
  if (!count) return "sem itens";
  return count === 1 ? "1 item" : `${count} itens`;
}

export function HistoricoComprasModal({ visible, onClose, companyId, customerId, customerName }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer-sales-history", companyId, customerId],
    queryFn: () => salesApi.list(companyId, { customer_id: customerId, limit: 20 }),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 30_000,
  });

  const sales: SalesListItem[] = data?.sales || [];

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={480}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Histórico de compras</Text>
          <Text style={s.subtitle} numberOfLines={1}>{customerName}</Text>
        </View>
        <Pressable onPress={onClose} style={s.closeBtn} testID="historico-compras-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 18 }}>
        {isLoading && (
          <View style={s.centerBox}>
            <ActivityIndicator color={Colors.violet3} />
          </View>
        )}

        {!isLoading && isError && (
          <View style={s.centerBox}>
            <Text style={s.errorTxt}>Não foi possível carregar o histórico.</Text>
            <Pressable onPress={() => refetch()} style={s.retryBtn} testID="historico-compras-tentar-de-novo">
              <Text style={s.retryTxt}>Tentar de novo</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && sales.length === 0 && (
          <View style={s.centerBox} testID="historico-compras-vazio">
            <Text style={{ fontSize: 26, marginBottom: 6 }}>🛍️</Text>
            <Text style={s.emptyTitle}>Nenhuma compra registrada ainda</Text>
          </View>
        )}

        {!isLoading && !isError && sales.map((sale) => {
          const isCancelled = sale.status === "cancelled";
          const method = paymentLabel(sale.payment_method);
          return (
            <View key={sale.id} style={s.saleRow} testID={`historico-compras-item-${sale.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.saleDate}>{fmtSaleDate(sale.created_at)}</Text>
                <Text style={s.saleMeta}>
                  {itemsLabel(sale.items_count)}{method ? ` · ${method}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.saleAmount, isCancelled && s.saleAmountCancelled]}>
                  {fmt(sale.net_amount ?? sale.total_amount)}
                </Text>
                {isCancelled && <Text style={s.cancelledTag}>Cancelada</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 18, paddingTop: 8 },
  centerBox: { alignItems: "center", paddingVertical: 32, gap: 8 },
  errorTxt: { fontSize: 13, color: Colors.ink3, textAlign: "center" },
  retryBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  retryTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  emptyTitle: { fontSize: 13, color: Colors.ink3, textAlign: "center" },
  saleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  saleDate: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  saleMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  saleAmount: { fontSize: 14, color: Colors.green, fontWeight: "700" },
  saleAmountCancelled: { color: Colors.ink3, textDecorationLine: "line-through" },
  cancelledTag: { fontSize: 9.5, color: Colors.red, fontWeight: "700", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
});

export default HistoricoComprasModal;
