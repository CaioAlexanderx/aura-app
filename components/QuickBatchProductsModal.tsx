import { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, Modal, Pressable, StyleSheet, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productsBatchApi, type BatchProductInput } from "@/services/productsBatchApi";
import { nameToHex, hexToName } from "@/utils/colorNames";

// ============================================================
// AURA. -- QuickBatchProductsModal (lote de produtos gerais)
//
// Modal com textarea onde o usuario cola/digita 1 produto por linha.
// Separadores aceitos: pipe "|", tab (paste de planilha OU Tab digitado), ";".
//
// Modos de entrada:
//
// 1) POSICIONAL (default, compativel com legacy):
//    Nome | Preco | Tamanho | Cor | Estoque
//    Camiseta Branca | 49,90 | M | branca | 10
//
// 2) HEADER MAPEADO (recomendado pra paste de Excel/Sheets):
//    Primeira linha define colunas. Aceita "#" prefix opcional.
//    Aliases: nome/produto, preco/valor, tamanho/tam, cor, estoque/qtd, categoria.
//    Permite ordem livre e omitir colunas.
//    Ex:
//      # nome ; estoque ; preco
//      Camiseta Branca ; 15 ; 49,90
//
// 3) SECTION MARKERS [Categoria] pra agrupar:
//    [Bermudas]
//    Bermuda slim preta | 49,90 | M | preto | 5
//    [Camisetas]
//    Camiseta basica | 29,90 | M | branca | 10
//    Sem bracket -> usa o picker global como default.
//
// 4) EXPANSAO {a,b,c} pra variantes:
//    Camiseta basica | 49,90 | {P,M,G,GG} | preto | 5
//    -> 4 linhas (uma por tamanho), 5 unidades cada.
//    {a,b} em size E em color -> produto cartesiano.
//
// 5) INFERENCIA FUZZY quando colunas faltam (sem header):
//    "Camiseta | 49,90" -> infere Nome + Preco
//    "Camiseta | 49,90 | 10" -> infere Nome + Preco + Estoque (fallback posicional)
//
// Atalhos (web):
//    Tab dentro do textarea insere "\t" (separador) -- nao muda foco.
//    Shift+Tab continua mudando foco normalmente.
//    Ctrl/Cmd + Enter submete.
//
// Regra: permite duplicados, soh avisa no final ("X duplicados criados").
// Max: 200 linhas por lote.
// ============================================================

type ColumnKey = 'name' | 'price' | 'size' | 'color' | 'stock' | 'category' | 'cost';

type ParsedRow = {
  line: string;          // linha original (pra debug)
  name: string;
  price: number;
  size: string | null;
  colorInput: string | null;   // o que o user digitou
  colorHex: string | null;     // convertido pelo nameToHex
  stock: number;
  categoryOverride: string | null;  // null = usa default do picker
  isValid: boolean;
  errorMsg?: string;
  expandedFromIdx?: number;   // se veio de expansao {a,b}, indice da linha original
};

// Aliases de cabecalho -> coluna canonica
var HEADER_ALIASES: Record<string, ColumnKey> = {
  // name
  'nome': 'name', 'name': 'name', 'produto': 'name', 'descricao': 'name', 'descrição': 'name', 'item': 'name',
  // price
  'preco': 'price', 'preço': 'price', 'price': 'price', 'valor': 'price', 'venda': 'price',
  // size
  'tamanho': 'size', 'size': 'size', 'tam': 'size', 'numero': 'size', 'número': 'size', 'medida': 'size',
  // color
  'cor': 'color', 'color': 'color', 'cores': 'color',
  // stock
  'estoque': 'stock', 'stock': 'stock', 'qtd': 'stock', 'quantidade': 'stock', 'qty': 'stock', 'un': 'stock', 'unidades': 'stock',
  // category override
  'categoria': 'category', 'category': 'category', 'cat': 'category',
  // cost (future-proof, ignorado por enquanto)
  'custo': 'cost', 'cost': 'cost', 'cost_price': 'cost',
};

var POSITIONAL_ORDER: ColumnKey[] = ['name', 'price', 'size', 'color', 'stock'];

// Detecta separador. Preferencia: tab > pipe > semicolon
function detectSeparator(text: string): string {
  const firstNonEmpty = text.split(/\r?\n/).find(function(l) { return l.trim() && !l.trim().startsWith('['); });
  if (!firstNonEmpty) return "|";
  if (firstNonEmpty.includes("\t")) return "\t";
  if (firstNonEmpty.includes("|")) return "|";
  if (firstNonEmpty.includes(";")) return ";";
  return "|";
}

function parseBrlNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function parseIntSafe(s: string): number {
  const n = parseInt(String(s || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Detecta se primeira linha eh um cabecalho mapeado
function isHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return true;
  // Heuristica: >=50% das partes match algum alias
  const cleaned = trimmed.replace(/^#\s*/, '');
  const sep = detectSeparator(cleaned);
  const parts = cleaned.split(sep).map(function(p) { return p.trim().toLowerCase(); }).filter(Boolean);
  if (parts.length < 2) return false;
  const recognized = parts.filter(function(p) { return HEADER_ALIASES[p]; }).length;
  return recognized / parts.length >= 0.5;
}

function parseHeader(line: string): ColumnKey[] {
  const cleaned = line.replace(/^#\s*/, '').trim();
  const sep = detectSeparator(cleaned);
  return cleaned.split(sep)
    .map(function(p) {
      const key = p.trim().toLowerCase();
      return HEADER_ALIASES[key] || null;
    })
    .map(function(c) { return c as ColumnKey; });
}

// [Categoria] no comeco da linha (sozinho)
function parseSectionMarker(line: string): string | null {
  const m = line.trim().match(/^\[([^\]]+)\]$/);
  return m ? m[1].trim() : null;
}

// {a,b,c} -> ["a","b","c"]; se nao tem chaves, retorna [value]
function expandPattern(value: string | null): string[] {
  if (!value) return [""];
  const m = value.match(/^\{([^}]+)\}$/);
  if (m) {
    return m[1].split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  }
  return [value];
}

// Cartesian product de N arrays
function crossProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(function(acc, arr) {
    const next: T[][] = [];
    acc.forEach(function(a) {
      arr.forEach(function(b) {
        next.push(a.concat([b]));
      });
    });
    return next;
  }, [[]]);
}

// Inferencia fuzzy quando nao tem header (posicional default)
function inferPositional(parts: string[]): ColumnKey[] {
  if (parts.length === 1) return ['name'];
  if (parts.length === 2) {
    // 2 colunas: Nome + Preco (mais comum)
    return ['name', 'price'];
  }
  if (parts.length === 3) {
    // 3 colunas: Nome + Preco + Estoque (heuristica comum em lojista pequeno)
    // se a 3a parece nao-numerica, usa Nome+Preco+Tamanho
    const third = parts[2].trim();
    const isNumeric = /^\d+$/.test(third);
    return isNumeric ? ['name', 'price', 'stock'] : ['name', 'price', 'size'];
  }
  // 4+ colunas: posicional padrao
  return POSITIONAL_ORDER.slice(0, parts.length);
}

function buildRowFromFields(
  rawLine: string,
  fields: Partial<Record<ColumnKey, string>>,
  sectionCategory: string | null,
  pickerDefault: string,
  parentIdx: number,
  isExpanded: boolean
): ParsedRow {
  const name = (fields.name || '').trim();
  const sizeRaw = fields.size || null;
  const colorRaw = fields.color || null;
  const colorHex = colorRaw ? nameToHex(colorRaw) : null;
  const explicitCat = (fields.category || '').trim();
  // Override de categoria: explicit > section. Picker default fica pro payload
  let categoryOverride: string | null = null;
  if (explicitCat && explicitCat !== pickerDefault) categoryOverride = explicitCat;
  else if (sectionCategory && sectionCategory !== pickerDefault) categoryOverride = sectionCategory;

  return {
    line: rawLine,
    name: name,
    price: parseBrlNumber(fields.price || ''),
    size: sizeRaw || null,
    colorInput: colorRaw || null,
    colorHex: colorHex,
    stock: parseIntSafe(fields.stock || ''),
    categoryOverride: categoryOverride,
    isValid: !!name,
    errorMsg: !name ? 'Nome vazio' : undefined,
    expandedFromIdx: isExpanded ? parentIdx : undefined,
  };
}

function parseRows(text: string, pickerDefault: string): ParsedRow[] {
  const lines = text.split(/\r?\n/);
  const sep = detectSeparator(text);
  let headerCols: ColumnKey[] | null = null;
  let currentSection: string | null = null;
  const rows: ParsedRow[] = [];
  let dataLineIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Header (so antes da primeira linha de dados)
    if (rows.length === 0 && headerCols === null && isHeaderLine(trimmed)) {
      headerCols = parseHeader(trimmed);
      continue;
    }

    // Section marker
    const sectionCat = parseSectionMarker(trimmed);
    if (sectionCat !== null) {
      currentSection = sectionCat;
      continue;
    }

    // Linha de dados
    const parts = trimmed.split(sep).map(function(p) { return p.trim(); });
    const columns = headerCols || inferPositional(parts);

    // Monta fields posicionalmente
    const fields: Partial<Record<ColumnKey, string>> = {};
    columns.forEach(function(col, idx) {
      if (col && parts[idx] !== undefined) fields[col] = parts[idx];
    });

    // Expansao {a,b} em size e color
    const sizes = expandPattern(fields.size || null);
    const colors = expandPattern(fields.color || null);
    const combos = crossProduct<string>([sizes, colors]);
    const isExpanded = combos.length > 1;

    combos.forEach(function(combo) {
      const localFields: Partial<Record<ColumnKey, string>> = Object.assign({}, fields);
      localFields.size = combo[0] || undefined;
      localFields.color = combo[1] || undefined;
      rows.push(buildRowFromFields(trimmed, localFields, currentSection, pickerDefault, dataLineIdx, isExpanded));
    });

    dataLineIdx++;
  }

  return rows;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  allCategories: string[];
};

const MAX_ROWS = 200;
const EXAMPLE_POSITIONAL = "Camiseta Branca | 49,90 | P | Branca | 15\nCamiseta Branca | 49,90 | M | Branca | 10\nTenis Esportivo | 199,90 | 38 | Preto | 5\nBone Aba Reta | 39,90 |  | Preto | 20";
const EXAMPLE_EXPANSION = "Camiseta basica | 49,90 | {P,M,G,GG} | preto | 5\nBermuda slim | 79,90 | {38,40,42} | {preto,cinza} | 3";
const EXAMPLE_SECTIONS = "[Camisetas]\nCamiseta Branca | 49,90 | M | branca | 10\nCamiseta Preta | 49,90 | M | preto | 8\n\n[Bermudas]\nBermuda slim | 79,90 | M | preto | 5";

export function QuickBatchProductsModal({ visible, onClose, allCategories }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(function() { return allCategories[0] || "Produtos"; });
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [activeHelp, setActiveHelp] = useState<'basic' | 'expansion' | 'sections'>('basic');
  const textRef = useRef<TextInput | null>(null);

  const parsed = useMemo(function() { return text.trim() ? parseRows(text, category) : []; }, [text, category]);
  const validRows = useMemo(function() { return parsed.filter(function(r) { return r.isValid; }); }, [parsed]);
  const invalidCount = parsed.length - validRows.length;
  const expandedCount = useMemo(function() {
    return validRows.filter(function(r) { return r.expandedFromIdx !== undefined; }).length;
  }, [validRows]);
  const overrideCount = useMemo(function() {
    return validRows.filter(function(r) { return r.categoryOverride !== null; }).length;
  }, [validRows]);
  const exceedsMax = validRows.length > MAX_ROWS;

  const mut = useMutation({
    mutationFn: function() {
      if (!company?.id) throw new Error("Sem empresa");
      const payload: BatchProductInput[] = validRows.map(function(r) {
        return {
          name: r.name,
          price: r.price,
          stock_qty: r.stock,
          size: r.size,
          color: r.colorHex,
          category: r.categoryOverride || category || "Produtos",
        };
      });
      return productsBatchApi.batchCreate(company.id, payload);
    },
    onSuccess: function(res) {
      qc.invalidateQueries({ queryKey: ["products", company?.id] });
      qc.invalidateQueries({ queryKey: ["duplicateGroups", company?.id] });
      const dup = res.duplicates > 0
        ? " (" + res.duplicates + " " + (res.duplicates === 1 ? "duplicado criado" : "duplicados criados") + ")"
        : "";
      toast.success(res.total_created + " " + (res.total_created === 1 ? "produto adicionado" : "produtos adicionados") + dup);
      setText("");
      onClose();
    },
    onError: function(err: any) {
      const msg = err?.data?.error || err?.message || "Erro ao criar produtos";
      toast.error(msg);
    },
  });

  function handleClose() {
    if (mut.isPending) return;
    setText("");
    onClose();
  }

  function handleSubmit() {
    if (validRows.length === 0) {
      toast.error("Digite pelo menos um produto (nome obrigatorio)");
      return;
    }
    if (exceedsMax) {
      toast.error("Maximo de " + MAX_ROWS + " produtos por lote. Voce tem " + validRows.length + ".");
      return;
    }
    mut.mutate();
  }

  function loadExample(which: 'basic' | 'expansion' | 'sections') {
    setActiveHelp(which);
    if (which === 'basic') setText(EXAMPLE_POSITIONAL);
    else if (which === 'expansion') setText(EXAMPLE_EXPANSION);
    else setText(EXAMPLE_SECTIONS);
  }

  // -----------------------------------------------------------
  // Tab intercept + Ctrl+Enter (web only)
  // RN Web encaminha o evento keydown via prop onKeyPress no TextInput.
  // Pra Tab funcionar (inserir \t em vez de mudar foco), usamos ref pro
  // DOM textarea direto e attach keydown listener no useEffect.
  // -----------------------------------------------------------
  useEffect(function() {
    if (Platform.OS !== 'web' || !visible) return;
    const inputNode = textRef.current as any;
    if (!inputNode) return;
    // RN Web expoe o DOM node em `_node` (RN versoes antigas) ou no proprio ref
    const domNode: HTMLTextAreaElement | null = inputNode._node || inputNode;
    if (!domNode || !domNode.addEventListener) return;

    function onKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd + Enter -> submit
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      // Tab (sem Shift) -> insere \t na posicao do cursor
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart || 0;
        const end = target.selectionEnd || 0;
        const newValue = target.value.substring(0, start) + '\t' + target.value.substring(end);
        // RN Web nao deixa setar value direto -- precisa disparar input event
        // Forca via setText + reposiciona cursor no proximo tick
        setText(newValue);
        requestAnimationFrame(function() {
          if (domNode) {
            domNode.selectionStart = start + 1;
            domNode.selectionEnd = start + 1;
          }
        });
      }
    }

    domNode.addEventListener('keydown', onKeyDown);
    return function() {
      domNode.removeEventListener('keydown', onKeyDown);
    };
    // handleSubmit muda quando validRows muda -- precisa do deps pra capturar versao atual
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, validRows.length, exceedsMax, mut.isPending]);

  // Activa o exemplo basico no placeholder (sem polluir o state)
  const placeholder = "Cole ou digite aqui...\n\nFormato simples:\n" + EXAMPLE_POSITIONAL;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Adicionar produtos em lote</Text>
              <Text style={s.subtitle}>Cole ou digite varios produtos de uma vez</Text>
            </View>
            <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={8}>
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            {/* Help tabs */}
            <View style={s.helpTabs}>
              <Pressable onPress={function() { setActiveHelp('basic'); }}
                style={[s.helpTab, activeHelp === 'basic' && s.helpTabActive]}>
                <Text style={[s.helpTabText, activeHelp === 'basic' && s.helpTabTextActive]}>Basico</Text>
              </Pressable>
              <Pressable onPress={function() { setActiveHelp('expansion'); }}
                style={[s.helpTab, activeHelp === 'expansion' && s.helpTabActive]}>
                <Text style={[s.helpTabText, activeHelp === 'expansion' && s.helpTabTextActive]}>Variantes</Text>
              </Pressable>
              <Pressable onPress={function() { setActiveHelp('sections'); }}
                style={[s.helpTab, activeHelp === 'sections' && s.helpTabActive]}>
                <Text style={[s.helpTabText, activeHelp === 'sections' && s.helpTabTextActive]}>Categorias</Text>
              </Pressable>
            </View>

            {/* Help content */}
            <View style={s.infoBox}>
              <Icon name="info" size={14} color={Colors.violet3} />
              <View style={{ flex: 1 }}>
                {activeHelp === 'basic' && (
                  <>
                    <Text style={s.infoTitle}>Nome | Preco | Tamanho | Cor | Estoque</Text>
                    <Text style={s.infoText}>
                      So o nome eh obrigatorio. Use "|", TAB ou ";" como separador.
                      {Platform.OS === 'web' ? " A tecla Tab insere separador (Shift+Tab muda foco)." : ""}
                    </Text>
                    <View style={s.exampleBox}>
                      <Text style={s.exampleText}>{EXAMPLE_POSITIONAL}</Text>
                    </View>
                    <Pressable onPress={function() { loadExample('basic'); }} style={s.exampleLoadBtn}>
                      <Text style={s.exampleLoadText}>Carregar exemplo</Text>
                    </Pressable>
                  </>
                )}
                {activeHelp === 'expansion' && (
                  <>
                    <Text style={s.infoTitle}>Expandir tamanhos/cores: {`{P,M,G,GG}`}</Text>
                    <Text style={s.infoText}>
                      Use chaves pra gerar varias linhas de uma vez. Combina tamanho x cor.
                    </Text>
                    <View style={s.exampleBox}>
                      <Text style={s.exampleText}>{EXAMPLE_EXPANSION}</Text>
                    </View>
                    <Text style={s.infoTextSmall}>{`{P,M,G,GG} = 4 linhas. {P,M,G} x {preto,cinza} = 6 linhas.`}</Text>
                    <Pressable onPress={function() { loadExample('expansion'); }} style={s.exampleLoadBtn}>
                      <Text style={s.exampleLoadText}>Carregar exemplo</Text>
                    </Pressable>
                  </>
                )}
                {activeHelp === 'sections' && (
                  <>
                    <Text style={s.infoTitle}>Agrupar por categoria: [Categoria]</Text>
                    <Text style={s.infoText}>
                      Coloque [Categoria] em uma linha sozinha. Itens abaixo herdam ate o proximo marcador.
                      Tambem aceita primeira linha como cabecalho (ex: "# nome ; preco ; estoque").
                    </Text>
                    <View style={s.exampleBox}>
                      <Text style={s.exampleText}>{EXAMPLE_SECTIONS}</Text>
                    </View>
                    <Pressable onPress={function() { loadExample('sections'); }} style={s.exampleLoadBtn}>
                      <Text style={s.exampleLoadText}>Carregar exemplo</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Categoria padrao */}
            <View style={{ marginBottom: 14 }}>
              <Text style={s.label}>Categoria padrao (linhas sem override)</Text>
              <Pressable onPress={function() { setShowCatPicker(!showCatPicker); }} style={s.catPicker}>
                <Icon name="tag" size={13} color={Colors.violet3} />
                <Text style={s.catPickerText}>{category}</Text>
                <Icon name={showCatPicker ? "chevron_up" : "chevron_down"} size={12} color={Colors.ink3} />
              </Pressable>
              {showCatPicker && (
                <View style={s.catList}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {allCategories.map(function(cat) {
                      return (
                        <Pressable key={cat} onPress={function() { setCategory(cat); setShowCatPicker(false); }}
                          style={[s.catOption, category === cat && s.catOptionActive]}>
                          <Text style={[s.catOptionText, category === cat && { color: Colors.violet3, fontWeight: "700" }]}>{cat}</Text>
                          {category === cat && <Icon name="check" size={12} color={Colors.violet3} />}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Textarea */}
            <View style={{ marginBottom: 12 }}>
              <View style={s.textareaHeader}>
                <Text style={s.label}>Produtos ({validRows.length} valido{validRows.length === 1 ? "" : "s"})</Text>
                {text.length > 0 && (
                  <Pressable onPress={function() { setText(""); }} hitSlop={6}>
                    <Text style={s.clearText}>Limpar</Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                ref={textRef}
                style={s.textarea}
                value={text}
                onChangeText={setText}
                placeholder={placeholder}
                placeholderTextColor={Colors.ink3}
                multiline
                numberOfLines={Platform.OS === "web" ? 10 : 8}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {Platform.OS === 'web' && (
                <Text style={s.hintShortcut}>Tab insere separador  ·  Ctrl/Cmd+Enter envia</Text>
              )}
            </View>

            {/* Stats badge row -- so quando tem item parseado */}
            {parsed.length > 0 && (
              <View style={s.statsRow}>
                <View style={s.statChip}>
                  <Text style={s.statChipText}>{parsed.length} linha{parsed.length === 1 ? "" : "s"}</Text>
                </View>
                {expandedCount > 0 && (
                  <View style={[s.statChip, s.statChipViolet]}>
                    <Icon name="layers" size={10} color={Colors.violet3} />
                    <Text style={[s.statChipText, { color: Colors.violet3 }]}>{expandedCount} de expansao {`{a,b}`}</Text>
                  </View>
                )}
                {overrideCount > 0 && (
                  <View style={[s.statChip, s.statChipViolet]}>
                    <Icon name="tag" size={10} color={Colors.violet3} />
                    <Text style={[s.statChipText, { color: Colors.violet3 }]}>{overrideCount} com categoria propria</Text>
                  </View>
                )}
                {invalidCount > 0 && (
                  <View style={[s.statChip, s.statChipError]}>
                    <Icon name="alert" size={10} color={Colors.red} />
                    <Text style={[s.statChipText, { color: Colors.red }]}>{invalidCount} invalida{invalidCount === 1 ? "" : "s"}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Preview */}
            {parsed.length > 0 && (
              <View style={s.preview}>
                <View style={s.previewHeader}>
                  <Text style={s.previewTitle}>Preview ({validRows.length} valido{validRows.length === 1 ? "" : "s"})</Text>
                </View>
                {parsed.slice(0, 30).map(function(r, idx) {
                  return (
                    <View key={idx} style={[s.previewRow, !r.isValid && s.previewRowInvalid]}>
                      <Text style={s.previewIdx}>{idx + 1}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={s.previewName} numberOfLines={1}>
                            {r.name || <Text style={{ color: Colors.red, fontStyle: "italic" as any }}>[sem nome]</Text>}
                          </Text>
                          {r.expandedFromIdx !== undefined && (
                            <View style={s.expandedTag}>
                              <Icon name="layers" size={9} color={Colors.violet3} />
                              <Text style={s.expandedTagText}>expandido</Text>
                            </View>
                          )}
                          {r.categoryOverride && (
                            <View style={s.expandedTag}>
                              <Icon name="tag" size={9} color={Colors.violet3} />
                              <Text style={s.expandedTagText}>{r.categoryOverride}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                          {r.price > 0 && <Text style={s.previewMeta}>R$ {r.price.toFixed(2).replace(".", ",")}</Text>}
                          {r.size && <Text style={s.previewMeta}>Tam: {r.size}</Text>}
                          {r.colorInput && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              {r.colorHex ? (
                                <View style={[s.colorDot, { backgroundColor: r.colorHex }]} />
                              ) : (
                                <View style={[s.colorDot, { borderWidth: 1, borderColor: Colors.amber, borderStyle: "dashed" as any }]} />
                              )}
                              <Text style={[s.previewMeta, !r.colorHex && { color: Colors.amber }]}>
                                {r.colorHex ? hexToName(r.colorHex) : r.colorInput + " (?)"}
                              </Text>
                            </View>
                          )}
                          {r.stock > 0 && <Text style={s.previewMeta}>{r.stock} un</Text>}
                        </View>
                      </View>
                      {!r.isValid && <Icon name="x" size={12} color={Colors.red} />}
                    </View>
                  );
                })}
                {parsed.length > 30 && (
                  <Text style={s.previewMore}>+ {parsed.length - 30} mais...</Text>
                )}
              </View>
            )}

            {exceedsMax && (
              <View style={s.errorBanner}>
                <Icon name="alert" size={14} color={Colors.red} />
                <Text style={s.errorText}>Maximo de {MAX_ROWS} produtos por lote. Remova {validRows.length - MAX_ROWS} linha{validRows.length - MAX_ROWS === 1 ? "" : "s"}.</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable onPress={handleClose} disabled={mut.isPending} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSubmit}
              disabled={mut.isPending || validRows.length === 0 || exceedsMax}
              style={[s.submitBtn, (mut.isPending || validRows.length === 0 || exceedsMax) && { opacity: 0.5 }]}>
              {mut.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="plus" size={13} color="#fff" />
                  <Text style={s.submitText}>
                    Adicionar {validRows.length > 0 ? validRows.length : ""} produto{validRows.length === 1 ? "" : "s"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 16 },
  modal: { backgroundColor: Colors.bg2, borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90%", borderWidth: 1, borderColor: Colors.border, overflow: "hidden" as any },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 17, fontWeight: "800", color: Colors.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },

  helpTabs: { flexDirection: "row", gap: 6, marginBottom: 8 },
  helpTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  helpTabActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet3 },
  helpTabText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  helpTabTextActive: { color: Colors.violet3, fontWeight: "700" },

  infoBox: { flexDirection: "row", gap: 10, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  infoTitle: { fontSize: 12, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  infoText: { fontSize: 11, color: Colors.ink3, lineHeight: 15 },
  infoTextSmall: { fontSize: 10, color: Colors.ink3, marginTop: 6, fontStyle: "italic" as any },
  exampleBox: { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: Colors.border },
  exampleText: { fontSize: 11, color: Colors.ink, fontFamily: Platform.OS === "web" ? "monospace" : undefined, lineHeight: 16 },
  exampleLoadBtn: { alignSelf: "flex-start" as any, marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  exampleLoadText: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },

  label: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.4, marginBottom: 6 },
  catPicker: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  catPickerText: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600" },
  catList: { backgroundColor: Colors.bg3, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" as any },
  catOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catOptionActive: { backgroundColor: Colors.violetD },
  catOptionText: { fontSize: 12, color: Colors.ink },

  textareaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  clearText: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.4 },
  textarea: {
    backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: Colors.ink,
    minHeight: 140, fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    lineHeight: 18,
  },
  hintShortcut: { fontSize: 10, color: Colors.ink3, marginTop: 6, fontStyle: "italic" as any },

  statsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  statChipViolet: { backgroundColor: Colors.violetD, borderColor: Colors.violet3 + "44" },
  statChipError: { backgroundColor: Colors.redD, borderColor: Colors.red + "44" },
  statChipText: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },

  preview: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
  previewTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.4 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, marginBottom: 3, borderWidth: 1, borderColor: "transparent" },
  previewRowInvalid: { borderColor: Colors.red + "55", backgroundColor: Colors.redD },
  previewIdx: { fontSize: 10, color: Colors.ink3, fontWeight: "700", minWidth: 18 },
  previewName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  previewMeta: { fontSize: 10, color: Colors.ink3 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  previewMore: { fontSize: 10, color: Colors.ink3, textAlign: "center", fontStyle: "italic" as any, marginTop: 4 },

  expandedTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet3 + "33" },
  expandedTagText: { fontSize: 9, color: Colors.violet3, fontWeight: "700" },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.redD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.red + "33", marginBottom: 8 },
  errorText: { flex: 1, fontSize: 12, color: Colors.red, fontWeight: "600" },

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg3 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  submitBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 11 },
  submitText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default QuickBatchProductsModal;
