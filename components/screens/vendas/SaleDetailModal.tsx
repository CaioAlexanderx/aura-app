import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Image, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useSaleDetail, useCancelSale, useUpdateSaleSeller, useEmitNfce, useReemitTrocaFiscal } from "@/hooks/useSales";
import { employeesApi, request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { printReceipt } from "@/services/creditApi";

// ============================================================
// AURA. — Modal de detalhes da venda (Item 3 Eryca)
//
// MULTICNPJ Onda 2.4 (03/05/2026): aceita prop `companyId` opcional.
//
// 02/06/2026 — Troca segmentada: quando sale.type='troca', o card de total
// vira um card de troca (Levou / Devolveu / Diferença / Pagamentos /
// Conciliação no Financeiro) e o "Cancelar venda" vira "Cancelar troca"
// (reverte estoque dos dois lados + transações + NF-e). Dados no bloco
// detail.troca (backend Aura-backend#138).
//
// 02/06/2026 (b) — Secao "Nota fiscal": mostra o status da emissao da venda
// (detail.fiscal) e um botao pra Emitir NFC-e (venda) ou Reprocessar a NF-e
// 55 de devolucao (troca). Links DANFE/consulta quando autorizada; motivo
// quando rejeitada.
//
// 02/06/2026 (c) — Polish: busca /nfce/config (lazy) pra (1) esconder o botao
// Emitir quando a empresa nao tem NFC-e ativa, mostrando uma nota de config;
// (2) marcar com badge "teste/homologacao" quando ambiente=homologacao (a
// nota sai como 'autorizada' fake, sem valor fiscal real).
//
// DESIGN-38 B5 (11/06/2026) — Botao "Recibo" em actionsRow:
// Aparece quando sale.payment_method === 'crediario' e há transaction_id.
// Chama printReceipt(effectiveCompanyId, transaction_id) — mesmo padrão
// auth do printCarne (fetch com Bearer → document.write em nova aba).
// Só visível para vendas não canceladas.
// ============================================================

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };
var fmtDateTime = function(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  credit: "Cartao Credito",
  credito: "Cartao Credito",
  cartao: "Cartao Credito",
  debit: "Cartao Debito",
  debito: "Cartao Debito",
  crediario: "Crediario",
  crediario_credito: "Credito da troca",
  voucher: "Voucher",
  vale: "Vale",
};

const FISCAL_STATUS_LABELS: Record<string, string> = {
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  processando: "Processando",
  pendente: "Pendente",
  falha: "Falha",
  cancelada: "Cancelada",
  erro: "Erro",
};

const TROCA_ORANGE = "#fb923c";

function fiscalStatusLabel(st: string) {
  return FISCAL_STATUS_LABELS[(st || "").toLowerCase()] || st || "—";
}

export function SaleDetailModal({
  visible, saleId, onClose, onEditTransaction,
  companyId, companyName,
}: {
  visible: boolean;
  saleId: string | null;
  onClose: () => void;
  onEditTransaction?: (transactionId: string) => void;
  companyId?: string;
  companyName?: string;
}) {
  const { detail, isLoading, error } = useSaleDetail(visible ? saleId : null, companyId);
  const { cancelSale, isCancelling } = useCancelSale(companyId);
  const { updateSeller, isUpdating } = useUpdateSaleSeller(companyId);
  const { emitNfce, isEmitting } = useEmitNfce(companyId);
  const { reemitTrocaFiscal, isReemitting } = useReemitTrocaFiscal(companyId);
  const { company } = useAuthStore();
  const effectiveCompanyId = companyId || company?.id;

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [editingSeller, setEditingSeller] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  // DESIGN-38 B5: estado de loading do botão Recibo
  const [printingReceipt, setPrintingReceipt] = useState(false);

  const { data: empData, isLoading: isLoadingEmps } = useQuery({
    queryKey: ["employees", effectiveCompanyId],
    queryFn: function() {
      if (!effectiveCompanyId) throw new Error("no company");
      return employeesApi.list(effectiveCompanyId);
    },
    enabled: editingSeller && !!effectiveCompanyId,
    staleTime: 60_000,
    retry: 1,
  });
  const employees: any[] = (empData as any)?.employees || [];

  // 02/06/2026 (c): config fiscal (lazy) — so quando o detalhe abriu.
  // Cache longo: config raramente muda.
  const { data: nfceCfg } = useQuery({
    queryKey: ["nfce-config", effectiveCompanyId],
    queryFn: function() {
      if (!effectiveCompanyId) throw new Error("no company");
      return request("/companies/" + effectiveCompanyId + "/nfce/config", { retry: 1 });
    },
    enabled: !!effectiveCompanyId && !!detail,
    staleTime: 300_000,
    retry: 1,
  });

  if (!visible) return null;

  async function handleConfirmCancel() {
    if (!saleId) return;
    try {
      const result = await cancelSale({ saleId: saleId, reason: cancelReason.trim() });
      if ((result as any)?.type === "troca") {
        toast.success("Troca cancelada. Estoque dos dois lados revertido e financeiro ajustado.");
        const warns = (result as any)?.fiscal_warnings;
        if (Array.isArray(warns) && warns.length) {
          toast.error("Atencao fiscal: " + warns[0]);
        }
      } else {
        toast.success(
          "Venda cancelada. " + result.items_returned + " item(s) devolvido(s) ao estoque e " +
          fmt(result.refunded_amount) + " removido(s) da receita."
        );
      }
      setConfirmCancel(false);
      setCancelReason("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao cancelar venda");
    }
  }

  function handleEditClick() {
    const txId = detail?.sale.transaction_id;
    if (!txId) {
      toast.error("Esta venda nao tem lancamento financeiro vinculado");
      return;
    }
    if (onEditTransaction) {
      onClose();
      onEditTransaction(txId);
    }
  }

  function handleOpenSellerEdit() {
    setSelectedSellerId((seller as any)?.id || null);
    setEditingSeller(true);
  }

  async function handleSaveSeller() {
    if (!saleId) return;
    try {
      await updateSeller({ saleId: saleId, seller_id: selectedSellerId });
      toast.success(selectedSellerId ? "Vendedor atualizado." : "Vendedor removido.");
      setEditingSeller(false);
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao salvar vendedor");
    }
  }

  function openFiscalLink(em: any) {
    const url = (em && (em.pdf_url || em.url_consulta)) || null;
    if (url) { try { Linking.openURL(url); } catch (_) {} }
  }

  async function handleEmitFiscal() {
    if (!saleId || !sale) return;
    try {
      if (isTroca) {
        const r = await reemitTrocaFiscal({ trocaSaleId: saleId });
        const po = (r && r.fiscal && r.fiscal.per_origin) || [];
        const okAny = po.some(function(p: any) { return (p.status || "").toLowerCase().indexOf("autoriz") >= 0; });
        const errAny = po.find(function(p: any) { return p.error || (p.status || "").toLowerCase().indexOf("rejeit") >= 0; });
        if (okAny) toast.success("NF-e de devolucao reprocessada com sucesso.");
        else if (errAny) toast.error("Reprocessada com pendencia: " + (errAny.error || fiscalStatusLabel(errAny.status)));
        else toast.success((r && r.message) || "Reprocessamento disparado.");
      } else {
        const body = {
          sale_id: saleId,
          tipo: "nfce" as const,
          payment_method: sale.payment_method || "dinheiro",
          items: items.map(function(it) {
            return {
              product_id: it.product_id,
              product_name: it.product_name,
              quantity: it.quantity,
              unit_price: it.unit_price,
              discount: it.discount,
            };
          }),
        };
        const r = await emitNfce({ body: body });
        const st = (r && r.nfce && r.nfce.status) || "";
        if (st === "rejeitada") toast.error("NFC-e rejeitada: " + ((r && r.motivo) || "ver detalhe"));
        else if (r && r.idempotent) toast.success("Esta venda ja tinha NFC-e emitida.");
        else toast.success("NFC-e emitida com sucesso.");
      }
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao emitir nota fiscal");
    }
  }

  // DESIGN-38 B5: imprimir recibo de pagamento crediário
  async function handlePrintReceipt() {
    const txId = detail?.sale.transaction_id;
    if (!txId || !effectiveCompanyId) {
      toast.error("Recibo indisponível: venda sem transação vinculada");
      return;
    }
    setPrintingReceipt(true);
    try {
      await printReceipt(effectiveCompanyId, txId);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao abrir recibo");
    } finally {
      setPrintingReceipt(false);
    }
  }

  const sale = detail?.sale;
  const isCancelled = sale?.status === "cancelled";
  const items = detail?.items || [];
  const customer = detail?.customer;
  const seller = detail?.seller;
  const paymentLabel = sale?.payment_method ? (PAYMENT_LABELS[sale.payment_method.toLowerCase()] || sale.payment_method) : "-";

  // 02/06/2026: troca segmentada
  const isTroca = (sale?.type as string) === "troca";
  const troca = detail?.troca || null;

  // DESIGN-38 B5: botão Recibo — só para vendas crediário não canceladas com transaction_id
  const isCrediario = (sale?.payment_method || "").toLowerCase() === "crediario";
  const showReceiptBtn = !isCancelled && isCrediario && !!sale?.transaction_id;

  // 02/06/2026 (b): estado fiscal — emissao relevante por tipo de venda.
  const fiscalList = detail?.fiscal || [];
  const relTipos = isTroca ? ["nfe", "nfe_devolucao"] : ["nfce"];
  const relevantFiscal = fiscalList.filter(function(f) { return relTipos.indexOf(f.tipo) >= 0; });
  const authorizedEmission = relevantFiscal.find(function(f) { return f.status === "autorizada"; }) || null;
  const latestFiscal = relevantFiscal.length ? relevantFiscal[0] : null;
  const fiscalDocLabel = isTroca ? "NF-e de devolucao" : "NFC-e";
  const fiscalBusy = isEmitting || isReemitting;

  // 02/06/2026 (c): config fiscal — habilita o botao + sinaliza homologacao.
  const fiscalEnabled = !!((nfceCfg as any)?.config?.is_active);
  const fiscalAmbiente = (nfceCfg as any)?.config?.ambiente || null;
  const fiscalHomolog = fiscalEnabled && fiscalAmbiente === "homologacao";

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <View style={s.headerTitleRow}>
              <Text style={s.headerTitle}>{isTroca ? "Detalhes da troca" : "Detalhes da venda"}</Text>
              {isTroca && !isCancelled && (
                <View style={s.trocaBadge}>
                  <Icon name="repeat" size={9} color={TROCA_ORANGE} />
                  <Text style={s.trocaBadgeText}>Troca</Text>
                </View>
              )}
              {isCancelled && (
                <View style={s.cancelledBadge}>
                  <Text style={s.cancelledText}>Cancelada</Text>
                </View>
              )}
              {companyName && (
                <View style={s.companyBadge}>
                  <Text style={s.companyBadgeText} numberOfLines={1}>{companyName}</Text>
                </View>
              )}
            </View>
            {sale && <Text style={s.headerDate}>{fmtDateTime(sale.created_at)}</Text>}
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>x</Text>
          </Pressable>
        </View>

        {/* Loading / Error */}
        {isLoading && (
          <View style={s.loadingBox}>
            <ActivityIndicator color={Colors.violet3} />
            <Text style={s.loadingText}>Carregando venda...</Text>
          </View>
        )}
        {error && !isLoading && (
          <View style={s.errorBox}>
            <Icon name="alert" size={16} color={Colors.red} />
            <Text style={s.errorText}>{(error as any)?.data?.error || error.message || "Erro ao carregar"}</Text>
          </View>
        )}

        {/* Conteudo */}
        {detail && sale && (
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 4 }}>
            {/* Venda normal: card de total */}
            {!isTroca && (
              <View style={[s.totalCard, isCancelled && s.totalCardCancelled]}>
                <Text style={s.totalLabel}>Valor da venda</Text>
                <Text style={[s.totalValue, isCancelled && s.totalValueStrike]}>{fmt(sale.total_amount)}</Text>
                {sale.discount_amount > 0 && (
                  <Text style={s.totalHint}>Desconto: {fmt(sale.discount_amount)}</Text>
                )}
                <View style={s.totalMetaRow}>
                  <View style={s.totalMetaItem}>
                    <Text style={s.totalMetaLabel}>Pagamento</Text>
                    <Text style={s.totalMetaValue}>{paymentLabel}</Text>
                  </View>
                  <View style={s.totalMetaItem}>
                    <Text style={s.totalMetaLabel}>Itens</Text>
                    <Text style={s.totalMetaValue}>{items.length}</Text>
                  </View>
                  {sale.coupon_code && (
                    <View style={s.totalMetaItem}>
                      <Text style={s.totalMetaLabel}>Cupom</Text>
                      <Text style={s.totalMetaValue}>{sale.coupon_code}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Troca: card segmentado */}
            {isTroca && troca && (
              <View style={[s.trocaCard, isCancelled && s.totalCardCancelled]}>
                {/* Levou */}
                <View style={s.trocaSegHead}>
                  <Text style={[s.trocaSegTitle, { color: Colors.green }]}>Levou (produtos novos)</Text>
                  <Text style={[s.trocaSegVal, { color: Colors.green }]}>{fmt(troca.new_value)}</Text>
                </View>
                {/* Devolveu */}
                <View style={s.trocaDivider} />
                <View style={s.trocaSegHead}>
                  <Text style={[s.trocaSegTitle, { color: TROCA_ORANGE }]}>Devolveu (produtos retirados)</Text>
                  <Text style={[s.trocaSegVal, { color: TROCA_ORANGE }]}>- {fmt(troca.returned_value)}</Text>
                </View>
                {troca.returned_items.map(function(ri, idx) {
                  return (
                    <View key={idx} style={s.trocaItemRow}>
                      <View style={s.trocaItemThumb}>
                        {ri.image_url ? (
                          <Image source={{ uri: ri.image_url }} style={s.itemImageInner} />
                        ) : (
                          <Icon name="package" size={12} color={Colors.ink3} />
                        )}
                      </View>
                      <Text style={s.trocaItemName} numberOfLines={1}>{ri.product_name}</Text>
                      <Text style={s.trocaItemMeta}>{ri.quantity}x</Text>
                      <Text style={s.trocaItemPrice}>{fmt(ri.unit_price)}</Text>
                    </View>
                  );
                })}
                {/* Diferenca */}
                <View style={s.trocaDiff}>
                  <Text style={s.trocaDiffLabel}>
                    {troca.net_amount >= 0 ? "Diferenca — cliente pagou" : "Diferenca — loja devolveu"}
                  </Text>
                  <Text style={s.trocaDiffVal}>{fmt(Math.abs(troca.net_amount))}</Text>
                </View>
                {/* Pagamentos */}
                {troca.payments && troca.payments.length > 0 && (
                  <View style={s.trocaSub}>
                    <Text style={s.trocaSubLabel}>Formas de pagamento</Text>
                    <View style={s.trocaPayWrap}>
                      {troca.payments.map(function(p, idx) {
                        var lbl = PAYMENT_LABELS[(p.method || "").toLowerCase()] || p.method;
                        return (
                          <View key={idx} style={s.trocaPill}>
                            <Text style={s.trocaPillTxt}>{lbl} · {fmt(p.amount)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                {/* Conciliacao financeiro */}
                <View style={s.trocaSub}>
                  <Text style={s.trocaSubLabel}>Conciliacao no Financeiro</Text>
                  <View style={s.trocaFinRow}>
                    <Text style={s.trocaFinLab}>Troca - Venda</Text>
                    <Text style={[s.trocaFinVal, { color: Colors.green }]}>+ {fmt(troca.new_value)}</Text>
                  </View>
                  <View style={s.trocaFinRow}>
                    <Text style={s.trocaFinLab}>Troca - Devolucao</Text>
                    <Text style={[s.trocaFinVal, { color: Colors.red }]}>- {fmt(troca.returned_value)}</Text>
                  </View>
                  <View style={[s.trocaFinRow, s.trocaFinNet]}>
                    <Text style={[s.trocaFinLab, { fontWeight: "800", color: Colors.ink }]}>Liquido</Text>
                    <Text style={[s.trocaFinVal, { color: TROCA_ORANGE, fontWeight: "800" }]}>+ {fmt(troca.net_amount)}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={s.peopleRow}>
              <View style={s.personCard}>
                <Icon name="users" size={12} color={Colors.ink3} />
                <Text style={s.personLabel}>Cliente</Text>
                <Text style={s.personValue} numberOfLines={1}>
                  {customer?.name || "Nao identificado"}
                </Text>
                {customer?.phone && <Text style={s.personHint}>{customer.phone}</Text>}
              </View>
              <View style={s.personCard}>
                <View style={s.personCardHeader}>
                  <Icon name="user_plus" size={12} color={Colors.ink3} />
                  {!isCancelled && (
                    <Pressable onPress={handleOpenSellerEdit} style={s.editSellerBtn}>
                      <Icon name="edit" size={11} color={Colors.violet3} />
                    </Pressable>
                  )}
                </View>
                <Text style={s.personLabel}>Vendedora</Text>
                <Text style={s.personValue} numberOfLines={1}>
                  {seller?.name || "Nao informada"}
                </Text>
              </View>
            </View>

            <Text style={s.sectionTitle}>{isTroca ? "Produtos levados" : "Mercadorias"}</Text>
            <View style={s.itemsBox}>
              {items.length === 0 && (
                <Text style={s.noItems}>Esta venda nao possui itens.</Text>
              )}
              {items.map(function(item) {
                return (
                  <View key={item.id} style={s.itemRow}>
                    <View style={s.itemImage}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={s.itemImageInner} />
                      ) : (
                        <Icon name="package" size={14} color={Colors.ink3} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName} numberOfLines={2}>{item.product_name}</Text>
                      <Text style={s.itemMeta}>
                        {item.quantity}x {fmt(item.unit_price)}
                        {item.discount > 0 ? "  - " + fmt(item.discount) : ""}
                      </Text>
                    </View>
                    <Text style={s.itemTotal}>{fmt(item.total_price)}</Text>
                  </View>
                );
              })}
            </View>

            {sale.notes && (
              <View style={s.notesBox}>
                <Text style={s.notesLabel}>Observacoes</Text>
                <Text style={s.notesText}>{sale.notes}</Text>
              </View>
            )}

            {/* 02/06/2026 (b/c): Nota fiscal */}
            {!isCancelled && (
              <View style={s.fiscalBox}>
                <View style={s.fiscalHeadRow}>
                  <Text style={s.fiscalTitle}>Nota fiscal</Text>
                  {fiscalHomolog && (
                    <View style={s.fiscalHomologPill}>
                      <Text style={s.fiscalHomologText}>Teste · homologacao</Text>
                    </View>
                  )}
                </View>
                {authorizedEmission ? (
                  <View style={s.fiscalRow}>
                    <View style={s.fiscalOkPill}>
                      <Icon name="info" size={11} color={Colors.green} />
                      <Text style={s.fiscalOkText}>
                        {fiscalDocLabel}{authorizedEmission.numero ? (" no " + authorizedEmission.numero) : ""} autorizada
                      </Text>
                    </View>
                    {(authorizedEmission.pdf_url || authorizedEmission.url_consulta) && (
                      <Pressable onPress={function() { openFiscalLink(authorizedEmission); }} style={s.fiscalLinkBtn}>
                        <Icon name="info" size={12} color={Colors.violet3} />
                        <Text style={s.fiscalLinkText}>{authorizedEmission.pdf_url ? "Ver DANFE" : "Consultar SEFAZ"}</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <>
                    {latestFiscal && latestFiscal.status !== "autorizada" ? (
                      <View style={s.fiscalErr}>
                        <Icon name="alert" size={12} color={Colors.red} />
                        <Text style={s.fiscalErrText}>
                          {fiscalStatusLabel(latestFiscal.status)}
                          {latestFiscal.error_message ? (" — " + latestFiscal.error_message) : ""}
                        </Text>
                      </View>
                    ) : (
                      <Text style={s.fiscalNone}>
                        {isTroca ? "A NF-e de devolucao desta troca ainda nao foi emitida." : "Esta venda ainda nao tem NFC-e emitida."}
                      </Text>
                    )}
                    {fiscalEnabled ? (
                      <Pressable
                        onPress={handleEmitFiscal}
                        disabled={fiscalBusy}
                        style={[s.actionBtn, s.fiscalEmitBtn]}
                      >
                        {fiscalBusy ? (
                          <ActivityIndicator color={Colors.violet3} size="small" />
                        ) : (
                          <>
                            <Icon name="info" size={13} color={Colors.violet3} />
                            <Text style={s.fiscalEmitText}>
                              {isTroca ? "Reprocessar NF-e de devolucao" : "Emitir NFC-e"}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    ) : (
                      <Text style={s.fiscalConfigNote}>
                        Emissao de nota fiscal nao configurada. Ative em Configuracoes › Nota Fiscal.
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}

            {isCancelled && sale.cancelled_at && (
              <View style={s.cancelledHint}>
                <Icon name="info" size={12} color={Colors.red} />
                <Text style={s.cancelledHintText}>
                  {isTroca
                    ? "Esta troca foi cancelada em " + fmtDateTime(sale.cancelled_at) + ". Estoque dos dois lados revertido e financeiro ajustado."
                    : "Esta venda foi cancelada em " + fmtDateTime(sale.cancelled_at) + ". O estoque foi devolvido e o valor saiu da receita."}
                </Text>
              </View>
            )}

            <View style={s.actionsRow}>
              {sale.transaction_id && onEditTransaction && !isTroca && (
                <Pressable
                  onPress={handleEditClick}
                  style={[s.actionBtn, s.actionEdit]}
                >
                  <Icon name="edit" size={13} color={Colors.violet3} />
                  <Text style={s.actionEditText}>Editar lancamento</Text>
                </Pressable>
              )}
              {/* DESIGN-38 B5: botão Recibo para vendas crediário */}
              {showReceiptBtn && (
                <Pressable
                  onPress={handlePrintReceipt}
                  disabled={printingReceipt}
                  style={[s.actionBtn, s.actionReceipt, printingReceipt && { opacity: 0.6 }]}
                >
                  {printingReceipt ? (
                    <ActivityIndicator color={Colors.violet3} size="small" />
                  ) : (
                    <>
                      <Icon name="info" size={13} color={Colors.violet3} />
                      <Text style={s.actionReceiptText}>Recibo</Text>
                    </>
                  )}
                </Pressable>
              )}
              {!isCancelled && (
                <Pressable
                  onPress={function() { setConfirmCancel(true); }}
                  disabled={isCancelling}
                  style={[s.actionBtn, s.actionCancel]}
                >
                  {isCancelling ? (
                    <ActivityIndicator color={Colors.red} size="small" />
                  ) : (
                    <>
                      <Icon name="x" size={13} color={Colors.red} />
                      <Text style={s.actionCancelText}>{isTroca ? "Cancelar troca" : "Cancelar venda"}</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Confirmar cancelamento */}
      {confirmCancel && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmModal}>
            <Text style={s.confirmTitle}>{isTroca ? "Cancelar troca?" : "Cancelar venda?"}</Text>
            <Text style={s.confirmMsg}>
              {isTroca
                ? "Os produtos novos voltam ao estoque, o produto devolvido sai do estoque, as transacoes da troca somem do financeiro e a NF-e de devolucao nao autorizada e removida. Acao irreversivel."
                : "Os " + items.length + " item(s) voltam para o estoque e o valor sai da receita. Esta acao nao pode ser desfeita."}
            </Text>
            <Text style={s.confirmFieldLabel}>Motivo (opcional)</Text>
            <TextInput
              style={s.confirmInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ex: cliente desistiu, produto trocado..."
              placeholderTextColor={Colors.ink3}
              multiline
              maxLength={200}
            />
            <View style={s.confirmActions}>
              <Pressable
                onPress={function() { setConfirmCancel(false); setCancelReason(""); }}
                style={s.confirmBtnCancel}
                disabled={isCancelling}
              >
                <Text style={s.confirmBtnCancelText}>Voltar</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmCancel}
                style={s.confirmBtnConfirm}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.confirmBtnConfirmText}>{isTroca ? "Sim, cancelar troca" : "Sim, cancelar venda"}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Picker de vendedor */}
      {editingSeller && (
        <View style={s.confirmOverlay}>
          <View style={s.sellerPickerModal}>
            <Text style={s.confirmTitle}>Alterar vendedora</Text>
            {isLoadingEmps ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={Colors.violet3} />
              </View>
            ) : (
              <ScrollView style={s.sellerList} contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false}>
                <Pressable
                  onPress={function() { setSelectedSellerId(null); }}
                  style={[s.sellerItem, selectedSellerId === null && s.sellerItemSelected]}
                >
                  <Text style={[s.sellerItemText, selectedSellerId === null && s.sellerItemTextSelected]}>
                    Sem vendedor
                  </Text>
                </Pressable>
                {employees.map(function(emp: any) {
                  const isSelected = selectedSellerId === emp.id;
                  return (
                    <Pressable
                      key={emp.id}
                      onPress={function() { setSelectedSellerId(emp.id); }}
                      style={[s.sellerItem, isSelected && s.sellerItemSelected]}
                    >
                      <Text style={[s.sellerItemText, isSelected && s.sellerItemTextSelected]}>
                        {emp.name}
                      </Text>
                    </Pressable>
                  );
                })}
                {employees.length === 0 && (
                  <Text style={s.noItems}>Nenhum funcionario cadastrado.</Text>
                )}
              </ScrollView>
            )}
            <View style={s.confirmActions}>
              <Pressable
                onPress={function() { setEditingSeller(false); }}
                style={s.confirmBtnCancel}
                disabled={isUpdating}
              >
                <Text style={s.confirmBtnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveSeller}
                style={s.confirmBtnConfirm}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.confirmBtnConfirmText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center",
    zIndex: 100,
  },
  modal: {
    backgroundColor: Colors.bg3, borderRadius: 20, padding: 24,
    maxWidth: 580, width: "92%", borderWidth: 1, borderColor: Colors.border2,
    maxHeight: "92%",
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  headerTitle: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  headerDate: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  cancelledBadge: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.red + "55" },
  cancelledText: { fontSize: 9, color: Colors.red, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  trocaBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(251,146,60,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(251,146,60,0.4)" },
  trocaBadgeText: { fontSize: 9, color: TROCA_ORANGE, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  companyBadge: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(124,58,237,0.28)", maxWidth: 200 },
  companyBadgeText: { fontSize: 9, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.4 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },

  loadingBox: { paddingVertical: 50, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: Colors.redD, borderRadius: 10, borderWidth: 1, borderColor: Colors.red + "33" },
  errorText: { flex: 1, fontSize: 12, color: Colors.red },

  totalCard: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  totalCardCancelled: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  totalLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  totalValue: { fontSize: 28, color: Colors.green, fontWeight: "800", marginTop: 4 },
  totalValueStrike: { color: Colors.red, textDecorationLine: "line-through" as any },
  totalHint: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  totalMetaRow: { flexDirection: "row", gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, width: "100%", justifyContent: "center" },
  totalMetaItem: { alignItems: "center" },
  totalMetaLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  totalMetaValue: { fontSize: 12, color: Colors.ink, fontWeight: "600", marginTop: 3 },

  // Troca card
  trocaCard: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "rgba(251,146,60,0.25)" },
  trocaDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  trocaSegHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trocaSegTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  trocaSegVal: { fontSize: 14, fontWeight: "800" },
  trocaItemThumb: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  trocaItemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  trocaItemName: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "500" },
  trocaItemMeta: { fontSize: 11, color: Colors.ink3 },
  trocaItemPrice: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  trocaDiff: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  trocaDiffLabel: { fontSize: 12, color: Colors.ink2, fontWeight: "700" },
  trocaDiffVal: { fontSize: 20, color: TROCA_ORANGE, fontWeight: "900", letterSpacing: -0.3 },
  trocaSub: { marginTop: 12 },
  trocaSubLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 },
  trocaPayWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  trocaPill: { backgroundColor: Colors.bg3, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  trocaPillTxt: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  trocaFinRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  trocaFinLab: { fontSize: 12, color: Colors.ink2 },
  trocaFinVal: { fontSize: 12.5, fontWeight: "700" },
  trocaFinNet: { borderTopWidth: 1, borderTopColor: Colors.border2, marginTop: 5, paddingTop: 8 },

  peopleRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  personCard: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  personCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editSellerBtn: { padding: 4, borderRadius: 6, backgroundColor: Colors.violetD },
  personLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 },
  personValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  personHint: { fontSize: 10, color: Colors.ink3 },

  sectionTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
  itemsBox: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  noItems: { fontSize: 12, color: Colors.ink3, fontStyle: "italic", textAlign: "center", paddingVertical: 16 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8 },
  itemImage: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  itemImageInner: { width: 36, height: 36 },
  itemName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  itemMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  itemTotal: { fontSize: 13, color: Colors.green, fontWeight: "700" },

  notesBox: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  notesLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  notesText: { fontSize: 12, color: Colors.ink, marginTop: 4, lineHeight: 17 },

  // 02/06/2026 (b/c): Nota fiscal
  fiscalBox: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, gap: 8 },
  fiscalHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fiscalTitle: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  fiscalHomologPill: { backgroundColor: "rgba(251,191,36,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" },
  fiscalHomologText: { fontSize: 9, color: "#fbbf24", fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  fiscalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  fiscalOkPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.green + "33" },
  fiscalOkText: { fontSize: 11.5, color: Colors.green, fontWeight: "700" },
  fiscalLinkBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  fiscalLinkText: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700" },
  fiscalErr: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, backgroundColor: Colors.redD, borderRadius: 8, borderWidth: 1, borderColor: Colors.red + "33" },
  fiscalErrText: { flex: 1, fontSize: 11, color: Colors.red, lineHeight: 15 },
  fiscalNone: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },
  fiscalEmitBtn: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  fiscalEmitText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  fiscalConfigNote: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16, fontStyle: "italic" },

  cancelledHint: { flexDirection: "row", gap: 8, padding: 10, backgroundColor: Colors.redD, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: Colors.red + "33" },
  cancelledHintText: { flex: 1, fontSize: 11, color: Colors.red, lineHeight: 15 },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1, minWidth: 100 },
  actionEdit: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  actionEditText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  // DESIGN-38 B5: botão Recibo
  actionReceipt: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  actionReceiptText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  actionCancel: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  actionCancelText: { fontSize: 12, color: Colors.red, fontWeight: "600" },

  confirmOverlay: {
    position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center",
    zIndex: 200,
  },
  confirmModal: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, maxWidth: 420, width: "90%", borderWidth: 1, borderColor: Colors.border2 },
  confirmTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 8 },
  confirmMsg: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 14 },
  confirmFieldLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 },
  confirmInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: Colors.ink, minHeight: 60, textAlignVertical: "top", marginBottom: 14 },
  confirmActions: { flexDirection: "row", gap: 8 },
  confirmBtnCancel: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  confirmBtnCancelText: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  confirmBtnConfirm: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: Colors.red, alignItems: "center" },
  confirmBtnConfirmText: { fontSize: 12, color: "#fff", fontWeight: "700" },

  sellerPickerModal: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, maxWidth: 380, width: "88%", borderWidth: 1, borderColor: Colors.border2, maxHeight: "60%" },
  sellerList: { maxHeight: 280, marginBottom: 14 },
  sellerItem: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  sellerItemSelected: { backgroundColor: Colors.violetD, borderColor: Colors.violet3 },
  sellerItemText: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  sellerItemTextSelected: { color: Colors.violet3, fontWeight: "700" },
});

export default SaleDetailModal;
