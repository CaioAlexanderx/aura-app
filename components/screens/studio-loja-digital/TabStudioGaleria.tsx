// ============================================================
// AURA STUDIO · Loja Digital · Tab Galeria de Templates
//
// QA fix (achado #10): esta tab era um CRUD degradado, subconjunto de
// /studio/galeria (form de URL colada em vez do wizard de upload, sem
// busca, sem criar categoria, sem "Vincular a produto", delete com
// comportamento diferente). Duas implementações divergentes = bug
// garantido. A tab virou um atalho: resumo (contagem + últimos thumbs)
// + CTA "Gerenciar galeria" pra tela completa, que é a única fonte de
// verdade pro CRUD de templates.
// ============================================================
import { useMemo, useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, type Template, type TemplateCategory } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

const PREVIEW_COUNT = 8;

export function TabStudioGaleria() {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  // QA fix (achado #18): sem company.id o loading ficava true pra sempre.
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) { setLoading(false); setBlocked(true); return; }
    setBlocked(false);
    setLoading(true);
    try {
      const [cats, tpls] = await Promise.all([
        studioApi.listCategories(company.id),
        studioApi.listTemplates(company.id, { limit: PREVIEW_COUNT }),
      ]);
      setCategories(cats.categories || []);
      setTemplates(tpls.templates || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar galeria");
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  function goToGaleria() {
    router.push("/studio/galeria" as any);
  }

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={t.primary} />
        <Text style={s.loadingText}>Carregando galeria…</Text>
      </View>
    );
  }

  if (blocked) {
    return (
      <View style={s.loadingWrap}>
        <Icon name="alert-circle" size={28} color={t.ink4} />
        <Text style={s.loadingText}>Não foi possível identificar sua empresa. Recarregue a página.</Text>
      </View>
    );
  }

  const hasTemplates = templates.length > 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={s.eyebrow}>LOJA DIGITAL · GALERIA</Text>
          <Text style={s.title}>Galeria de Templates</Text>
          <Text style={s.sub}>
            Artes prontas pro cliente escolher direto na loja — sem mandar arquivo.
          </Text>
        </View>
      </View>

      {/* Resumo */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{templates.length}{templates.length >= PREVIEW_COUNT ? "+" : ""}</Text>
          <Text style={s.statLabel}>Templates</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{categories.length}</Text>
          <Text style={s.statLabel}>Categorias</Text>
        </View>
      </View>

      {/* CTA principal — atalho pra tela completa (achado #10) */}
      <Pressable style={s.ctaPri} onPress={goToGaleria}>
        <Icon name="image" size={16} color="#fff" />
        <Text style={s.ctaPriTxt}>Gerenciar galeria</Text>
        <Icon name="arrow-right" size={14} color="#fff" />
      </Pressable>

      {/* Últimos thumbs */}
      {hasTemplates ? (
        <>
          <Text style={s.sectionLabel}>Últimos templates</Text>
          <View style={s.grid}>
            {templates.map((tpl) => (
              <Pressable key={tpl.id} style={s.tplCard} onPress={goToGaleria}>
                <View style={s.tplThumb}>
                  {tpl.thumb_url || tpl.image_url ? (
                    <Image source={{ uri: tpl.thumb_url || tpl.image_url }} style={s.tplImg} />
                  ) : (
                    <Icon name="image" size={24} color={t.ink4} />
                  )}
                </View>
                <Text style={s.tplName} numberOfLines={1}>{tpl.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={s.emptyCard}>
          <Icon name="image" size={32} color={t.ink4} />
          <Text style={s.emptyTitle}>Galeria vazia</Text>
          <Text style={s.emptySub}>
            Adicione templates pra ajudar clientes que não sabem desenhar.
          </Text>
          <Pressable style={s.ctaPri} onPress={goToGaleria}>
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.ctaPriTxt}>Criar primeiro template</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  loadingText: { color: t.ink3, fontSize: 14, textAlign: "center" },

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

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: t.paperCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: t.ink },
  statLabel: { fontSize: 12, color: t.ink3, marginTop: 2 },

  ctaPri: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: t.accent,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 20,
  },
  ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

  sectionLabel: { fontSize: 12, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 },

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

  // Grid de thumbs
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tplCard: {
    width: 100,
    gap: 6,
  },
  tplThumb: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: t.bg,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.ink5,
  },
  tplImg: { width: "100%", height: "100%" },
  tplName: { fontSize: 11, color: t.ink2, fontWeight: "600" },
});

export default TabStudioGaleria;
