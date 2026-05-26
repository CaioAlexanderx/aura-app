// FASE 4.1 (18/05/2026): ROLLBACK conceitual da Vitrine.
//
// A Fase 4 (PR aura-app #83) tentou separar "destaques" (★) e "ocultos" (👁)
// em dois botões distintos, com featured_product_ids virando ORDEM em vez de
// INCLUSION list. Ficou conceitualmente confuso. Usuário pediu o modelo simples:
//
//   featured_product_ids[] = INCLUSION list (= os produtos que aparecem na vitrine).
//     - Vazio  => mostra TODOS os produtos ativos (default p/ lojas novas).
//     - Cheio  => mostra SÓ os listados, na ordem do array (curadoria).
//
//   hidden_product_ids[] = coluna DORMENTE. Backend continua aceitando/devolvendo,
//   mas a UI não usa mais. Não dropar — manteremos o schema intacto.
//
// UI:
//   - UM Switch por linha, reflete diretamente `featured.has(id)`.
//   - Em modo automático todos os switches mostram OFF (featured é vazio) MAS
//     o banner explica que todos estão visíveis. Clicar ON em modo automático
//     adiciona aquele produto a featured e transita pra curadoria (só ele vai
//     aparecer). É o comportamento pré-Fase 4 exato.
//   - Dual-mode banner no topo:
//       featured.size === 0 → verde "modo automático: todos aparecem".
//       featured.size  >  0 → âmbar "modo personalizado: só X de Y aparecem"
//                             + botão "Mostrar todos novamente".
//   - KPIs: Total no estoque / Na vitrine / Ocultos.
//   - Filtros (chips): Todos / Na vitrine / Ocultos / Sem estoque.
//   - Bulk: Marcar / Desmarcar / Limpar (sem mais ★ e 👁).
//
// PERFORMANCE: query paginada (60/página) com debounce 350ms na busca. Set
// featured persiste entre páginas independente da página visível.

import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch, Platform, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { HoverRow } from "@/components/HoverRow";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { useChannelStyles } from "./shared";
import { useAccent } from "@/contexts/AccentTheme";
import type { AccentTokens } from "@/contexts/AccentTheme";

const PAGE_SIZE = 60;
const SAVE_DEBOUNCE_MS = 800;

type FilterKey = "all" | "in_storefront" | "hidden" | "out_of_stock";

type Props = { config: any; saveConfig: (data: any) => Promise<void>; isSaving: boolean };

export function TabVitrine({ config, saveConfig, isSaving }: Props) {
  const cs = useChannelStyles();
  const accent = useAccent();
  const s = useMemo(() => buildStyles(accent), [accent]);
  const { company } = useAuthStore();
  const cid = company?.id;

  // Set local de IDs que aparecem na vitrine (= featured_product_ids).
  // Vazio = modo automático (mostra TODOS). Cheio = modo curadoria.
  const [featured, setFeatured] = useState<Set<string>>(() => new Set(config.featured_product_ids || []));
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
    setShowPrices(config.show_prices ?? true);
    setShowStock(config.show_stock ?? false);
  }, [
    (config.featured_product_ids || []).join(","),
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

  // Modo automático = featured vazio (todos visíveis na vitrine pública).
  const isAutoMode = featured.size === 0;

  // Cada produto ganha 2 derived flags:
  //   - is_marked    : está em featured (= switch ON, sempre)
  //   - is_in_storefront : aparece de fato na loja pública (auto OU is_marked)
  const products = useMemo(() => rawProducts.map((p: any) => {
    const id = p.id || p.product_id;
    const isMarked = featured.has(id);
    return {
      ...p,
      _id: id,
      is_marked: isMarked,
      is_in_storefront: isAutoMode ? true : isMarked,
    };
  }), [rawProducts, featured, isAutoMode]);

  // Filtros locais em cima da página visível.
  const visibleProducts = useMemo(() => {
    if (filter === "all") return products;
    return products.filter((p) => {
      if (filter === "in_storefront") return p.is_in_storefront;
      if (filter === "hidden") return !p.is_in_storefront;
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

  function scheduleSave(nextFeatured: Set<string>, nextShowPrices?: boolean, nextShowStock?: boolean) {
    setSavingPill(true);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await saveConfig({
          featured_product_ids: Array.from(nextFeatured),
          show_prices: nextShowPrices ?? showPrices,
          show_stock: nextShowStock ?? showStock,
        });
      } finally {
        setSavingPill(false);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  // Toggle simples: add/remove de featured. Switch sempre reflete featured.has(id).
  // - Em modo automático, todos os switches mostram OFF (featured vazio).
  //   Clicar ON em qualquer produto adiciona a featured e transita pra curadoria
  //   com SÓ esse produto visível. Banner amarelo aparece dizendo "X de Y".
  // - Em modo curadoria, ON/OFF adiciona/remove. Se chegar em vazio, volta pra auto.
  function toggleVisible(id: string) {
    setFeatured((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      scheduleSave(next);
      return next;
    });
  }

  function handleShowPricesChange(v: boolean) {
    setShowPrices(v);
    scheduleSave(featured, v, showStock);
  }

  function handleShowStockChange(v: boolean) {
    setShowStock(v);
    scheduleSave(featured, showPrices, v);
  }

  function clearCuration() {
    // Volta pro modo automático (todos visíveis).
    const empty = new Set<string>();
    setFeatured(empty);
    scheduleSave(empty);
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

  // Bulk "Marcar": adicionar selecionados ao featured.
  // Em modo automatico, marcar 5 produtos transita pra curadoria com SO esses 5
  // visiveis. Banner amarelo aparece explicando.
  function bulkMark() {
    if (selected.size === 0) return;
    const next = new Set(featured);
    selected.forEach((id) => next.add(id));
    setFeatured(next);
    scheduleSave(next);
  }

  // Bulk "Desmarcar": remover selecionados do featured.
  // Em modo automatico, "desmarcar" nao faz nada (nada esta marcado).
  function bulkUnmark() {
    if (selected.size === 0) return;
    if (isAutoMode) return; // no-op em modo automatico
    const next = new Set(featured);
    selected.forEach((id) => next.delete(id));
    setFeatured(next);
    scheduleSave(next);
  }

  // ============ RENDER ============

  // Contagens. No modo automático, "na vitrine" = total (todos), "ocultos" = 0.
  const inStorefrontCount = isAutoMode ? total : featured.size;
  const hiddenCount = isAutoMode ? 0 : Math.max(0, total - featured.size);
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((p) => selected.has(p._id));

  const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "in_storefront", label: "Na vitrine" },
    { key: "hidden", label: "Ocultos" },
    { key: "out_of_stock", label: "Sem estoque" },
  ];

  return (
    <View>
      {/* Banner dual-mode (auto vs curadoria) */}
      {isAutoMode ? (
        <View style={[s.modeBanner, s.modeBannerAuto]}>
          <View style={[s.modeIcon, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
            <Icon name="check" size={18} color={Colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.modeTitle}>Modo automático: todos os produtos aparecem</Text>
            <Text style={s.modeDesc}>
              Sua loja mostra todos os <Text style={s.modeStrong}>{total}</Text> produtos ativos por padrão.
              Marque produtos abaixo pra entrar em modo curadoria e exibir só os escolhidos.
            </Text>
          </View>
        </View>
      ) : (
        <View style={[s.modeBanner, s.modeBannerCurated]}>
          <View style={[s.modeIcon, { backgroundColor: Colors.amberD, borderColor: Colors.amber }]}>
            <Icon name="star" size={18} color={Colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.modeTitle}>Modo personalizado: {inStorefrontCount} de {total} produtos</Text>
            <Text style={s.modeDesc}>
              Sua loja exibe apenas os <Text style={s.modeStrong}>{inStorefrontCount}</Text> marcados.
              Os outros <Text style={s.modeStrong}>{hiddenCount}</Text> ficam ocultos do público.
            </Text>
          </View>
          <Pressable onPress={clearCuration} style={s.modeBtn}>
            <Text style={s.modeBtnText}>Mostrar todos novamente</Text>
          </Pressable>
        </View>
      )}

      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>TOTAL NO ESTOQUE</Text>
          <Text style={s.kpiValue}>{total}</Text>
          <Text style={s.kpiSub}>todos os produtos cadastrados</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>NA VITRINE</Text>
          <Text style={[s.kpiValue, { color: Colors.green }]}>{inStorefrontCount}</Text>
          <Text style={s.kpiSub}>aparecem na loja digital</Text>
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
        {isFetching && <ActivityIndicator size="small" color={accent.primaryStrong} />}
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
            <Pressable onPress={bulkMark} style={[s.bulkBtn, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
              <Text style={[s.bulkBtnText, { color: Colors.green }]}>Marcar na vitrine</Text>
            </Pressable>
            {!isAutoMode && (
              <Pressable onPress={bulkUnmark} style={[s.bulkBtn, { backgroundColor: Colors.redD, borderColor: Colors.red }]}>
                <Text style={[s.bulkBtnText, { color: Colors.red }]}>Desmarcar</Text>
              </Pressable>
            )}
            <Pressable onPress={clearSelection} style={s.bulkBtn}>
              <Text style={s.bulkBtnText}>Limpar seleção</Text>
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
            const isMarked = prod.is_marked;
            const isInStorefront = prod.is_in_storefront;
            const isSelected = selected.has(id);
            const stock = prod.stock_qty ?? prod.stock ?? prod.quantity ?? null;

            // Visual da linha:
            //   - Em curadoria + marcado: bg violet (destaque visual)
            //   - Em curadoria + nao marcado: opacity 0.6 (esmaecido, NAO aparece)
            //   - Em auto: bg transparente padrao (todos aparecem igual)
            const rowBg = !isAutoMode && isMarked ? accent.primarySoft : "transparent";
            const rowOpacity = !isAutoMode && !isMarked ? 0.6 : 1;

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
                        <View style={[s.prodIcon, { backgroundColor: accent.primarySoft }]}>
                          <Icon name="package" size={18} color={accent.primaryStrong} />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={[s.prodIcon, { backgroundColor: isMarked ? accent.primarySoft : Colors.bg4 }]}>
                      <Icon name="package" size={18} color={isMarked ? accent.primaryStrong : Colors.ink3} />
                    </View>
                  )}
                  <View style={s.prodInfo}>
                    <Text style={s.prodName} numberOfLines={1}>{prod.name}</Text>
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
                  {/* Switch único reflete diretamente featured.has(id).
                      Em modo automatico mostra OFF (mas o banner explica
                      que todos aparecem por padrao). */}
                  <View style={s.switchWrap}>
                    <Text style={s.switchSideLabel}>{isAutoMode ? "Marcar" : "Aparece na vitrine"}</Text>
                    <Switch
                      value={isMarked}
                      onValueChange={() => toggleVisible(id)}
                      trackColor={{ true: accent.primary, false: Colors.bg4 }}
                      thumbColor="#fff"
                    />
                  </View>
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

function buildStyles(accent: AccentTokens) {
  return StyleSheet.create({
  // Banner dual-mode
  modeBanner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    alignItems: "center",
  },
  modeBannerAuto:    { backgroundColor: Colors.greenD, borderColor: Colors.green },
  modeBannerCurated: { backgroundColor: Colors.amberD, borderColor: Colors.amber },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modeTitle:  { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  modeDesc:   { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  modeStrong: { fontWeight: "700", color: Colors.ink },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  modeBtnText: { fontSize: 12, color: Colors.ink2, fontWeight: "700" },

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
  filterChipActive: { backgroundColor: accent.primarySoft, borderColor: accent.primary },
  filterChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  filterChipTextActive: { color: accent.primaryStrong, fontWeight: "700" },

  // Bulk bar
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    backgroundColor: accent.primarySoft,
    borderWidth: 1,
    borderColor: accent.primary,
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
    borderColor: accent.primaryStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg3,
  },
  bulkCheckboxActive: { backgroundColor: accent.primary, borderColor: accent.primary },
  bulkCheckboxMark: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 13 },
  bulkCount: { fontSize: 12, color: accent.primaryStrong, fontWeight: "700" },
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
  checkboxActive: { backgroundColor: accent.primary, borderColor: accent.primary },
  checkboxMark: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 13 },
  prodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  prodImg: { width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  prodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  prodInfo: { flex: 1, minWidth: 0 },
  prodName: { fontSize: 13, color: Colors.ink, fontWeight: "600", flexShrink: 1 },
  prodMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  prodRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  prodPrice: { fontSize: 12, color: Colors.ink2, fontWeight: "700", marginRight: 4 },

  // Switch "aparece na vitrine"
  switchWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchSideLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },

  // Paginação
  pageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 4, gap: 8 },
  pageBtn: { backgroundColor: accent.primarySoft, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  pageBtnDisabled: { opacity: 0.35 },
  // WCAG AA: 13px magenta sobre primarySoft (#EFF6FF) — fontWeight 700 garante ratio ≥3:1.
  pageBtnText: { fontSize: 13, color: accent.primaryStrong, fontWeight: "700" },
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
    backgroundColor: accent.primary,
  },
  savingPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  });
}
