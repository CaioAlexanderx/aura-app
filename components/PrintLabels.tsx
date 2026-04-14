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
  var isWeb = Platform.OS === "web";

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

  function toggleSelect(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(function(i) { return i !== id; })
        : [...selectedIds, id]
    );
  }

  function toggleAll() {
    var ids = filtered.map(function(p) { return p.id; });
    if (ids.every(function(id) { return selectedIds.includes(id); })) {
      onSelectionChange(selectedIds.filter(function(id) { return !ids.includes(id); }));
    } else {
      onSelectionChange(Array.from(new Set([...selectedIds, ...ids])));
    }
  }

  function handlePrint() {
    if (!isWeb || !company?.id || !token || selectedIds.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    var selected = products.filter(function(p) { return selectedIds.includes(p.id) && (p.barcode || p.code); });
    if (selected.length === 0) { toast.error("Produtos sem codigo"); return; }

    var isQR = mode === "qr";
    var COLS = 3;

    // Detect barcode format
    var firstCode = selected[0].barcode || selected[0].code;
    var numOnly = /^\d+$/.test(firstCode);
    var jsFormat = "CODE128";
    if (numOnly && firstCode.length === 13) jsFormat = "EAN13";
    else if (numOnly && firstCode.length === 8) jsFormat = "EAN8";
    else if (numOnly && firstCode.length === 12) jsFormat = "UPC";

    // Build individual label cells
    var cells = selected.map(function(p, i) {
      var code = esc(p.barcode || p.code);
      var name = esc(p.name);
      var price = "R$ " + p.price.toFixed(2).replace(".", ",");

      if (isQR) {
        var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(p.barcode || p.code) + "&bgcolor=ffffff&color=000000&margin=1";
        return '<td class="cell qr-layout"><img src="' + qrUrl + '" class="qr"><div class="info"><div class="name">' + name + '</div><div class="price">' + price + '</div></div></td>';
      }
      return '<td class="cell bc-layout"><div class="bc-box"><svg id="bc-' + i + '" data-code="' + code + '"></svg></div><div class="name">' + name + '</div><div class="price">' + price + '</div></td>';
    });

    // Pad last row
    while (cells.length % COLS !== 0) {
      cells.push('<td class="cell"></td>');
    }

    // Group cells into rows
    var rowsHtml = "";
    for (var r = 0; r < cells.length; r += COLS) {
      rowsHtml += "<tr>" + cells.slice(r, r + COLS).join("") + "</tr>\n";
    }
    var totalRows = cells.length / COLS;

    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
    html += '<title>Etiquetas Aura - ' + selected.length + ' produtos</title>';
    if (!isQR) {
      html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></scr' + 'ipt>';
    }
    html += '<style>';
    html += '@page{margin:0;size:99mm 21mm}';
    html += '*{margin:0;padding:0;box-sizing:border-box}';
    html += 'body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5}';

    html += 'table{border-collapse:collapse;width:99mm;table-layout:fixed}';
    html += 'tr{height:21mm;page-break-after:always;page-break-inside:avoid}';
    html += 'tr:last-child{page-break-after:auto}';
    html += '.cell{width:33mm;height:21mm;background:#fff;overflow:hidden;vertical-align:top;padding:0}';

    // BARCODE layout — clear separation between barcode zone and text zone
    // Total 21mm: 1mm top pad + 11mm barcode + 0.5mm gap + 3.5mm name + 4mm price + 1mm bottom pad
    html += '.bc-layout{text-align:center;padding:1mm 1.5mm}';
    html += '.bc-box{width:28mm;height:11mm;margin:0 auto;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff}';
    html += '.bc-box svg{width:100%!important;height:100%!important;display:block}';
    html += '.bc-layout .name{font-size:5.5pt;font-weight:600;line-height:1.1;max-height:3.5mm;overflow:hidden;word-break:break-word;margin-top:0.5mm;white-space:nowrap;text-overflow:ellipsis}';
    html += '.bc-layout .price{font-size:8pt;font-weight:900;margin-top:0.3mm}';

    // QR layout
    html += '.qr-layout{display:flex;flex-direction:row;align-items:center;padding:1mm 1.5mm;gap:1.5mm}';
    html += '.qr-layout .qr{width:17mm;height:17mm;flex-shrink:0;image-rendering:pixelated}';
    html += '.qr-layout .info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.5mm;overflow:hidden}';
    html += '.qr-layout .name{font-size:5.5pt;font-weight:700;line-height:1.15;max-height:10mm;overflow:hidden;word-break:break-word}';
    html += '.qr-layout .price{font-size:7.5pt;font-weight:900;white-space:nowrap}';

    // Preview
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
    html += '<div class="preview-bar"><div><span>Etiqueta 33x21mm x 3 colunas (' + (isQR ? "QR Code" : "Codigo de barras") + ')</span><br><b>' + selected.length + ' etiqueta' + (selected.length > 1 ? 's' : '') + ' em ' + totalRows + ' linha' + (totalRows > 1 ? 's' : '') + '</b></div>';
    html += '<button onclick="window.print()">Imprimir</button></div>';

    if (!isQR) {
      html += '<script>';
      html += 'document.querySelectorAll("[data-code]").forEach(function(el){';
      html += 'var code=el.getAttribute("data-code");';
      // FIX: displayValue:false — prevents number text overlapping with product name
      // FIX: height:50 + margin:8 — taller bars + wider quiet zones for reliable scanning
      // FIX: width:1.5 — slightly wider bars for thermal printer clarity
      html += 'try{JsBarcode(el,code,{format:"' + jsFormat + '",width:1.5,height:50,margin:8,displayValue:false,background:"#ffffff",lineColor:"#000000"});}';
      html += 'catch(e){try{JsBarcode(el,code,{format:"CODE128",width:1.5,height:50,margin:8,displayValue:false,background:"#ffffff",lineColor:"#000000"});}catch(e2){}}';
      // Convert fixed pixel dimensions to viewBox for responsive scaling inside .bc-box
      html += 'var w=el.getAttribute("width");var h=el.getAttribute("height");';
      html += 'if(w&&h){el.setAttribute("viewBox","0 0 "+w+" "+h);el.removeAttribute("width");el.removeAttribute("height");}';
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
        else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
      }
      toast.success(selected.length + " etiqueta(s) abertas para impressao");
    } catch (err) {
      console.error("[PrintLabels] Error:", err);
      toast.error("Erro ao gerar etiquetas");
    }
  }

  var allSelected = filtered.length > 0 && filtered.every(function(p) { return selectedIds.includes(p.id); });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Etiquetas 33x21mm (3 colunas)</Text>
          <Text style={s.hint}>Selecione os produtos e clique em imprimir. Otimizado para Bematech L42 PRO.</Text>
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
          return (
            <Pressable key={p.id} onPress={function() { toggleSelect(p.id); }} style={[s.item, sel && s.itemSelected]}>
              <View style={[s.checkbox, sel && s.checkboxSelected]}>
                {sel && <Icon name="check" size={10} color="#fff" />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.itemName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.itemCode} numberOfLines={1}>{p.barcode || p.code}</Text>
              </View>
              <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={handlePrint} style={[s.printBtn, selectedIds.length === 0 && { opacity: 0.5 }]} disabled={selectedIds.length === 0}>
        <Icon name="file_text" size={16} color="#fff" />
        <Text style={s.printBtnText}>Imprimir {selectedIds.length} etiqueta(s)</Text>
      </Pressable>

      <View style={s.setupHint}>
        <Icon name="alert" size={12} color={Colors.amber} />
        <Text style={s.setupText}>Chrome: Ctrl+P, tamanho do papel 99x21mm (ou 100x21mm), Margens: Nenhuma, Escala: 100%. Criar formulario no Windows se nao aparecer.</Text>
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
  toolbar: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink } as any,
  selectAllBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  selectAllText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  list: { gap: 3, backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, maxHeight: 400 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: Colors.bg },
  itemSelected: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  itemCode: { fontSize: 10, color: Colors.ink3, marginTop: 1, fontFamily: "monospace" as any },
  itemPrice: { fontSize: 13, color: Colors.green, fontWeight: "700", flexShrink: 0 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
  printBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14 },
  printBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  setupHint: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.amber + "33" },
  setupText: { fontSize: 10, color: Colors.amber, flex: 1, lineHeight: 16 },
});

export default PrintLabels;
