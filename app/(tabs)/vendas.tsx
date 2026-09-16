import { useState, useMemo, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Dimensions, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { useSalesList } from "@/hooks/useSales";
import { SaleDetailModal } from "@/components/screens/vendas/SaleDetailModal";
import { FechamentosTab } from "@/components/screens/vendas/FechamentosTab";
import { SalesRanking } from "@/components/screens/vendas/SalesRanking";
import { VendasFiltros, type StatusKey } from "@/components/screens/vendas/VendasFiltros";
import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import type { SalesListItem, SalesFilters } from "@/services/api";
import { useLocalSearchParams } from "expo-router";
import {
  periodToRange, spCurrentMonth,
  PAGE_SIZE, MONTH_NAMES,
  type PeriodKey, type MonthAnchor,
} from "@/utils/vendasPeriodo";
// 29/08/2026: cabecalho e abas compartilhados com /clientes (padrao do /estoque).
import { ScreenHero, ScreenTabs, type ScreenTabItem } from "@/components/ScreenHero";
// 29/08/2026: a listagem mostrava "1 item(s)" e "1 cancelada(s)".
import { pluralize } from "@/utils/plural";

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
// venda normal.
//
// 02/06/2026: a linha da troca agora mostra o LIQUIDO (net_amount =
// levado - devolvido) como valor principal em laranja, com o valor cheio
// dos produtos (total_amount) riscado/secundario embaixo. Antes mostrava
// o "levado" cheio, inflando a leitura de faturamento. Backend manda
// net_amount/returned_value na listagem (Aura-backend#138).
//
// 02/08/2026: aba "Ranking" entre Vendas e Fechamentos, migrada da tela
// de Folha. Ranking por vendedor e leitura de venda, nao de folha — e
// assim fica visivel tambem pro Essencial (ver Aura-backend#454).
//
// 28/08/2026 (relato Eryca #2) — HISTORICO COMPLETO:
// A tela pedia limit=100 numa tacada so, sem paginacao, com ORDER BY
// created_at DESC. Numa loja de ~20 vendas/dia as 100 linhas acabavam por
// volta do dia 15 e o resto do mes simplesmente nao existia na tela (nao era
// "carregue mais": nao havia mais nada). Duas mudancas:
//   1. Paginacao de 30 em 30 (PAGE_SIZE), com rodape Anterior/Proxima. Os KPIs
//      continuam vindo do periodo inteiro — o backend conta separado da pagina.
//   2. "Mes" virou seletor navegavel (< Agosto de 2026 >) sem limite pra tras,
//      no lugar do par "Mes"/"Mes anterior" que so alcancava dois meses.
//
// 29/08/2026 (QA de coerencia entre telas):
//   · Cabecalho editorial compartilhado (ScreenHero) — era o terceiro padrao
//     de titulo do app; agora e o mesmo de /estoque e /clientes.
//   · Abas viraram pilula (ScreenTabs). O sublinhado daqui era o unico do app.
//   · "Receita" virou "Receita de vendas": o Painel usava a MESMA palavra pra
//     um numero maior (819,40 x 639,50 no mesmo mes) porque la entram tambem
//     pedidos do Canal Digital e lancamentos manuais. Mesmo peso tipografico,
//     dois valores, nenhuma nota — agora cada rotulo diz o seu escopo.
// ============================================================

const SCREEN_W = typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width;
const IS_WIDE = SCREEN_W > 720;
// I0.6 (16/09/2026): a partir de 1024px, periodo+mes+status+busca cabem
// numa unica linha (ver VendasFiltros). Abaixo disso mantem a pilha.
const IS_FILTERS_ROW = SCREEN_W >= 1024;

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", dinheiro: "Dinheiro",
  credit: "Crédito", credito: "Crédito",
  debit: "Débito", debito: "Débito", voucher: "Voucher",
};

var fmt = function(n: number) { return "R$ " + Number(n != null ? n : 0).toFixed(2).replace(".", ","); };
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

// MULTICNPJ Onda 2.4: tipo do item da lista. Em consolidated tem
// company_id+company_name; em per-company eles sao undefined.
type SaleListRow = SalesListItem & {
  company_id?: string;
  company_name?: string;
};

export default function VendasScreen() {
  const { company, consolidatedView } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>("month");
  // Periodo personalizado: BR (dd/mm/aaaa) pro input + ISO (YYYY-MM-DD) pra logica.
  const [customFromBr, setCustomFromBr] = useState("");
  const [customToBr, setCustomToBr] = useState("");
  const [customFromIso, setCustomFromIso] = useState<string | null>(null);
  const [customToIso, setCustomToIso] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleListRow | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  // Mes que o seletor esta mostrando (so vale quando period === "month").
  const [monthAnchor, setMonthAnchor] = useState<MonthAnchor>(spCurrentMonth);
  // Pagina atual (0-based). 30 vendas por pagina.
  const [page, setPage] = useState(0);
  // 09/05/2026: aba Fechamentos de Caixa (KPIs+lista) ao lado da listagem de Vendas
  // 02/08/2026: aba "Ranking" entra no meio (Vendas | Ranking | Fechamentos).
  // Veio da tela de Folha; ranking por vendedor e leitura de venda, nao de
  // folha — e assim o plano Essencial (que nao tem folha) tambem enxerga.
  const params = useLocalSearchParams<{ tab?: string }>();
  const paramTab = typeof params.tab === "string" ? params.tab : undefined;
  const [activeTab, setActiveTab] = useState<"vendas" | "ranking" | "fechamentos">(
    paramTab === "ranking" || paramTab === "fechamentos" ? paramTab : "vendas"
  );

  const range = useMemo(
    function() { return periodToRange(period, customFromIso, customToIso, monthAnchor); },
    [period, customFromIso, customToIso, monthAnchor.y, monthAnchor.m]
  );

  // Trocar filtro volta pra pagina 1 — senao a pessoa filtra "Hoje" estando na
  // pagina 4 e cai numa pagina que nao existe mais (vazio parecendo "sem
  // vendas"). Ajuste feito no próprio render (padrão "derivar estado de props"):
  // usar effectivePage aqui evita disparar um fetch com o offset velho.
  const filterSignature = [period, range.from || "", range.to || "", status, search.trim()].join("|");
  const lastSignature = useRef(filterSignature);
  const filtersChanged = lastSignature.current !== filterSignature;
  if (filtersChanged) lastSignature.current = filterSignature;
  const effectivePage = filtersChanged ? 0 : page;
  if (filtersChanged && page !== 0) setPage(0);

  const filters: SalesFilters = {
    date_from: range.from,
    date_to: range.to,
    status: status,
    q: search.trim() || undefined,
    limit: PAGE_SIZE,
    offset: effectivePage * PAGE_SIZE,
  };

  const { sales, stats, total, isLoading, isFetching, error, refetch, breakdown, companyCount } = useSalesList(filters as any);

  // `total` e o tamanho do filtro inteiro — o backend conta separado da pagina,
  // entao os KPIs continuam falando do periodo, nao das 30 linhas visiveis.
  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const canPrev = effectivePage > 0;
  const canNext = effectivePage + 1 < totalPages;
  const firstOnPage = (sales?.length || 0) === 0 ? 0 : effectivePage * PAGE_SIZE + 1;
  const lastOnPage = effectivePage * PAGE_SIZE + (sales?.length || 0);

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

  // Como o periodo aparece escrito na linha de metricas do cabecalho.
  const periodoLabel = period === "today" ? "hoje"
    : period === "week" ? "nesta semana"
    : period === "month" ? MONTH_NAMES[monthAnchor.m].toLowerCase() + " de " + monthAnchor.y
    : period === "all" ? "no histórico"
    : "no período";

  const TABS_VENDAS: ScreenTabItem[] = [
    { key: "vendas", label: "Vendas" },
    { key: "ranking", label: "Ranking" },
    { key: "fechamentos", label: "Fechamentos de caixa" },
  ];

  // Linha de metricas do cabecalho. Na aba Vendas ela carrega o numero e ja
  // diz o escopo dele ("receita de vendas"), pra nao repetir a palavra solta
  // "receita" que o Painel usa pra outra conta.
  const heroSub = activeTab === "vendas"
    ? (stats ? (
        <>
          {pluralize(stats.total_sales, "venda", "vendas")} em {periodoLabel} ·{" "}
          <Text style={s.heroStrong}>{fmt(stats.revenue)}</Text> de receita de vendas · ticket médio de {fmt(stats.avg_ticket)}
        </>
      ) : "Conferência das vendas do Caixa: detalhe, lançamento financeiro e cancelamento.")
    : activeTab === "ranking"
    ? "Quem vendeu mais no período: pódio, receita, ticket médio e evolução por vendedor."
    : "Fechamentos de caixa: totais do mês, filtros por empresa e por divergência, detalhe no drawer.";

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {/* 29/08/2026: mesmo cabecalho editorial de /estoque e /clientes. */}
      <ScreenHero
        eyebrow="Conferência do caixa"
        title="Vendas"
        live={activeTab === "vendas"}
        subtitle={heroSub}
        actions={
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
        }
      />

      {/* 09/05/2026: tabs Vendas / Fechamentos de Caixa
          02/08/2026: "Ranking" entre as duas (migrada de Folha)
          29/08/2026: sublinhado -> pilula (ScreenTabs), igual /clientes e /estoque */}
      <ScreenTabs
        tabs={TABS_VENDAS}
        active={activeTab}
        onSelect={function(k: string) { setActiveTab(k as "vendas" | "ranking" | "fechamentos"); }}
      />

      {/* Ranking depende de um CNPJ especifico (o endpoint e
          /companies/:id/employees/ranking e o vinculo vendedor->empresa e por
          CNPJ). Em modo consolidado nao ha company.id — avisa em vez de
          renderizar um ranking vazio que parece "nenhuma venda". */}
      {activeTab === "ranking" && (consolidatedView || !company?.id ? (
        <View style={s.consolidatedBanner}>
          <Icon name="cart" size={14} color="#a78bfa" />
          <View style={{ flex: 1 }}>
            <Text style={s.consolidatedTitle}>Ranking disponível por empresa</Text>
            <Text style={s.consolidatedSub}>
              O ranking de vendedores é calculado por CNPJ. Escolha uma empresa específica no seletor para ver o pódio.
            </Text>
          </View>
        </View>
      ) : <SalesRanking />)}

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
                : `Visualizando as vendas desta empresa`}
            </Text>
            <Text style={s.consolidatedSub}>
              {consolidatedView
                ? "Cada linha mostra a loja onde a venda foi feita. Para editar o lançamento financeiro, troque pra empresa específica."
                : "Para ver as vendas de todas as suas empresas juntas, troque pra \"Todas as empresas\" no seletor."}
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
            <Text style={s.statHint}>{pluralize(stats.cancelled_sales, "cancelada", "canceladas")}</Text>
          )}
        </View>
        {/* 29/08/2026 — o rotulo era so "Receita", igual ao do Painel, com valor
            menor. O Painel soma TODAS as entradas confirmadas do mes (vendas,
            Canal Digital, lancamentos manuais); aqui so entra o que passou pelo
            Caixa. Rotulo + nota explicam a diferenca em vez de deixar o lojista
            achando que um dos dois esta errado. */}
        <View style={[s.statCard, s.statCardWide]} {...(Platform.OS === "web" ? ({ title: "Soma das vendas do Caixa no período, sem as canceladas. Não inclui pedidos do Canal Digital nem lançamentos manuais — esses entram na Receita total do Painel e no \"Entrou\" do Financeiro." } as any) : null)}>
          <Text style={s.statLabel}>Receita de vendas</Text>
          <Text style={[s.statValue, { color: Colors.green }]}>{stats ? fmt(stats.revenue) : "-"}</Text>
          <Text style={s.statHint}>Só o Caixa, sem canceladas. Pedidos do Canal Digital e lançamentos manuais entram na Receita total do Painel.</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Ticket médio</Text>
          <Text style={s.statValue}>{stats ? fmt(stats.avg_ticket) : "-"}</Text>
          <Text style={s.statHint}>Receita de vendas ÷ vendas ativas</Text>
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
                      {pluralize(b.total_sales, "venda", "vendas")}
                      {b.cancelled_sales > 0 ? " · " + pluralize(b.cancelled_sales, "cancelada", "canceladas") : ""}
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

      {/* FILTROS — I0.6 (16/09/2026): extraidos pra VendasFiltros. Em telas
          largas (>=1024px) periodo+mes+status+busca ficam numa linha so, em
          vez de tres blocos empilhados que sozinhos ja tomavam a dobra
          inteira. Mesmo comportamento de antes, so a disposicao mudou. */}
      <VendasFiltros
        wide={IS_FILTERS_ROW}
        period={period}
        onPeriodChange={setPeriod}
        monthAnchor={monthAnchor}
        onMonthAnchorChange={setMonthAnchor}
        customFromBr={customFromBr}
        onCustomFromBrChange={setCustomFromBr}
        customToBr={customToBr}
        onCustomToBrChange={setCustomToBr}
        onCustomFromIsoChange={setCustomFromIso}
        onCustomToIsoChange={setCustomToIso}
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
      />

      {/* LISTA */}
      {isLoading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} />
          <Text style={s.loadingText}>Carregando vendas…</Text>
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

      {/* Pagina alem do fim (ex.: filtro encolheu a lista): oferecer a volta,
          senao a tela mente dizendo que nao existe venda no periodo. */}
      {!isLoading && !error && sales.length === 0 && effectivePage > 0 && (
        <View style={s.pagerEmpty}>
          <Text style={s.pagerEmptyText}>
            Não há mais vendas depois da página {totalPages} neste período.
          </Text>
          <Pressable onPress={function() { setPage(0); }} style={s.pagerBtn}>
            <Icon name="chevron_left" size={13} color={Colors.violet3} />
            <Text style={s.pagerBtnText}>Voltar pra primeira página</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !error && sales.length === 0 && effectivePage === 0 && (
        <EmptyState
          icon="cart"
          iconColor={Colors.violet3}
          title="Nenhuma venda encontrada"
          subtitle={
            period === "all"
              ? "Vendas feitas no Caixa aparecem aqui pra conferência."
              : period === "month"
              ? "Nenhuma venda em " + MONTH_NAMES[monthAnchor.m] + " de " + monthAnchor.y +
                ". Use as setas do mês pra procurar em outro período."
              : "Nenhuma venda no período selecionado. Vendas feitas no Caixa aparecem aqui pra conferência."
          }
        />
      )}

      {!isLoading && !error && sales.length > 0 && (
        <View style={s.listWrap}>
          {sales.map(function(sale: SaleListRow) {
            const isCancelled = sale.status === "cancelled";
            const isTroca = sale.type === "troca";
            // 02/06/2026: troca mostra o liquido (net). Fallback p/ total se
            // o backend ainda nao mandar net_amount (deploy parcial).
            const trocaNet = (sale as any).net_amount != null ? (sale as any).net_amount : sale.total_amount;
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
                      <Text style={s.rowMetaPillText}>{pluralize(sale.items_count, "item", "itens")}</Text>
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
                  {isTroca ? (
                    <View style={s.rowRightStack}>
                      <Text style={[s.rowAmount, { color: "#fb923c" }, isCancelled && s.rowAmountStrike]}>
                        {(trocaNet >= 0 ? "+ " : "- ") + fmt(Math.abs(trocaNet))}
                      </Text>
                      <Text style={s.rowTrocaSub} numberOfLines={1}>
                        líquido · <Text style={s.rowTrocaStrike}>{fmt(sale.total_amount)}</Text>
                      </Text>
                    </View>
                  ) : (
                    <Text style={[s.rowAmount, isCancelled && s.rowAmountStrike]}>
                      {fmt(sale.total_amount)}
                    </Text>
                  )}
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
          {/* PAGINACAO — 30 por pagina. Antes a tela pedia 100 de uma vez e
              parava ali: numa loja movimentada o mes acabava no dia 15 e nao
              havia como chegar no resto. */}
          {total > PAGE_SIZE && (
            <View style={s.pagerRow}>
              <Pressable
                onPress={function() { if (canPrev) setPage(effectivePage - 1); }}
                disabled={!canPrev || isFetching}
                style={[s.pagerBtn, (!canPrev || isFetching) && s.pagerBtnDisabled]}
              >
                <Icon name="chevron_left" size={13} color={canPrev ? Colors.violet3 : Colors.ink3} />
                <Text style={[s.pagerBtnText, !canPrev && { color: Colors.ink3 }]}>Anterior</Text>
              </Pressable>
              <View style={s.pagerInfo}>
                <Text style={s.pagerInfoMain}>Página {effectivePage + 1} de {totalPages}</Text>
                <Text style={s.pagerInfoSub}>{firstOnPage}–{lastOnPage} de {pluralize(total, "venda", "vendas")}</Text>
              </View>
              <Pressable
                onPress={function() { if (canNext) setPage(effectivePage + 1); }}
                disabled={!canNext || isFetching}
                style={[s.pagerBtn, (!canNext || isFetching) && s.pagerBtnDisabled]}
              >
                <Text style={[s.pagerBtnText, !canNext && { color: Colors.ink3 }]}>Próxima</Text>
                <Icon name="chevron_right" size={13} color={canNext ? Colors.violet3 : Colors.ink3} />
              </Pressable>
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

  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.violetD, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, minWidth: 90, justifyContent: "center" },
  refreshText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },

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
  // I0.6 (16/09/2026): marginBottom/padding reduzidos (18->12 / 14->12) pra
  // a faixa de indicadores ocupar menos altura — assim a primeira venda da
  // lista cabe sem rolar em 1920x911 mesmo com cabecalho+abas+filtros
  // acima. Indicadores continuam os mesmos 4, so mais compactos.
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, minWidth: 130, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statValue: { fontSize: 20, color: Colors.ink, fontWeight: "800", marginTop: 6 },
  statHint: { fontSize: 9.5, color: Colors.ink3, marginTop: 3, lineHeight: 13 },
  // 29/08/2026: o card da receita carrega a nota de composicao, entao precisa
  // de mais largura que os irmaos pra nota nao virar cinco linhas.
  statCardWide: { minWidth: IS_WIDE ? 260 : 130, flexGrow: 2 },
  heroStrong: { color: Colors.green, fontWeight: "700" },

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

  // FILTROS: extraidos pra components/screens/vendas/VendasFiltros.tsx (I0.6).

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
  rowRight: { alignItems: "center", gap: 4, flexDirection: "row" },
  // 02/06/2026: stack vertical p/ troca (liquido + valor cheio riscado)
  rowRightStack: { alignItems: "flex-end" },
  rowTrocaSub: { fontSize: 9.5, color: Colors.ink3, marginTop: 1 },
  rowTrocaStrike: { textDecorationLine: "line-through" as any, color: Colors.ink3 },
  rowAmount: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  rowAmountStrike: { color: Colors.red, textDecorationLine: "line-through" as any },
  rowCancelBadge: { backgroundColor: Colors.redD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.red + "55" },
  rowCancelText: { fontSize: 8, color: Colors.red, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },

  moreHint: { padding: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  moreHintText: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", textAlign: "center" },

  // Paginacao (30 por pagina)
  pagerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 },
  pagerBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  pagerBtnDisabled: { backgroundColor: Colors.bg3, borderColor: Colors.border, opacity: 0.6 },
  pagerBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  pagerInfo: { flex: 1, alignItems: "center" },
  pagerInfoMain: { fontSize: 11.5, color: Colors.ink, fontWeight: "700" },
  pagerInfoSub: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  pagerEmpty: { alignItems: "center", gap: 10, padding: 24, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  pagerEmptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  // 29/08/2026: os estilos da tab bar sublinhada sairam daqui — as abas agora
  // vem do ScreenTabs (pilula), compartilhado com /clientes.

});
