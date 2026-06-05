// ============================================================
// AURA STUDIO · KDS de Produção (Fase 4 + UX overhaul 25/05 + Marketplaces S-0)
//
// 6 colunas: Aguardando personalização → Aguardando arte → Aprovado → Em produção → Pronto → Entregue
//
// Marketplaces S-0 (25/05/2026): awaiting_customization é a 1ª coluna (âmbar
// via StudioSemantic). Pedidos vindos de ML/Shopee chegam aqui (vertical='studio',
// customization_collected_at IS NULL). Lojista coleta a personalização e
// avança pra pending_art.
//
// Item #3 do follow-up: empty state celebratório quando fila vazia.
//
// Fase 3 (26/05/2026): loading + empty states migrados pra StudioLoading
// e StudioEmpty (componentes globais Studio).
//
// 26/05/2026 (residual UX overhaul): tokens dinamicos via useStudioTokens()
// + StudioPageHeader padronizado + AnimatedKpiCounter no colCount (pulsa
// quando pedido muda de coluna).
//
// 30/05/2026 (P1 Camada 1): advance() agora trata 409 deposit_required.
// Quando backend retorna 409, reverte o optimistic update e exibe Alert
// de confirmação. Ao confirmar, reenvia com force:true.
//
// 05/06/2026 (M2 DnD): drag-and-drop via useStudioKanbanDnD (web-only).
// Botões de avanço mantidos como fallback (mobile/native).
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useStudioTokens, useStudioSemantic } from "@/contexts/StudioThemeMode";
import { StudioScreen } from "@/components/studio/StudioScreen";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioSemanticPalette } from "@/constants/studio-semantic";
import { studioApi, type StudioOrder, type StudioProductionStatus } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { ApprovalRequestModal } from "@/components/studio/ApprovalRequestModal";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { AnimatedKpiCounter } from "@/components/studio/AnimatedKpiCounter";
import {
  useStudioKanbanDnD,
  useDraggableCardRef,
  useDropZoneRef,
} from "@/components/studio/kanban/useStudioKanbanDnD";

type Column = {
  key: StudioProductionStatus;
  label: string;
  icon: string;
  color: string;
  bg: string;
  nextLabel: string;
};

// Cores das colunas vêm de StudioSemantic (fonte única de cor de estado,
// theme-aware, AA). Mata o magenta-pra-estado das colunas awaiting/in_production.
function buildColumns(sem: StudioSemanticPalette): Column[] {
  return [
    // S-0: 1ª coluna pra pedidos de marketplace (ML/Shopee) sem personalização coletada.
    { key: "awaiting_customization", label: "Aguardando personalização", icon: "message-circle", color: sem.waiting.base,    bg: sem.waiting.soft,    nextLabel: "Coletar e enviar pra arte" },
    { key: "pending_art",   label: "Aguardando arte",  icon: "alert-circle", color: sem.art.base,        bg: sem.art.soft,        nextLabel: "Marcar como aprovado" },
    { key: "approved",      label: "Aprovado",         icon: "check",        color: sem.approved.base,   bg: sem.approved.soft,   nextLabel: "Iniciar produção" },
    { key: "in_production", label: "Em produção",      icon: "clock",        color: sem.production.base, bg: sem.production.soft, nextLabel: "Marcar como pronto" },
    { key: "ready",         label: "Pronto",           icon: "package",      color: sem.ready.base,      bg: sem.ready.soft,      nextLabel: "Marcar como entregue" },
    { key: "delivered",     label: "Entregue",         icon: "check-circle", color: sem.delivered.base,  bg: sem.delivered.soft,  nextLabel: "" },
  ];
}

const NEXT_STATUS: Record<StudioProductionStatus, StudioProductionStatus | null> = {
  awaiting_customization: "pending_art",
  pending_art:   "approved",
  approved:      "in_production",
  in_production: "ready",
  ready:         "delivered",
  delivered:     null,
  cancelled:     null,
};

function buildPlatformLabels(t: StudioPalette): Record<string, { label: string; bg: string; fg: string }> {
  return {
    mercado_livre: { label: "Mercado Livre", bg: t.warningSoft, fg: t.warningInk },
    shopee:        { label: "Shopee",        bg: "#FFEDD5",     fg: "#9A3412" },
  };
}

function fmtSla(createdAt: string): { txt: string; tone: "fresh" | "warm" | "late" } {
  const d = new Date(createdAt);
  const hours = (Date.now() - d.getTime()) / 3600000;
  if (hours < 24)  return { txt: `${Math.round(hours)}h atrás`,            tone: "fresh" };
  if (hours < 72)  return { txt: `${Math.round(hours / 24)}d atrás`,       tone: "warm" };
  return                   { txt: `${Math.round(hours / 24)}d (urgente)`,  tone: "late" };
}

// ── DraggableCard (sub-componente que consome o ref do hook) ─────────────────
// Separado para poder chamar useDraggableCardRef como hook (regra dos hooks:
// não pode ser chamado dentro de .map() diretamente).
function DraggableCard({
  o, col, t, s, dnd, NEXT_STATUS, PLATFORM_LABELS, onAdvance, onApproval, router,
}: {
  o: StudioOrder;
  col: Column;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  dnd: ReturnType<typeof useStudioKanbanDnD<StudioProductionStatus>>;
  NEXT_STATUS: Record<StudioProductionStatus, StudioProductionStatus | null>;
  PLATFORM_LABELS: Record<string, { label: string; bg: string; fg: string }>;
  onAdvance: (order: StudioOrder) => void;
  onApproval: (order: StudioOrder) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const cardRef = useDraggableCardRef(dnd.isWeb, o.id, dnd.onCardDragStart, dnd.onCardDragEnd);
  const sla = fmtSla(o.created_at);
  const next = NEXT_STATUS[col.key];
  const platformMeta = o.marketplace_platform ? PLATFORM_LABELS[o.marketplace_platform] : null;
  const isDragging = dnd.draggingId === o.id;

  return (
    <Pressable
      ref={cardRef}
      key={o.id}
      style={[s.card, isDragging && s.cardDragging]}
      onPress={() => router.push(`/studio/pedidos/${o.id}` as any)}
    >
      {dnd.isWeb && (
        <View style={s.dragHandle}>
          <Icon name="grip-vertical" size={14} color={t.ink4} />
        </View>
      )}
      <View style={s.cardHead}>
        <Text style={s.cardId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
        <View style={[s.slaChip,
                      sla.tone === "warm"  ? { backgroundColor: t.warningSoft } :
                      sla.tone === "late"  ? { backgroundColor: t.dangerSoft } : null]}>
          <Text style={[s.slaTxt,
                        sla.tone === "warm" ? { color: t.warningInk } :
                        sla.tone === "late" ? { color: t.dangerInk } : null]}>
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
          <Icon name="message-circle" size={10} color={t.infoInk} />
          <Text style={s.approvalBadgeTxt}>Aprovação enviada</Text>
        </View>
      )}
      <View style={s.cardActions}>
        {col.key === "awaiting_customization" && (
          <Pressable
            style={[s.btnApproval, { backgroundColor: t.accent }]}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); router.push(`/studio/pedidos/${o.id}` as any); }}
          >
            <Icon name="message-circle" size={12} color="#fff" />
            <Text style={s.btnApprovalTxt}>Coletar personalização</Text>
          </Pressable>
        )}
        {col.key === "pending_art" && (
          <Pressable
            style={s.btnApproval}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onApproval(o); }}
          >
            <Icon name="message-circle" size={12} color="#fff" />
            <Text style={s.btnApprovalTxt}>Solicitar aprovação</Text>
          </Pressable>
        )}
        {next && (
          <Pressable
            style={[s.btnAdvance, { backgroundColor: col.color }]}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onAdvance(o); }}
          >
            <Text style={s.btnAdvanceTxt}>{col.nextLabel} →</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default function StudioProducao() {
  const router = useRouter();
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const sem = useStudioSemantic();
  const COLUMNS = useMemo(() => buildColumns(sem), [sem]);
  const PLATFORM_LABELS = useMemo(() => buildPlatformLabels(t), [t]);

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

  // ── moveTo: lógica central de mover um pedido para qualquer status ────────
  // Preserva o tratamento de 409 deposit_required (P1 Camada 1).
  // advance() chama moveTo(order, NEXT_STATUS[cur]) para manter compat.
  // onDrop() de DnD também chama moveTo(order, targetStatus).
  const moveTo = useCallback(async (
    order: StudioOrder,
    targetStatus: StudioProductionStatus,
    force?: boolean,
  ) => {
    if (!company?.id) return;
    const cur = (order.studio_production_status || "pending_art") as StudioProductionStatus;
    // Optimistic update
    setOrders((prev) => prev.map((o) =>
      o.id === order.id ? { ...o, studio_production_status: targetStatus } : o
    ));
    try {
      await studioApi.updateProductionStatus(company.id, order.id, targetStatus, force);
      const col = COLUMNS.find((c) => c.key === targetStatus);
      toast.success(`✨ Movido pra ${col?.label}`);
    } catch (e: any) {
      // P1: gate de sinal — backend retorna 409 deposit_required quando
      // require_deposit_for_production=true e sinal não está confirmado.
      if (
        (e?.status === 409 || e?.code === 409) &&
        (e?.data?.error === "deposit_required" || e?.error === "deposit_required")
      ) {
        // Reverte optimistic update antes de pedir confirmação
        setOrders((prev) => prev.map((o) =>
          o.id === order.id ? { ...o, studio_production_status: cur } : o
        ));
        Alert.alert(
          "Sinal não recebido",
          e?.data?.message || e?.message ||
            "O sinal deste pedido ainda não foi confirmado. Deseja iniciar a produção mesmo assim?",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Iniciar mesmo assim",
              style: "destructive",
              onPress: () => moveTo(order, targetStatus, true),
            },
          ]
        );
        return;
      }
      toast.error(e?.message || "Erro ao atualizar");
      load();
    }
  }, [company?.id, COLUMNS, load]);

  // advance() = atalho para mover para o próximo status canônico
  const advance = useCallback((order: StudioOrder) => {
    const cur = (order.studio_production_status || "pending_art") as StudioProductionStatus;
    const next = NEXT_STATUS[cur];
    if (!next) return;
    moveTo(order, next);
  }, [moveTo]);

  // ── DnD setup ───────────────────────────────────────────────────────────
  // onDrop: recebe (orderId, toStatus) do drop zone e chama moveTo.
  // Política v1: permite drop em qualquer coluna — o gate 409 continua valendo.
  const onDrop = useCallback((orderId: string, toStatus: StudioProductionStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    moveTo(order, toStatus);
  }, [orders, moveTo]);

  const dnd = useStudioKanbanDnD<StudioProductionStatus>(onDrop);

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
    <StudioScreen variant="board" scroll={false} padded={false}>
      <View style={s.headerWrap}>
        <StudioPageHeader
          eyebrow="FLUXO DE PRODUÇÃO"
          title="Fila de produção"
          subtitle="Arraste os cards (ou use os botoes) pra mover."
          rightSlot={
            <Pressable style={s.reloadBtn} onPress={load} disabled={loading}>
              <Icon name="refresh-cw" size={14} color={t.ink2} />
              <Text style={s.reloadTxt}>{loading ? "Atualizando…" : "Atualizar"}</Text>
            </Pressable>
          }
        />
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
          {COLUMNS.map((col) => {
            // Drop zone ref por coluna
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const dropRef = useDropZoneRef<StudioProductionStatus>(
              col.key,
              dnd.onDrop,
              dnd.onHoverChange,
            );
            const isHovered = dnd.hoverStatus === col.key && dnd.draggingId !== null;
            return (
              <View
                key={col.key}
                ref={dropRef}
                style={[
                  s.col,
                  isHovered && { borderColor: col.color, borderWidth: 2, backgroundColor: col.bg },
                ]}
              >
                <View style={[s.colHead, { backgroundColor: col.bg }]}>
                  <View style={[s.colDot, { backgroundColor: col.color }]}>
                    <Icon name={col.icon as any} size={12} color="#fff" />
                  </View>
                  <Text style={[s.colTitle, { color: col.color }]}>{col.label}</Text>
                  <AnimatedKpiCounter
                    value={byStatus[col.key].length}
                    fontSize={12}
                    color={t.ink2}
                  />
                </View>
                <ScrollView style={s.colScroll} contentContainerStyle={{ padding: 10, gap: 10 }}>
                  {byStatus[col.key].length === 0 ? (
                    <Text style={s.colEmpty}>—</Text>
                  ) : byStatus[col.key].map((o) => (
                    <DraggableCard
                      key={o.id}
                      o={o}
                      col={col}
                      t={t}
                      s={s}
                      dnd={dnd}
                      NEXT_STATUS={NEXT_STATUS}
                      PLATFORM_LABELS={PLATFORM_LABELS}
                      onAdvance={advance}
                      onApproval={setApprovalFor}
                      router={router}
                    />
                  ))}
                </ScrollView>
              </View>
            );
          })}
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
    </StudioScreen>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.bg },
    headerWrap: {
      paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16,
    },
    reloadBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
      backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5,
    },
    reloadTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },

    boardScroll: { flex: 1 },
    board: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
    col: {
      width: 280,
      backgroundColor: t.paperCard,
      borderRadius: 16,
      borderWidth: 1, borderColor: t.ink5,
      overflow: "hidden",
      height: "100%",
    },
    colHead: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: t.ink5,
    },
    colDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    colTitle: { fontSize: 13, fontWeight: "800", flex: 1, letterSpacing: -0.1 },
    colScroll: { flex: 1, minHeight: 200 },
    colEmpty: { color: t.ink4, fontSize: 12, textAlign: "center", paddingVertical: 14 },

    card: {
      backgroundColor: t.paperCardElev,
      borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: t.ink5,
      gap: 6,
    },
    cardDragging: {
      opacity: 0.55,
    },
    dragHandle: {
      alignSelf: "center",
      marginBottom: 2,
    },
    cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardId: { fontSize: 10.5, color: t.ink4, fontWeight: "700", letterSpacing: 0.5 },
    slaChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: t.bgSoft },
    slaTxt: { fontSize: 10.5, fontWeight: "700", color: t.ink3 },
    cardName: { fontSize: 13.5, fontWeight: "700", color: t.ink, marginTop: 2 },
    cardMeta: { fontSize: 11.5, color: t.ink3 },
    platformBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      alignSelf: "flex-start", marginTop: 4,
    },
    platformBadgeTxt: { fontSize: 10.5, fontWeight: "800" },
    approvalBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: t.infoSoft,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      alignSelf: "flex-start", marginTop: 4,
    },
    approvalBadgeTxt: { fontSize: 10.5, color: t.infoInk, fontWeight: "700" },

    cardActions: { gap: 6, marginTop: 8 },
    btnApproval: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: t.success,
      paddingVertical: 8, borderRadius: 8,
    },
    btnApprovalTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
    btnAdvance: {
      paddingVertical: 8, borderRadius: 8,
      alignItems: "center",
    },
    btnAdvanceTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  });
}
