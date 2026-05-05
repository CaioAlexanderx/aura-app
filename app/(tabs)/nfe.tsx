import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { nfceApi, type NfceEmission, type NfceStatus } from "@/services/nfceApi";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";
import { ListSkeleton } from "@/components/ListSkeleton";
import { TABS, STATUS_MAP, EmissionRow, fmt, ns, openDanfe } from "@/components/screens/nfe/shared";
import { EmitNfseForm } from "@/components/screens/nfe/EmitNfseForm";
import { EmitNfceForm } from "@/components/screens/nfe/EmitNfceForm";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";

// Mai/2026: aba "Configuração" removida (cadastro de certificado A1 vai
// manualmente via console da Nuvem Fiscal). Documentos agora consome
// /companies/:id/nfce do backend (rota nova com schema infNFe correto).
function NfeScreenInner() {
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<NfceEmission | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [tipoFilter, setTipoFilter] = useState<"all" | "nfce" | "nfe">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | NfceStatus>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["nfce-emissions", company?.id],
    queryFn: () => nfceApi.list(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 15000,
  });
  const emissions: NfceEmission[] = data?.emissions || [];
  const stats = data?.stats;

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      nfceApi.cancel(company!.id, id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nfce-emissions", company?.id] });
      toast.success("Nota cancelada");
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cancelar"),
  });

  const totalEmitted    = stats?.total ?? emissions.length;
  const totalProcessing = emissions.filter(e => e.status === "processando").length;
  const totalRevenue    = stats?.total_value ?? emissions
    .filter(e => e.status === "autorizada")
    .reduce((s, e) => s + Number(e.total_nfce || 0), 0);

  const filtered = emissions.filter(e => {
    if (tipoFilter !== "all" && e.tipo !== tipoFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  function handleViewEmission(emission: NfceEmission) {
    if (emission.pdf_url) {
      openDanfe(emission.pdf_url);
      return;
    }
    if (emission.error_message) {
      toast.error(emission.error_message);
      return;
    }
    const label = STATUS_MAP[emission.status]?.label || emission.status;
    toast.info(`${label}${emission.protocolo ? " · Protocolo " + emission.protocolo : ""}`);
  }

  function handleConfirmCancel() {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 15) {
      toast.error("O motivo precisa ter ao menos 15 caracteres (regra SEFAZ)");
      return;
    }
    cancelMut.mutate({ id: cancelTarget.id, reason: cancelReason.trim() });
  }

  return (
    <ScrollView style={s.scr} contentContainerStyle={s.cnt}>
      <PageHeader title="Notas fiscais" subtitle="NFC-e (consumidor) e NF-e (B2B) via Nuvem Fiscal" />

      <View style={s.kpis}>
        <View style={s.kpi}>
          <Text style={s.kv}>{totalEmitted}</Text>
          <Text style={s.kl}>Emitidas</Text>
        </View>
        <View style={s.kpi}>
          <Text style={[s.kv, { color: Colors.green }]}>{fmt(totalRevenue)}</Text>
          <Text style={s.kl}>Faturado</Text>
        </View>
        <View style={s.kpi}>
          <Text style={[s.kv, { color: totalProcessing > 0 ? Colors.amber : Colors.green }]}>
            {totalProcessing}
          </Text>
          <Text style={s.kl}>Processando</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 12 }}
        contentContainerStyle={{ flexDirection: "row", gap: 6, paddingRight: 20 }}>
        {TABS.map((t, i) => (
          <Pressable key={t} onPress={() => setTab(i)} style={[s.tab, tab === i && s.tabActive]}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading && tab === 0 && <ListSkeleton rows={4} />}

      {tab === 0 && !isLoading && (
        <View>
          {emissions.length === 0 ? (
            <EmptyState
              icon="file_text"
              iconColor={Colors.violet3}
              title="Nenhuma nota fiscal emitida"
              subtitle="Use as abas acima para emitir sua primeira NFC-e ou NFS-e."
            />
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {(["all", "nfce", "nfe"] as const).map(t => (
                  <Pressable key={t} onPress={() => setTipoFilter(t)} style={[ns.chip, tipoFilter === t && ns.chipActive]}>
                    <Text style={[ns.chipText, tipoFilter === t && ns.chipTextActive]}>
                      {t === "all" ? "Todas" : t.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
                {(["all", "autorizada", "processando", "cancelada", "rejeitada", "erro"] as const).map(st => (
                  <Pressable key={st} onPress={() => setStatusFilter(st)} style={[ns.chip, statusFilter === st && ns.chipActive]}>
                    <Text style={[ns.chipText, statusFilter === st && ns.chipTextActive]}>
                      {st === "all" ? "Todos" : STATUS_MAP[st]?.label || st}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={ns.listCard}>
                {filtered.map(e => (
                  <EmissionRow
                    key={e.id}
                    emission={e}
                    onCancel={() => { setCancelTarget(e); setCancelReason(""); }}
                    onView={() => handleViewEmission(e)}
                  />
                ))}
                {filtered.length === 0 && (
                  <View style={{ alignItems: "center", paddingVertical: 30 }}>
                    <Text style={{ fontSize: 12, color: Colors.ink3 }}>Nenhuma nota com este filtro</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      )}

      {tab === 1 && company?.id && <EmitNfseForm companyId={company.id} />}
      {tab === 2 && company?.id && <EmitNfceForm companyId={company.id} />}

      {/* Modal inline de cancelamento (com input para motivo, regra SEFAZ ≥ 15 chars) */}
      {cancelTarget && (
        <View style={s.modalOverlay}>
          <Pressable style={s.modalBackdrop} onPress={() => { setCancelTarget(null); setCancelReason(""); }} />
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Cancelar nota fiscal?</Text>
            <Text style={s.modalDesc}>
              {cancelTarget.tipo === "nfe" ? "NF-e" : "NFC-e"} #{cancelTarget.numero} · {fmt(cancelTarget.total_nfce)}.
              A SEFAZ exige um motivo (mín. 15 caracteres). Esta ação não pode ser desfeita.
            </Text>
            <TextInput
              style={[ns.fInput, { minHeight: 80, marginTop: 4 }]}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ex: Erro de digitação no valor / produto trocado..."
              placeholderTextColor={Colors.ink3}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ fontSize: 10, color: Colors.ink3 }}>{cancelReason.trim().length} / 15</Text>
              <Text style={{ fontSize: 10, color: cancelReason.trim().length >= 15 ? Colors.green : Colors.amber }}>
                {cancelReason.trim().length >= 15 ? "OK" : "Faltam " + Math.max(0, 15 - cancelReason.trim().length) + " caracteres"}
              </Text>
            </View>
            <View style={s.modalActions}>
              <Pressable style={s.modalCancelBtn}
                onPress={() => { setCancelTarget(null); setCancelReason(""); }}>
                <Text style={s.modalCancelText}>Voltar</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirmBtn, (cancelReason.trim().length < 15 || cancelMut.isPending) && { opacity: 0.5 }]}
                disabled={cancelReason.trim().length < 15 || cancelMut.isPending}
                onPress={handleConfirmCancel}>
                <Text style={s.modalConfirmText}>{cancelMut.isPending ? "Cancelando..." : "Cancelar nota"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

export default function NfeScreen() {
  return (
    <RequireCompanyScope context="nfe" actionLabel="emitir nota fiscal">
      <NfeScreenInner />
    </RequireCompanyScope>
  );
}

const s = StyleSheet.create({
  scr: { flex: 1 },
  cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kv: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  kl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },

  modalOverlay: {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center", alignItems: "center",
    zIndex: 9999,
  },
  modalBackdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalCard: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 24,
    maxWidth: 460,
    width: "92%",
    borderWidth: 1,
    borderColor: Colors.border2,
    zIndex: 10000,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  modalDesc: { fontSize: 13, color: Colors.ink3, lineHeight: 20, marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  modalCancelText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: Colors.red, alignItems: "center",
  },
  modalConfirmText: { fontSize: 14, color: "#fff", fontWeight: "700" },
});
