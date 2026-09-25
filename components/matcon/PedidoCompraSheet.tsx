// ============================================================
// AURA. — Folha do pedido de compra (Matcon M4 #pedido)
//
// Saiu de app/(tabs)/matcon/compras.tsx em 25/09/2026, sem mudar o
// comportamento, quando Compras virou a tela de Fornecedores
// (/fornecedores). Ajusta a quantidade por item, envia no WhatsApp do
// fornecedor (wa.me síncrono no toque — utils/whatsapp.ts) e marca como
// enviado.
// ============================================================
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { matconApi, type PurchaseOrder, type PurchaseOrderItem } from "@/services/matconApi";
import { parseQtyInput, fmtQty } from "@/utils/matconUnits";
import { openWhatsApp } from "@/utils/whatsapp";
import { textoDoErro } from "@/components/matcon/erroMatcon";
import { textoPedidoWhatsApp } from "@/components/matcon/comprasUtil";

const fmtMoneyCurto = (n: number | string | null | undefined) =>
  `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;

export function PedidoCompraSheet({ order, companyId, nomeDaLoja, telefoneDoCadastro, onClose, onSalvo }: {
  order: PurchaseOrder | null;
  companyId: string | null;
  nomeDaLoja: string;
  /** WhatsApp do cadastro do fornecedor: vale quando o pedido não trouxe telefone. */
  telefoneDoCadastro?: string | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Reabre com as quantidades atuais do pedido (mesmo truque de
  // EntregaParcialSheet em entregas.tsx: chave carregada, sem efeito).
  const chaveAtual = order?.id || "";
  const [chaveCarregada, setChaveCarregada] = useState("");
  if (order && chaveAtual !== chaveCarregada) {
    const iniciais: Record<string, string> = {};
    (order.items || []).forEach((it) => { iniciais[it.product_id] = fmtQty(it.quantity); });
    setQtds(iniciais);
    setChaveCarregada(chaveAtual);
  }

  function itensAtuais(): PurchaseOrderItem[] | null {
    if (!order) return null;
    const itens: PurchaseOrderItem[] = [];
    for (const it of order.items || []) {
      const qtd = parseQtyInput(qtds[it.product_id] ?? "");
      if (qtd === null) {
        toast.error(`"${it.name}": quantidade inválida`);
        return null;
      }
      itens.push({ ...it, quantity: qtd });
    }
    return itens;
  }

  const total = order
    ? (order.items || []).reduce((acc, it) => acc + (parseQtyInput(qtds[it.product_id] ?? "") ?? 0) * (Number(it.unit_cost_est) || 0), 0)
    : 0;

  const editavel = order?.status === "draft" || order?.status === "sent";

  async function persistirEMarcarEnviado(itens: PurchaseOrderItem[]) {
    if (!order || !companyId) return;
    setBusy(true);
    try {
      const res = await matconApi.updatePurchaseOrder(companyId, order.id, {
        items: itens.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
        status: "sent",
      });
      onSalvo();
      toast.success(`Pedido #${res.order.number} marcado como enviado`);
      onClose();
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui marcar o pedido como enviado. Tente de novo em instantes."));
    } finally {
      setBusy(false);
    }
  }

  function enviarNoWhatsApp() {
    if (!order || busy) return;
    const itens = itensAtuais();
    if (!itens) return;
    const texto = textoPedidoWhatsApp({ ...order, items: itens }, nomeDaLoja);
    const telefone = order.supplier_phone || telefoneDoCadastro || null;
    if (!openWhatsApp(telefone, texto)) {
      if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
      }
    }
    persistirEMarcarEnviado(itens);
  }

  function marcarComoEnviado() {
    if (!order || busy) return;
    const itens = itensAtuais();
    if (!itens) return;
    persistirEMarcarEnviado(itens);
  }

  return (
    <ResponsiveSheet visible={!!order} onClose={onClose} maxWidth={520}>
      <>
        <View style={st.sheetHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.sheetTitle}>Pedido {order ? `#${order.number}` : ""} · {order?.supplier_name || "Fornecedor não identificado"}</Text>
            <Text style={st.sheetSub}>{editavel ? "Ajuste a quantidade de cada item antes de mandar" : "Pedido recebido"}</Text>
          </View>
          <Pressable onPress={onClose} style={st.sheetClose} testID="matcon-pedido-fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={st.sheetBody} keyboardShouldPersistTaps="handled">
          {(order?.items || []).map((it) => (
            <View key={it.product_id} style={st.sheetItemRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.sheetItemNome} numberOfLines={2}>{it.name}</Text>
                <Text style={st.sheetItemSug}>sugerido {fmtQty(it.quantity)} {it.unit || ""}</Text>
              </View>
              <TextInput
                style={st.sheetItemInput}
                value={qtds[it.product_id] ?? ""}
                editable={editavel}
                onChangeText={(v) => setQtds((prev) => ({ ...prev, [it.product_id]: v }))}
                keyboardType="decimal-pad"
                testID={`matcon-pedido-qtd-${it.product_id}`}
              />
              <Text style={st.sheetItemValor}>
                {fmtMoneyCurto((parseQtyInput(qtds[it.product_id] ?? "") ?? 0) * (Number(it.unit_cost_est) || 0))}
              </Text>
            </View>
          ))}

          <View style={st.sheetTotalRow}>
            <Text style={st.sheetTotalLabel}>Total estimado</Text>
            <Text style={st.sheetTotalValor}>{fmtMoneyCurto(total)}</Text>
          </View>

          {editavel && (
            <>
              <View style={st.acts}>
                <Pressable onPress={enviarNoWhatsApp} style={[st.sheetBtn, st.sheetBtnWa, busy && { opacity: 0.6 }]} disabled={busy} testID="matcon-pedido-enviar-whatsapp">
                  <Icon name="whatsapp" size={14} color={Colors.green} />
                  <Text style={[st.sheetBtnText, { color: Colors.green }]}>Enviar no WhatsApp para o fornecedor</Text>
                </Pressable>
                <Pressable onPress={marcarComoEnviado} style={[st.sheetBtn, busy && { opacity: 0.6 }]} disabled={busy} testID="matcon-pedido-marcar-enviado">
                  {busy ? <ActivityIndicator size="small" color={Colors.ink} /> : (
                    <>
                      <Icon name="check" size={14} color={Colors.ink} />
                      <Text style={st.sheetBtnText}>Marcar como enviado</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Text style={st.sheetNota}>&quot;Marcar como enviado&quot; é para quem prefere ligar: o pedido vai para &quot;a caminho&quot; do mesmo jeito.</Text>
            </>
          )}
        </ScrollView>
      </>
    </ResponsiveSheet>
  );
}

const st = StyleSheet.create({
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sheetSub: { fontSize: 12, color: Colors.ink3, marginTop: 2, maxWidth: 320 },
  sheetClose: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg2 },
  sheetBody: { paddingHorizontal: 18, paddingVertical: 14 },
  sheetItemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  sheetItemNome: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  sheetItemSug: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  sheetItemInput: { width: 70, textAlign: "center", fontSize: 13, fontWeight: "700", color: Colors.ink, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingVertical: 6 },
  sheetItemValor: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.ink, minWidth: 70, textAlign: "right" },
  sheetTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border2 },
  sheetTotalLabel: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  sheetTotalValor: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: "700", color: Colors.ink },
  acts: { gap: 8, marginTop: 4 },
  sheetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 10, paddingVertical: 12 },
  sheetBtnWa: { borderColor: Colors.green + "73", backgroundColor: Colors.bg3 },
  sheetBtnText: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  sheetNota: { fontSize: 11, color: Colors.ink3, marginTop: 10, marginBottom: 6, lineHeight: 16 },
});
