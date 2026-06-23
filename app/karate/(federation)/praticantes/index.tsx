// ============================================================
// Praticantes — Lista — Aura Karatê (federação) · Shoji
// Fiel ao pane "alunos" do standalone v5. Dados reais.
// Tocar numa linha → DETALHE full-page (trajetória, carteirinha, transferências).
// "Novo praticante" → MODAL (cadastro rápido).
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
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
  ShojiBackground, PageHead, SearchField, Chip, ShojiBadge, BeltTag, Avatar, ShojiButton, Mono, Body,
} from "@/components/karate/shoji";
import PraticanteFichaModal from "@/components/karate/PraticanteFichaModal";
import { karateApi, PractitionerListItem, AffiliationStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const STATUS_FILTERS: { key: AffiliationStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" }, { key: "active", label: "Em dia" }, { key: "pending", label: "Pendente" }, { key: "inactive", label: "Inativo" },
];

export default function PraticantesScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  const [items, setItems] = useState<PractitionerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AffiliationStatus | "all">("all");
  // Modal da ficha: usado SÓ para cadastro rápido ("Novo praticante").
  const [modal, setModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listPractitioners(federationId, { q: q || undefined, affiliation_status: status === "all" ? undefined : status, pageSize: 100 });
      setItems(res.data); setTotal(res.total ?? res.data.length);
    } catch { setError(true); }
    finally { isRefresh ? setRefreshing(false) : setLoading(false); }
  }, [federationId, q, status]);
  useEffect(() => { load(); }, [load]);

  const header = (
    <View>
      <PageHead
        eyebrow={`${total} ${total === 1 ? "praticante" : "praticantes"} · carteirinha FPKT`}
        title="Praticantes"
        sub="Cadastro federativo de praticantes ativos e suas trajetórias de graduação."
        actions={<>
          <ShojiButton label="Importar" icon="cloud-upload-outline" variant="ghost" onPress={() => router.push("/karate/importacao" as any)} />
          <ShojiButton label="Novo praticante" icon="add" variant="sumi" onPress={() => setModal({ open: true, id: null })} />
        </>}
      />
      <SearchField value={q} onChangeText={setQ} onSubmit={() => load()} placeholder="Buscar por nome, código FPKT, CPF ou RG..." style={{ marginBottom: 14 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((s) => <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />)}
      </ScrollView>
      {wide && items.length > 0 && (
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Praticante</Text>
          <Text style={[styles.th, { flex: 1.4 }]}>Dojô</Text>
          <Text style={[styles.th, { width: 150 }]}>Graduação</Text>
          <Text style={[styles.th, { width: 120 }]}>Status</Text>
          <View style={{ width: 18 }} />
        </View>
      )}
    </View>
  );

  function Row({ item }: { item: PractitionerListItem }) {
    const onPress = () => router.push(`/karate/praticantes/${item.id}` as any);
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
        <Ionicons name="chevron-forward" size={16} color={C.ink4} style={{ width: 18 }} />
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
      {loading ? (
        <View style={styles.content}>{header}<ActivityIndicator style={{ marginTop: 48 }} size="large" color={P.red} /></View>
      ) : (
        <FlatList
          data={items} keyExtractor={(i) => i.id} ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
          renderItem={({ item }) => <Row item={item} />}
          ListEmptyComponent={<KarateEmptyState icon="people-outline" title="Nenhum praticante encontrado" subtitle="Ajuste a busca/filtros, cadastre ou importe uma planilha." style={{ paddingVertical: 40 }} />}
        />
      )}
      {fichaModal}
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 48, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  chips: { gap: 8, paddingBottom: 18, alignItems: "center" } as ViewStyle,
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 8 } as ViewStyle,
  thead: { paddingVertical: 10 } as ViewStyle,
  th: { fontFamily: F.body, fontSize: 10, fontWeight: "600", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  cell: { fontSize: 12.5 } as TextStyle,
  name: { fontFamily: F.body, fontSize: 14, fontWeight: "600", color: C.ink } as TextStyle,
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 14, marginBottom: 10 } as ViewStyle,
});
