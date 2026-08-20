// ============================================================
// CAMPEONATO PÚBLICO — Aura Karatê (P0 Hub de Campeonatos)
// Rota: /karate/[slug]/campeonato/[cid]  (PÚBLICA, sem login)
//
// O AuthGuard raiz (app/_layout.tsx) tem bypass para
// segments[2]==="campeonato". Consome os endpoints públicos do backend
// (karateCompetitionsPublic.js): cabeçalho + conferência de inscrições +
// índice de chaves + chave por categoria — só o que a federação PUBLICOU
// (antes disso, 404 → mensagem "ainda não publicado").
//
// Substitui os dois PDFs do fluxo real: a planilha de conferência por
// e-mail e as chaves via WhatsApp ("cada associação imprime as suas").
// Sem chrome do app: cabeçalho da federação + conteúdo + rodapé Aura.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, ImageStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { formatEventDateLong } from "@/utils/eventDate";
import {
  karateCompetitionPublicApi, PublicCompetitionHeader, PublicConference,
  PublicBracketIndexCategory, PublicCategoryBracket, PublicBracketMatch,
} from "@/services/karateCompetitionSetupApi";

type Tab = "conferencia" | "chaves";

export default function PublicCompetitionScreen() {
  const { slug, cid } = useLocalSearchParams<{ slug: string; cid: string }>();
  const fedSlug = String(slug || "");
  const compId = String(cid || "");

  const [header, setHeader] = useState<PublicCompetitionHeader | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("conferencia");

  useEffect(() => {
    let alive = true;
    karateCompetitionPublicApi.getHeader(fedSlug, compId)
      .then((res) => {
        if (!alive) return;
        if (!res) { setNotFound(true); return; }
        setHeader(res);
        // Abre na superfície publicada: chaves têm prioridade quando existem.
        if (res.competition.brackets_published) setTab("chaves");
        else setTab("conferencia");
      })
      .catch(() => { if (alive) setNotFound(true); });
    return () => { alive = false; };
  }, [fedSlug, compId]);

  if (notFound) {
    return (
      <View style={s.page}>
        <View style={s.centerBox}>
          <Icon name="trophy" size={36} color={C.ink3} />
          <Text style={s.nfTitle}>Campeonato não encontrado</Text>
          <Text style={s.nfSub}>Confira o link com a sua federação.</Text>
        </View>
      </View>
    );
  }
  if (!header) {
    return <View style={s.page}><ActivityIndicator style={{ marginTop: 60 }} color={C.primary} /></View>;
  }

  const comp = header.competition;
  return (
    <ScrollView style={s.page} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Cabeçalho da federação */}
      <View style={s.fedHead}>
        {header.federation.logo ? (
          <Image source={{ uri: header.federation.logo }} style={s.fedLogo} resizeMode="contain" />
        ) : (
          <Icon name="trophy" size={26} color={C.primary} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.fedName}>{header.federation.name}</Text>
          <Text style={s.compName}>{comp.name}</Text>
          <Text style={s.compMeta}>
            {formatEventDateLong(comp.event_date)}{comp.location ? ` · ${comp.location}` : ""}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {([["conferencia", "Inscrições"], ["chaves", "Chaves"]] as [Tab, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, tab === key && s.tabOn]}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[s.tabTxt, tab === key && s.tabTxtOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 14, gap: 12 }}>
        {tab === "conferencia" ? (
          <ConferenceSection slug={fedSlug} cid={compId} published={comp.conference_published} />
        ) : (
          <BracketsSection slug={fedSlug} cid={compId} published={comp.brackets_published} />
        )}
      </View>

      <Text style={s.footer}>getaura.com.br · Aura Karatê</Text>
    </ScrollView>
  );
}

// ── Conferência de inscrições ───────────────────────────────
function ConferenceSection({ slug, cid, published }: { slug: string; cid: string; published: boolean }) {
  const [data, setData] = useState<PublicConference | null>(null);
  const [loading, setLoading] = useState(published);

  useEffect(() => {
    if (!published) return;
    let alive = true;
    karateCompetitionPublicApi.getConference(slug, cid)
      .then((res) => { if (alive) setData(res); })
      .catch(() => { /* mensagem genérica abaixo */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, cid, published]);

  if (!published) {
    return <PendingBox text="A lista de inscrições ainda não foi publicada pela federação." />;
  }
  if (loading) return <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />;
  if (!data) return <PendingBox text="Não foi possível carregar as inscrições — tente novamente." />;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.noticeBox}>
        <Icon name="alert_circle" size={14} color={C.primary} />
        <Text style={s.noticeTxt}>
          Confira nome, categoria e graduação da sua equipe.
          {data.rectification_deadline
            ? ` Retificações com a federação até ${formatEventDateLong(data.rectification_deadline)}.`
            : " Divergências: fale com a federação."}
        </Text>
      </View>
      <Text style={s.totalLine}>{data.total_entries} inscrições em {data.categories.length} categorias</Text>

      {data.categories.map((cat) => (
        <View key={cat.category_id} style={s.catCard}>
          <View style={s.catHead}>
            <Text style={s.catName}>{cat.category_name}</Text>
            <View style={{ flexDirection: "row", gap: 5 }}>
              {cat.division_name ? <Chip label={cat.division_name} /> : null}
              {cat.group_label ? <Chip label={cat.group_label} /> : null}
            </View>
          </View>
          {cat.entries.map((e, i) => (
            <View key={i} style={s.entryRow}>
              <Text style={s.entryName} numberOfLines={1}>
                {e.is_team ? `Equipe ${e.name}` : e.name}
              </Text>
              <Text style={s.entryDojo} numberOfLines={1}>{e.dojo_name || "—"}</Text>
              <Text style={s.entryBelt} numberOfLines={1}>{e.belt_name || ""}</Text>
            </View>
          ))}
          {cat.entries.filter((e) => e.is_team && e.team_members?.length).map((e, i) => (
            <Text key={`m-${i}`} style={s.teamMembers} numberOfLines={2}>
              {e.name}: {e.team_members!.map((m) => m.name + (m.role === "reserva" ? " (R)" : "")).join(", ")}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Chaves ──────────────────────────────────────────────────
function BracketsSection({ slug, cid, published }: { slug: string; cid: string; published: boolean }) {
  const [index, setIndex] = useState<PublicBracketIndexCategory[] | null>(null);
  const [loading, setLoading] = useState(published);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [bracket, setBracket] = useState<PublicCategoryBracket | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);

  useEffect(() => {
    if (!published) return;
    let alive = true;
    karateCompetitionPublicApi.getBracketsIndex(slug, cid)
      .then((res) => { if (alive) setIndex(res?.categories || []); })
      .catch(() => { if (alive) setIndex([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug, cid, published]);

  const openBracket = useCallback(async (catId: string) => {
    if (openCat === catId) { setOpenCat(null); setBracket(null); return; }
    setOpenCat(catId);
    setBracket(null);
    setBracketLoading(true);
    try {
      const res = await karateCompetitionPublicApi.getCategoryBracket(slug, cid, catId);
      setBracket(res);
    } finally {
      setBracketLoading(false);
    }
  }, [slug, cid, openCat]);

  if (!published) {
    return <PendingBox text="As chaves ainda não foram publicadas pela federação." />;
  }
  if (loading) return <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />;
  if (!index || index.length === 0) {
    return <PendingBox text="Nenhuma categoria com chave disponível." />;
  }

  return (
    <View style={{ gap: 8 }}>
      {index.map((cat) => (
        <View key={cat.category_id} style={s.catCard}>
          <TouchableOpacity style={s.bracketRow} onPress={() => openBracket(cat.category_id)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={s.catName}>{cat.category_name}</Text>
              <Text style={s.bracketMeta}>
                {cat.entry_count} inscritos
                {cat.division_name ? ` · ${cat.division_name}` : ""}{cat.group_label ? ` · ${cat.group_label}` : ""}
              </Text>
            </View>
            <Icon name={openCat === cat.category_id ? "chevron-up" : "chevron-down"} size={16} color={C.ink3} />
          </TouchableOpacity>
          {openCat === cat.category_id && (
            bracketLoading
              ? <ActivityIndicator color={C.primary} style={{ marginVertical: 14 }} />
              : bracket
                ? <PublicBracketView bracket={bracket} />
                : <PendingBox text="Chave ainda não gerada para esta categoria." />
          )}
        </View>
      ))}
    </View>
  );
}

// Chave read-only: rounds em colunas (scroll horizontal) — versão pública
// e leve do BracketView do admin. Kata: tabela de notas por fase.
function PublicBracketView({ bracket }: { bracket: PublicCategoryBracket }) {
  if (bracket.status === "not_generated") {
    return <PendingBox text="Chave ainda não gerada para esta categoria." />;
  }
  if (bracket.kata_scores) {
    const phases: ["eliminatoria" | "final", string][] = [["final", "Final"], ["eliminatoria", "Eliminatória"]];
    return (
      <View style={{ gap: 10, paddingTop: 8 }}>
        {phases.map(([phase, label]) => {
          const rows = bracket.kata_scores!.filter((k) => k.phase === phase);
          if (!rows.length) return null;
          return (
            <View key={phase} style={{ gap: 3 }}>
              <Text style={s.phaseLabel}>{label}</Text>
              {rows.map((k, i) => (
                <View key={i} style={s.kataRow}>
                  <Text style={s.kataOrder}>{k.presentation_order != null ? `${k.presentation_order}º` : ""}</Text>
                  <Text style={s.entryName} numberOfLines={1}>{k.name}</Text>
                  <Text style={s.entryDojo} numberOfLines={1}>{k.dojo_name || ""}</Text>
                  <Text style={s.kataNota}>{k.nota != null ? k.nota.toFixed(1) : "—"}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    );
  }

  const rounds = bracket.rounds || [];
  const roundLabel = (i: number) => {
    const remaining = rounds.length - i;
    if (remaining === 1) return "Final";
    if (remaining === 2) return "Semifinal";
    if (remaining === 3) return "Quartas";
    return `${i + 1}ª rodada`;
  };
  return (
    <View style={{ paddingTop: 8, gap: 8 }}>
      {bracket.champion?.name ? (
        <View style={s.championBox}>
          <Icon name="trophy" size={15} color="#a8730f" />
          <Text style={s.championTxt}>Campeão: {bracket.champion.name}</Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
        {rounds.map((round, i) => (
          <View key={i} style={s.roundCol}>
            <Text style={s.phaseLabel}>{roundLabel(i)}</Text>
            {round.map((m) => <MatchBox key={m.id} match={m} />)}
          </View>
        ))}
        {bracket.third_place_match && (
          <View style={s.roundCol}>
            <Text style={s.phaseLabel}>3º lugar</Text>
            <MatchBox match={bracket.third_place_match} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MatchBox({ match }: { match: PublicBracketMatch }) {
  const side = (v: PublicBracketMatch["aka"], score: number | null, isWinner: boolean) => (
    <View style={[s.matchSide, isWinner && s.matchSideWin]}>
      <Text style={[s.matchName, isWinner && s.matchNameWin]} numberOfLines={1}>
        {v === "bye" ? "— bye —" : v?.name || "a definir"}
      </Text>
      {score != null ? <Text style={s.matchScore}>{score}</Text> : null}
    </View>
  );
  const akaWin = !!match.winner_entry_id && match.aka !== "bye" && match.aka?.entry_id === match.winner_entry_id;
  const shiroWin = !!match.winner_entry_id && match.shiro !== "bye" && match.shiro?.entry_id === match.winner_entry_id;
  return (
    <View style={s.matchBox}>
      {side(match.aka, match.aka_score, akaWin)}
      <View style={s.matchDivider} />
      {side(match.shiro, match.shiro_score, shiroWin)}
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return <View style={s.chip}><Text style={s.chipTxt}>{label}</Text></View>;
}
function PendingBox({ text }: { text: string }) {
  return (
    <View style={s.pendingBox}>
      <Icon name="clock" size={15} color={C.ink3} />
      <Text style={s.pendingTxt}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg } as ViewStyle,
  centerBox: { alignItems: "center", gap: 8, marginTop: 80, paddingHorizontal: 24 } as ViewStyle,
  nfTitle: { fontSize: 18, fontFamily: F.heading, color: C.ink } as TextStyle,
  nfSub: { fontSize: 13, color: C.ink3 } as TextStyle,
  fedHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface } as ViewStyle,
  fedLogo: { width: 44, height: 44, borderRadius: 8 } as ImageStyle,
  fedName: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  compName: { fontSize: 19, fontFamily: F.heading, color: C.ink, marginTop: 1 } as TextStyle,
  compMeta: { fontSize: 12.5, color: C.ink2, marginTop: 2 } as TextStyle,
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface } as ViewStyle,
  tab: { paddingVertical: 9, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent" } as ViewStyle,
  tabOn: { borderBottomColor: C.primary } as ViewStyle,
  tabTxt: { fontSize: 13.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  tabTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  noticeBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: C.primaryLine, borderRadius: R.md, padding: 11 } as ViewStyle,
  noticeTxt: { flex: 1, fontSize: 12.5, color: C.primary2, lineHeight: 18 } as TextStyle,
  totalLine: { fontSize: 12, color: C.ink3 } as TextStyle,
  catCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, gap: 6 } as ViewStyle,
  catHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } as ViewStyle,
  catName: { fontSize: 14, fontWeight: "700", color: C.ink, flexShrink: 1 } as TextStyle,
  chip: { borderRadius: 999, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 8, paddingVertical: 2 } as ViewStyle,
  chipTxt: { fontSize: 10.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  entryRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 } as ViewStyle,
  entryName: { flex: 1.4, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  entryDojo: { flex: 1, fontSize: 12, color: C.ink3 } as TextStyle,
  entryBelt: { width: 84, fontSize: 12, color: C.ink3, textAlign: "right" } as TextStyle,
  teamMembers: { fontSize: 11.5, color: C.ink3, fontStyle: "italic" } as TextStyle,
  bracketRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  bracketMeta: { fontSize: 11.5, color: C.ink3, marginTop: 1 } as TextStyle,
  phaseLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  kataRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  kataOrder: { width: 28, fontSize: 12, color: C.ink3, fontVariant: ["tabular-nums"] } as TextStyle,
  kataNota: { width: 44, fontSize: 13, fontWeight: "800", color: C.ink, textAlign: "right", fontVariant: ["tabular-nums"] } as TextStyle,
  championBox: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#f7efdd", borderWidth: 1, borderColor: "#e8d9b5", borderRadius: R.sm, paddingHorizontal: 11, paddingVertical: 7, alignSelf: "flex-start" } as ViewStyle,
  championTxt: { fontSize: 13, fontWeight: "800", color: "#a8730f" } as TextStyle,
  roundCol: { width: 210, gap: 8 } as ViewStyle,
  matchBox: { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, backgroundColor: C.glassHi, overflow: "hidden" } as ViewStyle,
  matchSide: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingHorizontal: 10, paddingVertical: 7 } as ViewStyle,
  matchSideWin: { backgroundColor: C.primarySoft } as ViewStyle,
  matchName: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  matchNameWin: { fontWeight: "800", color: C.ink } as TextStyle,
  matchScore: { fontSize: 12.5, fontWeight: "800", color: C.primary, fontVariant: ["tabular-nums"] } as TextStyle,
  matchDivider: { height: 1, backgroundColor: C.border } as ViewStyle,
  pendingBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12 } as ViewStyle,
  pendingTxt: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  footer: { textAlign: "center", fontSize: 11, color: C.ink4, marginTop: 22 } as TextStyle,
});
