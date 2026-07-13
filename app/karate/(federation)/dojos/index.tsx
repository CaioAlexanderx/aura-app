// ============================================================
// Dojôs — Lista — Aura Karatê (federação) · Shoji
//
// Fiel ao pane "dojos" do standalone v5. Dados reais via
// GET /federation/{id}/dojos. Estados honestos.
// Tocar numa linha → DETALHE full-page (cadastro, equipe técnica, anuidades).
// "Novo dojô" → MODAL (cadastro rápido).
//
// FILTROS (Fix 8): status e região são INDEPENDENTES e COMBINÁVEIS, ambos
// server-side (a API faz AND entre `status` e `region`). Pontos do bug antigo
// que esta versão corrige:
//   1. Faltava o status "Suspenso" (suspended) na UI → agora presente.
//   2. A lista de regiões era derivada de `dojos` (resultado JÁ filtrado), então
//      só aparecia quando havia ativos e sumia ao filtrar → agora vem de um
//      fetch INDEPENDENTE (catálogo estável), exibido sempre.
//   3. Selecionar região não "gruda" mais o estado: trocar status continua
//      funcionando porque status/região são pedaços de estado ortogonais.
//   4. Botão "Limpar filtros" reseta de forma previsível (sem precisar trocar
//      de aba).
//
// Fix 12 (foco/busca) — histórico: numa versão anterior o campo de busca
//   perdia o foco a cada letra porque o SearchField (e os chips de status/
//   região + "Limpar filtros") viviam dentro do ListHeaderComponent, passado
//   como FUNÇÃO (useCallback com deps voláteis) — cada tecla trocava a
//   IDENTIDADE da função e, como ListHeaderComponent tratado como componente
//   (não elemento) remonta quando o "tipo" muda, o TextInput perdia o foco. O
//   workaround da época tirou a busca inteiramente de dentro da FlatList.
//
// Fix scroll de página inteira (item 11/07/2026) — mesma causa raiz do PR de
//   Praticantes: a causa nunca foi "a busca estar dentro da FlatList", foi "o
//   header ser passado como função de identidade instável". A correção é usar
//   um componente ESTÁVEL (`DojosListHeader`, memoizado, module scope) e
//   passá-lo como ELEMENTO para `ListHeaderComponent` — mesmo tipo em toda
//   renderização, então nunca remonta, só atualiza props, e o foco fica de
//   pé. Isso permite a FlatList ser o ÚNICO scroller da página: título,
//   busca, chips e o thead rolam junto com as linhas, e a lista aproveita a
//   altura inteira da tela (sem "janelinha" interna). Comportamento das
//   listas preservado integralmente (não havia debounce nesta tela — o fetch
//   por mudança de `q` foi mantido como estava).
// ============================================================
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView,
  useWindowDimensions, ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateShadows as SH } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SearchField, Chip, ShojiBadge, Avatar, ShojiButton, Mono, Body, RowPressable,
  RaisedHeader,
} from "@/components/karate/shoji";
import DojoFichaModal from "@/components/karate/DojoFichaModal";
import DojosExportModal from "@/components/karate/DojosExportModal";
import RosterProgressPanel from "@/components/karate/RosterProgressPanel";
import { karateApi, Dojo, DojoStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// 13/07/2026 — "Modelo" (affiliation_model) removido desta coluna: era
// metadado decorativo, distinto de karate_annuity_plan ("Plano de
// anuidade" — o que a campanha usa de verdade, ver
// karateAnnuityService.resolveDojoPlan no backend e DojoFichaModal.tsx).
// Como os dois usavam o mesmo vocabulário (Anual/Semestral/Trimestral), a
// coluna "Modelo" fazia a lista parecer afirmar que TODO dojô já tinha
// plano de anuidade definido — mesmo quando karate_annuity_plan era null e
// a ficha do dojô já dizia "Não definido" (achado de QA: contradição na
// mesma tela). A coluna agora mostra karate_annuity_plan diretamente, com
// o estado honesto "Não definido" — nunca inventa "Anual".
const ANNUITY_PLAN_LABEL: Record<string, string> = { anual: "Anual", semestral: "Semestral", trimestral: "Trimestral" };
function annuityPlanLabel(d: Dojo): string {
  return d.karate_annuity_plan ? (ANNUITY_PLAN_LABEL[d.karate_annuity_plan] ?? d.karate_annuity_plan) : "Não definido";
}

// Todos os status reais (computeDojoStatus). b1: o backend agora manda
// 'inactive' (baseado em is_active) em vez de 'suspended' — a key do filtro
// precisa casar com o valor real que a API envia.
// Status de dojô é só Ativo/Inativo (computeDojoStatus). Inadimplência é
// métrica separada (anuidade), não filtra dojô aqui.
const STATUS_FILTERS: { key: DojoStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativo" },
  { key: "inactive", label: "Inativo" },
];

function Meta({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.metaItem}><Icon name={icon as any} size={12} color={C.ink3} /><Text style={styles.metaTxt}>{text}</Text></View>;
}

// Linha extraída do render (componente estável, module scope) — não remonta
// a cada tecla nem a cada render da tela (antes vivia como função declarada
// dentro do componente da tela, recriada em toda renderização).
function DojoRowItem({ d, wide, onPress }: { d: Dojo; wide: boolean; onPress: () => void }) {
  if (wide) return (
    <RowPressable style={styles.tr} onPress={onPress} accessibilityRole="button">
      <View style={[styles.colDivider, { flex: 2, flexDirection: "row", alignItems: "center", gap: 12 }]}>
        <Avatar name={d.name} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{d.name}</Text>
          <Mono style={{ fontSize: 10, color: P.red }}>{d.fpkt_affiliation_id}</Mono>
        </View>
      </View>
      <View style={[styles.colDivider, { flex: 1.2 }]}><Body muted style={styles.cell}>{d.region || "—"}</Body></View>
      <View style={[styles.colDivider, { width: 128 }]}>
        <Body muted style={styles.cell} numberOfLines={1}>{annuityPlanLabel(d)}</Body>
      </View>
      <View style={[styles.colDivider, { width: 90 }]}><Mono style={[styles.cellNum, { textAlign: "right" }]}>{d.active_practitioner_count ?? d.practitioner_count}</Mono></View>
      <View style={{ width: 130 }}><ShojiBadge dojoStatus={d.status} /></View>
      <Icon name="chevron-forward" size={16} color={C.ink4} style={{ width: 18 }} />
    </RowPressable>
  );
  return (
    <RowPressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.cardTop}>
        <Avatar name={d.name} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{d.name}</Text>
          <Mono style={{ fontSize: 10, color: P.red, marginTop: 1 }}>{d.fpkt_affiliation_id}</Mono>
        </View>
        <ShojiBadge dojoStatus={d.status} />
      </View>
      <View style={styles.cardMeta}>
        <Meta icon="location-outline" text={d.region || "—"} />
        <Meta icon="people-outline" text={`${d.active_practitioner_count ?? d.practitioner_count} praticantes ativos`} />
        <Meta icon="ribbon-outline" text={annuityPlanLabel(d)} />
      </View>
    </RowPressable>
  );
}
const DojoRow = React.memo(DojoRowItem);

// ── Header da FlatList (título + busca + filtros + thead) ────────────
// Componente ESTÁVEL, declarado no module scope: sua IDENTIDADE (tipo) nunca
// muda entre renderizações, só as props mudam — é isso que garante que o
// TextInput da busca não perca foco a cada tecla mesmo com a busca de volta
// dentro do ListHeaderComponent (ver comentário no topo do arquivo).
type DojosListHeaderProps = {
  federationId: string;
  total: number;
  allRegions: string[];
  onExport: () => void;
  onNew: () => void;
  q: string;
  onChangeQ: (t: string) => void;
  onSubmit: () => void;
  status: DojoStatus | "all";
  onStatus: (s: DojoStatus | "all") => void;
  region: string | "all";
  onRegion: (r: string | "all") => void;
  hasFilters: boolean;
  onClear: () => void;
  showThead: boolean;
};

const DojosListHeader = React.memo(function DojosListHeader(p: DojosListHeaderProps) {
  return (
    <View>
      <RaisedHeader style={{ marginBottom: 28 }}>
        <PageHead
          eyebrow={`${p.total} ${p.total === 1 ? "dojô filiado" : "dojôs filiados"} · ${p.allRegions.length || "—"} regiões`}
          title="Dojôs filiados"
          sub="Gestão da rede federativa. Cadastro, anuidades e estado de cada filiado."
          actions={<>
            <ShojiButton label="Exportar" icon="download-outline" variant="ghost" onPress={p.onExport} />
            <ShojiButton label="Novo dojô" icon="add" variant="sumi" onPress={p.onNew} />
          </>}
        />
        <View>
          <SearchField value={p.q} onChangeText={p.onChangeQ} onSubmit={p.onSubmit} placeholder="Buscar por nome, código FPKT ou sensei..." style={{ marginBottom: 14 }} />

          {/* Linha de STATUS (independente) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUS_FILTERS.map((s) => (
              <Chip key={s.key} label={s.label} active={p.status === s.key} onPress={() => p.onStatus(s.key)} />
            ))}
          </ScrollView>

          {/* Linha de REGIÃO (independente) — sempre visível quando há >1 região no
              catálogo, em QUALQUER status. */}
          {p.allRegions.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <View style={styles.regionTag}><Icon name="location-outline" size={12} color={C.ink3} /><Text style={styles.regionTagTxt}>Região</Text></View>
              <Chip label="Todas" active={p.region === "all"} onPress={() => p.onRegion("all")} />
              {p.allRegions.map((r) => <Chip key={r} label={r} active={p.region === r} onPress={() => p.onRegion(r)} />)}
            </ScrollView>
          )}

          {/* Limpar filtros — reset previsível, sem precisar trocar de aba */}
          {p.hasFilters && (
            <TouchableOpacity onPress={p.onClear} style={styles.clearBtn} activeOpacity={0.7} accessibilityLabel="Limpar filtros">
              <Icon name="close-circle-outline" size={14} color={C.ink2} />
              <Text style={styles.clearTxt}>Limpar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      </RaisedHeader>

      {/* Painel da federação (G1 item 8) — andamento do pedido de
          atualização cadastral em todos os dojôs. Self-contained (busca os
          próprios dados por federationId), então plugar aqui não repete o
          bug de foco perdido do header (identidade estável, só props
          mudam). */}
      <RosterProgressPanel federationId={p.federationId} />

      {/* Poço (plano rebaixado): a borda/sombra interna marca o início da
          zona de dados. `pocoCap` só carrega o thead (modo wide); o corpo do
          poço continua por baixo de cada linha (`pocoItem`, mesmo bg/padding)
          e se fecha no `pocoFoot` (ListFooterComponent), lá embaixo. */}
      <View style={[styles.pocoCap, SH.sunken]}>
        {p.showThead && (
          <View style={[styles.tr, styles.thead]}>
            <View style={[styles.colDivider, { flex: 2 }]}><Text style={styles.th}>Dojô</Text></View>
            <View style={[styles.colDivider, { flex: 1.2 }]}><Text style={styles.th}>Região</Text></View>
            <View style={[styles.colDivider, { width: 128 }]}><Text style={styles.th}>Plano de anuidade</Text></View>
            <View style={[styles.colDivider, { width: 90 }]}><Text style={[styles.th, { textAlign: "right" }]}>Ativos</Text></View>
            <View style={{ width: 130 }}><Text style={styles.th}>Status</Text></View>
            <View style={{ width: 18 }} />
          </View>
        )}
      </View>
    </View>
  );
});

export default function DojosScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  // Filtros INDEPENDENTES — dois pedaços de estado ortogonais. Nenhum "gruda"
  // no outro: trocar `status` nunca mexe em `region`, e vice-versa.
  const [status, setStatus] = useState<DojoStatus | "all">("active");
  const [region, setRegion] = useState<string | "all">("all");

  // Catálogo de regiões — fetch INDEPENDENTE dos filtros, para a lista de regiões
  // ser estável em qualquer status (corrige "região só aparece nos ativos").
  const [allRegions, setAllRegions] = useState<string[]>([]);

  // Modal da ficha: usado SÓ para cadastro rápido ("Novo dojô").
  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  // Modal seletor de export (.xlsx) — pré-preenchido com os filtros ativos
  // da tela (status/região) e ajustável antes de confirmar.
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // ⚠️ BUGFIX (13/07/2026) — CONDIÇÃO DE CORRIDA NA BUSCA.
  // `load` disparava a cada tecla, sem debounce e sem cancelamento. Uma resposta
  // LENTA de uma busca antiga chegava DEPOIS da resposta da busca atual e
  // sobrescrevia a lista — e não se autocorrigia. Sintoma real reportado no QA:
  // buscar "BUSHIKAN" devolvia 16 dojôs, nenhum deles BUSHIKAN.
  // Correção: (1) cada requisição carrega um id incremental e só a MAIS RECENTE
  // pode escrever no estado; (2) debounce de 300ms na busca (filtros continuam
  // imediatos, porque clicar num chip não gera rajada de requisições).
  const reqIdRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const myReq = ++reqIdRef.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listDojos(federationId, {
        q: q || undefined,
        status: status === "all" ? undefined : status,
        region: region === "all" ? undefined : region,
        pageSize: 100,
      });
      if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta
      setDojos(res.data); setTotal(res.total ?? res.data.length);
    } catch {
      if (myReq !== reqIdRef.current) return;
      setError(true);
    } finally {
      if (myReq === reqIdRef.current) {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    }
  }, [federationId, q, status, region]);

  useEffect(() => {
    // Sem busca digitada, não faz sentido esperar: carrega já.
    if (!q) { load(); return; }
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load, q]);

  // Catálogo de regiões: busca SEM filtros (só a federação inteira). Roda quando
  // muda a federação e em cada refresh manual, para captar regiões novas. NÃO
  // depende de status/região, então a lista de regiões nunca colapsa.
  const loadRegions = useCallback(async () => {
    try {
      const res = await karateApi.listDojos(federationId, { pageSize: 200 });
      const uniq = Array.from(new Set(res.data.map((d) => d.region).filter(Boolean))) as string[];
      uniq.sort((a, b) => a.localeCompare(b, "pt-BR"));
      setAllRegions(uniq);
    } catch { /* catálogo é auxiliar — falha silenciosa não bloqueia a lista */ }
  }, [federationId]);
  useEffect(() => { loadRegions(); }, [loadRegions]);

  const refreshAll = useCallback(() => { load(true); loadRegions(); }, [load, loadRegions]);

  const hasFilters = status !== "all" || region !== "all" || !!q;
  const clearFilters = useCallback(() => { setStatus("all"); setRegion("all"); setQ(""); }, []);

  // Thead (cabeçalho da tabela) só aparece no modo wide e com itens.
  const showThead = wide && dojos.length > 0;

  // Elemento de header da FlatList — mesmo TIPO (DojosListHeader) em toda
  // renderização; só as props mudam. É isso que preserva o foco do
  // TextInput (ver comentário acima do componente).
  const listHeader = (
    <DojosListHeader
      federationId={federationId}
      total={total}
      allRegions={allRegions}
      onExport={() => setExportModalOpen(true)}
      onNew={() => setModal({ open: true, id: null })}
      q={q}
      onChangeQ={setQ}
      onSubmit={() => load()}
      status={status}
      onStatus={setStatus}
      region={region}
      onRegion={setRegion}
      hasFilters={hasFilters}
      onClear={clearFilters}
      showThead={showThead}
    />
  );

  const renderItem = useCallback(({ item }: { item: Dojo }) => (
    <View style={styles.pocoItem}>
      <DojoRow d={item} wide={wide} onPress={() => router.push(`/karate/dojos/${item.id}` as any)} />
    </View>
  ), [wide, router]);

  const fichaModal = (
    <DojoFichaModal
      federationId={federationId}
      visible={modal.open}
      dojoId={modal.id}
      onClose={() => setModal({ open: false, id: null })}
      onSaved={() => refreshAll()}
    />
  );

  const exportModal = (
    <DojosExportModal
      federationId={federationId}
      visible={exportModalOpen}
      onClose={() => setExportModalOpen(false)}
      initialStatus={status}
      initialRegion={region}
      regions={allRegions}
    />
  );

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} />{fichaModal}{exportModal}</ShojiBackground>;

  // A FlatList é o ÚNICO scroller da página: header (título/busca/filtros) +
  // thead + linhas rolam juntos, e a lista ocupa a altura inteira da área de
  // conteúdo (flex: 1). A FlatList permanece SEMPRE montada (nunca é trocada
  // por um ActivityIndicator solto) — o loading vira só o ListEmptyComponent
  // quando ainda não há itens — assim o header/busca nunca desmontam durante
  // um fetch, preservando o foco também nesse caso.
  return (
    <ShojiBackground>
      <View style={styles.content}>
        <FlatList
          data={dojos}
          keyExtractor={(d) => d.id}
          ListHeaderComponent={listHeader}
          ListFooterComponent={<View style={styles.pocoFoot} />}
          ListEmptyComponent={
            <View style={styles.pocoItem}>
              {loading ? (
                <ActivityIndicator style={{ marginTop: 48, marginBottom: 48 }} size="large" color={P.red} />
              ) : (
                <KarateEmptyState icon="home-outline" title="Nenhum dojô encontrado" subtitle="Ajuste a busca/filtros ou cadastre um novo dojô." style={{ paddingVertical: 40 }} />
              )}
            </View>
          }
          contentContainerStyle={styles.pageScroll}
          style={{ flex: 1, width: "100%" }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={P.red} />}
          renderItem={renderItem}
        />
      </View>
      {fichaModal}
      {exportModal}
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  // `content` só centraliza/limita a largura — o padding da página inteira
  // agora mora em `pageScroll` (contentContainerStyle da FlatList), porque é
  // ELA quem rola. A FlatList recebe `flex: 1` para preencher toda a área de
  // conteúdo do shell (que tem `overflow: hidden` — a FlatList é quem cria a
  // única região com scroll de fato).
  content: { flex: 1, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  pageScroll: { paddingHorizontal: 40, paddingTop: 48, paddingBottom: 72 } as ViewStyle,
  chips: { gap: 8, paddingBottom: 12, alignItems: "center" } as ViewStyle,
  regionTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 4 } as ViewStyle,
  regionTagTxt: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 6 } as ViewStyle,
  clearTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink2 } as TextStyle,

  // Poço (plano rebaixado): `pocoCap` abre o poço logo abaixo do
  // RaisedHeader (borda nítida + sombra interna, SH.sunken) e carrega o
  // thead; `pocoItem` repete o mesmo fundo/padding em CADA linha (thead e
  // linhas alinhados, mesma faixa contínua); `pocoFoot` fecha o poço com
  // cantos arredondados depois da última linha.
  pocoCap: { backgroundColor: P.paper2, borderTopWidth: 1.5, borderTopColor: C.line2, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 4 } as ViewStyle,
  pocoItem: { backgroundColor: P.paper2, paddingHorizontal: 24 } as ViewStyle,
  pocoFoot: { backgroundColor: P.paper2, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl, height: 20 } as ViewStyle,

  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 10 } as ViewStyle,
  // Item 4 (motion pack Shoji): divisão MUITO sutil entre colunas — hairline
  // de baixa opacidade, pensada pra profundidade/ritmo, não pra grade de
  // planilha (metade da opacidade do hairline de linha, C.line).
  colDivider: { borderRightWidth: 1, borderRightColor: "rgba(43,38,32,0.055)", paddingRight: 14 } as ViewStyle,
  th: { fontFamily: F.body, fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  cell: { fontSize: 12.5 } as TextStyle,
  cellNum: { fontSize: 12.5, color: C.ink } as TextStyle,
  name: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  card: { backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 14, gap: 10, marginBottom: 10 } as ViewStyle,
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 14 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
});
