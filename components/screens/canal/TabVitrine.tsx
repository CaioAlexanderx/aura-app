// FIX (14/05/2026): Vitrine travava/matava a aba do browser para clientes com
// muitos produtos (Davi Calcados: 4950+). Causa: query sem limite + render de
// todos os items num <View> sem virtualizacao.
//
// Solucao:
//   - Query propria aqui (nao mais via useDigitalChannel) com ?limit=60&offset=
//   - TextInput de busca com debounce 350ms que reseta para pagina 0
//   - Paginacao simples prev/next (60 produtos por pagina)
//   - KPI "TOTAL" vem do campo `total` retornado pelo backend (COUNT real)
//   - Selecao de featured continua funcionando mesmo paginado: o Set<string>
//     persiste independente de qual pagina esta visivel

import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch, Platform, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { HoverRow } from "@/components/HoverRow";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { cs } from "./shared";

const PAGE_SIZE = 60;

type Props = { config: any; saveConfig: (data: any) => Promise<void>; isSaving: boolean };

export function TabVitrine({ config, saveConfig, isSaving }: Props) {
  const { company } = useAuthStore();
  const cid = company?.id;

  const featuredInit: Set<string> = new Set(config.featured_product_ids || []);
  const [featured, setFeatured] = useState<Set<string>>(featuredInit);
  const [showPrices, setShowPrices] = useState(config.show_prices ?? true);
  const [showStock, setShowStock] = useState(config.show_stock ?? false);
  const [changed, setChanged] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFeatured(new Set(config.featured_product_ids || []));
    setShowPrices(config.show_prices ?? true);
    setShowStock(config.show_stock ?? false);
    setChanged(false);
  }, [config.featured_product_ids?.join(",")]);

  function handleSearchChange(text: string) {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(text);
      setPage(0);
    }, 350);
  }

  const { data, isFetching } = useQuery({
    queryKey: ['products-vitrine', cid, debouncedSearch, page],
    queryFn: () => request<any>(
      `/companies/${cid}/products?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`
    ),
    enabled: !!cid,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const products: any[] = data?.products || [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  function toggleProduct(id: string) {
    setFeatured(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setChanged(true);
  }

  function clearSelection() { setFeatured(new Set()); setChanged(true); }

  async function handleSave() {
    await saveConfig({ featured_product_ids: Array.from(featured), show_prices: showPrices, show_stock: showStock });
    setChanged(false);
  }

  const isCustomMode = featured.size > 0;
  const showingCount = isCustomMode ? featured.size : total;
  const hiddenCount = isCustomMode ? total - featured.size : 0;

  return (
    <View>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>TOTAL</Text>
          <Text style={s.kpiValue}>{total}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>NA LOJA</Text>
          <Text style={[s.kpiValue, { color: Colors.green }]}>{showingCount}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>OCULTOS</Text>
          <Text style={[s.kpiValue, { color: hiddenCount > 0 ? Colors.amber : Colors.ink3 }]}>{hiddenCount}</Text>
        </View>
      </View>

      {/* Configurações de exibição */}
      <View style={cs.card}>
        <View style={cs.switchRow}>
          <Text style={cs.switchLabel}>Mostrar precos</Text>
          <Switch value={showPrices} onValueChange={(v) => { setShowPrices(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
        <View style={[cs.switchRow, { borderBottomWidth: 0 }]}>
          <Text style={cs.switchLabel}>Mostrar estoque</Text>
          <Switch value={showStock} onValueChange={(v) => { setShowStock(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
        </View>
      </View>

      {/* Banner de modo */}
      {!isCustomMode ? (
        <View style={[s.modeBanner, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
          <Text style={s.modeBannerIcon}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.modeBannerTitle, { color: Colors.green }]}>Modo automatico: todos os produtos</Text>
            <Text style={s.modeBannerDesc}>Sua loja mostra todos os {total} produtos ativos. Marque produtos abaixo para exibir apenas alguns.</Text>
          </View>
        </View>
      ) : (
        <View style={[s.modeBanner, { backgroundColor: Colors.amberD, borderColor: Colors.amber }]}>
          <Text style={s.modeBannerIcon}>⚠</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.modeBannerTitle, { color: Colors.amber }]}>Modo personalizado: {featured.size} de {total}</Text>
            <Text style={s.modeBannerDesc}>Sua loja exibe apenas os {featured.size} produtos marcados. Os outros {hiddenCount} ficam ocultos do publico.</Text>
            <Pressable onPress={clearSelection} style={s.modeBannerBtn}>
              <Text style={s.modeBannerBtnText}>Mostrar todos os {total} produtos</Text>
            </Pressable>
          </View>
        </View>
      )}

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

      {/* Lista */}
      {products.length === 0 && !isFetching ? (
        <View style={s.emptyBox}>
          <Icon name="package" size={28} color={Colors.ink3} />
          <Text style={s.emptyText}>{debouncedSearch ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</Text>
          <Text style={s.emptyHint}>{debouncedSearch ? 'Tente outro termo de busca.' : 'Cadastre produtos no Estoque para exibi-los na vitrine.'}</Text>
        </View>
      ) : (
        <View style={cs.card}>
          {products.map((prod: any) => {
            const id = prod.id || prod.product_id;
            const isFeaturedItem = featured.has(id);
            const isShownInStore = isCustomMode ? isFeaturedItem : true;
            return (
              <HoverRow key={id} style={s.prodRow}>
                <View style={s.prodLeft}>
                  {prod.image_url ? (
                    <View style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 }}>
                      {Platform.OS === "web"
                        ? <img src={prod.image_url} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} />
                        : <View style={{ width: 40, height: 40, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" }}><Icon name="package" size={18} color={Colors.violet3} /></View>}
                    </View>
                  ) : (
                    <View style={[s.prodIcon, { backgroundColor: isFeaturedItem ? Colors.violetD : Colors.bg4 }]}>
                      <Icon name="package" size={18} color={isFeaturedItem ? Colors.violet3 : Colors.ink3} />
                    </View>
                  )}
                  <View style={s.prodInfo}>
                    <Text style={s.prodName}>{prod.name}</Text>
                    <Text style={s.prodMeta}>
                      {showPrices ? `R$ ${(parseFloat(prod.price) || 0).toFixed(2)}` : ""}
                      {prod.category ? ` · ${prod.category}` : ""}
                    </Text>
                  </View>
                </View>
                <View style={s.prodRight}>
                  <View style={[s.featBadge, { backgroundColor: isShownInStore ? Colors.greenD : Colors.bg4 }]}>
                    <Text style={[s.featBadgeText, { color: isShownInStore ? Colors.green : Colors.ink3 }]}>
                      {isShownInStore ? "Na loja" : "Oculto"}
                    </Text>
                  </View>
                  <Switch value={isFeaturedItem} onValueChange={() => toggleProduct(id)} trackColor={{ true: Colors.violet, false: Colors.bg4 }} thumbColor="#fff" />
                </View>
              </HoverRow>
            );
          })}
        </View>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <View style={s.pageRow}>
          <Pressable onPress={() => setPage(p => p - 1)} disabled={!hasPrev} style={[s.pageBtn, !hasPrev && s.pageBtnDisabled]}>
            <Text style={[s.pageBtnText, !hasPrev && { color: Colors.ink3 }]}>← Anterior</Text>
          </Pressable>
          <Text style={s.pageInfo}>Pagina {page + 1} de {totalPages}</Text>
          <Pressable onPress={() => setPage(p => p + 1)} disabled={!hasNext} style={[s.pageBtn, !hasNext && s.pageBtnDisabled]}>
            <Text style={[s.pageBtnText, !hasNext && { color: Colors.ink3 }]}>Proxima →</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={handleSave} disabled={isSaving || !changed} style={[cs.saveBtn, (isSaving || !changed) && { opacity: 0.5 }]}>
        <Text style={cs.saveBtnText}>{isSaving ? "Salvando..." : "Salvar vitrine"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  modeBanner: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: "flex-start" },
  modeBannerIcon: { fontSize: 18, fontWeight: "800", marginTop: 1 },
  modeBannerTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  modeBannerDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  modeBannerBtn: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  modeBannerBtnText: { fontSize: 12, color: Colors.amber, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, marginTop: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.ink, outlineStyle: "none" } as any,
  prodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  prodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  prodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  prodInfo: { flex: 1 },
  prodName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  prodMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  prodRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  featBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  featBadgeText: { fontSize: 9, fontWeight: "600" },
  pageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 4, gap: 8 },
  pageBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageInfo: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 8, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 280 },
});
