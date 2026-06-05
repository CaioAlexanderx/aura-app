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
 * BUGFIX (05/06/2026): RangeError "Invalid time value" quando o usuário
 * digitava data parcial no input livre `firstDueDate`. Causa raiz:
 *   - input era TextInput puro, sem máscara, com placeholder "AAAA-MM-DD"
 *   - usuário apaga/edita → string vira algo como "2026-0" / "" / "abc"
 *   - useMemo de simInstallments faz `new Date(firstDueDate).toISOString()`
 *     dentro do Array.from → Invalid Date → toISOString joga RangeError
 *     → ErrorBoundary engole o modal inteiro (incluindo saldo em aberto)
 *
 * Fix:
 *   1. Input agora usa <DateInput/> com máscara dd/mm/aaaa (padrão BR)
 *   2. State interno guarda firstDueDateBr (dd/mm/aaaa) e firstDueDateIso
 *      (YYYY-MM-DD) derivado via parseBrDate — null se inválido/incompleto
 *   3. simInstallments retorna [] se ISO null (não tenta new Date)
 *   4. Camada extra defensiva: `safeIso(date)` checa `Number.isNaN` antes
 *      de chamar toISOString (cobre paste/autocomplete/outras fontes)
 *   5. Submit bloqueado se ISO null (botão Confirmar disabled + forceShow)
 *
 * BUGFIX (05/06/2026, Parte 2): saldo em aberto da cliente não aparecia.
 * Causa: modal só mostrava `profile.credit_used`, que (a) podia estar
 * stale, (b) virava 0 quando o profile não existia, (c) o modal nem
 * renderizava quando o crash de data acima estourava no useMemo.
 * Fix: agregar `profile.open_installments[].remaining` (campo que o
 * backend já devolve) em `openBalance` + `openCount` e exibir como
 * linha destacada "Saldo em aberto" — sempre visível, mesmo sem profile.
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
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";

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

/**
 * Formata uma data (Date ou ISO YYYY-MM-DD) como dd/mm/aa para preview.
 * Retorna "—" se a data for inválida (evita "Invalid Date" no preview).
 */
function fmtDateSafe(input: Date | string | null | undefined): string {
  if (!input) return "—";
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return "—";
  }
}

/** Retorna ISO YYYY-MM-DD se a Date for válida, senão null. NUNCA joga. */
function safeIsoDate(d: Date): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  try {
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

const SCORE_LABEL: Record<string, string> = {
  premium: "Premium ★", bom: "Bom", regular: "Regular", restrito: "Restrito ⚠️", bloqueado: "Bloqueado 🚫",
};

const SCORE_COLOR: Record<string, string> = {
  premium: Colors.green, bom: "#34d399", regular: Colors.amber, restrito: "#f97316", bloqueado: Colors.red,
};

/** Próximo mês em dd/mm/aaaa — formato BR do nosso DateInput. */
function nextMonthBrDate(): string {
  var d = new Date();
  d.setMonth(d.getMonth() + 1);
  // safe: new Date() sempre válida
  var iso = safeIsoDate(d);
  return formatIsoToBr(iso) || "";
}

export function CreditInstallmentModal({ visible, companyId, customerId, customerName, totalAmount, onConfirm, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [numInstallments, setNumInstallments] = useState(2);
  // BR-formatted (dd/mm/aaaa) — fonte de verdade do que o usuário digita.
  const [firstDueDateBr, setFirstDueDateBr] = useState(() => nextMonthBrDate());
  const [amount, setAmount] = useState(totalAmount?.toFixed(2) || "");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ISO derivado da string BR — null se inválido/incompleto.
  const firstDueDateIso = useMemo(() => parseBrDate(firstDueDateBr), [firstDueDateBr]);

  // Resetar quando abre
  useEffect(() => {
    if (visible) {
      setStep(1);
      setNumInstallments(2);
      setFirstDueDateBr(nextMonthBrDate());
      setSubmitAttempted(false);
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

  // Saldo em aberto agregado das parcelas pendentes/overdue (fonte canônica).
  // Backend já devolve `profile.open_installments[].remaining`. Não dependemos
  // mais de `profile.credit_used` (que pode estar stale ou ausente sem profile).
  const { openBalance, openCount, openOverdueCount } = useMemo(() => {
    const list = profile?.open_installments || [];
    let sum = 0;
    let overdue = 0;
    for (const ins of list) {
      const rem = Number((ins as any).remaining);
      if (!Number.isFinite(rem)) continue;
      sum += rem;
      if (ins.status === "overdue") overdue += 1;
    }
    return { openBalance: sum, openCount: list.length, openOverdueCount: overdue };
  }, [profile]);

  // Simular parcelas — defensivo: skip se ISO inválido (impede Invalid time value).
  const simInstallments = useMemo(() => {
    if (!totalNum || numInstallments < 1) return [];
    if (!firstDueDateIso) return []; // <-- fix do crash: sem ISO válido, não simula
    var base = Math.floor(totalNum / numInstallments * 100) / 100;
    var remainder = Math.round((totalNum - base * numInstallments) * 100) / 100;
    var firstDate = new Date(firstDueDateIso);
    if (Number.isNaN(firstDate.getTime())) return []; // dupla checagem
    return Array.from({ length: numInstallments }, (_, i) => {
      var amt = i === numInstallments - 1 ? base + remainder : base;
      var d = new Date(firstDate);
      d.setMonth(d.getMonth() + i);
      var iso = safeIsoDate(d); // safe: nunca joga
      return { num: i + 1, amount: amt, date: iso, dateBr: fmtDateSafe(d) };
    });
  }, [totalNum, numInstallments, firstDueDateIso]);

  function canProceed() {
    if (step === 1) return !profileQ.isLoading && !isBlocked;
    if (step === 2) return totalNum > 0 && numInstallments >= 1 && !!firstDueDateIso;
    return false;
  }

  function handleNext() {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setSubmitAttempted(true);
      if (!firstDueDateIso) return; // bloqueia submit com data inválida
      // Apenas devolve os dados — o backend cria as parcelas no POST /pdv/sale
      onConfirm({ installments: numInstallments, first_due_date: firstDueDateIso });
    }
  }

  if (!visible) return null;

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

                {/* Saldo em aberto — SEMPRE visível quando há parcelas pendentes,
                    independente do profile estar configurado ou não. */}
                {!profileQ.isLoading && openCount > 0 && (
                  <View style={[m.openBalanceCard, openOverdueCount > 0 && m.openBalanceCardOverdue]}>
                    <View style={m.openBalanceHeader}>
                      <Icon
                        name={openOverdueCount > 0 ? "alert" : "clock"}
                        size={14}
                        color={openOverdueCount > 0 ? Colors.red : Colors.amber}
                      />
                      <Text style={[m.openBalanceLabel, openOverdueCount > 0 && { color: Colors.red }]}>
                        Saldo em aberto
                      </Text>
                    </View>
                    <Text style={[m.openBalanceValue, openOverdueCount > 0 && { color: Colors.red }]}>
                      {fmtCur(openBalance)}
                    </Text>
                    <Text style={m.openBalanceDetail}>
                      {openCount} parcela{openCount === 1 ? "" : "s"} pendente{openCount === 1 ? "" : "s"}
                      {openOverdueCount > 0 ? ` · ${openOverdueCount} em atraso` : ""}
                    </Text>
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
                      {Number(profile.credit_limit) > 0 && (
                        <View style={m.profileRow}>
                          <Text style={m.profileLabel}>Limite disponível</Text>
                          <Text style={[m.profileValue, { color: Colors.green }]}>{fmtCur(available)}</Text>
                        </View>
                      )}
                      {/* "Em uso" continua só por compatibilidade visual quando há limite */}
                      {Number(profile.credit_limit) > 0 && (
                        <View style={m.profileRow}>
                          <Text style={m.profileLabel}>Em uso</Text>
                          <Text style={m.profileValue}>{fmtCur(Number(profile.credit_used))}</Text>
                        </View>
                      )}
                    </View>

                    {isBlocked && (
                      <View style={m.alertBox}>
                        <Icon name="alert" size={14} color={Colors.red} />
                        <Text style={m.alertText}>Cliente com crédito bloqueado. Desbloqueie no dashboard antes de parcelar.</Text>
                      </View>
                    )}
                  </>
                )}

                {!profileQ.isLoading && !profile && openCount === 0 && (
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
                  <DateInput
                    value={firstDueDateBr}
                    onChangeText={setFirstDueDateBr}
                    placeholder="dd/mm/aaaa"
                    forceShowError={submitAttempted && !firstDueDateIso}
                    errorMessage="Informe uma data válida (dd/mm/aaaa)."
                  />
                </View>

                {/* Preview compacto */}
                {simInstallments.length > 0 && (
                  <View style={m.simTable}>
                    <Text style={m.simTitle}>SIMULAÇÃO</Text>
                    {simInstallments.map(ins => (
                      <View key={ins.num} style={m.simRow}>
                        <Text style={m.simNum}>{ins.num}ª</Text>
                        <Text style={m.simDate}>{ins.dateBr}</Text>
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

  // Saldo em aberto — card destacado (laranja/âmbar quando só pendente, vermelho com overdue)
  openBalanceCard: {
    backgroundColor: Colors.amber + "10",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.amber + "44",
    gap: 4,
  },
  openBalanceCardOverdue: {
    backgroundColor: Colors.redD,
    borderColor: Colors.red + "55",
  },
  openBalanceHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  openBalanceLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", color: Colors.amber },
  openBalanceValue: { fontSize: 22, fontWeight: "800", color: Colors.amber, marginTop: 2 },
  openBalanceDetail: { fontSize: 11, color: Colors.ink3 },

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
