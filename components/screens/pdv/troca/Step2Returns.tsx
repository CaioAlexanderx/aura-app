// ============================================================
// AURA. — PDV · Troca v2 · Step 2 (Devoluções agrupadas)
// Lista itens de TODAS as vendas selecionadas, agrupados por venda
// original. Cada grupo é colapsável, mostra header com data/total/
// vendedor, e cada item tem qty controls + badge "já devolvido em
// troca anterior" quando aplicável.
//
// 17/05/2026 — `item.id` recebido nos ReturnEntries usa
// SaleForTrocaItem.original_sale_item_id (sale_items.id real do backend
// v2) quando disponível; senão cai num fallback sintético "synth-..."
// que sinaliza ao TrocaModal pra NÃO usar caminho v2.
//
// 04/08/2026 — propaga total_price pro ReturnEntry.item (quando o
// backend devolver o campo). Sem isso o effectiveUnitPrice do
// TrocaModal não tem como capturar desconto por item e cai no
// fallback de unit_price bruto.
//
// 22/09/2026 (Matcon M4 — "devolução de sobra de obra", docs/
// CONTRACT_MATCON.md e docs/mockups/matcon-m4-profundidade.html
// §"Passo 2 — o que voltou"):
//   - Item de unidade fracionada (m², m³...) com matcon_enabled ganha
//     campo decimal (decimal-pad + parseQtyInput) no lugar do stepper.
//   - Com purchase_factor no produto, só caixa fechada volta ao
//     estoque (restockDeDevolucao) — o crédito do item passa a ser
//     sobre restockQty, não sobre a quantidade toda devolvida; a
//     sobra de caixa aberta aparece como aviso âmbar, vale R$ 0.
//   - lot_code/lot_id (quando a venda trouxer) aparecem como "no lote
//     X" e viajam no ReturnEntry pro payload da troca.
//   - Item não fracionado ou toggle off: idêntico a hoje (stepper).
// ============================================================
import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { readMatconSettings } from "@/constants/matcon";
import { isFractionalUnit, parseQtyInput, fmtQty } from "@/utils/matconUnits";
import { restockDeDevolucao, creditoDaDevolucao, fraseCaixaFechada, fraseCaixaAberta } from "./devolucaoUtil";
import type { SelectedSaleRow, ReturnEntry } from "./types";
import { fmtBRL } from "./types";

type Props = {
  selectedSales: SelectedSaleRow[];
  returnEntries: ReturnEntry[];
  onChangeEntries: (next: ReturnEntry[]) => void;
  /** 22/09/2026 (M4): catálogo de produtos (o mesmo que o TrocaModal já
   *  passa pro Step3NewItems) — fallback de unit/purchase_factor por
   *  product_id só quando o item da venda não os traz. Opcional: sem a
   *  prop (ou sem match), cai no comportamento de hoje. */
  products?: any[];
};

// Chave estável (saleId + productId + variantId) usada como índice no map.
function itemKey(saleId: string, productId: string | null, variantId: string | null | undefined) {
  return `${saleId}::${productId || "null"}::${variantId || "null"}`;
}

// Resolve o id que será gravado em ReturnEntry.item.id:
//   - prefere SaleForTrocaItem.original_sale_item_id (UUID real do v2 backend)
//   - fallback "synth-<saleId>-<productId>-<idx>" (v1 backend antigo)
// O TrocaModal usa o prefixo "synth-" pra decidir se cai em v1.
function resolveItemId(
  sale: SelectedSaleRow,
  item: SelectedSaleRow["items"][number],
  idx: number
): string {
  const real = (item as any).original_sale_item_id as string | undefined;
  if (real && typeof real === "string" && real.length > 0) return real;
  return `synth-${sale.id}-${item.product_id || "null"}-${idx}`;
}

export function Step2Returns({
  selectedSales,
  returnEntries,
  onChangeEntries,
  products,
}: Props) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 22/09/2026 (M4) — lookup product_id -> produto, só pro fallback de
  // unit/purchase_factor quando o item da venda não os traz.
  const productById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of Array.isArray(products) ? products : []) {
      if (p?.id) m.set(String(p.id), p);
    }
    return m;
  }, [products]);

  // 22/09/2026 (M4) — unit/purchase_factor: preferem o que o item da
  // venda já trouxer; sem isso, caem no produto do catálogo por
  // product_id (products é opcional — sem match, undefined mesmo).
  function resolveUnit(item: any): string | null {
    return item?.unit ?? productById.get(String(item?.product_id))?.unit ?? null;
  }
  function resolveFactor(item: any): number | null {
    return item?.purchase_factor ?? productById.get(String(item?.product_id))?.purchase_factor ?? null;
  }

  // 22/09/2026 (M4): mesma leitura de pdv_settings que CartPanel já faz —
  // Step2Returns não depende de nenhum prop novo do TrocaModal pra saber
  // se o Matcon está ligado.
  const { settings: pdvSettings } = usePdvSettings();
  const matcon = useMemo(() => readMatconSettings(pdvSettings), [pdvSettings]);

  const entriesByKey = useMemo(() => {
    const m = new Map<string, ReturnEntry>();
    for (const e of returnEntries) {
      const k = itemKey(e.saleId, e.item.product_id || null, (e.item as any).variant_id || null);
      m.set(k, e);
    }
    return m;
  }, [returnEntries]);

  function toggleCollapsed(saleId: string) {
    const next = new Set(collapsed);
    next.has(saleId) ? next.delete(saleId) : next.add(saleId);
    setCollapsed(next);
  }

  function getQty(saleId: string, productId: string | null, variantId: any): number {
    return entriesByKey.get(itemKey(saleId, productId, variantId))?.returnQty || 0;
  }

  function setQty(
    sale: SelectedSaleRow,
    item: SelectedSaleRow["items"][number],
    idx: number,
    nextQty: number
  ) {
    const k = itemKey(sale.id, item.product_id || null, (item as any).variant_id || null);
    const existing = entriesByKey.get(k);
    const clamped = Math.max(0, Math.min(Number(item.quantity), nextQty));

    if (clamped === 0) {
      onChangeEntries(returnEntries.filter((e) => {
        const ek = itemKey(e.saleId, e.item.product_id || null, (e.item as any).variant_id || null);
        return ek !== k;
      }));
      return;
    }

    if (existing) {
      onChangeEntries(returnEntries.map((e) => {
        const ek = itemKey(e.saleId, e.item.product_id || null, (e.item as any).variant_id || null);
        return ek === k ? { ...e, returnQty: clamped } : e;
      }));
    } else {
      const itemAsSaleDetailsItem: any = {
        id: resolveItemId(sale, item, idx),
        product_id: item.product_id,
        variant_id: (item as any).variant_id,
        product_name: item.product_name_snapshot,
        product_name_snapshot: item.product_name_snapshot,
        quantity: item.quantity,
        unit_price: item.unit_price,
        // 04/08/2026: passthrough — necessário pro cálculo de desconto
        // por item (effectiveUnitPrice) quando o backend enviar o campo.
        total_price: (item as any).total_price,
        // 22/09/2026 (M4): passthrough — lote de origem + unidade/fator de
        // compra do produto, usados pelo campo decimal e por
        // restockDeDevolucao logo abaixo. Undefined em venda sem Matcon.
        lot_code: (item as any).lot_code ?? null,
        lot_id: (item as any).lot_id ?? null,
        unit: resolveUnit(item),
        purchase_factor: resolveFactor(item),
      };
      const newEntry: ReturnEntry = {
        saleId: sale.id,
        saleDate: sale.created_at,
        saleCompanyName: sale.company_name || "—",
        sellerName: sale.seller_name,
        item: itemAsSaleDetailsItem,
        returnQty: clamped,
        previouslyReturnedQty: 0,
      };
      onChangeEntries([...returnEntries, newEntry]);
    }
  }

  function returnAllOfSale(sale: SelectedSaleRow) {
    const additions: ReturnEntry[] = [];
    const keptIds = new Set(returnEntries.map((e) =>
      itemKey(e.saleId, e.item.product_id || null, (e.item as any).variant_id || null)
    ));
    sale.items.forEach((item, idx) => {
      const k = itemKey(sale.id, item.product_id || null, (item as any).variant_id || null);
      if (!keptIds.has(k)) {
        additions.push({
          saleId: sale.id,
          saleDate: sale.created_at,
          saleCompanyName: sale.company_name || "—",
          sellerName: sale.seller_name,
          item: {
            id: resolveItemId(sale, item, idx),
            product_id: item.product_id,
            variant_id: (item as any).variant_id,
            product_name: item.product_name_snapshot,
            product_name_snapshot: item.product_name_snapshot,
            quantity: item.quantity,
            unit_price: item.unit_price,
            // 04/08/2026: passthrough — ver setQty acima.
            total_price: (item as any).total_price,
            // 22/09/2026 (M4): passthrough — ver setQty acima.
            lot_code: (item as any).lot_code ?? null,
            lot_id: (item as any).lot_id ?? null,
            unit: resolveUnit(item),
            purchase_factor: resolveFactor(item),
          } as any,
          returnQty: Number(item.quantity),
          previouslyReturnedQty: 0,
        });
      }
    });
    const updated = returnEntries.map((e) => {
      if (e.saleId !== sale.id) return e;
      const matchingItem = sale.items.find((i) =>
        i.product_id === e.item.product_id &&
        (((i as any).variant_id || null) === ((e.item as any).variant_id || null))
      );
      if (!matchingItem) return e;
      return { ...e, returnQty: Number(matchingItem.quantity) };
    });
    onChangeEntries([...updated, ...additions]);
  }

  function clearSale(saleId: string) {
    onChangeEntries(returnEntries.filter((e) => e.saleId !== saleId));
  }

  // 22/09/2026 (M4): crédito do item — sobre restockQty (só caixa fechada)
  // quando o produto tem purchase_factor; senão, o de sempre (qty × preço).
  function entryCredito(e: ReturnEntry): number {
    const factor = e.item.purchase_factor;
    if (matcon.matcon_enabled && isFractionalUnit(e.item.unit) && factor) {
      const { restockQty } = restockDeDevolucao(e.returnQty, factor);
      return creditoDaDevolucao(restockQty, Number(e.item.unit_price));
    }
    return e.returnQty * Number(e.item.unit_price);
  }

  const filterQ = filter.trim().toLowerCase();
  const totalReturnedValue = returnEntries.reduce((s, e) => s + entryCredito(e), 0);
  const totalReturnedQty = returnEntries.reduce((s, e) => s + e.returnQty, 0);

  return (
    <View>
      <Text style={s.sectionTitle}>O que o cliente está devolvendo?</Text>
      <Text style={s.sectionSub}>
        Use +/− em cada item. Itens aparecem agrupados por venda — pode devolver de várias.
      </Text>

      <TextInput
        style={s.input as any}
        value={filter}
        onChangeText={setFilter}
        placeholder="Filtrar por nome do produto..."
        placeholderTextColor={Colors.ink3}
      />

      {selectedSales.length === 0 ? (
        <Text style={s.emptyTxt}>Nenhuma venda selecionada — volte ao Step 1.</Text>
      ) : (
        selectedSales.map((sale) => {
          const isCollapsed = collapsed.has(sale.id);
          const filteredItems = filterQ
            ? sale.items.filter((it) =>
                (it.product_name_snapshot || "").toLowerCase().includes(filterQ)
              )
            : sale.items;
          if (filterQ && filteredItems.length === 0) return null;

          const dateStr = new Date(sale.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "2-digit",
          });
          const timeStr = new Date(sale.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit", minute: "2-digit",
          });
          const groupSubtotal = returnEntries
            .filter((e) => e.saleId === sale.id)
            .reduce((sum, e) => sum + entryCredito(e), 0);

          return (
            <View key={sale.id} style={s.group}>
              <Pressable style={s.groupHeader} onPress={() => toggleCollapsed(sale.id)}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.groupTitleRow}>
                    <Icon
                      name={isCollapsed ? "chevron_right" : "chevron_down"}
                      size={14} color={Colors.ink3}
                    />
                    <Text style={s.groupTitle}>
                      Compra de {dateStr} · {timeStr}
                    </Text>
                    {sale.is_cross_filial && (
                      <View style={s.badgeFilial}>
                        <Text style={s.badgeFilialIcon}>🏢</Text>
                        <Text style={s.badgeFilialTxt} numberOfLines={1}>
                          {sale.company_name}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.groupMeta}>
                    {sale.items.length} {sale.items.length === 1 ? "item" : "itens"} · {fmtBRL(sale.total_amount)}
                    {sale.seller_name ? ` · vendedor ${sale.seller_name}` : ""}
                    {groupSubtotal > 0 ? `  ·  ⚡ devolvendo ${fmtBRL(groupSubtotal)}` : ""}
                  </Text>
                </View>
                <View style={s.groupActions}>
                  {groupSubtotal > 0 ? (
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); clearSale(sale.id); }}
                      style={s.smallBtnGhost}
                    >
                      <Icon name="x" size={11} color={Colors.ink3} />
                      <Text style={s.smallBtnGhostTxt}>Limpar</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); returnAllOfSale(sale); }}
                    style={s.smallBtn}
                  >
                    <Text style={s.smallBtnTxt}>Devolver tudo</Text>
                  </Pressable>
                </View>
              </Pressable>

              {!isCollapsed && (
                <View style={s.itemList}>
                  {filteredItems.length === 0 ? (
                    <Text style={[s.emptyTxt, { paddingVertical: 14 }]}>
                      Sem itens com esse filtro.
                    </Text>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const currentQty = getQty(sale.id, item.product_id || null, (item as any).variant_id);
                      const maxQty = Number(item.quantity);
                      const hasPrev = false;
                      // 22/09/2026 (M4): fracionado + toggle ligado -> campo
                      // decimal; senão, o stepper de sempre (zero impacto
                      // fora do Matcon).
                      const itemUnit = resolveUnit(item);
                      const isFrac = matcon.matcon_enabled && isFractionalUnit(itemUnit);
                      const factor = resolveFactor(item);
                      const lotCode = (item as any).lot_code as string | null | undefined;
                      const restock = isFrac ? restockDeDevolucao(currentQty, factor) : null;

                      return (
                        <View key={`${sale.id}-${item.product_id}-${idx}`}>
                          <View style={s.itemRow}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.itemName} numberOfLines={1}>
                                {item.product_name_snapshot}
                              </Text>
                              <View style={s.itemMetaRow}>
                                <Text style={s.itemMeta}>
                                  {fmtBRL(Number(item.unit_price))} · qtd. orig.: {isFrac ? fmtQty(maxQty, itemUnit || "") : maxQty}
                                  {lotCode ? ` · lote ${lotCode}` : ""}
                                </Text>
                                {hasPrev && (
                                  <View style={s.badgePrevReturn}>
                                    <Text style={s.badgePrevReturnTxt}>
                                      ⚠ Já devolvido antes
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            {isFrac ? (
                              <DecimalQtyInput
                                testID={`troca-dev-qty-${item.product_id}`}
                                value={currentQty}
                                unit={itemUnit || ""}
                                onCommit={(q) => setQty(sale, item, idx, q)}
                              />
                            ) : (
                              <View style={s.qtyRow}>
                                <Pressable
                                  testID={`troca-dev-dec-${item.product_id}`}
                                  style={[s.qtyBtn, currentQty === 0 && s.qtyBtnDisabled]}
                                  onPress={() => setQty(sale, item, idx, currentQty - 1)}
                                  disabled={currentQty === 0}
                                >
                                  <Text style={s.qtyBtnTxt}>−</Text>
                                </Pressable>
                                <Text style={[s.qtyVal, currentQty > 0 && s.qtyValOn]}>
                                  {currentQty}
                                </Text>
                                <Pressable
                                  testID={`troca-dev-inc-${item.product_id}`}
                                  style={[s.qtyBtn, currentQty >= maxQty && s.qtyBtnDisabled]}
                                  onPress={() => setQty(sale, item, idx, currentQty + 1)}
                                  disabled={currentQty >= maxQty}
                                >
                                  <Text style={s.qtyBtnTxt}>+</Text>
                                </Pressable>
                              </View>
                            )}
                          </View>

                          {/* 22/09/2026 (M4): linha verde (caixa fechada volta
                              ao estoque) e/ou âmbar (caixa aberta não volta,
                              vale R$ 0) — só com item fracionado + quantidade
                              digitada. */}
                          {isFrac && restock && currentQty > 0 && restock.caixasFechadas !== null && restock.caixasFechadas > 0 && (
                            <View style={s.restockLine}>
                              <Text style={s.restockLineTxt}>
                                {fraseCaixaFechada({
                                  caixasFechadas: restock.caixasFechadas,
                                  restockQty: restock.restockQty,
                                  unit: itemUnit || "",
                                  lotCode,
                                  credito: creditoDaDevolucao(restock.restockQty, Number(item.unit_price)),
                                })}
                              </Text>
                            </View>
                          )}
                          {isFrac && restock && currentQty > 0 && !!factor && restock.naoVolta > 0 && (
                            <View style={s.openBoxLine}>
                              <Text style={s.openBoxLineTxt}>
                                {fraseCaixaAberta({ naoVolta: restock.naoVolta, unit: itemUnit || "" })}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={s.stepFooter}>
        <View>
          <Text style={s.footerLabel}>Total devolvendo</Text>
          <Text style={s.footerSub}>
            {matcon.matcon_enabled ? fmtQty(totalReturnedQty) : totalReturnedQty} {totalReturnedQty === 1 ? "item" : "itens"} de {selectedSales.length} {selectedSales.length === 1 ? "venda" : "vendas"}
          </Text>
        </View>
        <Text style={s.footerVal}>{fmtBRL(totalReturnedValue)}</Text>
      </View>
    </View>
  );
}

// 22/09/2026 (M4) — campo decimal do item fracionado devolvido. Mesmo
// padrão do campo decimal do carrinho (CartPanel.tsx): abre em pt-BR
// ("12,5"), parseQtyInput lê de volta na saída do campo; componente à
// parte porque cada linha precisa do próprio buffer (hook não entra
// dentro de .map()).
function DecimalQtyInput({
  value, unit, onCommit, testID,
}: { value: number; unit: string; onCommit: (qty: number) => void; testID?: string }) {
  const [buf, setBuf] = useState<string | null>(null);
  const editing = buf !== null;

  function commit() {
    if (buf !== null) {
      const parsed = parseQtyInput(buf);
      if (parsed !== null && parsed !== value) onCommit(parsed);
    }
    setBuf(null);
  }

  return (
    <View style={s.decCtrl}>
      <TextInput
        testID={testID}
        style={s.decVal as any}
        value={editing ? buf! : (value > 0 ? fmtQty(value) : "")}
        placeholder="0"
        placeholderTextColor={Colors.ink3}
        onFocus={() => setBuf(value > 0 ? fmtQty(value) : "")}
        onChangeText={(v) => setBuf(v.replace(/[^\d.,]/g, ""))}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <Text style={s.decUnit}>{unit}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: {
    fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 2, letterSpacing: -0.2,
  },
  sectionSub: { fontSize: 12, color: Colors.ink3, marginBottom: 14 },
  input: {
    backgroundColor: Glass.bgInput,
    borderWidth: 1, borderColor: Glass.bgInputBorder,
    color: Colors.ink, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 9, fontSize: 13, marginBottom: 12,
  },
  emptyTxt: {
    color: Colors.ink3, fontSize: 12, fontStyle: "italic",
    textAlign: "center", paddingVertical: 20,
  },
  group: {
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
    borderRadius: 12, marginBottom: 10, overflow: "hidden",
  },
  groupHeader: {
    padding: 12, paddingHorizontal: 14,
    backgroundColor: "rgba(124,58,237,0.05)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  groupTitleRow: {
    flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2,
  },
  groupTitle: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  groupMeta: { fontSize: 11, color: Colors.ink3 },
  groupActions: { flexDirection: "row", gap: 6, alignItems: "center", flexShrink: 0 },
  smallBtn: {
    backgroundColor: "rgba(124,58,237,0.15)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 7,
  },
  smallBtnTxt: { color: "#a78bfa", fontSize: 11, fontWeight: "600" },
  smallBtnGhost: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7,
  },
  smallBtnGhostTxt: { color: Colors.ink3, fontSize: 11, fontWeight: "500" },
  itemList: { paddingVertical: 4 },
  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.03)",
  },
  itemName: { fontSize: 13, fontWeight: "500", color: Colors.ink },
  itemMetaRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap",
  },
  itemMeta: { fontSize: 11, color: Colors.ink3 },
  badgePrevReturn: {
    backgroundColor: "rgba(251,191,36,0.15)",
    paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4,
  },
  badgePrevReturnTxt: { fontSize: 10, fontWeight: "600", color: "#fbbf24" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyBtnTxt: { color: Colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 16 },
  qtyVal: {
    minWidth: 26, textAlign: "center",
    color: Colors.ink3, fontSize: 14, fontWeight: "700",
  },
  qtyValOn: { color: Colors.violet3 },
  // 22/09/2026 (M4) — campo decimal (item fracionado) + linhas de restock.
  decCtrl: {
    flexDirection: "row", alignItems: "baseline", gap: 4, flexShrink: 0,
  },
  decVal: {
    minWidth: 56, textAlign: "right",
    color: Colors.violet3, fontSize: 15, fontWeight: "700",
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.35)",
    paddingVertical: 2,
  },
  decUnit: { color: Colors.ink3, fontSize: 11, fontWeight: "600" },
  restockLine: {
    marginHorizontal: 14, marginBottom: 8, padding: 10,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.25)",
    borderRadius: 9,
  },
  restockLineTxt: { color: "#34d399", fontSize: 11.5, lineHeight: 16 },
  openBoxLine: {
    marginHorizontal: 14, marginBottom: 8, padding: 10,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1, borderColor: "rgba(251,191,36,0.3)",
    borderRadius: 9,
  },
  openBoxLineTxt: { color: "#fbbf24", fontSize: 11.5, lineHeight: 16 },
  badgeFilial: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(96,165,250,0.15)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.3)",
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
  },
  badgeFilialIcon: { fontSize: 9 },
  badgeFilialTxt: { fontSize: 10, fontWeight: "700", color: "#60a5fa", maxWidth: 100 },
  stepFooter: {
    marginTop: 16, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.06)",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 11,
  },
  footerLabel: {
    fontSize: 11, color: Colors.ink2, textTransform: "uppercase",
    letterSpacing: 0.5, fontWeight: "600",
  },
  footerSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  footerVal: { fontSize: 20, fontWeight: "800", color: Colors.red, letterSpacing: -0.3 },
});

export default Step2Returns;
