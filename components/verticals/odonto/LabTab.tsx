// ============================================================
// AURA. — LabTab (Laboratorio protetico)
// Consome GET /dental/lab-orders + PATCH /lab-orders/:oid pra mudar status.
// Wrapper do component LabOrderTracker (presentational).
// ============================================================
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { LabOrderTracker, type LabOrder } from "@/components/verticals/odonto/LabOrderTracker";

type LabOrdersResponse = {
  total: number;
  orders: LabOrder[];
  summary: { pending: number; inProduction: number; ready: number; totalCost: number };
};

export function LabTab() {
  const { company } = useAuthStore();
  const cid = company?.id;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<LabOrdersResponse>({
    queryKey: ["dental-lab-orders", cid],
    queryFn: () => request<LabOrdersResponse>(`/companies/${cid}/dental/lab-orders`),
    enabled: !!cid,
    staleTime: 30000,
  });

  const statusMut = useMutation({
    mutationFn: (p: { orderId: string; status: string }) =>
      request(`/companies/${cid}/dental/lab-orders/${p.orderId}`, {
        method: "PATCH",
        body: { status: p.status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-lab-orders"] });
      toast.success("Status atualizado");
    },
    onError: () => { toast.error("Erro ao atualizar"); },
  });

  if (isLoading) {
    return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3 || "#a78bfa"} /></View>;
  }

  if (error) {
    return (
      <View style={s.errorBox}>
        <Icon name="alert" size={16} color={Colors.red || "#EF4444"} />
        <Text style={s.errorText}>Erro ao carregar pedidos de laboratorio. Tente recarregar.</Text>
      </View>
    );
  }

  const orders   = data?.orders   || [];
  const summary  = data?.summary  || { pending: 0, inProduction: 0, ready: 0, totalCost: 0 };

  return (
    <View style={{ gap: 12 }}>
      <View style={s.infoCard}>
        <Icon name="info" size={12} color={Colors.violet3 || "#a78bfa"} />
        <Text style={s.infoText}>
          Acompanhe pedidos a laboratorios externos (proteses, guias, trabalhos protetitos).
          Clique no status pra avancar a proxima etapa.
        </Text>
      </View>

      <LabOrderTracker
        orders={orders}
        summary={summary}
        onStatusChange={(orderId, newStatus) => statusMut.mutate({ orderId, status: newStatus })}
        // onNewOrder + onOrderPress omitidos por enquanto — precisam de modals
        // que criarei numa proxima sessao. Ver lab_orders nos Notes do projeto.
      />
    </View>
  );
}

const s = StyleSheet.create({
  infoCard:   { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2 },
  infoText:   { fontSize: 11, color: Colors.violet3 || "#a78bfa", flex: 1, lineHeight: 16 },
  errorBox:   { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.red || "#EF4444" },
  errorText:  { flex: 1, fontSize: 12, color: Colors.ink },
});

export default LabTab;
