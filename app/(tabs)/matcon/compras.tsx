// ============================================================
// AURA. — Matcon: esteira de Compras (M4)
//
// 22/09/2026. Terceira esteira do Matcon — a única de M4 com rota nova
// (regra 3 do CLAUDE.md): lote e devolução de sobra entram em telas que já
// existem (entrada do XML, carrinho, wizard de troca); compras é o único
// fluxo sem lar. Mesmo molde de código de /matcon/orcamentos e
// /matcon/entregas, mas a esteira aqui não é "abertos → aprovados": é
// "dinheiro que falta → dinheiro a caminho → dinheiro que chegou"
// (docs/mockups/matcon-m4-profundidade.html #compras/#pedido,
// docs/CONTRACT_MATCON.md §M4 Compras).
//
// "Esteira" e "XML" são nomes NOSSOS; na tela o lojista lê "falta
// comprar", "pedido enviado", "nota do fornecedor entrou" (revisão de
// texto de 22/09/2026 — §4b regra 4, zero jargão).
//
// Mockup aprovado: docs/mockups/matcon-m4-profundidade.html #compras e
// #pedido. Esteira, card e estado vazio vêm de
// components/matcon/EsteiraMatcon.tsx (mesma peça das outras duas); as
// contas de agrupamento por fornecedor, frase da sugestão, texto do
// WhatsApp e progresso do pedido, de components/matcon/comprasUtil.ts.
//
// Decisões desta tela:
//   · Chave de módulo PRÓPRIA `matcon.compras` (regra 3), já cadastrada
//     em hooks/useVisibleModules.ts.
//   · Gate do toggle: igual às outras duas esteiras — sem
//     pdv_settings.matcon_enabled a tela é só o mesmo recado curto.
//   · Multi-CNPJ (armadilha 2): compra é de UMA loja (estoque, pedido),
//     então <RequireCompanyScope> força escolher a empresa antes de
//     renderizar.
//   · A estação "Falta comprar" é a lista de purchaseSuggestions AGRUPADA
//     por fornecedor (comprasUtil.agruparPorFornecedor); "Pedido enviado" e
//     "Recebido" vêm de listPurchaseOrders. Nada é comprado sozinho: a
//     lista sugere, "Montar pedido" cria o rascunho, o dono aprova as
//     quantidades no pedido antes de enviar.
//   · "Enviar no WhatsApp" abre o wa.me SÍNCRONO no toque (regra de ouro
//     de utils/whatsapp.ts) com o texto de comprasUtil.textoPedidoWhatsApp
//     e só DEPOIS marca o pedido como enviado.
//   · "Marcar como enviado" é para quem prefere ligar — mesmo destino
//     (status "sent"), sem abrir o WhatsApp.
//   · O pedido fecha sozinho quando o XML do fornecedor entra no estoque
//     (backend casa por product_id); recebimento parcial fica em "Pedido
//     enviado" com "N de M un" por item — por isso não existe um botão
//     "marcar como recebido" aqui: a tela só lê o que o backend já casou.
//   · Regra 7: ações sempre visíveis no card, sem hover.
//
// QA 23/09/2026 (a rota ainda respondia 404 em produção e a tela dizia
// "Nada faltando hoje" com 23 alertas de estoque baixo):
//   · Sem tentativas por cima do client (RETRY_DA_TELA). Cada query tem o
//     seu estado: sugestões que falharam → <EsteiraErro> em "Falta
//     comprar"; pedidos que falharam → <EsteiraErro> em "Pedido enviado" e
//     "Recebido". "Nada faltando hoje" SÓ quando a API devolveu a lista
//     vazia, e a frase explica de onde vem a sugestão.
//   · Pedido montado e não enviado (`draft`, que o contrato já devolve)
//     aparece no topo de "Falta comprar" com "Continuar pedido" — antes ele
//     sumia ao fechar a folha e o dono montava outro por cima.
//
// QA 23/09/2026, com o backend no ar:
//   · Produto que já está num pedido ENVIADO (e ainda não chegou inteiro)
//     continuava em "Falta comprar" como se ninguém tivesse pedido. A linha
//     agora diz "já pedido no C-0001, chega em breve" e fica FORA do
//     "Montar pedido" — se todos os itens do fornecedor já foram pedidos, o
//     botão vira "Pedir de novo mesmo assim" (aí vai tudo, de propósito).
//   · Compras segue a regra do Estoque (decisão do Caio): a frase do item
//     segue o `reason` do backend (comprasUtil.fraseDaSugestao).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ScreenHero } from "@/components/ScreenHero";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import {
  matconApi, type PurchaseOrder, type PurchaseOrderItem, type PurchaseSuggestion,
} from "@/services/matconApi";
import { readMatconSettings, type MatconSettings } from "@/constants/matcon";
import { parseQtyInput, fmtQty } from "@/utils/matconUnits";
import { openWhatsApp } from "@/utils/whatsapp";
import { fmtDiaMesDeTimestamp } from "@/components/matcon/quotesUtil";
import {
  EsteiraMatcon, EsteiraCard, EsteiraVazia, EsteiraVaziaDestaque, EsteiraErro, type EsteiraEstacao,
} from "@/components/matcon/EsteiraMatcon";
import { RETRY_DA_TELA, fraseDoErroDeCarga, textoDoErro } from "@/components/matcon/erroMatcon";
import {
  agruparPorFornecedor, fraseDaSugestao, textoPedidoWhatsApp, progressoDoPedido,
  fmtMoneyApprox, produtosJaPedidos, fraseJaPedido, type FornecedorSugestoes,
} from "@/components/matcon/comprasUtil";

const fmtMoneyCurto = (n: number | string | null | undefined) =>
  `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;

// Quantos itens aparecem soltos no card antes do "mais N itens deste
// fornecedor" (mockup: 2 linhas visíveis, o resto some atrás de "Ver itens").
const ITENS_VISIVEIS = 2;

// Quantos dias um pedido recebido continua na estação (mockup: "Recebido ·
// 7 dias").
const DIAS_RECEBIDO = 7;

type Estacao = "sugestao" | "enviado" | "recebido";

export default function MatconComprasRoute() {
  // Multi-CNPJ: no modo consolidado o picker aparece antes da esteira.
  return (
    <RequireCompanyScope context="matcon" actionLabel="ver as compras">
      <MatconComprasScreen />
    </RequireCompanyScope>
  );
}

function MatconComprasScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { settings } = usePdvSettings();
  const matcon = useMemo(() => readMatconSettings(settings as Partial<MatconSettings>), [settings]);
  const enabled = matcon.matcon_enabled;

  const [estacao, setEstacao] = useState<Estacao>("sugestao");
  const [fornecedor, setFornecedor] = useState<string | null>(null); // key de FornecedorSugestoes; null = todos
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pedidoAberto, setPedidoAberto] = useState<PurchaseOrder | null>(null);

  const suggestionsQuery = useQuery({
    queryKey: ["matcon-purchase-suggestions", company?.id],
    queryFn: () => matconApi.purchaseSuggestions(company!.id),
    enabled: !!company?.id && enabled,
    staleTime: 30_000,
    retry: RETRY_DA_TELA,
  });

  const ordersQuery = useQuery({
    queryKey: ["matcon-purchase-orders", company?.id],
    queryFn: () => matconApi.listPurchaseOrders(company!.id, {}),
    enabled: !!company?.id && enabled,
    staleTime: 15_000,
    retry: RETRY_DA_TELA,
  });

  // Falhou e não há nada guardado para mostrar: bloco de erro, nunca a
  // lista vazia (o "Nada faltando hoje" do QA de 23/09 era um 404).
  const sugestoesFalharam = suggestionsQuery.isError && !suggestionsQuery.data;
  const pedidosFalharam = ordersQuery.isError && !ordersQuery.data;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["matcon-purchase-suggestions"] });
    qc.invalidateQueries({ queryKey: ["matcon-purchase-orders"] });
  }

  const resumoSugestao = suggestionsQuery.data?.summary;
  const resumoPedidos = ordersQuery.data?.summary;

  const fornecedores = useMemo(
    () => agruparPorFornecedor(suggestionsQuery.data?.suggestions || []),
    [suggestionsQuery.data],
  );

  const fornecedoresFiltrados = useMemo(
    () => (fornecedor ? fornecedores.filter((f) => f.key === fornecedor) : fornecedores),
    [fornecedores, fornecedor],
  );

  // Montado e ainda não enviado: volta a aparecer em "Falta comprar".
  const pedidosRascunho = useMemo(
    () => ((ordersQuery.data?.orders || []) as PurchaseOrder[]).filter((o) => o.status === "draft"),
    [ordersQuery.data],
  );

  const pedidosEnviados = useMemo(
    () => ((ordersQuery.data?.orders || []) as PurchaseOrder[]).filter((o) => o.status === "sent"),
    [ordersQuery.data],
  );

  // product_id → "C-0001": o que já foi pedido e ainda não chegou.
  const jaPedidos = useMemo(
    () => produtosJaPedidos((ordersQuery.data?.orders || []) as PurchaseOrder[]),
    [ordersQuery.data],
  );

  const pedidosRecebidos = useMemo(() => {
    const agora = Date.now();
    return ((ordersQuery.data?.orders || []) as PurchaseOrder[]).filter((o) => {
      if (o.status !== "received" || !o.received_at) return false;
      const dias = (agora - new Date(o.received_at).getTime()) / 86400000;
      return dias >= 0 && dias <= DIAS_RECEBIDO;
    });
  }, [ordersQuery.data]);

  const estacoes: EsteiraEstacao[] = [
    {
      key: "sugestao", label: "Falta comprar",
      count: resumoSugestao ? resumoSugestao.items_below_min : null,
      money: resumoSugestao ? fmtMoneyCurto(resumoSugestao.total_est_cost) : null,
      tone: "violet", active: estacao === "sugestao", onPress: () => setEstacao("sugestao"),
    },
    {
      key: "enviado", label: "Pedido enviado",
      count: resumoPedidos ? resumoPedidos.sent.count : null,
      money: resumoPedidos ? fmtMoneyCurto(resumoPedidos.sent.total) : null,
      tone: "amber", active: estacao === "enviado", onPress: () => setEstacao("enviado"),
    },
    {
      key: "recebido", label: `Recebido · ${DIAS_RECEBIDO} dias`,
      count: resumoPedidos ? resumoPedidos.received_7d.count : null,
      money: resumoPedidos ? fmtMoneyCurto(resumoPedidos.received_7d.total) : null,
      tone: "green", active: estacao === "recebido", onPress: () => setEstacao("recebido"),
    },
  ];

  // ── Ações ────────────────────────────────────────────────
  async function montarPedido(grupo: FornecedorSugestoes) {
    if (!company?.id || busyKey) return;
    // O que já está num pedido enviado fica de fora; se TUDO já foi pedido,
    // o toque é o "Pedir de novo mesmo assim" e vai tudo.
    const naoPedidos = grupo.items.filter((it: PurchaseSuggestion) => !jaPedidos[it.product_id]);
    const itens = naoPedidos.length > 0 ? naoPedidos : grupo.items;
    setBusyKey(grupo.key);
    try {
      const res = await matconApi.createPurchaseOrder(company.id, {
        supplier_name: grupo.supplier_name === "Sem fornecedor identificado" ? null : grupo.supplier_name,
        supplier_cnpj: grupo.supplier_cnpj,
        supplier_phone: grupo.supplier_phone,
        items: itens.map((s: PurchaseSuggestion) => ({ product_id: s.product_id, quantity: s.suggested_qty })),
      });
      invalidate();
      setPedidoAberto(res.order);
    } catch (e: any) {
      toast.error(textoDoErro(e, "Não consegui montar o pedido. Tente de novo em instantes."));
    } finally {
      setBusyKey(null);
    }
  }

  // Carregando por estação: "Falta comprar" depende das sugestões (e dos
  // rascunhos); "Pedido enviado"/"Recebido", só dos pedidos.
  const carregandoEstacao = enabled && (estacao === "sugestao" ? suggestionsQuery.isLoading : ordersQuery.isLoading);
  const isFetching = suggestionsQuery.isFetching || ordersQuery.isFetching;

  // ── Tela ──────────────────────────────────────────────────
  if (!enabled) {
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <ScreenHero eyebrow="Matcon" title="Compras" />
        <View style={st.gate} testID="matcon-compras-desligado">
          <View style={st.gateIcon}><Icon name="lock" size={20} color={Colors.violet3} /></View>
          <Text style={st.gateTitle}>Ligue &quot;Materiais de construção&quot; em Configurações › Caixa</Text>
          <Text style={st.gateDesc}>As compras só aparecem para lojas com o módulo ligado.</Text>
          <Pressable onPress={() => router.push("/configuracoes" as any)} style={st.gateBtn} testID="matcon-compras-ir-config">
            <Text style={st.gateBtnText}>Abrir Configurações</Text>
            <Icon name="chevron_right" size={14} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const itensAbaixoDoMinimo = resumoSugestao ? resumoSugestao.items_below_min : 0;
  const fornecedoresCount = resumoSugestao ? resumoSugestao.suppliers : 0;
  const pedidosACaminho = resumoPedidos ? resumoPedidos.sent.count : 0;

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <ScreenHero
        eyebrow="Matcon"
        title="Compras"
        live={!!resumoSugestao && !!resumoPedidos}
        subtitle={
          !resumoSugestao || !resumoPedidos ? (
            sugestoesFalharam || pedidosFalharam ? "Não consegui carregar tudo agora — veja o aviso abaixo."
              : suggestionsQuery.isLoading || ordersQuery.isLoading ? "Carregando…" : undefined
          ) : (
            <Text>
              {fmtMoneyCurto(resumoSugestao.total_est_cost)} de material faltando para a loja voltar ao mínimo ·{" "}
              <Text style={{ color: itensAbaixoDoMinimo > 0 ? Colors.amber : Colors.ink3, fontWeight: itensAbaixoDoMinimo > 0 ? "700" : "400" }}>
                {itensAbaixoDoMinimo} {itensAbaixoDoMinimo === 1 ? "item" : "itens"} abaixo do mínimo em {fornecedoresCount} {fornecedoresCount === 1 ? "fornecedor" : "fornecedores"}
              </Text>
              {" "}· {pedidosACaminho} {pedidosACaminho === 1 ? "pedido a caminho" : "pedidos a caminho"}
            </Text>
          )
        }
        actions={
          <Pressable onPress={() => router.push("/estoque" as any)} style={st.ghostBtn} testID="matcon-compras-ir-estoque">
            <Icon name="package" size={14} color={Colors.ink} />
            <Text style={st.ghostBtnText}>Estoque</Text>
          </Pressable>
        }
      />

      <EsteiraMatcon stations={estacoes} testID="matcon-esteira-compras" />

      {estacao === "sugestao" && fornecedores.length > 0 && (
        <View style={st.chips} testID="matcon-chips-fornecedor">
          <Pressable onPress={() => setFornecedor(null)} style={[st.chip, fornecedor === null && st.chipOn]} testID="matcon-chip-todos">
            <Text style={[st.chipText, fornecedor === null && st.chipTextOn]}>Todos os fornecedores</Text>
          </Pressable>
          {fornecedores.map((f) => (
            <Pressable key={f.key} onPress={() => setFornecedor(f.key)} style={[st.chip, fornecedor === f.key && st.chipOn]} testID={`matcon-chip-${f.key}`}>
              <Text style={[st.chipText, fornecedor === f.key && st.chipTextOn]} numberOfLines={1}>{f.supplier_name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {carregandoEstacao ? (
        <View style={st.loadingBox} testID="matcon-compras-carregando"><ActivityIndicator color={Colors.violet3} /></View>
      ) : (
        <>
          {estacao === "sugestao" && pedidosRascunho.length > 0 && (
            <View style={{ gap: 8, marginBottom: 12 }} testID="matcon-lista-rascunho">
              {pedidosRascunho.map((order) => (
                <PedidoRascunhoCard key={order.id} order={order} onAbrir={() => setPedidoAberto(order)} />
              ))}
            </View>
          )}

          {estacao === "sugestao" && (
            sugestoesFalharam ? (
              <EsteiraErro
                testID="matcon-compras-erro-sugestao"
                titulo="Não consegui ver o que falta comprar."
                frase={fraseDoErroDeCarga(suggestionsQuery.error)}
                onTentarDeNovo={() => { suggestionsQuery.refetch(); }}
                tentando={suggestionsQuery.isFetching}
              />
            ) : !suggestionsQuery.data ? null : fornecedoresFiltrados.length === 0 ? (
              <EsteiraVazia
                testID="matcon-compras-vazio"
                titulo="Nada faltando hoje."
                frase="Sugerimos compra quando o estoque de um produto fica abaixo do mínimo cadastrado, ou quando as vendas dos últimos 30 dias mostram que ele vai acabar. Hoje nenhum produto está assim."
                acao={
                  <Pressable onPress={() => router.push("/estoque" as any)} style={st.ghostBtn} testID="matcon-compras-vazio-ir-estoque">
                    <Icon name="package" size={14} color={Colors.ink} />
                    <Text style={st.ghostBtnText}>Conferir o estoque mínimo</Text>
                  </Pressable>
                }
              />
            ) : (
              <View style={{ gap: 8 }} testID="matcon-lista-sugestao">
                {fornecedoresFiltrados.map((grupo) => (
                  <FornecedorCard
                    key={grupo.key}
                    grupo={grupo}
                    jaPedidos={jaPedidos}
                    expandido={!!expandidos[grupo.key]}
                    onVerItens={() => setExpandidos((prev) => ({ ...prev, [grupo.key]: !prev[grupo.key] }))}
                    onMontarPedido={() => montarPedido(grupo)}
                    busy={busyKey === grupo.key}
                  />
                ))}
              </View>
            )
          )}

          {estacao !== "sugestao" && pedidosFalharam && (
            <EsteiraErro
              testID="matcon-compras-erro-pedidos"
              titulo="Não consegui carregar os pedidos de compra."
              frase={fraseDoErroDeCarga(ordersQuery.error)}
              onTentarDeNovo={() => { ordersQuery.refetch(); }}
              tentando={ordersQuery.isFetching}
            />
          )}

          {estacao === "enviado" && !!ordersQuery.data && (
            pedidosEnviados.length === 0 ? (
              <EsteiraVazia
                testID="matcon-compras-enviado-vazio"
                titulo="Nenhum pedido enviado."
                frase={<Text>Em <EsteiraVaziaDestaque>Falta comprar</EsteiraVaziaDestaque>, toque em <EsteiraVaziaDestaque>Montar pedido</EsteiraVaziaDestaque> no fornecedor e depois em <EsteiraVaziaDestaque>Enviar no WhatsApp para o fornecedor</EsteiraVaziaDestaque> ou <EsteiraVaziaDestaque>Marcar como enviado</EsteiraVaziaDestaque>.</Text>}
              />
            ) : (
              <View style={{ gap: 8 }} testID="matcon-lista-enviado">
                {pedidosEnviados.map((order) => (
                  <PedidoEnviadoCard key={order.id} order={order} onAbrir={() => setPedidoAberto(order)} />
                ))}
              </View>
            )
          )}

          {estacao === "recebido" && !!ordersQuery.data && (
            pedidosRecebidos.length === 0 ? (
              <EsteiraVazia
                testID="matcon-compras-recebido-vazio"
                titulo="Nada recebido nos últimos 7 dias."
                frase="Quando a nota do fornecedor der entrada no estoque, o pedido fecha sozinho e aparece aqui."
              />
            ) : (
              <View style={{ gap: 8 }} testID="matcon-lista-recebido">
                {pedidosRecebidos.map((order) => (
                  <PedidoRecebidoCard key={order.id} order={order} />
                ))}
              </View>
            )
          )}

          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </>
      )}

      <PedidoSheet
        order={pedidoAberto}
        companyId={company?.id || null}
        nomeDaLoja={company?.name || ""}
        onClose={() => setPedidoAberto(null)}
        onSalvo={invalidate}
      />
    </ScrollView>
  );
}

// ── Card da sugestão, por fornecedor ────────────────────────────────
function FornecedorCard({ grupo, jaPedidos, expandido, onVerItens, onMontarPedido, busy }: {
  grupo: FornecedorSugestoes;
  jaPedidos: Record<string, string>;
  expandido: boolean;
  onVerItens: () => void;
  onMontarPedido: () => void;
  busy: boolean;
}) {
  const visiveis = expandido ? grupo.items : grupo.items.slice(0, ITENS_VISIVEIS);
  const ocultos = grupo.items.slice(ITENS_VISIVEIS);
  const somaOcultos = ocultos.reduce((acc, s) => acc + (Number(s.est_cost) || 0), 0);
  const acabando = grupo.min_days_to_stockout !== null && grupo.min_days_to_stockout <= 3;
  const nItens = grupo.items.length;
  const tudoJaPedido = grupo.items.length > 0 && grupo.items.every((it) => !!jaPedidos[it.product_id]);

  const meta = ["quem vendeu esses itens na última nota", grupo.supplier_phone || ""].filter(Boolean).join(" · ");

  return (
    <EsteiraCard
      testID={`matcon-fornecedor-${grupo.key}`}
      tone={acabando ? "amber" : undefined}
      right={
        <>
          <View style={[st.badge, { borderColor: acabando ? Colors.amber : Colors.violet3 }]}>
            <Text style={[st.badgeText, { color: acabando ? Colors.amber : Colors.violet3 }]}>
              {acabando ? `Acaba em ${grupo.min_days_to_stockout} dias` : `${nItens} ${nItens === 1 ? "item" : "itens"}`}
            </Text>
          </View>
          <Text style={st.total}>{fmtMoneyCurto(grupo.total_est)}</Text>
        </>
      }
      actions={
        busy ? <ActivityIndicator size="small" color={Colors.violet3} /> : (
          <>
            {ocultos.length > 0 && (
              <Pressable onPress={onVerItens} style={st.miniBtn} testID={`matcon-ver-itens-${grupo.key}`}>
                <Text style={st.miniBtnText}>{expandido ? "Ver menos" : "Ver itens"}</Text>
              </Pressable>
            )}
            <Pressable onPress={onMontarPedido} style={[st.miniBtn, st.miniBtnPrimary]} testID={`matcon-montar-pedido-${grupo.key}`}>
              <Icon name="clipboard" size={13} color="#fff" />
              <Text style={[st.miniBtnText, { color: "#fff" }]}>{tudoJaPedido ? "Pedir de novo mesmo assim" : "Montar pedido"}</Text>
            </Pressable>
          </>
        )
      }
    >
      <Text style={st.cliente}>{grupo.supplier_name}</Text>
      <Text style={st.meta} numberOfLines={2}>{meta}</Text>

      <View style={{ marginTop: 8, gap: 4 }}>
        {visiveis.map((item) => {
          const pedido = jaPedidos[item.product_id];
          return pedido ? (
            <Text key={item.product_id} style={[st.itemFrase, st.itemJaPedido]} testID={`matcon-ja-pedido-${item.product_id}`}>
              <Text style={st.itemNomeInline}>{item.name}</Text> · {fraseJaPedido(pedido)}
            </Text>
          ) : (
            <Text key={item.product_id} style={st.itemFrase}>
              <Text style={st.itemNomeInline}>{item.name}</Text> · {fraseDaSugestao(item)}
            </Text>
          );
        })}
        {!expandido && ocultos.length > 0 && (
          <Text style={st.itemMais}>
            mais {ocultos.length} {ocultos.length === 1 ? "item" : "itens"} deste fornecedor · {fmtMoneyApprox(somaOcultos)}
          </Text>
        )}
      </View>

      {acabando && (
        <View style={st.aviso}>
          <Text style={st.avisoS}>⚠</Text>
          <Text style={st.avisoTexto}>Acaba em {grupo.min_days_to_stockout} {grupo.min_days_to_stockout === 1 ? "dia" : "dias"} no ritmo de venda de hoje.</Text>
        </View>
      )}
    </EsteiraCard>
  );
}

// ── Card de pedido montado e ainda não enviado (draft) ───────
function PedidoRascunhoCard({ order, onAbrir }: { order: PurchaseOrder; onAbrir: () => void }) {
  const n = (order.items || []).length;
  return (
    <EsteiraCard
      testID={`matcon-pedido-rascunho-${order.id}`}
      tone="violet"
      right={
        <>
          <View style={[st.badge, { borderColor: Colors.violet3 }]}>
            <Text style={[st.badgeText, { color: Colors.violet3 }]}>Falta enviar</Text>
          </View>
          <Text style={st.total}>{fmtMoneyCurto(order.total_est)}</Text>
        </>
      }
      actions={
        <Pressable onPress={onAbrir} style={[st.miniBtn, st.miniBtnPrimary]} testID={`matcon-continuar-pedido-${order.id}`}>
          <Text style={[st.miniBtnText, { color: "#fff" }]}>Continuar pedido</Text>
        </Pressable>
      }
    >
      <Text style={st.cliente}>{order.supplier_name || "Fornecedor não identificado"}</Text>
      <Text style={st.meta}>Pedido #{order.number} · {n} {n === 1 ? "item" : "itens"} · montado e ainda não enviado</Text>
    </EsteiraCard>
  );
}

// ── Card de "Pedido enviado" ─────────────────────────────────
function PedidoEnviadoCard({ order, onAbrir }: { order: PurchaseOrder; onAbrir: () => void }) {
  const progresso = progressoDoPedido(order);
  const meta = [`Pedido #${order.number}`, order.sent_at ? `enviado em ${fmtDiaMesDeTimestamp(order.sent_at)}` : ""].filter(Boolean).join(" · ");
  const parcial = progresso.pct > 0 && progresso.pct < 100;

  return (
    <EsteiraCard
      testID={`matcon-pedido-enviado-${order.id}`}
      tone="amber"
      right={
        <>
          <View style={[st.badge, { borderColor: Colors.amber }]}>
            <Text style={[st.badgeText, { color: Colors.amber }]}>{parcial ? "Parcial" : "Enviado"}</Text>
          </View>
          <Text style={st.total}>{fmtMoneyCurto(order.total_est)}</Text>
        </>
      }
      actions={
        <Pressable onPress={onAbrir} style={st.miniBtn} testID={`matcon-ver-pedido-${order.id}`}>
          <Text style={st.miniBtnText}>Ver pedido</Text>
        </Pressable>
      }
    >
      <Text style={st.cliente}>{order.supplier_name || "Fornecedor não identificado"}</Text>
      <Text style={st.meta} numberOfLines={2}>{meta}</Text>
      <View style={{ marginTop: 8, gap: 4 }}>
        {progresso.itens.map((item) => (
          <Text key={item.product_id} style={st.itemFrase} numberOfLines={1}>{item.name} · {item.label}</Text>
        ))}
      </View>
    </EsteiraCard>
  );
}

// ── Card de "Recebido" ───────────────────────────────────────
function PedidoRecebidoCard({ order }: { order: PurchaseOrder }) {
  const itens = order.items || [];
  // Um item só: "60 sc conferidos" (mockup). Vários itens de unidades
  // diferentes não somam num número só — conta os itens conferidos.
  const conferidos = itens.length === 1
    ? `${fmtQty(itens[0].received_qty)} ${itens[0].unit || ""} conferidos`.replace("  ", " ")
    : `${itens.length} ${itens.length === 1 ? "item conferido" : "itens conferidos"}`;

  return (
    <EsteiraCard
      testID={`matcon-pedido-recebido-${order.id}`}
      tone="green"
      right={
        <>
          <View style={[st.badge, { borderColor: Colors.green }]}>
            <Text style={[st.badgeText, { color: Colors.green }]}>Recebido</Text>
          </View>
          <Text style={st.total}>{fmtMoneyCurto(order.total_est)}</Text>
        </>
      }
    >
      <Text style={st.cliente}>{order.supplier_name || "Fornecedor não identificado"}</Text>
      <Text style={st.meta}>Pedido #{order.number}</Text>
      <View style={st.okline}>
        <Text style={st.okS}>✓</Text>
        <Text style={st.okTexto}>
          Nota do fornecedor entrou em {fmtDiaMesDeTimestamp(order.received_at)} · {conferidos}
        </Text>
      </View>
    </EsteiraCard>
  );
}

// ── Sheet do pedido (M4 #pedido) ─────────────────────────────────
function PedidoSheet({ order, companyId, nomeDaLoja, onClose, onSalvo }: {
  order: PurchaseOrder | null;
  companyId: string | null;
  nomeDaLoja: string;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Reabre com as quantidades atuais do pedido (§ mesmo truque de
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
      const raw = qtds[it.product_id] ?? "";
      const qtd = parseQtyInput(raw);
      if (qtd === null) {
        toast.error(`"${it.name}": quantidade inválida`);
        return null;
      }
      itens.push({ ...it, quantity: qtd });
    }
    return itens;
  }

  const total = order
    ? (order.items || []).reduce((acc, it) => {
        const qtd = parseQtyInput(qtds[it.product_id] ?? "") ?? 0;
        return acc + qtd * (Number(it.unit_cost_est) || 0);
      }, 0)
    : 0;

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

  // O wa.me PRECISA abrir síncrono no toque (utils/whatsapp.ts) — a
  // atualização do pedido só acontece depois, por baixo.
  function enviarNoWhatsApp() {
    if (!order || busy) return;
    const itens = itensAtuais();
    if (!itens) return;
    const texto = textoPedidoWhatsApp({ ...order, items: itens }, nomeDaLoja);
    if (!openWhatsApp(order.supplier_phone, texto)) {
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
          <View>
            <Text style={st.sheetTitle}>Pedido {order ? `#${order.number}` : ""} · {order?.supplier_name || "Fornecedor não identificado"}</Text>
            <Text style={st.sheetSub}>Ajuste a quantidade de cada item antes de mandar</Text>
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

          <View style={st.acts}>
            <Pressable
              onPress={enviarNoWhatsApp}
              style={[st.sheetBtn, st.sheetBtnWa, busy && { opacity: 0.6 }]}
              disabled={busy}
              testID="matcon-pedido-enviar-whatsapp"
            >
              <Icon name="whatsapp" size={14} color={Colors.green} />
              <Text style={[st.sheetBtnText, { color: Colors.green }]}>Enviar no WhatsApp para o fornecedor</Text>
            </Pressable>
            <Pressable
              onPress={marcarComoEnviado}
              style={[st.sheetBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              testID="matcon-pedido-marcar-enviado"
            >
              {busy ? <ActivityIndicator size="small" color={Colors.ink} /> : (
                <>
                  <Icon name="check" size={14} color={Colors.ink} />
                  <Text style={st.sheetBtnText}>Marcar como enviado</Text>
                </>
              )}
            </Pressable>
          </View>
          <Text style={st.sheetNota}>&quot;Marcar como enviado&quot; é para quem prefere ligar — o pedido sai de &quot;Falta comprar&quot; e vai para &quot;Pedido enviado&quot; do mesmo jeito.</Text>
        </ScrollView>
      </>
    </ResponsiveSheet>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 980, alignSelf: "center", width: "100%" },

  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },

  gate: { alignItems: "center", gap: 10, paddingVertical: 40, paddingHorizontal: 18 },
  gateIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  gateTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  gateDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 },
  gateBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  gateBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, maxWidth: 220 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },

  loadingBox: { paddingVertical: 40, alignItems: "center" },

  cliente: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  meta: { fontSize: 12, color: Colors.ink3, marginTop: 3, lineHeight: 17 },

  itemFrase: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  itemNomeInline: { color: Colors.ink, fontWeight: "600" },
  itemJaPedido: { color: Colors.ink3 },
  itemMais: { fontSize: 12, color: Colors.ink3, marginTop: 2 },

  aviso: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 10, padding: 9, borderRadius: 10, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "73" },
  avisoS: { color: Colors.amber, fontWeight: "800" },
  avisoTexto: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 },

  okline: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 10, padding: 9, borderRadius: 10, backgroundColor: Colors.greenD, borderWidth: 1, borderColor: Colors.green + "66" },
  okS: { color: Colors.green, fontWeight: "800" },
  okTexto: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 },

  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  total: { fontFamily: Fonts.mono, fontSize: 17, color: Colors.ink },

  miniBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniBtnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: Colors.ink },

  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
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
