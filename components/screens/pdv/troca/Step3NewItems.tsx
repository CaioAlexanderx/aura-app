// ============================================================
// AURA. — PDV · Troca v2 · Step 3 (Novos itens)
// 3 modos de localizar produto: busca / bipe / QR code.
//
// Comportamento por modo:
//   - text:    input filtra catálogo on-type, clique adiciona
//   - barcode: scanner global ativo (USB/Bluetooth);
//              bipe → procura no catálogo por barcode/sku,
//              acha → auto-add ao carrinho + flash visual + toast
//              não acha → toast "código não encontrado"
//   - qr:      input pra colar/scan QR (em desktop) ou camera (mobile);
//              QR do produto contém EAN/SKU; mesmo lookup do barcode.
//
// REUSO: useGlobalBarcodeScanner já existe (hooks/useGlobalBarcodeScanner)
// e foi desenhado pra ignorar foco em <input> — então só dispara quando
// o usuário não está digitando. Quando o modo "Bipe" está ativo o input
// fica desabilitado pra deixar o scanner livre.
//
// 17/05/2026 (FASE A — UI Redesign):
//   - Sub-componente da TrocaModal v2 (era inline antes)
//   - Step 3 agora alinhado com Step 1 (mesma SearchModeBar)
//   - Scanner ergonômico — operador não precisa clicar no input
// ============================================================
import { useState, useMemo, useEffect, useRef } from "react";
import {
  View, Text, Pressable, StyleSheet, TextInput, ScrollView, Platform,
} from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useGlobalBarcodeScanner } from "@/hooks/useGlobalBarcodeScanner";
import { SearchModeBar, STEP3_MODES, placeholderFor } from "./SearchModeBar";
import type { NewEntry, Step3SearchMode } from "./types";
import { fmtBRL } from "./types";

const IS_WEB = Platform.OS === "web";

type Product = {
  id: string;
  name: string;
  price?: number;
  barcode?: string | null;
  sku?: string | null;
  stock_qty?: number | null;
  // O catálogo do PDV traz outros campos — aceitamos `any` extra.
  [k: string]: any;
};

type Props = {
  products: Product[];
  newEntries: NewEntry[];
  onChangeEntries: (next: NewEntry[]) => void;
  // Resumo numérico pra exibir no rodapé interno do step (footer da modal
  // mostra o total geral; aqui é só do step).
  returnedValue: number;
  newValue: number;
  netAmount: number;
};

export function Step3NewItems({
  products,
  newEntries,
  onChangeEntries,
  returnedValue,
  newValue,
  netAmount,
}: Props) {
  const [mode, setMode] = useState<Step3SearchMode>("text");
  const [textQuery, setTextQuery] = useState("");
  const [qrInput, setQrInput] = useState("");

  // Ref pro último item adicionado — usado pro "flash" visual.
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<any>(null);

  // ─── Filtragem por texto (modo "text") ───────────────────────
  const filteredProducts = useMemo(() => {
    const q = textQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products
      .filter((p) => (p.name || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, textQuery]);

  // ─── Lookup por código (barcode + qr) ────────────────────────
  // Busca por barcode primeiro, sku como fallback. Case-insensitive.
  function findByCode(code: string): Product | null {
    const c = code.trim();
    if (!c) return null;
    const cLower = c.toLowerCase();
    return (
      products.find((p) => (p.barcode || "").toLowerCase() === cLower) ||
      products.find((p) => (p.sku || "").toLowerCase() === cLower) ||
      null
    );
  }

  // ─── addProduct unificado ────────────────────────────────────
  function addProduct(p: Product, via: NewEntry["addedVia"] = "search") {
    const idx = newEntries.findIndex(
      (e) => e.product_id === p.id && !e.variant_id
    );
    let next: NewEntry[];
    if (idx >= 0) {
      next = newEntries.map((e, i) =>
        i === idx ? { ...e, quantity: e.quantity + 1 } : e
      );
    } else {
      next = [
        ...newEntries,
        {
          product_id: p.id,
          variant_id: null,
          quantity: 1,
          unit_price: p.price || 0,
          product_name_snapshot: p.name || "",
          addedVia: via,
        },
      ];
    }
    onChangeEntries(next);

    // Flash visual no item recém-adicionado
    setFlashId(p.id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 800);
  }

  function changeQty(idx: number, delta: number) {
    onChangeEntries(
      newEntries.map((e, i) =>
        i === idx ? { ...e, quantity: Math.max(1, e.quantity + delta) } : e
      )
    );
  }

  function removeAt(idx: number) {
    onChangeEntries(newEntries.filter((_, i) => i !== idx));
  }

  // ─── Scanner global (modo "barcode") ─────────────────────────
  // Hook ignora teclas quando foco está em <input> (ver useGlobalBarcodeScanner).
  // No modo barcode tiramos o foco do input pra liberar o scanner.
  useGlobalBarcodeScanner({
    enabled: mode === "barcode",
    minLength: 3,
    onScan: (code) => {
      const p = findByCode(code);
      if (p) {
        addProduct(p, "barcode");
        toast.success(`Bipado: ${p.name}`);
      } else {
        toast.error(`Código "${code}" não encontrado no catálogo`);
      }
    },
  });

  // ─── QR submit (modo "qr") ───────────────────────────────────
  // Em desktop, o operador cola/scaneia o QR no input e aperta Enter.
  // Em mobile, idealmente abre câmera — placeholder de futuro botão.
  function handleQrSubmit() {
    const code = qrInput.trim();
    if (!code) return;
    const p = findByCode(code);
    if (p) {
      addProduct(p, "qr");
      toast.success(`QR lido: ${p.name}`);
      setQrInput("");
    } else {
      toast.error(`QR "${code.slice(0, 12)}..." não corresponde a um produto`);
    }
  }

  // ─── Limpa estado ao trocar de modo ──────────────────────────
  useEffect(() => {
    setTextQuery("");
    setQrInput("");
  }, [mode]);

  // ─── Render ──────────────────────────────────────────────────
  const sortedSelected = newEntries;

  return (
    <View>
      <Text style={s.sectionTitle}>Novos itens para o cliente</Text>
      <Text style={s.sectionSub}>
        Pode ficar vazio se for só devolução. Cliente pode levar quantos itens quiser.
      </Text>

      {/* Selected list */}
      {sortedSelected.length > 0 && (
        <View style={s.selectedBlock}>
          <Text style={s.fieldLabel}>
            Selecionados ({sortedSelected.length})
          </Text>
          {sortedSelected.map((e, idx) => {
            const isFlash = flashId === e.product_id;
            return (
              <View
                key={`${e.product_id}-${idx}`}
                style={[s.itemRow, isFlash && s.itemRowFlash]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.itemNameRow}>
                    <Text style={s.itemName} numberOfLines={1}>
                      {e.product_name_snapshot}
                    </Text>
                    {e.addedVia === "barcode" && (
                      <View style={s.addedViaBadge}>
                        <Icon name="barcode" size={9} color="#a78bfa" />
                        <Text style={s.addedViaTxt}>Bipado</Text>
                      </View>
                    )}
                    {e.addedVia === "qr" && (
                      <View style={s.addedViaBadge}>
                        <Icon name="qr_code" size={9} color="#a78bfa" />
                        <Text style={s.addedViaTxt}>QR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.itemSub}>{fmtBRL(e.unit_price)}</Text>
                </View>
                <View style={s.qtyRow}>
                  <Pressable style={s.qtyBtn} onPress={() => changeQty(idx, -1)}>
                    <Text style={s.qtyBtnTxt}>−</Text>
                  </Pressable>
                  <Text style={s.qtyVal}>{e.quantity}</Text>
                  <Pressable style={s.qtyBtn} onPress={() => changeQty(idx, 1)}>
                    <Text style={s.qtyBtnTxt}>+</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeAt(idx)}
                    style={s.removeBtn}
                    accessibilityLabel="Remover item"
                  >
                    <Icon name="x" size={12} color={Colors.red} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Mode bar — mesmo padrão visual do Step 1 */}
      <SearchModeBar
        mode={mode}
        modes={STEP3_MODES}
        onChange={setMode}
      />

      {/* Mode-specific input area */}
      {mode === "text" && (
        <>
          <TextInput
            style={s.input as any}
            value={textQuery}
            onChangeText={setTextQuery}
            placeholder={placeholderFor("text", STEP3_MODES)}
            placeholderTextColor={Colors.ink3}
            autoFocus
          />
          <View style={{ gap: 2, marginTop: 8 }}>
            {filteredProducts.length === 0 ? (
              <Text style={s.emptyTxt}>
                {textQuery.trim()
                  ? `Nenhum produto encontrado para "${textQuery.trim()}".`
                  : "Comece a digitar para filtrar o catálogo..."}
              </Text>
            ) : (
              filteredProducts.map((p) => (
                <Pressable
                  key={p.id}
                  style={s.productRow}
                  onPress={() => addProduct(p, "search")}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.itemName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={s.itemSub}>
                      {fmtBRL(p.price || 0)}
                      {p.stock_qty != null ? ` · ${p.stock_qty} em estoque` : ""}
                    </Text>
                  </View>
                  <View style={s.addIco}>
                    <Icon name="plus" size={13} color={Colors.violet3} />
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </>
      )}

      {mode === "barcode" && (
        <View style={s.scannerArea}>
          <View style={s.scannerIco}>
            <Icon name="barcode" size={28} color="#a78bfa" />
          </View>
          <Text style={s.scannerTitle}>Scanner ativo — bipe agora</Text>
          <Text style={s.scannerSub}>
            {placeholderFor("barcode", STEP3_MODES)}
          </Text>
          <Text style={s.scannerHint}>
            Funciona com leitores USB e Bluetooth. O produto entra automaticamente no carrinho.
          </Text>
          <View style={s.scannerPulse}>
            <View style={s.pulseDot} />
            <Text style={s.pulseTxt}>Aguardando leitura...</Text>
          </View>
        </View>
      )}

      {mode === "qr" && (
        <View>
          <View style={s.qrHelper}>
            <View style={s.qrHelperIco}>
              <Icon name="qr_code" size={20} color="#a78bfa" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.qrHelperTitle}>Leitura por QR Code</Text>
              <Text style={s.qrHelperSub}>
                {IS_WEB
                  ? "Cole o conteúdo do QR ou use um leitor USB de QR/datamatrix."
                  : "Em breve: abrir câmera. Por enquanto, cole o código abaixo."}
              </Text>
            </View>
          </View>

          <View style={s.qrInputRow}>
            <TextInput
              style={[s.input, { flex: 1 }] as any}
              value={qrInput}
              onChangeText={setQrInput}
              placeholder={placeholderFor("qr", STEP3_MODES)}
              placeholderTextColor={Colors.ink3}
              onSubmitEditing={handleQrSubmit}
              returnKeyType="search"
            />
            <Pressable
              style={[s.qrSubmit, !qrInput.trim() && { opacity: 0.45 }]}
              onPress={handleQrSubmit}
              disabled={!qrInput.trim()}
            >
              <Icon name="check" size={14} color="#fff" />
              <Text style={s.qrSubmitTxt}>Adicionar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Mini-resumo do step (line totals) */}
      <View style={s.stepFooter}>
        <View style={{ flex: 1 }}>
          <Text style={s.footerLine}>
            Devolvendo: <Text style={s.footerVal}>{fmtBRL(returnedValue)}</Text>
          </Text>
          <Text style={s.footerLine}>
            Novos:{" "}
            <Text style={[s.footerVal, { color: "#34d399" }]}>
              {fmtBRL(newValue)}
            </Text>
          </Text>
        </View>
        <View>
          <Text style={s.footerNetLabel}>
            {netAmount > 0
              ? "Cliente paga"
              : netAmount < 0
              ? "Loja devolve"
              : "Valor igual"}
          </Text>
          <Text
            style={[
              s.footerNetVal,
              {
                color:
                  netAmount > 0
                    ? "#34d399"
                    : netAmount < 0
                    ? Colors.red
                    : Colors.ink2,
              },
            ]}
          >
            {netAmount === 0 ? fmtBRL(0) : (netAmount > 0 ? "+" : "") + fmtBRL(netAmount)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.ink3,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Colors.ink3,
    marginBottom: 8,
  },

  // Selected list
  selectedBlock: {
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: IS_DARK_MODE
      ? "rgba(255,255,255,0.025)"
      : "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: IS_DARK_MODE
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.05)",
    borderRadius: 9,
    marginBottom: 6,
  },
  itemRowFlash: {
    backgroundColor: "rgba(124,58,237,0.12)",
    borderColor: "rgba(124,58,237,0.4)",
  },
  itemNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  itemName: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.ink,
    flexShrink: 1,
  },
  itemSub: {
    fontSize: 11,
    color: Colors.ink3,
    marginTop: 2,
  },
  addedViaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(167,139,250,0.15)",
    borderColor: "rgba(167,139,250,0.3)",
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
  },
  addedViaTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: "#a78bfa",
    letterSpacing: 0.3,
  },

  // Qty controls
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnTxt: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  qtyVal: {
    minWidth: 22,
    textAlign: "center",
    color: Colors.violet3,
    fontSize: 13,
    fontWeight: "700",
  },
  removeBtn: {
    marginLeft: 2,
    padding: 4,
    borderRadius: 6,
  },

  // Input
  input: {
    backgroundColor: Glass.bgInput,
    borderWidth: 1,
    borderColor: Glass.bgInputBorder,
    color: Colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9,
    fontSize: 13,
  },

  // Catalog rows
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  addIco: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "rgba(124,58,237,0.15)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Scanner area (barcode mode)
  scannerArea: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: "rgba(124,58,237,0.06)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.25)",
    borderRadius: 14,
    borderStyle: "dashed",
  },
  scannerIco: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(124,58,237,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  scannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 4,
  },
  scannerSub: {
    fontSize: 12,
    color: Colors.ink2,
    textAlign: "center",
    marginBottom: 6,
  },
  scannerHint: {
    fontSize: 11,
    color: Colors.ink3,
    textAlign: "center",
    fontStyle: "italic",
  },
  scannerPulse: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(167,139,250,0.1)",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#a78bfa",
    // (animação CSS-pulse só funciona via web — em native fica estático)
  },
  pulseTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: "#a78bfa",
    letterSpacing: 0.3,
  },

  // QR mode helpers
  qrHelper: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "rgba(124,58,237,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
    alignItems: "center",
  },
  qrHelperIco: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "rgba(167,139,250,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  qrHelperTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.ink,
  },
  qrHelperSub: {
    fontSize: 11,
    color: Colors.ink3,
    marginTop: 2,
  },
  qrInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  qrSubmit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.violet,
    borderRadius: 9,
  },
  qrSubmitTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  // Empty
  emptyTxt: {
    color: Colors.ink3,
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },

  // Step footer (mini-resumo)
  stepFooter: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  footerLine: {
    fontSize: 12,
    color: Colors.ink3,
    marginBottom: 2,
  },
  footerVal: {
    color: Colors.ink,
    fontWeight: "600",
  },
  footerNetLabel: {
    fontSize: 10,
    color: Colors.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
    textAlign: "right",
  },
  footerNetVal: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "right",
    letterSpacing: -0.3,
  },
});

export default Step3NewItems;
