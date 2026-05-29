import { useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, Dimensions, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { useSalesList } from "@/hooks/useSales";
import { SaleDetailModal } from "@/components/screens/vendas/SaleDetailModal";
import { FechamentosTab } from "@/components/screens/vendas/FechamentosTab";
import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import type { SalesListItem, SalesFilters } from "@/services/api";

// ============================================================
// AURA. — Tela de Vendas (Item 3 Eryca)
//
// 09/05/2026: Aba "Fechamentos de Caixa" ao lado da listagem de Vendas.
// Abas no topo logo abaixo do subtitle; tab "vendas" mantem todo
// comportamento legado, tab "fechamentos" renderiza FechamentosTab
// (KPIs + filtros multi-CNPJ + tabela + drawer).
//
// MULTICNPJ Onda 2.4 (03/05/2026): em modo consolidated, lista vendas
// agregadas de TODAS as empresas do user. Cada linha tem badge violeta
// com nome da loja onde foi feita. Ao abrir o detalhe, passamos
// companyId+companyName pro SaleDetailModal — assim cancel/detail vai
// pra empresa correta.
//
// "Editar lancamento" em consolidated: oculto por ora. TransactionModal
// usa company.id internamente e ainda nao suporta company override
// (Onda 2.6 vai adaptar). User troca pra empresa especifica antes de
// editar lancamentos do PDV.
//
// 13/05/2026: fix periodToRange — substituido new Date(y,m,d) por
// Date.UTC(y,m,d,3,0,0) para calcular meia-noite SP corretamente
// independente do fuso do navegador (bug: vendas do dia anterior
// apareciam na listagem do dia seguinte quando browser em UTC).
//
// 29/05/2026: badge "Troca" nas linhas com type='troca'. A troca sempre
// apareceu na listagem (backend nao filtra type), mas sem rotulo parecia
// venda normal. O valor exibido na troca e o "levado" (newValue).
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

function periodToRange(period: PeriodKey): { from?: string; to?: string } {
  if (period === "all") return {};
  // SP = UTC-3 fixo (DST abolido em 2019). Subtrai 3h de "agora" e le
  // a data em UTC — funciona independente do fuso do navegador.
  // A abordagem anterior (new Date(y,m,d)) criava meia-noite no fuso
  // LOCAL do browser, causando inclusao de vendas do dia anterior quando
  // o browser estava em UTC (bug relatado por Maria/Encanto Presentes).
  var now = new Date();
  var spNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  var y = spNow.getUTCFullYear();
  var m = spNow.getUTCMonth();
  var d = spNow.getUTCDate();
  // Meia-noite SP em UTC = mesmo dia SP, hora 03:00 UTC.
  var spMidnightUTC = function(year: number, month: number, day: number): string {
    return new Date(Date.UTC(year, month, day, 3, 0, 0)).toISOString();
  };
  if (period === "today") {
    return { from: spMidnightUTC(y, m, d) };
  }
  if (period === "week") {
    return { from: new Date(Date.UTC(y, m, d - 6, 3, 0, 0)).toISOString() };
  }
  if (period === "month") {
    return { from: spMidnightUTC(y, m, 1) };
  }
  return {};
}

// MULTICNPJ Onda 2.4: tipo do item da lista. Em consolidated tem
// company_id+company_name; em per-company eles sao undefined.
type SaleListRow = SalesListItem & {
  company_id?: string;
  company_name?: string;
};

export default function VendasScreen() {
  const { company, consolidatedView } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [status, setStatus] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleListRow | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  // 09/05/2026: aba Fechamentos de Caixa (KPIs+lista) ao lado da listagem de Vendas
  const [activeTab, setActiveTab] = useState<"vendas" | "fechamentos">("vendas");

  const range = useMemo(function() { return periodToRange(period); }, [period]);

  const filters: SalesFilters = {
    date_from: range.from,
    date_to: range.to,
    status: status,
    q: search.trim() || undefined,
    limit: 100,
  };

  const { sales, stats, total, isLoading, isFetching, error, refetch, breakdown, companyCount } = useSalesList(filters as any);

  // MULTICNPJ Onda 2.4: badge da loja so quando o user tem 2+ empresas
  const showCompanyBadge = (companyCount || 1) > 1;

  // Pra abrir TransactionModal precisa carregar a tx — usa companies.transactions
  // SO funciona em modo per-company. Em consolidated, "Editar lancamento" e ocultado.
  const { data: editTx } = useQuery({
    queryKey: ["transaction-by-id", company?.id, editingTxId],
    queryFn: async function() {
      if (!company?.id || !editingTxId) return null;
      const res = await companiesApi.transactions(company.id);
      const tx = (res?.transactions || []).find(function(t: any) { return t.id === editingTxId; });
      return tx || null;
    },
    enabled: !!company?.id && !!editingTxId && !consolidatedView,
    staleTime: 5_000,
  });

  function handleSaleClick(sale: SaleListRow) {
    setSelectedSale(sale);
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
        {activeTab === "vendas"
          ? "Conferencia das vendas do Caixa. Veja detalhes, edite o lancamento financeiro ou cancele uma venda inteira."
          : "Acompanhamento dos fechamentos de caixa: hero com totais do mes, filtros por empresa e por divergencia, drawer com detalhe."}
      </Text>

      {/* 09/05/2026: tabs Vendas / Fechamentos de Caixa */}
      <View style={s.tabBar}>
        <Pressable
          onPress={function() { setActiveTab("vendas"); }}
          style={[s.tabBtn, activeTab === "vendas" && s.tabBtnActive]}
        >
          <Text style={[s.tabBtnText, activeTab === "vendas" && s.tabBtnTextActive]}>Vendas</Text>
        </Pressable>
        <Pressable
          onPress={function() { setActiveTab("fechamentos"); }}
          style={[s.tabBtn, activeTab === "fechamentos" && s.tabBtnActive]}
        >
          <Text style={[s.tabBtnText, activeTab === "fechamentos" && s.tabBtnTextActive]}>Fechamentos de Caixa</Text>
        </Pressable>
      </View>

      {activeTab === "fechamentos" && <FechamentosTab />}

      {activeTab === "vendas" && (<>

      {/* MULTICNPJ Onda 2.4: banner consolidado */}
      {showCompanyBadge && (
        <View style={s.consolidatedBanner}>
          <Icon name="cart" size={14} color="#a78bfa" />
          <View style={{ flex: 1 }}>
            <Text style={s.consolidatedTitle}>
              {consolidatedView
                ? `Vendas consolidadas · ${companyCount} empresas`
                : `Visualizando vendas desta empresa`}
            </Text>
            <Text style={s.consolidatedSub}>
              {consolidatedView
                ? "Cada linha mostra a loja onde a venda foi feita. Para editar o lancamento financeiro, troque pra empresa especifica."
                : "Para ver vendas de todas as suas empresas juntas, troque pra \"Todas as empresas\" no seletor."}
            </Text>
          </View>
        </View>
      )}

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

      {/* MULTICNPJ Onda 2.4: breakdown por empresa em consolidated */}
      {consolidatedView && breakdown && breakdown.length > 1 && (
        <View style={s.breakdownCard}>
          <Text style={s.breakdownTitle}>Por empresa</Text>
          <View style={s.breakdownRows}>
            {breakdown.map(function(b: any) {
              return (
                <View key={b.company_id} style={s.breakdownRow}>
                  <View style={{ flex: 1 }}>
                    <View style={s.breakdownNameRow}>
                      <Text style={s.breakdownName} numberOfLines={1}>{b.company_name}</Text>
                      {b.is_primary && (
                        <View style={s.breakdownPrimaryBadge}>
                          <Text style={s.breakdownPrimaryText}>PRINCIPAL</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.breakdownMeta}>
                      {b.total_sales} venda{b.total_sales !== 1 ? "s" : ""}
                      {b.cancelled_sales > 0 ? ` · ${b.cancelled_sales} cancelada${b.cancelled_sales !== 1 ? "s" : ""}` : ""}
                      {" · ticket " + fmt(b.avg_ticket)}
                    </Text>
                  </View>
                  <Text style={s.breakdownRevenue}>{fmt(b.revenue)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

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
          {sales.map(function(sale: SaleListRow) {
            const isCancelled = sale.status === "cancelled";
            const isTroca = sale.type === "troca";
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
                    {isTroca && (
                      <View style={s.rowTrocaPill}>
                        <Icon name="repeat" size={9} color="#fb923c" />
                        <Text style={s.rowTrocaPillText}>Troca</Text>
                      </View>
                    )}
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
                    {/* MULTICNPJ Onda 2.4: badge da loja */}
                    {showCompanyBadge && sale.company_name && (
                      <View style={s.rowCompanyPill}>
                        <Text style={s.rowCompanyPillText} numberOfLines={1}>{sale.company_name}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={s.rowRight}>
                  <Text style={[s.rowAmount, isCancelled && s.rowAmountStrike, isTroca && { color: "#fb923c" }]}>
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

      </>)}

      {/* MODAL DE DETALHES — em consolidated, passa companyId+companyName do sale clicado */}
      <SaleDetailModal
        visible={!!selectedSale}
        saleId={selectedSale?.id ?? null}
        companyId={selectedSale?.company_id}
        companyName={showCompanyBadge ? selectedSale?.company_name : undefined}
        onClose={function() { setSelectedSale(null); }}
        // MULTICNPJ Onda 2.4: "Editar lancamento" so funciona em per-company.
        // TransactionModal usa company.id; sera adaptado na Onda 2.6.
        onEditTransaction={consolidatedView ? undefined : handleEditTransaction}
      />

      {/* TRANSACTION MODAL — so abre em modo per-company */}
      {!consolidatedView && editTx && (
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

  // MULTICNPJ Onda 2.4: banner
  consolidatedBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  consolidatedTitle: { fontSize: 12.5, fontWeight: "700", color: "#c4b5fd", letterSpacing: 0.2 },
  consolidatedSub: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 14 },

  // STATS
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  statCard: { flex: 1, minWidth: 130, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statValue: { fontSize: 20, color: Colors.ink, fontWeight: "800", marginTop: 6 },
  statHint: { fontSize: 9.5, color: Colors.ink3, marginTop: 3 },

  // MULTICNPJ Onda 2.4: breakdown por empresa
  breakdownCard: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  breakdownTitle: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 },
  breakdownRows: { gap: 8 },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  breakdownNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  breakdownName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  breakdownPrimaryBadge: { backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  breakdownPrimaryText: { fontSize: 8, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.4 },
  breakdownMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  breakdownRevenue: { fontSize: 14, color: Colors.green, fontWeight: "700" },

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
  // 29/05/2026: pill "Troca" (laranja) pra distinguir trocas das vendas normais
  rowTrocaPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(251,146,60,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "rgba(251,146,60,0.4)" },
  rowTrocaPillText: { fontSize: 9.5, color: "#fb923c", fontWeight: "700", letterSpacing: 0.3 },
  // MULTICNPJ Onda 2.4: pill da loja (violeta pra destacar)
  rowCompanyPill: { backgroundColor: Colors.violetD, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "rgba(124,58,237,0.28)", maxWidth: 140 },
  rowCompanyPillText: { fontSize: 9.5, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.2 },
  rowRight: { alignItems: "flex-end", gap: 4, flexDirection: "row" },
  rowAmount: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  rowAmountStrike: { color: Colors.red, textDecorationLine: "line-through" as any },
  rowCancelBadge: { backgroundColor: Colors.redD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.red + "55" },
  rowCancelText: { fontSize: 8, color: Colors.red, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },

  moreHint: { padding: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  moreHintText: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", textAlign: "center" },
  // 09/05/2026: tab bar Vendas/Fechamentos
  tabBar: { flexDirection: "row", gap: 4, marginTop: 4, marginBottom: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: Colors.violet },
  tabBtnText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabBtnTextActive: { color: Colors.violet3, fontWeight: "700" },

});
