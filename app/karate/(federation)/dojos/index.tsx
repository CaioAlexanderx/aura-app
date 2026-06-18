// ============================================================
// Dojôs — Lista — Aura Karatê (federação)
//
// Gestão da rede filiada. Busca + filtros (região/status), tabela
// responsiva (web) / cards (mobile). Ações: Importar + Novo dojô.
// Dados reais via GET /federation/{id}/dojos. Sem mock:
// loading → spinner, falha → ErrorState, vazio → honesto.
// ============================================================
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, RefreshControl, ScrollView,
  useWindowDimensions, ViewStyle, TextStyle, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { karateApi, Dojo, DojoStatus, AffiliationModel } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const MODEL_LABEL: Record<AffiliationModel, string> = {
  annual: "Anual", biannual: "Semestral", quarterly: "Trimestral",
};

const STATUS_FILTERS: { key: DojoStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativo" },
  { key: "expiring", label: "A vencer" },
  { key: "overdue", label: "Vencido" },
  { key: "defaulting", label: "Inadimplente" },
];

function HeaderBtn({ icon, label, primary, onPress }: { icon: string; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.hBtn, primary ? styles.hBtnPrimary : styles.hBtnGhost]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon as any} size={15} color={primary ? "#fff" : KarateColors.ink2} />
      <Text style={[styles.hBtnLabel, primary && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DojosScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DojoStatus | "all">("all");
  const [region, setRegion] = useState<string | "all">("all");

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const result = await karateApi.listDojos(federationId, {
        q: q || undefined,
        status: status === "all" ? undefined : status,
        region: region === "all" ? undefined : region,
        pageSize: 100,
      });
      setDojos(result.data);
      setTotal(result.total ?? result.data.length);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, q, status, region]);

  useEffect(() => { load(); }, [load]);

  // Regiões distintas das telas carregadas, p/ filtro leve.
  const regions = useMemo(() => Array.from(new Set(dojos.map((d) => d.region).filter(Boolean))), [dojos]);

  const header = (
    <View>
      {/* Page head */}
      <View style={styles.pageHead}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={styles.eyebrow}>{total} {total === 1 ? "dojô filiado" : "dojôs filiados"}</Text>
          <Text style={styles.h1}>Dojôs filiados</Text>
          <Text style={styles.sub}>Cadastro, anuidades e estado de cada afiliado.</Text>
        </View>
        <View style={styles.headActions}>
          <HeaderBtn icon="add" label="Novo dojô" primary onPress={() => router.push("/karate/dojos/novo" as any)} />
        </View>
      </View>

      {/* Toolbar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, código FPKT ou sensei..."
          placeholderTextColor={KarateColors.ink4}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={() => load()}
          accessibilityLabel="Buscar dojôs"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />
        ))}
        {regions.length > 1 && (
          <>
            <View style={styles.chipDivider} />
            <Chip label="Todas regiões" active={region === "all"} onPress={() => setRegion("all")} />
            {regions.map((r) => (
              <Chip key={r} label={r} active={region === r} onPress={() => setRegion(r)} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Cabeçalho da tabela (web) */}
      {wide && dojos.length > 0 && (
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Dojô</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Região</Text>
          <Text style={[styles.th, { width: 100 }]}>Modelo</Text>
          <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Pratic.</Text>
          <Text style={[styles.th, { width: 120 }]}>Status</Text>
          <View style={{ width: 20 }} />
        </View>
      )}
    </View>
  );

  function Row({ dojo }: { dojo: Dojo }) {
    const onPress = () => router.push(`/karate/dojos/${dojo.id}` as any);
    if (wide) {
      return (
        <TouchableOpacity style={styles.tr} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${dojo.name}, ${dojo.fpkt_affiliation_id}`}>
          <View style={{ flex: 2, paddingRight: 8 }}>
            <Text style={styles.dojoName} numberOfLines={1}>{dojo.name}</Text>
            <Text style={styles.dojoId}>{dojo.fpkt_affiliation_id}</Text>
          </View>
          <Text style={[styles.cell, { flex: 1.2 }]} numberOfLines={1}>{dojo.region || "—"}</Text>
          <Text style={[styles.cell, { width: 100 }]}>{MODEL_LABEL[dojo.affiliation_model] ?? "—"}</Text>
          <Text style={[styles.cellMono, { width: 90, textAlign: "right" }]}>{dojo.practitioner_count}</Text>
          <View style={{ width: 120 }}><Badge dojoStatus={dojo.status} /></View>
          <Ionicons name="chevron-forward" size={16} color={KarateColors.ink4} style={{ width: 20 }} />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${dojo.name}, ${dojo.fpkt_affiliation_id}`}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dojoId}>{dojo.fpkt_affiliation_id}</Text>
            <Text style={styles.dojoName}>{dojo.name}</Text>
          </View>
          <Badge dojoStatus={dojo.status} />
        </View>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}><Ionicons name="location-outline" size={12} color={KarateColors.ink3} /><Text style={styles.metaText}>{dojo.region || "—"}</Text></View>
          <View style={styles.metaItem}><Ionicons name="people-outline" size={12} color={KarateColors.ink3} /><Text style={styles.metaText}>{dojo.practitioner_count} praticantes</Text></View>
          <View style={styles.metaItem}><Ionicons name="ribbon-outline" size={12} color={KarateColors.ink3} /><Text style={styles.metaText}>{MODEL_LABEL[dojo.affiliation_model] ?? "—"}</Text></View>
        </View>
      </TouchableOpacity>
    );
  }

  if (error) {
    return <KarateErrorState onRetry={() => load()} />;
  }

  return (
    <View style={styles.screen}>
      {loading ? (
        <>
          {header}
          <ActivityIndicator style={{ marginTop: 48 }} size="large" color={KarateColors.primary} />
        </>
      ) : (
        <FlatList
          data={dojos}
          keyExtractor={(d) => d.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
          renderItem={({ item }) => <Row dojo={item} />}
          ListEmptyComponent={
            <KarateEmptyState icon="home-outline" title="Nenhum dojô encontrado" subtitle="Ajuste a busca/filtros ou cadastre um novo dojô." style={{ paddingVertical: 40 }} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  list:   { padding: 24, paddingBottom: 64, maxWidth: 1100, width: "100%", alignSelf: "center" } as ViewStyle,

  pageHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 16, marginBottom: 20 } as ViewStyle,
  eyebrow:  { fontSize: 11, fontWeight: "600", color: KarateColors.ink3, letterSpacing: 1, textTransform: "uppercase" } as TextStyle,
  h1:       { fontSize: 30, fontWeight: "800", color: KarateColors.ink, marginTop: 6 } as TextStyle,
  sub:      { fontSize: 13, color: KarateColors.ink2, marginTop: 6 } as TextStyle,
  headActions: { flexDirection: "row", gap: 8 } as ViewStyle,
  hBtn:        { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: KarateRadius.sm } as ViewStyle,
  hBtnGhost:   { backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  hBtnPrimary: { backgroundColor: KarateColors.primary } as ViewStyle,
  hBtnLabel:   { fontSize: 12.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,

  searchBar:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, minHeight: 24, outlineStyle: "none" as any } as ViewStyle,

  chips: { gap: 8, paddingBottom: 16, alignItems: "center" } as ViewStyle,
  chip:  { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  chipActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipLabel:  { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  chipDivider: { width: 1, height: 20, backgroundColor: KarateColors.border, marginHorizontal: 2 } as ViewStyle,

  tr:    { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 9 } as ViewStyle,
  th:    { fontSize: 10, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.6 } as TextStyle,
  cell:    { fontSize: 12.5, color: KarateColors.ink2 } as TextStyle,
  cellMono:{ fontSize: 12.5, fontWeight: "700", color: KarateColors.ink, fontVariant: ["tabular-nums"] } as TextStyle,

  card:       { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10, marginBottom: 10 } as ViewStyle,
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  dojoId:     { fontSize: 10, fontWeight: "800", color: KarateColors.primary, letterSpacing: 0.6, fontFamily: "monospace", marginTop: 2 } as TextStyle,
  dojoName:   { fontSize: 14.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  cardMeta:   { flexDirection: "row", flexWrap: "wrap", gap: 14 } as ViewStyle,
  metaItem:   { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaText:   { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
});
