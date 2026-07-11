// ============================================================
// AnnuitiesHub — Hub de Anuidades (Fase F2) · Shoji
//
// Substitui as antigas DojoAnnuitiesTab/CpfAnnuitiesTab (listas .map() num
// ScrollView) por um hub único, com:
//   1. Cabeçalho de temporada (seletor de ano) — dirige `year` de TODAS as
//      chamadas (summary + listagens).
//   2. 4 KPIs (Previsto/Recebido/Em aberto/Atrasado) vindos EXCLUSIVAMENTE
//      de GET /financial/annuities/summary — nunca somados no cliente.
//      Clicar num KPI filtra a lista pelo status correspondente.
//   3. Tabela (Dojôs | Praticantes) — FlatList virtualizada com paginação
//      real (AnnuitiesTable.tsx).
//   4. Área "Valores e planos" (AnnuityPlansPanel.tsx).
//
// Deep-link por query param na PRÓPRIA rota /karate/financeiro (o grupo
// (federation) já existe — nenhuma rota nova foi criada):
//   ?area=cobrancas|planos&seg=dojo|cpf&year=YYYY
// `index.tsx` decide montar este hub (em vez de Visão Geral) quando esses
// params estão presentes — ver bootstrapping lá.
//
// Este componente é só o "resolvedor de params + fonte do summary": a
// FlatList em si (e seu próprio header memoizado, único scroller da
// página) mora em AnnuitiesTable.tsx — mesmo padrão de Praticantes/Dojôs
// (fix de scroll de página inteira, 11/07/2026). AnnuitiesSeasonHeader
// (season header + KPIs + chips) é compartilhado pelos dois "sub-scrollers"
// (cobrancas via FlatList, planos via ScrollView simples).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP,
} from "@/constants/karateTheme";
import { ShojiBackground, PageHead, Chip, Mono, RaisedHeader } from "@/components/karate/shoji";
import { Motion, webTransition } from "@/constants/motion";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { karateApi, AnnuitySummaryResponse, AnnuitySummaryBucket, AnnuityStatusFilter } from "@/services/karateApi";
import { AnnuitiesTable } from "./AnnuitiesTable";
import { AnnuityPlansPanel } from "./AnnuityPlansPanel";

export type AreaKey = "cobrancas" | "planos";
export type SegKey = "dojo" | "cpf";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = 2023;
const YEAR_MAX = CURRENT_YEAR + 1;

const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── KPI card (clicável — aplica o filtro de status correspondente) ─────
type KpiDef = { key: AnnuityStatusFilter; label: string; bucket?: AnnuitySummaryBucket; accent?: "ok" | "danger" | "warn" };

function KpiCard({ def, active, onPress, loading }: { def: KpiDef; active: boolean; onPress: () => void; loading: boolean }) {
  const color = def.accent === "ok" ? P.ok : def.accent === "danger" ? P.red : def.accent === "warn" ? P.warn : C.ink;
  // Hover-web (leve elevação/tint, mesmo padrão de Chip no kit Shoji) — o
  // card É clicável (filtra a lista pelo status), então precisa PARECER
  // clicável (cursor + realce), não só reagir ao clique.
  const [hovered, setHovered] = useState(false);
  return (
    // Pressable (não TouchableOpacity) — mesmo componente-base do Chip/
    // RowPressable no kit Shoji, porque onHoverIn/onHoverOut só têm efeito
    // garantido no web sobre Pressable (TouchableOpacity não expõe esses
    // props de forma confiável).
    <Pressable
      style={({ pressed }) => [
        styles.kpiCard,
        active && styles.kpiCardActive,
        !active && hovered && styles.kpiCardHover,
        pressed && { opacity: 0.82 },
        Platform.OS === "web" ? (webTransition(["background-color", "border-color", "box-shadow"], Motion.fast) as any) : null,
        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
      ]}
      onPress={onPress}
      onHoverIn={Platform.OS === "web" ? () => setHovered(true) : undefined}
      onHoverOut={Platform.OS === "web" ? () => setHovered(false) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Filtrar por ${def.label}`}
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.kpiLabel} numberOfLines={1}>{def.label.toUpperCase()}</Text>
      {loading ? (
        <View style={{ marginTop: 12, height: 26, width: "70%", backgroundColor: C.line, borderRadius: 4 }} />
      ) : (
        <Text style={[styles.kpiValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmtMoney(def.bucket?.valor ?? 0)}
        </Text>
      )}
      <Text style={styles.kpiMeta}>
        {def.bucket?.count ?? 0} {def.bucket?.count === 1 ? "cobrança" : "cobranças"}
      </Text>
    </Pressable>
  );
}

// ── Season header — compartilhado entre a tabela (dentro do
//    ListHeaderComponent da FlatList) e a área de planos (dentro de um
//    ScrollView simples). Componente ESTÁVEL (module scope) — quando usado
//    como ELEMENTO (não função) num ListHeaderComponent, não remonta a
//    cada render (mesma regra de Praticantes/Dojôs).
export function AnnuitiesSeasonHeader({
  area, seg, year, summary, summaryLoading, summaryError, onArea, onSeg, onYear, onRetrySummary,
  statusFilter, onStatusFilter,
}: {
  area: AreaKey; seg: SegKey; year: string;
  summary: AnnuitySummaryResponse | null; summaryLoading: boolean; summaryError: boolean;
  onArea: (a: AreaKey) => void; onSeg: (s: SegKey) => void; onYear: (y: string) => void;
  onRetrySummary: () => void;
  statusFilter: AnnuityStatusFilter; onStatusFilter: (s: AnnuityStatusFilter) => void;
}) {
  const segment = seg === "dojo" ? summary?.dojo : summary?.praticante;
  // Ordem por urgência (não pela ordem do "funil" financeiro): o gestor
  // de federação quer ver quem deve e quanto está atrasado em segundos —
  // "Previsto" é só o contexto/total e vem por último.
  const kpis: KpiDef[] = [
    { key: "atrasado", label: "Atrasado", bucket: segment?.atrasado, accent: "danger" },
    { key: "em_aberto", label: "Em aberto", bucket: segment?.em_aberto, accent: "warn" },
    { key: "paid", label: "Recebido", bucket: segment?.recebido, accent: "ok" },
    { key: "all", label: "Previsto", bucket: segment?.previsto },
  ];

  const canPrevYear = parseInt(year, 10) > YEAR_MIN;
  const canNextYear = parseInt(year, 10) < YEAR_MAX;

  return (
    // RaisedHeader (kit Shoji) — mesmo componente COMPARTILHADO de
    // Praticantes/Dojôs (antes esta tela reimplementava o estilo
    // "raisedHeader" localmente, com padding/margin levemente diferentes
    // do canônico; usar o componente do kit elimina esse drift).
    <RaisedHeader style={{ marginBottom: 28 }}>
      <PageHead
        eyebrow="Financeiro · Aura Karatê"
        title="Anuidades"
        sub="Cobranças de dojô e de praticante faixa-preta da temporada — os mesmos valores do fechamento financeiro, sempre atualizados."
        actions={
          <View style={styles.yearSwitcher} accessibilityRole="adjustable" accessibilityLabel={`Temporada ${year}`}>
            <TouchableOpacity
              onPress={() => canPrevYear && onYear(String(parseInt(year, 10) - 1))}
              disabled={!canPrevYear}
              style={[styles.yearBtn, !canPrevYear && styles.yearBtnOff]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Temporada anterior"
            >
              <Icon name="chevron-back" size={14} color={C.ink} />
            </TouchableOpacity>
            <Mono style={styles.yearLabel}>{year}</Mono>
            <TouchableOpacity
              onPress={() => canNextYear && onYear(String(parseInt(year, 10) + 1))}
              disabled={!canNextYear}
              style={[styles.yearBtn, !canNextYear && styles.yearBtnOff]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Próxima temporada"
            >
              <Icon name="chevron-forward" size={14} color={C.ink} />
            </TouchableOpacity>
          </View>
        }
      />

      {summaryError ? (
        <View style={{ marginTop: 8 }}>
          <KarateErrorState
            title="Não foi possível carregar os KPIs"
            message="A tabela abaixo pode continuar sendo consultada normalmente."
            onRetry={onRetrySummary}
            style={{ paddingVertical: 20 }}
          />
        </View>
      ) : (
        <View style={styles.kpiRow}>
          {kpis.map((k) => (
            <KpiCard
              key={k.key}
              def={k}
              loading={summaryLoading}
              active={statusFilter === k.key}
              onPress={() => onStatusFilter(k.key)}
            />
          ))}
        </View>
      )}

      <View style={styles.areaTabs}>
        <Chip label="Cobranças" active={area === "cobrancas"} onPress={() => onArea("cobrancas")} />
        <Chip label="Valores e planos" active={area === "planos"} onPress={() => onArea("planos")} />
        {area === "cobrancas" && (
          <>
            <View style={styles.chipDivider} />
            <Chip label="Dojôs" active={seg === "dojo"} onPress={() => onSeg("dojo")} />
            <Chip label="Praticantes" active={seg === "cpf"} onPress={() => onSeg("cpf")} />
          </>
        )}
      </View>
    </RaisedHeader>
  );
}

export function AnnuitiesHub({ federationId }: { federationId: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ area?: string | string[]; seg?: string | string[]; year?: string | string[] }>();

  const area: AreaKey = firstParam(params.area) === "planos" ? "planos" : "cobrancas";
  const seg: SegKey = firstParam(params.seg) === "cpf" ? "cpf" : "dojo";
  const yearParam = firstParam(params.year);
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : String(CURRENT_YEAR);

  const setArea = useCallback((a: AreaKey) => router.setParams({ area: a } as any), [router]);
  const setSeg = useCallback((s: SegKey) => router.setParams({ seg: s } as any), [router]);
  const setYear = useCallback((y: string) => router.setParams({ year: y } as any), [router]);

  // Filtro de status aplicado à listagem — dirigido pelo clique num KPI.
  // Reseta ao trocar ano/segmento/área (evita filtro "preso" ao mudar de contexto).
  const [statusFilter, setStatusFilter] = useState<AnnuityStatusFilter>("all");
  useEffect(() => { setStatusFilter("all"); }, [year, seg]);

  const [summary, setSummary] = useState<AnnuitySummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const res = await karateApi.getAnnuitySummary(federationId, { year });
      setSummary(res);
    } catch {
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }, [federationId, year]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Header compartilhado (season + KPIs + chips), memoizado por props —
  // passado como ELEMENTO para a FlatList da tabela (nunca como função).
  const header = useMemo(() => (
    <AnnuitiesSeasonHeader
      area={area} seg={seg} year={year}
      summary={summary} summaryLoading={summaryLoading} summaryError={summaryError}
      onArea={setArea} onSeg={setSeg} onYear={setYear} onRetrySummary={loadSummary}
      statusFilter={statusFilter} onStatusFilter={setStatusFilter}
    />
  ), [area, seg, year, summary, summaryLoading, summaryError, setArea, setSeg, setYear, loadSummary, statusFilter]);

  if (area === "planos") {
    return (
      <ShojiBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {header}
          <AnnuityPlansPanel federationId={federationId} />
        </ScrollView>
      </ShojiBackground>
    );
  }

  return (
    <ShojiBackground>
      <AnnuitiesTable
        federationId={federationId}
        seg={seg}
        year={year}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onMutated={loadSummary}
        headerElement={header}
      />
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  // Padding horizontal fica no container pai (FlatList da tabela OU este
  // ScrollView, na área de planos) — o header em si é edge-to-edge dentro
  // dessa faixa, mesmo padrão de RaisedHeader (kit Shoji) / Praticantes-Dojôs.
  scrollContent: { paddingHorizontal: 40, paddingTop: 48, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center", gap: 24 } as ViewStyle,

  yearSwitcher: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.line2, borderRadius: R.pill, paddingHorizontal: 6, paddingVertical: 6 } as ViewStyle,
  yearBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: R.pill } as ViewStyle,
  yearBtnOff: { opacity: 0.3 } as ViewStyle,
  yearLabel: { fontSize: 14, fontWeight: "700", color: C.ink, minWidth: 44, textAlign: "center" } as TextStyle,

  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 } as ViewStyle,
  kpiCard: { flexGrow: 1, flexBasis: 160, minWidth: 150, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, paddingVertical: 16, paddingHorizontal: 16 } as ViewStyle,
  kpiCardActive: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  // Mesmo tratamento de hover do Chip (kit Shoji) — sinaliza que o card É
  // clicável (filtra a lista pelo status correspondente).
  kpiCardHover: Platform.OS === "web"
    ? ({ backgroundColor: P.glassHi, borderColor: C.line2, boxShadow: "0 3px 8px rgba(43,38,32,0.09)" } as any)
    : ({ backgroundColor: P.glassHi } as ViewStyle),
  kpiLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink3, letterSpacing: 1 } as TextStyle,
  kpiValue: { fontFamily: F.heading, fontSize: 24, fontWeight: "400", marginTop: 10 } as TextStyle,
  kpiMeta: { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 6 } as TextStyle,

  areaTabs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 20 } as ViewStyle,
  chipDivider: { width: 1, height: 20, backgroundColor: C.line2, marginHorizontal: 4 } as ViewStyle,
});
