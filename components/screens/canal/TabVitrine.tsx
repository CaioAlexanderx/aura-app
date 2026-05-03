import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { HoverRow } from "@/components/HoverRow";
import { cs } from "./shared";

type Props = { config: any; products: any[]; saveConfig: (data: any) => Promise<void>; isSaving: boolean };

export function TabVitrine({ config, products, saveConfig, isSaving }: Props) {
  const featuredInit: Set<string> = new Set(config.featured_product_ids || []);
  const [featured, setFeatured] = useState<Set<string>>(featuredInit);
  const [showPrices, setShowPrices] = useState(config.show_prices ?? true);
  const [showStock, setShowStock] = useState(config.show_stock ?? false);
  const [catFilter, setCatFilter] = useState("Todos");
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setFeatured(new Set(config.featured_product_ids || []));
    setShowPrices(config.show_prices ?? true); setShowStock(config.show_stock ?? false); setChanged(false);
  }, [config.featured_product_ids?.join(",")]);

  function toggleProduct(id: string) { setFeatured(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); setChanged(true); }
  function clearSelection() { setFeatured(new Set()); setChanged(true); }
  async function handleSave() { await saveConfig({ featured_product_ids: Array.from(featured), show_prices: showPrices, show_stock: showStock }); setChanged(false); }

  const cats = ["Todos", ...Array.from(new Set(products.map((p: any) => p.category).filter(Boolean)))];
  const filtered = catFilter === "Todos" ? products : products.filter((p: any) => p.category === catFilter);

  // Modo "Vitrine personalizada" só está ativo quando há pelo menos 1 produto marcado
  const isCustomMode = featured.size > 0;
  const showingCount = isCustomMode ? featured.size : products.length;
  const hiddenCount  = isCustomMode ? products.length - featured.size : 0;

  return (
    <View>
      {/* KPIs com semântica clara */}
      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>TOTAL</Text>
          <Text style={s.kpiValue}>{products.length}</Text>
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

      {/* Banner explicativo do modo de exibição */}
      {!isCustomMode ? (
        <View style={[s.modeBanner, { backgroundColor: Colors.greenD, borderColor: Colors.green }]}>
          <Text style={s.modeBannerIcon}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.modeBannerTitle, { color: Colors.green }]}>Modo automatico: todos os produtos</Text>
            <Text style={s.modeBannerDesc}>Sua loja mostra automaticamente todos os {products.length} produtos ativos. Marque produtos abaixo se quiser exibir apenas alguns.</Text>
          </View>
        </View>
      ) : (
        <View style={[s.modeBanner, { backgroundColor: Colors.amberD, borderColor: Colors.amber }]}>
          <Text style={s.modeBannerIcon}>⚠</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.modeBannerTitle, { color: Colors.amber }]}>Modo personalizado: {featured.size} de {products.length}</Text>
            <Text style={s.modeBannerDesc}>Sua loja exibe apenas os {featured.size} produtos marcados abaixo. Os outros {hiddenCount} ficam ocultos do publico.</Text>
            <Pressable onPress={clearSelection} style={s.modeBannerBtn}>
              <Text style={s.modeBannerBtnText}>Mostrar todos os {products.length} produtos</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={[cs.hint, { marginTop: 8 }]}>
        {isCustomMode
          ? "Desmarque para voltar ao modo automatico, ou ajuste a sua selecao abaixo."
          : "Marque produtos abaixo para criar uma vitrine personalizada (so os marcados aparecem)."}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingRight: 20 }}>
        {cats.map(c => <Pressable key={c} onPress={() => setCatFilter(c)} style={[cs.filterChip, catFilter === c && cs.filterChipActive]}><Text style={[cs.filterText, catFilter === c && cs.filterTextActive]}>{c}</Text></Pressable>)}
      </ScrollView>
      {products.length === 0 ? (
        <View style={s.emptyBox}><Icon name="package" size={28} color={Colors.ink3} /><Text style={s.emptyText}>Nenhum produto cadastrado</Text><Text style={s.emptyHint}>Cadastre produtos no Estoque para exibi-los na vitrine.</Text></View>
      ) : (
        <View style={cs.card}>
          {filtered.map((prod: any) => {
            const id = prod.id || prod.product_id;
            const isFeatured = featured.has(id);
            // No modo automatico, todos aparecem na loja; no modo personalizado, só os marcados
            const isShownInStore = isCustomMode ? isFeatured : true;
            return (
              <HoverRow key={id} style={s.prodRow}>
                <View style={s.prodLeft}>
                  {prod.image_url ? (
                    <View style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 }}>
                      {Platform.OS === "web" ? <img src={prod.image_url} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} /> : <View style={{ width: 40, height: 40, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" }}><Icon name="package" size={18} color={Colors.violet3} /></View>}
                    </View>
                  ) : <View style={[s.prodIcon, { backgroundColor: isFeatured ? Colors.violetD : Colors.bg4 }]}><Icon name="package" size={18} color={isFeatured ? Colors.violet3 : Colors.ink3} /></View>}
                  <View style={s.prodInfo}>
                    <Text style={s.prodName}>{prod.name}</Text>
                    <Text style={s.prodMeta}>{showPrices ? `R$ ${(parseFloat(prod.price) || 0).toFixed(2)}` : ""}{prod.category ? ` · ${prod.category}` : ""}</Text>
                  </View>
                </View>
                <View style={s.prodRight}>
                  <View style={[s.featBadge, { backgroundColor: isShownInStore ? Colors.greenD : Colors.bg4 }]}>
                    <Text style={[s.featBadgeText, { color: isShownInStore ? Colors.green : Colors.ink3 }]}>
                      {isShownInStore ? "Na loja" : "Oculto"}
                    </Text>
                  </View>
                  <Switch value={isFeatured} onValueChange={() => toggleProduct(id)} trackColor={{ true: Colors.violet, false: Colors.bg4 }} thumbColor="#fff" />
                </View>
              </HoverRow>
            );
          })}
        </View>
      )}
      <Pressable onPress={handleSave} disabled={isSaving} style={[cs.saveBtn, isSaving && { opacity: 0.6 }]}>
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
  // Banner de modo (automático vs personalizado)
  modeBanner: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, alignItems: "flex-start" },
  modeBannerIcon: { fontSize: 18, fontWeight: "800", marginTop: 1 },
  modeBannerTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  modeBannerDesc: { fontSize: 12, color: Colors.ink2 || Colors.ink3, lineHeight: 17 },
  modeBannerBtn: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border },
  modeBannerBtnText: { fontSize: 12, color: Colors.amber, fontWeight: "700" },
  // Lista de produtos
  prodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  prodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  prodIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  prodInfo: { flex: 1 },
  prodName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  prodMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  prodRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  featBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  featBadgeText: { fontSize: 9, fontWeight: "600" },
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 8, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 280 },
});
