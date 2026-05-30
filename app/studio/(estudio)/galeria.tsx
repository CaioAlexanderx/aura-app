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
//
// 26/05/2026 — migrado pra useStudioTokens() + StudioPageHeader
// (residual da Fase 3 UX overhaul). Mantém CRUD/modais/grid.
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Image, Modal,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioScreen } from "@/components/studio/StudioScreen";
import type { StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type Template, type TemplateCategory } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { TemplateUploadWizard } from "@/components/studio/TemplateUploadWizard";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";

export default function StudioGaleria() {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
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

  const filteredTemplates = templates.filter((tpl) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return tpl.name.toLowerCase().includes(q) || (tpl.tags || []).some((tag) => tag.toLowerCase().includes(q));
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
    <StudioScreen variant="grid">
      {/* Header canônico */}
      <StudioPageHeader
        eyebrow="GALERIA"
        title="Templates de arte prontos"
        subtitle="Cadastre artes que o cliente pode escolher na hora da personalização."
        marginBottom={22}
        rightSlot={
          <Pressable style={s.ctaPri} onPress={() => setWizardOpen(true)}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.ctaPriTxt}>Subir template</Text>
          </Pressable>
        }
      />

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
            {c.icon && <Icon name={c.icon as any} size={12} color={c.color || t.ink3} />}
            <Text style={[s.catChipTxt, filterCat === c.id && s.catChipTxtSel]}>{c.name}</Text>
            {c.template_count != null && <Text style={s.catCount}>{c.template_count}</Text>}
          </Pressable>
        ))}
        <Pressable style={s.catChipAdd} onPress={() => setShowNewCat(true)}>
          <Icon name="plus" size={12} color={t.ink2} />
          <Text style={[s.catChipTxt, { color: t.ink2 }]}>Categoria</Text>
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
            <Text style={[s.smallBtnTxt, { color: t.ink3 }]}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      {/* Search */}
      <View style={s.searchBox}>
        <Icon name="search" size={14} color={t.ink3} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar por nome ou tag"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Loading */}
      {loading && <StudioLoading variant="skeleton-cards" rows={6} />}

      {/* Empty */}
      {!loading && filteredTemplates.length === 0 && (
        templates.length === 0 ? (
          <StudioEmpty
            icon="image"
            title="Galeria vazia"
            desc="Cadastre seus primeiros templates. Vão aparecer pro cliente escolher no momento da personalização."
            primaryCta={{ label: "Adicionar template", onPress: () => setWizardOpen(true) }}
            secondaryCta={{ label: "Adicionar categoria", onPress: () => setShowNewCat(true) }}
          />
        ) : (
          <StudioEmpty
            icon="filter"
            title="Nenhum template nessa categoria"
            desc="Tente outra categoria ou adicione um novo."
            compact
          />
        )
      )}

      {/* Grid */}
      {!loading && filteredTemplates.length > 0 && (
        <View style={s.grid}>
          {filteredTemplates.map((tpl) => (
            <View key={tpl.id} style={s.tplCard}>
              <View style={s.tplThumb}>
                {tpl.thumb_url || tpl.image_url ? (
                  <Image source={{ uri: tpl.thumb_url || tpl.image_url }} style={s.tplImg} />
                ) : (
                  <Icon name="image" size={28} color={t.ink4} />
                )}
                {tpl.category_name && (
                  <View style={[s.tplCatBadge, tpl.category_color ? { backgroundColor: tpl.category_color } : null]}>
                    <Text style={s.tplCatBadgeTxt}>{tpl.category_name}</Text>
                  </View>
                )}
              </View>
              <View style={s.tplBody}>
                <Text style={s.tplName} numberOfLines={1}>{tpl.name}</Text>
                {(tpl.tags || []).length > 0 && (
                  <View style={s.tplTags}>
                    {tpl.tags.slice(0, 3).map((tag) => (
                      <Text key={tag} style={s.tplTag}>#{tag}</Text>
                    ))}
                  </View>
                )}
                <View style={s.tplFoot}>
                  <Text style={s.tplUse}>{tpl.use_count}× usado</Text>
                  <Pressable onPress={() => deleteTemplate(tpl)} style={s.tplDel}>
                    <Icon name="trash" size={12} color={t.accent} />
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
    </StudioScreen>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: t.bg },
    container: { padding: 28, paddingBottom: 60, maxWidth: 1200, alignSelf: "center", width: "100%" },

    ctaPri: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.primary,
      paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999,
    },
    ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

    catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
    catChip: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: t.paperCardElev,
      borderWidth: 1.5, borderColor: t.ink5,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    },
    catChipSel: { backgroundColor: t.primary, borderColor: t.primary },
    catChipTxt: { fontSize: 12.5, fontWeight: "600", color: t.ink2 },
    catChipTxtSel: { color: "#fff" },
    catCount: { fontSize: 11, color: t.ink4, fontWeight: "700" },
    // chip "+ Categoria" neutra — mesma afinidade visual das chips Todas/categoria*
    // (era accentSoft/accentGhost magenta, parecia CTA destacado e poluía a row)
    catChipAdd: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999,
      borderWidth: 1.5, borderColor: t.ink5,
      backgroundColor: t.paperCard,
    },

    newCatRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    newCatInput: { flex: 1, backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: t.ink },
    smallBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: t.primary },
    smallBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 12.5 },

    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.paperCardElev,
      borderWidth: 1, borderColor: t.ink5,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
      marginBottom: 18,
    },
    searchInput: { flex: 1, fontSize: 13, color: t.ink },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    tplCard: {
      width: 200,
      backgroundColor: t.paperCard,
      borderRadius: 16, overflow: "hidden",
      borderWidth: 1, borderColor: t.ink5,
    },
    tplThumb: { width: "100%", aspectRatio: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", position: "relative" },
    tplImg: { width: "100%", height: "100%" },
    tplCatBadge: {
      position: "absolute", top: 8, left: 8,
      backgroundColor: t.primary,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    },
    tplCatBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
    tplBody: { padding: 12 },
    tplName: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    tplTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
    tplTag: { fontSize: 10.5, color: t.ink3, fontWeight: "600" },
    tplFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.ink5 },
    tplUse: { fontSize: 11, color: t.ink3, fontWeight: "600" },
    tplDel: { width: 24, height: 24, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" },
  });
}
