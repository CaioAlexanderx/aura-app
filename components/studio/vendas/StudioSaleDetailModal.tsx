// ============================================================
// AURA STUDIO · Vendas — modal de detalhe / edição / cancelamento.
//
// 20/07/2026 — tela "Vendas" do Studio (paridade Negócio, tema Studio):
//   - Visualiza a venda (salesApi.get): itens, cliente, pagamento, fiscal.
//   - EDIÇÃO COMPLETA: qtd / preço unitário / desconto por item, remover
//     item e desconto da venda → salesApi.updateSale (PATCH /sales/:id).
//     ⚠️ Requer suporte no backend (ver PR); hoje o PATCH só troca vendedor.
//   - CANCELAMENTO (= "deleção" reversível): salesApi.cancel — estorna
//     estoque, receita e fiscal.
//   - NFC-e + comprovante não-fiscal reaproveitados do PDV.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, View, Text, Pressable, TextInput, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { BASE_URL } from "@/services/api";
import { openPrintWindow } from "@/services/printWindow";
import { salesApi, type SaleDetailFull } from "@/services/salesApi";
import { nfceApi } from "@/services/nfceApi";
import { NfceActions, type NfceActionsItem } from "@/components/screens/pdv/NfceActions";
import { money } from "@/components/studio/pdv/ui";
import { Ic } from "@/components/studio/pdv/icons";

const webPointer = () => (Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {});
const webNoOutline = () => (Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {});

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", credito: "Crédito", debito: "Débito", crediario: "Crediário",
};
const payLabel = (k?: string | null) => (k ? PAYMENT_LABELS[k] || k : "—");

type EditItem = {
  id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: string;
  unit_price: string;
  discount: string;
};

function toNum(s: string): number {
  const v = parseFloat((s || "").replace(",", "."));
  return isNaN(v) ? 0 : v;
}

function fmtDateTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function openPrintReceipt(companyId: string, saleId: string, token: string | null) {
  if (!token || !companyId) { toast.error("Sessão expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") { toast.info("Impressão disponível apenas na versão web"); return; }
  openPrintWindow(async () => {
    const res = await fetch(`${BASE_URL}/companies/${companyId}/print/receipt/${saleId}/preview`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false as const, error: "Erro ao gerar cupom" };
    return { ok: true as const, html: await res.text() };
  }).then((r) => { if (r === "blocked") toast.error("Pop-up bloqueado. Permita pop-ups para imprimir."); });
}

export function StudioSaleDetailModal({
  visible, saleId, companyId, onClose, onChanged,
}: {
  visible: boolean;
  saleId: string | null;
  companyId: string | undefined;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const t = useStudioTokens();
  const { token } = useAuthStore();

  const [detail, setDetail] = useState<SaleDetailFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [fiscalActive, setFiscalActive] = useState(false);

  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<EditItem[]>([]);
  const [saleDiscount, setSaleDiscount] = useState("0");
  const [saving, setSaving] = useState(false);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !saleId) return;
    setLoading(true);
    setEditing(false);
    setConfirmCancel(false);
    try {
      const d = await salesApi.get(companyId, saleId);
      setDetail(d);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar venda");
    } finally {
      setLoading(false);
    }
  }, [companyId, saleId]);

  useEffect(() => {
    if (visible && saleId) load();
    else if (!visible) { setDetail(null); setEditing(false); setConfirmCancel(false); setCancelReason(""); }
  }, [visible, saleId, load]);

  useEffect(() => {
    if (!visible || !companyId) return;
    let alive = true;
    nfceApi.getConfig(companyId)
      .then((r) => { if (alive) setFiscalActive(!!r?.config?.is_active); })
      .catch(() => { if (alive) setFiscalActive(false); });
    return () => { alive = false; };
  }, [visible, companyId]);

  const isCancelled = detail?.sale?.status === "cancelled";
  const isTroca = detail?.sale?.type === "troca";
  const canEdit = !!detail && !isCancelled && !isTroca;

  function startEdit() {
    if (!detail) return;
    setItems(detail.items.map((i) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: String(i.quantity),
      unit_price: (i.unit_price || 0).toFixed(2),
      discount: (i.discount || 0).toFixed(2),
    })));
    setSaleDiscount((detail.sale.discount_amount || 0).toFixed(2));
    setEditing(true);
  }

  function updateItem(idx: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const editedTotal = useMemo(() => {
    const sum = items.reduce((s, it) => s + Math.max(0, toNum(it.quantity) * toNum(it.unit_price) - toNum(it.discount)), 0);
    return Math.max(0, sum - toNum(saleDiscount));
  }, [items, saleDiscount]);

  async function saveEdit() {
    if (!companyId || !saleId) return;
    if (items.length === 0) { toast.error("A venda precisa de ao menos 1 item"); return; }
    setSaving(true);
    try {
      await salesApi.updateSale(companyId, saleId, {
        items: items.map((it) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: toNum(it.quantity),
          unit_price: toNum(it.unit_price),
          discount: toNum(it.discount),
        })),
        discount_amount: toNum(saleDiscount),
      });
      toast.success("Venda atualizada");
      setEditing(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar (endpoint de edição pendente no backend)");
    } finally {
      setSaving(false);
    }
  }

  async function doCancel() {
    if (!companyId || !saleId) return;
    setCancelling(true);
    try {
      const r = await salesApi.cancel(companyId, saleId, cancelReason.trim() || undefined);
      toast.success(`Venda cancelada · estornado R$ ${money(r.refunded_amount || 0)}`);
      setConfirmCancel(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  }

  const nfceItems: NfceActionsItem[] = (detail?.items || []).map((i) => ({
    product_id: i.product_id || "",
    product_name: i.product_name,
    quantity: i.quantity,
    unit_price: i.unit_price,
  }));

  const cardBase = { backgroundColor: t.paperCard, borderRadius: 12, borderWidth: 1, borderColor: t.ink5, padding: 14, marginBottom: 12 } as const;
  const smallInput = { height: 34, borderWidth: 1, borderColor: t.ink5, borderRadius: 8, backgroundColor: t.paperCardElev, color: t.ink, textAlign: "center" as const, fontSize: 13, fontWeight: "700" as const, paddingHorizontal: 6, ...webNoOutline() };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 16 }}>
        <View style={{ width: "100%", maxWidth: 560, maxHeight: "92%", backgroundColor: t.bg, borderRadius: 18, borderWidth: 1, borderColor: t.ink5, overflow: "hidden" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: t.ink5 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>Vendas</Text>
              <Text style={{ fontSize: 18, color: t.ink, fontWeight: "800" }} numberOfLines={1}>
                {isTroca ? "Detalhe da troca" : "Detalhe da venda"}
              </Text>
              {!!detail && <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }}>{fmtDateTime(detail.sale.created_at)}</Text>}
            </View>
            <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.paperCard, borderWidth: 1, borderColor: t.ink5, alignItems: "center", justifyContent: "center", ...webPointer() }}>
              <Ic name="x" size={18} color={t.ink2} />
            </Pressable>
          </View>

          {loading || !detail ? (
            <View style={{ padding: 48, alignItems: "center" }}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16 }}>
              {/* Badges */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {isCancelled && (
                  <View style={{ backgroundColor: t.dangerSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, color: t.dangerInk, fontWeight: "800" }}>Cancelada</Text>
                  </View>
                )}
                {isTroca && (
                  <View style={{ backgroundColor: t.warningSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, color: t.warningInk, fontWeight: "800" }}>Troca</Text>
                  </View>
                )}
              </View>

              {/* Total */}
              <View style={{ ...cardBase, alignItems: "center" }}>
                <Text style={{ fontSize: 11, color: t.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</Text>
                <Text style={{ fontSize: 26, color: isCancelled ? t.ink3 : t.primary, fontWeight: "800", textDecorationLine: isCancelled ? "line-through" : "none" }}>
                  R$ {money(editing ? editedTotal : detail.sale.total_amount)}
                </Text>
                {editing && <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>total recalculado</Text>}
              </View>

              {/* Meta */}
              <View style={cardBase}>
                <MetaRow t={t} label="Cliente" value={detail.customer?.name || "Consumidor"} />
                <MetaRow t={t} label="Vendedor" value={detail.seller?.name || "—"} />
                <MetaRow t={t} label="Pagamento" value={payLabel(detail.sale.payment_method)} />
                {!!detail.sale.coupon_code && <MetaRow t={t} label="Cupom" value={detail.sale.coupon_code} />}
                {!!detail.sale.notes && <MetaRow t={t} label="Observação" value={detail.sale.notes} />}
              </View>

              {/* Itens */}
              <View style={cardBase}>
                <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800", marginBottom: 10 }}>
                  {editing ? "Editar itens" : "Itens"}
                </Text>

                {editing ? (
                  <>
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 4, paddingHorizontal: 2 }}>
                      <Text style={{ flex: 1, fontSize: 10, color: t.ink3, fontWeight: "700" }}>Item</Text>
                      <Text style={{ width: 44, fontSize: 10, color: t.ink3, fontWeight: "700", textAlign: "center" }}>Qtd</Text>
                      <Text style={{ width: 66, fontSize: 10, color: t.ink3, fontWeight: "700", textAlign: "center" }}>Preço</Text>
                      <Text style={{ width: 60, fontSize: 10, color: t.ink3, fontWeight: "700", textAlign: "center" }}>Desc.</Text>
                      <View style={{ width: 30 }} />
                    </View>
                    {items.map((it, idx) => (
                      <View key={it.id || idx} style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 6, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: t.ink5 }}>
                        <Text style={{ flex: 1, fontSize: 12.5, color: t.ink, fontWeight: "600" }} numberOfLines={2}>{it.product_name}</Text>
                        <TextInput value={it.quantity} onChangeText={(v) => updateItem(idx, { quantity: v })} keyboardType="number-pad" style={{ ...smallInput, width: 44 }} />
                        <TextInput value={it.unit_price} onChangeText={(v) => updateItem(idx, { unit_price: v })} keyboardType="decimal-pad" style={{ ...smallInput, width: 66 }} />
                        <TextInput value={it.discount} onChangeText={(v) => updateItem(idx, { discount: v })} keyboardType="decimal-pad" style={{ ...smallInput, width: 60 }} />
                        <Pressable onPress={() => removeItem(idx)} disabled={items.length <= 1} style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center", opacity: items.length <= 1 ? 0.3 : 1, ...webPointer() }}>
                          <Ic name="trash" size={16} color={t.danger} />
                        </Pressable>
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.ink5 }}>
                      <Text style={{ fontSize: 12.5, color: t.ink2, fontWeight: "700" }}>Desconto da venda (R$)</Text>
                      <TextInput value={saleDiscount} onChangeText={setSaleDiscount} keyboardType="decimal-pad" style={{ ...smallInput, width: 90 }} />
                    </View>
                  </>
                ) : (
                  detail.items.map((i, idx) => (
                    <View key={i.id || idx} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: t.ink5 }}>
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <Text style={{ fontSize: 13, color: t.ink, fontWeight: "600" }} numberOfLines={2}>{i.product_name}</Text>
                        <Text style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>
                          {i.quantity} × R$ {money(i.unit_price)}{i.discount ? ` · −R$ ${money(i.discount)}` : ""}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800" }}>R$ {money(i.total_price)}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Fiscal (só quando fiscal ativo e não cancelada / não editando) */}
              {fiscalActive && !isCancelled && !editing && companyId && (
                <View style={{ ...cardBase, gap: 12 }}>
                  <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800" }}>Fiscal</Text>
                  {Platform.OS === "web" && (
                    <Pressable onPress={() => openPrintReceipt(companyId, detail.sale.id, token)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, paddingVertical: 12, borderRadius: 10, ...webPointer() }}>
                      <Ic name="receipt" size={16} color={t.ink} />
                      <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: "800" }}>Imprimir cupom</Text>
                    </Pressable>
                  )}
                  <NfceActions
                    companyId={companyId}
                    saleId={detail.sale.id}
                    items={nfceItems}
                    total={detail.sale.total_amount}
                    customerName={detail.customer?.name}
                    customerPhone={detail.customer?.phone}
                    paymentMethod={detail.sale.payment_method || undefined}
                  />
                </View>
              )}

              {/* Confirmação de cancelamento */}
              {confirmCancel ? (
                <View style={{ ...cardBase, borderColor: t.danger, gap: 10 }}>
                  <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "800" }}>Cancelar esta venda?</Text>
                  <Text style={{ fontSize: 12, color: t.ink3 }}>Estorna estoque, receita e fiscal. A venda fica marcada como cancelada.</Text>
                  <TextInput value={cancelReason} onChangeText={setCancelReason} placeholder="Motivo (opcional)" placeholderTextColor={t.ink3} style={{ height: 42, borderWidth: 1, borderColor: t.ink5, borderRadius: 10, backgroundColor: t.paperCardElev, color: t.ink, paddingHorizontal: 12, fontSize: 13.5, ...webNoOutline() }} />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable onPress={() => setConfirmCancel(false)} disabled={cancelling} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, alignItems: "center", ...webPointer() }}>
                      <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800" }}>Voltar</Text>
                    </Pressable>
                    <Pressable onPress={doCancel} disabled={cancelling} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: t.danger, alignItems: "center", opacity: cancelling ? 0.6 : 1, ...webPointer() }}>
                      <Text style={{ fontSize: 13, color: "#fff", fontWeight: "800" }}>{cancelling ? "Cancelando…" : "Confirmar"}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* Footer de ações */}
          {!!detail && !loading && !confirmCancel && (
            <View style={{ flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: t.ink5 }}>
              {editing ? (
                <>
                  <Pressable onPress={() => setEditing(false)} disabled={saving} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, alignItems: "center", ...webPointer() }}>
                    <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "800" }}>Descartar</Text>
                  </Pressable>
                  <Pressable onPress={saveEdit} disabled={saving} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.primary, alignItems: "center", opacity: saving ? 0.6 : 1, ...webPointer() }}>
                    <Text style={{ fontSize: 13.5, color: "#fff", fontWeight: "800" }}>{saving ? "Salvando…" : "Salvar alterações"}</Text>
                  </Pressable>
                </>
              ) : isCancelled ? (
                <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, alignItems: "center", ...webPointer() }}>
                  <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "800" }}>Fechar</Text>
                </Pressable>
              ) : (
                <>
                  {canEdit && (
                    <Pressable onPress={startEdit} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7, ...webPointer() }}>
                    <Ic name="edit" size={15} color={t.ink} />
                    <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "800" }}>Editar</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => setConfirmCancel(true)} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.dangerSoft, borderWidth: 1, borderColor: t.danger, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7, ...webPointer() }}>
                    <Ic name="trash" size={15} color={t.danger} />
                    <Text style={{ fontSize: 13.5, color: t.dangerInk, fontWeight: "800" }}>Cancelar venda</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MetaRow({ t, label, value }: { t: StudioPalette; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, gap: 12 }}>
      <Text style={{ fontSize: 12.5, color: t.ink3 }}>{label}</Text>
      <Text style={{ fontSize: 12.5, color: t.ink, fontWeight: "700", flexShrink: 1, textAlign: "right" }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default StudioSaleDetailModal;
