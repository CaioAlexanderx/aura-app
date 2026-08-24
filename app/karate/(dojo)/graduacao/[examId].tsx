// ============================================================
// Aura Karatê (dojô) — Ficha do exame de faixa (F10)
//
// O EXAME DE KYU É DO SENSEI. Esta tela é o consumidor que faltava para
// karateDojoBeltExamService.js (backend em produção há dias, migrations
// 264/265/272 aplicadas, ZERO tela usando). Ela cobre o ciclo inteiro:
// escolher os alunos → marcar os três quesitos (Kihon/Kata/Kumite, 〇 >
// △ > □) → decidir resultado (aprovado/reprovado, SEMPRE decisão
// explícita do sensei — nunca calculado dos quesitos) → escolher a faixa
// de destino (teto: Marrom 1º kyu; preta nunca aparece, o backend
// recusaria com TETO_DO_SENSEI) → concluir em lote.
//
// ONDE ESTA TELA MORA (decisão de rota, ver corpo do PR): rota própria
// `/karate/(dojo)/graduacao/[examId]`, alcançada de dentro de "Meus
// eventos" (MeusEventosTab já lista o exame de kyu via events-hub, com
// `source: 'belt_exam'` — só faltava o botão virar link) e do botão
// "Novo exame de faixa" no cabeçalho da mesma tela. Não criei uma rota
// listada em DojoShell.tsx: o item de nav está sendo mexido por outro
// agente nesta mesma leva (fora do escopo combinado), e Meus Eventos já
// É o lugar onde o sensei olha pra tudo que o próprio dojô organiza —
// duplicar a entrada na nav seria um segundo caminho pro mesmo destino.
//
// QA 09/08/2026 (item 2): por não ser ela mesma um item de DOJO_NAV, o
// breadcrumb do Topbar (components/karate/DojoShell.tsx) caia sempre no
// fallback "Painel" — errado, não é onde o usuário está. Corrigido
// declarando o rótulo certo via useDojoSectionLabel("Eventos") abaixo,
// consistente com o comentário acima (a tela é alcançada de dentro de
// Eventos → Meus eventos).
//
// LANÇAMENTO EM LOTE, TUDO-OU-NADA: POST .../results devolve 422 com
// `errors: [{student_id, code, message}]` e NADA é gravado quando
// qualquer aluno tem pendência — diferente do idioma "skipped" do resto
// do karatê. Por isso os erros aparecem POR ALUNO, dentro da própria
// linha (GraduacaoAlunoRow), e o lote inteiro fica editável até fechar
// sem pendência — nunca uma lista "puxe e tente de novo" separada.
//
// REABERTURA: o backend faz UPSERT por (exam_id, student_id) mesmo com o
// exame já 'completed' (só recusa quando 'cancelled') — de propósito,
// pra corrigir um lançamento ou completar a turma depois. Esta tela
// aproveita isso: "Lançar mais / corrigir" reabre o lote pré-preenchido
// com os resultados já gravados.
//
// CERTIFICADO DO DOJÔ (F9.1/F10, ligado nesta leva): o exame precisa
// estar CONCLUÍDO para fazer sentido emitir — o certificado sai para os
// APROVADOS do lançamento gravado, então enquanto o exame é rascunho
// (editing sempre true) a seção só EXPLICA que a emissão libera após
// concluir, em vez de esconder o recurso sem dizer nada. Uma vez
// 'completed', a ficha de leitura (não-editing) mostra
// DojoExamCertificatesManager (components/karate/DojoExamCertificatesManager.tsx,
// F9.1 #661) — ele mesmo já carrega a explicação de que este é o
// certificado NÃO OFICIAL do dojô, distinto do OFICIAL da federação
// (pedido depois em app/karate/(dojo)/certificados.tsx). Ao reabrir para
// corrigir ("Lançar mais / corrigir"), a seção fica oculta de novo —
// evita emitir certificado em cima de um lançamento que ainda pode
// mudar; ela volta assim que o novo lançamento fecha e a ficha some da
// edição.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  StyleSheet, Platform, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { PageHead, SectionHead, Card, KpiBand, ShojiBadge, ShojiButton } from "@/components/karate/shoji";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";
import {
  karateDojoBeltExamApi, BeltLadderStep, DojoBeltExam, DojoBeltExamResultRow,
  DojoBeltExamAttachment, SubmitResultItem, SubmitResultsSummary, AppliedResult,
} from "@/services/karateDojoBeltExamApi";
import { karateDojoStudentsApi, DojoStudent, DOJO_STUDENTS_MAX_LIMIT } from "@/services/karateDojoStudentsApi";
import { SelecionarAlunosModal } from "@/components/karate/dojoFederativo/SelecionarAlunosModal";
import { GraduacaoAlunoRow, GraduacaoRowState, emptyGraduacaoRow } from "@/components/karate/dojoGraduacao/GraduacaoAlunoRow";
import { quesitoDisplay, mapCertificateReason, mapBeltHistorySkipReason, mapGraduacaoError, fmtDataCurta } from "@/components/karate/dojoGraduacao/helpers";
import { DojoExamCertificatesManager } from "@/components/karate/DojoExamCertificatesManager";
import { useDojoSectionLabel } from "@/components/karate/DojoShell";
import { Skeleton } from "@/components/karate/Skeleton";

const STATUS_VIEW: Record<string, { label: string; badge: "neutral" | "ok" | "danger" }> = {
  draft: { label: "Rascunho", badge: "neutral" },
  completed: { label: "Concluído", badge: "ok" },
  cancelled: { label: "Cancelado", badge: "danger" },
};

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

export default function ExameGraduacaoScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { dojoName } = useKarateDojo();

  // QA 09/08/2026 (item 2): esta tela não é ela mesma um item da nav do
  // dojô (só é alcançada de dentro de "Meus eventos" — ver cabeçalho do
  // arquivo); sem isto o breadcrumb do Topbar caia no fallback "Painel".
  useDojoSectionLabel("Eventos");

  const [exam, setExam] = useState<DojoBeltExam | null>(null);
  const [results, setResults] = useState<DojoBeltExamResultRow[]>([]);
  const [attachments, setAttachments] = useState<DojoBeltExamAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [ladder, setLadder] = useState<BeltLadderStep[]>([]);
  const [ceilingReason, setCeilingReason] = useState<string | null>(null);

  const [studentsById, setStudentsById] = useState<Record<string, DojoStudent>>({});

  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, GraduacaoRowState>>({});
  const [showSelector, setShowSelector] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, { code: string; message: string }[]>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SubmitResultsSummary | null>(null);
  const [lastApplied, setLastApplied] = useState<AppliedResult[] | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!federationId || !examId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateDojoBeltExamApi.getExam(federationId, String(examId));
      if (!res.exam) { setError(true); return; }
      setExam(res.exam);
      setResults(res.results);
      setAttachments(res.attachments);
      setEditing(res.exam.status === "draft");
      if (res.exam.status === "draft") {
        setOrder([]);
        setRows({});
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, examId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!federationId) return;
    karateDojoBeltExamApi.getBeltLadder(federationId)
      .then((res) => {
        setLadder(res.data.filter((s) => s.grantable_by_dojo));
        setCeilingReason(res.ceiling_reason);
      })
      .catch(() => { setLadder([]); });
  }, [federationId]);

  useEffect(() => {
    if (!federationId) return;
    karateDojoStudentsApi.listStudents(federationId, { status: "active", limit: DOJO_STUDENTS_MAX_LIMIT })
      .then((res) => {
        const map: Record<string, DojoStudent> = {};
        for (const s of res.data || []) map[s.id] = s;
        setStudentsById(map);
      })
      .catch(() => { setStudentsById({}); });
  }, [federationId]);

  const resultsByStudent = useMemo(() => {
    const map: Record<string, DojoBeltExamResultRow> = {};
    for (const r of results) map[r.student_id] = r;
    return map;
  }, [results]);

  const rowStudent = useCallback((id: string) => {
    const s = studentsById[id];
    if (s) return { id: s.id, full_name: s.full_name, belt_label: s.belt_label, federated: s.federated };
    const r = resultsByStudent[id];
    if (r) return { id, full_name: r.name || "Aluno", belt_label: r.from_belt?.label ?? null, federated: r.federated };
    return { id, full_name: "Aluno", belt_label: null, federated: false };
  }, [studentsById, resultsByStudent]);

  const patchRow = (id: string, patch: Partial<GraduacaoRowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] || emptyGraduacaoRow()), ...patch } }));
  };

  const removeRow = (id: string) => {
    setOrder((prev) => prev.filter((x) => x !== id));
    setRows((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setRowErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
  };

  const handleSelectorSubmit = (studentIds: string[]) => {
    const fresh = studentIds.filter((id) => !order.includes(id));
    if (fresh.length) {
      setOrder((prev) => [...prev, ...fresh]);
      setRows((prev) => {
        const next = { ...prev };
        for (const id of fresh) next[id] = emptyGraduacaoRow();
        return next;
      });
    }
    setShowSelector(false);
  };

  const startEditing = () => {
    if (exam?.status === "completed") {
      const seededOrder = results.map((r) => r.student_id);
      const seededRows: Record<string, GraduacaoRowState> = {};
      for (const r of results) {
        seededRows[r.student_id] = {
          kihon: r.quesitos.kihon,
          kata: r.quesitos.kata,
          kumite: r.quesitos.kumite,
          result: r.result,
          toStep: r.to_belt
            ? { level: r.to_belt.level, color_label: "", kyu: r.to_belt.kyu, dan: r.to_belt.dan, label: r.to_belt.label || "", rank: r.to_belt.rank || 0, order: r.to_belt.order, grantable_by_dojo: true }
            : null,
          requestCertificate: r.certificate.requested,
          notes: r.notes || "",
        };
      }
      setOrder(seededOrder);
      setRows(seededRows);
    }
    setRowErrors({});
    setTopError(null);
    setLastSummary(null);
    setLastApplied(null);
    setEditing(true);
  };

  const allValid = order.length > 0 && order.every((id) => {
    const r = rows[id];
    if (!r || !r.result) return false;
    if (r.result === "approved" && !r.toStep) return false;
    return true;
  });
  const pendingCount = order.filter((id) => {
    const r = rows[id];
    return !r || !r.result || (r.result === "approved" && !r.toStep);
  }).length;
  const approvedCount = order.filter((id) => rows[id]?.result === "approved").length;
  const failedCount = order.filter((id) => rows[id]?.result === "failed").length;

  const handleSubmit = async () => {
    if (!federationId || !examId || !allValid || submitting) return;
    setSubmitting(true);
    setTopError(null);
    setRowErrors({});
    try {
      const items: SubmitResultItem[] = order.map((id) => {
        const r = rows[id];
        const item: SubmitResultItem = { student_id: id, result: r.result! };
        if (r.result === "approved" && r.toStep) {
          item.to_belt_level = r.toStep.level;
          if (r.toStep.kyu != null) item.to_belt_kyu = r.toStep.kyu;
          if (r.requestCertificate) item.request_certificate = true;
        }
        if (r.kihon) item.kihon = r.kihon;
        if (r.kata) item.kata = r.kata;
        if (r.kumite) item.kumite = r.kumite;
        if (r.notes.trim()) item.notes = r.notes.trim();
        return item;
      });
      const res = await karateDojoBeltExamApi.submitResults(federationId, String(examId), { results: items });
      toast.success(`Exame lançado — ${res.summary.approved} aprovado(s), ${res.summary.failed} reprovado(s).`);
      setLastSummary(res.summary);
      setLastApplied(res.results);
      await load();
    } catch (e: any) {
      if (e?.status === 422 && Array.isArray(e?.data?.errors)) {
        const byStudent: Record<string, { code: string; message: string }[]> = {};
        const generic: string[] = [];
        for (const err of e.data.errors) {
          if (err.student_id) {
            byStudent[err.student_id] = byStudent[err.student_id] || [];
            byStudent[err.student_id].push({ code: err.code, message: err.message });
          } else if (err.message) {
            generic.push(err.message);
          }
        }
        setRowErrors(byStudent);
        setTopError(
          `${e.data.errors.length} pendência${e.data.errors.length === 1 ? "" : "s"} — nada foi gravado. Corrija e lance de novo.` +
          (generic.length ? " " + generic.join(" ") : "")
        );
      } else {
        toast.error(mapGraduacaoError(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelExam = async () => {
    if (!federationId || !examId) return;
    const ok = await confirmAsync({
      title: "Cancelar exame?",
      message: "O exame fica marcado como cancelado. Como ele é um rascunho, nenhuma graduação foi registrada ainda.",
      confirmLabel: "Cancelar exame",
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await karateDojoBeltExamApi.cancelExam(federationId, String(examId));
      toast.success("Exame cancelado.");
      await load();
    } catch (e: any) {
      toast.error(mapGraduacaoError(e));
    } finally {
      setCancelling(false);
    }
  };

  // ── Anexos (ficha/comprovante) — web: <input type=file> + FileReader ──
  const handlePickFile = () => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !exam || exam.status === "cancelled") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;
    input.onchange = (ev: Event) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const result = String(reader.result || "");
        const commaIdx = result.indexOf(",");
        const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
        setUploading(true);
        try {
          const created = await karateDojoBeltExamApi.uploadAttachments(federationId, String(examId), [{
            content: base64,
            filename: file.name,
            content_type: file.type || "application/pdf",
          }]);
          setAttachments((prev) => [...created, ...prev]);
          toast.success("Anexo enviado.");
        } catch (e: any) {
          toast.error(e?.message || "Não foi possível enviar o anexo.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleDeleteAttachment = async (doc: DojoBeltExamAttachment) => {
    const ok = await confirmAsync({
      title: "Excluir anexo?",
      message: `Excluir "${doc.filename}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    try {
      await karateDojoBeltExamApi.deleteAttachment(federationId, String(examId), doc.id);
      setAttachments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir o anexo.");
    }
  };

  if (loading) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.wrap}>
        <Skeleton width={120} height={14} style={{ marginBottom: 16 }} />
        {/* page head */}
        <View style={{ gap: 8, marginBottom: 20 }}>
          <Skeleton width={100} height={11} />
          <Skeleton width="70%" height={26} />
          <Skeleton width="55%" height={13} />
        </View>
        {/* note block */}
        <Skeleton width="100%" height={60} radius={R.md} style={{ marginBottom: 16 }} />
        {/* list rows */}
        {[1, 2, 3, 4].map((k) => (
          <Skeleton key={k} width="100%" height={64} radius={R.md} style={{ marginBottom: 12 }} />
        ))}
      </ScrollView>
    );
  }
  if (error || !exam) {
    return <KarateErrorState onRetry={load} />;
  }

  const statusView = STATUS_VIEW[exam.status] ?? STATUS_VIEW.draft;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.wrap}>
      <ShojiButton
        label="‹ Meus eventos"
        variant="text"
        onPress={() => router.push("/karate/(dojo)/eventos" as any)}
        style={{ alignSelf: "flex-start", marginBottom: 6 }}
      />

      <PageHead
        eyebrow={dojoName}
        title={exam.title || "Exame de faixa"}
        sub={`${fmtDataCurta(exam.exam_date)}${exam.examiner_name ? ` · Examinador: ${exam.examiner_name}` : ""}`}
        actions={<ShojiBadge status={statusView.badge} label={statusView.label} />}
      />

      {exam.status === "draft" && (
        <View style={styles.rulesNote}>
          <Icon name="info" size={14} color={C.ink3} />
          <Text style={styles.rulesNoteTxt}>
            Você gradua até Marrom 1º kyu. {ceilingReason || "Faixa preta é exclusiva da banca da federação."} Aluno
            não federado também gradua — só o certificado da federação exige vínculo federativo.
          </Text>
        </View>
      )}

      {/* Certificado do dojô só faz sentido com o lançamento fechado (ele
          certifica os APROVADOS do resultado gravado) — enquanto o exame é
          rascunho, explica em vez de esconder o recurso (ver cabeçalho do
          arquivo). Mesma linguagem "não oficial" do
          DojoExamCertificatesManager, adiantada aqui. */}
      {exam.status === "draft" && (
        <View style={styles.rulesNote}>
          <Icon name="info" size={14} color={C.ink3} />
          <Text style={styles.rulesNoteTxt}>
            O certificado do dojô (não oficial) fica disponível aqui assim que você concluir o exame — emissão em
            massa para os aprovados. Ele não substitui o certificado OFICIAL da federação, pedido depois na aba
            Certificados.
          </Text>
        </View>
      )}

      {!!lastSummary && exam.status === "completed" && (
        <KpiBand
          style={{ marginTop: 16 }}
          items={[
            { label: "Aprovados", value: lastSummary.approved },
            { label: "Reprovados", value: lastSummary.failed },
            { label: "Certificados pedidos", value: lastSummary.certificates_requested },
          ]}
        />
      )}

      {/* Motivos POR ALUNO deste lançamento — nunca engolidos (ver cabeçalho
          do arquivo): o que não virou espelho na federação e o que não virou
          pedido de certificado, com o motivo explícito. Só aparece na sessão
          em que o lançamento acabou de acontecer (a ficha persistida, abaixo,
          não guarda `reason`/`message` — só requested/order_id). */}
      {!!lastApplied && (() => {
        const withReason = lastApplied.filter(
          (a) => a.belt_history_skipped_reason || (a.certificate.requested && !a.certificate.created)
        );
        if (withReason.length === 0) return null;
        return (
          <View style={styles.section}>
            <SectionHead
              title="Motivos deste lançamento"
              sub="Graduação sempre é registrada no dojô. O que abaixo não aconteceu foi só o espelho na federação e/ou o pedido de certificado — com o motivo."
            />
            <View style={{ gap: 8 }}>
              {withReason.map((a) => (
                <View key={a.result_id} style={styles.reasonRow}>
                  <Text style={styles.reasonName}>{a.name || "Aluno"}</Text>
                  {!!a.belt_history_skipped_reason && (
                    <Text style={styles.reasonTxt}>Federação: {mapBeltHistorySkipReason(a.belt_history_skipped_reason)}</Text>
                  )}
                  {a.certificate.requested && !a.certificate.created && (
                    <Text style={styles.reasonTxt}>
                      Certificado: {mapCertificateReason(a.certificate.reason, a.certificate.message)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      {/* ── Lote editável (rascunho, ou reabertura pra corrigir/completar) ── */}
      {editing ? (
        <View style={styles.section}>
          <SectionHead
            title="Lançamento em lote"
            sub="Marque os três quesitos, o resultado e a faixa de destino de cada aluno. Um item pendente segura o lote inteiro — nada é gravado até todos estarem prontos."
            actions={<ShojiButton label="Adicionar alunos" icon="user_plus" variant="ghost" onPress={() => setShowSelector(true)} />}
          />

          {!!topError && (
            <View style={styles.topErrorBanner}>
              <Icon name="alert_circle" size={15} color={P.red} />
              <Text style={styles.topErrorTxt}>{topError}</Text>
            </View>
          )}

          {order.length === 0 ? (
            <Card>
              <KarateEmptyState
                icon="ribbon"
                title="Nenhum aluno no lote ainda"
                subtitle="Escolha quem vai fazer o exame — alunos federados ou não."
                action={<ShojiButton label="Adicionar alunos" icon="user_plus" variant="sumi" onPress={() => setShowSelector(true)} style={{ marginTop: 12 }} />}
                style={{ paddingVertical: 28 }}
              />
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {order.map((id) => (
                <GraduacaoAlunoRow
                  key={id}
                  student={rowStudent(id)}
                  value={rows[id] || emptyGraduacaoRow()}
                  onChange={(patch) => patchRow(id, patch)}
                  onRemove={() => removeRow(id)}
                  ladder={ladder}
                  errors={rowErrors[id]}
                  disabled={submitting}
                />
              ))}
            </View>
          )}

          {order.length > 0 && (
            <View style={styles.submitBar}>
              <Text style={styles.submitHint}>
                {approvedCount} aprovado{approvedCount === 1 ? "" : "s"} · {failedCount} reprovado{failedCount === 1 ? "" : "s"}
                {pendingCount > 0 ? ` · ${pendingCount} pendente${pendingCount === 1 ? "" : "s"}` : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {exam.status === "completed" && (
                  <ShojiButton
                    label="Descartar edição"
                    variant="ghost"
                    onPress={submitting ? undefined : () => { setEditing(false); setOrder([]); setRows({}); setRowErrors({}); setTopError(null); }}
                    style={submitting ? { opacity: 0.5 } : undefined}
                  />
                )}
                <ShojiButton
                  label={submitting ? "Concluindo..." : (exam.status === "completed" ? "Salvar lançamento" : "Concluir exame")}
                  variant="sumi"
                  onPress={allValid && !submitting ? handleSubmit : undefined}
                  style={!allValid ? { opacity: 0.5 } : undefined}
                />
              </View>
            </View>
          )}

          {exam.status === "draft" && (
            <TouchableOpacity onPress={cancelling ? undefined : handleCancelExam} style={styles.cancelExamLink} accessibilityRole="button">
              {cancelling ? <ActivityIndicator size="small" color={P.ink3} /> : (
                <Text style={styles.cancelExamTxt}>Cancelar este exame</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {/* ── Ficha concluída (read-only) ── */}
          <View style={styles.section}>
            <SectionHead
              title="Resultado do exame"
              sub={`${exam.approved_count} aprovado${exam.approved_count === 1 ? "" : "s"} de ${exam.results_count} avaliado${exam.results_count === 1 ? "" : "s"}.`}
              actions={exam.status === "completed" ? <ShojiButton label="Lançar mais / corrigir" icon="edit" variant="ghost" onPress={startEditing} /> : undefined}
            />
            {results.length === 0 ? (
              <Card><Text style={styles.emptyTxt}>Nenhum aluno avaliado neste exame.</Text></Card>
            ) : (
              <View style={{ gap: 10 }}>
                {results.map((r) => (
                  <View key={r.id} style={styles.resultCard}>
                    <View style={styles.resultHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{r.name || "Aluno"}</Text>
                        <Text style={styles.resultBeltLine}>
                          {r.from_belt?.label || "Faixa anterior desconhecida"}
                          {"  →  "}
                          <Text style={{ fontWeight: "600", color: P.ink }}>{r.to_belt?.label || r.to_belt_name || "—"}</Text>
                        </Text>
                      </View>
                      <ShojiBadge status={r.result === "approved" ? "ok" : "danger"} label={r.result === "approved" ? "Aprovado" : "Reprovado"} />
                    </View>

                    <View style={styles.quesitosSummary}>
                      <Text style={styles.quesitoLine}>Kihon: {quesitoDisplay(r.quesitos.kihon)}</Text>
                      <Text style={styles.quesitoLine}>Kata: {quesitoDisplay(r.quesitos.kata)}</Text>
                      <Text style={styles.quesitoLine}>Kumite: {quesitoDisplay(r.quesitos.kumite)}</Text>
                    </View>

                    {!!r.notes && <Text style={styles.resultNotes}>{r.notes}</Text>}

                    {r.result === "approved" && (
                      <View style={styles.certLine}>
                        <Icon
                          name={r.certificate.requested ? "check_circle" : "info"}
                          size={13}
                          color={r.certificate.requested ? C.ok : C.ink3}
                        />
                        <Text style={styles.certLineTxt}>
                          {r.certificate.requested
                            ? (r.certificate.order_id ? "Certificado da federação pedido." : "Certificado pedido — aguardando confirmação.")
                            : "Certificado da federação não pedido."}
                          {r.federated ? "" : " (aluno não federado)"}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Certificado do dojô (F9.1 #661 + F10 #662, ligados aqui) ──
              Exame CONCLUÍDO: o sensei já fechou o lançamento, agora emite
              o certificado NÃO OFICIAL do dojô para os aprovados.
              DojoExamCertificatesManager é autossuficiente (editor de
              modelo, preview, emissão em massa, lista de emitidos) e já
              carrega no próprio topo a explicação da diferença para o
              certificado OFICIAL da federação (aba Certificados) — não
              duplicamos essa explicação aqui. Fica de fora enquanto
              `editing` (reabertura pra corrigir): evita emitir em cima de
              um lançamento que ainda pode mudar. */}
          {exam.status === "completed" && (
            <View style={styles.section}>
              <DojoExamCertificatesManager
                federationId={federationId}
                exam={{ id: exam.id, title: exam.title, exam_date: exam.exam_date, examiner_name: exam.examiner_name, status: exam.status }}
                dojoName={dojoName}
              />
            </View>
          )}
        </>
      )}

      {/* ── Anexos ── */}
      <View style={styles.section}>
        <SectionHead
          title="Anexos"
          sub="Ficha de exame assinada ou comprovante — vários arquivos por exame."
          actions={
            exam.status !== "cancelled" ? (
              <ShojiButton
                label={uploading ? "Enviando..." : "Adicionar anexo"}
                icon="upload"
                variant="ghost"
                onPress={Platform.OS === "web" && !uploading ? handlePickFile : undefined}
              />
            ) : undefined
          }
        />
        {Platform.OS !== "web" && (
          <Text style={styles.nativeNotice}>Envio de anexos disponível no navegador.</Text>
        )}
        {attachments.length === 0 ? (
          <Text style={styles.emptyTxt}>Nenhum anexo ainda.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {attachments.map((doc) => (
              <View key={doc.id} style={styles.attRow}>
                <Icon name="file_text" size={16} color={C.ink2} />
                <Text style={styles.attName} numberOfLines={1}>{doc.filename}</Text>
                <TouchableOpacity onPress={() => handleDeleteAttachment(doc)} hitSlop={8} accessibilityLabel={`Excluir ${doc.filename}`}>
                  <Icon name="trash" size={15} color={C.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <SelecionarAlunosModal
        visible={showSelector}
        onClose={() => setShowSelector(false)}
        federationId={federationId}
        title="Escolher alunos para o exame"
        subtitle={exam.title || undefined}
        ctaLabel="Adicionar"
        busy={false}
        onSubmit={handleSelectorSubmit}
        requireFederated={false}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: P.paper } as ViewStyle,
  // PREMISSA (24/08): coluna central com largura máxima — a tela do exame
  // não estica em monitor largo (padrão da mesa pública).
  wrap: { padding: 16, paddingBottom: 60, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  section: { marginTop: 20 } as ViewStyle,

  rulesNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, padding: 12, marginTop: 12 } as ViewStyle,
  rulesNoteTxt: { flex: 1, fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 17 } as TextStyle,

  topErrorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 12, marginBottom: 12 } as ViewStyle,
  topErrorTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: P.red2, lineHeight: 17 } as TextStyle,

  submitBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  submitHint: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,

  cancelExamLink: { alignSelf: "flex-start", marginTop: 14 } as ViewStyle,
  cancelExamTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textDecorationLine: "underline" } as TextStyle,

  emptyTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink3 } as TextStyle,

  resultCard: { backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.lg, padding: 14, gap: 10 } as ViewStyle,
  resultHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 } as ViewStyle,
  resultName: { fontFamily: F.body, fontSize: 14.5, fontWeight: "600", color: P.ink } as TextStyle,
  resultBeltLine: { fontFamily: F.body, fontSize: 12, color: C.ink2, marginTop: 3 } as TextStyle,

  quesitosSummary: { flexDirection: "row", flexWrap: "wrap", gap: 14 } as ViewStyle,
  quesitoLine: { fontFamily: F.body, fontSize: 12, color: C.ink2 } as TextStyle,

  resultNotes: { fontFamily: F.body, fontSize: 12, color: C.ink3, fontStyle: "italic" } as TextStyle,

  certLine: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  certLineTxt: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,

  reasonRow: { backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, padding: 11, gap: 3 } as ViewStyle,
  reasonName: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: P.ink } as TextStyle,
  reasonTxt: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, lineHeight: 16 } as TextStyle,

  nativeNotice: { fontFamily: F.body, fontSize: 12, color: C.ink3, marginBottom: 8 } as TextStyle,
  attRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, padding: 10 } as ViewStyle,
  attName: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink } as TextStyle,
});
