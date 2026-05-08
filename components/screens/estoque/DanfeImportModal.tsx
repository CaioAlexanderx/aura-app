// ============================================================
// AURA. — Estoque · Modal de Importação DANFE (XML NF-e)
//
// Fluxo: usuário seleciona XML da NF-e → parser extrai itens →
// tabela editável (nome, preço venda, custo, NCM, cor, categoria) →
// markup bulk opcional → botão Importar cria produtos via API.
//
// Fix #4 (08/05): coluna Custo agora é TextInput editável.
// applyBulkMarkup usa cost_edit como base de cálculo.
// handleImport salva o custo real ao criar o produto.
//
// NCM (08/05): coluna NCM adicionada com TextInput 8 dígitos,
// badge ✓/n/8/💡 e inferência automática via suggestNcm().
// Mesma lógica do AddProductForm (NCM_RULES + suggestNcm).
//
// Fix #5 (08/05): overlay usa position: fixed (web) para garantir
// que o modal abre sempre na viewport, mesmo com ScrollView rolada.
// ============================================================
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { companiesApi } from "@/services/api";
import { Colors } from "@/constants/colors";
import { maskCurrency, unmaskNumber } from "@/utils/masks";

const IS_WEB = Platform.OS === "web";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface DanfeItem {
  description: string;
  ncm: string;
  quantity: number;
  unit_value: number;
  unit_cost: number;
  total_value: number;
}

interface EditableItem extends DanfeItem {
  name: string;
  price: string;      // maskCurrency — preço de venda
  cost_edit: string;  // maskCurrency — custo editável; base do markup
  ncm_edit: string;   // 8 dígitos — editável
  color: string;
  category: string;
  selected: boolean;
}

interface DanfeImportModalProps {
  visible: boolean;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── NCM helpers (mesma lógica do AddProductForm) ─────────────────────────────

interface NcmRule { pattern: RegExp; ncm: string; label: string }

const NCM_RULES: NcmRule[] = [
  { pattern: /t[eê]nis|sneaker|esportivo/i,        ncm: "64041100", label: "Tênis esportivo" },
  { pattern: /sandália|chinelo|tamanco/i,           ncm: "64029990", label: "Sandália/chinelo" },
  { pattern: /bota|botina|coturno/i,               ncm: "64031990", label: "Bota/botina couro" },
  { pattern: /sapatilha|bailarina|flat/i,          ncm: "64041900", label: "Sapatilha" },
  { pattern: /scarpin|salto|peep.?toe|mule/i,      ncm: "64041900", label: "Sapato salto" },
  { pattern: /sapato|calçado|shoes?/i,             ncm: "64041900", label: "Calçado genérico" },
  { pattern: /bolsa|mochila|carteira|clutch/i,     ncm: "42022200", label: "Bolsa/acessório" },
  { pattern: /cinto|cinta/i,                       ncm: "42032100", label: "Cinto" },
  { pattern: /meia|sock/i,                         ncm: "61159900", label: "Meias" },
  { pattern: /palmilha|solado|cadarço/i,           ncm: "64069000", label: "Acessório calçado" },
];

function suggestNcm(name: string): NcmRule | null {
  if (!name) return null;
  for (const rule of NCM_RULES) {
    if (rule.pattern.test(name)) return rule;
  }
  return null;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function applyMarkup(costBrl: number, pct: number): string {
  const price = costBrl * (1 + pct / 100);
  return maskCurrency(String(Math.round(price * 100)));
}

const MARKUP_PRESETS = [30, 50, 80, 100, 150];

const ALL_CATEGORIES = [
  "Calçados", "Bolsas", "Acessórios", "Roupas", "Meias", "Outros",
];

// ─── Componente principal ────────────────────────────────────────────────────

export function DanfeImportModal({
  visible,
  companyId,
  onClose,
  onSuccess,
}: DanfeImportModalProps) {
  const [step, setStep] = useState<"upload" | "review" | "importing" | "done">("upload");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [markupPct, setMarkupPct] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateItem = useCallback(
    (idx: number, field: keyof EditableItem, value: string | boolean) => {
      setItems(prev =>
        prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
      );
    },
    []
  );

  const toggleAll = useCallback((checked: boolean) => {
    setItems(prev => prev.map(it => ({ ...it, selected: checked })));
  }, []);

  // ── Fix #4: markup agora usa cost_edit como base ──────────────────────────
  const applyBulkMarkup = useCallback((pct: number) => {
    setItems(prev =>
      prev.map(it => {
        if (!it.selected) return it;
        const baseCost = parseInt(unmaskNumber(it.cost_edit) || "0") / 100;
        return { ...it, price: applyMarkup(baseCost, pct) };
      })
    );
  }, []);

  function handleFileChange(e: any) {
    const file = e.target?.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const xmlText = evt.target?.result as string;
        const parsed = parseDanfeXml(xmlText);
        if (!parsed.length) {
          setError("Nenhum item encontrado no XML. Verifique se é um arquivo NF-e válido.");
          return;
        }
        setItems(
          parsed.map(it => ({
            ...it,
            name: it.description,
            price: maskCurrency(String(Math.round(it.unit_value * 100))),
            cost_edit: maskCurrency(String(Math.round(it.unit_cost * 100))),
            ncm_edit: it.ncm || "",
            color: "",
            category: "Calçados",
            selected: true,
          }))
        );
        setStep("review");
      } catch {
        setError("Erro ao ler o arquivo XML. Verifique se é uma NF-e válida.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const selected = items.filter(it => it.selected);
    if (!selected.length) return;
    setImporting(true);
    setStep("importing");
    let count = 0;
    for (const it of selected) {
      try {
        // Fix #4: usa custo editado; Fix NCM: usa ncm_edit
        const costCents = parseInt(unmaskNumber(it.cost_edit) || "0", 10);
        const cost = costCents / 100;
        const priceCents = parseInt(unmaskNumber(it.price) || "0", 10);
        const price = priceCents / 100;
        await companiesApi.createProduct(companyId, {
          name: it.name,
          price,
          cost,
          ncm: it.ncm_edit || null,
          color: it.color || null,
          category: it.category || null,
          stock: it.quantity,
        });
        count++;
        setImportedCount(count);
      } catch {
        // silencia erros individuais — continua importando os demais
      }
    }
    setImporting(false);
    setStep("done");
    setImportedCount(count);
  }

  function handleClose() {
    setStep("upload");
    setItems([]);
    setError(null);
    setMarkupPct("");
    setImportedCount(0);
    onClose();
  }

  function handleSuccess() {
    handleClose();
    onSuccess();
  }

  if (!visible) return null;

  const selectedCount = items.filter(i => i.selected).length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  return (
    // Fix #5: position fixed garante overlay na viewport mesmo com scroll
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />

      {step === "upload" && (
        <View style={[s.panel, s.panelUpload]}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>Importar DANFE (NF-e)</Text>
            <Pressable onPress={handleClose} style={s.closeBtn}>
              <Text style={s.closeBtnTxt}>✕</Text>
            </Pressable>
          </View>

          <View style={s.uploadBody}>
            <View style={s.uploadIcon}>
              <Text style={s.uploadIconTxt}>📄</Text>
            </View>
            <Text style={s.uploadTitle}>Selecione o XML da NF-e</Text>
            <Text style={s.uploadSub}>
              Selecione o arquivo .xml gerado pela SEFAZ para importar os
              produtos automaticamente.
            </Text>

            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            )}

            {IS_WEB && (
              <>
                <input
                  ref={fileInputRef as any}
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <Pressable
                  style={s.uploadBtn}
                  onPress={() => (fileInputRef.current as any)?.click()}
                >
                  <Text style={s.uploadBtnTxt}>Selecionar arquivo XML</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {step === "review" && (
        <View style={[s.panel, s.panelWide]}>
          <View style={s.panelHeader}>
            <View>
              <Text style={s.panelTitle}>Revisar produtos da NF-e</Text>
              <Text style={s.panelSub}>
                {items.length} produto{items.length !== 1 ? "s" : ""} encontrado
                {items.length !== 1 ? "s" : ""} · {selectedCount} selecionado
                {selectedCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={s.closeBtn}>
              <Text style={s.closeBtnTxt}>✕</Text>
            </Pressable>
          </View>

          {/* Markup bulk */}
          <View style={s.markupRow}>
            <Text style={s.markupLabel}>Aplicar margem (%):</Text>
            <View style={s.markupPresets}>
              {MARKUP_PRESETS.map(p => (
                <Pressable
                  key={p}
                  style={s.markupPresetBtn}
                  onPress={() => {
                    setMarkupPct(String(p));
                    applyBulkMarkup(p);
                  }}
                >
                  <Text style={s.markupPresetTxt}>{p}%</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.markupCustom}>
              <TextInput
                style={s.markupInput}
                value={markupPct}
                onChangeText={setMarkupPct}
                placeholder="custom %"
                keyboardType="numeric"
                placeholderTextColor={Colors.ink3}
              />
              <Pressable
                style={s.markupApplyBtn}
                onPress={() => {
                  const n = parseFloat(markupPct.replace(",", "."));
                  if (!isNaN(n)) applyBulkMarkup(n);
                }}
              >
                <Text style={s.markupApplyTxt}>Aplicar</Text>
              </Pressable>
            </View>
          </View>

          {/* Tabela */}
          <ScrollView horizontal showsHorizontalScrollIndicator style={s.tableScroll}>
            <View style={s.table}>
              {/* Cabeçalho */}
              <View style={[s.tableRow, s.tableHead]}>
                <Pressable
                  style={[s.colCheck]}
                  onPress={() => toggleAll(!allSelected)}
                >
                  <View style={[s.checkbox, allSelected && s.checkboxChecked]}>
                    {allSelected && <Text style={s.checkmark}>✓</Text>}
                  </View>
                </Pressable>
                <Text style={[s.colHdr, s.colName]}>Produto</Text>
                <Text style={[s.colHdr, s.colQty]}>Qtd</Text>
                <Text style={[s.colHdr, s.colCost]}>Custo NF</Text>
                <Text style={[s.colHdr, s.colPrice]}>Preço venda</Text>
                <Text style={[s.colHdr, s.colNcm]}>NCM</Text>
                <Text style={[s.colHdr, s.colColor]}>Cor</Text>
                <Text style={[s.colHdr, s.colCat]}>Categoria</Text>
              </View>

              {/* Linhas */}
              {items.map((it, idx) => {
                const ncmLen = it.ncm_edit.length;
                const ncmSuggestion = suggestNcm(it.name);
                return (
                  <View
                    key={idx}
                    style={[
                      s.tableRow,
                      idx % 2 === 0 ? s.rowEven : s.rowOdd,
                      !it.selected && s.rowDeselected,
                    ]}
                  >
                    {/* Check */}
                    <Pressable
                      style={s.colCheck}
                      onPress={() => updateItem(idx, "selected", !it.selected)}
                    >
                      <View style={[s.checkbox, it.selected && s.checkboxChecked]}>
                        {it.selected && <Text style={s.checkmark}>✓</Text>}
                      </View>
                    </Pressable>

                    {/* Nome */}
                    <TextInput
                      value={it.name}
                      onChangeText={v => updateItem(idx, "name", v)}
                      style={[s.cellInput, s.colName]}
                      placeholderTextColor={Colors.ink3}
                    />

                    {/* Qtd */}
                    <Text style={[s.cellText, s.colQty]}>{it.quantity}</Text>

                    {/* Custo NF — Fix #4: editável */}
                    <TextInput
                      value={it.cost_edit}
                      keyboardType="numeric"
                      onChangeText={v =>
                        updateItem(idx, "cost_edit", maskCurrency(unmaskNumber(v)))
                      }
                      style={[s.cellInput, s.colCost] as any}
                      placeholderTextColor={Colors.ink3}
                    />

                    {/* Preço venda */}
                    <TextInput
                      value={it.price}
                      keyboardType="numeric"
                      onChangeText={v =>
                        updateItem(idx, "price", maskCurrency(unmaskNumber(v)))
                      }
                      style={[s.cellInput, s.colPrice] as any}
                      placeholderTextColor={Colors.ink3}
                    />

                    {/* NCM — badge + sugestão */}
                    <View style={[s.colNcm, { position: "relative", flexDirection: "row", alignItems: "center" }]}>
                      <TextInput
                        value={it.ncm_edit}
                        onChangeText={v =>
                          updateItem(idx, "ncm_edit", v.replace(/\D/g, "").slice(0, 8))
                        }
                        keyboardType="number-pad"
                        maxLength={8}
                        placeholder="00000000"
                        placeholderTextColor={Colors.ink3}
                        style={[s.cellInput, { flex: 1, paddingRight: 28 }]}
                      />
                      <Pressable
                        style={[
                          s.ncmBadgeCell,
                          ncmLen === 8
                            ? s.ncmBadgeValid
                            : ncmLen > 0
                              ? s.ncmBadgePartial
                              : s.ncmBadgeEmpty,
                        ]}
                        onPress={
                          ncmSuggestion && ncmLen < 8
                            ? () => updateItem(idx, "ncm_edit", ncmSuggestion.ncm)
                            : undefined
                        }
                      >
                        <Text style={s.ncmBadgeTxt}>
                          {ncmLen === 8
                            ? "✓"
                            : ncmLen > 0
                              ? ncmLen + "/8"
                              : ncmSuggestion
                                ? "💡"
                                : "—"}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Cor */}
                    <TextInput
                      value={it.color}
                      onChangeText={v => updateItem(idx, "color", v)}
                      placeholder="ex: preto"
                      style={[s.cellInput, s.colColor]}
                      placeholderTextColor={Colors.ink3}
                    />

                    {/* Categoria */}
                    {IS_WEB ? (
                      <select
                        value={it.category}
                        onChange={e => updateItem(idx, "category", (e.target as any).value)}
                        style={{
                          width: 110,
                          height: 32,
                          background: "transparent",
                          border: "none",
                          color: Colors.ink,
                          fontSize: 12,
                          cursor: "pointer",
                        } as any}
                      >
                        {ALL_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <Text style={[s.cellText, s.colCat]}>{it.category}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={s.panelFooter}>
            <Pressable style={s.cancelBtn} onPress={handleClose}>
              <Text style={s.cancelBtnTxt}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[s.importBtn, selectedCount === 0 && s.importBtnDisabled]}
              onPress={selectedCount > 0 ? handleImport : undefined}
            >
              <Text style={s.importBtnTxt}>
                Importar {selectedCount} produto{selectedCount !== 1 ? "s" : ""}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "importing" && (
        <View style={[s.panel, s.panelSmall]}>
          <View style={s.importingBody}>
            <ActivityIndicator size="large" color={Colors.violet} />
            <Text style={s.importingTxt}>
              Importando produtos... {importedCount} de{" "}
              {items.filter(i => i.selected).length}
            </Text>
          </View>
        </View>
      )}

      {step === "done" && (
        <View style={[s.panel, s.panelSmall]}>
          <View style={s.doneBody}>
            <Text style={s.doneIcon}>✅</Text>
            <Text style={s.doneTitle}>
              {importedCount} produto{importedCount !== 1 ? "s" : ""} importado
              {importedCount !== 1 ? "s" : ""}
            </Text>
            <Text style={s.doneSub}>O estoque foi atualizado com sucesso.</Text>
            <Pressable style={s.importBtn} onPress={handleSuccess}>
              <Text style={s.importBtnTxt}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Parser XML ───────────────────────────────────────────────────────────────

function parseDanfeXml(xmlText: string): DanfeItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const items: DanfeItem[] = [];

  // Suporte a namespace e sem namespace
  const detNodes = doc.querySelectorAll("det");

  detNodes.forEach(det => {
    const prod = det.querySelector("prod");
    if (!prod) return;

    const description = prod.querySelector("xProd")?.textContent?.trim() || "";
    const ncm = prod.querySelector("NCM")?.textContent?.trim() || "";
    const quantity = parseFloat(prod.querySelector("qCom")?.textContent || "0");
    const unit_value = parseFloat(prod.querySelector("vUnCom")?.textContent || "0");
    const total_value = parseFloat(prod.querySelector("vProd")?.textContent || "0");

    // Custo: usa vUnCom como proxy do custo de aquisição
    const unit_cost = unit_value;

    if (description) {
      items.push({ description, ncm, quantity, unit_value, unit_cost, total_value });
    }
  });

  return items;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Fix #5: position fixed para ficar sempre na viewport
  overlay: {
    position: (IS_WEB ? "fixed" : "absolute") as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,8,20,0.72)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: 16,
  } as any,

  panel: {
    backgroundColor: "#1a1528",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.22)",
    overflow: "hidden",
    maxHeight: IS_WEB ? "92vh" : "92%",
  } as any,
  panelUpload: { width: 420, maxWidth: "100%" },
  panelWide: { width: "100%", maxWidth: 1140 },
  panelSmall: { width: 360, maxWidth: "100%" },

  panelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.15)",
  },
  panelTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.3 },
  panelSub: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  closeBtn: { padding: 6 },
  closeBtnTxt: { fontSize: 16, color: Colors.ink3 },

  uploadBody: { padding: 32, alignItems: "center", gap: 12 },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(124,58,237,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  uploadIconTxt: { fontSize: 28 },
  uploadTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  uploadSub: { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 320, lineHeight: 20 },
  uploadBtn: {
    marginTop: 8,
    backgroundColor: Colors.violet,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  uploadBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorTxt: { color: "#f87171", fontSize: 13 },

  markupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.12)",
    flexWrap: "wrap",
  },
  markupLabel: { fontSize: 12, color: Colors.ink3, marginRight: 4 },
  markupPresets: { flexDirection: "row", gap: 6 },
  markupPresetBtn: {
    backgroundColor: "rgba(124,58,237,0.12)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.25)",
  },
  markupPresetTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  markupCustom: { flexDirection: "row", gap: 6, alignItems: "center" },
  markupInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: Colors.ink,
    fontSize: 12,
    width: 80,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
  },
  markupApplyBtn: {
    backgroundColor: "rgba(124,58,237,0.18)",
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
  },
  markupApplyTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  tableScroll: { flex: 1 },
  table: { minWidth: "100%" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    paddingVertical: 2,
  },
  tableHead: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.2)",
    paddingVertical: 6,
  },
  rowEven: { backgroundColor: "rgba(255,255,255,0.02)" },
  rowOdd: { backgroundColor: "transparent" },
  rowDeselected: { opacity: 0.45 },

  colCheck: { width: 36, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  colName: { width: 220, paddingHorizontal: 6, flexShrink: 0 },
  colQty: { width: 50, paddingHorizontal: 4, flexShrink: 0, textAlign: "center" },
  colCost: { width: 90, paddingHorizontal: 4, flexShrink: 0 },
  colPrice: { width: 90, paddingHorizontal: 4, flexShrink: 0 },
  colNcm: { width: 108, paddingHorizontal: 4, flexShrink: 0 },
  colColor: { width: 90, paddingHorizontal: 4, flexShrink: 0 },
  colCat: { width: 110, paddingHorizontal: 4, flexShrink: 0 },

  colHdr: { fontSize: 11, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },

  cellInput: {
    height: 32,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 6,
    paddingHorizontal: 7,
    color: Colors.ink,
    fontSize: 12,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.15)",
  },
  cellText: { fontSize: 12, color: Colors.ink3 },

  // NCM badge
  ncmBadgeCell: {
    position: "absolute",
    right: 6,
    top: "50%" as any,
    transform: IS_WEB ? ([{ translateY: "-50%" }] as any) : [{ translateY: -10 }],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  ncmBadgeValid: { backgroundColor: "rgba(52,211,153,0.15)" },
  ncmBadgePartial: { backgroundColor: "rgba(251,191,36,0.15)" },
  ncmBadgeEmpty: { backgroundColor: "rgba(124,58,237,0.12)" },
  ncmBadgeTxt: { fontSize: 10, fontWeight: "700", color: Colors.ink3 },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(124,58,237,0.4)",
    backgroundColor: "rgba(124,58,237,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.violet,
    borderColor: Colors.violet,
  },
  checkmark: { fontSize: 11, color: "#fff", fontWeight: "700" },

  panelFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.15)",
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  cancelBtnTxt: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  importBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.violet,
  },
  importBtnDisabled: { opacity: 0.45 },
  importBtnTxt: { fontSize: 14, color: "#fff", fontWeight: "700" },

  importingBody: { padding: 40, alignItems: "center", gap: 16 },
  importingTxt: { fontSize: 14, color: Colors.ink3 },

  doneBody: { padding: 40, alignItems: "center", gap: 12 },
  doneIcon: { fontSize: 40 },
  doneTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  doneSub: { fontSize: 13, color: Colors.ink3, textAlign: "center" },
});
