// ============================================================
// Hub Social — container: lista de conversas + thread.
// Desktop (IS_WIDE): duas colunas. Mobile: lista ↔ thread (voltar).
// Polling de 15s na lista (MVP; websocket fica pra v2).
//
// Estados especiais, nesta ordem:
//   - visão consolidada multi-CNPJ (company null) → escolher loja
//   - schema_pending → migration não aplicada no ambiente (estado vazio)
//   - Aurinha desligada → card de ativação (settings PUT)
// ============================================================
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { EmptyState } from "@/components/EmptyState";
import { hubApi, type HubConversation, type HubStatus } from "@/services/hubApi";
import { CHANNEL_META, STATUS_META, CATEGORY_META, shortTime, displayName } from "./types";
import { ThreadView } from "./ThreadView";

type StatusFilter = "todas" | HubStatus;

function ConversationRow({ conv, selected, onPress }: {
  conv: HubConversation; selected: boolean; onPress: () => void;
}) {
  const ch = CHANNEL_META[conv.channel];
  const st = STATUS_META[conv.status];
  const cat = conv.category ? CATEGORY_META[conv.category] : null;
  const name = displayName(conv.customer_name, conv.external_id);
  return (
    <Pressable onPress={onPress} style={[s.row, selected && s.rowSelected]}>
      <View style={[s.avatar, { backgroundColor: ch.color + "33" }]}>
        <Text style={[s.avatarText, { color: ch.color }]}>{name.charAt(0).toUpperCase()}</Text>
        <View style={[s.channelDot, { backgroundColor: ch.color }]}>
          <Text style={s.channelDotText}>{ch.short}</Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowName} numberOfLines={1}>{name}</Text>
        <Text style={s.rowPreview} numberOfLines={1}>{conv.last_message_preview || "—"}</Text>
        <View style={s.rowChips}>
          <View style={[s.miniChip, { backgroundColor: st.color + "22" }]}>
            <Text style={[s.miniChipText, { color: st.color }]}>{st.label}</Text>
          </View>
          {cat && (
            <View style={[s.miniChip, { borderWidth: 1, borderColor: cat.color + "66" }]}>
              <Text style={[s.miniChipText, { color: cat.color }]}>{cat.label}</Text>
            </View>
          )}
          {conv.pending_approvals > 0 && (
            <View style={[s.miniChip, { backgroundColor: Colors.violet + "2e" }]}>
              <Text style={[s.miniChipText, { color: Colors.violet3 }]}>{conv.pending_approvals} p/ aprovar</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={s.rowTime}>{shortTime(conv.last_message_at)}</Text>
    </Pressable>
  );
}

export function HubView() {
  const { company } = useAuthStore();
  const companyId = company?.id as string | undefined;
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["hub-settings", companyId],
    queryFn: () => hubApi.settings(companyId!),
    enabled: !!companyId,
    staleTime: 30000,
  });

  const enabled = !!settings?.enabled;

  const { data, isLoading } = useQuery({
    queryKey: ["hub-conversations", companyId, statusFilter],
    queryFn: () => hubApi.conversations(companyId!, statusFilter === "todas" ? undefined : { status: statusFilter }),
    enabled: !!companyId && enabled,
    refetchInterval: 15000,
  });

  const mSettings = useMutation({
    mutationFn: (patch: { enabled?: boolean; approval_mode?: boolean }) => hubApi.saveSettings(companyId!, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hub-settings", companyId] }),
  });

  // Visão consolidada multi-CNPJ: atendimento é por loja.
  if (!companyId) {
    return (
      <EmptyState icon="users" iconColor={Colors.violet3}
        title="Escolha uma loja"
        subtitle="O atendimento do hub social é por loja. Saia da visão consolidada e selecione a empresa para ver as conversas." />
    );
  }

  if (settings?.schema_pending) {
    return (
      <EmptyState icon="alert" iconColor={Colors.amber}
        title="Hub quase pronto"
        subtitle="O servidor ainda está sendo atualizado para o hub social. Tente novamente em alguns minutos." />
    );
  }

  // Aurinha desligada → onboarding
  if (settings && !enabled) {
    return (
      <View style={s.onboardCard}>
        <Text style={s.onboardTitle}>Conheça a Aurinha 💜</Text>
        <Text style={s.onboardText}>
          A Aurinha responde as mensagens do Instagram da sua loja com seus produtos, preços e estoque reais —
          24 horas por dia. Reclamações, trocas e pedidos de desconto ela passa para você, com o contexto pronto.
        </Text>
        <View style={s.onboardRow}>
          <Text style={s.onboardLabel}>Modo aprovação (recomendado no começo)</Text>
          <Switch value={settings.approval_mode}
            onValueChange={(v) => mSettings.mutate({ approval_mode: v })}
            trackColor={{ true: Colors.violet, false: Colors.bg4 }} />
        </View>
        <Text style={s.onboardHint}>
          Com o modo aprovação ligado, a Aurinha só sugere — cada resposta espera o seu toque antes de ir para o cliente.
        </Text>
        <Pressable style={[s.activateBtn, mSettings.isPending && { opacity: 0.6 }]}
          disabled={mSettings.isPending}
          onPress={() => mSettings.mutate({ enabled: true })}>
          <Text style={s.activateBtnText}>{mSettings.isPending ? "Ativando…" : "Ativar a Aurinha"}</Text>
        </Pressable>
      </View>
    );
  }

  const conversations = data?.conversations || [];
  const needsHuman = (data?.counts || [])
    .filter((c) => c.status === "precisa_humano")
    .reduce((acc, c) => acc + c.n, 0);

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "precisa_humano", label: needsHuman > 0 ? `Precisa de você · ${needsHuman}` : "Precisa de você" },
    { key: "ia", label: "IA atendendo" },
    { key: "humano", label: "Com você" },
    { key: "resolvida", label: "Resolvidas" },
  ];

  const list = (
    <View style={IS_WIDE ? s.listColumn : { flex: 1 }}>
      <View style={s.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setStatusFilter(f.key)}
            style={[s.filterChip, statusFilter === f.key && s.filterChipOn,
              f.key === "precisa_humano" && needsHuman > 0 && statusFilter !== f.key && s.filterChipAlert]}>
            <Text style={[s.filterChipText, statusFilter === f.key && s.filterChipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      {isLoading && <View style={s.center}><ActivityIndicator color={Colors.violet3} /></View>}
      {!isLoading && conversations.length === 0 && (
        <EmptyState icon="star" iconColor={Colors.violet3}
          title="Nenhuma conversa ainda"
          subtitle="Quando alguém mandar mensagem no Instagram da loja, a conversa aparece aqui — e a Aurinha já começa a atender." />
      )}
      <ScrollView style={{ flex: 1 }}>
        {conversations.map((c) => (
          <ConversationRow key={c.id} conv={c} selected={c.id === selectedId} onPress={() => setSelectedId(c.id)} />
        ))}
      </ScrollView>
    </View>
  );

  if (IS_WIDE) {
    return (
      <View style={s.wideWrap}>
        {list}
        <View style={s.threadColumn}>
          {selectedId
            ? <ThreadView companyId={companyId} convId={selectedId} />
            : <EmptyState icon="users" iconColor={Colors.violet3} title="Selecione uma conversa" subtitle="Escolha uma conversa na lista para ver a thread." />}
        </View>
      </View>
    );
  }

  // Mobile: lista OU thread
  return selectedId
    ? <ThreadView companyId={companyId} convId={selectedId} onBack={() => setSelectedId(null)} />
    : list;
}

const s = StyleSheet.create({
  wideWrap: { flexDirection: "row", gap: 16, minHeight: 560 },
  listColumn: { width: 330, borderRightWidth: 1, borderRightColor: Colors.border, paddingRight: 12 },
  threadColumn: { flex: 1, minWidth: 0 },
  center: { alignItems: "center", paddingVertical: 30 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 10 },
  filterChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: Colors.bg3 },
  filterChipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  filterChipAlert: { borderColor: Colors.amber + "88" },
  filterChipText: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  filterChipTextOn: { color: "#fff" },
  row: { flexDirection: "row", gap: 10, paddingVertical: 11, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: "flex-start", borderRadius: 10 },
  rowSelected: { backgroundColor: Colors.violet + "1a" },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" },
  channelDot: { position: "absolute", right: -3, bottom: -3, width: 16, height: 16, borderRadius: 5, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.bg2 },
  channelDotText: { fontSize: 7, fontWeight: "800", color: "#fff" },
  rowName: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  rowPreview: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  rowChips: { flexDirection: "row", gap: 4, marginTop: 5, flexWrap: "wrap" },
  miniChip: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  miniChipText: { fontSize: 10, fontWeight: "700" },
  rowTime: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  onboardCard: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 20, gap: 12, backgroundColor: Colors.bg3, maxWidth: 560 },
  onboardTitle: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  onboardText: { fontSize: 13.5, color: Colors.ink2, lineHeight: 20 },
  onboardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  onboardLabel: { fontSize: 13, fontWeight: "600", color: Colors.ink, flex: 1 },
  onboardHint: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  activateBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  activateBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
