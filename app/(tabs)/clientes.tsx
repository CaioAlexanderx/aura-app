import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions, ActivityIndicator, Modal, KeyboardAvoidingView } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useCustomers } from "@/hooks/useCustomers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import { CustomerRow } from "@/components/screens/clientes/CustomerRow";
import { RankingTab } from "@/components/screens/clientes/RankingTab";
import { RetentionTab } from "@/components/screens/clientes/RetentionTab";
import { TABS, fmt } from "@/components/screens/clientes/types";
import type { Customer } from "@/components/screens/clientes/types";
import { arrayToCSV, downloadCSV, CUSTOMER_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { RetentionCard } from "@/components/RetentionCard";
import { ReviewsList } from "@/components/ReviewsList";
import { ServerImport } from "@/components/ServerImport";
import { Icon } from "@/components/Icon";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const PAGE_SIZE = 20;

// PLAN-01 (11/05/2026): UpgradeCard local pras tabs avancadas (Ranking,
// Retencao, Avaliacoes) que sao Negocio+. Mostra o conteudo da tab como
// teaser dentro do card -- educa o user sobre o que tem no upgrade em vez
// de esconder a aba. CTA navega pra /(tabs)/planos.
function UpgradeCard({ title, description, features }: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <View style={u.wrap}>
      <View style={u.iconWrap}>
        <Icon name="star" size={20} color={Colors.violet3} />
      </View>
      <Text style={u.title}>{title}</Text>
      <Text style={u.desc}>{description}</Text>
      <View style={u.featuresList}>
        {features.map(f => (
          <View key={f} style={u.featureRow}>
            <Icon name="check" size={12} color={Colors.green} />
            <Text style={u.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/planos")}
        style={u.cta}
      >
        <Text style={u.ctaText}>Conhecer o plano Negocio</Text>
      </Pressable>
      <Text style={u.hint}>A partir de R$ 169/mes -- ative quando quiser</Text>
    </View>
  );
}

const u = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 6, textAlign: "center" },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 20, lineHeight: 18, maxWidth: 380 },
  featuresList: { gap: 10, marginBottom: 20, alignSelf: "stretch", maxWidth: 380, marginHorizontal: "auto" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 13, color: Colors.ink, flex: 1 },
  cta: {
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingHorizontal: 22, paddingVertical: 12,
    marginBottom: 10,
  },
  ctaText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  hint: { fontSize: 11, color: Colors.ink3, textAlign: "center" },
});

export default function ClientesScreen() {
  const {
    customers, isLoading, isDemo, planBlocked, bulkDeleting,
    addCustomer, updateCustomer, deleteCustomer, bulkDeleteCustomers,
    consolidatedView, companyCount,
    plan, planLimit,
  } = useCustomers();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // PLAN-01: tabs avancadas (Ranking, Retencao, Avaliacoes) sao Negocio+.
  // Essencial ve as tabs mas o conteudo vira UpgradeCard.
  const isEssencial = plan === "essencial";

  // Modal de formulario: visivel quando adicionar ou editar
  const formModalVisible = showAdd || !!editTarget;
  function closeFormModal() { setShowAdd(false); setEditTarget(null); }

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.email.toLowerCase().includes(s) || c.instagram.toLowerCase().includes(s);
  });

  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, search);
  const totalLtv = customers.reduce((s, c) => s + c.totalSpent, 0);

  const pageIds        = paginated.map(c => c.id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every(id => bulkSelected.has(id));

  // MULTICNPJ Onda 2.3: mostra badge da loja em cada cliente quando o
  // owner tem 2+ empresas. Vale tanto em consolidated quanto per-company
  // (lista e a mesma owner-scoped, mostrar a origem ajuda a entender).
  const showCompanyBadge = (companyCount || 1) > 1;

  function handleAdd(c: Customer) { addCustomer(c); closeFormModal(); }
  function handleEdit(c: Customer) { updateCustomer(c.id, c); closeFormModal(); }
  function handleTabSelect(i: number) { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (customers.length === 0) { toast.error("Nenhum cliente para exportar"); return; }
    downloadCSV(arrayToCSV(customers, CUSTOMER_COLUMNS), `aura_clientes_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectPage() {
    if (pageAllSelected) {
      setBulkSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setBulkSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  function exitBulkMode() { setBulkMode(false); setBulkSelected(new Set()); }

  async function handleBulkDelete() {
    await bulkDeleteCustomers(Array.from(bulkSelected));
    exitBulkMode();
  }

  const bulkConfirmMessage = bulkSelected.size > 50
    ? `Voce selecionou ${bulkSelected.size} clientes. Esta acao nao pode ser desfeita e pode levar alguns segundos.`
    : "Esta acao nao pode ser desfeita. Os clientes selecionados serao removidos permanentemente.";

  // PLAN-01: mostra contagem X / limite no card de resumo.
  // Estimulo natural pra upgrade quando se aproxima do limite.
  const customerCountLabel = planLimit && planLimit < 999999
    ? `${customers.length} / ${planLimit.toLocaleString("pt-BR")}`
    : String(customers.length);
  const nearLimit = planLimit && planLimit < 999999 && customers.length / planLimit >= 0.85;

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Text style={s.pageTitle}>Clientes</Text>
        <Pressable onPress={() => { setShowAdd(true); setEditTarget(null); setTab(0); }} style={s.addBtn}>
          <Text style={s.addBtnText}>+ Adicionar</Text>
        </Pressable>
      </View>

      {/* MULTICNPJ Onda 2.3: banner explicativo de lista unica owner-scoped */}
      {showCompanyBadge && (
        <View style={s.consolidatedBanner}>
          <Icon name="users" size={14} color="#a78bfa" />
          <View style={{ flex: 1 }}>
            <Text style={s.consolidatedTitle}>
              {consolidatedView
                ? `Lista unica · ${companyCount} empresas`
                : `Lista compartilhada entre suas ${companyCount} empresas`}
            </Text>
            <Text style={s.consolidatedSub}>
              Os clientes sao do dono, nao da loja. Cada cliente aparece uma so vez, mesmo que compre em qualquer das suas empresas.
            </Text>
          </View>
        </View>
      )}

      {/* PLAN-01: aviso de limite proximo (>=85% do plano) */}
      {nearLimit && (
        <Pressable onPress={() => router.push("/(tabs)/planos")} style={s.nearLimitBanner}>
          <Icon name="alert" size={14} color={Colors.amber} />
          <View style={{ flex: 1 }}>
            <Text style={s.nearLimitTitle}>
              {customers.length >= planLimit
                ? `Limite do plano atingido (${planLimit.toLocaleString("pt-BR")} clientes)`
                : `Voce esta perto do limite (${customers.length} / ${planLimit.toLocaleString("pt-BR")})`}
            </Text>
            <Text style={s.nearLimitSub}>Toque para ver opcoes de upgrade</Text>
          </View>
          <Icon name="chevron_right" size={16} color={Colors.amber} />
        </Pressable>
      )}

      {planBlocked && (
        <View style={s.planBlock}><Text style={s.planBlockText}>Sem acesso ao modulo de clientes neste momento.</Text></View>
      )}

      <View style={s.summaryRow}>
        <View style={s.card}>
          <Text style={s.cardLabel}>TOTAL CLIENTES</Text>
          <Text style={s.cardValue}>{customerCountLabel}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>FATURAMENTO TOTAL</Text>
          <Text style={[s.cardValue, { color: Colors.green }]}>{fmt(totalLtv)}</Text>
        </View>
      </View>

      {/* RetentionCard so pra Negocio+ (chama endpoint /retention que e Negocio+). */}
      {tab === 0 && !planBlocked && !isDemo && !consolidatedView && !isEssencial && <RetentionCard />}

      {/* Modal de formulario (adicionar e editar) */}
      <Modal
        visible={formModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeFormModal}
      >
        <KeyboardAvoidingView
          style={s.modalWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Overlay — toque fora fecha */}
          <Pressable style={s.modalOverlay} onPress={closeFormModal} />
          <View style={s.modalContent}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 0 }}
              showsVerticalScrollIndicator={false}
            >
              <AddCustomerForm
                initialData={editTarget || undefined}
                onSave={editTarget ? handleEdit : handleAdd}
                onCancel={closeFormModal}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {TABS.map((t, i) => (
          <Pressable key={t} onPress={() => handleTabSelect(i)} style={[s.tab, tab === i && s.tabActive]}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
            {/* PLAN-01: cadeado discreto nas tabs avancadas pro Essencial */}
            {isEssencial && i > 0 && (
              <Icon name="lock" size={10} color={tab === i ? "#fff" : Colors.ink3} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      {tab === 0 && !planBlocked && (
        <View style={s.importRow}>
          <ImportExportBar onExport={handleExport} itemCount={customers.length} />
          {!consolidatedView && (
            <ServerImport entity="customers" onComplete={() => qc.invalidateQueries({ queryKey: ["customers"] })} />
          )}
          {!bulkMode ? (
            <Pressable onPress={() => setBulkMode(true)} style={s.bulkBtn}>
              <Text style={s.bulkBtnText}>Selecionar</Text>
            </Pressable>
          ) : (
            <Pressable onPress={exitBulkMode} style={[s.bulkBtn, { backgroundColor: Colors.bg4 }]}>
              <Text style={[s.bulkBtnText, { color: Colors.ink3 }]}>Cancelar</Text>
            </Pressable>
          )}
        </View>
      )}

      {bulkMode && (
        <View style={s.bulkBar}>
          <Pressable onPress={handleSelectPage} style={s.bulkAction}>
            <Text style={s.bulkActionText}>
              {pageAllSelected ? "Desmarcar pagina" : "Pag. atual"}
            </Text>
          </Pressable>

          {bulkSelected.size > 0 ? (
            <>
              <Text style={s.bulkCount}>{bulkSelected.size} selecionado{bulkSelected.size !== 1 ? "s" : ""}</Text>
              <Pressable
                onPress={() => setShowBulkConfirm(true)}
                disabled={bulkDeleting}
                style={[s.bulkAction, s.bulkDeleteAction, bulkDeleting && { opacity: 0.5 }]}
              >
                {bulkDeleting
                  ? <ActivityIndicator size="small" color={Colors.red} />
                  : <Text style={[s.bulkActionText, { color: Colors.red }]}>Excluir {bulkSelected.size}</Text>
                }
              </Pressable>
            </>
          ) : (
            <Text style={[s.bulkCount, { color: Colors.ink3, fontWeight: "400" }]}>
              Toque nos clientes para selecionar
            </Text>
          )}
        </View>
      )}

      {tab === 0 && (
        <View>
          <TextInput style={s.searchInput} placeholder="Buscar por nome, telefone, email ou Instagram..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
          <View style={s.listCard}>
            {filtered.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum cliente cadastrado</Text>
              </View>
            )}
            {paginated.map(c => (
              <CustomerRow
                key={c.id}
                c={c}
                expanded={!bulkMode && expandedId === c.id}
                onToggle={() => !bulkMode && setExpandedId(expandedId === c.id ? null : c.id)}
                onEdit={!bulkMode ? (customer) => { setEditTarget(customer); setShowAdd(false); } : undefined}
                onDelete={!bulkMode ? (id) => setDeleteTarget(id) : undefined}
                isSelected={bulkSelected.has(c.id)}
                onSelect={bulkMode ? toggleBulkSelect : undefined}
                showCompanyBadge={showCompanyBadge}
              />
            ))}
          </View>
          <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
        </View>
      )}

      {/* PLAN-01: tabs avancadas com UpgradeCard pro Essencial */}
      {tab === 1 && (isEssencial ? (
        <UpgradeCard
          title="Ranking de clientes"
          description="Veja seus clientes ordenados por faturamento, visitas e ticket medio. Identifique seus VIPs e quem precisa de atencao."
          features={[
            "Top clientes por LTV (faturamento total)",
            "Top por frequencia (numero de visitas)",
            "Ticket medio por cliente",
            "Status automatico: VIP, Frequente, Novo, Inativo",
          ]}
        />
      ) : <RankingTab customers={customers} />)}

      {tab === 2 && (isEssencial ? (
        <UpgradeCard
          title="Retencao e clientes em risco"
          description="Saiba quem voltou e quem nao voltou. Reaja antes de perder um bom cliente."
          features={[
            "Taxa de retencao mensal",
            "Clientes em risco (30-90 dias sem comprar)",
            "Clientes perdidos (90+ dias)",
            "Comparativo: novos vs voltando",
          ]}
        />
      ) : <RetentionTab />)}

      {tab === 3 && (isEssencial ? (
        <UpgradeCard
          title="Avaliacoes de clientes"
          description="Receba avaliacoes apos cada compra e construa reputacao publica."
          features={[
            "Pedido automatico de avaliacao apos a venda",
            "Resumo: estrelas medias + total de reviews",
            "Comentarios publicos no Canal Digital",
            "Notificacao quando voce recebe uma avaliacao",
          ]}
        />
      ) : <ReviewsList />)}

      <ConfirmDialog visible={!!deleteTarget} title="Excluir cliente?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive
        onConfirm={() => { if (deleteTarget) { deleteCustomer(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)} />

      <ConfirmDialog
        visible={showBulkConfirm}
        title={`Excluir ${bulkSelected.size} cliente${bulkSelected.size !== 1 ? "s" : ""}`}
        message={bulkConfirmMessage}
        confirmLabel="Confirmar exclusao"
        destructive
        onConfirm={() => { setShowBulkConfirm(false); handleBulkDelete(); }}
        onCancel={() => setShowBulkConfirm(false)}
      />

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: "transparent" },
  content:          { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  headerRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 },
  pageTitle:        { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  addBtn:           { backgroundColor: Colors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  addBtnText:       { color: "#fff", fontSize: 13, fontWeight: "700" },
  planBlock:        { backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.amber + "44" },
  planBlockText:    { fontSize: 12, color: Colors.amber, fontWeight: "500" },
  summaryRow:       { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 16 },
  card:             { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel:        { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue:        { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  tab:              { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive:        { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText:          { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive:    { color: "#fff", fontWeight: "600" },
  importRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" },
  bulkBtn:          { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  bulkBtnText:      { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  bulkBar:          { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2, flexWrap: "wrap" },
  bulkCount:        { fontSize: 13, color: Colors.violet3, fontWeight: "700", flex: 1 },
  bulkAction:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  bulkDeleteAction: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  bulkActionText:   { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchInput:      { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 16 },
  listCard:         { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  demoBanner:       { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText:         { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  // MULTICNPJ Onda 2.3
  consolidatedBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  consolidatedTitle: { fontSize: 12.5, fontWeight: "700", color: "#c4b5fd", letterSpacing: 0.2 },
  consolidatedSub: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 14 },
  // PLAN-01: banner near-limit
  nearLimitBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: Colors.amberD,
    borderWidth: 1,
    borderColor: Colors.amber + "44",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  nearLimitTitle: { fontSize: 13, color: Colors.amber, fontWeight: "700" },
  nearLimitSub: { fontSize: 11, color: Colors.amber, opacity: 0.85, marginTop: 1 },
  // Modal de formulario (adicionar/editar)
  modalWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalContent: {
    width: IS_WIDE ? 560 : "92%",
    maxHeight: "88%",
    borderRadius: 20,
    overflow: "hidden",
  },
});
