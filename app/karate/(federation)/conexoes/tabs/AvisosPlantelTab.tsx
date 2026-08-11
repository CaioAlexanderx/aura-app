// ============================================================
// AvisosPlantelTab — aba "Revisão de plantel" — Aura Karatê (federação)
// F11.3 (migration 276) · Shoji
//
// ── POR QUE ESTA FILA MORA EM CONEXÕES ──────────────────────
// Conexões já é o lugar onde a federação responde ao que os dojôs
// mandam: "Filiações" (o dojô pede para entrar) e "Praticantes" (o dojô
// pede para criar/transferir alguém). Esta é a terceira coisa que chega
// do dojô — "não reconheço esta pessoa como aluno atual" — e ela se
// resolve com o mesmo par de gestos (conferir → decidir). Seção nova no
// menu só afastaria a decisão de onde a federação já trabalha.
//
// ── ⚠️ O AVISO É DO SENSEI, NÃO DA FEDERAÇÃO ────────────────
// Cada linha é um FATO RELATADO por um dojô, com data e autor. NÃO diz
// que a pessoa parou de treinar: ela pode ter MUDADO DE DOJÔ (540
// transferências registradas). Nada foi inativado quando o aviso nasceu.
// Por isso o card mostra LADO A LADO o snapshot do momento do aviso e o
// estado ATUAL do praticante — quando divergem, é quase sempre
// transferência que ninguém registrou, e o card diz isso com todas as
// letras antes de qualquer botão.
//
// Lista e métricas falham de forma INDEPENDENTE (allSettled), condição
// de corrida resolvida por id incremental de requisição, e recarga no
// foco — mesmos padrões de SolicitacoesTab, a aba irmã.
// ============================================================
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, RefreshControl,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R,
} from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { ShojiBackground, PageHead, Card, KpiBand, Chip, Avatar } from "@/components/karate/shoji";
import { KarateButton } from "@/components/karate/KarateButton";
import { toast } from "@/components/Toast";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { DecidirAvisoModal } from "@/components/karate/rosterReview/DecidirAvisoModal";
import {
  karateRosterReviewNoticesApi, RosterReviewNotice, NoticesSummary, NoticeDecision,
  NoticeDecisionInput, NOTICES_PAGE_SIZE, EMPTY_NOTICES_SUMMARY, mapNoticeDecisionError,
} from "@/services/karateRosterReviewNoticesApi";

type DecisionFilter = NoticeDecision | "todas";

const DECISION_FILTERS: { key: DecisionFilter; label: string }[] = [
  { key: "pending", label: "A decidir" },
  { key: "transferred", label: "Transferidos" },
  { key: "inactivated", label: "Inativados" },
  { key: "kept", label: "Mantidos" },
  { key: "todas", label: "Todos" },
];

const DECISION_VIEW: Record<NoticeDecision, { label: string; color: string; bg: string; icon: string }> = {
  pending:     { label: "A decidir",  color: P.warn, bg: P.warnWash, icon: "clock" },
  transferred: { label: "Transferido", color: P.ok,  bg: P.okWash,   icon: "repeat" },
  inactivated: { label: "Inativado",  color: P.red,  bg: P.redWash,  icon: "power" },
  kept:        { label: "Mantido",    color: C.ink3, bg: P.glass2,   icon: "check_circle" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function AvisosPlantelTab() {
  const { federationId } = useKarateFederation();

  const [rows, setRows] = useState<RosterReviewNotice[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<NoticesSummary | null>(null);

  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("pending");
  const [dojoFilter, setDojoFilter] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [target, setTarget] = useState<RosterReviewNotice | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [decideErr, setDecideErr] = useState<string | null>(null);

  const reqIdRef = useRef(0);

  // Busca com respiro (350ms): a lista é server-side.
  React.useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async (isRefresh = false) => {
    if (!federationId) return;
    const myReq = ++reqIdRef.current;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [listRes, metricsRes] = await Promise.allSettled([
        karateRosterReviewNoticesApi.list(federationId, {
          decision: decisionFilter === "todas" ? undefined : decisionFilter,
          dojo_id: dojoFilter ?? undefined,
          q: q || undefined,
          limit: NOTICES_PAGE_SIZE,
          offset,
        }),
        karateRosterReviewNoticesApi.getMetrics(federationId),
      ]);
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta

      if (listRes.status === "fulfilled") {
        setRows(listRes.value.data);
        setCount(listRes.value.count);
        // O summary vem junto da página (não muda com filtro/paginação);
        // as métricas separadas são o fallback se a lista falhar.
        setSummary(listRes.value.summary);
        setListError(false);
      } else {
        setListError(true);
      }
      if (metricsRes.status === "fulfilled" && listRes.status !== "fulfilled") {
        setSummary(metricsRes.value);
      }
    } finally {
      if (myReq === reqIdRef.current) {
        if (isRefresh) setRefreshing(false); else setLoading(false);
      }
    }
  }, [federationId, decisionFilter, dojoFilter, q, offset]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decidir = useCallback(async (
    decision: NoticeDecisionInput,
    note: string,
    destinationDojoId?: string
  ) => {
    if (!federationId || !target) return;
    setDeciding(true);
    setDecideErr(null);
    try {
      const res = await karateRosterReviewNoticesApi.decide(federationId, target.id, {
        decision,
        note,
        destination_dojo_id: destinationDojoId,
      });
      setTarget(null);
      toast.success(
        decision === "kept"
          ? "Aviso conferido — o praticante segue como está."
          : decision === "transferred"
            ? `Transferência registrada${res.effect.moved_to_dojo_name ? " para " + res.effect.moved_to_dojo_name : ""}.`
            : "Praticante inativado na federação."
      );
      await load();
    } catch (e) {
      // 409 PRATICANTE_JA_SAIU_DO_DOJO / AVISO_JA_DECIDIDO viram frase, nunca
      // erro cru — e a fila é recarregada para o card refletir a verdade.
      setDecideErr(mapNoticeDecisionError(e));
      await load();
    } finally {
      setDeciding(false);
    }
  }, [federationId, target, load]);

  // Dojôs para filtrar — derivado do que está CARREGADO agora (nunca uma
  // lista paralela que pode divergir da fila visível).
  const dojoOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.dojo_id) map.set(r.dojo_id, r.dojo_name || "Dojô sem nome");
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const s = summary ?? EMPTY_NOTICES_SUMMARY;
  const kpiItems = useMemo(() => ([
    { label: "A decidir", value: s.pending, accent: s.pending > 0 },
    { label: "Transferidos", value: s.transferred },
    { label: "Inativados", value: s.inactivated },
    { label: "Mantidos", value: s.kept },
  ]), [s]);

  const from = count === 0 ? 0 : offset + 1;
  const to = Math.min(offset + rows.length, count);

  return (
    <ShojiBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      >
        <PageHead
          title="Revisão de plantel"
          sub="Praticantes que um dojô não reconhece como alunos atuais. É o relato do sensei, não uma constatação da federação — quem decide entre manter, transferir ou inativar é você."
        />

        {loading && !summary ? (
          <Skeleton height={100} style={{ marginTop: 16, marginBottom: 16, borderRadius: R.xl }} />
        ) : (
          <KpiBand items={kpiItems} style={{ marginTop: 16, marginBottom: 16 }} />
        )}

        {/* ── O que estes avisos NÃO dizem ── */}
        <View style={styles.contract}>
          <Icon name="info" size={15} color={C.ink3} />
          <Text style={styles.contractTxt}>
            Um aviso diz apenas &quot;esta pessoa não treina no meu dojô&quot;. Ela pode ter mudado de dojô —
            compare o retrato do aviso com o cadastro de hoje antes de inativar alguém.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <Icon name="search" size={16} color={C.ink3} />
          <TextInput
            style={styles.searchInput}
            value={qInput}
            onChangeText={setQInput}
            placeholder="Buscar por nome ou matrícula"
            placeholderTextColor={C.ink4}
            accessibilityLabel="Buscar aviso por praticante"
          />
          {qInput ? (
            <TouchableOpacity onPress={() => setQInput("")} accessibilityRole="button" accessibilityLabel="Limpar busca">
              <Icon name="x" size={15} color={C.ink3} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filtersRow}>
          {DECISION_FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              active={decisionFilter === f.key}
              onPress={() => { setDecisionFilter(f.key); setOffset(0); }}
              accessibilityLabel={`Filtrar por ${f.label}`}
            />
          ))}
        </View>

        {dojoOptions.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={styles.filtersRow}>
              <Chip label="Todos os dojôs" active={!dojoFilter} onPress={() => { setDojoFilter(null); setOffset(0); }} />
              {dojoOptions.map((d) => (
                <Chip
                  key={d.id}
                  label={d.name}
                  active={dojoFilter === d.id}
                  onPress={() => { setDojoFilter(d.id); setOffset(0); }}
                />
              ))}
            </View>
          </ScrollView>
        )}

        <View style={{ marginTop: 16 }}>
          {loading && rows.length === 0 ? (
            <>
              <Skeleton height={132} style={{ marginBottom: 10, borderRadius: R.lg }} />
              <Skeleton height={132} style={{ marginBottom: 10, borderRadius: R.lg }} />
              <Skeleton height={132} style={{ borderRadius: R.lg }} />
            </>
          ) : listError ? (
            <Card>
              <KarateErrorState
                title="Não foi possível carregar a fila"
                message="Tente de novo para ver os avisos de revisão de plantel."
                onRetry={() => load()}
                style={{ paddingVertical: 28 }}
              />
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <KarateEmptyState
                icon="inbox"
                title={decisionFilter === "pending" ? "Nenhum aviso a decidir" : "Nenhum aviso aqui"}
                subtitle="Quando um dojô concluir a revisão do plantel herdado, os praticantes que ele não reconhecer aparecem nesta fila."
                style={{ paddingVertical: 28 }}
              />
            </Card>
          ) : (
            <>
              {rows.map((n) => (
                <NoticeCard key={n.id} notice={n} onDecidir={() => { setDecideErr(null); setTarget(n); }} />
              ))}

              <View style={styles.pager}>
                <TouchableOpacity
                  style={[styles.pageBtn, offset === 0 && styles.pageBtnOff]}
                  disabled={offset === 0 || loading}
                  onPress={() => setOffset(Math.max(0, offset - NOTICES_PAGE_SIZE))}
                  accessibilityRole="button"
                  accessibilityLabel="Página anterior"
                >
                  <Icon name="chevron_left" size={16} color={offset === 0 ? C.ink4 : C.ink2} />
                </TouchableOpacity>
                <Text style={styles.pagerTxt}>{from}–{to} de {count}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, to >= count && styles.pageBtnOff]}
                  disabled={to >= count || loading}
                  onPress={() => setOffset(offset + NOTICES_PAGE_SIZE)}
                  accessibilityRole="button"
                  accessibilityLabel="Próxima página"
                >
                  <Icon name="chevron_right" size={16} color={to >= count ? C.ink4 : C.ink2} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <DecidirAvisoModal
        visible={target !== null}
        notice={target}
        federationId={federationId}
        submitting={deciding}
        error={decideErr}
        onClose={() => { setTarget(null); setDecideErr(null); }}
        onConfirm={decidir}
      />
    </ShojiBackground>
  );
}

// ── Card do aviso: snapshot × hoje, lado a lado ─────────────────────────
function NoticeCard({ notice, onDecidir }: { notice: RosterReviewNotice; onDecidir: () => void }) {
  const view = DECISION_VIEW[notice.decision];
  const nome = notice.practitioner_name || "Praticante sem nome";
  const saiu = notice.practitioner_left_dojo === true;
  const conhecidoHoje = notice.practitioner_current_is_active !== undefined;
  const mudouStatus =
    conhecidoHoje &&
    notice.practitioner_current_is_active !== null &&
    notice.practitioner_current_is_active !== notice.practitioner_was_active;

  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={styles.cardTop}>
        <Avatar name={nome} size={36} />
        <View style={styles.cardTitleWrap}>
          <Text style={styles.name} numberOfLines={1}>{nome}</Text>
          <View style={styles.metaRow}>
            {notice.practitioner_fpkt_number ? (
              <Text style={styles.mono}>{notice.practitioner_fpkt_number}</Text>
            ) : null}
            <Text style={styles.meta}>
              aviso de {notice.dojo_name || "dojô"} · {fmtDate(notice.reported_at)}
            </Text>
          </View>
        </View>
        <View style={[styles.pill, { backgroundColor: view.bg }]}>
          <Icon name={view.icon as any} size={11} color={view.color} />
          <Text style={[styles.pillTxt, { color: view.color }]}>{view.label}</Text>
        </View>
      </View>

      {/* Atribuição: o que foi dito, e por quem */}
      <Text style={styles.claim}>
        <Text style={styles.claimStrong}>{notice.dojo_name || "O dojô"}</Text> não reconhece esta pessoa como aluno
        atual{notice.reported_by_label ? ` (informado por ${notice.reported_by_label})` : ""}.
      </Text>

      {/* Snapshot × hoje */}
      <View style={styles.compare}>
        <View style={styles.compareCol}>
          <Text style={styles.compareHead}>No aviso · {fmtDate(notice.reported_at)}</Text>
          <CompareLine label="Situação" value={notice.practitioner_was_active ? "Ativo" : "Inativo"} />
          <CompareLine label="Matrícula" value={notice.practitioner_fpkt_number || "—"} />
          <CompareLine label="Dojô" value={notice.dojo_name || "—"} />
        </View>
        <View style={styles.compareCol}>
          <Text style={styles.compareHead}>Hoje</Text>
          <CompareLine
            label="Situação"
            value={
              !conhecidoHoje || notice.practitioner_current_is_active == null
                ? "—"
                : notice.practitioner_current_is_active ? "Ativo" : "Inativo"
            }
            highlight={mudouStatus}
          />
          <CompareLine
            label="Dojô"
            value={
              notice.practitioner_current_dojo_id === undefined
                ? "—"
                : saiu ? "Outro dojô" : "O mesmo do aviso"
            }
            highlight={saiu}
          />
        </View>
      </View>

      {saiu ? (
        <View style={styles.diverge}>
          <Icon name="alert" size={14} color={P.warn} />
          <Text style={styles.divergeTxt}>
            Este praticante já está em outro dojô — provável transferência já registrada. Inativar ou transferir a
            partir deste aviso será recusado; confira o cadastro e escolha &quot;Manter como está&quot;.
          </Text>
        </View>
      ) : null}

      {notice.decision === "pending" ? (
        <View style={styles.actions}>
          <KarateButton label="Decidir" variant="sumi" size="sm" onPress={onDecidir} />
        </View>
      ) : (
        <View style={styles.decided}>
          <Text style={styles.decidedTxt}>
            {view.label} em {fmtDate(notice.decided_at)}
            {notice.decided_by_label ? ` por ${notice.decided_by_label}` : ""}.
          </Text>
          {notice.decision_note ? <Text style={styles.decidedNote}>&ldquo;{notice.decision_note}&rdquo;</Text> : null}
        </View>
      )}
    </Card>
  );
}

function CompareLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.cmpLine}>
      <Text style={styles.cmpKey}>{label}</Text>
      <Text style={[styles.cmpVal, highlight && styles.cmpValHi]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60, maxWidth: 1080, width: "100%", alignSelf: "center" } as ViewStyle,

  contract: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12, marginBottom: 12 } as ViewStyle,
  contractTxt: { flex: 1, fontSize: 12.5, color: C.ink2, lineHeight: 18 } as TextStyle,

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, borderRadius: R.md, paddingHorizontal: 12, marginBottom: 10 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 13, color: C.ink, paddingVertical: 10 } as TextStyle,

  filtersRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,

  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" } as ViewStyle,
  cardTitleWrap: { flexGrow: 1, flexBasis: 180, minWidth: 160 } as ViewStyle,
  name: { fontSize: 14.5, fontWeight: "700", color: C.ink } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" } as ViewStyle,
  mono: { fontSize: 11.5, color: C.ink3, fontFamily: "monospace" } as TextStyle,
  meta: { fontSize: 11.5, color: C.ink3 } as TextStyle,
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: R.pill } as ViewStyle,
  pillTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,

  claim: { fontSize: 12.5, color: C.ink2, lineHeight: 18, marginTop: 10 } as TextStyle,
  claimStrong: { fontWeight: "800", color: C.ink } as TextStyle,

  compare: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 } as ViewStyle,
  compareCol: { flexGrow: 1, flexBasis: 200, minWidth: 180, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 11, gap: 5 } as ViewStyle,
  compareHead: { fontSize: 10.5, fontWeight: "800", color: C.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 } as TextStyle,
  cmpLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  cmpKey: { fontSize: 11.5, color: C.ink3 } as TextStyle,
  cmpVal: { flexShrink: 1, fontSize: 12, fontWeight: "600", color: C.ink2, textAlign: "right" } as TextStyle,
  cmpValHi: { color: P.warn, fontWeight: "800" } as TextStyle,

  diverge: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: P.warnWash, borderRadius: R.md, padding: 11, marginTop: 10 } as ViewStyle,
  divergeTxt: { flex: 1, fontSize: 12, color: C.ink2, lineHeight: 17 } as TextStyle,

  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 } as ViewStyle,
  decided: { marginTop: 10, gap: 3 } as ViewStyle,
  decidedTxt: { fontSize: 11.5, color: C.ink3 } as TextStyle,
  decidedNote: { fontSize: 11.5, color: C.ink2, fontStyle: "italic" } as TextStyle,

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 10 } as ViewStyle,
  pageBtn: { width: 34, height: 34, borderRadius: R.sm, borderWidth: 1, borderColor: C.line, backgroundColor: P.glass2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  pageBtnOff: { opacity: 0.45 } as ViewStyle,
  pagerTxt: { fontSize: 12.5, color: C.ink2, fontFamily: "monospace" } as TextStyle,
});
