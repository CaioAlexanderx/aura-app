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
 * digitava data parcial no input livre `firstDueDate`.
 *
 * BUGFIX (05/06/2026, Parte 2): saldo em aberto da cliente não aparecia.
 *
 * feat(unify) (13/06/2026):
 *   Quando a cliente já tem carnê(s) aberto(s), o Step 1 exibe um toggle
 *   "Unificar com carnê existente". Quando ligado:
 *     - O lojista escolhe o carnê + nº de parcelas + vencimento da 1ª.
 *     - Um preview (previewUnify) é carregado mostrando saldo existente,
 *       nova compra, juros e cronograma resultante.
 *     - onConfirm devolve `unify: { account_id, installments, first_due_date }`
 *       em vez de apenas { installments, first_due_date }.
 *     - O PDV (usePdvState / PdvModals) deve:
 *         1. Chamar finalizeSale() com installments=1 (só débito, sem cronograma).
 *         2. Após obter o sale_id no onSuccess, chamar creditApi.applyUnify(...).
 *   O caminho SEM unify permanece INTACTO.
 *
 * Props:
 *   visible        — controla visibilidade
 *   companyId      — empresa atual
 *   customerId     — cliente já selecionado no PDV (obrigatório)
 *   customerName   — nome do cliente (display)
 *   totalAmount    — valor total da venda (pre-preenche o campo)
 *   onConfirm(payload) — callback pós-seleção
 *   onClose        — callback fechar sem confirmar
 */
import { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { creditApi, type CreditAccount, type UnifyPlan } from "@/services/creditApi";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";

// ConfirmPayload ampliado: campo `unify` presente somente quando o toggle está ativo.
export type ConfirmPayload = {
  installments: number;
  first_due_date: string;
  /** Presente somente quando o lojista escolheu unificar. */
  unify?: {
    account_id: string;      // ID do carnê selecionado
    installments: number;    // Nº de parcelas do cronograma unificado
    first_due_date: string;  // YYYY-MM-DD da 1ª parcela
  };
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

function nextMonthBrDate(): string {
  var d = new Date();
  d.setMonth(d.getMonth() + 1);
  var iso = safeIsoDate(d);
  return formatIsoToBr(iso) || "";
}

export function CreditInstallmentModal({ visible, companyId, customerId, customerName, totalAmount, onConfirm, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [numInstallments, setNumInstallments] = useState(2);
  const [firstDueDateBr, setFirstDueDateBr] = useState(() => nextMonthBrDate());
  const [amount, setAmount] = useState(totalAmount?.toFixed(2) || "");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ── Unify state ──────────────────────────────────────────────
  const [unifyEnabled, setUnifyEnabled] = useState(false);
  const [unifyAccountId, setUnifyAccountId] = useState<string | null>(null);
  const [unifyInstallments, setUnifyInstallments] = useState(2);
  const [unifyFirstDueBr, setUnifyFirstDueBr] = useState(() => nextMonthBrDate());
  const [unifyPreview, setUnifyPreview] = useState<UnifyPlan | null>(null);
  const [unifyPreviewLoading, setUnifyPreviewLoading] = useState(false);
  const [unifyPreviewError, setUnifyPreviewError] = useState<string | null>(null);

  const unifyFirstDueIso = useMemo(() => parseBrDate(unifyFirstDueBr), [unifyFirstDueBr]);
  const firstDueDateIso  = useMemo(() => parseBrDate(firstDueDateBr), [firstDueDateBr]);

  // Resetar quando abre
  useEffect(() => {
    if (visible) {
      setStep(1);
      setNumInstallments(2);
      setFirstDueDateBr(nextMonthBrDate());
      setSubmitAttempted(false);
      setUnifyEnabled(false);
      setUnifyAccountId(null);
      setUnifyInstallments(2);
      setUnifyFirstDueBr(nextMonthBrDate());
      setUnifyPreview(null);
      setUnifyPreviewError(null);
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

  // Buscar histórico para obter a lista de carnês abertos
  const historyQ = useQuery({
    queryKey: ["credit-customer", companyId, customerId],
    queryFn: () => creditApi.getCustomerHistory(companyId, customerId),
    enabled: visible && !!companyId && !!customerId,
    staleTime: 30_000,
  });

  const openAccounts: CreditAccount[] = useMemo(
    () => (historyQ.data?.accounts || []).filter(a => a.id !== null && a.status === "open") as CreditAccount[],
    [historyQ.data],
  );

  const profile = profileQ.data;
  const config = profile?.config;
  const maxInstallments = Math.min(config?.max_installments || 12, 12);
  const totalNum = parseFloat(amount.replace(",", ".")) || 0;
  const available = profile ? (Number(profile.credit_limit) - Number(profile.credit_used)) : 0;
  const isBlocked = profile?.status === "blocked";

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

  const simInstallments = useMemo(() => {
    if (!totalNum || numInstallments < 1) return [];
    if (!firstDueDateIso) return [];
    var base = Math.floor(totalNum / numInstallments * 100) / 100;
    var remainder = Math.round((totalNum - base * numInstallments) * 100) / 100;
    var firstDate = new Date(firstDueDateIso);
    if (Number.isNaN(firstDate.getTime())) return [];
    return Array.from({ length: numInstallments }, (_, i) => {
      var amt = i === numInstallments - 1 ? base + remainder : base;
      var d = new Date(firstDate);
      d.setMonth(d.getMonth() + i);
      var iso = safeIsoDate(d);
      return { num: i + 1, amount: amt, date: iso, dateBr: fmtDateSafe(d) };
    });
  }, [totalNum, numInstallments, firstDueDateIso]);

  // Carregar preview do unify sempre que os parâmetros mudam
  useEffect(() => {
    if (!unifyEnabled || !unifyAccountId || !unifyFirstDueIso || totalNum <= 0 || unifyInstallments < 1) {
      setUnifyPreview(null);
      return;
    }
    let cancelled = false;
    setUnifyPreviewLoading(true);
    setUnifyPreviewError(null);
    creditApi.previewUnify(companyId, customerId, unifyAccountId, {
      amount: totalNum,
      installments: unifyInstallments,
      first_due_date: unifyFirstDueIso,
    }).then(plan => {
      if (!cancelled) { setUnifyPreview(plan); setUnifyPreviewLoading(false); }
    }).catch((err: any) => {
      if (!cancelled) {
        setUnifyPreviewError(err?.message || "Erro ao calcular unificação");
        setUnifyPreview(null);
        setUnifyPreviewLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [unifyEnabled, unifyAccountId, unifyInstallments, unifyFirstDueIso, totalNum, companyId, customerId]);

  function canProceed() {
    if (step === 1) return !profileQ.isLoading && !isBlocked;
    if (step === 2) {
      if (unifyEnabled) {
        return !!unifyAccountId && unifyInstallments >= 1 && !!unifyFirstDueIso && !!unifyPreview && !unifyPreviewLoading;
      }
      return totalNum > 0 && numInstallments >= 1 && !!firstDueDateIso;
    }
    return false;
  }

  function handleNext() {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setSubmitAttempted(true);
      if (unifyEnabled) {
        if (!unifyAccountId || !unifyFirstDueIso || !unifyPreview) return;
        // Fluxo de unify: a venda irá com installments=1 (só débito).
        // O applyUnify será chamado pelo PDV após obter o sale_id.
        onConfirm({
          installments: 1,           // sem cronograma próprio
          first_due_date: unifyFirstDueIso,
          unify: {
            account_id: unifyAccountId,
            installments: unifyInstallments,
            first_due_date: unifyFirstDueIso,
          },
        });
      } else {
        if (!firstDueDateIso) return;
        onConfirm({ installments: numInstallments, first_due_date: firstDueDateIso });
      }
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

                {/* Toggle de unificação — só aparece quando há carnê(s) aberto(s) */}
                {!profileQ.isLoading && !historyQ.isLoading && openAccounts.length > 0 && (
                  <View style={m.unifyToggleCard}>
                    <View style={m.unifyToggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={m.unifyToggleTitle}>Unificar com carnê existente</Text>
                        <Text style={m.unifyToggleSub}>
                          Soma o saldo aberto + esta compra e redivide em novas parcelas
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setUnifyEnabled(v => !v);
                          if (!unifyAccountId && openAccounts.length === 1) {
                            setUnifyAccountId(openAccounts[0].id as string);
                          }
                        }}
                        style={[m.toggleSwitch, unifyEnabled && m.toggleSwitchOn]}
                      >
                        <View style={[m.toggleThumb, unifyEnabled && m.toggleThumbOn]} />
                      </Pressable>
                    </View>

                    {unifyEnabled && (
                      <View style={m.unifyAccountList}>
                        {openAccounts.map(acc => (
                          <Pressable
                            key={acc.id}
                            style={[m.unifyAccountRow, unifyAccountId === acc.id && m.unifyAccountRowOn]}
                            onPress={() => setUnifyAccountId(acc.id as string)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[m.unifyAccountName, unifyAccountId === acc.id && { color: Colors.violet3 }]}>
                                {acc.name}
                              </Text>
                              <Text style={m.unifyAccountSub}>
                                Saldo: {fmtCur(acc.balance || 0)}
                                {acc.overdue ? " · Em atraso" : ""}
                              </Text>
                            </View>
                            {unifyAccountId === acc.id && <Icon name="check" size={14} color={Colors.violet3} />}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* STEP 2 — Configuração das parcelas */}
            {step === 2 && (
              <View style={m.stepContent}>
                <Text style={m.stepTitle}>
                  {unifyEnabled ? "Unificar parcelas" : "Configurar parcelas"}
                </Text>

                {/* Valor total (somente leitura se veio do carrinho) */}
                {!unifyEnabled && (
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
                )}

                {/* Fluxo SEM unify: seletor de parcelas normal */}
                {!unifyEnabled && (
                  <>
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
                  </>
                )}

                {/* Fluxo COM unify: seletor do nº de parcelas unificadas + data */}
                {unifyEnabled && (
                  <>
                    {/* Resumo do carnê selecionado */}
                    {unifyAccountId && (() => {
                      const acc = openAccounts.find(a => a.id === unifyAccountId);
                      if (!acc) return null;
                      return (
                        <View style={m.unifySelectedCard}>
                          <Text style={m.unifySelectedName}>{acc.name}</Text>
                          <Text style={m.unifySelectedSub}>
                            Saldo atual: {fmtCur(acc.balance || 0)}
                            {" + "}
                            Nova compra: {fmtCur(totalNum)}
                          </Text>
                        </View>
                      );
                    })()}

                    <Text style={m.fieldLabel}>Novo nº de parcelas</Text>
                    <View style={m.installChips}>
                      {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(n => (
                        <Pressable
                          key={n}
                          onPress={() => setUnifyInstallments(n)}
                          style={[m.chip, unifyInstallments === n && m.chipActive]}
                        >
                          <Text style={[m.chipText, unifyInstallments === n && m.chipTextActive]}>{n}x</Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={m.fieldWrap}>
                      <Text style={m.fieldLabel}>Vencimento da 1ª parcela</Text>
                      <DateInput
                        value={unifyFirstDueBr}
                        onChangeText={setUnifyFirstDueBr}
                        placeholder="dd/mm/aaaa"
                        forceShowError={submitAttempted && !unifyFirstDueIso}
                        errorMessage="Informe uma data válida (dd/mm/aaaa)."
                      />
                    </View>

                    {/* Preview do unify */}
                    {unifyPreviewLoading && (
                      <View style={m.loadingBox}>
                        <ActivityIndicator color={Colors.violet3} />
                        <Text style={m.loadingText}>Calculando cronograma...</Text>
                      </View>
                    )}
                    {unifyPreviewError && (
                      <View style={m.alertBox}>
                        <Icon name="alert" size={14} color={Colors.red} />
                        <Text style={m.alertText}>{unifyPreviewError}</Text>
                      </View>
                    )}
                    {unifyPreview && !unifyPreviewLoading && (
                      <View style={m.simTable}>
                        <Text style={m.simTitle}>CRONOGRAMA UNIFICADO</Text>
                        <View style={m.simRow}>
                          <Text style={[m.simDate, { flex: 1 }]}>Saldo em aberto</Text>
                          <Text style={m.simAmt}>{fmtCur(unifyPreview.open_remaining)}</Text>
                        </View>
                        <View style={m.simRow}>
                          <Text style={[m.simDate, { flex: 1 }]}>Nova compra</Text>
                          <Text style={m.simAmt}>{fmtCur(unifyPreview.new_amount)}</Text>
                        </View>
                        {unifyPreview.interest_added > 0 && (
                          <View style={m.simRow}>
                            <Text style={[m.simDate, { flex: 1 }]}>Juros</Text>
                            <Text style={[m.simAmt, { color: Colors.amber }]}>{fmtCur(unifyPreview.interest_added)}</Text>
                          </View>
                        )}
                        <View style={[m.simTotalRow, { marginBottom: 8 }]}>
                          <Text style={m.simTotalLabel}>TOTAL UNIFICADO</Text>
                          <Text style={m.simTotalValue}>{fmtCur(unifyPreview.total)}</Text>
                        </View>
                        {unifyPreview.schedule.map(s => (
                          <View key={s.number} style={m.simRow}>
                            <Text style={m.simNum}>{s.number}ª</Text>
                            <Text style={m.simDate}>{fmtDateSafe(s.due_date)}</Text>
                            <Text style={m.simAmt}>{fmtCur(s.amount_due)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
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
                {step === 2
                  ? unifyEnabled
                    ? unifyPreview ? `Confirmar ${unifyInstallments}x de ${fmtCur(unifyPreview.total / unifyInstallments)}` : "Aguardando..."
                    : `Confirmar ${numInstallments}x de ${totalNum > 0 ? fmtCur(Math.round(totalNum / numInstallments * 100) / 100) : "--"}`
                  : "Continuar"
                }
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

  body: { flexGrow: 1, maxHeight: 460 },
  stepContent: { padding: 20, gap: 14 },
  stepTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  stepSubtitle: { fontSize: 12, color: Colors.ink3 },

  loadingBox: { paddingVertical: 32, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 12, color: Colors.ink3 },

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

  // ── Unify toggle ───────────────────────────────────────────────────────────────
  unifyToggleCard: { backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.violet + "33", gap: 10 },
  unifyToggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  unifyToggleTitle: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  unifyToggleSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleSwitchOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.ink3 },
  toggleThumbOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
  unifyAccountList: { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  unifyAccountRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg2 },
  unifyAccountRowOn: { backgroundColor: Colors.violetD },
  unifyAccountName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  unifyAccountSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  unifySelectedCard: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.violet + "33" },
  unifySelectedName: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  unifySelectedSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

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
