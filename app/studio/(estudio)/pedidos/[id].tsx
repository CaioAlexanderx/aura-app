// ============================================================
// AURA STUDIO · Detalhe de pedido
//
// Camada 1 Fase C: PaymentCard + gate de produção por sinal.
// P1 (30/05): gate movido do frontend pro backend.
// advance() chama doAdvance() diretamente; doAdvance() trata
// 409 deposit_required do backend — fonte da verdade é o servidor.
// force: true enviado no retry quando lojista confirma fora do gate.
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Linking,
  Alert, Modal, TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { useAuthStore } from "@/stores/auth";
import { studioApi, type StudioOrderDetail, type StudioProductionStatus, type StudioPayment, type StudioPaymentKind } from "@/services/studioApi";
import { labelStudioStatus, colorStudioStatus } from "@/constants/studio-status";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";

const NEXT: Record<StudioProductionStatus, StudioProductionStatus | null> = {
  pending_art: "approved",
  approved: "in_production",
  in_production: "ready",
  ready: "delivered",
  delivered: null,
};

// ── PaymentCard ───────────────────────────────────────────────────────────────────────────
type PaymentCardProps = {
  orderId: string;
  companyId: string;
  depositRequired: number | null | undefined;
  depositPaid: boolean | undefined;
  onDepositReleased: () => void;
};

function PaymentCard({ orderId, companyId, depositRequired, depositPaid, onDepositReleased }: PaymentCardProps) {
  const [payments, setPayments] = useState<StudioPayment[]>([]);
  const [loadingPay, setLoadingPay] = useState(true);
  const [acting, setActing] = useState(false);
  const [markModal, setMarkModal] = useState(false);
  const [markTarget, setMarkTarget] = useState<StudioPayment | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [addKind, setAddKind] = useState<StudioPaymentKind>("deposit");
  const [addAmount, setAddAmount] = useState("");
  const [addDueAt, setAddDueAt] = useState("");
  const [chargeInfo, setChargeInfo] = useState<{ instructions: string; pix_code: string | null } | null>(null);
  const [chargeModal, setChargeModal] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoadingPay(true);
    try {
      const res = await studioApi.listOrderPayments(companyId, orderId);
      setPayments(res.payments || []);
    } catch { setPayments([]); }
    finally { setLoadingPay(false); }
  }, [companyId, orderId]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const hasDeposit = (depositRequired ?? 0) > 0;
  const showCard = hasDeposit || payments.length > 0;
  if (!showCard) return null;

  const handleMarkPaid = async () => {
    if (!markTarget) return;
    setActing(true);
    try {
      const res = await studioApi.markPaymentPaid(companyId, markTarget.id, { method: "pix" });
      setMarkModal(false);
      setMarkTarget(null);
      await loadPayments();
      if (res.deposit_released) onDepositReleased();
    } catch { Alert.alert("Erro", "Não foi possível confirmar o pagamento."); }
    finally { setActing(false); }
  };

  const handleChargeLink = async (payment: StudioPayment) => {
    setActing(true);
    try {
      const res = await studioApi.createChargeLink(companyId, payment.id);
      setChargeInfo({ instructions: (res as any).instructions || "", pix_code: res.pix_code });
      setChargeModal(true);
    } catch { Alert.alert("Erro", "Não foi possível gerar informações de cobrança."); }
    finally { setActing(false); }
  };

  const handleAddMarco = async () => {
    const amt = parseFloat(addAmount.replace(",", "."));
    if (!amt || amt <= 0) { Alert.alert("Valor inválido", "Informe um valor maior que zero."); return; }
    setActing(true);
    try {
      await studioApi.createOrderPayment(companyId, orderId, { kind: addKind, amount: amt, due_at: addDueAt || null, method: undefined });
      setAddModal(false);
      setAddAmount(""); setAddDueAt(""); setAddKind("deposit");
      await loadPayments();
    } catch { Alert.alert("Erro", "Não foi possível criar o marco de pagamento."); }
    finally { setActing(false); }
  };

  const kindLabel: Record<StudioPaymentKind, string> = { deposit: "Sinal", balance: "Saldo", full: "Total" };
  const statusPillStyle = (status: StudioPayment["status"]) => {
    if (status === "paid")      return { bg: "#DCFCE7", fg: "#16A34A" };
    if (status === "cancelled") return { bg: "#F1F5F9", fg: "#64748B" };
    return { bg: "#FEF3C7", fg: "#D97706" };
  };

  return (
    <View style={[ps.section]}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <Text style={ps.eyebrow}>PAGAMENTOS</Text>
        {hasDeposit && (
          <View style={[ps.pill, depositPaid ? { backgroundColor: "#DCFCE7" } : { backgroundColor: "#FEF3C7" }]}>
            <Text style={[ps.pillTxt, depositPaid ? { color: "#16A34A" } : { color: "#D97706" }]}>
              {depositPaid ? "✓ Sinal recebido — produção liberada" : `⚠ Sinal pendente — R$ ${Number(depositRequired).toFixed(2)}`}
            </Text>
          </View>
        )}
      </View>

      {loadingPay ? <ActivityIndicator size="small" color={StudioColors.primary} /> : (
        <>
          {payments.map((p) => {
            const col = statusPillStyle(p.status);
            return (
              <View key={p.id} style={ps.payRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={ps.payLabel}>{kindLabel[p.kind as StudioPaymentKind] || p.kind}</Text>
                    <Text style={ps.payAmount}>R$ {Number(p.amount).toFixed(2)}</Text>
                    <View style={[ps.pill, { backgroundColor: col.bg }]}>
                      <Text style={[ps.pillTxt, { color: col.fg }]}>
                        {p.status === "paid" ? "Pago" : p.status === "cancelled" ? "Cancelado" : "Pendente"}
                      </Text>
                    </View>
                  </View>
                  {p.due_at ? <Text style={ps.paySub}>Vence: {new Date(p.due_at).toLocaleDateString("pt-BR")}</Text> : null}
                  {p.paid_at ? <Text style={ps.paySub}>Pago em: {new Date(p.paid_at).toLocaleDateString("pt-BR")}</Text> : null}
                </View>
                {p.status === "pending" && (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable style={[ps.actionBtn, { backgroundColor: "#16A34A" }]} disabled={acting} onPress={() => { setMarkTarget(p); setMarkModal(true); }}>
                      <Text style={ps.actionBtnTxt}>Registrar Pix recebido</Text>
                    </Pressable>
                    <Pressable style={[ps.actionBtn, { backgroundColor: StudioColors.primary }]} disabled={acting} onPress={() => handleChargeLink(p)}>
                      <Text style={ps.actionBtnTxt}>Cobrar via loja</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          <Pressable style={[ps.actionBtn, { backgroundColor: StudioColors.accent, alignSelf: "flex-start", marginTop: 10 }]} onPress={() => setAddModal(true)}>
            <Text style={ps.actionBtnTxt}>+ Adicionar marco</Text>
          </Pressable>
        </>
      )}

      <Modal visible={markModal} transparent animationType="fade">
        <View style={ps.modalOverlay}><View style={ps.modalBox}>
          <Text style={ps.modalTitle}>Confirmar recebimento</Text>
          <Text style={ps.modalBody}>Marcar {markTarget ? `R$ ${Number(markTarget.amount).toFixed(2)}` : ""} como recebido via Pix?</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <Pressable style={[ps.modalBtn, { backgroundColor: "#F1F5F9" }]} onPress={() => { setMarkModal(false); setMarkTarget(null); }}><Text style={{ color: "#374151", fontWeight: "600" }}>Cancelar</Text></Pressable>
            <Pressable style={[ps.modalBtn, { backgroundColor: "#16A34A" }]} disabled={acting} onPress={handleMarkPaid}><Text style={{ color: "#fff", fontWeight: "700" }}>{acting ? "Salvando..." : "Confirmar"}</Text></Pressable>
          </View>
        </View></View>
      </Modal>

      <Modal visible={chargeModal} transparent animationType="fade">
        <View style={ps.modalOverlay}><View style={ps.modalBox}>
          <Text style={ps.modalTitle}>Informações de pagamento</Text>
          {chargeInfo?.pix_code ? <View style={ps.pixBox}><Text style={ps.pixLabel}>Chave Pix</Text><Text style={ps.pixCode}>{chargeInfo.pix_code}</Text></View> : null}
          {chargeInfo?.instructions ? <Text style={[ps.modalBody, { marginTop: 10 }]}>{chargeInfo.instructions}</Text> : null}
          <Pressable style={[ps.modalBtn, { backgroundColor: StudioColors.primary, marginTop: 16, alignSelf: "flex-end" }]} onPress={() => setChargeModal(false)}><Text style={{ color: "#fff", fontWeight: "700" }}>Fechar</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={addModal} transparent animationType="fade">
        <View style={ps.modalOverlay}><View style={ps.modalBox}>
          <Text style={ps.modalTitle}>Adicionar marco de pagamento</Text>
          <Text style={ps.inputLabel}>Tipo</Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
            {(["deposit", "balance", "full"] as StudioPaymentKind[]).map((k) => (
              <Pressable key={k} style={[ps.kindPill, addKind === k && { backgroundColor: StudioColors.primary, borderColor: StudioColors.primary }]} onPress={() => setAddKind(k)}>
                <Text style={[ps.kindPillTxt, addKind === k && { color: "#fff" }]}>{kindLabel[k]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={ps.inputLabel}>Valor (R$)</Text>
          <TextInput style={ps.input} keyboardType="decimal-pad" placeholder="0,00" value={addAmount} onChangeText={setAddAmount} />
          <Text style={ps.inputLabel}>Vencimento (opcional, AAAA-MM-DD)</Text>
          <TextInput style={ps.input} placeholder="2026-06-30" value={addDueAt} onChangeText={setAddDueAt} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <Pressable style={[ps.modalBtn, { backgroundColor: "#F1F5F9" }]} onPress={() => { setAddModal(false); setAddAmount(""); setAddDueAt(""); }}><Text style={{ color: "#374151", fontWeight: "600" }}>Cancelar</Text></Pressable>
            <Pressable style={[ps.modalBtn, { backgroundColor: StudioColors.primary }]} disabled={acting} onPress={handleAddMarco}><Text style={{ color: "#fff", fontWeight: "700" }}>{acting ? "Salvando..." : "Criar marco"}</Text></Pressable>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

// ── Tela principal ─────────────────────────────────────────────────────────────────────────────
export default function StudioOrderDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const oid = String(params?.id || "");
  const { company } = useAuthStore();

  const [data, setData] = useState<StudioOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id || !oid) return;
    setLoading(true);
    try {
      const d = await studioApi.getOrder(company.id, oid);
      setData(d);
    } catch (e) {
      console.warn("[studio order detail]", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [company?.id, oid]);

  useEffect(() => { load(); }, [load]);

  // P1: gate configurável — backend é a fonte da verdade.
  // Se require_deposit_for_production estiver ON e sinal pendente,
  // o backend retorna 409 deposit_required e doAdvance exibe Alert.
  // force: true enviado no retry quando lojista confirma.
  const doAdvance = async (next: StudioProductionStatus, force = false) => {
    if (!data || !company?.id) return;
    setActing(true);
    try {
      await studioApi.updateProductionStatus(company.id, oid, next, force || undefined);
      await load();
    } catch (e: any) {
      const errCode = e?.data?.error ?? e?.error ?? '';
      const is409 = (e?.status ?? e?.statusCode) === 409 || errCode === 'deposit_required';
      if (next === 'in_production' && is409) {
        const msg = e?.data?.message ?? 'Sinal não recebido. Iniciar produção mesmo assim?';
        Alert.alert(
          'Sinal não recebido',
          msg,
          [
            { text: 'Aguardar sinal', style: 'cancel' },
            { text: 'Iniciar mesmo assim', style: 'destructive', onPress: () => doAdvance(next, true) },
          ]
        );
      } else {
        console.warn('[advance production]', e);
      }
    } finally {
      setActing(false);
    }
  };

  const advance = () => {
    if (!data || !company?.id) return;
    const cur = data.order.studio_production_status as StudioProductionStatus | null;
    if (!cur) return;
    const next = NEXT[cur];
    if (!next) return;
    // Gate removido do FE — backend decide (P1). doAdvance trata 409.
    doAdvance(next);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: StudioColors.bg }}>
        <ActivityIndicator color={StudioColors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, padding: 24, backgroundColor: StudioColors.bg }}>
        <Text style={s.h1}>Pedido não encontrado</Text>
        <Pressable onPress={() => router.back()} style={s.linkBtn}><Text style={s.linkBtnTxt}>Voltar</Text></Pressable>
      </View>
    );
  }

  const { order, items, approvals } = data;
  const status = order.studio_production_status as StudioProductionStatus | null;
  const statusCol = status ? colorStudioStatus(status) : { bg: "#F1F5F9", fg: "#64748B" };
  const next = status ? NEXT[status] : null;
  const lastApproval = approvals?.[0] || null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: StudioColors.bg }}>
      <StudioBreadcrumb
        items={[
          { label: "Estúdio", href: "/studio" },
          { label: "Pedidos", href: "/studio/pedidos" },
          { label: `#${order.id.slice(0, 8)}` },
        ]}
      />
      <View style={s.container}>
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>{order.display_name || order.customer_name || "Pedido"}</Text>
            <Text style={s.h1Sub}>
              Criado em {new Date(order.created_at).toLocaleString("pt-BR")} · {order.item_count} item(ns) · R$ {Number(order.total_amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: statusCol.bg }]}>
            <Text style={[s.statusTxt, { color: statusCol.fg }]}>{labelStudioStatus(status)}</Text>
          </View>
        </View>

        <View style={s.actionRow}>
          {next && (
            <Pressable onPress={advance} disabled={acting} style={[s.actionBtn, { backgroundColor: StudioColors.primary }]}>
              <Icon name="arrow-right" size={16} color="#fff" />
              <Text style={s.actionBtnTxt}>Avançar pra "{labelStudioStatus(next)}"</Text>
            </Pressable>
          )}
          {status === "pending_art" && (
            <Pressable onPress={() => router.push("/studio/producao?intent=approval" as any)} style={[s.actionBtn, { backgroundColor: StudioColors.accent }]}>
              <Icon name="message-circle" size={16} color="#fff" />
              <Text style={s.actionBtnTxt}>Solicitar aprovação</Text>
            </Pressable>
          )}
          {lastApproval?.mockup_url ? (
            <Pressable onPress={() => Linking.openURL(lastApproval.mockup_url!)} style={[s.actionBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: StudioColors.ink4 }]}>
              <Icon name="image" size={16} color={StudioColors.ink2} />
              <Text style={[s.actionBtnTxt, { color: StudioColors.ink2 }]}>Ver mockup</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionEyebrow}>CLIENTE</Text>
          <Text style={s.sectionTitle}>{order.customer_name || "—"}</Text>
          {order.customer_phone ? (
            <Pressable onPress={() => Linking.openURL(`https://wa.me/${(order.customer_phone || "").replace(/\D/g, "")}`)} style={s.linkRow}>
              <Icon name="message-circle" size={14} color={StudioColors.primary} />
              <Text style={s.link}>{order.customer_phone}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionEyebrow}>ITENS DO PEDIDO</Text>
          {items.map((it) => (
            <View key={it.id} style={s.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{it.product_name}</Text>
                <Text style={s.itemSub}>{it.quantity} × R$ {Number(it.unit_price || 0).toFixed(2)}</Text>
                {it.customization ? (
                  <View style={s.custBox}>
                    <Text style={s.custTitle}>Personalização</Text>
                    <Text style={s.custBody}>{safeJson(it.customization)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {approvals?.length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>HISTÓRICO DE APROVAÇÃO</Text>
            {approvals.map((a) => {
              const col = colorStudioStatus(a.status);
              return (
                <View key={a.id} style={s.approvalRow}>
                  <View style={[s.approvalDot, { backgroundColor: col.fg }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.approvalTitle}>{labelStudioStatus(a.status)}</Text>
                    <Text style={s.approvalSub}>
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                      {a.response_note ? ` · "${a.response_note}"` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {company?.id ? (
          <PaymentCard
            orderId={oid}
            companyId={company.id}
            depositRequired={order.deposit_required}
            depositPaid={order.deposit_paid}
            onDepositReleased={load}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function safeJson(v: any): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

const s = StyleSheet.create({
  container: { padding: 22, maxWidth: 980, alignSelf: "center", width: "100%" },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: "800", color: StudioColors.ink },
  h1Sub: { fontSize: 12, color: StudioColors.ink3, marginTop: 4 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusTxt: { fontWeight: "800", fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 18 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  actionBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  section: { backgroundColor: StudioColors.paperCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: StudioColors.ink5, marginBottom: 14 },
  sectionEyebrow: { fontSize: 10, fontWeight: "800", color: StudioColors.ink3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: StudioColors.ink },
  itemCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: StudioColors.ink5 },
  itemTitle: { fontWeight: "700", color: StudioColors.ink, fontSize: 13 },
  itemSub: { color: StudioColors.ink3, fontSize: 12, marginTop: 2 },
  custBox: { marginTop: 8, padding: 10, backgroundColor: StudioColors.bg, borderRadius: 10, borderWidth: 1, borderColor: StudioColors.ink5 },
  custTitle: { fontSize: 10, fontWeight: "800", color: StudioColors.ink3, letterSpacing: 0.6 },
  custBody: { fontSize: 11, color: StudioColors.ink2, marginTop: 4, fontFamily: "monospace" },
  approvalRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: StudioColors.ink5 },
  approvalDot: { width: 8, height: 8, borderRadius: 4 },
  approvalTitle: { fontWeight: "700", color: StudioColors.ink, fontSize: 13 },
  approvalSub: { color: StudioColors.ink3, fontSize: 11, marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  link: { color: StudioColors.primary, fontWeight: "600", fontSize: 12 },
  linkBtn: { marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: StudioColors.primary },
  linkBtnTxt: { color: "#fff", fontWeight: "700" },
});

const ps = StyleSheet.create({
  section: { backgroundColor: StudioColors.paperCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: StudioColors.ink5, marginBottom: 14 },
  eyebrow: { fontSize: 10, fontWeight: "800", color: StudioColors.ink3, letterSpacing: 0.8, textTransform: "uppercase" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillTxt: { fontSize: 11, fontWeight: "700" },
  payRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: StudioColors.ink5, flexWrap: "wrap" },
  payLabel: { fontWeight: "700", color: StudioColors.ink, fontSize: 13 },
  payAmount: { color: StudioColors.ink2, fontSize: 13 },
  paySub: { color: StudioColors.ink3, fontSize: 11, marginTop: 2 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 420 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: StudioColors.ink, marginBottom: 8 },
  modalBody: { fontSize: 13, color: StudioColors.ink2, lineHeight: 20 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  pixBox: { backgroundColor: StudioColors.bg, borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: StudioColors.ink5 },
  pixLabel: { fontSize: 10, fontWeight: "800", color: StudioColors.ink3, letterSpacing: 0.6 },
  pixCode: { fontSize: 15, fontWeight: "700", color: StudioColors.primary, marginTop: 4 },
  inputLabel: { fontSize: 11, fontWeight: "700", color: StudioColors.ink3, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: StudioColors.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: StudioColors.ink, backgroundColor: StudioColors.bg },
  kindPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: StudioColors.ink4, backgroundColor: "#fff" },
  kindPillTxt: { fontWeight: "700", fontSize: 12, color: StudioColors.ink2 },
});
