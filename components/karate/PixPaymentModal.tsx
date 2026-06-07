// ============================================================
// PixPaymentModal (DESIGN-07) — Aura Karatê
//
// Fluxo:
//   1. Cria intent PIX via karateApi.createPixIntent()
//   2. Exibe QR gerado do `payload` (client-side) + copia-e-cola
//   3. Faz polling do status a cada ~3s até `paid` | `expired`
//   4. Estado de sucesso quando paid
//   5. Admins veem botão "Confirmar pagamento" (manual)
//
// Props:
//   federationId, amount, description — para criar o intent
//   onSuccess(result) — callback ao confirmar pagamento
//   onClose — fecha o modal
//   isAdmin — exibe ação de confirmação manual
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Clipboard,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { PixQRCode } from "@/components/karate/PixQRCode";
import {
  karateApi,
  PixIntent,
  PixStatusResponse,
} from "@/services/karateApi";

// ── MOCK (shape fiel ao contrato) ────────────────────────────
// TODO: remover quando /financial/pix/intent estiver ativo
const MOCK_INTENT: PixIntent = {
  intent_id: "mock-intent-001",
  payload:
    "00020126580014br.gov.bcb.pix0136aura-karate-mock-key@federacao.org.br5204000053039865802BR5915Federacao Karate6009Sao Paulo62140510mock000016304ABCD",
  amount: 0,
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  status: "pending",
};

type ModalState =
  | { phase: "creating" }
  | { phase: "waiting"; intent: PixIntent }
  | { phase: "paid"; intent: PixIntent }
  | { phase: "error"; message: string };

const POLLING_INTERVAL_MS = 3000;

interface PixPaymentModalProps {
  visible: boolean;
  federationId: string;
  amount: number;
  description?: string;
  isAdmin?: boolean;
  onSuccess: (intentId: string) => void;
  onClose: () => void;
}

export function PixPaymentModal({
  visible,
  federationId,
  amount,
  description,
  isAdmin = false,
  onSuccess,
  onClose,
}: PixPaymentModalProps) {
  const [state, setState] = useState<ModalState>({ phase: "creating" });
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handlePaid = useCallback(
    (intent: PixIntent) => {
      stopPolling();
      setState({ phase: "paid", intent });
      onSuccess(intent.intent_id);
    },
    [stopPolling, onSuccess]
  );

  const startPolling = useCallback(
    (intent: PixIntent) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          // MOCK: nunca retorna paid automaticamente — aguarda ação manual
          // TODO: remover fallback quando backend PIX estiver ativo
          let res: PixStatusResponse;
          try {
            res = await karateApi.getPixStatus(federationId, intent.intent_id);
          } catch {
            // MOCK fallback: mantém pending
            return;
          }
          if (res.status === "paid") {
            handlePaid(intent);
          } else if (res.status === "expired" || res.status === "error") {
            stopPolling();
            setState({ phase: "error", message: "PIX expirado ou com erro. Tente novamente." });
          }
        } catch {
          // rede: ignora e tenta novamente na próxima iteração
        }
      }, POLLING_INTERVAL_MS);
    },
    [federationId, handlePaid, stopPolling]
  );

  const createIntent = useCallback(async () => {
    setState({ phase: "creating" });
    try {
      // TODO: remover fallback MOCK quando endpoint PIX estiver ativo
      let intent: PixIntent;
      try {
        intent = await karateApi.createPixIntent(federationId, {
          amount,
          description,
          idempotency_key: `pix-${federationId}-${Date.now()}`,
        });
      } catch {
        // MOCK fallback
        intent = { ...MOCK_INTENT, amount };
      }
      setState({ phase: "waiting", intent });
      startPolling(intent);
    } catch (e: any) {
      setState({ phase: "error", message: e?.message ?? "Erro ao criar cobrança PIX." });
    }
  }, [federationId, amount, description, startPolling]);

  // Criar intent ao abrir
  useEffect(() => {
    if (visible) {
      createIntent();
    } else {
      stopPolling();
      setState({ phase: "creating" });
      setCopied(false);
    }
    return () => stopPolling();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = useCallback(() => {
    if (state.phase !== "waiting") return;
    const payload = state.intent.payload;
    if (Platform.OS === "web") {
      navigator.clipboard?.writeText(payload).catch(() => {});
    } else {
      Clipboard.setString(payload);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [state]);

  const handleManualConfirm = useCallback(async () => {
    if (state.phase !== "waiting") return;
    setConfirming(true);
    try {
      // TODO: remover fallback MOCK quando endpoint confirm estiver ativo
      try {
        await karateApi.confirmPixManual(federationId, state.intent.intent_id);
      } catch {
        // MOCK: aceita confirmar mesmo sem backend
      }
      handlePaid(state.intent);
    } catch (e: any) {
      setState({ phase: "error", message: e?.message ?? "Erro ao confirmar pagamento." });
    } finally {
      setConfirming(false);
    }
  }, [federationId, handlePaid, state]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pagamento PIX</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Creating */}
            {state.phase === "creating" && (
              <View style={styles.centeredSection}>
                <ActivityIndicator size="large" color={KarateColors.primary} />
                <Text style={styles.loadingText}>Gerando cobrança PIX…</Text>
              </View>
            )}

            {/* Waiting for payment */}
            {state.phase === "waiting" && (
              <>
                {/* Valor */}
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Valor</Text>
                  <Text style={styles.amountValue}>{formatCurrency(state.intent.amount)}</Text>
                </View>

                {/* QR Code */}
                <PixQRCode
                  payload={state.intent.payload}
                  qrImage={state.intent.qr_image}
                  size={200}
                  style={{ marginVertical: 16 }}
                />

                {/* Polling indicator */}
                <View style={styles.pollingRow}>
                  <ActivityIndicator size="small" color={KarateColors.ink4} />
                  <Text style={styles.pollingText}>Aguardando pagamento…</Text>
                </View>

                {/* Copia-e-cola */}
                <TouchableOpacity
                  style={[styles.copyBtn, copied && styles.copyBtnDone]}
                  onPress={handleCopy}
                  accessibilityRole="button"
                  accessibilityLabel={copied ? "Código copiado" : "Copiar código PIX"}
                >
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={16}
                    color={copied ? ShojiPalette.ok : KarateColors.primary}
                  />
                  <Text style={[styles.copyBtnLabel, copied && styles.copyBtnLabelDone]}>
                    {copied ? "Código copiado!" : "Copiar código PIX"}
                  </Text>
                </TouchableOpacity>

                {/* Admin: confirmar manualmente */}
                {isAdmin && (
                  <View style={styles.adminSection}>
                    <View style={styles.adminDivider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerLabel}>ADMIN</Text>
                      <View style={styles.dividerLine} />
                    </View>
                    <KarateButton
                      label="Confirmar pagamento manualmente"
                      variant="secondary"
                      onPress={handleManualConfirm}
                      loading={confirming}
                      style={{ marginTop: 4 }}
                    />
                    <Text style={styles.adminHint}>
                      Use quando o pagamento foi confirmado fora do sistema
                      (ex.: comprovante recebido via WhatsApp).
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Paid */}
            {state.phase === "paid" && (
              <View style={styles.centeredSection}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color={ShojiPalette.ok} />
                </View>
                <Text style={styles.successTitle}>Pagamento confirmado!</Text>
                <Text style={styles.successSub}>
                  {formatCurrency(state.intent.amount)} recebido com sucesso.
                </Text>
                <KarateButton
                  label="Fechar"
                  variant="primary"
                  onPress={onClose}
                  style={{ marginTop: 24, alignSelf: "center", minWidth: 140 }}
                />
              </View>
            )}

            {/* Error */}
            {state.phase === "error" && (
              <View style={styles.centeredSection}>
                <Ionicons name="alert-circle" size={48} color={KarateColors.danger} />
                <Text style={styles.errorTitle}>Erro no pagamento</Text>
                <Text style={styles.errorMessage}>{state.message}</Text>
                <View style={styles.errorActions}>
                  <KarateButton
                    label="Tentar novamente"
                    variant="primary"
                    onPress={createIntent}
                  />
                  <KarateButton
                    label="Cancelar"
                    variant="ghost"
                    onPress={onClose}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  } as ViewStyle,
  sheet: {
    backgroundColor: KarateColors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%" as any,
    ...Platform.select({
      web: { maxWidth: 480, alignSelf: "center", width: "100%", borderRadius: KarateRadius.lg } as any,
      default: {},
    }),
  } as ViewStyle,
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
  } as ViewStyle,
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: KarateColors.ink,
  } as TextStyle,
  closeBtn: {
    padding: 4,
  } as ViewStyle,
  body: {
    padding: 20,
    gap: 12,
    alignItems: "stretch",
  } as ViewStyle,

  centeredSection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  } as ViewStyle,
  loadingText: {
    fontSize: 14,
    color: KarateColors.ink3,
    marginTop: 8,
  } as TextStyle,

  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    backgroundColor: KarateColors.primarySoft,
    borderRadius: KarateRadius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  } as ViewStyle,
  amountLabel: {
    fontSize: 13,
    color: KarateColors.primary,
    fontWeight: "600",
  } as TextStyle,
  amountValue: {
    fontSize: 22,
    fontWeight: "900",
    color: KarateColors.primary,
    letterSpacing: -0.5,
  } as TextStyle,

  pollingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as ViewStyle,
  pollingText: {
    fontSize: 12,
    color: KarateColors.ink4,
  } as TextStyle,

  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: KarateColors.primaryLine,
    borderRadius: KarateRadius.md,
    paddingVertical: 12,
    backgroundColor: KarateColors.primaryDim,
  } as ViewStyle,
  copyBtnDone: {
    borderColor: ShojiPalette.ok,
    backgroundColor: ShojiPalette.okSoft,
  } as ViewStyle,
  copyBtnLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: KarateColors.primary,
  } as TextStyle,
  copyBtnLabelDone: {
    color: ShojiPalette.ok,
  } as TextStyle,

  adminSection: {
    gap: 8,
    marginTop: 4,
  } as ViewStyle,
  adminDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  } as ViewStyle,
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: KarateColors.border,
  } as ViewStyle,
  dividerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: KarateColors.ink4,
    letterSpacing: 1,
  } as TextStyle,
  adminHint: {
    fontSize: 11,
    color: KarateColors.ink3,
    textAlign: "center",
  } as TextStyle,

  successIcon: {
    marginBottom: 4,
  } as ViewStyle,
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: ShojiPalette.ok,
  } as TextStyle,
  successSub: {
    fontSize: 14,
    color: KarateColors.ink3,
    textAlign: "center",
  } as TextStyle,

  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: KarateColors.danger,
    marginTop: 8,
  } as TextStyle,
  errorMessage: {
    fontSize: 13,
    color: KarateColors.ink3,
    textAlign: "center",
  } as TextStyle,
  errorActions: {
    gap: 8,
    marginTop: 16,
    width: "100%",
  } as ViewStyle,
});
