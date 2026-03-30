import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { IS_WIDE, fmt } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { TabBar } from "@/components/TabBar";
import { HoverCard } from "@/components/HoverCard";
import { HoverRow } from "@/components/HoverRow";
import { DemoBanner } from "@/components/DemoBanner";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";

const TABS = ["Emitidas", "Pendentes"];

const MOCK_NFES = [
  { id: "1", number: "000042", client: "Tech Solutions Ltda", amount: 4500.00, date: "28/03/2026", status: "authorized" as const, type: "NF-e" },
  { id: "2", number: "000041", client: "Comercio Boa Vista ME", amount: 1230.50, date: "25/03/2026", status: "authorized" as const, type: "NF-e" },
  { id: "3", number: "000040", client: "Studio Design Ltda", amount: 890.00, date: "20/03/2026", status: "authorized" as const, type: "NFS-e" },
  { id: "4", number: "000039", client: "Padaria Central ME", amount: 567.80, date: "18/03/2026", status: "cancelled" as const, type: "NF-e" },
];

const MOCK_PENDING = [
  { id: "p1", client: "Nova Empresa Ltda", amount: 2100.00, reason: "Aguardando dados fiscais do cliente" },
  { id: "p2", client: "Servicos Rapidos ME", amount: 750.00, reason: "CNPJ do cliente em validacao" },
];

const statusMap = { authorized: { label: "Autorizada", color: Colors.green }, cancelled: { label: "Cancelada", color: Colors.red }, pending: { label: "Pendente", color: Colors.amber } };

export default function NfeScreen() {
  const { isDemo } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const hasData = isDemo; // In production: check real NF-e count

  if (!hasData) {
    return (
      <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
        <PageHeader title="NF-e" />
        <EmptyState
          icon="file_text"
          title="Nenhuma nota fiscal emitida"
          description="As notas fiscais serao emitidas automaticamente a cada venda PJ. Configure sua empresa para comecar."
          actionLabel="Ir para o PDV"
          onAction={() => router.push("/pdv" as any)}
          secondaryLabel="Configurar empresa"
          onSecondary={() => router.push("/onboarding" as any)}
        />
      </ScrollView>
    );
  }

  const emitted = MOCK_NFES.length;
  const totalMonth = MOCK_NFES.filter(n => n.status === "authorized").reduce((s, n) => s + n.amount, 0);

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="NF-e" />

      <View style={z.kpis}>
        <View style={z.kpi}><Icon name="file_text" size={20} color={Colors.violet3} /><Text style={z.kv}>{emitted}</Text><Text style={z.kl}>Emitidas no mes</Text></View>
        <View style={z.kpi}><Icon name="dollar" size={20} color={Colors.green} /><Text style={z.kv}>{fmt(totalMonth)}</Text><Text style={z.kl}>Total faturado</Text></View>
        <View style={z.kpi}><Icon name="alert" size={20} color={Colors.amber} /><Text style={z.kv}>{MOCK_PENDING.length}</Text><Text style={z.kl}>Pendentes</Text></View>
      </View>

      <View style={z.configCard}>
        <Icon name="check" size={16} color={Colors.green} />
        <Text style={z.configText}>Configuracao fiscal ativa. CNAE, ISS e aliquotas configurados via CNPJ.</Text>
      </View>

      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {tab === 0 && (
        <View>
          {MOCK_NFES.map(nf => {
            const st = statusMap[nf.status];
            return (
              <HoverRow key={nf.id} style={z.nfRow}>
                <View style={z.nfLeft}>
                  <View style={z.nfIcon}><Icon name="file_text" size={16} color={Colors.violet3} /></View>
                  <View style={z.nfInfo}>
                    <Text style={z.nfNumber}>#{nf.number} - {nf.type}</Text>
                    <Text style={z.nfClient}>{nf.client}</Text>
                    <Text style={z.nfDate}>{nf.date}</Text>
                  </View>
                </View>
                <View style={z.nfRight}>
                  <Text style={z.nfAmount}>{fmt(nf.amount)}</Text>
                  <View style={[z.nfBadge, { backgroundColor: st.color + "18" }]}><Text style={[z.nfBadgeText, { color: st.color }]}>{st.label}</Text></View>
                </View>
              </HoverRow>
            );
          })}
        </View>
      )}

      {tab === 1 && (
        <View>
          {MOCK_PENDING.map(p => (
            <HoverCard key={p.id} style={z.pendCard}>
              <View style={z.pendTop}>
                <Text style={z.pendClient}>{p.client}</Text>
                <Text style={z.pendAmount}>{fmt(p.amount)}</Text>
              </View>
              <Text style={z.pendReason}>{p.reason}</Text>
              <Pressable style={z.pendBtn}><Text style={z.pendBtnText}>Emitir nota</Text></Pressable>
            </HoverCard>
          ))}
        </View>
      )}

      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  kpis: { flexDirection: "row", gap: 10, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 6 },
  kv: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  kl: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  configCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.green + "33" },
  configText: { fontSize: 12, color: Colors.green, fontWeight: "500", flex: 1 },
  nfRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  nfLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  nfIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  nfInfo: { gap: 2 },
  nfNumber: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  nfClient: { fontSize: 12, color: Colors.ink3 },
  nfDate: { fontSize: 10, color: Colors.ink3 },
  nfRight: { alignItems: "flex-end", gap: 4 },
  nfAmount: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  nfBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  nfBadgeText: { fontSize: 9, fontWeight: "600" },
  pendCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  pendTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  pendClient: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  pendAmount: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  pendReason: { fontSize: 12, color: Colors.amber, marginBottom: 12 },
  pendBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16, alignSelf: "flex-start" },
  pendBtnText: { fontSize: 12, color: "#fff", fontWeight: "600" },
});
