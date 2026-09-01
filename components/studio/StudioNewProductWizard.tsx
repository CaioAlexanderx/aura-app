// ============================================================
// AURA STUDIO - StudioNewProductWizard
//
// 19/08/2026 — Enxugamento do catálogo (análise de UI):
// O wizard de 4 passos (Básico → Personalização → Ficha → Templates,
// cada um com interstitial "Sim/Não") virou UM passo só: o Básico.
// Motivo: os passos 2-4 embedavam os mesmos painéis que já existem
// no editor inline do estoque — o lojista respondia perguntas e
// navegava steps pra chegar no mesmo lugar. Agora:
//   1. Preenche nome + preço (únicos obrigatórios) e cria.
//   2. onCreated(product) → o estoque expande o produto inline,
//      onde Personalização/Ficha/Templates estão a 1 clique (tabs).
//
// Convencoes:
//   - useStudioTokens() pro theme (light/dark via StudioThemeMode)
//   - buildStyles(t) memoizado
//   - toast em "@/components/Toast"
//   - request() direto de "@/services/api" pra criar produto
//   - StudioGradient no header (primary -> accent 135deg)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Image,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { StudioGradient } from "@/components/studio/StudioGradient";
import { request } from "@/services/api";
import { studioApi } from "@/services/studioApi";
import { toast } from "@/components/Toast";
import { pickImageBase64, uploadStudioMockup } from "@/services/studioUploadApi";

// ───────────────────────────────────────────────────────────
// Tipos
// ───────────────────────────────────────────────────────────
type Props = {
  visible: boolean;
  onClose: () => void;
  companyId: string;
  onCreated?: (product: { id: string; name: string; price: number }) => void;
};

// Categoria: id para seleção local, name para enviar no payload (campo TEXT no produto)
type Category = { id: string; name: string; color?: string | null };

// ───────────────────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────────────────
export function StudioNewProductWizard({ visible, onClose, companyId, onCreated }: Props) {
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [sku, setSku] = useState("");
  // categoryName: texto que vai pro payload (campo TEXT no produto)
  const [categoryName, setCategoryName] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // ── Reset state quando modal fecha ──────────────────────
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setName("");
        setDescription("");
        setPrice("");
        setStockQty("");
        setSku("");
        setCategoryName("");
        setNewCategoryName("");
        setShowNewCategoryInput(false);
        setImageUrl("");
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  // ── Carrega categorias via studioApi ────────────────────
  useEffect(() => {
    if (!visible || !companyId) return;
    let cancelled = false;
    setLoadingCategories(true);
    studioApi.listProductCategories(companyId)
      .then((r) => {
        if (cancelled) return;
        const list = r?.categories ?? [];
        setCategories(list.map((c) => ({
          id: String(c.id),
          name: String(c.name || ""),
          color: c.color || null,
        })));
      })
      .catch((e) => {
        // Nao bloqueia: usuario pode criar produto sem categoria
        console.log("[StudioNewProductWizard] Erro ao carregar categorias", e);
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, companyId]);

  // ── Validacao ───────────────────────────────────────────
  const nameValid = name.trim().length >= 2;
  const priceNum = parseFloat(price.replace(",", "."));
  const priceValid = !isNaN(priceNum) && priceNum > 0;
  const canSubmit = nameValid && priceValid && !submitting;

  // ── Upload de imagem (web + native) ─────────────────────
  // Cross-platform (QA celular): antes só funcionava no web, e no app a
  // lojista esbarrava num toast pedindo pra colar URL — justo no fluxo mais
  // comum (foto tirada no próprio celular).
  async function handlePickImage() {
    const picked = await pickImageBase64().catch((e: any) => {
      toast.error(e?.message || "Não foi possível abrir a galeria.");
      return null;
    });
    if (!picked) return;
    setUploadingImage(true);
    try {
      const r = await uploadStudioMockup(companyId, {
        content_base64: picked.base64,
        content_type: picked.content_type,
        kind: "mockup",
      });
      setImageUrl(r.url);
      toast.success("Foto enviada!");
    } catch (e: any) {
      console.error("[StudioNewProductWizard] Falha upload imagem", e);
      toast.error(e?.message || "Falha no upload da foto");
    } finally {
      setUploadingImage(false);
    }
  }

  // ── Cria categoria nova via studioApi ───────────────────
  async function handleCreateCategory() {
    const trimmed = newCategoryName.trim();
    if (trimmed.length < 2) {
      toast.error("Nome da categoria precisa ter pelo menos 2 caracteres");
      return;
    }
    try {
      const r = await studioApi.createProductCategory(companyId, { name: trimmed });
      const newCat: Category = {
        id: String(r?.id || r?.category?.id || ""),
        name: trimmed,
        color: r?.color || null,
      };
      if (!newCat.id) {
        throw new Error("Backend não retornou id da categoria");
      }
      setCategories((prev) => [...prev, newCat]);
      setCategoryName(trimmed);
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      toast.success("Categoria criada");
    } catch (e: any) {
      console.error("[StudioNewProductWizard] Falha criar categoria", e);
      toast.error(e?.message || "Não foi possível criar a categoria");
    }
  }

  // ── Submit: cria produto e entrega pro editor inline ────
  // (#4): envia `category` como texto (nome), não `category_id` (FK)
  async function submitCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceNum,
      };
      const stockNum = parseInt(stockQty.replace(/\D/g, ""), 10);
      if (!isNaN(stockNum)) body.stock_qty = stockNum;
      if (sku.trim()) body.sku = sku.trim();
      if (categoryName) body.category = categoryName;
      if (imageUrl) body.image_url = imageUrl;

      console.log("[StudioNewProductWizard] POST produto", { companyId, body });
      const product = await request<any>(`/companies/${companyId}/products`, {
        method: "POST",
        body,
        retry: 0,
        timeout: 15000,
      });
      const productId = String(product?.id || product?.product?.id || "");
      if (!productId) {
        throw new Error("Backend não retornou id do produto");
      }
      toast.success("Produto criado!");
      onCreated?.({ id: productId, name: name.trim(), price: priceNum });
      onClose();
    } catch (e: any) {
      console.error("[StudioNewProductWizard] Falha criar produto", e);
      toast.error(e?.message || "Erro ao criar produto");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Tamanho do modal: full em mobile, 720px max em desktop
  const isCompact = winWidth < 720;
  const modalWidth = isCompact ? winWidth : Math.min(720, winWidth - 48);
  const modalMaxHeight = isCompact ? winHeight : winHeight - 48;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modal,
            {
              width: modalWidth,
              maxHeight: modalMaxHeight,
              borderRadius: isCompact ? 0 : 18,
            },
          ]}
        >
          {/* Header com gradient */}
          <StudioGradient
            colors={[t.primary, t.accent]}
            direction="135deg"
            style={styles.header}
          >
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerEyebrow}>Catálogo Studio</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>Novo produto</Text>
                <Text style={styles.headerSub}>
                  So nome e preço são obrigatórios. Personalização, ficha técnica e templates
                  ficam a 1 clique depois de criar.
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <Icon name="x" size={18} color="#fff" />
              </Pressable>
            </View>
          </StudioGradient>

          {/* Body scrollavel */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: 14 }}>
              {/* Nome */}
              <View style={styles.field}>
                <Text style={styles.label}>Nome do produto *</Text>
                <TextInput
                  style={[styles.input, !nameValid && name.length > 0 && styles.inputError]}
                  placeholder="Ex: Camiseta personalizada"
                  placeholderTextColor={t.ink4}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
                {name.length > 0 && !nameValid && (
                  <Text style={styles.errorTxt}>Pelo menos 2 caracteres</Text>
                )}
              </View>

              {/* Preco + Estoque */}
              <View style={styles.row2}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Preço (R$) *</Text>
                  <TextInput
                    style={[styles.input, !priceValid && price.length > 0 && styles.inputError]}
                    placeholder="0,00"
                    placeholderTextColor={t.ink4}
                    value={price}
                    onChangeText={(v) => setPrice(v.replace(/[^0-9.,]/g, ""))}
                    keyboardType="decimal-pad"
                  />
                  {price.length > 0 && !priceValid && (
                    <Text style={styles.errorTxt}>Preço precisa ser maior que zero</Text>
                  )}
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Estoque inicial</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={t.ink4}
                    value={stockQty}
                    onChangeText={(v) => setStockQty(v.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Descricao */}
              <View style={styles.field}>
                <Text style={styles.label}>Descrição</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                  placeholder="Detalhes que ajudam o cliente a decidir"
                  placeholderTextColor={t.ink4}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
              </View>

              {/* Categoria — chips por nome (campo TEXT, não FK) */}
              <View style={styles.field}>
                <Text style={styles.label}>Categoria</Text>
                {loadingCategories ? (
                  <ActivityIndicator color={t.primary} style={{ alignSelf: "flex-start" }} />
                ) : (
                  <View style={styles.catWrap}>
                    {categories.map((c) => {
                      const sel = c.name === categoryName;
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.catChip, sel && styles.catChipSel]}
                          onPress={() => setCategoryName(sel ? "" : c.name)}
                        >
                          {c.color ? (
                            <View style={[styles.catDot, { backgroundColor: c.color }]} />
                          ) : null}
                          <Text style={[styles.catChipTxt, sel && styles.catChipTxtSel]}>{c.name}</Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      style={styles.catChipAdd}
                      onPress={() => setShowNewCategoryInput(!showNewCategoryInput)}
                    >
                      <Icon name="plus" size={12} color={t.primary} />
                      <Text style={styles.catChipAddTxt}>Nova categoria</Text>
                    </Pressable>
                  </View>
                )}
                {showNewCategoryInput && (
                  <View style={[styles.row2, { marginTop: 8 }]}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Nome da nova categoria"
                      placeholderTextColor={t.ink4}
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      autoFocus
                    />
                    <Pressable style={styles.btnInlineCreate} onPress={handleCreateCategory}>
                      <Text style={styles.btnInlineCreateTxt}>Criar</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* SKU */}
              <View style={styles.field}>
                <Text style={styles.label}>SKU (opcional, gerado se vazio)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: CAM-PERS-001"
                  placeholderTextColor={t.ink4}
                  value={sku}
                  onChangeText={setSku}
                  autoCapitalize="characters"
                />
              </View>

              {/* Foto */}
              <View style={styles.field}>
                <Text style={styles.label}>Foto do produto</Text>
                <View style={styles.row2}>
                  <Pressable
                    style={[styles.uploadBtn, uploadingImage && { opacity: 0.6 }]}
                    onPress={handlePickImage}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Icon name="upload" size={14} color="#fff" />
                        <Text style={styles.uploadBtnTxt}>Subir do dispositivo</Text>
                      </>
                    )}
                  </Pressable>
                </View>
                <Text style={styles.hint}>Ou cole uma URL pública abaixo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor={t.ink4}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!imageUrl && /^https?:\/\//.test(imageUrl.trim()) && (
                  <View style={styles.imgPreview}>
                    <Image source={{ uri: imageUrl.trim() }} style={styles.imgPreviewImg} />
                    <Text style={styles.imgPreviewCap}>Prévia da foto</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer sticky */}
          <View style={styles.footer}>
            <Pressable style={styles.btnSec} onPress={onClose} disabled={submitting}>
              <Text style={styles.btnSecTxt}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPri, !canSubmit && styles.btnDisabled]}
              onPress={submitCreate}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={styles.btnPriTxt}>Criar produto</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────
// Styles (build com tokens dinamicos)
// ───────────────────────────────────────────────────────────
function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
    },
    modal: {
      backgroundColor: t.bg,
      overflow: "hidden",
      ...(Platform.OS === "web"
        ? ({ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" } as any)
        : { elevation: 20 }),
    },

    // ── Header ─────────────────────────────────────────────
    header: {
      paddingTop: 18,
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    headerEyebrow: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    headerTitle: {
      color: "#fff",
      fontSize: 19,
      fontWeight: "800",
      marginTop: 2,
      letterSpacing: -0.3,
    },
    headerSub: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 12,
      marginTop: 6,
      lineHeight: 17,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },

    // ── Body ───────────────────────────────────────────────
    body: { flex: 1 },
    bodyContent: { padding: 22, paddingBottom: 12 },

    // ── Form fields ───────────────────────────────────────
    field: { gap: 6 },
    label: {
      fontSize: 11,
      color: t.ink3,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    input: {
      backgroundColor: t.paperCardElev,
      borderWidth: 1.5,
      borderColor: t.ink5,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: t.ink,
    },
    inputError: {
      borderColor: t.danger,
    },
    errorTxt: {
      fontSize: 11.5,
      color: t.danger,
      marginTop: 2,
    },
    hint: {
      fontSize: 11.5,
      color: t.ink3,
      fontStyle: "italic",
      marginTop: 4,
    },
    row2: { flexDirection: "row", gap: 10, alignItems: "flex-end" },

    // ── Categorias ────────────────────────────────────────
    catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    catChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
    },
    catChipSel: {
      borderColor: t.primary,
      backgroundColor: t.primarySoft,
    },
    catChipTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },
    catChipTxtSel: { color: t.primary, fontWeight: "700" },
    catChipAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.primary,
      borderStyle: "dashed",
      backgroundColor: t.primaryGhost,
    },
    catChipAddTxt: { fontSize: 12, color: t.primary, fontWeight: "700" },
    catDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    btnInlineCreate: {
      backgroundColor: t.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      justifyContent: "center",
    },
    btnInlineCreateTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

    // ── Upload ────────────────────────────────────────────
    uploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: t.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      flex: 1,
    },
    uploadBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
    imgPreview: { alignItems: "center", marginTop: 10 },
    imgPreviewImg: {
      width: 160,
      height: 160,
      borderRadius: 12,
      backgroundColor: t.paperCardElev,
    },
    imgPreviewCap: { fontSize: 11, color: t.ink3, marginTop: 4 },

    // ── Footer sticky ──────────────────────────────────────
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: t.ink5,
      backgroundColor: t.paperCardElev,
      gap: 10,
    },
    btnPri: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.primary,
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 12,
      minWidth: 150,
      justifyContent: "center",
    },
    btnPriTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
    btnSec: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
    },
    btnSecTxt: { color: t.ink2, fontSize: 13, fontWeight: "700" },
    btnDisabled: { opacity: 0.45 },
  });
}

export default StudioNewProductWizard;
