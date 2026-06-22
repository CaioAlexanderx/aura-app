// ============================================================
// Dojôs — Lista — Aura Karatê (federação) · Shoji
//
// Fiel ao pane "dojos" do standalone v5. Dados reais via
// GET /federation/{id}/dojos. Estados honestos.
// Ficha (cadastro + edição) abre em MODAL sobre a lista (navegação fluida).
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
const STATUS_FILTERS: { key: DojoStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" }, { key: "active", label: "Ativo" }, { key: "expiring", label: "A vencer" },
  { key: "overdue", label: "Vencido" }, { key: "defaulting", label: "Inadimplente" },
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
  const [status, setStatus] = useState<DojoStatus | "all">("all");
  const [region, setRegion] = useState<string | "all">("all");
  // Modal da ficha: open + id (null = cadastro, string = edição)
  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listDojos(federationId, {
        q: q || undefined, status: status === "all" ? undefined : status,
        region: region === "all" ? undefined : region, pageSize: 100,
      });
      setDojos(res.data); setTotal(res.total ?? res.data.length);
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId, q, status, region]);

  useEffect(() => { load(); }, [load]);
  const regions = useMemo(() => Array.from(new Set(dojos.map((d) => d.region).filter(Boolean))), [dojos]);

  const header = (
    <View>
      <PageHead
        eyebrow={`${total} ${total === 1 ? "dojô filiado" : "dojôs filiados"} · ${regions.length || "—"} regiões`}
        title="Dojôs filiados"
        sub="Gestão da rede federativa. Cadastro, anuidades e estado de cada afiliado."
        actions={<ShojiButton label="Novo dojô" icon="add" variant="sumi" onPress={() => setModal({ open: true, id: null })} />}
      />
      <SearchField value={q} onChangeText={setQ} onSubmit={() => load()} placeholder="Buscar por nome, código FPKT ou sensei..." style={{ marginBottom: 14 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((s) => <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />)}
        {regions.length > 1 && <>
          <View style={styles.div} />
          <Chip label="Todas regiões" active={region === "all"} onPress={() => setRegion("all")} />
          {regions.map((r) => <Chip key={r} label={r} active={region === r} onPress={() => setRegion(r)} />)}
        </>}
      </ScrollView>
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
    const onPress = () => setModal({ open: true, id: d.id });
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
      onSaved={() => load(true)}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
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
  chips: { gap: 8, paddingBottom: 18, alignItems: "center" } as ViewStyle,
  div: { width: 1, height: 20, backgroundColor: C.line2, marginHorizontal: 2 } as ViewStyle,
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
