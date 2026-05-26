// ============================================================
// AURA STUDIO - StudioNewProductWizard (Sprint 4)
//
// Wizard 4 passos pra cadastro unificado de produto personalizado:
//   1. Basico (obrigatorio) — nome, descricao, preco, estoque, sku,
//      categoria, foto. Submit POST /companies/:cid/products.
//   2. Personalizacao (opcional) — embed StudioPersonalizacaoPanel.
//   3. Ficha tecnica (opcional)  — embed StudioFichaTecnicaPanel.
//   4. Templates (opcional)      — embed StudioTemplatesPanel.
//
// Convencoes:
//   - useStudioTokens() pro theme (light/dark via StudioThemeMode)
//   - buildStyles(t) memoizado
//   - toast em "@/components/Toast"
//   - request() direto de "@/services/api" pra criar produto
//   - StudioLoading no submit (variant spinner)
//   - StudioGradient no header (primary -> accent 135deg)
//
// Defensivo de imports:
//   Os 3 panels embedados (Sprints 1-3 paralelos) podem nao existir
//   no momento do build. Usamos require + try/catch + placeholder
//   pra nao quebrar build.
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
import { StudioLoading } from "@/components/studio/StudioLoading";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import {
  fileToBase64Web,
  pickFileWeb,
  uploadStudioMockup,
} from "@/services/studioUploadApi";

// ───────────────────────────────────────────────────────────
// Defensivo: panels da Sprints 1-3 podem nao existir ainda.
// Carrega via require + try/catch. Se faltar, vira placeholder.
// ───────────────────────────────────────────────────────────
let StudioPersonalizacaoPanel: any = null;
let StudioFichaTecnicaPanel: any = null;
let StudioTemplatesPanel: any = null;
try {
  StudioPersonalizacaoPanel = require("@/components/studio/StudioPersonalizacaoPanel").default;
} catch (e) {
  console.log("[StudioNewProductWizard] StudioPersonalizacaoPanel nao encontrado (Sprint 1 pendente)", e);
}
try {
  StudioFichaTecnicaPanel = require("@/components/studio/StudioFichaTecnicaPanel").default;
} catch (e) {
  console.log("[StudioNewProductWizard] StudioFichaTecnicaPanel nao encontrado (Sprint 2 pendente)", e);
}
try {
  StudioTemplatesPanel = require("@/components/studio/StudioTemplatesPanel").default;
} catch (e) {
  console.log("[StudioNewProductWizard] StudioTemplatesPanel nao encontrado (Sprint 3 pendente)", e);
}

// ───────────────────────────────────────────────────────────
// Tipos
// ───────────────────────────────────────────────────────────
type Props = {
  visible: boolean;
  onClose: () => void;
  companyId: string;
  onCreated?: (product: { id: string; name: string; price: number }) => void;
};

type Category = { id: string; name: string };

type CreatedProduct = {
  id: string;
  name: string;
  price: number;
};

const TOTAL_STEPS = 4;
const STEP_TITLES = ["Basico", "Personalizacao", "Ficha tecnica", "Templates"];

// ───────────────────────────────────────────────────────────
// Componente principal
// ───────────────────────────────────────────────────────────
export function StudioNewProductWizard({ visible, onClose, companyId, onCreated }: Props) {
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [step, setStep] = useState(1);

  // Step 1 — Basico
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Categorias
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Submit do step 1
  const [submitting, setSubmitting] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<CreatedProduct | null>(null);

  // Steps 2/3/4 — toggles "Sim/Nao (pular)"
  const [doPersonalizacao, setDoPersonalizacao] = useState<boolean | null>(null);
  const [doFichaTecnica, setDoFichaTecnica] = useState<boolean | null>(null);
  const [doTemplates, setDoTemplates] = useState<boolean | null>(null);

  // ── Reset state quando modal abre/fecha ─────────────────
  useEffect(() => {
    if (!visible) {
      // Reset apos fechar pra nao manter rascunho na proxima abertura
      const timer = setTimeout(() => {
        setStep(1);
        setName("");
        setDescription("");
        setPrice("");
        setStockQty("");
        setSku("");
        setCategoryId("");
        setNewCategoryName("");
        setShowNewCategoryInput(false);
        setImageUrl("");
        setCreatedProduct(null);
        setDoPersonalizacao(null);
        setDoFichaTecnica(null);
        setDoTemplates(null);
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  // ── Carrega categorias ao abrir ─────────────────────────
  useEffect(() => {
    if (!visible || !companyId) return;
    let cancelled = false;
    setLoadingCategories(true);
    request<{ categories?: Category[] } | Category[]>(
      `/companies/${companyId}/product-categories`,
      { method: "GET", retry: 1, timeout: 10000 }
    )
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r) ? r : Array.isArray((r as any)?.categories) ? (r as any).categories : [];
        setCategories(list.map((c: any) => ({ id: String(c.id), name: String(c.name || "") })));
      })
      .catch((e) => {
        console.log("[StudioNewProductWizard] Erro ao carregar categorias", e);
        // Nao bloqueia: usuario pode criar produto sem categoria
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, companyId]);

  // ── Validacao step 1 ────────────────────────────────────
  const nameValid = name.trim().length >= 2;
  const priceNum = parseFloat(price.replace(",", "."));
  const priceValid = !isNaN(priceNum) && priceNum > 0;
  const canSubmitStep1 = nameValid && priceValid && !submitting;

  // ── Upload de imagem (web) ──────────────────────────────
  async function handlePickImage() {
    if (Platform.OS !== "web") {
      toast.error("Upload do dispositivo so na versao web por enquanto. Cole uma URL publica.");
      return;
    }
    const file = await pickFileWeb("image/*");
    if (!file) return;
    setUploadingImage(true);
    try {
      const { base64, content_type } = await fileToBase64Web(file);
      const r = await uploadStudioMockup(companyId, {
        content_base64: base64,
        content_type,
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

  // ── Cria categoria nova inline ──────────────────────────
  async function handleCreateCategory() {
    const trimmed = newCategoryName.trim();
    if (trimmed.length < 2) {
      toast.error("Nome da categoria precisa ter pelo menos 2 caracteres");
      return;
    }
    try {
      const r = await request<any>(`/companies/${companyId}/product-categories`, {
        method: "POST",
        body: { name: trimmed },
        retry: 0,
        timeout: 10000,
      });
      const newCat: Category = { id: String(r?.id || r?.category?.id || ""), name: trimmed };
      if (!newCat.id) {
        throw new Error("Backend nao retornou id da categoria");
      }
      setCategories((prev) => [...prev, newCat]);
      setCategoryId(newCat.id);
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      toast.success("Categoria criada");
    } catch (e: any) {
      console.error("[StudioNewProductWizard] Falha criar categoria", e);
      toast.error(e?.message || "Nao foi possivel criar a categoria");
    }
  }

  // ── Submit step 1: cria produto ─────────────────────────
  async function submitStep1(advanceAfter: boolean) {
    if (!canSubmitStep1) return;
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
      if (categoryId) body.category_id = categoryId;
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
        throw new Error("Backend nao retornou id do produto");
      }
      const created: CreatedProduct = {
        id: productId,
        name: name.trim(),
        price: priceNum,
      };
      setCreatedProduct(created);
      toast.success("Produto criado!");

      if (advanceAfter) {
        setStep(2);
      } else {
        // Salvar e fechar — so com basico
        onCreated?.(created);
        onClose();
      }
    } catch (e: any) {
      console.error("[StudioNewProductWizard] Falha criar produto", e);
      toast.error(e?.message || "Erro ao criar produto");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Finalizar wizard ────────────────────────────────────
  function finalize() {
    if (createdProduct) {
      onCreated?.(createdProduct);
    }
    onClose();
  }

  // ── Navegacao steps 2-4 ─────────────────────────────────
  function goNext() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else finalize();
  }
  function goBack() {
    if (step > 1) setStep((s) => s - 1);
  }
  function skipStep() {
    if (step === 2) setDoPersonalizacao(false);
    if (step === 3) setDoFichaTecnica(false);
    if (step === 4) setDoTemplates(false);
    goNext();
  }

  // ── Tamanho do modal: full em mobile, 900px max em desktop
  const isCompact = winWidth < 720;
  const modalWidth = isCompact ? winWidth : Math.min(900, winWidth - 48);
  const modalMaxHeight = isCompact ? winHeight : winHeight - 48;
  const progressPct = (step / TOTAL_STEPS) * 100;

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
          {/* Header sticky com gradient */}
          <StudioGradient
            colors={[t.primary, t.accent]}
            direction="135deg"
            style={styles.header}
          >
            <View style={styles.headerRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeTxt}>
                  {step}/{TOTAL_STEPS}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerEyebrow}>Novo produto</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {STEP_TITLES[step - 1] || ""}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <Icon name="x" size={18} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </StudioGradient>

          {/* Body scrollavel */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {submitting && step === 1 ? (
              <View style={styles.loadingWrap}>
                <StudioLoading variant="spinner" label="Criando produto..." />
              </View>
            ) : (
              <>
                {step === 1 && (
                  <Step1Basico
                    t={t}
                    styles={styles}
                    name={name}
                    setName={setName}
                    description={description}
                    setDescription={setDescription}
                    price={price}
                    setPrice={setPrice}
                    stockQty={stockQty}
                    setStockQty={setStockQty}
                    sku={sku}
                    setSku={setSku}
                    categories={categories}
                    loadingCategories={loadingCategories}
                    categoryId={categoryId}
                    setCategoryId={setCategoryId}
                    showNewCategoryInput={showNewCategoryInput}
                    setShowNewCategoryInput={setShowNewCategoryInput}
                    newCategoryName={newCategoryName}
                    setNewCategoryName={setNewCategoryName}
                    onCreateCategory={handleCreateCategory}
                    imageUrl={imageUrl}
                    setImageUrl={setImageUrl}
                    onPickImage={handlePickImage}
                    uploadingImage={uploadingImage}
                    nameValid={nameValid}
                    priceValid={priceValid}
                  />
                )}

                {step === 2 && (
                  <StepEmbed
                    t={t}
                    styles={styles}
                    question="Este produto aceita personalizacao?"
                    explanation="Defina opcoes que o cliente escolhe na hora do pedido (cor, nome, frase, foto, etc)."
                    yes={doPersonalizacao === true}
                    no={doPersonalizacao === false}
                    onYes={() => setDoPersonalizacao(true)}
                    onNo={() => setDoPersonalizacao(false)}
                    Panel={StudioPersonalizacaoPanel}
                    panelLabel="Painel de personalizacao"
                    productId={createdProduct?.id || ""}
                    companyId={companyId}
                  />
                )}

                {step === 3 && (
                  <StepEmbed
                    t={t}
                    styles={styles}
                    question="Quer cadastrar a ficha tecnica agora?"
                    explanation="A ficha tecnica calcula sua margem automaticamente a partir dos insumos."
                    yes={doFichaTecnica === true}
                    no={doFichaTecnica === false}
                    onYes={() => setDoFichaTecnica(true)}
                    onNo={() => setDoFichaTecnica(false)}
                    Panel={StudioFichaTecnicaPanel}
                    panelLabel="Painel de ficha tecnica"
                    productId={createdProduct?.id || ""}
                    companyId={companyId}
                  />
                )}

                {step === 4 && (
                  <StepEmbed
                    t={t}
                    styles={styles}
                    question="Vincular templates de arte agora?"
                    explanation="Templates ajudam a montar o mockup mais rapido no pedido."
                    yes={doTemplates === true}
                    no={doTemplates === false}
                    onYes={() => setDoTemplates(true)}
                    onNo={() => setDoTemplates(false)}
                    Panel={StudioTemplatesPanel}
                    panelLabel="Painel de templates"
                    productId={createdProduct?.id || ""}
                    companyId={companyId}
                  />
                )}
              </>
            )}
          </ScrollView>

          {/* Footer sticky */}
          <View style={styles.footer}>
            {step === 1 ? (
              <>
                <Pressable
                  style={[styles.btnSec, !canSubmitStep1 && styles.btnDisabled]}
                  onPress={() => submitStep1(false)}
                  disabled={!canSubmitStep1}
                >
                  <Text style={styles.btnSecTxt}>Salvar e fechar</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnPri, !canSubmitStep1 && styles.btnDisabled]}
                  onPress={() => submitStep1(true)}
                  disabled={!canSubmitStep1}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnPriTxt}>Proximo {">"}</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.btnSec} onPress={goBack}>
                  <Text style={styles.btnSecTxt}>{"<"} Voltar</Text>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={styles.btnGhost} onPress={skipStep}>
                    <Text style={styles.btnGhostTxt}>Pular</Text>
                  </Pressable>
                  <Pressable style={styles.btnPri} onPress={goNext}>
                    <Text style={styles.btnPriTxt}>
                      {step === TOTAL_STEPS ? "Finalizar" : "Proximo >"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────
// Step 1 — Basico (componente filho pra manter o pai limpo)
// ───────────────────────────────────────────────────────────
function Step1Basico(props: {
  t: StudioPalette;
  styles: ReturnType<typeof buildStyles>;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  stockQty: string;
  setStockQty: (v: string) => void;
  sku: string;
  setSku: (v: string) => void;
  categories: Category[];
  loadingCategories: boolean;
  categoryId: string;
  setCategoryId: (v: string) => void;
  showNewCategoryInput: boolean;
  setShowNewCategoryInput: (v: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  onCreateCategory: () => void;
  imageUrl: string;
  setImageUrl: (v: string) => void;
  onPickImage: () => void;
  uploadingImage: boolean;
  nameValid: boolean;
  priceValid: boolean;
}) {
  const {
    t,
    styles,
    name,
    setName,
    description,
    setDescription,
    price,
    setPrice,
    stockQty,
    setStockQty,
    sku,
    setSku,
    categories,
    loadingCategories,
    categoryId,
    setCategoryId,
    showNewCategoryInput,
    setShowNewCategoryInput,
    newCategoryName,
    setNewCategoryName,
    onCreateCategory,
    imageUrl,
    setImageUrl,
    onPickImage,
    uploadingImage,
    nameValid,
    priceValid,
  } = props;

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.sectionQuestion}>Comece pelo basico</Text>
      <Text style={styles.sectionHelp}>
        Voce pode pular as proximas etapas e voltar depois. So o nome e o preco sao obrigatorios.
      </Text>

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

      {/* Descricao */}
      <View style={styles.field}>
        <Text style={styles.label}>Descricao</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          placeholder="Detalhes que ajudam o cliente a decidir"
          placeholderTextColor={t.ink4}
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>

      {/* Preco + Estoque */}
      <View style={styles.row2}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Preco (R$) *</Text>
          <TextInput
            style={[styles.input, !priceValid && price.length > 0 && styles.inputError]}
            placeholder="0,00"
            placeholderTextColor={t.ink4}
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9.,]/g, ""))}
            keyboardType="decimal-pad"
          />
          {price.length > 0 && !priceValid && (
            <Text style={styles.errorTxt}>Preco precisa ser maior que zero</Text>
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

      {/* Categoria */}
      <View style={styles.field}>
        <Text style={styles.label}>Categoria</Text>
        {loadingCategories ? (
          <ActivityIndicator color={t.primary} style={{ alignSelf: "flex-start" }} />
        ) : (
          <View style={styles.catWrap}>
            {categories.map((c) => {
              const sel = c.id === categoryId;
              return (
                <Pressable
                  key={c.id}
                  style={[styles.catChip, sel && styles.catChipSel]}
                  onPress={() => setCategoryId(sel ? "" : c.id)}
                >
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
            <Pressable style={styles.btnInlineCreate} onPress={onCreateCategory}>
              <Text style={styles.btnInlineCreateTxt}>Criar</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Foto */}
      <View style={styles.field}>
        <Text style={styles.label}>Foto do produto</Text>
        <View style={styles.row2}>
          <Pressable
            style={[styles.uploadBtn, uploadingImage && { opacity: 0.6 }]}
            onPress={onPickImage}
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
        <Text style={styles.hint}>Ou cole uma URL publica abaixo</Text>
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
            <Text style={styles.imgPreviewCap}>Prevvia da foto</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// Steps 2/3/4 — embed wrapper com pergunta Sim/Nao
// ───────────────────────────────────────────────────────────
function StepEmbed(props: {
  t: StudioPalette;
  styles: ReturnType<typeof buildStyles>;
  question: string;
  explanation: string;
  yes: boolean;
  no: boolean;
  onYes: () => void;
  onNo: () => void;
  Panel: any;
  panelLabel: string;
  productId: string;
  companyId: string;
}) {
  const { t, styles, question, explanation, yes, no, onYes, onNo, Panel, panelLabel, productId, companyId } = props;

  // Se Sim e tem Panel real, renderiza Panel
  if (yes && Panel) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={styles.sectionQuestion}>{question}</Text>
        <Text style={styles.sectionHelp}>{explanation}</Text>
        <View style={styles.panelWrap}>
          <Panel productId={productId} companyId={companyId} />
        </View>
        <Pressable style={styles.linkBtn} onPress={onNo}>
          <Text style={styles.linkBtnTxt}>Mudei de ideia, pular esta etapa</Text>
        </Pressable>
      </View>
    );
  }

  // Se Sim mas Panel nao existe (Sprints paralelas), placeholder defensivo
  if (yes && !Panel) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={styles.sectionQuestion}>{question}</Text>
        <View style={styles.placeholderWrap}>
          <Icon name="alert" size={20} color={t.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.placeholderTitle}>{panelLabel} ainda nao disponivel</Text>
            <Text style={styles.placeholderSub}>
              Este painel sera ativado quando o Sprint correspondente for finalizado. Voce ja pode
              avancar e cadastrar depois.
            </Text>
          </View>
        </View>
        <Pressable style={styles.linkBtn} onPress={onNo}>
          <Text style={styles.linkBtnTxt}>Pular esta etapa</Text>
        </Pressable>
      </View>
    );
  }

  // Estado inicial: 2 cards Sim/Nao
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.sectionQuestion}>{question}</Text>
      <Text style={styles.sectionHelp}>{explanation}</Text>
      <View style={styles.choiceRow}>
        <Pressable style={[styles.choiceCard, styles.choiceYes]} onPress={onYes}>
          <View style={styles.choiceIconYes}>
            <Icon name="check" size={20} color="#fff" />
          </View>
          <Text style={styles.choiceTitle}>Sim, cadastrar agora</Text>
          <Text style={styles.choiceSub}>Continua aqui no wizard</Text>
        </Pressable>
        <Pressable style={[styles.choiceCard, styles.choiceNo]} onPress={onNo}>
          <View style={styles.choiceIconNo}>
            <Icon name="x" size={20} color={t.ink2} />
          </View>
          <Text style={styles.choiceTitle}>Nao, pular</Text>
          <Text style={styles.choiceSub}>Voce pode fazer depois</Text>
        </Pressable>
      </View>
    </View>
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
      // sombra forte pra destacar do backdrop
      ...(Platform.OS === "web"
        ? ({ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" } as any)
        : { elevation: 20 }),
    },

    // ── Header sticky ──────────────────────────────────────
    header: {
      paddingTop: 18,
      paddingBottom: 14,
      paddingHorizontal: 20,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    stepBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.4)",
    },
    stepBadgeTxt: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 13,
      letterSpacing: 0.4,
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
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    progressBar: {
      marginTop: 14,
      height: 5,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: 999,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#fff",
      borderRadius: 999,
    },

    // ── Body ───────────────────────────────────────────────
    body: { flex: 1 },
    bodyContent: { padding: 22, paddingBottom: 12 },
    loadingWrap: { paddingVertical: 40 },

    // ── Step section ──────────────────────────────────────
    sectionQuestion: {
      fontSize: 18,
      fontWeight: "800",
      color: t.ink,
      letterSpacing: -0.3,
    },
    sectionHelp: {
      fontSize: 13,
      color: t.ink3,
      lineHeight: 19,
    },

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

    // ── Choice cards (Sim/Nao) ────────────────────────────
    choiceRow: { flexDirection: "row", gap: 14, marginTop: 6 },
    choiceCard: {
      flex: 1,
      padding: 18,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: "center",
      gap: 10,
      minHeight: 140,
      justifyContent: "center",
    },
    choiceYes: {
      borderColor: t.primary,
      backgroundColor: t.primaryGhost,
    },
    choiceNo: {
      borderColor: t.ink5,
      backgroundColor: t.paperCard,
    },
    choiceIconYes: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    choiceIconNo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.bgSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    choiceTitle: { fontSize: 14, fontWeight: "800", color: t.ink, textAlign: "center" },
    choiceSub: { fontSize: 12, color: t.ink3, textAlign: "center" },

    // ── Painel embed wrapper ──────────────────────────────
    panelWrap: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      backgroundColor: t.paperCard,
      padding: 14,
      minHeight: 200,
    },
    placeholderWrap: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.warningSoft,
      backgroundColor: t.warningSoft,
      alignItems: "flex-start",
    },
    placeholderTitle: { fontSize: 13.5, fontWeight: "800", color: t.warningInk },
    placeholderSub: { fontSize: 12, color: t.warningInk, marginTop: 4, lineHeight: 17 },
    linkBtn: { alignSelf: "flex-start", paddingVertical: 6 },
    linkBtnTxt: { color: t.primary, fontSize: 12.5, fontWeight: "700", textDecorationLine: "underline" },

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
      minWidth: 140,
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
    btnGhost: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: "transparent",
    },
    btnGhostTxt: { color: t.ink3, fontSize: 13, fontWeight: "600" },
    btnDisabled: { opacity: 0.45 },
  });
}

export default StudioNewProductWizard;
