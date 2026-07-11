// ============================================================
// Praticantes — Lista — Aura Karatê (federação) · Shoji
// Fiel ao pane "alunos" do standalone v5. Dados reais.
// Tocar numa linha → DETALHE full-page (trajetória, carteirinha, transferências).
// "Novo praticante" → MODAL (cadastro rápido).
//
// IA/Nav P1: a tela lê os params de rota `q` e `dojo_id` (via
//   useLocalSearchParams) e já carrega pré-filtrada:
//     • `q`       — pré-popula o campo de busca (vem da busca global do shell).
//     • `dojo_id` — filtra pelos praticantes do dojô (vem do CTA "Ver
//                   praticantes" no detalhe do dojô). A API já aceita dojo_id.
//
// Fix 6/8 (foco/busca) — histórico: numa versão anterior o campo de busca
//   perdia o foco a cada letra porque o SearchField (e os chips) viviam
//   dentro do ListHeaderComponent, passado como FUNÇÃO (useCallback com deps
//   voláteis q/status/role/…) — cada tecla trocava a IDENTIDADE da função, e
//   como ListHeaderComponent é tratado como um COMPONENTE (não um elemento),
//   trocar de identidade = trocar de tipo = remount do TextInput → foco
//   perdido. O workaround da época foi tirar a busca inteiramente de dentro
//   da FlatList (bloco persistente fora dela) — só que isso criava uma janela
//   de scroll pequena, com o header sempre fixo ocupando espaço.
//
// Fix scroll de página inteira (item 11/07/2026): a causa raiz nunca foi
//   "a busca estar dentro da FlatList", foi "o header ser passado como
//   FUNÇÃO com identidade instável". A correção definitiva é usar um
//   componente ESTÁVEL (`PractitionersListHeader`, memoizado, declarado no
//   module scope) e passá-lo como ELEMENTO (`<PractitionersListHeader .../>`)
//   para `ListHeaderComponent`. Um elemento de mesmo TIPO em toda renderização
//   nunca remonta — só atualiza props — então o TextInput mantém o foco
//   mesmo com o header de volta dentro da FlatList. Isso permite a FlatList
//   ser o ÚNICO scroller da página: título, busca, chips e o cabeçalho da
//   tabela (thead) rolam junto com as linhas, e a lista aproveita a altura
//   inteira da tela (sem "janelinha" interna).
//
// Fix 7 (filtros de papel): chips Instrutor/Examinador/Árbitro filtram
//   server-side via ?role=instructor|examiner|arbiter (o backend GET já aceita
//   `role` e mapeia para is_instructor/is_examiner/is_arbiter). Como a API
//   aceita UM papel por vez, os chips de papel são single-select e coexistem
//   com o filtro de status e o pré-filtro dojo_id.
//
// Fix 11/07/2026 (bug de produção — export ignorava filtros): "Exportar"
//   chamava karateApi.exportAllPractitioners(federationId) SEM filtro nenhum,
//   então baixava a federação inteira mesmo com a tela filtrada por dojô (CTA
//   "Ver praticantes" do detalhe do dojô, ?dojo_id=X) — confuso e pesado
//   (~9.600 praticantes). Agora o export manda os MESMOS filtros ativos na
//   tela (dojo_id do pré-filtro de rota, status e busca `q`), então baixa
//   exatamente o que está listado. Quando filtrado por dojô, o botão e o
//   nome do arquivo deixam isso explícito.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView,
  useWindowDimensions, ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
  Platform, Alert,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useRouter, useLocalSearchParams } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP, KarateShadows as SH } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SearchField, Chip, ShojiBadge, BeltTag, Avatar, ShojiButton, Mono, Body, RowPressable,
  RaisedHeader,
} from "@/components/karate/shoji";
import PraticanteFichaModal from "@/components/karate/PraticanteFichaModal";
import { karateApi, PractitionerListItem } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// Ativo/Inativo = afiliação (is_active). 'Sem faixa' é outra dimensão
// (praticante ainda sem graduação), não um status — por isso rótulo próprio.
type PractitionerStatusFilter = "all" | "active" | "inactive" | "pending";
const STATUS_FILTERS: { key: PractitionerStatusFilter; label: string }[] = [
  { key: "all", label: "Todos" }, { key: "active", label: "Ativo" }, { key: "inactive", label: "Inativo" }, { key: "pending", label: "Sem faixa" },
];

// Fix 7 — filtros de papel. Os `key` casam com o contrato do backend
// (?role=instructor|examiner|arbiter → is_instructor/is_examiner/is_arbiter).
type RoleFilter = "instructor" | "examiner" | "arbiter";
const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "instructor", label: "Instrutor" },
  { key: "examiner", label: "Examinador" },
  { key: "arbiter", label: "Árbitro" },
];

// Params de rota podem chegar como string | string[]; normaliza para string.
const firstParam = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const DEBOUNCE_MS = 350;

// Linha extraída do render (componente estável) — não remonta a cada tecla.
function PractitionerRow({ item, wide, onPress }: { item: PractitionerListItem; wide: boolean; onPress: () => void }) {
  if (wide) return (
    <RowPressable style={styles.tr} onPress={onPress} accessibilityRole="button">
      <View style={[styles.colDivider, { flex: 2, flexDirection: "row", alignItems: "center", gap: 12 }]}>
        <Avatar name={item.full_name} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
          <Mono style={{ fontSize: 10, color: P.red }}>{item.karate_registration_number}</Mono>
        </View>
      </View>
      <View style={[styles.colDivider, { flex: 1.4 }]}>
        <Body muted style={styles.cell}>{item.dojo_name || "—"}</Body>
      </View>
      <View style={[styles.colDivider, { width: 150 }]}>{item.belt_name ? <BeltTag level={item.belt_name.toLowerCase().replace(/\s+/g, "_")} name={item.belt_name} /> : <Body muted>—</Body>}</View>
      <View style={{ width: 120 }}><ShojiBadge affiliationStatus={item.affiliation_status} /></View>
      <Icon name="chevron-forward" size={16} color={C.ink4} style={{ width: 18 }} />
    </RowPressable>
  );
  return (
    <RowPressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Avatar name={item.full_name} size={40} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name}>{item.full_name}</Text>
        <Mono style={{ fontSize: 10, color: P.red }}>{item.karate_registration_number}</Mono>
        <Body muted style={{ fontSize: 11 }}>{item.dojo_name}</Body>
      </View>
      <View style={{ gap: 6, alignItems: "flex-end" }}>
        {item.belt_name ? <BeltTag level={item.belt_name.toLowerCase().replace(/\s+/g, "_")} name={item.belt_name} /> : null}
        <ShojiBadge affiliationStatus={item.affiliation_status} />
      </View>
    </RowPressable>
  );
}
const Row = React.memo(PractitionerRow);

// ── Header da FlatList (título + busca + filtros + thead) ────────────
// Componente ESTÁVEL, declarado no module scope: sua IDENTIDADE (tipo) nunca
// muda entre renderizações, só as props mudam. É isso — e não "morar fora da
// FlatList" — que garante que o TextInput da busca não perca foco a cada
// tecla, mesmo agora que a busca voltou a rolar junto com a página dentro do
// ListHeaderComponent. React.memo evita trabalho de diff redundante quando as
// props não mudam (ex.: enquanto as linhas re-renderizam por outro motivo).
type PractitionersListHeaderProps = {
  total: number;
  dojoIdParam: string;
  filteredDojoName: string | null;
  exportLabel: string;
  exporting: boolean;
  onExport: () => void;
  onImport: () => void;
  onNew: () => void;
  q: string;
  onChangeQ: (t: string) => void;
  onSubmitSearch: () => void;
  status: PractitionerStatusFilter;
  onStatus: (s: PractitionerStatusFilter) => void;
  role: RoleFilter | null;
  onRole: (r: RoleFilter | null) => void;
  showThead: boolean;
};

const PractitionersListHeader = React.memo(function PractitionersListHeader(p: PractitionersListHeaderProps) {
  return (
    <View>
      <RaisedHeader style={{ marginBottom: 28 }}>
        <PageHead
          eyebrow={`${p.total} ${p.total === 1 ? "praticante" : "praticantes"} · carteirinha FPKT`}
          title="Praticantes"
          sub={
            p.dojoIdParam
              ? `Exibindo somente os praticantes do dojô${p.filteredDojoName ? ` ${p.filteredDojoName}` : ""}. A exportação segue este filtro.`
              : "Cadastro federativo de praticantes ativos e suas trajetórias de graduação."
          }
          actions={<>
            <ShojiButton
              label={p.exportLabel}
              icon="download-outline"
              variant="ghost"
              onPress={p.onExport}
              style={p.exporting ? { opacity: 0.6 } : undefined}
            />
            <ShojiButton label="Importar" icon="cloud-upload-outline" variant="ghost" onPress={p.onImport} />
            <ShojiButton label="Novo praticante" icon="add" variant="sumi" onPress={p.onNew} />
          </>}
        />
        <View>
          <SearchField value={p.q} onChangeText={p.onChangeQ} onSubmit={p.onSubmitSearch} placeholder="Buscar por nome, código FPKT, CPF ou RG..." style={{ marginBottom: 14 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUS_FILTERS.map((s) => <Chip key={s.key} label={s.label} active={p.status === s.key} onPress={() => p.onStatus(s.key)} />)}
            <View style={styles.chipDivider} />
            {ROLE_FILTERS.map((r) => (
              <Chip key={r.key} label={r.label} active={p.role === r.key} onPress={() => p.onRole(p.role === r.key ? null : r.key)} />
            ))}
          </ScrollView>
        </View>
      </RaisedHeader>
      {/* Poço (plano rebaixado): a borda/sombra interna marca o início da
          zona de dados. `pocoCap` só carrega o thead (modo wide); o corpo do
          poço continua por baixo de cada linha (`pocoItem`, mesmo bg/padding)
          e se fecha no `pocoFoot` (ListFooterComponent), lá embaixo. */}
      <View style={[styles.pocoCap, SH.sunken]}>
        {p.showThead && (
          <View style={[styles.tr, styles.thead]}>
            <View style={[styles.colDivider, { flex: 2 }]}><Text style={styles.th}>Praticante</Text></View>
            <View style={[styles.colDivider, { flex: 1.4 }]}><Text style={styles.th}>Dojô</Text></View>
            <View style={[styles.colDivider, { width: 150 }]}><Text style={styles.th}>Graduação</Text></View>
            <View style={{ width: 120 }}><Text style={styles.th}>Status</Text></View>
            <View style={{ width: 18 }} />
          </View>
        )}
      </View>
    </View>
  );
});

export default function PraticantesScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  // IA/Nav P1 — pré-filtros vindos da rota (busca global / CTA do dojô).
  const params = useLocalSearchParams<{ q?: string | string[]; dojo_id?: string | string[] }>();
  const qParam = firstParam(params.q);
  const dojoIdParam = firstParam(params.dojo_id);

  const [items, setItems] = useState<PractitionerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // `q` = texto exibido no input (responsivo a cada tecla).
  // `debouncedQ` = termo "assentado" que efetivamente dispara o fetch.
  const [q, setQ] = useState(qParam);
  const [debouncedQ, setDebouncedQ] = useState(qParam);
  const [status, setStatus] = useState<PractitionerStatusFilter>("active");
  const [role, setRole] = useState<RoleFilter | null>(null);
  // Modal da ficha: usado SÓ para cadastro rápido ("Novo praticante").
  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  // Exportar (.xlsx) — todos os praticantes da federação. Web-only (SheetJS + Blob).
  const [exporting, setExporting] = useState(false);

  // Sincroniza busca quando o param `q` muda (ex.: nova busca vinda do shell).
  // Atualiza tanto o texto visível quanto o termo debounced (sem esperar).
  useEffect(() => { setQ(qParam); setDebouncedQ(qParam); }, [qParam]);

  // Fix 6 — debounce: só "assenta" o termo após o usuário parar de digitar.
  // O estado `q` (texto) já mudou imediatamente; aqui só atrasamos o fetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listPractitioners(federationId, {
        q: debouncedQ || undefined,
        dojo_id: dojoIdParam || undefined,
        affiliation_status: status === "all" ? undefined : status,
        role: role || undefined,
        pageSize: 100,
      });
      setItems(res.data); setTotal(res.total ?? res.data.length);
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId, debouncedQ, status, role, dojoIdParam]);
  useEffect(() => { load(); }, [load]);

  // Nome do dojô do pré-filtro (para o label do botão, o feedback e o nome
  // do arquivo exportado). Derivado da própria lista já carregada — todos os
  // itens compartilham o mesmo dojo_name quando dojo_id está fixado, então
  // não é preciso um fetch extra só para isso.
  const filteredDojoName = dojoIdParam ? items[0]?.dojo_name || null : null;

  // Submeter no teclado força a busca imediata (assenta o termo agora).
  const submitSearch = useCallback(() => { setDebouncedQ(q); }, [q]);

  // Exporta todos os praticantes da federação em .xlsx (uma aba "Praticantes").
  // Espelha o padrão do DojoExportModal: web-only, import dinâmico do SheetJS,
  // download via Blob (sem dependência nova).
  const handleExportPractitioners = useCallback(async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Use no computador", "A exportação de planilha funciona no Aura pelo navegador (desktop).");
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      // Fix bug de produção — manda os MESMOS filtros ativos na tela (dojo_id
      // do pré-filtro de rota, status e busca), não mais a federação inteira.
      const data = await karateApi.exportAllPractitioners(federationId, {
        dojo_id: dojoIdParam || undefined,
        status: status === "all" ? undefined : status,
        q: debouncedQ || undefined,
      });
      // perf: xlsx (~1MB) carregado sob demanda, fora do bundle inicial
      const xlsx = await import("xlsx");
      const headers = ["Nome", "Nº FPKT", "CPF", "RG", "Nascimento", "E-mail", "Telefone", "Dojô", "Nº FPKT Dojô", "Faixa", "Situação"];
      const rows = data.practitioners.map((p) => [
        p.nome || "",
        p.numero_fpkt || "",
        p.cpf || "",
        p.rg || "",
        p.nascimento || "",
        p.email || "",
        p.telefone || "",
        p.dojo || "",
        p.dojo_fpkt || "",
        p.faixa || "",
        p.situacao || "",
      ]);
      const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Praticantes");

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      // Nome do arquivo reflete o filtro de dojô quando presente (slug do
      // nome do dojô, sem acentos/espaços) — evita baixar "praticantes" e o
      // usuário achar que é a federação inteira.
      const dojoSlug = filteredDojoName
        ? "_" + filteredDojoName
            .normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
        : "";
      const fname = `FPKT_praticantes${dojoSlug}_${today}.xlsx`;
      const out = xlsx.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e?.message || "Não foi possível exportar os praticantes. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }, [federationId, exporting, dojoIdParam, status, debouncedQ, filteredDojoName]);

  // Cabeçalho da tela (título + CTAs). Quando filtrada por dojô (dojoIdParam),
  // o sub e o label do botão de export deixam claro que a exportação é só
  // daquele dojô — não da federação inteira (bug de produção corrigido em
  // 11/07/2026).
  const exportLabel = exporting
    ? "Exportando…"
    : dojoIdParam
      ? `Exportar dojô${filteredDojoName ? ` (${filteredDojoName})` : ""}`
      : "Exportar";

  // Thead (cabeçalho da tabela) só aparece no modo wide e com itens.
  const showThead = wide && items.length > 0;

  // Elemento de header da FlatList — mesmo TIPO (PractitionersListHeader) em
  // toda renderização; só as props mudam. É isso que preserva o foco do
  // TextInput (ver comentário acima do componente).
  const listHeader = (
    <PractitionersListHeader
      total={total}
      dojoIdParam={dojoIdParam}
      filteredDojoName={filteredDojoName}
      exportLabel={exportLabel}
      exporting={exporting}
      onExport={handleExportPractitioners}
      onImport={() => router.push("/karate/importacao" as any)}
      onNew={() => setModal({ open: true, id: null })}
      q={q}
      onChangeQ={setQ}
      onSubmitSearch={submitSearch}
      status={status}
      onStatus={setStatus}
      role={role}
      onRole={setRole}
      showThead={showThead}
    />
  );

  const renderItem = useCallback(({ item }: { item: PractitionerListItem }) => (
    <View style={styles.pocoItem}>
      <Row item={item} wide={wide} onPress={() => router.push(`/karate/praticantes/${item.id}` as any)} />
    </View>
  ), [wide, router]);

  const fichaModal = (
    <PraticanteFichaModal
      federationId={federationId}
      visible={modal.open}
      practitionerId={modal.id}
      onClose={() => setModal({ open: false, id: null })}
      onSaved={() => load(true)}
    />
  );

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} />{fichaModal}</ShojiBackground>;

  // A FlatList é o ÚNICO scroller da página: header (título/busca/filtros) +
  // thead + linhas rolam juntos, e a lista ocupa a altura inteira da área de
  // conteúdo (flex: 1). A FlatList permanece SEMPRE montada (nunca é trocada
  // por um ActivityIndicator solto) — o loading vira só o ListEmptyComponent
  // quando ainda não há itens — assim o header/busca nunca desmontam durante
  // um fetch (mesmo o debounced), preservando o foco também nesse caso.
  return (
    <ShojiBackground>
      <View style={styles.content}>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={listHeader}
          ListFooterComponent={<View style={styles.pocoFoot} />}
          ListEmptyComponent={
            <View style={styles.pocoItem}>
              {loading ? (
                <ActivityIndicator style={{ marginTop: 48, marginBottom: 48 }} size="large" color={P.red} />
              ) : (
                <KarateEmptyState icon="people-outline" title="Nenhum praticante encontrado" subtitle="Ajuste a busca/filtros, cadastre ou importe uma planilha." style={{ paddingVertical: 40 }} />
              )}
            </View>
          }
          contentContainerStyle={styles.pageScroll}
          style={{ flex: 1, width: "100%" }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
          renderItem={renderItem}
        />
      </View>
      {fichaModal}
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  // `content` só centraliza/limita a largura — o padding da página inteira
  // agora mora em `pageScroll` (contentContainerStyle da FlatList), porque é
  // ELE quem rola. A FlatList recebe `flex: 1` para preencher toda a área de
  // conteúdo do shell (que tem `overflow: hidden` — a FlatList é quem cria a
  // única região com scroll de fato).
  content: { flex: 1, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  pageScroll: { paddingHorizontal: 40, paddingTop: 48, paddingBottom: 72 } as ViewStyle,
  chips: { gap: 8, paddingBottom: 18, alignItems: "center" } as ViewStyle,
  chipDivider: { width: 1, height: 22, backgroundColor: C.line2, marginHorizontal: 4, alignSelf: "center" } as ViewStyle,

  // Poço (plano rebaixado): `pocoCap` abre o poço logo abaixo do
  // RaisedHeader (borda nítida + sombra interna, SH.sunken) e carrega o
  // thead; `pocoItem` repete o mesmo fundo/padding em CADA linha (thead e
  // linhas alinhados, mesma faixa contínua); `pocoFoot` fecha o poço com
  // cantos arredondados depois da última linha.
  pocoCap: { backgroundColor: P.paper2, borderTopWidth: 1.5, borderTopColor: C.line2, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 4 } as ViewStyle,
  pocoItem: { backgroundColor: P.paper2, paddingHorizontal: 24 } as ViewStyle,
  pocoFoot: { backgroundColor: P.paper2, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl, height: 20 } as ViewStyle,

  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 10 } as ViewStyle,
  // Item 4 (motion pack Shoji): divisão MUITO sutil entre colunas — hairline
  // de baixa opacidade, pensada pra profundidade/ritmo, não pra grade de
  // planilha (metade da opacidade do hairline de linha, C.line).
  colDivider: { borderRightWidth: 1, borderRightColor: "rgba(43,38,32,0.055)", paddingRight: 14 } as ViewStyle,
  th: { fontFamily: F.body, fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  cell: { fontSize: 12.5 } as TextStyle,
  name: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 14, marginBottom: 10 } as ViewStyle,
});
