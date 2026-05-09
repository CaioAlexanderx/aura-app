// ============================================================
// ConsultaCheckoutModal — Checkout pós-consulta
// #12 (2026-05-09): registrar pagamento + emitir NFC-e opcional.
// Exibido após ConsultaEndModal confirmar encerramento.
// ============================================================
import { useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Platform,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";
import { Icon } from "@/components/Icon";

interface Props {
  open: boolean;
  appointmentId: string;
  patientId: string | null;
  patientName?: string;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { key: "pix",            label: "Pix",        icon: "💠" },
  { key: "dinheiro",       label: "Dinheiro",   icon: "💵" },
  { key: "cartao_credito", label: "Crédito",    icon: "💳" },
  { key: "cartao_debito",  label: "Débito",     icon: "💳" },
  { key: "crediario",      label: "Crediário",  icon: "📋" },
];

export function ConsultaCheckoutModal({ open, appointmentId, patientId, patientName, onClose }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(false);
  const [nfceStatus, setNfceStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [nfceUrl, setNfceUrl] = useState<string | null>(null);

  const webBlur = Platform.OS === "web"
    ? { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } as any
    : {};

  const payMut = useMutation({
    mutationFn: () =>
      request(`/companies/${cid}/dental/appointments/${appointmentId}`, {
        method: "PATCH",
        body: {
          payment_method: paymentMethod,
          payment_amount: parseFloat(amount.replace(",", ".")) || null,
          payment_status: "paid",
          payment_notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-appt", cid, appointmentId] });
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
      setPaid(true);
      toast.success("Pagamento registrado!");
    },
    onError: (e: any) => {
      toast.error(e?.data?.error || "Erro ao registrar pagamento");
    },
  });

  async function handleNfce() {
    if (!cid) return;
    setNfceStatus("loading");
    try {
      const resp = await request<any>(`/companies/${cid}/nfce/emit`, {
        method: "POST",
        body: {
          appointment_id: appointmentId,
          patient_id: patientId,
          payment_method: paymentMethod,
          total_amount: parseFloat(amount.replace(",", ".")) || 0,
        },
      });
      setNfceUrl((resp as any)?.nfce_url || (resp as any)?.danfe_url || null);
      setNfceStatus("done");
      toast.success("NFC-e emitida com sucesso!");
    } catch (e: any) {
      setNfceStatus("error");
      toast.error(e?.data?.error || "Erro ao emitir NFC-e");
    }
  }

  function handleClose() {
    setPaymentMethod("pix");
    setAmount("");
    setNotes("");
    setPaid(false);
    setNfceStatus("idle");
    setNfceUrl(null);
    onClose();
  }

  const methodLabel = PAYMENT_METHODS.find(m => m.key === paymentMethod)?.label || "";

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={[s.backdrop, webBlur]}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.headerEmoji}>💰</Text>
              <View>
                <Text style={s.title}>Checkout</Text>
                {patientName ? <Text style={s.subtitle}>{patientName}</Text> : null}
              </View>
            </View>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Icon name="close" size={20} color={DentalColors.ink3} />
            </Pressable>
          </View>

          {!paid ? (
            /* ── PAYMENT FORM ── */
            <>
              <View style={s.body}>
                <Text style={s.sectionLabel}>FORMA DE PAGAMENTO</Text>
                <View style={s.methodGrid}>
                  {PAYMENT_METHODS.map(m => (
                    <Pressable
                      key={m.key}
                      onPress={() => setPaymentMethod(m.key)}
                      style={[s.methodBtn, paymentMethod === m.key && s.methodBtnActive]}
                    >
                      <Text style={s.methodIcon}>{m.icon}</Text>
                      <Text style={[s.methodLabel, paymentMethod === m.key && s.methodLabelActive]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[s.sectionLabel, { marginTop: 18 }]}>VALOR (R$)</Text>
                <View style={s.amountRow}>
                  <Text style={s.amountPrefix}>R$</Text>
                  <TextInput
                    style={s.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0,00"
                    placeholderTextColor={DentalColors.ink3}
                    keyboardType="decimal-pad"
                  />
                </View>

                <Text style={[s.sectionLabel, { marginTop: 18 }]}>OBSERVAÇÕES</Text>
                <TextInput
                  style={s.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Observações sobre o pagamento..."
                  placeholderTextColor={DentalColors.ink3}
                  multiline
                />
              </View>

              <View style={s.footer}>
                <Pressable onPress={handleClose} style={[s.btn, s.btnGhost]}>
                  <Text style={s.btnGhostText}>Pular</Text>
                </Pressable>
                <Pressable
                  onPress={() => payMut.mutate()}
                  style={[s.btn, s.btnCyan, payMut.isPending && { opacity: 0.6 }]}
                  disabled={payMut.isPending}
                >
                  {payMut.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnCyanText}>Registrar pagamento</Text>}
                </Pressable>
              </View>
            </>
          ) : (
            /* ── POST-PAYMENT: NFC-e ── */
            <View style={s.body}>
              <View style={s.successBanner}>
                <Text style={s.successIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.successTitle}>Pagamento registrado!</Text>
                  <Text style={s.successSub}>
                    {methodLabel}{amount ? ` · R$ ${amount}` : ""}
                  </Text>
                </View>
              </View>

              <Text style={[s.sectionLabel, { marginTop: 20 }]}>NOTA FISCAL</Text>
              <Text style={s.nfceHint}>Emita a NFC-e como comprovante fiscal para o paciente.</Text>

              {nfceStatus === "idle" && (
                <Pressable onPress={handleNfce} style={s.nfceBtn}>
                  <Text style={s.nfceBtnIcon}>🧾</Text>
                  <Text style={s.nfceBtnText}>Emitir NFC-e</Text>
                </Pressable>
              )}
              {nfceStatus === "loading" && (
                <View style={s.nfceLoading}>
                  <ActivityIndicator color={DentalColors.cyan} size="small" />
                  <Text style={s.nfceLoadingText}>Emitindo NFC-e...</Text>
                </View>
              )}
              {nfceStatus === "done" && (
                <View style={s.nfceDone}>
                  <Text style={s.nfceDoneText}>✅ NFC-e emitida com sucesso!</Text>
                  {nfceUrl ? <Text style={s.nfceLink} numberOfLines={2}>{nfceUrl}</Text> : null}
                </View>
              )}
              {nfceStatus === "error" && (
                <View style={s.nfceError}>
                  <Text style={s.nfceErrorText}>⚠️ Falha ao emitir. Verifique as configurações NFC-e.</Text>
                  <Pressable onPress={handleNfce} style={s.nfceRetryBtn}>
                    <Text style={s.nfceRetryText}>Tentar novamente</Text>
                  </Pressable>
                </View>
              )}

              <Pressable onPress={handleClose} style={[s.btn, s.btnGreen, { marginTop: 24 }]}>
                <Text style={s.btnGreenText}>Concluir atendimento</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:         { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", justifyContent: "center", alignItems: "center", padding: 20 },
  sheet:            { backgroundColor: DentalColors.bg, borderRadius: 20, width: "100%", maxWidth: 460, borderWidth: 1, borderColor: DentalColors.border } as any,
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: DentalColors.border },
  headerLeft:       { flexDirection: "row", alignItems: "center", gap: 10 },
  headerEmoji:      { fontSize: 24 },
  title:            { fontSize: 17, fontWeight: "700", color: DentalColors.ink },
  subtitle:         { fontSize: 11, color: DentalColors.ink3, marginTop: 1 },
  body:             { padding: 18 },
  sectionLabel:     { fontSize: 10, fontWeight: "700", color: DentalColors.cyan, letterSpacing: 1, marginBottom: 8 },
  methodGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodBtn:        { flex: 1, minWidth: 64, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, borderColor: DentalColors.border, backgroundColor: DentalColors.bg2, gap: 4 },
  methodBtnActive:  { borderColor: DentalColors.cyan, backgroundColor: "rgba(6,182,212,0.1)" },
  methodIcon:       { fontSize: 18 },
  methodLabel:      { fontSize: 10, color: DentalColors.ink3, fontWeight: "600", textAlign: "center" as any },
  methodLabelActive:{ color: DentalColors.cyan },
  amountRow:        { flexDirection: "row", alignItems: "center", backgroundColor: DentalColors.bg2, borderRadius: 10, borderWidth: 1, borderColor: DentalColors.border, paddingHorizontal: 14, overflow: "hidden" as any },
  amountPrefix:     { fontSize: 14, color: DentalColors.ink3, marginRight: 4 },
  amountInput:      { flex: 1, fontSize: 22, fontWeight: "700", color: DentalColors.ink, paddingVertical: 14 } as any,
  notesInput:       { backgroundColor: DentalColors.bg2, borderRadius: 10, borderWidth: 1, borderColor: DentalColors.border, padding: 12, fontSize: 13, color: DentalColors.ink, minHeight: 60, textAlignVertical: "top" as any } as any,
  footer:           { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: DentalColors.border },
  btn:              { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnGhost:         { backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border },
  btnGhostText:     { color: DentalColors.ink3, fontSize: 13, fontWeight: "600" },
  btnCyan:          { backgroundColor: DentalColors.cyan },
  btnCyanText:      { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnGreen:         { backgroundColor: DentalColors.green, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnGreenText:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  successBanner:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" },
  successIcon:      { fontSize: 28 },
  successTitle:     { fontSize: 15, fontWeight: "700", color: DentalColors.ink },
  successSub:       { fontSize: 12, color: DentalColors.ink3, marginTop: 2 },
  nfceHint:         { fontSize: 12, color: DentalColors.ink3, marginBottom: 12 },
  nfceBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(6,182,212,0.08)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(6,182,212,0.3)" },
  nfceBtnIcon:      { fontSize: 20 },
  nfceBtnText:      { fontSize: 14, fontWeight: "700", color: DentalColors.cyan },
  nfceLoading:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  nfceLoadingText:  { fontSize: 13, color: DentalColors.ink3 },
  nfceDone:         { backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 10, padding: 12, gap: 4 },
  nfceDoneText:     { fontSize: 13, color: DentalColors.green, fontWeight: "600" },
  nfceLink:         { fontSize: 10, color: DentalColors.ink3, marginTop: 2 },
  nfceError:        { backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 10, padding: 12, gap: 8 },
  nfceErrorText:    { fontSize: 12, color: "#EF4444" },
  nfceRetryBtn:     { alignSelf: "flex-start" as any, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#EF4444" },
  nfceRetryText:    { fontSize: 11, color: "#EF4444", fontWeight: "600" },
});

export default ConsultaCheckoutModal;
