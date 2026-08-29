import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { BarcodeQRSection } from "@/components/BarcodeQRSection";
import { ProductVariationsSection } from "@/components/ProductVariationsSection";
import { ImageUploadSection } from "@/components/ImageUploadSection";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { hexToName } from "@/utils/colorNames";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { useProductCategories } from "@/hooks/useProductCategories";
// D1 (F0): o cadastro passa a usar a ARVORE, no lugar da lista de chips
// de texto. O picker e o mesmo componente do B3, ja testado.
import { CategoryTreePicker, type CategorySelection } from "@/components/catalog/CategoryTreePicker";
import { useCategories } from "@/hooks/useCategories";
import type { Product } from "./types";
import { UNITS } from "./types";
import { suggestNcm, formatNcmDisplay, ncmFamilyByCode, getNcmStatus } from "@/utils/ncm";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#1f2937", "#6b7280", "#92400e",
];

// ============================================================================
// NCM smart: a inferencia mora em utils/ncm.ts.
//
// Estava aqui dentro -- e outra copia, divergente, dentro do DanfeImportModal.
// As duas casavam por substring, entao "botao" virava bota e "blusa social"
// virava sapato de couro. Medido no catalogo da Finesse: 46% das sugestoes
// estavam erradas. O modulo novo casa por token inteiro, usa o substantivo-
// nucleo do nome e aceita a categoria como veto.
// ============================================================================

// Fix 7: helper para inicializar campo mascarado a partir de número
function amountToMask(n: number): string {
  return maskCurrency(String(Math.round(n * 100)));
}

function FormField({ label, required, children, dense }: { label: string; required?: boolean; children: React.ReactNode; dense?: boolean }) {
  return (
    <View style={{ marginBottom: dense ? 0 : 11 }}>
      <Text style={s.label}>{label}{required && <Text style={{ color: Colors.red }}> *</Text>}</Text>
      {children}
    </View>
  );
}

export function AddProductForm({ categories, onSave, onCancel, editProduct }: {
  categories: string[];
  onSave: (p: Product) => void;
  onCancel: () => void;
  editProduct?: Product | null;
}) {
  const isEdit = !!editProduct;
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { categories: managedCategories } = useProductCategories();

  const mergedCategoryList = useMemo(() => {
    const managed = managedCategories.map(c => c.name);
    const managedSet = new Set(managed.map(n => n.toLowerCase()));
    const fromProducts = categories.filter(c => c && !managedSet.has(c.toLowerCase()));
    return [...managed, ...fromProducts];
  }, [managedCategories, categories]);

  const managedColorByName = useMemo(() => {
    const map: Record<string, string | null> = {};
    managedCategories.forEach(c => { map[c.name] = c.color; });
    return map;
  }, [managedCategories]);

  const [name, setName]         = useState(editProduct?.name || "");
  const [code, setCode]         = useState(editProduct?.code || "");
  const [barcode, setBarcode]   = useState(editProduct?.barcode || "");
  const [category, setCategory] = useState(editProduct?.category || mergedCategoryList[0] || "");
  // O chip acima nasce pre-selecionado com o primeiro da lista. Default nao e
  // escolha: sem esta flag, a sugestao de NCM usaria como veto uma categoria
  // que a lojista nunca tocou. No EDIT a categoria salva ja e escolha real.
  const [categoryTouched, setCategoryTouched] = useState(isEdit && !!editProduct?.category);
  // D1: selecao na arvore. `category` (texto) CONTINUA sendo enviado no
  // corpo do POST/PATCH -- e o que a rota de produto grava hoje, e o
  // trigger de dual-write o sobrescreve assim que o vinculo existe.
  // Remover o texto agora quebraria o cadastro em base sem a arvore.
  const [selecao, setSelecao] = useState<CategorySelection>({
    primaryCategoryId: null, alsoInIds: [],
  });
  const { byId: categoriaPorId, tree: arvoreCategorias } = useCategories();
  // Base sem arvore ainda: o fallback de chips continua no ar. Zero
  // categorias na arvore e o estado REAL da maioria das empresas hoje --
  // medido em 18/08: 55 categorias em 3 empresas, e a Davi com nenhuma.
  const temArvore = arvoreCategorias.length > 0;
  // Fix 7: inicializa com máscara de moeda
  const [price, setPrice]       = useState(editProduct ? amountToMask(editProduct.price) : "");
  const [cost, setCost]         = useState(editProduct ? amountToMask(editProduct.cost) : "");
  const [stock, setStock]       = useState(editProduct ? String(editProduct.stock) : "");
  const [minStock, setMinStock] = useState(editProduct ? String(editProduct.minStock) : "");
  const [unit, setUnit]         = useState(editProduct?.unit || "un");
  const [notes, setNotes]       = useState(editProduct?.notes || "");
  // Migration 305 — ficha tecnica. Texto livre: o objetivo e a lojista
  // conseguir escrever "Viscose com elastano" sem esperar uma modelagem
  // de composicao por percentual.
  const [material, setMaterial] = useState((editProduct as any)?.material || "");
  const [medidas, setMedidas]   = useState((editProduct as any)?.medidas || "");
  const [cuidados, setCuidados] = useState((editProduct as any)?.cuidados || "");
  const [color, setColor]       = useState(editProduct?.color || "");
  const [size, setSize]         = useState(editProduct?.size || "");
  // NCM: campo fiscal de 8 dígitos. Strip de não-dígitos no onChangeText e
  // bloqueia salvar se != 8 chars (ou se vazio — vazio é permitido).
  const [ncm, setNcm]           = useState(editProduct?.ncm || "");
  const [newCategory, setNewCategory] = useState("");
  const [showNewCat, setShowNewCat]   = useState(false);

  // Refs pra navegação por setas no scroll de categorias (UX desktop)
  const categoryScrollRef = useRef<any>(null);
  const chipPositionsRef = useRef<Record<string, { x: number; width: number }>>({});

  // Fix 10: estoque sempre aberto no CREATE; no EDIT segue lógica anterior
  const initialShowStock = isEdit
    ? ((parseInt(editProduct?.stock as any) || 0) > 0 || (parseInt(editProduct?.minStock as any) || 0) > 0)
    : true;
  const [showStock, setShowStock] = useState(initialShowStock);

  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);

  useEffect(() => {
    if (!isEdit && !category && mergedCategoryList.length > 0) {
      setCategory(mergedCategoryList[0]);
    }
  }, [isEdit, category, mergedCategoryList]);

  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2 || !company?.id) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingDup(true);
      try {
        const res = await companiesApi.checkDuplicate(company.id, trimmed, editProduct?.id);
        setDuplicates(res.duplicates || []);
      } catch {
        setDuplicates([]);
      } finally {
        setCheckingDup(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [name, company?.id, editProduct?.id]);

  // Sugestão NCM: re-calcula quando o nome (ou a categoria escolhida) muda.
  // Nunca entra sozinha no campo -- quem escreve o valor e o botao "Gerar".
  // Categoria que conta como escolha: no da arvore > categoria nova digitada >
  // chip clicado. Nada disso => null, e a sugestao volta a depender so do nome.
  const categoriaEscolhida = useMemo(() => {
    const no = selecao.primaryCategoryId ? categoriaPorId[selecao.primaryCategoryId] : null;
    if (no) return no.name;
    if (showNewCat && newCategory.trim()) return newCategory.trim();
    return categoryTouched ? category : null;
  }, [selecao.primaryCategoryId, categoriaPorId, showNewCat, newCategory, categoryTouched, category]);

  const ncmSuggestionResult = useMemo(
    () => suggestNcm(name, { category: categoriaEscolhida, material }),
    [name, categoriaEscolhida, material]
  );

  // O botao "Gerar" so acende quando a inferencia tem confianca. Sem sugestao
  // ele fica apagado -- que e o comportamento desejado: NCM errado vai pra nota
  // fiscal, entao nao gerar e melhor que gerar chute.
  const podeGerarNcm = !!ncmSuggestionResult;
  function gerarNcm() {
    if (ncmSuggestionResult) setNcm(ncmSuggestionResult.ncm);
  }

  const { data: variationsData } = useQuery({
    queryKey: ["productVariations", company?.id, editProduct?.id],
    queryFn: () => {
      return import("@/services/productsVariationsApi").then(m =>
        m.productsVariationsApi.get(company!.id, editProduct!.id)
      );
    },
    enabled: isEdit && !!editProduct?.id && !!company?.id,
    staleTime: 30000,
  });
  const hasVariations = !!(variationsData && variationsData.mode !== "none");

  function generateCode() {
    const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "PRD";
    setCode(prefix + "-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0"));
  }

  // Navegação por setas: avança/volta a SELEÇÃO de categoria + scroll automático
  function navigateCategory(direction: "prev" | "next") {
    if (showNewCat) setShowNewCat(false);
    const list = mergedCategoryList;
    if (list.length === 0) return;
    let idx = list.indexOf(category);
    if (idx === -1) idx = 0;
    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= list.length) return;
    const newCat = list[nextIdx];
    setCategory(newCat);
    setCategoryTouched(true);
    const pos = chipPositionsRef.current[newCat];
    if (pos && categoryScrollRef.current?.scrollTo) {
      categoryScrollRef.current.scrollTo({ x: Math.max(0, pos.x - 80), animated: true });
    }
  }

  const currentCategoryIdx = mergedCategoryList.indexOf(category);
  const canPrevCategory = currentCategoryIdx > 0 && !showNewCat;
  const canNextCategory = currentCategoryIdx >= 0 && currentCategoryIdx < mergedCategoryList.length - 1 && !showNewCat;
  const showCategoryArrows = Platform.OS === "web" && mergedCategoryList.length > 1;

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome do produto"); return; }
    if (!price.trim()) { toast.error("Preencha o preço de venda"); return; }
    // NCM: vazio é OK; preenchido tem que ter exatamente 8 dígitos
    if (ncm && ncm.length !== 8) {
      toast.error("NCM deve ter 8 digitos numericos (ou ficar vazio)");
      return;
    }
    // Se o lojista escolheu na arvore, o NOME do no vira o texto legado --
    // assim o produto nasce coerente nos dois modelos, e o vinculo e
    // gravado logo depois pelo estoque.tsx (precisa do id, que so existe
    // apos o create).
    const noEscolhido = selecao.primaryCategoryId ? categoriaPorId[selecao.primaryCategoryId] : null;
    const finalCategory = noEscolhido
      ? noEscolhido.name
      : (showNewCat && newCategory.trim() ? newCategory.trim() : category);
    const parsedPrice = parseInt(unmaskNumber(price) || "0") / 100;
    const parsedCost  = parseInt(unmaskNumber(cost)  || "0") / 100;
    onSave({
      id: editProduct?.id || Date.now().toString(),
      name: name.trim(), code: code.trim() || "---", barcode: barcode.trim(),
      category: finalCategory || "Produtos",
      price: parsedPrice,
      cost: parsedCost,
      stock: parseInt(stock) || 0, minStock: parseInt(minStock) || 0,
      abc: editProduct?.abc || "C", sold30d: editProduct?.sold30d || 0,
      unit, brand: editProduct?.brand || "",
      notes: notes.trim(), color: color || "", size: size.trim(),
      ncm: ncm || "",
      material: material.trim(), medidas: medidas.trim(), cuidados: cuidados.trim(),
      // D1: consumido por handleSaveProduct em estoque.tsx.
      categorySelection: selecao.primaryCategoryId ? selecao : undefined,
    } as any);
  }

  // ===== NCM badge state (cor + label) =====
  const ncmStatus = getNcmStatus(ncm);
  const ncmBadgeStyle = ncmStatus === 'valid' ? s.ncmBadgeValid
                      : ncmStatus === 'partial' ? s.ncmBadgePartial
                      : s.ncmBadgeEmpty;
  const ncmFamilyText = (ncmSuggestionResult && ncm === ncmSuggestionResult.ncm)
    ? ncmSuggestionResult.family
    : (ncmFamilyByCode(ncm) || 'NCM válido');
  const ncmBadgeLabel = ncmStatus === 'valid' ? '✓ OK'
                      : ncmStatus === 'partial' ? `${ncm.length}/8`
                      : 'vazio';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{isEdit ? "Editar produto" : "Adicionar produto"}</Text>
        <Pressable onPress={onCancel} style={s.closeBtn}><Text style={s.closeText}>×</Text></Pressable>
      </View>
      <Text style={s.hint}>Campos com * são obrigatórios.</Text>

      <FormField label="Nome do produto" required>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Pomada modeladora" placeholderTextColor={Colors.ink3} />
      </FormField>

      {duplicates.length > 0 && (
        <View style={s.dupBanner}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Text style={s.dupIcon}>!</Text>
            <Text style={s.dupTitle}>
              Voce ja tem {duplicates.length} produto{duplicates.length > 1 ? "s" : ""} com esse nome
            </Text>
          </View>
          <Text style={s.dupSub}>Podem ser variantes (cor/tamanho) do mesmo produto.</Text>
          <View style={{ marginTop: 10, gap: 6 }}>
            {duplicates.slice(0, 5).map((d, i) => (
              <View key={d.id || i} style={s.dupRow}>
                {d.color && <View style={[s.dupColorDot, { backgroundColor: d.color }]} />}
                <Text style={s.dupRowText} numberOfLines={1}>
                  {d.color ? hexToName(d.color) : ""}{d.color && (d.size || d.barcode) ? " · " : ""}
                  {d.size ? "T: " + d.size : ""}{d.size && d.barcode ? " · " : ""}
                  {d.barcode ? d.barcode.slice(-8) : ""}
                </Text>
                <Text style={s.dupStock}>{d.stock_qty} un</Text>
              </View>
            ))}
            {duplicates.length > 5 && <Text style={s.dupMore}>+ {duplicates.length - 5} outros</Text>}
          </View>
          <Text style={s.dupHint}>
            Dica: depois de salvar, use a ferramenta &quot;Unificar duplicatas&quot; na tela de Estoque.
          </Text>
        </View>
      )}

      {isEdit && editProduct?.id && (
        <ImageUploadSection
          productId={editProduct.id}
          currentImageUrl={(editProduct as any)?.image_url || null}
          onImageChange={() => qc.invalidateQueries({ queryKey: ["products", company?.id] })}
        />
      )}

      {/* ===== Identificadores: Código + NCM lado a lado ===== */}
      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Código interno">
            <View style={{ flexDirection: "row", gap: 5 }}>
              <TextInput style={[s.input, { flex: 1 }]} value={code} onChangeText={setCode} placeholder="POM-001" placeholderTextColor={Colors.ink3} />
              <Pressable onPress={generateCode} style={s.miniBtn}><Text style={s.miniBtnText}>Gerar</Text></Pressable>
            </View>
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="NCM (código fiscal)">
            <View style={{ flexDirection: "row", gap: 5 }}>
              <View style={{ flex: 1, position: "relative" as any }}>
                <TextInput
                  style={[s.input, { paddingRight: 46 }]}
                  value={ncm}
                  onChangeText={(v) => setNcm(v.replace(/\D/g, "").slice(0, 8))}
                  placeholder="00000000"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="number-pad"
                  maxLength={8}
                />
                <View style={[s.ncmBadge, ncmBadgeStyle]} pointerEvents="none">
                  <Text style={[s.ncmBadgeText,
                    ncmStatus === 'valid' && { color: Colors.green },
                    ncmStatus === 'partial' && { color: Colors.amber },
                    ncmStatus === 'empty' && { color: Colors.ink3 },
                  ]}>{ncmBadgeLabel}</Text>
                </View>
              </View>
              <Pressable
                onPress={gerarNcm}
                disabled={!podeGerarNcm}
                style={[s.miniBtn, !podeGerarNcm && s.miniBtnOff]}
                accessibilityLabel="Gerar NCM a partir do nome do produto"
              >
                <Text style={[s.miniBtnText, !podeGerarNcm && s.miniBtnTextOff]}>Gerar</Text>
              </Pressable>
            </View>
            {/* Hint contextual abaixo */}
            <Text style={s.ncmHint}>
              {ncmStatus === 'empty' && (ncmSuggestionResult
                ? <Text>
                    Pelo nome: <Text style={s.ncmHintStrong}>{ncmSuggestionResult.label}</Text>
                    {' '}· <Text style={s.ncmHintCode}>{formatNcmDisplay(ncmSuggestionResult.ncm)}</Text>. Toque em Gerar.
                  </Text>
                : '8 digitos. Necessário pra emitir nota fiscal.')}
              {ncmStatus === 'partial' && (
                <Text style={{ color: Colors.red }}>Faltam {8 - ncm.length} digito{8 - ncm.length > 1 ? 's' : ''}.</Text>
              )}
              {ncmStatus === 'valid' && (
                <Text style={{ color: Colors.green }}>
                  ✓ {ncmFamilyText}
                </Text>
              )}
            </Text>
          </FormField>
        </View>
      </View>

      <FormField label="Unidade">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 4 }}>
          {UNITS.map(u => (
            <Pressable key={u} onPress={() => setUnit(u)} style={[s.chip, unit === u && s.chipActive]}>
              <Text style={[s.chipText, unit === u && s.chipTextActive]}>{u}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </FormField>

      <FormField label="Categoria">
        {/* D1 (F0): a arvore e o caminho principal. Em modo EDICAO o
            picker recebe o productId e grava o vinculo sozinho; em modo
            CRIACAO ele so seleciona, e o vinculo e gravado apos o create
            (o id ainda nao existe). Ver handleSaveProduct em estoque.tsx.

            A lista de chips abaixo SOBREVIVE como fallback: enquanto a
            empresa nao tiver arvore (as migrations 257-260 sao recentes e
            a maioria das bases ainda esta em texto), o cadastro nao pode
            ficar sem campo de categoria. Some sozinha quando a arvore
            existir. */}
        <CategoryTreePicker
          value={selecao}
          onChange={setSelecao}
          productId={editProduct?.id}
        />

        {temArvore ? null : (
        <>
        <View style={s.categoryRow}>
          {showCategoryArrows && (
            <Pressable
              onPress={() => navigateCategory("prev")}
              disabled={!canPrevCategory}
              style={[s.catArrow, !canPrevCategory && s.catArrowDisabled]}
              accessibilityLabel="Categoria anterior"
            >
              <Text style={[s.catArrowText, !canPrevCategory && s.catArrowTextDisabled]}>‹</Text>
            </Pressable>
          )}
          <ScrollView
            ref={categoryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: "row", gap: 5 }}
            style={{ flex: 1 }}
          >
            {mergedCategoryList.map(c => {
              const selected = category === c && !showNewCat;
              const chipColor = managedColorByName[c];
              return (
                <Pressable
                  key={c}
                  onLayout={(e) => {
                    const { x, width } = e.nativeEvent.layout;
                    chipPositionsRef.current[c] = { x, width };
                  }}
                  onPress={() => { setCategory(c); setCategoryTouched(true); setShowNewCat(false); }}
                  style={[s.chip, selected && s.chipActive]}
                >
                  {chipColor ? <View style={[s.chipDot, { backgroundColor: chipColor }]} /> : null}
                  <Text style={[s.chipText, selected && s.chipTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setShowNewCat(true)} style={[s.chip, showNewCat && s.chipActive]}>
              <Text style={[s.chipText, showNewCat && s.chipTextActive]}>+ Nova</Text>
            </Pressable>
          </ScrollView>
          {showCategoryArrows && (
            <Pressable
              onPress={() => navigateCategory("next")}
              disabled={!canNextCategory}
              style={[s.catArrow, !canNextCategory && s.catArrowDisabled]}
              accessibilityLabel="Próxima categoria"
            >
              <Text style={[s.catArrowText, !canNextCategory && s.catArrowTextDisabled]}>›</Text>
            </Pressable>
          )}
        </View>
        {showNewCat && <TextInput style={[s.input, { marginTop: 6 }]} value={newCategory} onChangeText={setNewCategory} placeholder="Nome da nova categoria" placeholderTextColor={Colors.ink3} autoFocus />}
        </>
        )}
        <Text style={s.categoryHint}>
          {temArvore
            ? "Organize a arvore em Catalogo > Organizar catalogo."
            : "Gerencie suas categorias pelo botao \"Categorias\" na tela de Estoque."}
        </Text>
      </FormField>

      <View style={s.divider} />

      {/* Fix 7: campos de preço/custo com máscara de moeda */}
      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <FormField label="Preço de venda" required>
            <TextInput
              style={s.input}
              value={price}
              onChangeText={v => setPrice(maskCurrency(v))}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
            />
          </FormField>
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Custo">
            <TextInput
              style={s.input}
              value={cost}
              onChangeText={v => setCost(maskCurrency(v))}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
            />
          </FormField>
        </View>
      </View>

      {/* Fix 10: estoque aberto por padrão no create */}
      {!hasVariations && (
        <>
          <Pressable onPress={() => setShowStock(!showStock)} style={s.stockToggle}>
            <View style={{ flex: 1 }}>
              <Text style={s.stockToggleTitle}>Estoque {isEdit ? "" : "inicial (opcional)"}</Text>
              <Text style={s.stockToggleSub}>
                {showStock
                  ? "Informe a quantidade em maos e o nível mínimo para alertas."
                  : "Você pode dar entrada de estoque depois, a qualquer momento."}
              </Text>
            </View>
            <Icon name={showStock ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />
          </Pressable>

          {showStock && (
            <View style={s.row2}>
              <View style={{ flex: 1 }}><FormField label="Qtd. atual"><TextInput style={s.input} value={stock} onChangeText={setStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></FormField></View>
              <View style={{ flex: 1 }}><FormField label="Estoque mínimo"><TextInput style={s.input} value={minStock} onChangeText={setMinStock} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></FormField></View>
            </View>
          )}
        </>
      )}

      {hasVariations && (
        <View style={s.stockVariantHint}>
          <Icon name="info" size={13} color={Colors.violet3} />
          <Text style={s.stockVariantHintText}>
            Estoque controlado por variacoes abaixo. Total atual: {variationsData?.total_variants || 0} variantes.
          </Text>
        </View>
      )}

      <View style={s.divider} />

      {/* Fix 8: campo de cor usando <input type="color"> inline no web (não bloqueia) */}
      {!isEdit && (
        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <FormField label="Cor principal (opcional)">
              {Platform.OS === "web" ? (
                <View style={[s.colorRow, { position: "relative" as any }]}>
                  <View style={[s.colorSwatch, { backgroundColor: color || Colors.bg4, borderStyle: color ? "solid" : "dashed" }]} />
                  <Text style={[s.colorText, !color && { color: Colors.ink3 }]}>
                    {color ? (hexToName(color) + " · " + color) : "Toque para escolher"}
                  </Text>
                  <input
                    type="color"
                    value={color || "#6d28d9"}
                    onChange={(e: any) => setColor(e.target.value)}
                    style={{
                      position: "absolute", inset: 0, opacity: 0,
                      cursor: "pointer", width: "100%", height: "100%", border: "none",
                    } as any}
                  />
                  {color && (
                    <Pressable onPress={(e: any) => { e?.stopPropagation?.(); setColor(""); }}
                      style={{ zIndex: 2 }}>
                      <Text style={{ fontSize: 11, color: Colors.red }}>Remover</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {PRESET_COLORS.map(c => (
                      <Pressable key={c} onPress={() => setColor(color === c ? "" : c)}
                        style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c, borderWidth: color === c ? 3 : 1.5, borderColor: color === c ? Colors.violet : Colors.border }} />
                    ))}
                  </View>
                  {color && <Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 6 }}>{hexToName(color)} · {color}</Text>}
                </View>
              )}
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Tamanho (opcional)">
              <TextInput style={s.input} value={size} onChangeText={setSize} placeholder="P, M, G, 500ml..." placeholderTextColor={Colors.ink3} />
            </FormField>
          </View>
        </View>
      )}

      {/* Fix 10: aviso de variantes mais visível no create */}
      {!isEdit && (
        <View style={s.variantsHintBox}>
          <Icon name="layers" size={14} color={Colors.violet3} />
          <View style={{ flex: 1 }}>
            <Text style={s.variantsHintTitle}>Cores e tamanhos com estoque próprio</Text>
            <Text style={s.variantsHintDesc}>Salve o produto para liberar o cadastro de variantes com estoque individual por cor/tamanho.</Text>
          </View>
        </View>
      )}

      <BarcodeQRSection
        code={barcode}
        productName={name}
        price={parseInt(unmaskNumber(price) || "0") / 100}
        onCodeChange={setBarcode}
      />

      {isEdit && editProduct?.id && (
        <ProductVariationsSection
          productId={editProduct.id}
          productName={name}
          parentColor={editProduct.color || null}
          parentSize={editProduct.size || null}
          parentStock={editProduct.stock || null}
        />
      )}

      {/* O campo sempre existiu e sempre foi pra `products.description`,
          que a loja publica ja lia. Mas o rotulo nao dizia isso: na
          Finesse, 1 produto em 500 tem descricao. Quem preenche um campo
          chamado so "Descrição (opcional)" no fim de um formulario longo
          nao sabe que aquilo vira texto de vitrine. */}
      <FormField label="Descrição — aparece na página do produto">
        <TextInput
          style={[s.input, { minHeight: 76, textAlignVertical: "top" }]}
          value={notes}
          onChangeText={setNotes}
          placeholder={"Do que é feito, como veste, como cuidar. Ex.: Viscose com elastano, modelagem soltinha, lavar à mão."}
          placeholderTextColor={Colors.ink3}
          multiline
          numberOfLines={4}
        />
        <Text style={s.hint}>
          É o que o cliente lê antes de decidir. Sem isso, a página mostra só a foto e o preço.
        </Text>
      </FormField>

      {/* Migration 305 — ficha tecnica. Sao as tres perguntas que sobram
          depois da foto e do preco: de que e feito, quanto mede, como
          cuidar. Cada linha so aparece na loja se estiver preenchida —
          "Material: —" e pior que ficha nenhuma. */}
      <FormField label="Material">
        <TextInput style={s.input} value={material} onChangeText={setMaterial}
          placeholder="Ex.: Viscose com elastano" placeholderTextColor={Colors.ink3} />
      </FormField>

      <FormField label="Medidas">
        <TextInput style={s.input} value={medidas} onChangeText={setMedidas}
          placeholder="Ex.: Busto 92cm, comprimento 105cm" placeholderTextColor={Colors.ink3} />
      </FormField>

      <FormField label="Cuidados">
        <TextInput style={s.input} value={cuidados} onChangeText={setCuidados}
          placeholder="Ex.: Lavar à mão, não usar secadora" placeholderTextColor={Colors.ink3} />
        <Text style={s.hint}>
          Os três aparecem numa ficha na página do produto. Deixe em branco o que não se aplica.
        </Text>
      </FormField>

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={s.saveBtn}>
          <Text style={s.saveText}>{isEdit ? "Atualizar produto" : "Salvar produto"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  hint: { fontSize: 11, color: Colors.ink3, marginBottom: 12 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 4, letterSpacing: 0.2 },
  input: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: Colors.ink },
  row2: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 10 : 0, marginBottom: 11 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  categoryHint: { fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" as any },
  ncmHint: { fontSize: 10, color: Colors.ink3, marginTop: 4, lineHeight: 14 },
  ncmHintStrong: { color: Colors.violet3, fontWeight: "700" },
  ncmHintCode: { color: Colors.violet3, fontWeight: "700", fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace" },
  // ===== NCM badge dentro do input =====
  ncmBadge: { position: "absolute" as any, right: 6, top: 6, bottom: 6, paddingHorizontal: 7, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  ncmBadgeEmpty: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  ncmBadgePartial: { backgroundColor: "rgba(245,158,11,0.15)" },
  ncmBadgeValid: { backgroundColor: "rgba(34,197,94,0.18)" },
  ncmBadgeText: { fontSize: 10, fontWeight: "700" },
  // ===== Banner sugestão NCM =====
  // ===== Setas de navegação no scroll horizontal de categorias =====
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  catArrow: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  catArrowDisabled: { opacity: 0.35 },
  catArrowText: { fontSize: 16, color: Colors.violet3, fontWeight: "700", lineHeight: 16, marginTop: -2 },
  catArrowTextDisabled: { color: Colors.ink3 },
  miniBtn: { backgroundColor: Colors.violetD, borderRadius: 7, paddingHorizontal: 10, justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  miniBtnText: { fontSize: 10.5, color: Colors.violet3, fontWeight: "600" },
  miniBtnOff: { backgroundColor: Colors.bg3, borderColor: Colors.border },
  miniBtnTextOff: { color: Colors.ink3 },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 8 },
  colorSwatch: { width: 30, height: 30, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.border },
  colorText: { fontSize: 12, color: Colors.ink, fontWeight: "500", flex: 1 },
  // Estoque colapsável
  stockToggle: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg4, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  stockToggleTitle: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  stockToggleSub: { fontSize: 10.5, color: Colors.ink3, marginTop: 2, lineHeight: 14 },
  stockVariantHint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 8, padding: 9, borderWidth: 1, borderColor: Colors.border2, marginBottom: 8 },
  stockVariantHintText: { fontSize: 11, color: Colors.violet3, flex: 1, lineHeight: 14, fontWeight: "500" },
  // Aviso de variantes
  variantsHintBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border2, marginBottom: 12 },
  variantsHintTitle: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700", marginBottom: 2 },
  variantsHintDesc: { fontSize: 10.5, color: Colors.ink3, lineHeight: 14 },
  footer: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  saveText: { fontSize: 12.5, color: "#fff", fontWeight: "700" },
  // Duplicatas
  dupBanner: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    marginTop: -4,
  },
  dupIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#f59e0b", color: "#fff",
    fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 20,
  },
  dupTitle: { fontSize: 12.5, fontWeight: "700", color: "#78350f", flex: 1 },
  dupSub: { fontSize: 11, color: "#92400e", lineHeight: 15 },
  dupRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
  },
  dupColorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  dupRowText: { fontSize: 11, color: "#78350f", flex: 1 },
  dupStock: { fontSize: 10.5, color: "#92400e", fontWeight: "600" },
  dupMore: { fontSize: 10.5, color: "#92400e", fontStyle: "italic", paddingLeft: 8 },
  dupHint: { fontSize: 10.5, color: "#78350f", marginTop: 8, fontStyle: "italic", lineHeight: 14 },
});

export default AddProductForm;
