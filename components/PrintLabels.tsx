import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { generatePrintHTML, LABEL_PRESETS, getSavedPreset, savePreset } from "@/utils/codeGen";
import { toast } from "@/components/Toast";
import type { Product } from "@/components/screens/estoque/types";

const PAGE_SIZE = 50;

type Props = {
  products: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function PrintLabels({ products, selectedIds, onSelectionChange }: Props) {
  const [labelType, setLabelType] = useState<'barcode' | 'qr'>('barcode');
  const [presetId, setPresetId] = useState(getSavedPreset());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const isWeb = Platform.OS === 'web';

  // Produtos com código (base para tudo)
  const productsWithCode = useMemo(
    () => products.filter(p => p.barcode || p.code),
    [products]
  );

  // Categorias únicas
  const categories = useMemo(() => {
    const cats = new Set<string>();
    productsWithCode.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [productsWithCode]);

  // Produtos filtrados
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return productsWithCode.filter(p => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode || p.code || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    });
  }, [productsWithCode, search, categoryFilter]);

  // Página atual
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Seleção
  const pageIds = pageItems.map(p => p.id);
  const selectedOnPage = pageIds.filter(id => selectedIds.includes(id));
  const allPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.includes(p.id));

  function handlePresetChange(id: string) {
    setPresetId(id);
    savePreset(id);
    toast.success('Preset salvo: ' + (LABEL_PRESETS.find(p => p.id === id)?.name || id));
  }

  function toggleSelect(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    );
  }

  function togglePage() {
    if (allPageSelected) {
      onSelectionChange(selectedIds.filter(id => !pageIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...pageIds]));
      onSelectionChange(merged);
    }
  }

  function toggleFiltered() {
    const filteredIds = filtered.map(p => p.id);
    if (allFilteredSelected) {
      onSelectionChange(selectedIds.filter(id => !filteredIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...filteredIds]));
      onSelectionChange(merged);
    }
  }

  function clearSelection() {
    onSelectionChange([]);
  }

  function handleSearch(text: string) {
    setSearch(text);
    setPage(0);
  }

  function handleCategory(cat: string | null) {
    setCategoryFilter(cat);
    setPage(0);
  }

  function handlePrint() {
    if (!isWeb || selectedIds.length === 0) { toast.error('Selecione pelo menos um produto'); return; }
    const selected = products
      .filter(p => selectedIds.includes(p.id) && (p.barcode || p.code))
      .map(p => ({ name: p.name, code: p.barcode || p.code, price: p.price, type: labelType }));
    if (selected.length === 0) { toast.error('Produtos selecionados nao possuem codigo'); return; }
    const html = generatePrintHTML(selected, presetId);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    toast.success(`${selected.length} etiqueta(s) enviada(s) para impressao`);
  }

  const currentPreset = LABEL_PRESETS.find(p => p.id === presetId);

  return (
    <View style={s.container}>

      {/* ── Preset selector ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Tamanho da etiqueta</Text>
        <Text style={s.sectionHint}>Escolha o preset compativel com sua impressora. A configuracao fica salva.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
          {LABEL_PRESETS.map(p => (
            <Pressable key={p.id} onPress={() => handlePresetChange(p.id)} style={[s.presetChip, presetId === p.id && s.presetChipActive]}>
              <Text style={[s.presetSize, presetId === p.id && s.presetSizeActive]}>{p.id === 'a4' ? 'A4' : `${p.width}x${p.height}`}</Text>
              <Text style={[s.presetName, presetId === p.id && s.presetNameActive]} numberOfLines={1}>{p.name.split('(')[1]?.replace(')', '') || p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {currentPreset && (
          <View style={s.presetInfo}>
            <Text style={s.presetInfoText}>Configurado: {currentPreset.name} — {currentPreset.columns} colunas por linha</Text>
          </View>
        )}
      </View>

      {/* ── Tipo + busca ── */}
      <View style={s.section}>
        <View style={s.row}>
          <Text style={s.sectionTitle}>Selecionar produtos</Text>
          <View style={s.typeToggle}>
            <Pressable onPress={() => setLabelType('barcode')} style={[s.typeBtn, labelType === 'barcode' && s.typeBtnActive]}>
              <Text style={[s.typeText, labelType === 'barcode' && s.typeTextActive]}>Cod. barras</Text>
            </Pressable>
            <Pressable onPress={() => setLabelType('qr')} style={[s.typeBtn, labelType === 'qr' && s.typeBtnActive]}>
              <Text style={[s.typeText, labelType === 'qr' && s.typeTextActive]}>QR Code</Text>
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nome, codigo ou categoria..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => handleSearch('')}>
              <Icon name="x" size={12} color={Colors.ink3} />
            </Pressable>
          )}
        </View>

        {/* Category pills */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 4, marginTop: 6 }}>
            <Pressable
              onPress={() => handleCategory(null)}
              style={[s.catPill, !categoryFilter && s.catPillActive]}
            >
              <Text style={[s.catPillText, !categoryFilter && s.catPillTextActive]}>Todas</Text>
            </Pressable>
            {categories.map(cat => (
              <Pressable
                key={cat}
                onPress={() => handleCategory(categoryFilter === cat ? null : cat)}
                style={[s.catPill, categoryFilter === cat && s.catPillActive]}
              >
                <Text style={[s.catPillText, categoryFilter === cat && s.catPillTextActive]} numberOfLines={1}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Barra de status/seleção ── */}
      <View style={s.statusBar}>
        <Text style={s.statusText}>
          {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
          {search || categoryFilter ? ' encontrados' : ''}
          {' · '}
          <Text style={{ color: Colors.violet3, fontWeight: '700' }}>{selectedIds.length} selecionados</Text>
        </Text>
        <View style={s.statusActions}>
          <Pressable onPress={togglePage} style={s.statusBtn}>
            <Text style={s.statusBtnText}>
              {allPageSelected ? 'Desmarcar página' : `Pg. (${pageItems.length})`}
            </Text>
          </Pressable>
          {filtered.length > PAGE_SIZE && (
            <Pressable onPress={toggleFiltered} style={s.statusBtn}>
              <Text style={s.statusBtnText}>
                {allFilteredSelected ? 'Desmarcar filtro' : `Todos filtrados (${filtered.length})`}
              </Text>
            </Pressable>
          )}
          {selectedIds.length > 0 && (
            <Pressable onPress={clearSelection} style={[s.statusBtn, { borderColor: Colors.red || '#ef4444' }]}>
              <Text style={[s.statusBtnText, { color: Colors.red || '#ef4444' }]}>Limpar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Lista ── */}
      <View style={s.list}>
        {pageItems.length === 0 && (
          <Text style={s.emptyText}>
            {productsWithCode.length === 0
              ? 'Nenhum produto com codigo cadastrado'
              : 'Nenhum produto encontrado para esse filtro'}
          </Text>
        )}
        {pageItems.map(p => {
          const selected = selectedIds.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => toggleSelect(p.id)} style={[s.item, selected && s.itemSelected]}>
              <View style={[s.checkbox, selected && s.checkboxSelected]}>
                {selected && <Icon name="check" size={10} color="#fff" />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.itemName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.itemMeta} numberOfLines={1}>
                  {p.barcode || p.code}
                  {p.category ? ` · ${p.category}` : ''}
                  {(p as any).size ? ` · ${(p as any).size}` : ''}
                </Text>
              </View>
              <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace('.', ',')}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <View style={s.pagination}>
          <Pressable
            onPress={() => setPage(p => Math.max(0, p - 1))}
            style={[s.pageBtn, safePage === 0 && s.pageBtnDisabled]}
            disabled={safePage === 0}
          >
            <Icon name="chevron_left" size={14} color={safePage === 0 ? Colors.ink3 : Colors.violet3} />
          </Pressable>

          {/* Página atual e vizinhas */}
          {Array.from({ length: totalPages }, (_, i) => i)
            .filter(i => Math.abs(i - safePage) <= 2 || i === 0 || i === totalPages - 1)
            .reduce<(number | '...')[]>((acc, i, idx, arr) => {
              if (idx > 0 && (i as number) - (arr[idx - 1] as number) > 1) acc.push('...');
              acc.push(i);
              return acc;
            }, [])
            .map((item, idx) =>
              item === '...'
                ? <Text key={`ellipsis-${idx}`} style={s.pageEllipsis}>…</Text>
                : (
                  <Pressable
                    key={item}
                    onPress={() => setPage(item as number)}
                    style={[s.pageNum, safePage === item && s.pageNumActive]}
                  >
                    <Text style={[s.pageNumText, safePage === item && s.pageNumTextActive]}>
                      {(item as number) + 1}
                    </Text>
                  </Pressable>
                )
            )
          }

          <Pressable
            onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            style={[s.pageBtn, safePage === totalPages - 1 && s.pageBtnDisabled]}
            disabled={safePage === totalPages - 1}
          >
            <Icon name="chevron_right" size={14} color={safePage === totalPages - 1 ? Colors.ink3 : Colors.violet3} />
          </Pressable>

          <Text style={s.pageInfo}>{safePage + 1}/{totalPages}</Text>
        </View>
      )}

      {/* ── Botão imprimir ── */}
      <Pressable
        onPress={handlePrint}
        style={[s.printBtn, selectedIds.length === 0 && { opacity: 0.5 }]}
        disabled={selectedIds.length === 0}
      >
        <Icon name="file_text" size={16} color="#fff" />
        <Text style={s.printBtnText}>Imprimir {selectedIds.length} etiqueta(s)</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  section: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  sectionHint: { fontSize: 11, color: Colors.ink3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },

  // Preset
  presetChip: { backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', minWidth: 90 },
  presetChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  presetSize: { fontSize: 14, fontWeight: '800', color: Colors.ink3, marginBottom: 2 },
  presetSizeActive: { color: Colors.violet3 },
  presetName: { fontSize: 9, color: Colors.ink3, fontWeight: '500' },
  presetNameActive: { color: Colors.violet3 },
  presetInfo: { backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border2 },
  presetInfoText: { fontSize: 10, color: Colors.violet3, fontWeight: '500' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink, outlineStyle: 'none' } as any,

  // Category pills
  catPill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catPillActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  catPillText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  catPillTextActive: { color: Colors.violet3, fontWeight: '700' },

  // Toggle type
  typeToggle: { flexDirection: 'row', gap: 4, backgroundColor: Colors.bg, borderRadius: 8, padding: 3 },
  typeBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
  typeBtnActive: { backgroundColor: Colors.violet },
  typeText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  typeTextActive: { color: '#fff', fontWeight: '600' },

  // Status bar
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  statusText: { fontSize: 12, color: Colors.ink3 },
  statusActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2 },
  statusBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: '600' },

  // List
  list: { gap: 3, backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: Colors.bg },
  itemSelected: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: '500' },
  itemMeta: { fontSize: 10, color: Colors.ink3, marginTop: 1, fontFamily: 'monospace' },
  itemPrice: { fontSize: 13, color: Colors.ink, fontWeight: '700', flexShrink: 0 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: 'center', paddingVertical: 16 },

  // Pagination
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' },
  pageBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  pageBtnDisabled: { opacity: 0.4 },
  pageNum: { minWidth: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 4 },
  pageNumActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  pageNumText: { fontSize: 13, color: Colors.ink3, fontWeight: '600' },
  pageNumTextActive: { color: '#fff' },
  pageEllipsis: { fontSize: 13, color: Colors.ink3, paddingHorizontal: 2, alignSelf: 'center' },
  pageInfo: { fontSize: 11, color: Colors.ink3, marginLeft: 4 },

  // Print button
  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13 },
  printBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});

export default PrintLabels;
