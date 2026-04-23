import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  transactionSaleApi,
  type SaleDetailsResponse,
  type SaleDetailsItem,
} from "@/services/transactionSaleApi";

// ============================================================
// AURA. — Secao de mercadorias + vendedora dentro do TransactionModal
//
// Renderiza quando a transacao em edicao veio de uma venda do PDV
// (vinculo via idempotency_key). Permite:
//   - Ver itens da venda (foto, nome, qty x preco, total)
//   - Remover item -> devolucao parcial (estoque + total + entrada
//     de devolucao no financeiro)
//   - Selecionar vendedora (dropdown de funcionarios)
// ============================================================

var fmtBRL = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };

type Props = {
  transactionId: string;
  onChanged?: () => void; // Chamado apos qualquer mudanca pra refetch externo
};

export function SaleDetailsSection({ transactionId, onChanged }: Props) {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [data, setData] = useState<SaleDetailsResponse | null>(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState<string | null>(null);
  var [confirmRemove, setConfirmRemove] = useState<SaleDetailsItem | null>(null);
  var [removing, setRemoving] = useState(false);
  var [savingSeller, setSavingSeller] = useState(false);
  var [empOpen, setEmpOpen] = useState(false);

  function load() {
    if (!company?.id) return;
    setLoading(true);
    setError(null);
    transactionSaleApi
      .getDetails(company.id, transactionId)
      .then(function(res) { setData(res); setLoading(false); })
      .catch(function(err) {
        setError(err?.message || "Erro ao carregar detalhes");
        setLoading(false);
      });
  }

  useEffect(load, [company?.id, transactionId]);

  function invalidateGlobal() {
    if (!company?.id) return;
    qc.invalidateQueries({ queryKey: ["transactions", company.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", company.id] });
    qc.invalidateQueries({ queryKey: ["products", company.id] });
    qc.invalidateQueries({ queryKey: ["dre", company.id] });
    onChanged?.();
  }

  async function handleRemove() {
    if (!confirmRemove || !company?.id) return;
    setRemoving(true);
    try {
      var res = await transactionSaleApi.removeItem(company.id, transactionId, confirmRemove.id);
      toast.success(
        "Item devolvido (" + fmtBRL(res.removed_item.refund_amount) + ")" +
        (res.sale_cancelled ? " - venda cancelada (sem itens)" : "")
      );
      setConfirmRemove(null);
      load();
      invalidateGlobal();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao remover item");
    } finally {
      setRemoving(false);
    }
  }

  async function handleSelectSeller(empId: string | null, empName: string | null) {
    if (!company?.id || savingSeller) return;
    setSavingSeller(true);
    setEmpOpen(false);
    try {
      await transactionSaleApi.updateSeller(company.id, transactionId, empId, empName);
      toast.success(empId ? "Vendedora atualizada" : "Vendedora removida");
      load();
      invalidateGlobal();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao salvar vendedora");
    } finally {
      setSavingSeller(false);
    }
  }

  if (loading) {
    return (
      <View style={s.box}>
        <View style={s.loadingRow}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.loadingText}>Carregando detalhes da venda...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.box, { borderColor: Colors.red + "44" }]}>
        <Text style={s.errorText}>{error}</Text>
        <Pressable onPress={load} style={s.retryBtn}>
          <Text style={s.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  // Caso 1: Transacao nao vem de venda — mostra apenas seletor de vendedora
  // pra qualquer lancamento (vendedora pode ser util mesmo em receita avulsa)
  var seller = data.seller || { id: data.transaction.employee_id, name: data.transaction.employee_name };

  return (
    <View style={s.box}>
      {data.has_sale && data.sale ? (
        <>
          <View style={s.header}>
            <View style={s.iconBox}>
              <Icon name="cart" size={14} color={Colors.violet3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Venda vinculada</Text>
              <Text style={s.subtitle}>
                {data.items?.length || 0} {(data.items?.length || 0) === 1 ? "item" : "itens"}
                {" \u00b7 "}{fmtBRL(data.sale.total_amount)}
                {data.sale.payment_method ? " \u00b7 " + data.sale.payment_method : ""}
                {data.sale.status === "cancelled" ? " \u00b7 CANCELADA" : ""}
              </Text>
            </View>
          </View>

          {data.customer && (
            <View style={s.metaRow}>
              <Icon name="user" size={11} color={Colors.ink3} />
              <Text style={s.metaText}>Cliente: {data.customer.name}</Text>
            </View>
          )}

          {/* Lista de itens */}
          <Text style={s.sectionLabel}>MERCADORIAS</Text>
          {(data.items || []).length === 0 ? (
            <Text style={s.emptyText}>Nenhum item nesta venda</Text>
          ) : (
            (data.items || []).map(function(item) {
              return (
                <View key={item.id} style={s.itemRow}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={s.itemImage} />
                  ) : (
                    <View style={[s.itemImage, s.itemImagePh]}>
                      <Icon name="package" size={14} color={Colors.ink3} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={s.itemMeta}>
                      {item.quantity} x {fmtBRL(item.unit_price)} = {fmtBRL(item.total_price)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={function() { setConfirmRemove(item); }}
                    disabled={removing || data.sale?.status === "cancelled"}
                    style={[s.removeBtn, data.sale?.status === "cancelled" && { opacity: 0.4 }]}
                    {...{ title: "Remover (devolucao parcial)" } as any}
                  >
                    <Icon name="trash" size={13} color={Colors.red} />
                  </Pressable>
                </View>
              );
            })
          )}

          {(data.items || []).length > 0 && data.sale.status !== "cancelled" && (
            <View style={s.warningBox}>
              <Icon name="info" size={11} color={Colors.amber} />
              <Text style={s.warningText}>
                Remover um item devolve a quantidade ao estoque, reduz o total da venda e cria uma entrada de devolucao no financeiro.
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={s.header}>
          <View style={s.iconBox}>
            <Icon name="info" size={14} color={Colors.ink3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Lancamento manual</Text>
            <Text style={s.subtitle}>Esta transacao nao veio de uma venda do Caixa</Text>
          </View>
        </View>
      )}

      {/* Seletor de vendedora — sempre disponivel */}
      <Text style={s.sectionLabel}>VENDEDORA</Text>
      {seller.id ? (
        <View style={s.sellerChip}>
          <Icon name="user" size={12} color={Colors.violet3} />
          <Text style={s.sellerChipText} numberOfLines={1}>{seller.name || "(sem nome)"}</Text>
          <Pressable
            onPress={function() { handleSelectSeller(null, null); }}
            disabled={savingSeller}
            style={s.chipRemove}
          >
            <Text style={s.chipRemoveText}>x</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={function() { setEmpOpen(!empOpen); }} style={s.sellerEmpty}>
          <Icon name="user_plus" size={13} color={Colors.violet3} />
          <Text style={s.sellerEmptyText}>Adicionar vendedora</Text>
          <Icon name={empOpen ? "chevron_up" : "chevron_down"} size={11} color={Colors.ink3} />
        </Pressable>
      )}

      {empOpen && !seller.id && (
        <View style={s.dropdown}>
          {data.available_employees.length === 0 ? (
            <Text style={s.emptyText}>Nenhum funcionario cadastrado</Text>
          ) : (
            data.available_employees.map(function(emp) {
              return (
                <Pressable
                  key={emp.id}
                  onPress={function() { handleSelectSeller(emp.id, emp.name); }}
                  disabled={savingSeller}
                  style={s.dropdownRow}
                >
                  <Icon name="user" size={11} color={Colors.ink3} />
                  <Text style={s.dropdownText}>{emp.name}</Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {savingSeller && (
        <View style={s.loadingRow}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.loadingText}>Salvando...</Text>
        </View>
      )}

      <ConfirmDialog
        visible={!!confirmRemove}
        title="Devolver este item?"
        message={
          confirmRemove
            ? "Vai devolver " + confirmRemove.quantity + "x " + confirmRemove.product_name +
              " ao estoque e reduzir " + fmtBRL(confirmRemove.total_price) +
              " da venda. Tambem cria uma entrada de devolucao no financeiro. Esta acao nao pode ser desfeita."
            : ""
        }
        confirmLabel="Devolver"
        destructive
        onConfirm={handleRemove}
        onCancel={function() { setConfirmRemove(null); }}
      />
    </View>
  );
}

var s = StyleSheet.create({
  box: {
    backgroundColor: Colors.bg4,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 12,
    gap: 10,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  loadingText: { fontSize: 11, color: Colors.ink3 },
  errorText: { fontSize: 12, color: Colors.red, marginBottom: 6 },
  retryBtn: { alignSelf: "flex-start", backgroundColor: Colors.bg3, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  retryText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 4 },
  iconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 11, color: Colors.ink3 },
  sectionLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.8, marginTop: 4 },
  emptyText: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", paddingVertical: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: Colors.border },
  itemImage: { width: 36, height: 36, borderRadius: 6 },
  itemImagePh: { backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  itemMeta: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  removeBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.red + "33" },
  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: Colors.amber + "11", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: Colors.amber + "33" },
  warningText: { fontSize: 10, color: Colors.amber, flex: 1, lineHeight: 14 },
  sellerChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.violet },
  sellerChipText: { flex: 1, fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  chipRemove: { width: 20, height: 20, borderRadius: 5, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  chipRemoveText: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },
  sellerEmpty: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed" as any },
  sellerEmptyText: { flex: 1, fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  dropdown: { backgroundColor: Colors.bg3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginTop: -4, maxHeight: 180, overflow: "hidden" },
  dropdownRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
});

export default SaleDetailsSection;
