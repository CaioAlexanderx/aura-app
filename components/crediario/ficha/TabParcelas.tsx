// ============================================================
// TabParcelas — Aura · Crediário (F3 do redesign; spec §2.3)
//
// ANTES: 3 blocos de JSX quase idênticos (carnê expandido, órfãs,
// sem-carnê), breakdown de encargos + 4 botões SEMPRE visíveis por
// parcela, e o card "Receber valor livre" fixo no fim do scroll.
//
// AGORA:
//  - <ParcelaRow> único (compacto; breakdown + ações via accordion)
//  - "Receber valor livre" SAIU daqui — vive no sheet "Receber
//    pagamento" do shell (CTA fixo no rodapé da ficha)
// Toda a lógica (prefill, pix, renegociar, editar data) permanece no
// shell e chega por props — este arquivo é só apresentação.
//
// 10/10/2026 — carnês por compra (mockup docs/mockups/
// crediario-carnes-por-compra.html): o card "Carnês / contas" virou um
// cartão por carnê (<CarneCard>), com "Compras anteriores" para o que não
// tem carnê e "Quitados · N" recolhido no fim. A derivação de cada cartão
// está em utils/crediarioCarne (testada sozinha). O selo de periodicidade
// (Mensal/Quinzenal) saiu do cartão: não está no desenho aprovado.
// ============================================================
import { useMemo, useState } from "react";
import { isInstallmentOverdue, needsReview } from "@/utils/creditOverdue";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { CreditAccount, CreditInstallment } from "@/services/creditApi";
import { organizarCarnes, type ContaDoCarne, type EscopoCarne } from "@/utils/crediarioCarne";
import { Button } from "@/components/Button";
import { ParcelaRow, type ParcelaBreakdownLine } from "@/components/crediario/ParcelaRow";
import { CarneCard } from "./CarneCard";
import { fmt, fmtDate } from "./fichaHelpers";
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
  /** 10/10/2026: abre a escolha A4/bobina no shell. accountId undefined = todos. */
  onImprimir: (accountId: EscopoCarne, label: string, parcelas: number) => void;
  /** Abre o sheet "Receber pagamento" do shell com valor pré-preenchido.
   *  accountId (10/10/2026): o recebimento mira aquele carnê; sem ele, todos. */
  prefill: (v: number, accountId?: string) => void;
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
  accounts, openInst, useCarneLayout,
  handleCreateAccount, showNewAccount, setShowNewAccount, newAccountName, setNewAccountName, creatingAccount,
  expandedAccountId, setExpandedAccountId,
  handleEditDueDateOpen, onRenegociar, openInstallmentPix, onImprimir, prefill, openBalance,
  customerId, phone, onCobrar, name,
}: TabParcelasProps) {
  // Parcela expandida (uma por vez — progressive disclosure)
  const [expandedInstId, setExpandedInstId] = useState<string | null>(null);
  const [verQuitados, setVerQuitados] = useState(false);

  // 10/10/2026 — cartões de carnê. Além de quando já há carnê de verdade
  // (useCarneLayout), valem quando o backend manda os campos de carnê por
  // compra: aí o grupo sem carnê sozinho também vira o cartão "Compras
  // anteriores". Backend antigo com cliente sem carnê: as três telas do fim
  // deste arquivo, intactas.
  const cartoes = useCarneLayout || accounts.some(a => a.remaining !== undefined || a.purchases !== undefined);
  const { abertos, quitados } = useMemo(
    () => organizarCarnes<CreditInstallment>(accounts as ContaDoCarne[], openInst, isInstallmentOverdue),
    [accounts, openInst],
  );

  const renderParcela = (ins: CreditInstallment) => {
    const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
    // Regra ÚNICA: nunca `status === "overdue"` (congela entre sincronizações).
    const late = isInstallmentOverdue(ins);
    const toReview = !late && needsReview(ins);
    const chargesTotal = ins.charges_total ?? 0;
    const hasCharges = late && chargesTotal > 0;
    const totalHoje = hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem;
    return (
      <ParcelaRow
        key={ins.id}
        title={`Parcela ${ins.installment_number}/${ins.total_installments}`}
        subtitle={
          late
            ? `venceu ${fmtDate(ins.due_date)}${(ins.days_late ?? ins.days_charged ?? 0) > 0 ? ` · ${ins.days_late ?? ins.days_charged}d de atraso` : ""}`
            : toReview
              ? `venceu ${fmtDate(ins.due_date)} · anterior ao cadastro do carnê — confira se já foi paga`
              : `vence ${fmtDate(ins.due_date)} · no prazo`
        }
        amount={fmt(totalHoje)}
        overdue={late}
        expanded={expandedInstId === ins.id}
        onToggle={() => setExpandedInstId(prev => prev === ins.id ? null : ins.id)}
        onEditDate={() => handleEditDueDateOpen(ins)}
        breakdown={buildBreakdown(ins, rem, hasCharges, chargesTotal)}
        actions={
          <>
            {/* Task 03/08 (R5): a ação de 90% dos casos vira o CTA primário de
                largura cheia (alvo ≥44px); Alterar data e Pix descem para a
                linha secundária — nada some, nada trunca em 360px. */}
            <Button title={`Receber ${fmt(totalHoje)}`} variant="primary" size="md" onPress={() => prefill(totalHoje)} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Alterar data" variant="ghost" size="md" full onPress={() => handleEditDueDateOpen(ins)} />
              <Button title="Pix" variant="success" size="md" full onPress={() => openInstallmentPix(ins.id)} />
            </View>
          </>
        }
      />
    );
  };

  return (
<>
  {cartoes && (
    <View style={{ marginBottom: 13 }}>
      <View style={c.secRow}>
        <Text style={m.cardTitle}>Em aberto · {abertos.length}</Text>
        <View style={c.links}>
          <Pressable
            style={c.link}
            onPress={() => onImprimir(undefined, name, openInst.length)}
            accessibilityRole="button"
            testID="carnes-imprimir-todos"
          >
            <Text style={c.linkT}>Imprimir todos</Text>
          </Pressable>
          {/* "Novo carnê" manual continua existindo — discreto: o normal agora
              é o carnê nascer da venda. */}
          <Pressable
            style={c.link}
            onPress={() => { setShowNewAccount(v => !v); setNewAccountName(""); }}
            accessibilityRole="button"
            testID="carnes-novo-carne"
          >
            <Text style={[c.linkT, { color: Colors.ink3 }]}>Novo carnê</Text>
          </Pressable>
        </View>
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

      {abertos.map((carne) => {
        const isExpanded = expandedAccountId === carne.id;
        // Renegociar precisa de parcela para substituir. No grupo sem carnê o
        // saldo sem agenda ainda pode ser parcelado (10/07, "Parcelar saldo").
        const podeRenegociar = carne.parcelasAbertas.length > 0;
        const podeParcelar = !podeRenegociar && carne.semCarne && carne.semParcelas;
        return (
          <CarneCard
            key={carne.key}
            carne={carne}
            expanded={isExpanded}
            onToggle={() => setExpandedAccountId(isExpanded ? undefined : carne.id)}
            renderParcela={renderParcela}
            // Receber do carnê cai NESTE carnê; o grupo sem carnê não tem id
            // para mirar e segue a regra de sempre (parcela mais antiga primeiro).
            onReceber={() => prefill(carne.falta, carne.id ?? undefined)}
            onImprimir={() => onImprimir(carne.id, carne.nome, carne.parcelasAbertas.length)}
            onRenegociar={
              podeRenegociar ? () => onRenegociar(carne.id, carne.nome, carne.somaParcelas)
                : podeParcelar ? () => onRenegociar(null, "Saldo em aberto", carne.falta)
                  : undefined
            }
            renegociarLabel={podeParcelar ? "Parcelar saldo" : "Renegociar"}
            onCobrar={phone && onCobrar ? () => onCobrar(customerId!, name, phone) : undefined}
          />
        );
      })}

      {abertos.length === 0 && (
        <View style={[m.card, { alignItems: "center", paddingVertical: 22 }]}>
          <Text style={m.emptyTxt}>Nenhum carnê em aberto. 🎉</Text>
        </View>
      )}

      {quitados.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <View style={c.secRow}>
            <Text style={m.cardTitle}>Quitados · {quitados.length}</Text>
            <Pressable
              style={c.link}
              onPress={() => setVerQuitados(v => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: verQuitados }}
              testID="carnes-quitados-toggle"
            >
              <Text style={c.linkT}>{verQuitados ? "Ocultar" : "Ver todos"}</Text>
            </Pressable>
          </View>
          {verQuitados && quitados.map(q => (
            <View key={q.key} style={c.done} testID="carne-quitado">
              <Text style={c.doneK}>
                <Text style={{ color: Colors.green, fontWeight: "800" }}>✓ </Text>
                {q.nome}{q.itensResumo ? ` · ${q.itensResumo}` : ""}
              </Text>
              {q.valorOriginal != null && <Text style={c.doneV}>{fmt(q.valorOriginal)}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  )}

  {!cartoes && openInst.length > 0 && (
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
            onPress={() => onImprimir(undefined, name, openInst.length)}
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
  {!cartoes && openInst.length === 0 && openBalance > 0 && (
    <View style={[m.card, { alignItems: "center", paddingVertical: 22 }]}>
      <Text style={m.cardTitle}>Saldo em aberto sem parcelas</Text>
      <Text style={[m.emptyTxt, { textAlign: "center", marginTop: 6, lineHeight: 18 }]}>
        Este cliente tem {fmt(openBalance)} em aberto de venda no crediário sem
        parcelamento. Registre recebimentos de qualquer valor pelo botão abaixo.
      </Text>
      <View style={{ marginTop: 14, alignSelf: "stretch", flexDirection: "row", gap: 8 }}>
        <Button title={`Receber ${fmt(openBalance)}`} variant="primary" size="sm" full onPress={() => prefill(openBalance)} />
        {/* Parcelar saldo (10/07): conecta o fiado a um prazo — abre a renegociação
            com base no saldo sem agenda (backend cai no getUnscheduledBalance). */}
        <Button title="Parcelar saldo" variant="ghost" size="sm" full onPress={() => onRenegociar(null, "Saldo em aberto", openBalance)} />
      </View>
    </View>
  )}

  {!cartoes && openInst.length === 0 && openBalance <= 0 && (
    <View style={[m.card, { alignItems: "center", paddingVertical: 26 }]}>
      <Text style={m.emptyTxt}>Nenhuma parcela em aberto. 🎉</Text>
    </View>
  )}
</>
  );
}

// Cabeçalhos de seção e linhas de quitado (10/10/2026).
const c = StyleSheet.create({
  // flexWrap: em 360px os links descem para a linha de baixo em vez de
  // espremer o título.
  secRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", columnGap: 10, marginBottom: 4, marginHorizontal: 2,
  },
  links: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 14, marginLeft: "auto" as any },
  // Link de texto com alvo de toque de 44px.
  link: { minHeight: 44, justifyContent: "center" },
  linkT: { fontSize: 12.5, fontWeight: "600", color: Colors.violet3 },
  done: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
    paddingVertical: 9, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  doneK: { flex: 1, minWidth: 0, fontSize: 13, color: Colors.ink3 },
  doneV: { fontSize: 13, color: Colors.ink3, fontVariant: ["tabular-nums"] as any },
});
