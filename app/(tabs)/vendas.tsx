import { useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, Dimensions, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { useSalesList } from "@/hooks/useSales";
import { SaleDetailModal } from "@/components/screens/vendas/SaleDetailModal";
import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import type { SalesListItem, SalesFilters } from "@/services/api";

// ============================================================
// AURA. — Tela de Vendas (Item 3 Eryca)
//
// Lista todas as vendas do PDV pra conferencia da vendedora.
//
// Layout:
//   1. Stats no topo (4 cards): hoje, mes, ticket medio, canceladas
//   2. Filtros: periodo (hoje/semana/mes/tudo) + status (todas/ativas/canceladas)
//   3. Busca por cliente/vendedora
//   4. Lista compacta: data/hora · cliente · vendedora · valor · status
//   5. Click numa venda -> abre SaleDetailModal
//   6. SaleDetailModal -> botao "Editar lancamento" -> abre TransactionModal
//      do financeiro (com SaleDetailsSection ja integrada do Item 1)
// ============================================================

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 720;

type PeriodKey = "today" | "week" | "month" | "all";
type StatusKey = "all" | "active" | "cancelled";

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "all", label: "Tudo" },
];

const STATUS_OPTIONS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Ativas" },
  { key: "cancelled", label: "Canceladas" },
];

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", dinheiro: "Dinheiro",
  credit: "Credito", credito: "Credito",
  debit: "Debito", debito: "Debito", voucher: "Voucher",
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };
var fmtTime = function(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};
var fmtDate = function(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  } catch { return ""; }
};

// Calcula intervalo ISO (timestamptz) baseado no periodo selecionado.
// Retorna { from?, to? } pra usar nos filtros do backend.
function periodToRange(period: PeriodKey): { from?: string; to?: string } {
  if (period === "all") return {};
  const now = new Date();
  // Comeco do dia em SP
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const startOfDay = new Date(tzNow.getFullYear(), tzNow.getMonth(), tzNow.getDate());

  if (period === "today") {
    return { from: startOfDay.toISOString() };
  }
  if (period === "week") {
    // Ultimos 7 dias (rolling)
    const sevenAgo = new Date(startOfDay);
    sevenAgo.setDate(sevenAgo.getDate() - 6);
    return { from: sevenAgo.toISOString() };
  }
  if (period === "month") {
    // Mes atual (do dia 1 ate hoje)
    const monthStart = new Date(tzNow.getFullYear(), tzNow.getMonth(), 1);
    return { from: monthStart.toISOString() };
  }
  return {};
}

export default function VendasScreen() {
  const { company } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [status, setStatus] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Range derivado do periodo
  const range = useMemo(function() { return periodToRange(period); }, [period]);

  const filters: SalesFilters = {
    date_from: range.from,
    date_to: range.to,
    status: status,
    q: search.trim() || undefined,
    limit: 100,
  };

  const { sales, stats, total, isLoading, isFetching, error, refetch } = useSalesList(filters);

  // Pra abrir TransactionModal precisa carregar a tx — usa companies.transactions endpoint
  // Buscando a tx pelo ID isolado
  const { data: editTx } = useQuery({
    queryKey: ["transaction-by-id", company?.id, editingTxId],
    queryFn: async function() {
      if (!company?.id || !editingTxId) return null;
      // Busca todas e filtra (endpoint nao tem GET por id direto)
      const res = await companiesApi.transactions(company.id);
      const tx = (res?.transactions || []).find(function(t: any) { return t.id === editingTxId; });
      return tx || null;
    },
    enabled: !!company?.id && !!editingTxId,
    staleTime: 5_000,
  });

  function handleSaleClick(sale: SalesListItem) {
    setSelectedSaleId(sale.id);
  }

  function handleEditTransaction(txId: string) {
    setEditingTxId(txId);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.titleRow}>
        <Text style={s.title}>Vendas</Text>
        <Pressable onPress={function() { refetch(); }} style={s.refreshBtn} disabled={isFetching}>
          {isFetching ? (
            <ActivityIndicator size="small" color={Colors.violet3} />
          ) : (
            <>
              <Icon name="refresh" size={13} color={Colors.violet3} />
              <Text style={s.refreshText}>Atualizar</Text>
            </>
          )}
        </Pressable>
      </View>
      <Text style={s.subtitle}>
        Conferencia das vendas do Caixa. Veja detalhes, edite o lancamento financeiro
        ou cancele uma venda inteira.
      </Text>

      {/* STATS CARDS */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Vendas</Text>
          <Text style={s.statValue}>{stats?.total_sales ?? "-"}</Text>
          {stats && stats.cancelled_sales > 0 && (
            <Text style={s.statHint}>{stats.cancelled_sales} cancelada(s)</Text>
          )}
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Receita</Text>
          <Text style={[s.statValue, { color: Colors.green }]}>{stats ? fmt(stats.revenue) : "-"}</Text>
          <Text style={s.statHint}>liquido (sem canceladas)</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Ticket medio</Text>
          <Text style={s.statValue}>{stats ? fmt(stats.avg_ticket) : "-"}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Ativas</Text>
          <Text style={[s.statValue, { color: Colors.violet3 }]}>{stats?.active_sales ?? "-"}</Text>
        </View>
      </View>

      {/* FILTROS */}
      <View style={s.filtersWrap}>
        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Periodo</Text>
          <View style={s.chipRow}>
            {PERIOD_OPTIONS.map(function(opt) {
              const active = period === opt.key;
              return (
                <Pressable key={opt.key} onPress={function() { setPeriod(opt.key); }} style={[s.chip, active && s.chipActive]}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.filterGroup}>
          <Text style={s.filterLabel}>Status</Text>
          <View style={s.chipRow}>
            {STATUS_OPTIONS.map(function(opt) {
              const active = status === opt.key;
              return (
                <Pressable key={opt.key} onPress={function() { setStatus(opt.key); }} style={[s.chip, active && s.chipActive]}>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.searchWrap}>
          <Icon name="search" size={13} color={Colors.ink3} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar cliente ou vendedora..."
            placeholderTextColor={Colors.ink3}
          />
          {search.length > 0 && (
            <Pressable onPress={function() { setSearch(""); }} style={s.clearBtn}>
              <Icon name="x" size={11} color={Colors.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      {/* LISTA */}
      {isLoading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={s.loadingText}>Carregando vendas...</Text>
        </View>
      )}

      {!isLoading && error && (
        <View style={s.errorBox}>
          <Icon name="alert" size={16} color={Colors.red} />
          <Text style={s.errorText}>
            {(error as any)?.data?.error || error.message || "Erro ao carregar vendas"}
          </Text>
        </View>
      )}

      {!isLoading && !error && sales.length === 0 && (
        <EmptyState
          icon="cart"
          iconColor={Colors.violet3}
          title="Nenhuma venda encontrada"
          subtitle={
            (period === "all" ? "" : "Nenhuma venda no periodo selecionado. ") +
            "Vendas feitas no Caixa aparecem aqui pra conferencia."
          }
        />
      )}

      {!isLoading && !error && sales.length > 0 && (
        <View style={s.listWrap}>
          {sales.map(function(sale) {
            const isCancelled = sale.status === "cancelled";
            return (
              <Pressable
                key={sale.id}
                onPress={function() { handleSaleClick(sale); }}
                style={[s.row, isCancelled && s.rowCancelled]}
              >
                <View style={s.rowLeft}>
                  <Text style={s.rowDate}>{fmtDate(sale.created_at)}</Text>
                  <Text style={s.rowTime}>{fmtTime(sale.created_at)}</Text>
                </View>
                <View style={s.rowMid}>
                  <Text style={s.rowCust} numberOfLines={1}>
                    {sale.customer?.name || "Sem cliente"}
                  </Text>
                  <View style={s.rowMetaRow}>
                    {sale.seller?.name && (
                      <View style={s.rowMetaPill}>
                        <Icon name="user_plus" size={9} color={Colors.ink3} />
                        <Text style={s.rowMetaPillText}>{sale.seller.name}</Text>
                      </View>
                    )}
                    {sale.payment_method && (
                      <View style={s.rowMetaPill}>
                        <Text style={s.rowMetaPillText}>
                          {PAYMENT_LABELS[sale.payment_method.toLowerCase()] || sale.payment_method}
                        </Text>
                      </View>
                    )}
                    <View style={s.rowMetaPill}>
                      <Text style={s.rowMetaPillText}>{sale.items_count} item(s)</Text>
                    </View>
                  </View>
                </View>
                <View style={s.rowRight}>
                  <Text style={[s.rowAmount, isCancelled && s.rowAmountStrike]}>
                    {fmt(sale.total_amount)}
                  </Text>
                  {isCancelled && (
                    <View style={s.rowCancelBadge}>
                      <Text style={s.rowCancelText}>Cancelada</Text>
                    </View>
                  )}
                  <Icon name="chevron_right" size={14} color={Colors.ink3} />
                </View>
              </Pressable>
            );
          })}
          {total > sales.length && (
            <View style={s.moreHint}>
              <Text style={s.moreHintText}>
                Mostrando {sales.length} de {total} vendas. Refine os filtros pra encontrar uma especifica.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* MODAL DE DETALHES */}
      <SaleDetailModal
        visible={!!selectedSaleId}
        saleId={selectedSaleId}
        onClose={function() { setSelectedSaleId(null); }}
        onEditTransaction={handleEditTransaction}
      />

      {/* TRANSACTION MODAL — abre quando user clica "Editar lancamento" no detalhes */}
      {editTx && (
        <TransactionModal
          visible={!!editTx}
          editTransaction={editTx}
          onClose={function() { setEditingTxId(null); refetch(); }}
          onSave={function() { /* edicoes via PATCH companiesApi.updateTransaction acontecem dentro */ }}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 16, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700", flex: 1 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.violetD, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, minWidth: 90, justifyContent: "center" },
  refreshText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  subtitle: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 18 },

  // STATS
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  statCard: { flex: 1, minWidth: 130, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statValue: { fontSize: 20, color: Colors.ink, fontWeight: "800", marginTop: 6 },
  statHint: { fontSize: 9.5, color: Colors.ink3, marginTop: 3 },

  // FILTROS
  filtersWrap: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 14, gap: 12 },
  filterGroup: { gap: 6 },
  filterLabel: { fontSize: 9.5, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "700" },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 12, color: Colors.ink, paddingVertical: 4 },
  clearBtn: { width: 22, height: 22, borderRadius: 5, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },

  // LISTA
  loadingBox: { paddingVertical: 60, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: Colors.redD, borderRadius: 10, borderWidth: 1, borderColor: Colors.red + "33" },
  errorText: { flex: 1, fontSize: 12, color: Colors.red },

  listWrap: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: Colors.border, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  rowCancelled: { opacity: 0.65 },
  rowLeft: { width: 60, alignItems: "flex-start" },
  rowDate: { fontSize: 11, color: Colors.ink, fontWeight: "700" },
  rowTime: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  rowMid: { flex: 1, gap: 4 },
  rowCust: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  rowMetaRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  rowMetaPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: Colors.bg4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rowMetaPillText: { fontSize: 9.5, color: Colors.ink3, fontWeight: "500" },
  rowRight: { alignItems: "flex-end", gap: 4, flexDirection: "row" },
  rowAmount: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  rowAmountStrike: { color: Colors.red, textDecorationLine: "line-through" as any },
  rowCancelBadge: { backgroundColor: Colors.redD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.red + "55" },
  rowCancelText: { fontSize: 8, color: Colors.red, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },

  moreHint: { padding: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  moreHintText: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", textAlign: "center" },
});
