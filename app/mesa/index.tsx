// ============================================================
// MESA DO MESÁRIO — acesso PÚBLICO fora do shell (Hub P2.1)
// Rota: /mesa?t=<token>  (SEM conta Aura — token opaco da convocação)
//
// Vivência de campo (Campeonato Paulista JKA 2026): o mesário não tem
// conta no Aura, fica vinculado a UM koto por vez (trocável a qualquer
// momento — lanche/pausa) e o acesso é controlado pela federação. O
// backend (aura-backend PR #579, migration 302) deriva TUDO do token:
// federação, competição e o koto ATUAL — mover o mesário de koto move o
// acesso junto, sem novo link.
//
// Esta tela espelha o Modo Mesário interno (torneio/koto.tsx, aprovado
// em QA) com as diferenças do mundo público:
//   - autentica com o token da URL (?t=) guardado em sessionStorage e
//     REMOVIDO da barra de endereço (não fica em screenshot/histórico);
//   - a fila vem do GET /me (já escopada ao koto atual) e é re-lida a
//     cada 30s — troca de koto/categoria aparece sem reload;
//   - kata por NOTAS é operável AQUI (lançar nota, classificar para a
//     final, fechar resultado) — no koto interno isso delega à tela do
//     torneio, que o mesário público não tem;
//   - montagem de chave (gerar/travar) segue sendo ato da federação: a
//     mesa mostra "aguardando chave" e orienta falar com a mesa central.
//
// Estados de borda do contrato:
//   401 MESA_LINK_INVALID      → tela "link inválido/revogado"
//   /me com area:null          → tela "aguardando alocação" (auto-refresh)
//   403 CATEGORIA_FORA_DO_KOTO → aviso "categoria movida" + refresh da fila
//
// Mobile-first: operação com uma mão, no calor do evento — coluna única,
// alvos de toque generosos, números em mono.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Platform, Vibration,
  AccessibilityInfo, Animated, TextInput, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { toast, ToastContainer } from "@/components/Toast";
import { useShojiFonts } from "@/components/karate/shoji";
import {
  karateMesaApi, setMesaToken, mesaErrorCode, MesaMe, MesaCategory,
} from "@/services/karateMesaApi";
import {
  BracketState, BracketAthleteRef, PhaseByRound, PodiumEntry, KataScore,
} from "@/services/karateBracketsApi";
import {
  FORMAT_LABEL, DECISION_LABEL, MatchFormat, DecisionMethod,
} from "@/services/karateCompetitionP1Api";
import { findNextPendingMatch } from "@/components/karate/chaves/EventDayMode";
import { roundLabel } from "@/components/karate/chaves/shared";

// ── Constantes (mesmos valores do Modo Mesário interno) ─────
const ATOSHI_SEC = 30;
const DEFAULT_DURATION_SEC = 90;
const QUEUE_POLL_MS = 30_000;   // fila do koto
const WAITING_POLL_MS = 15_000; // "aguardando alocação" — refresh mais ansioso
const STORAGE_KEY = "aura_mesa_token";

const MODALITY_LABEL: Record<string, string> = {
  kata: "Kata", kumite: "Kumite", kihon_ippon: "Kihon-Ippon",
  team_kata: "Kata Equipe", team_kumite: "Kumite Equipe",
  enbu: "Enbu", fukugo: "Fukugo",
};

const isKataModality = (m: string) => m === "kata" || m === "team_kata";

/** true = painel de NOTAS; false = árvore de lutas (inclui kata bandeirada). */
function isScoreMode(cat: MesaCategory): boolean {
  if (cat.kata_mode) return cat.kata_mode === "score_rounds";
  return isKataModality(cat.modality); // heurística só enquanto a chave não existe
}

type QueueStatus = "aguardando" | "na_mesa" | "finalizada";

const QUEUE_VIEW: Record<QueueStatus, { label: string; color: string; bg: string; icon: string }> = {
  aguardando: { label: "Aguardando chave", color: P.neutral, bg: P.neutralWash, icon: "clock" },
  na_mesa:    { label: "Na mesa",          color: P.warn,    bg: P.warnWash,    icon: "play_circle" },
  finalizada: { label: "Finalizada",       color: P.ok,      bg: P.okWash,      icon: "check" },
};

// ── Helpers ─────────────────────────────────────────────────
function realAthlete(v: BracketAthleteRef | "bye" | null | undefined): BracketAthleteRef | null {
  return v && v !== "bye" ? v : null;
}

function vibrate(pattern: number | number[]) {
  try { Vibration.vibrate(pattern as any); } catch { /* sem vibração disponível */ }
}

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** ISO "YYYY-MM-DD..." → "dd/mm/aaaa" — parse manual tz-safe (nunca new Date). */
function fmtEventDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (Platform.OS === "web" && typeof window !== "undefined" && (window as any).matchMedia) {
      const mq = (window as any).matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(!!mq.matches);
      const onChange = (e: any) => { if (mounted) setReduced(!!e.matches); };
      mq.addEventListener?.("change", onChange);
      return () => { mounted = false; mq.removeEventListener?.("change", onChange); };
    }
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduced(!!v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  return reduced;
}

// ── Bootstrap do token: ?t= → sessionStorage → memória ──────
// O link chega como /mesa?t=<64 chars>. Guardamos em sessionStorage e
// LIMPAMOS a query da barra de endereço (o token não fica exposto em
// screenshot, histórico ou compartilhamento acidental da URL). Reload
// da página re-lê do sessionStorage.
function useMesaTokenBootstrap(): string | null {
  const { t } = useLocalSearchParams<{ t?: string }>();
  const [token, setToken] = useState<string | null>(() => {
    const fromUrl = typeof t === "string" && t.trim() ? t.trim() : null;
    if (fromUrl) return fromUrl;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { return window.sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
    }
    return null;
  });

  useEffect(() => {
    const fromUrl = typeof t === "string" && t.trim() ? t.trim() : null;
    if (fromUrl) {
      setToken(fromUrl);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try { window.sessionStorage.setItem(STORAGE_KEY, fromUrl); } catch { /* storage cheio/bloqueado */ }
        try { window.history.replaceState({}, "", "/mesa"); } catch { /* ok manter a query */ }
      }
    }
  }, [t]);

  useEffect(() => { setMesaToken(token); }, [token]);
  return token;
}

// Título + favicon da aba (a rota vive FORA de /karate, então o layout
// do karatê não injeta a marca — fazemos o mínimo aqui, web-only).
function useMesaWebChrome(competitionName: string | null) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = competitionName ? `Mesa · ${competitionName}` : "Mesa do Mesário · Aura Karatê";
  }, [competitionName]);
}

// ════════════════════════════════════════════════════════════
// Tela
// ════════════════════════════════════════════════════════════
export default function MesaPublicaScreen() {
  useShojiFonts();
  const token = useMesaTokenBootstrap();

  const [me, setMe] = useState<MesaMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  // Categorias finalizadas NESTA sessão (o /me não distingue "locked" de
  // "locked + pódio fechado" — marcamos localmente após o finalize).
  const [finalizedIds, setFinalizedIds] = useState<Set<string>>(new Set());

  const areaIdRef = useRef<string | null>(null);
  const meRef = useRef<MesaMe | null>(null);
  meRef.current = me;
  const selectedCatIdRef = useRef<string | null>(null);
  selectedCatIdRef.current = selectedCatId;

  useMesaWebChrome(me?.competition.name ?? null);

  const handleLinkInvalid = useCallback(() => {
    setLinkInvalid(true);
    setSelectedCatId(null);
  }, []);

  // ── Carga / refresh do /me ──────────────────────────────────
  // silent=true (polling): sem skeleton, sem apagar a tela em erro de rede.
  const load = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) { setLoading(true); setLoadError(null); }
    try {
      const data = await karateMesaApi.getMe();
      const prevAreaId = areaIdRef.current;
      areaIdRef.current = data.area?.id ?? null;
      setMe(data);
      setLinkInvalid(false);
      setLoadError(null);

      // Troca de koto detectada no refresh: avisa e fecha o painel aberto
      // (a fila nova pode nem conter a categoria que estava em operação).
      if (silent && prevAreaId && data.area && data.area.id !== prevAreaId) {
        toast.info(`Você agora está no koto "${data.area.name}" — fila atualizada.`);
        setSelectedCatId(null);
      } else if (silent) {
        // Categoria aberta saiu da fila (movida de koto): fecha com aviso.
        const sel = selectedCatIdRef.current;
        if (sel && !data.categories.some((c) => c.id === sel)) {
          toast.warning("A categoria em operação foi movida do seu koto — a fila foi atualizada.");
          setSelectedCatId(null);
        }
      }
    } catch (e: any) {
      if (e?.status === 401) { handleLinkInvalid(); return; }
      if (!silent) setLoadError(e?.message || "Não foi possível carregar a mesa.");
      // silent + erro de rede: mantém a última fila boa na tela.
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, handleLinkInvalid]);

  useEffect(() => { load(); }, [load]);

  // ── Polling leve: fila a cada 30s; "sem koto" a cada 15s ────
  useEffect(() => {
    if (!token || linkInvalid) return;
    const interval = meRef.current && !meRef.current.area ? WAITING_POLL_MS : QUEUE_POLL_MS;
    const timer = setInterval(() => { load(true); }, interval);
    return () => clearInterval(timer);
  }, [token, linkInvalid, me?.area?.id, load]);

  // Voltou pra aba (celular destravado, app retomado): re-lê a fila na hora.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onVisible = () => { if (document.visibilityState === "visible") load(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // 403 CATEGORIA_FORA_DO_KOTO vindo de qualquer operação de painel.
  const handleCategoryMoved = useCallback(() => {
    toast.warning("Esta categoria foi movida do seu koto — a fila foi atualizada.");
    setSelectedCatId(null);
    load(true);
  }, [load]);

  const markFinalized = useCallback((catId: string) => {
    setFinalizedIds((prev) => {
      const next = new Set(prev);
      next.add(catId);
      return next;
    });
  }, []);

  // ── Estados de borda ────────────────────────────────────────
  if (!token || linkInvalid) {
    return (
      <MesaFrame>
        <InvalidLinkCard onRetry={token ? () => { setLinkInvalid(false); load(); } : undefined} />
      </MesaFrame>
    );
  }

  if (loading) {
    return (
      <MesaFrame>
        <View style={s.content}>
          <Skeleton width={150} height={14} />
          <Skeleton width={260} height={30} style={{ marginTop: 8 }} />
          <Skeleton width={200} height={14} style={{ marginTop: 6 }} />
          <Skeleton height={72} radius={R.md} style={{ marginTop: 18 }} />
          <Skeleton height={72} radius={R.md} style={{ marginTop: 8 }} />
          <Skeleton height={72} radius={R.md} style={{ marginTop: 8 }} />
        </View>
      </MesaFrame>
    );
  }

  if (loadError || !me) {
    return (
      <MesaFrame>
        <View style={s.edgeWrap}>
          <View style={s.edgeCard}>
            <View style={[s.edgeSeal, { backgroundColor: P.neutralWash }]}>
              <Icon name="alert" size={26} color={C.ink3} />
            </View>
            <Text style={s.edgeTitle}>Não foi possível carregar a mesa</Text>
            <Text style={s.edgeTxt}>{loadError || "Falha inesperada — tente novamente."}</Text>
            <KarateButton label="Tentar de novo" variant="sumi" size="lg" onPress={() => load()} />
          </View>
        </View>
      </MesaFrame>
    );
  }

  if (!me.area) {
    return (
      <MesaFrame>
        <WaitingKotoCard me={me} onRefresh={() => load()} />
      </MesaFrame>
    );
  }

  const categories = me.categories;
  const selectedCat = categories.find((c) => c.id === selectedCatId) || null;
  const eventDate = fmtEventDate(me.competition.event_date);

  return (
    <MesaFrame>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* ── Cabeçalho: evento + koto + mesário ── */}
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.eyebrow}>Mesa do Mesário · {me.competition.name}</Text>
            <Text style={s.title}>{me.area.name}</Text>
            <View style={s.headerMetaRow}>
              <View style={s.officialChip}>
                <Icon name="user" size={12} color={C.ink2} />
                <Text style={s.officialChipTxt} numberOfLines={1}>{me.official.name}</Text>
                {me.official.is_chief && <Text style={s.chiefTag}>SHUCHIN</Text>}
              </View>
              {(eventDate || me.competition.location) && (
                <Text style={s.headerMeta} numberOfLines={1}>
                  {[eventDate, me.competition.location].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={s.refreshBtn}
            onPress={() => load()}
            accessibilityRole="button"
            accessibilityLabel="Atualizar a fila do koto"
          >
            <Icon name="refresh" size={16} color={C.ink2} />
          </TouchableOpacity>
        </View>

        {/* ── Fila de categorias do koto ── */}
        {categories.length === 0 ? (
          <View style={s.emptyBox}>
            <Icon name="layers" size={18} color={C.ink3} />
            <Text style={s.emptyTitle}>Nenhuma categoria neste koto por enquanto</Text>
            <Text style={s.emptyTxt}>
              A mesa central distribui as categorias entre os kotos — quando chegarem, elas aparecem aqui sozinhas.
            </Text>
          </View>
        ) : (
          <View style={s.catList}>
            {categories.map((cat, idx) => {
              const st: QueueStatus = finalizedIds.has(cat.id) || cat.bracket_status === "done"
                ? "finalizada"
                : cat.bracket_status === "locked" ? "na_mesa" : "aguardando";
              const v = QUEUE_VIEW[st];
              const active = selectedCatId === cat.id;
              const score = isScoreMode(cat);
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCatId(active ? null : cat.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={(state) => [s.catRow, (state as { hovered?: boolean }).hovered && s.catRowHover, active && s.catRowActive]}
                >
                  <Text style={s.catOrder}>{idx + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.catName} numberOfLines={2}>{cat.name}</Text>
                    <Text style={s.catMeta} numberOfLines={1}>
                      {MODALITY_LABEL[cat.modality] || cat.modality}
                      {isKataModality(cat.modality) ? (score ? " · notas" : " · bandeiras") : ""}
                      {cat.group_label ? ` · ${cat.group_label}` : ""}
                      {cat.division_name ? ` · ${cat.division_name}` : ""}
                      {` · ${cat.entry_count} atleta${cat.entry_count === 1 ? "" : "s"}`}
                    </Text>
                  </View>
                  <View style={[s.statusChip, { backgroundColor: v.bg }]}>
                    <Icon name={v.icon} size={12} color={v.color} />
                    <Text style={[s.statusChipTxt, { color: v.color }]}>{v.label}</Text>
                  </View>
                  <Icon name={active ? "chevron-up" : "chevron-down"} size={15} color={C.ink4} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Painel operacional da categoria aberta ── */}
        {selectedCat && (
          isScoreMode(selectedCat) ? (
            <MesaKataPanel
              key={selectedCat.id}
              cat={selectedCat}
              onFinalized={() => markFinalized(selectedCat.id)}
              onCategoryMoved={handleCategoryMoved}
              onLinkInvalid={handleLinkInvalid}
            />
          ) : (
            <MesaKumitePanel
              key={selectedCat.id}
              cat={selectedCat}
              onFinalized={() => markFinalized(selectedCat.id)}
              onCategoryMoved={handleCategoryMoved}
              onLinkInvalid={handleLinkInvalid}
            />
          )
        )}

        {/* Rodapé discreto: de onde vem este acesso */}
        <View style={s.footNote}>
          <Icon name="lock" size={12} color={C.ink4} />
          <Text style={s.footNoteTxt}>
            Acesso da mesa emitido pela federação — escopado ao seu koto atual. Qualquer dúvida, fale com a mesa central.
          </Text>
        </View>
      </ScrollView>
      <ToastContainer />
    </MesaFrame>
  );
}

// ── Moldura da página (papel Shoji + fontes) ────────────────
function MesaFrame({ children }: { children: React.ReactNode }) {
  return <View style={s.screen}>{children}</View>;
}

// ════════════════════════════════════════════════════════════
// Estados de borda — link inválido e aguardando alocação
// ════════════════════════════════════════════════════════════
function InvalidLinkCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={s.edgeWrap}>
      <View style={s.edgeCard}>
        <View style={[s.edgeSeal, { backgroundColor: P.redWash }]}>
          <Icon name="lock" size={26} color={P.red2} />
        </View>
        <Text style={s.edgeTitle}>Link da mesa inválido ou revogado</Text>
        <Text style={s.edgeTxt}>
          Este acesso não está mais ativo. Isso acontece quando a federação emite um novo link para você
          (o anterior deixa de valer) ou revoga o acesso ao encerrar sua participação.
        </Text>
        <View style={s.edgeHintBox}>
          <Icon name="users" size={14} color={C.ink2} />
          <Text style={s.edgeHintTxt}>
            Procure a <Text style={{ fontWeight: "700" }}>mesa central da federação</Text> e peça um novo link da mesa.
          </Text>
        </View>
        {onRetry && (
          <TouchableOpacity style={s.edgeGhostBtn} onPress={onRetry} accessibilityRole="button">
            <Icon name="refresh" size={14} color={C.ink3} />
            <Text style={s.edgeGhostTxt}>Recebi um novo link agora — tentar de novo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function WaitingKotoCard({ me, onRefresh }: { me: MesaMe; onRefresh: () => void }) {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 1200, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, pulse]);

  return (
    <View style={s.edgeWrap}>
      <View style={s.edgeCard}>
        <View style={[s.edgeSeal, { backgroundColor: P.neutralWash }]}>
          <Icon name="users" size={26} color={C.ink2} />
        </View>
        <Text style={s.edgeEyebrow}>{me.competition.name}</Text>
        <Text style={s.edgeTitle}>Olá, {me.official.name.split(" ")[0]} — aguardando seu koto</Text>
        <Text style={s.edgeTxt}>
          Seu acesso está ativo, mas a mesa central ainda não te alocou a um koto.
          Assim que a alocação sair, a fila de categorias aparece aqui sozinha.
        </Text>
        <Animated.View style={[s.waitingBadge, { opacity: pulse }]}>
          <Icon name="refresh" size={13} color={C.ink2} />
          <Text style={s.waitingBadgeTxt}>Verificando a alocação automaticamente…</Text>
        </Animated.View>
        <KarateButton label="Verificar agora" variant="secondary" size="md" onPress={onRefresh} />
      </View>
      <ToastContainer />
    </View>
  );
}

// ── Tratamento comum de erro dos painéis ────────────────────
// Devolve true quando o erro foi de FLUXO (link/koto) e a tela já reagiu.
function usePanelErrorHandler(onCategoryMoved: () => void, onLinkInvalid: () => void) {
  return useCallback((e: any): boolean => {
    if (e?.status === 401) { onLinkInvalid(); return true; }
    if (mesaErrorCode(e) === "CATEGORIA_FORA_DO_KOTO") { onCategoryMoved(); return true; }
    if (mesaErrorCode(e) === "MESARIO_SEM_KOTO") { onCategoryMoved(); return true; }
    return false;
  }, [onCategoryMoved, onLinkInvalid]);
}

// ════════════════════════════════════════════════════════════
// Painel Kumite (e demais modalidades em árvore) — espelho fiel
// do Modo Mesário interno: fase atual + próxima luta + cronômetro
// + fechar resultado.
// ════════════════════════════════════════════════════════════
function MesaKumitePanel({
  cat, onFinalized, onCategoryMoved, onLinkInvalid,
}: {
  cat: MesaCategory;
  onFinalized: () => void;
  onCategoryMoved: () => void;
  onLinkInvalid: () => void;
}) {
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [notGenerated, setNotGenerated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [absentPicker, setAbsentPicker] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [podium, setPodium] = useState<PodiumEntry[] | null>(null);
  const handleFlowError = usePanelErrorHandler(onCategoryMoved, onLinkInvalid);

  const loadBracket = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await karateMesaApi.getBracket(cat.id);
      if (!resp || resp.status === "not_generated") {
        setBracket(null);
        setNotGenerated(true);
      } else {
        setBracket(resp as BracketState);
        setNotGenerated(false);
      }
    } catch (e: any) {
      if (handleFlowError(e)) return;
      setBracket(null);
      setNotGenerated(false);
    } finally {
      setLoading(false);
    }
  }, [cat.id, handleFlowError]);
  useEffect(() => { loadBracket(); }, [loadBracket]);

  const totalRounds = bracket?.rounds.length ?? 0;
  const next = useMemo(() => (bracket ? findNextPendingMatch(bracket) : null), [bracket]);
  const phases: PhaseByRound[] = bracket?.phases_by_round ?? [];
  const hasPlan = phases.some((p) => p && p.format);

  const currentPhase: PhaseByRound | null = next
    ? (next.isThird ? phases[totalRounds - 1] ?? null : phases[next.roundIdx] ?? null)
    : null;

  const upcomingChange = useMemo(() => {
    if (!next || next.isThird || !currentPhase?.format) return null;
    const after = phases[next.roundIdx + 1];
    if (after?.format && after.format !== currentPhase.format) {
      return { round: next.roundIdx + 1, phase: after };
    }
    return null;
  }, [next, currentPhase, phases]);

  const akaAthlete = next ? realAthlete(next.match.aka) : null;
  const shiroAthlete = next ? realAthlete(next.match.shiro) : null;

  const advance = useCallback(async (winnerEntryId: string, decision?: { method: DecisionMethod; note?: string }) => {
    if (!next || !bracket || bracket.status !== "locked") return;
    setAdvancing(true);
    try {
      await karateMesaApi.advanceWinner(cat.id, {
        match_id: next.match.id,
        winner_entry_id: winnerEntryId,
        decision,
      });
      setAbsentPicker(false);
      await loadBracket();
    } catch (e: any) {
      if (handleFlowError(e)) return;
      toast.error(e?.message || "Não foi possível lançar o resultado.");
      await loadBracket();
    } finally {
      setAdvancing(false);
    }
  }, [next, bracket, cat.id, loadBracket, handleFlowError]);

  const handleAbsent = useCallback((absentSide: "aka" | "shiro") => {
    const winner = absentSide === "aka" ? shiroAthlete : akaAthlete;
    if (!winner) return;
    advance(winner.entry_id, { method: "kiken" });
  }, [advance, akaAthlete, shiroAthlete]);

  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const result = await karateMesaApi.finalizeBracket(cat.id);
      setPodium(result.podium);
      onFinalized();
      toast.success("Resultado fechado — categoria enviada à fila de premiação.");
    } catch (e: any) {
      if (handleFlowError(e)) return;
      const code = mesaErrorCode(e);
      if (code === "FINAL_PENDENTE") {
        toast.error("A final ainda não foi decidida — lance o resultado da final antes de fechar.");
      } else if (code === "TERCEIRO_PENDENTE") {
        toast.error("A disputa de 3º lugar ainda não foi decidida — lance esse resultado antes de fechar.");
      } else if (code === "BRACKET_NOT_LOCKED" || e?.status === 409) {
        toast.error("A chave precisa estar travada (oficial) para fechar o resultado — fale com a mesa central.");
      } else {
        toast.error(e?.message || "Não foi possível fechar o resultado.");
      }
      await loadBracket();
    } finally {
      setFinalizing(false);
    }
  }, [cat.id, loadBracket, onFinalized, handleFlowError]);

  if (loading) {
    return (
      <View style={s.panel}>
        <Skeleton width={200} height={18} />
        <Skeleton height={110} radius={R.md} style={{ marginTop: 10 }} />
        <Skeleton height={180} radius={R.md} style={{ marginTop: 10 }} />
      </View>
    );
  }

  // Chave inexistente ou em rascunho — a montagem é ato da federação.
  if (notGenerated || !bracket || bracket.status !== "locked") {
    return (
      <View style={s.panel}>
        <View style={s.noticeBox}>
          <Icon name="lock" size={16} color={C.ink3} />
          <View style={{ flex: 1 }}>
            <Text style={s.noticeTitle}>
              {notGenerated || !bracket ? "Chave ainda não gerada" : "Chave em rascunho (não travada)"}
            </Text>
            <Text style={s.noticeTxt}>
              A mesa opera sobre a chave oficial (travada). A geração e o travamento são feitos pela mesa
              central — assim que a chave for travada, o painel abre aqui sozinho.
            </Text>
          </View>
        </View>
        <KarateButton label="Verificar de novo" variant="secondary" size="md" onPress={loadBracket} />
      </View>
    );
  }

  if (podium) {
    return <PodiumCard catName={cat.name} podium={podium} />;
  }

  return (
    <View style={s.panel}>
      {/* ── Painel da fase atual — o anti-"decorar regulamento" ── */}
      {next && (
        <View style={s.phaseCard}>
          <Text style={s.phaseEyebrow}>
            {next.isThird ? "Disputa de 3º lugar" : roundLabel(next.roundIdx, totalRounds)} · fase atual
          </Text>
          {hasPlan && currentPhase?.format ? (
            <>
              <Text style={s.phaseFormat}>
                {currentPhase.format_label || FORMAT_LABEL[currentPhase.format as MatchFormat] || currentPhase.format}
              </Text>
              <View style={s.phaseMetaRow}>
                {!!currentPhase.decision && (
                  <View style={s.phaseMetaChip}>
                    <Icon name="flag" size={12} color={C.ink2} />
                    <Text style={s.phaseMetaTxt}>
                      Decisão: {DECISION_LABEL[currentPhase.decision as DecisionMethod] || currentPhase.decision}
                    </Text>
                  </View>
                )}
                {!!bracket.phase_plan?.required_kata && (
                  <View style={s.phaseMetaChip}>
                    <Icon name="layers" size={12} color={C.ink2} />
                    <Text style={s.phaseMetaTxt}>Kata: {bracket.phase_plan.required_kata}</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={s.planMissing}>
              <Icon name="info" size={14} color={C.ink3} />
              <Text style={s.planMissingTxt}>
                Formato não configurado para esta categoria — confira o regulamento com o árbitro central.
              </Text>
            </View>
          )}

          {upcomingChange && (
            <View style={s.changeAlert}>
              <Icon name="alert" size={16} color={P.red2} />
              <Text style={s.changeAlertTxt}>
                Atenção — na {roundLabel(upcomingChange.round, totalRounds).toLowerCase()} muda para{" "}
                <Text style={{ fontWeight: "700" }}>
                  {upcomingChange.phase.format_label || FORMAT_LABEL[upcomingChange.phase.format as MatchFormat] || upcomingChange.phase.format}
                </Text>
                . Avise os árbitros antes da fase começar.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Próxima luta ── */}
      {next && akaAthlete && shiroAthlete ? (
        <View style={s.fightCard}>
          <Text style={s.fightEyebrow}>Próxima luta</Text>

          <View style={s.sideBlock}>
            <SideHeader label="AKA" tone="aka" name={akaAthlete.student_name} dojo={akaAthlete.dojo_name} />
            <SideHeader label="SHIRO" tone="shiro" name={shiroAthlete.student_name} dojo={shiroAthlete.dojo_name} />
          </View>

          <View style={s.winnerBtns}>
            <TouchableOpacity
              style={[s.winBtn, s.winBtnAka, advancing && s.btnDisabled]}
              disabled={advancing}
              onPress={() => advance(akaAthlete.entry_id)}
              accessibilityRole="button"
              accessibilityLabel={`Vencedor AKA: ${akaAthlete.student_name || "atleta"}`}
            >
              <Text style={s.winBtnTxtAka}>Vencedor AKA</Text>
              <Text style={s.winBtnSubAka} numberOfLines={1}>{akaAthlete.student_name || "—"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.winBtn, s.winBtnShiro, advancing && s.btnDisabled]}
              disabled={advancing}
              onPress={() => advance(shiroAthlete.entry_id)}
              accessibilityRole="button"
              accessibilityLabel={`Vencedor SHIRO: ${shiroAthlete.student_name || "atleta"}`}
            >
              <Text style={s.winBtnTxtShiro}>Vencedor SHIRO</Text>
              <Text style={s.winBtnSubShiro} numberOfLines={1}>{shiroAthlete.student_name || "—"}</Text>
            </TouchableOpacity>
          </View>

          {!absentPicker ? (
            <TouchableOpacity
              style={[s.absentBtn, advancing && s.btnDisabled]}
              disabled={advancing}
              onPress={() => setAbsentPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Registrar ausência (W.O.)"
            >
              <Icon name="users" size={15} color={C.ink2} />
              <Text style={s.absentBtnTxt}>Ausente (W.O. / Kiken)</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.absentPicker}>
              <Text style={s.absentTitle}>Quem faltou? O atleta presente vence por Kiken.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[s.absentChoice, advancing && s.btnDisabled]}
                  disabled={advancing}
                  onPress={() => handleAbsent("aka")}
                  accessibilityRole="button"
                >
                  <Text style={s.absentChoiceTxt} numberOfLines={1}>Faltou {akaAthlete.student_name || "AKA"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.absentChoice, advancing && s.btnDisabled]}
                  disabled={advancing}
                  onPress={() => handleAbsent("shiro")}
                  accessibilityRole="button"
                >
                  <Text style={s.absentChoiceTxt} numberOfLines={1}>Faltou {shiroAthlete.student_name || "SHIRO"}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setAbsentPicker(false)} accessibilityRole="button">
                <Text style={s.absentCancel}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {advancing && <Text style={s.advancingTxt}>Lançando resultado…</Text>}

          <PhaseTimer
            matchKey={next.match.id}
            durationSec={currentPhase?.duration_sec ?? DEFAULT_DURATION_SEC}
            timeMode={currentPhase?.time_mode ?? null}
          />
        </View>
      ) : next ? (
        <View style={s.noticeBox}>
          <Icon name="clock" size={16} color={C.ink3} />
          <Text style={[s.noticeTxt, { flex: 1 }]}>Aguardando os vencedores das lutas anteriores para montar o próximo confronto.</Text>
        </View>
      ) : (
        <View style={s.finalizeCard}>
          <View style={s.finalizeHead}>
            <Icon name="trophy" size={20} color={P.red2} />
            <Text style={s.finalizeTitle}>Todas as lutas decididas</Text>
          </View>
          <Text style={s.finalizeTxt}>
            Feche o resultado para computar o pódio (1º/2º/3º) e enviar a categoria direto à fila de premiação — sem papel até a mesa central.
          </Text>
          <KarateButton
            label={finalizing ? "Fechando..." : "Fechar resultado"}
            variant="sumi"
            size="lg"
            loading={finalizing}
            disabled={finalizing}
            onPress={handleFinalize}
          />
        </View>
      )}
    </View>
  );
}

function SideHeader({ label, tone, name, dojo }: {
  label: string; tone: "aka" | "shiro"; name: string | null; dojo: string | null;
}) {
  const aka = tone === "aka";
  return (
    <View style={[s.sideHead, aka ? s.sideHeadAka : s.sideHeadShiro]}>
      <Text style={[s.sideTag, aka ? s.sideTagAka : s.sideTagShiro]}>{label}</Text>
      <Text style={s.sideName} numberOfLines={2}>{name || "—"}</Text>
      {!!dojo && <Text style={s.sideDojo} numberOfLines={1}>{dojo}</Text>}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Cronômetro da fase — idêntico ao do Modo Mesário interno:
// start/pause/reset grandes, Atoshi Baraku aos 30s (visual +
// vibração) e alerta no zero.
// ════════════════════════════════════════════════════════════
function PhaseTimer({ matchKey, durationSec, timeMode }: {
  matchKey: string;
  durationSec: number;
  timeMode: "corrido" | "efetivo" | null;
}) {
  const duration = Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : DEFAULT_DURATION_SEC;
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const atoshiFired = useRef(false);
  const zeroFired = useRef(false);
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setRunning(false);
    endAtRef.current = null;
    setRemaining(duration);
    atoshiFired.current = false;
    zeroFired.current = false;
  }, [matchKey, duration]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil(((endAtRef.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) setRunning(false);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [running]);

  const inAtoshi = remaining <= ATOSHI_SEC && remaining > 0;
  const isZero = remaining === 0;
  useEffect(() => {
    if (running && inAtoshi && !atoshiFired.current) {
      atoshiFired.current = true;
      vibrate(200);
    }
    if (isZero && endAtRef.current != null && !zeroFired.current) {
      zeroFired.current = true;
      vibrate([0, 300, 150, 300]);
    }
  }, [running, inAtoshi, isZero]);

  useEffect(() => {
    if (reducedMotion || !(running && inAtoshi)) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 500, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, running, inAtoshi, pulse]);

  const start = () => {
    if (remaining <= 0) return;
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const pauseTimer = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    endAtRef.current = null;
    setRemaining(duration);
    atoshiFired.current = false;
    zeroFired.current = false;
  };

  return (
    <View style={[s.timerBox, inAtoshi && s.timerBoxAtoshi, isZero && endAtRef.current != null && s.timerBoxZero]}>
      <View style={s.timerHeadRow}>
        <Text style={s.timerLabel}>Cronômetro · {fmtClock(duration)} de luta</Text>
        {timeMode === "corrido" && (
          <View style={s.timeModeChip}>
            <Icon name="clock" size={11} color={C.ink2} />
            <Text style={s.timeModeTxt}>Tempo corrido — deixe rodando</Text>
          </View>
        )}
        {timeMode === "efetivo" && (
          <View style={s.timeModeChip}>
            <Icon name="clock" size={11} color={C.ink2} />
            <Text style={s.timeModeTxt}>Tempo efetivo — pause a cada YAME</Text>
          </View>
        )}
      </View>

      <Text style={[s.timerClock, inAtoshi && s.timerClockAtoshi, isZero && endAtRef.current != null && s.timerClockZero]}>
        {fmtClock(remaining)}
      </Text>

      {inAtoshi && (
        <Animated.View style={[s.atoshiBadge, { opacity: pulse }]}>
          <Icon name="alert" size={15} color={P.paperWarm} />
          <Text style={s.atoshiTxt}>ATOSHI BARAKU — avise o árbitro central</Text>
        </Animated.View>
      )}
      {isZero && endAtRef.current != null && (
        <View style={s.zeroBadge}>
          <Icon name="alert" size={15} color={P.paperWarm} />
          <Text style={s.atoshiTxt}>TEMPO ENCERRADO</Text>
        </View>
      )}

      <View style={s.timerBtns}>
        {!running ? (
          <TouchableOpacity style={[s.timerBtn, s.timerBtnStart]} onPress={start} accessibilityRole="button" accessibilityLabel="Iniciar cronômetro">
            <Icon name="play_circle" size={18} color={P.paperWarm} />
            <Text style={s.timerBtnTxtLight}>{remaining < duration && remaining > 0 ? "Retomar" : "Iniciar"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.timerBtn, s.timerBtnPause]} onPress={pauseTimer} accessibilityRole="button" accessibilityLabel="Pausar cronômetro">
            <Icon name="clock" size={18} color={C.ink} />
            <Text style={s.timerBtnTxtDark}>Pausar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.timerBtn, s.timerBtnReset]} onPress={reset} accessibilityRole="button" accessibilityLabel="Zerar cronômetro">
          <Icon name="refresh" size={17} color={C.ink2} />
          <Text style={s.timerBtnTxtDark}>Zerar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Painel Kata por NOTAS — na mesa pública o lançamento acontece
// AQUI (não há tela do torneio para delegar): tocar no atleta abre
// o editor de nota; classificar N para a final; fechar resultado.
// ════════════════════════════════════════════════════════════
function MesaKataPanel({
  cat, onFinalized, onCategoryMoved, onLinkInvalid,
}: {
  cat: MesaCategory;
  onFinalized: () => void;
  onCategoryMoved: () => void;
  onLinkInvalid: () => void;
}) {
  const [scores, setScores] = useState<KataScore[] | null>(null);
  const [bracketLocked, setBracketLocked] = useState<boolean | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null); // `${entry_id}:${phase}`
  const [notaInput, setNotaInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [advanceCount, setAdvanceCount] = useState(8);
  const [advancing, setAdvancing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [podium, setPodium] = useState<PodiumEntry[] | null>(null);
  const handleFlowError = usePanelErrorHandler(onCategoryMoved, onLinkInvalid);

  const loadScores = useCallback(async () => {
    try {
      const [rows, bracketResp] = await Promise.all([
        karateMesaApi.getKataScores(cat.id),
        karateMesaApi.getBracket(cat.id).catch(() => null),
      ]);
      setScores(rows || []);
      setBracketLocked(!!bracketResp && bracketResp.status === "locked");
    } catch (e: any) {
      if (handleFlowError(e)) return;
      setScores([]);
      setBracketLocked(null);
    }
  }, [cat.id, handleFlowError]);
  useEffect(() => { loadScores(); }, [loadScores]);

  const eliminatoria = useMemo(() => (scores || [])
    .filter((r) => r.phase === "eliminatoria")
    .sort((a, b) => (a.presentation_order ?? 999) - (b.presentation_order ?? 999)), [scores]);
  const final = useMemo(() => (scores || [])
    .filter((r) => r.phase === "final")
    .sort((a, b) => (a.presentation_order ?? 999) - (b.presentation_order ?? 999)), [scores]);

  const elimComplete = eliminatoria.length > 0 && eliminatoria.every((r) => r.nota != null);
  const hasFinal = final.length > 0;
  const hasFinalNota = final.some((r) => r.nota != null);

  // Teto do "classificar N": nunca mais que o total da eliminatória.
  useEffect(() => {
    if (eliminatoria.length > 0) {
      setAdvanceCount((n) => Math.max(2, Math.min(n, eliminatoria.length)));
    }
  }, [eliminatoria.length]);

  const openEditor = useCallback((row: KataScore) => {
    const key = `${row.entry_id}:${row.phase}`;
    setEditingKey((prev) => (prev === key ? null : key));
    setNotaInput(row.nota != null ? String(row.nota).replace(".", ",") : "");
  }, []);

  const saveNota = useCallback(async (row: KataScore) => {
    const parsed = Number(notaInput.trim().replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
      toast.error("Nota inválida — use um valor entre 0 e 10 (ex.: 7,5).");
      return;
    }
    setSaving(true);
    try {
      await karateMesaApi.putKataScore(cat.id, { entry_id: row.entry_id, phase: row.phase, nota: parsed });
      setEditingKey(null);
      setNotaInput("");
      await loadScores();
    } catch (e: any) {
      if (handleFlowError(e)) return;
      toast.error(e?.message || "Não foi possível salvar a nota.");
    } finally {
      setSaving(false);
    }
  }, [cat.id, notaInput, loadScores, handleFlowError]);

  const handleAdvance = useCallback(async () => {
    setAdvancing(true);
    try {
      const result = await karateMesaApi.advanceKata(cat.id, { advance_count: advanceCount });
      toast.success(`${result.advanced} atleta${result.advanced === 1 ? "" : "s"} classificado${result.advanced === 1 ? "" : "s"} para a final.`);
      await loadScores();
    } catch (e: any) {
      if (handleFlowError(e)) return;
      toast.error(e?.message || "Não foi possível classificar para a final.");
    } finally {
      setAdvancing(false);
    }
  }, [cat.id, advanceCount, loadScores, handleFlowError]);

  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const result = await karateMesaApi.finalizeBracket(cat.id);
      setPodium(result.podium);
      onFinalized();
      toast.success("Resultado fechado — categoria enviada à fila de premiação.");
    } catch (e: any) {
      if (handleFlowError(e)) return;
      const code = mesaErrorCode(e);
      if (code === "FINAL_PENDENTE") {
        toast.error("Nenhuma nota lançada na fase final ainda — lance as notas da final antes de fechar.");
      } else if (code === "BRACKET_NOT_LOCKED" || e?.status === 409) {
        toast.error("A apuração precisa estar travada (oficial) para fechar o resultado — fale com a mesa central.");
      } else {
        toast.error(e?.message || "Não foi possível fechar o resultado.");
      }
    } finally {
      setFinalizing(false);
    }
  }, [cat.id, onFinalized, handleFlowError]);

  if (podium) return <PodiumCard catName={cat.name} podium={podium} />;

  if (scores === null) {
    return (
      <View style={s.panel}>
        <Skeleton width={200} height={18} />
        <Skeleton height={140} radius={R.md} style={{ marginTop: 10 }} />
      </View>
    );
  }

  if (scores.length === 0) {
    return (
      <View style={s.panel}>
        <View style={s.noticeBox}>
          <Icon name="lock" size={16} color={C.ink3} />
          <View style={{ flex: 1 }}>
            <Text style={s.noticeTitle}>Ordem de apresentação ainda não gerada</Text>
            <Text style={s.noticeTxt}>
              A mesa central gera a ordem (sorteio) e trava a apuração — assim que sair, a bateria abre aqui sozinha.
            </Text>
          </View>
        </View>
        <KarateButton label="Verificar de novo" variant="secondary" size="md" onPress={loadScores} />
      </View>
    );
  }

  const renderPhase = (title: string, rows: KataScore[]) => (
    <View style={s.kataList}>
      <Text style={s.kataListTitle}>{title}</Text>
      {rows.map((r) => {
        const key = `${r.entry_id}:${r.phase}`;
        const editing = editingKey === key;
        return (
          <View key={key}>
            <Pressable
              onPress={() => openEditor(r)}
              accessibilityRole="button"
              accessibilityLabel={`Lançar nota de ${r.student_name}`}
              accessibilityState={{ expanded: editing }}
              style={(state) => [s.kataRow, (state as { hovered?: boolean }).hovered && s.kataRowHover, editing && s.kataRowEditing]}
            >
              <Text style={s.kataOrder}>{r.presentation_order ?? "—"}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.kataName} numberOfLines={1}>{r.student_name}</Text>
                {!!r.dojo_name && <Text style={s.kataDojo} numberOfLines={1}>{r.dojo_name}</Text>}
              </View>
              {r.advances === true && (
                <View style={s.kataAdvChip}>
                  <Icon name="check" size={11} color={P.ok} />
                  <Text style={s.kataAdvTxt}>Classificou</Text>
                </View>
              )}
              {r.advances === false && (
                <View style={s.kataOutChip}>
                  <Text style={s.kataOutTxt}>Eliminada</Text>
                </View>
              )}
              <Text style={s.kataNota}>{r.nota != null ? String(r.nota).replace(".", ",") : "—"}</Text>
              <Icon name="edit" size={14} color={editing ? P.red2 : C.ink4} />
            </Pressable>

            {editing && (
              <View style={s.notaEditor}>
                <Text style={s.notaEditorLabel}>Nota de {r.student_name}</Text>
                <View style={s.notaEditorRow}>
                  <TextInput
                    style={s.notaInput}
                    value={notaInput}
                    onChangeText={setNotaInput}
                    placeholder="7,5"
                    placeholderTextColor={C.ink4}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    autoFocus
                    maxLength={5}
                    onSubmitEditing={() => saveNota(r)}
                    accessibilityLabel={`Nota de ${r.student_name}`}
                  />
                  <TouchableOpacity
                    style={[s.notaSaveBtn, saving && s.btnDisabled]}
                    disabled={saving}
                    onPress={() => saveNota(r)}
                    accessibilityRole="button"
                    accessibilityLabel="Salvar nota"
                  >
                    <Icon name="check" size={16} color={P.paperWarm} />
                    <Text style={s.notaSaveTxt}>{saving ? "Salvando…" : "Salvar nota"}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.notaEditorHint}>Some as notas válidas dos jurados (descartando a maior e a menor) e lance o total aqui.</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={s.panel}>
      {bracketLocked === false && (
        <View style={s.noticeBox}>
          <Icon name="lock" size={15} color={C.ink3} />
          <Text style={[s.noticeTxt, { flex: 1 }]}>
            A apuração ainda não foi travada pela mesa central — dá para conferir a ordem, mas o lançamento pode ser recusado até travar.
          </Text>
        </View>
      )}

      {renderPhase(`Eliminatória · ${eliminatoria.length}`, eliminatoria)}

      {/* Classificação para a final — aparece quando a eliminatória fecha e a final ainda não existe */}
      {elimComplete && !hasFinal && (
        <View style={s.advanceCard}>
          <View style={s.finalizeHead}>
            <Icon name="flag" size={18} color={C.ink} />
            <Text style={s.advanceTitle}>Eliminatória completa</Text>
          </View>
          <Text style={s.finalizeTxt}>Escolha quantos atletas classificam e monte a final.</Text>
          <View style={s.stepperRow}>
            <TouchableOpacity
              style={[s.stepBtn, advanceCount <= 2 && s.btnDisabled]}
              disabled={advanceCount <= 2}
              onPress={() => setAdvanceCount((n) => Math.max(2, n - 1))}
              accessibilityRole="button"
              accessibilityLabel="Diminuir quantidade de classificados"
            >
              <Icon name="minus" size={18} color={C.ink} />
            </TouchableOpacity>
            <View style={s.stepValueBox}>
              <Text style={s.stepValue}>{advanceCount}</Text>
              <Text style={s.stepValueSub}>classificam</Text>
            </View>
            <TouchableOpacity
              style={[s.stepBtn, advanceCount >= eliminatoria.length && s.btnDisabled]}
              disabled={advanceCount >= eliminatoria.length}
              onPress={() => setAdvanceCount((n) => Math.min(eliminatoria.length, n + 1))}
              accessibilityRole="button"
              accessibilityLabel="Aumentar quantidade de classificados"
            >
              <Icon name="plus" size={18} color={C.ink} />
            </TouchableOpacity>
          </View>
          <KarateButton
            label={advancing ? "Classificando..." : `Classificar os ${advanceCount} melhores para a final`}
            variant="sumi"
            size="lg"
            loading={advancing}
            disabled={advancing}
            onPress={handleAdvance}
          />
        </View>
      )}

      {hasFinal && renderPhase(`Final · ${final.length}`, final)}

      {hasFinalNota && (
        <View style={s.finalizeCard}>
          <View style={s.finalizeHead}>
            <Icon name="trophy" size={20} color={P.red2} />
            <Text style={s.finalizeTitle}>Notas da final lançadas</Text>
          </View>
          <Text style={s.finalizeTxt}>
            Feche o resultado para computar o pódio pela nota da final e enviar a categoria à fila de premiação.
          </Text>
          <KarateButton
            label={finalizing ? "Fechando..." : "Fechar resultado"}
            variant="sumi"
            size="lg"
            loading={finalizing}
            disabled={finalizing}
            onPress={handleFinalize}
          />
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Card do pódio (após o finalize) — celebratório, sóbrio.
// ════════════════════════════════════════════════════════════
function PodiumCard({ catName, podium }: { catName: string; podium: PodiumEntry[] }) {
  return (
    <View style={s.podiumCard}>
      <View style={s.podiumSeal}>
        <Icon name="trophy" size={22} color={P.paperWarm} />
      </View>
      <Text style={s.podiumTitle}>Pódio fechado</Text>
      <Text style={s.podiumSub}>{catName}</Text>
      <View style={{ gap: 8, alignSelf: "stretch", marginTop: 12 }}>
        {podium.map((p) => (
          <View key={p.entry_id} style={s.podiumRow}>
            <View style={[s.placeTile, p.placement === 1 && s.placeTileGold]}>
              <Text style={[s.placeTxt, p.placement === 1 && s.placeTxtGold]}>{p.placement}º</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.podiumName} numberOfLines={1}>{p.name || "—"}</Text>
              {!!p.dojo && <Text style={s.podiumDojo} numberOfLines={1}>{p.dojo}</Text>}
            </View>
            {p.points_awarded > 0 && <Text style={s.podiumPts}>{p.points_awarded} pts</Text>}
          </View>
        ))}
      </View>
      <View style={s.podiumMsg}>
        <Icon name="ribbon" size={14} color={P.ok} />
        <Text style={s.podiumMsgTxt}>Categoria enviada à fila de premiação.</Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// Styles — kit Shoji (papel opaco, sumi, vermelhão raro)
// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg } as ViewStyle,
  content: { padding: 16, paddingBottom: 64, width: "100%", maxWidth: 720, alignSelf: "center", gap: 14 } as ViewStyle,

  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 27, fontWeight: "400", color: C.ink, marginTop: 2 } as TextStyle,
  headerMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 } as ViewStyle,
  headerMeta: { fontFamily: F.body, fontSize: 12.5, color: C.ink3 } as TextStyle,
  officialChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: "100%" } as ViewStyle,
  officialChipTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink2, flexShrink: 1 } as TextStyle,
  chiefTag: { fontFamily: F.body, fontSize: 9, fontWeight: "800", letterSpacing: 0.8, color: "#a8730f", backgroundColor: "#f7efdd", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" } as TextStyle,
  refreshBtn: { width: 44, height: 44, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, alignItems: "center", justifyContent: "center" } as ViewStyle,

  emptyBox: { alignItems: "center", gap: 6, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingVertical: 26, paddingHorizontal: 18 } as ViewStyle,
  emptyTitle: { fontFamily: F.heading, fontSize: 15, fontWeight: "600", color: C.ink } as TextStyle,
  emptyTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center", lineHeight: 18, maxWidth: 400 } as TextStyle,

  catList: { gap: 6 } as ViewStyle,
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 12, minHeight: 60 } as ViewStyle,
  catRowHover: { borderColor: C.border2 } as ViewStyle,
  catRowActive: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  catOrder: { fontFamily: F.mono, fontSize: 14, color: C.ink3, width: 24, textAlign: "center" } as TextStyle,
  catName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink, lineHeight: 19 } as TextStyle,
  catMeta: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, marginTop: 2 } as TextStyle,
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 } as ViewStyle,
  statusChipTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700" } as TextStyle,

  panel: { gap: 12 } as ViewStyle,
  noticeBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 13 } as ViewStyle,
  noticeTitle: { fontFamily: F.body, fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,
  noticeTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18, marginTop: 2 } as TextStyle,

  // Estados de borda (link inválido / aguardando koto / erro)
  edgeWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  edgeCard: { width: "100%", maxWidth: 440, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 24, alignItems: "center", gap: 10 } as ViewStyle,
  edgeSeal: { width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 4 } as ViewStyle,
  edgeEyebrow: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.ink3, textAlign: "center" } as TextStyle,
  edgeTitle: { fontFamily: F.heading, fontSize: 21, fontWeight: "500", color: C.ink, textAlign: "center", lineHeight: 28 } as TextStyle,
  edgeTxt: { fontFamily: F.body, fontSize: 13, color: C.ink2, textAlign: "center", lineHeight: 19 } as TextStyle,
  edgeHintBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, alignSelf: "stretch", marginTop: 4 } as ViewStyle,
  edgeHintTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 } as TextStyle,
  edgeGhostBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 8, minHeight: 44 } as ViewStyle,
  edgeGhostTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink3 } as TextStyle,
  waitingBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 4 } as ViewStyle,
  waitingBadgeTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,

  // Painel da fase
  phaseCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 16, gap: 8 } as ViewStyle,
  phaseEyebrow: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  phaseFormat: { fontFamily: F.heading, fontSize: 23, fontWeight: "600", color: C.ink } as TextStyle,
  phaseMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  phaseMetaChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 } as ViewStyle,
  phaseMetaTxt: { fontFamily: F.body, fontSize: 11.5, color: C.ink2 } as TextStyle,
  planMissing: { flexDirection: "row", alignItems: "flex-start", gap: 8 } as ViewStyle,
  planMissingTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 } as TextStyle,
  changeAlert: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, padding: 11, marginTop: 2 } as ViewStyle,
  changeAlertTxt: { flex: 1, fontFamily: F.body, fontSize: 13, color: P.red3, lineHeight: 19 } as TextStyle,

  // Próxima luta
  fightCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 16, gap: 12 } as ViewStyle,
  fightEyebrow: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  sideBlock: { gap: 8 } as ViewStyle,
  sideHead: { borderRadius: R.md, borderWidth: 1, padding: 12, gap: 2 } as ViewStyle,
  sideHeadAka: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  sideHeadShiro: { backgroundColor: P.glassHi, borderColor: C.border2 } as ViewStyle,
  sideTag: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4 } as TextStyle,
  sideTagAka: { color: P.red2 } as TextStyle,
  sideTagShiro: { color: C.ink2 } as TextStyle,
  sideName: { fontFamily: F.heading, fontSize: 18, fontWeight: "600", color: C.ink, lineHeight: 24 } as TextStyle,
  sideDojo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,

  winnerBtns: { flexDirection: "row", gap: 8 } as ViewStyle,
  winBtn: { flex: 1, minHeight: 72, borderRadius: R.md, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 12, gap: 2 } as ViewStyle,
  winBtnAka: { backgroundColor: P.red, borderColor: P.red3 } as ViewStyle,
  winBtnShiro: { backgroundColor: P.glassHi, borderColor: C.ink } as ViewStyle,
  winBtnTxtAka: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: P.paperWarm } as TextStyle,
  winBtnSubAka: { fontFamily: F.body, fontSize: 11, color: "rgba(246,241,231,0.85)" } as TextStyle,
  winBtnTxtShiro: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: C.ink } as TextStyle,
  winBtnSubShiro: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  btnDisabled: { opacity: 0.5 } as ViewStyle,

  absentBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 48, borderRadius: R.md, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi } as ViewStyle,
  absentBtnTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  absentPicker: { gap: 8, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, padding: 12 } as ViewStyle,
  absentTitle: { fontFamily: F.body, fontSize: 12.5, color: C.ink2 } as TextStyle,
  absentChoice: { flex: 1, minHeight: 52, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 } as ViewStyle,
  absentChoiceTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink } as TextStyle,
  absentCancel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink3, textAlign: "center", paddingVertical: 4 } as TextStyle,
  advancingTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3, textAlign: "center" } as TextStyle,

  // Cronômetro
  timerBox: { borderRadius: R.lg, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, padding: 16, gap: 10, alignItems: "center" } as ViewStyle,
  timerBoxAtoshi: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  timerBoxZero: { borderColor: P.red3, backgroundColor: P.redWash } as ViewStyle,
  timerHeadRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch" } as ViewStyle,
  timerLabel: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  timeModeChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 } as ViewStyle,
  timeModeTxt: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  timerClock: { fontFamily: F.mono, fontSize: 64, color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  timerClockAtoshi: { color: P.red2 } as TextStyle,
  timerClockZero: { color: P.red3 } as TextStyle,
  atoshiBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: P.red2, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 } as ViewStyle,
  zeroBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: P.red3, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 } as ViewStyle,
  atoshiTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: P.paperWarm } as TextStyle,
  timerBtns: { flexDirection: "row", gap: 8, alignSelf: "stretch" } as ViewStyle,
  timerBtn: { flex: 1, minHeight: 56, borderRadius: R.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1 } as ViewStyle,
  timerBtnStart: { backgroundColor: C.sumi, borderColor: C.sumi } as ViewStyle,
  timerBtnPause: { backgroundColor: C.surface, borderColor: C.ink } as ViewStyle,
  timerBtnReset: { backgroundColor: C.glassHi, borderColor: C.border2 } as ViewStyle,
  timerBtnTxtLight: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: P.paperWarm } as TextStyle,
  timerBtnTxtDark: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: C.ink } as TextStyle,

  // Fechar resultado
  finalizeCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 16, gap: 10 } as ViewStyle,
  finalizeHead: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  finalizeTitle: { fontFamily: F.heading, fontSize: 19, fontWeight: "600", color: C.ink } as TextStyle,
  finalizeTxt: { fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 19 } as TextStyle,

  // Classificação da eliminatória para a final (kata por notas)
  advanceCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border2, borderRadius: R.lg, padding: 16, gap: 10 } as ViewStyle,
  advanceTitle: { fontFamily: F.heading, fontSize: 18, fontWeight: "600", color: C.ink } as TextStyle,
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 } as ViewStyle,
  stepBtn: { width: 56, height: 56, borderRadius: R.md, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, alignItems: "center", justifyContent: "center" } as ViewStyle,
  stepValueBox: { alignItems: "center", minWidth: 90 } as ViewStyle,
  stepValue: { fontFamily: F.mono, fontSize: 34, color: C.ink } as TextStyle,
  stepValueSub: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: C.ink3 } as TextStyle,

  // Pódio
  podiumCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 20, alignItems: "center", gap: 4 } as ViewStyle,
  podiumSeal: { width: 48, height: 48, borderRadius: 999, backgroundColor: P.red, alignItems: "center", justifyContent: "center", marginBottom: 6 } as ViewStyle,
  podiumTitle: { fontFamily: F.heading, fontSize: 23, fontWeight: "400", color: C.ink } as TextStyle,
  podiumSub: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center" } as TextStyle,
  podiumRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 10 } as ViewStyle,
  placeTile: { width: 38, height: 32, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" } as ViewStyle,
  placeTileGold: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  placeTxt: { fontFamily: F.mono, fontSize: 14, color: C.ink2 } as TextStyle,
  placeTxtGold: { color: P.red2 } as TextStyle,
  podiumName: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  podiumDojo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  podiumPts: { fontFamily: F.mono, fontSize: 12.5, color: C.ink3 } as TextStyle,
  podiumMsg: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: P.okWash, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 } as ViewStyle,
  podiumMsgTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: P.ok } as TextStyle,

  // Kata — bateria operável
  kataList: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, gap: 6 } as ViewStyle,
  kataListTitle: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: C.ink3, marginBottom: 2 } as TextStyle,
  kataRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: R.sm, paddingVertical: 10, paddingHorizontal: 8, minHeight: 52, borderWidth: 1, borderColor: "transparent" } as ViewStyle,
  kataRowHover: { backgroundColor: C.glassHi } as ViewStyle,
  kataRowEditing: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  kataOrder: { fontFamily: F.mono, fontSize: 13, color: C.ink3, width: 24, textAlign: "center" } as TextStyle,
  kataName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  kataDojo: { fontFamily: F.body, fontSize: 11, color: C.ink3 } as TextStyle,
  kataAdvChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: P.okWash, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 } as ViewStyle,
  kataAdvTxt: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: P.ok } as TextStyle,
  kataOutChip: { backgroundColor: P.neutralWash, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 } as ViewStyle,
  kataOutTxt: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: P.neutral } as TextStyle,
  kataNota: { fontFamily: F.mono, fontSize: 15, color: C.ink, minWidth: 44, textAlign: "right" } as TextStyle,

  notaEditor: { backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, borderRadius: R.md, padding: 12, gap: 8, marginTop: 4, marginBottom: 4 } as ViewStyle,
  notaEditorLabel: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink } as TextStyle,
  notaEditorRow: { flexDirection: "row", gap: 8, alignItems: "stretch" } as ViewStyle,
  notaInput: { width: 110, fontFamily: F.mono, fontSize: 24, color: C.ink, textAlign: "center", borderWidth: 1, borderColor: C.border2, borderRadius: R.md, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 10, minHeight: 56 } as TextStyle,
  notaSaveBtn: { flex: 1, minHeight: 56, borderRadius: R.md, backgroundColor: C.sumi, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 } as ViewStyle,
  notaSaveTxt: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: P.paperWarm } as TextStyle,
  notaEditorHint: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, lineHeight: 16 } as TextStyle,

  footNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 4, marginTop: 6 } as ViewStyle,
  footNoteTxt: { flex: 1, fontFamily: F.body, fontSize: 11, color: C.ink4, lineHeight: 16 } as TextStyle,
});
