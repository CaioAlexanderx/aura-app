import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { nfeApi } from "@/services/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { ListSkeleton } from "@/components/ListSkeleton";
import { TABS, STATUS_MAP, DocRow, fmt, ns } from "@/components/screens/nfe/shared";
import type { NfeDoc } from "@/components/screens/nfe/shared";
import { EmitNfseForm } from "@/components/screens/nfe/EmitNfseForm";
import { EmitNfceForm } from "@/components/screens/nfe/EmitNfceForm";
import { TabConfig } from "@/components/screens/nfe/TabConfig";

export default function NfeScreen() {
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["nfe-docs", company?.id],
    queryFn: () => nfeApi.list(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 15000,
  });
  const docs: NfeDoc[] = data?.documents || [];

  const cancelMut = useMutation({
    mutationFn: (ref: string) => nfeApi.cancel(company!.id, ref),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nfe-docs", company?.id] }); toast.success("Documento cancelado"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao cancelar"),
  });

  const authorized = docs.filter(d => d.status === "authorized");
  const totalMonth = authorized.reduce((s, d) => s + Number(d.value || 0), 0);
  const pending = docs.filter(d => d.status === "pending" || d.status === "processing").length;
  const filtered = docs.filter(d => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    return true;
  });

  async function handleViewDoc(ref: string) {
    try {
      const doc = await nfeApi.get(company!.id, ref);
      if (doc.pdf_url && Platform.OS === "web") { window.open(doc.pdf_url, "_blank"); return; }
      toast.info(`Status: ${STATUS_MAP[doc.status]?.label || doc.status}${doc.number ? " | Numero: " + doc.number : ""}`);
    } catch { toast.error("Erro ao consultar documento"); }
  }

  return (
    <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
      <PageHeader title="NF-e" />
      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kv}>{docs.length}</Text><Text style={s.kl}>Emitidas</Text></View>
        <View style={s.kpi}><Text style={[s.kv, { color: Colors.green }]}>{fmt(totalMonth)}</Text><Text style={s.kl}>Faturado</Text></View>
        <View style={s.kpi}><Text style={[s.kv, { color: pending > 0 ? Colors.amber : Colors.green }]}>{pending}</Text><Text style={s.kl}>Pendentes</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingRight: 20 }}>
        {TABS.map((t, i) => <Pressable key={t} onPress={() => setTab(i)} style={[s.tab, tab === i && s.tabActive]}><Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text></Pressable>)}
      </ScrollView>
      {isLoading && tab === 0 && <ListSkeleton rows={4} />}
      {tab === 0 && !isLoading && (
        <View>
          {docs.length === 0 ? (
            <EmptyState icon="file_text" iconColor={Colors.violet3} title="Nenhuma nota fiscal" subtitle="Emita sua primeira NFS-e ou NFC-e usando as abas acima." />
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {["all","nfse","nfce"].map(t => <Pressable key={t} onPress={() => setTypeFilter(t)} style={[ns.chip, typeFilter === t && ns.chipActive]}><Text style={[ns.chipText, typeFilter === t && ns.chipTextActive]}>{t === "all" ? "Todas" : t.toUpperCase()}</Text></Pressable>)}
                {["all","authorized","pending","cancelled"].map(st => <Pressable key={st} onPress={() => setStatusFilter(st)} style={[ns.chip, statusFilter === st && ns.chipActive]}><Text style={[ns.chipText, statusFilter === st && ns.chipTextActive]}>{st === "all" ? "Todos" : STATUS_MAP[st]?.label || st}</Text></Pressable>)}
              </View>
              <View style={ns.listCard}>
                {filtered.map(d => <DocRow key={d.id} doc={d} onCancel={() => setCancelTarget(d.ref)} onView={() => handleViewDoc(d.ref)} />)}
                {filtered.length === 0 && <View style={{ alignItems: "center", paddingVertical: 30 }}><Text style={{ fontSize: 12, color: Colors.ink3 }}>Nenhum documento com este filtro</Text></View>}
              </View>
            </>
          )}
        </View>
      )}
      {tab === 1 && company?.id && <EmitNfseForm companyId={company.id} />}
      {tab === 2 && company?.id && <EmitNfceForm companyId={company.id} />}
      {tab === 3 && company?.id && <TabConfig companyId={company.id} />}
      <ConfirmDialog visible={!!cancelTarget} title="Cancelar nota fiscal?" message="O cancelamento sera enviado a SEFAZ. Esta acao nao pode ser desfeita." confirmLabel="Cancelar nota" destructive
        onConfirm={() => { if (cancelTarget) { cancelMut.mutate(cancelTarget); setCancelTarget(null); } }} onCancel={() => setCancelTarget(null)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scr: { flex: 1 }, cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kv: { fontSize: 20, fontWeight: "800", color: Colors.ink }, kl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" }, tabTextActive: { color: "#fff", fontWeight: "600" },
});
