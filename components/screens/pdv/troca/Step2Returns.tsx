// ============================================================
// AURA. — PDV · Troca v2 · Step 2 (Devoluções agrupadas)
// Lista itens de TODAS as vendas selecionadas, agrupados por venda
// original. Cada grupo é colapsável, mostra header com data/total/
// vendedor, e cada item tem qty controls + badge "já devolvido em
// troca anterior" quando aplicável.
//
// Filtro de busca no topo filtra itens por nome — não vendas.
// Botão "Devolver tudo desta venda" no header de cada grupo.
//
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx
// 17/05/2026 (FASE A — UI Redesign)
// ============================================================
import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { SelectedSaleRow, ReturnEntry } from "./types";
import { fmtBRL } from "./types";

type Props = {
  selectedSales: SelectedSaleRow[];
  returnEntries: ReturnEntry[];
  onChangeEntries: (next: ReturnEntry[]) => void;
};

// Identidade estável de um item dentro de uma venda — usada como
// chave em returnEntries quando o backend não devolve sale_item.id
// (text mode synth + barcode mode quando salesApi.get falha).
function itemKey(saleId: string, productId: string | null, variantId: string | null | undefined) {
  return `${saleId}::${productId || "null"}::${variantId || "null"}`;
}

export function Step2Returns({
  selectedSales,
  returnEntries,
  onChangeEntries,
}: Props) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ─── Lookup map de returnEntries por (saleId, productId, variantId)
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
    nextQty: number
  ) {
    const k = itemKey(sale.id, item.product_id || null, (item as any).variant_id || null);
    const existing = entriesByKey.get(k);
    const clamped = Math.max(0, Math.min(Number(item.quantity), nextQty));

    if (clamped === 0) {
      // Remove entry
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
      // Cria nova entrada — guarda metadata da venda pra UI agrupar e fiscal saber origem
      const itemAsSaleDetailsItem: any = {
        id: `synth-${sale.id}-${item.product_id || "null"}`,
        product_id: item.product_id,
        variant_id: (item as any).variant_id,
        product_name: item.product_name_snapshot,
        product_name_snapshot: item.product_name_snapshot,
        quantity: item.quantity,
        unit_price: item.unit_price,
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
    for (const item of sale.items) {
      const k = itemKey(sale.id, item.product_id || null, (item as any).variant_id || null);
      if (keptIds.has(k)) {
        // já tem entrada — atualiza pra qtd máxima
      } else {
        additions.push({
          saleId: sale.id,
          saleDate: sale.created_at,
          saleCompanyName: sale.company_name || "—",
          sellerName: sale.seller_name,
          item: {
            id: `synth-${sale.id}-${item.product_id || "null"}`,
            product_id: item.product_id,
            variant_id: (item as any).variant_id,
            product_name: item.product_name_snapshot,
            product_name_snapshot: item.product_name_snapshot,
            quantity: item.quantity,
            unit_price: item.unit_price,
          } as any,
          returnQty: Number(item.quantity),
          previouslyReturnedQty: 0,
        });
      }
    }
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

  // ─── Render ──────────────────────────────────────────────────
  const filterQ = filter.trim().toLowerCase();
  const totalReturnedValue = returnEntries.reduce(
    (s, e) => s + e.returnQty * Number(e.item.unit_price), 0
  );
  const totalReturnedQty = returnEntries.reduce((s, e) => s + e.returnQty, 0);

  return (
    <View>
      <Text style={s.sectionTitle}>O que o cliente está devolvendo?</Text>
      <Text style={s.sectionSub}>
        Use +/− em cada item. Itens aparecem agrupados por venda — pode devolver de várias.
      </Text>

      {/* Filter */}
      <TextInput
        style={s.input as any}
        value={filter}
        onChangeText={setFilter}
        placeholder="Filtrar por nome do produto..."
        placeholderTextColor={Colors.ink3}
      />

      {/* Sale groups */}
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
            .reduce((sum, e) => sum + e.returnQty * Number(e.item.unit_price), 0);

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
                      const hasPrev = false; // placeholder — backend v2 trará isso

                      return (
                        <View
                          key={`${sale.id}-${item.product_id}-${idx}`}
                          style={s.itemRow}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.itemName} numberOfLines={1}>
                              {item.product_name_snapshot}
                            </Text>
                            <View style={s.itemMetaRow}>
                              <Text style={s.itemMeta}>
                                {fmtBRL(Number(item.unit_price))} · qtd. orig.: {maxQty}
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
                          <View style={s.qtyRow}>
                            <Pressable
                              style={[s.qtyBtn, currentQty === 0 && s.qtyBtnDisabled]}
                              onPress={() => setQty(sale, item, currentQty - 1)}
                              disabled={currentQty === 0}
                            >
                              <Text style={s.qtyBtnTxt}>−</Text>
                            </Pressable>
                            <Text style={[s.qtyVal, currentQty > 0 && s.qtyValOn]}>
                              {currentQty}
                            </Text>
                            <Pressable
                              style={[s.qtyBtn, currentQty >= maxQty && s.qtyBtnDisabled]}
                              onPress={() => setQty(sale, item, currentQty + 1)}
                              disabled={currentQty >= maxQty}
                            >
                              <Text style={s.qtyBtnTxt}>+</Text>
                            </Pressable>
                          </View>
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

      {/* Mini-resumo */}
      <View style={s.stepFooter}>
        <View>
          <Text style={s.footerLabel}>Total devolvendo</Text>
          <Text style={s.footerSub}>
            {totalReturnedQty} {totalReturnedQty === 1 ? "item" : "itens"} de {selectedSales.length} {selectedSales.length === 1 ? "venda" : "vendas"}
          </Text>
        </View>
        <Text style={s.footerVal}>{fmtBRL(totalReturnedValue)}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
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

  // Group
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

  // Item list
  itemList: { paddingVertical: 4 },
  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.03)",
  },
  itemName: {
    fontSize: 13, fontWeight: "500", color: Colors.ink,
  },
  itemMetaRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap",
  },
  itemMeta: { fontSize: 11, color: Colors.ink3 },
  badgePrevReturn: {
    backgroundColor: "rgba(251,191,36,0.15)",
    paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4,
  },
  badgePrevReturnTxt: { fontSize: 10, fontWeight: "600", color: "#fbbf24" },

  // Qty
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

  // Badge filial
  badgeFilial: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(96,165,250,0.15)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.3)",
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
  },
  badgeFilialIcon: { fontSize: 9 },
  badgeFilialTxt: { fontSize: 10, fontWeight: "700", color: "#60a5fa", maxWidth: 100 },

  // Step footer
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
