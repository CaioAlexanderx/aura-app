// ============================================================
// LancarAnuidadeDojoModal — lançar/editar cobrança de anuidade de DOJÔ
// (Bloco B item b3). Reusa o mesmo padrão do LancarAnuidadeModal
// (anuidade CPF do praticante, components/karate/praticante-detalhe/),
// adaptado para dojô e com suporte a dois modos:
//
//   mode="charge" → POST /financial/annuities/dojos/{dojoId}/charge
//                   (karateApi.chargeDojoAnnuity) — nova cobrança.
//   mode="edit"   → PATCH .../dojos/{dojoId}/{annuityId}
//                   (karateApi.updateAnnuity) — edita a cobrança INTEIRA
//                   (valor/plano/vencimentos por parcela), SEM lock de
//                   status (decisão do Caio, 23/07/2026, PR #432 já no ar
//                   — funciona em qualquer status, inclusive já paga).
//                   Quem chama este modal em mode="edit" decide se mostra
//                   o botão pra qualquer status ou só pra alguns — este
//                   componente não trava mais nada internamente.
//
// Campos: valor (R$), período de referência (ex.: "2026"), regime de
// parcelamento (chips), e — só em mode="edit", quando a anuidade já tem
// parcelas 'anuidade' carregadas (annuity.installments, seq!==0 é a
// convenção do backend pra excluir a parcela de filiação, mesma regra já
// usada em AnnuityReceiveModal.allocationLabel) — uma lista de parcelas
// com valor + vencimento editáveis individualmente.
//
// Regime de parcelamento (Fase F1 — reclamação do Caio 17/07): dojô tem 3
// planos possíveis (anual 1x / semestral 2x / trimestral 4x, ver migration
// 222 aura-backend). Semântica REAL da rota de charge, confirmada lendo
// src/routes/karateAnnuities.js:
//   - Valor (R$) EM BRANCO → backend busca a fee vigente do plano
//     (karate_annual_fees) e GERA as N parcelas do plano automaticamente,
//     com vencimentos escalonados. É o único caminho que realmente separa
//     em parcelas.
//   - Valor (R$) PREENCHIDO → 1 cobrança única nesse valor exato (contrato
//     antigo, pré-F1). O `plan` escolhido ainda é salvo como RÓTULO da
//     cobrança, mas NÃO gera parcelas — override manual sempre vira 1 linha.
//
// PR #432 (edição de header, 23/07/2026) — precedência quando o operador
// mexe em mais de uma coisa (ver AnnuityUpdateInput em karateApi.ts):
//   parcelas editadas explicitamente > regime trocado (re-gera as parcelas
//   pela fee vigente, valor total abaixo vira override opcional) > só o
//   valor total (redistribui proporcionalmente sobre as parcelas atuais) >
//   só a competência.
// Este componente NUNCA calcula o valor por parcela do regime localmente
// (isso é decisão do backend via karate_annual_fees — duplicar aqui
// divergiria em qualquer reajuste); só decide QUAL bloco do payload enviar
// com base no que o operador efetivamente tocou.
//
// Default do regime: pré-seleciona `karate_annuity_plan` do dojô (mode
// "charge") ou `annuity.plan` (mode "edit"). Backend resolve sozinho se
// nada for enviado — nunca assumimos 'anual' aqui.
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Pressable, ScrollView, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karateApi, ChargeInput, DojoAnnuity, AnnuityPlan, AnnuityUpdateInput } from "@/services/karateApi";
import { maskBrDate, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { toast } from "@/components/Toast";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  dojoId: string;
  dojoName?: string;
  /** "charge" lança nova cobrança; "edit" atualiza a cobrança em `annuity` (precisa de annuityId). */
  mode: "charge" | "edit";
  /** Obrigatório em mode="edit" — id da linha de karate_dojo_annuity_history a editar. */
  annuityId?: string | null;
  /** Cobrança sendo editada (para pré-preencher os campos em mode="edit").
   *  Ideal vir com `installments`/`plan` carregados (ex.: a linha da tabela
   *  de Anuidades, que já lista isso) — sem eles, a edição cai pro caminho
   *  legado (só valor total + competência, sem parcelas). */
  annuity?: DojoAnnuity | null;
  onDone: () => void;
}

const PLAN_OPTIONS: AnnuityPlan[] = ["anual", "semestral", "trimestral"];
const PLAN_LABELS: Record<AnnuityPlan, string> = {
  anual: "Anual", semestral: "Semestral", trimestral: "Trimestral",
};
// Contagem de parcelas por regime — constante de negócio (migration 222),
// não um valor monetário calculado. Seguro exibir sem consultar o backend.
const PLAN_INSTALLMENT_HINT: Record<AnnuityPlan, string> = {
  anual: "Gera 1 cobrança.",
  semestral: "Gera 2 cobranças (parcelas), uma a cada 6 meses.",
  trimestral: "Gera 4 cobranças (parcelas), uma a cada 3 meses.",
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Parser tolerante de valor em pt-BR ("1.234,56" / "300" / "300,5") —
// mesmo padrão de AnnuityReceiveModal.parseAmountInput.
function parseAmountInput(raw: string): number {
  const cleaned = String(raw).trim().replace(/[^\d,.\-]/g, "");
  if (!cleaned) return 0;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

interface InstallmentRow {
  seq: number;
  amountText: string;
  dueBr: string;
  amountPaid: number;
}

export function LancarAnuidadeDojoModal({
  visible, onClose, federationId, dojoId, dojoName, mode, annuityId, annuity, onDone,
}: Props) {
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDateBr, setDueDateBr] = useState("");
  const [plan, setPlan] = useState<AnnuityPlan | null>(null);
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Snapshot do estado ao ABRIR o modal — base pra dirty-check (só manda
  // no PATCH o que o operador de fato tocou). Não dispara re-render (não
  // precisa: só é lido no submit).
  const initialRef = useRef<{ period: string; plan: AnnuityPlan | null; amount: number | null; rows: InstallmentRow[] }>({
    period: "", plan: null, amount: null, rows: [],
  });

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setSaving(false);
    if (mode === "edit" && annuity) {
      const per = annuity.reference_period || "";
      const pl = annuity.plan ?? null;
      const amt = annuity.amount != null ? annuity.amount : null;
      // seq===0 é a convenção do backend pra parcela de FILIAÇÃO (nunca
      // entra na reestruturação desta rota — ver karateAnnuities.js/
      // AnnuityReceiveModal.allocationLabel, mesma regra reaplicada aqui).
      const anuidadeInsts = (annuity.installments || [])
        .filter((i) => i.seq !== 0)
        .sort((a, b) => a.seq - b.seq)
        .map((i) => ({
          seq: i.seq,
          amountText: fmtAmountForInput(i.amount),
          dueBr: formatIsoToBr(i.due_date),
          amountPaid: i.amount_paid || 0,
        }));
      setPeriod(per);
      setAmount(amt != null ? fmtAmountForInput(amt) : "");
      setDueDateBr("");
      setPlan(pl);
      setRows(anuidadeInsts);
      initialRef.current = { period: per, plan: pl, amount: amt, rows: anuidadeInsts };
    } else {
      setPeriod("");
      setAmount("");
      setDueDateBr("");
      setPlan(null);
      setRows([]);
      initialRef.current = { period: "", plan: null, amount: null, rows: [] };
      // Pré-seleção best-effort do plano REAL cadastrado no dojô — não
      // bloqueia o formulário se falhar (dojô sem plano definido é normal).
      if (dojoId && federationId) {
        karateApi.getDojo(federationId, dojoId)
          .then((d) => { if (d?.karate_annuity_plan) setPlan(d.karate_annuity_plan); })
          .catch(() => {});
      }
    }
  }, [visible, mode, annuity, dojoId, federationId]);

  const dueComplete = dueDateBr.length === 10;
  const dueIso = parseBrDate(dueDateBr);
  const dueBad = dueComplete && dueIso === null;
  const amountFilled = amount.trim().length > 0;

  // ── mode="edit": dirty-check + soma das parcelas (pra exibir o total
  // quando o operador está editando parcela a parcela) ──────────────────
  const rowsDirty = useMemo(() => {
    if (mode !== "edit") return false;
    const init = initialRef.current.rows;
    if (rows.length !== init.length) return false; // sem add/remove nesta UI — não deveria acontecer
    return rows.some((r, idx) => r.amountText !== init[idx]?.amountText || r.dueBr !== init[idx]?.dueBr);
  }, [mode, rows]);

  const rowsSum = useMemo(
    () => rows.reduce((s, r) => s + (parseAmountInput(r.amountText) || 0), 0),
    [rows]
  );

  function updateRow(seq: number, patch: Partial<Pick<InstallmentRow, "amountText" | "dueBr">>) {
    setRows((prev) => prev.map((r) => (r.seq === seq ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    if (!period.trim()) { setErr("Informe o período de referência (ex.: 2026)."); return; }

    if (mode === "edit") {
      if (!annuityId) { setErr("Cobrança sem identificador — não é possível editar."); return; }

      const init = initialRef.current;
      const periodDirty = period.trim() !== init.period;
      const planDirty = plan !== init.plan;
      const amountNum = amountFilled ? parseAmountInput(amount) : null;
      const amountDirty = !rowsDirty && amountFilled && amountNum !== init.amount && (amountNum ?? 0) > 0;

      const payload: AnnuityUpdateInput = {};
      if (periodDirty) payload.reference_period = period.trim();

      if (rowsDirty) {
        const specs: { seq: number; amount: number; due_date: string }[] = [];
        for (const r of rows) {
          const amt = parseAmountInput(r.amountText);
          if (!amt || amt <= 0) { setErr(`Valor inválido na parcela ${r.seq}.`); return; }
          if (r.dueBr.length !== 10) { setErr(`Informe o vencimento da parcela ${r.seq} (dd/mm/aaaa).`); return; }
          const iso = parseBrDate(r.dueBr);
          if (!iso) { setErr(`Vencimento inválido na parcela ${r.seq} (dd/mm/aaaa).`); return; }
          specs.push({ seq: r.seq, amount: amt, due_date: iso });
        }
        payload.installments = specs;
      } else if (planDirty && plan) {
        payload.plan = plan;
        if (amountDirty && amountNum) payload.amount = amountNum;
      } else if (amountDirty && amountNum) {
        payload.amount = amountNum;
      }

      if (Object.keys(payload).length === 0) { setErr("Nada para alterar."); return; }

      setErr(null);
      setSaving(true);
      try {
        await karateApi.updateAnnuity(federationId, dojoId, annuityId, payload);
        toast.success("Anuidade atualizada");
        setSaving(false);
        onDone();
      } catch (e: any) {
        setSaving(false);
        const code = e?.data?.code ?? null;
        let msg = e?.message || "Não foi possível salvar a anuidade.";
        if (code === "AMOUNT_BELOW_PAID") {
          const paidTotal = e?.data?.details?.paid_total;
          msg = paidTotal != null
            ? `O novo valor total (${fmtMoney(amountDirty && amountNum ? amountNum : rowsSum)}) é menor que o já recebido nesta anuidade (${fmtMoney(paidTotal)}) — não é possível. Ajuste o valor para, no mínimo, esse total.`
            : "O novo valor é menor que o já recebido nesta anuidade — não é possível.";
        }
        // Nunca limpamos os campos no erro — o operador não perde o que digitou.
        setErr(msg);
        toast.error(msg);
      }
      return;
    }

    // mode === "charge": amount/due_date são OPCIONAIS (ver comentário no
    // topo do arquivo). Amount manual exige due_date (contrato antigo);
    // amount em branco deixa o backend calcular via fee do plano, e
    // due_date em branco vira override opcional só se preenchido.
    let n: number | null = null;
    if (amountFilled) {
      n = Number(amount.replace(/\./g, "").replace(",", "."));
      if (!isFinite(n) || n <= 0) { setErr("Informe um valor válido."); return; }
      if (!dueDateBr.trim() || !dueComplete || dueBad || !dueIso) {
        setErr("Informe o vencimento (dd/mm/aaaa) — obrigatório quando o valor é manual.");
        return;
      }
    } else if (dueDateBr.trim() && (dueBad || !dueIso)) {
      setErr("Vencimento inválido (dd/mm/aaaa).");
      return;
    }

    setErr(null);
    setSaving(true);
    try {
      const body: ChargeInput = { reference_period: period.trim() };
      if (amountFilled && n !== null) body.amount = n;
      if (dueDateBr.trim() && dueIso) body.due_date = dueIso;
      if (plan) body.plan = plan;
      await karateApi.chargeDojoAnnuity(federationId, dojoId, body);
      toast.success("Anuidade lançada com sucesso");
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      const msg = e?.message || "Não foi possível lançar a anuidade.";
      setErr(msg);
      toast.error(msg);
    }
  }

  const title = mode === "edit" ? "Editar anuidade" : "Lançar anuidade";
  const cta = mode === "edit" ? "Salvar alterações" : "Lançar anuidade";

  const amountHint = mode === "charge"
    ? (amountFilled
        ? "Valor manual: gera 1 cobrança única nesse valor (não divide em parcelas, mesmo em semestral/trimestral)."
        : "Em branco: o Aura usa o valor vigente do regime escolhido e gera as parcelas automaticamente.")
    : rows.length > 0
      ? (rowsDirty
          ? "Parcelas editadas abaixo — o total agora é a soma delas."
          : "Valor total da anuidade. Editar as parcelas abaixo tem prioridade sobre este campo.")
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !saving && onClose()} />
        <View style={st.card}>
          <View style={st.head}>
            <Text style={st.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={10}>
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            {dojoName ? (
              <Text style={st.hint}>
                {mode === "edit" ? "Editando cobrança de anuidade do dojô " : "Cobrança de anuidade do dojô "}
                {dojoName}.
              </Text>
            ) : null}

            <Text style={st.label}>Período de referência <Text style={st.required}>*</Text></Text>
            <TextInput
              style={st.input}
              value={period}
              onChangeText={setPeriod}
              placeholder="Ex.: 2026"
              placeholderTextColor={KarateColors.ink4}
              accessibilityLabel="Período de referência"
            />

            <Text style={st.label}>Regime de parcelamento</Text>
            <View style={st.planRow}>
              {PLAN_OPTIONS.map((opt) => {
                const on = plan === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[st.planChip, on && st.planChipOn]}
                    onPress={() => setPlan(opt)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Regime ${PLAN_LABELS[opt]}`}
                  >
                    <View style={[st.radio, on && st.radioOn]}>{on ? <View style={st.radioDot} /> : null}</View>
                    <Text style={[st.planChipTxt, on && st.planChipTxtOn]}>{PLAN_LABELS[opt]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={st.planHint}>
              {mode === "edit" && plan && plan !== (annuity?.plan ?? null)
                ? `Regime alterado: ${PLAN_INSTALLMENT_HINT[plan]} As parcelas atuais serão substituídas pelas do novo regime (valor vigente, ou o valor abaixo se preenchido).`
                : plan ? PLAN_INSTALLMENT_HINT[plan] : "Sem regime escolhido, o Aura usa o plano cadastrado do dojô — ou pede para você definir um."}
            </Text>

            <Text style={st.label}>
              Valor (R$) {mode === "edit" || amountFilled ? <Text style={st.required}>*</Text> : null}
            </Text>
            <TextInput
              style={[st.input, st.mono, rowsDirty && st.inputReadOnly]}
              value={rowsDirty ? fmtAmountForInput(rowsSum) : amount}
              onChangeText={setAmount}
              editable={!rowsDirty}
              keyboardType="numeric"
              placeholder="500,00"
              placeholderTextColor={KarateColors.ink4}
              accessibilityLabel="Valor"
            />
            {amountHint ? <Text style={st.fieldHint}>{amountHint}</Text> : null}

            {mode === "charge" ? (
              <>
                <Text style={st.label}>
                  Vencimento · dd/mm/aaaa {amountFilled ? <Text style={st.required}>*</Text> : null}
                </Text>
                <TextInput
                  style={[st.input, st.mono, dueBad && st.inputBad]}
                  value={dueDateBr}
                  onChangeText={(v) => setDueDateBr(maskBrDate(v))}
                  keyboardType="numeric"
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={KarateColors.ink4}
                  maxLength={10}
                  accessibilityLabel="Data de vencimento"
                />
                {dueBad ? <Text style={st.errInline}>Data inválida</Text> : null}
              </>
            ) : null}

            {/* mode="edit" — parcelas 'anuidade' editáveis individualmente
                (excluída a de filiação, seq===0). Só aparece quando a
                anuidade já veio com installments carregados (linha da
                tabela de Anuidades) — sem isso, a edição cai pro caminho
                legado acima (só valor total). */}
            {mode === "edit" && rows.length > 0 ? (
              <View style={[st.parcelasBox, plan !== (annuity?.plan ?? null) && st.parcelasBoxDisabled]}>
                <Text style={st.parcelasTitle}>PARCELAS</Text>
                {plan !== (annuity?.plan ?? null) ? (
                  <Text style={st.fieldHint}>Regime alterado acima — estes vencimentos não serão usados.</Text>
                ) : null}
                {rows.map((r) => (
                  <View key={r.seq} style={st.parcelaRow}>
                    <View style={st.parcelaHead}>
                      <Text style={st.parcelaSeq}>Parcela {r.seq}</Text>
                      {r.amountPaid > 0.005 ? (
                        <Text style={st.parcelaPaid}>já recebido: {fmtMoney(r.amountPaid)}</Text>
                      ) : null}
                    </View>
                    <View style={st.parcelaFields}>
                      <TextInput
                        style={[st.input, st.mono, st.parcelaAmountInput]}
                        value={r.amountText}
                        onChangeText={(v) => updateRow(r.seq, { amountText: v })}
                        editable={plan === (annuity?.plan ?? null)}
                        keyboardType="numeric"
                        placeholder="0,00"
                        placeholderTextColor={KarateColors.ink4}
                        accessibilityLabel={`Valor da parcela ${r.seq}`}
                      />
                      <TextInput
                        style={[st.input, st.mono, st.parcelaDateInput]}
                        value={r.dueBr}
                        onChangeText={(v) => updateRow(r.seq, { dueBr: maskBrDate(v) })}
                        editable={plan === (annuity?.plan ?? null)}
                        keyboardType="numeric"
                        placeholder="dd/mm/aaaa"
                        placeholderTextColor={KarateColors.ink4}
                        maxLength={10}
                        accessibilityLabel={`Vencimento da parcela ${r.seq}`}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {err ? (
              <View style={st.errBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.primary} />
                <Text style={st.errTxt}>{err}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={st.footer}>
            <TouchableOpacity onPress={onClose} disabled={saving} style={st.btnGhost}>
              <Text style={st.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[st.btnPrimary, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={st.btnPrimaryTxt}>{cta}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function fmtAmountForInput(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const st = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card:      { width: "100%", maxWidth: 480, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2, maxHeight: "92%" } as ViewStyle,
  head:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  title:     { fontFamily: KarateFonts.heading, fontSize: 18, color: KarateColors.ink } as TextStyle,
  hint:      { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  label:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  required:  { color: KarateColors.primary } as TextStyle,
  input:     { fontSize: 14, color: KarateColors.ink, backgroundColor: KarateColors.glassHi, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 11 } as TextStyle,
  mono:      { fontFamily: KarateFonts.mono, letterSpacing: 0.5 } as TextStyle,
  inputBad:  { borderColor: KarateColors.primary } as ViewStyle,
  inputReadOnly: { opacity: 0.6 } as ViewStyle,
  errInline: { fontSize: 11, color: KarateColors.primary } as TextStyle,
  errBox:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errTxt:    { fontSize: 12.5, color: KarateColors.primary2, flex: 1 } as TextStyle,
  fieldHint: { fontSize: 11, color: KarateColors.ink3, marginTop: -6 } as TextStyle,
  // Regime de parcelamento — reusa o padrão visual do seletor "Plano de
  // anuidade" da ficha do dojô (components/karate/DojoFichaModal.tsx):
  // radio + label + detalhe secundário, só que o detalhe aqui é o nº de
  // parcelas (constante de negócio), não um valor monetário calculado.
  planRow:   { gap: 8, marginTop: 4 } as ViewStyle,
  planChip:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.glassHi, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 13 } as ViewStyle,
  planChipOn: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  planChipTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  planChipTxtOn: { color: KarateColors.ink } as TextStyle,
  radio:     { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  radioOn:   { borderColor: KarateColors.primary } as ViewStyle,
  radioDot:  { width: 9, height: 9, borderRadius: 999, backgroundColor: KarateColors.primary } as ViewStyle,
  planHint:  { fontSize: 11, color: KarateColors.ink3, marginTop: -2 } as TextStyle,
  // Parcelas editáveis (mode="edit") — cada linha valor+vencimento.
  parcelasBox: { gap: 10, backgroundColor: KarateColors.glassHi, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, padding: 12, marginTop: 4 } as ViewStyle,
  parcelasBoxDisabled: { opacity: 0.5 } as ViewStyle,
  parcelasTitle: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, color: KarateColors.ink3 } as TextStyle,
  parcelaRow: { gap: 6, borderTopWidth: 1, borderTopColor: KarateColors.border, paddingTop: 10 } as ViewStyle,
  parcelaHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  parcelaSeq: { fontSize: 12.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  parcelaPaid: { fontSize: 10.5, color: KarateColors.ink3 } as TextStyle,
  parcelaFields: { flexDirection: "row", gap: 8 } as ViewStyle,
  parcelaAmountInput: { flex: 1 } as ViewStyle,
  parcelaDateInput: { flex: 1 } as ViewStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: KarateRadius.md, backgroundColor: KarateColors.ink, minWidth: 150, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});
