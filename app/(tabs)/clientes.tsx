import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
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

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const PAGE_SIZE = 20;

export default function ClientesScreen() {
  const { customers, isLoading, isDemo, planBlocked, addCustomer, updateCustomer, deleteCustomer, bulkDeleteCustomers } = useCustomers();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Bulk select
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.email.toLowerCase().includes(s) || c.instagram.toLowerCase().includes(s);
  });

  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, search);
  const totalLtv = customers.reduce((s, c) => s + c.totalSpent, 0);

  function handleAdd(c: Customer) { addCustomer(c); setShowAdd(false); }
  function handleEdit(c: Customer) { updateCustomer(c.id, c); setEditTarget(null); }
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

  function handleSelectAll() {
    if (bulkSelected.size === filtered.length) setBulkSelected(new Set());
    else setBulkSelected(new Set(filtered.map(c => c.id)));
  }

  function exitBulkMode() { setBulkMode(false); setBulkSelected(new Set()); }

  async function handleBulkDelete() {
    await bulkDeleteCustomers(Array.from(bulkSelected));
    exitBulkMode();
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Text style={s.pageTitle}>Clientes</Text>
        <Pressable onPress={() => { setShowAdd(true); setEditTarget(null); setTab(0); }} style={s.addBtn}>
          <Text style={s.addBtnText}>+ Adicionar</Text>
        </Pressable>
      </View>

      {planBlocked && (
        <View style={s.planBlock}><Text style={s.planBlockText}>Clientes disponivel a partir do plano Negocio.</Text></View>
      )}

      <View style={s.summaryRow}>
        <View style={s.card}><Text style={s.cardLabel}>TOTAL CLIENTES</Text><Text style={s.cardValue}>{customers.length}</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>FATURAMENTO TOTAL</Text><Text style={[s.cardValue, { color: Colors.green }]}>{fmt(totalLtv)}</Text></View>
      </View>

      {tab === 0 && !planBlocked && !isDemo && <RetentionCard />}

      {showAdd && !editTarget && <AddCustomerForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />}
      {editTarget && <AddCustomerForm initialData={editTarget} onSave={handleEdit} onCancel={() => setEditTarget(null)} />}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {TABS.map((t, i) => (
          <Pressable key={t} onPress={() => handleTabSelect(i)} style={[s.tab, tab === i && s.tabActive]}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 0 && !planBlocked && (
        <View style={s.importRow}>
          <ImportExportBar onExport={handleExport} itemCount={customers.length} />
          <ServerImport entity="customers" onComplete={() => qc.invalidateQueries({ queryKey: ["customers", company?.id] })} />
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

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <View style={s.bulkBar}>
          <Text style={s.bulkCount}>{bulkSelected.size} selecionado{bulkSelected.size > 1 ? "s" : ""}</Text>
          <Pressable onPress={handleSelectAll} style={s.bulkAction}>
            <Text style={s.bulkActionText}>{bulkSelected.size === filtered.length ? "Desmarcar todos" : "Selecionar todos"}</Text>
          </Pressable>
          <Pressable onPress={() => setShowBulkConfirm(true)} style={[s.bulkAction, s.bulkDeleteAction]}>
            <Text style={[s.bulkActionText, { color: Colors.red }]}>Excluir {bulkSelected.size}</Text>
          </Pressable>
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
                onEdit={!bulkMode ? (customer) => { setEditTarget(customer); setShowAdd(false); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); } : undefined}
                onDelete={!bulkMode ? (id) => setDeleteTarget(id) : undefined}
                isSelected={bulkSelected.has(c.id)}
                onSelect={bulkMode ? toggleBulkSelect : undefined}
              />
            ))}
          </View>
          <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
        </View>
      )}

      {tab === 1 && <RankingTab customers={customers} />}
      {tab === 2 && <RetentionTab />}
      {tab === 3 && <ReviewsList />}

      <ConfirmDialog visible={!!deleteTarget} title="Excluir cliente?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive
        onConfirm={() => { if (deleteTarget) { deleteCustomer(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)} />

      <ConfirmDialog visible={showBulkConfirm}
        title={`Excluir ${bulkSelected.size} cliente${bulkSelected.size > 1 ? "s" : ""}`}
        message="Esta acao nao pode ser desfeita. Todos os clientes selecionados serao removidos permanentemente."
        confirmLabel="Excluir todos"
        destructive
        onConfirm={() => { setShowBulkConfirm(false); handleBulkDelete(); }}
        onCancel={() => setShowBulkConfirm(false)} />

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  addBtn: { backgroundColor: Colors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  planBlock: { backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.amber + "44" },
  planBlockText: { fontSize: 12, color: Colors.amber, fontWeight: "500" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 16 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  importRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" },
  bulkBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  bulkBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  bulkBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2, flexWrap: "wrap" },
  bulkCount: { fontSize: 13, color: Colors.violet3, fontWeight: "700", flex: 1 },
  bulkAction: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  bulkDeleteAction: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  bulkActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 16 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
