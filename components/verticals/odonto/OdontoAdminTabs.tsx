// ============================================================
// AURA. — Odonto Admin Tab Wrappers (operational)
// OrcamentosTab, ConveniosTab, CheckinTab, EsperaTab
// Extracted from OdontoTabWrappers.tsx
// ============================================================
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";
import { OrcamentoFunnel } from "@/components/verticals/odonto/OrcamentoFunnel";
import { ConvenioManager } from "@/components/verticals/odonto/ConvenioManager";
import { TissGuideManager } from "@/components/verticals/odonto/TissGuideManager";
import { CheckinPaciente } from "@/components/verticals/odonto/CheckinPaciente";
import { ListaEsperaDental } from "@/components/verticals/odonto/ListaEsperaDental";

function useCompanyId() { return useAuthStore().company?.id; }
function Loader() { return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>; }

export function OrcamentosTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-treatment-plans", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/treatment-plans"); },
    enabled: !!cid, staleTime: 30000,
  });
  if (isLoading) return <Loader />;
  var plans = ((data as any)?.plans) || [];
  if (plans.length === 0) {
    return <View style={z.empty}><Icon name="file_text" size={24} color={Colors.ink3} /><Text style={z.emptyText}>Nenhum orcamento criado</Text><Text style={z.hintText}>Crie orcamentos pela aba Pacientes ou Odontograma.</Text></View>;
  }
  var funnelData = plans.map(function(p: any) {
    return { id: p.id, patient_name: p.patient_name || "", title: p.title || "Orcamento", total_amount: parseFloat(p.total_amount) || 0, status: p.status || "pending", items_done: parseInt(p.items_done) || 0, items_total: parseInt(p.items_total) || 0, created_at: p.created_at };
  });
  return <OrcamentoFunnel plans={funnelData} />;
}

export function ConveniosTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-insurance", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/insurance"); },
    enabled: !!cid, staleTime: 60000,
  });
  var { data: guides } = useQuery({
    queryKey: ["dental-tiss", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/insurance/guides"); },
    enabled: !!cid, staleTime: 60000,
  });
  if (isLoading) return <Loader />;
  var insurances = ((data as any)?.insurances) || [];
  var tissList = ((guides as any)?.guides) || [];
  return (
    <View style={{ gap: 16 }}>
      <ConvenioManager insurances={insurances} />
      {tissList.length > 0 && <TissGuideManager guides={tissList} />}
    </View>
  );
}

export function CheckinTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-checkin", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/advanced/checkins"); },
    enabled: !!cid, staleTime: 10000,
  });
  if (isLoading) return <Loader />;
  var checkins = ((data as any)?.checkins) || [];
  var stats = (data as any)?.stats || { waiting: 0, called: 0, in_service: 0, completed: 0 };
  return <CheckinPaciente checkins={checkins} stats={stats} />;
}

export function EsperaTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-waitlist", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/advanced/waitlist"); },
    enabled: !!cid, staleTime: 15000,
  });
  if (isLoading) return <Loader />;
  var entries = ((data as any)?.entries) || [];
  return <ListaEsperaDental entries={entries} />;
}

var z = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  hintText: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
});
