import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  printCarne,
  type CreditAccount, type CreditInstallment, type PaymentPlan,
} from "@/services/creditApi";
import { DateInput } from "@/components/inputs/DateInput";
import {
  fmt, fmtDate, parseAmount, periodLabel,
  PAYMENT_METHODS,
} from "./fichaHelpers";
import { m } from "./fichaStyles";

function translateStatus(status: string): string {
  if (status === "paid") return "Quitada";
  if (status === "partial") return "Parcial";
  if (status === "overdue") return "Em atraso";
  if (status === "pending") return "Em aberto";
  if (status === "cancelled") return "Cancelada";
  return status;
}

export type TabParcelasProps = {
  profile: any;
  detail: any;
  accounts: CreditAccount[];
  openInst: CreditInstallment[];
  instByAccount: Map<string | null, CreditInstallment[]>;
  useCarneLayout: boolean;
  realCarnes: CreditAccount[];
  totalBalance: number;
  nextDueDate: string;
  scoreLabel: string | null;
  availableLimit: number | undefined;
  isBlocked: boolean;
  hasOverdue: boolean;
  handleCreateAccount: () => void;
  showNewAccount: boolean;
  setShowNewAccount: (fn: (v: boolean) => boolean) => void;
  newAccountName: string;
  setNewAccountName: (v: string) => void;
  creatingAccount: boolean;
  expandedAccountId: string | null | undefined;
  setExpandedAccountId: (v: string | null | undefined) => void;
  handleEditDueDateOpen: (inst: CreditInstallment) => void;
  openInstallmentPix: (id: string) => void;
  /** Pix para o recebimento de valor livre (B3). Passa o valor em reais. */
  openFreePix: (amount: number) => void;
  freeAmt: string;
  setFreeAmt: (v: string) => void;
  freeMethod: string;
  setFreeMethod: (v: string) => void;
  freeDateBr: string;
  setFreeDateBr: (v: string) => void;
  freeAccountId: string | null | undefined;
  setFreeAccountId: (v: string | null | undefined) => void;
  freePreview: PaymentPlan | null;
  freePreviewLoading: boolean;
  confirmFreePayment: () => void;
  freeSubmitting: boolean;
  prefill: (v: number) => void;
  triggerPreview: (amtStr: string, accountId?: string | null) => void;
  companyId: string;
  customerId: string;
  phone: string | null;
  onCobrar?: ((customerId: string, customerName: string, phone: string | null) => void) | undefined;
  name: string;
};

export function TabParcelas({
  profile, detail, accounts, openInst, instByAccount, useCarneLayout, realCarnes,
  totalBalance, nextDueDate, scoreLabel, availableLimit, isBlocked, hasOverdue,
  handleCreateAccount, showNewAccount, setShowNewAccount, newAccountName, setNewAccountName, creatingAccount,
  expandedAccountId, setExpandedAccountId,
  handleEditDueDateOpen, openInstallmentPix, openFreePix,
  freeAmt, setFreeAmt, freeMethod, setFreeMethod, freeDateBr, setFreeDateBr,
  freeAccountId, setFreeAccountId, freePreview, freePreviewLoading,
  confirmFreePayment, freeSubmitting, prefill, triggerPreview,
  companyId, customerId, phone, onCobrar, name,
}: TabParcelasProps) {
  const hasAccounts = accounts.length > 0;
  const freeAmtValue = parseAmount(freeAmt);
  return (
<>
  {useCarneLayout && (
    <View style={m.card}>
      <View style={m.cardTitleRow}>
        <Text style={m.cardTitle}>Carnês / contas</Text>
        <Pressable
          style={m.newAccBtn}
          onPress={() => { setShowNewAccount(v => !v); setNewAccountName(""); }}
        >
          <Icon name="plus" size={12} color={Colors.violet3} />
          <Text style={m.newAccTxt}>Novo carnê</Text>
        </Pressable>
      </View>

      {showNewAccount && (
        <View style={m.newAccRow}>
          <TextInput
            style={m.newAccInput}
            placeholder="Nome do carnê"
            placeholderTextColor={Colors.ink3}
            value={newAccountName}
            onChangeText={setNewAccountName}
            autoFocus
          />
          <Pressable
            style={[m.newAccConfirm, creatingAccount && { opacity: 0.5 }]}
            onPress={handleCreateAccount}
            disabled={creatingAccount}
          >
            {creatingAccount
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={m.newAccConfirmTxt}>Criar</Text>}
          </Pressable>
        </View>
      )}

      {accounts.map((acc) => {
        const isOverdueAcc = acc.overdue;
        const statusColor = isOverdueAcc ? Colors.red : Colors.green;
        const accKey = acc.id ?? "general";
        const isExpanded = expandedAccountId === acc.id;
        const accInst = instByAccount.get(acc.id) || [];
        return (
          <View key={accKey} style={m.accCard}>
            <View style={m.accTop}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => setExpandedAccountId(isExpanded ? undefined : acc.id)}
              >
                <Text style={m.accName}>{acc.name}</Text>
                <View style={m.accMeta}>
                  {periodLabel(acc) ? (
                    <View style={[m.accBadge, { backgroundColor: Colors.violet3 + "22", borderColor: Colors.violet3 + "44" }]}>
                      <Text style={[m.accBadgeTxt, { color: Colors.violet3 }]}>{periodLabel(acc)}</Text>
                    </View>
                  ) : null}
                  <View style={[m.accBadge, { backgroundColor: statusColor + "18", borderColor: statusColor + "33" }]}>
                    <Text style={[m.accBadgeTxt, { color: statusColor }]}>{isOverdueAcc ? "Em atraso" : "Em dia"}</Text>
                  </View>
                  {accInst.length > 0 && (
                    <View style={[m.accBadge, { backgroundColor: Colors.amber + "18", borderColor: Colors.amber + "33" }]}>
                      <Text style={[m.accBadgeTxt, { color: Colors.amber }]}>{accInst.length} parcela{accInst.length !== 1 ? "s" : ""}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[m.accBalance, { color: acc.balance > 0 ? Colors.red : Colors.ink3 }]}>
                  {fmt(acc.balance)}
                </Text>
                {!!fmtDate(acc.next_due_date || "") && (
                  <Text style={m.accNextDue}>Próx. {fmtDate(acc.next_due_date!)}</Text>
                )}
              </View>
            </View>

            {isExpanded && accInst.length > 0 && (
              <View style={m.accInstList}>
                {accInst.map((ins) => {
                  const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
                  const late = ins.status === "overdue";
                  const chargesTotal = ins.charges_total ?? 0;
                  const hasCharges = late && chargesTotal > 0;
                  return (
                    <View key={ins.id} style={m.parc}>
                      <View style={{ flex: 1 }}>
                        <Text style={m.parcT}>
                          Parcela {ins.installment_number}/{ins.total_installments}
                          {hasCharges
                            ? " · " + fmt(ins.total_due ?? (rem + chargesTotal))
                            : " · " + fmt(rem)}
                        </Text>
                        <Text style={m.parcS}>Vence {fmtDate(ins.due_date)}</Text>
                        {hasCharges && (
                          <View style={m.chargesBreakdown}>
                            <View style={m.chargesRow}>
                              <Text style={m.chargesLbl}>Principal em aberto</Text>
                              <Text style={m.chargesVal}>{fmt(rem)}</Text>
                            </View>
                            {(ins.late_fee ?? 0) > 0 && (
                              <View style={m.chargesRow}>
                                <Text style={m.chargesLbl}>Multa</Text>
                                <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_fee ?? 0)}</Text>
                              </View>
                            )}
                            {(ins.late_interest ?? 0) > 0 && (
                              <View style={m.chargesRow}>
                                <Text style={m.chargesLbl}>
                                  Mora
                                  {(ins.days_charged ?? 0) > 0 && (
                                    <Text style={m.chargesDaysChip}> {ins.days_charged}d</Text>
                                  )}
                                </Text>
                                <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_interest ?? 0)}</Text>
                              </View>
                            )}
                            <View style={[m.chargesRow, m.chargesTotalRow]}>
                              <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                              <Text style={m.chargesTotalVal}>
                                {fmt(ins.total_due ?? (rem + chargesTotal))}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <View style={[m.badge, { backgroundColor: (late ? Colors.red : Colors.green) + "1A", borderColor: (late ? Colors.red : Colors.green) + "44" }]}>
                          <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>{late ? "Atraso" : "OK"}</Text>
                        </View>
                        <Pressable style={m.calBtn} onPress={() => handleEditDueDateOpen(ins)}>
                          <Icon name="Calendar" size={13} color={Colors.violet} />
                        </Pressable>
                        <Pressable style={m.pixBtn} onPress={() => openInstallmentPix(ins.id)}>
                          <Text style={m.pixBtnTxt}>Pix</Text>
                        </Pressable>
                        <Pressable style={m.receberBtn} onPress={() => prefill(hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem)}>
                          <Text style={m.receberTxt}>Receber</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {isExpanded && accInst.length === 0 && (
              <Text style={[m.emptyTxt, { marginTop: 8 }]}>Sem parcelas abertas neste carnê.</Text>
            )}

            <View style={m.accActions}>
              <Pressable
                style={m.accActionBtn}
                onPress={() => prefill(acc.balance)}
              >
                <Text style={m.accActionTxt}>Receber</Text>
              </Pressable>
              <Pressable
                style={[m.accActionBtn, { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 }]}
                onPress={() => printCarne(companyId, customerId!)}
              >
                <Text style={[m.accActionTxt, { color: Colors.violet3 }]}>Imprimir</Text>
              </Pressable>
              {!!phone && (
                <Pressable
                  style={[m.accActionBtn, m.accActionWa]}
                  onPress={() => onCobrar?.(customerId!, name, phone)}
                >
                  <Text style={[m.accActionTxt, { color: Colors.green }]}>Cobrar</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      {(() => {
        const orphan = instByAccount.get(null) || [];
        if (!orphan.length) return null;
        return (
          <View style={[m.accCard, { borderTopColor: Colors.border }]}>
            <Text style={[m.accName, { color: Colors.ink3 }]}>Sem carnê</Text>
            {orphan.map((ins) => {
              const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
              const late = ins.status === "overdue";
              const chargesTotal = ins.charges_total ?? 0;
              const hasCharges = late && chargesTotal > 0;
              return (
                <View key={ins.id} style={m.parc}>
                  <View style={{ flex: 1 }}>
                    <Text style={m.parcT}>
                      Parcela {ins.installment_number}/{ins.total_installments}
                      {hasCharges
                        ? " · " + fmt(ins.total_due ?? (rem + chargesTotal))
                        : " · " + fmt(rem)}
                    </Text>
                    <Text style={m.parcS}>Vence {fmtDate(ins.due_date)}</Text>
                    {hasCharges && (
                      <View style={m.chargesBreakdown}>
                        <View style={m.chargesRow}>
                          <Text style={m.chargesLbl}>Principal em aberto</Text>
                          <Text style={m.chargesVal}>{fmt(rem)}</Text>
                        </View>
                        {(ins.late_fee ?? 0) > 0 && (
                          <View style={m.chargesRow}>
                            <Text style={m.chargesLbl}>Multa</Text>
                            <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_fee ?? 0)}</Text>
                          </View>
                        )}
                        {(ins.late_interest ?? 0) > 0 && (
                          <View style={m.chargesRow}>
                            <Text style={m.chargesLbl}>
                              Mora
                              {(ins.days_charged ?? 0) > 0 && (
                                <Text style={m.chargesDaysChip}> {ins.days_charged}d</Text>
                              )}
                            </Text>
                            <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_interest ?? 0)}</Text>
                          </View>
                        )}
                        <View style={[m.chargesRow, m.chargesTotalRow]}>
                          <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                          <Text style={m.chargesTotalVal}>
                            {fmt(ins.total_due ?? (rem + chargesTotal))}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[m.badge, { backgroundColor: (late ? Colors.red : Colors.green) + "1A", borderColor: (late ? Colors.red : Colors.green) + "44" }]}>
                      <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>{late ? "Atraso" : "OK"}</Text>
                    </View>
                    <Pressable style={m.calBtn} onPress={() => handleEditDueDateOpen(ins)}>
                      <Icon name="Calendar" size={13} color={Colors.violet} />
                    </Pressable>
                    <Pressable style={m.pixBtn} onPress={() => openInstallmentPix(ins.id)}>
                      <Text style={m.pixBtnTxt}>Pix</Text>
                    </Pressable>
                    <Pressable style={m.receberBtn} onPress={() => prefill(hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem)}>
                      <Text style={m.receberTxt}>Receber</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })()}
    </View>
  )}

  {!useCarneLayout && openInst.length > 0 && (
    <View style={m.card}>
      <View style={m.cardTitleRow}>
        <Text style={m.cardTitle}>Parcelas em aberto</Text>
        <Pressable
          style={[m.newAccBtn, { gap: 4 }]}
          onPress={() => printCarne(companyId, customerId!)}
        >
          <Icon name="printer" size={12} color={Colors.violet3} />
          <Text style={m.newAccTxt}>Imprimir carnê</Text>
        </Pressable>
      </View>
      {openInst.map((ins) => {
        const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
        const late = ins.status === "overdue";
        const chargesTotal = ins.charges_total ?? 0;
        const hasCharges = late && chargesTotal > 0;
        return (
          <View key={ins.id} style={m.parc}>
            <View style={{ flex: 1 }}>
              <Text style={m.parcT}>
                Parcela {ins.installment_number}/{ins.total_installments}
                {hasCharges
                  ? " · " + fmt(ins.total_due ?? (rem + chargesTotal))
                  : " · " + fmt(rem)}
              </Text>
              <Text style={m.parcS}>Vence {fmtDate(ins.due_date)}</Text>
              {hasCharges && (
                <View style={m.chargesBreakdown}>
                  <View style={m.chargesRow}>
                    <Text style={m.chargesLbl}>Principal em aberto</Text>
                    <Text style={m.chargesVal}>{fmt(rem)}</Text>
                  </View>
                  {(ins.late_fee ?? 0) > 0 && (
                    <View style={m.chargesRow}>
                      <Text style={m.chargesLbl}>Multa</Text>
                      <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_fee ?? 0)}</Text>
                    </View>
                  )}
                  {(ins.late_interest ?? 0) > 0 && (
                    <View style={m.chargesRow}>
                      <Text style={m.chargesLbl}>
                        Mora
                        {(ins.days_charged ?? 0) > 0 && (
                          <Text style={m.chargesDaysChip}> {ins.days_charged}d</Text>
                        )}
                      </Text>
                      <Text style={[m.chargesVal, { color: Colors.red }]}>{fmt(ins.late_interest ?? 0)}</Text>
                    </View>
                  )}
                  <View style={[m.chargesRow, m.chargesTotalRow]}>
                    <Text style={m.chargesTotalLbl}>Total a pagar</Text>
                    <Text style={m.chargesTotalVal}>
                      {fmt(ins.total_due ?? (rem + chargesTotal))}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <View style={[m.badge, { backgroundColor: (late ? Colors.red : Colors.green) + "1A", borderColor: (late ? Colors.red : Colors.green) + "44" }]}>
                <Text style={[m.badgeTxt, { color: late ? Colors.red : Colors.green }]}>{late ? "Em atraso" : "No prazo"}</Text>
              </View>
              <Pressable style={m.calBtn} onPress={() => handleEditDueDateOpen(ins)}>
                <Icon name="Calendar" size={13} color={Colors.violet} />
              </Pressable>
              <Pressable style={m.pixBtn} onPress={() => openInstallmentPix(ins.id)}>
                <Text style={m.pixBtnTxt}>Pix</Text>
              </Pressable>
              <Pressable style={m.receberBtn} onPress={() => prefill(hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem)}>
                <Text style={m.receberTxt}>Receber</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  )}

  <View style={m.card}>
    <Text style={m.cardTitle}>Receber valor livre</Text>
    <Text style={[m.termsHint, { marginBottom: 10 }]}>
      Digite um valor e vamos simular como ele é aplicado nas parcelas antes de confirmar.
    </Text>

    {realCarnes.length > 1 && (
      <View style={{ marginBottom: 12 }}>
        <Text style={m.fieldLabel}>Carnê</Text>
        <View style={m.chipRow}>
          <Pressable
            style={[m.chip, freeAccountId === undefined && m.chipOn]}
            onPress={() => { setFreeAccountId(undefined); triggerPreview(freeAmt, undefined); }}
          >
            <Text style={[m.chipTxt, freeAccountId === undefined && m.chipTxtOn]}>Todos</Text>
          </Pressable>
          {realCarnes.map(acc => (
            <Pressable
              key={acc.id!}
              style={[m.chip, freeAccountId === acc.id && m.chipOn]}
              onPress={() => { setFreeAccountId(acc.id); triggerPreview(freeAmt, acc.id); }}
            >
              <Text style={[m.chipTxt, freeAccountId === acc.id && m.chipTxtOn]}>{acc.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    )}

    <Text style={m.fieldLabel}>Valor recebido</Text>
    <View style={m.amountIn}>
      <Text style={m.amountPrefix}>R$</Text>
      <TextInput
        style={m.amountInput}
        value={freeAmt}
        onChangeText={(v) => {
          const clean = v.replace(/[^\d,.]/g, "");
          setFreeAmt(clean);
          triggerPreview(clean, freeAccountId);
        }}
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
      {totalBalance > 0 && (
        <Pressable style={m.qChip} onPress={() => prefill(totalBalance)}>
          <Text style={m.qChipTxt}>Quitar ({fmt(totalBalance)})</Text>
        </Pressable>
      )}
    </View>

    <Text style={[m.fieldLabel, { marginTop: 12 }]}>Data do recebimento</Text>
    <DateInput
      value={freeDateBr}
      onChangeText={setFreeDateBr}
      placeholder="dd/mm/aaaa"
      style={m.dateInput}
    />
    <Text style={m.dateHint}>Use uma data anterior para registrar um recebimento retroativo.</Text>

    <Text style={[m.fieldLabel, { marginTop: 12 }]}>Forma</Text>
    <View style={m.methods}>
      {PAYMENT_METHODS.map(pm => (
        <Pressable
          key={pm.key}
          style={[m.method, freeMethod === pm.key && m.methodActive]}
          onPress={() => setFreeMethod(pm.key)}
        >
          <Text style={[m.methodTxt, freeMethod === pm.key && { color: "#fff" }]}>{pm.label}</Text>
        </Pressable>
      ))}
    </View>

    {freePreviewLoading && (
      <View style={{ alignItems: "center", marginTop: 14 }}>
        <ActivityIndicator size="small" color={Colors.violet3} />
        <Text style={[m.termsHint, { textAlign: "center", marginTop: 4 }]}>Calculando distribuição...</Text>
      </View>
    )}
    {!freePreviewLoading && freePreview && (
      <View style={m.previewBox}>
        <Text style={m.previewTitle}>Como o valor vai ser aplicado</Text>
        {freePreview.applied.map((line, i) => (
          <View key={line.installment_id + i} style={m.previewRow}>
            <Text style={m.previewLbl}>
              Parcela {line.number ?? "?"}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              {line.charges_paid > 0 && (
                <Text style={[m.previewVal, { fontSize: 10, color: Colors.amber }]}>
                  Encargos: {fmt(line.charges_paid)}
                </Text>
              )}
              <Text style={m.previewVal}>Principal: {fmt(line.principal_paid)}</Text>
              <Text style={[m.previewVal, { fontSize: 10, color: Colors.ink3 }]}>
                {translateStatus(line.status_after)}
              </Text>
            </View>
          </View>
        ))}
        <View style={[m.previewRow, { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 8, marginTop: 4 }]}>
          <Text style={[m.previewLbl, { fontWeight: "700", color: Colors.ink }]}>Novo saldo em aberto</Text>
          <Text style={[m.previewVal, { color: freePreview.new_balance > 0 ? Colors.red : Colors.green, fontSize: 16 }]}>
            {fmt(freePreview.new_balance)}
          </Text>
        </View>
        {freePreview.credit_generated > 0 && (
          <View style={m.previewRow}>
            <Text style={m.previewLbl}>Crédito gerado</Text>
            <Text style={[m.previewVal, { color: Colors.green }]}>{fmt(freePreview.credit_generated)}</Text>
          </View>
        )}
      </View>
    )}

    {/* ── Botões de ação: Gerar Pix (B3) + Confirmar recebimento ── */}
    <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
      <Pressable
        style={[
          m.pixBtn,
          { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 12 },
          freeAmtValue <= 0 && { opacity: 0.4 },
        ]}
        disabled={freeAmtValue <= 0}
        onPress={() => openFreePix(freeAmtValue)}
      >
        <Text style={m.pixBtnTxt}>Gerar Pix</Text>
      </Pressable>

      <Pressable
        style={[m.cta, { flex: 2 }, (freeAmtValue <= 0 || freeSubmitting) && { opacity: 0.45 }]}
        disabled={freeAmtValue <= 0 || freeSubmitting}
        onPress={confirmFreePayment}
      >
        {freeSubmitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={m.ctaTxt}>
              {freeAmtValue > 0 ? `Confirmar recebimento de ${fmt(freeAmtValue)}` : "Confirmar recebimento"}
            </Text>}
      </Pressable>
    </View>
  </View>
</>
  );
}
