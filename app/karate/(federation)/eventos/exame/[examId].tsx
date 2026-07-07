// ============================================================
// Detalhe do Exame / Curso — Aura Karatê (federação)
//
// Para EXAME (exam_type != 'curso'):
//   Dados do exame, banca e candidatos com resultado. Lançar
//   resultados (modal por candidato), fechar exame (confirmação),
//   e solicitar certificado (sob demanda — Decisão FPKT #3).
//
// Para CURSO (exam_type == 'curso'):
//   Seção "Participantes" com lista de inscritos + campo de
//   busca/autocomplete para inscrever praticantes via
//   POST /belt-exams/:examId/candidates { student_id }.
//   Sem remoção de participante (backend não tem DELETE candidate).
//
// Dados reais via karateApi.getBeltExam. Sem mock: loading ->
// spinner, falha -> ErrorState.
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, ViewStyle, TextStyle, TextInput, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { LancarResultadosModal } from "@/components/karate/LancarResultadosModal";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, ExamCandidate, BeltExam, PractitionerListItem } from "@/services/karateApi";
import { buildMicrositeUrl, getMicrositeSlug } from "@/utils/microsite";
import { copyToClipboard } from "@/utils/clipboard";
import { notify } from "@/utils/webAlert";
import { request } from "@/services/api";
import { RegistrationFieldsEditor, RegistrationField } from "@/components/karate/RegistrationFieldsEditor";
import { EventBannerManager } from "@/components/karate/EventBannerManager";
import { EditarExameInfoModal } from "@/components/karate/EditarExameInfoModal";
import { formatEventDateNumeric } from "@/utils/eventDate";

const RESULT_BADGE: Record<string, "ok" | "alert" | "neutral"> = {
  approved: "ok", rejected: "alert", pending: "neutral",
};
const RESULT_LABEL: Record<string, string> = {
  approved: "Aprovado", rejected: "Reprovado", pending: "Pendente",
};
const certStatusLabel: Record<string, string> = {
  pending: "Pendente", generated: "Gerado", sent: "Enviado", error: "Erro",
};
const certStatusBadge: Record<string, "neutral" | "ok" | "warn" | "alert"> = {
  pending: "neutral", generated: "ok", sent: "ok", error: "alert",
};

function fmtDate(iso?: string | null): string {
  return formatEventDateNumeric(iso, "—");
}

// Formata o valor de uma resposta (checkbox -> Sim/Não; array de select
// múltiplo -> join; o resto vira string direta).
function formatResponseValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

// Bloco A (item 4) — lista legível das registration_responses de um inscrito,
// usando registration_fields do evento para resolver label a partir da key.
// Não é dump de JSON: cada resposta vira "Label: valor".
function RegistrationResponsesList({
  responses, fields,
}: {
  responses?: Record<string, unknown> | null;
  fields?: RegistrationField[] | null;
}) {
  if (!responses || Object.keys(responses).length === 0) return null;
  const fieldByKey = new Map((fields ?? []).map((f) => [f.key, f]));
  const entries = Object.entries(responses).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <View style={styles.responsesBox}>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.responseRow}>
          <Text style={styles.responseLabel}>{fieldByKey.get(key)?.label ?? key}</Text>
          <Text style={styles.responseValue}>{formatResponseValue(value)}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Seção de Participantes (apenas para curso) ──────────────────
interface ParticipantesSectionProps {
  candidates: ExamCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<ExamCandidate[]>>;
  federationId: string;
  examId: string;
  registrationFields?: RegistrationField[];
}

function ParticipantesSection({ candidates, setCandidates, federationId, examId, registrationFields }: ParticipantesSectionProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PractitionerListItem[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // IDs dos já inscritos para evitar duplicata visual
  const enrolledIds = new Set(candidates.map((c) => c.practitioner_id));

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await karateApi.listPractitioners(federationId, { q: text.trim(), pageSize: 8 });
        setSuggestions(res.data ?? []);
        setSuggestionsOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleSelect = async (item: PractitionerListItem) => {
    setSuggestionsOpen(false);
    setQuery("");
    setSuggestions([]);
    if (enrolledIds.has(item.id)) {
      notify("Já inscrito", `${item.full_name} já é participante deste curso.`);
      return;
    }
    setEnrolling(true);
    try {
      const candidate = await karateApi.addExamCandidate(federationId, examId, { student_id: item.id });
      setCandidates((prev) => [...prev, candidate]);
    } catch (e: any) {
      notify("Não foi possível inscrever", e?.message ?? "Tente novamente.");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <View style={ps.container}>
      <Text style={ps.sectionTitle}>Participantes ({candidates.length})</Text>

      {/* Campo de busca */}
      <View style={ps.searchWrap}>
        <View style={[ps.inputRow, enrolling && ps.inputDisabled]}>
          <TextInput
            ref={inputRef}
            style={ps.textInput}
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true); }}
            onBlur={() => { setTimeout(() => setSuggestionsOpen(false), 160); }}
            placeholder="Buscar praticante para inscrever…"
            placeholderTextColor={KarateColors.ink3}
            autoCorrect={false}
            editable={!enrolling}
            accessibilityLabel="Buscar praticante"
          />
          {searching || enrolling ? (
            <ActivityIndicator size="small" color={KarateColors.primary} style={ps.icon} />
          ) : (
            <Icon name={"search" as any} size={15} color={KarateColors.ink3} style={ps.icon} />
          )}
        </View>

        {/* Dropdown de sugestões */}
        {suggestionsOpen && suggestions.length > 0 && (
          <View style={ps.dropdown}>
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[ps.dropItem, enrolledIds.has(item.id) && ps.dropItemDim]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.75}
                accessibilityRole="menuitem"
                accessibilityLabel={item.full_name}
              >
                <View style={{ flex: 1 }}>
                  <Text style={ps.dropName}>{item.full_name}</Text>
                  {(item.dojo_name || item.karate_registration_number) ? (
                    <Text style={ps.dropSub} numberOfLines={1}>
                      {[item.dojo_name, item.karate_registration_number].filter(Boolean).join("  ·  ")}
                    </Text>
                  ) : null}
                </View>
                {enrolledIds.has(item.id) ? (
                  <Icon name={"check" as any} size={13} color={KarateColors.ok} />
                ) : (
                  <Icon name={"person-add-outline" as any} size={14} color={KarateColors.ink3} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Nenhuma sugestão */}
        {suggestionsOpen && !searching && suggestions.length === 0 && query.trim().length >= 2 && (
          <View style={ps.dropdown}>
            <Text style={ps.dropEmpty}>Nenhum praticante encontrado para "{query}".</Text>
          </View>
        )}
      </View>

      {/* Lista de inscritos */}
      {candidates.length === 0 ? (
        <KarateEmptyState
          icon="people-outline"
          title="Nenhum participante inscrito"
          subtitle="Use o campo acima para buscar e inscrever praticantes neste curso."
          style={{ paddingVertical: 32 }}
        />
      ) : (
        candidates.map((c) => (
          <View key={c.id} style={ps.card}>
            <View style={ps.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={ps.cardName}>{c.full_name}</Text>
                <Text style={ps.cardMeta}>
                  {[c.karate_registration_number, (c as any).dojo_name].filter(Boolean).join("  ·  ") || "—"}
                </Text>
              </View>
              <Badge status="ok" label="Inscrito" />
            </View>
            <RegistrationResponsesList responses={c.registration_responses} fields={registrationFields} />
          </View>
        ))
      )}

      {/* TODO: remoção de participante quando o backend expuser DELETE /candidates/:id */}
    </View>
  );
}

const ps = StyleSheet.create({
  container: { gap: 12 } as ViewStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  searchWrap: { zIndex: 10 } as ViewStyle,
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: KarateColors.bg2,
    borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: KarateRadius.md,
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 8,
  } as ViewStyle,
  inputDisabled: { opacity: 0.6 } as ViewStyle,
  textInput: { flex: 1, fontSize: 13, color: KarateColors.ink, outlineWidth: 0 } as any,
  icon: { flexShrink: 0 } as ViewStyle,
  dropdown: {
    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
    backgroundColor: KarateColors.bg2,
    borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: KarateRadius.md,
    marginTop: 4,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } as ViewStyle,
  dropItem: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: KarateColors.border,
    gap: 8,
  } as ViewStyle,
  dropItemDim: { opacity: 0.5 } as ViewStyle,
  dropName: { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  dropSub: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  dropEmpty: { fontSize: 12, color: KarateColors.ink3, padding: 12, textAlign: "center" } as TextStyle,
  card: {
    backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12,
  } as ViewStyle,
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  cardMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
});

// ── Tela principal ──────────────────────────────────────────────
export default function ExameDetalhe() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const router = useRouter();
  const { federationId } = useKarateFederation();

  const [exam, setExam] = useState<BeltExam | null>(null);
  const [candidates, setCandidates] = useState<ExamCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showResultados, setShowResultados] = useState(false);
  const [closingExam, setClosingExam] = useState(false);
  // F6.2: confirmação inline (Modal) para fechar exame — window.confirm trava a aba no web.
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closePendingCount, setClosePendingCount] = useState(0);
  // Nav P2: slug público da federação para o link de inscrição (empty state).
  const [pubSlug, setPubSlug] = useState<string | null>(null);
  // Bloco A: publicar inscrições (draft -> open) e copiar link direto do evento.
  const [publishing, setPublishing] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);
  // Bloco A: formulário de inscrição configurável (registration_fields).
  const [savingFields, setSavingFields] = useState(false);
  // Tornar evento editável: modal "Editar informações" (título, data, local, faixa/curso).
  const [showEditInfo, setShowEditInfo] = useState(false);

  const isCurso = exam?.exam_type === "curso";

  const load = useCallback(async (isRefresh = false) => {
    if (!examId) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.getBeltExam(federationId, examId);
      setExam(res);
      setCandidates(res.candidates ?? []);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, examId]);

  useEffect(() => { load(); }, [load]);

  // Resolve o slug público da federação (best-effort, sem bloquear a tela).
  useEffect(() => {
    let alive = true;
    const fromHost = getMicrositeSlug();
    if (fromHost) { setPubSlug(fromHost); return; }
    if (!federationId) return;
    karateApi.getFederationIdentity(federationId)
      .then((id) => { if (alive && id?.slug) setPubSlug(id.slug); })
      .catch(() => { /* sem slug -> empty state sem ação de link */ });
    return () => { alive = false; };
  }, [federationId]);

  // Link público da federação (microsite) — usado pela ação do empty state.
  const publicUrl = pubSlug ? buildMicrositeUrl(pubSlug, "/") : null;

  const shareInscription = async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    notify(
      ok ? "Link copiado" : "Não foi possível copiar",
      ok ? `Compartilhe a página pública da federação:\n${publicUrl}` : "Copie manualmente: " + publicUrl
    );
  };

  // Link público da INSCRIÇÃO deste evento (não a home da federação).
  // Usa o slug amigável quando disponível; cai para federationId (UUID) —
  // resolveFederation no backend aceita slug OU UUID.
  const inscriptionUrl = exam
    ? (pubSlug ? buildMicrositeUrl(pubSlug, `/inscricao/${exam.id}`) : buildMicrositeUrl(federationId, `/inscricao/${exam.id}`))
    : null;

  const copyInscriptionLink = async () => {
    if (!inscriptionUrl) return;
    setCopyingLink(true);
    try {
      const ok = await copyToClipboard(inscriptionUrl);
      notify(
        ok ? "Link copiado" : "Não foi possível copiar",
        ok ? `Link de inscrição copiado:\n${inscriptionUrl}` : "Copie manualmente: " + inscriptionUrl
      );
    } finally {
      setCopyingLink(false);
    }
  };

  // Publica o evento (draft -> open). PATCH já aceita status; sem rota nova.
  const handlePublish = async () => {
    if (!exam) return;
    setPublishing(true);
    try {
      await request(`/federation/${federationId}/belt-exams/${exam.id}`, {
        method: "PATCH",
        body: { status: "open" },
      });
      setExam((prev) => (prev ? { ...prev, status: "open" } : prev));
    } catch (e: any) {
      notify("Não foi possível publicar", e?.message ?? "Tente novamente.");
    } finally {
      setPublishing(false);
    }
  };

  // Salva os campos do formulário de inscrição configurável (Bloco A).
  const handleSaveRegistrationFields = async (fields: RegistrationField[]) => {
    if (!exam) return;
    setSavingFields(true);
    try {
      await request(`/federation/${federationId}/belt-exams/${exam.id}`, {
        method: "PATCH",
        body: { registration_fields: fields },
      });
      setExam((prev) => (prev ? { ...prev, registration_fields: fields } : prev));
      notify("Campos salvos", "O formulário de inscrição foi atualizado.");
    } catch (e: any) {
      notify("Não foi possível salvar", e?.message ?? "Tente novamente.");
    } finally {
      setSavingFields(false);
    }
  };

  const handleCandidateUpdate = (updated: ExamCandidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Tornar evento editável: após salvar via karateApi.updateBeltExam, atualiza o estado local do exam.
  const handleExamInfoUpdated = (updated: BeltExam) => {
    setExam((prev) => (prev ? { ...prev, ...updated } : updated));
    setShowEditInfo(false);
  };

  const handleCloseExam = () => {
    if (!exam) return;
    setClosePendingCount(candidates.filter((c) => c.result === "pending").length);
    setShowCloseConfirm(true);
  };

  const confirmCloseExam = async () => {
    if (!exam) return;
    setClosingExam(true);
    try {
      await karateApi.closeBeltExam(federationId, exam.id);
      setExam((prev) => (prev ? { ...prev, status: "done" } : prev));
    } catch (e: any) {
      notify("Não foi possível fechar o exame", e?.message ?? "Tente novamente.");
    } finally {
      setClosingExam(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg }}>
        <ActivityIndicator size="large" color={KarateColors.primary} style={{ marginTop: 48 }} />
      </View>
    );
  }
  if (error || !exam) return <KarateErrorState onRetry={() => load()} />;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Voltar">
          <Icon name={"arrow-back-outline" as any} size={20} color={KarateColors.primary} />
          <Text style={styles.backText}>Eventos</Text>
        </TouchableOpacity>

        <View style={styles.examHeader}>
          <View style={styles.examTitleRow}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <View style={styles.headerBadges}>
              {isCurso && <Badge status="neutral" label="Curso" />}
              <Badge
                status={exam.status === "open" ? "ok" : (exam.status === "done" || exam.status === "closed") ? "warn" : "neutral"}
                label={exam.status === "open" ? "Aberto" : (exam.status === "done" || exam.status === "closed") ? "Encerrado" : "Rascunho"}
              />
            </View>
          </View>
          <View style={styles.metaRow}>
            <Icon name={"calendar-outline" as any} size={13} color={KarateColors.ink3} />
            <Text style={styles.metaText}>{fmtDate(exam.exam_date)}</Text>
            {!!exam.location && (
              <>
                <Icon name={"location-outline" as any} size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{exam.location}</Text>
              </>
            )}
            {!!(exam as any).hours && (
              <>
                <Icon name={"time-outline" as any} size={13} color={KarateColors.ink3} />
                <Text style={styles.metaText}>{(exam as any).hours}h/aula</Text>
              </>
            )}
          </View>
          {!isCurso && <Text style={styles.metaText}>Faixa alvo: {exam.target_belt}</Text>}
          {!!exam.description && (
            <Text style={{ fontSize: 13, color: KarateColors.ink2, lineHeight: 19, marginTop: 8 }}>{exam.description}</Text>
          )}

          {/* Bloco A: publicar inscrições (draft -> open) + copiar link direto do evento. */}
          <View style={styles.headerActions}>
            {exam.status === "draft" && (
              <KarateButton
                label={publishing ? "Publicando..." : "Publicar / Ativar inscrições"}
                variant="sumi"
                size="sm"
                loading={publishing}
                onPress={handlePublish}
                style={{ flex: 1 }}
              />
            )}
            <KarateButton
              label={copyingLink ? "Copiando..." : "Copiar link de inscrição"}
              variant="secondary"
              size="sm"
              loading={copyingLink}
              onPress={copyInscriptionLink}
              style={{ flex: 1 }}
            />
            {/* Todos os eventos são editáveis: título, data, local, faixa/tipo. */}
            <KarateButton
              label="Editar informações"
              variant="secondary"
              size="sm"
              onPress={() => setShowEditInfo(true)}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Bloco A: formulário de inscrição configurável (exame e curso). */}
        <View style={styles.fieldsSection}>
          <RegistrationFieldsEditor
            fields={exam.registration_fields ?? []}
            onSave={handleSaveRegistrationFields}
            saving={savingFields}
          />
        </View>

        {/* Banner deixou de ser tela própria: agora é anexo do evento. */}
        <EventBannerManager federationId={federationId} eventId={exam.id} />

        {/* ── Seção específica de EXAME ─────────────────────────── */}
        {!isCurso && (
          <>
            {exam.status === "open" && (
              <View style={styles.actions}>
                <KarateButton label="Lançar Resultados" variant="primary" size="sm" onPress={() => setShowResultados(true)} style={{ flex: 1 }} />
                <KarateButton label={closingExam ? "Fechando..." : "Fechar Exame"} variant="secondary" size="sm" loading={closingExam} onPress={handleCloseExam} style={{ flex: 1 }} />
              </View>
            )}

            <Text style={styles.sectionTitle}>Candidatos ({candidates.length})</Text>
            {candidates.length === 0 ? (
              <KarateEmptyState
                icon="people-outline"
                title="Nenhum candidato inscrito"
                subtitle="Assim que houver inscrições neste exame, os candidatos aparecem aqui para lançar resultados."
                style={{ paddingVertical: 40 }}
                action={
                  publicUrl ? (
                    <KarateButton
                      label="Compartilhar link de inscrição"
                      variant="secondary"
                      size="sm"
                      onPress={shareInscription}
                    />
                  ) : undefined
                }
              />
            ) : (
              candidates.map((c) => (
                <View key={c.id} style={styles.candidateCard}>
                  <View style={styles.candidateRow}>
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateName}>{c.full_name}</Text>
                      <Text style={styles.candidateMeta}>{c.karate_registration_number ?? "—"} · Faixa atual: {c.current_belt ?? "—"}</Text>
                    </View>
                    <Badge status={RESULT_BADGE[c.result]} label={RESULT_LABEL[c.result]} />
                  </View>
                  {c.notes && <Text style={styles.notes}>Obs: {c.notes}</Text>}
                  <RegistrationResponsesList responses={c.registration_responses} fields={exam.registration_fields} />

                  {c.result === "approved" && c.certificate_status && (
                    <View style={styles.certSection}>
                      <Text style={styles.certLabel}>Certificado:</Text>
                      <Badge status={certStatusBadge[c.certificate_status]} label={certStatusLabel[c.certificate_status]} />
                      {c.certificate_url && <Text style={styles.certUrl} numberOfLines={1}>{c.certificate_url}</Text>}
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* ── Seção específica de CURSO ─────────────────────────── */}
        {isCurso && (
          <ParticipantesSection
            candidates={candidates}
            setCandidates={setCandidates}
            federationId={federationId}
            examId={exam.id}
            registrationFields={exam.registration_fields}
          />
        )}

        {/* ── Bloco C — Certificados (evento fechado) ───────────────
            Apenas lista quem está elegível: curso = todos os participantes;
            exame/graus = apenas aprovados. SEM geração de arte — só
            status de elegibilidade (workflow de certificados, fase futura
            cuida da emissão em si). Checa 'closed' (valor canônico) e
            'done' (valor legado que o backend gravava antes deste bloco). */}
        {(exam.status === "closed" || (exam.status as string) === "done") && (
          <View style={styles.certsSection}>
            <View style={styles.certsHeader}>
              <Icon name="ribbon" size={16} color={KarateColors.primary} />
              <Text style={styles.sectionTitle}>Certificados</Text>
            </View>
            {candidates.filter((c) => c.certificate_eligible).length === 0 ? (
              <KarateEmptyState
                icon="ribbon-outline"
                title="Nenhum elegível"
                subtitle={
                  isCurso
                    ? "Nenhum participante ficou elegível ao fechar este curso."
                    : "Nenhum candidato aprovado ficou elegível ao fechar este exame."
                }
                style={{ paddingVertical: 28 }}
              />
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={styles.certsHint}>
                  {isCurso
                    ? "Todos os participantes do curso ficaram elegíveis."
                    : "Candidatos aprovados ficaram elegíveis."}
                </Text>
                {candidates.filter((c) => c.certificate_eligible).map((c) => (
                  <View key={c.id} style={styles.certEligibleRow}>
                    <Icon name="checkmark-circle" size={16} color={KarateColors.ok ?? KarateColors.primary} />
                    <Text style={styles.certEligibleName}>{c.full_name}</Text>
                    {c.karate_registration_number && (
                      <Text style={styles.candidateMeta}>{c.karate_registration_number}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de resultados — apenas para exame */}
      {!isCurso && (
        <LancarResultadosModal
          visible={showResultados}
          candidates={candidates}
          onClose={() => setShowResultados(false)}
          onUpdateCandidate={handleCandidateUpdate}
          federationId={federationId}
          examId={exam.id}
        />
      )}

      {/* Editar informações — disponível para exame e curso */}
      <EditarExameInfoModal
        visible={showEditInfo}
        exam={exam}
        federationId={federationId}
        onClose={() => setShowEditInfo(false)}
        onSaved={handleExamInfoUpdated}
      />

      {/* F6.2 — confirmação inline de "Fechar exame" (window.confirm trava a aba no web) */}
      <Modal transparent visible={showCloseConfirm} animationType="fade" onRequestClose={() => setShowCloseConfirm(false)}>
        <View style={styles.overlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>Fechar exame?</Text>
            <Text style={styles.confirmMessage}>
              Tem certeza que deseja fechar "{exam.title}"?
              {closePendingCount > 0 ? `\n\n${closePendingCount} candidato(s) ainda com resultado pendente.` : ""}
            </Text>
            <View style={styles.confirmActions}>
              <KarateButton
                label="Cancelar"
                variant="secondary"
                size="sm"
                onPress={() => setShowCloseConfirm(false)}
                disabled={closingExam}
                style={{ flex: 1 }}
              />
              <KarateButton
                label={closingExam ? "Fechando..." : "Fechar exame"}
                variant="primary"
                size="sm"
                loading={closingExam}
                disabled={closingExam}
                onPress={() => {
                  setShowCloseConfirm(false);
                  confirmCloseExam();
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 12, paddingBottom: 40, maxWidth: 860, width: "100%", alignSelf: "center" } as ViewStyle,
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 } as ViewStyle,
  backText: { fontSize: 13, color: KarateColors.primary, fontWeight: "600" } as TextStyle,
  examHeader: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 6 } as ViewStyle,
  examTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  headerBadges: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  headerActions: { flexDirection: "row", gap: 8, marginTop: 8 } as ViewStyle,
  examTitle: { flex: 1, fontFamily: KarateFonts.heading, fontSize: 19, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" } as ViewStyle,
  metaText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  actions: { flexDirection: "row", gap: 8 } as ViewStyle,
  fieldsSection: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  emptyTxt: { fontSize: 13, color: KarateColors.ink3, paddingVertical: 8 } as TextStyle,
  candidateCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 6 } as ViewStyle,
  candidateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  candidateInfo: { flex: 1, gap: 2 } as ViewStyle,
  candidateName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  candidateMeta: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  notes: { fontSize: 12, color: KarateColors.warn, fontStyle: "italic" } as TextStyle,
  responsesBox: { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: KarateColors.border, gap: 4 } as ViewStyle,
  responseRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 } as ViewStyle,
  responseLabel: { fontSize: 11.5, color: KarateColors.ink3, flexShrink: 0 } as TextStyle,
  responseValue: { fontSize: 11.5, color: KarateColors.ink, fontWeight: "600", flex: 1, textAlign: "right" } as TextStyle,
  certSection: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 6, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  certLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  certUrl: { fontSize: 11, color: KarateColors.primary, flex: 1 } as TextStyle,
  // ── Bloco C — Certificados (elegibilidade pós-fechamento) ──────
  certsSection: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  certsHeader: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  certsHint: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  certEligibleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  certEligibleName: { flex: 1, fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  // F6.2 — confirmação inline de "Fechar exame" (Modal in-app)
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  confirmSheet: { width: "100%", maxWidth: 380, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 20, gap: 10 } as ViewStyle,
  confirmTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  confirmMessage: { fontSize: 13, color: KarateColors.ink2, lineHeight: 19 } as TextStyle,
  confirmActions: { flexDirection: "row", gap: 8, marginTop: 8 } as ViewStyle,
});
