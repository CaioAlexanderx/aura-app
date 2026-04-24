// ============================================================
// AURA. — RetornoTab (Recall + No-shows)
// Duas seccoes toggle (Recall | Faltas) cada uma consumindo um GET:
//   GET /dental/automation/recall/list
//   GET /dental/no-shows
// Wrappers dos componentes RecallControl e NoShowTracker.
// Botao global "Disparar recall a todos" chama POST /automation/recall.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { RecallControl, type RecallPatient } from "@/components/verticals/odonto/RecallControl";
import { NoShowTracker, type NoShowPatient } from "@/components/verticals/odonto/NoShowTracker";

type RecallResponse   = { recall_days: number; total: number; patients: RecallPatient[] };
type NoShowsResponse  = { total: number; patients: NoShowPatient[] };

type SubTab = "recall" | "noshows";

export function RetornoTab() {
  const { company } = useAuthStore();
  const cid = company?.id;
  const qc = useQueryClient();
  const [sub, setSub] = useState<SubTab>("recall");

  const { data: recallData, isLoading: loadRecall, error: recallErr } = useQuery<RecallResponse>({
    queryKey: ["dental-recall-list", cid],
    queryFn: () => request<RecallResponse>(`/companies/${cid}/dental/automation/recall/list`),
    enabled: !!cid && sub === "recall",
    staleTime: 60000,
  });

  const { data: noShowsData, isLoading: loadNoShows, error: noShowsErr } = useQuery<NoShowsResponse>({
    queryKey: ["dental-no-shows", cid],
    queryFn: () => request<NoShowsResponse>(`/companies/${cid}/dental/no-shows`),
    enabled: !!cid && sub === "noshows",
    staleTime: 60000,
  });

  // POST /automation/recall dispara batch para todos que cumprem criterio.
  // A API atual nao tem envio individual — retorna log pendente pra integracao WhatsApp.
  const sendRecallMut = useMutation({
    mutationFn: () =>
      request<{ patients_found: number; recall_days: number; results: any[] }>(
        `/companies/${cid}/dental/automation/recall`,
        { method: "POST", body: {} }
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["dental-recall-list"] });
      if (res.patients_found === 0) {
        toast.info("Nenhum paciente novo pra enviar recall");
      } else {
        toast.success(`Recall agendado pra ${res.patients_found} paciente${res.patients_found > 1 ? "s" : ""}`);
      }
    },
    onError: () => { toast.error("Erro ao disparar recall"); },
  });

  const recallPatients  = recallData?.patients  || [];
  const noShowsPatients = noShowsData?.patients || [];
  const recallDays      = recallData?.recall_days || 180;

  return (
    <View style={{ gap: 12 }}>
      {/* Toggle */}
      <View style={s.toggleRow}>
        <Pressable
          onPress={() => setSub("recall")}
          style={[s.toggleBtn, sub === "recall" && s.toggleBtnActive]}
        >
          <Icon name="phone" size={13} color={sub === "recall" ? "#fff" : Colors.ink3} />
          <Text style={[s.toggleText, sub === "recall" && s.toggleTextActive]}>
            Recall {recallPatients.length > 0 ? `(${recallPatients.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSub("noshows")}
          style={[s.toggleBtn, sub === "noshows" && s.toggleBtnActive]}
        >
          <Icon name="alert" size={13} color={sub === "noshows" ? "#fff" : Colors.ink3} />
          <Text style={[s.toggleText, sub === "noshows" && s.toggleTextActive]}>
            Faltas {noShowsPatients.length > 0 ? `(${noShowsPatients.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {sub === "recall" && (
        <>
          <View style={s.infoCard}>
            <Icon name="info" size={12} color={Colors.violet3 || "#a78bfa"} />
            <Text style={s.infoText}>
              Intervalo padrao de retorno: {Math.round(recallDays / 30)} meses ({recallDays} dias).
              Configurave em Automacoes.
            </Text>
          </View>

          {recallPatients.length > 0 && (
            <Pressable
              onPress={() => sendRecallMut.mutate()}
              style={[s.dispatchBtn, sendRecallMut.isPending && { opacity: 0.6 }]}
              disabled={sendRecallMut.isPending}
            >
              <Icon name="send" size={14} color="#fff" />
              <Text style={s.dispatchText}>
                {sendRecallMut.isPending ? "Enviando..." : "Disparar recall a todos elegiveis"}
              </Text>
            </Pressable>
          )}

          {loadRecall && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3 || "#a78bfa"} /></View>}
          {recallErr && (
            <View style={s.errorBox}>
              <Icon name="alert" size={16} color={Colors.red || "#EF4444"} />
              <Text style={s.errorText}>Erro ao carregar lista de recall.</Text>
            </View>
          )}
          {!loadRecall && !recallErr && (
            <RecallControl
              patients={recallPatients}
              // onSendRecall individual nao disponivel ainda — botao global acima faz batch.
              // onSchedule omitido — vai abrir modal de novo agendamento numa proxima sessao.
            />
          )}
        </>
      )}

      {sub === "noshows" && (
        <>
          <View style={s.infoCard}>
            <Icon name="info" size={12} color={Colors.violet3 || "#a78bfa"} />
            <Text style={s.infoText}>
              Historico completo de pacientes com faltas. Use pra decidir politica de deposito
              antecipado ou contato previo.
            </Text>
          </View>

          {loadNoShows && <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3 || "#a78bfa"} /></View>}
          {noShowsErr && (
            <View style={s.errorBox}>
              <Icon name="alert" size={16} color={Colors.red || "#EF4444"} />
              <Text style={s.errorText}>Erro ao carregar historico de faltas.</Text>
            </View>
          )}
          {!loadNoShows && !noShowsErr && (
            <NoShowTracker
              patients={noShowsPatients}
              maxNoShows={3}
              // onContactPatient + onViewHistory omitidos — vao abrir modals
              // na proxima sessao. Por ora o tracker mostra os dados agregados.
            />
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  toggleRow:    { flexDirection: "row", gap: 6, alignItems: "center" },
  toggleBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  toggleBtnActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  toggleText:   { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },

  infoCard:     { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2 },
  infoText:     { fontSize: 11, color: Colors.violet3 || "#a78bfa", flex: 1, lineHeight: 16 },

  dispatchBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet || "#6d28d9", borderRadius: 10, paddingVertical: 11 },
  dispatchText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  errorBox:     { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.red || "#EF4444" },
  errorText:    { flex: 1, fontSize: 12, color: Colors.ink },
});

export default RetornoTab;
