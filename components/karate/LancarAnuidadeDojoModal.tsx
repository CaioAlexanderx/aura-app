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
//
// Campos: valor (R$), período de referência (ex.: "2026"), vencimento
// (dd/mm/aaaa, mascarado — sem `new Date` para exibir; conversão via
// components/inputs/DateInput maskBrDate/parseBrDate/formatIsoToBr).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { karateApi, ChargeInput, DojoAnnuity } from "@/services/karateApi";
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

export function LancarAnuidadeDojoModal({
  visible, onClose, federationId, dojoId, dojoName, mode, annuityId, annuity, onDone,
}: Props) {
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDateBr, setDueDateBr] = useState("");
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
    } else {
      setPeriod("");
      setAmount("");
      setDueDateBr("");
    }
  }, [visible, mode, annuity]);

  const dueComplete = dueDateBr.length === 10;
  const dueIso = parseBrDate(dueDateBr);
  const dueBad = dueComplete && dueIso === null;

  async function handleSave() {
    if (!period.trim()) { setErr("Informe o período de referência (ex.: 2026)."); return; }
    const n = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!amount.trim() || !isFinite(n) || n <= 0) { setErr("Informe um valor válido."); return; }
    if (!dueDateBr.trim() || !dueComplete || dueBad || !dueIso) { setErr("Informe o vencimento (dd/mm/aaaa)."); return; }
    setErr(null);
    setSaving(true);
    try {
      if (mode === "edit") {
        if (!annuityId) { setSaving(false); setErr("Cobrança sem identificador — não é possível editar."); return; }
        await karateApi.updateAnnuity(federationId, dojoId, annuityId, {
          reference_period: period.trim(),
          amount: n,
          due_date: dueIso,
        });
        toast.success("Anuidade atualizada");
      } else {
        const body: ChargeInput = {
          reference_period: period.trim(),
          amount: n,
          due_date: dueIso,
        };
        await karateApi.chargeDojoAnnuity(federationId, dojoId, body);
        toast.success("Anuidade lançada com sucesso");
      }
      setSaving(false);
      onDone();
    } catch (e: any) {
      setSaving(false);
      const msg = e?.message || (mode === "edit" ? "Não foi possível salvar a anuidade." : "Não foi possível lançar a anuidade.");
      setErr(msg);
      toast.error(msg);
    }
  }

  const title = mode === "edit" ? "Editar anuidade" : "Lançar anuidade";
  const cta = mode === "edit" ? "Salvar alterações" : "Lançar anuidade";

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

            <Text style={st.label}>Valor (R$) <Text style={st.required}>*</Text></Text>
            <TextInput
              style={[st.input, st.mono]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="500,00"
              placeholderTextColor={KarateColors.ink4}
              accessibilityLabel="Valor"
            />

            <Text style={st.label}>Vencimento · dd/mm/aaaa <Text style={st.required}>*</Text></Text>
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
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: KarateRadius.md, backgroundColor: KarateColors.ink, minWidth: 150, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});
