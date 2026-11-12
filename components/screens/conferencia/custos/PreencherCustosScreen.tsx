// ============================================================
// AURA. — Conferência de estoque · Preencher custos (12/11/2026)
//
// Mockup aprovado pelo Caio em 12/11: claude.ai/artifact/X9nk1tpyZoQVv4jdEuHJ9k
// (B, C, D, E, F e G1–G6). Regras em utils/custoEmMassa.ts.
//
//   · lista dos produtos sem custo da loja (Aura-backend, migration 448),
//     com "Todos", "Desta conferência" (quando veio das diferenças) e "Sem
//     preço de venda", busca e "Mostrar mais";
//   · cada linha: caixa de 44 px (marcada = entra na gravação e nos
//     atalhos), nome e preço, e o CAMPO DE CUSTO, sempre editável, com a
//     origem do número embaixo (digitado / sugerido / mesmo);
//   · "Atalhos (opcional)", fechado ao abrir: sugerir pelo preço de venda
//     (Markup como padrão, Margem num toque, a loja lembra o último) e mesmo
//     custo para os marcados. Só preenchem campo vazio ou já sugerido, salvo
//     "Trocar também o que eu digitei";
//   · "Últimos preenchimentos de custo" embaixo, com Ver e Desfazer (7 dias);
//   · barra "Revisar e gravar (N)" e confirmação no ConfirmDialog do app
//     num WebPortal (nunca confirm()); nada grava sem confirmar;
//   · quem não edita o estoque ou não vê custo nunca vê esta tela.
//
// Tema do app (Colors); sem hover-reveal: tudo visível, todo controle é um
// toque; em 375 px o campo desce para baixo do nome.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, TextInput, useWindowDimensions,
} from "react-native";
import { Redirect, router } from "expo-router";
import { Colors } from "@/constants/colors";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WebPortal } from "@/components/WebPortal";
import { useConferenciaContexto } from "@/hooks/useConferenciaResultado";
import {
  custoEmMassaApi, mensagemDoCusto,
  type Contagens, type FiltroDosSemCusto, type ModoDoAtalho, type ProdutoSemCusto, type RespostaGravar,
} from "@/services/custoEmMassaApi";
import {
  PERCENTUAL_INICIAL, aplicarMesmoCusto, aplicarSugestao, brl, contas, dataEHoraDoPrazo, detalheDaLinha, digitar,
  etiquetaDaLinha, exemploDoAtalho, lerPercentual, lerReais, listaDeNomes, mensagemDaConfirmacao, montarPedido,
  novaLinha, plural, acimaDoPreco, campoInvalido, precoDaConta,
  type LinhaDeCusto, type TomDaEtiqueta,
} from "@/utils/custoEmMassa";
import { Aviso, Botao, Cartao, ui } from "../diferencas/ui";
import { UltimosPreenchimentos } from "./UltimosPreenchimentos";

type Props = { countId?: string | null; lojaDaRota?: string | null };

var POR_PAGINA = 100;
var LARGURA_ESTREITA = 560;

function sufixoLoja(loja: string | null | undefined): string {
  return loja ? "?loja=" + encodeURIComponent(loja) : "";
}

/** Caixa de marcar de 44 px (o toque inteiro), sem input do navegador. */
function Caixa({ marcada, onPress, rotulo, testID }: { marcada: boolean; onPress: () => void; rotulo: string; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={s.caixaToque} accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }} accessibilityLabel={rotulo} testID={testID}>
      <View style={[s.caixa, marcada && s.caixaOn]}>
        {marcada ? <Text style={s.caixaCheck}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

function corDaEtiqueta(tom: TomDaEtiqueta): string {
  if (tom === "ambar") return Colors.amber;
  if (tom === "digitado") return Colors.green;
  if (tom === "sugerido") return Colors.violet3;
  return Colors.ink3;
}

function bordaDoCampo(l: LinhaDeCusto): string {
  if (!l.marcada) return Colors.border;
  if (campoInvalido(l) || acimaDoPreco(l)) return Colors.amber;
  if (!String(l.valor || "").trim()) return precoDaConta(l.produto) === null ? Colors.amber : Colors.border2;
  return l.origem === "digitado" ? Colors.green : Colors.violet;
}

var Linha = React.memo(function Linha({ linha, estreita, onMarcar, onDigitar }: {
  linha: LinhaDeCusto; estreita: boolean;
  onMarcar: (id: string) => void; onDigitar: (id: string, v: string) => void;
}) {
  var p = linha.produto;
  var id = p.product_id;
  var etq = etiquetaDaLinha(linha);
  var campo = (
    <View style={[s.campoCol, estreita && s.campoColEstreita]}>
      <View style={[s.campo, { borderColor: bordaDoCampo(linha) }]}>
        <Text style={s.campoRS}>R$</Text>
        <TextInput
          value={linha.valor}
          onChangeText={function (v) { onDigitar(id, v); }}
          placeholder="0,00"
          placeholderTextColor={Colors.ink3}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={s.campoInput}
          accessibilityLabel={"Custo de " + p.nome}
          testID={"custo-campo-" + id}
        />
      </View>
      <Text style={[s.etiqueta, { color: corDaEtiqueta(etq.tom) }]} testID={"custo-etiqueta-" + id}>{etq.texto}</Text>
    </View>
  );
  return (
    <View style={[s.linha, !linha.marcada && { opacity: 0.6 }]} testID={"custo-linha-" + id}>
      <Caixa marcada={linha.marcada} onPress={function () { onMarcar(id); }} rotulo={"Marcar " + p.nome} testID={"custo-marcar-" + id} />
      <View style={s.linhaCorpo}>
        <View style={[s.linhaTopo, estreita && { flexDirection: "column", alignItems: "stretch" }]}>
          <View style={{ flex: estreita ? undefined : 1, minWidth: 0 }}>
            <Text style={s.nome} numberOfLines={2}>{p.nome}</Text>
            <Text style={ui.nota}>{detalheDaLinha(p)}</Text>
            {p.compartilhado ? (
              <View style={[s.chip, { marginTop: 4 }]} testID={"custo-compartilhado-" + id}>
                <Text style={s.chipTxt}>{"Compartilhado · vale nas " + Math.max(2, p.lojas || 2) + " lojas"}</Text>
              </View>
            ) : null}
          </View>
          {campo}
        </View>
      </View>
    </View>
  );
});

export function PreencherCustosScreen({ countId, lojaDaRota }: Props) {
  var ctx = useConferenciaContexto(lojaDaRota);
  var companyId = ctx.companyId;
  // Só quem edita o estoque E vê custo: sem isso, nem a lista é pedida.
  var liberado = !ctx.carregandoPermissao && ctx.podeEditar && !ctx.semCusto;
  var { width } = useWindowDimensions();
  var estreita = width < LARGURA_ESTREITA;
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  var [filtro, setFiltro] = useState<FiltroDosSemCusto>(countId ? "conferencia" : "todos");
  var [busca, setBusca] = useState("");
  var [buscaAplicada, setBuscaAplicada] = useState("");
  var [ordem, setOrdem] = useState<string[]>([]);
  var [linhas, setLinhas] = useState<Record<string, LinhaDeCusto>>({});
  var [total, setTotal] = useState(0);
  var [contagens, setContagens] = useState<Contagens | null>(null);
  var [carregando, setCarregando] = useState(true);
  var [carregandoMais, setCarregandoMais] = useState(false);
  var [erroLista, setErroLista] = useState<string | null>(null);

  var [atalhoAberto, setAtalhoAberto] = useState(false);
  var [modo, setModo] = useState<ModoDoAtalho>("markup");
  var [pctTxt, setPctTxt] = useState(PERCENTUAL_INICIAL.markup);
  var atalhoLembrado = useRef(false);
  var [trocarDigitados, setTrocarDigitados] = useState(false);
  var [mesmoTxt, setMesmoTxt] = useState("");
  var [avisoAtalho, setAvisoAtalho] = useState<string | null>(null);
  var [atalhoUsado, setAtalhoUsado] = useState<{ modo: ModoDoAtalho; percentual: number } | null>(null);

  var [confirmar, setConfirmar] = useState(false);
  var [gravando, setGravando] = useState(false);
  // talvezGravou: tempo esgotado, o servidor pode ter gravado. Tentar de
  // novo é seguro (quem já ganhou custo volta como "mudou no meio").
  var [erroGravar, setErroGravar] = useState<{ msg: string; talvezGravou: boolean } | null>(null);
  var [resultado, setResultado] = useState<RespostaGravar | null>(null);
  // Sobe a cada gravação: "Últimos preenchimentos" recarrega.
  var [versaoHist, setVersaoHist] = useState(0);

  // Busca com folga de 350 ms (não chama a cada letra).
  useEffect(function () {
    var t = setTimeout(function () { setBuscaAplicada(busca.trim()); }, 350);
    return function () { clearTimeout(t); };
  }, [busca]);

  var carregar = useCallback(function (offset: number) {
    if (!companyId || !liberado) { setCarregando(false); return Promise.resolve(); }
    if (offset === 0) setCarregando(true); else setCarregandoMais(true);
    setErroLista(null);
    return custoEmMassaApi.pendentes(companyId, {
      filtro: filtro, countId: countId || null, busca: buscaAplicada, limit: POR_PAGINA, offset: offset,
    })
      .then(function (r) {
        if (!vivo.current) return;
        var itens: ProdutoSemCusto[] = Array.isArray(r && r.itens) ? r.itens : [];
        // O que a pessoa já fez numa linha fica, mesmo trocando de filtro.
        setLinhas(function (atual) {
          var novo = { ...atual };
          itens.forEach(function (p) {
            novo[p.product_id] = novo[p.product_id] ? { ...novo[p.product_id], produto: p } : novaLinha(p);
          });
          return novo;
        });
        var ids = itens.map(function (p) { return p.product_id; });
        setOrdem(function (o) { return offset === 0 ? ids : o.concat(ids.filter(function (x) { return o.indexOf(x) < 0; })); });
        setTotal(Number(r && r.total) || 0);
        setContagens((r && r.contagens) || null);
        if (!atalhoLembrado.current && r && r.ultimo_atalho && (r.ultimo_atalho.modo === "markup" || r.ultimo_atalho.modo === "margem")) {
          atalhoLembrado.current = true;
          setModo(r.ultimo_atalho.modo);
          setPctTxt(String(r.ultimo_atalho.percentual).replace(".", ","));
        }
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErroLista(mensagemDoCusto(e, "lista"));
      })
      .finally(function () {
        if (!vivo.current) return;
        setCarregando(false);
        setCarregandoMais(false);
      });
  }, [companyId, liberado, filtro, countId, buscaAplicada]);

  useEffect(function () { carregar(0); }, [carregar]);

  var visiveis = useMemo(function () {
    return ordem.map(function (id) { return linhas[id]; }).filter(Boolean);
  }, [ordem, linhas]);
  var todas = useMemo(function () { return Object.keys(linhas).map(function (k) { return linhas[k]; }); }, [linhas]);
  var c = useMemo(function () { return contas(visiveis, trocarDigitados); }, [visiveis, trocarDigitados]);
  var prontas = useMemo(function () { return contas(todas, false).prontas; }, [todas]);

  var onMarcar = useCallback(function (id: string) {
    setAvisoAtalho(null);
    setLinhas(function (m) { var l = m[id]; if (!l) return m; return { ...m, [id]: { ...l, marcada: !l.marcada } }; });
  }, []);
  var onDigitar = useCallback(function (id: string, v: string) {
    setErroGravar(null);
    setLinhas(function (m) { var l = m[id]; if (!l) return m; return { ...m, [id]: digitar(l, v) }; });
  }, []);

  function mudarVisiveis(fn: (ls: LinhaDeCusto[]) => LinhaDeCusto[]) {
    setLinhas(function (m) {
      var lista = ordem.map(function (id) { return m[id]; }).filter(Boolean);
      var novas = fn(lista);
      var out = { ...m };
      novas.forEach(function (l) { out[l.produto.product_id] = l; });
      return out;
    });
  }

  function marcarTodos(marcada: boolean) {
    setAvisoAtalho(null);
    mudarVisiveis(function (ls) { return ls.map(function (l) { return { ...l, marcada: marcada }; }); });
  }

  function trocarModo(m: ModoDoAtalho) {
    if (m === modo) return;
    setModo(m);
    setPctTxt(PERCENTUAL_INICIAL[m]);
  }

  function sugerir() {
    var pct = lerPercentual(pctTxt, modo);
    if (pct === null) { setAvisoAtalho("Confira o percentual: com esse número a Aura não consegue sugerir."); return; }
    var r = aplicarSugestao(visiveis, modo, pct, trocarDigitados);
    mudarVisiveis(function () { return r.linhas; });
    setAtalhoUsado({ modo: modo, percentual: pct });
    setAvisoAtalho(
      (r.sugeridas === 1 ? "Sugerimos o custo de 1 produto." : "Sugerimos o custo de " + plural(r.sugeridas, "produto", "produtos") + ".")
      + " Confira cada linha: dá para mudar qualquer número antes de gravar."
      + (r.semPreco > 0
        ? " " + (r.semPreco === 1 ? "1 produto não tem preço de venda, então o atalho passou por ele." : plural(r.semPreco, "produto", "produtos") + " não têm preço de venda, então o atalho passou por eles.")
          + " Digite o custo à mão, ou deixe em branco: " + (r.semPreco === 1 ? "ele fica como está." : "eles ficam como estão.")
        : ""),
    );
  }

  function usarMesmo() {
    var v = lerReais(mesmoTxt);
    if (v === null || !(v > 0)) { setAvisoAtalho("Digite o custo que vai para os marcados."); return; }
    var custo = Math.round(v * 100) / 100;
    var r = aplicarMesmoCusto(visiveis, custo, trocarDigitados);
    mudarVisiveis(function () { return r.linhas; });
    setAvisoAtalho("Custo de " + brl(custo) + " colocado " + (r.preenchidas === 1 ? "em 1 produto" : "em " + plural(r.preenchidas, "produto", "produtos"))
      + ". Dá para mudar linha a linha."
      + (r.mantidas > 0 ? " " + (r.mantidas === 1 ? "1 que você digitou ficou como está." : plural(r.mantidas, "que você digitou ficou", "que você digitou ficaram") + " como estão.") : ""));
  }

  function gravar() {
    if (!companyId || gravando) return;
    setConfirmar(false);
    setGravando(true);
    setErroGravar(null);
    var pedido = montarPedido(todas, atalhoUsado, countId || null);
    custoEmMassaApi.gravar(companyId, pedido)
      .then(function (r) {
        if (!vivo.current) return;
        setResultado(r);
        setVersaoHist(function (v) { return v + 1; });
        // Gravados e "mudou no meio" saem da lista: os dois já têm custo.
        var sai: Record<string, boolean> = {};
        (r && Array.isArray(r.itens) ? r.itens : []).forEach(function (i) {
          if (i.status === "grava" || i.status === "mudou_no_meio") sai[i.product_id] = true;
        });
        setLinhas(function (m) {
          var out: Record<string, LinhaDeCusto> = {};
          Object.keys(m).forEach(function (k) { if (!sai[k]) out[k] = m[k]; });
          return out;
        });
        setOrdem(function (o) { return o.filter(function (k) { return !sai[k]; }); });
        setAvisoAtalho(null);
        return carregar(0);
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErroGravar({ msg: mensagemDoCusto(e, "gravar"), talvezGravou: !!(e && e.isNetworkError && e.code === "timeout") });
      })
      .finally(function () { if (vivo.current) setGravando(false); });
  }

  function voltar() {
    var destino = countId
      ? "/conferencia-estoque/" + encodeURIComponent(countId) + "/diferencas" + sufixoLoja(lojaDaRota)
      : "/conferencia-estoque" + sufixoLoja(lojaDaRota);
    if (router.canGoBack && router.canGoBack()) router.back();
    else router.replace(destino as any);
  }
  var rotuloVoltar = countId ? "‹ Diferenças" : "‹ Conferir estoque";

  // ── Porta: só quem edita o estoque E vê custo ────────────────
  if (ctx.carregandoPermissao) {
    return (
      <View style={[ui.tela, { alignItems: "center", justifyContent: "center", padding: 24 }]} testID="custos-permissao">
        <ActivityIndicator color={Colors.violet3} />
      </View>
    );
  }
  if (!ctx.podeEditar || ctx.semCusto) return <Redirect href={("/conferencia-estoque" + sufixoLoja(lojaDaRota)) as any} />;

  var nomeDaLoja = ctx.nomeDaLoja || "sua loja";
  var semNada = !!contagens && contagens.todos === 0;

  var cabecalho = (
    <View>
      <Pressable onPress={voltar} style={ui.voltar} accessibilityRole="link" testID="custos-voltar">
        <Text style={ui.voltarTxt}>{rotuloVoltar}</Text>
      </Pressable>
      <Text style={ui.titulo}>Preencher custos</Text>
      {contagens && !semNada ? (
        <Text style={[ui.sub, { lineHeight: 19 }]} testID="custos-sub">
          {(contagens.todos === 1 ? "1 produto da " + nomeDaLoja + " está sem custo." : plural(contagens.todos, "produto", "produtos") + " da " + nomeDaLoja + " estão sem custo.")
            + " Digite o custo de cada um. Nada é gravado até você confirmar."}
        </Text>
      ) : null}
    </View>
  );

  if (!companyId) {
    return (
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} testID="custos-tela">
        {cabecalho}
        <Aviso tipo="info" testID="custos-sem-loja">Você está vendo todas as lojas juntas. Escolha uma loja para preencher os custos dela.</Aviso>
      </ScrollView>
    );
  }

  var avisoResultado = resultado ? (function () {
    var r = resultado as RespostaGravar;
    var gravados = r.resumo ? r.resumo.gravar : 0;
    var mudaram = (r.itens || []).filter(function (i) { return i.status === "mudou_no_meio"; });
    var ate = dataEHoraDoPrazo(r.undo_deadline);
    if (!r.fill_id && gravados === 0) {
      return (
        <Aviso tipo="atencao" testID="custos-nada-gravado">
          {mudaram.length > 0
            ? (mudaram.length === 1 ? "O produto ganhou custo" : "Os " + mudaram.length + " produtos ganharam custo") + " enquanto você preenchia (por uma entrada de mercadoria, por exemplo) e " + (mudaram.length === 1 ? "ficou" : "ficaram") + " com esse custo. Nada mais foi gravado."
            : "Nenhum custo foi gravado: os produtos não estão mais nesta loja ou já têm custo."}
        </Aviso>
      );
    }
    return (
      <Aviso tipo="ok" testID="custos-gravado">
        <Text style={[ui.avisoTxt, { fontWeight: "700" }]}>
          {gravados === 1 ? "Custo gravado em 1 produto." : "Custo gravado em " + plural(gravados, "produto", "produtos") + "."}
        </Text>
        {mudaram.length > 0 ? (
          <Text style={[ui.nota, { marginTop: 6 }]} testID="custos-mudou-no-meio">
            {(mudaram.length === 1 ? "1 ganhou custo" : plural(mudaram.length, "ganhou custo", "ganharam custo"))
              + " enquanto você preenchia (por uma entrada de mercadoria) e " + (mudaram.length === 1 ? "ficou" : "ficaram")
              + " com o custo da entrada: " + listaDeNomes(mudaram.map(function (i) { return i.nome || ""; })) + "."}
          </Text>
        ) : null}
        <Text style={[ui.nota, { marginTop: 6 }]}>
          {(countId && (r.itens_de_conferencia_atualizados || 0) > 0 ? "Na conferência, o valor do que falta e do que sobra já conta com eles. " : "")
            + (ate ? "Se precisar, dá para desfazer até " + ate + ", aqui embaixo." : "Se precisar, dá para desfazer por 7 dias, aqui embaixo.")}
        </Text>
        {countId ? (
          <View style={{ marginTop: 10, flexDirection: "row" }}>
            <Botao pequeno rotulo="Voltar às diferenças" onPress={voltar} testID="custos-voltar-diferencas" />
          </View>
        ) : null}
      </Aviso>
    );
  })() : null;

  // G1: nada sem custo na loja.
  if (!carregando && !erroLista && semNada) {
    return (
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} testID="custos-tela">
        {cabecalho}
        {avisoResultado}
        <Cartao testID="custos-vazio" style={{ alignItems: "center", paddingVertical: 28, gap: 6 }}>
          <View style={s.okCirculo}><Text style={{ color: Colors.green, fontSize: 22, fontWeight: "800" }}>✓</Text></View>
          <Text style={[ui.h3, { textAlign: "center" }]}>Tudo com custo por aqui</Text>
          <Text style={[ui.nota, { textAlign: "center" }]}>
            {(contagens && contagens.produtos
              ? (contagens.produtos === 1 ? "O produto da " + nomeDaLoja + " tem" : "Os " + plural(contagens.produtos, "produto", "produtos") + " da " + nomeDaLoja + " têm")
              : "Os produtos da " + nomeDaLoja + " têm")
              + " custo cadastrado. A conta do que falta e do que sobra sai completa."}
          </Text>
        </Cartao>
        <UltimosPreenchimentos companyId={companyId} versao={versaoHist} onCustosMudaram={function () { carregar(0); }} />
      </ScrollView>
    );
  }

  var chips: Array<{ f: FiltroDosSemCusto; rotulo: string; n: number | null }> = [
    { f: "todos", rotulo: "Todos", n: contagens ? contagens.todos : null },
  ];
  if (countId) chips.push({ f: "conferencia", rotulo: "Desta conferência", n: contagens ? contagens.desta_conferencia : null });
  if (contagens && contagens.sem_preco > 0) chips.push({ f: "sem_preco", rotulo: "Sem preço de venda", n: contagens.sem_preco });

  var pctValido = lerPercentual(pctTxt, modo) !== null;

  return (
    <View style={{ flex: 1 }} testID="custos-tela">
      <ScrollView style={ui.tela} contentContainerStyle={[ui.conteudo, { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled">
        {cabecalho}
        {avisoResultado}

        {/* Filtros e busca */}
        <View style={s.barraFiltros}>
          {chips.map(function (ch) {
            var on = filtro === ch.f;
            return (
              <Pressable key={ch.f} onPress={function () { setFiltro(ch.f); }} style={[s.filtro, on && s.filtroOn]}
                accessibilityRole="tab" accessibilityState={{ selected: on }} testID={"custos-filtro-" + ch.f}>
                <Text style={[s.filtroTxt, on && { color: "#fff" }]}>{ch.rotulo + (ch.n != null ? " " + ch.n.toLocaleString("pt-BR") : "")}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.barraFiltros}>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar produto"
            placeholderTextColor={Colors.ink3}
            style={[s.busca, { flexBasis: estreita ? "100%" : 220 }]}
            accessibilityLabel="Buscar produto"
            testID="custos-busca"
          />
          <Botao tipo="secundario" pequeno rotulo="Marcar todos" onPress={function () { marcarTodos(true); }} testID="custos-marcar-todos" />
          <Botao tipo="secundario" pequeno rotulo="Desmarcar" onPress={function () { marcarTodos(false); }} testID="custos-desmarcar" />
          <Pressable onPress={function () { setAtalhoAberto(!atalhoAberto); }} style={[ui.btn, ui.btnSec, ui.btnPequeno]}
            accessibilityRole="button" accessibilityState={{ expanded: atalhoAberto }} testID="custos-atalhos">
            <Text style={ui.btnSecTxt}>{atalhoAberto ? "Fechar atalhos" : "Atalhos (opcional)"}</Text>
          </Pressable>
        </View>

        {/* C: atalhos (só sugerem) */}
        {atalhoAberto ? (
          <Cartao testID="custos-painel-atalhos" style={{ gap: 10, borderColor: Colors.border2 }}>
            <Text style={s.tituloAtalho}>Sugerir pelo preço de venda</Text>
            <View style={s.linhaAtalho}>
              <View style={s.seg} accessibilityRole="radiogroup">
                {(["markup", "margem"] as ModoDoAtalho[]).map(function (m) {
                  var on = modo === m;
                  return (
                    <Pressable key={m} onPress={function () { trocarModo(m); }} style={[s.segBtn, on && s.segOn]}
                      accessibilityRole="radio" accessibilityState={{ checked: on }} testID={"custos-modo-" + m}>
                      <Text style={[s.segTxt, on && { color: "#fff" }]}>{m === "markup" ? "Markup" : "Margem"}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[s.campo, s.pct, { borderColor: pctValido ? Colors.border2 : Colors.amber }]}>
                <TextInput value={pctTxt} onChangeText={setPctTxt} keyboardType="decimal-pad" inputMode="decimal"
                  style={[s.campoInput, { textAlign: "right" }]} accessibilityLabel="Percentual" testID="custos-pct" />
                <Text style={s.campoRS}>%</Text>
              </View>
            </View>
            <View style={s.conta}><Text style={ui.nota} testID="custos-exemplo">{exemploDoAtalho(modo, pctTxt)}</Text></View>
            <Text style={ui.nota} testID="custos-alvo">
              {"Vai sugerir o custo para " + plural(c.alvoDaSugestao, "produto marcado", "produtos marcados") + "."
                + (c.semPreco > 0 ? " " + plural(c.semPreco, "sem preço de venda fica", "sem preço de venda ficam") + " para você digitar." : "")
                + (c.digitadas > 0 && !trocarDigitados ? " " + (c.digitadas === 1 ? "1 que você digitou fica como está." : plural(c.digitadas, "que você digitou fica", "que você digitou ficam") + " como estão.") : "")}
            </Text>
            {c.digitadas > 0 ? (
              <Pressable onPress={function () { setTrocarDigitados(!trocarDigitados); }} style={s.trocar}
                accessibilityRole="checkbox" accessibilityState={{ checked: trocarDigitados }} testID="custos-trocar-digitados">
                <View style={[s.caixa, trocarDigitados && s.caixaOn]}>{trocarDigitados ? <Text style={s.caixaCheck}>✓</Text> : null}</View>
                <Text style={[ui.nota, { color: Colors.ink }]}>Trocar também o que eu digitei</Text>
              </Pressable>
            ) : null}
            <View style={s.linhaAtalho}>
              <Botao rotulo="Sugerir custos" onPress={sugerir} testID="custos-sugerir" />
              <Text style={[ui.nota, { flex: 1, minWidth: 160 }]}>Só preenche os campos. Você confere linha a linha antes de gravar.</Text>
            </View>
            <View style={s.sep} />
            <Text style={s.tituloAtalho}>Mesmo custo para os marcados</Text>
            <View style={s.linhaAtalho}>
              <View style={[s.campo, { width: 150, borderColor: Colors.border2 }]}>
                <Text style={s.campoRS}>R$</Text>
                <TextInput value={mesmoTxt} onChangeText={setMesmoTxt} placeholder="0,00" placeholderTextColor={Colors.ink3}
                  keyboardType="decimal-pad" inputMode="decimal" style={s.campoInput} accessibilityLabel="Mesmo custo" testID="custos-mesmo" />
              </View>
              <Botao tipo="secundario" rotulo={"Usar nos " + c.marcadas.toLocaleString("pt-BR") + " marcados"} onPress={usarMesmo} testID="custos-usar-mesmo" />
            </View>
          </Cartao>
        ) : null}

        {avisoAtalho ? <Aviso tipo="info" testID="custos-aviso-atalho">{avisoAtalho}</Aviso> : null}

        {/* G4 */}
        {erroGravar ? (
          <Aviso tipo="erro" testID="custos-erro-gravar">
            <Text style={[ui.avisoTxt, { fontWeight: "700" }]}>Não deu para gravar agora.</Text>
            <Text style={[ui.nota, { marginTop: 4, color: Colors.ink }]}>
              {(erroGravar.talvezGravou ? "O que você digitou continua aqui. " : "Nenhum custo foi alterado e o que você digitou continua aqui. ") + erroGravar.msg}
            </Text>
            <View style={{ marginTop: 10, flexDirection: "row" }}>
              <Botao pequeno rotulo="Tentar de novo" onPress={gravar} ocupado={gravando} testID="custos-tentar-gravar" />
            </View>
          </Aviso>
        ) : null}

        {/* Lista */}
        {carregando ? (
          <View style={{ padding: 24, alignItems: "center" }} testID="custos-carregando">
            <ActivityIndicator color={Colors.violet3} />
          </View>
        ) : erroLista ? (
          <Cartao testID="custos-erro-lista" style={{ gap: 8 }}>
            <Text style={ui.h3}>Não conseguimos carregar os produtos sem custo</Text>
            <Text style={ui.nota}>{"Pode ser a conexão. Nada foi alterado. " + erroLista}</Text>
            <View style={{ flexDirection: "row" }}>
              <Botao tipo="secundario" pequeno rotulo="Tentar de novo" onPress={function () { carregar(0); }} testID="custos-tentar-lista" />
            </View>
          </Cartao>
        ) : visiveis.length === 0 ? (
          <Aviso tipo="info" testID="custos-filtro-vazio">
            {buscaAplicada
              ? "Nenhum produto sem custo com “" + buscaAplicada + "”."
              : filtro === "conferencia"
                ? "Os itens com diferença desta conferência já têm custo. Toque em “Todos” para ver os outros produtos da loja."
                : "Nenhum produto sem preço de venda está sem custo."}
          </Aviso>
        ) : (
          <View style={s.lista} testID="custos-lista">
            {visiveis.map(function (l) {
              return <Linha key={l.produto.product_id} linha={l} estreita={estreita} onMarcar={onMarcar} onDigitar={onDigitar} />;
            })}
            {ordem.length < total ? (
              <View style={s.mais}>
                <Text style={ui.nota}>{"Mostrando " + ordem.length.toLocaleString("pt-BR") + " de " + total.toLocaleString("pt-BR") + ". Os atalhos valem para os que estão na tela."}</Text>
                <Botao tipo="secundario" pequeno rotulo={"Mostrar mais " + Math.min(POR_PAGINA, total - ordem.length)}
                  onPress={function () { carregar(ordem.length); }} ocupado={carregandoMais} testID="custos-mais" />
              </View>
            ) : null}
          </View>
        )}

        <UltimosPreenchimentos companyId={companyId} versao={versaoHist} onCustosMudaram={function () { carregar(0); }} />
      </ScrollView>

      {/* Barra: revisar e gravar */}
      <View style={s.barra} testID="custos-barra">
        <Text style={[ui.nota, { flex: 1, minWidth: 140, color: Colors.ink }]} testID="custos-barra-texto">
          <Text style={{ fontWeight: "800" }}>{prontas.toLocaleString("pt-BR")}</Text>
          {" de " + (contagens ? contagens.todos : total).toLocaleString("pt-BR") + " com custo para gravar"}
        </Text>
        <Botao rotulo={"Revisar e gravar" + (prontas ? " (" + prontas.toLocaleString("pt-BR") + ")" : "")}
          onPress={function () { setErroGravar(null); setConfirmar(true); }} desabilitado={prontas === 0} ocupado={gravando} testID="custos-revisar" />
      </View>

      {/* D: confirmação */}
      <WebPortal active={confirmar}>
        <ConfirmDialog
          visible={confirmar}
          title="Gravar os custos?"
          message={mensagemDaConfirmacao(todas, contagens ? contagens.todos : total)}
          confirmLabel="Gravar custos"
          cancelLabel="Voltar e conferir"
          destructive={false}
          onConfirm={gravar}
          onCancel={function () { setConfirmar(false); }}
        />
      </WebPortal>
    </View>
  );
}

var s = StyleSheet.create({
  barraFiltros: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  filtro: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4,
  },
  filtroOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  filtroTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink3 },
  busca: {
    flexGrow: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12,
    paddingHorizontal: 12, fontSize: 15, color: Colors.ink, backgroundColor: Colors.bg2,
  },
  lista: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: "hidden" },
  linha: { flexDirection: "row", alignItems: "flex-start", borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 8, paddingRight: 12 },
  linhaCorpo: { flex: 1, minWidth: 0 },
  linhaTopo: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  nome: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginTop: 4 },
  caixaToque: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  caixa: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.ink3,
    alignItems: "center", justifyContent: "center",
  },
  caixaOn: { borderColor: Colors.violet, backgroundColor: Colors.violet },
  caixaCheck: { color: "#fff", fontSize: 13, fontWeight: "800", lineHeight: 15 },
  campoCol: { width: 190, gap: 4 },
  campoColEstreita: { width: "100%", marginTop: 8 },
  campo: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 12, backgroundColor: Colors.bg2,
  },
  campoRS: { fontSize: 14, fontWeight: "700", color: Colors.ink3 },
  campoInput: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: "700", color: Colors.ink, paddingVertical: 8 },
  etiqueta: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  chip: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.violetD },
  chipTxt: { fontSize: 11.5, fontWeight: "700", color: Colors.violet3 },
  tituloAtalho: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  linhaAtalho: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  seg: { flexDirection: "row", borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, overflow: "hidden" },
  segBtn: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", backgroundColor: Colors.bg4 },
  segOn: { backgroundColor: Colors.violet },
  segTxt: { fontSize: 14, fontWeight: "700", color: Colors.ink3 },
  pct: { width: 110 },
  conta: { backgroundColor: Colors.bg4, borderRadius: 10, padding: 10 },
  trocar: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  sep: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  mais: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 12, gap: 8, alignItems: "flex-start" },
  okCirculo: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center",
  },
  barra: {
    position: "absolute" as any, left: 0, right: 0, bottom: 0,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.bg3,
    borderTopWidth: 1, borderTopColor: Colors.border2,
  },
});

export default PreencherCustosScreen;
