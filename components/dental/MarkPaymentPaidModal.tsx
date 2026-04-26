import { useState } from "react";
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";
import { invalidateDentalFinancials } from "@/lib/dentalQueryHelpers";

// ============================================================
// MarkPaymentPaidModal — marca uma parcela dental como recebida.
//
// Chamado pelo BillingDashboard quando o usuario clica "Receber"
// em uma parcela vencida. Backend (POST /billing/payments/:pid/pay)
// dispara trigger 068 que cria transaction (income, receita_clinica)
// automaticamente.
//
// Sem confirmacao via dialog adicional — modal proprio ja serve de
// confirmacao e captura o metodo de pagamento.
// ============================================================

type PaymentMethod = "pix" | "dinheiro" | "cartao_credito" | "cartao_debito" | "boleto" | "transferencia";

const METHODS: ReadonlyArray<{ value: PaymentMethod; label: string; icon: string }> = [
  { value: "pix",             label: "PIX",             icon: "dollar" },
  { value: "dinheiro",        label: "Dinheiro",        icon: "wallet" },
  { value: "cartao_credito",  label: "Cartão Crédito", icon: "tag" },
  { value: "cartao_debito",   label: "Cartão Débito",  icon: "tag" },
  { value: "boleto",          label: "Boleto",          icon: "barcode" },
  { value: "transferencia",   label: "Transferência",       icon: "refresh" },
];

function fmtBRL(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface PendingPayment {
  payment_id: string;
  patient_name: string;
  amount: number | string;
}

interface Props {
  payment: PendingPayment | null;
  onClose: () => void;
}

export function MarkPaymentPaidModal({ payment, onClose }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      request(
        `/companies/${cid}/dental/billing/payments/${payment!.payment_id}/pay`,
        {
          method: "POST",
          body: {
            method: method || undefined,
            notes: notes.trim() || undefined,
          },
          retry: 0,
        }
      ),
    onSuccess: () => {
      // Invalida tudo: queries dentais E queries financeiras genericas.
      // Trigger 068 ja criou a transaction — invalidateDentalFinancials
      // garante que /financeiro mostra ela imediatamente.
      qc.invalidateQueries({ queryKey: ["dental-billing-dash"] });
      qc.invalidateQueries({ queryKey: ["dental-billing-overdue"] });
      qc.invalidateQueries({ queryKey: ["dental-billing-patient"] });
      invalidateDentalFinancials(qc);
      toast.success("Recebimento registrado");
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err?.data?.error || err?.message || "Erro ao registrar pagamento");
    },
  });

  function handleClose() {
    setMethod(null);
    setNotes("");
    onClose();
  }

  if (!payment) return null;

  const amount = typeof payment.amount === "string" ? parseFloat(payment.amount) : payment.amount;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={handleClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <View style={{
          width: "100%", maxWidth: 440,
          backgroundColor: DentalColors.bg2,
          borderRadius: 16, padding: 22,
          borderWidth: 1, borderColor: DentalColors.border,
        }}>
          {/* Header com valor em destaque */}
          <View style={{ marginBottom: 18 }}>
            <Text style={{
              fontSize: 9, color: DentalColors.cyan, fontWeight: "700",
              letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
              fontFamily: "JetBrains Mono, monospace" as any,
            }}>RECEBIMENTO DE PARCELA</Text>
            <Text style={{
              fontSize: 32, fontWeight: "800", color: DentalColors.ink,
              letterSpacing: -0.5, marginBottom: 6,
            }}>{fmtBRL(amount)}</Text>
            <Text style={{ fontSize: 13, color: DentalColors.ink2 }}>
              de <Text style={{ fontWeight: "600", color: DentalColors.ink }}>{payment.patient_name}</Text>
            </Text>
          </View>

          {/* Metodo de pagamento (chips) */}
          <Text style={{
            fontSize: 10, color: DentalColors.ink3, fontWeight: "700",
            letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8,
          }}>Como foi recebido?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {METHODS.map((m) => {
              const selected = method === m.value;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMethod(m.value)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: 999, borderWidth: 1,
                    borderColor: selected ? DentalColors.cyanBorder : DentalColors.border,
                    backgroundColor: selected ? DentalColors.cyanDim : "transparent",
                  }}
                >
                  <Icon name={m.icon as any} size={12} color={selected ? DentalColors.cyan : DentalColors.ink3} />
                  <Text style={{
                    fontSize: 12, fontWeight: "600",
                    color: selected ? DentalColors.cyan : DentalColors.ink2,
                  }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Observacoes opcionais */}
          <Text style={{
            fontSize: 10, color: DentalColors.ink3, fontWeight: "700",
            letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6,
          }}>Observações (opcional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: Pagamento via PIX recebido na conta da clínica"
            placeholderTextColor={DentalColors.ink3}
            multiline
            numberOfLines={2}
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 10, padding: 10,
              fontSize: 12, color: DentalColors.ink,
              borderWidth: 1, borderColor: DentalColors.border,
              marginBottom: 18,
              minHeight: 56, textAlignVertical: "top" as any,
            }}
          />

          {/* Acoes */}
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Pressable
              onPress={handleClose}
              disabled={mut.isPending}
              style={{
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border,
              }}
            >
              <Text style={{ fontSize: 12, color: DentalColors.ink2, fontWeight: "500" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => mut.mutate()}
              disabled={mut.isPending}
              style={{
                paddingHorizontal: 18, paddingVertical: 10,
                borderRadius: 8, backgroundColor: DentalColors.cyan,
                opacity: mut.isPending ? 0.6 : 1,
                flexDirection: "row", alignItems: "center", gap: 6,
                minWidth: 180, justifyContent: "center",
              }}
            >
              {mut.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={13} color="#fff" />
                  <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>
                    Confirmar recebimento
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default MarkPaymentPaidModal;
