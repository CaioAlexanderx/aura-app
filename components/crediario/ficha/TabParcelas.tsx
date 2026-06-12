import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  printCarne,
  type CreditAccount, type CreditInstallment, type PaymentPlan,
} from "@/services/creditApi";
import { DateInput } from "@/components/inputs/DateInput";
import {
  fmt, fmtDate, parseAmount, periodLabel, scoreColor, scoreLabelPt,
  PAYMENT_METHODS, type ReceiveMode, productsFromNotes,
} from "./fichaHelpers";
import { m } from "./fichaStyles";

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
  amount: string;
  setAmount: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
  dateBr: string;
  setDateBr: (v: string) => void;
  dateInvalid: boolean;
  receiveMode: ReceiveMode;
  setReceiveMode: (v: ReceiveMode) => void;
  fifoAccountId: string | null | undefined;
  setFifoAccountId: (v: string | null | undefined) => void;
  distributions: Record<string, string>;
  setDistributions: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  distributionTotal: number;
  amountNum: number;
  afterBalance: number;
  payMut: { isPending: boolean };
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
  lastChargesPaid: number | null;
  lastTotalPaid: number | null;
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
  amount, setAmount, method, setMethod, dateBr, setDateBr, dateInvalid,
  receiveMode, setReceiveMode, fifoAccountId, setFifoAccountId,
  distributions, setDistributions, distributionTotal,
  amountNum, afterBalance, payMut,
  handleCreateAccount, showNewAccount, setShowNewAccount, newAccountName, setNewAccountName, creatingAccount,
  expandedAccountId, setExpandedAccountId,
  handleEditDueDateOpen, openInstallmentPix,
  lastChargesPaid, lastTotalPaid,
  freeAmt, setFreeAmt, freeMethod, setFreeMethod, freeDateBr, setFreeDateBr,
  freeAccountId, setFreeAccountId, freePreview, freePreviewLoading,
  confirmFreePayment, freeSubmitting, prefill, triggerPreview,
  companyId, customerId, phone, onCobrar, name,
}: TabParcelasProps) {
  const hasAccounts = accounts.length > 0;
  return (
<>
  {!!profile && (
    <View style={m.card}>
      <Text style={m.cardTitle}>Crédito</Text>
      <View style={m.row}>
        <Text style={m.rowK}>Score</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[m.rowV, { color: scoreColor(scoreLabel), fontSize: 15 }]}>
            {profile.credit_score}
          </Text>
          {!!scoreLabel && (
            <View style={[m.scorePill, { backgroundColor: scoreColor(scoreLabel) + "22" }]}>
              <Text style={[m.scorePillTxt, { color: scoreColor(scoreLabel) }]}>
                {scoreLabelPt(scoreLabel)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={m.row}>
        <Text style={m.rowK}>Limite total</Text>
        <Text style={m.rowV}>{fmt(profile.credit_limit)}</Text>
      </View>
      {availableLimit !== undefined && (
        <View style={m.row}>
          <Text style={m.rowK}>Disponível</Text>
          <Text style={[m.rowV, { color: availableLimit >= 0 ? Colors.green : Colors.red }]}>
            {fmt(availableLimit)}
          </Text>
        </View>
      )}
    </View>
  )}

  <View style={m.heroCard}>
    <Text style={m.heroLabel}>EM ABERTO</Text>
    <Text style={[m.heroValue, { color: totalBalance > 0 ? Colors.red : Colors.ink3 }]}>
      {fmt(totalBalance)}
    </Text>
    <Text style={m.heroSub}>
      {openInst.length} parcela{openInst.length !== 1 ? "s" : ""}
      {openInst.length > 0 && fmtDate(nextDueDate)
        ? ` · próximo venc. ${fmtDate(nextDueDate)}`
        : ""}
    </Text>
  </View>

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
                onPress={() => {
                  setReceiveMode("fifo");
                  setFifoAccountId(acc.id);
                  prefill(acc.balance);
                }}
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

  <View style={m.freeBox}>
    <Text style={m.freeTitle}>Receber valor livre</Text>

    {hasAccounts && (
      <View style={m.modeRow}>
        {(["fifo", "distribute"] as ReceiveMode[]).map(mode => (
          <Pressable
            key={mode}
            style={[m.modeChip, receiveMode === mode && m.modeChipOn]}
            onPress={() => setReceiveMode(mode)}
          >
            <Text style={[m.modeChipTxt, receiveMode === mode && m.modeChipTxtOn]}>
              {mode === "fifo" ? "Em um carnê" : "Distribuir entre carnês"}
            </Text>
          </Pressable>
        ))}
      </View>
    )}

    {hasAccounts && receiveMode === "fifo" && (
      <View style={[m.fieldBlock, { marginTop: 10 }]}>
        <Text style={m.fieldLabel}>Carnê</Text>
        <View style={m.chipRow}>
          <Pressable
            style={[m.chip, fifoAccountId === undefined && m.chipOn]}
            onPress={() => setFifoAccountId(undefined)}
          >
            <Text style={[m.chipTxt, fifoAccountId === undefined && m.chipTxtOn]}>Todos os carnês</Text>
          </Pressable>
          {accounts.map(acc => (
            <Pressable
              key={acc.id ?? "general"}
              style={[m.chip, fifoAccountId === acc.id && m.chipOn]}
              onPress={() => setFifoAccountId(acc.id)}
            >
              <Text style={[m.chipTxt, fifoAccountId === acc.id && m.chipTxtOn]}>{acc.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    )}

    {hasAccounts && receiveMode === "distribute" && (
      <View style={m.fieldBlock}>
        {accounts.map(acc => {
          const key = acc.id ?? "general";
          return (
            <View key={key} style={m.distRow}>
              <Text style={m.distLabel} numberOfLines={1}>{acc.name}</Text>
              <View style={m.distInput}>
                <Text style={m.amountPrefix}>R$</Text>
                <TextInput
                  style={m.distField}
                  value={distributions[key] || ""}
                  onChangeText={v => setDistributions(prev => ({ ...prev, [key]: v.replace(/[^\d,.]/g, "") }))}
                  placeholder="0,00"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          );
        })}
        <View style={m.distTotal}>
          <Text style={m.distTotalLbl}>Total</Text>
          <Text style={m.distTotalVal}>{fmt(distributionTotal)}</Text>
        </View>
      </View>
    )}

    {(!hasAccounts || receiveMode === "fifo") && (
      <>
        <Text style={m.fieldLabel}>Valor recebido</Text>
        <View style={m.amountIn}>
          <Text style={m.amountPrefix}>R$</Text>
          <TextInput
            style={m.amountInput}
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^\d,.]/g, ""))}
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
      </>
    )}

    <Text style={[m.fieldLabel, { marginTop: 14 }]}>Data do recebimento</Text>
    <DateInput
      value={dateBr}
      onChangeText={setDateBr}
      placeholder="dd/mm/aaaa"
      style={m.dateInput}
    />
    <Text style={m.dateHint}>Use uma data anterior para registrar um recebimento retroativo.</Text>

    <Text style={[m.fieldLabel, { marginTop: 14 }]}>Forma</Text>
    <View style={m.methods}>
      {PAYMENT_METHODS.map(pm => (
        <Pressable key={pm.key} style={[m.method, method === pm.key && m.methodActive]} onPress={() => setMethod(pm.key)}>
          <Text style={[m.methodTxt, method === pm.key && { color: "#fff" }]}>{pm.label}</Text>
        </Pressable>
      ))}
    </View>

    {amountNum > 0 && (
      <View style={m.after}>
        <Text style={m.afterK}>Saldo após recebimento</Text>
        <Text style={m.afterV}>{fmt(afterBalance)}</Text>
      </View>
    )}

    {lastChargesPaid != null && lastChargesPaid > 0 && lastTotalPaid != null && (
      <View style={m.chargesSummary}>
        <View style={m.chargesSummaryRow}>
          <Text style={m.chargesSummaryLbl}>Encargos quitados</Text>
          <Text style={[m.chargesSummaryVal, { color: Colors.red }]}>{fmt(lastChargesPaid)}</Text>
        </View>
        <View style={m.chargesSummaryRow}>
          <Text style={m.chargesSummaryLbl}>Abatido do principal</Text>
          <Text style={m.chargesSummaryVal}>{fmt(Math.max(0, lastTotalPaid - lastChargesPaid))}</Text>
        </View>
      </View>
    )}
  </View>

  <View style={m.card}>
    <Text style={m.cardTitle}>Valor Livre · Preview FIFO</Text>
    <Text style={[m.termsHint, { marginBottom: 10 }]}>
      Digite um valor para ver como será distribuído entre as parcelas (FIFO). Depois confirme para aplicar.
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

    <Text style={[m.fieldLabel, { marginTop: 12 }]}>Data do recebimento</Text>
    <DateInput
      value={freeDateBr}
      onChangeText={setFreeDateBr}
      placeholder="dd/mm/aaaa"
      style={m.dateInput}
    />

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
        <Text style={m.previewTitle}>Distribuição FIFO</Text>
        {freePreview.applied.map((line, i) => (
          <View key={line.installment_id + i} style={m.previewRow}>
            <Text style={m.previewLbl}>
              Parcela {line.number ?? "?"}{line.account_id ? "" : ""}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              {line.charges_paid > 0 && (
                <Text style={[m.previewVal, { fontSize: 10, color: Colors.amber }]}>
                  Encargos: {fmt(line.charges_paid)}
                </Text>
              )}
              <Text style={m.previewVal}>Principal: {fmt(line.principal_paid)}</Text>
              <Text style={[m.previewVal, { fontSize: 10, color: Colors.ink3 }]}>{line.status_after}</Text>
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

    <Pressable
      style={[m.cta, { marginTop: 14 }, (parseAmount(freeAmt) <= 0 || freeSubmitting) && { opacity: 0.45 }]}
      disabled={parseAmount(freeAmt) <= 0 || freeSubmitting}
      onPress={confirmFreePayment}
    >
      {freeSubmitting
        ? <ActivityIndicator color="#fff" />
        : <Text style={m.ctaTxt}>
            {parseAmount(freeAmt) > 0 ? `Confirmar ${fmt(parseAmount(freeAmt))}` : "Confirmar recebimento"}
          </Text>}
    </Pressable>
  </View>

  <View style={m.card}>
    <Text style={m.cardTitle}>Histórico de pagamentos</Text>
    {(detail?.transactions || []).length === 0 ? (
      <Text style={m.emptyTxt}>Sem movimentações ainda.</Text>
    ) : (
      (detail?.transactions || []).map((t) => {
        const isPay = t.type === "payment";
        const prods = productsFromNotes(t.notes);
        return (
          <View key={t.id} style={m.tlItem}>
            <View style={[m.tlDot, { backgroundColor: isPay ? Colors.green : Colors.violet3 }]} />
            <View style={{ flex: 1 }}>
              <View style={m.tlLine}>
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <Text style={m.tlMain}>{isPay ? `Recebimento${t.payment_method ? " · " + t.payment_method : ""}` : "Compra no crediário"}</Text>
                  {t.account_name && (
                    <View style={m.tlAccTag}>
                      <Text style={m.tlAccTagTxt}>{t.account_name}</Text>
                    </View>
                  )}
                </View>
                <Text style={[m.tlAmt, { color: isPay ? Colors.green : Colors.ink }]}>{isPay ? "+ " : ""}{fmt(t.amount)}</Text>
              </View>
              <Text style={m.tlSub}>{fmtDate(t.created_at)}{prods ? ` · ${prods}` : (t.notes && !isPay ? ` · ${t.notes}` : "")}</Text>
            </View>
          </View>
        );
      })
    )}
  </View>
</>
  );
}
