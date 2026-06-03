// ============================================================
// AURA. — Crediário · Modal de detalhe do cliente
//
// Substitui a rota app/crediario/cliente/[id] por um modal padrão
// (DNA TrocaModal): X + clique-fora fecham e voltam pra lista do
// crediário, sem mexer na navegação de tabs (antes voltava pro Painel).
//
// 03/06/2026 (polish crediário):
//   1. Modal padrão (X + backdrop)
//   2. Histórico de pagamentos (compra + recebimentos, com datas)
//   3. Recebimento de valor livre (1x) — POST /credit/customer/:cid/payment
//   4. Cobrança no WhatsApp (mensagem rica + chave Pix) via onCobrar
//
// Fonte: creditApi.getCustomerHistory -> balance + transactions
// (debit=compra, payment=recebimento) + open_installments.
// Recebimento usa creditApi.receivePayment -> applyPayment (FIFO).
// ============================================================
import { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView,
  TextInput, ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { creditApi } from "@/services/creditApi";
import { toast } from "@/components/Toast";

type Props = {
  visible: boolean;
  companyId: string;
  customerId: string | null;
  customerName?: string | null;
  pixKey?: string | null;
  storeName?: string | null;
  onClose: () => void;
  onCobrar?: (customerId: string, customerName: string, phone: string | null) => void;
  onChanged?: () => void;
};

const PAYMENT_METHODS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "cartao", label: "Cartão" },
];

function fmt(n: number) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" }); }
  catch { return ""; }
}
function parseAmount(raw: string): number {
  const s = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  return isFinite(n) && n >= 0 ? n : 0;
}
function productsFromNotes(notes?: string | null): string {
  if (!notes) return "";
  const mt = notes.match(/\(([^)]+)\)/);
  return mt ? mt[1] : "";
}

export function ClienteCrediarioModal({
  visible, companyId, customerId, customerName, pixKey, storeName,
  onClose, onCobrar, onChanged,
}: Props) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("dinheiro");

  const detailQ = useQuery({
    queryKey: ["credit-customer", companyId, customerId],
    queryFn: () => creditApi.getCustomerHistory(companyId, customerId!),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (visible) { setAmount(""); setMethod("dinheiro"); }
  }, [visible, customerId]);

  const detail = detailQ.data;
  const balance = detail?.balance ?? 0;
  const openInst = useMemo(
    () => (detail?.open_installments || []).slice()
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [detail],
  );
  const hasOverdue = openInst.some(i => i.status === "overdue");
  const openSum = openInst.reduce((s, i) => s + (i.remaining ?? (i.amount_due - (i.covered_amount || 0))), 0);

  const payMut = useMutation({
    mutationFn: (amt: number) => creditApi.receivePayment(companyId, customerId!, { amount: amt, payment_method: method }),
    onSuccess: (res) => {
      toast.success("Recebimento registrado! Saldo: " + fmt(res.new_balance));
      setAmount("");
      qc.invalidateQueries({ queryKey: ["credit-customer", companyId, customerId] });
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-aging", companyId] });
      onChanged?.();
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao registrar recebimento"),
  });

  const amountNum = parseAmount(amount);
  const afterBalance = Math.max(0, Math.round((balance - amountNum) * 100) / 100);

  function confirmReceive() {
    if (amountNum <= 0) { toast.error("Informe um valor maior que zero"); return; }
    payMut.mutate(amountNum);
  }
  function prefill(v: number) {
    setAmount(v.toFixed(2).replace(".", ","));
  }

  const name = detail?.customer?.name || customerName || "Cliente";
  const phone = detail?.customer?.phone || null;
  const initial = (name.trim()[0] || "?").toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={m.backdrop} onPress={onClose}>
        <Pressable style={m.sheet} onPress={() => {}}>
          {/* Header */}
          <View style={m.head}>
            <Pressable onPress={onClose} style={m.crumb}>
              <Icon name="chevron_right" size={15} color={Colors.violet3} style={{ transform: [{ rotate: "180deg" }] } as any} />
              <Text style={m.crumbTxt}>Crediário</Text>
            </Pressable>
            <Pressable onPress={onClose} style={m.xBtn}>
              <Icon name="x" size={15} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={m.body} contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
            {/* Cliente */}
            <View style={m.cust}>
              <View style={m.custL}>
                <View style={m.avatar}><Text style={m.avatarTxt}>{initial}</Text></View>
                <View>
                  <Text style={m.custName}>{name}</Text>
                  <View style={m.custSub}>
                    <View style={[m.dot, { backgroundColor: hasOverdue ? Colors.red : Colors.green }]} />
                    <View style={[m.pill, { backgroundColor: (hasOverdue ? Colors.red : Colors.green) + "22" }]}>
                      <Text style={[m.pillTxt, { color: hasOverdue ? Colors.red : Colors.green }]}>
                        {hasOverdue ? "Em atraso" : "Em dia"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              {!!phone && !!onCobrar && (
                <Pressable style={m.waBtn} onPress={() => onCobrar(customerId!, name, phone)}>
                  <Icon name="message_circle" size={14} color={Colors.green} />
                  <Text style={m.waTxt}>Cobrar</Text>
                </Pressable>
              )}
            </View>

            {detailQ.isLoading ? (
              <View style={{ paddingVertical: 36, alignItems: "center" }}>
                <ActivityIndicator color={Colors.violet3} />
              </View>
            ) : (
              <>
                {/* Resumo */}
                <View style={m.card}>
                  <Text style={m.cardTitle}>Resumo</Text>
                  <View style={m.row}>
                    <View><Text style={m.rowK}>Saldo devedor (crediário)</Text><Text style={m.rowKsub}>Ledger acumulado</Text></View>
                    <Text style={[m.rowV, { color: Colors.red }]}>{fmt(balance)}</Text>
                  </View>
                  {openInst.length > 0 && (
                    <View style={m.row}>
                      <View><Text style={m.rowK}>Parcelas abertas</Text><Text style={m.rowKsub}>{openInst.length} parcela{openInst.length !== 1 ? "s" : ""}</Text></View>
                      <Text style={[m.rowV, { color: Colors.amber }]}>{fmt(openSum)}</Text>
                    </View>
                  )}
                </View>

                {/* Parcelas em aberto */}
                {openInst.length > 0 && (
                  <View style={m.card}>
                    <Text style={m.cardTitle}>Parcelas em aberto</Text>
                    {openInst.map((ins) => {
                      const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                      const late = ins.status === "overdue";
                      return (
                        <View key={ins.id} style={m.parc}>
                          <View style={{ flex: 1 }}>
                            <Text style={m.parcT}>Parcela {ins.installment_number}/{ins.total_installments} · {fmt(rem)}</Text>
                            <Text style={m.parcS}>Vence {fmtDate(ins.due_date)}</Text>
                          </View>
                          <View style={[m.badge, { backgroundColor: (late ? Colors.red : Colors.green) + "1A", borderColor: (late ? Colors.red : Colors.green) + "44" }]}>
                            <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>{late ? "Em atraso" : "No prazo"}</Text>
                          </View>
                          <Pressable style={m.receberBtn} onPress={() => prefill(rem)}>
                            <Text style={m.receberTxt}>Receber</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Registrar recebimento (valor livre) */}
                <View style={m.freeBox}>
                  <Text style={m.freeTitle}>Registrar recebimento</Text>
                  <Text style={m.fieldLabel}>Valor recebido agora</Text>
                  <View style={m.amountIn}>
                    <Text style={m.amountPrefix}>R$</Text>
                    <TextInput
                      style={m.amountInput}
                      value={amount}
                      onChangeText={(v) => setAmount(v.replace(/[^\d,.]/g, ""))}
                      placeholder="0,00"
                      placeholderTextColor={Colors.ink3}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={m.quickRow}>
                    {[50, 100, 200].map(v => (
                      <Pressable key={v} style={m.qChip} onPress={() => prefill(v)}>
                        <Text style={m.qChipTxt}>{fmt(v)}</Text>
                      </Pressable>
                    ))}
                    {balance > 0 && (
                      <Pressable style={m.qChip} onPress={() => prefill(balance)}>
                        <Text style={m.qChipTxt}>Quitar ({fmt(balance)})</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={[m.fieldLabel, { marginTop: 14 }]}>Forma</Text>
                  <View style={m.methods}>
                    {PAYMENT_METHODS.map(pm => (
                      <Pressable key={pm.key} style={[m.method, method === pm.key && m.methodActive]} onPress={() => setMethod(pm.key)}>
                        <Text style={[m.methodTxt, method === pm.key && { color: "#fff" }]}>{pm.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {amountNum > 0 && (
                    <View style={m.after}>
                      <Text style={m.afterK}>Saldo após recebimento</Text>
                      <Text style={m.afterV}>{fmt(afterBalance)}</Text>
                    </View>
                  )}
                </View>

                {/* Histórico de pagamentos */}
                <View style={m.card}>
                  <Text style={m.cardTitle}>Histórico de pagamentos</Text>
                  {(detail?.transactions || []).length === 0 ? (
                    <Text style={m.emptyTxt}>Sem movimentações ainda.</Text>
                  ) : (
                    (detail?.transactions || []).map((t) => {
                      const isPay = t.type === "payment";
                      const prods = productsFromNotes(t.notes);
                      return (
                        <View key={t.id} style={m.tlItem}>
                          <View style={[m.tlDot, { backgroundColor: isPay ? Colors.green : Colors.violet3 }]} />
                          <View style={{ flex: 1 }}>
                            <View style={m.tlLine}>
                              <Text style={m.tlMain}>{isPay ? `Recebimento${t.payment_method ? " · " + t.payment_method : ""}` : "Compra no crediário"}</Text>
                              <Text style={[m.tlAmt, { color: isPay ? Colors.green : Colors.ink }]}>{isPay ? "+ " : ""}{fmt(t.amount)}</Text>
                            </View>
                            <Text style={m.tlSub}>{fmtDate(t.created_at)}{prods ? ` · ${prods}` : (t.notes && !isPay ? ` · ${t.notes}` : "")}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={m.footer}>
            <Pressable
              style={[m.cta, (amountNum <= 0 || payMut.isPending) && { opacity: 0.45 }]}
              disabled={amountNum <= 0 || payMut.isPending}
              onPress={confirmReceive}
            >
              {payMut.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={m.ctaTxt}>{amountNum > 0 ? `Confirmar recebimento de ${fmt(amountNum)}` : "Registrar recebimento"}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 16 },
  sheet: { backgroundColor: Colors.bg2, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90%", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },

  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  crumb: { flexDirection: "row", alignItems: "center", gap: 5 },
  crumbTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  xBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },

  body: { flexGrow: 0 },

  cust: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  custL: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 18, fontWeight: "700", color: Colors.violet3 },
  custName: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  custSub: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pillTxt: { fontSize: 10, fontWeight: "700" },
  waBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.4)", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  waTxt: { fontSize: 12, fontWeight: "700", color: Colors.green },

  card: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 13 },
  cardTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  rowK: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  rowKsub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  rowV: { fontSize: 17, fontWeight: "800" },

  parc: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: Colors.border },
  parcT: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  parcS: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  receberBtn: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  receberTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },

  freeBox: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 14, marginBottom: 13 },
  freeTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.violet3, textTransform: "uppercase", marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 },
  amountIn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg2, borderWidth: 1.5, borderColor: Colors.violet2, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  amountPrefix: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  amountInput: { flex: 1, color: Colors.ink, fontSize: 20, fontWeight: "800", paddingVertical: 0 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  qChip: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  qChipTxt: { fontSize: 11, fontWeight: "700", color: Colors.ink2 },
  methods: { flexDirection: "row", gap: 7 },
  method: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingVertical: 9 },
  methodActive: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  methodTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  after: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: Colors.border2 },
  afterK: { fontSize: 12, color: Colors.ink3 },
  afterV: { fontSize: 14, fontWeight: "800", color: Colors.amber },

  tlItem: { flexDirection: "row", gap: 11, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  tlLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  tlMain: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  tlAmt: { fontSize: 13, fontWeight: "800" },
  tlSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  emptyTxt: { fontSize: 12, color: Colors.ink3, paddingVertical: 6 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  cta: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ctaTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

export default ClienteCrediarioModal;
