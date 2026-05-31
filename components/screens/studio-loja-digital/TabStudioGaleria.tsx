// ============================================================
// AURA STUDIO · Loja Digital · Tab Galeria de Templates
//
// Gerencia a galeria de templates (artes prontas) que aparece
// no storefront Studio publico (/cardapio/studio/[slug]).
// Cliente escolhe um template ja pronto sem precisar mandar
// arte propria — diminui friccao e fecha venda mais rapido.
//
// CRUD funcional (endpoints ja existem em services/studioApi.ts):
//   - listCategories / listTemplates  → grid com filtros
//   - createTemplate                  → form inline (no modal)
//   - deleteTemplate                  → 2-click confirm via toast
//
// Variante "tab" do StudioGaleria (app/studio/(estudio)/galeria.tsx):
//   - Sem wizard externo (form inline minimo)
//   - Sem search box (tab focada em CRUD rapido)
//   - Header com tom "Loja Digital" (storefront-first)
// ============================================================
import { useMemo, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Image,
} from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, type Template, type TemplateCategory } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export function TabStudioGaleria() {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fName, setFName] = useState("");
  const [fImage, setFImage] = useState("");
  const [fCat, setFCat] = useState<string | null>(null);
  const [fTags, setFTags] = useState("");

  // 2-click delete confirm
  const [pendingDel, setPendingDel] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  }, [company?.id, filterCat]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFName(""); setFImage(""); setFCat(null); setFTags("");
  }

  async function handleCreate() {
    if (!company?.id) return;
    const name = fName.trim();
    const image_url = fImage.trim();
    if (!name) { toast.error("Da um nome pro template"); return; }
    if (!image_url) { toast.error("Cola a URL da imagem"); return; }
    setSaving(true);
    try {
      const tags = fTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await studioApi.createTemplate(company.id, {
        name,
        image_url,
        category_id: fCat || null,
        tags,
      });
      toast.success("Template adicionado!");
      resetForm();
      setFormOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tpl: Template) {
    if (!company?.id) return;
    if (pendingDel !== tpl.id) {
      setPendingDel(tpl.id);
      toast.info("Clica de novo no lixo pra confirmar");
      setTimeout(() => setPendingDel((cur) => (cur === tpl.id ? null : cur)), 4000);
      return;
    }
    try {
      await studioApi.deleteTemplate(company.id, tpl.id);
      toast.success("Template removido");
      setPendingDel(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={s.eyebrow}>LOJA DIGITAL · GALERIA</Text>
          <Text style={s.title}>Galeria de Templates</Text>
          <Text style={s.sub}>
            Artes prontas pro cliente escolher direto na loja — sem mandar arquivo.
          </Text>
        </View>
        <Pressable
          style={[s.ctaPri, formOpen && s.ctaSec]}
          onPress={() => { if (formOpen) { resetForm(); setFormOpen(false); } else { setFormOpen(true); } }}
        >
          <Icon name={formOpen ? "x" : "plus"} size={16} color={formOpen ? t.ink2 : "#fff"} />
          <Text style={[s.ctaPriTxt, formOpen && s.ctaSecTxt]}>
            {formOpen ? "Cancelar" : "Novo template"}
          </Text>
        </Pressable>
      </View>

      {/* Form inline */}
      {formOpen && (
        <View style={s.formCard}>
          <Text style={s.formTitle}>Adicionar template</Text>

          <View style={s.field}>
            <Text style={s.label}>Nome *</Text>
            <TextInput
              style={s.input}
              placeholder="Ex.: Caneca Dia das Maes — Floral"
              value={fName}
              onChangeText={setFName}
              placeholderTextColor={t.ink4}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>URL da imagem *</Text>
            <TextInput
              style={s.input}
              placeholder="https://..."
              value={fImage}
              onChangeText={setFImage}
              placeholderTextColor={t.ink4}
              autoCapitalize="none"
            />
            {fImage.trim() ? (
              <View style={s.previewBox}>
                <Image source={{ uri: fImage.trim() }} style={s.previewImg} />
              </View>
            ) : null}
          </View>

          <View style={s.field}>
            <Text style={s.label}>Categoria</Text>
            <View style={s.catPickRow}>
              <Pressable
                style={[s.catChip, !fCat && s.catChipSel]}
                onPress={() => setFCat(null)}
              >
                <Text style={[s.catChipTxt, !fCat && s.catChipTxtSel]}>Sem categoria</Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.catChip, fCat === c.id && s.catChipSel]}
                  onPress={() => setFCat(c.id)}
                >
                  <Text style={[s.catChipTxt, fCat === c.id && s.catChipTxtSel]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Tags (separe por virgula)</Text>
            <TextInput
              style={s.input}
              placeholder="floral, rosa, maes"
              value={fTags}
              onChangeText={setFTags}
              placeholderTextColor={t.ink4}
              autoCapitalize="none"
            />
          </View>

          <View style={s.formActions}>
            <Pressable
              style={[s.ctaPri, saving && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="check" size={16} color="#fff" />}
              <Text style={s.ctaPriTxt}>{saving ? "Salvando..." : "Salvar template"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Filtros por categoria */}
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
            style={[
              s.catChip,
              filterCat === c.id && s.catChipSel,
              c.color ? { borderColor: c.color } : null,
            ]}
            onPress={() => setFilterCat(c.id)}
          >
            {c.icon ? <Icon name={c.icon as any} size={12} color={c.color || t.ink3} /> : null}
            <Text style={[s.catChipTxt, filterCat === c.id && s.catChipTxtSel]}>{c.name}</Text>
            {c.template_count != null && <Text style={s.catCount}>{c.template_count}</Text>}
          </Pressable>
        ))}
      </View>

      {/* Loading */}
      {loading && (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator size="small" color={t.primary} />
        </View>
      )}

      {/* Empty */}
      {!loading && templates.length === 0 && (
        <View style={s.emptyCard}>
          <Icon name="image" size={32} color={t.ink4} />
          <Text style={s.emptyTitle}>
            {filterCat ? "Nada nessa categoria" : "Galeria vazia"}
          </Text>
          <Text style={s.emptySub}>
            {filterCat
              ? "Tenta outra categoria ou volta pra Tudo."
              : "Adicione templates pra ajudar clientes que nao sabem desenhar."}
          </Text>
          {!filterCat && !formOpen && (
            <Pressable style={s.ctaPri} onPress={() => setFormOpen(true)}>
              <Icon name="plus" size={16} color="#fff" />
              <Text style={s.ctaPriTxt}>Adicionar primeiro</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Grid */}
      {!loading && templates.length > 0 && (
        <View style={s.grid}>
          {templates.map((tpl) => {
            const isPending = pendingDel === tpl.id;
            return (
              <View key={tpl.id} style={s.tplCard}>
                <View style={s.tplThumb}>
                  {tpl.thumb_url || tpl.image_url ? (
                    <Image source={{ uri: tpl.thumb_url || tpl.image_url }} style={s.tplImg} />
                  ) : (
                    <Icon name="image" size={28} color={t.ink4} />
                  )}
                  {tpl.category_name ? (
                    <View
                      style={[
                        s.tplCatBadge,
                        tpl.category_color ? { backgroundColor: tpl.category_color } : null,
                      ]}
                    >
                      <Text style={s.tplCatBadgeTxt}>{tpl.category_name}</Text>
                    </View>
                  ) : null}
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
                    <Text style={s.tplUse}>{tpl.use_count}x usado</Text>
                    <Pressable
                      onPress={() => handleDelete(tpl)}
                      style={[s.tplDel, isPending && s.tplDelPending]}
                    >
                      <Icon
                        name="trash"
                        size={12}
                        color={isPending ? "#fff" : t.accent}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.bg },
  container: {
    padding: 24,
    paddingBottom: 60,
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 11,
    color: t.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: t.ink,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  sub: { fontSize: 13, color: t.ink3, marginTop: 4 },

  ctaPri: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: t.accent,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  ctaSec: {
    backgroundColor: t.paperCard,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  ctaSecTxt: { color: t.ink2 },

  // Form
  formCard: {
    backgroundColor: t.paperCard,
    borderWidth: 1,
    borderColor: t.ink5,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 14,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: t.ink,
    marginBottom: 2,
  },
  field: { gap: 6 },
  label: {
    fontSize: 11.5,
    fontWeight: "700",
    color: t.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5,
    borderColor: t.ink5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: t.ink,
  },
  previewBox: {
    marginTop: 8,
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  previewImg: { width: "100%", height: "100%" },
  catPickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },

  // Filtros
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: t.paperCardElev,
    borderWidth: 1.5,
    borderColor: t.ink5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  catChipSel: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  catChipTxt: { fontSize: 12.5, fontWeight: "600", color: t.ink2 },
  catChipTxtSel: { color: "#fff" },
  catCount: { fontSize: 11, color: t.ink4, fontWeight: "700" },

  // Empty
  emptyCard: {
    alignItems: "center",
    padding: 40,
    gap: 10,
    backgroundColor: t.paperCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: t.ink,
    marginTop: 6,
  },
  emptySub: {
    fontSize: 13,
    color: t.ink3,
    textAlign: "center",
    maxWidth: 360,
    marginBottom: 6,
  },

  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tplCard: {
    width: 200,
    backgroundColor: t.paperCard,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.ink5,
  },
  tplThumb: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: t.bg,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tplImg: { width: "100%", height: "100%" },
  tplCatBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: t.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tplCatBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  tplBody: { padding: 12 },
  tplName: { fontSize: 13.5, fontWeight: "700", color: t.ink },
  tplTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  tplTag: { fontSize: 10.5, color: t.ink3, fontWeight: "600" },
  tplFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: t.ink5,
  },
  tplUse: { fontSize: 11, color: t.ink3, fontWeight: "600" },
  tplDel: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: t.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tplDelPending: { backgroundColor: t.accent },
});

export default TabStudioGaleria;
