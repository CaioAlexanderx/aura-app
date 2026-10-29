// VITRINE: OCULTAR (tq-57, 29/10/2026).
//
// O switch de cada linha diz "aparece na loja". Desligar OCULTA o produto
// (grava em hidden_product_ids); o resto aparece sozinho, inclusive o
// produto cadastrado amanhã. Antes, desligar um produto montava a lista de
// inclusão (featured_product_ids) com TODOS os outros, e dali em diante
// produto novo não entrava na loja sem alguém lembrar — a Felic Adega
// escondeu 4 produtos gravando 149.
//
// Lojas que já têm a lista de inclusão seguem mostrando exatamente o mesmo
// (o backend aplica as duas regras, e o oculto ganha). Para elas o aviso do
// topo explica que produto novo não entra sozinho e oferece "Mostrar todos
// novamente". A regra de quem aparece mora em ./vitrineVisibilidade.ts,
// espelho da NA_VITRINE do backend.
//
// Histórico: a Fase 4 (app #83) tentou destaque + oculto em dois botões e a
// Fase 4.1 (18/05/2026) voltou para a lista de inclusão pura.
//
// PERFORMANCE: query paginada (60/página) com debounce 350ms na busca. As
// listas persistem entre páginas independente da página visível.

import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch, Platform, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { DeixarLojaPronta } from "./DeixarLojaPronta";
import { HoverRow } from "@/components/HoverRow";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { useChannelStyles } from "./shared";
import { useAccent } from "@/contexts/AccentTheme";
// F0: a navegacao por categoria da loja depende de produto vinculado a
// arvore. Produto sem categoria some da navegacao mesmo estando na
// vitrine -- por isso o aviso vive AQUI, na aba que decide o que aparece.
import { useRouter } from "expo-router";
import { useUnclassifiedProducts } from "@/hooks/useUnclassifiedProducts";
import type { AccentTokens } from "@/contexts/AccentTheme";
import {
  type Visibilidade, alternar, apareceNaLoja, contagens, mostrar, mostrarTodos, ocultar,
  paraSalvar, usaListaDeInclusao,
} from "./vitrineVisibilidade";

const PAGE_SIZE = 60;
const SAVE_DEBOUNCE_MS = 800;

type FilterKey = "all" | "in_storefront" | "hidden" | "out_of_stock";

type Props = { config: any; saveConfig: (data: any) => Promise<void>; isSaving: boolean };

export function TabVitrine({ config, saveConfig, isSaving }: Props) {
  const cs = useChannelStyles();
  const accent = useAccent();
  const s = useMemo(() => buildStyles(accent), [accent]);
  const { company } = useAuthStore();
  const router = useRouter();
  // Só a contagem interessa aqui; a tela de lote faz o trabalho.
  const { total: semCategoria } = useUnclassifiedProducts({ limit: 1 });
  const cid = company?.id;

  // Ocultos (hidden_product_ids) e a lista de inclusão antiga
  // (featured_product_ids, só nas lojas que já tinham).
  const [vis, setVis] = useState<Visibilidade>(() => lerVisibilidade(config));
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
    setVis(lerVisibilidade(config));
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

  // Loja que ainda usa a lista de inclusão antiga: só mostra uma seleção.
  const comLista = usaListaDeInclusao(vis);

  // is_in_storefront: aparece de fato na loja pública (= switch ligado).
  const products = useMemo(() => rawProducts.map((p: any) => {
    const id = String(p.id || p.product_id);
    return { ...p, _id: id, is_in_storefront: apareceNaLoja(vis, id) };
  }), [rawProducts, vis]);

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

  function scheduleSave(nextVis: Visibilidade, nextShowPrices?: boolean, nextShowStock?: boolean) {
    setSavingPill(true);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await saveConfig({
          ...paraSalvar(nextVis),
          show_prices: nextShowPrices ?? showPrices,
          show_stock: nextShowStock ?? showStock,
        });
      } finally {
        setSavingPill(false);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  // Desligar oculta; ligar tira dos ocultos (e, na loja com a lista antiga,
  // põe na lista — senão o produto continuaria fora).
  function aplicar(next: Visibilidade) {
    setVis(next);
    scheduleSave(next);
  }

  function toggleVisible(id: string) {
    aplicar(alternar(vis, id));
  }

  function handleShowPricesChange(v: boolean) {
    setShowPrices(v);
    scheduleSave(vis, v, showStock);
  }

  function handleShowStockChange(v: boolean) {
    setShowStock(v);
    scheduleSave(vis, showPrices, v);
  }

  function clearCuration() {
    // Todos aparecem: sem lista de inclusão e sem ocultos.
    aplicar(mostrarTodos());
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

  // Bulk: mostrar ou ocultar os selecionados de uma vez.
  function bulkMark() {
    if (selected.size === 0) return;
    aplicar(mostrar(vis, selected));
  }

  function bulkUnmark() {
    if (selected.size === 0) return;
    aplicar(ocultar(vis, selected));
  }

  // ============ RENDER ============

  const { naLoja: inStorefrontCount, ocultos: hiddenCount } = contagens(vis, total);
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((p) => selected.has(p._id));

  const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "in_storefront", label: "Na vitrine" },
    { key: "hidden", label: "Ocultos" },
    { key: "out_of_stock", label: "Sem estoque" },
  ];

  return (
    <View>
      {/* O que falta nas PECAS. Vem antes do modo auto/curadoria: nao
          adianta escolher quais aparecem se as que aparecem estao pela
          metade. O checklist da aba Design cuida do nivel da LOJA. */}
      <DeixarLojaPronta />

      {/* Aviso do topo. A loja com a lista de inclusão antiga ganha o aviso
          âmbar: produto novo não entra sozinho lá. */}
      {!comLista ? (
        <View style={[s.modeBanner, s.modeBannerAuto]}>
          <View style={[s.modeIcon, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
            <Icon name="check" size={18} color={Colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.modeTitle}>
              {hiddenCount > 0
                ? `${inStorefrontCount} de ${total} produtos aparecem na sua loja`
                : "Todos os seus produtos aparecem na loja"}
            </Text>
            <Text style={s.modeDesc}>
              Produto novo entra sozinho. Se não quiser mostrar algum, é só desligar ao lado dele.
            </Text>
          </View>
          {hiddenCount > 0 ? (
            <Pressable onPress={clearCuration} style={s.modeBtn}>
              <Text style={s.modeBtnText}>Mostrar todos novamente</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={[s.modeBanner, s.modeBannerCurated]}>
          <View style={[s.modeIcon, { backgroundColor: Colors.amberD, borderColor: Colors.amber }]}>
            <Icon name="star" size={18} color={Colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.modeTitle}>Sua loja mostra uma seleção: {inStorefrontCount} de {total} produtos</Text>
            <Text style={s.modeDesc}>
              Do jeito que está, produto novo não entra sozinho na loja. Para que entre,
              toque em "Mostrar todos novamente" e desligue só o que não quer mostrar.
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

      {/* F0: produtos fora da navegacao por categoria.
          Medido na Davi em 18/08: 1.183 de 1.434 produtos ativos sem
          categoria por caminho nenhum. Eles aparecem na vitrine, mas
          ninguem os encontra navegando -- e o lojista nao tem como saber
          disso sem alguem contar para ele. So aparece quando ha o que
          resolver. */}
      {semCategoria > 0 ? (
        <Pressable
          onPress={() => router.push("/catalogo/sem-categoria")}
          style={[cs.card, { borderColor: Colors.amber }]}
          accessibilityRole="button"
        >
          <Text style={{ color: Colors.amber, fontWeight: "700", fontSize: 13 }}>
            {semCategoria} produto(s) fora da navegacao por categoria
          </Text>
          <Text style={{ color: Colors.ink3, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
            Eles aparecem na vitrine, mas não são encontrados quando o cliente navega por
            categoria. Toque para categorizar em lote.
          </Text>
        </Pressable>
      ) : null}

      {/* F0: as tres portas da organizacao do catalogo, num bloco so.
          Ate aqui /catalogo/organizar e /catalogo/migracao existiam mas
          so eram alcancaveis digitando a URL -- funcionalidade que o
          lojista nao encontra e funcionalidade que nao existe.

          Ficam na Vitrine pela mesma razao do aviso acima: e a aba onde
          o lojista pensa "o que meu cliente ve", e categoria e o que
          organiza essa navegacao. Nao vao no estoque.tsx de proposito --
          e o arquivo de maior risco de regressao da fase, e ja foi
          tocado duas vezes (D1 e D2). */}
      <View style={cs.card}>
        <Text style={{ color: Colors.ink, fontWeight: "700", fontSize: 13 }}>
          Organização do catálogo
        </Text>
        <Text style={{ color: Colors.ink3, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
          A navegacao por categoria da loja sai daqui.
        </Text>

        <Pressable
          onPress={() => router.push("/catalogo/organizar")}
          style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: Colors.border, marginTop: 10 }}
          accessibilityRole="button"
        >
          <Text style={{ color: Colors.ink, fontSize: 13, fontWeight: "600" }}>
            Organizar catálogo
          </Text>
          <Text style={{ color: Colors.ink3, fontSize: 12, marginTop: 2 }}>
            Criar, renomear e mover categorias. Até três níveis.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/catalogo/migracao")}
          style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: Colors.border }}
          accessibilityRole="button"
        >
          <Text style={{ color: Colors.ink, fontSize: 13, fontWeight: "600" }}>
            Assistente de migração
          </Text>
          <Text style={{ color: Colors.ink3, fontSize: 12, marginTop: 2 }}>
            Converter as categorias antigas, escritas como texto, para a arvore.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/catalogo/sem-categoria")}
          style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: Colors.border }}
          accessibilityRole="button"
        >
          <Text style={{ color: Colors.ink, fontSize: 13, fontWeight: "600" }}>
            Produtos sem categoria
            {semCategoria > 0 ? ` (${semCategoria})` : ""}
          </Text>
          <Text style={{ color: Colors.ink3, fontSize: 12, marginTop: 2 }}>
            Categorizar vários de uma vez.
          </Text>
        </Pressable>
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
              <Text style={[s.bulkBtnText, { color: Colors.green }]}>Mostrar na loja</Text>
            </Pressable>
            <Pressable onPress={bulkUnmark} style={[s.bulkBtn, { backgroundColor: Colors.redD, borderColor: Colors.red }]}>
              <Text style={[s.bulkBtnText, { color: Colors.red }]}>Ocultar</Text>
            </Pressable>
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
            const isInStorefront = prod.is_in_storefront;
            const isSelected = selected.has(id);
            const stock = prod.stock_qty ?? prod.stock ?? prod.quantity ?? null;

            // Visual da linha: o produto oculto fica esmaecido.
            const rowOpacity = isInStorefront ? 1 : 0.6;

            return (
              <HoverRow key={id} style={[s.prodRow, { opacity: rowOpacity }]}>
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
                    <View style={[s.prodIcon, { backgroundColor: isInStorefront ? accent.primarySoft : Colors.bg4 }]}>
                      <Icon name="package" size={18} color={isInStorefront ? accent.primaryStrong : Colors.ink3} />
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
                  {/* Ligado = aparece na loja. Desligar oculta. */}
                  <View style={s.switchWrap}>
                    <Text style={s.switchSideLabel}>{isInStorefront ? "Aparece na loja" : "Oculto"}</Text>
                    <Switch
                      value={isInStorefront}
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

// As duas listas da configuração do canal, como conjuntos de texto.
function lerVisibilidade(config: any): Visibilidade {
  const lista = (raw: unknown) => (Array.isArray(raw) ? raw.map(String) : []);
  return {
    featured: new Set(lista(config?.featured_product_ids)),
    hidden: new Set(lista(config?.hidden_product_ids)),
  };
}
