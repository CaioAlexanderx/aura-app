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
// ============================================================
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView,
  useWindowDimensions, ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import {
  ShojiBackground, PageHead, SearchField, Chip, ShojiBadge, Avatar, ShojiButton, Mono, Body,
} from "@/components/karate/shoji";
import DojoFichaModal from "@/components/karate/DojoFichaModal";
import { karateApi, Dojo, DojoStatus, AffiliationModel } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const MODEL_LABEL: Record<AffiliationModel, string> = { annual: "Anual", biannual: "Semestral", quarterly: "Trimestral" };

// Todos os status reais (computeDojoStatus) — incl. Suspenso, que faltava.
const STATUS_FILTERS: { key: DojoStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativo" },
  { key: "expiring", label: "A vencer" },
  { key: "overdue", label: "Vencido" },
  { key: "defaulting", label: "Inadimplente" },
  { key: "suspended", label: "Suspenso" },
];

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
  const [status, setStatus] = useState<DojoStatus | "all">("all");
  const [region, setRegion] = useState<string | "all">("all");

  // Catálogo de regiões — fetch INDEPENDENTE dos filtros, para a lista de regiões
  // ser estável em qualquer status (corrige "região só aparece nos ativos").
  const [allRegions, setAllRegions] = useState<string[]>([]);

  // Modal da ficha: usado SÓ para cadastro rápido ("Novo dojô").
  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  // Lista filtrada (status × região × busca), server-side.
  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listDojos(federationId, {
        q: q || undefined,
        status: status === "all" ? undefined : status,
        region: region === "all" ? undefined : region,
        pageSize: 100,
      });
      setDojos(res.data); setTotal(res.total ?? res.data.length);
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId, q, status, region]);

  useEffect(() => { load(); }, [load]);

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

  const header = (
    <View>
      <PageHead
        eyebrow={`${total} ${total === 1 ? "dojô filiado" : "dojôs filiados"} · ${allRegions.length || "—"} regiões`}
        title="Dojôs filiados"
        sub="Gestão da rede federativa. Cadastro, anuidades e estado de cada afiliado."
        actions={<ShojiButton label="Novo dojô" icon="add" variant="sumi" onPress={() => setModal({ open: true, id: null })} />}
      />
      <SearchField value={q} onChangeText={setQ} onSubmit={() => load()} placeholder="Buscar por nome, código FPKT ou sensei..." style={{ marginBottom: 14 }} />

      {/* Linha de STATUS (independente) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />
        ))}
      </ScrollView>

      {/* Linha de REGIÃO (independente) — sempre visível quando há >1 região no
          catálogo, em QUALQUER status. */}
      {allRegions.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <View style={styles.regionTag}><Ionicons name="location-outline" size={12} color={C.ink3} /><Text style={styles.regionTagTxt}>Região</Text></View>
          <Chip label="Todas" active={region === "all"} onPress={() => setRegion("all")} />
          {allRegions.map((r) => <Chip key={r} label={r} active={region === r} onPress={() => setRegion(r)} />)}
        </ScrollView>
      )}

      {/* Limpar filtros — reset previsível, sem precisar trocar de aba */}
      {hasFilters && (
        <TouchableOpacity onPress={clearFilters} style={styles.clearBtn} activeOpacity={0.7} accessibilityLabel="Limpar filtros">
          <Ionicons name="close-circle-outline" size={14} color={C.ink2} />
          <Text style={styles.clearTxt}>Limpar filtros</Text>
        </TouchableOpacity>
      )}

      {wide && dojos.length > 0 && (
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Dojô</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Região</Text>
          <Text style={[styles.th, { width: 100 }]}>Modelo</Text>
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Pratic.</Text>
          <Text style={[styles.th, { width: 130 }]}>Status</Text>
          <View style={{ width: 18 }} />
        </View>
      )}
    </View>
  );

  function Row({ d }: { d: Dojo }) {
    const onPress = () => router.push(`/karate/dojos/${d.id}` as any);
    if (wide) return (
      <TouchableOpacity style={styles.tr} onPress={onPress} activeOpacity={0.7}>
        <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 8 }}>
          <Avatar name={d.name} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{d.name}</Text>
            <Mono style={{ fontSize: 10, color: P.red }}>{d.fpkt_affiliation_id}</Mono>
          </View>
        </View>
        <Body muted style={[styles.cell, { flex: 1.2 }]} >{d.region || "—"}</Body>
        <Body muted style={[styles.cell, { width: 100 }]}>{MODEL_LABEL[d.affiliation_model] ?? "—"}</Body>
        <Mono style={[styles.cellNum, { width: 90, textAlign: "right" }]}>{d.practitioner_count}</Mono>
        <View style={{ width: 130 }}><ShojiBadge dojoStatus={d.status} /></View>
        <Ionicons name="chevron-forward" size={16} color={C.ink4} style={{ width: 18 }} />
      </TouchableOpacity>
    );
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
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
          <Meta icon="people-outline" text={`${d.practitioner_count} praticantes`} />
          <Meta icon="ribbon-outline" text={MODEL_LABEL[d.affiliation_model] ?? "—"} />
        </View>
      </TouchableOpacity>
    );
  }

  const fichaModal = (
    <DojoFichaModal
      federationId={federationId}
      visible={modal.open}
      dojoId={modal.id}
      onClose={() => setModal({ open: false, id: null })}
      onSaved={() => refreshAll()}
    />
  );

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} />{fichaModal}</ShojiBackground>;

  return (
    <ShojiBackground>
      {loading ? (
        <View style={styles.content}>{header}<ActivityIndicator style={{ marginTop: 48 }} size="large" color={P.red} /></View>
      ) : (
        <FlatList
          data={dojos} keyExtractor={(d) => d.id} ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={P.red} />}
          renderItem={({ item }) => <Row d={item} />}
          ListEmptyComponent={<KarateEmptyState icon="home-outline" title="Nenhum dojô encontrado" subtitle="Ajuste a busca/filtros ou cadastre um novo dojô." style={{ paddingVertical: 40 }} />}
        />
      )}
      {fichaModal}
    </ShojiBackground>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.metaItem}><Ionicons name={icon as any} size={12} color={C.ink3} /><Text style={styles.metaTxt}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  chips: { gap: 8, paddingBottom: 12, alignItems: "center" } as ViewStyle,
  regionTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 4 } as ViewStyle,
  regionTagTxt: { fontFamily: F.body, fontSize: 10, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 6 } as ViewStyle,
  clearTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink2 } as TextStyle,
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 10 } as ViewStyle,
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
