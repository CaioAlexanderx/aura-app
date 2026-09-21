// ============================================================
// AURA. — AbcPorCategoria (Fase 1 ABC por categoria, 16/09/2026)
//
// Pedido do Caio (16/09): "melhorar ainda mais a curva ABC trazendo a
// categoria e não somente os itens avulsos". Visão irmã da tabela por
// produto do AbcCurveCard — mesmo período, classificação ABC própria
// (categorias não vêm classificadas do backend, só produtos — ver
// abcCategoryUtils.ts pra regra replicada e a razão de replicar aqui).
//
// Multi-CNPJ: assim como useProductsRanking, esta view NUNCA roda em
// consolidatedView — o AbcCurveCard (pai) já retorna o empty state de
// "modo consolidado" antes de montar este componente, mas o enabled do
// useQuery abaixo é defensivo (permite testar/usar este componente
// isolado sem herdar esse contrato implícito do pai).
//
// Hierarquia: products.category grava só o NOME DA FOLHA (não o caminho
// completo — ver comentário longo em abcCategoryUtils.ts). O agrupamento
// "categoria-mãe expansível" é melhor esforço via nome, não FK.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { companiesApi, type ProductCategoryRanking } from "@/services/companiesApi";
import { useAuthStore } from "@/stores/auth";
import { useCategories } from "@/hooks/useCategories";
import { DonutChart } from "@/components/charts/DonutChart";
import { Icon } from "@/components/Icon";
import {
  ABC_COLORS, PERIODS, CLASS_FILTERS, AbcBadge, Paginator, downloadCsv,
  fmt, fmtK, toNum,
  type PeriodKey, type Grade, type ClassFilter,
} from "./abcShared";
import {
  classifyABC, sumRevenue, buildReadingSentence, buildCategoryLookup, buildCategoryDisplayRows,
  categoryCsvRows, CATEGORY_CSV_HEADERS,
  type ClassifiedCategory,
} from "./abcCategoryUtils";

const PAGE_SIZE = 25;

type Props = {
  period: PeriodKey;
  onDrillToProduct: (categoryName: string) => void;
};

export function AbcPorCategoria({ period, onDrillToProduct }: Props) {
  const { company, consolidatedView } = useAuthStore();
  const companyId = company?.id;

  const [classFilter, setClassFilter] = useState<ClassFilter>("ALL");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ProductCategoryRanking[]>({
    queryKey: ["productsCategories", companyId, period],
    queryFn: () => companiesApi.productsCategories(companyId!, period),
    enabled: !!companyId && !consolidatedView,
    staleTime: 60_000,
    retry: 1,
  });

  const { flattened: categoryTree } = useCategories();

  const categories = useMemo<ProductCategoryRanking[]>(() => data || [], [data]);
  const totalRevenue = useMemo(() => sumRevenue(categories), [categories]);
  const totalQty = useMemo(() => categories.reduce((s, c) => s + toNum(c.total_qty), 0), [categories]);

  // Classificação SEMPRE sobre a lista completa (ordem do backend, ver
  // abcCategoryUtils.ts) — a frase de leitura e o donut usam o quadro
  // inteiro, independente do filtro de classe da tabela.
  const classified = useMemo<ClassifiedCategory[]>(
    () => classifyABC(categories, totalRevenue),
    [categories, totalRevenue]
  );

  const classBreakdown = useMemo(() => {
    return (["A", "B", "C"] as Grade[]).map((g) => {
      const items = classified.filter((c) => c.abc === g);
      const rev = items.reduce((s, c) => s + c.total_revenue, 0);
      const qty = items.reduce((s, c) => s + c.total_qty, 0);
      return {
        grade: g,
        count: items.length,
        total_revenue: rev,
        total_qty: qty,
        revenue_pct: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0,
        qty_pct: totalQty > 0 ? Math.round((qty / totalQty) * 100) : 0,
      };
    });
  }, [classified, totalRevenue, totalQty]);

  const donutItems = useMemo(
    () => classBreakdown.map((b) => ({ category: `Curva ${b.grade}`, amount: toNum(b.total_revenue) })).filter((d) => d.amount > 0),
    [classBreakdown]
  );

  const readingSentence = useMemo(() => buildReadingSentence(classified), [classified]);

  const filteredClassified = useMemo(
    () => (classFilter === "ALL" ? classified : classified.filter((c) => c.abc === classFilter)),
    [classified, classFilter]
  );

  const lookup = useMemo(() => buildCategoryLookup(categoryTree), [categoryTree]);
  const displayRows = useMemo(
    () => buildCategoryDisplayRows(filteredClassified, lookup),
    [filteredClassified, lookup]
  );

  const totalFiltered = displayRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = (pageSafe - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalFiltered);
  const pageRows = displayRows.slice(pageStart, pageEnd);

  const labels: Record<Grade, string> = {
    A: "Alta concentração de receita",
    B: "Concentração média",
    C: "Cauda longa",
  };
  const colors: Record<Grade, string> = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };

  function toggleExpanded(parentName: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parentName)) next.delete(parentName);
      else next.add(parentName);
      return next;
    });
  }

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    const periodTxt = (PERIODS.find((p) => p.key === period)?.label || period).toLowerCase();
    const tail = classFilter === "ALL" ? "todos" : `classe-${classFilter}`;
    downloadCsv(
      `curva-abc-categorias-${periodTxt}-${tail}-${stamp}.csv`,
      CATEGORY_CSV_HEADERS,
      categoryCsvRows(filteredClassified)
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {Platform.OS === "web" && categories.length > 0 && (
        <View style={s.exportRow}>
          <Pressable onPress={handleExport} style={s.exportBtn} accessibilityRole="button" accessibilityLabel="Exportar categorias em CSV">
            <Icon name="download" size={12} color={Colors.violet3} />
            <Text style={s.exportBtnText}>Exportar CSV</Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet} />
          <Text style={s.loadingText}>Calculando curva ABC por categoria…</Text>
        </View>
      ) : isError ? (
        <View style={s.emptyBox}>
          <Icon name="alert_triangle" size={28} color={Colors.amber} />
          <Text style={s.emptyTitle}>Não foi possível carregar</Text>
          <Text style={s.emptyText}>
            As categorias não responderam agora. A visão por produto continua disponível.
          </Text>
          <Pressable onPress={() => { setPage(1); refetch(); }} style={s.retryBtn}>
            <Text style={s.retryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : categories.length === 0 ? (
        <View style={s.emptyBox}>
          <Icon name="tag" size={28} color={Colors.ink3} />
          <Text style={s.emptyTitle}>Sem vendas no período</Text>
          <Text style={s.emptyText}>
            Faça vendas de produtos com categoria cadastrada pra ver a curva ABC por categoria.
          </Text>
        </View>
      ) : (
        <>
          {/* Leitura em frase */}
          <View style={s.readingBox}>
            <Icon name="bar_chart" size={14} color={Colors.violet3} />
            <Text style={s.readingText}>{readingSentence}</Text>
          </View>

          {/* Resumo */}
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Categorias vendidas</Text>
              <Text style={s.summaryValue}>{categories.length}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Unidades</Text>
              <Text style={s.summaryValue}>{totalQty.toLocaleString("pt-BR")}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Receita total</Text>
              <Text style={[s.summaryValue, { color: Colors.green }]}>{fmt(totalRevenue)}</Text>
            </View>
          </View>

          {/* Donut A/B/C por categoria */}
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

          {/* Cards A/B/C */}
          <View style={s.gradesRow}>
            {classBreakdown.map((b) => (
              <View key={b.grade} style={s.gradeCard}>
                <View style={s.gradeHeader}>
                  <AbcBadge abc={b.grade} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.gradeTitle}>Curva {b.grade}</Text>
                    <Text style={s.gradeHint}>{labels[b.grade]}</Text>
                  </View>
                </View>
                <Text style={s.gradeCount}>
                  {b.count} categoria{b.count !== 1 ? "s" : ""}
                </Text>
                <View style={{ gap: 6, marginTop: 8 }}>
                  <View style={s.barRow}>
                    <Text style={s.barLabel}>Receita</Text>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${Math.min(100, b.revenue_pct)}%`, backgroundColor: colors[b.grade] }]} />
                    </View>
                    <Text style={[s.pct, { color: colors[b.grade] }]}>{b.revenue_pct}%</Text>
                  </View>
                  <View style={s.barRow}>
                    <Text style={s.barLabel}>Qtd vendida</Text>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${Math.min(100, b.qty_pct)}%`, backgroundColor: colors[b.grade] }]} />
                    </View>
                    <Text style={[s.pct, { color: colors[b.grade] }]}>{b.qty_pct}%</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Filtro de classe */}
          <View style={s.classFilterRow}>
            <Text style={s.classFilterLabel}>Filtrar por classe</Text>
            <View style={s.classChips}>
              {CLASS_FILTERS.map((c) => {
                const active = c.key === classFilter;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => { setClassFilter(c.key); setPage(1); }}
                    style={[s.classChip, active && s.classChipActive]}
                  >
                    <Text style={[s.classChipText, active && s.classChipTextActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Tabela */}
          <View style={s.rankSection}>
            <View style={s.rankSectionHeader}>
              <Text style={s.rankTitle}>
                {classFilter === "ALL" ? "Todas as categorias" : `Categorias curva ${classFilter}`}
              </Text>
              <Text style={s.rankMeta}>
                {totalFiltered === 0 ? "0 categorias" : `${pageStart + 1}–${pageEnd} de ${totalFiltered}`}
                {isFetching ? " · atualizando…" : ""}
              </Text>
            </View>

            {pageRows.length === 0 ? (
              <View style={s.emptyBoxSmall}>
                <Text style={s.emptyText}>Nenhuma categoria nessa classe no período.</Text>
              </View>
            ) : (
              pageRows.map((row, idx) => {
                const globalIdx = pageStart + idx + 1;
                if (row.kind === "leaf") {
                  const c = row.item;
                  return (
                    <Pressable
                      key={c.category}
                      onPress={() => onDrillToProduct(c.category)}
                      style={s.rankRow}
                      accessibilityRole="button"
                      accessibilityLabel={"Ver produtos da categoria " + c.category}
                    >
                      <Text style={s.rankNum}>{globalIdx}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.rankName} numberOfLines={1}>{c.category}</Text>
                        <Text style={s.rankCat} numberOfLines={1}>{c.total_products} produto{c.total_products !== 1 ? "s" : ""}</Text>
                      </View>
                      <View style={s.rankRight}>
                        <Text style={s.rankQty}>{toNum(c.total_qty).toLocaleString("pt-BR")} un</Text>
                        <Text style={s.rankRev}>{fmtK(c.total_revenue)}</Text>
                      </View>
                      <AbcBadge abc={c.abc} size={20} />
                    </Pressable>
                  );
                }

                // Grupo: categoria-mãe com 2+ filhas presentes no ranking.
                const isOpen = expanded.has(row.parentName);
                return (
                  <View key={"grupo-" + row.parentName}>
                    <Pressable
                      onPress={() => toggleExpanded(row.parentName)}
                      style={[s.rankRow, s.groupRow]}
                      accessibilityRole="button"
                      accessibilityLabel={(isOpen ? "Recolher " : "Expandir ") + row.parentName}
                    >
                      <Text style={s.rankNum}>{globalIdx}</Text>
                      <Icon name={isOpen ? "chevron_down" : "chevron_right"} size={12} color={Colors.ink3} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.rankName} numberOfLines={1}>{row.parentName}</Text>
                        <Text style={s.rankCat} numberOfLines={1}>
                          {row.children.length} subcategoria{row.children.length !== 1 ? "s" : ""} · {row.total_products} produto{row.total_products !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View style={s.rankRight}>
                        <Text style={s.rankQty}>{toNum(row.total_qty).toLocaleString("pt-BR")} un</Text>
                        <Text style={s.rankRev}>{fmtK(row.total_revenue)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {row.grades.map((g) => <AbcBadge key={g} abc={g} size={18} />)}
                      </View>
                    </Pressable>
                    {isOpen && row.children.map((child) => (
                      <Pressable
                        key={child.category}
                        onPress={() => onDrillToProduct(child.category)}
                        style={[s.rankRow, s.childRow]}
                        accessibilityRole="button"
                        accessibilityLabel={"Ver produtos da categoria " + child.category}
                      >
                        <Text style={s.rankNum} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.rankName} numberOfLines={1}>{child.category}</Text>
                          <Text style={s.rankCat} numberOfLines={1}>{child.total_products} produto{child.total_products !== 1 ? "s" : ""}</Text>
                        </View>
                        <View style={s.rankRight}>
                          <Text style={s.rankQty}>{toNum(child.total_qty).toLocaleString("pt-BR")} un</Text>
                          <Text style={s.rankRev}>{fmtK(child.total_revenue)}</Text>
                        </View>
                        <AbcBadge abc={child.abc} size={20} />
                      </Pressable>
                    ))}
                  </View>
                );
              })
            )}

            <Paginator page={pageSafe} totalPages={totalPages} onPageChange={setPage} />
          </View>
        </>
      )}
    </View>
  );
}

export default AbcPorCategoria;

const s = StyleSheet.create({
  exportRow: { flexDirection: "row", justifyContent: "flex-end" },
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
  retryBtn: { marginTop: 14, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.violet },
  retryBtnText: { fontSize: 12, color: "#fff", fontWeight: "700" },

  readingBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 12, padding: 12,
  },
  readingText: { flex: 1, fontSize: 12.5, color: Colors.ink, lineHeight: 18, fontWeight: "600" },

  summaryRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
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
  gradeCard: { flex: 1, minWidth: 160, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  gradeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  gradeTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  gradeHint: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  gradeCount: { fontSize: 11, color: Colors.ink3 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { fontSize: 9, color: Colors.ink3, width: 70, textTransform: "uppercase", letterSpacing: 0.4 },
  track: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 10, fontWeight: "700", width: 30, textAlign: "right" },

  classFilterRow: { marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  classFilterLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  classChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  classChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  classChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  classChipText: { fontSize: 11, color: Colors.ink2, fontWeight: "600" },
  classChipTextActive: { color: Colors.violet3, fontWeight: "700" },

  rankSection: { gap: 4 },
  rankSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rankTitle: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  rankMeta: { fontSize: 10, color: Colors.ink3 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8 },
  groupRow: { backgroundColor: Colors.bg4 },
  childRow: { paddingLeft: 24 },
  rankNum: {
    width: 28, textAlign: "right", fontSize: 11, color: Colors.ink3, fontWeight: "700",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
  },
  rankName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  rankCat: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  rankRight: { alignItems: "flex-end", minWidth: 80 },
  rankQty: { fontSize: 10, color: Colors.ink3 },
  rankRev: { fontSize: 12, color: Colors.green, fontWeight: "700" },
});
