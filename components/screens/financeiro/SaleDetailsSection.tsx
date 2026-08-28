import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTransactionSale } from "@/hooks/useTransactionSale";
import { AddItemPicker } from "./AddItemPicker";
import type { SaleDetailsItem } from "@/services/api";

// ============================================================
// AURA. — Detalhes da venda vinculada (Item 1 Eryca + EXTRA C)
//
// Renderiza dentro do TransactionModal QUANDO o lancamento veio
// do PDV. Mostra:
//   1. Cliente da venda (read-only se houver)
//   2. Vendedora (editavel via dropdown de funcionarios)
//   3. Lista de mercadorias com botao "remover" por item
//      (devolucao parcial: backend devolve estoque + reduz total
//      + cria lancamento espelho de "devolucao" no financeiro)
//   4. Botao "+ Adicionar produto" (EXTRA C) que abre picker
//      pra incluir item novo na venda existente
//
// Comportamento:
//   - Se transacao nao tem venda vinculada (tx criada manual),
//     so mostra o seletor de vendedora.
//   - Se a venda foi cancelada, items aparecem mas botoes de
//     remover e adicionar ficam desabilitados.
//
// 28/08/2026 (relato Eryca) — VENDA NO CREDIARIO:
//   Antes essa secao nunca aparecia numa venda fiada: o lancamento dela nao e
//   "pdv-sale-<id>" (venda 100% no crediario nao gera receita na hora) e sim o
//   "A Receber" "pdv-credit-receivable-<id>". Corrigido o vinculo, o crediario
//   muda tres coisas aqui:
//     1. Remover item nao "devolve dinheiro" — abate as ultimas parcelas em
//        aberto e, se sobrar, vira credito a favor do cliente.
//     2. O item devolvido CONTINUA na lista, marcado como devolvido: o motor
//        de devolucao ancora uma venda type='devolucao' em vez de apagar o
//        sale_item (guarda anti-dupla-devolucao).
//     3. "Adicionar produto" nao existe: divida e carne ja foram gerados.
// ============================================================

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };

export function SaleDetailsSection({ txId, onClose }: { txId: string; onClose?: () => void }) {
  const {
    details, isLoading,
    removeItem, isRemoving,
    addItem, isAdding,
    updateSeller, isSavingSeller,
  } = useTransactionSale(txId);

  const [pendingRemoveItemId, setPendingRemoveItemId] = useState<string | null>(null);
  const [pendingRemoveItemName, setPendingRemoveItemName] = useState<string>("");
  const [empPickerOpen, setEmpPickerOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  if (isLoading) {
    return (
      <View style={s.box}>
        <View style={s.loadingRow}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.loadingText}>Carregando detalhes da venda...</Text>
        </View>
      </View>
    );
  }

  if (!details) return null;

  const isLinked = details.has_sale === true;
  const sale = details.sale;
  const isCancelled = sale?.status === "cancelled";
  const employees = details.available_employees || [];
  const currentSellerName = details.seller?.name || details.transaction.employee_name || null;
  const items = details.items || [];

  // 28/08/2026: venda no crediario. O lancamento aberto e o "A Receber", nao
  // uma receita ja embolsada — logo a devolucao aqui abate parcela, nao devolve
  // dinheiro. E nao da pra acrescentar produto: divida e carne ja foram gerados.
  const isCredit = sale?.is_credit === true || details.sale_source === "credit";
  const canAddItems = sale?.can_add_items !== false;
  // available_quantity so vem do backend novo; sem ele, assume item inteiro.
  const availableOf = function(item: SaleDetailsItem): number {
    return item.available_quantity != null ? item.available_quantity : item.quantity;
  };

  const filteredEmps = empSearch.trim().length > 0
    ? employees.filter(function(e) { return e.name.toLowerCase().includes(empSearch.toLowerCase()); })
    : employees;

  async function handleConfirmRemove() {
    if (!pendingRemoveItemId) return;
    try {
      const result = await removeItem(pendingRemoveItemId);
      const nome = result.removed_item?.name || "item";
      const valor = fmt(result.removed_item?.refund_amount || 0);
      if (result.mode === "credit_refund") {
        // No crediario o dinheiro nao sai do caixa: ele abate parcela. Dizer
        // "devolvido" aqui faria a lojista procurar uma saida que nao existe.
        const credito = result.credit_refund?.credit_generated || 0;
        toast.success(
          "Devolucao feita: " + nome + ". " + valor + " abatido do crediario" +
          (credito > 0 ? " · " + fmt(credito) + " viraram credito a favor do cliente." : ".")
        );
      } else {
        toast.success("Devolucao feita: " + nome + ". " + valor + " devolvido.");
      }
      if (result.sale_cancelled && onClose) {
        // Venda inteira cancelada: fecha modal pra evitar estado inconsistente
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao remover item");
    } finally {
      setPendingRemoveItemId(null);
      setPendingRemoveItemName("");
    }
  }

  async function handlePickSeller(employee_id: string | null, employee_name?: string) {
    try {
      await updateSeller({ employee_id: employee_id, employee_name: employee_name });
      toast.success("Vendedora atualizada");
      setEmpPickerOpen(false);
      setEmpSearch("");
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao atualizar");
    }
  }

  return (
    <View style={s.box}>
      <View style={s.headerRow}>
        <Icon name="receipt" size={14} color={Colors.violet3} />
        <Text style={s.headerTitle}>{isLinked ? "Detalhes da venda" : "Detalhes do lancamento"}</Text>
        {isCancelled && (
          <View style={s.cancelledBadge}>
            <Text style={s.cancelledText}>Cancelada</Text>
          </View>
        )}
      </View>

      {/* CLIENTE — read-only quando vinculado a venda */}
      {isLinked && details.customer && (
        <View style={s.fieldRow}>
          <View style={s.fieldIcon}><Icon name="users" size={12} color={Colors.ink3} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Cliente</Text>
            <Text style={s.fieldValue} numberOfLines={1}>{details.customer.name}</Text>
            {details.customer.phone && <Text style={s.fieldHint}>{details.customer.phone}</Text>}
          </View>
        </View>
      )}
      {isLinked && !details.customer && (
        <View style={s.fieldRow}>
          <View style={s.fieldIcon}><Icon name="users" size={12} color={Colors.ink3} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Cliente</Text>
            <Text style={s.fieldValuePlaceholder}>Não identificado</Text>
          </View>
        </View>
      )}

      {/* VENDEDORA — editavel sempre */}
      <View style={s.fieldRow}>
        <View style={s.fieldIcon}><Icon name="user_plus" size={12} color={Colors.ink3} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Vendedora</Text>
          {currentSellerName ? (
            <Text style={s.fieldValue} numberOfLines={1}>{currentSellerName}</Text>
          ) : (
            <Text style={s.fieldValuePlaceholder}>Não informada</Text>
          )}
        </View>
        <Pressable
          onPress={function() { setEmpPickerOpen(!empPickerOpen); }}
          disabled={isSavingSeller}
          style={s.changeBtn}
        >
          {isSavingSeller ? (
            <ActivityIndicator size="small" color={Colors.violet3} />
          ) : (
            <>
              <Icon name="edit" size={11} color={Colors.violet3} />
              <Text style={s.changeBtnText}>Alterar</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* DROPDOWN de vendedoras (quando aberto) */}
      {empPickerOpen && (
        <View style={s.empPicker}>
          <View style={s.empSearchBox}>
            <Icon name="search" size={12} color={Colors.ink3} />
            <Text
              style={s.empSearchInput}
              onPress={function() { /* RN nao tem input editavel inline aqui — usar overlay */ }}
            >
              {empSearch || "Buscar funcionaria..."}
            </Text>
          </View>
          <View style={{ maxHeight: 180 }}>
            {filteredEmps.length === 0 && (
              <Text style={s.empEmpty}>
                Nenhuma funcionaria cadastrada. Cadastre em Folha {">"} Funcionarias.
              </Text>
            )}
            {filteredEmps.map(function(e) {
              const isCurrent = details.transaction.employee_id === e.id;
              return (
                <Pressable
                  key={e.id}
                  onPress={function() { handlePickSeller(e.id, e.name); }}
                  style={[s.empRow, isCurrent && s.empRowCurrent]}
                  disabled={isSavingSeller}
                >
                  <Icon name={isCurrent ? "check" : "user_plus"} size={12} color={isCurrent ? Colors.violet : Colors.ink3} />
                  <Text style={[s.empRowName, isCurrent && { color: Colors.violet, fontWeight: "700" }]}>{e.name}</Text>
                </Pressable>
              );
            })}
            {currentSellerName && (
              <Pressable
                onPress={function() { handlePickSeller(null); }}
                style={[s.empRow, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 }]}
                disabled={isSavingSeller}
              >
                <Icon name="x" size={12} color={Colors.red} />
                <Text style={[s.empRowName, { color: Colors.red }]}>Limpar vendedora</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* MERCADORIAS DA VENDA */}
      {isLinked && (
        <View style={s.itemsBlock}>
          <View style={s.itemsHeader}>
            <Text style={s.itemsTitle}>Mercadorias ({items.length})</Text>
            {sale && (
              <Text style={s.itemsTotal}>Total: {fmt(sale.total_amount)}</Text>
            )}
          </View>
          {items.length > 0 && (
            <Text style={s.warnHint}>
              {isCredit
                ? "Remover devolve a quantidade ao estoque e abate as ultimas parcelas em aberto. Sobra vira credito a favor do cliente."
                : "Remover devolve a quantidade ao estoque e cria devolucao no financeiro. Adicionar decrementa o estoque e soma na venda."}
            </Text>
          )}
          {items.map(function(item: SaleDetailsItem) {
            const available = availableOf(item);
            const isReturned = available <= 0;
            const isPartial = !isReturned && available < item.quantity;
            return (
              <View key={item.id} style={[s.itemRow, isReturned && s.itemRowReturned]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={2}>{item.product_name}</Text>
                  <Text style={s.itemMeta}>
                    {item.quantity}x {fmt(item.unit_price)} = {fmt(item.total_price)}
                  </Text>
                  {/* O crediario nao apaga o item devolvido: ele fica na venda
                      com a marca. Sem isso a lojista devolveria duas vezes. */}
                  {isReturned && <Text style={s.itemReturned}>Devolvido</Text>}
                  {isPartial && (
                    <Text style={s.itemReturned}>
                      {item.quantity - available} devolvido(s) · restam {available}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={function() {
                    if (isCancelled) {
                      toast.error("Venda ja cancelada — items nao podem ser removidos");
                      return;
                    }
                    if (isReturned) {
                      toast.error("Esse produto ja foi devolvido por inteiro");
                      return;
                    }
                    setPendingRemoveItemId(item.id);
                    setPendingRemoveItemName(item.product_name);
                  }}
                  disabled={isRemoving || isCancelled || isReturned}
                  style={[s.removeBtn, (isCancelled || isReturned) && s.removeBtnDisabled]}
                >
                  {isRemoving && pendingRemoveItemId === item.id ? (
                    <ActivityIndicator size="small" color={Colors.red} />
                  ) : (
                    <Icon name="trash" size={13} color={isCancelled || isReturned ? Colors.ink3 : Colors.red} />
                  )}
                </Pressable>
              </View>
            );
          })}

          {items.length === 0 && (
            <Text style={s.emptyItemsText}>
              Esta venda nao possui mais items (todos foram removidos).
            </Text>
          )}

          {/* Botao "+ Adicionar produto" (EXTRA C).
              Crediario fica de fora: acrescentar item aqui aumentaria o
              recebivel sem aumentar a divida do ledger nem o carne. */}
          {!isCancelled && canAddItems && !addPickerOpen && (
            <Pressable
              onPress={function() { setAddPickerOpen(true); }}
              disabled={isAdding}
              style={s.addBtn}
            >
              <Icon name="plus" size={13} color={Colors.violet3} />
              <Text style={s.addBtnText}>Adicionar produto</Text>
            </Pressable>
          )}
          {!isCancelled && !canAddItems && (
            <View style={s.creditHint}>
              <Icon name="info" size={11} color={Colors.violet3} />
              <Text style={s.creditHintText}>
                Venda no crediario: as parcelas ja foram geradas, entao nao da pra
                incluir produto aqui. Pra vender mais, lance uma venda nova.
              </Text>
            </View>
          )}

          {/* Picker (quando aberto) */}
          {addPickerOpen && (
            <AddItemPicker
              onAdd={addItem}
              isAdding={isAdding}
              onCancel={function() { setAddPickerOpen(false); }}
            />
          )}

          {isCancelled && items.length > 0 && (
            <View style={s.cancelledHint}>
              <Icon name="info" size={11} color={Colors.red} />
              <Text style={s.cancelledHintText}>
                Venda cancelada — items nao podem ser modificados.
              </Text>
            </View>
          )}
        </View>
      )}

      <ConfirmDialog
        visible={!!pendingRemoveItemId}
        title="Devolver este item?"
        message={
          isCredit
            ? 'Voce vai devolver "' + pendingRemoveItemName + '" desta venda no crediario. ' +
              'A quantidade volta pro estoque e o valor abate as ultimas parcelas em aberto ' +
              '(o que sobrar vira credito a favor do cliente). Parcelas ja pagas nao sao tocadas.'
            : 'Voce vai remover "' + pendingRemoveItemName + '" da venda. ' +
              'A quantidade volta pro estoque, o total da venda diminui e um lancamento de devolucao eh criado no financeiro.'
        }
        confirmLabel="Sim, devolver"
        destructive
        onConfirm={handleConfirmRemove}
        onCancel={function() { setPendingRemoveItemId(null); setPendingRemoveItemName(""); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: Colors.bg4,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 10, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700", flex: 1 },
  cancelledBadge: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.red + "55" },
  cancelledText: { fontSize: 9, color: Colors.red, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  fieldValue: { fontSize: 13, color: Colors.ink, fontWeight: "600", marginTop: 2 },
  fieldValuePlaceholder: { fontSize: 13, color: Colors.ink3, fontStyle: "italic", marginTop: 2 },
  fieldHint: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  changeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, minWidth: 70, justifyContent: "center" },
  changeBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  empPicker: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  empSearchBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  empSearchInput: { flex: 1, fontSize: 11, color: Colors.ink3 },
  empEmpty: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", padding: 10, textAlign: "center" },
  empRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 6 },
  empRowCurrent: { backgroundColor: Colors.violetD },
  empRowName: { fontSize: 12, color: Colors.ink, fontWeight: "500", flex: 1 },
  itemsBlock: { marginTop: 8 },
  itemsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingBottom: 6 },
  itemsTitle: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  itemsTotal: { fontSize: 12, color: Colors.green, fontWeight: "700" },
  warnHint: { fontSize: 10, color: Colors.ink3, fontStyle: "italic", lineHeight: 14, marginBottom: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  itemName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  itemMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  // Item devolvido no crediario segue na lista (o motor nao apaga o sale_item).
  itemRowReturned: { opacity: 0.55 },
  itemReturned: { fontSize: 10, color: "#fb923c", fontWeight: "700", marginTop: 3 },
  removeBtn: { width: 30, height: 30, borderRadius: 7, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.red + "33" },
  removeBtnDisabled: { backgroundColor: Colors.bg3, borderColor: Colors.border, opacity: 0.5 },
  emptyItemsText: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", textAlign: "center", paddingVertical: 12 },

  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 10, backgroundColor: Colors.violetD, borderRadius: 8, borderWidth: 1, borderStyle: "dashed" as any, borderColor: Colors.violet3 + "55" },
  addBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },

  cancelledHint: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, backgroundColor: Colors.redD, borderRadius: 8, borderWidth: 1, borderColor: Colors.red + "33" },
  cancelledHintText: { flex: 1, fontSize: 11, color: Colors.red, lineHeight: 14 },
  creditHint: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, backgroundColor: Colors.violetD, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2 },
  creditHintText: { flex: 1, fontSize: 11, color: Colors.ink3, lineHeight: 14 },
});

export default SaleDetailsSection;
