// ============================================================
// AURA DOJÔ — P0 Hub de Campeonatos: CARRINHO DA DELEGAÇÃO
//
// A tela que substitui a planilha: o técnico monta a delegação
// (atletas → categorias, equipes com roster, nº de oficiais), vê a
// COTAÇÃO AO VIVO (dry-run no backend a cada mudança — linhas, isenções,
// avisos de compatibilidade, cotas por clube) e submete UM pedido:
// PIX consolidado da federação OU envio de comprovante (modo manual).
//
// Regras de UX herdadas do backend (e dos regulamentos):
//   • skips (não federado, já inscrito) aparecem como aviso por item —
//     nunca derrubam o carrinho;
//   • compatibilidade de categoria é SÓ AVISO (FPKT #1);
//   • cota por clube estourada BLOQUEIA o envio (o técnico decide quem
//     fica — o backend recusaria com 422 QUOTA_EXCEEDED).
//
// P2.2 — TRIAGEM AUTOMÁTICA (insight pós-Paulista): o sensei marca o
// ATLETA e as MODALIDADES; a categoria certa é resolvida pelo backend
// (idade na data do evento, sexo, corte de graduação):
//   • resolved  → card verde-sutil, zero escolha manual ("alterar" fica
//     discreto como escape);
//   • ambiguous → o sensei só desempata (ex.: Principal × Aspirantes);
//   • no_fit    → aviso âmbar com os critérios que falharam + fallback
//     manual. Dado ausente NUNCA bloqueia a inscrição (filosofia FPKT #1).
// A triagem é dry-run: os category_ids resolvidos alimentam o MESMO
// quote/submit de sempre — cotação, carrinho e PIX ficam inalterados.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
  StyleSheet, ViewStyle, TextStyle, Animated, Easing,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, KarateFonts as F, KarateRadius as R, KarateBelts, resolveBeltKey,
} from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { toast } from "@/components/Toast";
import { copyToClipboard } from "@/utils/clipboard";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useDojoSectionLabel } from "@/components/karate/DojoShell";
import { usePrefersReducedMotion } from "@/components/karate/anim/useReducedMotion";
import { formatEventDateLong } from "@/utils/eventDate";
import { SelecionarAlunosModal } from "@/components/karate/dojoFederativo/SelecionarAlunosModal";
import { CategoryPickerModal } from "@/components/karate/dojoCampeonatos/CategoryPickerModal";
import { karateDojoStudentsApi, DojoStudent, DOJO_STUDENTS_MAX_LIMIT } from "@/services/karateDojoStudentsApi";
import {
  karateDelegationsApi, OpenCompetition, EnrollmentCategory, QuoteResponse,
  isEnrollmentOpen, initialCartTab,
  SubmitResponse, DelegationBody, formatBRL, MODALITY_LABEL, isTeamModality,
  IndividualModality, TriageAthleteResult, TriageCategoryRef, triageFailLabel,
  MyBracketCategory, MyBracketsResponse, BRACKET_STATUS_LABEL, isNotPublishedError,
} from "@/services/karateDelegationsApi";
import { printScoresheet } from "@/components/karate/chaves/buildScoresheetHtml";
import { PresencaDojoTab } from "@/components/karate/competicoes/CredenciamentoTab";

type TeamDraft = {
  key: string;
  name: string;
  sex: "M" | "F" | "mixed";
  category_ids: string[];
  titular_ids: string[];
  reserve_ids: string[];
};

type PickerTarget =
  | { type: "athletes" }
  | { type: "team-titulares"; key: string }
  | { type: "team-reservas"; key: string };

/** Seletor de categorias: equipe (como antes) ou o FALLBACK manual de um
 *  par atleta×modalidade da triagem (escape — nunca bloquear). */
type CatPickerTarget =
  | { type: "team"; key: string }
  | { type: "pair"; sid: string; mod: IndividualModality };

const SEX_OPTIONS: ["M" | "F" | "mixed", string][] = [["M", "Masc"], ["F", "Fem"], ["mixed", "Misto"]];
const SEX_LABEL: Record<"M" | "F" | "mixed", string> = { M: "Masc", F: "Fem", mixed: "Misto" };

/** Ordem de exibição das modalidades individuais (chips). */
const MODALITY_ORDER: IndividualModality[] = ["kata", "kumite", "kihon_ippon"];

const pairKey = (sid: string, mod: string) => `${sid}|${mod}`;

/** Estado visual de um par atleta×modalidade (computado no pai). */
type PairView =
  | { kind: "loading" }
  | { kind: "manual_only"; hint?: string }
  | { kind: "resolved"; name: string; groupLabel: string | null; meta: string }
  | { kind: "override"; names: string[]; hasSuggestion: boolean }
  | { kind: "ambiguous"; options: { id: string; name: string; groupLabel: string | null; meta: string }[] }
  | { kind: "no_fit"; reasons: string[]; message?: string };

export default function DelegationCart() {
  const router = useRouter();
  const { cid } = useLocalSearchParams<{ cid: string }>();
  const { federationId } = useKarateFederation();
  useDojoSectionLabel("Campeonatos");

  // ── Dados base ──
  const [competition, setCompetition] = useState<OpenCompetition | null>(null);
  const [categories, setCategories] = useState<EnrollmentCategory[]>([]);
  const [students, setStudents] = useState<Map<string, DojoStudent>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Carrinho ──
  // Triagem P2.2: o sensei marca MODALIDADES por atleta; a categoria vem
  // da triagem (ou do override manual). category_ids são DERIVADOS.
  const [athleteMods, setAthleteMods] = useState<Map<string, IndividualModality[]>>(new Map());
  const [teams, setTeams] = useState<TeamDraft[]>([]);
  const [officials, setOfficials] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"pix_direct" | "manual">("pix_direct");

  // ── Triagem automática ──
  const [triageMap, setTriageMap] = useState<Map<string, TriageAthleteResult>>(new Map());
  const [triaging, setTriaging] = useState(false);
  const [triageFailed, setTriageFailed] = useState(false);
  /** Overrides manuais por par `${sid}|${mod}` (desempate do ambiguous ou
   *  fallback do seletor manual). Presente = vale sobre a triagem. */
  const [overrides, setOverrides] = useState<Map<string, string[]>>(new Map());
  const triageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triageSeq = useRef(0);

  // ── Modais ──
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [catPickerFor, setCatPickerFor] = useState<CatPickerTarget | null>(null);

  // ── Cotação / envio ──
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Minhas chaves (Onda B) ──
  // Aba separada do wizard: só leitura + impressão. Carrega sob demanda
  // (a primeira vez que o sensei abre a aba) para não pesar a inscrição.
  const [tab, setTab] = useState<"inscricao" | "chaves" | "presenca">("inscricao");
  const [brackets, setBrackets] = useState<MyBracketsResponse | null>(null);
  const [bracketsLoading, setBracketsLoading] = useState(false);
  const [bracketsError, setBracketsError] = useState<string | null>(null);
  const [printingCat, setPrintingCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!federationId || !cid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [comps, cats, studs] = await Promise.all([
        karateDelegationsApi.listOpenCompetitions(federationId),
        karateDelegationsApi.listCategories(federationId, String(cid)),
        karateDojoStudentsApi.listStudents(federationId, { status: "active", limit: DOJO_STUDENTS_MAX_LIMIT }),
      ]);
      const comp = (comps.data || []).find((c) => c.id === String(cid)) || null;
      if (!comp) {
        setLoadError("Campeonato não encontrado ou encerrado sem delegação do seu dojô.");
      }
      // Dia do evento (inscrições encerradas): o sensei veio pela
      // Presença/chaves — não faz sentido cair no wizard bloqueado.
      if (comp && !isEnrollmentOpen(comp)) {
        setTab((t) => (t === "inscricao" ? initialCartTab(comp) : t));
      }
      setCompetition(comp);
      setCategories(cats.data || []);
      setStudents(new Map((studs.data || []).map((st) => [st.id, st])));
    } catch (e: any) {
      setLoadError(e?.message || "Não foi possível carregar o campeonato.");
    } finally {
      setLoading(false);
    }
  }, [federationId, cid]);

  useEffect(() => { load(); }, [load]);

  const loadBrackets = useCallback(async () => {
    if (!federationId || !cid) return;
    setBracketsLoading(true);
    setBracketsError(null);
    try {
      const res = await karateDelegationsApi.getMyBrackets(federationId, String(cid));
      setBrackets({ published: !!res?.published, competition_name: res?.competition_name ?? null, data: res?.data || [] });
    } catch (e: any) {
      // Despublicado é estado, não erro: cai no vazio elegante.
      if (isNotPublishedError(e)) setBrackets({ published: false, data: [] });
      else setBracketsError(e?.message || "Não foi possível carregar as chaves.");
    } finally {
      setBracketsLoading(false);
    }
  }, [federationId, cid]);

  // Carrega na primeira abertura da aba (e só nela).
  useEffect(() => {
    if (tab === "chaves" && !brackets && !bracketsLoading && !bracketsError) loadBrackets();
  }, [tab, brackets, bracketsLoading, bracketsError, loadBrackets]);

  /** Súmula da MINHA categoria → mesma folha impressa pela federação. */
  const printMyBracket = useCallback(async (categoryId: string) => {
    if (!federationId || !cid) return;
    setPrintingCat(categoryId);
    try {
      const sheet = await karateDelegationsApi.getMyScoresheet(federationId, String(cid), categoryId);
      const ok = printScoresheet(sheet);
      if (!ok) toast.error("Popup bloqueado — permita popups para app.getaura.com.br");
      else toast.success("Folha aberta para impressão");
    } catch (e: any) {
      if (isNotPublishedError(e)) {
        // Federação despublicou entre o load e o toque: refaz a lista.
        toast.error("A federação despublicou as chaves — a lista foi atualizada.");
        setBrackets(null);
        loadBrackets();
      } else {
        toast.error(e?.message || "Não foi possível abrir a folha da chave.");
      }
    } finally {
      setPrintingCat((prev) => (prev === categoryId ? null : prev));
    }
  }, [federationId, cid, loadBrackets]);

  // ── Modalidades individuais que o campeonato oferece (chips) ──
  const availableMods = useMemo<IndividualModality[]>(() => {
    const present = new Set<IndividualModality>(
      categories.filter((c) => !isTeamModality(c.modality)).map((c) => c.modality as IndividualModality)
    );
    return [
      ...MODALITY_ORDER.filter((m) => present.has(m)),
      ...[...present].filter((m) => !MODALITY_ORDER.includes(m)),
    ];
  }, [categories]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // ── Categoria efetiva de um par atleta×modalidade ──
  // Override manual > categoria resolvida pela triagem > nada (pendente).
  const pairCategoryIds = useCallback((sid: string, mod: string): string[] => {
    const ov = overrides.get(pairKey(sid, mod));
    if (ov) return ov;
    const r = triageMap.get(sid)?.triage?.find((t) => t.modality === mod);
    if (r?.status === "resolved" && r.category) return [r.category.category_id];
    return [];
  }, [overrides, triageMap]);

  // ── Corpo do pedido (compartilhado por quote e submit) ──
  const body: DelegationBody = useMemo(() => ({
    athletes: [...athleteMods.entries()]
      .map(([student_id, mods]) => ({
        student_id,
        category_ids: [...new Set(mods.flatMap((m) => pairCategoryIds(student_id, m)))],
      }))
      .filter((a) => a.category_ids.length > 0),
    teams: teams
      .filter((t) => t.name.trim() && t.category_ids.length > 0 && t.titular_ids.length >= 2)
      .map((t) => ({
        name: t.name.trim(), sex: t.sex, category_ids: t.category_ids,
        titular_ids: t.titular_ids, reserve_ids: t.reserve_ids,
      })),
    officials_count: officials,
  }), [athleteMods, pairCategoryIds, teams, officials]);

  // ── Provas marcadas mas ainda sem categoria (desempate/ajuste) ──
  const pendingPairs = useMemo(() => {
    let n = 0;
    for (const [sid, mods] of athleteMods) {
      for (const m of mods) if (pairCategoryIds(sid, m).length === 0) n += 1;
    }
    return n;
  }, [athleteMods, pairCategoryIds]);

  const cartHasItems = body.athletes.length > 0 || body.teams.length > 0;

  // ── Cotação ao vivo (debounce 600ms) ──
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    if (!cartHasItems || !competition) { setQuote(null); return; }
    setQuoting(true);
    quoteTimer.current = setTimeout(async () => {
      try {
        const q = await karateDelegationsApi.quote(federationId, competition.id, body);
        setQuote(q);
      } catch (e: any) {
        // Cotação falhou (ex.: 409 fechou no meio) — mostra e não trava.
        toast.error(e?.message || "Não foi possível cotar a delegação.");
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 600);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(body), competition?.id, federationId]);

  // ── Triagem ao vivo (debounce 500ms — mesmo espírito da cotação) ──
  const triageInput = useMemo(
    () => [...athleteMods.entries()]
      .filter(([, mods]) => mods.length > 0)
      .map(([student_id, mods]) => ({ student_id, modalities: mods as string[] })),
    [athleteMods]
  );

  useEffect(() => {
    if (triageTimer.current) clearTimeout(triageTimer.current);
    if (!competition || triageInput.length === 0) { setTriaging(false); return; }
    const seq = ++triageSeq.current;
    setTriaging(true);
    setTriageFailed(false);
    triageTimer.current = setTimeout(async () => {
      try {
        const res = await karateDelegationsApi.triageDelegation(
          federationId, competition.id, { athletes: triageInput }
        );
        if (seq !== triageSeq.current) return;
        setTriageMap((prev) => {
          const next = new Map(prev);
          for (const r of res.results || []) if (r.student_id) next.set(r.student_id, r);
          return next;
        });
      } catch (_e) {
        // Triagem fora do ar não pode travar a inscrição: os cards caem
        // no fallback manual (filosofia: dado ausente nunca bloqueia).
        if (seq === triageSeq.current) setTriageFailed(true);
      } finally {
        if (seq === triageSeq.current) setTriaging(false);
      }
    }, 500);
    return () => { if (triageTimer.current) clearTimeout(triageTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(triageInput), competition?.id, federationId]);

  // ── Ações do carrinho ──
  const addAthletes = (ids: string[]) => {
    setAthleteMods((prev) => {
      const next = new Map(prev);
      for (const id of ids) if (!next.has(id)) next.set(id, []);
      return next;
    });
  };
  const removeAthlete = (id: string) => {
    setAthleteMods((prev) => { const next = new Map(prev); next.delete(id); return next; });
    setTriageMap((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev); next.delete(id); return next;
    });
    setOverrides((prev) => {
      const keys = [...prev.keys()].filter((k) => k.startsWith(`${id}|`));
      if (!keys.length) return prev;
      const next = new Map(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  };
  const toggleModality = (sid: string, mod: IndividualModality) => {
    const wasOn = (athleteMods.get(sid) || []).includes(mod);
    setAthleteMods((prev) => {
      const next = new Map(prev);
      const list = next.get(sid) || [];
      next.set(sid, wasOn ? list.filter((m) => m !== mod) : [...list, mod]);
      return next;
    });
    // Desmarcar a prova limpa o override — remarcar recomeça do automático.
    if (wasOn) {
      setOverrides((prev) => {
        if (!prev.has(pairKey(sid, mod))) return prev;
        const next = new Map(prev); next.delete(pairKey(sid, mod)); return next;
      });
    }
  };
  const setPairOverride = (sid: string, mod: IndividualModality, ids: string[]) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (ids.length === 0) next.delete(pairKey(sid, mod)); // vazio = volta ao automático
      else next.set(pairKey(sid, mod), ids);
      return next;
    });
  };

  const addTeam = () => {
    setTeams((prev) => [...prev, {
      key: `t-${Date.now()}`, name: "", sex: "mixed", category_ids: [], titular_ids: [], reserve_ids: [],
    }]);
  };
  const patchTeam = (key: string, patch: Partial<TeamDraft>) => {
    setTeams((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  };
  const removeTeam = (key: string) => setTeams((prev) => prev.filter((t) => t.key !== key));

  const onPickerSubmit = (ids: string[]) => {
    if (!pickerTarget) return;
    if (pickerTarget.type === "athletes") addAthletes(ids);
    else if (pickerTarget.type === "team-titulares") {
      patchTeam(pickerTarget.key, { titular_ids: [...new Set(ids)] });
    } else {
      patchTeam(pickerTarget.key, { reserve_ids: [...new Set(ids)] });
    }
    setPickerTarget(null);
  };

  // ── Envio ──
  const canSubmit = cartHasItems && !submitting
    && (!quote || quote.quota_violations.length === 0);

  const submit = async () => {
    if (!competition) return;
    setSubmitting(true);
    try {
      const res = await karateDelegationsApi.submit(federationId, competition.id, {
        ...body, payment_mode: paymentMode,
      });
      setResult(res);
      toast.success("Delegação enviada.");
    } catch (e: any) {
      if (e?.data?.quota_violations) {
        toast.error("Cota por clube excedida — ajuste a delegação.");
        // Recarrega a cotação para exibir as violações atualizadas.
        try { setQuote(await karateDelegationsApi.quote(federationId, competition.id, body)); } catch (_) { /* noop */ }
      } else {
        toast.error(e?.message || "Não foi possível enviar a delegação.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color={C.primary} />;
  if (loadError || !competition) {
    return <KarateErrorState message={loadError || "Campeonato não encontrado."} onRetry={load} />;
  }

  // Dia do evento: competição closed/done segue na tela (o dojô tem
  // delegação nela) — Presença e Minhas chaves ativas, wizard bloqueado.
  const enrollmentOpen = isEnrollmentOpen(competition);

  if (result) {
    return <SuccessView result={result} onDone={() => router.replace("/karate/(dojo)/campeonatos" as any)} />;
  }

  const nameOf = (id: string) => students.get(id)?.full_name || "Aluno";
  const catNameOf = (id: string) => categories.find((c) => c.id === id)?.name || "categoria";
  const divisionNameOf = (divId: string | null) =>
    (divId && competition.divisions?.find((d) => d.id === divId)?.name) || null;

  /** Linha de metadados da categoria (divisão · idade · sexo · corte de faixa). */
  const catMetaOf = (ref: TriageCategoryRef): string => {
    const full = catById.get(ref.category_id);
    const parts: string[] = [];
    const div = divisionNameOf(ref.division_id ?? full?.division_id ?? null);
    if (div) parts.push(div);
    if (full) {
      if (full.min_age != null && full.max_age != null) parts.push(`${full.min_age}–${full.max_age} anos`);
      else if (full.max_age != null) parts.push(`até ${full.max_age} anos`);
      else if (full.min_age != null) parts.push(`${full.min_age}+ anos`);
      parts.push(SEX_LABEL[full.sex]);
      if (full.belt_min && full.belt_max) parts.push(`${full.belt_min}–${full.belt_max}`);
      else if (full.belt_min) parts.push(`a partir de ${full.belt_min}`);
      else if (full.belt_max) parts.push(`até ${full.belt_max}`);
    }
    return parts.join(" · ");
  };

  /** Estado visual de um par atleta×modalidade (a alma da triagem). */
  const pairViewOf = (sid: string, mod: IndividualModality): PairView => {
    const ov = overrides.get(pairKey(sid, mod));
    const ath = triageMap.get(sid);
    const res = ath?.triage?.find((t) => t.modality === mod);
    if (ov && ov.length > 0) {
      return {
        kind: "override",
        names: ov.map(catNameOf),
        hasSuggestion: res?.status === "resolved" && !!res.category
          && !(ov.length === 1 && ov[0] === res.category.category_id),
      };
    }
    if (ath && ath.status !== "ok") return { kind: "manual_only" };
    if (res?.status === "resolved" && res.category) {
      return {
        kind: "resolved",
        name: res.category.name,
        groupLabel: res.category.group_label,
        meta: catMetaOf(res.category),
      };
    }
    if (res?.status === "ambiguous" && res.options?.length) {
      return {
        kind: "ambiguous",
        options: res.options.map((o) => ({
          id: o.category_id, name: o.name, groupLabel: o.group_label, meta: catMetaOf(o),
        })),
      };
    }
    if (res?.status === "no_fit") {
      const reasons = (res.considered || []).slice(0, 3).map((miss) => {
        const why = [...new Set((miss.failed || []).map(triageFailLabel))].join(" e ");
        return `${miss.category.name}: ${why || "não atende aos critérios"}`;
      });
      return { kind: "no_fit", reasons, message: res.message };
    }
    if (triageFailed) {
      return { kind: "manual_only", hint: "Triagem indisponível agora — escolha a categoria manualmente." };
    }
    return { kind: "loading" };
  };

  /** Faixa atual do atleta (vem da triagem) → cor + rótulo do DS. */
  const beltViewOf = (sid: string) => {
    const belt = triageMap.get(sid)?.belt;
    if (!belt) return null;
    const key = resolveBeltKey(belt);
    return key ? KarateBelts[key] : null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }}>
        {/* Cabeçalho do campeonato */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar">
            <Icon name="arrow-left" size={20} color={C.ink2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.compName} numberOfLines={2}>{competition.name}</Text>
            <Text style={s.compMeta}>
              {formatEventDateLong(competition.event_date)}{competition.location ? ` · ${competition.location}` : ""}
            </Text>
          </View>
        </View>

        {/* ── Abas: o wizard de inscrição × as chaves × a presença do dia ── */}
        <View style={s.tabsRow}>
          {([["inscricao", "Inscrição"], ["chaves", "Minhas chaves"], ["presenca", "Presença"]] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[s.tabBtn, tab === key && s.tabBtnOn]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[s.tabTxt, tab === key && s.tabTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "chaves" ? (
          <View style={s.tabPanelCol}>
            <MyBracketsPanel
              state={brackets}
              loading={bracketsLoading}
              error={bracketsError}
              printingCat={printingCat}
              onRetry={() => { setBrackets(null); setBracketsError(null); loadBrackets(); }}
              onPrint={printMyBracket}
            />
          </View>
        ) : tab === "presenca" ? (
          <PresencaDojoTab federationId={federationId} competitionId={String(cid)} />
        ) : !enrollmentOpen ? (
          /* Wizard bloqueado — a delegação já foi consolidada; hoje o
             trabalho do sensei é Presença e Minhas chaves. */
          <View style={s.closedBox}>
            <Icon name="lock-closed" size={28} color={C.ink3} />
            <Text style={s.closedTitle}>Inscrições encerradas</Text>
            <Text style={s.closedTxt}>
              A federação encerrou as inscrições deste campeonato. Sua delegação
              já enviada continua valendo — acompanhe o dia do evento pelas abas
              Presença e Minhas chaves.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <KarateButton label="Presença" variant="sumi" size="md" onPress={() => setTab("presenca")} />
              <KarateButton label="Minhas chaves" variant="ghost" size="md" onPress={() => setTab("chaves")} />
            </View>
          </View>
        ) : (
        <>
        {/* ── Atletas — triagem automática ── */}
        <Section
          title="Atletas — provas individuais"
          action={<AddButton label="Adicionar atletas" onPress={() => setPickerTarget({ type: "athletes" })} />}
        >
          {athleteMods.size === 0 ? (
            <Text style={s.emptyHint}>
              Adicione os atletas e marque as provas de cada um — a categoria certa é
              encontrada automaticamente pelos critérios da federação.
            </Text>
          ) : availableMods.length === 0 ? (
            <Text style={s.emptyHint}>Este campeonato não tem provas individuais.</Text>
          ) : (
            [...athleteMods.entries()].map(([id, mods]) => {
              const ath = triageMap.get(id);
              const belt = beltViewOf(id);
              return (
                <View key={id} style={s.athCard}>
                  <View style={s.athHead}>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={s.athleteName} numberOfLines={1}>{nameOf(id)}</Text>
                      {belt ? (
                        <View style={s.beltTag}>
                          <View style={[s.beltDot, { backgroundColor: belt.color }]} />
                          <Text style={s.beltTagTxt}>{belt.label}</Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={() => removeAthlete(id)} hitSlop={8} accessibilityLabel="Remover atleta">
                      <Icon name="x" size={16} color={C.ink3} />
                    </TouchableOpacity>
                  </View>

                  {/* Chips de modalidade — o único gesto que o sensei precisa fazer */}
                  <View style={s.modChipsRow}>
                    {availableMods.map((m) => {
                      const on = mods.includes(m);
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[s.modChip, on && s.modChipOn]}
                          onPress={() => toggleModality(id, m)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={`${MODALITY_LABEL[m]} — ${nameOf(id)}`}
                        >
                          {on ? <Icon name="check" size={12} color={C.primary} /> : null}
                          <Text style={[s.modChipTxt, on && s.modChipTxtOn]}>{MODALITY_LABEL[m]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {mods.length === 0 ? (
                    <Text style={s.athHint}>Marque as provas — a categoria aparece sozinha.</Text>
                  ) : null}

                  {/* Status do atleta na federação (não federado etc.) */}
                  {ath && ath.status !== "ok" ? (
                    <FadeIn>
                      <View style={s.athStatusBox}>
                        <Icon name="alert_circle" size={15} color={C.warn} />
                        <Text style={s.athStatusTxt}>
                          {ath.status === "ALUNO_NAO_FEDERADO"
                            ? "Este aluno ainda não está federado — federe-o na aba Federativo antes de inscrever."
                            : "Não encontramos o cadastro deste aluno na federação — atualize a lista e tente de novo."}
                        </Text>
                      </View>
                    </FadeIn>
                  ) : null}

                  {/* Resultado da triagem por prova marcada */}
                  {mods.map((m) => (
                    <TriagePairBlock
                      key={pairKey(id, m)}
                      modLabel={MODALITY_LABEL[m]}
                      view={pairViewOf(id, m)}
                      onManual={() => setCatPickerFor({ type: "pair", sid: id, mod: m })}
                      onPick={(catId) => setPairOverride(id, m, [catId])}
                      onRestore={() => setPairOverride(id, m, [])}
                    />
                  ))}
                </View>
              );
            })
          )}

          {pendingPairs > 0 && !triaging ? (
            <Text style={s.pendingHint}>
              {pendingPairs === 1
                ? "1 prova ainda sem categoria definida — ela só entra no pedido depois da escolha."
                : `${pendingPairs} provas ainda sem categoria definida — elas só entram no pedido depois da escolha.`}
            </Text>
          ) : null}
        </Section>

        {/* ── Equipes ── */}
        <Section
          title="Equipes"
          action={<AddButton label="Nova equipe" onPress={addTeam} />}
        >
          {teams.length === 0 ? (
            <Text style={s.emptyHint}>Kata/Kumite equipe: monte o time com titulares e reserva.</Text>
          ) : (
            teams.map((t) => (
              <View key={t.key} style={s.teamCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput
                    style={s.teamNameInput}
                    value={t.name}
                    onChangeText={(v) => patchTeam(t.key, { name: v })}
                    placeholder="Nome da equipe (ex.: Kondei A)"
                    placeholderTextColor={C.ink4}
                    accessibilityLabel="Nome da equipe"
                  />
                  <TouchableOpacity onPress={() => removeTeam(t.key)} hitSlop={8} accessibilityLabel="Remover equipe">
                    <Icon name="trash" size={16} color={C.primary} />
                  </TouchableOpacity>
                </View>

                <View style={s.sexRow}>
                  {SEX_OPTIONS.map(([value, label]) => (
                    <TouchableOpacity
                      key={value}
                      style={[s.sexChip, t.sex === value && s.sexChipOn]}
                      onPress={() => patchTeam(t.key, { sex: value })}
                    >
                      <Text style={[s.sexChipTxt, t.sex === value && s.sexChipTxtOn]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={s.smallBtn} onPress={() => setCatPickerFor({ type: "team", key: t.key })}>
                    <Text style={s.smallBtnTxt}>
                      {t.category_ids.length ? `${t.category_ids.length} prova${t.category_ids.length > 1 ? "s" : ""}` : "Provas"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <RosterLine
                  label="Titulares"
                  ids={t.titular_ids}
                  nameOf={nameOf}
                  onEdit={() => setPickerTarget({ type: "team-titulares", key: t.key })}
                />
                <RosterLine
                  label="Reservas"
                  ids={t.reserve_ids}
                  nameOf={nameOf}
                  onEdit={() => setPickerTarget({ type: "team-reservas", key: t.key })}
                />
                {t.titular_ids.length > 0 && t.titular_ids.length < 2 && (
                  <Text style={s.teamWarn}>Equipe precisa de pelo menos 2 titulares.</Text>
                )}
              </View>
            ))
          )}
        </Section>

        {/* ── Oficiais ── */}
        <Section title="Oficiais do dojô (árbitros, mesários, staff)">
          <View style={s.officialsRow}>
            <Text style={s.officialsHint}>
              Contrapartida do regulamento: oficiais inscritos geram isenção de atletas na cotação.
            </Text>
            <View style={s.stepper}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setOfficials((n) => Math.max(0, n - 1))} accessibilityLabel="Diminuir oficiais">
                <Text style={s.stepBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={s.stepValue}>{officials}</Text>
              <TouchableOpacity style={s.stepBtn} onPress={() => setOfficials((n) => n + 1)} accessibilityLabel="Aumentar oficiais">
                <Text style={s.stepBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* ── Cotação / avisos ── */}
        {cartHasItems && (
          <Section title="Cotação">
            {quoting && !quote ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 8 }} />
            ) : quote ? (
              <QuotePanel quote={quote} />
            ) : (
              <Text style={s.emptyHint}>A cotação aparece aqui.</Text>
            )}
          </Section>
        )}
        </>
        )}
      </ScrollView>

      {/* ── Rodapé fixo: pagamento + enviar ──
          Só na aba de inscrição, e só com inscrições abertas — no dia do
          evento (closed/done) não há o que cotar nem enviar. */}
      {tab === "inscricao" && enrollmentOpen && (
      <View style={s.footerBar}>
        <View style={s.footerInner}>
        <View style={s.payRow}>
          {([["pix_direct", "PIX da federação"], ["manual", "Comprovante depois"]] as const).map(([mode, label]) => (
            <TouchableOpacity
              key={mode}
              style={[s.payChip, paymentMode === mode && s.payChipOn]}
              onPress={() => setPaymentMode(mode)}
            >
              <Text style={[s.payChipTxt, paymentMode === mode && s.payChipTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.footerRow}>
          <View>
            <Text style={s.footerTotalLabel}>Total{quoting ? " (atualizando…)" : ""}</Text>
            <Text style={s.footerTotal}>{quote ? formatBRL(quote.quote.total) : "—"}</Text>
          </View>
          <KarateButton
            label={submitting ? "Enviando…" : "Enviar delegação"}
            variant="sumi"
            size="lg"
            onPress={submit}
            disabled={!canSubmit}
          />
        </View>
        </View>
      </View>
      )}

      {/* ── Modais ── */}
      <SelecionarAlunosModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        federationId={federationId}
        title={pickerTarget?.type === "athletes" ? "Adicionar atletas"
          : pickerTarget?.type === "team-titulares" ? "Titulares da equipe" : "Reservas da equipe"}
        subtitle="Somente alunos federados participam de campeonatos."
        ctaLabel="Confirmar"
        busy={false}
        onSubmit={onPickerSubmit}
      />
      {/* Fallback manual da triagem (par atleta×modalidade) OU provas da equipe.
          No par, confirmar vazio limpa o override e volta ao automático. */}
      <CategoryPickerModal
        visible={catPickerFor !== null}
        onClose={() => setCatPickerFor(null)}
        title={
          catPickerFor?.type === "pair"
            ? `${MODALITY_LABEL[catPickerFor.mod]} — ${nameOf(catPickerFor.sid)}`
            : "Provas da equipe"
        }
        subtitle={competition.name}
        categories={
          catPickerFor?.type === "pair"
            ? categories.filter((c) => c.modality === catPickerFor.mod)
            : categories
        }
        mode={catPickerFor?.type === "team" ? "team" : "individual"}
        initialSelected={
          catPickerFor?.type === "pair"
            ? pairCategoryIds(catPickerFor.sid, catPickerFor.mod)
            : catPickerFor?.type === "team"
              ? (teams.find((t) => t.key === catPickerFor.key)?.category_ids || [])
              : []
        }
        onConfirm={(ids) => {
          if (!catPickerFor) return;
          if (catPickerFor.type === "pair") setPairOverride(catPickerFor.sid, catPickerFor.mod, ids);
          else patchTeam(catPickerFor.key, { category_ids: ids });
        }}
      />
    </View>
  );
}

// ── Subcomponentes ──────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

// ── Minhas chaves (Onda B) ─────────────────────────────────
// A tradução do ritual do ginásio: o sensei chega, procura o KOTO
// (área/tatame) da categoria do aluno e imprime a folha. Aqui ele vê SÓ
// as categorias onde tem atleta — e a folha é a MESMA da federação.

const KATA_MODE_LABEL: Record<string, string> = {
  scores: "Kata por notas",
  notas: "Kata por notas",
  score: "Kata por notas",
  bracket: "Kata em chave",
  chave: "Kata em chave",
  flag: "Kata por bandeiras",
  flags: "Kata por bandeiras",
};

/** KOTO legível — é o primeiro dado que o sensei procura no ginásio. */
function kotoOf(c: MyBracketCategory): string {
  if (c.area_name) return c.area_name;
  if (c.area_order != null) return `Área ${c.area_order}`;
  return "a definir";
}

function MyBracketsPanel({
  state, loading, error, printingCat, onRetry, onPrint,
}: {
  state: MyBracketsResponse | null;
  loading: boolean;
  error: string | null;
  printingCat: string | null;
  onRetry: () => void;
  onPrint: (categoryId: string) => void;
}) {
  const rows = useMemo(() => {
    const list = [...(state?.data || [])];
    list.sort((a, b) => {
      const ao = a.area_order ?? 9999;
      const bo = b.area_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    return list;
  }, [state]);

  if (loading && !state) {
    return (
      <Section title="Minhas chaves">
        <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Minhas chaves">
        <View style={s.brEmpty}>
          <Icon name="alert-circle" size={22} color={C.warn} />
          <Text style={s.brEmptyTitle}>{error}</Text>
          <TouchableOpacity style={s.brRetry} onPress={onRetry} accessibilityRole="button">
            <Icon name="refresh-cw" size={13} color={C.primary} />
            <Text style={s.brRetryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </Section>
    );
  }

  if (state && !state.published) {
    return (
      <Section title="Minhas chaves">
        <View style={s.brEmpty}>
          <Icon name="layout-grid" size={24} color={C.ink3} />
          <Text style={s.brEmptyTitle}>A federação ainda não publicou as chaves</Text>
          <Text style={s.brEmptyHint}>
            Assim que o sorteio for publicado, as categorias dos seus atletas aparecem
            aqui com o KOTO e a folha pronta para imprimir.
          </Text>
          <TouchableOpacity style={s.brRetry} onPress={onRetry} accessibilityRole="button">
            <Icon name="refresh-cw" size={13} color={C.primary} />
            <Text style={s.brRetryTxt}>Verificar de novo</Text>
          </TouchableOpacity>
        </View>
      </Section>
    );
  }

  if (rows.length === 0) {
    return (
      <Section title="Minhas chaves">
        <View style={s.brEmpty}>
          <Icon name="layout-grid" size={24} color={C.ink3} />
          <Text style={s.brEmptyTitle}>Nenhum atleta seu nas chaves deste campeonato</Text>
          <Text style={s.brEmptyHint}>
            Só aparecem aqui as categorias com pelo menos um atleta do seu dojô confirmado.
          </Text>
        </View>
      </Section>
    );
  }

  return (
    <Section
      title={`Minhas chaves (${rows.length})`}
      action={
        <TouchableOpacity style={s.brRetry} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Atualizar chaves">
          <Icon name="refresh-cw" size={13} color={C.primary} />
          <Text style={s.brRetryTxt}>Atualizar</Text>
        </TouchableOpacity>
      }
    >
      <Text style={s.emptyHint}>
        Confira o KOTO da categoria e imprima a folha — é a mesma súmula usada pela mesa.
      </Text>
      {rows.map((c) => (
        <MyBracketCard
          key={c.id}
          cat={c}
          printing={printingCat === c.id}
          onPrint={() => onPrint(c.id)}
        />
      ))}
    </Section>
  );
}

function MyBracketCard({ cat, printing, onPrint }: { cat: MyBracketCategory; printing: boolean; onPrint: () => void }) {
  const printable = cat.bracket_status !== "not_generated";
  const meta = [cat.division_name, cat.group_label, MODALITY_LABEL[cat.modality as EnrollmentCategory["modality"]] || cat.modality]
    .filter(Boolean).join(" · ");
  const kata = cat.kata_mode ? KATA_MODE_LABEL[String(cat.kata_mode).toLowerCase()] : null;
  const done = cat.bracket_status === "done";
  const official = cat.bracket_status === "locked";

  const body = (
    <>
      <View style={s.brTopRow}>
        <View style={s.brKoto}>
          <Text style={s.brKotoLabel}>KOTO</Text>
          <Text style={s.brKotoValue} numberOfLines={1}>{kotoOf(cat)}</Text>
        </View>
        <View style={[s.brPill, official && s.brPillOk, done && s.brPillMuted]}>
          <Icon
            name={official ? "lock-closed" : done ? "check-circle" : "information-circle"}
            size={12}
            color={official ? C.ok : done ? C.ink3 : C.ink2}
          />
          <Text style={[s.brPillTxt, official && s.brPillTxtOk, done && s.brPillTxtMuted]}>
            {BRACKET_STATUS_LABEL[cat.bracket_status] || cat.bracket_status}
          </Text>
        </View>
      </View>

      <Text style={s.brCatName} numberOfLines={2}>{cat.name}</Text>
      {meta ? <Text style={s.brCatMeta} numberOfLines={2}>{meta}</Text> : null}
      {kata ? <Text style={s.brCatMeta}>{kata}</Text> : null}

      <View style={s.brAthletes}>
        <Text style={s.brAthLabel}>
          {cat.my_athletes.length === 1 ? "Meu atleta" : `Meus atletas (${cat.my_athletes.length})`}
        </Text>
        {cat.my_athletes.length === 0 ? (
          <Text style={s.brAthName}>—</Text>
        ) : (
          cat.my_athletes.map((n, i) => (
            <Text key={`${n}-${i}`} style={s.brAthName} numberOfLines={1}>{n}</Text>
          ))
        )}
      </View>

      {printable ? (
        <View style={s.brPrintRow}>
          <Icon name="print" size={14} color={C.primary} />
          <Text style={s.brPrintTxt}>{printing ? "Abrindo folha…" : "Imprimir folha da chave"}</Text>
        </View>
      ) : (
        <Text style={s.brNote}>
          O sorteio desta categoria ainda não foi feito — a folha fica disponível quando a chave sair.
        </Text>
      )}
    </>
  );

  if (!printable) return <View style={s.brCard}>{body}</View>;

  return (
    <TouchableOpacity
      style={s.brCard}
      onPress={onPrint}
      disabled={printing}
      accessibilityRole="button"
      accessibilityLabel={`Imprimir folha da chave de ${cat.name}`}
    >
      {body}
    </TouchableOpacity>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.addBtn} onPress={onPress} accessibilityRole="button">
      <Icon name="plus" size={14} color={C.primary} />
      <Text style={s.addBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Entrada suave (fade + slide sutil) — respeita prefers-reduced-motion. */
function FadeIn({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const reduced = usePrefersReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    const anim = Animated.timing(v, {
      toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={[style, {
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Resultado da triagem de UM par atleta×modalidade.
 *  resolved → verde-sutil (zero escolha) · ambiguous → só desempatar ·
 *  no_fit → âmbar com os porquês · sempre com escape manual. */
function TriagePairBlock({ modLabel, view, onManual, onPick, onRestore }: {
  modLabel: string;
  view: PairView;
  onManual: () => void;
  onPick: (categoryId: string) => void;
  onRestore: () => void;
}) {
  return (
    <FadeIn key={view.kind} style={s.pairBlock}>
      <Text style={s.pairEyebrow}>{modLabel}</Text>

      {view.kind === "loading" ? (
        <View style={s.pairLoadingRow}>
          <ActivityIndicator size="small" color={C.ink3} />
          <Text style={s.pairLoadingTxt}>Encontrando a categoria…</Text>
        </View>
      ) : null}

      {view.kind === "resolved" ? (
        <View style={s.resolvedBox}>
          <Icon name="check_circle" size={16} color={C.ok} />
          <View style={{ flex: 1 }}>
            <View style={s.catNameRow}>
              <Text style={s.catName}>{view.name}</Text>
              {view.groupLabel ? (
                <View style={s.groupChip}><Text style={s.groupChipTxt}>{view.groupLabel}</Text></View>
              ) : null}
            </View>
            {view.meta ? <Text style={s.catMeta}>{view.meta}</Text> : null}
          </View>
          <TouchableOpacity onPress={onManual} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={`Alterar categoria de ${modLabel}`}>
            <Text style={s.linkTxt}>alterar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {view.kind === "override" ? (
        <View style={s.overrideBox}>
          <Icon name="edit" size={14} color={C.ink2} />
          <View style={{ flex: 1 }}>
            <Text style={s.catName}>{view.names.join(", ")}</Text>
            <Text style={s.overrideTag}>Escolha manual</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <TouchableOpacity onPress={onManual} hitSlop={6} accessibilityRole="button"
              accessibilityLabel={`Alterar categoria de ${modLabel}`}>
              <Text style={s.linkTxt}>alterar</Text>
            </TouchableOpacity>
            {view.hasSuggestion ? (
              <TouchableOpacity onPress={onRestore} hitSlop={6} accessibilityRole="button"
                accessibilityLabel={`Usar a categoria sugerida em ${modLabel}`}>
                <Text style={s.linkTxt}>usar sugestão</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {view.kind === "ambiguous" ? (
        <View style={{ gap: 6 }}>
          <Text style={s.ambigTitle}>Mais de uma categoria serve — escolha uma:</Text>
          {view.options.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={s.optionRow}
              onPress={() => onPick(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: false }}
              accessibilityLabel={`${o.name} em ${modLabel}`}
            >
              <View style={s.radio} />
              <View style={{ flex: 1 }}>
                <View style={s.catNameRow}>
                  <Text style={s.catName}>{o.name}</Text>
                  {o.groupLabel ? (
                    <View style={s.groupChip}><Text style={s.groupChipTxt}>{o.groupLabel}</Text></View>
                  ) : null}
                </View>
                {o.meta ? <Text style={s.catMeta}>{o.meta}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {view.kind === "no_fit" ? (
        <View style={s.noFitBox}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Icon name="alert" size={15} color={C.warn} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.noFitTitle}>Nenhuma categoria de {modLabel} encaixa automaticamente</Text>
              {view.message ? <Text style={s.noFitTxt}>{view.message}</Text> : null}
              {view.reasons.map((r, i) => (
                <Text key={i} style={s.noFitTxt}>• {r}</Text>
              ))}
            </View>
          </View>
          <TouchableOpacity style={s.manualBtn} onPress={onManual} accessibilityRole="button">
            <Text style={s.manualBtnTxt}>Escolher manualmente</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {view.kind === "manual_only" ? (
        <View style={s.manualOnlyRow}>
          {view.hint ? <Text style={s.pairLoadingTxt}>{view.hint}</Text> : null}
          <TouchableOpacity style={s.manualBtn} onPress={onManual} accessibilityRole="button">
            <Text style={s.manualBtnTxt}>Escolher manualmente</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </FadeIn>
  );
}

function RosterLine({ label, ids, nameOf, onEdit }: {
  label: string; ids: string[]; nameOf: (id: string) => string; onEdit: () => void;
}) {
  return (
    <View style={s.rosterLine}>
      <Text style={s.rosterLabel}>{label}</Text>
      <Text style={s.rosterNames} numberOfLines={2}>
        {ids.length ? ids.map(nameOf).join(", ") : "—"}
      </Text>
      <TouchableOpacity style={s.smallBtn} onPress={onEdit}>
        <Text style={s.smallBtnTxt}>{ids.length ? "Editar" : "Escolher"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function QuotePanel({ quote }: { quote: QuoteResponse }) {
  return (
    <View style={{ gap: 10 }}>
      {quote.quota_violations.length > 0 && (
        <View style={s.blockBox}>
          <Icon name="alert" size={15} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.blockTitle}>Cota por clube excedida — o envio está bloqueado</Text>
            {quote.quota_violations.map((v, i) => (
              <Text key={i} style={s.blockTxt}>
                {v.category_name || v.category_id}: limite {v.limit}, {v.existing} já inscrito{v.existing === 1 ? "" : "s"} + {v.adding} no carrinho ({v.over} a mais)
              </Text>
            ))}
          </View>
        </View>
      )}

      {quote.skipped.length > 0 && (
        <View style={s.warnBox}>
          <Text style={s.warnTitle}>Fora do pedido ({quote.skipped.length})</Text>
          {quote.skipped.map((sk, i) => (
            <Text key={i} style={s.warnTxt}>• {sk.name || sk.student_id || sk.team}: {sk.message}</Text>
          ))}
        </View>
      )}

      {quote.warnings.length > 0 && (
        <View style={s.warnBox}>
          <Text style={s.warnTitle}>Avisos de categoria (não bloqueiam)</Text>
          {quote.warnings.map((w, i) => (
            <Text key={i} style={s.warnTxt}>• {w.name} em {w.category_name}: {w.warnings.join(" ")}</Text>
          ))}
        </View>
      )}

      {quote.quote.lines.map((l, i) => (
        <View key={i} style={s.quoteLine}>
          <Text style={[s.quoteLabel, l.exempted && s.quoteExempt]} numberOfLines={1}>
            {l.label}{l.exempted ? " (isento)" : ""}
          </Text>
          <Text style={[s.quoteAmount, l.exempted && s.quoteExempt]}>{formatBRL(l.amount)}</Text>
        </View>
      ))}
      {quote.quote.discount > 0 && (
        <View style={s.quoteLine}>
          <Text style={s.quoteLabel}>
            Isenções por oficiais ({quote.quote.exemptions.applied} de {quote.quote.exemptions.earned})
          </Text>
          <Text style={[s.quoteAmount, { color: "#2e7d4f" }]}>−{formatBRL(quote.quote.discount)}</Text>
        </View>
      )}
      <View style={s.quoteTotalLine}>
        <Text style={s.quoteTotalLabel}>Total da delegação</Text>
        <Text style={s.quoteTotalValue}>{formatBRL(quote.quote.total)}</Text>
      </View>
    </View>
  );
}

function SuccessView({ result, onDone }: { result: SubmitResponse; onDone: () => void }) {
  const pix = result.payment && !result.payment.error ? result.payment : null;
  const nEntries = result.enrolled.athletes.length
    + result.enrolled.teams.reduce((sum, t) => sum + t.entry_ids.length, 0);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, gap: 14, alignItems: "center" }}>
      <Icon name="check_circle" size={44} color="#2e7d4f" />
      <Text style={s.successTitle}>Delegação enviada</Text>
      <Text style={s.successSub}>
        {nEntries} inscriç{nEntries === 1 ? "ão" : "ões"} registradas
        {result.skipped.length ? ` · ${result.skipped.length} fora do pedido` : ""} · total {formatBRL(result.order.total_amount)}
      </Text>

      {pix && pix.payload ? (
        <View style={s.pixCard}>
          <Text style={s.pixTitle}>Pague o PIX consolidado</Text>
          <PixQRCode payload={pix.payload} qrImage={pix.qr_image || undefined} size={190} />
          <TouchableOpacity
            style={s.copyBtn}
            onPress={async () => { await copyToClipboard(pix.payload || ""); toast.success("Código PIX copiado."); }}
          >
            <Icon name="copy" size={14} color={C.primary} />
            <Text style={s.copyBtnTxt}>Copiar código PIX</Text>
          </TouchableOpacity>
          <Text style={s.pixHint}>Após o pagamento, a confirmação é automática.</Text>
        </View>
      ) : result.order.total_amount > 0 ? (
        <View style={s.pixCard}>
          <Text style={s.pixTitle}>
            {result.payment?.error ? "PIX indisponível agora" : "Pagamento por transferência"}
          </Text>
          <Text style={s.pixHint}>
            {result.payment?.error
              ? `${result.payment.error} Você pode enviar o comprovante em "Meus pedidos".`
              : 'Pague no PIX/conta da federação e envie o comprovante em "Meus pedidos" — a federação confirma na conferência.'}
          </Text>
        </View>
      ) : (
        <Text style={s.pixHint}>Sem valores a pagar — inscrições confirmadas.</Text>
      )}

      <KarateButton label="Ver meus pedidos" variant="sumi" size="lg" onPress={onDone} />
    </ScrollView>
  );
}

// ── Estilos ─────────────────────────────────────────────────
const s = StyleSheet.create({
  // PREMISSA (24/08): coluna central com largura máxima — cabeçalho e os
  // cards do wizard (Atletas/Equipes/Oficiais/Cotação) não esticam a tela.
  header: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  compName: { fontSize: 19, fontFamily: F.heading, color: C.ink } as TextStyle,
  compMeta: { fontSize: 12.5, color: C.ink3, marginTop: 2 } as TextStyle,
  section: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } as ViewStyle,
  sectionTitle: { fontSize: 13, fontWeight: "800", color: C.ink, flexShrink: 1 } as TextStyle,
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 11, paddingVertical: 6 } as ViewStyle,
  addBtnTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  emptyHint: { fontSize: 12.5, color: C.ink3 } as TextStyle,
  athleteName: { fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,

  // ── Dia do evento: wizard bloqueado (inscrições encerradas) ──
  // Segue a premissa da coluna central (24/08): não estica a tela.
  closedBox: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center", gap: 8, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  closedTitle: { fontSize: 15, fontWeight: "800", color: C.ink } as TextStyle,
  closedTxt: { fontSize: 12.5, color: C.ink3, textAlign: "center", lineHeight: 18 } as TextStyle,

  // ── Abas (inscrição × minhas chaves × presença) ──
  // PREMISSA (24/08): coluna central — abas e painéis não esticam a tela.
  tabsRow: { flexDirection: "row", gap: 6, backgroundColor: C.glass2, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 4, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  tabPanelCol: { width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: R.md } as ViewStyle,
  tabBtnOn: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2 } as ViewStyle,
  tabTxt: { fontSize: 13, fontWeight: "600", color: C.ink3 } as TextStyle,
  tabTxtOn: { color: C.ink, fontWeight: "800" } as TextStyle,

  // ── Minhas chaves (Onda B) ──
  brEmpty: { alignItems: "center", gap: 8, paddingVertical: 18, paddingHorizontal: 10 } as ViewStyle,
  brEmptyTitle: { fontSize: 13.5, fontWeight: "700", color: C.ink, textAlign: "center" } as TextStyle,
  brEmptyHint: { fontSize: 12.5, color: C.ink3, textAlign: "center", lineHeight: 18, maxWidth: 380 } as TextStyle,
  brRetry: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 11, paddingVertical: 6 } as ViewStyle,
  brRetryTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  brCard: { borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, gap: 8, backgroundColor: C.glass2 } as ViewStyle,
  brTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } as ViewStyle,
  brKoto: { flexDirection: "row", alignItems: "baseline", gap: 7, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 5 } as ViewStyle,
  brKotoLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: C.primary } as TextStyle,
  brKotoValue: { fontSize: 15, fontWeight: "800", color: C.primary } as TextStyle,
  brPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.glassHi, paddingHorizontal: 9, paddingVertical: 3 } as ViewStyle,
  brPillOk: { backgroundColor: C.okSoft, borderColor: C.okLine } as ViewStyle,
  brPillMuted: { backgroundColor: C.glass2 } as ViewStyle,
  brPillTxt: { fontSize: 11, fontWeight: "700", color: C.ink2 } as TextStyle,
  brPillTxtOk: { color: C.ok } as TextStyle,
  brPillTxtMuted: { color: C.ink3 } as TextStyle,
  brCatName: { fontSize: 14.5, fontWeight: "800", color: C.ink } as TextStyle,
  brCatMeta: { fontSize: 12, color: C.ink3 } as TextStyle,
  brAthletes: { gap: 2, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 } as ViewStyle,
  brAthLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: C.ink3, marginBottom: 2 } as TextStyle,
  brAthName: { fontSize: 13, fontWeight: "600", color: C.ink2 } as TextStyle,
  brPrintRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 11, paddingVertical: 7 } as ViewStyle,
  brPrintTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  brNote: { fontSize: 12, color: C.ink3, fontStyle: "italic" } as TextStyle,

  // ── Triagem P2.2 — card do atleta ──
  athCard: { borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 11, gap: 9, backgroundColor: C.glass2 } as ViewStyle,
  athHead: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  beltTag: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.glassHi, paddingHorizontal: 8, paddingVertical: 2 } as ViewStyle,
  beltDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: "rgba(43,38,32,0.18)" } as ViewStyle,
  beltTagTxt: { fontSize: 10.5, fontWeight: "600", color: C.ink2 } as TextStyle,
  modChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  modChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.surface } as ViewStyle,
  modChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  modChipTxt: { fontSize: 12.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  modChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  athHint: { fontSize: 11.5, color: C.ink3 } as TextStyle,
  athStatusBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: C.warnSoft, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10 } as ViewStyle,
  athStatusTxt: { flex: 1, fontSize: 12, color: C.warn, fontWeight: "600" } as TextStyle,
  pendingHint: { fontSize: 11.5, color: C.ink3, fontStyle: "italic" } as TextStyle,

  // ── Triagem P2.2 — bloco por prova (par atleta×modalidade) ──
  pairBlock: { gap: 5 } as ViewStyle,
  pairEyebrow: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  pairLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 } as ViewStyle,
  pairLoadingTxt: { fontSize: 12, color: C.ink3 } as TextStyle,
  resolvedBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.okSoft, borderWidth: 1, borderColor: C.okLine, borderRadius: R.md, padding: 10 } as ViewStyle,
  catNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" } as ViewStyle,
  catName: { fontSize: 13, fontWeight: "700", color: C.ink } as TextStyle,
  catMeta: { fontSize: 11.5, color: C.ink2, marginTop: 1 } as TextStyle,
  groupChip: { borderRadius: 999, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 7, paddingVertical: 1 } as ViewStyle,
  groupChipTxt: { fontSize: 10, fontWeight: "700", color: C.ink2 } as TextStyle,
  linkTxt: { fontSize: 12, fontWeight: "700", color: C.ink2, textDecorationLine: "underline" } as TextStyle,
  overrideBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, padding: 10 } as ViewStyle,
  overrideTag: { fontSize: 10.5, fontWeight: "700", color: C.ink3, marginTop: 1 } as TextStyle,
  ambigTitle: { fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, padding: 10, backgroundColor: C.surface } as ViewStyle,
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.border2, backgroundColor: C.surface } as ViewStyle,
  noFitBox: { backgroundColor: C.warnSoft, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10, gap: 8 } as ViewStyle,
  noFitTitle: { fontSize: 12.5, fontWeight: "700", color: C.warn } as TextStyle,
  noFitTxt: { fontSize: 11.5, color: C.ink2 } as TextStyle,
  manualBtn: { alignSelf: "flex-start", borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: C.glassHi } as ViewStyle,
  manualBtnTxt: { fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  manualOnlyRow: { gap: 6 } as ViewStyle,
  smallBtn: { borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.glassHi } as ViewStyle,
  smallBtnTxt: { fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  teamCard: { borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 11, gap: 8, backgroundColor: C.surface } as ViewStyle,
  teamNameInput: { flex: 1, fontSize: 14, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.glassHi } as TextStyle,
  sexRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" } as ViewStyle,
  sexChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 11, paddingVertical: 5 } as ViewStyle,
  sexChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  sexChipTxt: { fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  sexChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  rosterLine: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  rosterLabel: { width: 64, fontSize: 11.5, fontWeight: "700", color: C.ink3 } as TextStyle,
  rosterNames: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  teamWarn: { fontSize: 11.5, color: C.primary } as TextStyle,
  officialsRow: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  officialsHint: { flex: 1, fontSize: 12, color: C.ink3 } as TextStyle,
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  stepBtn: { width: 34, height: 34, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center", backgroundColor: C.glassHi } as ViewStyle,
  stepBtnTxt: { fontSize: 18, fontWeight: "700", color: C.ink } as TextStyle,
  stepValue: { minWidth: 26, textAlign: "center", fontSize: 16, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  blockBox: { flexDirection: "row", gap: 8, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: C.primaryLine, borderRadius: R.md, padding: 11 } as ViewStyle,
  blockTitle: { fontSize: 12.5, fontWeight: "800", color: C.primary2 } as TextStyle,
  blockTxt: { fontSize: 12, color: C.primary2, marginTop: 2 } as TextStyle,
  warnBox: { backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 11, gap: 3 } as ViewStyle,
  warnTitle: { fontSize: 11.5, fontWeight: "800", color: C.ink2 } as TextStyle,
  warnTxt: { fontSize: 12, color: C.ink2 } as TextStyle,
  quoteLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  quoteLabel: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  quoteAmount: { fontSize: 12.5, color: C.ink2, fontVariant: ["tabular-nums"] } as TextStyle,
  quoteExempt: { textDecorationLine: "line-through", color: C.ink3 } as TextStyle,
  quoteTotalLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 } as ViewStyle,
  quoteTotalLabel: { fontSize: 13.5, fontWeight: "800", color: C.ink } as TextStyle,
  quoteTotalValue: { fontSize: 17, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  // A barra do rodapé cobre a tela; o conteúdo (pagamento + total/enviar)
  // segue a coluna central — total e botão não se separam em monitor largo.
  footerBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 12 } as ViewStyle,
  footerInner: { width: "100%", maxWidth: 920, alignSelf: "center", gap: 8 } as ViewStyle,
  payRow: { flexDirection: "row", gap: 6 } as ViewStyle,
  payChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 6 } as ViewStyle,
  payChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  payChipTxt: { fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  payChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 } as ViewStyle,
  footerTotalLabel: { fontSize: 11, color: C.ink3 } as TextStyle,
  footerTotal: { fontSize: 19, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  successTitle: { fontSize: 22, fontFamily: F.heading, color: C.ink } as TextStyle,
  successSub: { fontSize: 13.5, color: C.ink2, textAlign: "center", maxWidth: 420 } as TextStyle,
  pixCard: { width: "100%", maxWidth: 420, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 16, alignItems: "center", gap: 10 } as ViewStyle,
  pixTitle: { fontSize: 15, fontWeight: "800", color: C.ink } as TextStyle,
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 8 } as ViewStyle,
  copyBtnTxt: { fontSize: 13, fontWeight: "700", color: C.primary } as TextStyle,
  pixHint: { fontSize: 12, color: C.ink3, textAlign: "center" } as TextStyle,
});
