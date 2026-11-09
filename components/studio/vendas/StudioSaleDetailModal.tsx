// ============================================================
// AURA STUDIO · Vendas — modal de detalhe / edição / cancelamento.
//
// 20/07/2026 — tela "Vendas" do Studio (paridade Negócio, tema Studio):
//   - Visualiza a venda (salesApi.get): itens, cliente, pagamento, fiscal.
//   - 09/11/2026: a "edição completa" (qtd / preço / desconto por item) saiu.
//     O backend nunca editou itens: ignorava o corpo, gravava o vendedor como
//     NULO e respondia ok, e a tela dizia "Venda atualizada". O PATCH agora
//     recusa campo desconhecido (400) e a tela não promete o que não existe:
//     para mudar produtos ou valores, cancela-se a venda e lança-se de novo.
//   - CANCELAMENTO (= "deleção" reversível): salesApi.cancel — estorna
//     estoque, receita e fiscal.
//   - NFC-e + comprovante não-fiscal reaproveitados do PDV.
// ============================================================
import { useCallback, useEffect, useState } from "react";
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
import { respiroInferior, telaCheia, useModalNoCelular } from "@/components/studio/modalNoCelular";

const webPointer = () => (Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {});
const webNoOutline = () => (Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {});

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao: "Cartão", credito: "Crédito", debito: "Débito", crediario: "Crediário",
};
const payLabel = (k?: string | null) => (k ? PAYMENT_LABELS[k] || k : "—");

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
  // Etapa 4 (05/10): no celular o detalhe ocupa a tela toda, com cabeçalho de uma linha.
  const celular = useModalNoCelular();
  const casca = telaCheia(celular);
  const { token } = useAuthStore();

  const [detail, setDetail] = useState<SaleDetailFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [fiscalActive, setFiscalActive] = useState(false);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !saleId) return;
    setLoading(true);
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
    else if (!visible) { setDetail(null); setConfirmCancel(false); setCancelReason(""); }
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 16 }, casca.fundo]}>
        <View style={[{ width: "100%", maxWidth: 560, maxHeight: "92%", backgroundColor: t.bg, borderRadius: 18, borderWidth: 1, borderColor: t.ink5, overflow: "hidden" }, casca.caixa]} testID="detalhe-da-venda">
          {/* Header */}
          <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: t.ink5 }, celular && { paddingLeft: 14, paddingRight: 6, paddingVertical: 4, minHeight: 52 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {celular ? null : <Text style={{ fontSize: 11, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>Vendas</Text>}
              <Text style={{ fontSize: celular ? 16 : 18, color: t.ink, fontWeight: "800" }} numberOfLines={1}>
                {isTroca ? "Detalhe da troca" : "Detalhe da venda"}
              </Text>
              {!!detail && <Text style={{ fontSize: 12, color: t.ink3, marginTop: celular ? 0 : 2 }} numberOfLines={1}>{fmtDateTime(detail.sale.created_at)}</Text>}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" style={{ width: celular ? 44 : 36, height: celular ? 44 : 36, borderRadius: 10, backgroundColor: celular ? "transparent" : t.paperCard, borderWidth: celular ? 0 : 1, borderColor: t.ink5, alignItems: "center", justifyContent: "center", ...webPointer() }}>
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
                  R$ {money(detail.sale.total_amount)}
                </Text>
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
                  Itens
                </Text>

                {detail.items.map((i, idx) => (
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
                }
                {!isCancelled && !isTroca && (
                  <Text style={{ fontSize: 11.5, color: t.ink3, marginTop: 10, lineHeight: 16 }} testID="studio-venda-sem-edicao-de-itens">
                    Produtos e valores de uma venda feita não mudam por aqui. Para corrigir, cancele a venda e lance de novo.
                  </Text>
                )}
              </View>

              {/* Fiscal (só quando fiscal ativo e não cancelada / não editando) */}
              {fiscalActive && !isCancelled && companyId && (
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
            <View style={[{ flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: t.ink5 }, celular && { paddingHorizontal: 14, paddingTop: 10, ...respiroInferior(10) }]} testID="detalhe-da-venda-rodape">
              {isCancelled ? (
                <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, alignItems: "center", ...webPointer() }}>
                  <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "800" }}>Fechar</Text>
                </Pressable>
              ) : (
                <>
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
