// ============================================================
// AURA STUDIO · Detalhe de pedido
//
// Item #9 da análise UX/UI: hub levava pra lugar nenhum.
// Tela mostra: pedido, items + customizações, status, aprovações
// + ações rápidas (avançar produção, solicitar aprovação, ver mockup).
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { useAuthStore } from "@/stores/auth";
import { studioApi, type StudioOrderDetail, type StudioProductionStatus } from "@/services/studioApi";
import { labelStudioStatus, colorStudioStatus } from "@/constants/studio-status";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";

const NEXT: Record<StudioProductionStatus, StudioProductionStatus | null> = {
  pending_art: "approved",
  approved: "in_production",
  in_production: "ready",
  ready: "delivered",
  delivered: null,
};

export default function StudioOrderDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const oid = String(params?.id || "");
  const { company } = useAuthStore();

  const [data, setData] = useState<StudioOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id || !oid) return;
    setLoading(true);
    try {
      const d = await studioApi.getOrder(company.id, oid);
      setData(d);
    } catch (e) {
      console.warn("[studio order detail]", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [company?.id, oid]);

  useEffect(() => { load(); }, [load]);

  const advance = async () => {
    if (!data || !company?.id) return;
    const cur = data.order.studio_production_status as StudioProductionStatus | null;
    if (!cur) return;
    const next = NEXT[cur];
    if (!next) return;
    setActing(true);
    try {
      await studioApi.updateProductionStatus(company.id, oid, next);
      await load();
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: StudioColors.bg }}>
        <ActivityIndicator color={StudioColors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, padding: 24, backgroundColor: StudioColors.bg }}>
        <Text style={s.h1}>Pedido não encontrado</Text>
        <Pressable onPress={() => router.back()} style={s.linkBtn}>
          <Text style={s.linkBtnTxt}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const { order, items, approvals } = data;
  const status = order.studio_production_status as StudioProductionStatus | null;
  const statusCol = status ? colorStudioStatus(status) : { bg: "#F1F5F9", fg: "#64748B" };
  const next = status ? NEXT[status] : null;
  const lastApproval = approvals?.[0] || null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: StudioColors.bg }}>
      <StudioBreadcrumb
        items={[
          { label: "Estúdio", href: "/studio" },
          { label: "Pedidos", href: "/studio/pedidos" },
          { label: `#${order.id.slice(0, 8)}` },
        ]}
      />
      <View style={s.container}>
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>{order.display_name || order.customer_name || "Pedido"}</Text>
            <Text style={s.h1Sub}>
              Criado em {new Date(order.created_at).toLocaleString("pt-BR")} · {order.item_count} item(ns) · R$ {Number(order.total_amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: statusCol.bg }]}>
            <Text style={[s.statusTxt, { color: statusCol.fg }]}>{labelStudioStatus(status)}</Text>
          </View>
        </View>

        {/* Ações rápidas */}
        <View style={s.actionRow}>
          {next && (
            <Pressable onPress={advance} disabled={acting} style={[s.actionBtn, { backgroundColor: StudioColors.primary }]}>
              <Icon name="arrow-right" size={16} color="#fff" />
              <Text style={s.actionBtnTxt}>Avançar pra "{labelStudioStatus(next)}"</Text>
            </Pressable>
          )}
          {status === "pending_art" && (
            <Pressable
              onPress={() => router.push("/studio/producao?intent=approval" as any)}
              style={[s.actionBtn, { backgroundColor: StudioColors.accent }]}
            >
              <Icon name="message-circle" size={16} color="#fff" />
              <Text style={s.actionBtnTxt}>Solicitar aprovação</Text>
            </Pressable>
          )}
          {lastApproval?.mockup_url ? (
            <Pressable
              onPress={() => Linking.openURL(lastApproval.mockup_url!)}
              style={[s.actionBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: StudioColors.ink4 }]}
            >
              <Icon name="image" size={16} color={StudioColors.ink2} />
              <Text style={[s.actionBtnTxt, { color: StudioColors.ink2 }]}>Ver mockup</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Cliente */}
        <View style={s.section}>
          <Text style={s.sectionEyebrow}>CLIENTE</Text>
          <Text style={s.sectionTitle}>{order.customer_name || "—"}</Text>
          {order.customer_phone ? (
            <Pressable
              onPress={() => Linking.openURL(`https://wa.me/${(order.customer_phone || "").replace(/\D/g, "")}`)}
              style={s.linkRow}
            >
              <Icon name="message-circle" size={14} color={StudioColors.primary} />
              <Text style={s.link}>{order.customer_phone}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Itens */}
        <View style={s.section}>
          <Text style={s.sectionEyebrow}>ITENS DO PEDIDO</Text>
          {items.map((it) => (
            <View key={it.id} style={s.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{it.product_name}</Text>
                <Text style={s.itemSub}>{it.quantity} × R$ {Number(it.unit_price || 0).toFixed(2)}</Text>
                {it.customization ? (
                  <View style={s.custBox}>
                    <Text style={s.custTitle}>Personalização</Text>
                    <Text style={s.custBody}>{safeJson(it.customization)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* Aprovações */}
        {approvals?.length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>HISTÓRICO DE APROVAÇÃO</Text>
            {approvals.map((a) => {
              const col = colorStudioStatus(a.status);
              return (
                <View key={a.id} style={s.approvalRow}>
                  <View style={[s.approvalDot, { backgroundColor: col.fg }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.approvalTitle}>{labelStudioStatus(a.status)}</Text>
                    <Text style={s.approvalSub}>
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                      {a.response_note ? ` · "${a.response_note}"` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function safeJson(v: any): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

const s = StyleSheet.create({
  container: { padding: 22, maxWidth: 980, alignSelf: "center", width: "100%" },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: "800", color: StudioColors.ink },
  h1Sub: { fontSize: 12, color: StudioColors.ink3, marginTop: 4 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusTxt: { fontWeight: "800", fontSize: 12 },

  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 18 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  actionBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  section: {
    backgroundColor: StudioColors.paperCard,
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: StudioColors.ink5,
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 10, fontWeight: "800", color: StudioColors.ink3,
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: StudioColors.ink },

  itemCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: StudioColors.ink5,
  },
  itemTitle: { fontWeight: "700", color: StudioColors.ink, fontSize: 13 },
  itemSub: { color: StudioColors.ink3, fontSize: 12, marginTop: 2 },
  custBox: {
    marginTop: 8, padding: 10,
    backgroundColor: StudioColors.bg,
    borderRadius: 10,
    borderWidth: 1, borderColor: StudioColors.ink5,
  },
  custTitle: { fontSize: 10, fontWeight: "800", color: StudioColors.ink3, letterSpacing: 0.6 },
  custBody: { fontSize: 11, color: StudioColors.ink2, marginTop: 4, fontFamily: "monospace" },

  approvalRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: StudioColors.ink5,
  },
  approvalDot: { width: 8, height: 8, borderRadius: 4 },
  approvalTitle: { fontWeight: "700", color: StudioColors.ink, fontSize: 13 },
  approvalSub: { color: StudioColors.ink3, fontSize: 11, marginTop: 2 },

  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  link: { color: StudioColors.primary, fontWeight: "600", fontSize: 12 },
  linkBtn: { marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: StudioColors.primary },
  linkBtnTxt: { color: "#fff", fontWeight: "700" },
});
