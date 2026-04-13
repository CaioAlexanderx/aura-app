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
  async function handleSave() { await saveConfig({ featured_product_ids: Array.from(featured), show_prices: showPrices, show_stock: showStock }); setChanged(false); }

  const cats = ["Todos", ...Array.from(new Set(products.map((p: any) => p.category).filter(Boolean)))];
  const filtered = catFilter === "Todos" ? products : products.filter((p: any) => p.category === catFilter);

  return (
    <View>
      <View style={s.kpiRow}>
        <View style={s.kpi}><Text style={s.kpiLabel}>TOTAL</Text><Text style={s.kpiValue}>{products.length}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>NA VITRINE</Text><Text style={[s.kpiValue, { color: Colors.green }]}>{featured.size}</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>OCULTOS</Text><Text style={[s.kpiValue, { color: Colors.ink3 }]}>{products.length - featured.size}</Text></View>
      </View>
      <View style={cs.card}>
        <View style={cs.switchRow}><Text style={cs.switchLabel}>Mostrar precos</Text><Switch value={showPrices} onValueChange={(v) => { setShowPrices(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" /></View>
        <View style={[cs.switchRow, { borderBottomWidth: 0 }]}><Text style={cs.switchLabel}>Mostrar estoque</Text><Switch value={showStock} onValueChange={(v) => { setShowStock(v); setChanged(true); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" /></View>
      </View>
      <Text style={cs.hint}>Selecione os produtos que aparecem na vitrine.</Text>
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
            return (
              <HoverRow key={id} style={s.prodRow}>
                <View style={s.prodLeft}>
                  {prod.image_url ? (
                    <View style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 }}>
                      {Platform.OS === "web" ? <img src={prod.image_url} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" } as any} /> : <View style={{ width: 40, height: 40, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" }}><Icon name="package" size={18} color={Colors.violet3} /></View>}
                    </View>
                  ) : <View style={[s.prodIcon, { backgroundColor: isFeatured ? Colors.violetD : Colors.bg4 }]}><Icon name="package" size={18} color={isFeatured ? Colors.violet3 : Colors.ink3} /></View>}
                  <View style={s.prodInfo}><Text style={s.prodName}>{prod.name}</Text><Text style={s.prodMeta}>{showPrices ? `R$ ${(parseFloat(prod.price) || 0).toFixed(2)}` : ""}{prod.category ? ` \u00b7 ${prod.category}` : ""}</Text></View>
                </View>
                <View style={s.prodRight}>
                  <View style={[s.featBadge, { backgroundColor: isFeatured ? Colors.greenD : Colors.bg4 }]}><Text style={[s.featBadgeText, { color: isFeatured ? Colors.green : Colors.ink3 }]}>{isFeatured ? "Visivel" : "Oculto"}</Text></View>
                  <Switch value={isFeatured} onValueChange={() => toggleProduct(id)} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
                </View>
              </HoverRow>
            );
          })}
        </View>
      )}
      {changed && <Pressable onPress={handleSave} disabled={isSaving} style={[cs.saveBtn, isSaving && { opacity: 0.6 }]}><Text style={cs.saveBtnText}>{isSaving ? "Salvando..." : "Salvar vitrine"}</Text></Pressable>}
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: Colors.ink },
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
