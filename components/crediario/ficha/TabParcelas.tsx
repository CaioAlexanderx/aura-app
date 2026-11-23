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
//
// 23/11/2026 (F1 do redesenho da ficha): o Cobrar saiu do cartão do carnê
// (um Cobrar só, no alto da ficha) e os nomes mudaram — "Parcela 1 de 3",
// "vence 20/12" (sem o "· no prazo"), "19 dias de atraso", "Mudar as
// parcelas", "Dividir em parcelas", "Criar carnê vazio".
//
// 23/11/2026 (F4 do redesenho): sem sanfona dentro de sanfona. Nos cartões
// de carnê a parcela a pagar é uma linha só (<LinhaDaParcela>): número, data
// com o lápis sempre à vista, multa e juros em frase quando houver, valor e
// "Receber". O "Pix" da linha saiu (o "Gerar Pix" está no Receber
// pagamento) e o "Alterar data" também (é o lápis). Juntar, Imprimir todos e
// Criar carnê vazio foram para o "⋯" do alto da ficha. A ParcelaRow com
// sanfona continua só na lista do backend antigo (sem carnês).
// ============================================================
import { useMemo, useState } from "react";
import { isInstallmentOverdue, needsReview } from "@/utils/creditOverdue";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import type { CreditAccount, CreditInstallment } from "@/services/creditApi";
import { organizarCarnes, type ContaDoCarne, type EscopoCarne } from "@/utils/crediarioCarne";
import { dataDoVencimento, diaEmSaoPaulo } from "@/utils/crediarioMovimentacao";
import { Button } from "@/components/Button";
import { ParcelaRow, type ParcelaBreakdownLine } from "@/components/crediario/ParcelaRow";
import { CarneCard } from "./CarneCard";
import { fmt } from "./fichaHelpers";
import { m, CorDaFicha } from "./fichaStyles";

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
  /** 10/10/2026: abre o "Juntar carnês". Ausente = menos de 2 carnês com saldo. */
  onJuntar?: () => void;
  /** 09/11/2026: pede a exclusão do carnê (confirmação no shell). Ausente = sem o botão. */
  onExcluirCarne?: (carne: { id: string; nome: string; falta: number }) => void;
  /** Abre o sheet "Receber pagamento" do shell com valor pré-preenchido.
   *  accountId (10/10/2026): o recebimento mira aquele carnê; sem ele, todos. */
  prefill: (v: number, accountId?: string) => void;
  /** Saldo total em aberto do ledger — pode ser > 0 SEM nenhuma parcela
   *  (venda no crediário em 1x/fiado não gera agenda de parcelas). */
  openBalance: number;
  companyId: string;
  customerId: string;
  phone: string | null;
  /** 23/11/2026: o carnê não cobra mais (um Cobrar só, no alto da ficha).
   *  Continua aceito para não mexer em quem já passa. */
  onCobrar?: ((customerId: string, customerName: string, phone: string | null, carne?: { id: string | null }) => void) | undefined;
  name: string;
};

export function TabParcelas({
  accounts, openInst, useCarneLayout,
  handleCreateAccount, showNewAccount, setShowNewAccount, newAccountName, setNewAccountName, creatingAccount,
  expandedAccountId, setExpandedAccountId,
  handleEditDueDateOpen, onRenegociar, openInstallmentPix, onImprimir, onExcluirCarne, prefill, openBalance,
  name,
}: TabParcelasProps) {
  // Parcela expandida (uma por vez) — só na lista do backend antigo.
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

  // Só carnê de verdade e aberto tem "Excluir carnê": o grupo sem carnê não
  // tem id, e cancelado/juntado não tem o que excluir (o backend nem manda).
  const excluiveis = useMemo(
    () => new Set(accounts.filter(a => a.id && (!a.status || a.status === "open")).map(a => a.id as string)),
    [accounts],
  );

  const renderParcela = (ins: CreditInstallment) => {
    const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
    // Regra ÚNICA: nunca `status === "overdue"` (congela entre sincronizações).
    const late = isInstallmentOverdue(ins);
    const toReview = !late && needsReview(ins);
    const chargesTotal = ins.charges_total ?? 0;
    const hasCharges = late && chargesTotal > 0;
    const totalHoje = hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem;
    const diasDeAtraso = ins.days_late ?? ins.days_charged ?? 0;
    // Ano só quando não é o corrente ("vence 20/12/27").
    const venc = dataDoVencimento(ins.due_date, diaEmSaoPaulo(new Date().toISOString()));
    return (
      <ParcelaRow
        key={ins.id}
        title={`Parcela ${ins.installment_number} de ${ins.total_installments}`}
        subtitle={
          late
            ? [
                `venceu ${venc}`,
                // Os dias vêm antes dos encargos: é o que a lojista procura.
                diasDeAtraso > 0 ? `${diasDeAtraso} ${diasDeAtraso === 1 ? "dia" : "dias"} de atraso` : "",
                hasCharges ? `${fmt(rem)} + ${fmt(chargesTotal)} de multa e juros` : "",
              ].filter(Boolean).join(" · ")
            : toReview
              ? `venceu ${venc} · antes de o carnê ser cadastrado — confira se já foi paga`
              : `vence ${venc}`
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

  // F4: a linha da parcela no cartão do carnê — sem sanfona.
  const renderLinha = (ins: CreditInstallment, indice: number) => {
    const rem = ins.remaining ?? (ins.amount_due - (ins.covered_amount || 0));
    const late = isInstallmentOverdue(ins);
    const toReview = !late && needsReview(ins);
    const chargesTotal = ins.charges_total ?? 0;
    const hasCharges = late && chargesTotal > 0;
    const totalHoje = hasCharges ? (ins.total_due ?? (rem + chargesTotal)) : rem;
    const diasDeAtraso = ins.days_late ?? ins.days_charged ?? 0;
    const hoje = diaEmSaoPaulo(new Date().toISOString());
    const venc = dataDoVencimento(ins.due_date, hoje);
    // Vencida dentro da carência: não é atraso, mas a data já passou.
    const jaVenceu = late || toReview || (diaEmSaoPaulo(ins.due_date) || "9999") < hoje;
    const jaPago = Number(ins.covered_amount || 0);
    const porque = late
      ? [
          hasCharges ? `${fmt(rem)} + ${fmt(chargesTotal)} de multa e juros` : "",
          diasDeAtraso > 0 ? `${diasDeAtraso} ${diasDeAtraso === 1 ? "dia" : "dias"} de atraso` : "",
        ].filter(Boolean).join(" · ")
      : toReview
        ? "antes de o carnê ser cadastrado — confira se já foi paga"
        : jaPago > 0.009 ? `já tem ${fmt(jaPago)} pago` : "";
    return (
      <LinhaDaParcela
        key={ins.id}
        numero={`${ins.installment_number} de ${ins.total_installments}`}
        data={`${jaVenceu ? "venceu" : "vence"} ${venc}`}
        porque={porque}
        valor={fmt(totalHoje)}
        atrasada={late}
        principal={indice === 0}
        onData={() => handleEditDueDateOpen(ins)}
        // 23/11/2026 (revisão da F4): o Receber da linha mira o carnê DELA —
        // quem toca Receber no carnê B espera abater o B. Antes ia para a
        // parcela mais antiga de qualquer carnê.
        onReceber={() => prefill(totalHoje, ins.account_id ?? undefined)}
        // O Pix da parcela volta (o Caio não aprovou tirar).
        onPix={() => openInstallmentPix(ins.id)}
      />
    );
  };

  return (
<>
  {cartoes && (
    <View style={{ marginBottom: 13 }}>
      {showNewAccount && (
        <View style={m.newAccRow}>
          <TextInput
            style={m.newAccInput}
            placeholder="Nome do carnê"
            placeholderTextColor={CorDaFicha.secundario}
            value={newAccountName}
            onChangeText={setNewAccountName}
            autoFocus
          />
          <Pressable
            style={[m.newAccConfirm, { minHeight: 44 }, creatingAccount && { opacity: 0.5 }]}
            onPress={handleCreateAccount}
            disabled={creatingAccount}
            accessibilityRole="button"
          >
            {creatingAccount
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={m.newAccConfirmTxt}>Criar</Text>}
          </Pressable>
          <Pressable
            style={c.cancelar}
            onPress={() => { setShowNewAccount(() => false); setNewAccountName(""); }}
            disabled={creatingAccount}
            accessibilityRole="button"
            testID="carnes-novo-carne-cancelar"
          >
            <Text style={c.linkT}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      {abertos.map((carne) => {
        // Renegociar precisa de parcela para substituir. No grupo sem carnê o
        // saldo sem agenda ainda pode ser parcelado (10/07, "Parcelar saldo").
        const podeRenegociar = carne.parcelasAbertas.length > 0;
        const podeParcelar = !podeRenegociar && carne.semCarne && carne.semParcelas;
        return (
          <CarneCard
            key={carne.key}
            carne={carne}
            renderParcela={renderLinha}
            // Receber do carnê cai NESTE carnê; o grupo sem carnê não tem id
            // para mirar e segue a regra de sempre (parcela mais antiga primeiro).
            onReceber={() => prefill(carne.falta, carne.id ?? undefined)}
            onImprimir={() => onImprimir(carne.id, carne.nome, carne.parcelasAbertas.length)}
            onRenegociar={
              podeRenegociar ? () => onRenegociar(carne.id, carne.nome, carne.somaParcelas)
                : podeParcelar ? () => onRenegociar(null, "Saldo em aberto", carne.falta)
                  : undefined
            }
            renegociarLabel={podeParcelar ? "Dividir em parcelas" : "Mudar as parcelas"}
            onExcluir={onExcluirCarne && carne.id && !carne.semCarne && excluiveis.has(carne.id)
              ? () => onExcluirCarne({ id: carne.id!, nome: carne.nome, falta: carne.falta })
              : undefined}
          />
        );
      })}

      {abertos.length === 0 && (
        <View style={[m.card, { alignItems: "center", paddingVertical: 22 }]}>
          <Text style={m.emptyTxt}>Nenhum carnê em aberto. 🎉</Text>
        </View>
      )}

      {quitados.length > 0 && (
        <View style={{ marginTop: 2 }}>
          <View style={c.secRow}>
            <Text style={c.quitadosT}>{quitados.length} {quitados.length === 1 ? "carnê quitado" : "carnês quitados"}</Text>
            <Pressable
              style={c.link}
              onPress={() => setVerQuitados(v => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: verQuitados }}
              testID="carnes-quitados-toggle"
            >
              <Text style={c.linkT}>{verQuitados ? "Ocultar" : "Ver"}</Text>
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
            <Text style={[m.newAccTxt, { fontFamily: Fonts.body }]}>Mudar as parcelas</Text>
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
        Este cadastro tem {fmt(openBalance)} em aberto de venda no crediário sem
        parcelamento. Registre recebimentos de qualquer valor pelo botão abaixo.
      </Text>
      <View style={{ marginTop: 14, alignSelf: "stretch", flexDirection: "row", gap: 8 }}>
        <Button title={`Receber ${fmt(openBalance)}`} variant="primary" size="sm" full onPress={() => prefill(openBalance)} />
        {/* Parcelar saldo (10/07): conecta o fiado a um prazo — abre a renegociação
            com base no saldo sem agenda (backend cai no getUnscheduledBalance). */}
        <Button title="Dividir em parcelas" variant="ghost" size="sm" full onPress={() => onRenegociar(null, "Saldo em aberto", openBalance)} />
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
  linkT: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "600", color: Colors.violet3 },
  done: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
    paddingVertical: 9, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  doneK: { fontFamily: Fonts.body, flex: 1, minWidth: 0, fontSize: 13, color: CorDaFicha.secundario },
  doneV: { fontFamily: Fonts.mono, fontSize: 12.5, color: CorDaFicha.secundario, fontVariant: ["tabular-nums"] as any },
  quitadosT: { fontFamily: Fonts.body, fontSize: 13, color: CorDaFicha.secundario },
  cancelar: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10 },
});

// ── F4: linha da parcela a pagar, sem sanfona ────────────────────────────
// Ícone · número · data (com lápis) e o porquê · valor · Receber. Quebra de
// linha em vez de espremer: em tela estreita data e Receber descem.
function LinhaDaParcela({ numero, data, porque, valor, atrasada, principal, onData, onReceber, onPix }: {
  numero: string; data: string; porque: string; valor: string;
  atrasada: boolean; principal: boolean;
  onData: () => void; onReceber: () => void; onPix?: () => void;
}) {
  return (
    <View style={[l.linha, atrasada && l.linhaLate]} testID={`parcela-${numero}`}>
      <View style={[l.ic, atrasada && l.icLate]}>
        <Text style={[l.icT, atrasada && { color: Colors.red }]}>{atrasada ? "!" : ""}</Text>
      </View>
      <Text style={l.num} accessibilityLabel={`Parcela ${numero}`}>{numero}</Text>
      <View style={l.meio}>
        <Pressable
          onPress={onData}
          style={({ pressed }: any) => [l.data, pressed && { backgroundColor: Colors.violetD }]}
          accessibilityRole="button"
          accessibilityLabel={`Mudar a data da parcela ${numero}`}
          hitSlop={6}
        >
          <Text style={[l.dataT, atrasada && { color: Colors.red }]}>{data}</Text>
          <Text style={l.lapis}>✎</Text>
        </Pressable>
        {!!porque && <Text style={l.porque}>{porque}</Text>}
      </View>
      <Text style={[l.valor, atrasada && { color: Colors.red }]}>{valor}</Text>
      <Pressable
        onPress={onReceber}
        style={({ pressed }: any) => [l.receber, principal ? l.receberP : l.receberS, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`Receber ${valor} da parcela ${numero}`}
      >
        <Text style={[l.receberT, principal && { color: "#fff" }]}>Receber</Text>
      </Pressable>
      {!!onPix && (
        <Pressable
          onPress={onPix}
          style={({ pressed }: any) => [l.receber, l.receberS, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`Pix da parcela ${numero}`}
          testID={`parcela-${numero}-pix`}
        >
          <Text style={[l.receberT, { color: CorDaFicha.verdeTexto }]}>Pix</Text>
        </Pressable>
      )}
    </View>
  );
}

const l = StyleSheet.create({
  linha: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 10, rowGap: 6,
    paddingHorizontal: 14, paddingVertical: 9, minHeight: 52, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  linhaLate: { backgroundColor: Colors.redD },
  ic: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: CorDaFicha.secundario, alignItems: "center", justifyContent: "center" },
  icLate: { borderColor: Colors.red },
  icT: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "800", color: CorDaFicha.secundario },
  num: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "700", color: Colors.ink, minWidth: 48 },
  meio: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 },
  data: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44,
    paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2,
  },
  dataT: { fontFamily: Fonts.body, fontSize: 12.5, color: Colors.ink },
  lapis: { fontFamily: Fonts.body, fontSize: 12, color: Colors.violet3 },
  porque: { fontFamily: Fonts.body, fontSize: 11.5, color: CorDaFicha.secundario, marginTop: 3 },
  valor: { fontFamily: Fonts.mono, fontSize: 13.5, fontWeight: "500", color: Colors.ink, textAlign: "right", marginLeft: "auto" as any, fontVariant: ["tabular-nums"] as any },
  receber: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  receberP: { backgroundColor: Colors.violet },
  receberS: { borderWidth: 1, borderColor: Colors.border2 },
  receberT: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "700", color: Colors.ink },
});
