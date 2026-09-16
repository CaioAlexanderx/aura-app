// ============================================================
// ReceberPagamentoModal — Aura · Clientes (I0.5)
//
// Substitui o window.prompt/window.confirm que "Receber pagamento"
// usava na linha expandida do cliente. Mesma chamada de API de antes
// (creditApi.receivePayment) — só a UI virou modal de verdade:
//   - valor em R$ com máscara de moeda (maskCurrency/unmaskNumber,
//     utils/masks.ts — mesmo padrão centavos-first do resto do app)
//   - forma de pagamento (PAYMENT_METHODS do crediário — dinheiro/pix/cartão)
//   - se o valor recebido for maior que o saldo em aberto, pede uma
//     segunda confirmação via ConfirmGate (padrão único de confirmação
//     sensível do repo) em vez do window.confirm nativo
//
// Segue o DNA visual ResponsiveSheet (header fixo → conteúdo → rodapé
// fixo com CTA), como DevolucaoModal.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { ConfirmGate } from "@/components/ConfirmGate";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { creditApi } from "@/services/creditApi";
import { PAYMENT_METHODS } from "@/components/crediario/ficha/fichaHelpers";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { fmt } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  companyId: string;
  customerId: string;
  customerName: string;
  balance: number;
  onSuccess: (newBalance: number) => void;
};

export function ReceberPagamentoModal({
  visible, onClose, companyId, customerId, customerName, balance, onSuccess,
}: Props) {
  const [amountMasked, setAmountMasked] = useState("0,00");
  const [method, setMethod] = useState("dinheiro");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOverpay, setConfirmOverpay] = useState(false);

  // Reseta o formulário sempre que o modal reabre pra um novo cliente/valor.
  useEffect(() => {
    if (visible) {
      setAmountMasked(balance > 0 ? maskCurrency(String(Math.round(balance * 100))) : "0,00");
      setMethod("dinheiro");
      setError(null);
      setConfirmOverpay(false);
    }
  }, [visible, balance]);

  const amount = (parseInt(unmaskNumber(amountMasked) || "0", 10) || 0) / 100;
  const amountValid = amount > 0;
  const isOverpay = amount > balance + 0.01;

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await creditApi.receivePayment(companyId, customerId, {
        amount,
        payment_method: method,
      });
      onSuccess(res.new_balance);
      handleClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao registrar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  function handleConfirmPress() {
    if (!amountValid) {
      setError("Informe um valor válido.");
      return;
    }
    setError(null);
    if (isOverpay && !confirmOverpay) {
      setConfirmOverpay(true);
      return;
    }
    submit();
  }

  return (
    <ResponsiveSheet visible={visible} onClose={handleClose} maxWidth={420}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Receber pagamento</Text>
          <Text style={s.subtitle} numberOfLines={1}>{customerName}</Text>
        </View>
        <Pressable onPress={handleClose} style={s.closeBtn} disabled={submitting} testID="receber-pagamento-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      <View style={s.body}>
        <Text style={s.balanceLabel}>Saldo em aberto</Text>
        <Text style={s.balanceValue}>{fmt(balance)}</Text>

        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Quanto recebeu?</Text>
        <View style={s.amountBox}>
          <Text style={s.amountPrefix}>R$</Text>
          <TextInput
            style={s.amountInput}
            value={amountMasked}
            onChangeText={(v) => {
              setAmountMasked(maskCurrency(v));
              setError(null);
              setConfirmOverpay(false);
            }}
            keyboardType="number-pad"
            placeholder="0,00"
            placeholderTextColor={Colors.ink3}
            testID="receber-pagamento-input"
          />
        </View>

        <Text style={[s.fieldLabel, { marginTop: 14 }]}>Forma</Text>
        <View style={s.methods}>
          {PAYMENT_METHODS.map((pm) => (
            <Pressable
              key={pm.key}
              style={[s.method, method === pm.key && s.methodActive]}
              onPress={() => setMethod(pm.key)}
              testID={`receber-pagamento-metodo-${pm.key}`}
            >
              <Text style={[s.methodTxt, method === pm.key && s.methodTxtActive]}>{pm.label}</Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={s.error} testID="receber-pagamento-erro">{error}</Text>}

        <ConfirmGate
          visible={confirmOverpay}
          message={
            `O valor recebido (${fmt(amount)}) é maior que o saldo em aberto (${fmt(balance)}). ` +
            `Isso vai gerar crédito a favor do cliente. Confirmar assim mesmo?`
          }
          confirmLabel="Sim, confirmar"
          onConfirm={submit}
          onCancel={() => setConfirmOverpay(false)}
          loading={submitting}
        />

        <View style={s.actions}>
          <Button title="Cancelar" variant="ghost" onPress={handleClose} disabled={submitting} full />
          <Button
            title={submitting ? "Registrando..." : "Confirmar"}
            variant="success"
            onPress={handleConfirmPress}
            loading={submitting}
            disabled={!amountValid}
            full
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  body: { padding: 18 },
  balanceLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  balanceValue: { fontSize: 20, fontWeight: "700", color: "#f97316", marginTop: 2 },
  fieldLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, letterSpacing: 0.3 },
  amountBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14,
  },
  amountPrefix: { fontSize: 15, color: Colors.ink3, fontWeight: "600", marginRight: 6 },
  amountInput: { flex: 1, fontSize: 18, color: Colors.ink, fontWeight: "700", paddingVertical: 12 },
  methods: { flexDirection: "row", gap: 8 },
  method: { flex: 1, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, alignItems: "center" },
  methodActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  methodTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  methodTxtActive: { color: "#fff" },
  error: { fontSize: 12, color: Colors.red, marginTop: 10, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginTop: 18 },
});

export default ReceberPagamentoModal;
