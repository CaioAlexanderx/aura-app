// ============================================================
// BatchLaunchModal — lançar cobrança em lote (Fase F3) · Shoji
//
// Alimenta a multi-seleção JÁ existente na tabela do hub de Anuidades
// (AnnuitiesTable.tsx) com POST /financial/annuities/batch — mesmo motor
// do CampaignWizard (created/skipped/errors, nunca all-or-nothing). Usado
// quando o operador seleciona manualmente algumas linhas SEM cobrança e
// quer lançar só aquelas, em vez de rodar a campanha completa da temporada.
//
// Modal RN normal (<Modal>) — igual PixPaymentModal/LancarAnuidadeDojoModal,
// que já são abertos DIRETO de dentro de AnnuitiesTable.tsx (não há Modal
// pai envolvendo a tabela), então não há o problema de "Modal dentro de
// Modal no RN Web renderiza atrás" aqui.
//
// Cada alvo é revalidado contra o banco no backend (loadTargetInfo em
// karateAnnuityCampaign.js) — esta tela não decide elegibilidade sozinha,
// só mostra os nomes que o operador escolheu na tabela.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, TextInput, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import { toast } from "@/components/Toast";
import { karateApi, AnnuityCampaignResult, AnnuityBatchTarget } from "@/services/karateApi";
import { CampaignResultSummary } from "@/components/karate/campaign/CampaignResultSummary";

// "dojo" | "cpf" — mesmo union de SegKey (AnnuitiesHub.tsx), repetido aqui
// pra não importar de dentro de app/ (rota Expo Router) num componente.
type SegKey = "dojo" | "cpf";

type Props = {
  visible: boolean;
  federationId: string;
  year: string;
  seg: SegKey;
  targets: { id: string; name: string }[];
  onClose: () => void;
  /** Chamado depois que o operador fecha a tela de resultado — tabela e
   *  summary recarregam (o mesmo padrão de onDone dos outros modais desta tela). */
  onDone: () => void;
};

export function BatchLaunchModal({ visible, federationId, year, seg, targets, onClose, onDone }: Props) {
  const [dueDateBr, setDueDateBr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnnuityCampaignResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDueDateBr("");
    setSubmitting(false);
    setResult(null);
  }, [visible]);

  const dueDateIso = dueDateBr.length === 10 ? parseBrDate(dueDateBr) : null;
  const dueDateInvalid = dueDateBr.length === 10 && (!dueDateIso || !dueDateIso.startsWith(year));

  async function handleConfirm() {
    if (targets.length === 0 || dueDateInvalid) return;
    setSubmitting(true);
    try {
      const batchTargets: AnnuityBatchTarget[] = targets.map((t) => ({
        type: seg === "dojo" ? "dojo" : "practitioner",
        id: t.id,
      }));
      const res = await karateApi.batchAnnuityCampaign(federationId, {
        targets: batchTargets,
        year,
        due_date: dueDateIso || undefined,
      });
      setResult(res);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível lançar as cobranças.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = result ? "Cobranças lançadas" : "Lançar cobrança em lote";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={result ? onDone : onClose}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !submitting && (result ? onDone() : onClose())} />
        <View style={st.card}>
          <View style={st.head}>
            <Text style={st.title}>{title}</Text>
            <TouchableOpacity onPress={result ? onDone : onClose} disabled={submitting} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={C.ink3} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 14, maxHeight: 420 }}>
            {result ? (
              <CampaignResultSummary result={result} />
            ) : (
              <>
                <Text style={st.hint}>
                  {targets.length} {seg === "dojo" ? (targets.length === 1 ? "dojô selecionado" : "dojôs selecionados") : (targets.length === 1 ? "praticante selecionado" : "praticantes selecionados")} sem
                  cobrança nesta temporada. Cada um será revalidado no servidor antes de gerar a cobrança.
                </Text>

                <View style={st.list}>
                  {targets.slice(0, 8).map((t) => (
                    <Text key={t.id} style={st.listItem} numberOfLines={1}>· {t.name}</Text>
                  ))}
                  {targets.length > 8 && <Text style={st.listMore}>+ {targets.length - 8} outro{targets.length - 8 === 1 ? "" : "s"}</Text>}
                </View>

                <Text style={st.label}>Vencimento (opcional)</Text>
                <TextInput
                  style={[st.input, st.mono, dueDateInvalid && st.inputBad]}
                  value={dueDateBr}
                  onChangeText={(v) => setDueDateBr(maskBrDate(v))}
                  keyboardType="numeric"
                  placeholder="dd/mm/aaaa — deixe em branco pro padrão"
                  placeholderTextColor={C.ink4}
                  maxLength={10}
                  accessibilityLabel="Vencimento das cobranças em lote"
                />
                {dueDateInvalid && <Text style={st.errInline}>Data inválida ou fora do ano {year}.</Text>}
                <Text style={st.hintSmall}>
                  Em branco, o servidor usa o vencimento vigente do plano — ou, se ele já passou nesta temporada,
                  o último dia do mês atual (a cobrança nasce a vencer, não atrasada).
                </Text>
              </>
            )}
          </View>

          <View style={st.footer}>
            {result ? (
              <TouchableOpacity onPress={onDone} style={st.btnPrimary}>
                <Text style={st.btnPrimaryTxt}>Concluir</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={onClose} disabled={submitting} style={st.btnGhost}>
                  <Text style={st.btnGhostTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={submitting || targets.length === 0 || dueDateInvalid}
                  style={[st.btnPrimary, (submitting || targets.length === 0 || dueDateInvalid) && { opacity: 0.6 }]}
                >
                  {submitting ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={st.btnPrimaryTxt}>Lançar {targets.length} cobrança{targets.length === 1 ? "" : "s"}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card:      { width: "100%", maxWidth: 480, backgroundColor: P.paperWarm, borderRadius: R.xl, overflow: "hidden", borderWidth: 1, borderColor: C.line2, maxHeight: "92%" } as ViewStyle,
  head:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: P.glassHi } as ViewStyle,
  title:     { fontFamily: F.heading, fontSize: 18, color: C.ink } as TextStyle,
  hint:      { fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 } as TextStyle,
  hintSmall: { fontFamily: F.body, fontSize: 10.5, color: C.ink4, fontStyle: "italic", lineHeight: 15 } as TextStyle,
  list:      { gap: 3, backgroundColor: P.glass2, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 10 } as ViewStyle,
  listItem:  { fontFamily: F.body, fontSize: 12, color: C.ink } as TextStyle,
  listMore:  { fontFamily: F.body, fontSize: 11, color: C.ink3, fontStyle: "italic", marginTop: 2 } as TextStyle,
  label:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: C.ink2, marginTop: 4 } as TextStyle,
  input:     { fontSize: 14, color: C.ink, backgroundColor: P.glassHi, borderWidth: 1, borderColor: C.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 11 } as TextStyle,
  mono:      { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  inputBad:  { borderColor: P.red } as ViewStyle,
  errInline: { fontSize: 11, color: P.red } as TextStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: P.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: C.line2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 150, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});
