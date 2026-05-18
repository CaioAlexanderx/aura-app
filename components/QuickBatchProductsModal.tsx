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
//
// 2) HEADER MAPEADO (recomendado pra paste de Excel/Sheets):
//    # nome ; estoque ; preco
//    Camiseta Branca ; 15 ; 49,90
//
// 3) SECTION MARKERS [Categoria] pra agrupar:
//    [Bermudas]
//    Bermuda slim preta | 49,90 | M | preto | 5
//
// 4) EXPANSAO {a,b,c} pra variantes:
//    Camiseta | 49,90 | {P,M,G,GG} | preto | 5
//
// 5) MARKUP GLOBAL DO LOTE (D-M01, 18/05/2026):
//    Campo "Markup automatico" no topo aceita 2x / 2.5x / +100% / 200%.
//    Quando preenchido, a 2a coluna posicional (ou header 'custo') vira CUSTO
//    e o preco de venda eh calculado: preco = custo * markup.
//    Override por linha: usar header com 'custo' E 'preco' juntos -- markup
//    eh ignorado nessa linha (preco manual prevalece).
//
// 6) EDICAO INLINE NO PREVIEW (D-M02, 18/05/2026):
//    Clicar no icone de lapis em uma linha do preview abre form inline pra
//    editar. Salvar -> reescreve a linha original no textarea.
//    Indisponivel pra linhas expandidas ({a,b}) -- edita o texto original.
//
// Atalhos (web):
//    Tab dentro do textarea insere "\t" (separador).
//    Shift+Tab muda foco. Ctrl/Cmd + Enter submete.
//
// Regra: permite duplicados, soh avisa no final.
// Max: 200 linhas por lote.
// ============================================================

type ColumnKey = 'name' | 'price' | 'size' | 'color' | 'stock' | 'category' | 'cost';
type PriceSource = 'manual' | 'markup' | 'none';

type ParsedRow = {
  line: string;
  name: string;
  cost: number;
  price: number;
  priceSource: PriceSource;
  size: string | null;
  colorInput: string | null;
  colorHex: string | null;
  stock: number;
  categoryOverride: string | null;
  isValid: boolean;
  errorMsg?: string;
  expandedFromIdx?: number;
};

var HEADER_ALIASES: Record<string, ColumnKey> = {
  'nome': 'name', 'name': 'name', 'produto': 'name', 'descricao': 'name', 'descrição': 'name', 'item': 'name',
  'preco': 'price', 'preço': 'price', 'price': 'price', 'valor': 'price', 'venda': 'price',
  'tamanho': 'size', 'size': 'size', 'tam': 'size', 'numero': 'size', 'número': 'size', 'medida': 'size',
  'cor': 'color', 'color': 'color', 'cores': 'color',
  'estoque': 'stock', 'stock': 'stock', 'qtd': 'stock', 'quantidade': 'stock', 'qty': 'stock', 'un': 'stock', 'unidades': 'stock',
  'categoria': 'category', 'category': 'category', 'cat': 'category',
  'custo': 'cost', 'cost': 'cost', 'cost_price': 'cost', 'preco_custo': 'cost', 'preço_custo': 'cost',
};

var POSITIONAL_ORDER: ColumnKey[] = ['name', 'price', 'size', 'color', 'stock'];

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Parse input de markup -- aceita "2x", "2.5x", "+100%", "100%", "2", "2.5"
// Retorna o multiplicador ou null se invalido/vazio.
function parseMarkup(input: string): number | null {
  if (!input || !input.trim()) return null;
  const cleaned = input.trim().toLowerCase();
  // "2x" / "2.5x" / "2,5x"
  const xMatch = cleaned.match(/^([\d.,]+)\s*x$/);
  if (xMatch) {
    const n = parseBrlNumber(xMatch[1]);
    return n > 0 ? n : null;
  }
  // "+100%" / "100%" / "+50%"
  const pctMatch = cleaned.match(/^[+]?([\d.,]+)\s*%$/);
  if (pctMatch) {
    const pct = parseBrlNumber(pctMatch[1]);
    if (pct <= 0) return null;
    return 1 + (pct / 100);
  }
  // "2" / "2.5" -- assume multiplicador
  if (/^[\d.,]+$/.test(cleaned)) {
    const n = parseBrlNumber(cleaned);
    return n > 0 ? n : null;
  }
  return null;
}

function isHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return true;
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

function parseSectionMarker(line: string): string | null {
  const m = line.trim().match(/^\[([^\]]+)\]$/);
  return m ? m[1].trim() : null;
}

function expandPattern(value: string | null): string[] {
  if (!value) return [""];
  const m = value.match(/^\{([^}]+)\}$/);
  if (m) {
    return m[1].split(',').map(function(x) { return x.trim(); }).filter(Boolean);
  }
  return [value];
}

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

function inferPositional(parts: string[]): ColumnKey[] {
  if (parts.length === 1) return ['name'];
  if (parts.length === 2) return ['name', 'price'];
  if (parts.length === 3) {
    const third = parts[2].trim();
    const isNumeric = /^\d+$/.test(third);
    return isNumeric ? ['name', 'price', 'stock'] : ['name', 'price', 'size'];
  }
  return POSITIONAL_ORDER.slice(0, parts.length);
}

function buildRowFromFields(
  rawLine: string,
  fields: Partial<Record<ColumnKey, string>>,
  sectionCategory: string | null,
  pickerDefault: string,
  parentIdx: number,
  isExpanded: boolean,
  markup: number | null
): ParsedRow {
  const name = (fields.name || '').trim();
  const sizeRaw = fields.size || null;
  const colorRaw = fields.color || null;
  const colorHex = colorRaw ? nameToHex(colorRaw) : null;
  const explicitCat = (fields.category || '').trim();

  // Categoria override: explicit > section
  let categoryOverride: string | null = null;
  if (explicitCat && explicitCat !== pickerDefault) categoryOverride = explicitCat;
  else if (sectionCategory && sectionCategory !== pickerDefault) categoryOverride = sectionCategory;

  // ----- Resolucao de custo + preco com markup -----
  // Regras (D-M01):
  // - Se markup ativo + linha tem 'cost' (header) sem 'price' -> price = cost * markup
  // - Se markup ativo + linha tem 'price' sem 'cost' -> trata price como cost, calcula
  // - Se markup ativo + linha tem ambos -> manual (markup ignorado nessa linha)
  // - Sem markup -> price direto, cost = 0
  const rawCost = parseBrlNumber(fields.cost || '');
  const rawPrice = parseBrlNumber(fields.price || '');
  let cost = rawCost;
  let price = rawPrice;
  let priceSource: PriceSource = 'none';

  if (markup && markup > 0) {
    if (rawCost > 0 && rawPrice === 0) {
      price = round2(rawCost * markup);
      priceSource = 'markup';
    } else if (rawCost === 0 && rawPrice > 0) {
      cost = rawPrice;
      price = round2(rawPrice * markup);
      priceSource = 'markup';
    } else if (rawCost > 0 && rawPrice > 0) {
      priceSource = 'manual';
    }
  } else {
    priceSource = rawPrice > 0 ? 'manual' : 'none';
  }

  return {
    line: rawLine,
    name: name,
    cost: cost,
    price: price,
    priceSource: priceSource,
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

function parseRows(text: string, pickerDefault: string, markup: number | null): ParsedRow[] {
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

    if (rows.length === 0 && headerCols === null && isHeaderLine(trimmed)) {
      headerCols = parseHeader(trimmed);
      continue;
    }

    const sectionCat = parseSectionMarker(trimmed);
    if (sectionCat !== null) {
      currentSection = sectionCat;
      continue;
    }

    const parts = trimmed.split(sep).map(function(p) { return p.trim(); });
    const columns = headerCols || inferPositional(parts);

    const fields: Partial<Record<ColumnKey, string>> = {};
    columns.forEach(function(col, idx) {
      if (col && parts[idx] !== undefined) fields[col] = parts[idx];
    });

    const sizes = expandPattern(fields.size || null);
    const colors = expandPattern(fields.color || null);
    const combos = crossProduct<string>([sizes, colors]);
    const isExpanded = combos.length > 1;

    combos.forEach(function(combo) {
      const localFields: Partial<Record<ColumnKey, string>> = Object.assign({}, fields);
      localFields.size = combo[0] || undefined;
      localFields.color = combo[1] || undefined;
      rows.push(buildRowFromFields(trimmed, localFields, currentSection, pickerDefault, dataLineIdx, isExpanded, markup));
    });

    dataLineIdx++;
  }

  return rows;
}

// Substitui a primeira ocorrencia de uma linha exata no texto.
// Usado pela edicao inline.
function replaceLineInText(currentText: string, originalLine: string, newLine: string): string {
  const lines = currentText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === originalLine.trim()) {
      lines[i] = newLine;
      return lines.join('\n');
    }
  }
  return currentText;
}

// Reconstroi uma linha a partir de campos editados, usando o separador detectado.
// Mantem so colunas posicionais por simplicidade -- header e section nao sao
// alterados pela edicao inline.
function buildLineFromFields(fields: { name: string; price: string; size: string; color: string; stock: string }, sep: string): string {
  // Posicional padrao: name | price | size | color | stock
  return [fields.name, fields.price, fields.size, fields.color, fields.stock]
    .map(function(v) { return v || ''; })
    .join(' ' + sep + ' ');
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
const EXAMPLE_MARKUP = "Camiseta basica | 25,00 | M | preto | 10\nBermuda slim | 35,00 | M | cinza | 5\nTenis casual | 95,00 | 40 | preto | 3";

export function QuickBatchProductsModal({ visible, onClose, allCategories }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(function() { return allCategories[0] || "Produtos"; });
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [activeHelp, setActiveHelp] = useState<'basic' | 'expansion' | 'sections' | 'markup'>('basic');
  const [markupInput, setMarkupInput] = useState("");
  const [editingLine, setEditingLine] = useState<string | null>(null);  // linha original sendo editada
  const [editFields, setEditFields] = useState<{ name: string; price: string; size: string; color: string; stock: string }>({
    name: "", price: "", size: "", color: "", stock: ""
  });
  const textRef = useRef<TextInput | null>(null);

  const markup = useMemo(function() { return parseMarkup(markupInput); }, [markupInput]);
  const parsed = useMemo(function() { return text.trim() ? parseRows(text, category, markup) : []; }, [text, category, markup]);
  const validRows = useMemo(function() { return parsed.filter(function(r) { return r.isValid; }); }, [parsed]);
  const invalidCount = parsed.length - validRows.length;
  const expandedCount = useMemo(function() {
    return validRows.filter(function(r) { return r.expandedFromIdx !== undefined; }).length;
  }, [validRows]);
  const overrideCount = useMemo(function() {
    return validRows.filter(function(r) { return r.categoryOverride !== null; }).length;
  }, [validRows]);
  const markupCount = useMemo(function() {
    return validRows.filter(function(r) { return r.priceSource === 'markup'; }).length;
  }, [validRows]);
  const exceedsMax = validRows.length > MAX_ROWS;

  const mut = useMutation({
    mutationFn: function() {
      if (!company?.id) throw new Error("Sem empresa");
      const payload: BatchProductInput[] = validRows.map(function(r) {
        const item: BatchProductInput = {
          name: r.name,
          price: r.price,
          stock_qty: r.stock,
          size: r.size,
          color: r.colorHex,
          category: r.categoryOverride || category || "Produtos",
        };
        if (r.cost > 0) item.cost_price = r.cost;
        return item;
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
      setMarkupInput("");
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
    setMarkupInput("");
    setEditingLine(null);
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

  function loadExample(which: 'basic' | 'expansion' | 'sections' | 'markup') {
    setActiveHelp(which);
    if (which === 'basic') {
      setText(EXAMPLE_POSITIONAL);
      setMarkupInput("");
    } else if (which === 'expansion') {
      setText(EXAMPLE_EXPANSION);
      setMarkupInput("");
    } else if (which === 'sections') {
      setText(EXAMPLE_SECTIONS);
      setMarkupInput("");
    } else if (which === 'markup') {
      setText(EXAMPLE_MARKUP);
      setMarkupInput("2x");
    }
  }

  // ----- Edicao inline (D-M02) -----
  function startEditing(row: ParsedRow) {
    if (row.expandedFromIdx !== undefined) return;  // expansoes nao editam
    setEditingLine(row.line);
    setEditFields({
      name: row.name,
      price: row.priceSource === 'markup' ? String(row.cost).replace('.', ',') : (row.price > 0 ? row.price.toFixed(2).replace('.', ',') : ""),
      size: row.size || "",
      color: row.colorInput || "",
      stock: row.stock > 0 ? String(row.stock) : "",
    });
  }

  function cancelEditing() {
    setEditingLine(null);
  }

  function saveEditing() {
    if (!editingLine) return;
    if (!editFields.name.trim()) {
      toast.error("Nome eh obrigatorio");
      return;
    }
    const sep = detectSeparator(text);
    const newLine = buildLineFromFields(editFields, sep);
    const newText = replaceLineInText(text, editingLine, newLine);
    setText(newText);
    setEditingLine(null);
  }

  // ----- Tab intercept + Ctrl+Enter (web only) -----
  useEffect(function() {
    if (Platform.OS !== 'web' || !visible) return;
    const inputNode = textRef.current as any;
    if (!inputNode) return;
    const domNode: HTMLTextAreaElement | null = inputNode._node || inputNode;
    if (!domNode || !domNode.addEventListener) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart || 0;
        const end = target.selectionEnd || 0;
        const newValue = target.value.substring(0, start) + '\t' + target.value.substring(end);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, validRows.length, exceedsMax, mut.isPending]);

  const placeholder = "Cole ou digite aqui...\n\nFormato simples:\n" + EXAMPLE_POSITIONAL;
  const priceLabelInExample = markup ? "Custo" : "Preco";

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
              <Pressable onPress={function() { setActiveHelp('markup'); }}
                style={[s.helpTab, activeHelp === 'markup' && s.helpTabActive]}>
                <Text style={[s.helpTabText, activeHelp === 'markup' && s.helpTabTextActive]}>Markup</Text>
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
                {activeHelp === 'markup' && (
                  <>
                    <Text style={s.infoTitle}>Markup automatico: digite custo, vendemos calculado</Text>
                    <Text style={s.infoText}>
                      Preencha o campo Markup acima (ex: 2x, 2.5x, +100%) e digite o CUSTO no
                      lugar do preco. O preco de venda eh calculado automaticamente.
                    </Text>
                    <View style={s.exampleBox}>
                      <Text style={s.exampleText}>{"Markup: 2x\n\n" + EXAMPLE_MARKUP + "\n\n-> Camiseta R$ 50,00 (custo 25)\n-> Bermuda R$ 70,00 (custo 35)"}</Text>
                    </View>
                    <Text style={s.infoTextSmall}>Aceita "2x", "2.5x", "+100%", "200%". Linhas com header "custo" + "preco" juntos ignoram o markup.</Text>
                    <Pressable onPress={function() { loadExample('markup'); }} style={s.exampleLoadBtn}>
                      <Text style={s.exampleLoadText}>Carregar exemplo com markup 2x</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Markup global + Categoria padrao -- row dupla */}
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Markup automatico (opcional)</Text>
                <View style={[s.markupWrap, markup && s.markupWrapActive]}>
                  <Icon name="layers" size={12} color={markup ? Colors.violet3 : Colors.ink3} />
                  <TextInput
                    style={s.markupInput}
                    value={markupInput}
                    onChangeText={setMarkupInput}
                    placeholder="ex: 2x ou +100%"
                    placeholderTextColor={Colors.ink3}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {markup && <Text style={s.markupParsed}>= {markup.toFixed(2).replace('.', ',')}x</Text>}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Categoria padrao</Text>
                <Pressable onPress={function() { setShowCatPicker(!showCatPicker); }} style={s.catPicker}>
                  <Icon name="tag" size={13} color={Colors.violet3} />
                  <Text style={s.catPickerText} numberOfLines={1}>{category}</Text>
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
            </View>

            {markup && (
              <View style={s.markupHint}>
                <Icon name="info" size={11} color={Colors.violet3} />
                <Text style={s.markupHintText}>
                  Markup ativo. A 2a coluna (ou header "custo") sera tratada como custo; preco = custo x {markup.toFixed(2).replace('.', ',')}.
                </Text>
              </View>
            )}

            {/* Textarea */}
            <View style={{ marginBottom: 12 }}>
              <View style={s.textareaHeader}>
                <Text style={s.label}>
                  Produtos ({validRows.length} valido{validRows.length === 1 ? "" : "s"})
                  {markup ? "  ·  " + priceLabelInExample + " na 2a coluna" : ""}
                </Text>
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
                <Text style={s.hintShortcut}>Tab insere separador  ·  Ctrl/Cmd+Enter envia  ·  clique no lapis pra editar uma linha</Text>
              )}
            </View>

            {/* Stats chips */}
            {parsed.length > 0 && (
              <View style={s.statsRow}>
                <View style={s.statChip}>
                  <Text style={s.statChipText}>{parsed.length} linha{parsed.length === 1 ? "" : "s"}</Text>
                </View>
                {markupCount > 0 && (
                  <View style={[s.statChip, s.statChipViolet]}>
                    <Icon name="layers" size={10} color={Colors.violet3} />
                    <Text style={[s.statChipText, { color: Colors.violet3 }]}>{markupCount} com markup</Text>
                  </View>
                )}
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
                  const isEditing = editingLine === r.line && r.expandedFromIdx === undefined;
                  const canEdit = r.expandedFromIdx === undefined;

                  if (isEditing) {
                    return (
                      <View key={idx} style={s.editRow}>
                        <Text style={s.previewIdx}>{idx + 1}</Text>
                        <View style={{ flex: 1, gap: 6 }}>
                          <View style={s.editFieldsRow}>
                            <TextInput
                              style={[s.editInput, { flex: 2 }]}
                              value={editFields.name}
                              onChangeText={function(v) { setEditFields(Object.assign({}, editFields, { name: v })); }}
                              placeholder="Nome"
                              placeholderTextColor={Colors.ink3}
                            />
                            <TextInput
                              style={[s.editInput, { flex: 1 }]}
                              value={editFields.price}
                              onChangeText={function(v) { setEditFields(Object.assign({}, editFields, { price: v })); }}
                              placeholder={markup ? "Custo" : "Preco"}
                              placeholderTextColor={Colors.ink3}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={s.editFieldsRow}>
                            <TextInput
                              style={[s.editInput, { flex: 1 }]}
                              value={editFields.size}
                              onChangeText={function(v) { setEditFields(Object.assign({}, editFields, { size: v })); }}
                              placeholder="Tamanho"
                              placeholderTextColor={Colors.ink3}
                            />
                            <TextInput
                              style={[s.editInput, { flex: 1 }]}
                              value={editFields.color}
                              onChangeText={function(v) { setEditFields(Object.assign({}, editFields, { color: v })); }}
                              placeholder="Cor"
                              placeholderTextColor={Colors.ink3}
                            />
                            <TextInput
                              style={[s.editInput, { flex: 1 }]}
                              value={editFields.stock}
                              onChangeText={function(v) { setEditFields(Object.assign({}, editFields, { stock: v })); }}
                              placeholder="Estoque"
                              placeholderTextColor={Colors.ink3}
                              keyboardType="number-pad"
                            />
                          </View>
                        </View>
                        <View style={{ gap: 4 }}>
                          <Pressable onPress={saveEditing} style={s.editSaveBtn}>
                            <Icon name="check" size={11} color="#fff" />
                          </Pressable>
                          <Pressable onPress={cancelEditing} style={s.editCancelBtn}>
                            <Icon name="x" size={11} color={Colors.ink3} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <Pressable key={idx} onPress={canEdit ? function() { startEditing(r); } : undefined}
                      style={[s.previewRow, !r.isValid && s.previewRowInvalid, !canEdit && { opacity: 0.85 }]}>
                      <Text style={s.previewIdx}>{idx + 1}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={s.previewName} numberOfLines={1}>
                            {r.name || <Text style={{ color: Colors.red, fontStyle: "italic" as any }}>[sem nome]</Text>}
                          </Text>
                          {r.priceSource === 'markup' && (
                            <View style={s.markupTag}>
                              <Icon name="layers" size={9} color={Colors.violet3} />
                              <Text style={s.expandedTagText}>calc</Text>
                            </View>
                          )}
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
                          {r.priceSource === 'markup' && r.cost > 0 && (
                            <Text style={s.previewMeta}>custo R$ {r.cost.toFixed(2).replace(".", ",")}</Text>
                          )}
                          {r.price > 0 && <Text style={[s.previewMeta, r.priceSource === 'markup' && { color: Colors.violet3, fontWeight: "700" }]}>R$ {r.price.toFixed(2).replace(".", ",")}</Text>}
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
                      {canEdit && r.isValid && (
                        <Icon name="edit" size={11} color={Colors.ink3} />
                      )}
                      {!r.isValid && <Icon name="x" size={12} color={Colors.red} />}
                    </Pressable>
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

  helpTabs: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
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

  row2: { flexDirection: "row", gap: 10, marginBottom: 8 },
  markupWrap: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  markupWrapActive: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  markupInput: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600", padding: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  markupParsed: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  markupHint: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, padding: 8, marginBottom: 14, borderWidth: 1, borderColor: Colors.violet3 + "33" },
  markupHintText: { flex: 1, fontSize: 10, color: Colors.violet3, fontWeight: "600", lineHeight: 14 },

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
  markupTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.violet + "22", borderWidth: 1, borderColor: Colors.violet3 + "55" },

  editRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.violetD, marginBottom: 4, borderWidth: 1, borderColor: Colors.violet3 + "55" },
  editFieldsRow: { flexDirection: "row", gap: 4 },
  editInput: { backgroundColor: Colors.bg2, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, color: Colors.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  editSaveBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  editCancelBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.redD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.red + "33", marginBottom: 8 },
  errorText: { flex: 1, fontSize: 12, color: Colors.red, fontWeight: "600" },

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg3 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  submitBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 11 },
  submitText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default QuickBatchProductsModal;
