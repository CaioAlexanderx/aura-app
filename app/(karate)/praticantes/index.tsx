// ============================================================
// Praticantes — Lista — Aura Karatê
//
// Wired ao GET /federation/{id}/practitioners.
// MOCK ativo enquanto backend não responder.
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
import { BeltBadge } from "@/components/karate/BeltBadge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { karateApi, PractitionerListItem, AffiliationStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const MOCK_PRACTITIONERS: PractitionerListItem[] = [
  { id: "p1", full_name: "Carlos Eduardo Silva", karate_registration_number: "FPKT-A-00001", dojo_name: "Dojô Shotokan ABC", belt_name: "Preta", affiliation_status: "active" },
  { id: "p2", full_name: "Maria José Santos", karate_registration_number: "FPKT-A-00002", dojo_name: "Dojô Karatê Esperança", belt_name: "Verde", affiliation_status: "active" },
  { id: "p3", full_name: "Lucas Pereira Oliveira", karate_registration_number: "FPKT-A-00003", dojo_name: "Dojô Shotokan ABC", belt_name: null, affiliation_status: "pending" },
  { id: "p4", full_name: "Ana Clara Mendes", karate_registration_number: "FPKT-A-00004", dojo_name: "Dojô Bushido São Bernardo", belt_name: "Amarela", affiliation_status: "inactive" },
];

function PractitionerRow({ item, onPress }: { item: PractitionerListItem; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${item.full_name}, ${item.karate_registration_number}`}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={18} color={KarateColors.ink3} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.name}>{item.full_name}</Text>
        <Text style={styles.regNum}>{item.karate_registration_number}</Text>
        <Text style={styles.dojoName}>{item.dojo_name}</Text>
      </View>
      <View style={{ gap: 6, alignItems: "flex-end" }}>
        {item.belt_name && (
          <BeltBadge beltLevel={item.belt_name.toLowerCase().replace(" ", "_")} beltName={item.belt_name} />
        )}
        <Badge affiliationStatus={item.affiliation_status as AffiliationStatus} />
      </View>
    </TouchableOpacity>
  );
}

export default function PraticantesScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [items, setItems] = useState<PractitionerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await karateApi.listPractitioners(federationId, { q }).catch(() => ({
        data: MOCK_PRACTITIONERS, page: 1, page_size: 25, total: MOCK_PRACTITIONERS.length,
      }));
      setItems(res.data);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId, q]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, CPF ou FPKT-A..."
          placeholderTextColor={KarateColors.ink4}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={() => load()}
          accessibilityLabel="Buscar praticantes"
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={KarateColors.primary} />
      ) : items.length === 0 ? (
        <KarateEmptyState icon="people-outline" title="Nenhum praticante encontrado" subtitle="Tente outro termo ou importe uma planilha." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
          renderItem={({ item }) => (
            <PractitionerRow
              item={item}
              onPress={() => router.push(`/(karate)/praticantes/${item.id}` as any)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(karate)/praticantes/novo" as any)}
        accessibilityRole="button"
        accessibilityLabel="Cadastrar novo praticante"
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
  row:         { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  name:        { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  regNum:      { fontSize: 11, fontWeight: "700", color: KarateColors.primary, fontFamily: "monospace", letterSpacing: 0.5 } as TextStyle,
  dojoName:    { fontSize: 11, color: KarateColors.ink3 } as TextStyle,
  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: KarateColors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  } as ViewStyle,
});
