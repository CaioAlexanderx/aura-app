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
  const { customers, isLoading, isDemo, planBlocked, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.email.toLowerCase().includes(s) || c.instagram.toLowerCase().includes(s);
  });

  // P1-6: Paginacao clientes
  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, search);

  const totalLtv = customers.reduce((s, c) => s + c.totalSpent, 0);

  function handleAdd(c: Customer) { addCustomer(c); setShowAdd(false); }

  function handleEdit(c: Customer) {
    updateCustomer(c.id, c);
    setEditTarget(null);
  }

  function handleTabSelect(i: number) { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (customers.length === 0) { toast.error("Nenhum cliente para exportar"); return; }
    const csv = arrayToCSV(customers, CUSTOMER_COLUMNS);
    downloadCSV(csv, `aura_clientes_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Text style={s.pageTitle}>Clientes</Text>
        <Pressable onPress={() => { setShowAdd(true); setEditTarget(null); setTab(0); }} style={s.addBtn}>
          <Text style={s.addBtnText}>+ Adicionar cliente</Text>
        </Pressable>
      </View>

      {planBlocked && (
        <View style={s.planBlock}>
          <Text style={s.planBlockText}>Clientes disponivel a partir do plano Negocio. Faca upgrade em Configuracoes {'>'} Meu plano.</Text>
        </View>
      )}

      <View style={s.summaryRow}>
        <View style={s.card}><Text style={s.cardLabel}>TOTAL CLIENTES</Text><Text style={s.cardValue}>{customers.length}</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>FATURAMENTO TOTAL</Text><Text style={[s.cardValue, { color: Colors.green }]}>{fmt(totalLtv)}</Text></View>
      </View>

      {tab === 0 && !planBlocked && !isDemo && <RetentionCard />}

      {showAdd && !editTarget && (
        <AddCustomerForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
      )}
      {editTarget && (
        <AddCustomerForm initialData={editTarget} onSave={handleEdit} onCancel={() => setEditTarget(null)} />
      )}

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
        </View>
      )}

      {tab === 0 && (
        <View>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nome, telefone, email ou Instagram..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={setSearch}
          />
          <View style={s.listCard}>
            {filtered.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                <Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum cliente cadastrado</Text>
              </View>
            )}
            {paginated.map(c => (
              <CustomerRow
                key={c.id}
                c={c}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                onEdit={(customer) => { setEditTarget(customer); setShowAdd(false); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }}
                onDelete={(id) => setDeleteTarget(id)}
              />
            ))}
          </View>
          <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
        </View>
      )}

      {tab === 1 && <RankingTab customers={customers} />}
      {tab === 2 && <RetentionTab />}
      {tab === 3 && <ReviewsList />}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir cliente?"
        message="Esta acao nao pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => { if (deleteTarget) { deleteCustomer(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />
      {isDemo && (
        <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>
      )}
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
  planBlockText: { fontSize: 12, color: Colors.amber, fontWeight: "500", lineHeight: 18 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 16 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  importRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 16 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
