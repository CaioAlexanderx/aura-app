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

/** Escape HTML special chars to prevent broken labels */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function PrintLabels({ products, selectedIds, onSelectionChange }: Props) {
  const { company, token } = useAuthStore();
  const [mode, setMode] = useState<"barcode" | "qr">("barcode");
  const [search, setSearch] = useState("");
  const isWeb = Platform.OS === "web";

  const productsWithCode = useMemo(
    () => products.filter(p => p.barcode || p.code),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return productsWithCode;
    return productsWithCode.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode || p.code || "").toLowerCase().includes(q)
    );
  }, [productsWithCode, search]);

  function toggleSelect(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    );
  }

  function toggleAll() {
    const ids = filtered.map(p => p.id);
    if (ids.every(id => selectedIds.includes(id))) {
      onSelectionChange(selectedIds.filter(id => !ids.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...selectedIds, ...ids])));
    }
  }

  function handlePrint() {
    if (!isWeb || !company?.id || !token || selectedIds.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    const selected = products.filter(p => selectedIds.includes(p.id) && (p.barcode || p.code));
    if (selected.length === 0) { toast.error("Produtos sem codigo"); return; }

    const isQR = mode === "qr";

    // Detect barcode format
    const firstCode = selected[0].barcode || selected[0].code;
    const numOnly = /^\d+$/.test(firstCode);
    let jsFormat = "CODE128";
    if (numOnly && firstCode.length === 13) jsFormat = "EAN13";
    else if (numOnly && firstCode.length === 8) jsFormat = "EAN8";
    else if (numOnly && firstCode.length === 12) jsFormat = "UPC";
    const barWidth = jsFormat === "EAN13" || jsFormat === "EAN8" || jsFormat === "UPC" ? 1.0 : 0.8;

    // Build label HTML with escaped product names
    const labelHtml = selected.map((p, i) => {
      const code = esc(p.barcode || p.code);
      const name = esc(p.name);
      const price = "R$ " + p.price.toFixed(2).replace(".", ",");

      if (isQR) {
        const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(p.barcode || p.code) + "&bgcolor=ffffff&color=000000&margin=1";
        return '<div class="label qr-layout"><img src="' + qrUrl + '" class="qr" alt="QR"><div class="info"><div class="name">' + name + '</div><div class="price">' + price + '</div></div></div>';
      }
      return '<div class="label barcode-layout"><div class="barcode-wrap"><svg class="barcode" id="bc-' + i + '" data-code="' + code + '"></svg></div><div class="name">' + name + '</div><div class="price">' + price + '</div></div>';
    }).join("\n");

    // Build full HTML — uses string concat to avoid template literal escaping issues
    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
    html += '<title>Etiquetas Aura - ' + selected.length + ' produtos</title>';
    if (!isQR) {
      html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></scr' + 'ipt>';
    }
    html += '<style>';
    html += '@page{margin:0;size:33mm 21mm}';
    html += '*{margin:0;padding:0;box-sizing:border-box}';
    html += 'body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5}';
    html += '.label{width:33mm;height:21mm;background:#fff;overflow:hidden;page-break-after:always}';
    html += '.label:last-child{page-break-after:auto}';
    html += '.barcode-layout{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1mm 2mm;text-align:center;height:100%}';
    html += '.barcode-wrap{width:100%;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}';
    html += '.barcode-wrap svg{max-width:28mm;max-height:10mm;height:auto}';
    html += '.barcode-layout .name{font-size:5pt;font-weight:600;line-height:1.1;max-height:4.5mm;overflow:hidden;word-break:break-word;margin-top:0.5mm}';
    html += '.barcode-layout .price{font-size:7pt;font-weight:900;margin-top:0.2mm}';
    html += '.qr-layout{display:flex;flex-direction:row;align-items:center;padding:1mm 1.5mm;gap:1.5mm}';
    html += '.qr-layout .qr{width:17mm;height:17mm;flex-shrink:0;image-rendering:pixelated}';
    html += '.qr-layout .info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.5mm;overflow:hidden}';
    html += '.qr-layout .name{font-size:5.5pt;font-weight:700;line-height:1.15;max-height:10mm;overflow:hidden;word-break:break-word}';
    html += '.qr-layout .price{font-size:7.5pt;font-weight:900;white-space:nowrap}';
    html += '.preview-bar{position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999;font-family:-apple-system,sans-serif}';
    html += '.preview-bar span{color:#a78bfa;font-size:12px}';
    html += '.preview-bar b{color:#e2e8f0;font-size:13px}';
    html += '.preview-bar button{background:#7c3aed;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}';
    html += '.label-preview{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:20px;padding-bottom:80px}';
    html += '.label-preview .label{border:1px dashed #ccc;border-radius:2px}';
    html += '@media print{.preview-bar{display:none!important}.label-preview{padding:0;gap:0}.label-preview .label{border:none}body{background:#fff}}';
    html += '</style></head><body>';
    html += '<div class="label-preview">' + labelHtml + '</div>';
    html += '<div class="preview-bar"><div><span>Etiqueta 33x21mm (' + (isQR ? "QR Code" : "Codigo de barras") + ')</span><br><b>' + selected.length + ' produto' + (selected.length > 1 ? 's' : '') + '</b></div>';
    html += '<button onclick="window.print()">Imprimir</button></div>';
    if (!isQR) {
      html += '<script>';
      html += 'document.querySelectorAll(".barcode").forEach(function(el){';
      html += 'var code=el.getAttribute("data-code");';
      html += 'try{JsBarcode(el,code,{format:"' + jsFormat + '",width:' + barWidth + ',height:24,margin:4,fontSize:7,textMargin:1,displayValue:true,font:"Arial",background:"#ffffff",lineColor:"#000000"});}';
      html += 'catch(e){try{JsBarcode(el,code,{format:"CODE128",width:0.8,height:24,margin:4,fontSize:7,textMargin:1,displayValue:true,font:"Arial",background:"#ffffff",lineColor:"#000000"});}catch(e2){}}';
      html += '});';
      html += '</scr' + 'ipt>';
    }
    html += '</body></html>';

    // Use Blob URL instead of document.write — does NOT inherit CSP from opener
    try {
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var w = window.open(url, "_blank");
      if (!w) {
        // Fallback: try document.write if popup was blocked
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

  const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.includes(p.id));

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Etiquetas 33x21mm</Text>
          <Text style={s.hint}>Selecione os produtos e clique em imprimir. Otimizado para Bematech L42 PRO.</Text>
        </View>
        <View style={s.modeToggle}>
          <Pressable onPress={() => setMode("barcode")} style={[s.modeBtn, mode === "barcode" && s.modeBtnActive]}>
            <Text style={[s.modeText, mode === "barcode" && s.modeTextActive]}>Cod. barras</Text>
          </Pressable>
          <Pressable onPress={() => setMode("qr")} style={[s.modeBtn, mode === "qr" && s.modeBtnActive]}>
            <Text style={[s.modeText, mode === "qr" && s.modeTextActive]}>QR Code</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput style={s.searchInput} placeholder="Buscar produto..." placeholderTextColor={Colors.ink3}
            value={search} onChangeText={setSearch} />
          {search.length > 0 && <Pressable onPress={() => setSearch("")}><Icon name="x" size={12} color={Colors.ink3} /></Pressable>}
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
        {filtered.map(p => {
          const selected = selectedIds.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => toggleSelect(p.id)} style={[s.item, selected && s.itemSelected]}>
              <View style={[s.checkbox, selected && s.checkboxSelected]}>
                {selected && <Icon name="check" size={10} color="#fff" />}
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
        <Text style={s.setupText}>Bematech L42 PRO: tamanho do papel 33x21mm. Chrome: Ctrl+P, Margens: Nenhuma, Escala: 100%.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
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
