import { useState, useMemo, ReactNode } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { FoodColors } from "@/constants/food-tokens";
import {
  useFoodMenu, useFoodRecipesSummary,
  useUpsertMenuMutation,
  useCreateCategoryMutation, useUpdateCategoryMutation,
  useCreateItemMutation, useUpdateItemMutation, useDeleteItemMutation,
  type FoodItem, type FoodCategory, type FoodMenu,
} from "@/hooks/useFoodMenu";
import { FoodMargemBadge } from "@/components/food/FoodMargemBadge";
import { FichaTecnicaDrawer } from "@/components/food/FichaTecnicaDrawer";

// ============================================================
// Cardapio — Fase 1 do MVP Food.
//
// 3 abas: Itens / Categorias / Cardápios.
// Modais inline (CenteredModal helper) pra editar item/categoria/menu.
// FichaTecnicaDrawer separado em components/food.
//
// Backend (food.js) já entrega tudo que precisamos. Fase 1 é 100%
// frontend.
// ============================================================

type Tab = "itens" | "categorias" | "cardapios";

export default function CardapioScreen() {
  const [tab, setTab] = useState<Tab>("itens");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FoodItem | null | "new">(null);
  const [editingCategory, setEditingCategory] = useState<FoodCategory | null | "new">(null);
  const [editingMenu, setEditingMenu] = useState<FoodMenu | null | "new">(null);
  const [fichaItemId, setFichaItemId] = useState<string | null>(null);

  const { data: menuData, isLoading } = useFoodMenu();
  const { data: summary } = useFoodRecipesSummary();

  const menu = menuData?.menu;
  const categories = useMemo(() => menuData?.categories || [], [menuData]);
  const items = useMemo(() => menuData?.items || [], [menuData]);

  // index margem por item id (vem do /recipes/summary)
  const marginByItemId = useMemo(() => {
    const m = new Map<string, number | null>();
    summary?.forEach(s => m.set(s.id, s.margin_pct));
    return m;
  }, [summary]);

  const categoryName = (cid: string | null) =>
    categories.find(c => c.id === cid)?.name || "—";

  const filteredItems = useMemo(() => {
    let out = items;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      out = out.filter(i => i.name.toLowerCase().includes(q));
    }
    if (categoryFilter) out = out.filter(i => i.category_id === categoryFilter);
    return out;
  }, [items, search, categoryFilter]);

  if (isLoading) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <ActivityIndicator color={FoodColors.red} />
      </View>
    );
  }

  // Empty: nenhuma empresa tem cardapio
  if (!menu) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Cardápio</Text>
        <View style={{
          backgroundColor: FoodColors.surface, borderColor: FoodColors.border, borderWidth: 1,
          borderRadius: 12, padding: 40, alignItems: "center",
        }}>
          <Text style={{ fontSize: 48 }}>📖</Text>
          <Text style={{ fontSize: 16, color: FoodColors.ink, fontWeight: "700", marginTop: 12 }}>Sem cardápio</Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 4, textAlign: "center", maxWidth: 320 }}>
            Crie um cardápio padrão pra começar a cadastrar categorias e itens.
          </Text>
          <Pressable onPress={() => setEditingMenu("new")} style={{
            marginTop: 16, backgroundColor: FoodColors.red,
            paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8,
          }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>+ Criar cardápio</Text>
          </Pressable>
        </View>
        {editingMenu && (
          <MenuModal initial={editingMenu === "new" ? null : editingMenu} onClose={() => setEditingMenu(null)} />
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Cardápio</Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 2 }}>
            {menu.name} · {categories.length} categorias · {items.filter(i => i.is_active).length} itens ativos
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 6, paddingVertical: 4 }}>
        {(["itens", "categorias", "cardapios"] as Tab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
              backgroundColor: tab === t ? FoodColors.red : FoodColors.surface,
              borderWidth: 1, borderColor: tab === t ? FoodColors.red : FoodColors.border,
            }}
          >
            <Text style={{
              color: tab === t ? "#fff" : FoodColors.ink2,
              fontWeight: "600", fontSize: 13, textTransform: "capitalize",
            }}>
              {t === "cardapios" ? "Cardápios" : t === "itens" ? "Itens (" + items.length + ")" : "Categorias (" + categories.length + ")"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* TAB ITENS */}
      {tab === "itens" && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <View style={{
              flex: 1, minWidth: 200, flexDirection: "row",
              backgroundColor: FoodColors.surface, borderRadius: 8,
              borderWidth: 1, borderColor: FoodColors.border,
              paddingHorizontal: 12, alignItems: "center",
            }}>
              <Icon name="search" size={14} color={FoodColors.ink3} />
              <TextInput
                value={search} onChangeText={setSearch}
                placeholder="Buscar item..."
                placeholderTextColor={FoodColors.ink4}
                style={{ flex: 1, padding: 10, color: FoodColors.ink, fontSize: 13 }}
              />
            </View>
            <Pressable onPress={() => setEditingItem("new")} style={{
              backgroundColor: FoodColors.red, paddingHorizontal: 18, paddingVertical: 10,
              borderRadius: 8, flexDirection: "row", gap: 6, alignItems: "center",
            }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>+ Item</Text>
            </Pressable>
          </View>

          {/* Filtro categoria */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <CategoryChip label="Todas" active={!categoryFilter} onPress={() => setCategoryFilter(null)} />
            {categories.map(c => (
              <CategoryChip key={c.id} label={c.name} active={categoryFilter === c.id} onPress={() => setCategoryFilter(c.id)} />
            ))}
          </ScrollView>

          {/* Tabela */}
          {filteredItems.length === 0 ? (
            <View style={{
              backgroundColor: FoodColors.surface, borderRadius: 10, padding: 30,
              alignItems: "center", borderWidth: 1, borderColor: FoodColors.border,
            }}>
              <Text style={{ fontSize: 13, color: FoodColors.ink3 }}>
                Nenhum item cadastrado. Adicione o primeiro com "+ Item".
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: FoodColors.surface, borderRadius: 10,
              borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden",
            }}>
              {/* header row */}
              <View style={{
                flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10,
                backgroundColor: FoodColors.surface2,
                borderBottomWidth: 1, borderBottomColor: FoodColors.border, gap: 10,
              }}>
                <Text style={[colHeader, { flex: 2.5 }]}>Item</Text>
                <Text style={[colHeader, { flex: 1.2 }]}>Categoria</Text>
                <Text style={[colHeader, { flex: 0.8, textAlign: "right" }]}>Preço</Text>
                <Text style={[colHeader, { flex: 0.8, textAlign: "right" }]}>CMV</Text>
                <Text style={[colHeader, { flex: 0.8, textAlign: "center" }]}>Margem</Text>
                <Text style={[colHeader, { width: 90, textAlign: "right" }]}>Ações</Text>
              </View>

              {filteredItems.map(item => (
                <View key={item.id} style={{
                  flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10,
                  alignItems: "center",
                  borderBottomWidth: 1, borderBottomColor: FoodColors.border, gap: 10,
                  opacity: item.is_active ? 1 : 0.4,
                }}>
                  <View style={{ flex: 2.5, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 6,
                      backgroundColor: FoodColors.surface2,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text>🍽</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: FoodColors.ink, fontWeight: "600" }} numberOfLines={1}>{item.name}</Text>
                      {!item.is_available && (
                        <Text style={{ fontSize: 10, color: FoodColors.amber }}>Esgotado</Text>
                      )}
                    </View>
                  </View>
                  <Text style={{ flex: 1.2, fontSize: 12, color: FoodColors.ink3 }}>{categoryName(item.category_id)}</Text>
                  <Text style={{ flex: 0.8, fontSize: 12, color: FoodColors.green, fontWeight: "600", textAlign: "right" }}>
                    R$ {Number(item.price).toFixed(2)}
                  </Text>
                  <Text style={{ flex: 0.8, fontSize: 12, color: FoodColors.ink3, textAlign: "right" }}>
                    R$ {Number(item.cost_price || 0).toFixed(2)}
                  </Text>
                  <View style={{ flex: 0.8, alignItems: "center" }}>
                    <FoodMargemBadge marginPct={marginByItemId.get(item.id)} size="sm" />
                  </View>
                  <View style={{ width: 90, flexDirection: "row", gap: 4, justifyContent: "flex-end" }}>
                    <Pressable
                      onPress={() => setFichaItemId(item.id)}
                      style={iconBtnStyle}
                      {...(Platform.OS === "web" ? ({ title: "Ficha técnica" } as any) : {})}
                    >
                      <Icon name="clipboard" size={12} color={FoodColors.cyan} />
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingItem(item)}
                      style={iconBtnStyle}
                      {...(Platform.OS === "web" ? ({ title: "Editar" } as any) : {})}
                    >
                      <Icon name="edit" size={12} color={FoodColors.ink3} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* TAB CATEGORIAS */}
      {tab === "categorias" && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Pressable onPress={() => setEditingCategory("new")} style={{
              backgroundColor: FoodColors.red, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8,
            }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>+ Categoria</Text>
            </Pressable>
          </View>

          {categories.length === 0 ? (
            <View style={{
              backgroundColor: FoodColors.surface, borderRadius: 10, padding: 30,
              alignItems: "center", borderWidth: 1, borderColor: FoodColors.border,
            }}>
              <Text style={{ fontSize: 13, color: FoodColors.ink3 }}>
                Nenhuma categoria. Crie pra organizar os itens.
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: FoodColors.surface, borderRadius: 10,
              borderWidth: 1, borderColor: FoodColors.border, overflow: "hidden",
            }}>
              {categories.slice().sort((a,b) => (a.sort_order||0) - (b.sort_order||0)).map(cat => {
                const count = items.filter(i => i.category_id === cat.id).length;
                return (
                  <View key={cat.id} style={{
                    flexDirection: "row", alignItems: "center",
                    paddingHorizontal: 14, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: FoodColors.border, gap: 10,
                    opacity: cat.is_active ? 1 : 0.4,
                  }}>
                    <Text style={{ width: 40, fontSize: 12, color: FoodColors.ink3, textAlign: "center" }}>
                      #{cat.sort_order || 0}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 14, color: FoodColors.ink, fontWeight: "600" }}>{cat.name}</Text>
                    <Text style={{ fontSize: 12, color: FoodColors.ink3, marginRight: 8 }}>{count} itens</Text>
                    <Pressable onPress={() => setEditingCategory(cat)} style={iconBtnStyle}>
                      <Icon name="edit" size={12} color={FoodColors.ink3} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* TAB CARDAPIOS */}
      {tab === "cardapios" && (
        <View style={{ gap: 10 }}>
          <View style={{
            backgroundColor: FoodColors.surface, borderRadius: 10, padding: 16,
            borderWidth: 1, borderColor: FoodColors.border,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: FoodColors.ink, fontWeight: "700" }}>{menu.name}</Text>
                <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
                  Slug: {menu.slug || "—"} · {menu.accepts_online_orders ? "Aceita pedidos online" : "Apenas presencial"}
                </Text>
                {menu.min_order_amount ? (
                  <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 2 }}>
                    Pedido mínimo: R$ {Number(menu.min_order_amount).toFixed(2)}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => setEditingMenu(menu)} style={iconBtnStyle}>
                <Icon name="edit" size={13} color={FoodColors.ink3} />
              </Pressable>
            </View>
          </View>

          <View style={{
            backgroundColor: "rgba(245,158,11,0.08)",
            borderLeftWidth: 3, borderLeftColor: FoodColors.amber,
            padding: 12, borderRadius: 6,
          }}>
            <Text style={{ fontSize: 12, color: FoodColors.amber, fontWeight: "700" }}>
              ⏱ Horários por período (almoço/jantar)
            </Text>
            <Text style={{ fontSize: 11, color: FoodColors.ink3, marginTop: 4, lineHeight: 16 }}>
              Schema food_menu_schedules já existe (migration 014d). Endpoint CRUD será
              adicionado em sub-PR. Por enquanto, o cardápio fica sempre disponível.
            </Text>
          </View>
        </View>
      )}

      {/* MODALS */}
      {editingItem && (
        <ItemModal
          initial={editingItem === "new" ? null : editingItem}
          categories={categories}
          onClose={() => setEditingItem(null)}
        />
      )}
      {editingCategory && menu && (
        <CategoryModal
          initial={editingCategory === "new" ? null : editingCategory}
          menuId={menu.id}
          onClose={() => setEditingCategory(null)}
        />
      )}
      {editingMenu && (
        <MenuModal
          initial={editingMenu === "new" ? null : editingMenu}
          onClose={() => setEditingMenu(null)}
        />
      )}

      <FichaTecnicaDrawer itemId={fichaItemId} onClose={() => setFichaItemId(null)} />
    </View>
  );
}

// ============================================================
// Subcomponents
// ============================================================
function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: active ? FoodColors.redDim : FoodColors.surface,
      borderWidth: 1, borderColor: active ? FoodColors.red : FoodColors.border,
    }}>
      <Text style={{
        color: active ? FoodColors.red : FoodColors.ink3,
        fontSize: 12, fontWeight: "600",
      }}>{label}</Text>
    </Pressable>
  );
}

function ItemModal({ initial, categories, onClose }: { initial: FoodItem | null; categories: FoodCategory[]; onClose: () => void }) {
  const createM = useCreateItemMutation();
  const updateM = useUpdateItemMutation();
  const deleteM = useDeleteItemMutation();

  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id || null);
  const [price, setPrice] = useState(initial?.price ? String(initial.price) : "");
  const [prepMin, setPrepMin] = useState(initial?.preparation_time_min ? String(initial.preparation_time_min) : "");
  const [serves, setServes] = useState(initial?.serves ? String(initial.serves) : "1");
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true);

  const handleSave = async () => {
    if (!name.trim() || !price) return;
    const body: Partial<FoodItem> = {
      name: name.trim(),
      description: description.trim() || null,
      category_id: categoryId,
      price: parseFloat(price),
      preparation_time_min: prepMin ? parseInt(prepMin, 10) : null,
      serves: serves ? parseInt(serves, 10) : 1,
      is_available: isAvailable,
    };
    if (initial) await updateM.mutateAsync({ id: initial.id, ...body });
    else         await createM.mutateAsync(body);
    onClose();
  };
  const handleDelete = async () => {
    if (!initial) return;
    await deleteM.mutateAsync(initial.id);
    onClose();
  };
  const disabled = !name.trim() || !price || createM.isPending || updateM.isPending;

  return (
    <CenteredModal title={initial ? "Editar item" : "Novo item"} onClose={onClose}>
      <Field label="Nome *">
        <TextInput value={name} onChangeText={setName} placeholder="Ex: Picanha na Brasa" placeholderTextColor={FoodColors.ink4} style={fieldStyle} />
      </Field>
      <Field label="Descrição">
        <TextInput value={description} onChangeText={setDescription} placeholder="Ex: 400g, acompanha arroz + farofa" placeholderTextColor={FoodColors.ink4} multiline style={[fieldStyle, { minHeight: 60 }]} />
      </Field>
      <Field label="Categoria">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <CategoryChip label="Sem categoria" active={!categoryId} onPress={() => setCategoryId(null)} />
          {categories.map(c => <CategoryChip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
        </ScrollView>
      </Field>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field label="Preço *" flex={1}>
          <TextInput value={price} onChangeText={setPrice} placeholder="0,00" placeholderTextColor={FoodColors.ink4} keyboardType="decimal-pad" style={fieldStyle} />
        </Field>
        <Field label="Tempo (min)" flex={1}>
          <TextInput value={prepMin} onChangeText={setPrepMin} placeholder="15" placeholderTextColor={FoodColors.ink4} keyboardType="number-pad" style={fieldStyle} />
        </Field>
        <Field label="Serve" flex={1}>
          <TextInput value={serves} onChangeText={setServes} placeholder="1" placeholderTextColor={FoodColors.ink4} keyboardType="number-pad" style={fieldStyle} />
        </Field>
      </View>
      <Pressable onPress={() => setIsAvailable(!isAvailable)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
        <View style={{
          width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
          borderColor: isAvailable ? FoodColors.red : FoodColors.border,
          backgroundColor: isAvailable ? FoodColors.red : "transparent",
          alignItems: "center", justifyContent: "center",
        }}>
          {isAvailable && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✓</Text>}
        </View>
        <Text style={{ fontSize: 13, color: FoodColors.ink2 }}>Item disponível (pode ser pedido)</Text>
      </Pressable>

      <ModalActions>
        {initial && (
          <Pressable onPress={handleDelete} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: FoodColors.red }}>
            <Text style={{ color: FoodColors.red, fontSize: 13, fontWeight: "600" }}>Remover</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.surface2 }}>
          <Text style={{ color: FoodColors.ink2, fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={disabled} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.red, opacity: disabled ? 0.4 : 1 }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{initial ? "Salvar" : "Criar"}</Text>
        </Pressable>
      </ModalActions>
    </CenteredModal>
  );
}

function CategoryModal({ initial, menuId, onClose }: { initial: FoodCategory | null; menuId: string; onClose: () => void }) {
  const createM = useCreateCategoryMutation();
  const updateM = useUpdateCategoryMutation();

  const [name, setName] = useState(initial?.name || "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order != null ? String(initial.sort_order) : "0");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (initial) {
      await updateM.mutateAsync({
        id: initial.id,
        name: name.trim(),
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: isActive,
      });
    } else {
      await createM.mutateAsync({
        menu_id: menuId, name: name.trim(),
        sort_order: parseInt(sortOrder, 10) || 0,
      });
    }
    onClose();
  };
  const disabled = !name.trim() || createM.isPending || updateM.isPending;

  return (
    <CenteredModal title={initial ? "Editar categoria" : "Nova categoria"} onClose={onClose}>
      <Field label="Nome *">
        <TextInput value={name} onChangeText={setName} placeholder="Ex: Pratos Principais" placeholderTextColor={FoodColors.ink4} style={fieldStyle} />
      </Field>
      <Field label="Ordem">
        <TextInput value={sortOrder} onChangeText={setSortOrder} placeholder="0" placeholderTextColor={FoodColors.ink4} keyboardType="number-pad" style={fieldStyle} />
      </Field>
      {initial && (
        <Pressable onPress={() => setIsActive(!isActive)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
          <View style={{
            width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
            borderColor: isActive ? FoodColors.red : FoodColors.border,
            backgroundColor: isActive ? FoodColors.red : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {isActive && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✓</Text>}
          </View>
          <Text style={{ fontSize: 13, color: FoodColors.ink2 }}>Categoria ativa</Text>
        </Pressable>
      )}

      <ModalActions>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.surface2 }}>
          <Text style={{ color: FoodColors.ink2, fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={disabled} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.red, opacity: disabled ? 0.4 : 1 }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{initial ? "Salvar" : "Criar"}</Text>
        </Pressable>
      </ModalActions>
    </CenteredModal>
  );
}

function MenuModal({ initial, onClose }: { initial: FoodMenu | null; onClose: () => void }) {
  const upsertM = useUpsertMenuMutation();

  const [name, setName] = useState(initial?.name || "Cardápio Principal");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [acceptsOnline, setAcceptsOnline] = useState(initial?.accepts_online_orders ?? false);
  const [minAmount, setMinAmount] = useState(initial?.min_order_amount ? String(initial.min_order_amount) : "");

  const handleSave = async () => {
    if (!name.trim()) return;
    await upsertM.mutateAsync({
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      accepts_online_orders: acceptsOnline,
      min_order_amount: minAmount ? parseFloat(minAmount) : undefined,
    });
    onClose();
  };
  const disabled = !name.trim() || upsertM.isPending;

  return (
    <CenteredModal title={initial ? "Editar cardápio" : "Novo cardápio"} onClose={onClose}>
      <Field label="Nome *">
        <TextInput value={name} onChangeText={setName} placeholder="Cardápio Principal" placeholderTextColor={FoodColors.ink4} style={fieldStyle} />
      </Field>
      <Field label="Slug (URL pública)">
        <TextInput value={slug} onChangeText={setSlug} placeholder="cardapio-jantar" placeholderTextColor={FoodColors.ink4} style={fieldStyle} autoCapitalize="none" />
      </Field>
      <Field label="Descrição">
        <TextInput value={description} onChangeText={setDescription} placeholder="Sobre o cardápio" placeholderTextColor={FoodColors.ink4} multiline style={[fieldStyle, { minHeight: 60 }]} />
      </Field>
      <Pressable onPress={() => setAcceptsOnline(!acceptsOnline)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
        <View style={{
          width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
          borderColor: acceptsOnline ? FoodColors.red : FoodColors.border,
          backgroundColor: acceptsOnline ? FoodColors.red : "transparent",
          alignItems: "center", justifyContent: "center",
        }}>
          {acceptsOnline && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✓</Text>}
        </View>
        <Text style={{ fontSize: 13, color: FoodColors.ink2 }}>Aceita pedidos online (delivery próprio)</Text>
      </Pressable>
      {acceptsOnline && (
        <Field label="Pedido mínimo (R$)">
          <TextInput value={minAmount} onChangeText={setMinAmount} placeholder="0,00" placeholderTextColor={FoodColors.ink4} keyboardType="decimal-pad" style={fieldStyle} />
        </Field>
      )}

      <ModalActions>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.surface2 }}>
          <Text style={{ color: FoodColors.ink2, fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={disabled} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: FoodColors.red, opacity: disabled ? 0.4 : 1 }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{initial ? "Salvar" : "Criar"}</Text>
        </Pressable>
      </ModalActions>
    </CenteredModal>
  );
}

function Field({ label, children, flex }: { label: string; children: ReactNode; flex?: number }) {
  return (
    <View style={{ gap: 4, flex }}>
      <Text style={{
        fontSize: 11, color: FoodColors.ink3, fontWeight: "600",
        textTransform: "uppercase", letterSpacing: 0.5,
      }}>{label}</Text>
      {children}
    </View>
  );
}

function CenteredModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center", alignItems: "center", padding: 20,
      }}>
        <View style={{
          backgroundColor: FoodColors.surface, borderRadius: 14, padding: 20,
          width: "100%", maxWidth: 480, gap: 12,
          borderWidth: 1, borderColor: FoodColors.border,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontSize: 16, color: FoodColors.ink, fontWeight: "800" }}>{title}</Text>
            <Pressable onPress={onClose} style={{
              width: 28, height: 28, alignItems: "center", justifyContent: "center",
              borderRadius: 6, backgroundColor: FoodColors.surface2,
            }}>
              <Icon name="x" size={13} color={FoodColors.ink3} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ModalActions({ children }: { children: ReactNode }) {
  return (
    <View style={{
      flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: FoodColors.border,
    }}>
      {children}
    </View>
  );
}

// ============================================================
// Shared styles
// ============================================================
const colHeader: any = {
  fontSize: 10,
  color: FoodColors.ink3,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontWeight: "700",
};
const fieldStyle: any = {
  backgroundColor: FoodColors.bg,
  color: FoodColors.ink,
  padding: 10,
  borderRadius: 8,
  fontSize: 13,
  borderWidth: 1,
  borderColor: FoodColors.border,
};
const iconBtnStyle: any = {
  width: 28, height: 28, alignItems: "center", justifyContent: "center",
  borderRadius: 6, backgroundColor: FoodColors.surface2,
};
