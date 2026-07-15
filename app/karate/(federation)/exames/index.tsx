// ============================================================
// Exames — Federação (Track J) · Shoji
//
// Breadcrumb: FPKT / Exames / Certificados
// Sub-tabs: Graduações | Certificados   (Bancas removida — fora de escopo;
//   Carteirinhas promovida a tela própria — /karate/carteirinhas)
//
// Aba Certificados (Track J):
//   — Caixa de certificados: todos os pedidos dos dojôs
//   — Filtros por estado (chips)
//   — Busca por praticante/dojô
//   — Seleção em lote + "Avançar para [estado]" + "Aplicar"
//   — Seletor de estado por linha (jump to any state)
//   — Drawer detalhe com timeline + processar
//   - Modal recusar (com motivo)
//
// Aba Graduações: no escopo, ainda sem fluxo dedicado nesta tela → mostra um
//   empty state limpo (sem placeholder poluído). O lançamento de graduações
//   acontece hoje na ficha do praticante.
//
// E-mail dispara no backend (best-effort post-commit), não no FE.
// Orquestrador slim: data-fetching/state/handlers preservados; UI e
// subcomponentes vivem em components/karate/certificados/* (Shoji).
// Sem deps novas. Mock-fallback se migration 182 pendente (503).
//
// F4.2: o título da página é "Certificados" para casar com o item de menu
//   "Certificados" que o usuário clicou (a rota é /karate/exames; as abas
//   Graduações/Certificados continuam dentro da página).
// ============================================================
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { normalizeCertStatus, CertOrderStatus } from "@/components/karate/EstadoSelo";
import {
  ShojiBackground, PageHead, SectionHead, SearchField, Chip,
} from "@/components/karate/shoji";
import { karateApi, CertOrder } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  SubTab, SUB_TABS, STATUS_FILTERS, cs,
} from "@/components/karate/certificados/shared";
import { RecusarModal } from "@/components/karate/certificados/RecusarModal";
import { DetalheDrawer } from "@/components/karate/certificados/DetalheDrawer";
import { OrderRow } from "@/components/karate/certificados/OrderRow";
import { BatchBar } from "@/components/karate/certificados/BatchBar";

// ── Main Screen ───────────────────────────────────────────────
export default function ExamesScreen() {
  const { federationId } = useKarateFederation();
  const [sub, setSub] = useState<SubTab>("certificados");

  // Certificados state
  const [orders, setOrders] = useState<CertOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<CertOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchTarget, setBatchTarget] = useState<CertOrderStatus>("in_production");
  const [detailOrder, setDetailOrder] = useState<CertOrder | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [recusarTarget, setRecusarTarget] = useState<string | "batch" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (search.trim()) params.q = search.trim();
      const res = await karateApi.listCertOrders(federationId, params);
      setOrders(res.data || []);
    } catch {
      // migration pendente ou sem conexão – mantém vazio
    } finally {
      setLoading(false);
    }
  }, [federationId, filterStatus, search]);

  useEffect(() => {
    if (sub === "certificados") load();
  }, [sub, load]);

  // ---- Advance single ----
  const advanceOrder = useCallback(async (orderId: string, status: CertOrderStatus | "refused_trigger") => {
    if (status === "refused_trigger") { setRecusarTarget(orderId); setRecusarOpen(true); return; }
    try {
      const updated = await karateApi.advanceCertOrderStatus(federationId, orderId, status);
      setOrders((prev) => prev.map((o) => o.id === orderId ? updated : o));
      if (detailOrder?.id === orderId) setDetailOrder(updated);
    } catch { /* best-effort */ }
  }, [federationId, detailOrder]);

  // ---- Batch advance ----
  const batchApply = useCallback(async () => {
    if (!selected.size) return;
    try {
      const res = await karateApi.batchCertOrderStatus(federationId, {
        order_ids: Array.from(selected),
        status: batchTarget,
      });
      const updatedMap = new Map(res.updated.map((o) => [o.id, o]));
      setOrders((prev) => prev.map((o) => updatedMap.get(o.id) ?? o));
      setSelected(new Set());
    } catch { /* best-effort */ }
  }, [federationId, selected, batchTarget]);

  // ---- Refuse ----
  const confirmRecusar = useCallback(async (reason: string) => {
    if (!recusarTarget) return;
    setRecusarOpen(false);
    if (recusarTarget === "batch") {
      const ids = Array.from(selected);
      await Promise.allSettled(
        ids.map((id) => karateApi.refuseCertOrder(federationId, id, reason)
          .then((upd) => setOrders((prev) => prev.map((o) => o.id === id ? upd : o)))
        )
      );
      setSelected(new Set());
    } else {
      try {
        const upd = await karateApi.refuseCertOrder(federationId, recusarTarget, reason);
        setOrders((prev) => prev.map((o) => o.id === recusarTarget ? upd : o));
        if (detailOrder?.id === recusarTarget) setDetailOrder(upd);
      } catch { /* best-effort */ }
    }
    setRecusarTarget(null);
  }, [federationId, recusarTarget, selected, detailOrder]);

  const openDetail = useCallback(async (order: CertOrder) => {
    setDetailOrder(order);
    setDrawerOpen(true);
    // tenta buscar detalhe com timeline
    try {
      const full = await karateApi.getCertOrder(federationId, order.id);
      setDetailOrder(full);
    } catch { /* mantém o que tem */ }
  }, [federationId]);

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const visibleOrders = orders;
  const pendentesCount = orders.filter((o) => ["requested","in_production","printed"].includes(o.status)).length;

  const countsByStatus = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.id] = f.id === "all" ? orders.length : orders.filter((o) => o.status === f.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Page head */}
        <PageHead
          eyebrow="Federação · Operação"
          title="Certificados"
          sub="Lançamento de certificados de graduações"
        />

        {/* Sub-tabs */}
        <View style={cs.subTabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 4 }}>
            {SUB_TABS.map((t) => (
              <TouchableOpacity key={t.id} style={[cs.subTab, sub === t.id && cs.subTabActive]} onPress={() => setSub(t.id)}
                accessibilityRole="tab" accessibilityState={{ selected: sub === t.id }}>
                <Text style={[cs.subTabText, sub === t.id && cs.subTabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Graduações: empty state limpo (sem placeholder poluído) */}
        {sub === "graduacoes" ? (
          <View style={cs.emptyState}>
            <Icon name="school-outline" size={34} color={C.ink4} />
            <Text style={cs.emptyStateTitle}>Graduações</Text>
            <Text style={cs.emptyStateText}>
              O lançamento de graduações é feito hoje na ficha de cada praticante.
              Em breve, o histórico de graduações da rede aparecerá aqui.
            </Text>
          </View>
        ) : (
          <>
            {/* Section header */}
            <SectionHead
              title="Caixa de certificados"
              sub="Pedidos de todos os dojôs — produção e expedição"
              actions={pendentesCount > 0 ? (
                <View style={cs.alertBadge}>
                  <View style={cs.alertDot} />
                  <Text style={cs.alertBadgeText}>{pendentesCount} aguardando</Text>
                </View>
              ) : undefined}
            />

            {/* Search */}
            <SearchField
              value={search}
              onChangeText={(v) => { setSearch(v); }}
              placeholder="Buscar praticante ou dojô..."
              onSubmit={load}
              style={{ marginBottom: 12 }}
            />

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
              {STATUS_FILTERS.map((f) => (
                <Chip key={f.id}
                  label={`${f.label} ${countsByStatus[f.id] > 0 ? countsByStatus[f.id] : ""}`.trim()}
                  active={filterStatus === f.id}
                  onPress={() => setFilterStatus(f.id)}
                />
              ))}
            </ScrollView>

            {/* Batch toolbar */}
            {selected.size > 0 ? (
              <BatchBar
                count={selected.size}
                batchTarget={batchTarget}
                onSetTarget={setBatchTarget}
                onApply={batchApply}
                onRefuse={() => { setRecusarTarget("batch"); setRecusarOpen(true); }}
                onClear={() => setSelected(new Set())}
              />
            ) : null}

            {/* Orders list */}
            {loading ? (
              <ActivityIndicator color={P.red} style={{ marginVertical: 32 }} />
            ) : visibleOrders.length === 0 ? (
              <View style={cs.empty}>
                <Icon name="ribbon-outline" size={32} color={C.ink4} />
                <Text style={cs.emptyText}>Nenhum pedido encontrado</Text>
              </View>
            ) : (
              visibleOrders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  selected={selected.has(o.id)}
                  onToggle={toggleSel}
                  onDetail={openDetail}
                />
              ))
            )}

            <Text style={cs.hint}>
              <Icon name="information-circle-outline" size={12} color={C.ink4} />
              {" "}Mudanças de estado disparam um e-mail ao dojô. O seletor no detalhe permite saltar para qualquer estado.
            </Text>
          </>
        )}

        {/* Modals */}
        <RecusarModal
          visible={recusarOpen}
          subtitle={
            recusarTarget === "batch"
              ? `${selected.size} pedido(s) serão recusados com o mesmo motivo.`
              : "O pedido será encerrado e o dojô notificado."
          }
          onClose={() => { setRecusarOpen(false); setRecusarTarget(null); }}
          onConfirm={confirmRecusar}
        />

        <DetalheDrawer
          order={detailOrder}
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onAdvance={advanceOrder}
          onRecusar={(id) => { setRecusarTarget(id); setRecusarOpen(true); }}
        />
      </ScrollView>
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
});
