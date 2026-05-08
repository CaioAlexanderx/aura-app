// ============================================================
// AURA. — Estoque · DanfeImportModal (DNA TrocaModal)
//
// Importa NF-e (XML) com revisao item-a-item e bulk actions.
//
// 07/05/2026: Refeito visualmente para alinhar com a DNA da TrocaModal
// (glassmorphism violeta, stepper centralizado, footer dentro do scroll).
// Logica funcional preservada 1-pra-1: parseXml -> revisar -> importar.
//
// 08/05/2026: Categoria virou picker (ao inves de TextInput livre).
// Lista as categorias existentes da empresa, permite filtrar por busca
// e criar nova inline. Evita duplicatas por divergencia de capitalizacao.
//
// Steps logicos:
//   1. upload  — escolher arquivo XML
//   2. review  — editar nome/preco/cor/categoria + bulk actions
//   3. import  — barra de progresso
//   4. done    — tela de sucesso (espelha OpenCloseCashModal)
// ============================================================
import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { danfeApi, DanfeItem } from "@/services/danfeApi";
import { companiesApi } from "@/services/companiesApi";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { IS_WEB, webOnly } from "@/components/screens/pdv/types";
import { toast } from "@/components/Toast";
import { useProductCategories, type ProductCategory } from "@/hooks/useProductCategories";

interface Props {
  visible: boolean;
  companyId: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

type Step = "upload" | "review" | "importing" | "done";
type PickerCtx = { kind: "bulk" } | { kind: "row"; idx: number };

const MARKUP_PRESETS = [
  { label: "0%", pct: 0 },
  { label: "+30%", pct: 30 },
  { label: "+50%", pct: 50 },
  { label: "+100%", pct: 100 },
];

interface EditableItem extends DanfeItem {
  name: string;
  price: string; // maskCurrency format e.g. "35,08"
  color: string;
  category: string;
  selected: boolean;
}

function applyMarkup(unitCost: number, pct: number): string {
  const price = unitCost * (1 + pct / 100);
  const cents = Math.round(price * 100);
  return maskCurrency(String(cents));
}

const STEP_LABELS: Record<Exclude<Step, "done">, string> = {
  upload: "ARQUIVO",
  review: "REVISAR",
  importing: "IMPORTAR",
};
const STEP_ORDER: Array<Exclude<Step, "done">> = ["upload", "review", "importing"];

export function DanfeImportModal({ visible, companyId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [invoiceInfo, setInvoiceInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importedCount, setImportedCount] = useState(0);
  const [bulkColor, setBulkColor] = useState("#7c3aed");
  const [bulkCategory, setBulkCategory] = useState("");
  const fileInputRef = useRef<any>(null);

  // ── Categorias existentes da empresa ──
  const { categories: catList, create: createCat, isCreating: creatingCat } =
    useProductCategories("product");

  // ── Picker state (compartilhado entre bulk e linhas) ──
  const [pickerCtx, setPickerCtx] = useState<PickerCtx | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  function openPicker(ctx: PickerCtx) {
    setPickerCtx(ctx);
    setPickerSearch("");
  }
  function closePicker() {
    setPickerCtx(null);
    setPickerSearch("");
  }

  // Aplica a categoria escolhida conforme o contexto do picker.
  // Bulk: propaga IMEDIATAMENTE nos itens selecionados (sem precisar de "Aplicar").
  // Row: atualiza so aquela linha.
  function pickCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !pickerCtx) return;
    if (pickerCtx.kind === "bulk") {
      setBulkCategory(trimmed);
      setItems((prev) =>
        prev.map((it) => (it.selected ? { ...it, category: trimmed } : it))
      );
    } else {
      updateItem(pickerCtx.idx, "category", trimmed);
    }
    closePicker();
  }

  function clearCategoryRow(idx: number) {
    updateItem(idx, "category", "");
  }

  async function handleCreateAndPick(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      // O hook useProductCategories nao retorna a categoria criada via mutate(),
      // mas a aplicamos pelo nome direto — o backend cria e o cache invalida em seguida.
      createCat({ name: trimmed });
      pickCategory(trimmed);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar categoria");
    }
  }

  // ── Categorias filtradas pelo search do picker ──
  const filteredCats = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catList;
    return catList.filter((c) => c.name.toLowerCase().includes(q));
  }, [catList, pickerSearch]);

  const showCreateOption = useMemo(() => {
    const q = pickerSearch.trim();
    if (!q) return false;
    return !catList.some((c) => c.name.toLowerCase() === q.toLowerCase());
  }, [catList, pickerSearch]);

  // ── Reset ──
  const reset = useCallback(() => {
    setStep("upload");
    setParsing(false);
    setItems([]);
    setSupplierName(null);
    setInvoiceInfo(null);
    setError(null);
    setImportProgress({ done: 0, total: 0 });
    setImportedCount(0);
    setBulkColor("#7c3aed");
    setBulkCategory("");
    setPickerCtx(null);
    setPickerSearch("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // ── XML file picked ───────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setParsing(true);
      try {
        const text: string = await file.text();
        const result = await danfeApi.parseXml(companyId, text);
        const editableItems: EditableItem[] = result.items.map((it: DanfeItem) => ({
          ...it,
          name: it.description,
          price: applyMarkup(it.unit_cost, 0),
          color: "#7c3aed",
          category: "",
          selected: true,
        }));
        setItems(editableItems);
        setSupplierName(result.supplier_name);
        const parts: string[] = [];
        if (result.invoice_number) parts.push("NF " + result.invoice_number);
        if (result.invoice_date)
          parts.push(result.invoice_date.split("-").reverse().join("/"));
        if (result.total_value)
          parts.push(
            "R$ " +
              result.total_value
                .toFixed(2)
                .replace(".", ",")
                .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
          );
        setInvoiceInfo(parts.join(" · ") || null);
        setStep("review");
      } catch (err: any) {
        setError(err?.data?.error || err?.message || "Falha ao processar XML.");
      } finally {
        setParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [companyId]
  );

  // ── Item field updates ───────────────────────────────────────────────
  const updateItem = useCallback(
    (idx: number, field: keyof EditableItem, value: any) => {
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
      );
    },
    []
  );

  const toggleAll = useCallback((checked: boolean) => {
    setItems((prev) => prev.map((it) => ({ ...it, selected: checked })));
  }, []);

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const applyBulkMarkup = useCallback((pct: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.selected ? { ...it, price: applyMarkup(it.unit_cost, pct) } : it
      )
    );
  }, []);

  const applyBulkColor = useCallback((color: string) => {
    setItems((prev) => prev.map((it) => (it.selected ? { ...it, color } : it)));
  }, []);

  // ── Import ───────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    const selected = items.filter((it) => it.selected);
    if (selected.length === 0) {
      toast.error("Selecione ao menos um produto para importar.");
      return;
    }
    setStep("importing");
    setImportProgress({ done: 0, total: selected.length });
    let ok = 0;
    for (const it of selected) {
      try {
        const priceCents = parseInt(unmaskNumber(it.price) || "0", 10);
        const price = priceCents / 100;
        await companiesApi.createProduct(companyId, {
          name: it.name || it.description,
          price: price,
          cost: it.unit_cost,
          color: it.color || null,
          category: it.category || null,
          sku: it.supplier_code || null,
          barcode: it.ean || null,
          ncm: it.ncm || null,
          stock_qty: Math.round(it.quantity),
          unit: it.unit,
        });
        ok++;
      } catch {
        /* skip individual failures silently */
      }
      setImportProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setImportedCount(ok);
    setStep("done");
  }, [items, companyId]);

  const handleDone = useCallback(() => {
    onSuccess(importedCount);
    reset();
    onClose();
  }, [importedCount, onSuccess, onClose, reset]);

  const selectedCount = items.filter((it) => it.selected).length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  if (!visible) return null;

  // ── Estilo do painel — glassmorphism violeta canonico ──
  const panelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.97)" : "rgba(255,255,255,0.97)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.30)",
    boxShadow: IS_DARK_MODE
      ? "0 24px 60px -10px rgba(0,0,0,0.70)"
      : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });

  // O modal cresce no passo review (tabela 7 colunas).
  const isWideStep = step === "review";

  // ── Mapinha de cor por nome de categoria pra exibir dot na linha ──
  const catByName: Record<string, ProductCategory> = useMemo(() => {
    const m: Record<string, ProductCategory> = {};
    for (const c of catList) m[c.name.toLowerCase()] = c;
    return m;
  }, [catList]);

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={handleClose} />
      <View
        style={[
          s.panel,
          isWideStep && s.panelWide,
          IS_WEB ? (panelWeb as any) : { backgroundColor: Colors.bg3 },
        ]}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.headerIco}>
              <Icon name="upload" size={15} color="#a78bfa" />
            </View>
            <Text style={s.headerTitle}>Importar DANFE (XML)</Text>
          </View>
          <Pressable onPress={handleClose} style={s.closeBtn}>
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        </View>

        {/* Stepper — esconde no done */}
        {step !== "done" && (
          <View style={s.stepBar}>
            {STEP_ORDER.map((stKey, idx) => {
              const curIdx = STEP_ORDER.indexOf(step as any);
              const myIdx = idx;
              const done = curIdx > myIdx;
              const active = curIdx === myIdx;
              return (
                <View key={stKey} style={s.stepItem}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                    {done ? (
                      <Icon name="check" size={9} color="#fff" />
                    ) : (
                      <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{myIdx + 1}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      s.stepLabel,
                      (active || done) && { color: active ? "#a78bfa" : Colors.ink3 },
                    ]}
                  >
                    {STEP_LABELS[stKey]}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── UPLOAD ────────────────────────────────────────────────── */}
        {step === "upload" && (
          <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
            {error && (
              <View style={[s.diff, s.diffDown]}>
                <Icon name="alert" size={12} color={Colors.red} />
                <Text style={[s.diffTxt, { color: Colors.red }]} numberOfLines={2}>
                  {error}
                </Text>
              </View>
            )}

            <Text style={s.sectionTitle}>Selecione o arquivo XML da NF-e</Text>

            <View style={s.uploadCard}>
              <View style={s.uploadIcoWrap}>
                <Icon name="file_text" size={28} color="#a78bfa" />
              </View>
              <Text style={s.uploadTitle}>Arraste ou clique para escolher</Text>
              <Text style={s.uploadSub}>
                Apenas o arquivo .xml gerado pela SEFAZ — não o PDF nem imagem.
              </Text>

              {Platform.OS === "web" ? (
                <View style={{ position: "relative", marginTop: 18 }}>
                  <View style={[s.btnPri, { paddingHorizontal: 22, paddingVertical: 11 }]}>
                    {parsing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.btnPriTxt}>Escolher arquivo .xml</Text>
                    )}
                  </View>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    disabled={parsing}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: parsing ? "wait" : "pointer",
                      width: "100%",
                      height: "100%",
                    } as any}
                    onChange={handleFileChange}
                  />
                </View>
              ) : (
                <Text style={[s.helpTxt, { marginTop: 14 }]}>
                  Disponível apenas na versão web.
                </Text>
              )}
            </View>

            <View style={s.stepFooter}>
              <Text style={s.footerTxt}>PASSO 1 DE 3</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={s.btnSec} onPress={handleClose}>
                  <Text style={s.btnSecTxt}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ─── REVIEW ────────────────────────────────────────────────── */}
        {step === "review" && (
          <View style={{ flex: 1, minHeight: 0 }}>
            {/* Supplier info strip — padrao info-strip da TrocaModal */}
            {(supplierName || invoiceInfo) && (
              <View style={[s.infoStrip, { marginHorizontal: 20, marginTop: 14, marginBottom: 8 }]}>
                {supplierName && (
                  <Text style={s.infoStripTitle}>{supplierName}</Text>
                )}
                {invoiceInfo && (
                  <Text style={s.infoStripSub}>{invoiceInfo}</Text>
                )}
              </View>
            )}

            {/* Bulk actions bar */}
            <View style={s.bulkBar}>
              <Pressable onPress={() => toggleAll(!allSelected)} style={s.checkboxTouch}>
                <View
                  style={[
                    s.checkbox,
                    allSelected && {
                      backgroundColor: Colors.violet,
                      borderColor: Colors.violet,
                    },
                  ]}
                >
                  {allSelected && <Text style={s.checkMark}>✓</Text>}
                </View>
                <Text style={s.bulkLabel}>
                  {selectedCount}/{items.length}
                </Text>
              </Pressable>

              <View style={s.bulkSep} />

              {MARKUP_PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => applyBulkMarkup(p.pct)}
                  style={s.presetBtn}
                >
                  <Text style={s.presetTxt}>{p.label}</Text>
                </Pressable>
              ))}

              <View style={s.bulkSep} />

              {/* Bulk color swatch */}
              <View style={{ position: "relative", width: 30, height: 30 }}>
                <View style={[s.colorPreview, { backgroundColor: bulkColor }]} />
                {Platform.OS === "web" && (
                  <input
                    type="color"
                    value={bulkColor}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                      width: "100%",
                      height: "100%",
                    } as any}
                    onChange={(e: any) => {
                      const c = e.target.value;
                      setBulkColor(c);
                      applyBulkColor(c);
                    }}
                  />
                )}
              </View>

              {/* Bulk category — picker */}
              <Pressable
                onPress={() => openPicker({ kind: "bulk" })}
                style={[s.catTrigger, { minWidth: 180 }]}
              >
                {(() => {
                  const c = catByName[bulkCategory.toLowerCase()];
                  return (
                    <>
                      {c?.color ? (
                        <View style={[s.catDot, { backgroundColor: c.color }]} />
                      ) : (
                        <View style={[s.catDot, s.catDotEmpty]} />
                      )}
                      <Text
                        style={[s.catTriggerTxt, !bulkCategory && s.catTriggerTxtPh]}
                        numberOfLines={1}
                      >
                        {bulkCategory || "Categoria…"}
                      </Text>
                      <Icon name="chevron_down" size={11} color={Colors.ink3} />
                    </>
                  );
                })()}
              </Pressable>
            </View>

            {/* Table header */}
            <View style={s.tableHeader}>
              <View style={s.colCheck} />
              <Text style={[s.colHdr, s.colName]}>Produto</Text>
              <Text style={[s.colHdr, s.colQty]}>Qtd</Text>
              <Text style={[s.colHdr, s.colCost]}>Custo NF</Text>
              <Text style={[s.colHdr, s.colPrice]}>Venda</Text>
              <Text style={[s.colHdr, s.colColor]}>Cor</Text>
              <Text style={[s.colHdr, s.colCat]}>Categoria</Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {items.map((it, idx) => (
                <View
                  key={idx}
                  style={[
                    s.row,
                    !it.selected && { opacity: 0.45 },
                  ]}
                >
                  {/* Checkbox */}
                  <Pressable
                    onPress={() => updateItem(idx, "selected", !it.selected)}
                    style={s.colCheck}
                  >
                    <View
                      style={[
                        s.checkbox,
                        it.selected && {
                          backgroundColor: Colors.violet,
                          borderColor: Colors.violet,
                        },
                      ]}
                    >
                      {it.selected && <Text style={s.checkMark}>✓</Text>}
                    </View>
                  </Pressable>

                  {/* Name */}
                  <TextInput
                    value={it.name}
                    onChangeText={(v) => updateItem(idx, "name", v)}
                    style={[s.cellInput, s.colName] as any}
                    placeholderTextColor={Colors.ink3}
                  />

                  {/* Qty — read-only */}
                  <Text style={[s.cell, s.colQty]}>
                    {it.quantity % 1 === 0 ? it.quantity : it.quantity.toFixed(2)}
                  </Text>

                  {/* Cost — read-only */}
                  <Text style={[s.cell, s.colCost, { color: Colors.ink3 }]}>
                    {it.unit_cost.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </Text>

                  {/* Sell price */}
                  <TextInput
                    value={it.price}
                    keyboardType="numeric"
                    onChangeText={(v) =>
                      updateItem(idx, "price", maskCurrency(unmaskNumber(v)))
                    }
                    style={[s.cellInput, s.colPrice] as any}
                    placeholderTextColor={Colors.ink3}
                  />

                  {/* Color */}
                  <View
                    style={[
                      s.colColor,
                      {
                        position: "relative",
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <View style={[s.colorDot, { backgroundColor: it.color }]} />
                    {Platform.OS === "web" && (
                      <input
                        type="color"
                        value={it.color}
                        style={{
                          position: "absolute",
                          inset: 0,
                          opacity: 0,
                          cursor: "pointer",
                          width: "100%",
                          height: "100%",
                        } as any}
                        onChange={(e: any) => updateItem(idx, "color", e.target.value)}
                      />
                    )}
                  </View>

                  {/* Category — picker compacto */}
                  <Pressable
                    onPress={() => openPicker({ kind: "row", idx })}
                    style={[s.catTrigger, s.colCat, { paddingHorizontal: 8, height: 28 }]}
                  >
                    {(() => {
                      const c = catByName[(it.category || "").toLowerCase()];
                      return (
                        <>
                          {c?.color ? (
                            <View style={[s.catDot, { backgroundColor: c.color }]} />
                          ) : it.category ? (
                            <View style={[s.catDot, { backgroundColor: "rgba(124,58,237,0.4)" }]} />
                          ) : (
                            <View style={[s.catDot, s.catDotEmpty]} />
                          )}
                          <Text
                            style={[s.catTriggerTxt, !it.category && s.catTriggerTxtPh]}
                            numberOfLines={1}
                          >
                            {it.category || "—"}
                          </Text>
                          {it.category ? (
                            <Pressable
                              hitSlop={6}
                              onPress={(e: any) => {
                                if (e?.stopPropagation) e.stopPropagation();
                                clearCategoryRow(idx);
                              }}
                              style={{ paddingHorizontal: 2 }}
                            >
                              <Icon name="x" size={10} color={Colors.ink3} />
                            </Pressable>
                          ) : (
                            <Icon name="chevron_down" size={10} color={Colors.ink3} />
                          )}
                        </>
                      );
                    })()}
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            {/* Footer (sticky) */}
            <View style={[s.stepFooter, s.stepFooterSticky]}>
              <Text style={s.footerTxt}>
                {selectedCount} produto{selectedCount !== 1 ? "s" : ""} · PASSO 2 DE 3
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  style={s.btnSec}
                  onPress={() => {
                    setItems([]);
                    setSupplierName(null);
                    setInvoiceInfo(null);
                    setStep("upload");
                  }}
                >
                  <Text style={s.btnSecTxt}>{"<- Trocar arquivo"}</Text>
                </Pressable>
                <Pressable
                  onPress={handleImport}
                  disabled={selectedCount === 0}
                  style={[s.btnPri, selectedCount === 0 && { opacity: 0.45 }, { minWidth: 160 }]}
                >
                  <Text style={s.btnPriTxt}>
                    {selectedCount > 0
                      ? "Importar (" + selectedCount + ")"
                      : "Importar"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* ═══ PICKER OVERLAY (categorias) ═══ */}
            {pickerCtx && (
              <View style={s.pickerOverlay} pointerEvents="box-none">
                <Pressable style={s.pickerBackdrop} onPress={closePicker} />
                <View style={s.pickerCard}>
                  <View style={s.pickerHeader}>
                    <Text style={s.pickerTitle}>
                      {pickerCtx.kind === "bulk"
                        ? "Aplicar categoria nos selecionados"
                        : "Escolher categoria"}
                    </Text>
                    <Pressable onPress={closePicker} style={s.pickerClose}>
                      <Icon name="x" size={12} color={Colors.ink3} />
                    </Pressable>
                  </View>
                  <TextInput
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder="Buscar ou criar categoria…"
                    placeholderTextColor={Colors.ink3}
                    style={s.pickerSearch as any}
                    autoFocus
                  />
                  <ScrollView style={s.pickerList} contentContainerStyle={{ gap: 2 }}>
                    {filteredCats.length === 0 && !showCreateOption && (
                      <Text style={s.pickerEmpty}>
                        Nenhuma categoria. Digite acima para criar.
                      </Text>
                    )}
                    {filteredCats.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => pickCategory(c.name)}
                        style={s.pickerItem}
                      >
                        {c.color ? (
                          <View style={[s.catDot, { backgroundColor: c.color }]} />
                        ) : (
                          <View style={[s.catDot, s.catDotEmpty]} />
                        )}
                        <Text style={s.pickerItemName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        {c.product_count > 0 ? (
                          <Text style={s.pickerItemCount}>{c.product_count}</Text>
                        ) : null}
                      </Pressable>
                    ))}
                    {showCreateOption && (
                      <Pressable
                        onPress={() => handleCreateAndPick(pickerSearch)}
                        style={[s.pickerItem, s.pickerItemCreate]}
                        disabled={creatingCat}
                      >
                        <View style={[s.catDot, { backgroundColor: "rgba(124,58,237,0.5)", borderStyle: "dashed", borderWidth: 1, borderColor: "rgba(124,58,237,0.7)" }]} />
                        <Text style={s.pickerItemCreateTxt} numberOfLines={1}>
                          {creatingCat ? "Criando…" : '+ Criar "' + pickerSearch.trim() + '"'}
                        </Text>
                      </Pressable>
                    )}
                  </ScrollView>
                  {pickerCtx.kind === "row" && items[pickerCtx.idx]?.category ? (
                    <Pressable
                      onPress={() => {
                        clearCategoryRow(pickerCtx.idx);
                        closePicker();
                      }}
                      style={s.pickerClear}
                    >
                      <Icon name="x" size={11} color={Colors.ink3} />
                      <Text style={s.pickerClearTxt}>Remover categoria desta linha</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ─── IMPORTING ────────────────────────────────────────────────────── */}
        {step === "importing" && (
          <ScrollView style={s.body} contentContainerStyle={[s.bodyContent, { alignItems: "center", paddingVertical: 36 }]}>
            <ActivityIndicator size="large" color={Colors.violet} />
            <Text style={[s.sectionTitle, { marginTop: 16, textAlign: "center" }]}>
              Importando {importProgress.done}/{importProgress.total}…
            </Text>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {
                    width:
                      importProgress.total > 0
                        ? ((importProgress.done / importProgress.total) * 100 + "%") as any
                        : "0%",
                  },
                ]}
              />
            </View>
            <Text style={[s.helpTxt, { marginTop: 14, textAlign: "center" }]}>
              Não feche esta janela enquanto a importação estiver em andamento.
            </Text>
          </ScrollView>
        )}

        {/* ─── DONE ──────────────────────────────────────────────────────────── */}
        {step === "done" && (
          <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
            <View style={s.successHero}>
              <View style={s.successCheck}>
                <Icon name="check" size={26} color={Colors.green} />
              </View>
              <Text style={s.successTitle}>
                {importedCount} produto{importedCount !== 1 ? "s" : ""} importado
                {importedCount !== 1 ? "s" : ""}
              </Text>
              <Text style={s.successSub}>
                Estoque atualizado com as quantidades da NF-e
              </Text>
            </View>

            <View style={s.stepFooter}>
              <View style={{ flex: 1 }} />
              <Pressable style={[s.btnPri, { minWidth: 140 }]} onPress={handleDone}>
                <Text style={s.btnPriTxt}>Concluir</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── Styles (DNA TrocaModal + extras pra tabela e picker) ─────────────────
const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  panel: {
    width: "100%" as any,
    maxWidth: 580,
    maxHeight: "90vh" as any,
    borderRadius: 16,
    overflow: "hidden" as any,
    zIndex: 1,
  },
  panelWide: {
    maxWidth: 1100,
    height: "90vh" as any,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  // Stepper
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.10)",
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.violet },
  stepDotDone: { backgroundColor: "#34d399" },
  stepDotTxt: { fontSize: 10, fontWeight: "700", color: Colors.ink3 },
  stepLabel: { fontSize: 10, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.3 },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 28, gap: 10 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4,
  },
  helpTxt: { fontSize: 11, color: Colors.ink3, lineHeight: 15, marginTop: 6 },

  // Info strip
  infoStrip: {
    padding: 10, borderRadius: 8,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderLeftWidth: 3, borderLeftColor: Colors.violet,
  },
  infoStripTitle: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  infoStripSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  // Diff banner (erro)
  diff: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9,
    borderWidth: 1,
  },
  diffDown: {
    backgroundColor: "rgba(248,113,113,0.10)",
    borderColor: "rgba(248,113,113,0.25)",
  },
  diffTxt: { fontSize: 12, fontWeight: "600", flex: 1 },

  // Upload card
  uploadCard: {
    borderWidth: 1,
    borderStyle: "dashed" as any,
    borderColor: "rgba(124,58,237,0.30)",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.04)",
  },
  uploadIcoWrap: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: "rgba(124,58,237,0.15)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  uploadTitle: {
    fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 4,
  },
  uploadSub: {
    fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 17,
    maxWidth: 320,
  },

  // Bulk bar
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.10)",
  },
  checkboxTouch: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: "rgba(124,58,237,0.40)",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkMark: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 13 },
  bulkLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  bulkSep: {
    width: 1, height: 20,
    backgroundColor: "rgba(124,58,237,0.18)",
    marginHorizontal: 4,
  },
  presetBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  presetTxt: { fontSize: 11, color: Colors.ink2, fontWeight: "600" },
  colorPreview: {
    width: 28, height: 28, borderRadius: 7,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
  },

  // Category trigger (substitui o TextInput livre)
  catTrigger: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    borderRadius: 7, paddingHorizontal: 10,
    height: 30,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  catTriggerTxt: { fontSize: 12, color: Colors.ink, fontWeight: "600", flex: 1 },
  catTriggerTxtPh: { color: Colors.ink3, fontWeight: "400" },
  catDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  catDotEmpty: {
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
    borderStyle: "dashed",
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.10)",
  },
  colHdr: {
    fontSize: 10, fontWeight: "700", color: Colors.ink3,
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  colCheck: { width: 32, alignItems: "center" },
  colName: { flex: 2, paddingHorizontal: 4 },
  colQty: { width: 50, textAlign: "center" },
  colCost: { width: 86, textAlign: "right", paddingRight: 8 },
  colPrice: { width: 96, paddingHorizontal: 4 },
  colColor: { width: 36 },
  colCat: { flex: 1, paddingHorizontal: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.06)",
  },
  cell: { fontSize: 12, color: Colors.ink },
  cellInput: {
    fontSize: 12, color: Colors.ink,
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 6, paddingHorizontal: 8, height: 28,
    paddingVertical: Platform.OS === "ios" ? 4 : 0,
    outlineStyle: "none",
  } as any,
  colorDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
  },

  // Step footer (interno) e variante sticky
  stepFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.12)",
  },
  stepFooterSticky: {
    marginTop: 0,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "rgba(9,12,26,0.55)",
    borderTopColor: "rgba(124,58,237,0.18)",
  },
  footerTxt: { fontSize: 11, fontWeight: "600", color: Colors.ink3, letterSpacing: 0.3 },

  // Buttons
  btnSec: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  btnSecTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  btnPri: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    backgroundColor: Colors.violet,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    minWidth: 110,
  },
  btnPriTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Progresso (importing)
  progressTrack: {
    width: "70%" as any,
    maxWidth: 360,
    height: 6,
    borderRadius: 3,
    marginTop: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  progressFill: {
    height: "100%" as any,
    borderRadius: 3,
    backgroundColor: Colors.violet,
  },

  // Sucesso
  successHero: {
    alignItems: "center",
    paddingVertical: 22,
    borderRadius: 12,
    backgroundColor: "rgba(52,211,153,0.06)",
    borderWidth: 1, borderColor: "rgba(52,211,153,0.18)",
  },
  successCheck: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(52,211,153,0.14)",
    borderWidth: 2, borderColor: Colors.green,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  successTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  successSub: { fontSize: 12, color: Colors.ink3, marginTop: 4, textAlign: "center" },

  // Picker overlay
  pickerOverlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBackdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  pickerCard: {
    width: "100%" as any,
    maxWidth: 380,
    maxHeight: 460,
    backgroundColor: "rgba(18,10,35,0.99)",
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.40)",
    overflow: "hidden",
    zIndex: 1,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 16px 40px -8px rgba(0,0,0,0.6)" } as any)
      : {}),
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124,58,237,0.18)",
  },
  pickerTitle: { fontSize: 12, fontWeight: "700", color: Colors.ink, textTransform: "uppercase", letterSpacing: 0.8 },
  pickerClose: {
    width: 26, height: 26, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pickerSearch: {
    margin: 12,
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    color: Colors.ink, fontSize: 13,
    outlineStyle: "none",
  } as any,
  pickerList: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    maxHeight: 280,
  },
  pickerEmpty: {
    fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 18,
  },
  pickerItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  pickerItemName: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "500" },
  pickerItemCount: {
    fontSize: 10, color: Colors.ink3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
  },
  pickerItemCreate: {
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
    borderStyle: "dashed",
    marginTop: 4,
  },
  pickerItemCreateTxt: { flex: 1, fontSize: 13, color: "#a78bfa", fontWeight: "700" },
  pickerClear: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.18)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  pickerClearTxt: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
});

export default DanfeImportModal;
