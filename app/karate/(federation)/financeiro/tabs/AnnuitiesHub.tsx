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
import { ShojiBackground, PageHead, Mono, RaisedHeader, ShojiButton } from "@/components/karate/shoji";
import { Motion, webTransition } from "@/constants/motion";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  karateApi, AnnuitySummaryResponse, AnnuitySummaryBucket, AnnuityStatusFilter,
  AnnuityCampaignPreviewResponse, AnnuityCampaignScope, AnnuityCampaignResult,
} from "@/services/karateApi";
import { AnnuitiesTable } from "./AnnuitiesTable";
import { AnnuityPlansPanel } from "./AnnuityPlansPanel";
import { AnnuityReguaPanel } from "./AnnuityReguaPanel";
import { CampaignWizard } from "@/components/karate/campaign/CampaignWizard";

export type AreaKey = "cobrancas" | "planos" | "regua";
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
type KpiDef = { key: AnnuityStatusFilter; label: string; bucket?: AnnuitySummaryBucket; accent?: "ok" | "danger" | "warn"; icon: string };

function KpiCard({ def, active, onPress, loading }: { def: KpiDef; active: boolean; onPress: () => void; loading: boolean }) {
  // Mockup: só os KPIs acentuados (Atrasado/Em aberto/Recebido) tingem o
  // rótulo (ícone + texto); "Previsto" fica no muted padrão (.kpi .lbl sem
  // style inline no mockup) — nunca o VALOR grande, que é sempre ink.
  const color = def.accent === "ok" ? P.ok : def.accent === "danger" ? P.red : def.accent === "warn" ? P.warn : C.ink3;
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
        Platform.OS === "web" ? (webTransition(["border-color", "box-shadow"], Motion.fast) as any) : null,
        Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
      ]}
      onPress={onPress}
      onHoverIn={Platform.OS === "web" ? () => setHovered(true) : undefined}
      onHoverOut={Platform.OS === "web" ? () => setHovered(false) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Filtrar por ${def.label}`}
      accessibilityState={{ selected: active }}
    >
      {/* Filete vermelho no topo — só no card ATIVO (mockup .kpi.active:before).
          Ativo NUNCA lava o card inteiro de vermelho (isso era desalinhado do
          mockup); só o filete + a borda sinalizam seleção. */}
      {active && <View pointerEvents="none" style={styles.kpiActiveBar} />}
      <View style={styles.kpiLabelRow}>
        <Icon name={def.icon as any} size={13} color={color} />
        <Text style={[styles.kpiLabel, { color }]} numberOfLines={1}>{def.label.toUpperCase()}</Text>
      </View>
      {loading ? (
        <View style={{ marginTop: 12, height: 26, width: "70%", backgroundColor: C.line, borderRadius: 4 }} />
      ) : (
        <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
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
  onNovaCampanha, newMembersCount, newMembersLoading, newMembersDojos, newMembersPracts, onOpenCampaignFromBanner,
}: {
  area: AreaKey; seg: SegKey; year: string;
  summary: AnnuitySummaryResponse | null; summaryLoading: boolean; summaryError: boolean;
  onArea: (a: AreaKey) => void; onSeg: (s: SegKey) => void; onYear: (y: string) => void;
  onRetrySummary: () => void;
  statusFilter: AnnuityStatusFilter; onStatusFilter: (s: AnnuityStatusFilter) => void;
  /** Fase F3 — abre o CampaignWizard (botão "Nova campanha" e banner de
   *  novos filiados sem cobrança compartilham o mesmo wizard). */
  onNovaCampanha: () => void;
  newMembersCount: number;
  newMembersLoading: boolean;
  /** Breakdown dojôs/praticantes do MESMO preview — só pra copy do banner
   *  (mockup mostra "(N dojôs, M faixas-pretas)"). */
  newMembersDojos: number;
  newMembersPracts: number;
  onOpenCampaignFromBanner: () => void;
}) {
  const segment = seg === "dojo" ? summary?.dojo : summary?.praticante;
  // Ordem por urgência (não pela ordem do "funil" financeiro): o gestor
  // de federação quer ver quem deve e quanto está atrasado em segundos —
  // "Previsto" é só o contexto/total e vem por último.
  const kpis: KpiDef[] = [
    { key: "atrasado", label: "Atrasado", bucket: segment?.atrasado, accent: "danger", icon: "warning" },
    { key: "em_aberto", label: "Em aberto", bucket: segment?.em_aberto, accent: "warn", icon: "time" },
    { key: "paid", label: "Recebido", bucket: segment?.recebido, accent: "ok", icon: "checkmark-circle" },
    { key: "all", label: "Previsto", bucket: segment?.previsto, icon: "document-text" },
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {area === "cobrancas" && (
              <ShojiButton label="Nova campanha" icon="send" variant="accent" onPress={onNovaCampanha} />
            )}
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
          </View>
        }
      />

      {/* Navegação de áreas (mockup .areas) — abas de sublinhado serifado,
          SEPARADAS do switch Dojôs/Praticantes (mockup .seg, mais abaixo).
          Fase F4 (11/07/2026) completa a 3ª área do mockup, "Régua de
          e-mail" (AnnuityReguaPanel.tsx) — editor de assunto/mensagem,
          preview ao vivo e offsets, sobre o mesmo endpoint de reminder-config
          que já existia (agora com subject_template/body_template). */}
      <View style={styles.areaTabs}>
        <Pressable
          onPress={() => onArea("cobrancas")}
          style={styles.areaTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: area === "cobrancas" }}
        >
          <Text style={[styles.areaTabLabel, area === "cobrancas" && styles.areaTabLabelOn]}>Cobranças</Text>
          {area === "cobrancas" && <View style={styles.areaTabUnderline} />}
        </Pressable>
        <Pressable
          onPress={() => onArea("planos")}
          style={styles.areaTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: area === "planos" }}
        >
          <Text style={[styles.areaTabLabel, area === "planos" && styles.areaTabLabelOn]}>Valores e planos</Text>
          {area === "planos" && <View style={styles.areaTabUnderline} />}
        </Pressable>
        <Pressable
          onPress={() => onArea("regua")}
          style={styles.areaTab}
          accessibilityRole="tab"
          accessibilityState={{ selected: area === "regua" }}
        >
          <Text style={[styles.areaTabLabel, area === "regua" && styles.areaTabLabelOn]}>Régua de e-mail</Text>
          {area === "regua" && <View style={styles.areaTabUnderline} />}
        </Pressable>
      </View>

      {/* KPIs (mockup: só existem na área Cobranças — "Valores e planos" não
          tem faixa de KPI, só os cards de plano). */}
      {area === "cobrancas" && (
        summaryError ? (
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
        )
      )}

      {/* Banner de novos filiados sem cobrança (mockup .banner) — tom neutro
          e propositivo (nunca alarmista: ausência de cobrança nunca é
          inadimplência). Só aparece na aba Cobranças, e só quando há alguém
          elegível. Copy segue o padrão do mockup: destaca a CONTAGEM (dojôs +
          faixas-pretas) em negrito, não o "alarme". */}
      {area === "cobrancas" && !newMembersLoading && newMembersCount > 0 && (
        <View style={styles.banner}>
          <View style={styles.bannerIco}>
            <Icon name="user-plus" size={16} color={P.red} />
          </View>
          <Text style={styles.bannerTxt}>
            <Text style={styles.bannerBold}>
              {newMembersCount} novo{newMembersCount === 1 ? "" : "s"} filiado{newMembersCount === 1 ? "" : "s"}
            </Text>
            {" "}
            ({newMembersDojos} dojô{newMembersDojos === 1 ? "" : "s"}, {newMembersPracts} faixa{newMembersPracts === 1 ? "" : "s"}-preta) ainda sem cobrança em {year}.
          </Text>
          <ShojiButton label="Revisar e lançar" variant="accent" onPress={onOpenCampaignFromBanner} />
        </View>
      )}

      {/* Switch Dojôs/Praticantes (mockup .seg) — pill de fundo único, SEPARADO
          da navegação de áreas acima (antes vivia junto com os Chips de área
          na mesma linha; o mockup trata como dois controles distintos). */}
      {area === "cobrancas" && (
        <View style={styles.segRow}>
          <Pressable
            onPress={() => onSeg("dojo")}
            style={[styles.segBtn, seg === "dojo" && styles.segBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: seg === "dojo" }}
          >
            <Text style={[styles.segLabel, seg === "dojo" && styles.segLabelOn]}>Dojôs</Text>
          </Pressable>
          <Pressable
            onPress={() => onSeg("cpf")}
            style={[styles.segBtn, seg === "cpf" && styles.segBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: seg === "cpf" }}
          >
            <Text style={[styles.segLabel, seg === "cpf" && styles.segLabelOn]}>Praticantes</Text>
          </Pressable>
        </View>
      )}
    </RaisedHeader>
  );
}

export function AnnuitiesHub({ federationId }: { federationId: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ area?: string | string[]; seg?: string | string[]; year?: string | string[] }>();

  const areaParam = firstParam(params.area);
  const area: AreaKey = areaParam === "planos" ? "planos" : areaParam === "regua" ? "regua" : "cobrancas";
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

  // ── Fase F3 — campanha anual de anuidades ────────────────────────
  // Contagem de elegíveis pra o banner de novos filiados: MESMO preview
  // (scope='both', sem due_date) que o CampaignWizard usa no passo 1 —
  // números pequenos são o esperado (só faixa-preta ATIVA e dojô ATIVO
  // sem cobrança na temporada), nunca somados a partir da listagem paginada.
  const [newMembersPreview, setNewMembersPreview] = useState<AnnuityCampaignPreviewResponse | null>(null);
  const [newMembersLoading, setNewMembersLoading] = useState(true);
  const loadNewMembers = useCallback(async () => {
    setNewMembersLoading(true);
    try {
      const res = await karateApi.previewAnnuityCampaign(federationId, { year, scope: "both" });
      setNewMembersPreview(res);
    } catch {
      // Falha silenciosa aqui: o banner some (sem elegíveis aparentes) em
      // vez de empurrar mais um KarateErrorState pra tela — a tabela e o
      // summary já têm o próprio tratamento de erro.
      setNewMembersPreview(null);
    } finally {
      setNewMembersLoading(false);
    }
  }, [federationId, year]);
  useEffect(() => { loadNewMembers(); }, [loadNewMembers]);
  const newMembersCount = newMembersPreview
    ? newMembersPreview.totals.dojos_count + newMembersPreview.totals.practitioners_count
    : 0;
  const newMembersDojos = newMembersPreview?.totals.dojos_count ?? 0;
  const newMembersPracts = newMembersPreview?.totals.practitioners_count ?? 0;

  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardInitialScope, setWizardInitialScope] = useState<AnnuityCampaignScope | undefined>(undefined);
  // Bump força remount da AnnuitiesTable (recarrega listagem + limpa seleção/
  // busca/expansão) depois que uma campanha cria cobranças novas — mais
  // simples e seguro do que replicar o load() interno dela aqui fora.
  const [tableReloadToken, setTableReloadToken] = useState(0);

  const openCampaignWizard = useCallback((scope?: AnnuityCampaignScope) => {
    setWizardInitialScope(scope);
    setWizardVisible(true);
  }, []);
  const handleCampaignSuccess = useCallback((_result: AnnuityCampaignResult) => {
    loadSummary();
    loadNewMembers();
    setTableReloadToken((t) => t + 1);
  }, [loadSummary, loadNewMembers]);

  // Header compartilhado (season + KPIs + chips), memoizado por props —
  // passado como ELEMENTO para a FlatList da tabela (nunca como função).
  const header = useMemo(() => (
    <AnnuitiesSeasonHeader
      area={area} seg={seg} year={year}
      summary={summary} summaryLoading={summaryLoading} summaryError={summaryError}
      onArea={setArea} onSeg={setSeg} onYear={setYear} onRetrySummary={loadSummary}
      statusFilter={statusFilter} onStatusFilter={setStatusFilter}
      onNovaCampanha={() => openCampaignWizard(undefined)}
      newMembersCount={newMembersCount}
      newMembersLoading={newMembersLoading}
      newMembersDojos={newMembersDojos}
      newMembersPracts={newMembersPracts}
      onOpenCampaignFromBanner={() => openCampaignWizard("both")}
    />
  ), [
    area, seg, year, summary, summaryLoading, summaryError, setArea, setSeg, setYear, loadSummary, statusFilter,
    newMembersCount, newMembersLoading, newMembersDojos, newMembersPracts, openCampaignWizard,
  ]);

  const wizard = (
    <CampaignWizard
      visible={wizardVisible}
      federationId={federationId}
      year={year}
      initialScope={wizardInitialScope}
      onClose={() => setWizardVisible(false)}
      onSuccess={handleCampaignSuccess}
      onOpenPlans={() => setArea("planos")}
    />
  );

  if (area === "planos") {
    return (
      <ShojiBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {header}
          <AnnuityPlansPanel federationId={federationId} />
        </ScrollView>
        {wizard}
      </ShojiBackground>
    );
  }

  if (area === "regua") {
    return (
      <ShojiBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {header}
          <AnnuityReguaPanel federationId={federationId} />
        </ScrollView>
        {wizard}
      </ShojiBackground>
    );
  }

  return (
    <ShojiBackground>
      <AnnuitiesTable
        key={tableReloadToken}
        federationId={federationId}
        seg={seg}
        year={year}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onMutated={loadSummary}
        headerElement={header}
      />
      {wizard}
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
  // Mockup (.kpi): card SEMPRE var(--card)/branco — nem em hover nem ativo
  // ganha lavagem de cor de fundo; só a BORDA muda (faint no hover, red no
  // ativo) + um filete vermelho no topo quando ativo (kpiActiveBar).
  kpiCard: { position: "relative", flexGrow: 1, flexBasis: 160, minWidth: 150, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, paddingVertical: 16, paddingHorizontal: 16, overflow: "hidden" } as ViewStyle,
  kpiCardActive: { borderColor: P.red } as ViewStyle,
  kpiActiveBar: { position: "absolute", left: 0, right: 0, top: 0, height: 2, backgroundColor: P.red } as ViewStyle,
  // Mesmo tratamento de hover do Chip (kit Shoji) — sinaliza que o card É
  // clicável (filtra a lista pelo status correspondente); só a borda muda.
  kpiCardHover: Platform.OS === "web"
    ? ({ borderColor: C.ink4, boxShadow: "0 3px 8px rgba(43,38,32,0.09)" } as any)
    : ({ borderColor: C.ink4 } as ViewStyle),
  kpiLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 } as ViewStyle,
  kpiLabel: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink3, letterSpacing: 1 } as TextStyle,
  // Valor grande NUNCA muda de cor por status (mockup: só o rótulo/ícone
  // tingem) — sempre ink, mesmo no card ativo/acentuado.
  kpiValue: { fontFamily: F.heading, fontSize: 24, fontWeight: "400", color: C.ink, marginTop: 10 } as TextStyle,
  kpiMeta: { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 6 } as TextStyle,

  // Navegação de áreas (mockup .areas/.area/.area.on) — abas de texto serifado
  // sublinhadas, SEM fundo de pill (diferente do Chip usado no resto do app).
  areaTabs: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 26, marginTop: 20, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  areaTab: { paddingTop: 6, paddingBottom: 12, position: "relative" } as ViewStyle,
  areaTabLabel: { fontFamily: F.heading, fontSize: 15.5, color: C.ink3 } as TextStyle,
  areaTabLabelOn: { color: C.ink } as TextStyle,
  areaTabUnderline: { position: "absolute", left: 0, right: 0, bottom: -1, height: 2, backgroundColor: P.red } as ViewStyle,

  // Banner de novos filiados (mockup .banner) — faixa red-soft com ícone,
  // texto e um botão de ação explícito.
  banner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.redWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, paddingVertical: 12, paddingHorizontal: 16, marginTop: 18, flexWrap: "wrap" } as ViewStyle,
  bannerIco: { width: 28, height: 28, borderRadius: R.pill, alignItems: "center", justifyContent: "center", backgroundColor: P.glassHi, flexShrink: 0 } as ViewStyle,
  bannerTxt: { flex: 1, minWidth: 200, fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 } as TextStyle,
  bannerBold: { fontWeight: "700", color: P.red2 } as TextStyle,

  // Switch Dojôs/Praticantes (mockup .seg) — pill de fundo único com dois
  // botões; o ativo ganha um "chip" branco por cima (mesma lógica do CSS
  // `.seg button.on{background:var(--card)}`).
  segRow: { flexDirection: "row", alignSelf: "flex-start", backgroundColor: P.paper2, borderRadius: R.md, padding: 3, marginTop: 18, gap: 2 } as ViewStyle,
  segBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: R.sm } as ViewStyle,
  segBtnOn: { backgroundColor: P.glass, ...(Platform.OS === "web" ? ({ boxShadow: "0 1px 3px rgba(43,38,32,0.10)" } as any) : {}) } as ViewStyle,
  segLabel: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  segLabelOn: { color: C.ink } as TextStyle,
});
