import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { HoverRow } from "@/components/HoverRow";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { ListSkeleton } from "@/components/ListSkeleton";
import { PLAN_C, STATUS_C, MODULE_LABELS } from "./types";
import type { AdminClient } from "./types";

export function ClientsAdmin() {
  const { token, isStaff } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: apiClients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => adminApi.clients(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ companyId, overrides }: { companyId: string; overrides: Record<string, boolean> }) =>
      adminApi.updateModules(companyId, overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Modulos atualizados");
    },
    onError: () => toast.error("Erro ao atualizar modulos"),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const clients: AdminClient[] = apiClients?.clients || [];
  const filtered = filter === "all" ? clients : clients.filter(c =>
    filter === "active" ? c.is_active : filter === "inactive" ? !c.is_active : true
  );

  if (isLoading) return <ListSkeleton rows={4} showCards />;

  function handleToggle(client: AdminClient, moduleKey: string, enabled: boolean) {
    const currentOverrides = client.module_overrides || {};
    const newOverrides = { ...currentOverrides, [moduleKey]: enabled };
    toggleMutation.mutate({ companyId: client.id, overrides: newOverrides });
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {[{ k: "all", l: "Todos" }, { k: "active", l: "Ativos" }, { k: "inactive", l: "Inativos" }].map(f => (
          <Pressable key={f.k} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}>
            <Text style={[s.chipText, filter === f.k && s.chipTextActive]}>
              {f.l} ({f.k === "all" ? clients.length : clients.filter(c => f.k === "active" ? c.is_active : !c.is_active).length})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 && <Text style={{ fontSize: 13, color: Colors.ink3, textAlign: "center", paddingVertical: 40 }}>Nenhum cliente encontrado</Text>}

      {filtered.map(client => {
        const pc = PLAN_C[client.plan] || { color: Colors.ink3, label: client.plan || "?" };
        const sc = client.is_active ? STATUS_C.active : STATUS_C.false;
        const isOpen = selected === client.id;
        const displayName = client.trade_name || client.legal_name || "Sem nome";
        return (
          <Pressable key={client.id} onPress={() => setSelected(isOpen ? null : client.id)}>
            <HoverRow style={s.row}>
              <View style={s.info}>
                <Text style={s.name}>{displayName}</Text>
                <Text style={s.sub}>{client.owner_email}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: pc.color + "18" }]}><Text style={[s.badgeText, { color: pc.color }]}>{pc.label}</Text></View>
              <View style={[s.badge, { backgroundColor: sc.color + "18" }]}><Text style={[s.badgeText, { color: sc.color }]}>{sc.label}</Text></View>
            </HoverRow>

            {isOpen && (
              <View style={s.detail}>
                <View style={s.detailGrid}>
                  <View style={s.detailItem}><Text style={s.detailLabel}>Owner</Text><Text style={s.detailValue}>{client.owner_name || "-"}</Text></View>
                  <View style={s.detailItem}><Text style={s.detailLabel}>Email</Text><Text style={s.detailValue}>{client.owner_email}</Text></View>
                  <View style={s.detailItem}><Text style={s.detailLabel}>Desde</Text><Text style={s.detailValue}>{client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}</Text></View>
                  <View style={s.detailItem}><Text style={s.detailLabel}>Plano</Text><Text style={[s.detailValue, { color: pc.color }]}>{pc.label}</Text></View>
                </View>

                <View style={s.detailGrid}>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Modulos visiveis</Text>
                    <Text style={s.detailValue}>{(client.visible_modules || []).length}</Text>
                  </View>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Overrides</Text>
                    <Text style={s.detailValue}>{Object.keys(client.module_overrides || {}).length}</Text>
                  </View>
                </View>

                <View style={s.toggles}>
                  <Text style={s.toggleTitle}>Modulos</Text>
                  {MODULE_LABELS.map(mod => {
                    const isVisible = (client.visible_modules || []).includes(mod.key);
                    const hasOverride = client.module_overrides && mod.key in client.module_overrides;
                    return (
                      <View key={mod.key} style={s.toggleRow}>
                        <Text style={[s.toggleLabel, !isVisible && { opacity: 0.4 }]}>
                          {mod.label} {hasOverride ? "(override)" : ""}
                        </Text>
                        <Switch
                          value={isVisible}
                          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                          thumbColor={isVisible ? Colors.violet : Colors.ink3}
                          onValueChange={(val) => handleToggle(client, mod.key, val)}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, gap: 8, flexWrap: "wrap" },
  info: { flex: 1, minWidth: 150, gap: 2 },
  name: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  sub: { fontSize: 11, color: Colors.ink3 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginBottom: 8, marginTop: -2, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  detailItem: { minWidth: 100, gap: 2 },
  detailLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  toggles: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  toggleTitle: { fontSize: 12, fontWeight: "600", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  toggleLabel: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
});
