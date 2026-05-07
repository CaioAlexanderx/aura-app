// ============================================================
// AURA. — ImportDanfeModal
// 07/05/2026: importar produtos em massa a partir de PDF da DANFE.
// Fluxo: upload PDF -> backend chama Claude -> retorna preview ->
// usuario revisa/edita -> confirma -> loop POST /products.
//
// Caso de uso: cliente recebe nota fiscal (DANFE) do fornecedor com
// dezenas/centenas de produtos sem codigo de barras impresso. Cadastrar
// um a um e inviavel. A IA extrai descricao + qty + custo + NCM e o
// usuario so revisa antes de salvar em massa.
// ============================================================
import { useState, useMemo } from "react";
import {
  View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator,
  Platform, StyleSheet,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { request, companiesApi } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

const isWeb = Platform.OS === "web";

type DanfeItem = {
  idx: number;
  description: string;
  quantity: number;
  unit_cost: number;
  unit: string;
  ncm: string | null;
  supplier_code: string | null;
};

type PreviewResponse = {
  items: DanfeItem[];
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  warning?: string;
  stats?: { extracted_count: number; elapsed_ms: number };
  quota?: { used: number; limit: number };
};

type EditableItem = DanfeItem & {
  selected: boolean;
  status: "pending" | "saving" | "saved" | "error";
  error?: string | null;
  internal_code?: string;
};

// Le PDF do input file -> base64 (sem prefixo data:)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:application/pdf;base64," prefix
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Erro ao ler PDF"));
    reader.readAsDataURL(file);
  });
}

// Geracao auto de codigo interno PROD-001, PROD-002, etc.
// Cliente pode editar manualmente depois se quiser.
function autoCode(idx: number, prefix = "PROD"): string {
  return prefix + "-" + String(idx + 1).padStart(3, "0");
}

// Concorrencia 4 - evita estourar rate limit do backend ou banco.
async function runWithConcurrency<T>(
  items: T[],
  worker: (it: T, i: number) => Promise<void>,
  concurrency = 4,
) {
  let cursor = 0;
  async function loop() {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array(Math.min(concurrency, items.length)).fill(0).map(loop));
}

export function ImportDanfeModal({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete?: (count: number) => void;
}) {
  const { company } = useAuthStore();
  const qc = useQueryClient();

  const [step, setStep] = useState<"upload" | "loading" | "preview" | "saving">("upload");
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [stats, setStats] = useState<PreviewResponse["stats"] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  function reset() {
    setStep("upload");
    setSupplierName(null);
    setInvoiceNumber(null);
    setItems([]);
    setError(null);
    setWarning(null);
    setStats(null);
    setProgress({ done: 0, total: 0 });
  }

  function handleClose() {
    if (step === "loading" || step === "saving") return; // evita fechar no meio
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    if (!company?.id) {
      toast.error("Nenhuma empresa selecionada");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF da DANFE");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("PDF muito grande (max 4 MB). Comprima antes de enviar.");
      return;
    }

    setStep("loading");
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const resp = await request<PreviewResponse>(
        "/companies/" + company.id + "/products/import-danfe-preview",
        {
          method: "POST",
          body: { pdf_base64: base64 },
          retry: 0,
          timeout: 60000, // IA pode levar ate 60s em DANFEs grandes
        },
      );

      setSupplierName(resp.supplier_name);
      setInvoiceNumber(resp.invoice_number);
      setStats(resp.stats || null);
      setWarning(resp.warning || null);

      const editable: EditableItem[] = (resp.items || []).map((it) => ({
        ...it,
        selected: true,
        status: "pending",
        internal_code: autoCode(it.idx),
      }));
      setItems(editable);
      setStep("preview");
    } catch (err: any) {
      setError(err?.message || "Erro ao processar PDF");
      setStep("upload");
    }
  }

  function updateItem(idx: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((it) => (it.idx === idx ? { ...it, ...patch } : it)));
  }

  function toggleSelected(idx: number) {
    setItems((prev) => prev.map((it) => (it.idx === idx ? { ...it, selected: !it.selected } : it)));
  }

  function selectAll(value: boolean) {
    setItems((prev) => prev.map((it) => ({ ...it, selected: value })));
  }

  const selectedCount = useMemo(() => items.filter((it) => it.selected).length, [items]);
  const totalValue = useMemo(
    () => items.filter((it) => it.selected).reduce((acc, it) => acc + it.quantity * it.unit_cost, 0),
    [items],
  );

  async function handleConfirm() {
    if (!company?.id) return;
    const toSave = items.filter((it) => it.selected);
    if (toSave.length === 0) {
      toast.error("Selecione pelo menos um item");
      return;
    }

    setStep("saving");
    setProgress({ done: 0, total: toSave.length });

    let saved = 0;
    let failed = 0;

    await runWithConcurrency(
      toSave,
      async (it) => {
        try {
          updateItem(it.idx, { status: "saving" });
          await companiesApi.createProduct(company!.id, {
            name: it.description,
            sku: it.internal_code || autoCode(it.idx),
            barcode: undefined,
            category: "Produtos",
            price: 0, // preco de venda zerado — cliente preenche depois
            cost_price: it.unit_cost,
            stock_qty: it.quantity,
            min_stock: 0,
            unit: it.unit || "un",
            description: it.supplier_code ? `Cód. fornecedor: ${it.supplier_code}` : undefined,
            ncm: it.ncm || undefined,
          });
          updateItem(it.idx, { status: "saved" });
          saved++;
        } catch (e: any) {
          updateItem(it.idx, { status: "error", error: e?.message || "Erro" });
          failed++;
        } finally {
          setProgress((p) => ({ done: p.done + 1, total: p.total }));
        }
      },
      4,
    );

    qc.invalidateQueries({ queryKey: ["products", company.id] });

    if (failed === 0) {
      toast.success(`${saved} produto${saved !== 1 ? "s" : ""} cadastrado${saved !== 1 ? "s" : ""}!`);
      onComplete?.(saved);
      reset();
      onClose();
    } else {
      toast.error(`${saved} salvos, ${failed} com erro. Veja a lista.`);
      setStep("preview"); // volta pra lista pra usuario ver erros
    }
  }

  // ── Render ───────────────────────────────────────────

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Importar DANFE</Text>
              {step === "preview" && (
                <Text style={s.subtitle}>
                  {supplierName || "Fornecedor"}
                  {invoiceNumber ? " · NF-e " + invoiceNumber : ""}
                </Text>
              )}
            </View>
            <Pressable onPress={handleClose} style={s.closeBtn}>
              <Text style={s.closeText}>×</Text>
            </Pressable>
          </View>

          {step === "upload" && (
            <View style={s.uploadBody}>
              <View style={s.uploadIconWrap}>
                <Icon name="upload" size={36} color={Colors.violet3} />
              </View>
              <Text style={s.uploadTitle}>Suba o PDF da DANFE</Text>
              <Text style={s.uploadDesc}>
                A IA vai extrair descrição, quantidade, custo, NCM e código do fornecedor de cada item. Você revisa antes de cadastrar.
              </Text>
              {isWeb && (
                <View style={s.fileInputWrap}>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e: any) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                    style={{
                      position: "absolute" as any,
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                    } as any}
                  />
                  <View style={s.fileInputBtn}>
                    <Icon name="upload" size={14} color="#fff" />
                    <Text style={s.fileInputBtnText}>Selecionar PDF</Text>
                  </View>
                </View>
              )}
              {!isWeb && (
                <Text style={s.uploadDesc}>
                  Disponível apenas na versão web por enquanto.
                </Text>
              )}
              <Text style={s.uploadHint}>
                PDF máximo 4 MB · processamento leva 10–30 segundos
              </Text>
              {error && <Text style={s.errorText}>{error}</Text>}
            </View>
          )}

          {step === "loading" && (
            <View style={s.loadingBody}>
              <ActivityIndicator color={Colors.violet3} size="large" />
              <Text style={s.loadingTitle}>Extraindo itens com IA…</Text>
              <Text style={s.loadingDesc}>
                Lendo o PDF e identificando produtos. Isso pode levar até 30 segundos.
              </Text>
            </View>
          )}

          {step === "preview" && (
            <>
              <View style={s.previewSummary}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryLabel}>SELECIONADOS</Text>
                  <Text style={s.summaryValue}>{selectedCount} de {items.length}</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={s.summaryLabel}>VALOR TOTAL</Text>
                  <Text style={s.summaryValue}>R$ {totalValue.toFixed(2).replace(".", ",")}</Text>
                </View>
                <Pressable
                  onPress={() => selectAll(selectedCount !== items.length)}
                  style={s.toggleAllBtn}
                >
                  <Text style={s.toggleAllText}>
                    {selectedCount === items.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Text>
                </Pressable>
              </View>

              {warning && (
                <View style={s.warningBanner}>
                  <Text style={s.warningText}>{warning}</Text>
                </View>
              )}

              <ScrollView style={s.list} contentContainerStyle={{ padding: 6 }}>
                {items.map((it) => (
                  <View
                    key={it.idx}
                    style={[
                      s.itemCard,
                      !it.selected && s.itemCardDim,
                      it.status === "saved" && s.itemCardSaved,
                      it.status === "error" && s.itemCardError,
                    ]}
                  >
                    <View style={s.itemHeader}>
                      <Pressable onPress={() => toggleSelected(it.idx)} style={s.checkbox}>
                        {it.selected && <Text style={s.checkmark}>✓</Text>}
                      </Pressable>
                      <TextInput
                        style={s.descInput}
                        value={it.description}
                        onChangeText={(v) => updateItem(it.idx, { description: v })}
                        placeholder="Descrição"
                        placeholderTextColor={Colors.ink3}
                      />
                      {it.status === "saved" && (
                        <View style={s.statusBadge}>
                          <Text style={s.statusBadgeText}>✓ Salvo</Text>
                        </View>
                      )}
                      {it.status === "error" && (
                        <View style={[s.statusBadge, { backgroundColor: Colors.redD }]}>
                          <Text style={[s.statusBadgeText, { color: Colors.red }]}>Erro</Text>
                        </View>
                      )}
                    </View>

                    <View style={s.itemFields}>
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>Qtd</Text>
                        <TextInput
                          style={s.fieldInput}
                          value={String(it.quantity)}
                          onChangeText={(v) => updateItem(it.idx, { quantity: parseFloat(v) || 0 })}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>Un</Text>
                        <TextInput
                          style={s.fieldInput}
                          value={it.unit}
                          onChangeText={(v) => updateItem(it.idx, { unit: v })}
                        />
                      </View>
                      <View style={[s.field, { flex: 1.4 }]}>
                        <Text style={s.fieldLabel}>Custo</Text>
                        <TextInput
                          style={s.fieldInput}
                          value={String(it.unit_cost)}
                          onChangeText={(v) => updateItem(it.idx, { unit_cost: parseFloat(v) || 0 })}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={[s.field, { flex: 1.2 }]}>
                        <Text style={s.fieldLabel}>NCM</Text>
                        <TextInput
                          style={s.fieldInput}
                          value={it.ncm || ""}
                          onChangeText={(v) =>
                            updateItem(it.idx, { ncm: v.replace(/\D/g, "").slice(0, 8) || null })
                          }
                          placeholder="00000000"
                          placeholderTextColor={Colors.ink3}
                          maxLength={8}
                        />
                      </View>
                      <View style={[s.field, { flex: 1.2 }]}>
                        <Text style={s.fieldLabel}>Código</Text>
                        <TextInput
                          style={s.fieldInput}
                          value={it.internal_code || ""}
                          onChangeText={(v) => updateItem(it.idx, { internal_code: v })}
                          placeholder={autoCode(it.idx)}
                          placeholderTextColor={Colors.ink3}
                        />
                      </View>
                    </View>

                    {it.error && (
                      <Text style={s.itemError}>{it.error}</Text>
                    )}
                    {it.supplier_code && (
                      <Text style={s.itemMeta}>
                        Cód. fornecedor: <Text style={{ color: Colors.violet3 }}>{it.supplier_code}</Text>
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>

              <View style={s.footer}>
                <Pressable onPress={handleClose} style={s.cancelBtn}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirm}
                  disabled={selectedCount === 0}
                  style={[s.confirmBtn, selectedCount === 0 && { opacity: 0.4 }]}
                >
                  <Text style={s.confirmText}>
                    Cadastrar {selectedCount} {selectedCount === 1 ? "produto" : "produtos"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {step === "saving" && (
            <View style={s.loadingBody}>
              <ActivityIndicator color={Colors.violet3} size="large" />
              <Text style={s.loadingTitle}>
                Cadastrando {progress.done} de {progress.total}…
              </Text>
              <View style={s.progressBar}>
                <View
                  style={[
                    s.progressFill,
                    { width: ((progress.done / progress.total) * 100) + "%" },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  sheet: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    width: "92%",
    maxWidth: 920,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: Colors.border2,
    overflow: "hidden",
    flexDirection: "column" as any,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },

  // Upload
  uploadBody: { padding: 32, alignItems: "center", gap: 12 },
  uploadIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.violetD,
    borderWidth: 2, borderColor: "rgba(167,139,250,0.3)",
    alignItems: "center", justifyContent: "center",
    borderStyle: "dashed" as any,
  },
  uploadTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginTop: 8 },
  uploadDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, maxWidth: 420 },
  fileInputWrap: { position: "relative" as any, marginTop: 8 },
  fileInputBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.violet, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  fileInputBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  uploadHint: { fontSize: 10, color: Colors.ink3, marginTop: 4, fontStyle: "italic" as any },
  errorText: { fontSize: 12, color: Colors.red, marginTop: 6, textAlign: "center" },

  // Loading
  loadingBody: { padding: 48, alignItems: "center", gap: 14 },
  loadingTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginTop: 8 },
  loadingDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 },
  progressBar: {
    width: 280, height: 6, borderRadius: 3,
    backgroundColor: Colors.bg4, overflow: "hidden", marginTop: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.violet,
    borderRadius: 3,
  },

  // Preview
  previewSummary: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryItem: { flexDirection: "column" as any },
  summaryLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6 },
  summaryValue: { fontSize: 13, color: Colors.ink, fontWeight: "700", marginTop: 2 },
  toggleAllBtn: {
    marginLeft: "auto" as any,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
  },
  toggleAllText: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  warningBanner: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderLeftWidth: 3, borderLeftColor: Colors.amber,
    padding: 10,
    marginHorizontal: 14, marginTop: 10,
    borderRadius: 6,
  },
  warningText: { fontSize: 11.5, color: Colors.amber, lineHeight: 16 },
  list: { flex: 1, maxHeight: 480 },
  itemCard: {
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  itemCardDim: { opacity: 0.5 },
  itemCardSaved: { borderColor: "rgba(34,197,94,0.4)", backgroundColor: "rgba(34,197,94,0.06)" },
  itemCardError: { borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.06)" },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.border2,
    backgroundColor: Colors.bg3,
    alignItems: "center", justifyContent: "center",
  },
  checkmark: { color: Colors.violet3, fontSize: 14, fontWeight: "700" },
  descInput: {
    flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600",
    backgroundColor: Colors.bg3,
    borderRadius: 6, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(34,197,94,0.15)" },
  statusBadgeText: { fontSize: 10, color: Colors.green, fontWeight: "700" },
  itemFields: { flexDirection: "row", gap: 6, marginTop: 4 },
  field: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.4 },
  fieldInput: {
    backgroundColor: Colors.bg3,
    borderRadius: 6, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 12, color: Colors.ink,
  },
  itemError: { fontSize: 11, color: Colors.red, marginTop: 4 },
  itemMeta: { fontSize: 10, color: Colors.ink3, marginTop: 2 },

  footer: {
    flexDirection: "row", justifyContent: "flex-end", gap: 8,
    padding: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bg4,
  },
  cancelBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  confirmBtn: {
    backgroundColor: Colors.violet,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 8,
  },
  confirmText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default ImportDanfeModal;
