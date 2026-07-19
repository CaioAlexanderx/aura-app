// ============================================================
// ChargeActionModal — Confirmar pagamento / Cancelar cobrança (F3a)
//
// Um modal só para as duas ações "de risco baixo" da linha de cobrança,
// alternando por `mode`. Confirmação inline dentro do próprio modal
// (mesmo padrão do resto do dojô — sem ConfirmHost global no grupo).
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import {
  karateDojoBillingApi, DojoCharge, DojoChargePaymentMethod,
} from "@/services/karateDojoBillingApi";
import { PAYMENT_METHOD_LABEL, fmtBRL, fmtDateBR, mapBillingError } from "./helpers";

const METHODS: DojoChargePaymentMethod[] = ["pix", "dinheiro", "cartao", "outro"];

interface Props {
  visible: boolean;
  mode: "confirm" | "cancel";
  federationId: string;
  charge: DojoCharge | null;
  onClose: () => void;
  onDone: () => void;
}

export function ChargeActionModal({ visible, mode, federationId, charge, onClose, onDone }: Props) {
  const [method, setMethod] = useState<DojoChargePaymentMethod>("pix");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!charge) return null;

  const close = () => {
    setErr(null);
    setBusy(false);
    onClose();
  };

  const confirmPayment = async () => {
    setBusy(true);
    setErr(null);
    try {
      await karateDojoBillingApi.confirmCharge(federationId, charge.id, { method });
      onDone();
      close();
    } catch (e: any) {
      setErr(mapBillingError(e).message);
      setBusy(false);
    }
  };

  const cancelCharge = async () => {
    setBusy(true);
    setErr(null);
    try {
      await karateDojoBillingApi.cancelCharge(federationId, charge.id);
      onDone();
      close();
    } catch (e: any) {
      setErr(mapBillingError(e).message);
      setBusy(false);
    }
  };

  const isConfirm = mode === "confirm";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={s.card}>
          <View style={s.head}>
            <Text style={s.title}>{isConfirm ? "Confirmar pagamento" : "Cancelar cobrança"}</Text>
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <View style={s.infoBox}>
              <Text style={s.infoNome}>{charge.student.full_name}</Text>
              <Text style={s.infoMeta}>{fmtBRL(charge.amount)} · vencimento {fmtDateBR(charge.due_date)}</Text>
            </View>

            {isConfirm ? (
              <>
                <Text style={s.lbl}>Forma de pagamento</Text>
                <View style={s.chips}>
                  {METHODS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[s.chip, method === m && s.chipOn]}
                      onPress={() => setMethod(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: method === m }}
                    >
                      <Text style={[s.chipTxt, method === m && s.chipTxtOn]}>{PAYMENT_METHOD_LABEL[m]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <Text style={s.confirmTxt}>
                Cancelar a cobrança de {fmtBRL(charge.amount)} de {charge.student.full_name}? A cobrança some da lista pendente/vencida
                e não pode ser paga depois — se for só um engano, dá pra gerar de novo no próximo "Gerar cobranças do mês".
              </Text>
            )}

            {!!err && <Text style={s.err}>{err}</Text>}

            <View style={s.actions}>
              <KarateButton label="Voltar" variant="ghost" size="sm" onPress={close} style={{ flex: 1 }} />
              {isConfirm ? (
                <KarateButton label="Confirmar pagamento" variant="sumi" size="sm" onPress={confirmPayment} loading={busy} style={{ flex: 2 }} />
              ) : (
                <KarateButton label="Cancelar cobrança" variant="primary" size="sm" onPress={cancelCharge} loading={busy} style={{ flex: 2 }} />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 440, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  title: { fontSize: 15.5, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  infoBox: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  infoNome: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  infoMeta: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  lbl: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  confirmTxt: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  err: { fontSize: 12.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  actions: { flexDirection: "row", gap: 8, marginTop: 4 } as ViewStyle,
});
