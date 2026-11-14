import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Image, Linking, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { ResponsiveSheet, SHEET_NARROW_BP } from "@/components/ResponsiveSheet";
import { toast } from "@/components/Toast";
import { useSaleDetail, useCancelSale, useEmitNfce, useReemitTrocaFiscal } from "@/hooks/useSales";
import { request, BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { openPrintWindow } from "@/services/printWindow";
import { cupomComVale } from "@/utils/valeTrocaCupom";
import { DevolucaoModal } from "@/components/crediario/DevolucaoModal";
import { router } from "expo-router";
import { ROTA_TROCA_PDV, rotuloDevolvido, mensagemCancelamento, avisoRetornosAtivos } from "@/utils/devolucaoOuTroca";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { readMatconSettings } from "@/constants/matcon";
import { matconApi } from "@/services/matconApi";
import { textoDoErro } from "@/components/matcon/erroMatcon";
import { EditarVendaModal } from "./EditarVendaModal";
import { NfseDaOrigem } from "@/components/nfse/NfseDaOrigem";
import { nfcePulada, textoServicosForaDaNfce, TEXTO_NFCE_SO_SERVICO } from "@/utils/nfseAutomatica";
// 14/11/2026 (NF-e 55, CP4): "Emitir NF-e" ao lado do "Emitir NFC-e".
import { Nfe55Wizard } from "@/components/nfe55/Nfe55Wizard";
import { abrirDanfe, baixarXml } from "@/components/nfe55/nfe55Acoes";
import { nfe55Api } from "@/services/nfe55Api";
import { AcoesDeEventosNfe } from "@/components/nfe55/EventosNfe";
import {
  brl, fmtDataHora, rotuloDaForma, normalizarMetodo, rotuloDaEdicao, mascararTelefone, mesDaVenda, diaEmSaoPaulo,
} from "./editarVendaUtils";

// ============================================================
// AURA. — Modal de detalhes da venda (Item 3 Eryca)
//
// MULTICNPJ Onda 2.4 (03/05/2026): aceita prop `companyId` opcional (a
// empresa dona da venda no consolidado). Tudo daqui — detalhe, cancelar,
// editar, nota — vai para essa empresa.
//
// 02/06/2026 — Troca segmentada (Levou / Devolveu / Diferença / Pagamentos /
// Conciliação no Financeiro); "Cancelar troca" reverte tudo (Aura-backend#138).
// 02/06/2026 (b/c) — Seção "Nota fiscal" (detail.fiscal + /nfce/config).
// DESIGN-38 B5/B4 (11/06/2026) — Recibo (cupom /print/receipt/:saleId) e
// Devolver (DevolucaoModal) na venda no crediário.
// 13/06/2026 — 2ª via térmica da NFC-e autorizada (fetch com Bearer).
// 22-23/09/2026 (Matcon M1) — selo "saldo a entregar" e "Criar entrega".
//
// 09/11/2026 — redesenho com "Editar venda" (mockup aprovado pelo Caio):
//   - ResponsiveSheet (bottom sheet abaixo de 500 px) com cabeçalho fixo,
//     conteúdo que rola e rodapé fixo com Button;
//   - "Editar venda" é a ação principal (EditarVendaModal: forma de
//     pagamento, vendedor(a) e cliente, Aura-backend#972). O caminho
//     "Editar lançamento" a partir da venda saiu: ele editava o lançamento
//     do Financeiro e deixava o caixa com a forma antiga;
//   - "Cancelar venda" vira texto vermelho à esquerda, longe da principal;
//   - formas da venda em pílulas (dividida, entrada + crediário);
//   - "Editada em dd/mm por Fulano" (detail.last_edit);
//   - sem cor fixa: o laranja #fb923c e o #fbbf24 viraram Colors.amber;
//   - ícones de verdade: fechar é Icon x; recibo, nota e 2ª via têm ícone
//     próprio (antes tudo era "info").
// ============================================================

const FISCAL_STATUS_LABELS: Record<string, string> = {
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  processando: "Processando",
  pendente: "Pendente",
  falha: "Falha",
  cancelada: "Cancelada",
  erro: "Erro",
};

function fiscalStatusLabel(st: string) {
  return FISCAL_STATUS_LABELS[(st || "").toLowerCase()] || st || "—";
}

type Pilula = { method: string; amount: number; installments?: number };

export function SaleDetailModal({
  visible, saleId, onClose,
  companyId, companyName,
}: {
  visible: boolean;
  saleId: string | null;
  onClose: () => void;
  companyId?: string;
  companyName?: string;
}) {
  const { width } = useWindowDimensions();
  const estreito = width < SHEET_NARROW_BP;
  const saleDetail = useSaleDetail(visible ? saleId : null, companyId);
  const { detail, isLoading, error } = saleDetail;
  const { cancelSale, isCancelling } = useCancelSale(companyId);
  const { emitNfce, isEmitting } = useEmitNfce(companyId);
  const { reemitTrocaFiscal, isReemitting } = useReemitTrocaFiscal(companyId);
  const { company } = useAuthStore();
  const effectiveCompanyId = companyId || company?.id;
  // 22/09/2026 (Matcon M1): selo "saldo a entregar" — só com o toggle ligado.
  const { settings: pdvSettings } = usePdvSettings();
  // 12/11/2026: o vale-troca da 2ª via segue a loja QUE VENDEU (no consolidado
  // pode ser outra): ligado/desligado e prazo em dias. Mesma loja = mesma query.
  const { settings: pdvDaLojaDaVenda } = usePdvSettings(effectiveCompanyId);
  const matcon = readMatconSettings(pdvSettings);
  const [criandoEntrega, setCriandoEntrega] = useState(false);
  const [entregaCriadaDe, setEntregaCriadaDe] = useState<string | null>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [editando, setEditando] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [showDevolucao, setShowDevolucao] = useState(false);
  const [print2via, setPrint2via] = useState(false);
  const [nfeAberta, setNfeAberta] = useState(false);
  const [enviandoNfe, setEnviandoNfe] = useState(false);

  // 02/06/2026 (c): config fiscal (lazy) — so quando o detalhe abriu.
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
      // 16/09/2026: devolução cancelada é desfeita no backend (#718).
      toast.success(mensagemCancelamento(result as any));
      const warns = (result as any)?.fiscal_warnings;
      if ((result as any)?.type === "troca" && Array.isArray(warns) && warns.length) {
        toast.error("Atenção fiscal: " + warns[0]);
      }
      setConfirmCancel(false);
      setCancelReason("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao cancelar venda");
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
        if (okAny) toast.success("NF-e de devolução reprocessada com sucesso.");
        else if (errAny) toast.error("Reprocessada com pendência: " + (errAny.error || fiscalStatusLabel(errAny.status || "")));
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
          // 13/11/2026: o desconto da venda (cupom + manual). O backend lê a
          // venda gravada e rateia nos itens; este campo é só conferência.
          ...(Number(sale.discount_amount) > 0 ? { discount_amount: Number(sale.discount_amount) } : {}),
        };
        const r = await emitNfce({ body: body });
        const st = (r && r.nfce && r.nfce.status) || "";
        // 10/11/2026 (Aura-backend#983): venda só de serviço volta 200 sem
        // nota — não é sucesso de NFC-e (a nota de serviço sai separada).
        if (nfcePulada(r)) toast.info(TEXTO_NFCE_SO_SERVICO);
        else if (st === "rejeitada") toast.error("NFC-e rejeitada: " + ((r && r.motivo) || "ver detalhe"));
        else if (r && r.idempotent) toast.success("Esta venda já tinha NFC-e emitida.");
        else toast.success("NFC-e emitida com sucesso." + (textoServicosForaDaNfce(r) ? " " + textoServicosForaDaNfce(r) : ""));
      }
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao emitir nota fiscal");
    }
  }

  // Cupom da venda via /print/receipt/:saleId/preview (fetch com Bearer).
  async function handlePrintReceipt() {
    if (!saleId || !effectiveCompanyId) {
      toast.error("Recibo indisponível para esta venda");
      return;
    }
    if (typeof window === "undefined") return;
    setPrintingReceipt(true);
    const token = useAuthStore.getState().token;
    const url = BASE_URL + "/companies/" + effectiveCompanyId + "/print/receipt/" + saleId + "/preview";
    try {
      const outcome = await openPrintWindow(async () => {
        const resp = await fetch(url, { headers: token ? { Authorization: "Bearer " + token } : {} });
        if (!resp.ok) return { ok: false as const, error: "Erro ao carregar recibo (" + resp.status + ")." };
        // 12/11/2026: 2ª via leva o vale-troca enquanto o prazo da venda vale —
        // dia da venda original + prazo da loja que vendeu (nunca hoje + N).
        const html = cupomComVale(await resp.text(), {
          companyId: effectiveCompanyId, saleId, vendaEm: (sale as any)?.created_at, config: pdvDaLojaDaVenda,
        });
        return { ok: true as const, html };
      });
      if (outcome === "blocked") toast.error("Permita pop-ups para imprimir o recibo.");
    } finally {
      setPrintingReceipt(false);
    }
  }

  // 14/11/2026 (NF-e 55, CP4): envio unitário ao e-mail do destinatário.
  async function handleEnviarNfe(emissaoId: string) {
    if (!effectiveCompanyId || enviandoNfe) return;
    setEnviandoNfe(true);
    try {
      const r = await nfe55Api.enviarEmail(effectiveCompanyId, emissaoId);
      toast.success("NF-e enviada para " + r.para);
    } catch (e: any) {
      toast.error((e && e.data && e.data.error) || (e && e.message) || "Não deu para enviar agora.");
    } finally {
      setEnviandoNfe(false);
    }
  }

  async function handlePrint2Via(nfceId: string) {
    if (!effectiveCompanyId || !nfceId) { toast.error("Nota indisponível"); return; }
    if (typeof window === "undefined") return;
    setPrint2via(true);
    const token = useAuthStore.getState().token;
    const url = BASE_URL + "/companies/" + effectiveCompanyId + "/nfce/" + nfceId + "/danfe-termica";
    try {
      const outcome = await openPrintWindow(async () => {
        const resp = await fetch(url, { headers: token ? { Authorization: "Bearer " + token } : {} });
        if (!resp.ok) return { ok: false as const, error: "Não foi possível gerar a 2ª via (" + resp.status + ")." };
        return { ok: true as const, html: await resp.text() };
      });
      if (outcome === "blocked") toast.error("Permita pop-ups para imprimir a 2ª via.");
    } finally {
      setPrint2via(false);
    }
  }

  const sale = detail?.sale;
  const isCancelled = sale?.status === "cancelled";

  async function handleCriarEntrega() {
    if (!sale || !effectiveCompanyId || criandoEntrega) return;
    setCriandoEntrega(true);
    try {
      await matconApi.createDelivery(effectiveCompanyId, { sale_id: sale.id });
      setEntregaCriadaDe(sale.id);
      toast.success("Entrega criada. Ela aparece em Entregas, em Separando.");
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui criar a entrega agora. Tente de novo daqui a pouco."));
    } finally {
      setCriandoEntrega(false);
    }
  }
  const items = detail?.items || [];
  const customer = detail?.customer;
  const seller = detail?.seller;

  const isTroca = (sale?.type as string) === "troca";
  const troca = detail?.troca || null;
  const isDevolucao = (sale?.type as string) === "devolucao";
  const devolucao = detail?.devolucao || null;
  const avisoRetornos = !isCancelled ? avisoRetornosAtivos(detail?.returns) : null;

  // Formas em pílulas. Backend antigo (sem detail.payments): a forma única.
  const pilulas: Pilula[] = (detail?.payments && detail.payments.length)
    ? detail.payments
    : (sale ? [{ method: sale.payment_method || "", amount: sale.total_amount }] : []);
  const temCrediario = pilulas.some(function(p) { return normalizarMetodo(p.method) === "crediario"; }) ||
    (sale?.payment_method || "").toLowerCase() === "crediario";
  const comEntrada = temCrediario && pilulas.length > 1;
  function textoDaPilula(p: Pilula) {
    const cred = normalizarMetodo(p.method) === "crediario";
    const nome = cred ? "Crediário" + (p.installments && p.installments > 1 ? " " + p.installments + "x" : "") : rotuloDaForma(p.method);
    return (comEntrada && !cred ? "Entrada " : "") + nome + " · " + brl(p.amount);
  }

  const showReceiptBtn = !isCancelled && temCrediario && !!saleId;
  const showRefundBtn = !isCancelled && temCrediario && !isTroca && items.length > 0;
  const podeEditar = !!sale && !isCancelled && !isTroca && !isDevolucao;

  // 02/06/2026 (b): estado fiscal — emissão relevante por tipo de venda.
  const fiscalList = detail?.fiscal || [];
  // 14/11/2026 (NF-e 55, CP4): a venda comum mostra a nota de produtos que
  // tiver — NFC-e ou NF-e de venda (uma só por venda, backend #1017).
  const relTipos = isTroca ? ["nfe", "nfe_devolucao"] : ["nfce", "nfe"];
  const relevantFiscal = fiscalList.filter(function(f) { return relTipos.indexOf(f.tipo) >= 0; });
  const authorizedEmission = relevantFiscal.find(function(f) { return f.status === "autorizada"; }) || null;
  const latestFiscal = relevantFiscal.length ? relevantFiscal[0] : null;
  const nfeDeVenda = !isTroca && !!authorizedEmission && authorizedEmission.tipo === "nfe";
  const fiscalDocLabel = isTroca ? "NF-e de devolução" : (authorizedEmission && authorizedEmission.tipo === "nfe" ? "NF-e" : "NFC-e");
  const fiscalBusy = isEmitting || isReemitting;
  const fiscalEnabled = !!((nfceCfg as any)?.config?.is_active);
  const fiscalAmbiente = (nfceCfg as any)?.config?.ambiente || null;
  const fiscalHomolog = fiscalEnabled && fiscalAmbiente === "homologacao";

  const titulo = isTroca ? "Detalhes da troca" : isDevolucao ? "Detalhes da devolução"
    : (sale?.sale_number ? "Venda #" + sale.sale_number : "Detalhes da venda");
  const subtitulo = sale ? fmtDataHora(sale.created_at) + (companyName ? " · " + companyName : "") : "";
  const editada = rotuloDaEdicao(detail?.last_edit || null);
  const telefone = mascararTelefone(customer?.phone || null);
  const cancelLabel = isTroca ? "Cancelar troca" : isDevolucao ? "Desfazer devolução" : "Cancelar venda";

  const secundarios: React.ReactNode[] = [];
  if (showReceiptBtn) secundarios.push(<Button key="recibo" title="Recibo" icon="receipt" size="sm" variant="secondary" loading={printingReceipt} onPress={handlePrintReceipt} />);
  if (showRefundBtn) secundarios.push(<Button key="devolver" title="Devolver" icon="rotate_ccw" size="sm" variant="secondary" onPress={function() { setShowDevolucao(true); }} />);
  if (showRefundBtn) secundarios.push(
    <Button key="trocar" testID="venda-trocar" title="Trocar" icon="repeat" size="sm" variant="secondary" onPress={function() { onClose(); router.push(ROTA_TROCA_PDV as any); }} />
  );
  if (matcon.matcon_enabled && sale && !isCancelled && !isTroca && !isDevolucao && sale.has_pending_delivery !== true) {
    secundarios.push(entregaCriadaDe === sale.id ? (
      <Button key="ver-entregas" testID="venda-ver-entregas" title="Ver entregas" icon="truck" size="sm" variant="secondary" onPress={function() { onClose(); router.push("/matcon/entregas" as any); }} />
    ) : (
      <Button key="criar-entrega" testID="venda-criar-entrega" title="Criar entrega" icon="truck" size="sm" variant="secondary" loading={criandoEntrega} onPress={handleCriarEntrega} />
    ));
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={580}>
      {/* Cabeçalho fixo */}
      <View style={s.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.headerTitleRow}>
            <Text style={s.headerTitle} numberOfLines={1}>{titulo}</Text>
            {temCrediario && !isTroca && !isDevolucao && !isCancelled && (
              <View style={s.badge}><Text style={s.badgeText}>Crediário</Text></View>
            )}
            {isTroca && !isCancelled && (
              <View style={[s.badge, s.badgeAmber]}>
                <Icon name="repeat" size={9} color={Colors.amber} />
                <Text style={[s.badgeText, { color: Colors.amber }]}>Troca</Text>
              </View>
            )}
            {isCancelled && (
              <View style={[s.badge, s.badgeRed]}><Text style={[s.badgeText, { color: Colors.red }]}>Cancelada</Text></View>
            )}
            {matcon.matcon_enabled && sale?.has_pending_delivery === true && (
              <Pressable
                onPress={() => { onClose(); router.push("/matcon/entregas?dia=pending" as any); }}
                style={[s.badge, s.badgeAmber]}
                testID="venda-saldo-a-entregar"
              >
                <Icon name="truck" size={10} color={Colors.amber} />
                <Text style={[s.badgeText, { color: Colors.amber }]}>saldo a entregar</Text>
                <Text style={s.pendingDeliveryLink}>· Ver entregas</Text>
              </Pressable>
            )}
          </View>
          {!!subtitulo && <Text style={s.headerDate} numberOfLines={1}>{subtitulo}</Text>}
        </View>
        <Pressable onPress={onClose} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Fechar" testID="venda-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      {/* Conteúdo que rola */}
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.body}>
        {isLoading && (
          <View style={s.loadingBox}>
            <ActivityIndicator color={Colors.violet3} />
            <Text style={s.loadingText}>Carregando venda...</Text>
          </View>
        )}
        {error && !isLoading && (
          <View style={s.errorBox}>
            <Icon name="alert_circle" size={16} color={Colors.red} />
            <Text style={s.errorText}>{(error as any)?.data?.error || error.message || "Erro ao carregar"}</Text>
          </View>
        )}

        {detail && sale && (<>
          {isDevolucao && devolucao && (
            <View style={[s.totalCard, isCancelled && s.totalCardCancelled]}>
              <Text style={s.totalLabel}>Devolução no crediário</Text>
              <Text style={[s.totalValue, isCancelled && s.totalValueStrike]}>{brl(devolucao.refund_value)}</Text>
              <Text style={s.totalHint}>
                {devolucao.original_sale_number ? "Da venda #" + devolucao.original_sale_number + ". " : ""}
                Valor abatido da dívida do cliente.
              </Text>
              {devolucao.items.map(function(ri, idx) {
                return <Text key={idx} style={s.itemMeta}>{ri.quantity}x {ri.product_name} voltou ao estoque</Text>;
              })}
            </View>
          )}

          {avisoRetornos && (
            <View style={s.returnsHint}>
              <Icon name="repeat" size={12} color={Colors.amber} />
              <Text style={s.returnsHintText}>{avisoRetornos}</Text>
            </View>
          )}

          {!isTroca && !isDevolucao && (
            <View style={[s.totalCard, isCancelled && s.totalCardCancelled]}>
              <Text style={s.totalLabel}>Valor da venda</Text>
              <Text style={[s.totalValue, isCancelled && s.totalValueStrike]}>{brl(sale.total_amount)}</Text>
              {sale.discount_amount > 0 && <Text style={s.totalHint}>Desconto: {brl(sale.discount_amount)}</Text>}
              <View style={s.pillsRow} testID="venda-formas">
                {pilulas.map(function(p, idx) {
                  return (
                    <View key={idx} style={s.pill}>
                      <Text style={s.pillTxt}>{textoDaPilula(p)}</Text>
                    </View>
                  );
                })}
                {sale.coupon_code ? (
                  <View style={s.pill}><Text style={s.pillTxt}>Cupom {sale.coupon_code}</Text></View>
                ) : null}
              </View>
            </View>
          )}

          {/* Troca: card segmentado */}
          {isTroca && troca && (
            <View style={[s.trocaCard, isCancelled && s.totalCardCancelled]}>
              <View style={s.trocaSegHead}>
                <Text style={[s.trocaSegTitle, { color: Colors.green }]}>Levou (produtos novos)</Text>
                <Text style={[s.trocaSegVal, { color: Colors.green }]}>{brl(troca.new_value)}</Text>
              </View>
              <View style={s.trocaDivider} />
              <View style={s.trocaSegHead}>
                <Text style={[s.trocaSegTitle, { color: Colors.amber }]}>Devolveu (produtos retirados)</Text>
                <Text style={[s.trocaSegVal, { color: Colors.amber }]}>- {brl(troca.returned_value)}</Text>
              </View>
              {troca.returned_items.map(function(ri, idx) {
                return (
                  <View key={idx} style={s.trocaItemRow}>
                    <View style={s.trocaItemThumb}>
                      {ri.image_url ? <Image source={{ uri: ri.image_url }} style={s.itemImageInner} /> : <Icon name="package" size={12} color={Colors.ink3} />}
                    </View>
                    <Text style={s.trocaItemName} numberOfLines={1}>{ri.product_name}</Text>
                    <Text style={s.trocaItemMeta}>{ri.quantity}x</Text>
                    <Text style={s.trocaItemPrice}>{brl(ri.unit_price)}</Text>
                  </View>
                );
              })}
              <View style={s.trocaDiff}>
                <Text style={s.trocaDiffLabel}>{troca.net_amount >= 0 ? "Diferença, cliente pagou" : "Diferença, loja devolveu"}</Text>
                <Text style={s.trocaDiffVal}>{brl(Math.abs(troca.net_amount))}</Text>
              </View>
              {troca.payments && troca.payments.length > 0 && (
                <View style={s.trocaSub}>
                  <Text style={s.trocaSubLabel}>Formas de pagamento</Text>
                  <View style={s.pillsRow}>
                    {troca.payments.map(function(p, idx) {
                      return <View key={idx} style={s.pill}><Text style={s.pillTxt}>{rotuloDaForma(p.method)} · {brl(p.amount)}</Text></View>;
                    })}
                  </View>
                </View>
              )}
              <View style={s.trocaSub}>
                <Text style={s.trocaSubLabel}>Conciliação no Financeiro</Text>
                <View style={s.trocaFinRow}>
                  <Text style={s.trocaFinLab}>Troca - Venda</Text>
                  <Text style={[s.trocaFinVal, { color: Colors.green }]}>+ {brl(troca.new_value)}</Text>
                </View>
                <View style={s.trocaFinRow}>
                  <Text style={s.trocaFinLab}>Troca - Devolução</Text>
                  <Text style={[s.trocaFinVal, { color: Colors.red }]}>- {brl(troca.returned_value)}</Text>
                </View>
                <View style={[s.trocaFinRow, s.trocaFinNet]}>
                  <Text style={[s.trocaFinLab, { fontWeight: "800", color: Colors.ink }]}>Líquido</Text>
                  <Text style={[s.trocaFinVal, { color: Colors.ink, fontWeight: "800" }]}>+ {brl(troca.net_amount)}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={[s.peopleRow, estreito && { flexDirection: "column" }]}>
            <View style={s.personCard}>
              <View style={s.personHead}><Icon name="user" size={12} color={Colors.ink3} /><Text style={s.personLabel}>Cliente</Text></View>
              <Text style={s.personValue} numberOfLines={1}>{customer?.name || "Sem cliente"}</Text>
              <Text style={s.personHint}>{customer ? (telefone || " ") : "Venda no balcão"}</Text>
            </View>
            <View style={s.personCard}>
              <View style={s.personHead}><Icon name="users" size={12} color={Colors.ink3} /><Text style={s.personLabel}>Vendedor(a)</Text></View>
              <Text style={s.personValue} numberOfLines={1}>{seller?.name || "Sem vendedor(a)"}</Text>
              <Text style={s.personHint}>{seller?.name ? "Comissão de " + mesDaVenda(diaEmSaoPaulo(sale.created_at)) : " "}</Text>
            </View>
          </View>

          {editada && (
            <View style={s.editadaRow} testID="venda-editada">
              <Icon name="edit" size={12} color={Colors.ink3} />
              <Text style={s.editadaTxt}>{editada}</Text>
            </View>
          )}

          {!isDevolucao && (<>
            <Text style={s.sectionTitle}>{isTroca ? "Produtos levados" : "Produtos"}</Text>
            <View style={s.itemsBox}>
              {items.length === 0 && <Text style={s.noItems}>Esta venda não tem produtos.</Text>}
              {items.map(function(item, idx) {
                const devolvido = rotuloDevolvido(item.quantity, (item as any).returned_quantity);
                return (
                  <View key={item.id || String(idx)} style={[s.itemRow, devolvido === "Devolvido" && { opacity: 0.55 }]}>
                    <View style={s.itemImage}>
                      {item.image_url ? <Image source={{ uri: item.image_url }} style={s.itemImageInner} /> : <Icon name="package" size={14} color={Colors.ink3} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.itemName} numberOfLines={2}>{item.product_name}</Text>
                      <Text style={s.itemMeta}>
                        {item.quantity} × {brl(item.unit_price)}
                        {item.discount > 0 ? "  - " + brl(item.discount) : ""}
                      </Text>
                      {devolvido && <Text style={s.itemReturned}>{devolvido}</Text>}
                    </View>
                    <Text style={s.itemTotal}>{brl(item.total_price)}</Text>
                  </View>
                );
              })}
            </View>
          </>)}

          {sale.notes && (
            <View style={s.notesBox}>
              <Text style={s.notesLabel}>Observações</Text>
              <Text style={s.notesText}>{sale.notes}</Text>
            </View>
          )}

          {/* Nota fiscal */}
          {!isCancelled && !isDevolucao && (
            <View style={s.fiscalBox}>
              <View style={s.fiscalHeadRow}>
                <Text style={s.fiscalTitle}>Nota fiscal</Text>
                {fiscalHomolog && (
                  <View style={[s.badge, s.badgeAmber]}><Text style={[s.badgeText, { color: Colors.amber }]}>Teste · homologação</Text></View>
                )}
              </View>
              {authorizedEmission ? (
                <>
                <View style={s.fiscalRow}>
                  <View style={s.fiscalOkPill}>
                    <Icon name="check_circle" size={12} color={Colors.green} />
                    <Text style={s.fiscalOkText}>
                      {fiscalDocLabel}{authorizedEmission.numero ? (" nº " + authorizedEmission.numero) : ""} autorizada
                    </Text>
                  </View>
                  {nfeDeVenda ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      <Button testID="venda-nfe-danfe" title="DANFE" icon="file_text" size="sm" variant="secondary"
                        onPress={function() { if (effectiveCompanyId) abrirDanfe(effectiveCompanyId, authorizedEmission.id); }} />
                      <Button testID="venda-nfe-xml" title="XML" icon="download" size="sm" variant="secondary"
                        onPress={function() { if (effectiveCompanyId) baixarXml(effectiveCompanyId, authorizedEmission.id, authorizedEmission.chave_acesso); }} />
                      <Button testID="venda-nfe-email" title="E-mail" icon="mail" size="sm" variant="secondary" loading={enviandoNfe}
                        onPress={function() { handleEnviarNfe(authorizedEmission.id); }} />
                    </View>
                  ) : isTroca ? (
                    (authorizedEmission.pdf_url || authorizedEmission.url_consulta) ? (
                      <Button title={authorizedEmission.pdf_url ? "Ver DANFE" : "Consultar SEFAZ"} icon="external_link" size="sm" variant="secondary"
                        onPress={function() { openFiscalLink(authorizedEmission); }} />
                    ) : null
                  ) : (
                    <Button title="2ª via" icon="print" size="sm" variant="secondary" loading={print2via}
                      onPress={function() { handlePrint2Via(authorizedEmission.id); }} />
                  )}
                </View>
                {/* CP5 (14/11/2026): prazo à vista, carta de correção e cancelar da NF-e de venda. */}
                {nfeDeVenda && effectiveCompanyId ? (
                  <AcoesDeEventosNfe companyId={effectiveCompanyId} nota={authorizedEmission as any}
                    onMudou={function() { if (saleDetail.refetch) saleDetail.refetch(); }} />
                ) : null}
                </>
              ) : (
                <>
                  {latestFiscal && latestFiscal.status !== "autorizada" ? (
                    <View style={s.fiscalErr}>
                      <Icon name="alert_circle" size={12} color={Colors.red} />
                      <Text style={s.fiscalErrText}>
                        {fiscalStatusLabel(latestFiscal.status)}
                        {latestFiscal.error_message ? (" — " + latestFiscal.error_message) : ""}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.fiscalNone}>
                      {isTroca ? "A NF-e de devolução desta troca ainda não foi emitida." : "Esta venda ainda não tem nota fiscal."}
                    </Text>
                  )}
                  {fiscalEnabled ? (
                    isTroca ? (
                      <Button title="Reprocessar NF-e de devolução" icon="file_text" size="sm" variant="secondary"
                        loading={fiscalBusy} onPress={handleEmitFiscal} style={{ alignSelf: "flex-start" }} />
                    ) : (
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Button testID="venda-emitir-nfe" title={latestFiscal && latestFiscal.tipo === "nfe" ? "Emitir NF-e de novo" : "Emitir NF-e (empresa / CNPJ)"}
                            icon="file_text" size="sm" variant="secondary" onPress={function() { setNfeAberta(true); }} />
                          <Button testID="venda-emitir-nfce" title="Emitir NFC-e" icon="file_text" size="sm" variant="secondary"
                            loading={fiscalBusy} onPress={handleEmitFiscal} />
                        </View>
                        <Text style={s.fiscalConfigNote}>Uma venda tem uma nota de produtos só: NF-e ou NFC-e.</Text>
                      </View>
                    )
                  ) : (
                    <Text style={s.fiscalConfigNote}>Emissão de nota fiscal não configurada. Ative em Configurações › Nota Fiscal.</Text>
                  )}
                </>
              )}
              {/* 10/11/2026 (NFS-e automática, tela 5): a nota de serviço da
                  venda. Some quando a venda não tem NFS-e (só produto, loja
                  que não emite). companyId = o da venda (multi-CNPJ). */}
              {!isTroca && (
                <NfseDaOrigem companyId={effectiveCompanyId} tipo="venda" id={saleId} origem="venda" testID="venda-nfse" />
              )}
            </View>
          )}

          {isCancelled && sale.cancelled_at && (
            <View style={s.cancelledHint}>
              <Icon name="alert_circle" size={12} color={Colors.red} />
              <Text style={s.cancelledHintText}>
                {isTroca
                  ? "Esta troca foi cancelada em " + fmtDataHora(sale.cancelled_at) + ". Estoque dos dois lados revertido e financeiro ajustado."
                  : isDevolucao
                  ? "Esta devolução foi desfeita em " + fmtDataHora(sale.cancelled_at) + ". A peça saiu de novo do estoque e o valor voltou para a dívida."
                  : "Esta venda foi cancelada em " + fmtDataHora(sale.cancelled_at) + ". O estoque voltou e o valor saiu da receita. Venda cancelada não é editada."}
              </Text>
            </View>
          )}
          {isTroca && !isCancelled && (
            <Text style={s.hint}>A troca não tem “Editar venda”. Para corrigir, use “Cancelar troca” e faça de novo.</Text>
          )}
        </>)}
      </ScrollView>

      {/* Rodapé fixo */}
      {detail && sale && (
        <View style={s.footer}>
          {secundarios.length > 0 && (
            <View style={s.footerSec}>{secundarios}</View>
          )}
          <View style={s.footerMain}>
            {!isCancelled ? (
              <Pressable onPress={function() { setConfirmCancel(true); }} disabled={isCancelling} style={s.cancelLink} testID="venda-cancelar" accessibilityRole="button">
                <Text style={s.cancelLinkTxt}>{cancelLabel}</Text>
              </Pressable>
            ) : <View />}
            {podeEditar ? (
              <Button testID="venda-editar" title="Editar venda" icon="edit" variant="primary" onPress={function() { setEditando(true); }} />
            ) : (
              <Button title="Fechar" variant="ghost" onPress={onClose} />
            )}
          </View>
        </View>
      )}

      {/* Confirmar cancelamento */}
      <ResponsiveSheet visible={confirmCancel} onClose={function() { setConfirmCancel(false); }} maxWidth={420}>
        <View style={s.confirmBody}>
          <Text style={s.confirmTitle}>{isTroca ? "Cancelar troca?" : isDevolucao ? "Desfazer devolução?" : "Cancelar venda?"}</Text>
          <Text style={s.confirmMsg}>
            {isTroca
              ? "Os produtos novos voltam ao estoque, o produto devolvido sai do estoque, as transações da troca saem do Financeiro e a NF-e de devolução não autorizada é removida. Não dá para desfazer."
              : isDevolucao
              ? "A peça devolvida sai de novo do estoque e o valor volta a ser dívida do cliente, nas mesmas parcelas de antes."
              : "Os " + items.length + " produto(s) voltam para o estoque e o valor sai da receita. Não dá para desfazer."}
          </Text>
          <Text style={s.confirmFieldLabel}>Motivo (opcional)</Text>
          <TextInput
            style={s.confirmInput}
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="Ex.: cliente desistiu"
            placeholderTextColor={Colors.ink3}
            multiline
            maxLength={200}
          />
          <View style={s.confirmActions}>
            <Button title="Voltar" variant="ghost" full disabled={isCancelling} onPress={function() { setConfirmCancel(false); setCancelReason(""); }} />
            <Button title={isTroca ? "Sim, cancelar troca" : isDevolucao ? "Sim, desfazer" : "Sim, cancelar venda"} variant="danger" full loading={isCancelling} onPress={handleConfirmCancel} />
          </View>
        </View>
      </ResponsiveSheet>

      {editando && saleId && (
        <EditarVendaModal
          visible={editando}
          saleId={saleId}
          companyId={effectiveCompanyId}
          onClose={function() { setEditando(false); }}
          onPrintReceipt={handlePrintReceipt}
        />
      )}

      {showDevolucao && saleId && (
        <DevolucaoModal
          visible={showDevolucao}
          companyId={effectiveCompanyId || ""}
          sale={{
            id: saleId,
            items: items.map(function(it) {
              return { id: it.id, product_name: it.product_name, quantity: it.quantity, unit_price: it.unit_price, total_price: it.total_price };
            }),
          }}
          onClose={function() { setShowDevolucao(false); }}
          onDone={function() { /* C1-FE: não fechar aqui — o passo de resultado fica visível. */ }}
        />
      )}

      {/* 14/11/2026 (NF-e 55, CP4): a NF-e sai da loja DA VENDA (multi-CNPJ). */}
      {nfeAberta && saleId && (
        <Nfe55Wizard
          visible={nfeAberta}
          companyId={effectiveCompanyId}
          saleId={saleId}
          saleNumber={sale?.sale_number || null}
          onClose={function() { setNfeAberta(false); if (saleDetail.refetch) saleDetail.refetch(); }}
          onEmitida={function() { if (saleDetail.refetch) saleDetail.refetch(); }}
        />
      )}
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  headerTitle: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  headerDate: { fontSize: 12, color: Colors.ink3, marginTop: 3 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border2 },
  badgeAmber: { backgroundColor: Colors.amberD, borderColor: Colors.amber },
  badgeRed: { backgroundColor: Colors.redD, borderColor: Colors.red },
  badgeText: { fontSize: 9.5, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  pendingDeliveryLink: { fontSize: 9.5, color: Colors.amber, fontWeight: "700", textDecorationLine: "underline" },
  closeBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },

  body: { padding: 16, gap: 12 },
  loadingBox: { paddingVertical: 50, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: Colors.redD, borderRadius: 10, borderWidth: 1, borderColor: Colors.red },
  errorText: { flex: 1, fontSize: 12, color: Colors.red },

  totalCard: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  totalCardCancelled: { backgroundColor: Colors.redD, borderColor: Colors.red },
  totalLabel: { fontSize: 10.5, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  totalValue: { fontSize: 28, color: Colors.ink, fontWeight: "800", marginTop: 4 },
  totalValueStrike: { color: Colors.red, textDecorationLine: "line-through" as any },
  totalHint: { fontSize: 12, color: Colors.ink3, marginTop: 4 },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, justifyContent: "center" },
  pill: { backgroundColor: Colors.bg3, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border2 },
  pillTxt: { fontSize: 12, color: Colors.ink, fontWeight: "600" },

  trocaCard: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
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
  trocaDiffVal: { fontSize: 20, color: Colors.ink, fontWeight: "900" },
  trocaSub: { marginTop: 12 },
  trocaSubLabel: { fontSize: 9.5, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 },
  trocaFinRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  trocaFinLab: { fontSize: 12, color: Colors.ink2 },
  trocaFinVal: { fontSize: 12.5, fontWeight: "700" },
  trocaFinNet: { borderTopWidth: 1, borderTopColor: Colors.border2, marginTop: 5, paddingTop: 8 },

  peopleRow: { flexDirection: "row", gap: 8, width: "100%" },
  personCard: { flex: 1, minWidth: 0, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 3 },
  personHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  personLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  personValue: { fontSize: 14, color: Colors.ink, fontWeight: "600", marginTop: 2 },
  personHint: { fontSize: 11, color: Colors.ink3 },
  editadaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  editadaTxt: { fontSize: 12, color: Colors.ink3 },

  sectionTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  itemsBox: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: Colors.border },
  noItems: { fontSize: 12, color: Colors.ink3, fontStyle: "italic", textAlign: "center", paddingVertical: 16 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8 },
  itemImage: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  itemImageInner: { width: 36, height: 36 },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  itemMeta: { fontSize: 11.5, color: Colors.ink3, marginTop: 2 },
  itemReturned: { fontSize: 10.5, color: Colors.amber, fontWeight: "700", marginTop: 3 },
  itemTotal: { fontSize: 13, color: Colors.ink, fontWeight: "700" },

  notesBox: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  notesLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  notesText: { fontSize: 12.5, color: Colors.ink, marginTop: 4, lineHeight: 18 },

  fiscalBox: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  fiscalHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fiscalTitle: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  fiscalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  fiscalOkPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.greenD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.green },
  fiscalOkText: { fontSize: 12, color: Colors.green, fontWeight: "700" },
  fiscalErr: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, backgroundColor: Colors.redD, borderRadius: 8, borderWidth: 1, borderColor: Colors.red },
  fiscalErrText: { flex: 1, fontSize: 11.5, color: Colors.red, lineHeight: 16 },
  fiscalNone: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  fiscalConfigNote: { fontSize: 12, color: Colors.ink3, lineHeight: 17, fontStyle: "italic" },

  returnsHint: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber },
  returnsHintText: { flex: 1, fontSize: 12.5, color: Colors.ink, lineHeight: 17 },
  cancelledHint: { width: "100%", flexDirection: "row", gap: 8, padding: 10, backgroundColor: Colors.redD, borderRadius: 8, borderWidth: 1, borderColor: Colors.red },
  cancelledHintText: { flex: 1, fontSize: 12, color: Colors.ink, lineHeight: 17 },
  hint: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },

  footer: { width: "100%", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
  footerSec: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  footerMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cancelLink: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  cancelLinkTxt: { fontSize: 13, color: Colors.red, fontWeight: "700" },

  confirmBody: { padding: 20 },
  confirmTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700", marginBottom: 8 },
  confirmMsg: { fontSize: 13, color: Colors.ink2, lineHeight: 19, marginBottom: 14 },
  confirmFieldLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 },
  confirmInput: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, minHeight: 60, textAlignVertical: "top", marginBottom: 14 },
  confirmActions: { flexDirection: "row", gap: 8 },
});

export default SaleDetailModal;
