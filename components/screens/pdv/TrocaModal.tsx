// ============================================================
// AURA. – PDV · Modal de Troca (Option B)
// Fluxo 4 passos: buscar venda → selecionar devoluções →
// adicionar novos itens → confirmar + enviar
// Depende de migration 101 (sales.type + troca_returned_items)
//
// 11/05/2026: Step 1 ganha busca avançada — range de datas (default
// últimos 7 dias, max 30 dias atrás) + toggle modo "Cliente/número"
// (q) vs "Código de barras" (product_barcode, lista vendas com aquele
// produto). Backend filtro implementado em PR Aura-backend#57.
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, TextInput,
  ActivityIndicator, ScrollView,
} from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { salesApi } from "@/services/api";
import type { SalesListItem, SaleDetailFull, SaleDetailsItem } from "@/services/api";
import { trocaApi } from "@/services/trocaApi";
import { toast } from "@/components/Toast";
import { IS_WEB, webOnly } from "./types";

// ─── local types ─────────────────────────────────────────────
type ReturnEntry = { item: SaleDetailsItem; returnQty: number };
type NewEntry = {
  product_id: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  product_name_snapshot: string;
};
type Step = 1 | 2 | 3 | 4;
type SearchMode = "text" | "barcode";

const fmt = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");

// Helpers de data — YYYY-MM-DD no fuso SP, idênticos ao usado no PDV/Caixa
function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const MAX_DAYS_BACK = 30;     // janela máxima de troca
const DEFAULT_DAYS_BACK = 7;  // default ao abrir o modal

// ─── component ───────────────────────────────────────────────
export function TrocaModal({
  visible,
  companyId,
  products,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  companyId: string;
  products: any[];
  onClose: () => void;
  onSuccess?: (result: any) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [searchMode, setSearchMode] = useState<SearchMode>("text");
  const [searchQuery, setSearchQuery] = useState("");        // cliente/número (modo text)
  const [barcodeQuery, setBarcodeQuery] = useState("");      // código de barras (modo barcode)
  const [dateFrom, setDateFrom] = useState<string>(daysAgoISO(DEFAULT_DAYS_BACK));
  const [dateTo, setDateTo] = useState<string>(todayISO());
  const [loadingSales, setLoadingSales] = useState(false);
  const [recentSales, setRecentSales] = useState<SalesListItem[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleDetailFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [returnEntries, setReturnEntries] = useState<ReturnEntry[]>([]);
  const [newEntries, setNewEntries] = useState<NewEntry[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [submitting, setSubmitting] = useState(false);

  // Limite mínimo do range — usado no <input min=...> do date picker
  const minDate = useMemo(() => daysAgoISO(MAX_DAYS_BACK), []);
  const today = useMemo(() => todayISO(), []);

  // Garante que dateFrom nunca seja anterior ao limite (max 30 dias atrás).
  // Se o user mexer no dateTo e o range ficar > 30d, ajusta dateFrom pra
  // manter dentro da janela.
  useEffect(() => {
    if (dateFrom < minDate) setDateFrom(minDate);
    if (dateFrom > dateTo) setDateFrom(dateTo);
  }, [dateFrom, dateTo, minDate]);

  const loadSales = useCallback(() => {
    if (!visible || !companyId) return;
    setLoadingSales(true);
    const params: any = {
      date_from: dateFrom + "T00:00:00",
      date_to: dateTo + "T23:59:59",
      status: "active",
      limit: 30,
    };
    if (searchMode === "text" && searchQuery.trim()) {
      params.q = searchQuery.trim();
    } else if (searchMode === "barcode" && barcodeQuery.trim()) {
      params.product_barcode = barcodeQuery.trim();
    }
    salesApi
      .list(companyId, params)
      .then(res => setRecentSales(res.sales || []))
      .catch(() => setRecentSales([]))
      .finally(() => setLoadingSales(false));
  }, [visible, companyId, searchMode, searchQuery, barcodeQuery, dateFrom, dateTo]);

  useEffect(() => { loadSales(); }, [loadSales]);

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setSearchMode("text");
      setSearchQuery("");
      setBarcodeQuery("");
      setDateFrom(daysAgoISO(DEFAULT_DAYS_BACK));
      setDateTo(todayISO());
      setSelectedSale(null);
      setReturnEntries([]);
      setNewEntries([]);
      setProductSearch("");
      setPaymentMethod("dinheiro");
    }
  }, [visible]);

  async function pickSale(saleId: string) {
    setLoadingDetail(true);
    try {
      const detail = await salesApi.get(companyId, saleId);
      setSelectedSale(detail);
      setReturnEntries(detail.items.map(it => ({ item: it, returnQty: 0 })));
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível carregar a venda");
    } finally {
      setLoadingDetail(false);
    }
  }

  function changeReturnQty(itemId: string, delta: number) {
    setReturnEntries(prev =>
      prev.map(e =>
        e.item.id !== itemId
          ? e
          : { ...e, returnQty: Math.max(0, Math.min(Number(e.item.quantity), e.returnQty + delta)) }
      )
    );
  }

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const src = q ? products.filter(p => (p.name || "").toLowerCase().includes(q)) : products;
    return src.slice(0, 20);
  }, [products, productSearch]);

  function addProduct(p: any) {
    setNewEntries(prev => {
      const idx = prev.findIndex(e => e.product_id === p.id && !e.variant_id);
      if (idx >= 0)
        return prev.map((e, i) => (i === idx ? { ...e, quantity: e.quantity + 1 } : e));
      return [
        ...prev,
        {
          product_id: p.id,
          variant_id: null,
          quantity: 1,
          unit_price: p.price || 0,
          product_name_snapshot: p.name || "",
        },
      ];
    });
  }

  function changeNewQty(idx: number, delta: number) {
    setNewEntries(prev =>
      prev.map((e, i) => (i !== idx ? e : { ...e, quantity: Math.max(1, e.quantity + delta) }))
    );
  }

  function removeNew(idx: number) {
    setNewEntries(prev => prev.filter((_, i) => i !== idx));
  }

  const returnedItems = returnEntries.filter(e => e.returnQty > 0);
  const returnedValue = returnedItems.reduce((s, e) => s + e.returnQty * e.item.unit_price, 0);
  const newValue      = newEntries.reduce((s, e) => s + e.quantity * e.unit_price, 0);
  const netAmount     = parseFloat((newValue - returnedValue).toFixed(2));

  async function handleSubmit() {
    if (returnedItems.length === 0 && newEntries.length === 0) {
      toast.error("Adicione ao menos um item à troca");
      return;
    }
    if (!selectedSale) return;
    setSubmitting(true);
    try {
      const result = await trocaApi.create(companyId, {
        original_sale_id: selectedSale.sale.id,
        returned_items: returnedItems.map(e => ({
          product_id: e.item.product_id,
          variant_id: e.item.variant_id,
          quantity: e.returnQty,
          unit_price: e.item.unit_price,
          product_name_snapshot: e.item.product_name,
        })),
        new_items: newEntries,
        payment_method: netAmount > 0 ? paymentMethod : undefined,
      });
      toast.success("Troca registrada com sucesso!");
      onSuccess?.(result);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar troca");
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  const PAY_OPTS = [
    { key: "dinheiro", label: "Dinheiro" },
    { key: "pix",      label: "Pix" },
    { key: "cartao",   label: "Cartão" },
    { key: "debito",   label: "Débito" },
  ];
  const STEPS = ["Venda", "Devolução", "Novos", "Confirmar"];

  const panelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.97)" : "rgba(255,255,255,0.97)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE
      ? "0 24px 60px -10px rgba(0,0,0,0.7)"
      : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });

  // Range em dias para hint
  const rangeDays = Math.max(0, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1);

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.panel, IS_WEB ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.headerIco}>
              <Icon name="repeat" size={16} color="#a78bfa" />
            </View>
            <Text style={s.headerTitle}>Troca de produto</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {/* Step bar */}
        <View style={s.stepBar}>
          {STEPS.map((label, idx) => {
            const n = (idx + 1) as Step;
            const done = step > n;
            const active = step === n;
            return (
              <View key={n} style={s.stepItem}>
                <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                  {done
                    ? <Icon name="check" size={9} color="#fff" />
                    : <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{n}</Text>}
                </View>
                <Text style={[s.stepLabel, (active || done) && { color: active ? "#a78bfa" : Colors.ink3 }]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Body */}
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">

          {/* ══ Step 1 ══ */}
          {step === 1 && (
            <>
              <Text style={s.sectionTitle}>Localizar venda original</Text>

              {/* Range de datas */}
              <View style={s.dateRow}>
                <View style={s.dateField}>
                  <Text style={s.dateLabel}>De</Text>
                  {IS_WEB ? (
                    <input
                      type="date"
                      value={dateFrom}
                      min={minDate}
                      max={dateTo}
                      onChange={(e: any) => setDateFrom(e.target.value)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 9,
                        background: Glass.bgInput as any,
                        border: "1px solid " + (Glass.bgInputBorder as any),
                        color: Colors.ink as any,
                        fontSize: 13,
                        outline: "none",
                        width: "100%",
                      }}
                    />
                  ) : (
                    <TextInput
                      style={s.input as any}
                      value={dateFrom}
                      onChangeText={setDateFrom}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.ink3}
                    />
                  )}
                </View>
                <View style={s.dateField}>
                  <Text style={s.dateLabel}>Até</Text>
                  {IS_WEB ? (
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      max={today}
                      onChange={(e: any) => setDateTo(e.target.value)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 9,
                        background: Glass.bgInput as any,
                        border: "1px solid " + (Glass.bgInputBorder as any),
                        color: Colors.ink as any,
                        fontSize: 13,
                        outline: "none",
                        width: "100%",
                      }}
                    />
                  ) : (
                    <TextInput
                      style={s.input as any}
                      value={dateTo}
                      onChangeText={setDateTo}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.ink3}
                    />
                  )}
                </View>
              </View>
              <Text style={s.rangeHint}>
                {rangeDays === 1 ? "1 dia" : `${rangeDays} dias`} · janela máxima de {MAX_DAYS_BACK} dias atrás
              </Text>

              {/* Toggle modo de busca */}
              <View style={s.modeRow}>
                <Pressable
                  onPress={() => setSearchMode("text")}
                  style={[s.modeBtn, searchMode === "text" && s.modeBtnActive]}
                >
                  <Icon name="user" size={12} color={searchMode === "text" ? "#fff" : Colors.ink3} />
                  <Text style={[s.modeBtnTxt, searchMode === "text" && { color: "#fff" }]}>
                    Cliente/número
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSearchMode("barcode")}
                  style={[s.modeBtn, searchMode === "barcode" && s.modeBtnActive]}
                >
                  <Icon name="barcode" size={12} color={searchMode === "barcode" ? "#fff" : Colors.ink3} />
                  <Text style={[s.modeBtnTxt, searchMode === "barcode" && { color: "#fff" }]}>
                    Código de barras
                  </Text>
                </Pressable>
              </View>

              {/* Input adapta conforme modo */}
              {searchMode === "text" ? (
                <TextInput
                  style={s.input as any}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar por nome do cliente ou vendedora…"
                  placeholderTextColor={Colors.ink3}
                  autoFocus
                />
              ) : (
                <TextInput
                  style={s.input as any}
                  value={barcodeQuery}
                  onChangeText={setBarcodeQuery}
                  placeholder="Bipe ou digite o código de barras do produto…"
                  placeholderTextColor={Colors.ink3}
                  autoFocus
                  returnKeyType="search"
                />
              )}

              {/* Resultados */}
              {loadingSales || loadingDetail ? (
                <View style={s.centered}><ActivityIndicator color={Colors.violet} /></View>
              ) : recentSales.length === 0 ? (
                <Text style={s.emptyTxt}>
                  {searchMode === "barcode" && barcodeQuery.trim()
                    ? "Nenhuma venda com esse código de barras no período."
                    : "Nenhuma venda ativa encontrada no período."}
                </Text>
              ) : (
                recentSales.map(sale => (
                  <Pressable key={sale.id} style={s.saleRow} onPress={() => pickSale(sale.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.saleName} numberOfLines={1}>
                        {(sale as any).customer_name || sale.customer?.name || "Sem cliente"}
                      </Text>
                      <Text style={s.saleSub}>
                        {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        {" "}às{" "}
                        {new Date(sale.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {(sale as any).items_count ?? 0} itens · {fmt(sale.total_amount)}
                      </Text>
                    </View>
                    <Text style={{ color: Colors.ink3, fontSize: 18 }}>›</Text>
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* ══ Step 2 ══ */}
          {step === 2 && selectedSale && (
            <>
              <Text style={s.sectionTitle}>O que o cliente está devolvendo?</Text>
              <View style={s.saleInfoBox}>
                <Text style={s.saleInfoTxt}>
                  {new Date(selectedSale.sale.created_at).toLocaleDateString("pt-BR")} · {fmt(selectedSale.sale.total_amount)}
                </Text>
                {selectedSale.customer && (
                  <Text style={s.saleInfoSub}>{selectedSale.customer.name}</Text>
                )}
              </View>
              {returnEntries.map(entry => (
                <View key={entry.item.id} style={s.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName} numberOfLines={1}>{entry.item.product_name}</Text>
                    <Text style={s.itemSub}>{fmt(entry.item.unit_price)} · orig.: {entry.item.quantity}</Text>
                  </View>
                  <View style={s.qtyRow}>
                    <Pressable style={s.qtyBtn} onPress={() => changeReturnQty(entry.item.id, -1)}>
                      <Text style={s.qtyBtnTxt}>−</Text>
                    </Pressable>
                    <Text style={[s.qtyVal, entry.returnQty > 0 && { color: Colors.violet }]}>
                      {entry.returnQty}
                    </Text>
                    <Pressable style={s.qtyBtn} onPress={() => changeReturnQty(entry.item.id, 1)}>
                      <Text style={s.qtyBtnTxt}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <View style={s.stepFooter}>
                <Text style={s.footerTxt}>Devolução: {fmt(returnedValue)}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.btnSec} onPress={() => setStep(1)}>
                    <Text style={s.btnSecTxt}>Voltar</Text>
                  </Pressable>
                  <Pressable style={s.btnPri} onPress={() => setStep(3)}>
                    <Text style={s.btnPriTxt}>Avançar →</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {/* ══ Step 3 ══ */}
          {step === 3 && (
            <>
              <Text style={s.sectionTitle}>Novos itens para o cliente</Text>
              {newEntries.length > 0 && (
                <View style={{ gap: 4, marginBottom: 10 }}>
                  <Text style={s.subsectionLabel}>Selecionados</Text>
                  {newEntries.map((entry, idx) => (
                    <View key={idx} style={s.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemName} numberOfLines={1}>{entry.product_name_snapshot}</Text>
                        <Text style={s.itemSub}>{fmt(entry.unit_price)}</Text>
                      </View>
                      <View style={s.qtyRow}>
                        <Pressable style={s.qtyBtn} onPress={() => changeNewQty(idx, -1)}>
                          <Text style={s.qtyBtnTxt}>−</Text>
                        </Pressable>
                        <Text style={s.qtyVal}>{entry.quantity}</Text>
                        <Pressable style={s.qtyBtn} onPress={() => changeNewQty(idx, 1)}>
                          <Text style={s.qtyBtnTxt}>+</Text>
                        </Pressable>
                        <Pressable style={{ marginLeft: 4, padding: 4 }} onPress={() => removeNew(idx)}>
                          <Icon name="x" size={12} color={Colors.red} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              <TextInput
                style={s.input as any}
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Buscar produto do catálogo…"
                placeholderTextColor={Colors.ink3}
              />
              <View style={{ gap: 2, marginTop: 4 }}>
                {filteredProducts.length === 0 ? (
                  <Text style={s.emptyTxt}>Nenhum produto encontrado.</Text>
                ) : (
                  filteredProducts.map(p => (
                    <Pressable key={p.id} style={s.productRow} onPress={() => addProduct(p)}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemName} numberOfLines={1}>{p.name}</Text>
                        <Text style={s.itemSub}>{fmt(p.price || 0)}</Text>
                      </View>
                      <View style={s.addIco}>
                        <Icon name="plus" size={13} color={Colors.violet3} />
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
              <View style={s.stepFooter}>
                <Text style={s.footerTxt}>Novos: {fmt(newValue)}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.btnSec} onPress={() => setStep(2)}>
                    <Text style={s.btnSecTxt}>Voltar</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btnPri, returnedItems.length === 0 && newEntries.length === 0 && { opacity: 0.45 }]}
                    onPress={() => setStep(4)}
                    disabled={returnedItems.length === 0 && newEntries.length === 0}
                  >
                    <Text style={s.btnPriTxt}>Revisar →</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {/* ══ Step 4 ══ */}
          {step === 4 && (
            <>
              <Text style={s.sectionTitle}>Revisar e confirmar</Text>
              {returnedItems.length > 0 && (
                <View style={s.summaryBox}>
                  <Text style={s.summaryLabel}>Devolvido (−)</Text>
                  {returnedItems.map(e => (
                    <View key={e.item.id} style={s.summaryRow}>
                      <Text style={s.summaryItem} numberOfLines={1}>{e.returnQty}× {e.item.product_name}</Text>
                      <Text style={[s.summaryVal, { color: Colors.red }]}>−{fmt(e.returnQty * e.item.unit_price)}</Text>
                    </View>
                  ))}
                  <View style={s.summaryTotal}>
                    <Text style={[s.summaryItem, { fontWeight: "700" }]}>Total devolvido</Text>
                    <Text style={[s.summaryVal, { color: Colors.red, fontWeight: "700" }]}>−{fmt(returnedValue)}</Text>
                  </View>
                </View>
              )}
              {newEntries.length > 0 && (
                <View style={s.summaryBox}>
                  <Text style={s.summaryLabel}>Novos itens (+)</Text>
                  {newEntries.map((e, i) => (
                    <View key={i} style={s.summaryRow}>
                      <Text style={s.summaryItem} numberOfLines={1}>{e.quantity}× {e.product_name_snapshot}</Text>
                      <Text style={[s.summaryVal, { color: "#34d399" }]}>+{fmt(e.quantity * e.unit_price)}</Text>
                    </View>
                  ))}
                  <View style={s.summaryTotal}>
                    <Text style={[s.summaryItem, { fontWeight: "700" }]}>Total novos</Text>
                    <Text style={[s.summaryVal, { color: "#34d399", fontWeight: "700" }]}>+{fmt(newValue)}</Text>
                  </View>
                </View>
              )}
              <View style={s.netBox}>
                <Text style={s.netLabel}>
                  {netAmount > 0 ? "Cliente paga diferença" : netAmount < 0 ? "Loja devolve" : "Valor igual"}
                </Text>
                <Text style={[s.netVal, { color: netAmount > 0 ? "#34d399" : netAmount < 0 ? Colors.red : Colors.ink3 }]}>
                  {netAmount >= 0 ? "+" : ""}{fmt(netAmount)}
                </Text>
              </View>
              {netAmount > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={s.subsectionLabel}>Pagamento da diferença</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {PAY_OPTS.map(opt => (
                      <Pressable
                        key={opt.key}
                        style={[s.payChip, paymentMethod === opt.key && s.payChipActive]}
                        onPress={() => setPaymentMethod(opt.key)}
                      >
                        <Text style={[s.payChipTxt, paymentMethod === opt.key && { color: "#fff" }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <View style={[s.stepFooter, { marginTop: 12 }]}>
                <Pressable style={s.btnSec} onPress={() => setStep(3)}>
                  <Text style={s.btnSecTxt}>Voltar</Text>
                </Pressable>
                <Pressable
                  style={[s.btnPri, submitting && { opacity: 0.6 }, { minWidth: 160 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.btnPriTxt}>✓ Confirmar troca</Text>}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  panel: {
    width: "100%" as any,
    maxWidth: 560,
    maxHeight: "90vh" as any,
    borderRadius: 16,
    overflow: "hidden" as any,
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Glass.lineFaint,
  },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.1)",
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Glass.lineSoft,
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.violet },
  stepDotDone: { backgroundColor: "#34d399" },
  stepDotTxt: { fontSize: 10, fontWeight: "700", color: Colors.ink3 },
  stepLabel: { fontSize: 10, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.3 },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 28, gap: 10 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4,
  },
  subsectionLabel: {
    fontSize: 10, fontWeight: "600", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  input: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9,
    backgroundColor: Glass.bgInput, borderWidth: 1, borderColor: Glass.bgInputBorder,
    color: Colors.ink, fontSize: 13, outlineStyle: "none",
  } as any,
  // ─── Step 1 — range de datas + toggle modo ───────────────
  dateRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateField: { flex: 1, gap: 4 },
  dateLabel: {
    fontSize: 10, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  rangeHint: {
    fontSize: 10,
    color: Colors.ink3,
    marginTop: -4,
    marginBottom: 4,
    fontStyle: "italic",
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Glass.lineFaint,
    borderWidth: 1,
    borderColor: Glass.lineBorderCard,
  },
  modeBtnActive: {
    backgroundColor: Colors.violet,
    borderColor: Colors.violet,
  },
  modeBtnTxt: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.ink3,
  },
  // ──────────────────────────────────────────────────────────
  centered: { alignItems: "center", padding: 24 },
  emptyTxt: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
  saleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10,
    backgroundColor: Glass.lineFaint,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    marginBottom: 4,
  },
  saleName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  saleSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  saleInfoBox: {
    padding: 10, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderLeftWidth: 3, borderLeftColor: Colors.violet,
    marginBottom: 4,
  },
  saleInfoTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  saleInfoSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.08)",
  },
  itemName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  itemSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: Glass.lineSoft,
    alignItems: "center", justifyContent: "center",
  },
  qtyBtnTxt: { fontSize: 16, color: Colors.ink, lineHeight: 18 },
  qtyVal: { fontSize: 13, fontWeight: "700", color: Colors.ink, minWidth: 22, textAlign: "center" },
  productRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.08)",
  },
  addIco: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1, borderStyle: "dashed" as any, borderColor: "rgba(124,58,237,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  summaryBox: {
    backgroundColor: Glass.lineFaint, borderRadius: 10,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    padding: 12, gap: 4, marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 10, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryTotal: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.12)",
    paddingTop: 6, marginTop: 4,
  },
  summaryItem: { fontSize: 12, color: Colors.ink, flex: 1, marginRight: 8 },
  summaryVal: { fontSize: 12, fontWeight: "600" },
  netBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 10,
    backgroundColor: "rgba(124,58,237,0.07)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.2)",
  },
  netLabel: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  netVal: { fontSize: 18, fontWeight: "800" },
  payChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Glass.lineFaint,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
  },
  payChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  payChipTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  stepFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.12)",
  },
  footerTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  btnSec: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: Glass.lineFaint,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
  },
  btnSecTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  btnPri: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    backgroundColor: Colors.violet,
    alignItems: "center", justifyContent: "center",
    minWidth: 100,
  },
  btnPriTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
