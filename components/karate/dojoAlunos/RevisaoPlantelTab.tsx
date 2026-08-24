// ============================================================
// RevisaoPlantelTab — F11.3 (dojô): revisão do plantel herdado
// Aba "Revisão do plantel" da tela Alunos, irmã de FederadosTab.
//
// ── POR QUE ESTA ABA EXISTE ─────────────────────────────────
// Quando o sensei assume o registro federativo (F11.0–F11.2), ele herda
// os praticantes que já apontavam para aquela linha. A lista da FPKT está
// velha (9.840 praticantes em 105 registros; 74 dojôs inativos carregam
// 4.033). Aqui ele diz quem realmente treina com ele.
//
// ── ⚠️ O QUE ESTA TELA NÃO FAZ, E NÃO PODE PARECER FAZER ────
// Ela NÃO inativa e NÃO exclui ninguém. "Não reconheço" não é "inativo":
// o praticante pode ter MUDADO DE DOJÔ (540 transferências registradas).
// O sensei sabe responder "esta pessoa treina comigo?"; ele NÃO sabe
// responder "esta pessoa parou de treinar karatê?". Por isso, em toda a
// tela:
//   • os dois botões da linha são "Treina aqui" e "Não reconheço" —
//     nunca "inativar", "excluir" ou "remover da federação";
//   • o cabeçalho e o modal de conclusão dizem, com todas as letras, que
//     a marcação vira AVISO e que quem decide é a federação;
//   • quando o sensei não reconhece alguém que a federação tem como
//     ATIVO, a própria linha lembra que pode ser transferência.
// Se a interface prometesse mais do que faz, o sensei acharia que limpou
// a base — e não limpou.
//
// ── VOLUME (centenas por dojô) ──────────────────────────────
// Paginação server-side (50/página), busca por nome/matrícula, filtros
// por status na federação e por estado da revisão, seleção múltipla que
// SOBREVIVE à troca de página, e ação sobre TODO o filtro atual (o
// backend aceita 500 ids por chamada; markInChunks quebra o resto).
// Obrigar 300 cliques individuais mataria a feature.
//
// ── RETOMÁVEL ───────────────────────────────────────────────
// O estado mora no servidor: marca metade hoje, volta amanhã. A barra de
// progresso mostra revisados/faltando, e a revisão só nasce na PRIMEIRA
// marcação — abrir a aba para olhar não começa revisão nenhuma.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { toast } from "@/components/Toast";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateDojoRosterReviewApi, RosterPractitioner, RosterReviewState, RosterSummary,
  RosterReviewItemStatus, RosterPendingPolicy, RosterMarkStatus,
  ROSTER_PAGE_SIZE, mapRosterReviewError, rosterReviewErrorCode, rosterReviewErrorSummary,
} from "@/services/karateDojoRosterReviewApi";
import { ConcluirRevisaoModal } from "./ConcluirRevisaoModal";

type ActiveFilter = "all" | "active" | "inactive";
type ReviewFilter = "all" | RosterReviewItemStatus;

const EMPTY_SUMMARY: RosterSummary = {
  inherited_total: 0, recognized: 0, not_recognized: 0, pending: 0, inactive_in_federation: 0,
};

const REVIEW_FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Sem marcação" },
  { key: "recognized", label: "Treinam aqui" },
  { key: "not_recognized", label: "Não reconheço" },
];

const ACTIVE_FILTERS: { key: ActiveFilter; label: string }[] = [
  { key: "all", label: "Qualquer situação" },
  { key: "active", label: "Ativos na federação" },
  { key: "inactive", label: "Inativos na federação" },
];

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  /** Deixa a tela-mãe (Alunos) atualizar o badge da aba sem refazer o GET. */
  onSummaryChange?: (summary: RosterSummary) => void;
}

export function RevisaoPlantelTab({ onSummaryChange }: Props) {
  const { federationId } = useKarateFederation();

  const [state, setState] = useState<RosterReviewState | null>(null);
  const [rows, setRows] = useState<RosterPractitioner[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [busy, setBusy] = useState(false);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");

  // Seleção por id — sobrevive à troca de página e à troca de filtro (o
  // sensei pode ir juntando gente de páginas diferentes antes de agir).
  const [selected, setSelected] = useState<string[]>([]);

  // Ação sobre TODO o filtro atual: confirmada num passo explícito, com o
  // número na frente. É o caminho que evita 300 cliques.
  const [bulkAsk, setBulkAsk] = useState<RosterMarkStatus | null>(null);

  const [concluirOpen, setConcluirOpen] = useState(false);
  const [concluirErr, setConcluirErr] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [resultado, setResultado] = useState<{ notices: number; changed: boolean } | null>(null);

  const reqIdRef = useRef(0);
  // Guarda de concorrência REAL (a variável de estado `busy` só serve para
  // a UI; ela não vale dentro do closure de uma chamada já em curso).
  const busyRef = useRef(false);
  // O callback do pai vive numa ref: se ele chegasse nas deps de `load`,
  // um arrow inline no pai recriaria `load` a cada render e o efeito
  // entraria em laço (fetch → setState → novo load → fetch…).
  const onSummaryRef = useRef(onSummaryChange);
  useEffect(() => { onSummaryRef.current = onSummaryChange; }, [onSummaryChange]);

  const summary = state?.summary ?? EMPTY_SUMMARY;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Busca com respiro: 350ms sem digitar antes de ir ao servidor (a lista
  // é server-side; um GET por tecla numa base de centenas é desperdício).
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    if (!federationId) return;
    const myReq = ++reqIdRef.current;
    setLoading(true);
    try {
      // Estado (progresso) e página falham de forma INDEPENDENTE: um 500
      // na lista não pode apagar a barra de progresso que veio 200.
      const [stateRes, pageRes] = await Promise.allSettled([
        karateDojoRosterReviewApi.getState(federationId),
        karateDojoRosterReviewApi.listRoster(federationId, {
          q: q || undefined,
          status: activeFilter === "all" ? undefined : activeFilter,
          review_status: reviewFilter === "all" ? undefined : reviewFilter,
          limit: ROSTER_PAGE_SIZE,
          offset,
        }),
      ]);
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta

      if (stateRes.status === "fulfilled") {
        setState(stateRes.value);
        onSummaryRef.current?.(stateRes.value.summary);
      }
      if (pageRes.status === "fulfilled") {
        setRows(pageRes.value.data);
        setCount(pageRes.value.count);
        setListError(false);
      } else {
        setListError(true);
      }
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  }, [federationId, q, activeFilter, reviewFilter, offset]);

  useEffect(() => { load(); }, [load]);

  // ── Marcação ──────────────────────────────────────────────────────────
  // Uma única porta para toda marcação (linha, seleção e filtro inteiro):
  // o mesmo tratamento de erro, o mesmo reload, a mesma frase.
  const runMark = useCallback(async (ids: string[], status: RosterMarkStatus, clearSelection: boolean) => {
    if (!federationId || !ids.length) return;
    // markInChunks quebra em lotes de 500 (teto do backend) e vai somando.
    const res = await karateDojoRosterReviewApi.markInChunks(federationId, ids, status);
    setState((prev) => ({
      review: res.review ?? prev?.review ?? null,
      summary: res.summary,
      schema_pending: prev?.schema_pending ?? false,
    }));
    onSummaryRef.current?.(res.summary);
    if (clearSelection) setSelected([]);
    if (res.skipped_count > 0) {
      // Id que não é deste dojô volta em `skipped` e NUNCA escreve — dizer
      // isso é melhor que sumir com a diferença entre pedido e feito.
      toast.info(`${res.skipped_count} ${res.skipped_count === 1 ? "praticante não é" : "praticantes não são"} deste dojô e ${res.skipped_count === 1 ? "foi ignorado" : "foram ignorados"}.`);
    }
    await load();
  }, [federationId, load]);

  const applyMark = useCallback(async (ids: string[], status: RosterMarkStatus, clearSelection: boolean) => {
    if (busyRef.current || !ids.length) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await runMark(ids, status, clearSelection);
    } catch (e) {
      toast.error(mapRosterReviewError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [runMark]);

  // Clicar de novo no botão já marcado DESMARCA (volta a "sem marcação").
  // Errar um clique não pode ser irreversível.
  const toggleRow = useCallback((p: RosterPractitioner, target: "recognized" | "not_recognized") => {
    const next: RosterMarkStatus = p.review_status === target ? "pending" : target;
    applyMark([p.practitioner_id], next, false);
  }, [applyMark]);

  const applyToWholeFilter = useCallback(async (status: RosterMarkStatus) => {
    if (!federationId || busyRef.current) return;
    setBulkAsk(null);
    busyRef.current = true;
    setBusy(true);
    try {
      // Os ids do FILTRO INTEIRO (não só da página) — é isto que evita
      // 300 cliques. collectIds pagina no teto de 200 por chamada.
      const { ids } = await karateDojoRosterReviewApi.collectIds(federationId, {
        q: q || undefined,
        status: activeFilter === "all" ? undefined : activeFilter,
        review_status: reviewFilter === "all" ? undefined : reviewFilter,
      });
      await runMark(ids, status, true);
    } catch (e) {
      toast.error(mapRosterReviewError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [federationId, q, activeFilter, reviewFilter, runMark]);

  // ── Conclusão ─────────────────────────────────────────────────────────
  const concluir = useCallback(async (policy?: RosterPendingPolicy) => {
    if (!federationId) return;
    setConcluindo(true);
    setConcluirErr(null);
    try {
      const res = await karateDojoRosterReviewApi.complete(federationId, policy);
      setConcluirOpen(false);
      setResultado({ notices: res.notices_created, changed: res.practitioners_changed });
      setSelected([]);
      await load();
    } catch (e) {
      // 409 REVISAO_INCOMPLETA traz os números no corpo: em vez de um
      // toast genérico, atualizamos o modal com o total real de pendentes
      // (pode ter mudado desde o último GET) e deixamos ele escolher.
      if (rosterReviewErrorCode(e) === "REVISAO_INCOMPLETA") {
        const fresh = rosterReviewErrorSummary(e);
        if (fresh) {
          setState((prev) => (prev ? { ...prev, summary: fresh } : { review: null, summary: fresh, schema_pending: false }));
          onSummaryRef.current?.(fresh);
        }
      }
      setConcluirErr(mapRosterReviewError(e));
    } finally {
      setConcluindo(false);
    }
  }, [federationId, load]);

  // ── Derivados de tela ─────────────────────────────────────────────────
  const revisados = summary.recognized + summary.not_recognized;
  const progresso = summary.inherited_total > 0 ? revisados / summary.inherited_total : 0;
  const pageIds = rows.map((r) => r.practitioner_id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const from = count === 0 ? 0 : offset + 1;
  const to = Math.min(offset + rows.length, count);
  const review = state?.review ?? null;
  const emAndamento = review?.status === "in_progress";
  const concluida = review?.status === "completed";

  if (!federationId) return null;

  // Migration 276 ainda não aplicada neste ambiente: o plantel existe, a
  // revisão é que ainda não. Estado honesto, sem tela vazia enigmática.
  if (state?.schema_pending) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.stateBox}>
          <Icon name="clock" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>A revisão do plantel ainda não está disponível.</Text>
          <Text style={styles.stateSub}>
            Assim que a federação liberar esta etapa, você poderá marcar aqui quem treina no seu dojô.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── O contrato, no topo: o que a marcação faz e o que não faz ── */}
      <View style={styles.lead}>
        <Text style={styles.leadTitle}>Quem treina no seu dojô hoje?</Text>
        <Text style={styles.leadTxt}>
          Esta lista veio da federação junto com o seu registro e pode estar desatualizada. Marque quem é
          seu aluno atual. <Text style={styles.leadStrong}>Marcar &quot;não reconheço&quot; não inativa nem exclui
          ninguém</Text> — a pessoa pode ter mudado de dojô. A federação recebe um aviso e decide o que fazer.
        </Text>
      </View>

      {/* ── Resultado da última conclusão (fica até sair da aba) ── */}
      {resultado ? (
        <View style={styles.doneBox}>
          <Icon name="check_circle" size={18} color={KarateColors.ok} />
          <View style={styles.doneTxtWrap}>
            <Text style={styles.doneTitle}>
              Revisão concluída — {resultado.notices} {resultado.notices === 1 ? "aviso enviado" : "avisos enviados"} à federação.
            </Text>
            <Text style={styles.doneSub}>
              {resultado.changed
                ? "O cadastro dos praticantes foi atualizado pela federação."
                : "Nenhum praticante foi inativado ou excluído: a federação vai conferir cada aviso e decidir."}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Progresso (retomada) ── */}
      <View style={styles.card}>
        <View style={styles.progHead}>
          <Text style={styles.cardTitle}>
            {revisados} de {summary.inherited_total} revisados
          </Text>
          {summary.pending > 0 ? (
            <Text style={styles.progFalta}>faltam {summary.pending}</Text>
          ) : (
            <Text style={styles.progOk}>tudo marcado</Text>
          )}
        </View>
        <View style={styles.progTrack}>
          <View style={[styles.progFill, { width: `${Math.round(progresso * 100)}%` }]} />
        </View>
        <View style={styles.progLegend}>
          <Legend color={KarateColors.ok} label={`${summary.recognized} treinam aqui`} />
          <Legend color={KarateColors.warn} label={`${summary.not_recognized} não reconheço`} />
          <Legend color={KarateColors.ink4} label={`${summary.pending} sem marcação`} />
        </View>
        <Text style={styles.progHint}>
          Você pode sair e voltar depois: o que já foi marcado fica guardado.
          {emAndamento && review?.started_at ? ` Revisão começada em ${fmtDateTime(review.started_at)}.` : ""}
          {concluida && review?.completed_at
            ? ` Última revisão concluída em ${fmtDateTime(review.completed_at)}${review.notices_created != null ? ` (${review.notices_created} ${review.notices_created === 1 ? "aviso" : "avisos"})` : ""}. Marque abaixo se o plantel mudou desde então.`
            : ""}
        </Text>

        {summary.inherited_total > 0 && (
          <View style={styles.concluirRow}>
            <KarateButton
              label="Concluir revisão"
              variant="sumi"
              size="sm"
              disabled={busy}
              onPress={() => { setConcluirErr(null); setConcluirOpen(true); }}
            />
            <Text style={styles.concluirHint}>Envia os avisos para a federação conferir.</Text>
          </View>
        )}
      </View>

      {/* ── O caso que merece atenção ── */}
      {summary.inactive_in_federation > 0 && (
        <TouchableOpacity
          style={styles.hintBox}
          onPress={() => { setActiveFilter("inactive"); setReviewFilter("pending"); setOffset(0); }}
          accessibilityRole="button"
        >
          <Icon name="info" size={15} color={KarateColors.ink3} />
          <Text style={styles.hintTxt}>
            A federação já tem {summary.inactive_in_federation} {summary.inactive_in_federation === 1 ? "praticante" : "praticantes"} desta lista
            como {summary.inactive_in_federation === 1 ? "inativo" : "inativos"}. Filtrar por eles →
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Busca + filtros ── */}
      <View style={styles.search}>
        <Icon name="search" size={16} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          value={qInput}
          onChangeText={setQInput}
          placeholder="Buscar por nome ou matrícula"
          placeholderTextColor={KarateColors.ink4}
          accessibilityLabel="Buscar praticante do plantel herdado"
        />
        {qInput ? (
          <TouchableOpacity onPress={() => setQInput("")} accessibilityRole="button" accessibilityLabel="Limpar busca">
            <Icon name="x" size={15} color={KarateColors.ink3} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {REVIEW_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={reviewFilter === f.key}
              onPress={() => { setReviewFilter(f.key); setOffset(0); }}
            />
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {ACTIVE_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={activeFilter === f.key}
              onPress={() => { setActiveFilter(f.key); setOffset(0); }}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Barra de lote ── */}
      <View style={styles.bulkBar}>
        <View style={styles.bulkLine}>
          <TouchableOpacity
            style={styles.selectAll}
            onPress={() => {
              setSelected((prev) => (allPageSelected
                ? prev.filter((id) => !pageIds.includes(id))
                : Array.from(new Set(prev.concat(pageIds)))));
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allPageSelected }}
            disabled={rows.length === 0}
          >
            <View style={[styles.box, allPageSelected && styles.boxOn]}>
              {allPageSelected ? <Icon name="check" size={11} color="#fdf8f2" /> : null}
            </View>
            <Text style={styles.selectAllTxt}>
              {allPageSelected ? "Desmarcar esta página" : `Selecionar esta página (${rows.length})`}
            </Text>
          </TouchableOpacity>
          {selected.length > 0 ? (
            <TouchableOpacity onPress={() => setSelected([])} accessibilityRole="button">
              <Text style={styles.clearSel}>limpar seleção ({selected.length})</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {selected.length > 0 ? (
          <View style={styles.bulkActions}>
            <Text style={styles.bulkLabel}>{selected.length} selecionados:</Text>
            <KarateButton label="Treinam aqui" variant="secondary" size="sm" disabled={busy}
              onPress={() => applyMark(selected, "recognized", true)} />
            <KarateButton label="Não reconheço" variant="secondary" size="sm" disabled={busy}
              onPress={() => applyMark(selected, "not_recognized", true)} />
            <KarateButton label="Tirar marcação" variant="ghost" size="sm" disabled={busy}
              onPress={() => applyMark(selected, "pending", true)} />
          </View>
        ) : null}

        {count > rows.length && count > 0 ? (
          <View style={styles.bulkActions}>
            <Text style={styles.bulkLabel}>Todos os {count} do filtro atual:</Text>
            <KarateButton label="Treinam aqui" variant="secondary" size="sm" disabled={busy}
              onPress={() => setBulkAsk("recognized")} />
            <KarateButton label="Não reconheço" variant="secondary" size="sm" disabled={busy}
              onPress={() => setBulkAsk("not_recognized")} />
          </View>
        ) : null}
      </View>

      {/* ── Lista ── */}
      {loading && rows.length === 0 ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      ) : listError ? (
        <View style={styles.stateBox}>
          <Icon name="alert_circle" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Não foi possível carregar o plantel.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.stateBox}>
          <Icon name="users" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>
            {summary.inherited_total === 0
              ? "Nenhum praticante herdado da federação."
              : "Nenhum praticante com estes filtros."}
          </Text>
          <Text style={styles.stateSub}>
            {summary.inherited_total === 0
              ? "Quando a federação apontar praticantes para o seu registro, eles aparecem aqui para revisão."
              : "Ajuste a busca ou os filtros acima."}
          </Text>
        </View>
      ) : (
        <>
          {rows.map((p) => (
            <PractitionerRow
              key={p.practitioner_id}
              p={p}
              selected={selectedSet.has(p.practitioner_id)}
              busy={busy}
              onToggleSelect={() => setSelected((prev) => (prev.includes(p.practitioner_id)
                ? prev.filter((id) => id !== p.practitioner_id)
                : prev.concat(p.practitioner_id)))}
              onMark={(target) => toggleRow(p, target)}
            />
          ))}

          <View style={styles.pager}>
            <TouchableOpacity
              style={[styles.pageBtn, offset === 0 && styles.pageBtnOff]}
              disabled={offset === 0 || loading}
              onPress={() => setOffset(Math.max(0, offset - ROSTER_PAGE_SIZE))}
              accessibilityRole="button"
              accessibilityLabel="Página anterior"
            >
              <Icon name="chevron_left" size={16} color={offset === 0 ? KarateColors.ink4 : KarateColors.ink2} />
            </TouchableOpacity>
            <Text style={styles.pagerTxt}>{from}–{to} de {count}</Text>
            <TouchableOpacity
              style={[styles.pageBtn, to >= count && styles.pageBtnOff]}
              disabled={to >= count || loading}
              onPress={() => setOffset(offset + ROSTER_PAGE_SIZE)}
              accessibilityRole="button"
              accessibilityLabel="Próxima página"
            >
              <Icon name="chevron_right" size={16} color={to >= count ? KarateColors.ink4 : KarateColors.ink2} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Confirmação da ação sobre o filtro inteiro ── */}
      <Modal visible={bulkAsk !== null} transparent animationType="fade" onRequestClose={() => setBulkAsk(null)}>
        <View style={styles.backdrop}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>
              {bulkAsk === "recognized"
                ? `Marcar ${count} praticantes como "treinam aqui"?`
                : `Marcar ${count} praticantes como "não reconheço"?`}
            </Text>
            <Text style={styles.confirmTxt}>
              {bulkAsk === "recognized"
                ? "Vale para todos os praticantes que batem com a busca e os filtros atuais. Nenhum aviso é gerado por eles."
                : `Vale para todos os praticantes que batem com a busca e os filtros atuais. Nada é inativado agora: ao concluir a revisão, cada um deles vira um aviso para a federação conferir.`}
            </Text>
            <Text style={styles.confirmHint}>Dá para mudar qualquer marcação depois, até você concluir a revisão.</Text>
            <View style={styles.confirmBtns}>
              <KarateButton label="Cancelar" variant="ghost" size="md" onPress={() => setBulkAsk(null)} style={styles.confirmBtn} />
              <KarateButton
                label="Confirmar"
                variant="sumi"
                size="md"
                onPress={() => bulkAsk && applyToWholeFilter(bulkAsk)}
                style={styles.confirmBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ConcluirRevisaoModal
        visible={concluirOpen}
        summary={summary}
        submitting={concluindo}
        error={concluirErr}
        onCancel={() => setConcluirOpen(false)}
        onConfirm={concluir}
      />

      {busy ? (
        <View style={styles.busyBar}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
          <Text style={styles.busyTxt}>Salvando marcação…</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ── Linha do praticante ─────────────────────────────────────────────────
function PractitionerRow({ p, selected, busy, onToggleSelect, onMark }: {
  p: RosterPractitioner;
  selected: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onMark: (target: "recognized" | "not_recognized") => void;
}) {
  const isRec = p.review_status === "recognized";
  const isNot = p.review_status === "not_recognized";
  // ATIVO na federação + não reconhecido pelo sensei = o caso que merece
  // atenção (provável transferência não registrada). Inativo que ele
  // também não reconhece é decisão fácil para a federação.
  const atencao = isNot && p.is_active;

  return (
    <View style={[styles.row, selected && styles.rowSel]}>
      <View style={styles.rowMain}>
        <TouchableOpacity
          onPress={onToggleSelect}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`Selecionar ${p.name}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.box, selected && styles.boxOn]}>
            {selected ? <Icon name="check" size={11} color="#fdf8f2" /> : null}
          </View>
        </TouchableOpacity>

        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
          <View style={styles.rowMeta}>
            {p.karate_registration_number ? (
              <Text style={styles.rowMatricula}>{p.karate_registration_number}</Text>
            ) : null}
            {!p.is_active ? (
              <View style={styles.tagInativo}>
                <Text style={styles.tagInativoTxt}>Inativo na federação</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.markGroup}>
          <TouchableOpacity
            style={[styles.markBtn, isRec && styles.markBtnRec]}
            onPress={() => onMark("recognized")}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ selected: isRec }}
            accessibilityLabel={`${p.name} treina aqui`}
          >
            <Icon name="check" size={13} color={isRec ? "#fdf8f2" : KarateColors.ink3} />
            <Text style={[styles.markTxt, isRec && styles.markTxtOn]}>Treina aqui</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.markBtn, isNot && styles.markBtnNot]}
            onPress={() => onMark("not_recognized")}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ selected: isNot }}
            accessibilityLabel={`Não reconheço ${p.name} como aluno atual`}
          >
            <Icon name="x" size={13} color={isNot ? "#fdf8f2" : KarateColors.ink3} />
            <Text style={[styles.markTxt, isNot && styles.markTxtOn]}>Não reconheço</Text>
          </TouchableOpacity>
        </View>
      </View>

      {atencao ? (
        <View style={styles.rowNote}>
          <Icon name="info" size={12} color={KarateColors.ink3} />
          <Text style={styles.rowNoteTxt}>
            A federação tem esta pessoa como ativa. Se ela mudou de dojô, a federação registra a transferência —
            seu aviso só diz que ela não treina com você.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendTxt}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  // PREMISSA (24/08): coluna central com largura máxima — a revisão do
  // plantel não estica em monitor largo (padrão da mesa pública).
  content: { padding: 16, gap: 12, paddingBottom: 60, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,

  lead: { gap: 4 } as ViewStyle,
  leadTitle: { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  leadTxt: { fontSize: 13, color: KarateColors.ink3, lineHeight: 19, maxWidth: 620 } as TextStyle,
  leadStrong: { fontWeight: "800", color: KarateColors.ink2 } as TextStyle,

  doneBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: KarateColors.okSoft, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  doneTxtWrap: { flex: 1 } as ViewStyle,
  doneTitle: { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  doneSub: { fontSize: 12, color: KarateColors.ink2, marginTop: 3, lineHeight: 17 } as TextStyle,

  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  progHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  progFalta: { fontSize: 12, fontWeight: "700", color: KarateColors.warn } as TextStyle,
  progOk: { fontSize: 12, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  progTrack: { height: 8, borderRadius: 4, backgroundColor: KarateColors.bg2, overflow: "hidden" } as ViewStyle,
  progFill: { height: 8, borderRadius: 4, backgroundColor: KarateColors.primary } as ViewStyle,
  progLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  legend: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  legendDot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  legendTxt: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
  progHint: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,
  concluirRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 2 } as ViewStyle,
  concluirHint: { fontSize: 11.5, color: KarateColors.ink3, flexShrink: 1 } as TextStyle,

  hintBox: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 11 } as ViewStyle,
  hintTxt: { flex: 1, fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,

  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, paddingVertical: 11 } as TextStyle,

  chipRow: { flexDirection: "row", gap: 6, paddingVertical: 1 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.pill, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "800" } as TextStyle,

  bulkBar: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 11, gap: 9 } as ViewStyle,
  bulkLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" } as ViewStyle,
  selectAll: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  selectAllTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  clearSel: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  bulkActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as ViewStyle,
  bulkLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,

  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.surface } as ViewStyle,
  boxOn: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,

  row: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8 } as ViewStyle,
  rowSel: { borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  rowMain: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" } as ViewStyle,
  rowInfo: { flexGrow: 1, flexBasis: 160, minWidth: 140 } as ViewStyle,
  rowName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" } as ViewStyle,
  rowMatricula: { fontSize: 11.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  tagInativo: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: KarateRadius.pill, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  tagInativoTxt: { fontSize: 10.5, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,

  markGroup: { flexDirection: "row", gap: 6 } as ViewStyle,
  markBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  markBtnRec: { backgroundColor: KarateColors.ok, borderColor: KarateColors.ok } as ViewStyle,
  markBtnNot: { backgroundColor: KarateColors.warn, borderColor: KarateColors.warn } as ViewStyle,
  markTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  markTxtOn: { color: "#fdf8f2" } as TextStyle,

  rowNote: { flexDirection: "row", gap: 7, alignItems: "flex-start", backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 9 } as ViewStyle,
  rowNoteTxt: { flex: 1, fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 8 } as ViewStyle,
  pageBtn: { width: 34, height: 34, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface, alignItems: "center", justifyContent: "center" } as ViewStyle,
  pageBtnOff: { opacity: 0.45 } as ViewStyle,
  pagerTxt: { fontSize: 12.5, color: KarateColors.ink2, fontFamily: "monospace" } as TextStyle,

  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  backdrop: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  confirmSheet: { width: "100%", maxWidth: 440, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 18, gap: 10 } as ViewStyle,
  confirmTitle: { fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  confirmTxt: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  confirmHint: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,
  confirmBtns: { flexDirection: "row", gap: 10, marginTop: 4 } as ViewStyle,
  confirmBtn: { flex: 1 } as ViewStyle,

  busyBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 6 } as ViewStyle,
  busyTxt: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
