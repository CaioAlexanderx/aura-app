import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { hexToName } from "@/utils/colorNames";
import { buildLabelHtml, buildLabelName, validateLabelItems, isValidEAN13, generateEAN13 } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { LabelItem, InvalidCodeItem } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { Product } from "@/components/screens/estoque/types";

type Props = {
  products: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

type EAN13Entry = { name: string; originalCode: string; generated: string; productId?: string; variantId?: string };

var SIZE_ATTRS = new Set(["tamanho", "size", "tam", "tam.", "variacao", "variacao", "medida", "numero", "num", "numeracao", "n"]);
var COLOR_ATTRS = new Set(["cor", "color", "colour"]);

function variantSizeColor(v: any): { size: string; color: string } {
  var size = ""; var color = "";
  var attrs = v.attributes || [];
  for (var a of attrs) {
    var val = String(a.value || "").trim();
    if (!val) continue;
    var attr = (a.attribute || a.attribute_name || "").toLowerCase().trim();
    if (SIZE_ATTRS.has(attr) && !size) size = val;
    else if ((COLOR_ATTRS.has(attr) || /^#[0-9a-fA-F]{6}$/.test(val)) && !color) color = val;
  }
  if (!size) {
    for (var b of attrs) {
      var bval = String(b.value || "").trim();
      if (!bval) continue;
      var battr = (b.attribute || b.attribute_name || "").toLowerCase().trim();
      if (COLOR_ATTRS.has(battr)) continue;
      if (/^#[0-9a-fA-F]{6}$/.test(bval)) continue;
      size = bval;
      break;
    }
  }
  return { size: size, color: color };
}

var COLOR_NAME_TO_HEX: Record<string, string> = {
  preto: "#000000", branco: "#ffffff", vermelho: "#ef4444", azul: "#3b82f6",
  verde: "#22c55e", amarelo: "#eab308", rosa: "#ec4899", roxo: "#8b5cf6",
  laranja: "#f97316", marrom: "#92400e", bege: "#d4b896", cinza: "#6b7280",
  prata: "#c0c0c0", dourado: "#d4a017", nude: "#e8c4a0", caramelo: "#c68e4e",
  "bordo": "#800020", vinho: "#722f37", "azul escuro": "#1e3a5f", "verde agua": "#7fffd4",
};

function colorNameToHex(name: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(name)) return name;
  var hexMatch = name.match(/#[0-9a-fA-F]{6}/);
  if (hexMatch) return hexMatch[0];
  return COLOR_NAME_TO_HEX[name.toLowerCase().trim()] || null;
}

export function PrintLabels({ products, selectedIds, onSelectionChange }: Props) {
  var { company, token } = useAuthStore();
  var [mode, setMode] = useState<"barcode" | "qr">("barcode");
  var [search, setSearch] = useState("");
  var [quantities, setQuantities] = useState<Record<string, number>>({});
  var [showStoreName, setShowStoreName] = useState(true);
  var [variantCache, setVariantCache] = useState<Record<string, any[]>>({});
  var [selectedVariants, setSelectedVariants] = useState<Record<string, Set<string>>>({});
  var [includeParentInPrint, setIncludeParentInPrint] = useState<Record<string, boolean>>({});
  var [invalidCodes, setInvalidCodes] = useState<InvalidCodeItem[]>([]);

  // EAN-13 generation state
  var [showEan13Panel, setShowEan13Panel] = useState(false);
  var [ean13GenList, setEan13GenList] = useState<EAN13Entry[]>([]);
  var [pendingPrintItems, setPendingPrintItems] = useState<LabelItem[]>([]);

  var isWeb = Platform.OS === "web";
  var storeName = (company && (company.trade_name || company.legal_name)) || "";

  var productsWithCode = useMemo(
    function() { return products.filter(function(p) { return p.barcode || p.code; }); }, [products]);

  var filtered = useMemo(function() {
    var q = search.toLowerCase().trim();
    if (!q) return productsWithCode;
    return productsWithCode.filter(function(p) {
      return p.name.toLowerCase().includes(q) || (p.barcode || p.code || "").toLowerCase().includes(q);
    });
  }, [productsWithCode, search]);

  function getQty(key: string) { return quantities[key] || 1; }
  function setQty(key: string, n: number) { setQuantities(function(prev) { return { ...prev, [key]: Math.max(1, Math.min(999, n)) }; }); }

  function fetchVariantsIfNeeded(productId: string) {
    if (variantCache[productId] || !company?.id) return;
    var p = products.find(function(pr) { return pr.id === productId; });
    if (!p || !p.has_variants) return;
    companiesApi.variants(company.id, productId).then(function(res) {
      var active = (res.variants || []).filter(function(v: any) { return v.is_active !== false; });
      setVariantCache(function(prev) { return { ...prev, [productId]: active }; });
      if (active.length > 0) {
        var varIds = new Set(active.map(function(v: any) { return v.id; }));
        setSelectedVariants(function(prev) { return { ...prev, [productId]: varIds }; });
        var newQtys: Record<string, number> = {};
        active.forEach(function(v: any) { var stock = parseInt(v.stock_qty) || 1; newQtys[productId + "__" + v.id] = Math.max(1, stock); });
        setQuantities(function(prev) { return { ...prev, ...newQtys }; });
      }
    }).catch(function() { setVariantCache(function(prev) { return { ...prev, [productId]: [] }; }); });
  }

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(function(i) { return i !== id; }));
      setSelectedVariants(function(prev) { var n = { ...prev }; delete n[id]; return n; });
      setIncludeParentInPrint(function(prev) { var n = { ...prev }; delete n[id]; return n; });
    } else {
      onSelectionChange([...selectedIds, id]);
      fetchVariantsIfNeeded(id);
      if (!quantities[id]) { var p = products.find(function(pr) { return pr.id === id; }); if (p && p.stock > 1) setQty(id, p.stock); }
    }
  }

  function toggleIncludeParent(productId: string) {
    setIncludeParentInPrint(function(prev) { return { ...prev, [productId]: !prev[productId] }; });
  }

  function toggleVariant(productId: string, variantId: string) {
    setSelectedVariants(function(prev) {
      var current = new Set(prev[productId] || []);
      if (current.has(variantId)) current.delete(variantId); else current.add(variantId);
      return { ...prev, [productId]: current };
    });
  }

  function toggleAllVariants(productId: string) {
    var variants = variantCache[productId] || [];
    var current = selectedVariants[productId] || new Set();
    var allSelected = variants.every(function(v: any) { return current.has(v.id); });
    if (allSelected) { setSelectedVariants(function(prev) { return { ...prev, [productId]: new Set() }; }); }
    else { var all = new Set(variants.map(function(v: any) { return v.id; })); setSelectedVariants(function(prev) { return { ...prev, [productId]: all }; }); }
  }

  function toggleAll() {
    var ids = filtered.map(function(p) { return p.id; });
    if (ids.every(function(id) { return selectedIds.includes(id); })) { onSelectionChange(selectedIds.filter(function(id) { return !ids.includes(id); })); }
    else { var newIds = Array.from(new Set([...selectedIds, ...ids])); onSelectionChange(newIds); filtered.forEach(function(p) { fetchVariantsIfNeeded(p.id); if (!quantities[p.id] && p.stock > 1) setQty(p.id, p.stock); }); }
  }

  var totalLabels = useMemo(function() {
    var total = 0;
    selectedIds.forEach(function(id) {
      var variants = variantCache[id] || []; var selVars = selectedVariants[id];
      var hasAnyVariant = variants.length > 0;
      if (hasAnyVariant) {
        if (selVars && selVars.size > 0) { selVars.forEach(function(vid) { total += getQty(id + "__" + vid); }); }
        if (includeParentInPrint[id]) { total += getQty(id); }
      } else {
        total += getQty(id);
      }
    });
    return total;
  }, [selectedIds, quantities, selectedVariants, variantCache, includeParentInPrint]);

  // Monta a lista de LabelItems a partir da selecao atual
  function buildItems(): LabelItem[] | null {
    var items: LabelItem[] = [];
    selectedIds.forEach(function(id) {
      var p = products.find(function(pr) { return pr.id === id; });
      if (!p || !(p.barcode || p.code)) return;
      var variants = variantCache[id] || []; var selVars = selectedVariants[id];
      var hasAnyVariant = variants.length > 0;

      if (hasAnyVariant) {
        if (includeParentInPrint[id]) {
          items.push({ name: p.name, price: p.price, barcode: p.barcode || p.code, size: p.size || "", color: p.color || "", qty: getQty(id), productId: id });
        }
        if (selVars && selVars.size > 0) {
          variants.forEach(function(v: any) {
            if (!selVars.has(v.id)) return;
            var sc = variantSizeColor(v);
            var effectivePrice = v.price_override ? parseFloat(v.price_override) : p.price;
            var effectiveBarcode = v.barcode || p.barcode || p.code;
            items.push({ name: p.name, price: effectivePrice, barcode: effectiveBarcode, size: sc.size, color: sc.color, qty: getQty(id + "__" + v.id), productId: id, variantId: v.id });
          });
        }
      } else {
        items.push({ name: p.name, price: p.price, barcode: p.barcode || p.code, size: p.size || "", color: p.color || "", qty: getQty(id), productId: id });
      }
    });
    return items;
  }

  // Executa a impressao com os itens ja prontos (barcodes validos EAN-13)
  function doPrint(items: LabelItem[]) {
    var html = buildLabelHtml(items, { mode: mode, storeName: storeName, showStoreName: showStoreName });
    try {
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var w = window.open(url, "_blank");
      if (!w) { var w2 = window.open("", "_blank"); if (w2) { w2.document.write(html); w2.document.close(); } else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; } }
      toast.success(totalLabels + " etiqueta(s) abertas para impressao");
    } catch (err) { console.error("[PrintLabels] Error:", err); toast.error("Erro ao gerar etiquetas"); }
  }

  function handlePrint() {
    if (!isWeb || !company?.id || !token || selectedIds.length === 0) { toast.error("Selecione pelo menos um produto"); return; }

    // Reset paineis anteriores
    setInvalidCodes([]);
    setShowEan13Panel(false);

    var items = buildItems();
    if (!items || items.length === 0) { toast.error("Nenhum item selecionado. Marque o produto pai ou pelo menos uma variante."); return; }

    // 1. Validacao: codigos placeholder/vazios — bloqueia impressao
    var invalid = validateLabelItems(items);
    if (invalid.length > 0) {
      setInvalidCodes(invalid);
      toast.error(invalid.length + " produto(s) com código inválido — corrija antes de imprimir");
      return;
    }

    // 2. Verificacao EAN-13: produtos sem EAN-13 valido recebem codigo gerado
    var noEan13 = items.filter(function(item) { return !isValidEAN13(item.barcode); });
    if (noEan13.length > 0) {
      // 08/06/2026: gera EAN-13 deterministico por PRODUTO/VARIANTE (nao por
      // codigo). Seed = id da variante (ou do produto) -> codigo unico e estavel
      // e que pode ser gravado de volta no cadastro (ver handleConfirmEan13).
      var seen = new Set<string>();
      var genList: EAN13Entry[] = [];
      noEan13.forEach(function(item) {
        var identity = item.variantId || item.productId || item.barcode || item.name;
        if (seen.has(identity)) return;
        seen.add(identity);
        genList.push({
          name: buildLabelName(item.name, item.size, item.color),
          originalCode: item.barcode,
          generated: generateEAN13(identity),
          productId: item.productId,
          variantId: item.variantId,
        });
      });
      setPendingPrintItems(items);
      setEan13GenList(genList);
      setShowEan13Panel(true);
      return;
    }

    // Todos tem EAN-13 valido — imprime direto
    doPrint(items);
  }

  // Confirma a geracao de EAN-13 e imprime substituindo os codigos
  async function handleConfirmEan13() {
    // Mapeia o codigo gerado por IDENTIDADE (variante ou produto).
    var codeByIdentity: Record<string, string> = {};
    ean13GenList.forEach(function(g) {
      var identity = g.variantId || g.productId || g.originalCode;
      if (identity) codeByIdentity[identity] = g.generated;
    });

    var resolvedItems = pendingPrintItems.map(function(item) {
      if (isValidEAN13(item.barcode)) return item;
      var identity = item.variantId || item.productId || item.barcode;
      var gen = identity ? codeByIdentity[identity] : undefined;
      return gen ? { ...item, barcode: gen } : item;
    });

    // 08/06/2026: persiste o codigo gerado no cadastro (produto OU variante)
    // ANTES de imprimir. Sem isso o EAN-13 existe so na etiqueta e o PDV nao
    // encontra o item ao bipar (busca casa em products.barcode / variant.barcode).
    if (company?.id) {
      var cid = company.id;
      var saves = ean13GenList
        .filter(function(g) { return !!g.productId; })
        .map(function(g) {
          return g.variantId
            ? companiesApi.updateVariant(cid, g.productId as string, g.variantId, { barcode: g.generated })
            : companiesApi.updateProduct(cid, g.productId as string, { barcode: g.generated });
        });
      if (saves.length > 0) {
        try {
          await Promise.all(saves);
          toast.success(saves.length + " codigo(s) gravado(s) no cadastro");
        } catch (err) {
          console.error("[PrintLabels] Falha ao salvar EAN-13 gerado:", err);
          toast.error("Etiquetas geradas, mas falhou ao gravar o codigo no cadastro — o PDV pode nao reconhecer ao bipar.");
        }
      }
    }

    setShowEan13Panel(false);
    doPrint(resolvedItems);
  }

  function renderColorIndicator(colorVal: string) {
    if (!colorVal) return null;
    var hex = colorNameToHex(colorVal);
    if (hex) return <View style={[s.colorDot, { backgroundColor: hex }]} />;
    return <Text style={s.colorBadge}>{colorVal}</Text>;
  }

  // Indicador visual de validade EAN-13 para exibir na lista
  function renderEan13Badge(code: string) {
    if (!code) return null;
    var valid = isValidEAN13(code);
    return (
      <View style={[s.ean13Badge, valid ? s.ean13BadgeOk : s.ean13BadgeWarn]}>
        <Text style={[s.ean13BadgeText, valid ? s.ean13BadgeTextOk : s.ean13BadgeTextWarn]}>
          {valid ? "EAN-13" : "Sem EAN-13"}
        </Text>
      </View>
    );
  }

  var allSelected = filtered.length > 0 && filtered.every(function(p) { return selectedIds.includes(p.id); });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.title}>Etiquetas 33x21mm — Padrão EAN-13</Text>
          <Text style={s.hint}>Selecione os produtos. Produtos sem EAN-13 válido receberão um código interno gerado automaticamente antes da impressão.</Text>
        </View>
        <View style={s.modeToggle}>
          <Pressable onPress={function() { setMode("barcode"); }} style={[s.modeBtn, mode === "barcode" && s.modeBtnActive]}><Text style={[s.modeText, mode === "barcode" && s.modeTextActive]}>EAN-13</Text></Pressable>
          <Pressable onPress={function() { setMode("qr"); }} style={[s.modeBtn, mode === "qr" && s.modeBtnActive]}><Text style={[s.modeText, mode === "qr" && s.modeTextActive]}>QR Code</Text></Pressable>
        </View>
      </View>

      {storeName ? (
        <Pressable onPress={function() { setShowStoreName(!showStoreName); }} style={s.storeToggle}>
          <View style={[s.checkbox, showStoreName && s.checkboxSelected]}>{showStoreName && <Icon name="check" size={10} color="#fff" />}</View>
          <Text style={s.storeToggleText}>Incluir nome da loja no topo: <Text style={s.storeTogglePreview}>{storeName.toUpperCase()}</Text></Text>
        </Pressable>
      ) : null}

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput style={s.searchInput} placeholder="Buscar produto..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
          {search.length > 0 && <Pressable onPress={function() { setSearch(""); }}><Icon name="x" size={12} color={Colors.ink3} /></Pressable>}
        </View>
        <Pressable onPress={toggleAll} style={s.selectAllBtn}><Text style={s.selectAllText}>{allSelected ? "Desmarcar" : "Selecionar"} todos ({filtered.length})</Text></Pressable>
      </View>

      <ScrollView style={s.list} nestedScrollEnabled>
        {filtered.length === 0 && (<Text style={s.emptyText}>{productsWithCode.length === 0 ? "Nenhum produto com codigo cadastrado" : "Nenhum produto encontrado"}</Text>)}
        {filtered.map(function(p) {
          var sel = selectedIds.includes(p.id);
          var variants = variantCache[p.id] || [];
          var hasVariants = sel && variants.length > 0;
          var selVars = selectedVariants[p.id] || new Set();
          var allVarsSelected = hasVariants && variants.every(function(v: any) { return selVars.has(v.id); });
          var parentChecked = !!includeParentInPrint[p.id];
          var productCode = p.barcode || p.code;

          if (!hasVariants) {
            var qty = getQty(p.id);
            var labelPreview = buildLabelName(p.name, p.size || "", p.color || "");
            return (
              <View key={p.id} style={[s.item, sel && s.itemSelected]}>
                <Pressable onPress={function() { toggleSelect(p.id); }} style={s.itemLeft}>
                  <View style={[s.checkbox, sel && s.checkboxSelected]}>{sel && <Icon name="check" size={10} color="#fff" />}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={s.itemName} numberOfLines={1}>{labelPreview}</Text>
                      {p.has_variants && <Text style={s.varBadge}>V</Text>}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                      <Text style={s.itemCode} numberOfLines={1}>{productCode} | {p.stock} un</Text>
                      {renderColorIndicator(p.color)}
                      {p.size ? <Text style={s.sizeBadge}>{p.size}</Text> : null}
                      {renderEan13Badge(productCode)}
                    </View>
                  </View>
                  <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
                </Pressable>
                {sel && (
                  <View style={s.qtyRow}>
                    <Pressable onPress={function() { setQty(p.id, qty - 1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>{"<"}</Text></Pressable>
                    <TextInput style={s.qtyInput} value={String(qty)} onChangeText={function(v) { var n = parseInt(v); if (!isNaN(n)) setQty(p.id, n); }} keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                    <Pressable onPress={function() { setQty(p.id, qty + 1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>{"›"}</Text></Pressable>
                    <Text style={s.qtyLabel}>etiq.</Text>
                  </View>
                )}
              </View>
            );
          }

          var parentLabelPreview = buildLabelName(p.name, p.size || "", p.color || "");
          var parentQty = getQty(p.id);
          return (
            <View key={p.id} style={[s.item, s.itemSelected]}>
              <View style={s.parentRow}>
                <Pressable onPress={function() { toggleSelect(p.id); }} style={{ marginRight: 8 }}>
                  <View style={[s.checkbox, s.checkboxSelected]}><Icon name="check" size={10} color="#fff" /></View>
                </Pressable>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {renderColorIndicator(p.color)}
                    <Text style={s.itemName} numberOfLines={1}>{parentLabelPreview}</Text>
                    <Text style={s.varBadge}>V</Text>
                    {p.size ? <Text style={s.sizeBadge}>{p.size}</Text> : null}
                  </View>
                  <Text style={s.variantHint}>{variants.length} variante{variants.length > 1 ? "s" : ""} | {selVars.size} selecionada{selVars.size !== 1 ? "s" : ""}{parentChecked ? " + etiqueta do pai" : ""}</Text>
                </View>
                <Pressable onPress={function() { toggleAllVariants(p.id); }} style={s.toggleAllVarsBtn}>
                  <Text style={s.toggleAllVarsText}>{allVarsSelected ? "Nenhuma" : "Todas"}</Text>
                </Pressable>
              </View>

              <View style={[s.variantRow, parentChecked && s.variantRowSelected, s.parentSelfRow]}>
                <Pressable onPress={function() { toggleIncludeParent(p.id); }} style={s.variantLeft}>
                  <View style={[s.checkboxSmall, parentChecked && s.checkboxSmallSelected]}>{parentChecked && <Icon name="check" size={8} color="#fff" />}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {renderColorIndicator(p.color)}
                      <Text style={s.variantName} numberOfLines={1}>{parentLabelPreview}</Text>
                      <Text style={s.parentSelfBadge}>PAI</Text>
                      {p.size ? <Text style={s.sizeBadge}>{p.size}</Text> : null}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                      <Text style={s.variantMeta}>{productCode} | {p.stock} un</Text>
                      {renderEan13Badge(productCode)}
                    </View>
                  </View>
                  <Text style={s.variantPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
                </Pressable>
                {parentChecked && (
                  <View style={s.qtyRowVariant}>
                    <Pressable onPress={function() { setQty(p.id, parentQty - 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"<"}</Text></Pressable>
                    <TextInput style={s.qtyInputSmall} value={String(parentQty)} onChangeText={function(val) { var n = parseInt(val); if (!isNaN(n)) setQty(p.id, n); }} keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                    <Pressable onPress={function() { setQty(p.id, parentQty + 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"›"}</Text></Pressable>
                    <Text style={s.qtyLabel}>etiq.</Text>
                  </View>
                )}
              </View>

              {variants.map(function(v: any) {
                var vsel = selVars.has(v.id);
                var vkey = p.id + "__" + v.id;
                var vqty = getQty(vkey);
                var sc = variantSizeColor(v);
                var vlabel = buildLabelName(p.name, sc.size, sc.color);
                var effectivePrice = v.price_override ? parseFloat(v.price_override) : p.price;
                var vBarcode = v.barcode || p.barcode || p.code;
                var vStock = parseInt(v.stock_qty) || 0;

                return (
                  <View key={v.id} style={[s.variantRow, vsel && s.variantRowSelected]}>
                    <Pressable onPress={function() { toggleVariant(p.id, v.id); }} style={s.variantLeft}>
                      <View style={[s.checkboxSmall, vsel && s.checkboxSmallSelected]}>{vsel && <Icon name="check" size={8} color="#fff" />}</View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {renderColorIndicator(sc.color)}
                          <Text style={s.variantName} numberOfLines={1}>{vlabel}</Text>
                          {sc.size ? <Text style={s.sizeBadge}>{sc.size}</Text> : null}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                          <Text style={s.variantMeta}>{vBarcode} | {vStock} un</Text>
                          {renderEan13Badge(vBarcode)}
                        </View>
                      </View>
                      <Text style={s.variantPrice}>R$ {effectivePrice.toFixed(2).replace(".", ",")}</Text>
                    </Pressable>
                    {vsel && (
                      <View style={s.qtyRowVariant}>
                        <Pressable onPress={function() { setQty(vkey, vqty - 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"<"}</Text></Pressable>
                        <TextInput style={s.qtyInputSmall} value={String(vqty)} onChangeText={function(val) { var n = parseInt(val); if (!isNaN(n)) setQty(vkey, n); }} keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                        <Pressable onPress={function() { setQty(vkey, vqty + 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"›"}</Text></Pressable>
                        <Text style={s.qtyLabel}>etiq.</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Painel: codigos placeholder invalidos */}
      {invalidCodes.length > 0 && (
        <View style={s.invalidPanel}>
          <View style={s.invalidHeader}>
            <Icon name="alert" size={16} color={Colors.red} />
            <Text style={s.invalidTitle}>
              {invalidCodes.length} produto{invalidCodes.length > 1 ? "s" : ""} sem codigo valido - corrija antes de imprimir
            </Text>
            <Pressable onPress={function() { setInvalidCodes([]); }} style={s.invalidClose}>
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>
          <Text style={s.invalidHint}>
            Codigos como "...", "-", "0000" ou muito curtos geram barras ilegiveis no scanner. Edite o produto no Estoque e cadastre um SKU real.
          </Text>
          <ScrollView style={s.invalidList} nestedScrollEnabled>
            {invalidCodes.map(function(item, idx) {
              return (
                <View key={idx} style={s.invalidRow}>
                  <Text style={s.invalidName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.invalidCode}>{item.code}</Text>
                  <Text style={s.invalidReason}>{item.reason}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Painel: geracao de EAN-13 para produtos sem codigo valido */}
      {showEan13Panel && (
        <View style={s.ean13Panel}>
          <View style={s.ean13Header}>
            <Icon name="alert" size={16} color={Colors.amber} />
            <Text style={s.ean13Title}>
              {ean13GenList.length} produto{ean13GenList.length > 1 ? "s" : ""} sem EAN-13 valido
            </Text>
            <Pressable onPress={function() { setShowEan13Panel(false); }} style={s.invalidClose}>
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>
          <Text style={s.ean13Hint}>
            Um EAN-13 interno sera gerado automaticamente (prefixo 200 — uso interno GS1, sem registro). O mesmo produto sempre gera o mesmo codigo. O codigo gerado sera salvo no cadastro do produto.
          </Text>
          <ScrollView style={s.ean13List} nestedScrollEnabled>
            {ean13GenList.map(function(entry, idx) {
              return (
                <View key={idx} style={s.ean13Row}>
                  <Text style={s.ean13ItemName} numberOfLines={1}>{entry.name}</Text>
                  <Text style={s.ean13OldCode} numberOfLines={1}>{entry.originalCode || "(sem codigo)"}</Text>
                  <Text style={s.ean13Arrow}>{"→"}</Text>
                  <Text style={s.ean13NewCode}>{entry.generated}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={s.ean13Actions}>
            <Pressable onPress={function() { setShowEan13Panel(false); }} style={s.ean13CancelBtn}>
              <Text style={s.ean13CancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleConfirmEan13} style={s.ean13ConfirmBtn}>
              <Icon name="file_text" size={14} color="#fff" />
              <Text style={s.ean13ConfirmText}>Usar estes codigos e Imprimir</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable onPress={handlePrint} style={[s.printBtn, totalLabels === 0 && { opacity: 0.5 }]} disabled={totalLabels === 0}>
        <Icon name="file_text" size={16} color="#fff" />
        <Text style={s.printBtnText}>Imprimir {totalLabels} etiqueta(s)</Text>
      </Pressable>
      <View style={s.setupHint}>
        <Icon name="alert" size={12} color={Colors.amber} />
        <Text style={s.setupText}>Chrome: Ctrl+P, papel 99x21mm, Margens: Nenhuma, Escala: 100%. A quantidade padrao e baseada no estoque de cada variante.</Text>
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
  list: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, maxHeight: 520 },
  item: { borderRadius: 10, backgroundColor: Colors.bg, overflow: "hidden", marginBottom: 3 },
  itemSelected: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  parentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkboxSmall: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxSmallSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  itemCode: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" as any },
  itemPrice: { fontSize: 13, color: Colors.green, fontWeight: "700", flexShrink: 0 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
  colorDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  colorBadge: { fontSize: 9, fontWeight: "600", color: Colors.ink2, backgroundColor: Colors.bg4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  sizeBadge: { fontSize: 9, fontWeight: "700", color: Colors.violet3, backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  varBadge: { fontSize: 8, fontWeight: "700", color: "#06b6d4", backgroundColor: "rgba(6,182,212,0.12)", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: "hidden" },
  parentSelfBadge: { fontSize: 8, fontWeight: "800", color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, overflow: "hidden", letterSpacing: 0.3 },
  parentSelfRow: { borderLeftColor: "#f59e0b" + "55" },
  variantHint: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  toggleAllVarsBtn: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  toggleAllVarsText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  variantRow: { marginHorizontal: 8, marginBottom: 3, borderRadius: 8, backgroundColor: Colors.bg, overflow: "hidden", borderLeftWidth: 3, borderLeftColor: "transparent" },
  variantRowSelected: { borderLeftColor: Colors.violet, backgroundColor: Colors.bg + "cc" },
  variantLeft: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10 },
  variantName: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  variantMeta: { fontSize: 9, color: Colors.ink3, fontFamily: "monospace" as any, marginTop: 1 },
  variantPrice: { fontSize: 12, color: Colors.green, fontWeight: "700", flexShrink: 0 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingBottom: 8, paddingLeft: 40 },
  qtyRowVariant: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingBottom: 6, paddingLeft: 34 },
  qtyBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  qtyBtnSmall: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  qtyInput: { width: 48, height: 28, borderRadius: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border2, textAlign: "center", fontSize: 13, fontWeight: "700", color: Colors.ink, paddingVertical: 0 } as any,
  qtyInputSmall: { width: 40, height: 24, borderRadius: 6, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border2, textAlign: "center", fontSize: 12, fontWeight: "700", color: Colors.ink, paddingVertical: 0 } as any,
  qtyLabel: { fontSize: 10, color: Colors.ink3, marginLeft: 2 },
  printBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14 },
  printBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  setupHint: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.amber + "33" },
  setupText: { fontSize: 10, color: Colors.amber, flex: 1, lineHeight: 16 },
  // Painel codigos invalidos (placeholder)
  invalidPanel: { backgroundColor: Colors.redD, borderRadius: 12, borderWidth: 1, borderColor: Colors.red + "44", padding: 12, gap: 8 },
  invalidHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  invalidTitle: { fontSize: 13, color: Colors.red, fontWeight: "700", flex: 1 },
  invalidClose: { padding: 4, borderRadius: 6 },
  invalidHint: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },
  invalidList: { maxHeight: 160, borderRadius: 8, backgroundColor: Colors.bg, padding: 4 },
  invalidRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  invalidName: { fontSize: 11, color: Colors.ink, fontWeight: "600", flex: 1 },
  invalidCode: { fontSize: 10, color: Colors.red, fontFamily: "monospace" as any, fontWeight: "700", backgroundColor: Colors.redD, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  invalidReason: { fontSize: 10, color: Colors.ink3, flex: 1.5 },
  // Badge EAN-13 na lista
  ean13Badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  ean13BadgeOk: { backgroundColor: "rgba(34,197,94,0.12)" },
  ean13BadgeWarn: { backgroundColor: "rgba(245,158,11,0.15)" },
  ean13BadgeText: { fontSize: 8, fontWeight: "700" },
  ean13BadgeTextOk: { color: Colors.green },
  ean13BadgeTextWarn: { color: Colors.amber },
  // Painel geracao EAN-13
  ean13Panel: { backgroundColor: Colors.amberD, borderRadius: 12, borderWidth: 1, borderColor: Colors.amber + "55", padding: 12, gap: 8 },
  ean13Header: { flexDirection: "row", alignItems: "center", gap: 8 },
  ean13Title: { fontSize: 13, color: Colors.amber, fontWeight: "700", flex: 1 },
  ean13Hint: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },
  ean13List: { maxHeight: 150, borderRadius: 8, backgroundColor: Colors.bg, padding: 4 },
  ean13Row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ean13ItemName: { fontSize: 11, color: Colors.ink, fontWeight: "600", flex: 1.5, minWidth: 0 },
  ean13OldCode: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" as any, flex: 1, minWidth: 0 },
  ean13Arrow: { fontSize: 12, color: Colors.ink3 },
  ean13NewCode: { fontSize: 10, color: Colors.green, fontFamily: "monospace" as any, fontWeight: "700", backgroundColor: "rgba(34,197,94,0.1)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ean13Actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" },
  ean13CancelBtn: { backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  ean13CancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  ean13ConfirmBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  ean13ConfirmText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default PrintLabels;
