// ============================================================
// Exames — Federação (Track J)
//
// Breadcrumb: FPKT / Exames / Certificados
// Sub-tabs: Bancas | Graduações | Certificados
//
// Aba Certificados (Track J):
//   — Caixa de certificados: todos os pedidos dos dojôs
//   — Filtros por estado (pills)
//   — Busca por praticante/dojô
//   — Seleção em lote + "Avançar para [estado]" + "Aplicar"
//   — Seletor de estado por linha (jump to any state)
//   — Drawer detalhe com timeline + processar
//   — Modal recusar (com motivo)
//
// E-mail dispara no backend (best-effort post-commit), não no FE.
// StyleSheet: todos top-level são objetos (WeakMap safe).
// Sem deps novas. Mock-fallback se migration 182 pendente (503).
// ============================================================
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  StyleSheet, ActivityIndicator, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { EstadoSelo, normalizeCertStatus, CertOrderStatus } from "@/components/karate/EstadoSelo";
import { karateApi, CertOrder } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// ── Sub-tabs ──────────────────────────────────────────────────
type SubTab = "bancas" | "graduacoes" | "certificados";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "bancas",       label: "Bancas" },
  { id: "graduacoes",   label: "Graduações" },
  { id: "certificados", label: "Certificados" },
];

// ── Estado filter pills ───────────────────────────────────────
const STATUS_FILTERS: { id: CertOrderStatus | "all"; label: string }[] = [
  { id: "all",          label: "Todos" },
  { id: "requested",    label: "Solicitado" },
  { id: "in_production",label: "Em produção" },
  { id: "printed",      label: "Impresso" },
  { id: "shipped",      label: "Enviado" },
  { id: "refused",      label: "Recusado" },
];

const ADVANCE_OPTIONS: { value: CertOrderStatus; label: string }[] = [
  { value: "in_production", label: "Em produção" },
  { value: "printed",       label: "Impresso" },
  { value: "shipped",       label: "Enviado" },
];

// ── Helpers ───────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

// ── StatusSelectRow (dropdown simulado como radio) ────────────
const STATUS_SELECT_OPTIONS: { value: CertOrderStatus | "refused_trigger"; label: string }[] = [
  { value: "requested",    label: "Solicitado" },
  { value: "in_production",label: "Em produção" },
  { value: "printed",      label: "Impresso" },
  { value: "shipped",      label: "Enviado" },
  { value: "refused_trigger", label: "Recusado…" },
];

// ── RecusarModal ──────────────────────────────────────────────
function RecusarModal({
  visible, subtitle, onClose, onConfirm,
}: { visible: boolean; subtitle: string; onClose: () => void; onConfirm: (reason: string) => void; }) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => { if (!visible) setMotivo(""); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={st.recusarCard}>
          <Text style={st.recusarTitle}>Recusar pedido</Text>
          <Text style={st.recusarSub}>{subtitle}</Text>
          <Text style={st.fieldLabel}>Motivo</Text>
          <TextInput
            style={[st.field, { minHeight: 80, textAlignVertical: "top" }]}
            value={motivo}
            onChangeText={setMotivo}
            placeholder="Ex.: Nome divergente do RG — reenviar com a grafia correta."
            placeholderTextColor={KarateColors.ink4}
            multiline
          />
          <Text style={st.recusarHint}>O dojô recebe o motivo por e-mail e pode reenviar o pedido.</Text>
          <View style={st.recusarFooter}>
            <TouchableOpacity style={st.btnGhost} onPress={onClose}>
              <Text style={st.btnGhostText}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.btnDanger} onPress={() => onConfirm(motivo.trim() || "Pedido recusado.")}>
              <Text style={st.btnDangerText}>Confirmar recusa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── DetalheDrawer ─────────────────────────────────────────────
function DetalheDrawer({
  order, visible, onClose, onAdvance, onRecusar,
}: {
  order: CertOrder | null;
  visible: boolean;
  onClose: () => void;
  onAdvance: (orderId: string, status: CertOrderStatus | "refused_trigger") => void;
  onRecusar: (orderId: string) => void;
}) {
  if (!order) return null;
  const history = order.history || [];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={st.drawer}>
          <View style={st.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.drawerMono}>{order.id.slice(0,8).toUpperCase()}</Text>
              <Text style={st.drawerName}>{order.nome_impresso}</Text>
              <Text style={st.drawerBelt}>{order.belt_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Text style={st.kLabel}>Estado</Text>
              <EstadoSelo status={normalizeCertStatus(order.status)} />
            </View>

            {order.status === "refused" && order.refusal_reason ? (
              <View style={st.refusalBox}>
                <Text style={st.refusalTitle}>Motivo da recusa</Text>
                <Text style={st.refusalText}>{order.refusal_reason}</Text>
              </View>
            ) : null}

            <View style={st.kvList}>
              <View style={st.kvRow}><Text style={st.kLabel}>Nome impresso</Text><Text style={st.kValue}>{order.nome_impresso}</Text></View>
              <View style={st.kvRow}><Text style={st.kLabel}>Banca</Text><Text style={st.kValue}>{order.exam_ref || order.exam_date || "—"}</Text></View>
              <View style={st.kvRow}>
                <Text style={st.kLabel}>Entrega</Text>
                <View>
                  <Text style={st.kValue}>{order.delivery_type === "mail" ? "Envio por correio" : "Retirada no dojô"}</Text>
                  {order.delivery_type === "mail" && order.addr_logradouro ? (
                    <Text style={st.kAddr}>{order.addr_logradouro}{order.addr_numero ? ", " + order.addr_numero : ""}{"\n"}{order.addr_complemento ? order.addr_complemento + "\n" : ""}{order.addr_cep} · {order.addr_cidade}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            <Text style={[st.fieldLabel, { marginTop: 20, marginBottom: 10 }]}>Linha do tempo</Text>
            {history.length === 0 ? (
              <Text style={st.kValue}>Nenhum registro ainda</Text>
            ) : (
              history.map((h, i) => (
                <View key={h.id} style={st.tlRow}>
                  <View style={st.tlDotCol}>
                    <View style={[st.tlDot, { backgroundColor: i === history.length - 1 ? KarateColors.primary : KarateColors.border }]} />
                    {i < history.length - 1 ? <View style={st.tlLine} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <EstadoSelo status={normalizeCertStatus(h.to_status)} />
                    <Text style={st.tlWho}>{h.who_name || "—"}</Text>
                    <Text style={st.tlOrg}>{h.org_name || ""} · {fmtDate(h.created_at)}</Text>
                  </View>
                </View>
              ))
            )}

            {order.status !== "refused" && order.status !== "shipped" ? (
              <View style={st.processBox}>
                <Text style={[st.fieldLabel, { marginBottom: 10 }]}>Processar</Text>
                <View style={{ gap: 6 }}>
                  {STATUS_SELECT_OPTIONS.filter((o) => o.value !== order.status).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={st.processOpt}
                      onPress={() => {
                        if (opt.value === "refused_trigger") { onRecusar(order.id); }
                        else { onAdvance(order.id, opt.value as CertOrderStatus); }
                      }}
                    >
                      <Text style={[st.processOptText, opt.value === "refused_trigger" && { color: KarateColors.danger }]}>{opt.label}</Text>
                      <Ionicons name="chevron-forward" size={14} color={KarateColors.ink4} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

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
      // migration pendente ou sem conexão — mantém vazio
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
    <ScrollView style={st.screen} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
      {/* Page head */}
      <View style={st.pageHead}>
        <Text style={st.eyebrow}>Federação · Operação</Text>
        <Text style={st.h1}>Exames</Text>
        <Text style={st.pageSub}>Bancas, lançamento de graduações e a caixa de certificados — pedidos dos dojôs que a federação imprime e expede.</Text>
      </View>

      {/* Sub-tabs */}
      <View style={st.subTabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 4 }}>
          {SUB_TABS.map((t) => (
            <TouchableOpacity key={t.id} style={[st.subTab, sub === t.id && st.subTabActive]} onPress={() => setSub(t.id)}
              accessibilityRole="tab" accessibilityState={{ selected: sub === t.id }}>
              <Text style={[st.subTabText, sub === t.id && st.subTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stub content for non-cert tabs */}
      {sub !== "certificados" ? (
        <View style={st.stubBox}>
          <Text style={st.stubText}>{sub === "bancas" ? "Bancas examinadoras — fora do escopo deste fluxo." : "Lançamento de graduações — fora do escopo deste fluxo."}</Text>
        </View>
      ) : (
        <>
          {/* Section header */}
          <View style={st.sectionHead}>
            <View>
              <Text style={st.h2}>Caixa de certificados</Text>
              <Text style={st.sh}>Pedidos de todos os dojôs — produção e expedição</Text>
            </View>
            {pendentesCount > 0 && (
              <View style={st.alertBadge}>
                <View style={st.alertDot} />
                <Text style={st.alertBadgeText}>{pendentesCount} aguardando</Text>
              </View>
            )}
          </View>

          {/* Search */}
          <View style={st.searchBox}>
            <Ionicons name="search" size={14} color={KarateColors.ink3} />
            <TextInput
              style={st.searchInput}
              placeholder="Buscar praticante ou dojô..."
              placeholderTextColor={KarateColors.ink4}
              value={search}
              onChangeText={(v) => { setSearch(v); }}
              returnKeyType="search"
              onSubmitEditing={load}
            />
            {search ? <TouchableOpacity onPress={() => { setSearch(""); }}><Ionicons name="close-circle" size={16} color={KarateColors.ink4} /></TouchableOpacity> : null}
          </View>

          {/* Filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity key={f.id}
                style={[st.filterPill, filterStatus === f.id && st.filterPillActive]}
                onPress={() => setFilterStatus(f.id)}
              >
                <Text style={[st.filterPillText, filterStatus === f.id && st.filterPillTextActive]}>
                  {f.label} {countsByStatus[f.id] > 0 ? countsByStatus[f.id] : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Batch toolbar */}
          {selected.size > 0 ? (
            <View style={st.batchBar}>
              <Text style={st.batchCount}>{selected.size}</Text>
              <Text style={st.batchLabel}>selecionado(s) — processar em lote</Text>
              <View style={{ flex: 1 }} />
              <Text style={st.batchForLabel}>Avançar para</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
                {ADVANCE_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt.value}
                    style={[st.batchOpt, batchTarget === opt.value && st.batchOptSel]}
                    onPress={() => setBatchTarget(opt.value)}
                  >
                    <Text style={[st.batchOptText, batchTarget === opt.value && st.batchOptTextSel]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={st.btnPrimary} onPress={batchApply}>
                <Text style={st.btnPrimaryText}>Aplicar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.btnGhost}
                onPress={() => { setRecusarTarget("batch"); setRecusarOpen(true); }}>
                <Text style={st.btnGhostText}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelected(new Set())}>
                <Ionicons name="close" size={18} color={KarateColors.ink3} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Orders list */}
          {loading ? (
            <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 32 }} />
          ) : visibleOrders.length === 0 ? (
            <View style={st.empty}>
              <Ionicons name="ribbon-outline" size={32} color={KarateColors.ink4} />
              <Text style={st.emptyText}>Nenhum pedido encontrado</Text>
            </View>
          ) : (
            visibleOrders.map((o) => (
              <View key={o.id} style={[st.orderRow, selected.has(o.id) && st.orderRowSel]}>
                <TouchableOpacity onPress={() => toggleSel(o.id)} style={st.checkbox}>
                  <View style={[st.checkboxBox, selected.has(o.id) && st.checkboxBoxSel]}>
                    {selected.has(o.id) ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
                  </View>
                </TouchableOpacity>
                <View style={st.av}><Text style={st.avText}>{initials(o.nome_impresso)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{o.nome_impresso}</Text>
                  <Text style={st.orderMeta}>{o.belt_name} · {fmtDate(o.created_at)}</Text>
                </View>
                <EstadoSelo status={normalizeCertStatus(o.status)} />
                <TouchableOpacity onPress={() => openDetail(o)} style={st.detailBtn}>
                  <Text style={st.detailBtnText}>Detalhe</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={st.hint}>
            <Ionicons name="information-circle-outline" size={12} color={KarateColors.ink4} />
            {" "}Mudanças de estado disparam um e-mail ao dojô (Track I). O seletor no detalhe permite saltar para qualquer estado.
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
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, paddingBottom: 48 } as ViewStyle,

  pageHead: { marginBottom: 20 } as ViewStyle,
  eyebrow: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  h1: { fontSize: 28, fontWeight: "800", color: KarateColors.ink, letterSpacing: -0.5 } as TextStyle,
  pageSub: { fontSize: 13, color: KarateColors.ink2, marginTop: 6, lineHeight: 20 } as TextStyle,

  subTabBar: { borderBottomWidth: 1, borderBottomColor: KarateColors.border, marginBottom: 20 } as ViewStyle,
  subTab: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 } as ViewStyle,
  subTabActive: { borderBottomColor: KarateColors.primary } as ViewStyle,
  subTabText: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  subTabTextActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  stubBox: { paddingVertical: 48, alignItems: "center" } as ViewStyle,
  stubText: { fontSize: 13, color: KarateColors.ink3 } as TextStyle,

  sectionHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 } as ViewStyle,
  h2: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sh: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  alertBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: "#FCA5A5" } as ViewStyle,
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: KarateColors.danger } as ViewStyle,
  alertBadgeText: { fontSize: 11, fontWeight: "700", color: KarateColors.danger } as TextStyle,

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, outlineStyle: "none" } as any,

  filterPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  filterPillActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  filterPillText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  filterPillTextActive: { color: KarateColors.primary } as TextStyle,

  batchBar: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 14, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, marginBottom: 14 } as ViewStyle,
  batchCount: { fontSize: 18, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  batchLabel: { fontSize: 12, color: KarateColors.ink2 } as TextStyle,
  batchForLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.08, color: KarateColors.ink3 } as TextStyle,
  batchOpt: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  batchOptSel: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  batchOptText: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  batchOptTextSel: { color: "#fff", fontWeight: "700" } as TextStyle,

  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  orderRowSel: { backgroundColor: "#FEF2F2" } as ViewStyle,
  checkbox: { padding: 4 } as ViewStyle,
  checkboxBox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: KarateColors.border, alignItems: "center", justifyContent: "center" } as ViewStyle,
  checkboxBoxSel: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  av: { width: 34, height: 34, borderRadius: 17, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  avText: { fontSize: 12, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  name: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  orderMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 2, fontFamily: "monospace" } as TextStyle,
  detailBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  detailBtnText: { fontSize: 11.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 } as ViewStyle,
  emptyText: { fontSize: 13, color: KarateColors.ink4 } as TextStyle,

  hint: { fontSize: 11.5, color: KarateColors.ink4, marginTop: 14, lineHeight: 18 } as TextStyle,

  btnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  btnPrimaryText: { fontSize: 12.5, fontWeight: "700", color: "#fff" } as TextStyle,
  btnGhost: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff" } as ViewStyle,
  btnGhostText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  btnDanger: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KarateColors.danger, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  btnDangerText: { fontSize: 12.5, fontWeight: "700", color: "#fff" } as TextStyle,

  fieldLabel: { fontSize: 10.5, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.06, color: KarateColors.ink3, marginBottom: 6 } as TextStyle,
  field: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 11, fontSize: 13, color: KarateColors.ink, backgroundColor: "#fff" } as ViewStyle,

  // Recusar modal
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.34)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  recusarCard: { backgroundColor: "#fff", borderRadius: KarateRadius.md, padding: 24, width: "100%", maxWidth: 460 } as ViewStyle,
  recusarTitle: { fontSize: 17, fontWeight: "800", color: KarateColors.ink, marginBottom: 4 } as TextStyle,
  recusarSub: { fontSize: 12.5, color: KarateColors.ink3, marginBottom: 16 } as TextStyle,
  recusarHint: { fontSize: 11, color: KarateColors.ink3, marginTop: 10 } as TextStyle,
  recusarFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 } as ViewStyle,

  // Detalhe drawer
  drawer: { backgroundColor: "#fff", borderTopLeftRadius: KarateRadius.lg, borderTopRightRadius: KarateRadius.lg, width: "100%", maxHeight: "90%", overflow: "hidden" } as ViewStyle,
  drawerHeader: { flexDirection: "row", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  drawerMono: { fontSize: 10, fontFamily: "monospace", color: KarateColors.ink3, letterSpacing: 0.04 } as TextStyle,
  drawerName: { fontSize: 20, fontWeight: "800", color: KarateColors.ink, marginTop: 4 } as TextStyle,
  drawerBelt: { fontSize: 12, color: KarateColors.ink3, marginTop: 4 } as TextStyle,

  kvList: { gap: 0, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, overflow: "hidden" } as ViewStyle,
  kvRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 10, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  kLabel: { fontSize: 11, fontWeight: "700", color: KarateColors.ink3, width: 90, flexShrink: 0, paddingTop: 1 } as TextStyle,
  kValue: { fontSize: 13, color: KarateColors.ink, flex: 1 } as TextStyle,
  kAddr: { fontSize: 11, color: KarateColors.ink3, marginTop: 4, fontFamily: "monospace", lineHeight: 18 } as TextStyle,

  refusalBox: { padding: 12, borderWidth: 1, borderColor: "#FCA5A5", borderRadius: KarateRadius.sm, backgroundColor: "#FEF2F2", marginBottom: 14 } as ViewStyle,
  refusalTitle: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.1, color: KarateColors.danger, marginBottom: 6 } as TextStyle,
  refusalText: { fontSize: 12.5, color: KarateColors.ink, lineHeight: 19 } as TextStyle,

  tlRow: { flexDirection: "row", gap: 12 } as ViewStyle,
  tlDotCol: { width: 18, alignItems: "center" } as ViewStyle,
  tlDot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 6 } as ViewStyle,
  tlLine: { width: 1, flex: 1, backgroundColor: KarateColors.border, marginVertical: 2 } as ViewStyle,
  tlWho: { fontSize: 12, fontWeight: "600", color: KarateColors.ink, marginTop: 6 } as TextStyle,
  tlOrg: { fontSize: 11, color: KarateColors.ink3, marginTop: 2, fontFamily: "monospace" } as TextStyle,

  processBox: { marginTop: 20, padding: 14, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.surface } as ViewStyle,
  processOpt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  processOptText: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
});
