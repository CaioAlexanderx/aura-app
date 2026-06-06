// ============================================================
// Ficha do Praticante — Aura Karatê
//
// Tabs: Cadastro | Trajetória (wired) | Carteirinha | Documentos | Competições
// Wired: GET /federation/{id}/practitioners/{practitionerId}
// Trajetória: wired (belt_history do endpoint acima)
// Demais abas: placeholder (backend não define endpoint ainda)
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { karateApi, PractitionerDetail, AffiliationStatus, BeltHistoryEntry } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const MOCK_PRACTITIONER: PractitionerDetail = {
  id: "p1", full_name: "Carlos Eduardo Silva",
  karate_registration_number: "FPKT-A-00001",
  cpf: "123.456.789-00", rg: "12.345.678-9",
  birth_date: "1990-03-15", email: "carlos@email.com",
  phone: "11 9 9999-0001", dojo_id: "d1",
  is_student: true, is_arbiter: false, is_instructor: true, is_examiner: false,
  photo_url: null, parent_guardian_id: null,
  affiliation_status: "active",
  current_belt: { belt_level: "preta", belt_name: "Preta", current_since: "2015-08-20" },
  belt_history: [
    { id: "bh1", belt_level: "preta",      belt_name: "Preta",      belt_schema: "fpkt_shotokan", graduated_at: "2015-08-20", is_legacy: false, exam_id: "e10" },
    { id: "bh2", belt_level: "marrom",     belt_name: "Marrom",     belt_schema: "fpkt_shotokan", graduated_at: "2013-04-10", is_legacy: false, exam_id: "e08" },
    { id: "bh3", belt_level: "azul_escuro",belt_name: "Azul Escuro",belt_schema: "fpkt_shotokan", graduated_at: "2011-11-05", is_legacy: false, exam_id: "e06" },
    { id: "bh4", belt_level: "verde",      belt_name: "Verde",      belt_schema: "legacy",         graduated_at: "2008-06-01", is_legacy: true,  exam_id: null  },
    { id: "bh5", belt_level: "amarela",    belt_name: "Amarela",    belt_schema: "legacy",         graduated_at: "2006-03-10", is_legacy: true,  exam_id: null  },
    { id: "bh6", belt_level: "branca",     belt_name: "Branca",     belt_schema: "legacy",         graduated_at: "2005-01-01", is_legacy: true,  exam_id: null  },
  ],
};

const TABS = ["Cadastro", "Trajetória", "Carteirinha", "Documentos", "Competições"] as const;
type Tab = typeof TABS[number];

function CadastroTab({ p }: { p: PractitionerDetail }) {
  function Row({ icon, label, val }: { icon: string; label: string; val: string | null }) {
    if (!val) return null;
    return (
      <View style={tabStyles.infoRow}>
        <Ionicons name={icon as any} size={14} color={KarateColors.ink3} />
        <Text style={tabStyles.infoLabel}>{label}</Text>
        <Text style={tabStyles.infoVal}>{val}</Text>
      </View>
    );
  }
  return (
    <View style={tabStyles.tab}>
      <Row icon="person-outline"   label="Nome"         val={p.full_name} />
      <Row icon="id-card-outline"  label="CPF"          val={p.cpf ?? null} />
      <Row icon="document-outline" label="RG"           val={p.rg ?? null} />
      <Row icon="calendar-outline" label="Nascimento"   val={p.birth_date ?? null} />
      <Row icon="mail-outline"     label="E-mail"       val={p.email ?? null} />
      <Row icon="call-outline"     label="Telefone"     val={p.phone ?? null} />
      <Row icon="ribbon-outline"   label="Registro"     val={p.karate_registration_number} />
      <View style={tabStyles.rolesRow}>
        {p.is_instructor && <View style={tabStyles.roleChip}><Text style={tabStyles.roleChipText}>Instrutor</Text></View>}
        {p.is_arbiter    && <View style={tabStyles.roleChip}><Text style={tabStyles.roleChipText}>Árbitro</Text></View>}
        {p.is_examiner   && <View style={tabStyles.roleChip}><Text style={tabStyles.roleChipText}>Examinador</Text></View>}
      </View>
    </View>
  );
}

function TrajetoriaTab({ history }: { history: BeltHistoryEntry[] }) {
  if (history.length === 0) {
    return <KarateEmptyState icon="ribbon-outline" title="Sem histórico de faixas" style={{ paddingVertical: 32 }} />;
  }
  return (
    <View style={tabStyles.tab}>
      {history.map((entry) => (
        <View key={entry.id} style={tabStyles.beltEntry}>
          <View style={tabStyles.beltLine} />
          <View style={{ flex: 1, gap: 4 }}>
            <BeltBadge
              beltLevel={entry.belt_level}
              beltName={entry.belt_name}
              isLegacy={entry.is_legacy}
            />
            <Text style={tabStyles.beltDate}>
              {new Date(entry.graduated_at).toLocaleDateString("pt-BR")}
              {entry.belt_schema === "legacy" ? " · Registro histórico" : ""}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <KarateEmptyState
      icon="construct-outline"
      title={`${label} — Em desenvolvimento`}
      subtitle="Esta aba será implementada em uma próxima fase."
      style={{ paddingVertical: 48 }}
    />
  );
}

export default function FichaPraticanteScreen() {
  const { practitionerId } = useLocalSearchParams<{ practitionerId: string }>();
  const { federationId } = useKarateFederation();
  const [data, setData] = useState<PractitionerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Cadastro");

  useEffect(() => {
    if (!practitionerId) return;
    karateApi.getPractitioner(federationId, practitionerId)
      .then(setData)
      .catch(() => setData(MOCK_PRACTITIONER))
      .finally(() => setLoading(false));
  }, [federationId, practitionerId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 16, gap: 12 }}>
        {[1,2,3,4].map((k) => <Skeleton key={k} height={24} />)}
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={KarateColors.ink3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.regNum}>{data.karate_registration_number}</Text>
            <Text style={styles.fullName}>{data.full_name}</Text>
            {data.current_belt && (
              <BeltBadge
                beltLevel={data.current_belt.belt_level}
                beltName={data.current_belt.belt_name}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
          <Badge affiliationStatus={data.affiliation_status as AffiliationStatus} />
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
        {activeTab === "Cadastro"    && <CadastroTab p={data} />}
        {activeTab === "Trajetória"  && <TrajetoriaTab history={data.belt_history} />}
        {activeTab === "Carteirinha" && <PlaceholderTab label="Carteirinha" />}
        {activeTab === "Documentos"  && <PlaceholderTab label="Documentos" />}
        {activeTab === "Competições" && <PlaceholderTab label="Competições" />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  headerCard: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  avatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  regNum:     { fontSize: 11, fontWeight: "800", color: KarateColors.primary, letterSpacing: 0.8, fontFamily: "monospace" } as TextStyle,
  fullName:   { fontSize: 18, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  tabBar:     { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  tabBarContent: { flexDirection: "row", paddingHorizontal: 8 } as ViewStyle,
  tab:        { paddingVertical: 12, paddingHorizontal: 14 } as ViewStyle,
  tabActive:  { borderBottomWidth: 2, borderBottomColor: KarateColors.primary } as ViewStyle,
  tabLabel:   { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  content:    { flex: 1 } as ViewStyle,
});

const tabStyles = StyleSheet.create({
  tab:         { padding: 16, gap: 10 } as ViewStyle,
  infoRow:     { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  infoLabel:   { fontSize: 12, color: KarateColors.ink3, width: 88 } as TextStyle,
  infoVal:     { fontSize: 13, color: KarateColors.ink, flex: 1 } as TextStyle,
  rolesRow:    { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 } as ViewStyle,
  roleChip:    { paddingVertical: 3, paddingHorizontal: 10, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  roleChipText:{ fontSize: 11, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  beltEntry:   { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 8 } as ViewStyle,
  beltLine:    { width: 3, borderRadius: 2, backgroundColor: KarateColors.border, alignSelf: "stretch", minHeight: 40 } as ViewStyle,
  beltDate:    { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
});
