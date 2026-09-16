// ============================================================
// AURA. -- AbcCurveCard (expandido 30/05/2026, Fase 1 ABC por categoria 16/09/2026)
//
// Curva ABC dos produtos calculada a partir de vendas reais.
// Migrou do Estoque (era decorativa, sempre 'C') pro Financeiro/Receitas.
// Consome useProductsRanking — backend ranqueia por revenue e atribui A/B/C.
//
// Entry point pro usuario: Painel → "Vendas" → "Ver análise completa".
// Esse botao navega pra /financeiro?tab=receitas&focus=abc; o financeiro.tsx
// auto-rola ate aqui via getElementById("abc-curve-card") quando focus=abc.
//
// 16/09/2026 (pedido do Caio — "trazer a categoria e não só os itens
//   avulsos"): seletor "Por produto · Por categoria" (texto, não ícone —
//   decisão do Caio). A visão por categoria mora em AbcPorCategoria.tsx
//   (arquivo irmão) e reclassifica ABC no cliente porque o backend só
//   classifica produto (ver abcCategoryUtils.ts pra regra replicada e
//   comentário completo). Clicar numa categoria muda pra "Por produto"
//   já filtrado por ela (chip "Categoria: X ✕" pra limpar o filtro sem
//   sair da visão). Constantes/estilos compartilhados entre as duas
//   visões saíram pra abcShared.tsx (sem isso, import circular).
//
// 30/05/2026 (fix bug Eryca):
//   - isError capture explicito do useQuery. Antes, render exceptions aqui
//     subiam pro ErrorBoundary global (mensagem "Algo deu errado"), que era
//     o que a cliente via como "erro intermitente".
//   - Tabela paginada substitui Top 10 fixo. Filtro por classe A/B/C/Todos.
//     Periodo expandido (Hoje/Semana/Mes/Ano).
//   - Cards de resumo agora puxam class_breakdown do backend (3 cards com
//     contagem + % receita por classe).
//   - Export CSV (web only) — leva todo o ranking pra planilha.
//   - Type assertions defensivas pra valores numericos (NaN → 0).
//
// 06/05/2026: fix React error #31 com helper periodLabelOf (objeto period
//   vindo do backend novo virando children de <Text>).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { companiesApi } from "@/services/companiesApi";
import type { ProductRanking, ProductRankingItem, AbcClassBreakdown } from "@/hooks/useSalesAnalytics";
import { useAuthStore } from "@/stores/auth";
import { DonutChart } from "@/components/charts/DonutChart";
import { Icon } from "@/components/Icon";
import {
  ABC_COLORS, PERIODS, CLASS_FILTERS, AbcBadge, Paginator, downloadCsv,
  fmt, fmtK, toNum,
  type PeriodKey, type Grade, type ClassFilter,
} from "./abcShared";
import { type AbcViewMode, getInitialViewMode, persistViewMode } from "./abcCategoryUtils";
import { AbcPorCategoria } from "./AbcPorCategoria";

const PAGE_SIZE = 25;

// CSV client-side. Backend ja devolve os dados; nao precisamos endpoint dedicado.
function exportProductCSV(filename: string, products: ProductRankingItem[]) {
  const headers = ["#", "Produto", "Categoria", "Classe", "Quantidade", "Receita (R$)", "% acumulado"];
  const rows = products.map((p, i) => [
    String(i + 1),
    (p.name || "").replace(/"/g, '""'),
    (p.category || "").replace(/"/g, '""'),
    String(p.abc || "C"),
    String(toNum(p.qty_sold ?? p.total_qty)),
    toNum(p.revenue ?? p.total_revenue).toFixed(2).replace(".", ","),
    p.accumulated_pct != null ? String(p.accumulated_pct).replace(".", ",") : "",
  ]);
  downloadCsv(filename, headers, rows);
}

// Slug simples pra nome de arquivo — sem depender de libs externas.
function slugify(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Local em vez do useProductsRanking de hooks/useSalesAnalytics.ts: aquele
// hook tem queryKey sem `category`, o que reciclaria o cache de uma
// categoria pra outra ao trocar o filtro no drill-down (bug silencioso —
// o usuário veria produtos da categoria errada por um instante ou, pior,
// indefinidamente se o cache já estava "fresh"). Mesma lógica de
// habilitação/retry do hook original; só acrescenta `category` na key e
// no payload repassado pro companiesApi (que já aceita esse filtro —
// services/companiesApi.ts, ProductsRankingOpts.category).
function useAbcProductRanking(opts: {
  period: PeriodKey;
  limit: number;
  abc?: Grade;
  category?: string | null;
  enabled: boolean;
}) {
  const { company, consolidatedView } = useAuthStore();
  const companyId = company?.id;
  const category = opts.category || undefined;
  return useQuery<ProductRanking>({
    queryKey: ["productsRanking", companyId, opts.period, opts.limit, opts.abc, category || null],
    queryFn: () => companiesApi.productsRanking(companyId!, { period: opts.period, limit: opts.limit, abc: opts.abc, category }),
    enabled: opts.enabled && !!companyId && !consolidatedView,
    staleTime: 60_000,
    retry: 1,
  });
}

export function AbcCurveCard() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [classFilter, setClassFilter] = useState<ClassFilter>("ALL");
  const [page, setPage] = useState(1);
  const [viewMode, setViewModeState] = useState<AbcViewMode>(() => getInitialViewMode());
  const [categoryDrill, setCategoryDrill] = useState<string | null>(null);
  const { consolidatedView } = useAuthStore();

  function setViewMode(mode: AbcViewMode) {
    setViewModeState(mode);
    persistViewMode(mode);
  }

  function handleDrillToProduct(categoryName: string) {
    setCategoryDrill(categoryName);
    setViewMode("produto");
    setPage(1);
  }

  // MULTI-CNPJ: espelha useProductsRanking — em consolidatedView o ranking
  // por produto fica desabilitado (não existe /me/products/ranking; ver
  // comentário de useProductsRanking em hooks/useSalesAnalytics.ts). A
  // visão por categoria usa a mesma rota-base por empresa
  // (/companies/:id/products/categories), então tem a MESMA limitação —
  // por isso o card inteiro (as duas visões) cai no empty state abaixo em
  // vez de deixar só a visão por categoria disponível.
  if (consolidatedView) {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Curva ABC de produtos</Text>
            <Text style={s.subtitle}>Ranking calculado a partir das vendas</Text>
          </View>
        </View>
        <View style={s.emptyBox}>
          <Icon name="bar_chart" size={28} color={Colors.ink3} />
          <Text style={s.emptyTitle}>Modo consolidado</Text>
          <Text style={s.emptyText}>
            Selecione uma loja específica no switcher pra ver a curva ABC dos produtos.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <AbcCurveCardInner
      period={period}
      onPeriodChange={(p) => { setPeriod(p); setPage(1); }}
      classFilter={classFilter}
      onClassFilterChange={(c) => { setClassFilter(c); setPage(1); }}
      page={page}
      onPageChange={setPage}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      categoryDrill={categoryDrill}
      onClearCategoryDrill={() => setCategoryDrill(null)}
      onDrillToProduct={handleDrillToProduct}
    />
  );
}

type InnerProps = {
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  classFilter: ClassFilter;
  onClassFilterChange: (c: ClassFilter) => void;
  page: number;
  onPageChange: (p: number) => void;
  viewMode: AbcViewMode;
  onViewModeChange: (m: AbcViewMode) => void;
  categoryDrill: string | null;
  onClearCategoryDrill: () => void;
  onDrillToProduct: (categoryName: string) => void;
};

function AbcCurveCardInner(props: InnerProps) {
  const {
    period, onPeriodChange, classFilter, onClassFilterChange, page, onPageChange,
    viewMode, onViewModeChange, categoryDrill, onClearCategoryDrill, onDrillToProduct,
  } = props;

  // Só busca o ranking por produto quando essa é a visão ativa — evita
  // disparar as duas queries (produto + categoria) toda vez que o card
  // monta, já que trocar de visão é uma ação explícita do usuário.
  const queryAbc = classFilter === "ALL" ? undefined : classFilter;
  const { data, isLoading, isError, refetch, isFetching } = useAbcProductRanking({
    period,
    limit: 500,
    abc: queryAbc,
    category: categoryDrill,
    enabled: viewMode === "produto",
  });

  const products = useMemo<ProductRankingItem[]>(
    () => (data as ProductRanking | undefined)?.products || [],
    [data]
  );
  const totalRevenue = toNum((data as ProductRanking | undefined)?.summary?.total_revenue);
  const totalSold = toNum((data as ProductRanking | undefined)?.summary?.total_sold);
  const totalProductsAll = toNum((data as ProductRanking | undefined)?.summary?.total_products);
  const periodLabel = PERIODS.find((p) => p.key === period)?.label || period;

  // class_breakdown vem do backend (novo). Fallback: deriva client-side
  // pra periodos onde a versao antiga do servidor responde (deploy gradual).
  const classBreakdown: AbcClassBreakdown[] = useMemo(() => {
    const fromServer = (data as ProductRanking | undefined)?.class_breakdown;
    if (fromServer && fromServer.length) return fromServer;
    return (["A", "B", "C"] as Grade[]).map((g) => {
      const items = products.filter((p) => (p.abc || "C") === g);
      const rev = items.reduce((sum, p) => sum + toNum(p.revenue ?? p.total_revenue), 0);
      const qty = items.reduce((sum, p) => sum + toNum(p.qty_sold ?? p.total_qty), 0);
      return {
        grade: g,
        count: items.length,
        total_revenue: rev,
        total_qty: qty,
        revenue_pct: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0,
        qty_pct: totalSold > 0 ? Math.round((qty / totalSold) * 100) : 0,
      };
    });
  }, [data, products, totalRevenue, totalSold]);

  // Paginação client-side (servidor ja limitou; usuario percorre a fatia atual).
  const filteredProducts = useMemo(() => {
    if (classFilter === "ALL") return products;
    return products.filter((p) => (p.abc || "C") === classFilter);
  }, [products, classFilter]);

  const totalFiltered = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = (pageSafe - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalFiltered);
  const pageItems = filteredProducts.slice(pageStart, pageEnd);

  const donutItems = useMemo(() => {
    return classBreakdown
      .map((b) => ({ category: `Curva ${b.grade}`, amount: toNum(b.total_revenue) }))
      .filter((d) => d.amount > 0);
  }, [classBreakdown]);

  const labels: Record<Grade, string> = {
    A: "Alta rotatividade",
    B: "Rotatividade média",
    C: "Baixa rotatividade",
  };
  const colors: Record<Grade, string> = {
    A: Colors.green, B: Colors.amber, C: Colors.ink3,
  };

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    const periodTxt = (PERIODS.find(p => p.key === period)?.label || period).toLowerCase();
    const tail = classFilter === "ALL" ? "todos" : `classe-${classFilter}`;
    const catTail = categoryDrill ? `-categoria-${slugify(categoryDrill)}` : "";
    exportProductCSV(`curva-abc-${periodTxt}-${tail}${catTail}-${stamp}.csv`, filteredProducts);
  }

  return (
    <View style={s.card}>
      {/* Header com titulo, seletor de visao, periodo e export */}
      <View style={s.headerRow}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.title}>
            {viewMode === "categoria" ? "Curva ABC por categoria" : "Curva ABC de produtos"}
          </Text>
          <Text style={s.subtitle}>Calculada a partir das vendas reais · {periodLabel}</Text>
          <Text style={s.subtitleNote}>
            Vendas canceladas e trocas excluídas (alinhado com Painel e Vendas).
          </Text>
          {viewMode === "produto" && categoryDrill && (
            <Pressable
              onPress={onClearCategoryDrill}
              style={s.categoryChip}
              accessibilityRole="button"
              accessibilityLabel={"Remover filtro de categoria " + categoryDrill}
            >
              <Text style={s.categoryChipText}>Categoria: {categoryDrill} ✕</Text>
            </Pressable>
          )}
        </View>
        <View style={s.headerActions}>
          {/* Seletor de visão — texto, não ícone (decisão do Caio, 16/09/2026) */}
          <View style={s.viewModeChips}>
            <Pressable
              onPress={() => onViewModeChange("produto")}
              style={[s.viewModeChip, viewMode === "produto" && s.viewModeChipActive]}
              accessibilityRole="button"
              accessibilityLabel="Ver curva ABC por produto"
            >
              <Text style={[s.viewModeChipText, viewMode === "produto" && s.viewModeChipTextActive]}>Por produto</Text>
            </Pressable>
            <Pressable
              onPress={() => onViewModeChange("categoria")}
              style={[s.viewModeChip, viewMode === "categoria" && s.viewModeChipActive]}
              accessibilityRole="button"
              accessibilityLabel="Ver curva ABC por categoria"
            >
              <Text style={[s.viewModeChipText, viewMode === "categoria" && s.viewModeChipTextActive]}>Por categoria</Text>
            </Pressable>
          </View>
          <View style={s.periodChips}>
            {PERIODS.map((p) => {
              const active = p.key === period;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => onPeriodChange(p.key)}
                  style={[s.periodChip, active && s.periodChipActive]}
                >
                  <Text style={[s.periodChipText, active && s.periodChipTextActive]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {viewMode === "produto" && Platform.OS === "web" && products.length > 0 && (
            <Pressable onPress={handleExport} style={s.exportBtn}>
              <Icon name="download" size={12} color={Colors.violet3} />
              <Text style={s.exportBtnText}>Exportar CSV</Text>
            </Pressable>
          )}
        </View>
      </View>

      {viewMode === "categoria" ? (
        <AbcPorCategoria period={period} onDrillToProduct={onDrillToProduct} />
      ) : (
        <>
          {/* Estados: loading / erro / empty / dados */}
          {isLoading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={Colors.violet} />
              <Text style={s.loadingText}>Calculando curva ABC…</Text>
            </View>
          ) : isError ? (
            // 30/05/2026 (fix Eryca): captura erro do react-query antes
            // de subir pro ErrorBoundary global. Cliente continua vendo
            // o resto da tela (Financeiro/Receitas) funcional.
            <View style={s.emptyBox}>
              <Icon name="alert_triangle" size={28} color={Colors.amber} />
              <Text style={s.emptyTitle}>Não foi possível carregar</Text>
              <Text style={s.emptyText}>
                A curva ABC não respondeu agora. As outras seções da tela continuam disponíveis.
              </Text>
              <Pressable onPress={() => { onPageChange(1); refetch(); }} style={s.retryBtn}>
                <Text style={s.retryBtnText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : products.length === 0 ? (
            <View style={s.emptyBox}>
              <Icon name="bar_chart" size={28} color={Colors.ink3} />
              <Text style={s.emptyTitle}>Sem vendas no período</Text>
              <Text style={s.emptyText}>
                {categoryDrill
                  ? `Nenhuma venda de "${categoryDrill}" nesse período.`
                  : "Faça vendas pelo PDV ou registre lançamentos pra ver a curva ABC."}
              </Text>
            </View>
          ) : (
            <>
              {/* Resumo top */}
              <View style={s.summaryRow}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryLabel}>Produtos vendidos</Text>
                  <Text style={s.summaryValue}>{totalProductsAll || products.length}</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={s.summaryLabel}>Unidades</Text>
                  <Text style={s.summaryValue}>{totalSold.toLocaleString("pt-BR")}</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={s.summaryLabel}>Receita total</Text>
                  <Text style={[s.summaryValue, { color: Colors.green }]}>{fmt(totalRevenue)}</Text>
                </View>
              </View>

              {/* Donut + legenda */}
              {donutItems.length > 0 && totalRevenue > 0 && (
                <View style={s.donutRow}>
                  <DonutChart items={donutItems} total={totalRevenue} colorFn={(i) => ABC_COLORS[i % ABC_COLORS.length]} />
                  <View style={s.donutLegend}>
                    {donutItems.map((d, i) => {
                      const pct = totalRevenue > 0 ? Math.round((d.amount / totalRevenue) * 100) : 0;
                      return (
                        <View key={d.category} style={s.legendItem}>
                          <View style={[s.legendDot, { backgroundColor: ABC_COLORS[i] }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.legendLabel}>{d.category}</Text>
                            <Text style={s.legendValue}>{fmt(d.amount)} · {pct}%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Cards A/B/C com breakdown vindo do backend */}
              <View style={s.gradesRow}>
                {classBreakdown.map((b) => {
                  const grade = b.grade as Grade;
                  return (
                    <View key={grade} style={s.gradeCard}>
                      <View style={s.gradeHeader}>
                        <AbcBadge abc={grade} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.gradeTitle}>Curva {grade}</Text>
                          <Text style={s.gradeHint}>{labels[grade]}</Text>
                        </View>
                      </View>
                      <Text style={s.gradeCount}>
                        {b.count} produto{b.count !== 1 ? "s" : ""}
                      </Text>
                      <View style={{ gap: 6, marginTop: 8 }}>
                        <View style={s.barRow}>
                          <Text style={s.barLabel}>Receita</Text>
                          <View style={s.track}>
                            <View style={[s.fill, { width: `${Math.min(100, b.revenue_pct)}%`, backgroundColor: colors[grade] }]} />
                          </View>
                          <Text style={[s.pct, { color: colors[grade] }]}>{b.revenue_pct}%</Text>
                        </View>
                        <View style={s.barRow}>
                          <Text style={s.barLabel}>Qtd vendida</Text>
                          <View style={s.track}>
                            <View style={[s.fill, { width: `${Math.min(100, b.qty_pct)}%`, backgroundColor: colors[grade] }]} />
                          </View>
                          <Text style={[s.pct, { color: colors[grade] }]}>{b.qty_pct}%</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Filtro de classe — substitui o "top 10" simplista */}
              <View style={s.classFilterRow}>
                <Text style={s.classFilterLabel}>Filtrar por classe</Text>
                <View style={s.classChips}>
                  {CLASS_FILTERS.map((c) => {
                    const active = c.key === classFilter;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => onClassFilterChange(c.key)}
                        style={[s.classChip, active && s.classChipActive]}
                      >
                        <Text style={[s.classChipText, active && s.classChipTextActive]}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Tabela paginada — substitui "Top 10 mais vendidos" */}
              <View style={s.rankSection}>
                <View style={s.rankSectionHeader}>
                  <Text style={s.rankTitle}>
                    {classFilter === "ALL" ? "Ranking completo" : `Produtos curva ${classFilter}`}
                  </Text>
                  <Text style={s.rankMeta}>
                    {totalFiltered === 0
                      ? "0 produtos"
                      : `${pageStart + 1}–${pageEnd} de ${totalFiltered}`}
                    {isFetching ? " · atualizando…" : ""}
                  </Text>
                </View>

                {pageItems.length === 0 ? (
                  <View style={s.emptyBoxSmall}>
                    <Text style={s.emptyText}>Nenhum produto nessa classe no período.</Text>
                  </View>
                ) : (
                  pageItems.map((p, idx) => {
                    const grade = ((p.abc || "C") as Grade);
                    const globalIdx = pageStart + idx + 1;
                    const qty = toNum(p.qty_sold ?? p.total_qty);
                    const rev = toNum(p.revenue ?? p.total_revenue);
                    return (
                      <View key={String(p.id ?? globalIdx)} style={s.rankRow}>
                        <Text style={s.rankNum}>{globalIdx}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.rankName} numberOfLines={1}>
                            {p.name || "Produto"}
                            {p.is_active === false ? "  (inativo)" : ""}
                          </Text>
                          {p.category ? <Text style={s.rankCat} numberOfLines={1}>{p.category}</Text> : null}
                        </View>
                        <View style={s.rankRight}>
                          <Text style={s.rankQty}>{qty.toLocaleString("pt-BR")} un</Text>
                          <Text style={s.rankRev}>{fmtK(rev)}</Text>
                        </View>
                        <AbcBadge abc={grade} size={20} />
                      </View>
                    );
                  })
                )}

                <Paginator page={pageSafe} totalPages={totalPages} onPageChange={onPageChange} />
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  subtitleNote: { fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" },
  categoryChip: {
    alignSelf: "flex-start", marginTop: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet,
    borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11,
  },
  categoryChipText: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  viewModeChips: { flexDirection: "row", gap: 4, backgroundColor: Colors.bg4, borderRadius: 8, padding: 3 },
  viewModeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  viewModeChipActive: { backgroundColor: Colors.violet },
  viewModeChipText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  viewModeChipTextActive: { color: "#fff", fontWeight: "700" },
  periodChips: { flexDirection: "row", gap: 4, backgroundColor: Colors.bg4, borderRadius: 8, padding: 3 },
  periodChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  periodChipActive: { backgroundColor: Colors.violet },
  periodChipText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  periodChipTextActive: { color: "#fff", fontWeight: "700" },
  exportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.bg4, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  exportBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  loadingBox: { alignItems: "center", paddingVertical: 32, gap: 8 },
  loadingText: { fontSize: 11, color: Colors.ink3 },
  emptyBox: { alignItems: "center", paddingVertical: 28, gap: 6, paddingHorizontal: 20 },
  emptyBoxSmall: { alignItems: "center", paddingVertical: 18, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700", marginTop: 4 },
  emptyText: { fontSize: 11, color: Colors.ink3, textAlign: "center", lineHeight: 16 },
  retryBtn: {
    marginTop: 14, paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: Colors.violet,
  },
  retryBtnText: { fontSize: 12, color: "#fff", fontWeight: "700" },

  summaryRow: {
    flexDirection: "row", gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14,
  },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  summaryValue: { fontSize: 16, color: Colors.ink, fontWeight: "800", marginTop: 4 },

  donutRow: { flexDirection: "row", alignItems: "center", gap: 20, flexWrap: "wrap" },
  donutLegend: { flex: 1, gap: 8, minWidth: 160 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  legendValue: { fontSize: 10, color: Colors.ink3, marginTop: 1 },

  gradesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gradeCard: {
    flex: 1, minWidth: 160,
    backgroundColor: Colors.bg4,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gradeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  gradeTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  gradeHint: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  gradeCount: { fontSize: 11, color: Colors.ink3 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { fontSize: 9, color: Colors.ink3, width: 70, textTransform: "uppercase", letterSpacing: 0.4 },
  track: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 10, fontWeight: "700", width: 30, textAlign: "right" },

  classFilterRow: {
    marginTop: 6, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    gap: 8,
  },
  classFilterLabel: {
    fontSize: 10, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1,
  },
  classChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  classChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, backgroundColor: Colors.bg4,
    borderWidth: 1, borderColor: Colors.border,
  },
  classChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  classChipText: { fontSize: 11, color: Colors.ink2, fontWeight: "600" },
  classChipTextActive: { color: Colors.violet3, fontWeight: "700" },

  rankSection: { gap: 4 },
  rankSectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  rankTitle: {
    fontSize: 10, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1,
  },
  rankMeta: { fontSize: 10, color: Colors.ink3 },
  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 7, paddingHorizontal: 8,
    borderRadius: 8,
  },
  rankNum: {
    width: 28, textAlign: "right",
    fontSize: 11, color: Colors.ink3, fontWeight: "700",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
  },
  rankName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  rankCat: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  rankRight: { alignItems: "flex-end", minWidth: 80 },
  rankQty: { fontSize: 10, color: Colors.ink3 },
  rankRev: { fontSize: 12, color: Colors.green, fontWeight: "700" },
});

export default AbcCurveCard;
