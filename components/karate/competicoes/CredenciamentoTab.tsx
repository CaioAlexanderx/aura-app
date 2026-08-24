// ============================================================
// AURA KARATÊ — CHECK-IN LEVE (credenciamento do dia)
//
// O balcão do dia digitalizado. A presença é do ATLETA (o backend
// propaga para todas as inscrições dele), e as duas pontas escrevem no
// MESMO dado:
//   • federação → balcão do credenciamento, fila andando, lista de todos
//     os dojôs agrupada;
//   • dojô      → o sensei responde pelo próprio time (Canal A; no portal
//     as ações ficam desabilitadas).
//
// Três estados e nada mais: presente / ausente / pendente. As marcações
// são OTIMISTAS (o balcão não pode esperar rede) com rollback + toast em
// caso de erro, e a origem ("pelo dojô" / "pela federação") fica visível
// para o dia não virar discussão sobre quem marcou.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import {
  karateCompetitionP1Api, CheckInAction, CheckInEntry, CheckInResponse,
  CheckInSource, CheckInStatus,
} from "@/services/karateCompetitionP1Api";
import { karateDelegationsApi, isPortalReadOnlyError } from "@/services/karateDelegationsApi";

const STATUS_TONE: Record<CheckInStatus, { bg: string; fg: string; label: string }> = {
  presente: { bg: C.okSoft, fg: C.ok, label: "Presente" },
  ausente: { bg: C.dangerSoft, fg: C.danger, label: "Ausente" },
  pendente: { bg: C.glassHi, fg: C.ink3, label: "Pendente" },
};

const SOURCE_LABEL: Record<CheckInSource, string> = {
  dojo: "pelo dojô",
  federacao: "pela federação",
};

const PORTAL_NOTICE =
  "O portal do dojô é somente leitura. Entre com a conta do dojô para marcar presença.";

/** ISO → "14:32" (só a hora; a data é sempre a do evento). */
function fmtHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Rastro do que já foi marcado: "Presente pelo dojô · 08:41". */
function traceText(e: CheckInEntry): string | null {
  if (e.status === "pendente") return null;
  const parts = [STATUS_TONE[e.status].label];
  if (e.check_in_source) parts.push(SOURCE_LABEL[e.check_in_source]);
  const hora = fmtHora(e.checked_in_at);
  const head = parts.join(" ");
  return hora ? `${head} · ${hora}` : head;
}

/** Normaliza a resposta — campo ausente vira vazio, nunca quebra a fila. */
function normalize(res: CheckInResponse | null | undefined): CheckInEntry[] {
  const rows = Array.isArray(res?.data) ? res!.data : [];
  return rows.map((r) => ({
    student_id: String(r?.student_id ?? ""),
    student_name: r?.student_name || "Atleta",
    dojo_id: r?.dojo_id ?? null,
    dojo_name: r?.dojo_name ?? null,
    categories: Array.isArray(r?.categories) ? r.categories.filter(Boolean).map(String) : [],
    status: (["presente", "ausente", "pendente"] as const).includes(r?.status as any)
      ? (r.status as CheckInStatus)
      : "pendente",
    checked_in_at: r?.checked_in_at ?? null,
    check_in_source: r?.check_in_source ?? null,
  })).filter((r) => !!r.student_id);
}

// ── Painel compartilhado pelas duas pontas ──────────────────

interface PanelProps {
  /** Quem está marcando — define o texto de origem otimista. */
  source: CheckInSource;
  /** Agrupa por dojô (federação); no dojô a lista é só dos meus atletas. */
  grouped: boolean;
  fetcher: () => Promise<CheckInResponse>;
  marker: (studentId: string, status: CheckInAction) => Promise<{ entries_updated: number }>;
  /** Linha de contexto acima da busca (opcional). */
  intro?: string;
  emptyTitle: string;
  emptySubtitle: string;
}

function CheckInPanel({ source, grouped, fetcher, marker, intro, emptyTitle, emptySubtitle }: PanelProps) {
  const [entries, setEntries] = useState<CheckInEntry[] | null>(null);
  const [schemaPending, setSchemaPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetcher();
      setSchemaPending(!!res?.schema_pending);
      setEntries(normalize(res));
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar o credenciamento.");
      setEntries([]);
    }
  }, [fetcher]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Totais derivados da lista — sobem/descem junto com cada marcação.
  const totals = useMemo(() => {
    const t = { atletas: 0, presentes: 0, ausentes: 0, pendentes: 0 };
    for (const e of entries || []) {
      t.atletas += 1;
      if (e.status === "presente") t.presentes += 1;
      else if (e.status === "ausente") t.ausentes += 1;
      else t.pendentes += 1;
    }
    return t;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries || [];
    return (entries || []).filter((e) =>
      e.student_name.toLowerCase().includes(q) || (e.dojo_name || "").toLowerCase().includes(q)
    );
  }, [entries, query]);

  // A lista já vem ordenada por dojô/atleta — agrupar é só quebrar em blocos.
  const groups = useMemo(() => {
    if (!grouped) return [{ key: "__all__", name: "", rows: filtered }];
    const out: { key: string; name: string; rows: CheckInEntry[] }[] = [];
    for (const e of filtered) {
      const key = e.dojo_id || e.dojo_name || "__sem_dojo__";
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(e);
      else out.push({ key, name: e.dojo_name || "Sem dojô", rows: [e] });
    }
    return out;
  }, [filtered, grouped]);

  const mark = useCallback(async (entry: CheckInEntry, action: CheckInAction) => {
    if (readOnly || busyId) return;
    const next: CheckInStatus = action === "limpar" ? "pendente" : action;
    if (entry.status === next) return;

    const before = entry;
    setBusyId(entry.student_id);
    setEntries((list) => (list || []).map((r) => (r.student_id === before.student_id
      ? {
        ...r,
        status: next,
        checked_in_at: next === "pendente" ? null : new Date().toISOString(),
        check_in_source: next === "pendente" ? null : source,
      }
      : r)));

    try {
      await marker(before.student_id, action);
    } catch (e: any) {
      // Rollback só da linha tocada — o resto da fila segue como está.
      setEntries((list) => (list || []).map((r) => (r.student_id === before.student_id ? before : r)));
      if (isPortalReadOnlyError(e)) {
        setReadOnly(true);
        toast.error(PORTAL_NOTICE);
      } else {
        toast.error(e?.message || "Não foi possível marcar a presença.");
      }
    } finally {
      setBusyId((prev) => (prev === before.student_id ? null : prev));
    }
  }, [readOnly, busyId, marker, source]);

  if (entries === null && !error) return <ActivityIndicator style={{ marginTop: 32 }} color={C.primary} />;
  if (error) return <KarateErrorState message={error} onRetry={load} />;

  return (
    <View style={s.panel}>
      {schemaPending && (
        <View style={s.notice}>
          <Icon name="clock" size={14} color={C.ink3} />
          <Text style={s.noticeTxt}>
            O credenciamento ainda não está disponível neste campeonato. Assim que a federação liberar, a lista aparece aqui.
          </Text>
        </View>
      )}

      {readOnly && (
        <View style={[s.notice, s.noticeWarn]}>
          <Icon name="lock" size={14} color={C.warn} />
          <Text style={[s.noticeTxt, { color: C.warn }]}>{PORTAL_NOTICE}</Text>
        </View>
      )}

      {!!intro && <Text style={s.intro}>{intro}</Text>}

      {/* Totais ao vivo — o painel do balcão. */}
      <View style={s.totalsRow}>
        <Stat label="Atletas" value={totals.atletas} />
        <Stat label="Presentes" value={totals.presentes} color={C.ok} />
        <Stat label="Ausentes" value={totals.ausentes} color={C.danger} />
        <Stat label="Pendentes" value={totals.pendentes} />
      </View>

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Icon name="search" size={15} color={C.ink3} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar atleta ou dojô"
            placeholderTextColor={C.ink4}
            autoCorrect={false}
            accessibilityLabel="Buscar atleta ou dojô"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Limpar busca" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={14} color={C.ink3} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={refresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Atualizar lista"
        >
          <Icon name="refresh" size={15} color={refreshing ? C.ink4 : C.ink2} />
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <KarateEmptyState
          icon="users"
          title={query.trim() ? "Nenhum atleta encontrado" : emptyTitle}
          subtitle={query.trim() ? "Ajuste a busca para encontrar o atleta." : emptySubtitle}
          style={{ paddingVertical: 28 }}
        />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: 8 }}>
            {grouped && (
              <View style={s.groupHead}>
                <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
                <Text style={s.groupCount}>
                  {g.rows.filter((r) => r.status === "presente").length}/{g.rows.length}
                </Text>
              </View>
            )}
            {g.rows.map((e) => (
              <AthleteRow
                key={e.student_id}
                entry={e}
                busy={busyId === e.student_id}
                disabled={readOnly}
                onMark={mark}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function AthleteRow({ entry, busy, disabled, onMark }: {
  entry: CheckInEntry;
  busy: boolean;
  disabled: boolean;
  onMark: (entry: CheckInEntry, action: CheckInAction) => void;
}) {
  const tone = STATUS_TONE[entry.status];
  const trace = traceText(entry);
  const provas = entry.categories.length ? entry.categories.join(" · ") : "Sem prova nas listagens";
  return (
    <View style={[s.card, entry.status === "presente" && s.cardPresente, entry.status === "ausente" && s.cardAusente]}>
      <View style={s.cardHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.athlete} numberOfLines={1}>{entry.student_name}</Text>
          <Text style={s.provas} numberOfLines={2}>{provas}</Text>
          {!!trace && <Text style={s.trace}>{trace}</Text>}
        </View>
        <View style={[s.statusChip, { backgroundColor: tone.bg }]}>
          <Text style={[s.statusTxt, { color: tone.fg }]}>{tone.label}</Text>
        </View>
      </View>

      <View style={s.actions}>
        <ActionBtn
          icon="check_circle"
          label="Presente"
          active={entry.status === "presente"}
          activeBg={C.okSoft}
          activeFg={C.ok}
          disabled={disabled || busy}
          onPress={() => onMark(entry, "presente")}
        />
        <ActionBtn
          icon="x_circle"
          label="Ausente"
          active={entry.status === "ausente"}
          activeBg={C.dangerSoft}
          activeFg={C.danger}
          disabled={disabled || busy}
          onPress={() => onMark(entry, "ausente")}
        />
        <ActionBtn
          icon="refresh"
          label="Limpar"
          active={false}
          activeBg={C.glassHi}
          activeFg={C.ink3}
          disabled={disabled || busy || entry.status === "pendente"}
          onPress={() => onMark(entry, "limpar")}
        />
      </View>
    </View>
  );
}

function ActionBtn({ icon, label, active, activeBg, activeFg, disabled, onPress }: {
  icon: string; label: string; active: boolean; activeBg: string; activeFg: string;
  disabled: boolean; onPress: () => void;
}) {
  const fg = disabled ? C.ink4 : active ? activeFg : C.ink2;
  return (
    <TouchableOpacity
      style={[
        s.actionBtn,
        active && { backgroundColor: activeBg, borderColor: activeFg },
        disabled && s.actionBtnOff,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
    >
      <Icon name={icon as any} size={15} color={fg} />
      <Text style={[s.actionTxt, { color: fg }, active && { fontWeight: "800" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Ponta da FEDERAÇÃO: aba Credenciamento ──────────────────

export function CredenciamentoTab({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const fetcher = useCallback(
    () => karateCompetitionP1Api.getCheckIn(federationId, competitionId),
    [federationId, competitionId]
  );
  const marker = useCallback(
    (studentId: string, status: CheckInAction) =>
      karateCompetitionP1Api.setCheckIn(federationId, competitionId, studentId, status),
    [federationId, competitionId]
  );
  return (
    <CheckInPanel
      source="federacao"
      grouped
      fetcher={fetcher}
      marker={marker}
      intro="Balcão do dia: marque quem chegou. A presença vale para todas as provas do atleta e aparece na hora para o dojô dele."
      emptyTitle="Nenhum atleta inscrito ainda"
      emptySubtitle="Quando as inscrições forem confirmadas, os atletas aparecem aqui por dojô."
    />
  );
}

// ── Ponta do DOJÔ: aba Presença ─────────────────────────────

export function PresencaDojoTab({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const fetcher = useCallback(
    () => karateDelegationsApi.getCheckIn(federationId, competitionId),
    [federationId, competitionId]
  );
  const marker = useCallback(
    (studentId: string, status: CheckInAction) =>
      karateDelegationsApi.setCheckIn(federationId, competitionId, studentId, status),
    [federationId, competitionId]
  );
  return (
    <CheckInPanel
      source="dojo"
      grouped={false}
      fetcher={fetcher}
      marker={marker}
      intro="O dojô responde pela presença dos seus atletas no dia. Marque aqui e o credenciamento da federação já vê — sem fila no balcão."
      emptyTitle="Nenhum atleta seu neste campeonato"
      emptySubtitle="Assim que a inscrição da delegação for confirmada, seus atletas aparecem aqui."
    />
  );
}

const s = StyleSheet.create({
  // PREMISSA (24/08): coluna central com largura máxima — em monitor largo,
  // linha full-width separa nome e status por ~1500px e vira defeito de
  // escaneabilidade. Mesmo padrão da mesa pública (maxWidth + alignSelf).
  panel: { gap: 12, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  intro: { fontSize: 12.5, color: C.ink3, lineHeight: 18 } as TextStyle,

  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 11, paddingVertical: 9 } as ViewStyle,
  noticeWarn: { backgroundColor: C.warnSoft, borderColor: C.border2 } as ViewStyle,
  noticeTxt: { flex: 1, fontSize: 12, color: C.ink3, lineHeight: 17 } as TextStyle,

  totalsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  // Chips inline dimensionados pelo conteúdo — não caixas de ¼ de tela.
  stat: { flexDirection: "row", alignItems: "baseline", gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 } as ViewStyle,
  statValue: { fontFamily: F.mono, fontSize: 15, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  statLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: C.ink3 } as TextStyle,

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, paddingHorizontal: 11, minHeight: 42 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 13.5, color: C.ink, paddingVertical: 9 } as TextStyle,
  refreshBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border2, borderRadius: R.md, backgroundColor: C.surface } as ViewStyle,

  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4 } as ViewStyle,
  groupName: { flex: 1, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  groupCount: { fontFamily: F.mono, fontSize: 11.5, color: C.ink3, fontVariant: ["tabular-nums"] } as TextStyle,

  card: { backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 12, gap: 10 } as ViewStyle,
  cardPresente: { borderColor: C.okSoft, backgroundColor: C.okSoft } as ViewStyle,
  cardAusente: { borderColor: C.dangerSoft } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  athlete: { fontSize: 14.5, fontWeight: "700", color: C.ink } as TextStyle,
  provas: { fontSize: 12, color: C.ink3, lineHeight: 17 } as TextStyle,
  trace: { fontSize: 11.5, color: C.ink3, marginTop: 1 } as TextStyle,
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,

  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  // Botões pelo CONTEÚDO (minWidth p/ alvo de toque) — nunca flex:1
  // dividindo a tela inteira (premissa 24/08).
  actionBtn: { minWidth: 116, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, backgroundColor: C.glassHi, paddingHorizontal: 14 } as ViewStyle,
  actionBtnOff: { opacity: 0.5 } as ViewStyle,
  actionTxt: { fontSize: 13, fontWeight: "700" } as TextStyle,
});
