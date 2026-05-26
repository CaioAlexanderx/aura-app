// ============================================================
// AURA STUDIO · Galeria de templates (Fase 2)
//
// CRUD funcional:
//   - Lista templates em grid com thumb + nome + categoria + tags
//   - Filtro por categoria
//   - Botão "Subir template" abre wizard StudioWorkflow (4 passos)
//   - Lista categorias colapsável com count
//
// Workflow-first aplicado APENAS no fluxo de subir template
// (não na listagem em si — conforme diretriz workflow-first).
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Image, Modal,
} from "react-native";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { studioApi, type Template, type TemplateCategory } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { TemplateUploadWizard } from "@/components/studio/TemplateUploadWizard";

export default function StudioGaleria() {
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [cats, tpls] = await Promise.all([
        studioApi.listCategories(company.id),
        studioApi.listTemplates(company.id, filterCat ? { category_id: filterCat } : undefined),
      ]);
      setCategories(cats.categories || []);
      setTemplates(tpls.templates || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar galeria");
    } finally { setLoading(false); }
  }, [company?.id, filterCat]);

  useEffect(() => { load(); }, [load]);

  const filteredTemplates = templates.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
  });

  async function createCategory() {
    if (!company?.id || !newCatName.trim()) return;
    try {
      await studioApi.createCategory(company.id, { name: newCatName.trim() });
      toast.success("Categoria criada!");
      setNewCatName(""); setShowNewCat(false);
      load();
    } catch (e: any) { toast.error(e?.message || "Erro ao criar categoria"); }
  }

  async function deleteTemplate(tpl: Template) {
    if (!company?.id) return;
    try {
      await studioApi.deleteTemplate(company.id, tpl.id);
      toast.success("Template removido");
      load();
    } catch (e: any) { toast.error(e?.message || "Erro"); }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>FASE 2 · GALERIA</Text>
          <Text style={s.title}>Templates prontos pra venda</Text>
          <Text style={s.sub}>
            Cliente final escolhe da galeria e sai na hora — sem precisar mandar arte.
          </Text>
        </View>
        <Pressable style={s.ctaPri} onPress={() => setWizardOpen(true)}>
          <Icon name="plus" size={16} color="#fff" />
          <Text style={s.ctaPriTxt}>Subir template</Text>
        </Pressable>
      </View>

      {/* Categorias */}
      <View style={s.catRow}>
        <Pressable
          style={[s.catChip, !filterCat && s.catChipSel]}
          onPress={() => setFilterCat(null)}
        >
          <Text style={[s.catChipTxt, !filterCat && s.catChipTxtSel]}>Tudo</Text>
          <Text style={s.catCount}>{templates.length}</Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={[s.catChip, filterCat === c.id && s.catChipSel,
                    c.color ? { borderColor: c.color } : null]}
            onPress={() => setFilterCat(c.id)}
          >
            {c.icon && <Icon name={c.icon as any} size={12} color={c.color || StudioColors.ink3} />}
            <Text style={[s.catChipTxt, filterCat === c.id && s.catChipTxtSel]}>{c.name}</Text>
            {c.template_count != null && <Text style={s.catCount}>{c.template_count}</Text>}
          </Pressable>
        ))}
        <Pressable style={s.catChipAdd} onPress={() => setShowNewCat(true)}>
          <Icon name="plus" size={12} color={StudioColors.ink2} />
          <Text style={[s.catChipTxt, { color: StudioColors.ink2 }]}>Categoria</Text>
        </Pressable>
      </View>

      {showNewCat && (
        <View style={s.newCatRow}>
          <TextInput
            style={s.newCatInput}
            placeholder="Nome da categoria (Dia das Mães, Disney…)"
            value={newCatName}
            onChangeText={setNewCatName}
            autoFocus
          />
          <Pressable style={s.smallBtn} onPress={createCategory}>
            <Text style={s.smallBtnTxt}>Criar</Text>
          </Pressable>
          <Pressable style={[s.smallBtn, { backgroundColor: "transparent" }]} onPress={() => { setShowNewCat(false); setNewCatName(""); }}>
            <Text style={[s.smallBtnTxt, { color: StudioColors.ink3 }]}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      {/* Search */}
      <View style={s.searchBox}>
        <Icon name="search" size={14} color={StudioColors.ink3} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar por nome ou tag"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Loading */}
      {loading && (
        <View style={{ paddingVertical: 30 }}>
          <ActivityIndicator size="small" color={StudioColors.primary} />
        </View>
      )}

      {/* Empty */}
      {!loading && filteredTemplates.length === 0 && (
        <View style={s.emptyCard}>
          <Icon name="image" size={32} color={StudioColors.ink4} />
          <Text style={s.emptyTitle}>
            {templates.length === 0 ? "Galeria vazia" : "Nada com esse filtro"}
          </Text>
          <Text style={s.emptySub}>
            {templates.length === 0
              ? "Bora subir o primeiro template? Templates economizam tempo do cliente e fecham venda mais rápido."
              : "Tenta outra categoria ou limpa o filtro."}
          </Text>
          {templates.length === 0 && (
            <Pressable style={s.ctaPri} onPress={() => setWizardOpen(true)}>
              <Icon name="plus" size={16} color="#fff" />
              <Text style={s.ctaPriTxt}>Subir primeiro template</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Grid */}
      {!loading && filteredTemplates.length > 0 && (
        <View style={s.grid}>
          {filteredTemplates.map((t) => (
            <View key={t.id} style={s.tplCard}>
              <View style={s.tplThumb}>
                {t.thumb_url || t.image_url ? (
                  <Image source={{ uri: t.thumb_url || t.image_url }} style={s.tplImg} />
                ) : (
                  <Icon name="image" size={28} color={StudioColors.ink4} />
                )}
                {t.category_name && (
                  <View style={[s.tplCatBadge, t.category_color ? { backgroundColor: t.category_color } : null]}>
                    <Text style={s.tplCatBadgeTxt}>{t.category_name}</Text>
                  </View>
                )}
              </View>
              <View style={s.tplBody}>
                <Text style={s.tplName} numberOfLines={1}>{t.name}</Text>
                {(t.tags || []).length > 0 && (
                  <View style={s.tplTags}>
                    {t.tags.slice(0, 3).map((tag) => (
                      <Text key={tag} style={s.tplTag}>#{tag}</Text>
                    ))}
                  </View>
                )}
                <View style={s.tplFoot}>
                  <Text style={s.tplUse}>{t.use_count}× usado</Text>
                  <Pressable onPress={() => deleteTemplate(t)} style={s.tplDel}>
                    <Icon name="trash" size={12} color={StudioColors.accent} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Wizard subir template */}
      <Modal visible={wizardOpen} animationType="slide" onRequestClose={() => setWizardOpen(false)}>
        <TemplateUploadWizard
          categories={categories}
          onClose={() => setWizardOpen(false)}
          onSaved={() => { setWizardOpen(false); load(); }}
        />
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: StudioColors.bg },
  container: { padding: 28, paddingBottom: 60, maxWidth: 1200, alignSelf: "center", width: "100%" },

  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: StudioColors.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13.5, color: StudioColors.ink3, marginTop: 4 },

  ctaPri: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: StudioColors.primary,
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999,
  },
  ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1.5, borderColor: StudioColors.ink5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  catChipSel: { backgroundColor: StudioColors.primary, borderColor: StudioColors.primary },
  catChipTxt: { fontSize: 12.5, fontWeight: "600", color: StudioColors.ink2 },
  catChipTxtSel: { color: "#fff" },
  catCount: { fontSize: 11, color: StudioColors.ink4, fontWeight: "700" },
  // chip "+ Categoria" neutra — mesma afinidade visual das chips Todas/categoria*
  // (era accentSoft/accentGhost magenta, parecia CTA destacado e poluía a row)
  catChipAdd: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1.5, borderColor: StudioColors.ink5,
    backgroundColor: StudioColors.paperCard,
  },

  newCatRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  newCatInput: { flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: StudioColors.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: StudioColors.primary },
  smallBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 12.5 },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: StudioColors.ink5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    marginBottom: 18,
  },
  searchInput: { flex: 1, fontSize: 13, color: StudioColors.ink },

  emptyCard: {
    alignItems: "center", padding: 40, gap: 10,
    backgroundColor: StudioColors.paperCard,
    borderRadius: 18, borderWidth: 1, borderColor: StudioColors.ink5,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: StudioColors.ink, marginTop: 6 },
  emptySub: { fontSize: 13, color: StudioColors.ink3, textAlign: "center", maxWidth: 360, marginBottom: 6 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tplCard: {
    width: 200,
    backgroundColor: StudioColors.paperCard,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: StudioColors.ink5,
  },
  tplThumb: { width: "100%", aspectRatio: 1, backgroundColor: StudioColors.bg, alignItems: "center", justifyContent: "center", position: "relative" },
  tplImg: { width: "100%", height: "100%" },
  tplCatBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: StudioColors.primary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  tplCatBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  tplBody: { padding: 12 },
  tplName: { fontSize: 13.5, fontWeight: "700", color: StudioColors.ink },
  tplTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  tplTag: { fontSize: 10.5, color: StudioColors.ink3, fontWeight: "600" },
  tplFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: StudioColors.ink5 },
  tplUse: { fontSize: 11, color: StudioColors.ink3, fontWeight: "600" },
  tplDel: { width: 24, height: 24, borderRadius: 12, backgroundColor: StudioColors.accentSoft, alignItems: "center", justifyContent: "center" },
});
