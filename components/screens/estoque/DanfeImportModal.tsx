import React, { useState, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { Colors } from "@/constants/colors";
import { danfeApi, DanfeItem } from "@/services/danfeApi";
import { companiesApi } from "@/services/companiesApi";
import { maskCurrency, unmaskNumber } from "@/utils/masks";

interface Props {
  visible: boolean;
  companyId: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

type Step = "upload" | "loading" | "review" | "importing" | "done";

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

export function DanfeImportModal({ visible, companyId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [invoiceInfo, setInvoiceInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importedCount, setImportedCount] = useState(0);
  const [bulkColor, setBulkColor] = useState("#7c3aed");
  const [bulkCategory, setBulkCategory] = useState("");
  const fileInputRef = useRef<any>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setItems([]);
    setSupplierName(null);
    setInvoiceInfo(null);
    setError(null);
    setImportProgress({ done: 0, total: 0 });
    setImportedCount(0);
    setBulkColor("#7c3aed");
    setBulkCategory("");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // ── XML file picked ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setStep("loading");
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
        setError(
          err?.data?.error || err?.message || "Falha ao processar XML."
        );
        setStep("upload");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [companyId]
  );

  // ── Item field updates ──────────────────────────────────────────────────────
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

  // ── Bulk actions ────────────────────────────────────────────────────────────
  const applyBulkMarkup = useCallback((pct: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.selected ? { ...it, price: applyMarkup(it.unit_cost, pct) } : it
      )
    );
  }, []);

  const applyBulkColor = useCallback((color: string) => {
    setItems((prev) =>
      prev.map((it) => (it.selected ? { ...it, color } : it))
    );
  }, []);

  const applyBulkCategory = useCallback(() => {
    if (!bulkCategory.trim()) return;
    setItems((prev) =>
      prev.map((it) =>
        it.selected ? { ...it, category: bulkCategory.trim() } : it
      )
    );
  }, [bulkCategory]);

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    const selected = items.filter((it) => it.selected);
    if (selected.length === 0) {
      Alert.alert(
        "Nenhum item selecionado",
        "Selecione ao menos um produto para importar."
      );
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: Colors.bg2 }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: Colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={[styles.closeTxt, { color: Colors.ink2 }]}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Colors.ink }]}>
            Importar DANFE (XML)
          </Text>
          <View style={{ width: 70 }} />
        </View>

        {/* ─── UPLOAD ─────────────────────────────────────────────────── */}
        {step === "upload" && (
          <View style={styles.centered}>
            {error && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: Colors.red + "15",
                    borderColor: Colors.red + "40",
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: Colors.red }]}>
                  {error}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.uploadCard,
                {
                  backgroundColor: Colors.bg3,
                  borderColor: Colors.border2,
                },
              ]}
            >
              <Text style={styles.uploadIcon}>📄</Text>
              <Text style={[styles.uploadTitle, { color: Colors.ink }]}>
                Selecione o arquivo XML da NF-e
              </Text>
              <Text style={[styles.uploadSub, { color: Colors.ink3 }]}>
                {"O arquivo .xml gerado pela SEFAZ\n(não o PDF nem imagem)"}
              </Text>
              {Platform.OS === "web" ? (
                <View style={{ position: "relative", marginTop: 20 }}>
                  <View
                    style={[styles.uploadBtn, { backgroundColor: Colors.violet }]}
                  >
                    <Text style={styles.uploadBtnTxt}>Escolher arquivo .xml</Text>
                  </View>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                      width: "100%",
                      height: "100%",
                    } as any}
                    onChange={handleFileChange}
                  />
                </View>
              ) : (
                <Text style={[styles.uploadSub, { color: Colors.ink3, marginTop: 12 }]}>
                  Disponível apenas na versão web.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ─── LOADING ────────────────────────────────────────────────── */}
        {step === "loading" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.violet} />
            <Text style={[styles.loadingTxt, { color: Colors.ink2 }]}>
              Processando XML…
            </Text>
          </View>
        )}

        {/* ─── REVIEW ─────────────────────────────────────────────────── */}
        {step === "review" && (
          <View style={{ flex: 1 }}>
            {/* Supplier info strip */}
            {(supplierName || invoiceInfo) && (
              <View
                style={[
                  styles.infoBar,
                  {
                    backgroundColor: Colors.bg3,
                    borderBottomColor: Colors.border,
                  },
                ]}
              >
                {supplierName && (
                  <Text style={[styles.supplierName, { color: Colors.ink }]}>
                    {supplierName}
                  </Text>
                )}
                {invoiceInfo && (
                  <Text style={[styles.invoiceInfo, { color: Colors.ink3 }]}>
                    {invoiceInfo}
                  </Text>
                )}
              </View>
            )}

            {/* Bulk actions bar */}
            <View
              style={[
                styles.bulkBar,
                {
                  backgroundColor: Colors.bg4,
                  borderBottomColor: Colors.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggleAll(!allSelected)}
                style={styles.checkboxTouch}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: allSelected
                        ? Colors.violet
                        : "transparent",
                      borderColor: allSelected
                        ? Colors.violet
                        : Colors.border2,
                    },
                  ]}
                >
                  {allSelected && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </View>
                <Text style={[styles.bulkLabel, { color: Colors.ink3 }]}>
                  {selectedCount}/{items.length}
                </Text>
              </TouchableOpacity>

              <View style={styles.bulkSep} />

              {MARKUP_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => applyBulkMarkup(p.pct)}
                  style={[styles.presetBtn, { borderColor: Colors.border2 }]}
                >
                  <Text style={[styles.presetTxt, { color: Colors.ink2 }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={styles.bulkSep} />

              {/* Bulk color */}
              <View style={{ position: "relative", width: 30, height: 30 }}>
                <View
                  style={[
                    styles.colorPreview,
                    { backgroundColor: bulkColor, borderColor: Colors.border2 },
                  ]}
                />
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

              {/* Bulk category */}
              <TextInput
                value={bulkCategory}
                onChangeText={setBulkCategory}
                placeholder="Categoria..."
                placeholderTextColor={Colors.ink3}
                style={[
                  styles.bulkCatInput,
                  {
                    color: Colors.ink,
                    borderColor: Colors.border2,
                    backgroundColor: Colors.bg3,
                  },
                ]}
                onSubmitEditing={applyBulkCategory}
              />
              <TouchableOpacity
                onPress={applyBulkCategory}
                style={[styles.applyBtn, { backgroundColor: Colors.violetD }]}
              >
                <Text style={[styles.applyTxt, { color: Colors.violet }]}>
                  Aplicar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Table header */}
            <View
              style={[
                styles.tableHeader,
                {
                  backgroundColor: Colors.bg3,
                  borderBottomColor: Colors.border,
                },
              ]}
            >
              <View style={styles.colCheck} />
              <Text
                style={[styles.colHdr, styles.colName, { color: Colors.ink3 }]}
              >
                Produto
              </Text>
              <Text
                style={[styles.colHdr, styles.colQty, { color: Colors.ink3 }]}
              >
                Qtd
              </Text>
              <Text
                style={[styles.colHdr, styles.colCost, { color: Colors.ink3 }]}
              >
                Custo NF
              </Text>
              <Text
                style={[styles.colHdr, styles.colPrice, { color: Colors.ink3 }]}
              >
                Venda
              </Text>
              <Text
                style={[styles.colHdr, styles.colColor, { color: Colors.ink3 }]}
              >
                Cor
              </Text>
              <Text
                style={[styles.colHdr, styles.colCat, { color: Colors.ink3 }]}
              >
                Categoria
              </Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 90 }}
            >
              {items.map((it, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: Colors.border,
                      backgroundColor: it.selected ? Colors.bg2 : Colors.bg,
                    },
                  ]}
                >
                  {/* Checkbox */}
                  <TouchableOpacity
                    onPress={() => updateItem(idx, "selected", !it.selected)}
                    style={styles.colCheck}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: it.selected
                            ? Colors.violet
                            : "transparent",
                          borderColor: it.selected
                            ? Colors.violet
                            : Colors.border2,
                        },
                      ]}
                    >
                      {it.selected && (
                        <Text style={styles.checkMark}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Name */}
                  <TextInput
                    value={it.name}
                    onChangeText={(v) => updateItem(idx, "name", v)}
                    style={[
                      styles.input,
                      styles.colName,
                      { color: Colors.ink, borderColor: Colors.border2 },
                    ]}
                    placeholderTextColor={Colors.ink3}
                  />

                  {/* Qty — read-only */}
                  <Text
                    style={[
                      styles.cell,
                      styles.colQty,
                      { color: Colors.ink2 },
                    ]}
                  >
                    {it.quantity % 1 === 0
                      ? it.quantity
                      : it.quantity.toFixed(2)}
                  </Text>

                  {/* Cost — read-only */}
                  <Text
                    style={[
                      styles.cell,
                      styles.colCost,
                      { color: Colors.ink3 },
                    ]}
                  >
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
                      updateItem(
                        idx,
                        "price",
                        maskCurrency(unmaskNumber(v))
                      )
                    }
                    style={[
                      styles.input,
                      styles.colPrice,
                      { color: Colors.ink, borderColor: Colors.border2 },
                    ]}
                    placeholderTextColor={Colors.ink3}
                  />

                  {/* Color */}
                  <View
                    style={[
                      styles.colColor,
                      {
                        position: "relative",
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: it.color },
                      ]}
                    />
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
                        onChange={(e: any) =>
                          updateItem(idx, "color", e.target.value)
                        }
                      />
                    )}
                  </View>

                  {/* Category */}
                  <TextInput
                    value={it.category}
                    onChangeText={(v) => updateItem(idx, "category", v)}
                    placeholder="—"
                    placeholderTextColor={Colors.ink3}
                    style={[
                      styles.input,
                      styles.colCat,
                      { color: Colors.ink, borderColor: Colors.border2 },
                    ]}
                  />
                </View>
              ))}
            </ScrollView>

            {/* Footer */}
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: Colors.bg2,
                  borderTopColor: Colors.border,
                },
              ]}
            >
              <Text style={[styles.footerInfo, { color: Colors.ink3 }]}>
                {selectedCount} produto
                {selectedCount !== 1 ? "s" : ""} selecionado
                {selectedCount !== 1 ? "s" : ""}
              </Text>
              <TouchableOpacity
                onPress={handleImport}
                disabled={selectedCount === 0}
                style={[
                  styles.importBtn,
                  {
                    backgroundColor:
                      selectedCount > 0 ? Colors.violet : Colors.bg4,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.importBtnTxt,
                    {
                      color:
                        selectedCount > 0 ? "#fff" : Colors.ink3,
                    },
                  ]}
                >
                  {selectedCount > 0
                    ? "Importar (" + selectedCount + ")"
                    : "Importar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── IMPORTING ──────────────────────────────────────────────── */}
        {step === "importing" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.violet} />
            <Text style={[styles.loadingTxt, { color: Colors.ink }]}>
              Importando {importProgress.done}/{importProgress.total}…
            </Text>
            <View
              style={[styles.progressTrack, { backgroundColor: Colors.bg4 }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: Colors.violet,
                    width:
                      importProgress.total > 0
                        ? ((importProgress.done / importProgress.total) *
                            100 +
                            "%") as any
                        : "0%",
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ─── DONE ───────────────────────────────────────────────────── */}
        {step === "done" && (
          <View style={styles.centered}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={[styles.doneTitle, { color: Colors.ink }]}>
              {importedCount} produto{importedCount !== 1 ? "s" : ""} importado
              {importedCount !== 1 ? "s" : ""}
            </Text>
            <Text style={[styles.doneSub, { color: Colors.ink3 }]}>
              Estoque atualizado com as quantidades da NF-e
            </Text>
            <TouchableOpacity
              onPress={handleDone}
              style={[
                styles.importBtn,
                { backgroundColor: Colors.violet, marginTop: 24 },
              ]}
            >
              <Text style={styles.importBtnTxt}>Concluir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 70 },
  closeTxt: { fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    width: "100%",
    maxWidth: 420,
  },
  errorText: { fontSize: 13, lineHeight: 18 },
  uploadCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
  },
  uploadIcon: { fontSize: 48, marginBottom: 16 },
  uploadTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  uploadSub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  uploadBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  uploadBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },
  loadingTxt: { marginTop: 16, fontSize: 15 },
  infoBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  supplierName: { fontSize: 14, fontWeight: "600" },
  invoiceInfo: { fontSize: 12, marginTop: 2 },
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
    flexWrap: "wrap",
  },
  checkboxTouch: { flexDirection: "row", alignItems: "center", gap: 5 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  bulkLabel: { fontSize: 12 },
  bulkSep: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(120,100,240,0.15)",
    marginHorizontal: 2,
  },
  presetBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  presetTxt: { fontSize: 12, fontWeight: "500" },
  colorPreview: { width: 28, height: 28, borderRadius: 6, borderWidth: 1 },
  bulkCatInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    minWidth: 90,
    height: 30,
  },
  applyBtn: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  applyTxt: { fontSize: 12, fontWeight: "600" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  colHdr: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  colCheck: { width: 32, alignItems: "center" },
  colName: { flex: 2, paddingHorizontal: 4 },
  colQty: { width: 40, textAlign: "center" },
  colCost: { width: 76, textAlign: "right", paddingRight: 6 },
  colPrice: { width: 86, paddingHorizontal: 4 },
  colColor: { width: 36 },
  colCat: { flex: 1, paddingHorizontal: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: { fontSize: 13 },
  input: {
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
    height: 32,
  },
  colorDot: { width: 24, height: 24, borderRadius: 12 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  footerInfo: { fontSize: 13 },
  importBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  importBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },
  progressTrack: {
    width: "80%",
    height: 6,
    borderRadius: 3,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  doneIcon: { fontSize: 64, marginBottom: 16 },
  doneTitle: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  doneSub: { fontSize: 14, textAlign: "center" },
});
