import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  productsVariationsApi, matrixKey,
  type ColorEntry, type MatrixMap, type BarcodesMap, type VariationsMode,
} from "@/services/productsVariationsApi";
import { hexToName, nameToHex } from "@/utils/colorNames";

// ============================================================
// AURA. -- ProductVariationsSection (reformulado)
//
// UX radicalmente simplificada:
//   [+ Cor]       [+ Tamanho]
//
// Ao adicionar cor OU tamanho, a tela revela grid de estoque.
// - Se so cor: lista "Azul: 5" "Preto: 3"
// - Se so tamanho: lista "P: 10" "M: 5"
// - Se ambos: matriz NxM com estoque por combinacao
//
// Preco unico do produto pai (nao ha preco por variante).
//
// 08/05/2026: aceita props parentColor/parentSize/parentStock —
// quando o pai tem cor+tamanho proprios e stock_qty > 0 mas a
// combinacao nao esta nas variantes, mesclamos no estado local
// (chip de cor + tamanho aparecem + matrix preenchida) e marcamos
// dirty=true pra forcar salvar e migrar pra variante real.
//
// 21/05/2026: barcode por variante.
// - color/size rows: campo inline EAN / Cód. barras
// - matrix mode: secao "Codigos de barras" abaixo da grade
// - estado hidratado do GET barcodes map; persistido no PUT
//
// 21/05/2026 (tarde): AUTO-SAVE no blur. Substitui o botao
// "Salvar variacoes" por debounce + indicador inline. Bug Eryca:
// cliente editava estoque na matrix e clicava no botao principal
// "Atualizar produto" do form (que so chama PATCH /products e
// nao toca em variantes), entao mudancas nas variantes eram
// perdidas. Agora qualquer mudanca (estoque, barcode, +/- cor,
// +/- tamanho) dispara debounce 400ms e PUT /variations
// automaticamente. Status mostrado em "Salvando…" / "✓ Salvo".
// Toast flutuante "Informacoes salvas" com throttle 2.5s.
// ============================================================

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899",
  "#FFFFFF", "#1F2937", "#6B7280", "#92400E",
];

// Tempo de espera apos a ultima alteracao antes de disparar o PUT.
// 400ms eh curto o suficiente pra "blur saves" (clicar em outra celula
// dispara antes de visualmente perceber atraso) e longo o suficiente pra
// coalescer rajadas de digitacao na mesma celula.
const AUTOSAVE_DEBOUNCE_MS = 400;

// ─── Modal inline para adicionar cor ───
function AddColorPopover({ onAdd, onCancel, existingHexes }: {
  onAdd: (color: ColorEntry) => void;
  onCancel: () => void;
  existingHexes: Set<string>;
}) {
  const [hex, setHex] = useState("#3B82F6");
  const [customInput, setCustomInput] = useState("");

  function tryAddFromInput() {
    const resolved = nameToHex(customInput.trim());
    if (resolved) {
      setHex(resolved);
      setCustomInput("");
    } else if (customInput.trim()) {
      toast.error('Cor "' + customInput + '" nao reconhecida. Use o seletor.');
    }
  }

  function confirm() {
    const normalizedHex = hex.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalizedHex)) {
      toast.error("Cor invalida");
      return;
    }
    if (existingHexes.has(normalizedHex)) {
      toast.error("Essa cor ja foi adicionada");
      return;
    }
    onAdd({ hex: normalizedHex, name: hexToName(normalizedHex) || null });
  }

  return (
    <View style={s.popover}>
      <Text style={s.popoverTitle}>Adicionar cor</Text>

      {/* Color picker preset */}
      <View style={s.colorGrid}>
        {PRESET_COLORS.map(c => (
          <Pressable key={c} onPress={() => setHex(c)}
            style={[s.colorPresetDot, { backgroundColor: c }, hex.toUpperCase() === c.toUpperCase() && s.colorPresetActive]} />
        ))}
      </View>

      {/* Picker web nativo */}
      {Platform.OS === "web" && (
        <View style={s.nativePickerRow}>
          <Text style={s.popoverLabel}>Ou escolha exata:</Text>
          <input
            type="color"
            value={hex}
            onChange={(e: any) => setHex(e.target.value.toUpperCase())}
            style={{
              width: 40, height: 32, borderRadius: 6, border: "1px solid #333",
              background: "transparent", cursor: "pointer", padding: 0,
            } as any}
          />
        </View>
      )}

      {/* Input por nome */}
      <View style={s.nameInputRow}>
        <TextInput
          style={s.popoverInput}
          value={customInput}
          onChangeText={setCustomInput}
          placeholder="Ou digite o nome: azul, rosa claro..."
          placeholderTextColor={Colors.ink3}
          onBlur={tryAddFromInput}
          onSubmitEditing={tryAddFromInput}
        />
      </View>

      {/* Preview */}
      <View style={s.previewRow}>
        <View style={[s.previewDot, { backgroundColor: hex }]} />
        <Text style={s.previewText}>{hexToName(hex)} · {hex}</Text>
      </View>

      <View style={s.popoverActions}>
        <Pressable onPress={onCancel} style={s.popoverCancel}>
          <Text style={s.popoverCancelText}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={confirm} style={s.popoverConfirm}>
          <Text style={s.popoverConfirmText}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Popover inline pra adicionar tamanho ───
function AddSizePopover({ onAdd, onCancel, existingSizes }: {
  onAdd: (size: string) => void;
  onCancel: () => void;
  existingSizes: Set<string>;
}) {
  const [value, setValue] = useState("");

  function confirm() {
    const trimmed = value.trim();
    if (!trimmed) { toast.error("Digite um tamanho"); return; }
    if (existingSizes.has(trimmed)) { toast.error("Tamanho ja adicionado"); return; }
    if (trimmed.length > 30) { toast.error("Maximo 30 caracteres"); return; }
    onAdd(trimmed);
  }

  return (
    <View style={s.popover}>
      <Text style={s.popoverTitle}>Adicionar tamanho</Text>
      <TextInput
        style={s.popoverInput}
        value={value}
        onChangeText={setValue}
        placeholder="Ex: P, M, G, 38, 500ml..."
        placeholderTextColor={Colors.ink3}
        autoFocus
        onSubmitEditing={confirm}
      />
      <View style={s.popoverActions}>
        <Pressable onPress={onCancel} style={s.popoverCancel}>
          <Text style={s.popoverCancelText}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={confirm} style={s.popoverConfirm}>
          <Text style={s.popoverConfirmText}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Componente principal ───
type Props = {
  productId: string;
  productName: string;
  /** Cor propria do pai (hex). Quando presente e nao consta nas variantes,
   *  e adicionada automaticamente como chip e a matrix recebe o stock. */
  parentColor?: string | null;
  /** Tamanho proprio do pai. Mesma logica do parentColor. */
  parentSize?: string | null;
  /** stock_qty do proprio pai (nao das variantes). Quando > 0 e ha
   *  parentColor/parentSize, preenche a celula correspondente da matrix. */
  parentStock?: number | null;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function ProductVariationsSection({ productId, productName, parentColor, parentSize, parentStock }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  // Estado local (o que ta sendo editado)
  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<MatrixMap>({});
  const [barcodes, setBarcodes] = useState<BarcodesMap>({});   // 21/05/2026
  const [dirty, setDirty] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [showSizePopover, setShowSizePopover] = useState(false);
  // Indica se houve mescla do estoque do pai na hidratacao (banner amarelo).
  const [parentMerged, setParentMerged] = useState(false);

  // Auto-save state (21/05/2026)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  // Ref com o estado mais recente — usado dentro do mutationFn pra garantir
  // que o PUT sempre envie o estado mais atualizado, mesmo que o user
  // digite entre o agendamento e a execucao do timer.
  const stateRef = useRef({ colors, sizes, matrix, barcodes });
  useEffect(() => {
    stateRef.current = { colors, sizes, matrix, barcodes };
  }, [colors, sizes, matrix, barcodes]);
  // Marca se o useEffect de hidratacao deve ignorar a proxima atualizacao
  // de `data` (pra nao sobrescrever o estado local logo apos um PUT bem-
  // sucedido que dispara invalidate).
  const skipNextHydrateRef = useRef(false);
  // Throttle do toast "Informacoes salvas" — evita spam quando o user
  // edita varias celulas rapido (cada blur ~ 1 PUT ~ 1 toast).
  // Mostra toast no maximo 1x a cada 2.5s.
  const lastToastAtRef = useRef(0);

  // Fetch inicial
  const { data, isLoading } = useQuery({
    queryKey: ["productVariations", company?.id, productId],
    queryFn: () => productsVariationsApi.get(company!.id, productId),
    enabled: !!company?.id && !!productId,
    staleTime: 30000,
  });

  // Hidrata o estado local ao carregar dados, mesclando dados do pai quando
  // ha estoque orfao (cor+tamanho do pai sem variante correspondente).
  useEffect(() => {
    if (!data) return;
    // Se o ultimo PUT acabou de retornar, o invalidate vai trazer dados
    // identicos ao que ja temos. Pula a hidratacao pra evitar overwrite
    // de quaisquer alteracoes feitas pelo usuario entre o PUT e o GET.
    if (skipNextHydrateRef.current) {
      skipNextHydrateRef.current = false;
      return;
    }
    // Se ha PUT em voo ou agendado, NAO hidrata — o estado local eh a
    // fonte da verdade durante edicao ativa.
    if (inFlightRef.current || saveTimerRef.current) return;

    const fetchedColors: ColorEntry[] = data.colors || [];
    const fetchedSizes: string[] = data.sizes || [];
    const fetchedMatrix: MatrixMap = { ...(data.matrix || {}) };
    const fetchedBarcodes: BarcodesMap = { ...(data.barcodes || {}) };   // 21/05/2026

    // Normaliza cor do pai pra hex uppercase. Se nao for hex valido, ignora.
    const parentHex = parentColor && /^#[0-9A-Fa-f]{6}$/.test(parentColor)
      ? parentColor.toUpperCase()
      : null;
    const parentSizeTrimmed = parentSize && parentSize.trim() ? parentSize.trim() : null;
    const parentStockNum = parentStock && parentStock > 0 ? parentStock : 0;

    let mergedColors = [...fetchedColors];
    let mergedSizes = [...fetchedSizes];
    let merged = false;

    // Inclui cor do pai se nao esta nas variantes
    if (parentHex && !mergedColors.some(c => c.hex.toUpperCase() === parentHex)) {
      mergedColors.push({ hex: parentHex, name: hexToName(parentHex) || null });
      merged = true;
    }

    // Inclui tamanho do pai se nao esta nas variantes
    if (parentSizeTrimmed && !mergedSizes.includes(parentSizeTrimmed)) {
      mergedSizes.push(parentSizeTrimmed);
      merged = true;
    }

    // Preenche celula da matriz com o stock do pai se ainda nao existe.
    // matrixKey aceita null pra modos color-only ou size-only.
    if (parentStockNum > 0 && (parentHex || parentSizeTrimmed)) {
      const key = matrixKey(parentHex, parentSizeTrimmed);
      if (fetchedMatrix[key] === undefined || fetchedMatrix[key] === 0) {
        fetchedMatrix[key] = parentStockNum;
        merged = true;
      }
    }

    setColors(mergedColors);
    setSizes(mergedSizes);
    setMatrix(fetchedMatrix);
    setBarcodes(fetchedBarcodes);   // 21/05/2026
    setParentMerged(merged);
    setDirty(merged);
    // Se houve merge, agenda auto-save debounced pra formalizar a migracao
    // do estoque orfao pra variante. NAO usa immediate=true porque
    // stateRef.current ainda nao reflete os sets acima (sync useEffect roda
    // depois) — o debounce de 400ms da tempo do estado commitar.
    if (merged) {
      scheduleSave();
    }
  }, [data, parentColor, parentSize, parentStock]);

  const mode: VariationsMode = useMemo(() => {
    if (colors.length > 0 && sizes.length > 0) return 'matrix';
    if (colors.length > 0) return 'color';
    if (sizes.length > 0) return 'size';
    return 'none';
  }, [colors, sizes]);

  // ── Auto-save: agenda PUT debounced ──
  function scheduleSave(immediate = false) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (immediate) {
      triggerSave();
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      triggerSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function triggerSave() {
    // Se ja tem PUT em voo, re-agenda pra logo depois pra coalescer
    if (inFlightRef.current) {
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        triggerSave();
      }, 200);
      return;
    }
    if (!company?.id || !productId) return;
    saveMut.mutate();
  }

  // Save mutation — inclui barcodes no payload (21/05/2026)
  const saveMut = useMutation({
    mutationFn: () => {
      inFlightRef.current = true;
      setSaveStatus('saving');
      // Le do ref pra garantir estado mais recente (o usuario pode ter
      // digitado MAIS coisas entre o scheduleSave e o efetivo trigger)
      const snap = stateRef.current;
      return productsVariationsApi.save(company!.id, productId, {
        colors: snap.colors,
        sizes: snap.sizes,
        matrix: snap.matrix,
        barcodes: snap.barcodes,
      });
    },
    onSuccess: (res) => {
      // Marca pra pular a proxima hidratacao (o invalidate vai disparar
      // refetch que retornaria os mesmos dados que ja temos localmente)
      skipNextHydrateRef.current = true;
      qc.invalidateQueries({ queryKey: ["productVariations", company?.id, productId] });
      qc.invalidateQueries({ queryKey: ["products", company?.id] });
      setSaveStatus('saved');
      setDirty(false);
      setParentMerged(false);
      // Toast flutuante "Informacoes salvas" — throttle de 2.5s pra nao
      // inundar a tela se o user editar varias celulas em sequencia
      // (cada blur dispara um PUT, mas o toast aparece no maximo 1x a cada
      // 2.5s). Mensagem curta porque o user ja sabe O QUE salvou.
      const now = Date.now();
      if (now - lastToastAtRef.current > 2500) {
        lastToastAtRef.current = now;
        toast.success("Informacoes salvas");
      }
    },
    onError: (err: any) => {
      setSaveStatus('error');
      toast.error(err?.data?.error || err?.message || "Erro ao salvar variacoes");
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  // Auto-fade do status "saved" -> "idle" depois de 1.8s
  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const t = setTimeout(() => setSaveStatus('idle'), 1800);
    return () => clearTimeout(t);
  }, [saveStatus]);

  // Flush pendente ao desmontar (modal fechado / navegacao)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        // Sincrono nao da; mas como saveMut.mutate eh fire-and-forget,
        // disparamos mesmo asssim — react-query mantem o request rodando
        // independente do componente desmontado.
        if (dirty && company?.id && productId) {
          saveMut.mutate();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers — cada um dispara scheduleSave ao final
  function addColor(c: ColorEntry) {
    setColors([...colors, c]);
    setShowColorPopover(false);
    setDirty(true);
    scheduleSave();
  }
  function removeColor(hex: string) {
    setColors(colors.filter(c => c.hex !== hex));
    // Remove entradas da matrix e barcodes referentes a essa cor
    const newMatrix = { ...matrix };
    const newBarcodes = { ...barcodes };
    Object.keys(newMatrix).forEach(k => {
      if (k.startsWith(hex + '|') || k === hex + '|') delete newMatrix[k];
    });
    Object.keys(newBarcodes).forEach(k => {
      if (k.startsWith(hex + '|') || k === hex + '|') delete newBarcodes[k];
    });
    setMatrix(newMatrix);
    setBarcodes(newBarcodes);
    setDirty(true);
    scheduleSave();
  }
  function addSize(s: string) {
    setSizes([...sizes, s]);
    setShowSizePopover(false);
    setDirty(true);
    scheduleSave();
  }
  function removeSize(value: string) {
    setSizes(sizes.filter(s => s !== value));
    // Remove entradas da matrix e barcodes referentes a esse tamanho
    const newMatrix = { ...matrix };
    const newBarcodes = { ...barcodes };
    Object.keys(newMatrix).forEach(k => {
      if (k.endsWith('|' + value)) delete newMatrix[k];
    });
    Object.keys(newBarcodes).forEach(k => {
      if (k.endsWith('|' + value)) delete newBarcodes[k];
    });
    setMatrix(newMatrix);
    setBarcodes(newBarcodes);
    setDirty(true);
    scheduleSave();
  }
  function updateStock(hex: string | null, size: string | null, value: string) {
    const n = parseInt(value) || 0;
    const key = matrixKey(hex, size);
    setMatrix({ ...matrix, [key]: n < 0 ? 0 : n });
    setDirty(true);
    scheduleSave();
  }
  function stockAt(hex: string | null, size: string | null): string {
    const key = matrixKey(hex, size);
    const v = matrix[key];
    return v === undefined ? "" : String(v);
  }
  // 21/05/2026: barcode helpers
  function barcodeAt(hex: string | null, size: string | null): string {
    return barcodes[matrixKey(hex, size)] || "";
  }
  function updateBarcode(hex: string | null, size: string | null, value: string) {
    const key = matrixKey(hex, size);
    const newBarcodes = { ...barcodes };
    if (value) {
      newBarcodes[key] = value;
    } else {
      delete newBarcodes[key];
    }
    setBarcodes(newBarcodes);
    setDirty(true);
    scheduleSave();
  }

  // Handler de onBlur dos inputs — forca flush imediato pra refletir
  // visualmente "✓ Salvo" antes do user sair da celula (latencia
  // perceptivel menor que esperar o debounce de 400ms).
  function handleInputBlur() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      triggerSave();
    }
  }

  const existingHexSet = useMemo(() => new Set(colors.map(c => c.hex.toUpperCase())), [colors]);
  const existingSizeSet = useMemo(() => new Set(sizes), [sizes]);

  if (isLoading) {
    return (
      <View style={s.container}>
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 8 }}>Carregando variacoes...</Text>
        </View>
      </View>
    );
  }

  const totalStock = Object.values(matrix).reduce((acc, v) => acc + (v || 0), 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Cores e Tamanhos</Text>
          <Text style={s.subtitle}>
            {mode === 'none' && "Adicione cores ou tamanhos para cadastrar estoque por variacao."}
            {mode === 'color' && colors.length + " cor" + (colors.length === 1 ? "" : "es") + " · total " + totalStock + " un"}
            {mode === 'size' && sizes.length + " tamanho" + (sizes.length === 1 ? "" : "s") + " · total " + totalStock + " un"}
            {mode === 'matrix' && (colors.length * sizes.length) + " combinac" + ((colors.length * sizes.length) === 1 ? "ao" : "oes") + " · total " + totalStock + " un"}
          </Text>
        </View>
        {/* Indicador inline de auto-save (substitui o botao "Salvar variacoes" antigo) */}
        <View style={s.saveStatusBadge}>
          {saveStatus === 'saving' && (
            <>
              <ActivityIndicator size="small" color={Colors.violet3} />
              <Text style={s.saveStatusText}>Salvando…</Text>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Icon name="check" size={11} color={Colors.green} />
              <Text style={[s.saveStatusText, { color: Colors.green }]}>Salvo</Text>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <Icon name="alert" size={11} color={Colors.red} />
              <Text style={[s.saveStatusText, { color: Colors.red }]}>Erro</Text>
            </>
          )}
          {saveStatus === 'idle' && dirty && (
            <Text style={[s.saveStatusText, { color: Colors.amber }]}>Aguardando…</Text>
          )}
        </View>
      </View>

      {/* Banner: estoque do pai foi mesclado (vai migrar automaticamente) */}
      {parentMerged && (
        <View style={s.parentMergedBanner}>
          <Icon name="alert" size={12} color={Colors.amber} />
          <View style={{ flex: 1 }}>
            <Text style={s.parentMergedTitle}>Migrando estoque do produto pai pra grade…</Text>
            <Text style={s.parentMergedDesc}>
              {parentColor && parentSize
                ? "A combinacao " + (hexToName(parentColor) || parentColor) + " · " + parentSize + " (" + (parentStock || 0) + " un) veio do pai e sera salva como variante."
                : parentColor
                  ? (hexToName(parentColor) || parentColor) + " (" + (parentStock || 0) + " un) veio do pai e sera salvo como variante."
                  : (parentSize || "") + " (" + (parentStock || 0) + " un) veio do pai e sera salvo como variante."}
            </Text>
          </View>
        </View>
      )}

      {/* Cores */}
      <View style={s.sectionBlock}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>Cores</Text>
          {!showColorPopover && (
            <Pressable onPress={() => setShowColorPopover(true)} style={s.addPillBtn}>
              <Icon name="plus" size={11} color={Colors.violet3} />
              <Text style={s.addPillText}>Adicionar cor</Text>
            </Pressable>
          )}
        </View>

        <View style={s.chipsRow}>
          {colors.map(c => (
            <View key={c.hex} style={s.colorChip}>
              <View style={[s.colorChipDot, { backgroundColor: c.hex }]} />
              <Text style={s.colorChipText}>{c.name || hexToName(c.hex)}</Text>
              <Pressable onPress={() => removeColor(c.hex)} hitSlop={6} style={s.chipRemove}>
                <Icon name="x" size={10} color={Colors.ink3} />
              </Pressable>
            </View>
          ))}
          {colors.length === 0 && !showColorPopover && (
            <Text style={s.emptyHint}>Nenhuma cor. Clique em "Adicionar cor".</Text>
          )}
        </View>

        {showColorPopover && (
          <AddColorPopover
            onAdd={addColor}
            onCancel={() => setShowColorPopover(false)}
            existingHexes={existingHexSet}
          />
        )}
      </View>

      {/* Tamanhos */}
      <View style={s.sectionBlock}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>Tamanhos</Text>
          {!showSizePopover && (
            <Pressable onPress={() => setShowSizePopover(true)} style={s.addPillBtn}>
              <Icon name="plus" size={11} color={Colors.violet3} />
              <Text style={s.addPillText}>Adicionar tamanho</Text>
            </Pressable>
          )}
        </View>

        <View style={s.chipsRow}>
          {sizes.map(sz => (
            <View key={sz} style={s.sizeChip}>
              <Text style={s.sizeChipText}>{sz}</Text>
              <Pressable onPress={() => removeSize(sz)} hitSlop={6} style={s.chipRemove}>
                <Icon name="x" size={10} color={Colors.ink3} />
              </Pressable>
            </View>
          ))}
          {sizes.length === 0 && !showSizePopover && (
            <Text style={s.emptyHint}>Nenhum tamanho. Clique em "Adicionar tamanho".</Text>
          )}
        </View>

        {showSizePopover && (
          <AddSizePopover
            onAdd={addSize}
            onCancel={() => setShowSizePopover(false)}
            existingSizes={existingSizeSet}
          />
        )}
      </View>

      {/* Grid de estoque */}
      {mode !== 'none' && (
        <View style={s.stockBlock}>
          <Text style={s.stockLabel}>Estoque por variacao (auto-salva ao mudar)</Text>

          {/* ── Color-only: dot + label + stock + barcode ── */}
          {mode === 'color' && (
            <View style={{ gap: 6 }}>
              {colors.map(c => (
                <View key={c.hex} style={s.stockRow}>
                  <View style={[s.stockRowDot, { backgroundColor: c.hex }]} />
                  <Text style={s.stockRowLabel} numberOfLines={1}>{c.name || hexToName(c.hex)}</Text>
                  <TextInput
                    style={s.stockInput}
                    value={stockAt(c.hex, null)}
                    onChangeText={v => updateStock(c.hex, null, v)}
                    onBlur={handleInputBlur}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.ink3}
                  />
                  <Text style={s.stockUnit}>un</Text>
                  <View style={s.stockRowDivider} />
                  <TextInput
                    style={s.barcodeInput}
                    value={barcodeAt(c.hex, null)}
                    onChangeText={v => updateBarcode(c.hex, null, v)}
                    onBlur={handleInputBlur}
                    placeholder="EAN / Cód. barras"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="default"
                    returnKeyType="next"
                  />
                </View>
              ))}
            </View>
          )}

          {/* ── Size-only: dot + label + stock + barcode ── */}
          {mode === 'size' && (
            <View style={{ gap: 6 }}>
              {sizes.map(sz => (
                <View key={sz} style={s.stockRow}>
                  <View style={[s.stockRowDot, { backgroundColor: Colors.violet }]} />
                  <Text style={s.stockRowLabel} numberOfLines={1}>{sz}</Text>
                  <TextInput
                    style={s.stockInput}
                    value={stockAt(null, sz)}
                    onChangeText={v => updateStock(null, sz, v)}
                    onBlur={handleInputBlur}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.ink3}
                  />
                  <Text style={s.stockUnit}>un</Text>
                  <View style={s.stockRowDivider} />
                  <TextInput
                    style={s.barcodeInput}
                    value={barcodeAt(null, sz)}
                    onChangeText={v => updateBarcode(null, sz, v)}
                    onBlur={handleInputBlur}
                    placeholder="EAN / Cód. barras"
                    placeholderTextColor={Colors.ink3}
                    keyboardType="default"
                    returnKeyType="next"
                  />
                </View>
              ))}
            </View>
          )}

          {/* ── Matrix: grade de estoque + secao de barcodes abaixo ── */}
          {mode === 'matrix' && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header da tabela: linha com tamanhos */}
                  <View style={s.matrixRow}>
                    <View style={[s.matrixCellHeader, { width: 110 }]}>
                      <Text style={s.matrixHeaderText}>Cor \\ Tamanho</Text>
                    </View>
                    {sizes.map(sz => (
                      <View key={sz} style={s.matrixCellHeader}>
                        <Text style={s.matrixHeaderText}>{sz}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Linhas: 1 por cor */}
                  {colors.map(c => (
                    <View key={c.hex} style={s.matrixRow}>
                      <View style={[s.matrixCellHeader, s.matrixCellHeaderRow, { width: 110 }]}>
                        <View style={[s.matrixColorDot, { backgroundColor: c.hex }]} />
                        <Text style={s.matrixRowLabel} numberOfLines={1}>{c.name || hexToName(c.hex)}</Text>
                      </View>
                      {sizes.map(sz => (
                        <View key={sz} style={s.matrixCell}>
                          <TextInput
                            style={s.matrixInput}
                            value={stockAt(c.hex, sz)}
                            onChangeText={v => updateStock(c.hex, sz, v)}
                            onBlur={handleInputBlur}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={Colors.ink3}
                            selectTextOnFocus
                          />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Codigos de barras por combinacao (matrix mode) — 21/05/2026 */}
              <View style={s.matrixBarcodeSection}>
                <Text style={[s.stockLabel, { marginBottom: 6 }]}>Codigos de barras</Text>
                <View style={{ gap: 6 }}>
                  {colors.map(c => sizes.map(sz => (
                    <View key={matrixKey(c.hex, sz)} style={s.stockRow}>
                      <View style={[s.stockRowDot, { backgroundColor: c.hex }]} />
                      <Text style={s.stockRowLabel} numberOfLines={1}>
                        {(c.name || hexToName(c.hex))} · {sz}
                      </Text>
                      <TextInput
                        style={s.barcodeInput}
                        value={barcodeAt(c.hex, sz)}
                        onChangeText={v => updateBarcode(c.hex, sz, v)}
                        onBlur={handleInputBlur}
                        placeholder="EAN / Cód. barras"
                        placeholderTextColor={Colors.ink3}
                        keyboardType="default"
                        returnKeyType="next"
                      />
                    </View>
                  )))}
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 3, lineHeight: 15 },

  // Indicador inline de auto-save no header (21/05/2026)
  saveStatusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border,
    minHeight: 24, minWidth: 70, justifyContent: "center",
  },
  saveStatusText: { fontSize: 10.5, color: Colors.violet3, fontWeight: "600" },

  // Banner do merge do pai
  parentMergedBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "rgba(251,191,36,0.10)",
    borderWidth: 1, borderColor: "rgba(251,191,36,0.30)",
    borderRadius: 9, padding: 10, marginBottom: 12,
  },
  parentMergedTitle: { fontSize: 11, color: Colors.amber, fontWeight: "700" },
  parentMergedDesc: { fontSize: 11, color: Colors.ink2, marginTop: 2, lineHeight: 15 },

  sectionBlock: { marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.5 },
  addPillBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  addPillText: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  emptyHint: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" as any },
  colorChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  colorChipDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  colorChipText: { fontSize: 11, color: Colors.ink, fontWeight: "500" },
  sizeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  sizeChipText: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  chipRemove: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },

  // Popover
  popover: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border2, marginTop: 8 },
  popoverTitle: { fontSize: 12, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  popoverLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  popoverInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: Colors.ink },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  colorPresetDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.border },
  colorPresetActive: { borderWidth: 3, borderColor: Colors.violet },
  nativePickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  nameInputRow: { marginBottom: 10 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  previewDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  previewText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  popoverActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  popoverCancel: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: Colors.border },
  popoverCancelText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  popoverConfirm: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 7, backgroundColor: Colors.violet },
  popoverConfirmText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  // Stock grid
  stockBlock: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  stockLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.5, marginBottom: 8 },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  stockRowDot: { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  stockRowLabel: { minWidth: 36, maxWidth: 90, fontSize: 12, color: Colors.ink, fontWeight: "500" },
  stockInput: { width: 64, backgroundColor: Colors.bg4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: Colors.ink, textAlign: "right", fontWeight: "600" },
  stockUnit: { fontSize: 10, color: Colors.ink3, fontWeight: "600", width: 20 },
  // 21/05/2026: divider e campo barcode nas linhas de estoque
  stockRowDivider: { width: 1, height: 20, backgroundColor: Colors.border, flexShrink: 0 },
  barcodeInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, color: Colors.ink, minWidth: 80 },

  // Matrix
  matrixRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
  matrixCellHeader: { width: 70, height: 34, borderRadius: 6, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  matrixCellHeaderRow: { flexDirection: "row", gap: 4, paddingHorizontal: 6 },
  matrixHeaderText: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },
  matrixColorDot: { width: 10, height: 10, borderRadius: 5 },
  matrixRowLabel: { fontSize: 10, color: Colors.ink, fontWeight: "600", flex: 1 },
  matrixCell: { width: 70, height: 34 },
  matrixInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, fontSize: 12, color: Colors.ink, textAlign: "center", fontWeight: "600" },
  // 21/05/2026: secao de barcodes abaixo da grade de matrix
  matrixBarcodeSection: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
});

export default ProductVariationsSection;
