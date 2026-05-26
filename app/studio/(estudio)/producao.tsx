// ============================================================
// AURA STUDIO · KDS de Produção (Fase 4 + UX overhaul 25/05 + Marketplaces S-0)
//
// 6 colunas: Aguardando personalização → Aguardando arte → Aprovado → Em produção → Pronto → Entregue
//
// Marketplaces S-0 (25/05/2026): awaiting_customization é a 1ª coluna, em
// rosa accent. Pedidos vindos de ML/Shopee chegam aqui (vertical='studio',
// customization_collected_at IS NULL). Lojista coleta a personalização e
// avança pra pending_art.
//
// Item #3 do follow-up: empty state celebratório quando fila vazia.
//
// Fase 3 (26/05/2026): loading + empty states migrados pra StudioLoading
// e StudioEmpty (componentes globais Studio).
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { studioApi, type StudioOrder, type StudioProductionStatus } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { ApprovalRequestModal } from "@/components/studio/ApprovalRequestModal";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";

type Column = {
  key: StudioProductionStatus;
  label: string;
  icon: string;
  color: string;
  bg: string;
  nextLabel: string;
};

const COLUMNS: Column[] = [
  // S-0: nova primeira coluna pra pedidos de marketplace (ML/Shopee) sem personalização ainda coletada.
  { key: "awaiting_customization", label: "Aguardando personalização", icon: "message-circle", color: StudioColors.accent, bg: "#FCE7F3", nextLabel: "Coletar e enviar pra arte" },
  { key: "pending_art",   label: "Aguardando arte",  icon: "alert-circle", color: StudioColors.warning, bg: StudioColors.warningSoft, nextLabel: "Marcar como aprovado" },
  { key: "approved",      label: "Aprovado",         icon: "check",        color: StudioColors.primary, bg: StudioColors.primarySoft, nextLabel: "Iniciar produção" },
  { key: "in_production", label: "Em produção",      icon: "clock",        color: StudioColors.accent, bg: StudioColors.accentSoft, nextLabel: "Marcar como pronto" },
  { key: "ready",         label: "Pronto",           icon: "package",      color: StudioColors.mint, bg: StudioColors.mintSoft, nextLabel: "Marcar como entregue" },
  { key: "delivered",     label: "Entregue",         icon: "check-circle", color: "#6B7280", bg: "#F3F4F6", nextLabel: "" },
];

const NEXT_STATUS: Record<StudioProductionStatus, StudioProductionStatus | null> = {
  awaiting_customization: "pending_art",
  pending_art:   "approved",
  approved:      "in_production",
  in_production: "ready",
  ready:         "delivered",
  delivered:     null,
  cancelled:     null,
};

const PLATFORM_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  mercado_livre: { label: "Mercado Livre", bg: StudioColors.warningSoft, fg: StudioColors.warningInk },
  shopee:        { label: "Shopee",        bg: "#FFEDD5", fg: "#9A3412" },
};

function fmtSla(createdAt: string): { txt: string; tone: "fresh" | "warm" | "late" } {
  const d = new Date(createdAt);
  const hours = (Date.now() - d.getTime()) / 3600000;
  if (hours < 24)  return { txt: `${Math.round(hours)}h atrás`,            tone: "fresh" };
  if (hours < 72)  return { txt: `${Math.round(hours / 24)}d atrás`,       tone: "warm" };
  return                   { txt: `${Math.round(hours / 24)}d (urgente)`,  tone: "late" };
}

export default function StudioProducao() {
  const router = useRouter();
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  const [approvalFor, setApprovalFor] = useState<StudioOrder | null>(null);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const r = await studioApi.listOrders(company.id, { days: 60, limit: 300 });
      setOrders(r.orders || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar pedidos");
    } finally { setLoading(false); }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  async function advance(order: StudioOrder) {
    const cur = (order.studio_production_status || "pending_art") as StudioProductionStatus;
    const next = NEXT_STATUS[cur];
    if (!next || !company?.id) return;
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, studio_production_status: next } : o));
    try {
      await studioApi.updateProductionStatus(company.id, order.id, next);
      const col = COLUMNS.find((c) => c.key === next);
      toast.success(`✨ Movido pra ${col?.label}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar");
      load();
    }
  }

  const byStatus: Record<string, StudioOrder[]> = {};
  for (const col of COLUMNS) byStatus[col.key] = [];
  for (const o of orders) {
    const key = (o.studio_production_status || "pending_art") as StudioProductionStatus;
    if (byStatus[key]) byStatus[key].push(o);
  }

  // #3: detecta "fila completamente vazia exceto delivered" — celebra
  const activeCount = COLUMNS.filter((c) => c.key !== "delivered").reduce(
    (sum, c) => sum + byStatus[c.key].length, 0
  );
  const allCaughtUp = !loading && orders.length > 0 && activeCount === 0;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>FASE 4 · KDS DE PRODUÇÃO</Text>
          <Text style={s.title}>Linha de produção do estúdio</Text>
          <Text style={s.sub}>
            Acompanhe os pedidos passando por cada etapa. Click "→ Próxima" pra avançar — ou solicite aprovação do cliente quando a arte ficar pronta.
          </Text>
        </View>
        <Pressable style={s.reloadBtn} onPress={load} disabled={loading}>
          <Icon name="refresh-cw" size={14} color={StudioColors.ink2} />
          <Text style={s.reloadTxt}>{loading ? "Atualizando…" : "Atualizar"}</Text>
        </Pressable>
      </View>

      {loading && orders.length === 0 ? (
        <StudioLoading variant="skeleton-grid" rows={3} />
      ) : orders.length === 0 ? (
        // Empty state: fila vazia
        <StudioEmpty
          icon="package"
          title="Fila de produção vazia"
          desc="Quando entrar um pedido novo, ele aparece aqui automaticamente."
          primaryCta={{ label: "Ver pedidos do dia", onPress: () => router.push("/studio/pedidos" as any) }}
        />
      ) : allCaughtUp ? (
        // #3: tudo entregue → celebra
        <StudioEmpty
          emoji="🎉"
          title="Tudo entregue!"
          desc="Nenhum pedido na produção agora."
          tone="celebration"
          primaryCta={{ label: "Novo pedido", onPress: () => router.push("/studio/pedidos" as any) }}
        />
      ) : (
        <ScrollView horizontal style={s.boardScroll} contentContainerStyle={s.board}>
          {COLUMNS.map((col) => (
            <View key={col.key} style={s.col}>
              <View style={[s.colHead, { backgroundColor: col.bg }]}>
                <View style={[s.colDot, { backgroundColor: col.color }]}>
                  <Icon name={col.icon as any} size={12} color="#fff" />
                </View>
                <Text style={[s.colTitle, { color: col.color }]}>{col.label}</Text>
                <Text style={s.colCount}>{byStatus[col.key].length}</Text>
              </View>
              <ScrollView style={s.colScroll} contentContainerStyle={{ padding: 10, gap: 10 }}>
                {byStatus[col.key].length === 0 ? (
                  <Text style={s.colEmpty}>—</Text>
                ) : byStatus[col.key].map((o) => {
                  const sla = fmtSla(o.created_at);
                  const next = NEXT_STATUS[col.key];
                  const platformMeta = o.marketplace_platform ? PLATFORM_LABELS[o.marketplace_platform] : null;
                  return (
                    <Pressable
                      key={o.id}
                      style={s.card}
                      onPress={() => router.push(`/studio/pedidos/${o.id}` as any)}
                    >
                      <View style={s.cardHead}>
                        <Text style={s.cardId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                        <View style={[s.slaChip,
                                      sla.tone === "warm"  ? { backgroundColor: StudioColors.warningSoft } :
                                      sla.tone === "late"  ? { backgroundColor: StudioColors.dangerSoft } : null]}>
                          <Text style={[s.slaTxt,
                                        sla.tone === "warm" ? { color: StudioColors.warningInk } :
                                        sla.tone === "late" ? { color: StudioColors.dangerInk } : null]}>
                            {sla.txt}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.cardName} numberOfLines={1}>
                        {o.display_name || "Sem cadastro"}
                      </Text>
                      <Text style={s.cardMeta}>
                        {o.item_count} item{o.item_count === 1 ? "" : "s"} · R$ {Number(o.total_amount).toFixed(2)}
                      </Text>
                      {platformMeta && (
                        <View style={[s.platformBadge, { backgroundColor: platformMeta.bg }]}>
                          <Icon name="shopping-bag" size={10} color={platformMeta.fg} />
                          <Text style={[s.platformBadgeTxt, { color: platformMeta.fg }]}>
                            {platformMeta.label}
                          </Text>
                        </View>
                      )}
                      {o.pending_approval_url && (
                        <View style={s.approvalBadge}>
                          <Icon name="message-circle" size={10} color="#1E40AF" />
                          <Text style={s.approvalBadgeTxt}>Aprovação enviada</Text>
                        </View>
                      )}
                      <View style={s.cardActions}>
                        {col.key === "awaiting_customization" && (
                          <Pressable
                            style={[s.btnApproval, { backgroundColor: StudioColors.accent }]}
                            onPress={(e) => { e.stopPropagation && e.stopPropagation(); router.push(`/studio/pedidos/${o.id}` as any); }}
                          >
                            <Icon name="message-circle" size={12} color="#fff" />
                            <Text style={s.btnApprovalTxt}>Coletar personalização</Text>
                          </Pressable>
                        )}
                        {col.key === "pending_art" && (
                          <Pressable
                            style={s.btnApproval}
                            onPress={(e) => { e.stopPropagation && e.stopPropagation(); setApprovalFor(o); }}
                          >
                            <Icon name="message-circle" size={12} color="#fff" />
                            <Text style={s.btnApprovalTxt}>Solicitar aprovação</Text>
                          </Pressable>
                        )}
                        {next && (
                          <Pressable
                            style={[s.btnAdvance, { backgroundColor: col.color }]}
                            onPress={(e) => { e.stopPropagation && e.stopPropagation(); advance(o); }}
                          >
                            <Text style={s.btnAdvanceTxt}>{col.nextLabel} →</Text>
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={!!approvalFor}
        animationType="slide"
        onRequestClose={() => setApprovalFor(null)}
      >
        {approvalFor && (
          <ApprovalRequestModal
            order={approvalFor}
            onClose={() => setApprovalFor(null)}
            onSent={() => { setApprovalFor(null); load(); }}
          />
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: StudioColors.bg },
  header: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16, gap: 16, flexWrap: "wrap",
  },
  eyebrow: { fontSize: 11, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: StudioColors.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: StudioColors.ink3, marginTop: 4, maxWidth: 580 },
  reloadBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioColors.ink5,
  },
  reloadTxt: { fontSize: 12.5, color: StudioColors.ink2, fontWeight: "600" },

  boardScroll: { flex: 1 },
  board: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  col: {
    width: 280,
    backgroundColor: StudioColors.paperCard,
    borderRadius: 16,
    borderWidth: 1, borderColor: StudioColors.ink5,
    overflow: "hidden",
    height: "100%",
  },
  colHead: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: StudioColors.ink5,
  },
  colDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  colTitle: { fontSize: 13, fontWeight: "800", flex: 1, letterSpacing: -0.1 },
  colCount: { fontSize: 12, color: StudioColors.ink2, fontWeight: "800" },
  colScroll: { flex: 1, minHeight: 200 },
  colEmpty: { color: StudioColors.ink4, fontSize: 12, textAlign: "center", paddingVertical: 14 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: StudioColors.ink5,
    gap: 6,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardId: { fontSize: 10.5, color: StudioColors.ink4, fontWeight: "700", letterSpacing: 0.5 },
  slaChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: StudioColors.bgSoft },
  slaTxt: { fontSize: 10.5, fontWeight: "700", color: StudioColors.ink3 },
  cardName: { fontSize: 13.5, fontWeight: "700", color: StudioColors.ink, marginTop: 2 },
  cardMeta: { fontSize: 11.5, color: StudioColors.ink3 },
  platformBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    alignSelf: "flex-start", marginTop: 4,
  },
  platformBadgeTxt: { fontSize: 10.5, fontWeight: "800" },
  approvalBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    alignSelf: "flex-start", marginTop: 4,
  },
  approvalBadgeTxt: { fontSize: 10.5, color: "#1E40AF", fontWeight: "700" },

  cardActions: { gap: 6, marginTop: 8 },
  btnApproval: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 8, borderRadius: 8,
  },
  btnApprovalTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  btnAdvance: {
    paddingVertical: 8, borderRadius: 8,
    alignItems: "center",
  },
  btnAdvanceTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
