import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { hexToName } from "@/utils/colorNames";
import { LabelVariantSelector } from "@/components/LabelVariantSelector";
import { buildLabelHtml, buildLabelName } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { LabelItem } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { Product } from "@/components/screens/estoque/types";

type Props = {
  products: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function PrintLabels({ products, selectedIds, onSelectionChange }: Props) {
  var { company, token } = useAuthStore();
  var [mode, setMode] = useState<"barcode" | "qr">("barcode");
  var [search, setSearch] = useState("");
  var [quantities, setQuantities] = useState<Record<string, number>>({});
  var [showStoreName, setShowStoreName] = useState(true);
  var [overrideSizes, setOverrideSizes] = useState<Record<string, string>>({});
  var [overrideColors, setOverrideColors] = useState<Record<string, string>>({});
  var [variantCache, setVariantCache] = useState<Record<string, any[]>>({});
  var isWeb = Platform.OS === "web";

  var storeName = (company && (company.trade_name || company.legal_name)) || "";

  var productsWithCode = useMemo(
    function() { return products.filter(function(p) { return p.barcode || p.code; }); },
    [products]
  );

  var filtered = useMemo(function() {
    var q = search.toLowerCase().trim();
    if (!q) return productsWithCode;
    return productsWithCode.filter(function(p) {
      return p.name.toLowerCase().includes(q) || (p.barcode || p.code || "").toLowerCase().includes(q);
    });
  }, [productsWithCode, search]);

  function getQty(id: string) { return quantities[id] || 1; }
  function setQty(id: string, n: number) {
    setQuantities(function(prev) { return { ...prev, [id]: Math.max(1, Math.min(999, n)) }; });
  }

  function fetchVariantsIfNeeded(productId: string) {
    if (variantCache[productId] || !company?.id) return;
    var p = products.find(function(pr) { return pr.id === productId; });
    if (!p || !p.has_variants) return;
    companiesApi.variants(company.id, productId).then(function(res) {
      setVariantCache(function(prev) { return { ...prev, [productId]: (res.variants || []).filter(function(v: any) { return v.is_active !== false; }) }; });
    }).catch(function() {
      setVariantCache(function(prev) { return { ...prev, [productId]: [] }; });
    });
  }

  function getAvailableOptions(p: Product) {
    var sizes = new Set<string>();
    var colors = new Set<string>();
    // Direct product fields
    if (p.size) sizes.add(p.size);
    if (p.color && /^#[0-9A-Fa-f]{6}$/.test(p.color)) colors.add(p.color);
    // From variants — BUGFIX: API returns "attribute" key, not "attribute_name"
    var variants = variantCache[p.id] || [];
    variants.forEach(function(v: any) {
      (v.attributes || []).forEach(function(a: any) {
        var val = String(a.value || "").trim();
        if (!val) return;
        var attrLower = (a.attribute || a.attribute_name || "").toLowerCase();
        if (attrLower === "tamanho" || attrLower === "size") sizes.add(val);
        else if (attrLower === "cor" || attrLower === "color" || /^#[0-9A-Fa-f]{6}$/.test(val)) colors.add(val);
      });
    });
    return { sizes: Array.from(sizes), colors: Array.from(colors) };
  }

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(function(i) { return i !== id; }));
    } else {
      onSelectionChange([...selectedIds, id]);
      fetchVariantsIfNeeded(id);
      if (!quantities[id]) {
        var p = products.find(function(pr) { return pr.id === id; });
        if (p && p.stock > 1) setQty(id, p.stock);
      }
    }
  }

  function toggleAll() {
    var ids = filtered.map(function(p) { return p.id; });
    if (ids.every(function(id) { return selectedIds.includes(id); })) {
      onSelectionChange(selectedIds.filter(function(id) { return !ids.includes(id); }));
    } else {
      var newIds = Array.from(new Set([...selectedIds, ...ids]));
      onSelectionChange(newIds);
      var newQtys: Record<string, number> = { ...quantities };
      filtered.forEach(function(p) {
        if (!newQtys[p.id] && p.stock > 1) newQtys[p.id] = p.stock;
        fetchVariantsIfNeeded(p.id);
      });
      setQuantities(newQtys);
    }
  }

  var totalLabels = selectedIds.reduce(function(sum, id) { return sum + getQty(id); }, 0);

  function getEffectiveSize(p: Product): string { return overrideSizes[p.id] || p.size || ""; }
  function getEffectiveColor(p: Product): string { return overrideColors[p.id] || p.color || ""; }

  function handlePrint() {
    if (!isWeb || !company?.id || !token || selectedIds.length === 0) {
      toast.error("Selecione pelo menos um produto"); return;
    }
    var selected = products.filter(function(p) { return selectedIds.includes(p.id) && (p.barcode || p.code); });
    if (selected.length === 0) { toast.error("Produtos sem codigo"); return; }

    var items: LabelItem[] = selected.map(function(p) {
      return { name: p.name, price: p.price, barcode: p.barcode || p.code, size: getEffectiveSize(p), color: getEffectiveColor(p), qty: getQty(p.id) };
    });

    var html = buildLabelHtml(items, { mode: mode, storeName: storeName, showStoreName: showStoreName });

    try {
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var w = window.open(url, "_blank");
      if (!w) {
        var w2 = window.open("", "_blank");
        if (w2) { w2.document.write(html); w2.document.close(); }
        else { toast.error("Popup bloqueado \u2014 permita popups para app.getaura.com.br"); return; }
      }
      toast.success(totalLabels + " etiqueta(s) abertas para impressao");
    } catch (err) { console.error("[PrintLabels] Error:", err); toast.error("Erro ao gerar etiquetas"); }
  }

  var allSelected = filtered.length > 0 && filtered.every(function(p) { return selectedIds.includes(p.id); });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.title}>Etiquetas 33x21mm (3 colunas)</Text>
          <Text style={s.hint}>Selecione os produtos e ajuste a quantidade de etiquetas por item.</Text>
        </View>
        <View style={s.modeToggle}>
          <Pressable onPress={function() { setMode("barcode"); }} style={[s.modeBtn, mode === "barcode" && s.modeBtnActive]}>
            <Text style={[s.modeText, mode === "barcode" && s.modeTextActive]}>Cod. barras</Text>
          </Pressable>
          <Pressable onPress={function() { setMode("qr"); }} style={[s.modeBtn, mode === "qr" && s.modeBtnActive]}>
            <Text style={[s.modeText, mode === "qr" && s.modeTextActive]}>QR Code</Text>
          </Pressable>
        </View>
      </View>

      {storeName ? (
        <Pressable onPress={function() { setShowStoreName(!showStoreName); }} style={s.storeToggle}>
          <View style={[s.checkbox, showStoreName && s.checkboxSelected]}>
            {showStoreName && <Icon name="check" size={10} color="#fff" />}
          </View>
          <Text style={s.storeToggleText}>Incluir nome da loja no topo: <Text style={s.storeTogglePreview}>{storeName.toUpperCase()}</Text></Text>
        </Pressable>
      ) : null}

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput style={s.searchInput} placeholder="Buscar produto..." placeholderTextColor={Colors.ink3}
            value={search} onChangeText={setSearch} />
          {search.length > 0 && <Pressable onPress={function() { setSearch(""); }}><Icon name="x" size={12} color={Colors.ink3} /></Pressable>}
        </View>
        <Pressable onPress={toggleAll} style={s.selectAllBtn}>
          <Text style={s.selectAllText}>{allSelected ? "Desmarcar" : "Selecionar"} todos ({filtered.length})</Text>
        </Pressable>
      </View>

      <View style={s.list}>
        {filtered.length === 0 && (
          <Text style={s.emptyText}>
            {productsWithCode.length === 0 ? "Nenhum produto com codigo cadastrado" : "Nenhum produto encontrado"}
          </Text>
        )}
        {filtered.map(function(p) {
          var sel = selectedIds.includes(p.id);
          var qty = getQty(p.id);
          var effSize = getEffectiveSize(p);
          var effColor = getEffectiveColor(p);
          var labelPreview = buildLabelName(p.name, effSize, effColor);
          var opts = getAvailableOptions(p);
          var showVariant = sel && (opts.sizes.length > 0 || opts.colors.length > 0);
          return (
            <View key={p.id} style={[s.item, sel && s.itemSelected]}>
              <Pressable onPress={function() { toggleSelect(p.id); }} style={s.itemLeft}>
                <View style={[s.checkbox, sel && s.checkboxSelected]}>
                  {sel && <Icon name="check" size={10} color="#fff" />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemName} numberOfLines={1}>{labelPreview}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                    <Text style={s.itemCode} numberOfLines={1}>{p.barcode || p.code} | {p.stock} un</Text>
                    {effColor && /^#/.test(effColor) && <View style={[s.colorDot, { backgroundColor: effColor }]} />}
                    {effSize ? <Text style={s.sizeBadge}>{effSize}</Text> : null}
                  </View>
                </View>
                <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
              </Pressable>
              {sel && (
                <View style={s.qtyRow}>
                  <Pressable onPress={function() { setQty(p.id, qty - 1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>{"<"}</Text></Pressable>
                  <TextInput style={s.qtyInput} value={String(qty)}
                    onChangeText={function(v) { var n = parseInt(v); if (!isNaN(n)) setQty(p.id, n); }}
                    keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                  <Pressable onPress={function() { setQty(p.id, qty + 1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>{"\u203A"}</Text></Pressable>
                  <Text style={s.qtyLabel}>etiq.</Text>
                </View>
              )}
              {showVariant && (
                <LabelVariantSelector
                  availableSizes={opts.sizes}
                  availableColors={opts.colors}
                  selectedSize={overrideSizes[p.id] || p.size || ""}
                  selectedColor={overrideColors[p.id] || p.color || ""}
                  onChangeSize={function(v) { setOverrideSizes(function(prev) { return { ...prev, [p.id]: v }; }); }}
                  onChangeColor={function(v) { setOverrideColors(function(prev) { return { ...prev, [p.id]: v }; }); }}
                />
              )}
            </View>
          );
        })}
      </View>

      <Pressable onPress={handlePrint} style={[s.printBtn, selectedIds.length === 0 && { opacity: 0.5 }]} disabled={selectedIds.length === 0}>
        <Icon name="file_text" size={16} color="#fff" />
        <Text style={s.printBtnText}>Imprimir {totalLabels} etiqueta(s) de {selectedIds.length} produto(s)</Text>
      </Pressable>

      <View style={s.setupHint}>
        <Icon name="alert" size={12} color={Colors.amber} />
        <Text style={s.setupText}>Chrome: Ctrl+P, papel 99x21mm, Margens: Nenhuma, Escala: 100%. A quantidade padrao e baseada no estoque do produto.</Text>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  container: { gap: 12 },
  header: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  modeToggle: { flexDirection: "row", gap: 4, backgroundColor: Colors.bg, borderRadius: 8, padding: 3 },
  modeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  modeBtnActive: { backgroundColor: Colors.violet },
  modeText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  modeTextActive: { color: "#fff", fontWeight: "600" },
  storeToggle: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  storeToggleText: { fontSize: 12, color: Colors.ink2, flex: 1 },
  storeTogglePreview: { fontWeight: "700", color: Colors.violet3, letterSpacing: 0.5 },
  toolbar: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink } as any,
  selectAllBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  selectAllText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  list: { gap: 3, backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, maxHeight: 500 },
  item: { borderRadius: 10, backgroundColor: Colors.bg, overflow: "hidden" },
  itemSelected: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  itemCode: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" as any },
  itemPrice: { fontSize: 13, color: Colors.green, fontWeight: "700", flexShrink: 0 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
  colorDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  sizeBadge: { fontSize: 9, fontWeight: "700", color: Colors.violet3, backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingBottom: 8, paddingLeft: 40 },
  qtyBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 16, color: Colors.violet3, fontWeight: "700" },
  qtyInput: { width: 48, height: 28, borderRadius: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border2, textAlign: "center", fontSize: 13, fontWeight: "700", color: Colors.ink, paddingVertical: 0 } as any,
  qtyLabel: { fontSize: 10, color: Colors.ink3, marginLeft: 2 },
  printBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14 },
  printBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  setupHint: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.amber + "33" },
  setupText: { fontSize: 10, color: Colors.amber, flex: 1, lineHeight: 16 },
});

export default PrintLabels;
