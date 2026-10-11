// ============================================================
// AURA. -- VariantPickerModal
// Modal para selecionar variante de um produto (cor/tamanho/etc)
// Usado no PDV (Fase C) e na Venda retroativa (TransactionModal).
// FIX: herda cor/tamanho do produto pai quando variante nao tem atributos
// 08/05/2026: opcao "vender pai" mostra cor+tamanho do pai em vez de
// "Sem variante específica · genérico" — quando ha atributos no pai.
// 01/06/2026: prop opcional `blockOutOfStock` — quando true, variantes
// (e a opcao pai) com estoque <= 0 ficam DESABILITADAS e marcadas como
// "Esgotado", impedindo selecao. Usado na Troca (Step3) pra nao deixar
// o operador escolher um tamanho sem estoque (que falharia no submit com
// "Estoque insuficiente"). Default false preserva o comportamento atual
// do PDV/venda retroativa (que so sinaliza estoque baixo, sem bloquear).
// 11/10/2026: bipe confirma o tamanho. O Caixa lancava direto a variante do
// codigo bipado; agora abre este seletor com ela JA marcada ("Bipado") e os
// outros tamanhos a vista — Enter confirma, setas trocam. Um bipe novo com o
// seletor aberto confirma o tamanho marcado e segue para o proximo codigo.
// Tudo opcional (`keyboard`, `preselect*`, `onScanAgain`): Troca e venda
// retroativa continuam como estavam.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { hexToName } from "@/utils/colorNames";
import { criarDetector, OCIOSO_MS, CONFIRMA_OCIOSO_MS } from "@/utils/leituraRapida";

/** Tempo em que o Enter e ignorado logo depois de o seletor marcar o tamanho
 *  bipado: leitor que manda Enter duas vezes (CR+LF) nao confirma sozinho. */
export var ENTER_LIBERADO_APOS_MS = 250;

export type VariantChoice = {
  id: string;
  label: string;
  price: number;
  stock: number;
  barcode?: string;
};

var isWeb = Platform.OS === "web";

var COLOR_NAME_TO_HEX: Record<string, string> = {
  preto: "#000000", branco: "#ffffff", vermelho: "#ef4444", azul: "#3b82f6",
  verde: "#22c55e", amarelo: "#eab308", rosa: "#ec4899", roxo: "#8b5cf6",
  laranja: "#f97316", marrom: "#92400e", bege: "#d4b896", cinza: "#6b7280",
  prata: "#c0c0c0", dourado: "#d4a017", nude: "#e8c4a0", caramelo: "#c68e4e",
};

function toHex(val: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(val)) return val;
  var m = val.match(/#[0-9a-fA-F]{6}/);
  if (m) return m[0];
  return COLOR_NAME_TO_HEX[val.toLowerCase().trim()] || null;
}

function getLabel(v: any, parentColor?: string, parentSize?: string): string {
  var attrs = v.attributes || [];
  var parts: string[] = [];
  for (var a of attrs) {
    if (!a.value) continue;
    if (/^#[0-9a-fA-F]{6}$/.test(a.value)) parts.push(hexToName(a.value));
    else parts.push(a.value);
  }
  // Fallback: if variant has no attributes, show parent info + suffix
  if (parts.length === 0) {
    var inherited: string[] = [];
    if (parentColor) inherited.push(hexToName(parentColor) || parentColor);
    if (parentSize) inherited.push(parentSize);
    var suffix = v.sku_suffix || "Variante";
    return inherited.length > 0 ? suffix + " · " + inherited.join(" · ") : suffix;
  }
  return parts.join(" · ");
}

function getColor(v: any, parentColor?: string): string | null {
  var attrs = v.attributes || [];
  for (var a of attrs) {
    var h = toHex(a.value || "");
    if (h) return h;
  }
  // Fallback to parent color
  if (parentColor) return toHex(parentColor);
  return null;
}

// Rotulo da opcao "vender o pai diretamente" — preferimos os atributos do
// proprio pai (cor + tamanho) em vez de um generico "Sem variante específica".
function buildParentLabel(parentColor?: string, parentSize?: string): { label: string; sub: string } {
  var parts: string[] = [];
  if (parentColor) {
    var nm = hexToName(parentColor) || parentColor;
    parts.push(nm);
  }
  if (parentSize) parts.push(parentSize);
  if (parts.length > 0) {
    return { label: parts.join(" · "), sub: "estoque do produto pai" };
  }
  return { label: "Sem variante específica", sub: "genérico" };
}

export function VariantPickerModal({
  visible, product, onSelect, onClose, blockOutOfStock = false,
  keyboard = false, preselectVariantId = null, preselectBarcode = null, onScanAgain,
}: {
  visible: boolean;
  product: { id: string; name: string; price: number; color?: string; size?: string; stock?: number } | null;
  onSelect: (variant: VariantChoice) => void;
  onClose: () => void;
  blockOutOfStock?: boolean;
  /** Enter confirma a variante marcada; setas trocam. So o Caixa liga. */
  keyboard?: boolean;
  /** Variante que o bipe identificou: abre ja marcada. */
  preselectVariantId?: string | null;
  /** Codigo bipado: marca a variante que tem esse codigo de barras. */
  preselectBarcode?: string | null;
  /** Bipe com o seletor aberto, depois de confirmar a variante marcada. */
  onScanAgain?: (code: string) => void;
}) {
  var { company } = useAuthStore();
  var [variants, setVariants] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [selId, setSelId] = useState<string | null>(null);
  var [bipadoId, setBipadoId] = useState<string | null>(null);
  var enterLiberadoEm = useRef(0);
  var scrollRef = useRef<any>(null);
  var posicoes = useRef<Record<string, number>>({});
  var vivo = useRef<any>({});

  useEffect(function() {
    if (!visible || !product || !company?.id) { setVariants([]); return; }
    setLoading(true);
    setVariants([]); // bipe em sequência troca o produto com o seletor aberto
    companiesApi.variants(company.id, product.id)
      .then(function(res) { setVariants(res.variants || []); })
      .catch(function() { setVariants([]); })
      .finally(function() { setLoading(false); });
  }, [visible, product?.id, company?.id]);

  var activeVariants = variants.filter(function(v: any) { return v.is_active !== false; });
  var parentColor = (product && product.color) || "";
  var parentSize = (product && product.size) || "";

  function escolhaDe(v: any): VariantChoice {
    var preco = v.price_override ? parseFloat(v.price_override) : (product ? product.price : 0);
    return { id: v.id, label: getLabel(v, parentColor, parentSize), price: preco, stock: parseInt(v.stock_qty) || 0, barcode: v.barcode };
  }
  function bloqueada(v: any): boolean {
    return blockOutOfStock && (parseInt(v.stock_qty) || 0) <= 0;
  }

  // Tamanho bipado ja marcado quando as variantes chegam.
  useEffect(function() {
    if (!visible) { setSelId(null); setBipadoId(null); return; }
    var alvo = (preselectVariantId ? activeVariants.find(function(v: any) { return v.id === preselectVariantId; }) : null)
      || (preselectBarcode ? activeVariants.find(function(v: any) { return v.barcode && String(v.barcode) === preselectBarcode; }) : null);
    if (alvo && bloqueada(alvo)) alvo = null;
    setSelId(alvo ? alvo.id : null);
    setBipadoId(alvo ? alvo.id : null);
    enterLiberadoEm.current = Date.now() + ENTER_LIBERADO_APOS_MS;
  }, [visible, variants, preselectVariantId, preselectBarcode, product?.id]);

  // A variante marcada fica a vista (lista longa de tamanhos).
  useEffect(function() {
    if (!selId || !scrollRef.current || typeof scrollRef.current.scrollTo !== "function") return;
    var y = posicoes.current[selId];
    if (typeof y === "number") scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: false });
  }, [selId, loading]);

  vivo.current = { activeVariants: activeVariants, selId: selId, onSelect: onSelect, onScanAgain: onScanAgain, escolhaDe: escolhaDe, bloqueada: bloqueada };

  // Teclado (web): Enter confirma, setas trocam, bipe novo confirma e segue.
  useEffect(function() {
    if (!isWeb || !keyboard || !visible || typeof window === "undefined") return;
    var det = criarDetector();
    var timer: any = null;

    function marcada(): VariantChoice | null {
      var L = vivo.current;
      var v = L.activeVariants.find(function(x: any) { return x.id === L.selId; });
      return v && !L.bloqueada(v) ? L.escolhaDe(v) : null;
    }
    function bipeNovo() {
      timer = null;
      var code = det.leitura();
      if (!code) return;
      det.reset();
      var L = vivo.current;
      var atual = marcada();
      if (!atual || !L.onScanAgain) return; // nada marcado: o bipe nao decide por ninguem
      L.onSelect(atual);
      L.onScanAgain(code);
    }
    function mover(passo: number) {
      var L = vivo.current;
      var ids = L.activeVariants.filter(function(v: any) { return !L.bloqueada(v); }).map(function(v: any) { return v.id; });
      if (!ids.length) return;
      var i = ids.indexOf(L.selId);
      var prox = i < 0 ? (passo > 0 ? 0 : ids.length - 1) : Math.min(ids.length - 1, Math.max(0, i + passo));
      setSelId(ids[prox]);
    }
    function aoTecla(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Enter") {
        // preventDefault tambem impede o Enter de "clicar" o botao que ficou
        // com o foco atras do seletor.
        e.preventDefault();
        if (timer) { clearTimeout(timer); timer = null; }
        if (det.leitura()) { bipeNovo(); return; }
        det.reset();
        if (e.repeat || Date.now() < enterLiberadoEm.current) return;
        var atual = marcada();
        if (atual) vivo.current.onSelect(atual);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        mover(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key && e.key.length === 1 && !e.repeat) {
        det.tecla(e.key, e.timeStamp || Date.now());
        if (timer) clearTimeout(timer);
        timer = setTimeout(bipeNovo, OCIOSO_MS + CONFIRMA_OCIOSO_MS);
      }
    }
    window.addEventListener("keydown", aoTecla, true);
    return function() {
      window.removeEventListener("keydown", aoTecla, true);
      if (timer) clearTimeout(timer);
    };
  }, [keyboard, visible]);

  if (!visible || !product) return null;
  var parentHex = parentColor ? toHex(parentColor) : null;
  var parentLabel = buildParentLabel(parentColor, parentSize);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Qual variante?</Text>
            <Pressable onPress={onClose} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, marginBottom: 8 }}>
            {parentColor ? <View style={[s.parentDot, { backgroundColor: parentHex || parentColor }]} /> : null}
            <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
            {parentSize ? <Text style={s.sizeBadge}>{parentSize}</Text> : null}
          </View>

          {loading ? (
            <View style={{ paddingVertical: 30, alignItems: "center" }}>
              <ActivityIndicator color={Colors.violet3} />
            </View>
          ) : activeVariants.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={s.empty}>Nenhuma variante ativa encontrada</Text>
            </View>
          ) : (
            <ScrollView ref={scrollRef} style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 8, padding: 16 }}>
              {/* 07/05: produto pai pode ter stock proprio independente das variantes
                 (caso onde o usuario cadastrou estoque no pai antes de criar variantes,
                 ou onde sobrou estoque "generico" nao-categorizado). Quando product.stock > 0
                 oferecemos a opcao de vender sem variante — id="" sinaliza parent-only.
                 08/05: rotulo deriva da cor+tamanho do pai (nao mais "generico" hardcoded). */}
              {(product.stock || 0) > 0 && (
                <Pressable
                  onPress={function() { onSelect({ id: "", label: parentLabel.label, price: product.price, stock: product.stock || 0 }); }}
                  style={[s.variantRow, s.parentRow, isWeb && { cursor: "pointer", transition: "all 0.15s ease" } as any]}
                >
                  <View
                    style={[
                      s.colorDot,
                      parentHex
                        ? { backgroundColor: parentHex }
                        : { backgroundColor: "rgba(167,139,250,0.25)", borderStyle: "dashed" },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.variantLabel}>{parentLabel.label}</Text>
                    <Text style={s.variantMeta}>
                      R$ {product.price.toFixed(2).replace(".", ",")} · {product.stock} un · {parentLabel.sub}
                    </Text>
                  </View>
                  <View style={s.stockBadge}><Text style={s.stockText}>{product.stock}</Text></View>
                </Pressable>
              )}
              {activeVariants.map(function(v: any) {
                var label = getLabel(v, parentColor, parentSize);
                var effectivePrice = v.price_override ? parseFloat(v.price_override) : product.price;
                var stock = parseInt(v.stock_qty) || 0;
                var hex = getColor(v, parentColor);
                var disabled = blockOutOfStock && stock <= 0;
                var marcadaAqui = selId === v.id;
                return (
                  <Pressable
                    key={v.id}
                    testID={"variante-" + v.id}
                    aria-selected={marcadaAqui}
                    onLayout={function(e: any) { posicoes.current[v.id] = e.nativeEvent.layout.y; }}
                    disabled={disabled}
                    onPress={disabled ? undefined : function() { onSelect({ id: v.id, label: label, price: effectivePrice, stock: stock, barcode: v.barcode }); }}
                    style={[
                      s.variantRow,
                      disabled && s.variantRowDisabled,
                      marcadaAqui && s.variantRowSel,
                      isWeb && !disabled && { cursor: "pointer", transition: "all 0.15s ease" } as any,
                    ]}>
                    {hex && <View style={[s.colorDot, { backgroundColor: hex }]} />}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={s.variantLabel}>{label}</Text>
                        {bipadoId === v.id && <Text style={s.bipadoBadge}>Bipado</Text>}
                      </View>
                      <Text style={s.variantMeta}>
                        R$ {effectivePrice.toFixed(2).replace(".", ",")}
                        {disabled ? "" : " · " + stock + " un"}
                        {v.barcode ? " · ..." + String(v.barcode).slice(-4) : ""}
                      </Text>
                    </View>
                    {disabled ? (
                      <View style={s.esgotadoBadge}><Text style={s.esgotadoText}>Esgotado</Text></View>
                    ) : (
                      <View style={[s.stockBadge, stock < 3 && { backgroundColor: Colors.redD }]}>
                        <Text style={[s.stockText, stock < 3 && { color: Colors.red }]}>{stock}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {isWeb && keyboard && !loading && activeVariants.length > 0 && (
            <View style={s.footer}>
              <Text style={s.footerText}>
                {selId ? "Enter confirma · ↑ ↓ troca o tamanho · Esc cancela" : "↑ ↓ escolhe · Enter confirma · Esc cancela"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

var s = StyleSheet.create({
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 200 },
  sheet: { backgroundColor: Colors.bg3, borderRadius: 20, maxWidth: 440, width: "90%", borderWidth: 1, borderColor: Colors.border2, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  productName: { fontSize: 13, color: Colors.ink3, flex: 1 },
  parentDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  sizeBadge: { fontSize: 9, fontWeight: "700", color: Colors.violet3, backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  empty: { fontSize: 13, color: Colors.ink3 },
  variantRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg4, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  variantRowSel: {
    borderColor: Colors.violet3,
    borderWidth: 2,
    padding: 13,
    backgroundColor: "rgba(124,58,237,0.16)",
  },
  bipadoBadge: {
    fontSize: 9, fontWeight: "800", color: "#fff", backgroundColor: Colors.violet,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  footer: { paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  footerText: { fontSize: 11, color: Colors.ink3, textAlign: "center" },
  variantRowDisabled: {
    opacity: 0.5,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  parentRow: {
    backgroundColor: "rgba(124,58,237,0.08)",
    borderColor: "rgba(167,139,250,0.25)",
    borderStyle: "dashed",
  } as any,
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  variantLabel: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  variantMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  stockBadge: {
    backgroundColor: Colors.violetD, borderRadius: 8,
    minWidth: 32, height: 32, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2,
  },
  stockText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  esgotadoBadge: {
    backgroundColor: Colors.redD, borderRadius: 999,
    paddingHorizontal: 10, height: 26, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.3)",
  },
  esgotadoText: { fontSize: 10, color: Colors.red, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
});

export default VariantPickerModal;
