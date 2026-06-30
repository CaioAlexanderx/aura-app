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
// Fix 6/8 (foco/busca) — CAUSA RAIZ corrigida na v2:
//   O campo de busca perdia o foco a cada letra porque o SearchField (e os
//   chips de filtro) viviam DENTRO do ListHeaderComponent da FlatList. Mesmo
//   com useCallback, a FlatList reconcilia o elemento de header a cada render
//   e o renderHeader trocava de identidade a cada tecla (deps q/status/role/…),
//   o que DESMONTAVA o TextInput → foco perdido (a v1/PR #306, com debounce +
//   header memoizado + Row memo, NÃO resolveu por isso).
//   Correção definitiva: a busca e os filtros agora são um <View> PERSISTENTE,
//   FORA da FlatList, montado UMA única vez no corpo da tela. Quando os dados/
//   linhas re-renderizam, o input não é tocado e mantém o foco. O header da
//   FlatList passou a conter SÓ o PageHead + o cabeçalho da tabela (thead).
//     • o texto (`q`) atualiza imediatamente (responsivo ao digitar);
//     • o fetch é DEBOUNCED (~350ms) — só o termo "assentado" dispara a busca.
//
// Fix 7 (filtros de papel): chips Instrutor/Examinador/Árbitro filtram
//   server-side via ?role=instructor|examiner|arbiter (o backend GET já aceita
//   `role` e mapeia para is_instructor/is_examiner/is_arbiter). Como a API
//   aceita UM papel por vez, os chips de papel são single-select e coexistem
//   com o filtro de status e o pré-filtro dojo_id.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView,
  useWindowDimensions, ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useRouter, useLocalSearchParams } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SearchField, Chip, ShojiBadge, BeltTag, Avatar, ShojiButton, Mono, Body,
} from "@/components/karate/shoji";
import PraticanteFichaModal from "@/components/karate/PraticanteFichaModal";
import { karateApi, PractitionerListItem, AffiliationStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STATUS_FILTERS: { key: AffiliationStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" }, { key: "active", label: "Em dia" }, { key: "pending", label: "Pendente" }, { key: "inactive", label: "Inativo" },
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

// Linha extraída do render (componente estável) — são remonta a cada tecla.
function PractitionerRow({ item, wide, onPress }: { item: PractitionerListItem; wide: boolean; onPress: () => void }) {
  if (wide) return (
    <TouchableOpacity style={styles.tr} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 8 }}>
        <Avatar name={item.full_name} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
          <Mono style={{ fontSize: 10, color: P.red }}>{item.karate_registration_number}</Mono>
        </View>
      </View>
      <Body muted style={[styles.cell, { flex: 1.4 }]}>{item.dojo_name || "—"}</Body>
      <View style={{ width: 150 }}>{item.belt_name ? <BeltTag level={item.belt_name.toLowerCase().replace(/\s+/g, "_")} name={item.belt_name} /> : <Body muted>—</Body>}</View>
      <View style={{ width: 120 }}><ShojiBadge affiliationStatus={item.affiliation_status} /></View>
      <Icon name="chevron-forward" size={16} color={C.ink4} style={{ width: 18 }} />
    </TouchableOpacity>
  );
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
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
    </TouchableOpacity>
  );
}
const Row = React.memo(PractitionerRow);

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
  const [status, setStatus] = useState<AffiliationStatus | "all">("all");
  const [role, setRole] = useState<RoleFilter | null>(null);
  // Modal da ficha: usado SÓ para cadastro rápido ("Novo praticante").
  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  // Sincroniza busca quando o param `q` muda (ex.(�nova busca do shell).
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

  // Submeter no teclado força a busca imediata (assenta o termo agora).
  const submitSearch = useCallback(() => { setDebouncedQ(q); }, [q]);

  // ── Busca + filtros: bloco PERSISTENTE, FORA da FlatList ─────────────
  // Montado UMA vez no corpo da tela. Como NÃO é o ListHeaderComponent, a
  // FlatList nunca o reconcilia/remonta ao re-renderizar as linhas → o
  // TextInput de busca mantém o foco entre teclas. (Causa raiz da v1.)
  const searchAndFilters = (
    <View>
      <SearchField value={q} onChangeText={setQ} onSubmit={submitSearch} placeholder="Buscar por nome, código FPKT, CPF ou RG..." style={{ marginBottom: 14 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((s) => <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />)}
        <View style={styles.chipDivider} />
        {ROLE_FILTERS.map((r) => (
          <Chip key={r.key} label={r.label} active={role === r.key} onPress={() => setRole(role === r.key ? null : r.key)} />
        ))}
      </ScrollView>
    </View>
  );

  // Cabeçalho da tela (título + CTAs). Fica acima da busca; não tem input.
  const pageHead = (
    <PageHead
      eyebrow={`${total} ${total === 1 ? "praticante" : "praticantes"} · carteirinha FPKT`}
      title="Praticantes"
      sub="Cadastro federativo de praticantes ativos e suas trajetórias de graduação."
      actions={<>
        <ShojiButton label="Importar" icon="cloud-upload-outline" variant="ghost" onPress={() => router.push("/karate/importacao" as any)} />
        <ShojiButton label="Novo praticante" icon="add" variant="sumi" onPress={() => setModal({ open: true, id: null })} />
      </>}
    />
  );

  // Header da FlatList: SÓ cabeçalho da tabela (thead) no modo wide. Sem
  // input/chips aqui — por isso não há mais remontagem do TextInput.
  const showThead = wide && items.length > 0;
  const renderHeader = useCallback(() => (
    showThead ? (
      <View style={[styles.tr, styles.thead]}>
        <Text style={[styles.th, { flex: 2 }]}>Praticante</Text>
        <Text style={[styles.th, { flex: 1.4 }]}>Dojô</Text>
        <Text style={[styles.th, { width: 150 }]}>Graduação</Text>
        <Text style={[styles.th, { width: 120 }]}>Status</Text>
        <View style={{ width: 18 }} />
      </View>
    ) : null
  ), [showThead]);

  const renderItem = useCallback(({ item }: { item: PractitionerListItem }) => (
    <Row item={item} wide={wide} onPress={() => router.push(`/karate/praticantes/${item.id}` as any)} />
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

  return (
    <ShojiBackground>
      <View style={styles.content}>
        {pageHead}
        {searchAndFilters}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} size="large" color={P.red} />
        ) : (
          <FlatList
            data={items} keyExtractor={(i) => i.id} ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            style={{ width: "100%" }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
            renderItem={renderItem}
            ListEmptyComponent={<KarateEmptyState icon="people-outline" title="Nenhum praticante encontrado" subtitle="Ajuste a busca/filtros, cadastre ou importe uma planilha." style={{ paddingVertical: 40 }} />}
          />
        )}
      </View>
      {fichaModal}
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  // `content` agora envolve a tela inteira (head + busca + lista). A FlatList
  // recebe `flex: 1` via listContent não-paddado; o padding externo mora aqui.
  content: { flex: 1, padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  listContent: { paddingBottom: 24 } as ViewStyle,
  chips: { gap: 8, paddingBottom: 18, alignItems: "center" } as ViewStyle,
  chipDivider: { width: 1, height: 22, backgroundColor: C.line2, marginHorizontal: 4, alignSelf: "center" } as ViewStyle,
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 10 } as ViewStyle,
  th: { fontFamily: F.body, fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  cell: { fontSize: 12.5 } as TextStyle,
  name: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 14, marginBottom: 10 } as ViewStyle,
});
