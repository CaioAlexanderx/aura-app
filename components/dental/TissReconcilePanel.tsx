import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";
import { MarkTissGuidePaidModal, type PendingTissGuide } from "@/components/dental/MarkTissGuidePaidModal";

// ============================================================
// TissReconcilePanel — lista guias TISS pendentes de reconciliacao
// (status enviada/autorizada/pendente_auth) e permite marcar paga.
//
// Renderizado como tab "Reconciliar TISS" em
// app/dental/(clinic)/faturamento.tsx.
//
// Modal MarkTissGuidePaidModal cuida do fluxo de pagamento.
// Trigger 067 cria transaction (receita_tiss) automaticamente.
// ============================================================

type StatusFilter = "autorizada" | "enviada" | "pendente_auth" | "all_pending";

const STATUS_OPTS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "autorizada",    label: "Autorizadas" },
  { value: "enviada",       label: "Enviadas" },
  { value: "pendente_auth", label: "Pendentes auth" },
  { value: "all_pending",   label: "Todas pendentes" },
];

const STATUS_BADGE_META: Record<string, { color: string; bg: string; label: string }> = {
  autorizada:    { color: "#10B981", bg: "rgba(16,185,129,0.14)", label: "Autorizada" },
  enviada:       { color: "#06B6D4", bg: "rgba(6,182,212,0.14)",  label: "Enviada" },
  pendente_auth: { color: "#F59E0B", bg: "rgba(245,158,11,0.14)", label: "Pendente auth" },
  rascunho:      { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)", label: "Rascunho" },
};

function fmtBRL(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TissReconcilePanel() {
  const cid = useAuthStore().company?.id;
  const [filter, setFilter] = useState<StatusFilter>("autorizada");
  const [activeGuide, setActiveGuide] = useState<PendingTissGuide | null>(null);

  // Pra "all_pending", nao mandamos status no query e filtramos client-side
  const queryStatusParam = filter === "all_pending" ? "" : `?status=${filter}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ["tiss-guides-pending", cid, filter],
    queryFn: () => request<{ guides: any[]; stats: any[] }>(
      `/companies/${cid}/dental/tiss/guides${queryStatusParam}`
    ),
    enabled: !!cid,
    staleTime: 30000,
  });

  const allGuides = data?.guides || [];
  const guides = filter === "all_pending"
    ? allGuides.filter((g: any) =>
        ["autorizada", "enviada", "pendente_auth"].includes(g.status))
    : allGuides;

  return (
    <View>
      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 14 }}
        contentContainerStyle={{ gap: 6, paddingRight: 16 }}
      >
        {STATUS_OPTS.map((opt) => {
          const active = filter === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setFilter(opt.value)}
              style={{
                paddingHorizontal: 12, paddingVertical: 7,
                borderRadius: 999, borderWidth: 1,
                borderColor: active ? DentalColors.cyanBorder : DentalColors.border,
                backgroundColor: active ? DentalColors.cyanDim : "transparent",
              }}
            >
              <Text style={{
                fontSize: 11, fontWeight: "600",
                color: active ? DentalColors.cyan : DentalColors.ink2,
              }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Loading */}
      {isLoading && (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={DentalColors.cyan} />
        </View>
      )}

      {/* Erro */}
      {!isLoading && error && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          padding: 14, borderRadius: 10,
          backgroundColor: "rgba(239,68,68,0.06)",
          borderWidth: 1, borderColor: "rgba(239,68,68,0.25)",
        }}>
          <Icon name="alert" size={14} color={DentalColors.red} />
          <Text style={{ fontSize: 12, color: DentalColors.ink2, flex: 1 }}>
            Erro ao carregar guias. Tente recarregar.
          </Text>
        </View>
      )}

      {/* Empty */}
      {!isLoading && !error && guides.length === 0 && (
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: DentalColors.cyanDim,
            alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="check" size={22} color={DentalColors.cyan} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "600", color: DentalColors.ink }}>
            Nenhuma guia pendente
          </Text>
          <Text style={{ fontSize: 12, color: DentalColors.ink3, textAlign: "center", maxWidth: 320 }}>
            Todas as guias TISS deste filtro já foram reconciliadas ou ainda não foram enviadas.
          </Text>
        </View>
      )}

      {/* Lista */}
      {!isLoading && !error && guides.length > 0 && (
        <View style={{ gap: 8 }}>
          {guides.map((g: any) => {
            const meta = STATUS_BADGE_META[g.status] || STATUS_BADGE_META.rascunho;
            const total = parseFloat(g.total_value || 0);
            return (
              <View
                key={g.id}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: DentalColors.surface,
                  borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: DentalColors.border,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text style={{
                      fontSize: 12, fontWeight: "700", color: DentalColors.cyan,
                      fontFamily: "JetBrains Mono, monospace" as any,
                    }}>{g.guide_number}</Text>
                    <View style={{
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                      backgroundColor: meta.bg,
                    }}>
                      <Text style={{
                        fontSize: 9, fontWeight: "700", color: meta.color,
                        letterSpacing: 0.4, textTransform: "uppercase",
                      }}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: DentalColors.ink }} numberOfLines={1}>
                    {g.patient_name || "Paciente"}
                  </Text>
                  <Text style={{ fontSize: 11, color: DentalColors.ink3, marginTop: 2 }} numberOfLines={1}>
                    {g.insurance_name || "Convênio"}
                    {"  ·  "}
                    {g.guide_type === "sp_sadt" ? "SP/SADT" : g.guide_type === "consulta" ? "Consulta" : g.guide_type === "honorario" ? "Honorário" : "Internação"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Text style={{
                    fontSize: 14, fontWeight: "700", color: DentalColors.ink,
                    fontFamily: "JetBrains Mono, monospace" as any,
                  }}>{fmtBRL(total)}</Text>
                  <Pressable
                    onPress={() => setActiveGuide({
                      id: g.id,
                      guide_number: g.guide_number,
                      patient_name: g.patient_name || "Paciente",
                      insurance_name: g.insurance_name || "Convênio",
                      total_value: total,
                    })}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 4,
                      backgroundColor: DentalColors.cyan,
                      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
                    }}
                  >
                    <Icon name="check" size={11} color="#fff" />
                    <Text style={{ fontSize: 11, color: "#fff", fontWeight: "700" }}>
                      Reconciliar
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <MarkTissGuidePaidModal
        guide={activeGuide}
        onClose={() => setActiveGuide(null)}
      />
    </View>
  );
}

export default TissReconcilePanel;
