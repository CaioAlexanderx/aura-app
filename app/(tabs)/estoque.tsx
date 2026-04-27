import { useState, useRef, useMemo, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { useProducts } from "@/hooks/useProducts";
import { useProductCategories } from "@/hooks/useProductCategories";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { ServerImport } from "@/components/ServerImport";
import { AddProductForm } from "@/components/screens/estoque/AddProductForm";
import { AddServiceForm } from "@/components/screens/estoque/AddServiceForm";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { AbcSummary } from "@/components/screens/estoque/AbcSummary";
import { AlertsList } from "@/components/screens/estoque/AlertsList";
import { PrintLabels } from "@/components/PrintLabels";
import { Pagination } from "@/components/Pagination";
import { ScrollableChips } from "@/components/ScrollableChips";
import { MergeDuplicatesModal } from "@/components/MergeDuplicatesModal";
import { CategoriesModal } from "@/components/screens/estoque/CategoriesModal";
import { QuickBatchProductsModal } from "@/components/QuickBatchProductsModal";
import { usePagination } from "@/hooks/usePagination";
import { TABS, DEFAULT_CATEGORIES, fmt } from "@/components/screens/estoque/types";
import type { Product } from "@/components/screens/estoque/types";
import type { CategoryType } from "@/services/api";
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

type CategoriesModalState = { open: boolean; initialType?: CategoryType };

export default function EstoqueScreen() {
  const { products, categories, isLoading, isDemo, addProduct, updateProduct, deleteProduct, bulkDeleteProducts } = useProducts();
  const { categoryNames: managedCategoryNames } = useProductCategories();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [labelSelection, setLabelSelection] = useState<string[]>([]);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [categoriesModal, setCategoriesModal] = useState<CategoriesModalState>({ open: false });

  const { data: dupGroupsData, refetch: refetchDupGroups } = useQuery({
    queryKey: ["duplicateGroups", company?.id],
    queryFn: () => companiesApi.duplicateGroups(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 60000,
  });
  const dupGroupsCount = ((dupGroupsData as any)?.groups?.length || 0);

  // Scroll para o topo após o formulário ser renderizado
  useEffect(() => {
    if (showAddForm || showServiceForm) {
      const t = setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 80);
      return () => clearTimeout(t);
    }
  }, [showAddForm, showServiceForm]);

  // Categorias cadastradas tem prioridade; categorias derivadas dos produtos
  // (legado, ainda nao cadastradas) entram depois para cobrir o que ja existe.
  const allCategories = useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_CATEGORIES,
      ...managedCategoryNames,
      ...categories,
      ...products.map(p => p.category),
    ])).filter(Boolean);
  }, [managedCategoryNames, categories, products]);

  const filterCategories = ["Todos", ...allCategories];
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, search + catFilter);
  const lowStock = products.filter(p => p.stock <= p.minStock && p.unit !== "srv");
  const totalValue = products.reduce((acc, p) => acc + p.stock * p.cost, 0);
  const totalItems = products.reduce((acc, p) => acc + p.stock, 0);
  const serviceCount = products.filter(p => p.category === "Servicos" || p.unit === "srv").length;

  function handleSaveProduct(product: Product) {
    if (editProduct) { updateProduct(product); setEditProduct(null); }
    else addProduct(product);
    setShowAddForm(false);
    setShowServiceForm(false);
    setTimeout(() => refetchDupGroups(), 500);
  }

  function handleEdit(product: Product) {
    setEditProduct(product); setShowAddForm(true); setShowServiceForm(false); setActiveTab(0);
  }

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (products.length === 0) { toast.error("Nenhum produto para exportar"); return; }
    downloadCSV(arrayToCSV(products, PRODUCT_COLUMNS), `aura_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function handleImportComplete() {
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
    refetchDupGroups();
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
    refetchDupGroups();
  }

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      {/* Header with three action buttons: servico, lote, produto */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>Estoque</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable onPress={() => { setEditProduct(null); setShowServiceForm(true); setShowAddForm(false); setActiveTab(0); }} style={s.serviceBtn}>
            <Icon name="star" size={14} color={Colors.violet3} />
            <Text style={s.serviceBtnText}>+ Servico</Text>
          </Pressable>
          {!isDemo && (
            <Pressable onPress={() => setShowBatchModal(true)} style={s.batchBtn}>
              <Icon name="layers" size={14} color={Colors.violet3} />
              <Text style={s.batchBtnText}>+ Em lote</Text>
            </Pressable>
          )}
          <Pressable onPress={() => { setEditProduct(null); setShowAddForm(true); setShowServiceForm(false); setActiveTab(0); }} style={s.addBtn}>
            <Icon name="package" size={14} color="#fff" />
            <Text style={s.addBtnText}>+ Produto</Text>
          </Pressable>
        </View>
      </View>

      {products.length > 0 && (
        <View style={s.summaryRow}>
          <SummaryCard label="TOTAL PRODUTOS" value={String(products.length)} sub={`${totalItems} unidades` + (serviceCount > 0 ? ` + ${serviceCount} servico${serviceCount > 1 ? "s" : ""}` : "")} />
          <SummaryCard label="VALOR EM ESTOQUE" value={fmt(totalValue)} />
          <SummaryCard label="ESTOQUE BAIXO" value={String(lowStock.length)} color={lowStock.length > 0 ? Colors.red : Colors.green} sub={lowStock.length > 0 ? "Ver alertas" : "Tudo OK"} onPress={lowStock.length > 0 ? () => setActiveTab(2) : undefined} />
        </View>
      )}

      {dupGroupsCount > 0 && !showAddForm && !showServiceForm && !isDemo && (
        <Pressable onPress={() => setShowMergeModal(true)} style={s.dupBanner}>
          <View style={s.dupBannerIcon}><Text style={s.dupBannerIconText}>!</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.dupBannerTitle}>{dupGroupsCount} grupo{dupGroupsCount > 1 ? "s" : ""} de produtos duplicados</Text>
            <Text style={s.dupBannerDesc}>Produtos com o mesmo nome podem ser unificados em variantes (cor/tamanho).</Text>
          </View>
          <View style={s.dupBannerCta}><Text style={s.dupBannerCtaText}>Unificar</Text><Text style={s.dupBannerArrow}>{"›"}</Text></View>
        </Pressable>
      )}

      {/* Service form (simplified) */}
      {showServiceForm && (
        <AddServiceForm
          onSave={handleSaveProduct}
          onCancel={() => setShowServiceForm(false)}
          onOpenCategories={() => setCategoriesModal({ open: true, initialType: "service" })}
        />
      )}

      {showAddForm && (
        <AddProductForm
          categories={allCategories}
          onSave={handleSaveProduct}
          onCancel={() => { setShowAddForm(false); setEditProduct(null); }}
          editProduct={editProduct}
        />
      )}

      {isLoading && <ListSkeleton rows={4} showCards />}

      {!isLoading && products.length === 0 && !isDemo && !showAddForm && !showServiceForm && (
        <View>
          <EmptyState icon="package" iconColor={Colors.amber} title="Nenhum produto cadastrado" subtitle="Cadastre seu primeiro produto ou servico, ou importe de uma planilha." actionLabel="+ Adicionar produto" onAction={() => { setShowAddForm(true); setActiveTab(0); }} />
          <View style={s.emptyImport}>
            <View style={s.emptyImportIcon}><Icon name="layers" size={18} color={Colors.violet3} /></View>
            <View style={{ flex: 1 }}><Text style={s.emptyImportTitle}>Adicionar em lote</Text><Text style={s.emptyImportDesc}>Cole varios produtos de uma vez e cadastre em segundos</Text></View>
            <Pressable onPress={() => setShowBatchModal(true)} style={s.batchBtnSmall}>
              <Text style={s.batchBtnSmallText}>Abrir</Text>
            </Pressable>
          </View>
          <View style={s.emptyImport}>
            <View style={s.emptyImportIcon}><Icon name="upload" size={18} color={Colors.violet3} /></View>
            <View style={{ flex: 1 }}><Text style={s.emptyImportTitle}>Importar planilha CSV</Text><Text style={s.emptyImportDesc}>Cadastre centenas de produtos via arquivo CSV</Text></View>
            <ServerImport entity="products" onComplete={handleImportComplete} />
          </View>
        </View>
      )}

      {products.length > 0 && <TabBar active={activeTab} onSelect={handleTabSelect} />}

      {products.length > 0 && activeTab === 0 && (
        <View style={s.toolbar}>
          <ImportExportBar onExport={handleExport} itemCount={products.length} />
          <ServerImport entity="products" onComplete={handleImportComplete} />
          <Pressable onPress={() => setCategoriesModal({ open: true })} style={s.catBtn}>
            <Icon name="tag" size={12} color={Colors.violet3} />
            <Text style={s.catBtnText}>Categorias</Text>
          </Pressable>
          {!bulkMode ? (
            <Pressable onPress={() => setBulkMode(true)} style={s.bulkBtn}><Text style={s.bulkBtnText}>Selecionar</Text></Pressable>
          ) : (
            <Pressable onPress={exitBulkMode} style={[s.bulkBtn, { backgroundColor: Colors.bg4 }]}><Text style={[s.bulkBtnText, { color: Colors.ink3 }]}>Cancelar</Text></Pressable>
          )}
          {dupGroupsCount > 0 && !bulkMode && !isDemo && (
            <Pressable onPress={() => setShowMergeModal(true)} style={s.dupBtn}><Text style={s.dupBtnText}>{"⚑ Unificar " + dupGroupsCount + (dupGroupsCount > 1 ? " grupos" : " grupo")}</Text></Pressable>
          )}
        </View>
      )}

      {bulkMode && bulkSelected.size > 0 && (
        <View style={s.bulkBar}>
          <Text style={s.bulkCount}>{bulkSelected.size} selecionado{bulkSelected.size > 1 ? "s" : ""}</Text>
          <Pressable onPress={handleSelectAll} style={s.bulkAction}><Text style={s.bulkActionText}>{bulkSelected.size === filtered.length ? "Desmarcar todos" : "Selecionar todos"}</Text></Pressable>
          <Pressable onPress={() => setShowBulkConfirm(true)} style={[s.bulkAction, s.bulkDeleteAction]}><Text style={[s.bulkActionText, { color: Colors.red }]}>Excluir {bulkSelected.size}</Text></Pressable>
        </View>
      )}

      {activeTab === 0 && products.length > 0 && (
        <View>
          <TextInput style={s.searchInput} placeholder="Buscar por nome ou codigo..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
          <ScrollableChips items={filterCategories} active={catFilter} onSelect={setCatFilter} />
          <View style={s.listCard}>
            {paginated.map(p => (
              <ProductRow key={p.id} product={p} showAbc={!bulkMode} onDelete={!isDemo && !bulkMode ? (id) => setDeleteTarget(id) : undefined} onEdit={!isDemo && !bulkMode ? handleEdit : undefined} isSelected={bulkSelected.has(p.id)} onSelect={bulkMode ? toggleBulkSelect : undefined} />
            ))}
            {filtered.length === 0 && <View style={{ alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
          </View>
          <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
        </View>
      )}

      {activeTab === 1 && (
        <View>
          <View style={s.abcInfo}><Text style={s.abcInfoIcon}>i</Text><Text style={s.abcInfoText}>A curva ABC classifica seus produtos por importancia nas vendas.</Text></View>
          <AbcSummary products={products} />
          <View style={[s.listCard, { marginTop: 20 }]}>
            {[...products].sort((a, b) => a.abc.localeCompare(b.abc) || b.sold30d - a.sold30d).map(p => (
              <ProductRow key={p.id} product={p} showAbc onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined} onEdit={!isDemo ? handleEdit : undefined} />
            ))}
          </View>
        </View>
      )}

      {activeTab === 2 && <AlertsList products={products} />}
      {activeTab === 3 && <PrintLabels products={products} selectedIds={labelSelection} onSelectionChange={setLabelSelection} />}

      <ConfirmDialog visible={!!deleteTarget} title="Excluir produto?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => { if (deleteTarget) { deleteProduct(deleteTarget); setDeleteTarget(null); refetchDupGroups(); } }} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog visible={showBulkConfirm} title={`Excluir ${bulkSelected.size} produto${bulkSelected.size > 1 ? "s" : ""}`} message="Esta acao nao pode ser desfeita. Todos os produtos selecionados serao removidos permanentemente." confirmLabel="Excluir todos" destructive onConfirm={() => { setShowBulkConfirm(false); handleBulkDelete(); }} onCancel={() => setShowBulkConfirm(false)} />
      <MergeDuplicatesModal visible={showMergeModal} onClose={() => setShowMergeModal(false)} onComplete={() => { qc.invalidateQueries({ queryKey: ["products", company?.id] }); refetchDupGroups(); }} />
      <QuickBatchProductsModal visible={showBatchModal} onClose={() => setShowBatchModal(false)} allCategories={allCategories} />
      <CategoriesModal
        visible={categoriesModal.open}
        initialType={categoriesModal.initialType}
        onClose={() => setCategoriesModal({ open: false })}
      />
      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 8, flexWrap: "wrap" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  serviceBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  serviceBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  batchBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  batchBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  batchBtnSmall: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  batchBtnSmallText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  cardSub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" },
  catBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  catBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  bulkBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  bulkBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  dupBtn: { backgroundColor: Colors.amberD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" },
  dupBtnText: { fontSize: 12, color: Colors.amber, fontWeight: "700" },
  bulkBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2, flexWrap: "wrap" },
  bulkCount: { fontSize: 13, color: Colors.violet3, fontWeight: "700", flex: 1 },
  bulkAction: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  bulkDeleteAction: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  bulkActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchInput: { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 12 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  abcInfo: { flexDirection: "row", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2 },
  abcInfoIcon: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  abcInfoText: { fontSize: 12, color: Colors.ink3, flex: 1, lineHeight: 18 },
  emptyImport: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginTop: 12 },
  emptyImportIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  emptyImportTitle: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  emptyImportDesc: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  dupBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fef3c7", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", marginBottom: 16 },
  dupBannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center" },
  dupBannerIconText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  dupBannerTitle: { fontSize: 13, fontWeight: "700", color: "#78350f" },
  dupBannerDesc: { fontSize: 11.5, color: "#92400e", marginTop: 2, lineHeight: 16 },
  dupBannerCta: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f59e0b", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  dupBannerCtaText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  dupBannerArrow: { fontSize: 14, color: "#fff", fontWeight: "800" },
});
