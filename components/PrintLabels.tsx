import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import type { Product } from "@/components/screens/estoque/types";

type Props = {
  products: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function PrintLabels({ products, selectedIds, onSelectionChange }: Props) {
  var { company, token } = useAuthStore();
  var [mode, setMode] = useState<"barcode" | "qr">("barcode");
  var [search, setSearch] = useState("");
  var [quantities, setQuantities] = useState<Record<string, number>>({});
  var [showStoreName, setShowStoreName] = useState(true);
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
      return p.name.toLowerCase().includes(q) ||
        (p.barcode || p.code || "").toLowerCase().includes(q);
    });
  }, [productsWithCode, search]);

  function getQty(id: string) { return quantities[id] || 1; }
  function setQty(id: string, n: number) {
    var v = Math.max(1, Math.min(999, n));
    setQuantities(function(prev) { return { ...prev, [id]: v }; });
  }

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(function(i) { return i !== id; }));
    } else {
      onSelectionChange([...selectedIds, id]);
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
      onSelectionChange(Array.from(new Set([...selectedIds, ...ids])));
      var newQtys: Record<string, number> = { ...quantities };
      filtered.forEach(function(p) {
        if (!newQtys[p.id] && p.stock > 1) newQtys[p.id] = p.stock;
      });
      setQuantities(newQtys);
    }
  }

  var totalLabels = selectedIds.reduce(function(sum, id) { return sum + getQty(id); }, 0);

  function handlePrint() {
    if (!isWeb || !company?.id || !token || selectedIds.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    var selected = products.filter(function(p) { return selectedIds.includes(p.id) && (p.barcode || p.code); });
    if (selected.length === 0) { toast.error("Produtos sem codigo"); return; }

    var isQR = mode === "qr";
    var COLS = 3;

    var firstCode = selected[0].barcode || selected[0].code;
    var numOnly = /^\d+$/.test(firstCode);
    var jsFormat = "CODE128";
    if (numOnly && firstCode.length === 13) jsFormat = "EAN13";
    else if (numOnly && firstCode.length === 8) jsFormat = "EAN8";
    else if (numOnly && firstCode.length === 12) jsFormat = "UPC";

    var storeHeader = showStoreName && storeName ? esc(storeName.toUpperCase()) : "";

    // Build cells — repeat each product by its quantity
    // CRITICAL: <td class="cell"> stays as table-cell (NO display:flex on td).
    //           Flex layout goes on inner <div class="bc-inner"> or <div class="qr-inner">.
    //           This preserves the 3-column table layout.
    var cells: string[] = [];
    var labelIdx = 0;
    selected.forEach(function(p) {
      var qty = getQty(p.id);
      var code = esc(p.barcode || p.code);
      var name = esc(p.name);
      var price = "R$ " + p.price.toFixed(2).replace(".", ",");

      for (var q = 0; q < qty; q++) {
        if (isQR) {
          var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(p.barcode || p.code) + "&bgcolor=ffffff&color=000000&margin=1";
          cells.push(
            '<td class="cell"><div class="qr-inner">' +
              '<img src="' + qrUrl + '" class="qr">' +
              '<div class="info">' +
                (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
                '<div class="name">' + name + '</div>' +
                '<div class="price">' + price + '</div>' +
              '</div>' +
            '</div></td>'
          );
        } else {
          var storeLine = storeHeader ? '<div class="store">' + storeHeader + '</div>' : '';
          cells.push(
            '<td class="cell"><div class="bc-inner">' +
              storeLine +
              '<div class="name">' + name + '</div>' +
              '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
              '<div class="price">' + price + '</div>' +
            '</div></td>'
          );
        }
        labelIdx++;
      }
    });

    while (cells.length % COLS !== 0) {
      cells.push('<td class="cell"></td>');
    }

    var rowsHtml = "";
    for (var r = 0; r < cells.length; r += COLS) {
      rowsHtml += "<tr>" + cells.slice(r, r + COLS).join("") + "</tr>\n";
    }
    var totalRows = cells.length / COLS;

    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
    html += '<title>Etiquetas Aura - ' + totalLabels + ' etiquetas</title>';
    if (!isQR) {
      html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></scr' + 'ipt>';
    }
    html += '<style>';
    html += '@page{margin:0;size:99mm 21mm}';
    html += '*{margin:0;padding:0;box-sizing:border-box}';
    html += 'body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#000}';
    // TABLE: 99mm = 3 x 33mm. table-layout:fixed forces equal columns.
    html += 'table{border-collapse:collapse;width:99mm;table-layout:fixed}';
    html += 'tr{height:21mm;page-break-inside:avoid}';
    // CELL: plain td, NO display override — must remain display:table-cell for 3-col layout
    html += '.cell{width:33mm;height:21mm;overflow:hidden;vertical-align:top;padding:0}';
    // BARCODE inner div — flex column, full height of cell
    html += '.bc-inner{padding:0.8mm 1mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;height:21mm;width:33mm;gap:0.3mm}';
    html += '.bc-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
    html += '.bc-inner .name{font-size:6pt;font-weight:500;line-height:1.05;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#000}';
    html += '.bc-inner .bc-box{flex:1 1 auto;width:100%;max-width:31mm;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;padding:0.2mm 0}';
    html += '.bc-inner .bc-box svg{max-width:100%;max-height:100%;width:auto;height:auto;display:block}';
    html += '.bc-inner .price{font-size:9pt;font-weight:900;line-height:1;color:#000}';
    // QR inner div — flex row
    html += '.qr-inner{display:flex;flex-direction:row;align-items:center;padding:1mm 1.5mm;gap:1.5mm;height:21mm;width:33mm}';
    html += '.qr-inner .qr{width:17mm;height:17mm;flex-shrink:0;image-rendering:pixelated}';
    html += '.qr-inner .info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.4mm;overflow:hidden}';
    html += '.qr-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
    html += '.qr-inner .name{font-size:6pt;font-weight:600;line-height:1.15;max-height:9mm;overflow:hidden;word-break:break-word;color:#000}';
    html += '.qr-inner .price{font-size:8pt;font-weight:900;white-space:nowrap;color:#000;margin-top:0.4mm}';
    // Preview bar (hidden on print)
    html += '.preview-bar{position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999;font-family:-apple-system,sans-serif}';
    html += '.preview-bar span{color:#a78bfa;font-size:12px}';
    html += '.preview-bar b{color:#e2e8f0;font-size:13px}';
    html += '.preview-bar button{background:#7c3aed;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}';
    html += '.preview-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;padding-bottom:80px}';
    html += '.preview-wrap table{border:1px dashed #ccc}';
    html += '.preview-wrap .cell{border:1px dashed #eee}';
    html += '@media print{.preview-bar{display:none!important}.preview-wrap{padding:0;gap:0}.preview-wrap table{border:none}.preview-wrap .cell{border:none}body{background:#fff}}';
    html += '</style></head><body>';
    html += '<div class="preview-wrap"><table>' + rowsHtml + '</table></div>';
    html += '<div class="preview-bar"><div><span>Etiqueta 33x21mm x 3 colunas (' + (isQR ? "QR Code" : "Codigo de barras legivel") + ')</span><br><b>' + totalLabels + ' etiqueta' + (totalLabels > 1 ? 's' : '') + ' (' + selected.length + ' produto' + (selected.length > 1 ? 's' : '') + ') em ' + totalRows + ' linha' + (totalRows > 1 ? 's' : '') + '</b></div>';
    html += '<button onclick="window.print()">Imprimir</button></div>';

    if (!isQR) {
      html += '<script>';
      html += 'document.querySelectorAll("[data-code]").forEach(function(el){';
      html += 'var code=el.getAttribute("data-code");';
      html += 'var opts={width:2,height:38,margin:2,displayValue:true,fontSize:13,textMargin:1,font:"Arial",fontOptions:"bold",background:"#ffffff",lineColor:"#000000"};';
      html += 'try{JsBarcode(el,code,Object.assign({},opts,{format:"' + jsFormat + '"}));}';
      html += 'catch(e){try{JsBarcode(el,code,Object.assign({},opts,{format:"CODE128"}));}catch(e2){console.error(e2);}}';
      html += '});';
      html += '</scr' + 'ipt>';
    }
    html += '</body></html>';

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
    } catch (err) {
      console.error("[PrintLabels] Error:", err);
      toast.error("Erro ao gerar etiquetas");
    }
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
          return (
            <View key={p.id} style={[s.item, sel && s.itemSelected]}>
              <Pressable onPress={function() { toggleSelect(p.id); }} style={s.itemLeft}>
                <View style={[s.checkbox, sel && s.checkboxSelected]}>
                  {sel && <Icon name="check" size={10} color="#fff" />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemName} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.itemCode} numberOfLines={1}>{p.barcode || p.code} | {p.stock} un</Text>
                </View>
                <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
              </Pressable>
              {sel && (
                <View style={s.qtyRow}>
                  <Pressable onPress={function() { setQty(p.id, qty - 1); }} style={s.qtyBtn}>
                    <Text style={s.qtyBtnText}>{"<"}</Text>
                  </Pressable>
                  <TextInput
                    style={s.qtyInput}
                    value={String(qty)}
                    onChangeText={function(v) { var n = parseInt(v); if (!isNaN(n)) setQty(p.id, n); }}
                    keyboardType="number-pad"
                    maxLength={3}
                    selectTextOnFocus
                  />
                  <Pressable onPress={function() { setQty(p.id, qty + 1); }} style={s.qtyBtn}>
                    <Text style={s.qtyBtnText}>{"\u203A"}</Text>
                  </Pressable>
                  <Text style={s.qtyLabel}>etiq.</Text>
                </View>
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
  itemCode: { fontSize: 10, color: Colors.ink3, marginTop: 1, fontFamily: "monospace" as any },
  itemPrice: { fontSize: 13, color: Colors.green, fontWeight: "700", flexShrink: 0 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
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
