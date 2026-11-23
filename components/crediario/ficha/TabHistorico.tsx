// ============================================================
// TabHistorico — Aura · Crediário · Movimentações
//
// 23/11/2026 (F1 do redesenho da ficha, mockup aprovado pelo Caio): o antigo
// "Histórico · Linha do tempo" vira "Movimentações", na língua da lojista:
//  - verbo no lugar do tipo ("Pagou no Pix", "Comprou", "Valor lançado à mão
//    pela loja"), sem legenda de cores e sem o botão Atualizar (a lista já
//    recarrega depois de cada ação);
//  - sinal do ponto de vista da dívida: "−" verde diminui, "+" neutro aumenta
//    (comprar não é erro);
//  - mês como cabeçalho, dia curto na linha;
//  - "Para onde foi o dinheiro": cada parcela "paga inteira", "abateu R$ X" ou
//    "sobra do pagamento", com "vence dd/mm · hoje faltam R$ Y" tirado das
//    parcelas abertas da ficha (utils/crediarioMovimentacao, testada sozinha);
//  - uma ação à vista por linha (Recibo, Devolver itens) e o raro no "⋯":
//    Corrigir/Remover este pagamento, Excluir este lançamento. O "⋯" abre um
//    menu embaixo da linha com toque — nada depende de passar o mouse.
//
// Lógica preservada: recibo, devolução (B4/B5), excluir manual_debit,
// editar/remover pagamento (08/10, Looks da Jenny), paginação por cursor.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { creditApi, printReceipt, type CreditHistoryEvent } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import { ConfirmGate } from "@/components/ConfirmGate";
import { fmt } from "./fichaHelpers";
import { eventNote } from "./eventNote";
import { m, CorDaFicha } from "./fichaStyles";
import { carregarVendaParaDevolucao } from "./vendaParaDevolucao";
import { DevolucaoModal, type DevolucaoSale } from "@/components/crediario/DevolucaoModal";
import { diaSP } from "@/utils/crediarioPagamento";
import {
  agruparPorMes, diaDoEvento, diaEmSaoPaulo, diminuiADivida, paraOndeFoiODinheiro,
  tituloDoEvento, valorComSinal, type ParcelaAbertaDaFicha,
} from "@/utils/crediarioMovimentacao";
import { EditarPagamentoModal, type PagamentoEmEdicao } from "./EditarPagamentoModal";
import { NfseDaOrigem } from "@/components/nfse/NfseDaOrigem";
import { useNfseAutomaticaConfig } from "@/hooks/useNfseAutomatica";

export type TabHistoricoProps = {
  histEvents: CreditHistoryEvent[];
  histCursor: string | null;
  histLoading: boolean;
  histLoaded: boolean;
  loadHistory: (cursor?: string | null) => void;
  setHistLoaded: (v: boolean) => void;
  // contexto passado pelo shell (ClienteCrediarioModal)
  companyId: string;
  customerId: string;
  /** Nome da cliente da ficha — vai para o "Corrigir pagamento". */
  customerName?: string;
  /** Parcelas abertas da ficha: o "hoje faltam" de cada parcela paga em parte. */
  openInst?: ParcelaAbertaDaFicha[];
  onRefresh: () => void;
};

const NUM = { fontVariant: ["tabular-nums"] as any };

export function TabHistorico({
  histEvents, histCursor, histLoading, histLoaded, loadHistory, setHistLoaded,
  companyId, customerId, customerName, openInst, onRefresh,
}: TabHistoricoProps) {
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [loadingRefundId, setLoadingRefundId] = useState<string | null>(null);
  const [refundSale, setRefundSale] = useState<DevolucaoSale | null>(null);
  // ConfirmGate (padrão único F3): id do evento aguardando confirmação.
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Pagamento: remover (ConfirmGate) e editar (modal).
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [editando, setEditando] = useState<PagamentoEmEdicao | null>(null);
  // "⋯" aberto (um por vez).
  const [menuDe, setMenuDe] = useState<string | null>(null);
  // 10/11/2026 (NFS-e automática, tela 5): a compra no crediário com serviço
  // mostra a nota de serviço da venda (o recebimento não é origem: a nota é
  // a da venda). Só consulta com a emissão automática ligada na loja.
  const { ativa: nfseAtiva } = useNfseAutomaticaConfig(companyId);

  const meses = useMemo(() => agruparPorMes(histEvents), [histEvents]);
  const hoje = diaEmSaoPaulo(new Date().toISOString());

  function recarregar() {
    onRefresh();
    setHistLoaded(false);
    loadHistory();
  }

  // Remove um recebimento (DELETE /credit/payments/:id): as parcelas que ele
  // cobriu voltam a ficar em aberto e o Financeiro volta para "a receber".
  async function handleRemovePayment(transactionId: string) {
    setRemovingId(transactionId);
    try {
      const res = await creditApi.undoPayment(companyId, transactionId);
      const n = res?.installments_reopened ?? 0;
      toast.success(
        n > 0
          ? `Pagamento removido. ${n} ${n === 1 ? "parcela voltou" : "parcelas voltaram"} a ficar em aberto.`
          : "Pagamento removido."
      );
      recarregar();
    } catch (err: any) {
      console.error("[crediário] undoPayment error:", err);
      toast.error(err?.data?.error || "Não foi possível remover o pagamento. Tente novamente.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handlePrintReceipt(transactionId: string) {
    setPrintingId(transactionId);
    try {
      await printReceipt(companyId, transactionId);
    } catch (err) {
      console.error("[crediário] printReceipt error:", err);
      toast.error("Não foi possível abrir o recibo. Tente novamente.");
    } finally {
      setPrintingId(null);
    }
  }

  async function openRefund(ev: CreditHistoryEvent) {
    if (!ev.sale_id) return;
    setLoadingRefundId(ev.id);
    try {
      // Mesma montagem do "Excluir carnê" de carnê de venda (vendaParaDevolucao).
      const sale = await carregarVendaParaDevolucao(companyId, ev.sale_id);
      if (!sale) {
        toast.error("Todos os itens desta venda já foram devolvidos.");
        return;
      }
      setRefundSale(sale);
    } catch (err) {
      console.error("[crediário] openRefund error:", err);
      toast.error("Não foi possível carregar a venda. Tente novamente.");
    } finally {
      setLoadingRefundId(null);
    }
  }

  // Exclui um lançamento manual (manual_debit) via DELETE /credit/transaction/:id.
  // Após sucesso, recarrega a lista do zero (evita paginação inconsistente) e
  // invalida saldo/perfil via onRefresh (mesmo callback usado pela devolução).
  async function handleDelete(transactionId: string) {
    setDeletingId(transactionId);
    try {
      const res = await creditApi.undoTransaction(companyId, transactionId);
      // 10/09/2026 (caso Ana Lucia, looks da jenny): o backend passou a cancelar
      // as parcelas que nasceram com o lançamento — dizemos quantas, para a
      // lojista não estranhar o carnê encolhendo.
      const n = res?.cancelled_installments ?? 0;
      toast.success(
        n > 0
          ? `Lançamento excluído! ${n} ${n === 1 ? "parcela cancelada" : "parcelas canceladas"}.`
          : "Lançamento excluído!"
      );
      onRefresh();
      setHistLoaded(false);
      loadHistory();
    } catch (err: any) {
      console.error("[crediário] undoTransaction error:", err);
      toast.error(err?.data?.error || "Não foi possível excluir o lançamento. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  function renderEvento(ev: CreditHistoryEvent) {
    const diminui = diminuiADivida(ev.amount);
    const isPrinting = printingId === ev.id;
    const isLoadingRefund = loadingRefundId === ev.id;
    const canRefund = ev.type === "purchase" && !!ev.sale_id;
    // Só lançamento manual (sem venda/parcela vinculada) pode ser excluído por
    // aqui — purchase/payment/refund têm efeitos colaterais (parcelas, estoque,
    // venda) que o endpoint genérico de "undo" pode não reverter corretamente.
    const canDelete = ev.type === "manual_debit";
    const isDeleting = deletingId === ev.id;
    const isPayment = ev.type === "payment";
    const grupos = isPayment ? paraOndeFoiODinheiro(ev.payment?.allocations, openInst, hoje) : [];
    const canEditPayment = isPayment && ev.payment?.can_edit === true;
    // Backend novo respondeu (can_edit veio) mas o pagamento é anterior à
    // divisão por parcela: explica em vez de só não mostrar as opções.
    const pagamentoAntigo = isPayment && ev.payment?.can_edit === false;
    const isRemoving = removingId === ev.id;
    // 21/09/2026: descrição digitada no lançamento (meta.notes).
    const note = eventNote(ev);
    const temMais = canEditPayment || canDelete;
    const menuAberto = menuDe === ev.id;

    return (
      <View key={ev.id} style={lc.ev} testID={`crediario-mov-${ev.id}`}>
        <Text style={lc.dia}>{diaDoEvento(ev.occurred_at)}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={lc.topo}>
            <Text style={lc.titulo}>{tituloDoEvento(ev)}</Text>
            <Text style={[lc.valor, { color: diminui ? CorDaFicha.verdeTexto : Colors.ink }]}>
              {valorComSinal(ev.amount)}
            </Text>
          </View>
          {!!note && <Text style={lc.note} selectable>{ev.type === "manual_debit" ? `“${note}”` : note}</Text>}
          {ev.items && ev.items.length > 0 && (
            <View style={lc.itemList}>
              {ev.items.map((it, idx) => (
                <View key={idx} style={lc.ln}>
                  <Text style={lc.lnTxt} numberOfLines={2}>{`${it.quantity}× ${it.product_name}`}</Text>
                  {/* INC-2026-11-20-01: o backend manda o total em reais (sale_items.total_price), nao em centavos. */}
                  <Text style={lc.lnVal}>{fmt(it.total)}</Text>
                </View>
              ))}
            </View>
          )}
          {nfseAtiva && ev.type === "purchase" && !!ev.sale_id && (
            <NfseDaOrigem companyId={companyId} tipo="venda" id={ev.sale_id} origem="cobranca" style={{ marginTop: 8 }} testID={`crediario-nfse-${ev.id}`} />
          )}
          {grupos.length > 0 && (
            <View style={{ gap: 6, marginTop: 4 }} testID={`crediario-pagamento-parcelas-${ev.id}`}>
              {grupos.map((g) => (
                <View key={g.chave}>
                  {/* QA 23/11 (P2): duas linhas em vez de cortar o nome do carnê. */}
                  <Text style={lc.onde} numberOfLines={2}>{`Para onde foi o dinheiro · ${g.nome}`}</Text>
                  {g.linhas.map((l) => (
                    <View key={l.id} style={lc.ln}>
                      <Text style={[lc.marca, { color: l.tipo === "inteira" ? Colors.green : Colors.amber }]}>
                        {l.tipo === "inteira" ? "✓" : "◐"}
                      </Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={lc.lnTxt}>{l.rotulo}</Text>
                        {!!l.detalhe && <Text style={lc.lnSub}>{l.detalhe}</Text>}
                      </View>
                      <Text style={lc.lnVal}>{fmt(l.valor)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
          {pagamentoAntigo && (
            <Text style={lc.antigo}>
              Pagamento antigo: a Aura não guardou em quais parcelas ele entrou. Para corrigir ou remover, fale com a gente.
            </Text>
          )}

          {/* Uma ação à vista (Recibo ou Devolver itens); o raro no "⋯". */}
          {(isPayment || canRefund || temMais) && (
            <View style={lc.acoes}>
              {isPayment && (
                <Pressable
                  style={[lc.acao, isPrinting && { opacity: 0.5 }]}
                  onPress={() => handlePrintReceipt(ev.id)}
                  disabled={isPrinting}
                  accessibilityRole="button"
                  testID={`crediario-mov-recibo-${ev.id}`}
                >
                  {isPrinting
                    ? <ActivityIndicator size="small" color={Colors.violet3} style={{ width: 12, height: 12 }} />
                    : <Icon name="printer" size={12} color={Colors.violet3} />}
                  <Text style={lc.acaoTxt}>Recibo</Text>
                </Pressable>
              )}
              {canRefund && (
                <Pressable
                  style={[lc.acao, isLoadingRefund && { opacity: 0.5 }]}
                  onPress={() => { setMenuDe(null); setConfirmDeleteId(null); setConfirmRefundId(prev => prev === ev.id ? null : ev.id); }}
                  disabled={isLoadingRefund}
                  accessibilityRole="button"
                  testID={`crediario-mov-devolver-${ev.id}`}
                >
                  {isLoadingRefund
                    ? <ActivityIndicator size="small" color={Colors.violet3} style={{ width: 12, height: 12 }} />
                    : <Icon name="repeat" size={12} color={Colors.violet3} />}
                  <Text style={lc.acaoTxt}>Devolver itens</Text>
                </Pressable>
              )}
              {temMais && (
                <Pressable
                  style={[lc.mais, menuAberto && lc.maisOn]}
                  onPress={() => { setConfirmRemoveId(null); setConfirmDeleteId(null); setMenuDe(menuAberto ? null : ev.id); }}
                  accessibilityRole="button"
                  accessibilityLabel="Mais ações"
                  accessibilityState={{ expanded: menuAberto }}
                  testID={`crediario-mov-mais-${ev.id}`}
                >
                  <Text style={lc.maisTxt}>⋯</Text>
                </Pressable>
              )}
            </View>
          )}

          {menuAberto && (
            <View style={lc.menu} testID={`crediario-mov-menu-${ev.id}`}>
              {canEditPayment && (
                <Pressable
                  style={lc.menuItem}
                  onPress={() => {
                    setMenuDe(null);
                    setConfirmRemoveId(null);
                    setEditando({
                      id: ev.id,
                      amount: Math.abs(ev.amount),
                      method: ev.payment?.method || null,
                      paidAt: diaSP(ev.occurred_at),
                      customerId,
                      customerName: customerName || "este cadastro",
                    });
                  }}
                  disabled={isRemoving}
                  accessibilityRole="button"
                  testID={`crediario-pagamento-editar-${ev.id}`}
                >
                  <Text style={lc.menuTxt}>Corrigir este pagamento</Text>
                </Pressable>
              )}
              {canEditPayment && (
                <Pressable
                  style={[lc.menuItem, isRemoving && { opacity: 0.5 }]}
                  onPress={() => { setMenuDe(null); setConfirmRemoveId(ev.id); }}
                  disabled={isRemoving}
                  accessibilityRole="button"
                  testID={`crediario-pagamento-remover-${ev.id}`}
                >
                  <Text style={[lc.menuTxt, { color: Colors.red }]}>Remover este pagamento</Text>
                </Pressable>
              )}
              {canDelete && (
                <Pressable
                  style={[lc.menuItem, isDeleting && { opacity: 0.5 }]}
                  onPress={() => { setMenuDe(null); setConfirmRefundId(null); setConfirmDeleteId(ev.id); }}
                  disabled={isDeleting}
                  accessibilityRole="button"
                  testID={`crediario-mov-excluir-${ev.id}`}
                >
                  <Text style={[lc.menuTxt, { color: Colors.red }]}>Excluir este lançamento</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ConfirmGate — padrão único de confirmação sensível (F3) */}
          {canRefund && (
            <ConfirmGate
              visible={confirmRefundId === ev.id}
              message={`Devolver itens da compra de ${fmt(Math.abs(ev.amount))}?`}
              confirmLabel="Sim, devolver"
              onConfirm={() => { setConfirmRefundId(null); openRefund(ev); }}
              onCancel={() => setConfirmRefundId(null)}
              loading={isLoadingRefund}
            />
          )}
          {canEditPayment && (
            <ConfirmGate
              visible={confirmRemoveId === ev.id}
              message={`Remover o pagamento de ${fmt(Math.abs(ev.amount))}? As parcelas que ele pagou voltam a ficar em aberto.`}
              confirmLabel="Sim, remover"
              tone="red"
              onConfirm={() => { setConfirmRemoveId(null); handleRemovePayment(ev.id); }}
              onCancel={() => setConfirmRemoveId(null)}
              loading={isRemoving}
            />
          )}
          {canDelete && (
            <ConfirmGate
              visible={confirmDeleteId === ev.id}
              message={`Excluir este lançamento de ${fmt(Math.abs(ev.amount))}? Isso não pode ser desfeito.`}
              confirmLabel="Sim, excluir"
              tone="red"
              onConfirm={() => { setConfirmDeleteId(null); handleDelete(ev.id); }}
              onCancel={() => setConfirmDeleteId(null)}
              loading={isDeleting}
            />
          )}
        </View>
      </View>
    );
  }

  return (
<View>
  <View style={m.card}>
    <View style={lc.cab}>
      {/* Fonte do título inline: estilo inline vence a regra global de fonte
          do painel (app/(tabs)/_layout.tsx); a classe do StyleSheet não. */}
      <Text style={[lc.cabTitulo, { fontFamily: Fonts.heading }]}>Movimentações</Text>
      <Text style={lc.cabSub}>mais recentes primeiro</Text>
    </View>

    {histLoading && histEvents.length === 0 && (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator color={Colors.violet3} />
      </View>
    )}

    {!histLoading && !histLoaded && (
      <Pressable
        style={[m.cta, { marginVertical: 10 }]}
        onPress={() => loadHistory()}
      >
        <Text style={[m.ctaTxt, { fontFamily: Fonts.body }]}>Carregar movimentações</Text>
      </Pressable>
    )}

    {histEvents.length === 0 && histLoaded && !histLoading && (
      <Text style={[m.emptyTxt, { fontFamily: Fonts.body }]}>Nenhuma movimentação ainda.</Text>
    )}

    {meses.map((g) => (
      <View key={g.mes + g.eventos[0]?.id}>
        <Text style={lc.mes}>{g.mes}</Text>
        {g.eventos.map(renderEvento)}
      </View>
    ))}

    {histCursor && !histLoading && (
      <Pressable
        style={[m.cta, { marginTop: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border }]}
        onPress={() => loadHistory(histCursor)}
      >
        <Text style={[m.ctaTxt, { color: Colors.ink2, fontFamily: Fonts.body }]}>Carregar mais</Text>
      </Pressable>
    )}
    {histLoading && histEvents.length > 0 && (
      <View style={{ paddingVertical: 12, alignItems: "center" }}>
        <ActivityIndicator size="small" color={Colors.violet3} />
      </View>
    )}
  </View>

  <EditarPagamentoModal
    visible={!!editando}
    companyId={companyId}
    pagamento={editando}
    onClose={() => setEditando(null)}
    onSaved={() => { setEditando(null); recarregar(); }}
  />

  {/* B4: DevolucaoModal — renderizada fora do map para evitar aninhamento */}
  {refundSale && (
    <DevolucaoModal
      visible={!!refundSale}
      companyId={companyId}
      sale={refundSale}
      onClose={() => setRefundSale(null)}
      onDone={() => {
        setRefundSale(null);
        onRefresh();
        setHistLoaded(false);
        loadHistory();
      }}
    />
  )}
</View>
  );
}

const lc = StyleSheet.create({
  cab: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  cabTitulo: { fontFamily: Fonts.heading, fontSize: 20, color: Colors.ink },
  cabSub: { fontFamily: Fonts.body, fontSize: 11.5, color: CorDaFicha.secundario },
  mes: {
    fontFamily: Fonts.body, fontSize: 11, fontWeight: "700", color: CorDaFicha.secundario,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 2,
  },
  ev: { flexDirection: "row", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  dia: { fontFamily: Fonts.body, width: 44, fontSize: 12, fontWeight: "600", color: CorDaFicha.secundario, paddingTop: 1 },
  topo: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  titulo: { fontFamily: Fonts.body, flex: 1, minWidth: 0, fontSize: 13, fontWeight: "700", color: Colors.ink },
  valor: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "800", ...NUM },
  note: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink2, marginTop: 3, lineHeight: 16 },
  onde: { fontFamily: Fonts.body, fontSize: 11.5, color: CorDaFicha.secundario, marginTop: 4, marginBottom: 2 },
  itemList: { marginTop: 4, gap: 1 },
  ln: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingVertical: 2 },
  marca: { fontFamily: Fonts.body, width: 14, fontSize: 12.5, fontWeight: "800" },
  lnTxt: { fontFamily: Fonts.body, flex: 1, minWidth: 0, fontSize: 12.5, color: Colors.ink2 },
  lnSub: { fontFamily: Fonts.body, fontSize: 11.5, color: CorDaFicha.secundario, marginTop: 1 },
  lnVal: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "600", color: Colors.ink, ...NUM },
  antigo: { fontFamily: Fonts.body, fontSize: 11.5, color: CorDaFicha.secundario, marginTop: 5, lineHeight: 16 },
  acoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 7 },
  // Alvo ≥44px (toque; F5 da ficha).
  acao: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, minHeight: 44, borderRadius: 9,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  acaoTxt: { fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  mais: {
    width: 44, minHeight: 44, borderRadius: 9, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  maisOn: { borderColor: Colors.violet2, backgroundColor: Colors.violetD },
  maisTxt: { fontFamily: Fonts.body, fontSize: 16, fontWeight: "800", color: Colors.ink2, lineHeight: 18 },
  menu: {
    marginTop: 6, padding: 4, borderRadius: 11, gap: 2,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  menuItem: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: 8 },
  menuTxt: { fontFamily: Fonts.body, fontSize: 13, fontWeight: "600", color: Colors.ink },
});
