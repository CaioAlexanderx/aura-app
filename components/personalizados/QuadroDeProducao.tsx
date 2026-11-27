// ============================================================
// AURA. — Personalizados: Fila de produção no shell Negócio (p-129)
//
// Porte do quadro do Studio (app/studio/(estudio)/producao.tsx) para dentro
// do Negócio, no desenho do mockup p-131 (aprovado em 16/11/2026). Mesmos
// dados e mesmas rotas; o que muda é a casca:
//
//   - AÇÕES SEMPRE VISÍVEIS. Nada aparece só no hover (regra 7 do
//     CLAUDE.md): o botão da etapa seguinte fica no cartão o tempo todo, no
//     mouse e no toque.
//   - ARRASTAR SÓ NO WEB, POR CIMA DOS BOTÕES. O botão continua sendo o
//     caminho de todo mundo (toque, nativo, teclado). No web o cartão também
//     arrasta entre colunas (26/11/2026), por eventos HTML5 do DOM
//     (useStudioKanbanDnD) e não pelo responder system do react-native-web,
//     que ficou morto no arraste do Odonto. Soltar faz o que o botão faz,
//     com a mesma pergunta ao voltar; ver decidirSolta em regrasDaProducao.
//   - NO CELULAR, UMA ETAPA POR VEZ. Abaixo de 768 px o quadro vira uma
//     lista da etapa escolhida nos botões do alto.
//   - OVERLAY POR WebPortal. O pedido de aprovação da arte abre por
//     WebPortal: dentro do shell o z-index:0 do react-native-web prende
//     qualquer position:fixed.
//   - CORES DO NEGÓCIO. A tela lê useStudioTokens(), e quem monta a rota
//     envolve o quadro em <TemaDoNegocio>.
//
// 17/11/2026 (p-176):
//   - "Recolher a arte e o texto" no cartão de Aguardando personalização abre
//     a FolhaDeRecolher. "Enviar para a arte" fica ao lado, mais discreto,
//     como o "Marcar como aprovado" de Aguardando arte;
//   - o cartão mostra o item ("2 × Caneca com nome") e a origem
//     (origin_label: Orçamento, Caixa, Loja online);
//   - o número e o nome do cartão abrem o detalhe do pedido;
//   - "Entregues e cancelados": a segunda vista, com o que saiu da Fila.
//
// O que o mockup desenha e ainda NÃO está aqui (cards próprios): a loja de
// origem em cada cartão e o filtro de loja no cabeçalho. No consolidado eles
// vivem na lista de todas as lojas (p-187,
// components/personalizados/consolidado/ProducaoConsolidada.tsx). Daqui o
// quadro é sempre de uma loja só.
//
// 17/11/2026 (p-187): `destacarId` vem do "Abrir na loja" da lista de todas
// as lojas (?pedido=<id>). O cartão ganha borda de destaque e, no celular,
// a etapa dele abre primeiro. Pedido que já saiu da Fila (entregue,
// cancelado) avisa por toast.
//
// 25/11/2026: "Voltar para …" no cartão (BotaoVoltarEtapa). Na fusão o
// arrasto saiu e o cartão só andava para a frente. Volta uma etapa pela
// mesma rota e pelo mesmo `mover` do avançar; sair de "Em produção" ou de
// "Pronto" pede confirmação. Recusa do backend (marketplace com a arte já
// recolhida) aparece no toast com a mensagem dele.
//
// 25/11/2026 (p-185, D6 do Caio: "o saldo é baixado na Produção"): pedido de
// orçamento com dinheiro faltando mostra "Falta receber R$ X" e "Recebi" (a
// folha da baixa do saldo, com as formas do Caixa). "Marcar como entregue"
// com falta pergunta antes (AvisoFaltaReceber): "Receber agora" baixa e
// entrega; "Entregar mesmo assim" entrega. Só com os campos orcamento_* do
// backend (Aura-backend#1106, trava do financeiro): sem eles, o de antes.
//
// Regras sem tela: components/personalizados/regrasDaProducao.ts e
// regrasDoReceber.ts.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { toast } from "@/components/Toast";
import { WebPortal } from "@/components/WebPortal";
import { confirmAlert } from "@/utils/webAlert";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type StudioOrder, type StudioProductionStatus } from "@/services/studioApi";
import { ApprovalRequestModal } from "@/components/studio/ApprovalRequestModal";
import { useAprovacaoNova } from "@/components/studio/aprovacaoDaArte/trava";
import { RegistrarPagamentoSheet } from "@/components/studio/RegistrarPagamentoSheet";
import { useCobrarSaldo } from "@/components/studio/useCobrarSaldo";
import { useRegistrarPagamento } from "@/components/studio/useRegistrarPagamento";
import { comEtapaDoPedido } from "@/components/studio/etapaDoPedido";
import { numeroDoPedido, situacaoDoPixNoCartao, reais } from "@/components/studio/pagamentoDoPedido";
import { labelStudioStatus } from "@/constants/studio-status";
import {
  ETAPAS, PROXIMA_ETAPA, LARGURA_DO_CELULAR, agruparPorEtapa, ehAtivo, etapaDe, etapaInicialNoCelular, fraseDoResumo,
  decidirSolta, itemDoCartao, nomeDoCliente, origemDoPedido, prazoDoCartao, resumoDaFila, saidosDaFila, semAntigosDaAtivacao, type Etapa,
} from "@/components/personalizados/regrasDaProducao";
import { CapaMiniatura } from "@/components/personalizados/CapaMiniatura";
import { FolhaDeRecolher } from "@/components/personalizados/FolhaDeRecolher";
import { BotaoVoltarEtapa, ConfirmacaoDeVoltar } from "@/components/personalizados/BotaoVoltarEtapa";
import { useDraggableCardRef, useDropZoneRef, useStudioKanbanDnD } from "@/components/studio/kanban/useStudioKanbanDnD";
import { Icon } from "@/components/Icon";
import { ConfirmacaoDeTirarDaFila } from "@/components/personalizados/ConfirmacaoDeTirarDaFila";
import { TEXTO_DE_TIRAR_DA_FILA, ehPedidoNaoEncontrado, ehTemRecebimento, recebidoDaRecusa, tirarDaFila } from "@/components/personalizados/tirarDaFila";
import { AvisoFaltaReceber } from "@/components/personalizados/AvisoFaltaReceber";
import { useReceberDoOrcamento } from "@/components/personalizados/useReceberDoOrcamento";
import { FORMAS_DO_ORCAMENTO, faltaReceberDoOrcamento } from "@/components/personalizados/regrasDoReceber";

type Props = {
  companyId: string;
  /** pdv_settings.personalizados_ativado_em (ISO) ou null. Ver regrasDaProducao.ts. */
  ativadoEm: string | null;
  /** Pedido vindo do "Abrir na loja" do consolidado (p-187): fica em destaque. */
  destacarId?: string | null;
  /** Abre o detalhe do pedido. Sem ela, o cartão não abre nada (como no p-129). */
  onAbrirPedido?: (orderId: string) => void;
};

type Vista = "fila" | "saidos";
type Saida = "delivered" | "cancelled";

export function QuadroDeProducao({ companyId, ativadoEm, destacarId = null, onAbrirPedido }: Props) {
  const t = useStudioTokens();
  const aprovacaoNova = useAprovacaoNova();
  const s = useMemo(() => estilos(t, aprovacaoNova), [t, aprovacaoNova]);
  const { width } = useWindowDimensions();
  const celular = width < LARGURA_DO_CELULAR;

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<StudioOrder[]>([]);
  const [aprovacaoDe, setAprovacaoDe] = useState<StudioOrder | null>(null);
  const [etapaNoCelular, setEtapaNoCelular] = useState<StudioProductionStatus | null>(null);
  const [recolherDe, setRecolherDe] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("fila");
  const [saida, setSaida] = useState<Saida>("delivered");
  // p-185: o pedido de orçamento que ia ser entregue com dinheiro faltando.
  const [avisoDe, setAvisoDe] = useState<StudioOrder | null>(null);
  // C1: "Tirar da fila". `modo` é a caixa aberta; a de recebimento vem da recusa do backend.
  const [tirarDe, setTirarDe] = useState<{ pedido: StudioOrder; modo: "pergunta" | "recebimento"; tirando: boolean; recebido?: number | null } | null>(null);
  // Arraste para uma coluna de trás que pede confirmação (a mesma do botão).
  const [voltarDe, setVoltarDe] = useState<{ pedido: StudioOrder; destino: Etapa } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await studioApi.listOrders(companyId, { days: 60, limit: 300 });
      setPedidos((r.orders || []).map(comEtapaDoPedido));
      setErro(null);
    } catch (e: any) {
      setErro(e?.message || "Não deu para carregar os pedidos.");
    } finally {
      setCarregando(false);
    }
  }, [companyId]);

  useEffect(() => { carregar(); }, [carregar]);

  const naFila = useMemo(() => semAntigosDaAtivacao(pedidos, ativadoEm), [pedidos, ativadoEm]);
  const grupos = useMemo(() => agruparPorEtapa(naFila), [naFila]);
  const resumo = useMemo(() => resumoDaFila(naFila), [naFila]);
  const saidos = useMemo(() => saidosDaFila(pedidos), [pedidos]);
  const etapaAberta = etapaNoCelular || etapaInicialNoCelular(grupos);

  // "Abrir na loja" (p-187): uma vez, quando a lista chega.
  const destaqueVisto = useRef(false);
  useEffect(() => {
    if (!destacarId || destaqueVisto.current || carregando || erro) return;
    destaqueVisto.current = true;
    const alvo = naFila.find((o) => o.id === destacarId);
    if (alvo && ehAtivo(alvo)) setEtapaNoCelular(etapaDe(alvo));
    else toast.info("Esse pedido não está mais na Fila: já foi entregue ou cancelado.");
  }, [destacarId, carregando, erro, naFila]);

  const mover = useCallback(async (pedido: StudioOrder, destino: StudioProductionStatus, forcar?: boolean) => {
    const atual = etapaDe(pedido);
    setPedidos((antes) => antes.map((o) => (o.id === pedido.id ? { ...o, studio_production_status: destino } : o)));
    try {
      await studioApi.updateProductionStatus(companyId, pedido.id, destino, forcar);
      const etapa = ETAPAS.find((e) => e.key === destino);
      toast.success(etapa ? `Movido para ${etapa.label}` : "Pedido entregue");
    } catch (e: any) {
      setPedidos((antes) => antes.map((o) => (o.id === pedido.id ? { ...o, studio_production_status: atual } : o)));
      const semSinal = (e?.status === 409 || e?.code === 409)
        && (e?.data?.error === "deposit_required" || e?.error === "deposit_required");
      if (semSinal) {
        confirmAlert(
          "Sinal não recebido",
          e?.data?.message || "O sinal deste pedido ainda não foi confirmado. Quer iniciar a produção mesmo assim?",
          "Iniciar mesmo assim",
          () => mover(pedido, destino, true),
          { destructive: true },
        );
        return;
      }
      toast.error(e?.message || "Não deu para mover o pedido. Tente de novo.");
      carregar();
    }
  }, [companyId, carregar]);

  const avancar = useCallback((pedido: StudioOrder) => {
    const proxima = PROXIMA_ETAPA[etapaDe(pedido)];
    if (!proxima) return;
    if (proxima === "delivered" && faltaReceberDoOrcamento(pedido) !== null) {
      setAvisoDe(pedido);
      return;
    }
    mover(pedido, proxima);
  }, [mover]);

  // Soltar o cartão numa coluna: o mesmo que os botões (decidirSolta).
  const soltar = useCallback((pedidoId: string, destino: StudioProductionStatus) => {
    const pedido = naFila.find((o) => o.id === pedidoId);
    if (!pedido) return;
    const d = decidirSolta(etapaDe(pedido), destino);
    if (d.acao === "avancar") avancar(pedido);
    else if (d.acao === "mover") mover(pedido, d.destino);
    else if (d.acao === "pular") toast.info("Avance uma etapa de cada vez.");
    else if (d.acao === "confirmar-voltar") setVoltarDe({ pedido, destino: d.destino });
  }, [naFila, avancar, mover]);
  const dnd = useStudioKanbanDnD<StudioProductionStatus>(soltar);
  const arrasta = dnd.isWeb && !celular;

  const confirmarTirar = useCallback(async () => {
    const alvo = tirarDe;
    if (!alvo || alvo.tirando) return;
    setTirarDe({ ...alvo, tirando: true });
    try {
      await tirarDaFila(companyId, alvo.pedido.id);
      setPedidos((antes) => antes.filter((o) => o.id !== alvo.pedido.id));
      setTirarDe(null);
      toast.success(TEXTO_DE_TIRAR_DA_FILA.feito);
    } catch (e: any) {
      if (ehTemRecebimento(e)) {
        setTirarDe({ pedido: alvo.pedido, modo: "recebimento", tirando: false, recebido: recebidoDaRecusa(e) ?? alvo.pedido.fila_recebido });
        return;
      }
      setTirarDe(null);
      if (ehPedidoNaoEncontrado(e)) {
        // O pedido já não existe para esta loja: a lista estava velha.
        toast.error("Esse pedido não está mais na Fila. Atualizei a lista.");
        carregar();
        return;
      }
      toast.error(e?.message || "Não deu para tirar da fila. Tente de novo.");
    }
  }, [tirarDe, companyId, carregar]);

  const { cobrar, cobrandoId } = useCobrarSaldo(companyId);
  const baixa = useRegistrarPagamento(companyId, { onSucesso: carregar });
  const receber = useReceberDoOrcamento(companyId, { onSucesso: carregar });

  const cartao = (o: StudioOrder, etapa: Etapa) => (
    <Cartao
      key={o.id}
      o={o}
      etapa={etapa}
      t={t}
      s={s}
      destacado={!!destacarId && o.id === destacarId}
      dnd={dnd}
      arrasta={arrasta}
      onAvancar={avancar}
      onVoltar={mover}
      onTirar={(p) => setTirarDe(p.fila_tem_recebimento
        // Já se sabe que há dinheiro recebido: avisa e leva ao cancelamento, sem perguntar antes.
        ? { pedido: p, modo: "recebimento", tirando: false, recebido: p.fila_recebido }
        : { pedido: p, modo: "pergunta", tirando: false })}
      onAprovacao={setAprovacaoDe}
      onRecolher={(p) => setRecolherDe(p.id)}
      onAbrir={onAbrirPedido}
      cobrando={cobrandoId === o.balance_installment_id}
      onCobrar={() => o.balance_installment_id && cobrar({
        orderId: o.id, installmentId: o.balance_installment_id, phone: o.customer_phone,
        customerName: o.customer_name, dueDate: o.balance_due_date, status: o.balance_status,
      })}
      onRecebi={() => o.balance_installment_id && o.balance_amount != null && baixa.abrir({
        orderId: o.id, installmentId: o.balance_installment_id, customerName: o.customer_name,
        amount: Number(o.balance_amount) || 0, dueDate: o.balance_due_date, status: o.balance_status,
      })}
      onReceberOrcamento={() => receber.abrir(o)}
    />
  );

  let corpo: React.ReactNode;
  const semDados = (carregando || !!erro) && pedidos.length === 0;
  if (vista === "saidos" && !semDados) {
    const lista = saidos[saida];
    corpo = (
      <View style={{ flex: 1 }} testID="producao-saidos">
        <View style={s.chipsDosSaidos}>
          {(["delivered", "cancelled"] as Saida[]).map((k) => {
            const ativa = k === saida;
            const n = saidos[k].length;
            const rotulo = k === "delivered" ? "Entregues" : "Cancelados";
            return (
              <Pressable
                key={k}
                testID={`producao-saida-${k}`}
                onPress={() => setSaida(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                accessibilityLabel={`${rotulo}, ${n} ${n === 1 ? "pedido" : "pedidos"}`}
                style={[s.chip, ativa && s.chipAtivo]}
              >
                <Text style={[s.chipTxt, ativa && s.chipTxtAtivo]}>{rotulo} {n}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.notaDosSaidos}>Pedidos dos últimos 60 dias.</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listaDoCelular}>
          {lista.length === 0 ? (
            <Text style={s.etapaVazia} testID="producao-saidos-vazio">
              {saida === "delivered" ? "Nenhum pedido entregue nos últimos 60 dias." : "Nenhum pedido cancelado nos últimos 60 dias."}
            </Text>
          ) : lista.map((o) => <LinhaSaida key={o.id} o={o} t={t} s={s} onAbrir={onAbrirPedido} />)}
        </ScrollView>
      </View>
    );
  } else if (carregando && pedidos.length === 0) {
    corpo = <View style={s.aviso} testID="producao-carregando"><Text style={s.avisoTxt}>Carregando os pedidos…</Text></View>;
  } else if (erro && pedidos.length === 0) {
    corpo = (
      <View style={s.aviso} testID="producao-erro">
        <Text style={s.avisoTitulo}>Não deu para carregar a Fila</Text>
        <Text style={s.avisoTxt}>{erro}</Text>
        <Pressable style={s.botaoNeutro} onPress={carregar} accessibilityRole="button" testID="producao-tentar-de-novo">
          <Text style={s.botaoNeutroTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (resumo.ativos === 0) {
    corpo = (
      <View style={s.aviso} testID="producao-vazia">
        <Text style={s.avisoTitulo}>Nenhum pedido na Fila</Text>
        <Text style={s.avisoTxt}>Quando entrar um pedido de peça personalizada, ele aparece aqui.</Text>
      </View>
    );
  } else if (celular) {
    const etapa = ETAPAS.find((e) => e.key === etapaAberta) || ETAPAS[0];
    const lista = grupos[etapa.key];
    corpo = (
      <View style={{ flex: 1 }} testID="producao-uma-etapa">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.seletor} contentContainerStyle={s.seletorDentro}>
          {ETAPAS.map((e) => {
            const ativa = e.key === etapa.key;
            const n = grupos[e.key].length;
            return (
              <Pressable
                key={e.key}
                testID={`producao-etapa-${e.key}`}
                onPress={() => setEtapaNoCelular(e.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                accessibilityLabel={`${e.label}, ${n} ${n === 1 ? "pedido" : "pedidos"}`}
                style={[s.chip, ativa && s.chipAtivo]}
              >
                <Text style={[s.chipTxt, ativa && s.chipTxtAtivo]}>{e.curto} {n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listaDoCelular}>
          {lista.length === 0
            ? <Text style={s.etapaVazia} testID="producao-etapa-sem-pedido">Nenhum pedido em {etapa.label}.</Text>
            : lista.map((o) => cartao(o, etapa))}
        </ScrollView>
      </View>
    );
  } else {
    corpo = (
      <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={s.quadro} testID="producao-colunas">
        {ETAPAS.map((e) => (
          <Coluna key={e.key} e={e} s={s} dnd={dnd} arrasta={arrasta} total={grupos[e.key].length}>
            {grupos[e.key].map((o) => cartao(o, e))}
          </Coluna>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={s.tela} testID="producao-quadro">
      <View style={s.barra}>
        <Text style={s.resumo} testID="producao-resumo">
          {carregando && pedidos.length === 0 ? " " : fraseDoResumo(resumo, (v) => reais(v))}
        </Text>
        <View style={s.barraLado}>
          <View style={s.vistas} accessibilityRole="tablist">
            {([["fila", "Na Fila"], ["saidos", "Entregues e cancelados"]] as Array<[Vista, string]>).map(([k, rotulo]) => {
              const ativa = vista === k;
              return (
                <Pressable
                  key={k}
                  testID={`producao-vista-${k}`}
                  onPress={() => setVista(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativa }}
                  style={[s.vista, ativa && s.vistaAtiva]}
                >
                  <Text style={[s.vistaTxt, ativa && s.vistaTxtAtiva]}>{rotulo}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={s.botaoNeutro} onPress={carregar} disabled={carregando} accessibilityRole="button" testID="producao-atualizar">
            <Text style={s.botaoNeutroTxt}>{carregando ? "Atualizando…" : "Atualizar"}</Text>
          </Pressable>
        </View>
      </View>

      {corpo}

      {/* Pedido de aprovação da arte: por WebPortal, fora da árvore do shell. */}
      <WebPortal active={!!aprovacaoDe}>
        <View style={s.overlay} testID="producao-overlay-aprovacao">
          {aprovacaoDe ? (
            <ApprovalRequestModal
              order={aprovacaoDe}
              onClose={() => setAprovacaoDe(null)}
              onSent={() => { setAprovacaoDe(null); carregar(); }}
            />
          ) : null}
        </View>
      </WebPortal>

      {/* Baixa do saldo: o sheet abre pelo Modal do react-native-web, que já
          monta em document.body. */}
      <RegistrarPagamentoSheet controller={baixa} />

      {/* p-185: o que falta do pedido de orçamento (mesma folha, valor fixo). */}
      <RegistrarPagamentoSheet controller={receber} formas={FORMAS_DO_ORCAMENTO} valorFixo rotuloDoValor="Falta receber" />
      <AvisoFaltaReceber
        falta={avisoDe ? faltaReceberDoOrcamento(avisoDe) : null}
        idDeTeste="producao-aviso-falta"
        onFechar={() => setAvisoDe(null)}
        onEntregar={() => {
          const p = avisoDe;
          setAvisoDe(null);
          if (p) mover(p, "delivered");
        }}
        onReceber={() => {
          const p = avisoDe;
          setAvisoDe(null);
          if (p) receber.abrir(p, () => mover(p, "delivered"));
        }}
      />

      {/* Arraste para trás de "Em produção" ou "Pronto": a mesma pergunta do botão. */}
      <ConfirmacaoDeVoltar
        ativa={!!voltarDe}
        destino={voltarDe?.destino || ETAPAS[0]}
        idDeTeste="producao-arraste-voltar"
        onCancelar={() => setVoltarDe(null)}
        onConfirmar={() => {
          const v = voltarDe;
          setVoltarDe(null);
          if (v) mover(v.pedido, v.destino.key);
        }}
      />

      {/* C1: tirar da fila (a venda e o dinheiro não mudam). */}
      <ConfirmacaoDeTirarDaFila
        modo={tirarDe?.modo || null}
        trabalhando={!!tirarDe?.tirando}
        recebido={tirarDe?.recebido}
        idDeTeste="producao-tirar"
        onFechar={() => setTirarDe(null)}
        onConfirmar={confirmarTirar}
        onIrParaCancelamento={() => {
          const p = tirarDe?.pedido;
          setTirarDe(null);
          if (p && onAbrirPedido) onAbrirPedido(p.id);
        }}
      />

      {/* Arte e texto das peças: ResponsiveSheet (Modal, em document.body). */}
      <FolhaDeRecolher
        companyId={companyId}
        pedidoId={recolherDe}
        onFechar={() => setRecolherDe(null)}
        onSalvo={() => carregar()}
      />
    </View>
  );
}

type Dnd = ReturnType<typeof useStudioKanbanDnD<StudioProductionStatus>>;

/** Uma coluna do quadro; no web, também é onde o cartão arrastado cai. */
function Coluna({
  e, s, dnd, arrasta, total, children,
}: { e: Etapa; s: ReturnType<typeof estilos>; dnd: Dnd; arrasta: boolean; total: number; children: React.ReactNode }) {
  const ref = useDropZoneRef<StudioProductionStatus>(e.key, dnd.onDrop, dnd.onHoverChange);
  // Coluna-alvo realçada enquanto um cartão passa por cima.
  const alvo = arrasta && !!dnd.draggingId && dnd.hoverStatus === e.key;
  return (
    <View ref={ref} style={[s.coluna, alvo && s.colunaAlvo]} testID={`producao-coluna-${e.key}`}>
      <View style={s.colunaTopo}>
        <Text style={s.colunaTitulo} numberOfLines={2}>{e.label}</Text>
        <Text style={s.colunaConta}>{total}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.colunaDentro}>
        {children}
      </ScrollView>
    </View>
  );
}

/** O número e o nome do cartão: abrem o detalhe quando há para onde ir. */
function Cabeca({
  o, nome, origem, s, onAbrir,
}: { o: StudioOrder; nome: string; origem: string | null; s: ReturnType<typeof estilos>; onAbrir?: (id: string) => void }) {
  const dentro = (
    <>
      <View style={s.linha}>
        <Text style={s.numero}>{numeroDoPedido(o as any)}</Text>
        {origem ? <View style={[s.selo, s.seloMarca]}><Text style={[s.seloTxt, s.seloMarcaTxt]}>{origem}</Text></View> : null}
      </View>
      {/* Duas linhas com reticências; o nome inteiro fica no title e no aria. */}
      <Text style={s.nome} numberOfLines={2} accessibilityLabel={nome} {...({ title: nome } as any)}>{nome}</Text>
    </>
  );
  if (!onAbrir) return dentro;
  return (
    <Pressable
      onPress={() => onAbrir(o.id)}
      accessibilityRole="link"
      accessibilityLabel={`Abrir o pedido de ${nome}`}
      style={s.cabecaQueAbre}
      testID={`producao-abrir-${o.id}`}
    >
      {dentro}
    </Pressable>
  );
}

/** Um pedido entregue ou cancelado, na vista "Entregues e cancelados". */
function LinhaSaida({
  o, t, s, onAbrir,
}: { o: StudioOrder; t: StudioPalette; s: ReturnType<typeof estilos>; onAbrir?: (id: string) => void }) {
  const nome = nomeDoCliente(o);
  const etapa = etapaDe(o);
  const cancelado = etapa === "cancelled";
  const quando = Number.isNaN(Date.parse(o.created_at)) ? "" : new Date(o.created_at).toLocaleDateString("pt-BR");
  return (
    <View style={s.cartao} testID={`producao-saido-${o.id}`}>
      <Cabeca o={o} nome={nome} origem={origemDoPedido(o)} s={s} onAbrir={onAbrir} />
      <Text style={s.meta}>{itemDoCartao(o)} · {reais(o.total_amount)}</Text>
      <View style={s.selos}>
        <View style={[s.selo, { backgroundColor: cancelado ? t.dangerSoft : t.successSoft }]}>
          <Text style={[s.seloTxt, { color: cancelado ? t.dangerInk : t.successInk }]}>{labelStudioStatus(etapa)}</Text>
        </View>
        {quando ? <View style={s.selo}><Text style={s.seloTxt}>Pedido de {quando}</Text></View> : null}
      </View>
    </View>
  );
}

function Cartao({
  o, etapa, t, s, destacado, dnd, arrasta, onAvancar, onVoltar, onTirar, onAprovacao, onRecolher, onAbrir, onCobrar, onRecebi, onReceberOrcamento, cobrando,
}: {
  o: StudioOrder;
  etapa: Etapa;
  t: StudioPalette;
  s: ReturnType<typeof estilos>;
  destacado?: boolean;
  dnd: Dnd;
  /** Web com o quadro em colunas: o cartão arrasta. */
  arrasta: boolean;
  onAvancar: (o: StudioOrder) => void;
  /** Mesmo `mover` do avançar: mesma rota, mesmo desfazer no erro. */
  onVoltar: (o: StudioOrder, destino: StudioProductionStatus) => void;
  /** C1: abre a pergunta de tirar o pedido da Fila. */
  onTirar: (o: StudioOrder) => void;
  onAprovacao: (o: StudioOrder) => void;
  onRecolher: (o: StudioOrder) => void;
  onAbrir?: (id: string) => void;
  onCobrar: () => void;
  onRecebi: () => void;
  /** p-185: abre a baixa do que falta do pedido de orçamento. */
  onReceberOrcamento: () => void;
  cobrando: boolean;
}) {
  const nome = nomeDoCliente(o);
  const prazo = prazoDoCartao(o);
  const pix = situacaoDoPixNoCartao(o as any);
  const origem = origemDoPedido(o);
  const temSaldo = !!o.balance_installment_id && o.balance_amount != null;
  // p-185: só com os campos do backend; sem eles, o cartão de antes.
  const faltaReceber = faltaReceberDoOrcamento(o);
  const naArte = etapa.key === "pending_art";
  const naPersonalizacao = etapa.key === "awaiting_customization";
  // Duas ações na etapa: a principal é a da etapa, e o avançar fica discreto.
  const duasAcoes = naArte || naPersonalizacao;

  const cartaoRef = useDraggableCardRef(arrasta, o.id, dnd.onCardDragStart, dnd.onCardDragEnd);
  const arrastando = arrasta && dnd.draggingId === o.id;

  return (
    <View ref={cartaoRef} style={[s.cartao, destacado && s.cartaoDestacado, arrastando && s.cartaoArrastando]} testID={`producao-cartao-${o.id}`}>
      <View style={s.topoDoCartao}>
        <CapaMiniatura o={o} nome={nome} t={t} />
        <View style={s.cresce}>
          <Cabeca o={o} nome={nome} origem={origem} s={s} onAbrir={onAbrir} />
        </View>
        {/* Sempre visível: no toque não há hover para revelar. */}
        <Pressable
          style={s.lixeira}
          onPress={() => onTirar(o)}
          accessibilityRole="button"
          accessibilityLabel={`Tirar da fila: pedido de ${nome}`}
          testID={`producao-tirar-${o.id}`}
        >
          <Icon name="trash" size={16} color={t.ink3} />
        </Pressable>
      </View>
      <Text style={s.meta} testID={`producao-item-${o.id}`}>{itemDoCartao(o)} · {reais(o.total_amount)}</Text>

      <View style={s.selos}>
        <View style={[s.selo, prazo.tom === "atencao" && { backgroundColor: t.warningSoft }, prazo.tom === "atrasado" && { backgroundColor: t.dangerSoft }]}>
          <Text style={[s.seloTxt, prazo.tom === "atencao" && { color: t.warningInk }, prazo.tom === "atrasado" && { color: t.dangerInk }]}>{prazo.texto}</Text>
        </View>
        {pix ? (
          <View style={[s.selo, { backgroundColor: pix.tom === "sucesso" ? t.successSoft : t.warningSoft }]}>
            <Text style={[s.seloTxt, { color: pix.tom === "sucesso" ? t.successInk : t.warningInk }]}>
              {pix.tom === "sucesso" ? "Pago" : pix.rotulo}
            </Text>
          </View>
        ) : null}
        {o.pending_approval_url ? (
          <View style={[s.selo, { backgroundColor: t.infoSoft }]}>
            <Text style={[s.seloTxt, { color: t.infoInk }]}>Aprovação enviada</Text>
          </View>
        ) : null}
      </View>

      {temSaldo ? (
        <Text style={s.meta} testID={`producao-saldo-${o.id}`}>
          Saldo <Text style={s.saldoValor}>{reais(o.balance_amount)}</Text>
          {o.balance_status === "overdue" ? " · vencido" : ""}
        </Text>
      ) : null}
      {faltaReceber !== null ? (
        <Text style={s.meta} testID={`producao-falta-receber-${o.id}`}>
          Falta receber <Text style={s.saldoValor}>{reais(faltaReceber)}</Text>
        </Text>
      ) : null}

      {/* Ações: sempre na tela, sem hover. */}
      <View style={s.acoes} testID={`producao-acoes-${o.id}`}>
        {naPersonalizacao ? (
          <Pressable
            style={s.botaoDaEtapa}
            onPress={() => onRecolher(o)}
            accessibilityRole="button"
            accessibilityLabel={`Recolher a arte e o texto do pedido de ${nome}`}
            testID={`producao-recolher-${o.id}`}
          >
            <Text style={s.botaoDaEtapaTxt}>Recolher a arte e o texto</Text>
          </Pressable>
        ) : null}
        {naArte ? (
          <Pressable
            style={s.botaoDaEtapa}
            onPress={() => onAprovacao(o)}
            accessibilityRole="button"
            accessibilityLabel={`Pedir aprovação da arte de ${nome} pelo WhatsApp`}
            testID={`producao-aprovacao-${o.id}`}
          >
            <Text style={s.botaoDaEtapaTxt}>Pedir aprovação da arte</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={duasAcoes ? s.botaoNeutro : s.botaoDaEtapa}
          onPress={() => onAvancar(o)}
          accessibilityRole="button"
          accessibilityLabel={`${etapa.avancar}: pedido de ${nome}`}
          testID={`producao-avancar-${o.id}`}
        >
          <Text style={duasAcoes ? s.botaoNeutroTxt : s.botaoDaEtapaTxt}>{etapa.avancar}</Text>
        </Pressable>
        {temSaldo ? (
          <View style={s.acoesLado}>
            <Pressable
              style={[s.botaoNeutro, s.cresce]}
              onPress={onCobrar}
              disabled={cobrando}
              accessibilityRole="button"
              accessibilityLabel={`Cobrar o saldo de ${nome} pelo WhatsApp`}
              testID={`producao-cobrar-${o.id}`}
            >
              <Text style={s.botaoNeutroTxt}>{cobrando ? "Abrindo…" : "Cobrar saldo"}</Text>
            </Pressable>
            <Pressable
              style={[s.botaoNeutro, s.cresce]}
              onPress={onRecebi}
              accessibilityRole="button"
              accessibilityLabel={`Registrar o recebimento de ${nome}`}
              testID={`producao-recebi-${o.id}`}
            >
              <Text style={[s.botaoNeutroTxt, { color: t.successInk }]}>Recebi</Text>
            </Pressable>
          </View>
        ) : null}
        {faltaReceber !== null ? (
          <Pressable
            style={s.botaoNeutro}
            onPress={onReceberOrcamento}
            accessibilityRole="button"
            accessibilityLabel={`Registrar o recebimento de ${nome}`}
            testID={`producao-receber-orcamento-${o.id}`}
          >
            <Text style={[s.botaoNeutroTxt, { color: t.successInk }]}>Recebi</Text>
          </Pressable>
        ) : null}
        {/* Voltar uma etapa: discreto, por último. Some na primeira etapa. */}
        <BotaoVoltarEtapa
          etapaAtual={etapa.key}
          onVoltar={(destino) => onVoltar(o, destino)}
          nome={nome}
          idDeTeste={`producao-voltar-${o.id}`}
        />
      </View>
    </View>
  );
}

function estilos(t: StudioPalette, aprovacaoNova: boolean = false) {
  return StyleSheet.create({
    tela: { flex: 1, minHeight: 420 },
    barra: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14, flexWrap: "wrap" },
    resumo: { fontSize: 12.5, color: t.ink3, flexShrink: 1 },
    barraLado: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    vistas: { flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: t.primaryBorder, overflow: "hidden" },
    // 40 px de altura, como os outros botões da barra.
    vista: { minHeight: 40, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.paperCard },
    vistaAtiva: { backgroundColor: t.primaryGhost },
    vistaTxt: { fontSize: 12, fontWeight: "600", color: t.ink2 },
    vistaTxtAtiva: { color: t.ink, fontWeight: "700" },
    chipsDosSaidos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    notaDosSaidos: { fontSize: 12, color: t.ink3, marginTop: 8, marginBottom: 8 },
    cabecaQueAbre: { gap: 6 },
    topoDoCartao: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    // 44 px de alvo de toque, com o desenho pequeno e discreto no canto.
    lixeira: { width: 44, height: 44, marginTop: -8, marginRight: -10, alignItems: "center", justifyContent: "center" },

    aviso: { alignItems: "center", justifyContent: "center", paddingVertical: 56, paddingHorizontal: 24, gap: 10, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: t.primaryBorder, backgroundColor: t.bgSoft },
    avisoTitulo: { fontSize: 18, fontWeight: "700", color: t.ink, textAlign: "center" },
    avisoTxt: { fontSize: 13, color: t.ink3, textAlign: "center", maxWidth: 420, lineHeight: 20 },

    // flexGrow: as cinco colunas dividem a largura (cabem em 1440 px); abaixo do mínimo o quadro rola na horizontal, sem cortar.
    quadro: { gap: 10, paddingBottom: 16, flexGrow: 1 },
    coluna: { flex: 1, minWidth: 196, maxWidth: 300, backgroundColor: t.bgSoft, borderRadius: 12, borderWidth: 1, borderColor: t.ink5, overflow: "hidden", maxHeight: 760 },
    colunaAlvo: { borderColor: t.primary, borderWidth: 2, backgroundColor: t.primaryGhost },
    colunaTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingHorizontal: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.ink5 },
    colunaTitulo: { flex: 1, fontSize: 12, fontWeight: "700", color: t.ink },
    colunaConta: { fontSize: 11.5, color: t.ink3, fontVariant: ["tabular-nums"] },
    colunaDentro: { padding: 8, gap: 8 },
    etapaVazia: { fontSize: 13, color: t.ink3, paddingVertical: 24, textAlign: "center" },

    seletor: { flexGrow: 0, marginBottom: 10 },
    seletorDentro: { gap: 6, paddingRight: 8 },
    // 44 px de altura: alvo de toque confortável no celular.
    chip: { justifyContent: "center", minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: "transparent" },
    chipAtivo: { backgroundColor: t.primary, borderColor: t.primary },
    chipTxt: { fontSize: 12.5, fontWeight: "600", color: t.ink2 },
    chipTxtAtivo: { color: "#fff" },
    listaDoCelular: { gap: 10, paddingBottom: 24 },

    cartao: { backgroundColor: t.paperCard, borderRadius: 11, borderWidth: 1, borderColor: t.ink5, padding: 10, gap: 6 },
    cartaoArrastando: { opacity: 0.45 },
    cartaoDestacado: { borderWidth: 2, borderColor: t.primary },
    linha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    numero: { fontSize: 11.5, fontWeight: "700", color: t.accentInk, fontVariant: ["tabular-nums"] },
    nome: { fontSize: 13, fontWeight: "700", color: t.ink },
    meta: { fontSize: 12, color: t.ink3 },
    saldoValor: { fontWeight: "700", color: t.ink, fontVariant: ["tabular-nums"] },
    selos: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.bgSoft },
    seloTxt: { fontSize: 10.5, fontWeight: "700", color: t.ink3 },
    seloMarca: { backgroundColor: t.primaryGhost },
    seloMarcaTxt: { color: t.accentInk },

    acoes: { gap: 6, marginTop: 2 },
    acoesLado: { flexDirection: "row", gap: 6 },
    cresce: { flex: 1 },
    // O botão da etapa seguinte, como no mockup: fundo violeta suave e borda.
    botaoDaEtapa: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.primaryGhost },
    botaoDaEtapaTxt: { fontSize: 12, fontWeight: "700", color: t.ink, textAlign: "center" },
    botaoNeutro: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.paperCard },
    botaoNeutroTxt: { fontSize: 12, fontWeight: "600", color: t.ink2 },

    // O contêiner do WebPortal é um <div> fixo, sem flex: o overlay se
    // estica por conta própria.
    // Com o modal novo da aprovação, transparente: a folha traz o próprio pano
    // escuro e a Produção aparece atrás (mockup, 27/11/2026). Com o modal
    // atual, o fundo de sempre (ele não tem pano próprio).
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: aprovacaoNova ? "transparent" : t.bg },
  });
}

export default QuadroDeProducao;
