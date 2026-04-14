import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useProducts } from "@/hooks/useProducts";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { ServerImport } from "@/components/ServerImport";
import { AddProductForm } from "@/components/screens/estoque/AddProductForm";
import { VariantsSection } from "@/components/VariantsSection";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { AbcSummary } from "@/components/screens/estoque/AbcSummary";
import { AlertsList } from "@/components/screens/estoque/AlertsList";
import { PrintLabels } from "@/components/PrintLabels";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { TABS, DEFAULT_CATEGORIES, fmt } from "@/components/screens/estoque/types";
import type { Product } from "@/components/screens/estoque/types";
import { arrayToCSV, downloadCSV, PRODUCT_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const PAGE_SIZE = 20;

function SummaryCard({ label, value, color, sub, onPress }: { label: string; value: string; color?: string; sub?: string; onPress?: () => void }) {
  const [h, sH] = useState(false); const w = Platform.OS === "web";
  return <Pressable onPress={onPress} onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
    style={[s.card, h && { transform: [{ translateY: -2 }], borderColor: Colors.border2 }, w && { transition: "all 0.2s ease", cursor: onPress ? "pointer" : "default" } as any]}>
    <Text style={s.cardLabel}>{label}</Text>
    <Text style={[s.cardValue, color ? { color } : {}]}>{value}</Text>
    {sub && <Text style={s.cardSub}>{sub}</Text>}
  </Pressable>;
}

function TabBar({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}
    contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
    {TABS.map((tab, i) => <Pressable key={tab} onPress={() => onSelect(i)} style={[s.tab, active === i && s.tabActive]}><Text style={[s.tabText, active === i && s.tabTextActive]}>{tab}</Text></Pressable>)}
  </ScrollView>;
}

export default function EstoqueScreen() {
  const { products, categories, isLoading, isDemo, addProduct, updateProduct, deleteProduct, bulkDeleteProducts } = useProducts();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [labelSelection, setLabelSelection] = useState<string[]>([]);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // P0 #11: variants query (after editProduct state declaration)
  const editingProductId = editProduct?.id || null;
  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ['variants', company?.id, editingProductId],
    queryFn: () => companiesApi.variants(company!.id, editingProductId!),
    enabled: !!company?.id && !!editingProductId && showAddForm,
    staleTime: 30000,
  });

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories, ...products.map(p => p.category)]));
  const filterCategories = ["Todos", ...allCategories.filter(Boolean)];
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, search + catFilter);
  const lowStock = products.filter(p => p.stock <= p.minStock);
  const totalValue = products.reduce((acc, p) => acc + p.stock * p.cost, 0);
  const totalItems = products.reduce((acc, p) => acc + p.stock, 0);

  function handleSaveProduct(product: Product) {
    if (editProduct) { updateProduct(product); setEditProduct(null); }
    else addProduct(product);
    setShowAddForm(false);
  }

  function handleEdit(product: Product) {
    setEditProduct(product); setShowAddForm(true); setActiveTab(0);
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (products.length === 0) { toast.error("Nenhum produto para exportar"); return; }
    downloadCSV(arrayToCSV(products, PRODUCT_COLUMNS), `aura_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function handleImportComplete() {
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
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
    else setBulkSelected(new Set(filtered.map(p => p.id)));
  }

  function exitBulkMode() { setBulkMode(false); setBulkSelected(new Set()); }

  async function handleBulkDelete() {
    await bulkDeleteProducts(Array.from(bulkSelected));
    exitBulkMode();
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <ScreenHeader
        title="Estoque"
        actionLabel="+ Adicionar produto"
        actionIcon="package"
        onAction={() => { setEditProduct(null); setShowAddForm(true); setActiveTab(0); }}
      />

      {/* KPIs */}
      {products.length > 0 && (
        <View style={s.summaryRow}>
          <SummaryCard label="TOTAL PRODUTOS" value={String(products.length)} sub={`${totalItems} unidades`} />
          <SummaryCard label="VALOR EM ESTOQUE" value={fmt(totalValue)} />
          <SummaryCard label="ESTOQUE BAIXO" value={String(lowStock.length)} color={lowStock.length > 0 ? Colors.red : Colors.green} sub={lowStock.length > 0 ? "Ver alertas" : "Tudo OK"} onPress={lowStock.length > 0 ? () => setActiveTab(2) : undefined} />
        </View>
      )}

      {showAddForm && (
        <>
          <AddProductForm
            categories={allCategories}
            onSave={handleSaveProduct}
            onCancel={() => { setShowAddForm(false); setEditProduct(null); }}
            editProduct={editProduct}
          />
          {/* P0 #11: Variants — only when editing existing product */}
          {editProduct?.id && (
            <VariantsSection
              productId={editProduct.id}
              productName={editProduct.name || ''}
              basePrice={editProduct.price || 0}
              variants={variantsData?.variants || []}
              onUpdate={() => refetchVariants()}
            />
          )}
        </>
      )}

      {isLoading && <ListSkeleton rows={4} showCards />}

      {/* Empty state */}
      {!isLoading && products.length === 0 && !isDemo && !showAddForm && (
        <View>
          <EmptyState
            icon="package"
            iconColor={Colors.amber}
            title="Nenhum produto cadastrado"
            subtitle="Cadastre seu primeiro produto ou importe de uma planilha."
            actionLabel="+ Adicionar produto"
            onAction={() => { setShowAddForm(true); setActiveTab(0); }}
          />
          <View style={s.emptyImport}>
            <View style={s.emptyImportIcon}>
              <Icon name="upload" size={18} color={Colors.violet3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.emptyImportTitle}>Importar planilha</Text>
              <Text style={s.emptyImportDesc}>Cadastre varios produtos de uma vez via CSV</Text>
            </View>
            <ServerImport
              entity="products"
              onComplete={handleImportComplete}
            />
          </View>
        </View>
      )}

      {products.length > 0 && <TabBar active={activeTab} onSelect={handleTabSelect} />}

      {/* Toolbar */}
      {products.length > 0 && activeTab === 0 && (
        <View style={s.toolbar}>
          <ImportExportBar onExport={handleExport} itemCount={products.length} />
          <ServerImport
            entity="products"
            onComplete={handleImportComplete}
          />
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

      {activeTab === 0 && products.length > 0 && (
        <View>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nome ou codigo..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
            {filterCategories.map(c => (
              <Pressable key={c} onPress={() => setCatFilter(c)} style={[s.catChip, catFilter === c && s.catChipActive]}>
                <Text style={[s.catChipText, catFilter === c && s.catChipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.listCard}>
            {paginated.map(p => (
              <ProductRow
                key={p.id}
                product={p}
                showAbc={!bulkMode}
                onDelete={!isDemo && !bulkMode ? (id) => setDeleteTarget(id) : undefined}
                onEdit={!isDemo && !bulkMode ? handleEdit : undefined}
                isSelected={bulkSelected.has(p.id)}
                onSelect={bulkMode ? toggleBulkSelect : undefined}
              />
            ))}
            {filtered.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text>
              </View>
            )}
          </View>
          <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
        </View>
      )}

      {activeTab === 1 && (
        <View>
          <View style={s.abcInfo}>
            <Text style={s.abcInfoIcon}>i</Text>
            <Text style={s.abcInfoText}>A curva ABC classifica seus produtos por importancia nas vendas.</Text>
          </View>
          <AbcSummary products={products} />
          <View style={[s.listCard, { marginTop: 20 }]}>
            {[...products].sort((a, b) => a.abc.localeCompare(b.abc) || b.sold30d - a.sold30d).map(p => (
              <ProductRow key={p.id} product={p} showAbc
                onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined}
                onEdit={!isDemo ? handleEdit : undefined}
              />
            ))}
          </View>
        </View>
      )}

      {activeTab === 2 && <AlertsList products={products} />}
      {activeTab === 3 && <PrintLabels products={products} selectedIds={labelSelection} onSelectionChange={setLabelSelection} />}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir produto?"
        message="Esta acao nao pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => { if (deleteTarget) { deleteProduct(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        visible={showBulkConfirm}
        title={`Excluir ${bulkSelected.size} produto${bulkSelected.size > 1 ? "s" : ""}`}
        message="Esta acao nao pode ser desfeita. Todos os produtos selecionados serao removidos permanentemente."
        confirmLabel="Excluir todos"
        destructive
        onConfirm={() => { setShowBulkConfirm(false); handleBulkDelete(); }}
        onCancel={() => setShowBulkConfirm(false)}
      />

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: "transparent" },
  content:  { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  cardSub:   { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  tab:       { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText:   { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  toolbar:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" },
  bulkBtn:   { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  bulkBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  bulkBar:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2, flexWrap: "wrap" },
  bulkCount: { fontSize: 13, color: Colors.violet3, fontWeight: "700", flex: 1 },
  bulkAction: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  bulkDeleteAction: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  bulkActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 12 },
  catChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  catChipText:   { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  catChipTextActive: { color: Colors.violet3, fontWeight: "600" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  abcInfo:     { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 },
  abcInfoIcon: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  abcInfoText: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 },
  emptyImport: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bg3, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginTop: 12,
  },
  emptyImportIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  emptyImportTitle: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  emptyImportDesc:  { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
