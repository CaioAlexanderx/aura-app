// ============================================================
// Dojôs — Lista — Aura Karatê
//
// Wired ao endpoint GET /federation/{id}/dojos.
// MOCK ativo (fallback) enquanto backend não responder.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, RefreshControl,
  ViewStyle, TextStyle, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, Dojo, DojoStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// MOCK
const MOCK_DOJOS: Dojo[] = [
  { id: "d1", fpkt_affiliation_id: "FPKT-001", name: "Dojô Shotokan ABC", cnpj: null, sensei_cpf: null, region: "São Paulo", affiliation_model: "annual", affiliation_since: "2020-01-15", dojo_founded_year: 2010, address: "Rua das Flores, 100", phone: "11 9999-0001", email: "abc@shotokan.com", status: "active", practitioner_count: 48 },
  { id: "d2", fpkt_affiliation_id: "FPKT-002", name: "Dojô Karatê Esperança", cnpj: null, sensei_cpf: null, region: "Campinas", affiliation_model: "biannual", affiliation_since: "2019-06-01", dojo_founded_year: 2005, address: "Av. Brasil, 200", phone: "19 8888-0002", email: null, status: "overdue", practitioner_count: 32 },
  { id: "d3", fpkt_affiliation_id: "FPKT-003", name: "Dojô Bushido São Bernardo", cnpj: "12.345.678/0001-99", sensei_cpf: null, region: "ABC Paulista", affiliation_model: "annual", affiliation_since: "2022-03-10", dojo_founded_year: 2018, address: null, phone: null, email: null, status: "expiring", practitioner_count: 21 },
];

function DojoCard({ dojo, onPress }: { dojo: Dojo; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${dojo.name}, ${dojo.fpkt_affiliation_id}`}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dojoId}>{dojo.fpkt_affiliation_id}</Text>
          <Text style={styles.dojoName}>{dojo.name}</Text>
        </View>
        <Badge dojoStatus={dojo.status as DojoStatus} />
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={12} color={KarateColors.ink3} />
          <Text style={styles.metaText}>{dojo.region}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={12} color={KarateColors.ink3} />
          <Text style={styles.metaText}>{dojo.practitioner_count} praticantes</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DojosScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const result = await karateApi.listDojos(federationId, { q }).catch(() => ({ data: MOCK_DOJOS, page: 1, page_size: 25, total: MOCK_DOJOS.length }));
      setDojos(result.data);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, q]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.screen}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou FPKT-ID..."
          placeholderTextColor={KarateColors.ink4}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={() => load()}
          accessibilityLabel="Buscar dojôs"
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={KarateColors.primary} />
      ) : dojos.length === 0 ? (
        <KarateEmptyState icon="home-outline" title="Nenhum dojô encontrado" subtitle="Tente outro termo ou cadastre um novo dojô." />
      ) : (
        <FlatList
          data={dojos}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
          renderItem={({ item }) => (
            <DojoCard
              dojo={item}
              onPress={() => router.push(`/(karate)/dojos/${item.id}` as any)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(karate)/dojos/novo" as any)}
        accessibilityRole="button"
        accessibilityLabel="Cadastrar novo dojô"
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  searchBar:   { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, paddingHorizontal: 12, paddingVertical: 10 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, minHeight: 24 } as ViewStyle,
  list:        { paddingHorizontal: 16, paddingBottom: 96, gap: 10 } as ViewStyle,
  card:        { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  cardHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  dojoId:      { fontSize: 10, fontWeight: "800", color: KarateColors.primary, letterSpacing: 0.8, fontFamily: "monospace" } as TextStyle,
  dojoName:    { fontSize: 15, fontWeight: "700", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  cardMeta:    { flexDirection: "row", gap: 16 } as ViewStyle,
  metaItem:    { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  metaText:    { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: KarateColors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  } as ViewStyle,
});
