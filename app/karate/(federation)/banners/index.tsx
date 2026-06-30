// ============================================================
// Banners / Divulgacoes — Aura Karate (Admin)
//
// Tela de gerenciamento de banners da federacao:
//   - Lista banners existentes com thumbnail (proporcao por formato)
//   - Upload via base64 (expo-image-picker web / file input)
//   - Seletor de formato: 1:1 / Story 1080x1920 / Paisagem 1920x1080
//   - Campo de titulo, seletor de evento (listCourses), placement, toggle ativo
//   - Reordenacao simples via sort_order
//   - Design Shoji / KarateColors
//
// Acesso: federation_admin (gateado em NAV_ITEMS do KarateShell)
// mod: karate.banners (registrado em MODULE_PLAN_MAP e PERM_TO_MODULES)
// ============================================================
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Switch,
  Platform,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { bannerApi, Banner, BannerFormat, BannerPlacement, BannerCreateInput } from "@/services/karateApi";
import { karateApi } from "@/services/karateApi";
import { Icon } from "@/components/Icon";

// ── Tipos ────────────────────────────────────────────────────

type FormatOption = { value: BannerFormat; label: string; ratio: number };
type PlacementOption = { value: BannerPlacement; label: string };

const FORMAT_OPTIONS: FormatOption[] = [
  { value: "1:1",       label: "Quadrado 1:1",              ratio: 1 },
  { value: "story",     label: "Story 1080x1920",           ratio: 9 / 16 },
  { value: "landscape", label: "Paisagem 1920x1080",        ratio: 16 / 9 },
];

const PLACEMENT_OPTIONS: PlacementOption[] = [
  { value: "hub",       label: "Hub" },
  { value: "inscricao", label: "Inscricao" },
  { value: "ambos",     label: "Ambos" },
];

// Largura fixa do thumbnail na lista
const THUMB_WIDTH = 100;

function thumbHeight(format: BannerFormat): number {
  const opt = FORMAT_OPTIONS.find((f) => f.value === format);
  const ratio = opt?.ratio ?? 1;
  return Math.round(THUMB_WIDTH / ratio);
}

// ── Upload via FileReader (web) ───────────────────────────────
function pickImageWeb(): Promise<{ base64: string; contentType: string; previewUrl: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > 8 * 1024 * 1024) {
        alert("Imagem muito grande (max 8 MB)");
        return resolve(null);
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, contentType: file.type || "image/jpeg", previewUrl: dataUrl });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

// ── FormularioBanner — criacao de novo banner ─────────────────
interface FormState {
  base64: string;
  contentType: string;
  previewUrl: string;
  format: BannerFormat;
  title: string;
  placement: BannerPlacement;
  eventId: string;
  sortOrder: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  base64: "",
  contentType: "image/jpeg",
  previewUrl: "",
  format: "1:1",
  title: "",
  placement: "ambos",
  eventId: "",
  sortOrder: "0",
  active: true,
};

interface FormularioBannerProps {
  federationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function FormularioBanner({ federationId, onSuccess, onCancel }: FormularioBannerProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Busca eventos (cursos) para o seletor de evento
  const { data: coursesData } = useQuery({
    queryKey: ["karate-courses", federationId],
    queryFn: () => karateApi.listCourses(federationId, { pageSize: 100 }),
    staleTime: 2 * 60000,
  });
  const events = coursesData?.items ?? [];

  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: (body: BannerCreateInput) => bannerApi.createBanner(federationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["karate-banners", federationId] });
      onSuccess();
    },
  });

  async function handlePickImage() {
    if (Platform.OS !== "web") return;
    const result = await pickImageWeb();
    if (!result) return;
    setForm((f) => ({ ...f, base64: result.base64, contentType: result.contentType, previewUrl: result.previewUrl }));
  }

  function handleSubmit() {
    if (!form.base64) { alert("Selecione uma imagem"); return; }
    const body: BannerCreateInput = {
      image_base64: form.base64,
      image_content_type: form.contentType,
      format: form.format,
      title: form.title.trim() || null,
      placement: form.placement,
      event_id: form.eventId || null,
      sort_order: parseInt(form.sortOrder, 10) || 0,
      active: form.active,
    };
    createMut.mutate(body);
  }

  const busy = createMut.isPending;

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Novo Banner</Text>

      {/* Preview / upload */}
      <TouchableOpacity style={styles.uploadZone} onPress={handlePickImage} activeOpacity={0.8}>
        {form.previewUrl ? (
          <Image source={{ uri: form.previewUrl }} style={styles.uploadPreview as ImageStyle} resizeMode="contain" />
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Icon name="image" size={32} color={KarateColors.ink4} />
            <Text style={styles.uploadHint}>Clique para selecionar imagem</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Formato */}
      <Text style={styles.fieldLabel}>Formato</Text>
      <View style={styles.chipRow}>
        {FORMAT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, form.format === opt.value && styles.chipActive]}
            onPress={() => setForm((f) => ({ ...f, format: opt.value }))}
          >
            <Text style={[styles.chipLabel, form.format === opt.value && styles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Titulo */}
      <Text style={styles.fieldLabel}>Titulo (opcional)</Text>
      <TextInput
        style={styles.input as any}
        value={form.title}
        onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
        placeholder="Ex.: Campeonato Estadual 2026"
        placeholderTextColor={KarateColors.ink4}
      />

      {/* Placement */}
      <Text style={styles.fieldLabel}>Exibir em</Text>
      <View style={styles.chipRow}>
        {PLACEMENT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, form.placement === opt.value && styles.chipActive]}
            onPress={() => setForm((f) => ({ ...f, placement: opt.value }))}
          >
            <Text style={[styles.chipLabel, form.placement === opt.value && styles.chipLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Evento (opcional) */}
      <Text style={styles.fieldLabel}>Evento vinculado (opcional)</Text>
      {events.length > 0 ? (
        <View style={styles.selectWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.chip, !form.eventId && styles.chipActive]}
              onPress={() => setForm((f) => ({ ...f, eventId: "" }))}
            >
              <Text style={[styles.chipLabel, !form.eventId && styles.chipLabelActive]}>Nenhum</Text>
            </TouchableOpacity>
            {events.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                style={[styles.chip, form.eventId === ev.id && styles.chipActive]}
                onPress={() => setForm((f) => ({ ...f, eventId: ev.id }))}
              >
                <Text style={[styles.chipLabel, form.eventId === ev.id && styles.chipLabelActive]} numberOfLines={1}>
                  {ev.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <TextInput
          style={styles.input as any}
          value={form.eventId}
          onChangeText={(v) => setForm((f) => ({ ...f, eventId: v }))}
          placeholder="ID do evento (opcional)"
          placeholderTextColor={KarateColors.ink4}
        />
      )}

      {/* Sort order */}
      <Text style={styles.fieldLabel}>Ordem de exibicao</Text>
      <TextInput
        style={styles.input as any}
        value={form.sortOrder}
        onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v.replace(/[^0-9]/g, "") }))}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={KarateColors.ink4}
      />

      {/* Ativo */}
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>Ativo</Text>
        <Switch
          value={form.active}
          onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
          trackColor={{ false: KarateColors.border, true: KarateColors.primary }}
          thumbColor={KarateColors.bg}
        />
      </View>

      {createMut.isError && (
        <Text style={styles.errorText}>
          {"Erro ao criar banner: " + ((createMut.error as any)?.message ?? "tente novamente")}
        </Text>
      )}

      <View style={styles.formActions}>
        <TouchableOpacity style={styles.btnSecondary} onPress={onCancel} disabled={busy}>
          <Text style={styles.btnSecondaryLabel}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnPrimary, busy && styles.btnDisabled]} onPress={handleSubmit} disabled={busy}>
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryLabel}>Salvar Banner</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── BannerCard — item da lista ────────────────────────────────
interface BannerCardProps {
  banner: Banner;
  federationId: string;
}

function BannerCard({ banner, federationId }: BannerCardProps) {
  const qc = useQueryClient();

  const patchMut = useMutation({
    mutationFn: (patch: Partial<Banner>) => bannerApi.updateBanner(federationId, banner.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["karate-banners", federationId] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => bannerApi.deleteBanner(federationId, banner.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["karate-banners", federationId] }),
  });

  function handleToggleActive() {
    patchMut.mutate({ active: !banner.active });
  }

  function handleDelete() {
    if (Platform.OS === "web") {
      if (!confirm("Remover este banner?")) return;
    }
    deleteMut.mutate();
  }

  function handleSortUp() {
    patchMut.mutate({ sort_order: Math.max(0, banner.sort_order - 1) });
  }

  function handleSortDown() {
    patchMut.mutate({ sort_order: banner.sort_order + 1 });
  }

  const th = thumbHeight(banner.format);
  const busy = patchMut.isPending || deleteMut.isPending;

  const formatLabel = FORMAT_OPTIONS.find((f) => f.value === banner.format)?.label ?? banner.format;
  const placementLabel = PLACEMENT_OPTIONS.find((p) => p.value === banner.placement)?.label ?? banner.placement;

  return (
    <View style={[styles.card, !banner.active && styles.cardInactive]}>
      {/* Thumbnail */}
      <Image
        source={{ uri: banner.image_url }}
        style={[styles.thumb, { width: THUMB_WIDTH, height: th } as ImageStyle]}
        resizeMode="cover"
      />

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {banner.title || "(sem titulo)"}
        </Text>
        <Text style={styles.cardMeta}>{formatLabel} • {placementLabel}</Text>
        {banner.event_name && (
          <Text style={styles.cardMeta} numberOfLines={1}>Evento: {banner.event_name}</Text>
        )}
        <Text style={styles.cardMeta}>Ordem: {banner.sort_order}</Text>
      </View>

      {/* Acoes */}
      <View style={styles.cardActions}>
        {/* Toggle ativo */}
        <Switch
          value={banner.active}
          onValueChange={handleToggleActive}
          trackColor={{ false: KarateColors.border, true: KarateColors.primary }}
          thumbColor={KarateColors.bg}
          disabled={busy}
        />

        {/* Reordenar */}
        <TouchableOpacity style={styles.iconBtn} onPress={handleSortUp} disabled={busy} accessibilityLabel="Mover para cima">
          <Icon name="chevron_up" size={18} color={KarateColors.ink3} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSortDown} disabled={busy} accessibilityLabel="Mover para baixo">
          <Icon name="chevron_down" size={18} color={KarateColors.ink3} />
        </TouchableOpacity>

        {/* Excluir */}
        <TouchableOpacity style={styles.iconBtn} onPress={handleDelete} disabled={busy} accessibilityLabel="Remover banner">
          <Icon name="trash" size={18} color={KarateColors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────
export default function BannersScreen() {
  const { federationId } = useKarateFederation();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["karate-banners", federationId],
    queryFn: () => bannerApi.listBanners(federationId),
    enabled: !!federationId,
    staleTime: 60000,
  });

  const banners = (data?.banners ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
  }, []);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
  }, []);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="image" size={20} color={KarateColors.primary} />
          <Text style={styles.headerTitle}>Banners / Divulgacoes</Text>
        </View>
        {!showForm && (
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => setShowForm(true)}
            accessibilityRole="button"
            accessibilityLabel="Adicionar banner"
          >
            <Icon name="plus" size={16} color="#fff" />
            <Text style={styles.btnPrimaryLabel}>Novo Banner</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Formulario de criacao */}
        {showForm && (
          <FormularioBanner
            federationId={federationId}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}

        {/* Estados de carregamento / erro */}
        {isLoading && (
          <View style={styles.centeredMessage}>
            <ActivityIndicator size="large" color={KarateColors.primary} />
            <Text style={styles.centeredText}>Carregando banners...</Text>
          </View>
        )}

        {!isLoading && error && (
          <View style={styles.centeredMessage}>
            <Icon name="alert_circle" size={28} color={KarateColors.primary} />
            <Text style={styles.centeredText}>Erro ao carregar banners</Text>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => refetch()}>
              <Text style={styles.btnSecondaryLabel}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lista de banners */}
        {!isLoading && !error && banners.length === 0 && !showForm && (
          <View style={styles.centeredMessage}>
            <Icon name="image" size={36} color={KarateColors.ink4} />
            <Text style={styles.emptyTitle}>Nenhum banner cadastrado</Text>
            <Text style={styles.emptyHint}>Clique em &quot;Novo Banner&quot; para adicionar o primeiro banner da federacao.</Text>
          </View>
        )}

        {!isLoading && banners.map((banner) => (
          <BannerCard key={banner.id} banner={banner} federationId={federationId} />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Estilos Shoji ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: KarateColors.bg,
  } as ViewStyle,

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: KarateColors.bg2,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
  } as ViewStyle,
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  } as ViewStyle,
  headerTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 18,
    fontWeight: "600",
    color: KarateColors.ink,
  } as TextStyle,

  // Scroll
  scroll: { flex: 1 } as ViewStyle,
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  } as ViewStyle,

  // Formulario
  form: {
    backgroundColor: KarateColors.bg2,
    borderRadius: KarateRadius.lg,
    borderWidth: 1,
    borderColor: KarateColors.border,
    padding: 20,
    marginBottom: 8,
    gap: 10,
  } as ViewStyle,
  formTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 16,
    fontWeight: "600",
    color: KarateColors.ink,
    marginBottom: 4,
  } as TextStyle,

  // Upload
  uploadZone: {
    borderWidth: 1.5,
    borderColor: KarateColors.border2,
    borderStyle: "dashed",
    borderRadius: KarateRadius.md,
    overflow: "hidden",
    backgroundColor: KarateColors.glass2,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  uploadPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  } as ViewStyle,
  uploadHint: {
    fontFamily: KarateFonts.body,
    fontSize: 13,
    color: KarateColors.ink4,
  } as TextStyle,
  uploadPreview: {
    width: "100%" as any,
    height: 180,
  },

  // Campos
  fieldLabel: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    fontWeight: "600",
    color: KarateColors.ink3,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
  } as TextStyle,
  input: {
    backgroundColor: KarateColors.glass2,
    borderWidth: 1,
    borderColor: KarateColors.border2,
    borderRadius: KarateRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: KarateFonts.body,
    fontSize: 13,
    color: KarateColors.ink,
    outlineStyle: "none",
  } as any,

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: KarateRadius.md,
    borderWidth: 1,
    borderColor: KarateColors.border2,
    backgroundColor: KarateColors.glass2,
  } as ViewStyle,
  chipActive: {
    borderColor: KarateColors.primary,
    backgroundColor: KarateColors.primarySoft,
  } as ViewStyle,
  chipLabel: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    fontWeight: "500",
    color: KarateColors.ink3,
  } as TextStyle,
  chipLabelActive: {
    color: KarateColors.primary,
    fontWeight: "700",
  } as TextStyle,

  // Select wrapper (eventos)
  selectWrap: {
    flexDirection: "row",
    gap: 8,
  } as ViewStyle,

  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,

  // Erros
  errorText: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    color: KarateColors.primary,
  } as TextStyle,

  // Acoes do formulario
  formActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    justifyContent: "flex-end",
  } as ViewStyle,

  // Botoes
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: KarateColors.primary,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: KarateRadius.md,
  } as ViewStyle,
  btnPrimaryLabel: {
    fontFamily: KarateFonts.body,
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  } as TextStyle,
  btnDisabled: {
    opacity: 0.6,
  } as ViewStyle,
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: KarateColors.glass2,
    borderWidth: 1,
    borderColor: KarateColors.border2,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: KarateRadius.md,
  } as ViewStyle,
  btnSecondaryLabel: {
    fontFamily: KarateFonts.body,
    fontSize: 13,
    fontWeight: "600",
    color: KarateColors.ink3,
  } as TextStyle,

  // Cards
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: KarateColors.bg2,
    borderRadius: KarateRadius.lg,
    borderWidth: 1,
    borderColor: KarateColors.border,
    overflow: "hidden",
    gap: 12,
    padding: 12,
  } as ViewStyle,
  cardInactive: {
    opacity: 0.55,
  } as ViewStyle,
  thumb: {
    borderRadius: KarateRadius.sm,
    backgroundColor: KarateColors.glass2,
  } as ViewStyle,
  cardInfo: {
    flex: 1,
    gap: 3,
  } as ViewStyle,
  cardTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 14,
    fontWeight: "600",
    color: KarateColors.ink,
  } as TextStyle,
  cardMeta: {
    fontFamily: KarateFonts.body,
    fontSize: 11,
    color: KarateColors.ink3,
  } as TextStyle,
  cardActions: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  } as ViewStyle,
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: KarateColors.glass2,
    borderWidth: 1,
    borderColor: KarateColors.border2,
  } as ViewStyle,

  // Estado vazio / loading
  centeredMessage: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 60,
  } as ViewStyle,
  centeredText: {
    fontFamily: KarateFonts.body,
    fontSize: 14,
    color: KarateColors.ink3,
  } as TextStyle,
  emptyTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 16,
    fontWeight: "600",
    color: KarateColors.ink,
  } as TextStyle,
  emptyHint: {
    fontFamily: KarateFonts.body,
    fontSize: 13,
    color: KarateColors.ink4,
    textAlign: "center",
    maxWidth: 320,
  } as TextStyle,
});
