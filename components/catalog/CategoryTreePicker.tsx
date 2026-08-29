import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { useColors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useCategories, MAX_DEPTH, canHaveChildren, type Category } from "@/hooks/useCategories";
import { CategoryBreadcrumb } from "./CategoryBreadcrumb";
import { CategoryChip } from "./CategoryChip";

export type CategorySelection = { primaryCategoryId: string | null; alsoInIds: string[] };

// productId presente => persiste via PUT /products/:id/categories a cada
// mudanca (contrato sec.4). Ausente => so chama onChange (form salva).
type Props = { value: CategorySelection; onChange: (next: CategorySelection) => void; productId?: string };

export function CategoryTreePicker({ value, onChange, productId }: Props) {
  const C = useColors();
  const { tree, byId, search, create, isCreating, assignProductCategories, isLoading } = useCategories();
  const [path, setPath] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const results = useMemo(() => (query.trim() ? search(query) : null), [query, search]);
  const currentNode = path.length ? path[path.length - 1] : null;
  const currentLevel: Category[] = currentNode ? currentNode.children || [] : tree;
  const isEmptyRoot = !isLoading && path.length === 0 && tree.length === 0;
  const canCreateHere = canHaveChildren(currentNode);

  const primary = value.primaryCategoryId ? byId[value.primaryCategoryId] : null;
  const chips = value.alsoInIds.map((id) => byId[id]).filter(Boolean) as Category[];

  function persist(next: CategorySelection) {
    onChange(next);
    if (productId) {
      assignProductCategories(productId, {
        primary_category_id: next.primaryCategoryId || "",
        also_in: next.alsoInIds,
      });
    }
  }

  function selectPrimary(cat: Category) {
    persist({ primaryCategoryId: cat.id, alsoInIds: value.alsoInIds.filter((id) => id !== cat.id) });
  }

  function toggleAlso(cat: Category) {
    if (cat.id === value.primaryCategoryId) return;
    const has = value.alsoInIds.includes(cat.id);
    const next = has ? value.alsoInIds.filter((id) => id !== cat.id) : [...value.alsoInIds, cat.id];
    persist({ ...value, alsoInIds: next });
  }

  function removeChip(id: string) {
    if (id === value.primaryCategoryId) persist({ primaryCategoryId: null, alsoInIds: value.alsoInIds });
    else persist({ ...value, alsoInIds: value.alsoInIds.filter((x) => x !== id) });
  }

  async function submitCreate() {
    if (!newName.trim()) return;
    const parentId = currentNode ? currentNode.id : null;
    const created = await create({ name: newName.trim(), parent_id: parentId });
    setNewName("");
    setShowCreate(false);
    if (created?.id) selectPrimary(created as Category);
  }

  return (
    <View style={s.wrap}>
      {(primary || chips.length > 0) && (
        <View style={s.chipsRow}>
          {primary && <CategoryChip label={primary.name} variant="primary" color={primary.color} onRemove={() => removeChip(primary.id)} />}
          {chips.map((cat) => (
            <CategoryChip key={cat.id} label={cat.name} color={cat.color} onRemove={() => removeChip(cat.id)} />
          ))}
        </View>
      )}
      <View style={[s.searchBox, { borderColor: C.border2, backgroundColor: C.bg3 }]}>
        <Icon name="search" size={14} color={C.ink3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar categoria..."
          placeholderTextColor={C.ink3}
          style={[s.searchInput, { color: C.ink }]}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Limpar busca">
            <Icon name="x" size={14} color={C.ink3} />
          </Pressable>
        )}
      </View>
      {results ? (
        <ScrollView style={s.list}>
          {results.length === 0 ? (
            <Text style={[s.emptyResult, { color: C.ink3 }]}>{'Nenhuma categoria encontrada para "' + query + '".'}</Text>
          ) : (
            results.map(({ category, breadcrumb }) => (
              <CategoryRow
                key={category.id}
                category={category}
                breadcrumb={breadcrumb}
                isPrimary={category.id === value.primaryCategoryId}
                isAlso={value.alsoInIds.includes(category.id)}
                onSelectPrimary={() => selectPrimary(category)}
                onToggleAlso={() => toggleAlso(category)}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <View>
          {path.length > 0 && (
            <Pressable onPress={() => setPath(path.slice(0, -1))} style={s.backRow}>
              <Icon name="chevron_left" size={14} color={C.violet} />
              <Text style={[s.backText, { color: C.violet }]}>{currentNode ? currentNode.name : "Início"}</Text>
            </Pressable>
          )}
          {isLoading && path.length === 0 && tree.length === 0 ? (
            <Text style={[s.emptyResult, { color: C.ink3 }]}>Carregando categorias...</Text>
          ) : isEmptyRoot ? (
            <View style={s.emptyState}>
              <Icon name="layers" size={28} color={C.ink3} />
              <Text style={[s.emptyTitle, { color: C.ink }]}>Nenhuma categoria ainda</Text>
              <Text style={[s.emptyText, { color: C.ink3 }]}>Crie a primeira categoria para organizar o catalogo.</Text>
              <Pressable onPress={() => setShowCreate(true)} style={[s.cta, { backgroundColor: C.violet }]}>
                <Icon name="plus" size={14} color="#fff" />
                <Text style={s.ctaText}>Criar primeira categoria</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={s.list}>
              {currentLevel.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  isPrimary={cat.id === value.primaryCategoryId}
                  isAlso={value.alsoInIds.includes(cat.id)}
                  onSelectPrimary={() => selectPrimary(cat)}
                  onToggleAlso={() => toggleAlso(cat)}
                  onEnter={cat.depth < MAX_DEPTH ? () => setPath([...path, cat]) : undefined}
                />
              ))}
            </ScrollView>
          )}
          {!isEmptyRoot && canCreateHere && !showCreate && (
            <Pressable onPress={() => setShowCreate(true)} style={s.addRow} accessibilityLabel="Criar subcategoria">
              <Icon name="plus" size={13} color={C.violet} />
              <Text style={[s.addText, { color: C.violet }]}>{currentNode ? "Criar subcategoria" : "Criar categoria"}</Text>
            </Pressable>
          )}
        </View>
      )}

      {showCreate && (
        <View style={[s.createBox, { borderColor: C.border2 }]}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nome da categoria"
            placeholderTextColor={C.ink3}
            style={[s.createInput, { color: C.ink, borderColor: C.border2 }]}
            autoFocus
          />
          <View style={s.createActions}>
            <Pressable onPress={() => { setShowCreate(false); setNewName(""); }} style={s.createCancel}>
              <Text style={{ color: C.ink3, fontSize: 12.5, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={submitCreate}
              disabled={isCreating || !newName.trim()}
              style={[s.createSubmit, { backgroundColor: C.violet, opacity: isCreating || !newName.trim() ? 0.5 : 1 }]}
            >
              <Text style={s.createSubmitText}>{isCreating ? "Criando..." : "Criar"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// Linha da arvore/resultado de busca, interna ao arquivo (sec.3 e 6.6).
type RowProps = {
  category: Category;
  breadcrumb?: Category[];
  isPrimary: boolean;
  isAlso: boolean;
  onSelectPrimary: () => void;
  onToggleAlso: () => void;
  onEnter?: () => void;
};

function CategoryRow({ category, breadcrumb, isPrimary, isAlso, onSelectPrimary, onToggleAlso, onEnter }: RowProps) {
  const C = useColors();
  const count = category.product_count_total ?? category.product_count;

  return (
    <View style={[s.row, { borderColor: C.border }]}>
      <Pressable onPress={onSelectPrimary} style={s.rowMain} accessibilityLabel={"Selecionar " + category.name}>
        {breadcrumb && breadcrumb.length > 1 ? (
          <CategoryBreadcrumb nodes={breadcrumb} />
        ) : (
          <Text style={[s.rowName, { color: C.ink, fontWeight: isPrimary ? "700" : "500" }]} numberOfLines={1}>
            {category.name}
          </Text>
        )}
        <Text style={[s.rowCount, { color: C.ink3 }]}>{count + (count === 1 ? " produto" : " produtos")}</Text>
      </Pressable>

      <View style={s.rowActions}>
        {isPrimary && <Icon name="star" size={14} color={C.violet} />}
        <Pressable onPress={onToggleAlso} disabled={isPrimary} hitSlop={8} style={s.secondaryBtn} accessibilityLabel={"Também em " + category.name}>
          <Icon name={isAlso ? "check_circle" : "plus_circle"} size={16} color={isPrimary ? C.ink3 : isAlso ? C.green : C.ink3} />
        </Pressable>
        {onEnter && (
          <Pressable onPress={onEnter} hitSlop={8} accessibilityLabel={"Entrar em " + category.name}>
            <Icon name="chevron_right" size={16} color={C.ink3} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 13.5, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  list: { maxHeight: 320 },
  emptyResult: { fontSize: 12.5, padding: 16, textAlign: "center" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8 },
  backText: { fontSize: 12.5, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 13.5 },
  rowCount: { fontSize: 11 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryBtn: { padding: 2 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 14.5, fontWeight: "700" },
  emptyText: { fontSize: 12.5, textAlign: "center" },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 16, borderRadius: 10, marginTop: 6 },
  ctaText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
  addText: { fontSize: 12.5, fontWeight: "600" },
  createBox: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  createInput: { height: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 13 },
  createActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  createCancel: { height: 32, paddingHorizontal: 10, justifyContent: "center" },
  createSubmit: { height: 32, paddingHorizontal: 14, borderRadius: 8, justifyContent: "center" },
  createSubmitText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});

export default CategoryTreePicker;
