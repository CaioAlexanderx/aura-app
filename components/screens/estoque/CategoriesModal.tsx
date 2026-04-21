import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useProductCategories, type ProductCategory } from "@/hooks/useProductCategories";
import type { CategoryType } from "@/services/api";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280", "#1f2937", "#92400e", "#0ea5e9",
];

type DeleteTarget = { cat: ProductCategory } | null;

export function CategoriesModal({
  visible, onClose, initialType,
}: {
  visible: boolean;
  onClose: () => void;
  initialType?: CategoryType;
}) {
  // type ativo no modal. Quando initialType vem fixo, travamos o toggle.
  const [type, setType] = useState<CategoryType>(initialType || "product");
  const lockedType = !!initialType;

  const { categories, isLoading, create, update, remove, isCreating, isUpdating, isDeleting } =
    useProductCategories(type);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteMoveTo, setDeleteMoveTo] = useState<string | null>(null);

  // Ao trocar de aba zera o form
  function switchType(next: CategoryType) {
    if (lockedType) return;
    setType(next);
    setNewName(""); setNewColor(null);
    setEditingId(null); setEditName(""); setEditColor(null);
    setDeleteTarget(null); setDeleteMoveTo(null);
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    create({ name, color: newColor });
    setNewName(""); setNewColor(null);
  }

  function startEdit(cat: ProductCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditColor(null);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    update(editingId, { name: editName.trim(), color: editColor });
    cancelEdit();
  }

  function startDelete(cat: ProductCategory) {
    setDeleteTarget({ cat });
    setDeleteMoveTo(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    remove(deleteTarget.cat.id, deleteMoveTo || undefined);
    setDeleteTarget(null);
    setDeleteMoveTo(null);
  }

  const availableMoveTargets = deleteTarget
    ? categories.filter(c => c.id !== deleteTarget.cat.id)
    : [];

  const itemLabel = type === "service" ? "servico" : "produto";
  const itemLabelPlural = type === "service" ? "servicos" : "produtos";
  const titleText = type === "service" ? "Categorias de servicos" : "Categorias de produtos";
  const subtitleText = type === "service"
    ? "Organize seus servicos em grupos (ex: Corte, Coloracao, Estetica)."
    : "Organize seus produtos em grupos.";
  const createPlaceholder = type === "service"
    ? "Ex: Corte, Coloracao, Manicure..."
    : "Ex: Bebidas, Vestuario...";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{titleText}</Text>
              <Text style={s.subtitle}>{subtitleText}</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>

          {/* Toggle Produtos / Servicos */}
          {!lockedType && (
            <View style={s.segmented}>
              <Pressable
                onPress={() => switchType("product")}
                style={[s.segBtn, type === "product" && s.segBtnActive]}
              >
                <Icon name="package" size={11} color={type === "product" ? "#fff" : Colors.ink3} />
                <Text style={[s.segText, type === "product" && s.segTextActive]}>Produtos</Text>
              </Pressable>
              <Pressable
                onPress={() => switchType("service")}
                style={[s.segBtn, type === "service" && s.segBtnActive]}
              >
                <Icon name="star" size={11} color={type === "service" ? "#fff" : Colors.ink3} />
                <Text style={[s.segText, type === "service" && s.segTextActive]}>Servicos</Text>
              </Pressable>
            </View>
          )}

          {/* Create */}
          <View style={s.createCard}>
            <Text style={s.sectionLabel}>Adicionar nova</Text>
            <View style={s.createRow}>
              <TextInput
                style={s.input}
                value={newName}
                onChangeText={setNewName}
                placeholder={createPlaceholder}
                placeholderTextColor={Colors.ink3}
                onSubmitEditing={handleCreate}
              />
              <Pressable
                onPress={handleCreate}
                disabled={!newName.trim() || isCreating}
                style={[s.primaryBtn, (!newName.trim() || isCreating) && { opacity: 0.5 }]}
              >
                {isCreating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>+ Criar</Text>}
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colorRow}>
              <Pressable
                onPress={() => setNewColor(null)}
                style={[s.colorChip, !newColor && s.colorChipActive, { backgroundColor: Colors.bg4 }]}
              >
                <Text style={s.noColorText}>sem cor</Text>
              </Pressable>
              {PRESET_COLORS.map(c => (
                <Pressable
                  key={c}
                  onPress={() => setNewColor(c)}
                  style={[s.colorChip, { backgroundColor: c }, newColor === c && s.colorChipActive]}
                />
              ))}
            </ScrollView>
          </View>

          {/* List */}
          <ScrollView style={s.list} contentContainerStyle={{ gap: 6 }}>
            {isLoading && (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color={Colors.violet3} />
              </View>
            )}

            {!isLoading && categories.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Nenhuma categoria cadastrada</Text>
                <Text style={s.emptyHint}>Crie sua primeira categoria acima para comecar a organizar seus {itemLabelPlural}.</Text>
              </View>
            )}

            {categories.map(cat => {
              const isEditing = editingId === cat.id;
              return (
                <View key={cat.id} style={s.row}>
                  {isEditing ? (
                    <View style={{ flex: 1, gap: 6 }}>
                      <TextInput
                        style={s.inputInline}
                        value={editName}
                        onChangeText={setEditName}
                        placeholderTextColor={Colors.ink3}
                        autoFocus
                      />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colorRow}>
                        <Pressable
                          onPress={() => setEditColor(null)}
                          style={[s.colorChipSmall, !editColor && s.colorChipSmallActive, { backgroundColor: Colors.bg4 }]}
                        />
                        {PRESET_COLORS.map(c => (
                          <Pressable
                            key={c}
                            onPress={() => setEditColor(c)}
                            style={[s.colorChipSmall, { backgroundColor: c }, editColor === c && s.colorChipSmallActive]}
                          />
                        ))}
                      </ScrollView>
                      <View style={s.editActions}>
                        <Pressable onPress={cancelEdit} style={s.ghostBtn}>
                          <Text style={s.ghostBtnText}>Cancelar</Text>
                        </Pressable>
                        <Pressable onPress={saveEdit} disabled={isUpdating || !editName.trim()} style={[s.primaryBtn, isUpdating && { opacity: 0.5 }]}>
                          {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Salvar</Text>}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      {cat.color ? <View style={[s.dot, { backgroundColor: cat.color }]} /> : <View style={[s.dot, { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border }]} />}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.name} numberOfLines={1}>{cat.name}</Text>
                        <Text style={s.count}>{cat.product_count} {cat.product_count === 1 ? itemLabel : itemLabelPlural}</Text>
                      </View>
                      <Pressable onPress={() => startEdit(cat)} style={s.iconBtn} hitSlop={6}>
                        <Icon name="edit" size={12} color={Colors.violet3} />
                      </Pressable>
                      <Pressable onPress={() => startDelete(cat)} style={s.iconBtn} hitSlop={6}>
                        <Icon name="x" size={12} color={Colors.red} />
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={s.footer}>
            <Pressable onPress={onClose} style={s.secondaryBtn}>
              <Text style={s.secondaryBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>

        {/* Delete flow */}
        <ConfirmDialog
          visible={!!deleteTarget}
          title={"Excluir categoria \"" + (deleteTarget?.cat.name || "") + "\"?"}
          message={
            deleteTarget && deleteTarget.cat.product_count > 0
              ? "Esta categoria tem " + deleteTarget.cat.product_count + " " + (deleteTarget.cat.product_count === 1 ? itemLabel : itemLabelPlural) + "."
                + (deleteMoveTo
                    ? " Eles serao movidos para \"" + deleteMoveTo + "\"."
                    : " Se voce nao escolher um destino, os itens ficarao sem categoria cadastrada.")
              : "Esta acao nao pode ser desfeita."
          }
          confirmLabel={isDeleting ? "Removendo..." : "Excluir"}
          destructive
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteMoveTo(null); }}
        />

        {/* Move picker (preview antes do confirm) — so aparece se tem itens */}
        {deleteTarget && deleteTarget.cat.product_count > 0 && availableMoveTargets.length > 0 && (
          <View style={s.moveBanner} pointerEvents="box-none">
            <View style={s.moveBannerInner}>
              <Text style={s.moveBannerTitle}>
                Mover {deleteTarget.cat.product_count} {deleteTarget.cat.product_count === 1 ? itemLabel : itemLabelPlural} para:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={() => setDeleteMoveTo(null)}
                  style={[s.moveChip, !deleteMoveTo && s.moveChipActive]}
                >
                  <Text style={[s.moveChipText, !deleteMoveTo && s.moveChipTextActive]}>Nenhum (deixar texto antigo)</Text>
                </Pressable>
                {availableMoveTargets.map(c => (
                  <Pressable
                    key={c.id}
                    onPress={() => setDeleteMoveTo(c.name)}
                    style={[s.moveChip, deleteMoveTo === c.name && s.moveChipActive]}
                  >
                    {c.color && <View style={[s.moveChipDot, { backgroundColor: c.color }]} />}
                    <Text style={[s.moveChipText, deleteMoveTo === c.name && s.moveChipTextActive]}>{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 520, maxHeight: "90%", backgroundColor: Colors.bg3, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", gap: 4, marginHorizontal: 20, marginBottom: 12, padding: 4, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 7 },
  segBtnActive: { backgroundColor: Colors.violet },
  segText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  segTextActive: { color: "#fff", fontWeight: "700" },
  createCard: { backgroundColor: Colors.bg4, marginHorizontal: 16, marginBottom: 4, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  sectionLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  createRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  inputInline: { backgroundColor: Colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border2 },
  primaryBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", justifyContent: "center", minWidth: 80 },
  primaryBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  ghostBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  ghostBtnText: { color: Colors.ink3, fontSize: 12, fontWeight: "600" },
  secondaryBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  colorRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  colorChip: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.border },
  colorChipActive: { borderWidth: 3, borderColor: Colors.violet },
  colorChipSmall: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border },
  colorChipSmallActive: { borderWidth: 2.5, borderColor: Colors.violet },
  noColorText: { fontSize: 8, color: Colors.ink3, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, maxHeight: 340 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyTitle: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 11, color: Colors.ink3, textAlign: "center", maxWidth: 320 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  count: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  editActions: { flexDirection: "row", gap: 6, justifyContent: "flex-end", marginTop: 2 },
  footer: { padding: 16, paddingTop: 8, flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  moveBanner: { position: "absolute", left: 0, right: 0, bottom: 100, alignItems: "center", paddingHorizontal: 20 },
  moveBannerInner: { width: "100%", maxWidth: 480, backgroundColor: Colors.violetD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border2, gap: 10 },
  moveBannerTitle: { fontSize: 11, fontWeight: "700", color: Colors.violet3 },
  moveChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  moveChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  moveChipText: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  moveChipTextActive: { color: "#fff" },
  moveChipDot: { width: 10, height: 10, borderRadius: 5 },
});

export default CategoriesModal;
