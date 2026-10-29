// ============================================================
// AURA. — Canal Digital · TabPedidos
//
// Histórico (detalhes nos commits):
//   03/05 Pix manual (comprovante + aprovar/rejeitar) · 11/05 confirmação
//   manual de pagamento · 18/05 chips por grupo · 21/05 cartão (CheckoutPro)
//   e excluir pedido teste · 25/05 accent por vertical · 17/08 aprovar Pix
//   voltou a funcionar e contraste no escuro.
//
// 10/09/2026 — REDESENHO da fila (relato do Caio com print da Finesse):
//   1. Visual: status tinham cor fixa clara (#fef3c7...) — no tema escuro
//      viravam pílulas creme brilhantes, e o card pendente ganhava borda
//      âmbar de 2 px e fundo tingido. Agora o card é neutro, com uma barra
//      lateral no tom do status quando pede ação, e a pílula usa os tokens
//      do tema. A folha de detalhe tinha fundo branco fixo.
//   2. Cancelar e Excluir no próprio card, com confirmação ali mesmo. Antes
//      Cancelar só aparecia no detalhe e NÃO aparecia em Pix pendente.
//   3. Foto e nome do primeiro item no card, e busca por número, cliente,
//      telefone ou produto (backend: services/filaDePedidos.js).
//   4. Detalhe carregado da rota própria — a seção "Itens" lia o objeto da
//      lista, que nunca trouxe itens, e saía vazia.
//   5. `orderIdInicial`: o link do aviso no navegador abre o pedido direto.
//
// Regras (quem pode confirmar, cancelar, excluir; rótulos) vivem em
// utils/filaDePedidos.ts, testadas sem montar componente.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Modal, ActivityIndicator, Linking, Image, TextInput,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useDigitalOrders, useDigitalOrderDetail } from "@/hooks/useDigitalOrders";
import { toast } from "@/components/Toast";
import { useChannelStyles } from "./shared";
import { useAccent } from "@/contexts/AccentTheme";
import type { AccentTokens } from "@/contexts/AccentTheme";
import {
  CHIPS, ChipKey, Tom, PedidoDaFila, PROXIMO_STATUS,
  situacaoDoPedido, rotuloDoStatus, podeConfirmarPagamento, podeCancelar, podeExcluir,
  filtrarPorGrupo, contagemDosGrupos, resumoDosItens, rotuloDoPagamento,
  rotuloDaEntrega, tempoDesde, formatarReais,
} from "@/utils/filaDePedidos";
// tq-47 (29/10/2026): fila do pedido com aceite — aceitar com o tempo,
// recusar com o motivo, saiu para entrega, aviso pelo WhatsApp da lojista.
import {
  TEMPOS_DE_PREPARO, PREPARO_PADRAO, MOTIVOS_RAPIDOS, AVISO_DO_PIX_PAGO,
  podeAceitar, textoDoPedidoParado, pedidosParaRepetirAviso, horaPrevista, proximoPasso,
  lembreteNaEntrega, tituloDoAviso, type AvisoWhatsapp,
} from "@/utils/filaComAceite";
import { tocarAvisoDePedido } from "@/utils/somDePedido";

function coresDoTom(tom: Tom): { cor: string; fundo: string } {
  switch (tom) {
    case "ambar":    return { cor: Colors.amber, fundo: Colors.amberD };
    case "vermelho": return { cor: Colors.red, fundo: Colors.redD };
    case "violeta":  return { cor: Colors.violet3, fundo: Colors.violetD };
    case "verde":    return { cor: Colors.green, fundo: Colors.greenD };
    default:         return { cor: Colors.ink3, fundo: Colors.bg4 };
  }
}

function Miniatura({ uri, tamanho = 48 }: { uri?: string | null; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  const altura = Math.round(tamanho * 1.25);
  if (!uri || falhou) {
    return (
      <View style={[estiloMini.caixa, { width: tamanho, height: altura }]}>
        <Icon name="package" size={Math.round(tamanho * 0.4)} color={Colors.ink3} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFalhou(true)}
      style={[estiloMini.caixa, { width: tamanho, height: altura }]}
      resizeMode="cover"
    />
  );
}

const estiloMini = StyleSheet.create({
  caixa: { borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});

type Confirmacao = { tipo: "cancelar" | "excluir"; id: string } | null;

export function TabPedidos({ companyId, orderIdInicial }: { companyId?: string; orderIdInicial?: string } = {}) {
  const cs = useChannelStyles();
  const accent = useAccent();
  const s = useMemo(() => buildStyles(accent), [accent]);

  const [filter, setFilter] = useState<ChipKey>("all");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(orderIdInicial || null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [proofZoom, setProofZoom] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [modoNoDetalhe, setModoNoDetalhe] = useState<"normal" | "cancelar" | "excluir" | "recusar">("normal");
  const [working, setWorking] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // tq-47: tempo escolhido por pedido, ação em andamento, a faixa "avise a
  // cliente" depois de cada passo e o relógio do destaque de pedido parado.
  const [tempoPorPedido, setTempoPorPedido] = useState<Record<string, number>>({});
  const [agindoId, setAgindoId] = useState<string | null>(null);
  const [ultimoAviso, setUltimoAviso] = useState<{ titulo: string; aviso: AvisoWhatsapp } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const avisosRepetidos = useRef<Set<string>>(new Set());

  // Busca vai ao servidor 300 ms depois da última tecla.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  // Link do aviso (/canal?tab=pedidos&order_id=...) chegando com a tela aberta.
  useEffect(() => {
    if (orderIdInicial) setAbertoId(orderIdInicial);
  }, [orderIdInicial]);

  const {
    orders, counts, kpi, isLoading, isFetching, refetch,
    updateStatus, isUpdating, cancelOrder, isCancelling, deleteOrder, isDeleting,
    approvePayment: approvePaymentApi, rejectPayment: rejectPaymentApi,
    filaComAceite, acceptOrder, refuseOrder, markOutForDelivery, markRefunded, markDelivered,
  } = useDigitalOrders("all", companyId, buscaAplicada);

  // Relógio do "há 12 min sem resposta" (a lista em si já atualiza a cada 30 s).
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Acréscimo da Nina (19/10): pedido parado há 10 min repete o aviso de
  // pedido novo UMA vez. Nada cancela sozinho.
  useEffect(() => {
    const parados = pedidosParaRepetirAviso(orders as PedidoDaFila[], avisosRepetidos.current, agora);
    if (!parados.length) return;
    parados.forEach((o) => avisosRepetidos.current.add(o.id));
    tocarAvisoDePedido();
    const o = parados[0];
    toast.info(parados.length === 1
      ? `O pedido #${o.order_number} está esperando o seu aceite.`
      : `${parados.length} pedidos estão esperando o seu aceite.`);
  }, [orders, agora]);

  function tempoDoPedido(id: string): number {
    return tempoPorPedido[id] || PREPARO_PADRAO;
  }

  function mostrarAviso(numero: string | number, res: any) {
    const aviso: AvisoWhatsapp | null = res?.aviso_whatsapp || null;
    if (aviso && aviso.texto) setUltimoAviso({ titulo: tituloDoAviso(aviso.passo, numero), aviso });
  }

  function abrirWhatsapp(aviso: AvisoWhatsapp | null | undefined) {
    if (aviso?.link) Linking.openURL(aviso.link);
  }

  async function aceitar(o: any) {
    setAgindoId(o.id);
    try {
      const res = await acceptOrder(o.id, tempoDoPedido(o.id));
      toast.success(`Pedido #${o.order_number} aceito`);
      mostrarAviso(o.order_number, res);
      if (abertoId === o.id) fecharDetalhe();
    } catch (err: any) {
      toast.error(err?.message || "Não deu para aceitar o pedido. Tente de novo.");
    } finally {
      setAgindoId(null);
    }
  }

  async function recusarDoDetalhe() {
    if (!pedidoAberto) return;
    const texto = motivo.trim();
    if (!texto) { toast.error("Escreva o motivo: é o que a cliente vai ler."); return; }
    setWorking(true);
    try {
      const res = await refuseOrder(pedidoAberto.id, texto);
      toast.success(`Pedido #${pedidoAberto.order_number} recusado`);
      mostrarAviso(pedidoAberto.order_number, res);
      fecharDetalhe();
    } catch (err: any) {
      toast.error(err?.message || "Não deu para recusar o pedido. Tente de novo.");
    } finally {
      setWorking(false);
    }
  }

  async function seguirPasso(o: any) {
    const passo = proximoPasso(o);
    if (!passo) return;
    setAgindoId(o.id);
    try {
      const res = passo.acao === "saiu"
        ? await markOutForDelivery(o.id)
        : passo.status === "delivered"
          ? await markDelivered(o.id)
          : await updateStatus({ oid: o.id, status: passo.status });
      mostrarAviso(o.order_number, res);
      if (abertoId === o.id) fecharDetalhe();
    } catch (err: any) {
      toast.error(err?.message || "Não deu para atualizar o pedido. Tente de novo.");
    } finally {
      setAgindoId(null);
    }
  }

  async function marcarDevolvido(o: any) {
    setWorking(true);
    try {
      await markRefunded(o.id);
      toast.success("Marcado como devolvido");
    } catch (err: any) {
      toast.error(err?.message || "Não deu para marcar. Tente de novo.");
    } finally {
      setWorking(false);
    }
  }

  const detalhe = useDigitalOrderDetail(abertoId, companyId);
  // Enquanto o detalhe carrega, o card da lista já desenha o cabeçalho.
  const pedidoAberto: any = detalhe.data || orders.find((o: any) => o.id === abertoId) || null;

  const pedidosFiltrados = useMemo(() => filtrarPorGrupo(orders as PedidoDaFila[], filter), [orders, filter]);
  const grupos = contagemDosGrupos(counts);

  function fecharDetalhe() {
    setAbertoId(null);
    setModoNoDetalhe("normal");
    setMotivo("");
  }

  async function confirmarPagamento(o: any, opts?: { daLista?: boolean }) {
    if (!o) return;
    if (opts?.daLista) setApprovingId(o.id); else setWorking(true);
    try {
      await approvePaymentApi(o.id);
      toast.success("Pagamento confirmado · pedido #" + o.order_number);
      if (!opts?.daLista) fecharDetalhe();
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao confirmar pagamento");
    } finally {
      if (opts?.daLista) setApprovingId(null); else setWorking(false);
    }
  }

  async function cancelarDaLista(o: any) {
    try {
      await cancelOrder({ oid: o.id, orderNumber: o.order_number });
      setConfirmacao(null);
    } catch {}
  }

  async function excluirDaLista(o: any) {
    try {
      await deleteOrder(o.id);
      setConfirmacao(null);
    } catch {}
  }

  // No detalhe, cancelar Pix pendente/comprovante usa reject-payment: ele
  // grava o motivo na nota do pedido. O resto usa o status "cancelled".
  async function cancelarDoDetalhe() {
    if (!pedidoAberto) return;
    setWorking(true);
    try {
      if (podeConfirmarPagamento(pedidoAberto)) {
        await rejectPaymentApi(pedidoAberto.id, motivo.trim() || undefined);
        toast.success(`Pedido #${pedidoAberto.order_number} cancelado`);
      } else {
        await cancelOrder({ oid: pedidoAberto.id, orderNumber: pedidoAberto.order_number });
      }
      fecharDetalhe();
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar o pedido");
    } finally {
      setWorking(false);
    }
  }

  async function excluirDoDetalhe() {
    if (!pedidoAberto) return;
    try {
      await deleteOrder(pedidoAberto.id);
      fecharDetalhe();
    } catch {}
  }

  async function avancar() {
    if (!pedidoAberto) return;
    const proximo = PROXIMO_STATUS[pedidoAberto.status];
    if (!proximo) return;
    await updateStatus({ oid: pedidoAberto.id, status: proximo });
    fecharDetalhe();
  }

  return (
    <View>
      {/* Cartões de cima: o que pede ação, o que está andando, o que entrou hoje. */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <View style={[s.kpiBarra, { backgroundColor: grupos.precisaAgir ? Colors.amber : Colors.border }]} />
          <Text style={[s.kpiNum, grupos.precisaAgir ? { color: Colors.amber } : null]}>{grupos.precisaAgir}</Text>
          <Text style={s.kpiLabel}>Precisa agir</Text>
        </View>
        <View style={s.kpiCard}>
          <View style={[s.kpiBarra, { backgroundColor: Colors.violet3 }]} />
          <Text style={s.kpiNum}>{grupos.emCurso}</Text>
          <Text style={s.kpiLabel}>Em curso</Text>
        </View>
        <View style={s.kpiCard}>
          <View style={[s.kpiBarra, { backgroundColor: Colors.green }]} />
          <Text style={s.kpiNum} numberOfLines={1} adjustsFontSizeToFit>{formatarReais(kpi.revenue_today)}</Text>
          <Text style={s.kpiLabel}>Receita hoje</Text>
        </View>
      </View>

      {/* Busca */}
      <View style={s.buscaCaixa}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nº do pedido, cliente, telefone ou produto"
          placeholderTextColor={Colors.ink3}
          // outlineStyle só existe no web e não está no tipo do RN: vai inline.
          style={[s.buscaInput, { outlineStyle: "none" } as any]}
          testID="fila-busca"
          accessibilityLabel="Buscar pedidos"
        />
        {isFetching && !!buscaAplicada && <ActivityIndicator size="small" color={Colors.ink3} />}
        {!!busca && (
          <Pressable onPress={() => setBusca("")} style={s.buscaLimpar} accessibilityLabel="Limpar busca">
            <Icon name="x" size={13} color={Colors.ink3} />
          </Pressable>
        )}
      </View>

      <View style={s.chipsLinha}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
          {CHIPS.map((c) => {
            const ativo = filter === c.key;
            const badge = c.key === "precisa-agir" && grupos.precisaAgir > 0;
            return (
              <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[cs.filterChip, ativo && cs.filterChipActive, s.chip]}>
                <Text style={[cs.filterText, ativo && cs.filterTextActive]}>{c.label}</Text>
                {badge && (
                  <View style={s.chipBadge}>
                    <Text style={s.chipBadgeText}>{grupos.precisaAgir}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable onPress={() => refetch()} style={s.refreshBtn} accessibilityLabel="Atualizar pedidos">
          <Icon name="refresh" size={12} color={accent.primaryStrong} />
          <Text style={s.refreshText}>Atualizar</Text>
        </Pressable>
      </View>

      {/* tq-47: depois de aceitar, recusar, saiu ou entregue — avisar a cliente. */}
      {ultimoAviso && (
        <View style={s.avisoFaixa} testID="fila-aviso-cliente">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.avisoTitulo}>{ultimoAviso.titulo} Avise a cliente:</Text>
            <Text style={s.avisoTexto} numberOfLines={2}>{ultimoAviso.aviso.texto}</Text>
          </View>
          {!!ultimoAviso.aviso.link && (
            <Pressable onPress={() => abrirWhatsapp(ultimoAviso.aviso)} style={s.btnWhats} testID="fila-aviso-whatsapp">
              <Text style={s.btnWhatsTexto}>Avisar no WhatsApp</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setUltimoAviso(null)} style={s.buscaLimpar} accessibilityLabel="Fechar aviso">
            <Icon name="x" size={13} color={Colors.ink3} />
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="small" color={accent.primary} style={{ marginTop: 32 }} />
      ) : pedidosFiltrados.length === 0 ? (
        <View style={s.vazio}>
          <Icon name="inbox" size={30} color={Colors.ink3} />
          <Text style={s.vazioTitulo}>{buscaAplicada ? "Nenhum pedido encontrado" : "Nenhum pedido aqui"}</Text>
          <Text style={s.vazioDesc}>
            {buscaAplicada
              ? `Nada com “${buscaAplicada}”. Tente o número do pedido ou o nome do cliente.`
              : "Quando clientes fizerem pedidos pelo site, eles aparecem aqui."}
          </Text>
        </View>
      ) : (
        pedidosFiltrados.map((o: any) => {
          const sit = situacaoDoPedido(o);
          const cores = coresDoTom(sit.tom);
          const confirmar = podeConfirmarPagamento(o);
          // tq-47: quem espera aceite mostra Aceitar/Recusar no lugar de Cancelar.
          const aceitavel = podeAceitar(o, filaComAceite);
          const cancelar = podeCancelar(o) && !aceitavel;
          const excluir = podeExcluir(o);
          const parado = textoDoPedidoParado(o, filaComAceite, agora);
          const passo = !aceitavel && o.accepted_at ? proximoPasso(o) : null;
          const prevista = horaPrevista(o);
          const lembrete = lembreteNaEntrega(o);
          const agindo = agindoId === o.id;
          const confirmandoCancelar = !!confirmacao && confirmacao.id === o.id && confirmacao.tipo === "cancelar";
          const confirmandoExcluir = !!confirmacao && confirmacao.id === o.id && confirmacao.tipo === "excluir";
          const itens = resumoDosItens(o);
          return (
            <Pressable key={o.id} style={s.card} onPress={() => setAbertoId(o.id)} testID={`fila-pedido-${o.order_number}`}>
              <View style={[s.cardBarra, { backgroundColor: sit.precisaAgir ? cores.cor : "transparent" }]} />
              <View style={s.cardCorpo}>
                <View style={s.cardTopo}>
                  <Miniatura uri={o.first_item_image} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.cardLinha}>
                      <Text style={s.cardNum}>#{o.order_number}</Text>
                      <View style={[s.pill, { backgroundColor: cores.fundo }]}>
                        <View style={[s.pillPonto, { backgroundColor: cores.cor }]} />
                        <Text style={[s.pillTexto, { color: cores.cor }]}>{sit.rotulo}</Text>
                      </View>
                    </View>
                    <Text style={s.cardCliente} numberOfLines={1}>{o.customer_name || "Cliente"}</Text>
                    {!!itens && <Text style={s.cardItens} numberOfLines={1}>{itens}</Text>}
                  </View>
                </View>

                <View style={s.cardRodape}>
                  <Text style={s.cardTotal}>{formatarReais(o.total)}</Text>
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {rotuloDoPagamento(o.payment_method, o.pay_on_delivery_method)} · {rotuloDaEntrega(o.delivery_type)} · {tempoDesde(o.created_at)}
                  </Text>
                </View>

                {!!parado && (
                  <View style={s.parado} testID={`fila-parado-${o.order_number}`}>
                    <Icon name="clock" size={11} color={Colors.red} />
                    <Text style={s.paradoTexto}>{parado}</Text>
                  </View>
                )}
                {(aceitavel || lembrete) && !!o.pagamento_na_entrega && (
                  <Text style={s.pagamentoNaEntrega}>{o.pagamento_na_entrega}</Text>
                )}
                {!!lembrete && <Text style={s.cardItens}>{lembrete}</Text>}
                {!aceitavel && !!prevista && ["preparing", "ready"].includes(o.status) && (
                  <Text style={s.cardItens}>Previsto até {prevista}</Text>
                )}

                {aceitavel && !confirmandoCancelar && !confirmandoExcluir && (
                  <View style={s.aceiteCaixa}>
                    <Text style={s.aceitePergunta}>Quanto tempo leva?</Text>
                    <View style={s.tempos}>
                      {TEMPOS_DE_PREPARO.map((t) => {
                        const sel = tempoDoPedido(o.id) === t;
                        return (
                          <Pressable
                            key={t}
                            onPress={() => setTempoPorPedido((atual) => ({ ...atual, [o.id]: t }))}
                            style={[s.tempoChip, sel && { backgroundColor: accent.primary, borderColor: accent.primary }]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: sel }}
                          >
                            <Text style={[s.tempoTexto, sel && { color: "#fff" }]}>{t} min</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={s.acoes}>
                      <Pressable
                        onPress={() => aceitar(o)}
                        disabled={agindo}
                        style={[s.btnPrimario, agindo && { opacity: 0.6 }]}
                        testID={`fila-aceitar-${o.order_number}`}
                      >
                        {agindo ? <ActivityIndicator size="small" color="#fff" /> : (
                          <>
                            <Icon name="check" size={12} color="#fff" />
                            <Text style={s.btnPrimarioTexto}>Aceitar</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => { setAbertoId(o.id); setModoNoDetalhe("recusar"); }}
                        style={s.btnRecusar}
                        testID={`fila-recusar-${o.order_number}`}
                      >
                        <Text style={s.btnRecusarTexto}>Recusar</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {passo && (passo.acao === "saiu" || o.status === "out_for_delivery") ? (
                  <View style={s.acoes}>
                    <Pressable
                      onPress={() => seguirPasso(o)}
                      disabled={agindo}
                      style={[s.btnPrimario, agindo && { opacity: 0.6 }]}
                      testID={`fila-passo-${o.order_number}`}
                    >
                      {agindo ? <ActivityIndicator size="small" color="#fff" /> : (
                        <Text style={s.btnPrimarioTexto}>{passo.rotulo}</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {o.status === "awaiting_approval" && !!o.payment_proof_url && (
                  <View style={s.comprovante}>
                    <Icon name="check" size={11} color={Colors.green} />
                    <Text style={s.comprovanteTexto}>Comprovante anexado</Text>
                  </View>
                )}

                {(confirmandoCancelar || confirmandoExcluir) ? (
                  <View style={s.confirmaCaixa}>
                    <Text style={s.confirmaTexto}>
                      {confirmandoCancelar
                        ? `Cancelar o pedido #${o.order_number}? A cliente é avisada por e-mail se tiver informado um.`
                        : `Excluir o pedido #${o.order_number} de vez? Não dá para desfazer.`}
                    </Text>
                    <View style={s.acoes}>
                      <Pressable onPress={() => setConfirmacao(null)} style={s.btnSecundario}>
                        <Text style={s.btnSecundarioTexto}>Voltar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => (confirmandoCancelar ? cancelarDaLista(o) : excluirDaLista(o))}
                        disabled={isCancelling || isDeleting}
                        style={[s.btnPerigo, (isCancelling || isDeleting) && { opacity: 0.6 }]}
                      >
                        <Text style={s.btnPerigoTexto}>
                          {confirmandoCancelar ? (isCancelling ? "Cancelando..." : "Cancelar pedido") : (isDeleting ? "Excluindo..." : "Excluir")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (confirmar || cancelar || excluir) ? (
                  <View style={s.acoes}>
                    {confirmar && (
                      <Pressable
                        onPress={() => confirmarPagamento(o, { daLista: true })}
                        disabled={approvingId === o.id}
                        style={[s.btnPrimario, approvingId === o.id && { opacity: 0.6 }]}
                        testID={`fila-confirmar-${o.order_number}`}
                      >
                        {approvingId === o.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Icon name="check" size={12} color="#fff" />
                            <Text style={s.btnPrimarioTexto}>Confirmar pagamento</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                    {cancelar && (
                      <Pressable onPress={() => setConfirmacao({ tipo: "cancelar", id: o.id })} style={s.btnSecundario} testID={`fila-cancelar-${o.order_number}`}>
                        <Icon name="x_circle" size={12} color={Colors.ink2} />
                        <Text style={s.btnSecundarioTexto}>Cancelar</Text>
                      </Pressable>
                    )}
                    {excluir && (
                      <Pressable onPress={() => setConfirmacao({ tipo: "excluir", id: o.id })} style={s.btnIcone} accessibilityLabel={`Excluir pedido ${o.order_number}`} testID={`fila-excluir-${o.order_number}`}>
                        <Icon name="trash" size={13} color={Colors.ink3} />
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}

      {/* Detalhe */}
      <Modal visible={!!abertoId} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={fecharDetalhe}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            {!pedidoAberto ? (
              <ActivityIndicator size="small" color={accent.primary} style={{ margin: 40 }} />
            ) : (() => {
              const o = pedidoAberto;
              const sit = situacaoDoPedido(o);
              const cores = coresDoTom(sit.tom);
              const aceitavel = podeAceitar(o, filaComAceite);
              // tq-47: pedido aceito pela fila segue "saiu para entrega"; o resto, como antes.
              const passo = aceitavel ? null : (o.accepted_at || o.status === "out_for_delivery" ? proximoPasso(o) : null);
              const proximo = passo ? null : PROXIMO_STATUS[o.status];
              const confirmar = podeConfirmarPagamento(o);
              const cancelar = podeCancelar(o) && !aceitavel;
              const excluir = podeExcluir(o);
              const cartao = o.payment_method === "card";
              const prevista = horaPrevista(o);
              const pagoOnline = (o.payment_method === "pix" || cartao) && ["confirmed", "paid", "received"].includes(String(o.payment_status || ""));
              const itens: any[] = Array.isArray(o.items) ? o.items : [];
              return (
                <>
                  <View style={s.sheetHead}>
                    <View>
                      <Text style={s.sheetTitle}>Pedido #{o.order_number}</Text>
                      <Text style={s.sheetSub}>{tempoDesde(o.created_at)}</Text>
                    </View>
                    <Pressable onPress={fecharDetalhe} style={s.closeBtn} accessibilityLabel="Fechar">
                      <Icon name="x" size={16} color={Colors.ink3} />
                    </Pressable>
                  </View>

                  <ScrollView style={{ padding: 20 }}>
                    <View style={[s.statusBanner, { backgroundColor: cores.fundo, borderColor: cores.cor }]}>
                      <Text style={[s.statusBannerText, { color: cores.cor }]}>{sit.rotulo}</Text>
                      {!!prevista && ["preparing", "ready"].includes(o.status) && (
                        <Text style={[s.dSub, { color: cores.cor }]}>Previsto até {prevista}</Text>
                      )}
                      {o.status === "cancelled" && !!o.cancel_reason && (
                        <Text style={[s.dSub, { color: cores.cor }]}>Motivo: {o.cancel_reason}</Text>
                      )}
                    </View>

                    {aceitavel && modoNoDetalhe === "normal" && (
                      <View style={{ marginBottom: 8 }}>
                        <Text style={s.aceitePergunta}>Quanto tempo leva?</Text>
                        <View style={s.tempos}>
                          {TEMPOS_DE_PREPARO.map((t) => {
                            const sel = tempoDoPedido(o.id) === t;
                            return (
                              <Pressable
                                key={t}
                                onPress={() => setTempoPorPedido((atual) => ({ ...atual, [o.id]: t }))}
                                style={[s.tempoChip, sel && { backgroundColor: accent.primary, borderColor: accent.primary }]}
                              >
                                <Text style={[s.tempoTexto, sel && { color: "#fff" }]}>{t} min</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {!!o.aviso_whatsapp?.link && (
                      <Pressable onPress={() => abrirWhatsapp(o.aviso_whatsapp)} style={s.btnWhatsLargo} testID="detalhe-avisar-whatsapp">
                        <Icon name="whatsapp" size={14} color="#fff" />
                        <Text style={s.btnWhatsTexto}>Avisar a cliente no WhatsApp</Text>
                      </Pressable>
                    )}

                    {!!o.devolver_por_fora && (
                      <View style={[cs.card, s.caixaAtencao]}>
                        <Text style={s.dLine}>A cliente pagou {cartao ? "no cartão" : "o Pix"} e o pedido foi recusado.</Text>
                        <Text style={s.dSub}>Devolva o valor por fora e marque aqui quando tiver devolvido.</Text>
                        <Pressable onPress={() => marcarDevolvido(o)} disabled={working} style={[s.btnSecundario, { marginTop: 10, alignSelf: "flex-start" }, working && { opacity: 0.6 }]}>
                          <Text style={s.btnSecundarioTexto}>Marcar como devolvido</Text>
                        </Pressable>
                      </View>
                    )}

                    <Text style={s.sec}>Pagamento</Text>
                    <View style={cs.card}>
                      <Text style={s.dLine}>{rotuloDoPagamento(o.payment_method, o.pay_on_delivery_method)}</Text>
                      <Text style={s.dSub}>
                        {o.pagamento_na_entrega
                          ? o.pagamento_na_entrega
                          : o.payment_status === "confirmed"
                          ? (cartao ? "Pagamento confirmado pelo Mercado Pago" : "Pagamento confirmado")
                          : o.payment_status === "expired"
                            ? "O Pix não foi pago em 48 h e o pedido foi cancelado automaticamente."
                            : o.payment_method === "on_delivery"
                              ? "Cliente paga no momento da entrega ou retirada"
                              : o.status === "awaiting_approval"
                                ? "Cliente avisou que pagou. Confira o comprovante e confirme abaixo."
                                : cartao && o.status === "pending_payment"
                                  ? "Cliente foi para o checkout do Mercado Pago. A confirmação entra sozinha quando o pagamento for aprovado."
                                  : o.status === "pending_payment"
                                    ? "Cliente ainda não avisou no site. Se o Pix já caiu na sua conta, confirme abaixo."
                                    : "Aguardando pagamento"}
                      </Text>
                      {!!o.payment_proof_url && (
                        <Pressable onPress={() => setProofZoom(o.payment_proof_url)} style={s.proofThumb}>
                          {String(o.payment_proof_url).toLowerCase().includes(".pdf") ? (
                            <View style={s.proofPdf}>
                              <Icon name="file_text" size={24} color={accent.primaryStrong} />
                              <Text style={s.proofPdfText}>Ver comprovante (PDF)</Text>
                            </View>
                          ) : (
                            <Image source={{ uri: o.payment_proof_url }} style={s.proofImg} resizeMode="cover" />
                          )}
                          <Text style={s.proofZoomHint}>Toque para ampliar</Text>
                        </Pressable>
                      )}
                    </View>

                    <Text style={s.sec}>Cliente</Text>
                    <View style={cs.card}>
                      <Text style={s.dLine}>{o.customer_name}</Text>
                      {!!o.customer_phone && (
                        <Pressable onPress={() => Linking.openURL(`https://wa.me/${String(o.customer_phone).replace(/\D/g, "")}`)}>
                          <Text style={[s.dSub, { color: accent.primaryStrong }]}>{o.customer_phone} · abrir WhatsApp</Text>
                        </Pressable>
                      )}
                      {!!o.customer_email && <Text style={s.dSub}>{o.customer_email}</Text>}
                    </View>

                    <Text style={s.sec}>Entrega</Text>
                    <View style={cs.card}>
                      <Text style={s.dLine}>{o.delivery_type === "delivery" ? "Entrega a domicílio" : rotuloDaEntrega(o.delivery_type)}</Text>
                      {!!o.delivery_address && <Text style={s.dSub}>{o.delivery_address}</Text>}
                    </View>

                    <Text style={s.sec}>Itens</Text>
                    <View style={cs.card}>
                      {detalhe.isLoading && !itens.length ? (
                        <ActivityIndicator size="small" color={Colors.ink3} />
                      ) : itens.length === 0 ? (
                        <Text style={s.dSub}>Sem itens registrados.</Text>
                      ) : itens.map((item: any, i: number) => (
                        <View key={item.id || i} style={[s.itemRow, i > 0 && s.itemSeparado]}>
                          <Miniatura uri={item.product_image} tamanho={36} />
                          <Text style={s.itemName}>{item.product_name_display || item.product_name} × {item.quantity}</Text>
                          <Text style={s.itemPrice}>{formatarReais(item.subtotal)}</Text>
                        </View>
                      ))}
                      <View style={s.somaBloco}>
                        {Number(o.delivery_fee) > 0 && (
                          <View style={s.sumRow}><Text style={s.sumLabel}>Entrega</Text><Text style={s.sumVal}>{formatarReais(o.delivery_fee)}</Text></View>
                        )}
                        <View style={s.sumRow}>
                          <Text style={[s.sumLabel, s.sumForte]}>Total</Text>
                          <Text style={[s.sumVal, s.sumForte]}>{formatarReais(o.total)}</Text>
                        </View>
                      </View>
                    </View>

                    {!!o.notes && (
                      <>
                        <Text style={s.sec}>Observações</Text>
                        <View style={cs.card}><Text style={s.dSub}>{String(o.notes).trim()}</Text></View>
                      </>
                    )}

                    {modoNoDetalhe === "recusar" && (
                      <View style={[cs.card, s.caixaPerigo]} testID="detalhe-recusar">
                        <Text style={[cs.fieldLabel, { color: Colors.red }]}>Por que você vai recusar?</Text>
                        <Text style={s.dSub}>A cliente lê esse motivo no aviso do WhatsApp.</Text>
                        <View style={[s.tempos, { marginTop: 8 }]}>
                          {MOTIVOS_RAPIDOS.map((m) => (
                            <Pressable key={m} onPress={() => setMotivo(m)} style={[s.tempoChip, motivo === m && { backgroundColor: Colors.red, borderColor: Colors.red }]}>
                              <Text style={[s.tempoTexto, motivo === m && { color: "#fff" }]}>{m}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <TextInput
                          style={[cs.input, { marginTop: 8 }]}
                          value={motivo}
                          onChangeText={setMotivo}
                          placeholder="Ou escreva com as suas palavras"
                          placeholderTextColor={Colors.ink3}
                          multiline
                          testID="detalhe-motivo-recusa"
                        />
                        {pagoOnline && <Text style={[s.dSub, { marginTop: 8 }]}>{AVISO_DO_PIX_PAGO}</Text>}
                      </View>
                    )}

                    {modoNoDetalhe === "cancelar" && (
                      <View style={[cs.card, s.caixaPerigo]}>
                        <Text style={[cs.fieldLabel, { color: Colors.red }]}>
                          {confirmar ? "Motivo do cancelamento (opcional)" : "Cancelar este pedido?"}
                        </Text>
                        {confirmar ? (
                          <TextInput
                            style={cs.input}
                            value={motivo}
                            onChangeText={setMotivo}
                            placeholder="Ex.: o Pix não caiu na conta"
                            placeholderTextColor={Colors.ink3}
                            multiline
                          />
                        ) : (
                          <Text style={s.dSub}>A cliente é avisada por e-mail se tiver informado um.</Text>
                        )}
                      </View>
                    )}

                    {modoNoDetalhe === "excluir" && (
                      <View style={[cs.card, s.caixaPerigo]}>
                        <Text style={[s.dLine, { color: Colors.red }]}>Excluir o pedido de vez?</Text>
                        <Text style={s.dSub}>Apaga o pedido e os itens. Não dá para desfazer. Use para pedidos de teste.</Text>
                      </View>
                    )}

                    {excluir && modoNoDetalhe === "normal" && (
                      <Pressable onPress={() => setModoNoDetalhe("excluir")} style={s.linkExcluir}>
                        <Text style={s.linkExcluirTexto}>Excluir pedido de vez</Text>
                      </Pressable>
                    )}

                    <View style={{ height: 24 }} />
                  </ScrollView>

                  <View style={s.sheetFoot}>
                    {modoNoDetalhe === "excluir" ? (
                      <>
                        <Pressable onPress={() => setModoNoDetalhe("normal")} disabled={isDeleting} style={s.footSecundario}>
                          <Text style={s.footSecundarioTexto}>Voltar</Text>
                        </Pressable>
                        <Pressable onPress={excluirDoDetalhe} disabled={isDeleting} style={[s.footPrimario, { backgroundColor: Colors.red }, isDeleting && { opacity: 0.6 }]}>
                          <Text style={s.footPrimarioTexto}>{isDeleting ? "Excluindo..." : "Excluir de vez"}</Text>
                        </Pressable>
                      </>
                    ) : modoNoDetalhe === "recusar" ? (
                      <>
                        <Pressable onPress={() => { setModoNoDetalhe("normal"); setMotivo(""); }} disabled={working} style={s.footSecundario}>
                          <Text style={s.footSecundarioTexto}>Voltar</Text>
                        </Pressable>
                        <Pressable onPress={recusarDoDetalhe} disabled={working} style={[s.footPrimario, { backgroundColor: Colors.red }, working && { opacity: 0.6 }]} testID="detalhe-confirmar-recusa">
                          <Text style={s.footPrimarioTexto}>{working ? "Recusando..." : "Recusar pedido"}</Text>
                        </Pressable>
                      </>
                    ) : aceitavel ? (
                      <>
                        <Pressable onPress={() => setModoNoDetalhe("recusar")} disabled={agindoId === o.id} style={s.footSecundario}>
                          <Text style={s.footSecundarioTexto}>Recusar</Text>
                        </Pressable>
                        <Pressable onPress={() => aceitar(o)} disabled={agindoId === o.id} style={[s.footPrimario, { backgroundColor: Colors.green }, agindoId === o.id && { opacity: 0.6 }]}>
                          <Text style={s.footPrimarioTexto}>{agindoId === o.id ? "..." : `Aceitar · ${tempoDoPedido(o.id)} min`}</Text>
                        </Pressable>
                      </>
                    ) : modoNoDetalhe === "cancelar" ? (
                      <>
                        <Pressable onPress={() => { setModoNoDetalhe("normal"); setMotivo(""); }} disabled={working} style={s.footSecundario}>
                          <Text style={s.footSecundarioTexto}>Voltar</Text>
                        </Pressable>
                        <Pressable onPress={cancelarDoDetalhe} disabled={working} style={[s.footPrimario, { backgroundColor: Colors.red }, working && { opacity: 0.6 }]}>
                          <Text style={s.footPrimarioTexto}>{working ? "Cancelando..." : "Cancelar pedido"}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        {cancelar && (
                          <Pressable onPress={() => setModoNoDetalhe("cancelar")} disabled={working || isUpdating} style={s.footSecundario}>
                            <Text style={s.footSecundarioTexto}>Cancelar pedido</Text>
                          </Pressable>
                        )}
                        {confirmar ? (
                          <Pressable onPress={() => confirmarPagamento(o)} disabled={working} style={[s.footPrimario, { backgroundColor: Colors.green }, working && { opacity: 0.6 }]}>
                            <Text style={s.footPrimarioTexto}>
                              {working ? "..." : (o.status === "pending_payment" ? "Confirmar pagamento recebido" : "Aprovar pagamento")}
                            </Text>
                          </Pressable>
                        ) : passo ? (
                          <Pressable onPress={() => seguirPasso(o)} disabled={agindoId === o.id} style={[s.footPrimario, agindoId === o.id && { opacity: 0.6 }]}>
                            <Text style={s.footPrimarioTexto}>{agindoId === o.id ? "..." : passo.rotulo}</Text>
                          </Pressable>
                        ) : !!proximo && (
                          <Pressable onPress={avancar} disabled={isUpdating} style={[s.footPrimario, isUpdating && { opacity: 0.6 }]}>
                            <Text style={s.footPrimarioTexto}>{isUpdating ? "..." : `Marcar como ${rotuloDoStatus(proximo).toLowerCase()}`}</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Lightbox do comprovante */}
      <Modal visible={!!proofZoom} animationType="fade" transparent onRequestClose={() => setProofZoom(null)}>
        <Pressable style={s.lightbox} onPress={() => setProofZoom(null)}>
          {proofZoom && (
            proofZoom.toLowerCase().includes(".pdf") ? (
              <View style={{ alignItems: "center", gap: 16 }}>
                <Text style={{ color: "#fff", fontSize: 18 }}>Comprovante em PDF</Text>
                <Pressable onPress={() => Linking.openURL(proofZoom)} style={s.lightboxOpenBtn}>
                  <Text style={s.lightboxOpenText}>Abrir PDF em nova aba</Text>
                </Pressable>
              </View>
            ) : (
              <Image source={{ uri: proofZoom }} style={s.lightboxImg} resizeMode="contain" />
            )
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function buildStyles(accent: AccentTokens) {
  return StyleSheet.create({
    kpiRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    kpiCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center", overflow: "hidden" },
    kpiBarra: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
    kpiNum: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginBottom: 3 },
    kpiLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textAlign: "center" },

    buscaCaixa: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
    buscaInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },
    buscaLimpar: { padding: 6, borderRadius: 6 },

    chipsLinha: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    chip: { flexDirection: "row", alignItems: "center" },
    chipBadge: { marginLeft: 6, backgroundColor: Colors.amber, borderRadius: 999, minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
    chipBadgeText: { color: Colors.bg, fontSize: 10, fontWeight: "800", lineHeight: 12 },
    refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 6 },
    refreshText: { fontSize: 11, color: accent.primaryStrong, fontWeight: "700" },

    vazio: { alignItems: "center", paddingVertical: 48, gap: 10 },
    vazioTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
    vazioDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, maxWidth: 300 },

    card: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: "hidden" },
    cardBarra: { width: 3 },
    cardCorpo: { flex: 1, padding: 14, gap: 10 },
    cardTopo: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    cardLinha: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 },
    cardNum: { fontSize: 14, fontWeight: "800", color: Colors.ink },
    cardCliente: { fontSize: 12, color: Colors.ink2, marginBottom: 2 },
    cardItens: { fontSize: 12, color: Colors.ink3 },
    cardRodape: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    cardTotal: { fontSize: 15, fontWeight: "800", color: Colors.ink },
    cardMeta: { fontSize: 11, color: Colors.ink3, flexShrink: 1, textAlign: "right" },

    pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    pillPonto: { width: 6, height: 6, borderRadius: 3 },
    pillTexto: { fontSize: 11, fontWeight: "700" },

    comprovante: { flexDirection: "row", alignItems: "center", gap: 5 },
    comprovanteTexto: { fontSize: 11, color: Colors.green, fontWeight: "600" },

    acoes: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
    btnPrimario: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.green, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12 },
    btnPrimarioTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
    btnSecundario: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12 },
    btnSecundarioTexto: { color: Colors.ink2, fontSize: 12, fontWeight: "600" },
    btnIcone: { alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
    btnPerigo: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.red, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12 },
    btnPerigoTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
    confirmaCaixa: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, gap: 2 },
    confirmaTexto: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginBottom: 2 },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: { backgroundColor: Colors.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", overflow: "hidden", borderWidth: 1, borderColor: Colors.border, width: "100%" as any, maxWidth: 720, alignSelf: "center" },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
    sheetTitle: { fontSize: 16, fontWeight: "800", color: Colors.ink },
    sheetSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
    statusBanner: { borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 8, borderWidth: 1 },
    statusBannerText: { fontSize: 14, fontWeight: "800" },
    sec: { fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 14 },
    dLine: { fontSize: 13, fontWeight: "600", color: Colors.ink },
    dSub: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17 },
    proofThumb: { marginTop: 12, alignItems: "center", gap: 6 },
    proofImg: { width: "100%" as any, height: 180, borderRadius: 10, backgroundColor: Colors.bg4 },
    proofPdf: { width: "100%" as any, height: 100, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", gap: 6 },
    proofPdfText: { fontSize: 13, color: accent.primaryStrong, fontWeight: "700" },
    proofZoomHint: { fontSize: 11, color: Colors.ink3 },
    itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    itemSeparado: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 8 },
    itemName: { fontSize: 13, color: Colors.ink, flex: 1 },
    itemPrice: { fontSize: 13, fontWeight: "700", color: Colors.ink },
    somaBloco: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 10, paddingTop: 8 },
    sumRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    sumLabel: { fontSize: 13, color: Colors.ink3 },
    sumVal: { fontSize: 13, color: Colors.ink3 },
    sumForte: { fontWeight: "800", color: Colors.ink },
    caixaPerigo: { borderColor: Colors.red, backgroundColor: Colors.redD, marginTop: 10 },
    // tq-47: fila com aceite
    caixaAtencao: { borderColor: Colors.amber, backgroundColor: Colors.amberD, marginTop: 4, marginBottom: 4 },
    avisoFaixa: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.greenD, borderWidth: 1, borderColor: Colors.green, borderRadius: 12, padding: 12, marginBottom: 10 },
    avisoTitulo: { fontSize: 12.5, fontWeight: "800", color: Colors.ink },
    avisoTexto: { fontSize: 12, color: Colors.ink2, marginTop: 2, lineHeight: 17 },
    btnWhats: { backgroundColor: "#1f9d55", borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12 },
    btnWhatsLargo: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1f9d55", borderRadius: 10, paddingVertical: 11, marginBottom: 8 },
    btnWhatsTexto: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
    parado: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: Colors.redD, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    paradoTexto: { fontSize: 11, fontWeight: "700", color: Colors.red },
    pagamentoNaEntrega: { fontSize: 12.5, fontWeight: "700", color: Colors.ink, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    aceiteCaixa: { gap: 8 },
    aceitePergunta: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
    tempos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tempoChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: "transparent" },
    tempoTexto: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
    btnRecusar: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.red, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 14 },
    btnRecusarTexto: { color: Colors.red, fontSize: 12, fontWeight: "700" },
    linkExcluir: { alignSelf: "center", marginTop: 16, padding: 8 },
    linkExcluirTexto: { fontSize: 12, color: Colors.red, fontWeight: "600", textDecorationLine: "underline" },
    sheetFoot: { flexDirection: "row", gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: Colors.border },
    footSecundario: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
    footSecundarioTexto: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
    footPrimario: { flex: 2, backgroundColor: accent.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    footPrimarioTexto: { fontSize: 14, fontWeight: "700", color: "#fff" },

    lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center", padding: 20 },
    lightboxImg: { width: "100%" as any, height: "80%" as any },
    lightboxOpenBtn: { backgroundColor: accent.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
    lightboxOpenText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
}
