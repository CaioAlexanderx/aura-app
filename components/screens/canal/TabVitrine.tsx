// FASE 4 (18/05/2026): Redesign Vitrine — "Todos + Destaques" (NÃO filtro)
//
// MUDANÇA CONCEITUAL:
//   Antes: featured_product_ids[] funcionava como FILTRO — marcar 5 produtos
//          escondia todo o resto da vitrine pública. UX confusa, anti-pattern
//          documentado em memory/ux_tabvitrine_filtrar_vs_destacar.
//
//   Agora:
//     - Todos os produtos aparecem na vitrine por padrão.
//     - Star (★) -> featured_product_ids[] = ordem (aparece PRIMEIRO).
//     - Eye (👁) -> hidden_product_ids[] = esconde da vitrine pública.
//
// CONTRATO DA API (Aura-backend Fase 4 PR A — em paralelo):
//   GET /companies/:id/products já retorna lista; flags is_featured/is_hidden
//   são derivadas client-side via Set<string> contra config.featured_product_ids
//   e config.hidden_product_ids. Se o backend evoluir e passar a retornar as
//   flags no payload do produto, o código continua funcionando (override local).
//
//   PATCH /digital-channel/config (via saveConfig) aceita:
//     - featured_product_ids: string[]
//     - hidden_product_ids:   string[]   (depende do PR A; se backend ignorar
//                                         a coluna inexistente, o array não
//                                         persiste mas frontend não quebra)
//
// PERFORMANCE: query paginada (60/página) com debounce 350ms na busca, igual
// antes. Selecionados (featured + hidden) persistem via Set<string> entre
// páginas independente da página visível.

import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch, Platform, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { HoverRow } from "@/components/HoverRow";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { cs } from "./shared";

const PAGE_SIZE = 60;
const SAVE_DEBOUNCE_MS = 800;

type FilterKey = "all" | "featured" | "hidden" | "out_of_stock";

type Props = { config: any; saveConfig: (data: any) => Promise<void>; isSaving: boolean };

export function TabVitrine({ config, saveConfig, isSaving }: Props) {
  const { company } = useAuthStore();
  const cid = company?.id;

  // Sets locais — fonte de verdade enquanto o usuário interage. Sincronizados
  // de volta com config após cada save ou quando o config muda externamente.
  const [featured, setFeatured] = useState<Set<string>>(() => new Set(config.featured_product_ids || []));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(config.hidden_product_ids || []));
  const [showPrices, setShowPrices] = useState(config.show_prices ?? true);
  const [showStock, setShowStock] = useState(config.show_stock ?? false);
  const [savingPill, setSavingPill] = useState(false);

  // Busca + paginação
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filtro ativo
  const [filter, setFilter] = useState<FilterKey>("all");

  // Save debounce
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronia config -> estado local (quando muda externamente)
  useEffect(() => {
    setFeatured(new Set(config.featured_product_ids || []));
    setHidden(new Set(config.hidden_product_ids || []));
    setShowPrices(config.show_prices ?? true);
    setShowStock(config.show_stock ?? false);
  }, [
    (config.featured_product_ids || []).join(","),
    (config.hidden_product_ids || []).join(","),
    config.show_prices,
    config.show_stock,
  ]);

  function handleSearchChange(text: string) {
    setSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(text);
      setPage(0);
    }, 350);
  }

  // Query paginada (mesma do antigo TabVitrine pra evitar trava com 4950+ produtos)
  const { data, isFetching } = useQuery({
    queryKey: ["products-vitrine", cid, debouncedSearch, page],
    queryFn: () => request<any>(
      `/companies/${cid}/products?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`
    ),
    enabled: !!cid,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const rawProducts: any[] = data?.products || [];
  const total: number = data?.total ?? 0;

  // Deriva is_featured/is_hidden client-side (se backend já mandar, usa o do payload)
  const products = useMemo(() => rawProducts.map((p: any) => {
    const id = p.id || p.product_id;
    return {
      ...p,
      _id: id,
      is_featured: typeof p.is_featured === "boolean" ? p.is_featured : featured.has(id),
      is_hidden: typeof p.is_hidden === "boolean" ? p.is_hidden : hidden.has(id),
    };
  }), [rawProducts, featured, hidden]);

  // Aplica filtro local em cima da página atual.
  // OBS: filtros "featured"/"hidden" idealmente seriam server-side num futuro PR
  // pra refletir o conjunto completo, não só a página visível. Por enquanto
  // filtra a página corrente.
  const visibleProducts = useMemo(() => {
    if (filter === "all") return products;
    return products.filter((p) => {
      if (filter === "featured") return p.is_featured;
      if (filter === "hidden") return p.is_hidden;
      if (filter === "out_of_stock") {
        const stock = p.stock_qty ?? p.stock ?? p.quantity ?? null;
        return stock !== null && Number(stock) <= 0;
      }
      return true;
    });
  }, [products, filter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  // ============ AÇÕES ============

  function scheduleSave(nextFeatured: Set<string>, nextHidden: Set<string>, nextShowPrices?: boolean, nextShowStock?: boolean) {
    setSavingPill(true);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await saveConfig({
          featured_product_ids: Array.from(nextFeatured),
          hidden_product_ids: Array.from(nextHidden),
          show_prices: nextShowPrices ?? showPrices,
          show_stock: nextShowStock ?? showStock,
        });
      } finally {
        setSavingPill(false);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function toggleFeatured(id: string) {
    setFeatured((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      scheduleSave(next, hidden);
      return next;
    });
  }

  function toggleHidden(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      scheduleSave(featured, next);
      return next;
    });
  }

  function handleShowPricesChange(v: boolean) {
    setShowPrices(v);
    scheduleSave(featured, hidden, v, showStock);
  }

  function handleShowStockChange(v: boolean) {
    setShowStock(v);
    scheduleSave(featured, hidden, showPrices, v);
  }

  // ----- Bulk -----
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const allIds = visibleProducts.map((p) => p._id);
    const allSelected = allIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function bulkFeature() {
    if (selected.size === 0) return;
    const next = new Set(featured);
    selected.forEach((id) => next.add(id));
    setFeatured(next);
    scheduleSave(next, hidden);
  }

  function bulkUnfeature() {
    if (selected.size === 0) return;
    const next = new Set(featured);
    selected.forEach((id) => next.delete(id));
    setFeatured(next);
    scheduleSave(next, hidden);
  }

  function bulkHide() {
    if (selected.size === 0) return;
    const next = new Set(hidden);
    selected.forEach((id) => next.add(id));
    setHidden(next);
    scheduleSave(featured, next);
  }

  function bulkShow() {
    if (selected.size === 0) return;
    const next = new Set(hidden);
    selected.forEach((id) => next.delete(id));
    setHidden(next);
    scheduleSave(featured, next);
  }

  // ============ RENDER ============

  const featuredCount = featured.size;
  const hiddenCount = hidden.size;
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((p) => selected.has(p._id));

  const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "featured", label: "Em destaque ★" },
    { key: "hidden", label: "Ocultos 👁" },
    { key: "out_of_stock", label: "Sem estoque" },
  ];

  return (
    <View>
      {/* Banner explicativo */}
      <View style={s.eduBanner}>
        <View style={s.eduIcon}>
          <Icon name="star" size={18} color={Colors.violet3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eduTitle}>Todos seus produtos aparecem na vitrine por padrão</Text>
          <Text style={s.eduDesc}>
            Os <Text style={s.eduStrong}>destaques</Text> (estrela) aparecem primeiro; o resto vem depois.{" "}
            Use <Text style={s.eduStrong}>"Ocultar"</Text> (olho) só pra esconder produtos específicos da vitrine sem precisar tirar do estoque.
          </Text>
        </View>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>TOTAL NO ESTOQUE</Text>
          <Text style={s.kpiValue}>{total}</Text>
          <Text style={s.kpiSub}>todos os produtos cadastrados</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>EM DESTAQUE</Text>
          <Text style={[s.kpiValue, { color: Colors.amber }]}>{featuredCount}</Text>
          <Text style={s.kpiSub}>aparecem primeiro na vitrine</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>OCULTOS</Text>
          <Text style={[s.kpiValue, { color: hiddenCount > 0 ? Colors.red : Colors.ink3 }]}>{hiddenCount}</Text>
          <Text style={s.kpiSub}>não aparecem na vitrine</Text>
        </View>
      </View>

      {/* Toggles globais */}
      <View style={cs.card}>
        <View style={cs.switchRow}>
          <Text style={cs.switchLabel}>Mostrar preços na vitrine</Text>
          <Switch
            value={showPrices}
            onValueChange={handleShowPricesChange}
            trackColor={{ true: Colors.green, false: Colors.bg4 }}
            thumbColor="#fff"
          />
        </View>
        <View style={[cs.switchRow, { borderBottomWidth: 0 }]}>
          <Text style={cs.switchLabel}>Mostrar estoque na vitrine</Text>
          <Switch
            value={showStock}
            onValueChange={handleShowStockChange}
            trackColor={{ true: Colors.green, false: Colors.bg4 }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Busca */}
      <View style={s.searchRow}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar produto por nome ou SKU..."
          placeholderTextColor={Colors.ink3}
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {isFetching && <ActivityIndicator size="small" color={Colors.violet3} />}
      </View>

      {/* Filtros (chips) */}
      <View style={s.filterRow}>
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setFilter(opt.key)}
              style={[s.filterChip, active && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <View style={s.bulkBar}>
          <Pressable onPress={selectAllVisible} style={s.bulkCheckRow}>
            <View style={[s.bulkCheckbox, allVisibleSelected && s.bulkCheckboxActive]}>
              {allVisibleSelected && <Text style={s.bulkCheckboxMark}>✓</Text>}
            </View>
            <Text style={s.bulkCount}>{selected.size} produto{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}</Text>
          </Pressable>
          <View style={s.bulkBtns}>
            <Pressable onPress={bulkFeature} style={[s.bulkBtn, { backgroundColor: Colors.amberD, borderColor: Colors.amber }]}>
              <Text style={[s.bulkBtnText, { color: Colors.amber }]}>★ Destacar</Text>
            </Pressable>
            <Pressable onPress={bulkUnfeature} style={s.bulkBtn}>
              <Text style={s.bulkBtnText}>Tirar destaque</Text>
            </Pressable>
            <Pressable onPress={bulkHide} style={[s.bulkBtn, { backgroundColor: Colors.redD, borderColor: Colors.red }]}>
              <Text style={[s.bulkBtnText, { color: Colors.red }]}>👁 Ocultar</Text>
            </Pressable>
            <Pressable onPress={bulkShow} style={s.bulkBtn}>
              <Text style={s.bulkBtnText}>Mostrar</Text>
            </Pressable>
            <Pressable onPress={clearSelection} style={s.bulkBtn}>
              <Text style={s.bulkBtnText}>Limpar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Lista */}
      {visibleProducts.length === 0 && !isFetching ? (
        <View style={s.emptyBox}>
          <Icon name="package" size={28} color={Colors.ink3} />
          <Text style={s.emptyText}>
            {debouncedSearch ? "Nenhum produto encontrado" : filter !== "all" ? "Nenhum produto nesse filtro" : "Nenhum produto cadastrado"}
          </Text>
          <Text style={s.emptyHint}>
            {debouncedSearch
              ? "Tente outro termo de busca."
              : filter !== "all"
                ? "Mude o filtro ou navegue entre as páginas."
                : "Cadastre produtos no Estoque para exibi-los na vitrine."}
          </Text>
        </View>
      ) : (
        <View style={cs.card}>
          {visibleProducts.map((prod: any) => {
            const id = prod._id;
            const isFeatured = prod.is_featured;
            const isHidden = prod.is_hidden;
            const isSelected = selected.has(id);
            const stock = prod.stock_qty ?? prod.stock ?? prod.quantity ?? null;

            // Linha hidden ganha precedência visual sobre featured
            const rowBg = isHidden
              ? Colors.bg4
              : isFeatured
                ? Colors.amberD
                : "transparent";
            const rowOpacity = isHidden ? 0.55 : 1;

            return (
              <HoverRow key={id} style={[s.prodRow, { backgroundColor: rowBg, opacity: rowOpacity }]}>
                {/* Bulk checkbox */}
                <Pressable onPress={() => toggleSelect(id)} style={s.checkboxBtn} hitSlop={6}>
                  <View style={[s.checkbox, isSelected && s.checkboxActive]}>
                    {isSelected && <Text style={s.checkboxMark}>✓</Text>}
                  </View>
                </Pressable>

                <View style={s.prodLeft}>
                  {prod.image_url ? (
                    <View style={s.prodImg}>
                      {Platform.OS === "web" ? (
                        <img src={prod.image_url} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} />
                      ) : (
                        <View style={[s.prodIcon, { backgroundColor: Colors.violetD }]}>
                          <Icon name="package" size={18} color={Colors.violet3} />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={[s.prodIcon, { backgroundColor: isFeatured ? Colors.amberD : Colors.bg4 }]}>
                      <Icon name="package" size={18} color={isFeatured ? Colors.amber : Colors.ink3} />
                    </View>
                  )}
                  <View style={s.prodInfo}>
                    <View style={s.prodNameRow}>
                      <Text style={s.prodName} numberOfLines={1}>{prod.name}</Text>
                      {isHidden && (
                        <View style={s.hiddenBadge}>
                          <Text style={s.hiddenBadgeText}>OCULTO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.prodMeta} numberOfLines={1}>
                      {prod.category ? `${prod.category}` : ""}
                      {prod.category && stock !== null ? " · " : ""}
                      {stock !== null ? `${Number(stock)} em estoque` : ""}
                    </Text>
                  </View>
                </View>

                <View style={s.prodRight}>
                  {showPrices && (
                    <Text style={s.prodPrice}>R$ {(parseFloat(prod.price) || 0).toFixed(2)}</Text>
                  )}
                  {/* Star (★) */}
                  <Pressable
                    onPress={() => toggleFeatured(id)}
                    style={[s.iconBtn, isFeatured && s.iconBtnStarActive]}
                    hitSlop={6}
                  >
                    <Text style={[s.iconBtnText, { color: isFeatured ? "#fff" : Colors.ink2 }]}>★</Text>
                  </Pressable>
                  {/* Eye (👁) */}
                  <Pressable
                    onPress={() => toggleHidden(id)}
                    style={[s.iconBtn, isHidden && s.iconBtnEyeActive]}
                    hitSlop={6}
                  >
                    <Text style={[s.iconBtnText, { color: isHidden ? "#fff" : Colors.ink2 }]}>{isHidden ? "🚫" : "👁"}</Text>
                  </Pressable>
                </View>
              </HoverRow>
            );
          })}
        </View>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <View style={s.pageRow}>
          <Pressable onPress={() => setPage((p) => p - 1)} disabled={!hasPrev} style={[s.pageBtn, !hasPrev && s.pageBtnDisabled]}>
            <Text style={[s.pageBtnText, !hasPrev && { color: Colors.ink3 }]}>← Anterior</Text>
          </Pressable>
          <Text style={s.pageInfo}>Página {page + 1} de {totalPages}</Text>
          <Pressable onPress={() => setPage((p) => p + 1)} disabled={!hasNext} style={[s.pageBtn, !hasNext && s.pageBtnDisabled]}>
            <Text style={[s.pageBtnText, !hasNext && { color: Colors.ink3 }]}>Próxima →</Text>
          </Pressable>
        </View>
      )}

      {/* Saving pill flutuante */}
      {(savingPill || isSaving) && (
        <View style={s.savingPill}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={s.savingPillText}>Salvando...</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // Banner explicativo
  eduBanner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  eduIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bg3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eduTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  eduDesc: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  eduStrong: { fontWeight: "700", color: Colors.violet3 },

  // KPIs
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, textAlign: "center" },
  kpiValue: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  kpiSub: { fontSize: 10, color: Colors.ink3, marginTop: 4, textAlign: "center" },

  // Busca
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, marginTop: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.ink, outlineStyle: "none" } as any,

  // Filtros
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  filterChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  filterChipTextActive: { color: Colors.violet3, fontWeight: "700" },

  // Bulk bar
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.violet,
    marginBottom: 10,
    gap: 12,
    flexWrap: "wrap",
  },
  bulkCheckRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bulkCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.violet3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg3,
  },
  bulkCheckboxActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  bulkCheckboxMark: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 13 },
  bulkCount: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  bulkBtns: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  bulkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bulkBtnText: { fontSize: 11, color: Colors.ink2, fontWeight: "600" },

  // Linha produto
  prodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  checkboxBtn: { padding: 4 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg3,
  },
  checkboxActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkboxMark: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 13 },
  prodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  prodImg: { width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  prodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  prodInfo: { flex: 1, minWidth: 0 },
  prodNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  prodName: { fontSize: 13, color: Colors.ink, fontWeight: "600", flexShrink: 1 },
  prodMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  hiddenBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.redD,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  hiddenBadgeText: { fontSize: 8, fontWeight: "800", color: Colors.red, letterSpacing: 0.4 },
  prodRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  prodPrice: { fontSize: 12, color: Colors.ink2, fontWeight: "700", marginRight: 4 },

  // Botões de ação (star/eye)
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.bg3,
  },
  iconBtnText: { fontSize: 14, fontWeight: "800" },
  iconBtnStarActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  iconBtnEyeActive: { backgroundColor: Colors.red, borderColor: Colors.red },

  // Paginação
  pageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 4, gap: 8 },
  pageBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageInfo: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },

  // Empty state
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 8, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 280 },

  // Pill "Salvando..."
  savingPill: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.violet,
  },
  savingPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
