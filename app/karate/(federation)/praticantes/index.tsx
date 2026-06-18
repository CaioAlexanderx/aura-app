// ============================================================
// Praticantes — Lista — Aura Karatê (federação)
//
// Cadastro federativo. Busca + filtro de status, tabela
// responsiva (web) / cards (mobile). Ações: Importar + Novo.
// Dados reais via GET /federation/{id}/practitioners. Sem mock:
// loading → spinner, falha → ErrorState, vazio → honesto.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, RefreshControl, ScrollView,
  useWindowDimensions, ViewStyle, TextStyle, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { karateApi, PractitionerListItem, AffiliationStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STATUS_FILTERS: { key: AffiliationStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Em dia" },
  { key: "pending", label: "Pendente" },
  { key: "inactive", label: "Inativo" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
const beltKey = (name: string) => name.toLowerCase().replace(/\s+/g, "_");

function HeaderBtn({ icon, label, primary, onPress }: { icon: string; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.hBtn, primary ? styles.hBtnPrimary : styles.hBtnGhost]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
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

export default function PraticantesScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  const [items, setItems] = useState<PractitionerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AffiliationStatus | "all">("all");

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listPractitioners(federationId, {
        q: q || undefined,
        affiliation_status: status === "all" ? undefined : status,
        pageSize: 100,
      });
      setItems(res.data);
      setTotal(res.total ?? res.data.length);
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, q, status]);

  useEffect(() => { load(); }, [load]);

  const header = (
    <View>
      <View style={styles.pageHead}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={styles.eyebrow}>{total} {total === 1 ? "praticante" : "praticantes"}</Text>
          <Text style={styles.h1}>Praticantes</Text>
          <Text style={styles.sub}>Cadastro federativo e trajetórias de graduação.</Text>
        </View>
        <View style={styles.headActions}>
          <HeaderBtn icon="cloud-upload-outline" label="Importar" onPress={() => router.push("/karate/importacao" as any)} />
          <HeaderBtn icon="add" label="Novo praticante" primary onPress={() => router.push("/karate/praticantes/novo" as any)} />
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, código FPKT, CPF ou RG..."
          placeholderTextColor={KarateColors.ink4}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={() => load()}
          accessibilityLabel="Buscar praticantes"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />
        ))}
      </ScrollView>

      {wide && items.length > 0 && (
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Praticante</Text>
          <Text style={[styles.th, { flex: 1.4 }]}>Dojô</Text>
          <Text style={[styles.th, { width: 130 }]}>Graduação</Text>
          <Text style={[styles.th, { width: 110 }]}>Status</Text>
          <View style={{ width: 20 }} />
        </View>
      )}
    </View>
  );

  function Row({ item }: { item: PractitionerListItem }) {
    const onPress = () => router.push(`/karate/praticantes/${item.id}` as any);
    const av = (
      <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials(item.full_name)}</Text></View>
    );
    if (wide) {
      return (
        <TouchableOpacity style={styles.tr} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.full_name}, ${item.karate_registration_number}`}>
          <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 8 }}>
            {av}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
              <Text style={styles.regNum}>{item.karate_registration_number}</Text>
            </View>
          </View>
          <Text style={[styles.cell, { flex: 1.4 }]} numberOfLines={1}>{item.dojo_name || "—"}</Text>
          <View style={{ width: 130 }}>
            {item.belt_name ? <BeltBadge beltLevel={beltKey(item.belt_name)} beltName={item.belt_name} /> : <Text style={styles.cellMuted}>—</Text>}
          </View>
          <View style={{ width: 110 }}><Badge affiliationStatus={item.affiliation_status} /></View>
          <Ionicons name="chevron-forward" size={16} color={KarateColors.ink4} style={{ width: 20 }} />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${item.full_name}, ${item.karate_registration_number}`}>
        {av}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.regNum}>{item.karate_registration_number}</Text>
          <Text style={styles.dojoNameSm}>{item.dojo_name}</Text>
        </View>
        <View style={{ gap: 6, alignItems: "flex-end" }}>
          {item.belt_name ? <BeltBadge beltLevel={beltKey(item.belt_name)} beltName={item.belt_name} /> : null}
          <Badge affiliationStatus={item.affiliation_status} />
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
          data={items}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
          renderItem={({ item }) => <Row item={item} />}
          ListEmptyComponent={
            <KarateEmptyState icon="people-outline" title="Nenhum praticante encontrado" subtitle="Ajuste a busca/filtros, cadastre ou importe uma planilha." style={{ paddingVertical: 40 }} />
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

  tr:    { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 9 } as ViewStyle,
  th:    { fontSize: 10, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.6 } as TextStyle,
  cell:    { fontSize: 12.5, color: KarateColors.ink2 } as TextStyle,
  cellMuted:{ fontSize: 12.5, color: KarateColors.ink4 } as TextStyle,

  card:    { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 } as ViewStyle,
  avatar:  { width: 38, height: 38, borderRadius: 19, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  avatarTxt:{ fontSize: 13, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  name:    { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  regNum:  { fontSize: 11, fontWeight: "700", color: KarateColors.primary, fontFamily: "monospace", letterSpacing: 0.4, marginTop: 1 } as TextStyle,
  dojoNameSm: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
});
