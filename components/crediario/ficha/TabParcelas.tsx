// ============================================================
// TabParcelas — Aura · Crediário (F3 do redesign; spec §2.3)
//
// ANTES: 3 blocos de JSX quase idênticos (carnê expandido, órfãs,
// sem-carnê), breakdown de encargos + 4 botões SEMPRE visíveis por
// parcela, e o card "Receber valor livre" fixo no fim do scroll.
//
// AGORA:
//  - <ParcelaRow> único (compacto; breakdown + ações via accordion)
//  - Carnês com Collapsible animado + chevron; "Receber" é o único
//    CTA primário do carnê, demais ações viram botões ghost sm
//  - "Receber valor livre" SAIU daqui — vive no sheet "Receber
//    pagamento" do shell (CTA fixo no rodapé da ficha)
// Toda a lógica (prefill, pix, renegociar, editar data) permanece no
// shell e chega por props — este arquivo é só apresentação.
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Animated } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  printCarne,
  type CreditAccount, type CreditInstallment,
} from "@/services/creditApi";
import { Collapsible } from "@/components/anim";
import { Button } from "@/components/Button";
import { ParcelaRow, type ParcelaBreakdownLine } from "@/components/crediario/ParcelaRow";
import { fmt, fmtDate, periodLabel } from "./fichaHelpers";
import { m } from "./fichaStyles";

// Soma do restante (principal em aberto) de uma lista de parcelas.
function sumRemaining(list: CreditInstallment[]): number {
  return list.reduce((s, i) => s + (i.remaining ?? (i.amount_due - (i.covered_amount || 0))), 0);
}

/** Monta o breakdown de encargos da parcela para o ParcelaRow. */
function buildBreakdown(ins: CreditInstallment, rem: number, hasCharges: boolean, chargesTotal: number): ParcelaBreakdownLine[] {
  if (!hasCharges) {
    return [{ label: "Valor da parcela", value: fmt(rem), total: true }];
  }
  const lines: ParcelaBreakdownLine[] = [{ label: "Principal em aberto", value: fmt(rem) }];
  if ((ins.late_fee ?? 0) > 0) lines.push({ label: "Multa", value: fmt(ins.late_fee ?? 0) });
  if ((ins.late_interest ?? 0) > 0) {
    lines.push({
      label: `Mora${(ins.days_charged ?? 0) > 0 ? ` · ${ins.days_charged}d` : ""}`,
      value: fmt(ins.late_interest ?? 0),
    });
  }
  lines.push({ label: "Total a pagar hoje", value: fmt(ins.total_due ?? (rem + chargesTotal)), total: true });
  return lines;
}

export type TabParcelasProps = {
  accounts: CreditAccount[];
  openInst: CreditInstallment[];
  instByAccount: Map<string | null, CreditInstallment[]>;
  useCarneLayout: boolean;
  handleCreateAccount: () => void;
  showNewAccount: boolean;
  setShowNewAccount: (fn: (v: boolean) => boolean) => void;
  newAccountName: string;
  setNewAccountName: (v: string) => void;
  creatingAccount: boolean;
  expandedAccountId: string | null | undefined;
  setExpandedAccountId: (v: string | null | undefined) => void;
  handleEditDueDateOpen: (inst: CreditInstallment) => void;
  onRenegociar: (accountId: string | null | undefined, scopeLabel: string, openRemaining: number) => void;
  openInstallmentPix: (id: string) => void;
  /** Abre o sheet "Receber pagamento" do shell com valor pré-preenchido. */
  prefill: (v: number) => void;
  /** Saldo total em aberto do ledger — pode ser > 0 SEM nenhuma parcela
   *  (venda no crediário em 1x/fiado não gera agenda de parcelas). */
  openBalance: number;
  companyId: string;
  customerId: string;
  phone: string | null;
  onCobrar?: ((customerId: string, customerName: string, phone: string | null) => void) | undefined;
  name: string;
};

export function TabParcelas({
  accounts, openInst, instByAccount, useCarneLayout,
  handleCreateAccount, showNewAccount, setShowNewAccount, newAccountName, setNewAccountName, creatingAccount,
  expandedAccountId, setExpandedAccountId,
  handleEditDueDateOpen, onRenegociar, openInstallmentPix, prefill, openBalance,
  companyId, customerId, phone, onCobrar, name,
}: TabParcelasProps) {
  // Parcela expandida (uma por vez — progressive disclosure)
  const [expandedInstId, setExpandedInstId] = useState<string | null>(null);

  const renderParcela = (ins: CreditInstallment) => {
    const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
    const late = ins.status === "overdue";
    const chargesTotal = ins.charges_total ?? 0;
    const hasCharges = late && chargesTotal > 0;
    const totalHoje = hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem;
    return (
      <ParcelaRow
        key={ins.id}
        title={`Parcela ${ins.installment_number}/${ins.total_installments}`}
        subtitle={late ? `venceu ${fmtDate(ins.due_date)}${(ins.days_charged ?? 0) > 0 ? ` · ${ins.days_charged}d de atraso` : ""}` : `vence ${fmtDate(ins.due_date)} · no prazo`}
        amount={fmt(totalHoje)}
        overdue={late}
        expanded={expandedInstId === ins.id}
        onToggle={() => setExpandedInstId(prev => prev === ins.id ? null : ins.id)}
        onEditDate={() => handleEditDueDateOpen(ins)}
        breakdown={buildBreakdown(ins, rem, hasCharges, chargesTotal)}
        actions={
          <>
            <Button title="Alterar data" variant="ghost" size="sm" full onPress={() => handleEditDueDateOpen(ins)} />
            <Button title="Pix" variant="success" size="sm" full onPress={() => openInstallmentPix(ins.id)} />
            <Button title="Receber" variant="primary" size="sm" full onPress={() => prefill(totalHoje)} />
          </>
        }
      />
    );
  };

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
            {/* Cabeçalho do carnê (accordion) — colapsado mostra só o essencial */}
            <Pressable
              style={m.accTop}
              onPress={() => setExpandedAccountId(isExpanded ? undefined : acc.id)}
              accessibilityRole="button"
              accessibilityLabel={`Carnê ${acc.name}, saldo ${fmt(acc.balance)}. Toque para ${isExpanded ? "recolher" : "expandir"}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={m.accName}>{acc.name}</Text>
                <View style={m.accMeta}>
                  <View style={[m.accBadge, { backgroundColor: statusColor + "18", borderColor: statusColor + "33" }]}>
                    <Text style={[m.accBadgeTxt, { color: statusColor }]}>{isOverdueAcc ? "Em atraso" : "Em dia"}</Text>
                  </View>
                  {periodLabel(acc) ? (
                    <View style={[m.accBadge, { backgroundColor: Colors.violet3 + "22", borderColor: Colors.violet3 + "44" }]}>
                      <Text style={[m.accBadgeTxt, { color: Colors.violet3 }]}>{periodLabel(acc)}</Text>
                    </View>
                  ) : null}
                  {accInst.length > 0 && (
                    <Text style={m.accNextDue}>{accInst.length} parcela{accInst.length !== 1 ? "s" : ""}</Text>
                  )}
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={[m.accBalance, { color: acc.balance > 0 ? Colors.red : Colors.ink3 }]}>
                  {fmt(acc.balance)}
                </Text>
                {!!fmtDate(acc.next_due_date || "") && (
                  <Text style={m.accNextDue}>Próx. {fmtDate(acc.next_due_date!)}</Text>
                )}
              </View>
              <Animated.View style={isExpanded ? ({ transform: [{ rotate: "90deg" }] } as any) : undefined}>
                <Icon name="chevron_right" size={15} color={isExpanded ? Colors.violet3 : Colors.ink3} />
              </Animated.View>
            </Pressable>

            <Collapsible open={isExpanded}>
              <View style={{ marginTop: 10 }}>
                {accInst.length > 0
                  ? accInst.map(renderParcela)
                  : <Text style={m.emptyTxt}>Sem parcelas abertas neste carnê.</Text>}
              </View>
            </Collapsible>

            {/* F4.3 (pente-fino): ações do carnê SEMPRE visíveis, como antes da F3 —
                Renegociar escondido no accordion fez lojista achar que a função sumiu */}
            <View style={m.accActions}>
              <Button title="Receber" variant="primary" size="sm" onPress={() => prefill(acc.balance)} />
              {accInst.length > 0 && (
                <Button title="Renegociar" variant="ghost" size="sm" onPress={() => onRenegociar(acc.id, acc.name, sumRemaining(accInst))} />
              )}
              <Button title="Imprimir" variant="ghost" size="sm" onPress={() => printCarne(companyId, customerId!)} />
              {!!phone && (
                <Button title="Cobrar" variant="success" size="sm" onPress={() => onCobrar?.(customerId!, name, phone)} />
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
            <Text style={[m.accName, { color: Colors.ink3, marginBottom: 8 }]}>Sem carnê</Text>
            {orphan.map(renderParcela)}
            <View style={m.accActions}>
              <Button title="Renegociar" variant="ghost" size="sm" onPress={() => onRenegociar(null, "Sem carnê", sumRemaining(orphan))} />
            </View>
          </View>
        );
      })()}
    </View>
  )}

  {!useCarneLayout && openInst.length > 0 && (
    <View style={m.card}>
      <View style={m.cardTitleRow}>
        <Text style={m.cardTitle}>Parcelas em aberto</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            style={[m.newAccBtn, { gap: 4 }]}
            onPress={() => onRenegociar(null, "Parcelas em aberto", sumRemaining(openInst))}
          >
            <Icon name="repeat" size={12} color={Colors.violet3} />
            <Text style={m.newAccTxt}>Renegociar</Text>
          </Pressable>
          <Pressable
            style={[m.newAccBtn, { gap: 4 }]}
            onPress={() => printCarne(companyId, customerId!)}
          >
            <Icon name="printer" size={12} color={Colors.violet3} />
            <Text style={m.newAccTxt}>Imprimir carnê</Text>
          </Pressable>
        </View>
      </View>
      {openInst.map(renderParcela)}
    </View>
  )}

  {/* Fix 10/07 (relato Jenniffer): saldo > 0 SEM parcelas (venda 1x/fiado não
      gera agenda) mostrava "Nenhuma parcela em aberto 🎉" — contradizia o
      EM ABERTO do topo e escondia o caminho para receber. */}
  {!useCarneLayout && openInst.length === 0 && openBalance > 0 && (
    <View style={[m.card, { alignItems: "center", paddingVertical: 22 }]}>
      <Text style={m.cardTitle}>Saldo em aberto sem parcelas</Text>
      <Text style={[m.emptyTxt, { textAlign: "center", marginTop: 6, lineHeight: 18 }]}>
        Este cliente tem {fmt(openBalance)} em aberto de venda no crediário sem
        parcelamento. Registre recebimentos de qualquer valor pelo botão abaixo.
      </Text>
      <View style={{ marginTop: 14, alignSelf: "stretch" }}>
        <Button title={`Receber ${fmt(openBalance)}`} variant="primary" size="sm" full onPress={() => prefill(openBalance)} />
      </View>
    </View>
  )}

  {!useCarneLayout && openInst.length === 0 && openBalance <= 0 && (
    <View style={[m.card, { alignItems: "center", paddingVertical: 26 }]}>
      <Text style={m.emptyTxt}>Nenhuma parcela em aberto. 🎉</Text>
    </View>
  )}
</>
  );
}
