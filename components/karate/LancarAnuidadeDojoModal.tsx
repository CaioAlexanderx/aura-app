// ============================================================
// LancarAnuidadeDojoModal — lançar/editar cobrança de anuidade de DOJÔ
// (Bloco B item b3). Reusa o mesmo padrão do LancarAnuidadeModal
// (anuidade CPF do praticante, components/karate/praticante-detalhe/),
// adaptado para dojô e com suporte a dois modos:
//
//   mode="charge" → POST /financial/annuities/dojos/{dojoId}/charge
//                   (karateApi.chargeDojoAnnuity) — nova cobrança.
//   mode="edit"   → PATCH .../dojos/{dojoId}/{annuityId}
//                   (karateApi.updateAnnuity) — edita cobrança NÃO paga
//                   (backend recusa com erro se já paga; exibido via toast).
//                   PATCH só mexe em amount/due_date/reference_period da
//                   linha (legado, pré-parcelas) — não aceita `plan`, então
//                   o seletor de regime só aparece em mode="charge".
//
// Campos: valor (R$), período de referência (ex.: "2026"), vencimento
// (dd/mm/aaaa, mascarado — sem `new Date` para exibir; conversão via
// components/inputs/DateInput maskBrDate/parseBrDate/formatIsoToBr).
//
// Regime de parcelamento (Fase F1 — reclamação do Caio 17/07): dojô tem 3
// planos possíveis (anual 1x / semestral 2x / trimestral 4x, ver migration
// 222 aura-backend). Semântica REAL da rota de charge, confirmada lendo
// src/routes/karateAnnuities.js (não documentada anteriormente no front):
//   - Valor (R$) EM BRANCO → backend busca a fee vigente do plano
//     (karate_annual_fees) e GERA as N parcelas do plano automaticamente,
//     com vencimentos escalonados. É o único caminho que realmente separa
//     em parcelas.
//   - Valor (R$) PREENCHIDO → 1 cobrança única nesse valor exato (contrato
//     antigo, pré-F1). O `plan` escolhido ainda é salvo como RÓTULO da
//     cobrança, mas NÃO gera parcelas — override manual sempre vira 1 linha.
// Por isso os dois campos abaixo do seletor de regime viram texto honesto
// em vez de conta feita no front (o valor por parcela é decisão do backend
// via karate_annual_fees — duplicar aqui divergiria em qualquer reajuste).
//
// Default do regime: pré-seleciona `karate_annuity_plan` do dojô (busca
// leve via karateApi.getDojo ao abrir, best-effort — falha silenciosa não
// bloqueia o lançamento, só deixa sem pré-seleção). Backend resolve sozinho
// se nada for enviado (plan explícito > karate_annuity_plan do dojô > 422
// PLANO_INDEFINIDO) — nunca assumimos 'anual' aqui.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karateApi, ChargeInput, DojoAnnuity, AnnuityPlan } from "@/services/karateApi";
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
  /** Cobrança sendo editada (para pré-preencher os campos em mode="edit"). */
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

export function LancarAnuidadeDojoModal({
  visible, onClose, federationId, dojoId, dojoName, mode, annuityId, annuity, onDone,
}: Props) {
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDateBr, setDueDateBr] = useState("");
  const [plan, setPlan] = useState<AnnuityPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setSaving(false);
    if (mode === "edit" && annuity) {
      setPeriod(annuity.reference_period || "");
      setAmount(annuity.amount != null ? String(annuity.amount).replace(".", ",") : "");
      setDueDateBr(formatIsoToBr(annuity.due_date));
      setPlan(null);
    } else {
      setPeriod("");
      setAmount("");
      setDueDateBr("");
      setPlan(null);
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

  async function handleSave() {
    if (!period.trim()) { setErr("Informe o período de referência (ex.: 2026)."); return; }

    if (mode === "edit") {
      const n = Number(amount.replace(/\./g, "").replace(",", "."));
      if (!amount.trim() || !isFinite(n) || n <= 0) { setErr("Informe um valor válido."); return; }
      if (!dueDateBr.trim() || !dueComplete || dueBad || !dueIso) { setErr("Informe o vencimento (dd/mm/aaaa)."); return; }
      setErr(null);
      setSaving(true);
      try {
        if (!annuityId) { setSaving(false); setErr("Cobrança sem identificador — não é possível editar."); return; }
        await karateApi.updateAnnuity(federationId, dojoId, annuityId, {
          reference_period: period.trim(),
          amount: n,
          due_date: dueIso,
        });
        toast.success("Anuidade atualizada");
        setSaving(false);
        onDone();
      } catch (e: any) {
        setSaving(false);
        const msg = e?.message || "Não foi possível salvar a anuidade.";
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

          <View style={{ padding: 16, gap: 12 }}>
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

            {mode === "charge" ? (
              <>
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
                  {plan ? PLAN_INSTALLMENT_HINT[plan] : "Sem regime escolhido, o Aura usa o plano cadastrado do dojô — ou pede para você definir um."}
                </Text>
              </>
            ) : null}

            <Text style={st.label}>
              Valor (R$) {mode === "edit" || amountFilled ? <Text style={st.required}>*</Text> : null}
            </Text>
            <TextInput
              style={[st.input, st.mono]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="500,00"
              placeholderTextColor={KarateColors.ink4}
              accessibilityLabel="Valor"
            />
            {amountHint ? <Text style={st.fieldHint}>{amountHint}</Text> : null}

            <Text style={st.label}>
              Vencimento · dd/mm/aaaa {mode === "edit" || amountFilled ? <Text style={st.required}>*</Text> : null}
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

            {err ? (
              <View style={st.errBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.primary} />
                <Text style={st.errTxt}>{err}</Text>
              </View>
            ) : null}
          </View>

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
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: KarateRadius.md, backgroundColor: KarateColors.ink, minWidth: 150, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});
