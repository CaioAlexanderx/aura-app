/**
 * CreditInstallmentModal
 * Wizard 2 passos para configurar venda parcelada no PDV.
 *
 * FASE 1 (26/05/2026): o modal agora apenas coleta numInstallments +
 * firstDueDate e devolve via onConfirm({ installments, first_due_date }).
 * A criação real das credit_installments é feita INLINE no backend
 * dentro do POST /pdv/sale (bloco best-effort após COMMIT).
 * O step de "criação via API separada" foi removido — evita double-create.
 *
 * Props:
 *   visible        — controla visibilidade
 *   companyId      — empresa atual
 *   customerId     — cliente já selecionado no PDV (obrigatório)
 *   customerName   — nome do cliente (display)
 *   totalAmount    — valor total da venda (pre-preenche o campo)
 *   onConfirm({ installments, first_due_date }) — callback pós-seleção
 *   onClose        — callback fechar sem confirmar
 */
import { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { creditApi } from "@/services/creditApi";

type ConfirmPayload = {
  installments: number;
  first_due_date: string;
};

type Props = {
  visible: boolean;
  companyId: string;
  customerId: string;
  customerName?: string;
  totalAmount?: number;
  onConfirm: (payload: ConfirmPayload) => void;
  onClose: () => void;
};

var fmtCur = function(n: number) {
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

var fmtDate = function(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
  catch { return iso; }
};

const SCORE_LABEL: Record<string, string> = {
  premium: "Premium ★", bom: "Bom", regular: "Regular", restrito: "Restrito ⚠️", bloqueado: "Bloqueado 🚫",
};

const SCORE_COLOR: Record<string, string> = {
  premium: Colors.green, bom: "#34d399", regular: Colors.amber, restrito: "#f97316", bloqueado: Colors.red,
};

function nextMonthDate(): string {
  var d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split("T")[0];
}

export function CreditInstallmentModal({ visible, companyId, customerId, customerName, totalAmount, onConfirm, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [numInstallments, setNumInstallments] = useState(2);
  const [firstDueDate, setFirstDueDate] = useState(() => nextMonthDate());
  const [amount, setAmount] = useState(totalAmount?.toFixed(2) || "");

  // Resetar quando abre
  useEffect(() => {
    if (visible) {
      setStep(1);
      setNumInstallments(2);
      setFirstDueDate(nextMonthDate());
      if (totalAmount !== undefined) setAmount(totalAmount.toFixed(2));
    }
  }, [visible, totalAmount]);

  // Buscar perfil do cliente (informativo — não bloqueia mais)
  const profileQ = useQuery({
    queryKey: ["credit-profile", companyId, customerId],
    queryFn: () => creditApi.getCustomerProfile(companyId, customerId),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 30_000,
  });

  const profile = profileQ.data;
  const config = profile?.config;
  const maxInstallments = Math.min(config?.max_installments || 12, 12);
  const totalNum = parseFloat(amount.replace(",", ".")) || 0;
  const available = profile ? (Number(profile.credit_limit) - Number(profile.credit_used)) : 0;
  const isBlocked = profile?.status === "blocked";

  // Simular parcelas
  const simInstallments = useMemo(() => {
    if (!totalNum || numInstallments < 1) return [];
    var base = Math.floor(totalNum / numInstallments * 100) / 100;
    var remainder = Math.round((totalNum - base * numInstallments) * 100) / 100;
    var firstDate = new Date(firstDueDate);
    return Array.from({ length: numInstallments }, (_, i) => {
      var amt = i === numInstallments - 1 ? base + remainder : base;
      var d = new Date(firstDate);
      d.setMonth(d.getMonth() + i);
      return { num: i + 1, amount: amt, date: d.toISOString().split("T")[0] };
    });
  }, [totalNum, numInstallments, firstDueDate]);

  function canProceed() {
    if (step === 1) return !profileQ.isLoading && !isBlocked;
    if (step === 2) return totalNum > 0 && numInstallments >= 1 && !!firstDueDate;
    return false;
  }

  function handleNext() {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      // Apenas devolve os dados — o backend cria as parcelas no POST /pdv/sale
      onConfirm({ installments: numInstallments, first_due_date: firstDueDate });
    }
  }

  if (!visible) return null;

  // Resumo compacto das parcelas (preview inline)
  const previewText = simInstallments.length > 0
    ? simInstallments
        .slice(0, 4)
        .map(ins => `${ins.num}ª ${fmtCur(ins.amount)} · ${fmtDate(ins.date)}`)
        .join("  •  ")
        + (simInstallments.length > 4 ? ` ... +${simInstallments.length - 4} parcelas` : "")
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          {/* Header */}
          <View style={m.header}>
            <Text style={m.headerTitle}>Crediário Parcelado</Text>
            <Pressable onPress={onClose} style={m.closeBtn}>
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>

          {/* Steps indicator */}
          <View style={m.stepsRow}>
            {[1, 2].map(s => (
              <View key={s} style={[m.stepDot, s <= step && m.stepDotActive, s === step && m.stepDotCurrent]}>
                {s < step
                  ? <Icon name="check" size={10} color="#fff" />
                  : <Text style={[m.stepDotNum, s <= step && { color: "#fff" }]}>{s}</Text>
                }
              </View>
            ))}
          </View>

          <ScrollView style={m.body} showsVerticalScrollIndicator={false}>
            {/* STEP 1 — Perfil de crédito (informativo) */}
            {step === 1 && (
              <View style={m.stepContent}>
                <Text style={m.stepTitle}>Perfil de crédito</Text>
                <Text style={m.stepSubtitle}>Score e limites de {customerName || "cliente"}</Text>

                {profileQ.isLoading && (
                  <View style={m.loadingBox}>
                    <ActivityIndicator color={Colors.violet3} />
                    <Text style={m.loadingText}>Consultando perfil...</Text>
                  </View>
                )}

                {!profileQ.isLoading && profile && (
                  <>
                    <View style={m.profileCard}>
                      <View style={m.profileRow}>
                        <Text style={m.profileLabel}>Score</Text>
                        <View style={[m.scoreBadge, { backgroundColor: (SCORE_COLOR[profile.label] || Colors.amber) + "22" }]}>
                          <Text style={[m.scoreBadgeText, { color: SCORE_COLOR[profile.label] || Colors.amber }]}>
                            {profile.credit_score}pts — {SCORE_LABEL[profile.label] || profile.label}
                          </Text>
                        </View>
                      </View>
                      <View style={m.profileRow}>
                        <Text style={m.profileLabel}>Limite disponível</Text>
                        <Text style={[m.profileValue, { color: Colors.green }]}>{fmtCur(available)}</Text>
                      </View>
                      <View style={m.profileRow}>
                        <Text style={m.profileLabel}>Em uso</Text>
                        <Text style={m.profileValue}>{fmtCur(Number(profile.credit_used))}</Text>
                      </View>
                    </View>

                    {isBlocked && (
                      <View style={m.alertBox}>
                        <Icon name="alert" size={14} color={Colors.red} />
                        <Text style={m.alertText}>Cliente com crédito bloqueado. Desbloqueie no dashboard antes de parcelar.</Text>
                      </View>
                    )}
                  </>
                )}

                {!profileQ.isLoading && !profile && (
                  <View style={[m.alertBox, { borderColor: Colors.violet + "33", backgroundColor: Colors.violetD }]}>
                    <Icon name="clock" size={14} color={Colors.violet3} />
                    <Text style={[m.alertText, { color: Colors.violet3 }]}>Perfil sem limite configurado. O parcelamento será criado automaticamente.</Text>
                  </View>
                )}
              </View>
            )}

            {/* STEP 2 — Configuração das parcelas */}
            {step === 2 && (
              <View style={m.stepContent}>
                <Text style={m.stepTitle}>Configurar parcelas</Text>

                {/* Valor total (somente leitura se veio do carrinho) */}
                <View style={m.fieldWrap}>
                  <Text style={m.fieldLabel}>Valor total (R$)</Text>
                  <TextInput
                    style={[m.fieldInput, totalAmount !== undefined && { opacity: 0.7 }]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={Colors.ink3}
                    editable={totalAmount === undefined}
                  />
                </View>

                {/* Seletor de parcelas */}
                <Text style={m.fieldLabel}>Dividir em quantas vezes?</Text>
                <View style={m.installChips}>
                  {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(n => (
                    <Pressable
                      key={n}
                      onPress={() => setNumInstallments(n)}
                      style={[m.chip, numInstallments === n && m.chipActive]}
                    >
                      <Text style={[m.chipText, numInstallments === n && m.chipTextActive]}>{n}x</Text>
                      {totalNum > 0 && (
                        <Text style={[m.chipSub, numInstallments === n && { color: "rgba(255,255,255,0.75)" }]}>
                          {fmtCur(Math.round(totalNum / n * 100) / 100)}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>

                {/* Data da 1ª parcela */}
                <View style={m.fieldWrap}>
                  <Text style={m.fieldLabel}>Vencimento da 1ª parcela</Text>
                  <TextInput
                    style={m.fieldInput}
                    value={firstDueDate}
                    onChangeText={setFirstDueDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={Colors.ink3}
                  />
                </View>

                {/* Preview compacto */}
                {simInstallments.length > 0 && (
                  <View style={m.simTable}>
                    <Text style={m.simTitle}>SIMULAÇÃO</Text>
                    {simInstallments.map(ins => (
                      <View key={ins.num} style={m.simRow}>
                        <Text style={m.simNum}>{ins.num}ª</Text>
                        <Text style={m.simDate}>{fmtDate(ins.date)}</Text>
                        <Text style={m.simAmt}>{fmtCur(ins.amount)}</Text>
                      </View>
                    ))}
                    <View style={m.simTotalRow}>
                      <Text style={m.simTotalLabel}>TOTAL</Text>
                      <Text style={m.simTotalValue}>{fmtCur(totalNum)}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={m.footer}>
            {step > 1 && (
              <Pressable onPress={() => setStep(step - 1)} style={m.backBtn}>
                <Text style={m.backBtnText}>Voltar</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleNext}
              disabled={!canProceed()}
              style={[m.nextBtn, !canProceed() && m.nextBtnDisabled]}
            >
              <Text style={m.nextBtnText}>
                {step === 2 ? `Confirmar ${numInstallments}x de ${totalNum > 0 ? fmtCur(Math.round(totalNum / numInstallments * 100) / 100) : "--"}` : "Continuar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 16 },
  sheet: { backgroundColor: Colors.bg2, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90%", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },

  stepsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotCurrent: { borderColor: Colors.violet2, backgroundColor: Colors.violet },
  stepDotNum: { fontSize: 11, fontWeight: "700", color: Colors.ink3 },

  body: { flexGrow: 1, maxHeight: 440 },
  stepContent: { padding: 20, gap: 14 },
  stepTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  stepSubtitle: { fontSize: 12, color: Colors.ink3 },

  loadingBox: { paddingVertical: 32, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 12, color: Colors.ink3 },

  profileCard: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  profileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  profileLabel: { fontSize: 12, color: Colors.ink3 },
  profileValue: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreBadgeText: { fontSize: 11, fontWeight: "700" },

  alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.redD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.red + "33" },
  alertText: { flex: 1, fontSize: 11.5, color: Colors.red, lineHeight: 16 },

  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: Colors.ink3, letterSpacing: 0.4, textTransform: "uppercase" },
  fieldInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },

  installChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minWidth: 56, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  chipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  chipText: { fontSize: 13, fontWeight: "700", color: Colors.ink3 },
  chipTextActive: { color: "#fff" },
  chipSub: { fontSize: 9, color: Colors.ink3, marginTop: 2 },

  simTable: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  simTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 4 },
  simRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  simNum: { width: 28, fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  simDate: { flex: 1, fontSize: 11, color: Colors.ink3 },
  simAmt: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  simTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 },
  simTotalLabel: { fontSize: 10, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.5, textTransform: "uppercase" },
  simTotalValue: { fontSize: 13, fontWeight: "800", color: Colors.green },

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  backBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  nextBtn: { flex: 1, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
