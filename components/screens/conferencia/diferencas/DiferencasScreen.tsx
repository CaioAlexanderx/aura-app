// ============================================================
// AURA. — Conferência de estoque · Diferenças, ajustar e transferir
// (p-108, entrega C, 11/11/2026)
//
// Mockup aprovado pelo Caio: claude.ai/artifact/NYmEGh4GYjWYjz5krAUTbk
// (etapas 3 "Diferenças" e 4 "Ajustado").
//
//   · resumo: batem, faltam (peças), sobram (peças), não contados; falta e
//     sobra a custo, e quantos itens ficaram fora por não ter custo. Quem
//     não vê custo (podeVerCusto, ou custos_ocultos do backend) não vê
//     valor nenhum — nunca "R$ 0";
//   · listas por grupo; "batem" e "não contados" abrem num toque;
//   · NÃO AJUSTAR: cada falta/sobra tem a caixa "Ajustar" à esquerda,
//     marcada; a desmarcada vai em ignorar_item_ids e fica como está
//     (Aura-backend#1001);
//   · "zerar não contados" só por escolha explícita, começa desmarcado;
//   · motivo (opcional, até 200), começa com o gravado ao começar e vai no
//     aplicar;
//   · Ajustar: só quem edita o estoque, com o ConfirmDialog do app num
//     WebPortal (nunca confirm()), com a prévia do estoque depois. A regra
//     do backend soma ou tira só a diferença do que o sistema tinha no
//     bipe, então a venda feita depois da contagem fica mantida. 409
//     JA_APLICADA (clique duplo) conta como sucesso;
//   · TRANSFERIR (ajuste de escopo do Caio, 11/11): só com 2+ lojas
//     (lojasDaTransferencia) e para quem edita o estoque. É um modo à
//     parte, com faixa própria e um botão "Transferir" à direita de cada
//     linha (não a caixa do ajuste), para não confundir as duas escolhas.
//     As sobras já vêm escolhidas; abre o TransferirModal do Estoque
//     pré-preenchido, mandando stock_count_id. Antes ou depois de ajustar.
//
//   · 12/11/2026: no rascunho, o aviso "N itens sem custo" ganha o botão
//     "Preencher custos" (quem edita o estoque e vê custo), que abre a tela
//     de custos filtrada nesta conferência. Ao voltar (foco), as diferenças
//     recarregam: o backend já pôs o custo novo nos itens sem custo no bipe.
//
// Antes do backend no ar: 503 MIGRATION_PENDING / 404 viram texto gentil.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Colors } from "@/constants/colors";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import { TransferirModal } from "@/components/screens/estoque/transferencia/TransferirModal";
import {
  conferenciaEstoqueResultadoApi, mensagemDaConferencia, MSG_SO_QUEM_EDITA, MOTIVO_MAX,
  type Conferencia, type ItemDiferenca, type RespostaAplicar, type RespostaDiferencas, type TransferenciaDaConferencia,
} from "@/services/conferenciaEstoqueResultadoApi";
import { useConferenciaContexto } from "@/hooks/useConferenciaResultado";
import {
  DIAS_PARA_DESFAZER, avisoDeEstoqueQueMudou, brl, chaveDoItem, comSinal, dataCurta, dataEHora, desfazerAte, itens as nItens,
  montarTransferencia, pecas, podeDesfazerAgora, qtd, rotuloDoEscopo, somaDasPecas,
} from "@/utils/conferenciaResultado";
import { plural as pluralQtd, textoDosNumeros } from "@/utils/transferenciaEstoque";
import { Aviso, Botao, Cartao, Marcar, Selo, ui } from "./ui";
import { NavDaConferencia } from "../NavDaConferencia";

type Props = { countId: string; lojaDaRota?: string | null };

var PREVIA_NA_CONFIRMACAO = 3;

function sufixoLoja(loja: string | null | undefined): string {
  return loja ? "?loja=" + encodeURIComponent(loja) : "";
}

function depoisDoAjuste(it: ItemDiferenca): number {
  return it.estoque_depois != null ? it.estoque_depois : Math.max(0, it.estoque_atual + it.diferenca);
}

export function DiferencasScreen({ countId, lojaDaRota }: Props) {
  var ctx = useConferenciaContexto(lojaDaRota);
  var companyId = ctx.companyId;
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  var [carregando, setCarregando] = useState(true);
  var [erro, setErro] = useState<string | null>(null);
  var [conf, setConf] = useState<Conferencia | null>(null);
  var [transferencias, setTransferencias] = useState<TransferenciaDaConferencia[]>([]);
  var [dif, setDif] = useState<RespostaDiferencas | null>(null);

  var [zerar, setZerar] = useState(false);
  // item_id → true: desmarcado, não ajusta (vai em ignorar_item_ids).
  var [naoAjustar, setNaoAjustar] = useState<Record<string, boolean>>({});
  var [motivo, setMotivo] = useState("");
  var motivoPronto = useRef(false);
  var [confirmar, setConfirmar] = useState(false);
  var [aplicando, setAplicando] = useState(false);
  var [erroAplicar, setErroAplicar] = useState<string | null>(null);
  var [resultado, setResultado] = useState<RespostaAplicar | null>(null);

  var [verBatem, setVerBatem] = useState(false);
  var [verNaoContados, setVerNaoContados] = useState(false);

  var [escolhendo, setEscolhendo] = useState(false);
  var [escolhidos, setEscolhidos] = useState<Record<string, boolean>>({});
  var [transferirAberto, setTransferirAberto] = useState(false);
  var [aberturas, setAberturas] = useState(0);

  var carregar = useCallback(function (silencioso?: boolean) {
    if (!companyId) { setCarregando(false); return Promise.resolve(); }
    if (!silencioso) setCarregando(true);
    setErro(null);
    return Promise.all([
      conferenciaEstoqueResultadoApi.obter(companyId, countId),
      conferenciaEstoqueResultadoApi.diferencas(companyId, countId),
    ])
      .then(function (r) {
        if (!vivo.current) return;
        var c = r[0] && r[0].conferencia ? r[0].conferencia : null;
        setConf(c);
        // O motivo começa com o gravado ao começar; depois é da pessoa.
        if (c && !motivoPronto.current) { motivoPronto.current = true; setMotivo(c.motivo || ""); }
        setTransferencias(Array.isArray(r[0] && r[0].transferencias) ? (r[0].transferencias as TransferenciaDaConferencia[]) : []);
        setDif(r[1]);
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErro(mensagemDaConferencia(e, "carregar"));
      })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }, [companyId, countId]);

  useEffect(function () { carregar(); }, [carregar]);

  // Volta da tela de custos (ou de outra da pilha): recarrega em silêncio,
  // para o valor de falta e sobra já contar o custo novo. O primeiro foco é
  // o da abertura, que o efeito acima já carrega.
  var primeiroFoco = useRef(true);
  useFocusEffect(useCallback(function () {
    if (primeiroFoco.current) { primeiroFoco.current = false; return; }
    carregar(true);
  }, [carregar]));

  var grupos = useMemo(function () {
    var out = { faltam: [] as ItemDiferenca[], sobram: [] as ItemDiferenca[], batem: [] as ItemDiferenca[] };
    (dif ? dif.itens : []).forEach(function (it) { out[it.grupo].push(it); });
    return out;
  }, [dif]);

  var naoContados = dif ? dif.nao_contados : [];
  var zeraveis = naoContados.filter(function (n) { return n.estoque_atual !== 0; });
  var status = conf ? conf.status : null;
  var rascunho = status === "rascunho";
  var podeAjustar = rascunho && ctx.podeEditar;

  var comDiferenca = grupos.faltam.concat(grupos.sobram);
  var paraAjustar = comDiferenca.filter(function (it) { return !naoAjustar[it.item_id]; });
  var desmarcados = comDiferenca.filter(function (it) { return !!naoAjustar[it.item_id]; });
  var aAjustar = paraAjustar.length + (zerar ? zeraveis.length : 0);

  var lojas = ctx.lojasTransferencia;
  var podeTransferir = !!lojas && ctx.podeEditar && (status === "rascunho" || status === "aplicada")
    && (comDiferenca.length + grupos.batem.length) > 0;

  // ── Ajustar ──────────────────────────────────────────────────
  function aplicar() {
    if (!companyId || aplicando) return;
    setConfirmar(false);
    setAplicando(true);
    setErroAplicar(null);
    conferenciaEstoqueResultadoApi.aplicar(companyId, countId, {
      zerar_nao_contados: zerar,
      ignorar_item_ids: desmarcados.map(function (it) { return it.item_id; }),
      motivo: motivo,
    })
      .then(function (r) {
        if (!vivo.current) return;
        setResultado(r || {});
        if (r && r.conferencia) setConf(r.conferencia);
        return carregar(true);
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErroAplicar(mensagemDaConferencia(e, "aplicar"));
        if (e && e.status === 409) carregar(true);
      })
      .finally(function () { if (vivo.current) setAplicando(false); });
  }

  function alternarAjuste(it: ItemDiferenca) {
    setNaoAjustar(function (m) { var n = { ...m }; if (n[it.item_id]) delete n[it.item_id]; else n[it.item_id] = true; return n; });
  }

  // ── Transferir ───────────────────────────────────────────────
  function comecarEscolha() {
    var m: Record<string, boolean> = {};
    grupos.sobram.forEach(function (it) { m[chaveDoItem(it)] = true; });
    setEscolhidos(m);
    setEscolhendo(true);
  }
  function alternar(it: ItemDiferenca) {
    var k = chaveDoItem(it);
    setEscolhidos(function (m) { var n = { ...m }; if (n[k]) delete n[k]; else n[k] = true; return n; });
  }
  function marcarSobras() {
    setEscolhidos(function (m) {
      var n = { ...m };
      grupos.sobram.forEach(function (it) { n[chaveDoItem(it)] = true; });
      return n;
    });
  }
  var listaEscolhida = useMemo(function () {
    return (dif ? dif.itens : []).filter(function (it) { return !!escolhidos[chaveDoItem(it)]; });
  }, [dif, escolhidos]);
  var transferencia = useMemo(function () { return montarTransferencia(listaEscolhida); }, [listaEscolhida]);

  function abrirTransferir() {
    if (listaEscolhida.length === 0) return;
    setAberturas(function (n) { return n + 1; });
    setTransferirAberto(true);
  }

  function irPara(caminho: string) { router.push(caminho as any); }

  // ── Render ───────────────────────────────────────────────────
  function linha(it: ItemDiferenca) {
    var k = chaveDoItem(it);
    var mudou = avisoDeEstoqueQueMudou(it, status);
    var cor = it.diferenca < 0 ? Colors.red : it.diferenca > 0 ? Colors.green : Colors.ink3;
    var ajustavel = podeAjustar && !escolhendo && it.diferenca !== 0;
    var fora = !!naoAjustar[it.item_id] && rascunho && it.diferenca !== 0;
    var vai = !!escolhidos[k];
    var info = (
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.nome} numberOfLines={2}>{it.nome}</Text>
        <Text style={ui.nota} testID={"dif-sub-" + k}>
          {(it.variante ? it.variante + " · " : "") + "sistema " + qtd(it.estoque_no_bipe) + ", contado " + qtd(it.contado)}
        </Text>
        {mudou ? (
          <Text style={ui.nota} testID={"dif-mudou-" + k}>{mudou}</Text>
        ) : null}
        {fora ? <Text style={[ui.nota, { color: Colors.amber }]} testID={"dif-fora-" + k}>Fica como está: não será ajustado.</Text> : null}
      </View>
    );
    return (
      <View key={k} style={[s.linha, fora && { opacity: 0.6 }]} testID={"dif-item-" + k}>
        <View style={s.linhaCorpo}>
          {ajustavel ? (
            <Marcar marcado={!naoAjustar[it.item_id]} onPress={function () { alternarAjuste(it); }}
              rotulo={"Ajustar " + it.nome + (it.variante ? " " + it.variante : "")} testID={"dif-ajustar-" + k} />
          ) : null}
          {info}
          <Text style={[s.num, { color: cor }]} testID={"dif-num-" + k}>{comSinal(it.diferenca)}</Text>
        </View>
        {escolhendo ? (
          <Pressable onPress={function () { alternar(it); }} style={[s.pill, vai && s.pillOn]}
            accessibilityRole="switch" accessibilityState={{ checked: vai }}
            accessibilityLabel={"Transferir " + it.nome + (it.variante ? " " + it.variante : "")} testID={"dif-escolher-" + k}>
            <Text style={[s.pillTxt, vai && { color: "#fff" }]}>{vai ? "⇄ Vai para outra loja" : "⇄ Transferir"}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function grupo(titulo: string, lista: ItemDiferenca[], testID: string) {
    if (lista.length === 0) return null;
    return (
      <Cartao style={[{ paddingHorizontal: 4, paddingVertical: 4 }, escolhendo && s.cartaoTransferir]} testID={testID}>
        <Text style={[ui.h3, { paddingHorizontal: 10, paddingTop: 8 }]}>{titulo}</Text>
        {lista.map(linha)}
      </Cartao>
    );
  }

  var cabecalho = (
    <View>
      <NavDaConferencia
        voltar={{ rotulo: "Voltar às conferências", destino: "/conferencia-estoque" + sufixoLoja(lojaDaRota), testID: "dif-voltar-lista" }}
        testIDEstoque="dif-ir-estoque"
        style={{ marginBottom: 8 }}
      />
      <View style={[ui.linhaFlex, { justifyContent: "space-between" }]}>
        <Text style={ui.titulo}>Diferenças</Text>
        {status === "aplicada" ? <Selo tipo="verde" testID="dif-status">Ajustada</Selo>
          : status === "desfeita" ? <Selo tipo="neutro" testID="dif-status">Desfeita</Selo>
          : status === "descartada" ? <Selo tipo="neutro" testID="dif-status">Descartada</Selo>
          : status === "rascunho" ? <Selo tipo="ambar" testID="dif-status">Rascunho salvo</Selo> : null}
      </View>
      {conf ? (
        <Text style={ui.sub} testID="dif-subtitulo">
          {"Conferência nº " + conf.numero + " · " + rotuloDoEscopo(conf.escopo) + (ctx.nomeDaLoja ? " · " + ctx.nomeDaLoja : "")}
        </Text>
      ) : null}
    </View>
  );

  if (!companyId) {
    return (
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} testID="dif-tela">
        {cabecalho}
        <Aviso tipo="info" testID="dif-sem-loja">
          Você está vendo todas as lojas juntas. Abra esta conferência a partir da loja em que ela foi feita.
        </Aviso>
      </ScrollView>
    );
  }

  if (carregando) {
    return (
      <View style={[ui.tela, { alignItems: "center", justifyContent: "center", padding: 24 }]} testID="dif-carregando">
        <ActivityIndicator color={Colors.violet3} />
        <Text style={[ui.nota, { marginTop: 10 }]}>Comparando a contagem com o sistema…</Text>
      </View>
    );
  }

  if (erro || !dif || !conf) {
    return (
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} testID="dif-tela">
        {cabecalho}
        <Aviso tipo="erro" testID="dif-erro">{erro || "Não conseguimos abrir esta conferência agora."}</Aviso>
        <View style={ui.acoes}>
          <Botao tipo="secundario" rotulo="Tentar de novo" onPress={function () { carregar(); }} testID="dif-tentar" />
        </View>
      </ScrollView>
    );
  }

  var r = dif.resumo;
  var pecasF = somaDasPecas(grupos.faltam);
  var pecasS = somaDasPecas(grupos.sobram);
  var ate = desfazerAte(conf);
  var aindaDesfaz = podeDesfazerAgora(conf);
  var semValor = ctx.semCusto || dif.custos_ocultos;

  var ajustadosTxt = resultado
    ? resultado.ja_aplicada
      ? "Esta conferência já tinha ajustado o estoque."
      : "Estoque ajustado em " + nItens(resultado.ajustados != null ? Number(resultado.ajustados) : aAjustar) + "."
    : "Esta conferência já ajustou o estoque.";
  var ignoradosNoResultado = resultado && Array.isArray(resultado.ignorados)
    ? resultado.ignorados.filter(function (x) { return !x || x.motivo !== "produto_indisponivel"; }).length : 0;

  // Mensagem da confirmação: o que acontece, com a prévia do estoque depois.
  var previa = paraAjustar.slice(0, PREVIA_NA_CONFIRMACAO).map(function (it) {
    return it.nome + (it.variante ? " · " + it.variante : "") + ": " + qtd(it.estoque_atual) + " → " + qtd(depoisDoAjuste(it));
  });
  var resto = paraAjustar.length - previa.length;
  var mensagemConfirmar = "Vamos ajustar " + nItens(aAjustar) + " pela sua contagem. As vendas feitas depois que você contou cada item ficam mantidas: a Aura só soma ou tira a diferença."
    + (previa.length > 0 ? " Fica assim: " + previa.join("; ") + (resto > 0 ? " e mais " + qtd(resto) : "") + "." : "")
    + (desmarcados.length > 0 ? " " + (desmarcados.length === 1 ? "1 item desmarcado fica" : qtd(desmarcados.length) + " itens desmarcados ficam") + " como está." : "")
    + (zerar && zeraveis.length > 0 ? " " + (zeraveis.length === 1 ? "1 item não contado vai" : qtd(zeraveis.length) + " itens não contados vão") + " para 0." : "")
    + " O ajuste fica registrado no histórico de conferências, e dá para desfazer por " + DIAS_PARA_DESFAZER + " dias, se precisar.";

  return (
    <View style={ui.tela}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[ui.conteudo, escolhendo && { paddingBottom: 140 }]} keyboardShouldPersistTaps="handled" testID="dif-tela">
        {cabecalho}

        {/* Ajustado (agora ou antes) */}
        {status === "aplicada" ? (
          <Aviso tipo="ok" testID="dif-ajustado">
            <Text style={[ui.avisoTxt, { fontWeight: "700" }]}>{ajustadosTxt}</Text>
            <Text style={[ui.nota, { marginTop: 6 }]}>
              {"Tudo ficou registrado no histórico de conferências, como “Conferência nº " + conf.numero + (conf.motivo ? " · " + conf.motivo : "") + "”."
                + (ignoradosNoResultado > 0 ? " " + (ignoradosNoResultado === 1 ? "1 item desmarcado ficou" : qtd(ignoradosNoResultado) + " itens desmarcados ficaram") + " como estava." : "")
                + (aindaDesfaz && ate ? " Você pode desfazer tudo até " + dataEHora(ate.toISOString()) + ", no histórico." : "")}
            </Text>
          </Aviso>
        ) : null}
        {status === "desfeita" ? (
          <Aviso tipo="info" testID="dif-desfeita">
            {"Conferência desfeita" + (conf.desfeita_em ? " em " + dataCurta(conf.desfeita_em) : "") + ". O estoque voltou ao que era, e ela segue registrada no histórico de conferências, marcada como desfeita."}
          </Aviso>
        ) : null}

        {/* Resumo */}
        <View style={s.resumo} testID="dif-resumo">
          <View style={s.resumoCel}><Text style={s.resumoNum} testID="dif-resumo-batem">{qtd(r.batem)}</Text><Text style={ui.nota}>batem</Text></View>
          <View style={s.resumoCel}><Text style={[s.resumoNum, { color: Colors.red }]} testID="dif-resumo-faltam">{qtd(r.faltam)}</Text><Text style={ui.nota}>{"faltam · " + pecas(pecasF)}</Text></View>
          <View style={s.resumoCel}><Text style={[s.resumoNum, { color: Colors.green }]} testID="dif-resumo-sobram">{qtd(r.sobram)}</Text><Text style={ui.nota}>{"sobram · " + pecas(pecasS)}</Text></View>
          <View style={s.resumoCel}><Text style={s.resumoNum} testID="dif-resumo-nao-contados">{qtd(r.nao_contados)}</Text><Text style={ui.nota}>não contados</Text></View>
        </View>

        {!semValor && (r.valor_faltam != null || r.valor_sobram != null) ? (
          <Cartao testID="dif-custo">
            <View style={ui.linhaFlex}>
              {r.valor_faltam != null ? <Selo tipo="vermelho" testID="dif-valor-faltam">{"Falta a custo: " + brl(r.valor_faltam)}</Selo> : null}
              {r.valor_sobram != null ? <Selo tipo="verde" testID="dif-valor-sobram">{"Sobra a custo: " + brl(r.valor_sobram)}</Selo> : null}
            </View>
            <Text style={[ui.nota, { marginTop: 8 }]} testID="dif-sem-custo">
              {r.itens_sem_custo > 0
                ? (r.itens_sem_custo === 1 ? "1 item sem custo cadastrado ficou fora desta conta." : qtd(r.itens_sem_custo) + " itens sem custo cadastrado ficaram fora desta conta.")
                : "Todos os itens têm custo cadastrado."}
            </Text>
            {r.itens_sem_custo > 0 && rascunho && ctx.podeEditar ? (
              <View style={{ marginTop: 8, flexDirection: "row" }}>
                <Botao tipo="secundario" pequeno rotulo="Preencher custos"
                  onPress={function () { irPara("/conferencia-estoque/custos?conferencia=" + encodeURIComponent(countId) + (lojaDaRota ? "&loja=" + encodeURIComponent(lojaDaRota) : "")); }}
                  testID="dif-preencher-custos" />
              </View>
            ) : null}
          </Cartao>
        ) : null}

        {dif.itens.length === 0 ? (
          <Aviso tipo="info" testID="dif-vazia">Nada foi contado nesta conferência ainda. Volte para a contagem e bipe ou busque os itens.</Aviso>
        ) : null}

        {escolhendo ? (
          <Aviso tipo="info" testID="dif-modo-transferir">
            <Text style={[ui.avisoTxt, { fontWeight: "700" }]}>Escolhendo o que vai para outra loja</Text>
            <Text style={[ui.nota, { marginTop: 4 }]}>
              Toque em “Transferir” nos itens que vão. Isso não muda o que será ajustado: o ajuste segue as caixas “Ajustar” de antes.
            </Text>
          </Aviso>
        ) : comDiferenca.length > 0 ? (
          <Text style={ui.nota} testID="dif-nota-venda">
            {(podeAjustar ? "Desmarque o que você não quer ajustar. " : "") + "A venda feita depois que você contou cada item é mantida: a Aura só soma ou tira a diferença."}
          </Text>
        ) : null}

        {grupo("Faltam", grupos.faltam, "dif-grupo-faltam")}
        {grupo("Sobram", grupos.sobram, "dif-grupo-sobram")}

        {grupos.batem.length > 0 ? (
          verBatem || escolhendo ? grupo("Batem", grupos.batem, "dif-grupo-batem") : (
            <Pressable onPress={function () { setVerBatem(true); }} style={ui.voltar} accessibilityRole="button" testID="dif-ver-batem">
              <Text style={ui.voltarTxt}>{"Ver os " + qtd(grupos.batem.length) + " que batem"}</Text>
            </Pressable>
          )
        ) : null}

        {/* Zerar não contados: só por escolha, desmarcado */}
        {podeAjustar && naoContados.length > 0 && !escolhendo ? (
          <Cartao testID="dif-zerar-cartao">
            <Marcar marcado={zerar} onPress={function () { setZerar(!zerar); }} rotulo="Zerar o que não apareceu" testID="dif-zerar">
              <Text style={s.nome}>Contei tudo: zerar o que não apareceu</Text>
              <Text style={ui.nota}>
                {(naoContados.length === 1 ? "1 item não contado." : qtd(naoContados.length) + " itens não contados.") + " Se não marcar, ficam como estão."}
              </Text>
            </Marcar>
            {zerar ? (
              <View style={{ marginTop: 8 }}>
                <Selo tipo="ambar" testID="dif-zerar-aviso">{"Esses itens vão para 0. Dá para desfazer por " + DIAS_PARA_DESFAZER + " dias."}</Selo>
              </View>
            ) : null}
          </Cartao>
        ) : null}

        {naoContados.length > 0 ? (
          verNaoContados ? (
            <Cartao testID="dif-grupo-nao-contados">
              <Text style={ui.h3}>Não contados</Text>
              {naoContados.map(function (n) {
                var k = chaveDoItem(n);
                return (
                  <Text key={k} style={[ui.nota, { paddingVertical: 4 }]} testID={"dif-nao-contado-" + k}>
                    {n.nome + (n.variante ? " · " + n.variante : "") + " · tem " + qtd(n.estoque_atual) + " no sistema"}
                  </Text>
                );
              })}
            </Cartao>
          ) : (
            <Pressable onPress={function () { setVerNaoContados(true); }} style={ui.voltar} accessibilityRole="button" testID="dif-ver-nao-contados">
              <Text style={ui.voltarTxt}>{"Ver os " + qtd(naoContados.length) + " não contados"}</Text>
            </Pressable>
          )
        ) : null}

        {/* Motivo: editável antes de ajustar; depois, só leitura */}
        {podeAjustar && !escolhendo ? (
          <Cartao testID="dif-motivo-cartao">
            <Text style={[ui.nota, { marginBottom: 6 }]}>MOTIVO (OPCIONAL)</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ex.: inventário do mês"
              placeholderTextColor={Colors.ink3}
              maxLength={MOTIVO_MAX}
              editable={!aplicando}
              style={s.motivo as any}
              accessibilityLabel="Motivo"
              testID="dif-motivo"
            />
          </Cartao>
        ) : conf.motivo ? (
          <Cartao testID="dif-motivo-lido">
            <Text style={ui.nota}>MOTIVO</Text>
            <Text style={[s.nome, { marginTop: 4 }]}>{conf.motivo}</Text>
          </Cartao>
        ) : null}

        {/* Transferir entre lojas: modo à parte */}
        {podeTransferir && !escolhendo ? (
          <Cartao testID="dif-transferir-cartao">
            <Text style={ui.h3}>Mandar para outra loja</Text>
            <Text style={ui.nota}>
              Sobrou peça aqui e falta em outra loja do grupo? Escolha os itens e transfira sem sair da conferência. As sobras já vêm escolhidas.
            </Text>
            <View style={{ marginTop: 10 }}>
              <Botao tipo="secundario" rotulo="Escolher itens para transferir" onPress={comecarEscolha} testID="dif-transferir" />
            </View>
          </Cartao>
        ) : null}
        {transferencias.length > 0 ? (
          <Text style={ui.nota} testID="dif-transferencias">
            {"Transferências desta conferência: " + transferencias.map(function (t) {
              return "nº " + t.numero + (t.destino_nome ? " para " + t.destino_nome : "") + (t.total_pecas != null ? " (" + pecas(Number(t.total_pecas)) + ")" : "");
            }).join(", ") + "."}
          </Text>
        ) : null}

        {!!erroAplicar && <Aviso tipo="erro" testID="dif-erro-aplicar">{erroAplicar}</Aviso>}

        {/* Ações */}
        {rascunho && !escolhendo ? (
          <View style={ui.acoes}>
            <Botao tipo="secundario" rotulo="Voltar e contar mais"
              onPress={function () { irPara("/conferencia-estoque/" + encodeURIComponent(countId) + sufixoLoja(lojaDaRota)); }} testID="dif-contar-mais" />
            {ctx.podeEditar ? (
              <Botao rotulo={"Ajustar " + nItens(aAjustar)} onPress={function () { setConfirmar(true); }}
                desabilitado={aAjustar === 0} ocupado={aplicando} testID="dif-ajustar" />
            ) : null}
          </View>
        ) : null}
        {rascunho && !ctx.podeEditar && !ctx.carregandoPermissao ? (
          <Text style={ui.nota} testID="dif-so-quem-edita">{MSG_SO_QUEM_EDITA}</Text>
        ) : null}
        {!rascunho && !escolhendo ? (
          <View style={ui.acoes}>
            <Botao tipo="secundario" rotulo="Ver histórico" onPress={function () { irPara("/conferencia-estoque/historico" + sufixoLoja(lojaDaRota)); }} testID="dif-historico" />
            <Botao rotulo="Nova conferência" onPress={function () { irPara("/conferencia-estoque" + sufixoLoja(lojaDaRota)); }} testID="dif-nova" />
          </View>
        ) : null}
      </ScrollView>

      {/* Barra da escolha para transferir: sempre visível, sem hover */}
      {escolhendo ? (
        <View style={s.barra} testID="dif-barra-transferir">
          <Text style={[ui.nota, { flexBasis: "100%" }]} testID="dif-barra-texto">
            {listaEscolhida.length === 0 ? "Toque em “Transferir” nos itens que vão para outra loja." : nItens(listaEscolhida.length) + " para transferir"}
          </Text>
          {grupos.sobram.length > 0 ? (
            <Botao tipo="secundario" pequeno rotulo="Escolher as sobras" onPress={marcarSobras} testID="dif-marcar-sobras" />
          ) : null}
          <View style={{ flex: 1 }} />
          <Botao tipo="secundario" pequeno rotulo="Cancelar" onPress={function () { setEscolhendo(false); setEscolhidos({}); }} testID="dif-cancelar-escolha" />
          <Botao pequeno rotulo={"Transferir " + nItens(listaEscolhida.length)} onPress={abrirTransferir}
            desabilitado={listaEscolhida.length === 0} testID="dif-abrir-transferir" />
        </View>
      ) : null}

      <WebPortal active={confirmar}>
        <ConfirmDialog
          visible={confirmar}
          title="Ajustar o estoque?"
          message={mensagemConfirmar}
          confirmLabel="Ajustar"
          cancelLabel="Agora não"
          destructive={false}
          onConfirm={aplicar}
          onCancel={function () { setConfirmar(false); }}
        />
      </WebPortal>

      <WebPortal active={transferirAberto && !!lojas}>
        <TransferirModal
          key={"transferir-" + aberturas}
          origem={lojas ? lojas.origem : { id: "", nome: "" }}
          destinos={lojas ? lojas.destinos : []}
          produtos={transferencia.produtos}
          quantidadesIniciais={transferencia.quantidades}
          stockCountId={countId}
          onFechar={function () { setTransferirAberto(false); }}
          onEstoqueMudou={function () { carregar(true); }}
          onConcluido={function (numeros, pecasTotal, destino) {
            toast.success((numeros.length > 1 ? "Transferências " : "Transferência ") + textoDosNumeros(numeros)
              + (numeros.length > 1 ? " feitas: " : " feita: ") + pluralQtd(pecasTotal, "peça", "peças") + " para " + destino.nome);
            setTransferirAberto(false);
            setEscolhendo(false);
            setEscolhidos({});
          }}
        />
      </WebPortal>
    </View>
  );
}

var s = StyleSheet.create({
  resumo: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resumoCel: { flexGrow: 1, flexBasis: 140, backgroundColor: Colors.bg4, borderRadius: 12, padding: 10, minWidth: 0 },
  resumoNum: { fontSize: 24, fontWeight: "700", color: Colors.ink },
  linha: { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  linhaCorpo: { flexDirection: "row", alignItems: "center", gap: 10 },
  nome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  num: { fontSize: 15, fontWeight: "700", textAlign: "right", minWidth: 44 },
  cartaoTransferir: { borderColor: Colors.violet },
  pill: {
    alignSelf: "flex-end", minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center",
    borderWidth: 1, borderColor: Colors.violet, backgroundColor: Colors.violetD,
  },
  pillOn: { backgroundColor: Colors.violet },
  pillTxt: { color: Colors.violet3, fontSize: 13, fontWeight: "700" },
  motivo: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.ink, backgroundColor: Colors.bg2, minHeight: 44,
  },
  barra: {
    position: "absolute" as any, left: 0, right: 0, bottom: 0,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.bg3,
    borderTopWidth: 1, borderTopColor: Colors.border2,
  },
});

export default DiferencasScreen;
