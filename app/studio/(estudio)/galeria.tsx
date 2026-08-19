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
  TextInput, Image, Modal, ActivityIndicator,
} from "react-native";
import { Icon } from "@/components/Icon";
import { request } from "@/services/api";
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

  // ── Vincular arte a produtos (19/08/2026) ────────────────
  // linkTarget: template sendo vinculado; products carregados 1x sob demanda.
  const [linkTarget, setLinkTarget] = useState<Template | null>(null);
  const [linkProducts, setLinkProducts] = useState<Array<{ id: string; name: string; image_url: string | null }>>([]);
  const [linkProductsLoading, setLinkProductsLoading] = useState(false);
  const [linkChecked, setLinkChecked] = useState<Record<string, boolean>>({});
  const [linkSaving, setLinkSaving] = useState(false);

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

  // ── Vincular a produtos ─────────────────────────────────
  async function openLinkModal(tpl: Template) {
    setLinkTarget(tpl);
    const checked: Record<string, boolean> = {};
    (tpl.linked_products || []).forEach((p) => { checked[p.id] = true; });
    setLinkChecked(checked);
    if (linkProducts.length === 0 && company?.id) {
      setLinkProductsLoading(true);
      try {
        const r: any = await request(
          `/companies/${company.id}/studio/products?include_non_personalizable=true&limit=500`,
          { method: "GET", retry: 1, timeout: 15000 },
        );
        const list = Array.isArray(r) ? r : (r?.products || r?.items || []);
        setLinkProducts(list.map((p: any) => ({
          id: String(p.id),
          name: String(p.name || ""),
          image_url: p.image_url || null,
        })));
      } catch (e: any) {
        toast.error(e?.message || "Erro ao carregar produtos");
        setLinkTarget(null);
      } finally {
        setLinkProductsLoading(false);
      }
    }
  }

  async function saveLinks() {
    if (!company?.id || !linkTarget) return;
    const before = new Set((linkTarget.linked_products || []).map((p) => p.id));
    const after = new Set(Object.keys(linkChecked).filter((id) => linkChecked[id]));
    const toAdd = [...after].filter((id) => !before.has(id));
    const toRemove = [...before].filter((id) => !after.has(id));
    if (!toAdd.length && !toRemove.length) { setLinkTarget(null); return; }
    setLinkSaving(true);
    let fail = 0;
    for (const pid of toAdd) {
      try { await studioApi.linkTemplate(company.id, pid, linkTarget.id); }
      catch (e) { fail++; console.error("[Galeria.link]", { pid, e }); }
    }
    for (const pid of toRemove) {
      try { await studioApi.unlinkTemplate(company.id, pid, linkTarget.id); }
      catch (e) { fail++; console.error("[Galeria.unlink]", { pid, e }); }
    }
    setLinkSaving(false);
    setLinkTarget(null);
    if (fail > 0) toast.error(`${fail} vínculo(s) falharam — tente de novo`);
    else toast.success("Vínculos atualizados");
    load();
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
                {/* Produtos vinculados — 1 clique pra gerenciar */}
                <Pressable onPress={() => openLinkModal(tpl)} style={s.tplLinkRow}>
                  <Icon name="link" size={12} color={(tpl.linked_products || []).length > 0 ? t.primary : t.ink3} />
                  <Text
                    style={[
                      s.tplLinkTxt,
                      (tpl.linked_products || []).length > 0 && { color: t.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {(tpl.linked_products || []).length > 0
                      ? `${tpl.linked_products!.length} produto${tpl.linked_products!.length > 1 ? "s" : ""}`
                      : "Vincular a produto"}
                  </Text>
                </Pressable>

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

      {/* Vincular arte a produtos */}
      <Modal
        visible={!!linkTarget}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!linkSaving) setLinkTarget(null); }}
      >
        <View style={s.linkOverlay}>
          <View style={s.linkCard}>
            <View style={s.linkHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.linkTitle}>Vincular a produtos</Text>
                <Text style={s.linkSub} numberOfLines={1}>{linkTarget?.name}</Text>
              </View>
              <Pressable
                onPress={() => { if (!linkSaving) setLinkTarget(null); }}
                hitSlop={8}
                style={s.linkClose}
              >
                <Icon name="x" size={18} color={t.ink3} />
              </Pressable>
            </View>
            <Text style={s.linkHint}>
              A arte aparece em destaque nos produtos marcados. Sem vínculo, ela continua disponível pra loja toda.
            </Text>

            {linkProductsLoading ? (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <ActivityIndicator color={t.primary} />
              </View>
            ) : linkProducts.length === 0 ? (
              <Text style={s.linkEmpty}>Nenhum produto no catálogo ainda.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {linkProducts.map((p) => {
                  const checked = !!linkChecked[p.id];
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setLinkChecked((prev) => ({ ...prev, [p.id]: !checked }))}
                      style={[s.linkRow, checked && s.linkRowActive]}
                    >
                      {p.image_url ? (
                        <Image source={{ uri: p.image_url }} style={s.linkThumb} />
                      ) : (
                        <View style={[s.linkThumb, s.linkThumbEmpty]}>
                          <Icon name="image" size={16} color={t.ink4} />
                        </View>
                      )}
                      <Text style={s.linkRowName} numberOfLines={2}>{p.name}</Text>
                      <View style={[s.linkCheckbox, checked && s.linkCheckboxOn]}>
                        {checked && <Icon name="check" size={12} color="#fff" />}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={s.linkActions}>
              <Pressable
                onPress={() => setLinkTarget(null)}
                disabled={linkSaving}
                style={s.linkCancelBtn}
              >
                <Text style={s.linkCancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={saveLinks}
                disabled={linkSaving || linkProductsLoading}
                style={[s.linkSaveBtn, (linkSaving || linkProductsLoading) && { opacity: 0.5 }]}
              >
                {linkSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.linkSaveTxt}>Salvar vínculos</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
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

    // Vincular a produtos
    tplLinkRow: {
      flexDirection: "row", alignItems: "center", gap: 5,
      marginTop: 8, paddingVertical: 5, paddingHorizontal: 8,
      borderRadius: 8, backgroundColor: t.bgSoft,
      alignSelf: "flex-start",
    },
    tplLinkTxt: { fontSize: 11, color: t.ink3, fontWeight: "700" },

    linkOverlay: {
      flex: 1, backgroundColor: "rgba(15,23,42,0.55)",
      alignItems: "center", justifyContent: "center", padding: 20,
    },
    linkCard: {
      width: "100%", maxWidth: 440,
      backgroundColor: t.paperCardElev,
      borderRadius: 16, padding: 16, gap: 10,
    },
    linkHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    linkTitle: { fontSize: 16, fontWeight: "800", color: t.ink },
    linkSub: { fontSize: 12, color: t.ink3, marginTop: 2 },
    linkClose: { padding: 4 },
    linkHint: { fontSize: 12, color: t.ink3, lineHeight: 17 },
    linkEmpty: { fontSize: 12, color: t.ink3, fontStyle: "italic", textAlign: "center", padding: 20 },
    linkRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      padding: 8, borderRadius: 10, marginVertical: 3,
      borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.bgSoft,
    },
    linkRowActive: { borderColor: t.primary, backgroundColor: t.primaryGhost },
    linkThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: t.bg },
    linkThumbEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.ink5 },
    linkRowName: { flex: 1, fontSize: 13, fontWeight: "700", color: t.ink },
    linkCheckbox: {
      width: 20, height: 20, borderRadius: 5,
      borderWidth: 1.5, borderColor: t.ink4,
      alignItems: "center", justifyContent: "center",
    },
    linkCheckboxOn: { backgroundColor: t.primary, borderColor: t.primary },
    linkActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 4 },
    linkCancelBtn: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCard,
    },
    linkCancelTxt: { color: t.ink2, fontSize: 13, fontWeight: "700" },
    linkSaveBtn: {
      paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
      backgroundColor: t.primary, minWidth: 130, alignItems: "center",
    },
    linkSaveTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  });
}
