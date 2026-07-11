// ============================================================
// CampaignWizard — campanha anual de anuidades (Fase F3) · Shoji
//
// Segue o DNA ESTRUTURAL do TrocaModal (components/screens/pdv/TrocaModal.
// tsx — padrão canônico de wizard multi-passo do app): overlay próprio
// (View absoluta com zIndex, NÃO <Modal> do RN — "Modal dentro de Modal no
// RN Web renderiza atrás → invisível → no-op silencioso", já quebramos
// isso 3x), stepbar numerado com passos concluídos/ativos, footer fixo
// com voltar/continuar, confirmação de saída quando há progresso, e um
// passo final de RESULTADO que só mostra números REAIS vindos da API
// (nunca otimista) — nunca fecha sozinho.
//
// Passo 1 — Escopo (Step1Scope): dojôs/praticantes/ambos + contagem real
//   de elegíveis (preview scope='both' buscado uma única vez na abertura).
// Passo 2 — Valores e vencimento (Step2ValuesDueDate): valores da vigência
//   somente leitura + vencimento editável (default do backend).
// Passo 3 — Revisão (Step3Review): lista do preview com exclusão linha a
//   linha (alimenta `exclude`) + resumo recalculado no cliente.
// Confirmar → POST /campaign com os números REAIS da resposta no passo 4
//   (CampaignResultSummary, compartilhado com o BatchLaunchModal da
//   tabela — mesmo motor no backend).
//
// Visibilidade E elegibilidade são sempre as que o BACKEND devolveu — este
// componente nunca decide sozinho quem é elegível (isso vive nas queries
// SQL de karateAnnuityCampaign.js, replicadas em karateApi.ts só como doc).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { parseBrDate } from "@/components/inputs/DateInput";
import { toast } from "@/components/Toast";
import {
  karateApi,
  AnnuityCampaignPreviewResponse,
  AnnuityCampaignResult,
  AnnuityCampaignScope,
  AnnuityFeePlan,
} from "@/services/karateApi";
import { Step1Scope } from "./Step1Scope";
import { Step2ValuesDueDate } from "./Step2ValuesDueDate";
import { Step3Review } from "./Step3Review";
import { CampaignResultSummary } from "./CampaignResultSummary";
import { countForScope, referenceDueDate, rowsForScope } from "./types";
import type { CampaignStep } from "./types";

// Rótulos alinhados ao mockup ("1 · Escopo", "2 · Planos e valores",
// "3 · Revisão") — o número vem do stepDot ao lado, não precisa repetir
// aqui no texto.
const STEP_LABELS: Record<Exclude<CampaignStep, 4>, string> = {
  1: "Escopo",
  2: "Planos e valores",
  3: "Revisão",
};

type Props = {
  visible: boolean;
  federationId: string;
  year: string;
  /** Preseleciona o escopo (usado pelo banner de novos filiados — abre
   *  já com 'both' escolhido, mas o usuário ainda pode trocar no passo 1). */
  initialScope?: AnnuityCampaignScope;
  onClose: () => void;
  /** Chamado assim que a resposta REAL de /campaign chega — hub recarrega
   *  summary/tabela em paralelo enquanto o usuário revisa o resultado. */
  onSuccess?: (result: AnnuityCampaignResult) => void;
  /** Fecha o wizard e abre a área "Valores e planos" do hub. Nada foi
   *  submetido antes da confirmação no passo 3 — não há por que confirmar
   *  saída aqui, é só navegação. */
  onOpenPlans?: () => void;
};

export function CampaignWizard({
  visible, federationId, year, initialScope, onClose, onSuccess, onOpenPlans,
}: Props) {
  const [step, setStep] = useState<CampaignStep>(1);
  const [scope, setScope] = useState<AnnuityCampaignScope | null>(null);

  const [preview, setPreview] = useState<AnnuityCampaignPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  const [fees, setFees] = useState<AnnuityFeePlan[]>([]);
  const [feesLoading, setFeesLoading] = useState(true);

  const [dueDateOverrideBr, setDueDateOverrideBr] = useState("");
  const [excludeDojoIds, setExcludeDojoIds] = useState<Set<string>>(new Set());
  const [excludePractitionerIds, setExcludePractitionerIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnnuityCampaignResult | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const fetchPreview = useCallback(async (dueDateOverride?: string) => {
    setPreviewLoading(true);
    setPreviewError(false);
    try {
      const res = await karateApi.previewAnnuityCampaign(federationId, { year, scope: "both", due_date: dueDateOverride });
      setPreview(res);
    } catch {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [federationId, year]);

  // Reset + fetch inicial ao abrir.
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setScope(initialScope ?? null);
    setPreview(null);
    setDueDateOverrideBr("");
    setExcludeDojoIds(new Set());
    setExcludePractitionerIds(new Set());
    setSubmitting(false);
    setResult(null);
    setShowExitConfirm(false);
    fetchPreview(undefined);
    setFeesLoading(true);
    karateApi.getFeePlans(federationId)
      .then(setFees)
      .catch(() => setFees([]))
      .finally(() => setFeesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Vencimento é do ano da temporada (validado igual ao backend — ver
  // validateDueDateOverride em karateAnnuityService.js).
  const dueDateOverrideIso = dueDateOverrideBr.length === 10 ? parseBrDate(dueDateOverrideBr) : null;
  const dueDateInvalid =
    dueDateOverrideBr.length === 10 && (!dueDateOverrideIso || !dueDateOverrideIso.startsWith(year));

  // Refaz o preview (scope='both', mesma chamada) quando o override muda —
  // debounced. Vazio ou inválido: sem refetch (o preview atual continua
  // valendo; o campo mostra o erro separadamente).
  useEffect(() => {
    if (!visible) return;
    if (dueDateOverrideBr.length > 0 && dueDateOverrideBr.length < 10) return;
    if (dueDateOverrideBr.length === 10 && (!dueDateOverrideIso || dueDateInvalid)) return;
    const t = setTimeout(() => {
      fetchPreview(dueDateOverrideIso || undefined);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueDateOverrideBr, visible]);

  const { due_date: refDueDate, due_date_ajustada: refDueDateAdjusted } = useMemo(
    () => referenceDueDate(preview), [preview]
  );

  const scoped = useMemo(() => rowsForScope(preview, scope), [preview, scope]);

  const toggleExcludeDojo = useCallback((id: string) => {
    setExcludeDojoIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const toggleExcludePractitioner = useCallback((id: string) => {
    setExcludePractitionerIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const includedCount =
    scoped.dojos.filter((d) => !excludeDojoIds.has(d.dojo_id)).length +
    scoped.practitioners.filter((p) => !excludePractitionerIds.has(p.practitioner_id)).length;

  const canAdvance = useCallback((): boolean => {
    if (step === 1) return !!scope && !previewLoading && countForScope(preview, scope) > 0;
    if (step === 2) return !dueDateInvalid && !previewLoading;
    return false;
  }, [step, scope, preview, previewLoading, dueDateInvalid]);

  const canConfirm = !submitting && includedCount > 0;

  const next = useCallback(() => setStep((s) => (Math.min(3, s + 1) as CampaignStep)), []);
  const prev = useCallback(() => setStep((s) => (Math.max(1, s - 1) as CampaignStep)), []);

  async function handleSubmit() {
    if (!scope || includedCount === 0) return;
    setSubmitting(true);
    try {
      const res = await karateApi.runAnnuityCampaign(federationId, {
        year,
        scope,
        exclude: {
          dojo_ids: Array.from(excludeDojoIds),
          practitioner_ids: Array.from(excludePractitionerIds),
        },
        due_date: dueDateOverrideIso || undefined,
      });
      setResult(res);
      setStep(4);
      onSuccess?.(res);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível rodar a campanha.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasProgress = step > 1 && step < 4;
  const requestClose = () => {
    if (hasProgress) setShowExitConfirm(true);
    else onClose();
  };

  if (!visible) return null;

  let footerInfo = "";
  if (step === 1) {
    footerInfo = scope
      ? `${countForScope(preview, scope)} elegíve${countForScope(preview, scope) === 1 ? "l" : "is"} neste escopo`
      : "Escolha quem entra nesta rodada";
  } else if (step === 2) {
    footerInfo = "Confira a vigência e o vencimento antes de revisar a lista";
  } else if (step === 3) {
    footerInfo = `${includedCount} ${includedCount === 1 ? "cobrança será" : "cobranças serão"} lançada${includedCount === 1 ? "" : "s"}`;
  }

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={step === 4 ? undefined : requestClose} />
      <View style={s.panel}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.headerIco}>
              <Icon name="send" size={15} color={P.red} />
            </View>
            <View>
              <Text style={s.headerTitle}>{step === 4 ? "Campanha lançada" : `Campanha de anuidades · ${year}`}</Text>
              <Text style={s.headerSub}>
                {step === 1 && "Quem entra nesta rodada"}
                {step === 2 && "Valores e vencimento"}
                {step === 3 && "Revise antes de confirmar"}
                {step === 4 && "Números reais do lote — nada aqui é estimado"}
              </Text>
            </View>
          </View>
          <Pressable onPress={requestClose} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={C.ink3} />
          </Pressable>
        </View>

        {step !== 4 && (
          <View style={s.stepBar}>
            {([1, 2, 3] as const).map((n, idx) => {
              const done = step > n;
              const active = step === n;
              return (
                <View key={n} style={s.stepItem}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                    {done ? <Icon name="check" size={10} color="#fdf8f2" /> : <Text style={[s.stepDotTxt, active && { color: "#fdf8f2" }]}>{n}</Text>}
                  </View>
                  <Text style={[s.stepLabel, (active || done) && { color: active ? P.red : C.ink2, fontWeight: active ? "700" : "500" }]} numberOfLines={1}>
                    {STEP_LABELS[n]}
                  </Text>
                  {idx < 2 && <View style={[s.stepSep, done && { backgroundColor: P.redLine }]} />}
                </View>
              );
            })}
          </View>
        )}

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <Step1Scope
              year={year}
              scope={scope}
              onChangeScope={setScope}
              preview={preview}
              loading={previewLoading && !preview}
              error={previewError}
              onRetry={() => fetchPreview(dueDateOverrideIso || undefined)}
            />
          )}
          {step === 2 && scope && (
            <Step2ValuesDueDate
              year={year}
              scope={scope}
              fees={fees}
              feesLoading={feesLoading}
              dueDateIso={refDueDate}
              dueDateAdjusted={refDueDateAdjusted}
              dueDateOverrideBr={dueDateOverrideBr}
              onChangeDueDateOverride={setDueDateOverrideBr}
              dueDateInvalid={dueDateInvalid}
              onOpenPlans={() => { onOpenPlans?.(); onClose(); }}
            />
          )}
          {step === 3 && (
            <Step3Review
              dojos={scoped.dojos}
              practitioners={scoped.practitioners}
              excludedDojoIds={excludeDojoIds}
              excludedPractitionerIds={excludePractitionerIds}
              onToggleDojo={toggleExcludeDojo}
              onTogglePractitioner={toggleExcludePractitioner}
              dueDateIso={refDueDate}
              dueDateAdjusted={refDueDateAdjusted}
            />
          )}
          {step === 4 && result && <CampaignResultSummary result={result} />}
        </ScrollView>

        {step !== 4 && (
          <View style={s.footer}>
            <Text style={s.footerInfo} numberOfLines={1}>{footerInfo}</Text>
            <View style={s.footerActions}>
              {step > 1 && (
                <Pressable style={s.btnSec} onPress={prev}>
                  <Text style={s.btnSecTxt}>← Voltar</Text>
                </Pressable>
              )}
              {step < 3 && (
                <Pressable style={[s.btnPri, !canAdvance() && { opacity: 0.45 }]} onPress={next} disabled={!canAdvance()}>
                  <Text style={s.btnPriTxt}>Continuar →</Text>
                </Pressable>
              )}
              {step === 3 && (
                <Pressable
                  style={[s.btnConfirm, !canConfirm && { opacity: 0.45 }]}
                  onPress={canConfirm ? handleSubmit : undefined}
                  disabled={!canConfirm}
                >
                  {submitting ? <ActivityIndicator size="small" color="#fdf8f2" /> : (
                    <>
                      <Icon name="send" size={13} color="#fdf8f2" />
                      <Text style={s.btnPriTxt}>Confirmar campanha</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={s.footer}>
            <Text style={s.footerInfo} numberOfLines={1}>
              {result ? `${result.created.length} criada${result.created.length === 1 ? "" : "s"}` : ""}
            </Text>
            <View style={s.footerActions}>
              <Pressable style={s.btnPri} onPress={onClose}>
                <Text style={s.btnPriTxt}>Concluir</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {showExitConfirm && (
        <View style={s.exitOverlay}>
          <View style={s.exitCard}>
            <Text style={s.exitTitle}>Sair sem lançar a campanha?</Text>
            <Text style={s.exitMsg}>
              Nada foi enviado ainda — se sair agora, só perde as escolhas de escopo/vencimento/exclusões desta rodada.
            </Text>
            <View style={s.exitActions}>
              <Pressable style={s.exitStay} onPress={() => setShowExitConfirm(false)}>
                <Text style={s.exitStayTxt}>Continuar aqui</Text>
              </Pressable>
              <Pressable style={s.exitLeave} onPress={() => { setShowExitConfirm(false); onClose(); }}>
                <Text style={s.exitLeaveTxt}>Sair</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(43,38,32,0.45)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 20,
  } as ViewStyle,
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 } as ViewStyle,
  panel: {
    width: "100%", maxWidth: 720, maxHeight: "94%",
    borderRadius: R.xl, overflow: "hidden", flexDirection: "column",
    backgroundColor: P.paperWarm,
    borderWidth: 1, borderColor: C.line2,
    ...(Platform.OS === "web" ? ({ boxShadow: "0 24px 60px -10px rgba(43,38,32,0.35)" } as any) : {}),
  } as ViewStyle,
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.line2,
    backgroundColor: P.glassHi,
  } as ViewStyle,
  headerIco: { width: 32, height: 32, borderRadius: R.md, backgroundColor: P.redWash, alignItems: "center", justifyContent: "center" } as ViewStyle,
  headerTitle: { fontFamily: F.heading, fontSize: 18, color: C.ink } as TextStyle,
  headerSub: { fontFamily: F.body, fontSize: 12, color: C.ink3, marginTop: 1 } as TextStyle,
  closeBtn: { width: 32, height: 32, borderRadius: R.md, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" } as ViewStyle,

  stepBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 22, paddingVertical: 14,
    backgroundColor: P.paper2,
    borderBottomWidth: 1, borderBottomColor: C.line,
    gap: 6,
  } as ViewStyle,
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  stepDot: { width: 24, height: 24, borderRadius: 999, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  stepDotActive: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  stepDotDone: { backgroundColor: P.ok, borderColor: P.ok } as ViewStyle,
  stepDotTxt: { color: C.ink3, fontSize: 12, fontWeight: "700" } as TextStyle,
  stepLabel: { color: C.ink3, fontSize: 12.5, fontWeight: "500" } as TextStyle,
  stepSep: { width: 28, height: 1.5, backgroundColor: C.line2, marginHorizontal: 4 } as ViewStyle,

  body: { flex: 1 } as ViewStyle,
  bodyContent: { padding: 22, paddingBottom: 8 } as ViewStyle,

  footer: {
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: C.line2,
    backgroundColor: P.glassHi,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
  } as ViewStyle,
  footerInfo: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2, fontWeight: "500" } as TextStyle,
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0 } as ViewStyle,
  btnPri: { backgroundColor: P.ink, paddingVertical: 11, paddingHorizontal: 20, borderRadius: R.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 } as ViewStyle,
  btnConfirm: { backgroundColor: P.red, paddingVertical: 11, paddingHorizontal: 20, borderRadius: R.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 200 } as ViewStyle,
  btnPriTxt: { color: "#fdf8f2", fontSize: 13.5, fontWeight: "700" } as TextStyle,
  btnSec: { backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, paddingVertical: 11, paddingHorizontal: 16, borderRadius: R.md } as ViewStyle,
  btnSecTxt: { color: C.ink, fontSize: 13, fontWeight: "500" } as TextStyle,

  exitOverlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(43,38,32,0.55)", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 } as ViewStyle,
  exitCard: { width: "100%", maxWidth: 380, borderRadius: R.lg, padding: 22, backgroundColor: P.paperWarm, borderWidth: 1, borderColor: C.line2 } as ViewStyle,
  exitTitle: { fontFamily: F.heading, fontSize: 16, color: C.ink, marginBottom: 8 } as TextStyle,
  exitMsg: { fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 19, marginBottom: 18 } as TextStyle,
  exitActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 } as ViewStyle,
  exitStay: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.md, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2 } as ViewStyle,
  exitStayTxt: { fontSize: 13, fontWeight: "700", color: C.ink } as TextStyle,
  exitLeave: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.md, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine } as ViewStyle,
  exitLeaveTxt: { fontSize: 13, fontWeight: "700", color: P.red } as TextStyle,
});

export default CampaignWizard;
