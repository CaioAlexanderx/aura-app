// ============================================================================
// AURA. — Promoção em lote (De/Por) · assistente "Criar promoção" (p-86)
//
// Mockup aprovado pelo Caio (08/11/2026): https://claude.ai/artifact/UHRfmosodr9VCqHUt11Yhf
// DNA do TrocaModal (CLAUDE.md, armadilha 5), no formato do AjustarPrecoModal:
// painel, cabeçalho, barra de passos, corpo com rolagem, rodapé com a frase
// de situação à esquerda e as ações à direita.
//   1 Quais produtos   — tudo com estoque, por categoria ou um a um.
//   2 Quanto e quando  — % / R$ / preço único, terminação, prazo (agendar).
//   3 Conferir         — prévia do servidor (nada gravado): De → Por, quem
//                        já está em promoção (a nova substitui), quem fica de
//                        fora por estar abaixo do custo (sai sozinho).
//   4 Pronto.
// Acima de 2.000 itens o serviço divide em lotes (promocoesApi.emLotes).
// Sem hover: tudo visível, alvos de 44 px; a 375 px a lista vira linhas
// com o nome em cima e os preços embaixo.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, Platform, useWindowDimensions,
} from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { DateInput, formatIsoToBr, parseBrDate } from "@/components/inputs/DateInput";
import { Aviso } from "@/components/screens/estoque/reajuste/Aviso";
import { exemploTerminacao } from "@/components/screens/estoque/reajuste/reajusteRegras";
import { hojeBrt } from "@/components/screens/configuracoes/assentoTemporada";
import { useProducts } from "@/hooks/useProducts";
import { ApiError } from "@/services/api";
import {
  promocoesApi, type ModoPromocao, type RespostaPromocao, type TerminacaoPromocao, type PedidoPromocao,
} from "@/services/promocoesApi";
import {
  ATALHOS_PCT, MODOS_PROMOCAO, TERMINACOES_PROMOCAO, VALOR_INICIAL_PROMO, alvosQueEntram, brl, chaveDoItem, nomeDoItemPromo,
  descontoMedio, erroDasDatas, erroDoValorPromo, instantesDoPrazo, itensQueEntram, montarPedidoPromo, pctTxt,
  plural, prazosDisponiveis, promocaoVigenteOuAgendada, rotuloDoValorPromo, textoDeFora, textoDoPrazo, textoDoPronto,
  type ChavePrazo,
} from "./regrasDePor";

var IS_WEB = Platform.OS === "web";

type Base = "estoque" | "categoria" | "um";
type Passo = 1 | 2 | 3 | 4;
var PASSOS: Array<[number, string]> = [[1, "Quais produtos"], [2, "Quanto e até quando"], [3, "Conferir"]];
var LIMITE_LISTA = 60;

type Props = {
  companyId: string;
  onFechar: () => void;
  /** Gravou: a seção recarrega as listas. */
  onAplicada?: () => void;
  /** "Repetir promoção": já abre no "um a um" com estes produtos marcados. */
  preSelecionados?: string[];
};

export function mensagemErroPromo(e: any): string {
  if (e instanceof ApiError && e.status === 403) return "Seu acesso é só de consulta. Peça a quem cuida da loja para ligar a promoção.";
  var codigo = e && e.data && e.data.code;
  if (codigo === "MIGRATION_PENDING" || (e instanceof ApiError && e.status === 503)) return "Esta função ainda está sendo ligada na sua conta. Tente de novo daqui a pouco.";
  if (codigo === "INVALID_DATES") return "Confira as datas: o fim precisa ser depois do começo e ainda não ter passado.";
  if (codigo === "TOO_MANY_TARGETS") return "São produtos demais de uma vez. Tente com menos produtos.";
  if (e && e.isNetworkError) return "Sem conexão agora. Confira a internet e tente de novo.";
  return (e && e.message) || "Não conseguimos fazer isso agora. Tente de novo em instantes.";
}

export function CriarPromocaoModal({ companyId, onFechar, onAplicada, preSelecionados }: Props) {
  var largura = useWindowDimensions().width;
  var estreito = largura < 640;
  var hoje = hojeBrt();
  var { products, isLoading } = useProducts() as any;
  var produtos: any[] = products || [];

  var [passo, setPasso] = useState<Passo>(1);
  var [baseSel, setBaseSel] = useState<Base>(preSelecionados && preSelecionados.length ? "um" : "estoque");
  var [cats, setCats] = useState<Record<string, boolean>>({});
  var [marcados, setMarcados] = useState<Record<string, boolean>>(function () {
    var m: Record<string, boolean> = {};
    (preSelecionados || []).forEach(function (id) { m[id] = true; });
    return m;
  });
  var [busca, setBusca] = useState("");
  var [deixarDeFora, setDeixarDeFora] = useState(true);

  var [modo, setModoState] = useState<ModoPromocao>("percent");
  var [valorTxt, setValorTxt] = useState(VALOR_INICIAL_PROMO.percent);
  var [terminacao, setTerminacao] = useState<TerminacaoPromocao>("90");
  var prazos = useMemo(function () { return prazosDisponiveis(hoje); }, [hoje]);
  var [prazo, setPrazo] = useState<ChavePrazo>(prazos[0] ? prazos[0].chave : "datas");
  var [iniTxt, setIniTxt] = useState(formatIsoToBr(hoje));
  var [fimTxt, setFimTxt] = useState(formatIsoToBr(prazos[0] ? prazos[0].fim : hoje));

  var [carregando, setCarregando] = useState(false);
  var [erro, setErro] = useState<string | null>(null);
  var [previa, setPrevia] = useState<RespostaPromocao | null>(null);
  var [pedido, setPedido] = useState<PedidoPromocao | null>(null);
  var [tirados, setTirados] = useState<Record<string, true>>({});
  var [verTodos, setVerTodos] = useState(false);
  var [aplicando, setAplicando] = useState(false);
  var [resultado, setResultado] = useState<RespostaPromocao | null>(null);
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  // ── passo 1 ────────────────────────────────────────────────
  var elegiveis = useMemo(function () {
    return produtos.filter(function (p) { return !(deixarDeFora && promocaoVigenteOuAgendada(p)); });
  }, [produtos, deixarDeFora]);
  var comEstoque = useMemo(function () { return elegiveis.filter(function (p) { return Number(p.stock) > 0; }); }, [elegiveis]);
  var categorias = useMemo(function () {
    var c: Record<string, number> = {};
    comEstoque.forEach(function (p) { var k = p.category || "Produtos"; c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).sort().map(function (k) { return { nome: k, n: c[k] }; });
  }, [comEstoque]);

  var selecionados: string[] = useMemo(function () {
    if (baseSel === "estoque") return comEstoque.map(function (p) { return p.id; });
    if (baseSel === "categoria") return comEstoque.filter(function (p) { return cats[p.category || "Produtos"]; }).map(function (p) { return p.id; });
    return elegiveis.filter(function (p) { return marcados[p.id]; }).map(function (p) { return p.id; });
  }, [baseSel, comEstoque, elegiveis, cats, marcados]);

  var encontrados = useMemo(function () {
    var q = busca.trim().toLowerCase();
    var lista = !q ? elegiveis : elegiveis.filter(function (p) {
      return String(p.name || "").toLowerCase().indexOf(q) >= 0 || String(p.code || "").toLowerCase().indexOf(q) >= 0 || String(p.barcode || "").indexOf(q) >= 0;
    });
    return lista.slice(0, 50);
  }, [busca, elegiveis]);

  // ── passo 2 ────────────────────────────────────────────────
  var erroValor = erroDoValorPromo(modo, valorTxt);
  var prazoEscolhido = prazos.find(function (p) { return p.chave === prazo; });
  var ini = prazo === "datas" ? parseBrDate(iniTxt) : prazoEscolhido ? prazoEscolhido.ini : null;
  var fim = prazo === "datas" ? parseBrDate(fimTxt) : prazoEscolhido ? prazoEscolhido.fim : null;
  var erroDatas = erroDasDatas(ini, fim, hoje);
  var podeVer = !erroValor && !erroDatas && selecionados.length > 0 && !carregando;

  function setModo(m: ModoPromocao) {
    if (m === modo) return;
    setModoState(m);
    setValorTxt(VALOR_INICIAL_PROMO[m]);
    setErro(null);
  }

  function verComoFica() {
    if (!podeVer || !ini || !fim) return;
    setCarregando(true);
    setErro(null);
    var novo = montarPedidoPromo(
      selecionados.map(function (id) { return { product_id: id }; }), modo, valorTxt, terminacao, instantesDoPrazo(ini, fim, hoje),
    );
    promocoesApi.previa(companyId, novo)
      .then(function (r) {
        if (!vivo.current) return;
        setPrevia(r);
        setPedido(novo);
        setTirados({});
        setVerTodos(false);
        setPasso(3);
      })
      .catch(function (e) { if (vivo.current) setErro(mensagemErroPromo(e)); })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }

  // ── passo 3 ────────────────────────────────────────────────
  var entram = previa ? itensQueEntram(previa, tirados) : [];
  var jaEmPromo = entram.filter(function (i) { return i.ja_em_promocao; }).length;
  var agendada = !!ini && ini > hoje;

  function aplicar() {
    if (!pedido || !ini || !fim || aplicando || entram.length === 0) return;
    setAplicando(true);
    setErro(null);
    // O que vai é exatamente o que a pessoa conferiu (item a item, variante
    // inclusa), com o instante de agora recalculado se começa hoje.
    var instantes = instantesDoPrazo(ini, fim, hoje);
    var final: PedidoPromocao = { ...pedido, starts_at: instantes.starts_at, ends_at: instantes.ends_at, targets: alvosQueEntram(entram) };
    promocoesApi.aplicar(companyId, final)
      .then(function (r) {
        if (!vivo.current) return;
        setResultado(r);
        setPasso(4);
        if (onAplicada) onAplicada();
      })
      .catch(function (e) { if (vivo.current) setErro(mensagemErroPromo(e)); })
      .finally(function () { if (vivo.current) setAplicando(false); });
  }

  var ocupado = carregando || aplicando;
  var fechar = ocupado ? undefined : onFechar;

  var panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  var sub = passo === 1 ? "Escolha quais produtos entram. Você confere tudo antes de ligar."
    : passo === 2 ? "Quanto de desconto e até quando vale."
      : passo === 3 ? "Confira como fica. Nada foi gravado ainda."
        : agendada ? "Promoção agendada." : "Promoção no ar.";

  var rodape = passo === 1 ? plural(selecionados.length, "produto", "produtos")
    : passo === 2 ? plural(selecionados.length, "produto", "produtos")
      : passo === 3 ? (aplicando ? "Gravando a promoção…" : plural(entram.length, "item entra", "itens entram"))
        : "";

  var mostrados = verTodos ? (previa ? previa.items : []) : (previa ? previa.items.slice(0, LIMITE_LISTA) : []);

  return (
    <View style={[s.overlay, estreito && { padding: 10 }]} testID="promo-modal">
      <Pressable style={s.backdrop} onPress={fechar} accessibilityLabel="Fechar" />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} accessibilityViewIsModal accessibilityLabel="Criar promoção">

        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIco}><Icon name="tag" size={16} color="#a78bfa" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>Criar promoção</Text>
              <Text style={s.headerSub}>{sub}</Text>
            </View>
          </View>
          <Pressable onPress={fechar} style={s.closeBtn} testID="promo-x" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {passo < 4 && (
          <View style={s.stepBar} accessibilityLabel={"Passo " + passo + " de 3"}>
            {PASSOS.map(function (pp, idx) {
              var n = pp[0];
              var ativo = n === passo;
              var feito = n < passo;
              return (
                <View key={n} style={s.stepItem} testID={"promo-passo-" + n}>
                  <View style={[s.stepDot, feito && s.stepDotDone, ativo && s.stepDotActive]}>
                    {feito ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  {(!estreito || ativo) && (
                    <Text style={[s.stepLabel, (ativo || feito) && { color: ativo ? "#a78bfa" : Colors.ink2, fontWeight: ativo ? "700" : "500" }]}>{pp[1]}</Text>
                  )}
                  {idx < PASSOS.length - 1 && <View style={[s.stepSep, estreito && { width: 14 }]} />}
                </View>
              );
            })}
          </View>
        )}

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {!!erro && <View style={{ marginBottom: 12 }}><Aviso tipo="erro" testID="promo-erro">{erro}</Aviso></View>}

          {passo === 1 && (
            <View style={{ gap: 12 }}>
              <Text style={s.q}>Quais produtos entram?</Text>
              {isLoading ? <ActivityIndicator color={Colors.violet} /> : (
                <View style={[s.opts, estreito && s.optsCel]} accessibilityRole="radiogroup">
                  {([
                    ["estoque", "Tudo que tem estoque", plural(comEstoque.length, "produto", "produtos"), "Produto sem estoque fica de fora."],
                    ["categoria", "Por categoria", plural(baseSel === "categoria" ? selecionados.length : 0, "produto", "produtos"), "Marque as categorias."],
                    ["um", "Escolher um a um", plural(elegiveis.filter(function (p) { return marcados[p.id]; }).length, "marcado", "marcados"), "Busque e marque."],
                  ] as Array<[Base, string, string, string]>).map(function (o) {
                    var on = baseSel === o[0];
                    return (
                      <Pressable key={o[0]} onPress={function () { setBaseSel(o[0]); }} style={[s.opt, estreito && s.optCel, on && s.optOn]}
                        accessibilityRole="radio" accessibilityState={{ checked: on }} testID={"promo-base-" + o[0]}>
                        <View style={s.optTopo}>
                          <Text style={[s.optTit, on && { color: Colors.violet3 }]}>{o[1]}</Text>
                          <Text style={s.optConta}>{o[2]}</Text>
                        </View>
                        <Text style={s.optTxt}>{o[3]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {baseSel === "categoria" && (
                <View style={s.chips} testID="promo-categorias">
                  {categorias.length === 0 && <Text style={s.t}>Nenhuma categoria com estoque.</Text>}
                  {categorias.map(function (c) {
                    var on = !!cats[c.nome];
                    return (
                      <Pressable key={c.nome} onPress={function () { var n = { ...cats }; n[c.nome] = !on; setCats(n); }}
                        style={[s.chip, on && s.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={"promo-cat-" + c.nome}>
                        <Text style={[s.chipTxt, on && { color: Colors.violet3 }]}>{c.nome} <Text style={s.t}>{c.n}</Text></Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {baseSel === "um" && (
                <View style={{ gap: 8 }}>
                  <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar produto ou código" placeholderTextColor={Colors.ink3}
                    style={s.busca} testID="promo-busca" />
                  <View style={s.lista}>
                    {encontrados.length === 0 && <Text style={[s.t, { padding: 12 }]}>Nenhum produto encontrado.</Text>}
                    {encontrados.map(function (p) {
                      var on = !!marcados[p.id];
                      return (
                        <Pressable key={p.id} onPress={function () { var n = { ...marcados }; n[p.id] = !on; setMarcados(n); }}
                          style={s.linhaSel} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={"promo-marcar-" + p.id}>
                          <View style={[s.caixa, on && s.caixaOn]}>{on && <Icon name="check" size={12} color="#fff" />}</View>
                          <Text style={s.linhaNome} numberOfLines={2}>{p.name}</Text>
                          <Text style={s.t}>{brl(p.price)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <Pressable onPress={function () { setDeixarDeFora(!deixarDeFora); }} style={s.linhaCheck}
                accessibilityRole="checkbox" accessibilityState={{ checked: deixarDeFora }} testID="promo-deixar-de-fora">
                <View style={[s.caixa, deixarDeFora && s.caixaOn]}>{deixarDeFora && <Icon name="check" size={12} color="#fff" />}</View>
                <Text style={s.t}>Deixar de fora o que já está em promoção</Text>
              </Pressable>
            </View>
          )}

          {passo === 2 && (
            <View style={{ gap: 14 }}>
              <Text style={s.q}>Como fica o preço?</Text>
              <View style={[s.opts, estreito && s.optsCel]} accessibilityRole="radiogroup">
                {MODOS_PROMOCAO.map(function (m) {
                  var on = modo === m.modo;
                  return (
                    <Pressable key={m.modo} onPress={function () { setModo(m.modo); }} style={[s.opt, s.opt3, estreito && s.optCel, on && s.optOn]}
                      accessibilityRole="radio" accessibilityState={{ checked: on }} testID={"promo-modo-" + m.modo}>
                      <Text style={[s.optTit, on && { color: Colors.violet3 }]}>{m.titulo}</Text>
                      <Text style={s.optTxt}>{m.texto}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={s.campo}>
                <Text style={s.rot}>{rotuloDoValorPromo(modo)}</Text>
                <TextInput value={valorTxt} onChangeText={function (v) { setValorTxt(v); setErro(null); }} inputMode="decimal" keyboardType="decimal-pad"
                  style={[s.valor, !!erroValor && { borderColor: Colors.red }]} testID="promo-valor" accessibilityLabel={rotuloDoValorPromo(modo)} />
                {!!erroValor && <Text style={s.erroCampo} testID="promo-erro-valor">{erroValor}</Text>}
                {modo === "percent" && (
                  <View style={s.chips}>
                    {ATALHOS_PCT.map(function (v) {
                      var on = valorTxt === String(v);
                      return (
                        <Pressable key={v} onPress={function () { setValorTxt(String(v)); }} style={[s.chip, on && s.chipOn]} testID={"promo-pct-" + v}>
                          <Text style={[s.chipTxt, on && { color: Colors.violet3 }]}>{v}%</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {modo !== "preco" && (
                <View style={s.campo}>
                  <Text style={s.rot}>Terminar em</Text>
                  <View style={s.seg}>
                    {TERMINACOES_PROMOCAO.map(function (t) {
                      var on = terminacao === t.valor;
                      return (
                        <Pressable key={t.valor} onPress={function () { setTerminacao(t.valor); }} style={[s.segBtn, on && s.segOn]} testID={"promo-term-" + t.valor}>
                          <Text style={[s.segTxt, on && { color: "#fff" }]}>{t.rotulo}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {!!exemploTerminacao(terminacao) && <Text style={s.t}>{exemploTerminacao(terminacao)}</Text>}
                </View>
              )}

              <Text style={[s.q, { marginTop: 4 }]}>Até quando vale?</Text>
              <View style={[s.opts, estreito && s.optsCel]} accessibilityRole="radiogroup">
                {prazos.map(function (p) {
                  var on = prazo === p.chave;
                  return (
                    <Pressable key={p.chave} onPress={function () { setPrazo(p.chave); }} style={[s.opt, estreito && s.optCel, on && s.optOn]}
                      accessibilityRole="radio" accessibilityState={{ checked: on }} testID={"promo-prazo-" + p.chave}>
                      <View style={s.optTopo}>
                        <Text style={[s.optTit, on && { color: Colors.violet3 }]}>{p.titulo}</Text>
                        <Text style={s.optConta}>{p.detalhe}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable onPress={function () { setPrazo("datas"); }} style={[s.opt, estreito && s.optCel, prazo === "datas" && s.optOn]}
                  accessibilityRole="radio" accessibilityState={{ checked: prazo === "datas" }} testID="promo-prazo-datas">
                  <View style={s.optTopo}>
                    <Text style={[s.optTit, prazo === "datas" && { color: Colors.violet3 }]}>Escolher as datas</Text>
                    <Text style={s.optConta}>começo e fim</Text>
                  </View>
                </Pressable>
              </View>
              {prazo === "datas" && (
                <View style={s.datas}>
                  <View style={{ gap: 4 }}>
                    <Text style={s.rot}>Começa</Text>
                    <DateInput value={iniTxt} onChangeText={setIniTxt} testID="promo-ini" style={s.data} />
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text style={s.rot}>Termina</Text>
                    <DateInput value={fimTxt} onChangeText={setFimTxt} testID="promo-fim" style={s.data} />
                  </View>
                </View>
              )}
              {erroDatas
                ? <Aviso tipo="aviso" testID="promo-erro-datas">{erroDatas}</Aviso>
                : <Aviso tipo="info" testID="promo-prazo-texto">{textoDoPrazo(ini!, fim!, hoje)}</Aviso>}
            </View>
          )}

          {passo === 3 && previa && (
            <View style={{ gap: 12 }}>
              <View style={s.res}>
                <View style={s.resBox}><Text style={s.resN} testID="promo-entram">{entram.length.toLocaleString("pt-BR")}</Text><Text style={s.t}>{entram.length === 1 ? "item entra" : "itens entram"}</Text></View>
                <View style={s.resBox}><Text style={s.resN}>{pctTxt(descontoMedio(entram))}</Text><Text style={s.t}>desconto médio</Text></View>
                <View style={s.resBox}><Text style={s.resN} testID="promo-fora-n">{previa.fora.length.toLocaleString("pt-BR")}</Text><Text style={s.t}>ficam de fora</Text></View>
              </View>
              <Aviso tipo="ok" testID="promo-prazo-conferir">{textoDoPrazo(ini!, fim!, hoje)}</Aviso>
              {jaEmPromo > 0 && (
                <Aviso tipo="aviso" testID="promo-ja-em-promocao">
                  {plural(jaEmPromo, "item já está", "itens já estão")} em promoção. A promoção nova substitui a de agora: fica valendo só uma por produto.
                </Aviso>
              )}
              {!!textoDeFora(previa.fora) && (
                <Aviso tipo="erro" testID="promo-fora">{textoDeFora(previa.fora)} Eles continuam com o preço normal.</Aviso>
              )}
              <View style={s.lista} testID="promo-previa-lista">
                <View style={[s.linhaPrevia, s.cab]}>
                  <Text style={[s.th, { flex: 1 }]}>Produto</Text>
                  <Text style={s.th}>De → Por</Text>
                </View>
                {mostrados.map(function (i) {
                  var k = chaveDoItem(i);
                  var fora = !!tirados[i.product_id];
                  return (
                    <View key={k} style={[s.linhaPrevia, estreito && s.linhaPreviaCel, fora && { opacity: 0.5 }]} testID={"promo-item-" + k}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.linhaNome} numberOfLines={2}>{nomeDoItemPromo(i)}</Text>
                        {i.ja_em_promocao && <Text style={s.tag}>já em promoção</Text>}
                      </View>
                      <View style={s.precos}>
                        <Text style={s.de}>{brl(i.preco_de)}</Text>
                        <Text style={s.por}>{fora ? "fica de fora" : brl(i.preco_por)}</Text>
                        <Pressable
                          onPress={function () { var n = { ...tirados }; if (fora) delete n[i.product_id]; else n[i.product_id] = true; setTirados(n); }}
                          style={s.tirar} accessibilityRole="button" accessibilityLabel={fora ? "Voltar para a promoção" : "Tirar da promoção"}
                          testID={"promo-tirar-" + k}>
                          {fora ? <Text style={s.tirarTxt}>Incluir</Text> : <Icon name="x" size={14} color={Colors.ink3} />}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
              {previa.items.length > mostrados.length && (
                <Pressable onPress={function () { setVerTodos(true); }} style={s.link} testID="promo-ver-todos">
                  <Text style={s.linkTxt}>Ver todos os {previa.items.length.toLocaleString("pt-BR")}</Text>
                </Pressable>
              )}
            </View>
          )}

          {passo === 4 && resultado && (
            <View style={s.fim} testID="promo-pronto">
              <View style={s.ok}><Icon name="check" size={22} color={Colors.green} /></View>
              <Text style={s.fimTit}>{agendada ? "Promoção agendada" : "Promoção no ar"}</Text>
              <Text style={[s.t, { textAlign: "center" }]}>
                {textoDoPronto(resultado.items.length, agendada)} {textoDoPrazo(ini!, fim!, hoje)}
              </Text>
              {!!textoDeFora(resultado.fora) && <Aviso tipo="aviso">{textoDeFora(resultado.fora)}</Aviso>}
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.footerInfo} numberOfLines={2} testID="promo-rodape">{rodape}</Text>
          <View style={s.footerActions}>
            {passo === 1 && (
              <>
                <Pressable style={s.btnSec} onPress={onFechar} testID="promo-cancelar" accessibilityRole="button"><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
                <Pressable style={[s.btnPri, selecionados.length === 0 && { opacity: 0.45 }]} disabled={selecionados.length === 0}
                  onPress={function () { setPasso(2); }} testID="promo-continuar" accessibilityRole="button" accessibilityState={{ disabled: selecionados.length === 0 }}>
                  <Text style={s.btnPriTxt}>Continuar</Text>
                </Pressable>
              </>
            )}
            {passo === 2 && (
              <>
                <Pressable style={s.btnSec} onPress={carregando ? undefined : function () { setPasso(1); setErro(null); }} testID="promo-voltar-1" accessibilityRole="button">
                  <Icon name="arrow_left" size={14} color={Colors.ink} /><Text style={s.btnSecTxt}>Voltar</Text>
                </Pressable>
                <Pressable style={[s.btnPri, !podeVer && { opacity: 0.45 }]} disabled={!podeVer} onPress={verComoFica}
                  testID="promo-ver" accessibilityRole="button" accessibilityState={{ disabled: !podeVer, busy: carregando }}>
                  {carregando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>Ver como fica</Text>}
                </Pressable>
              </>
            )}
            {passo === 3 && (
              <>
                <Pressable style={s.btnSec} onPress={aplicando ? undefined : function () { setPasso(2); setErro(null); }} testID="promo-voltar-2" accessibilityRole="button">
                  <Icon name="arrow_left" size={14} color={Colors.ink} /><Text style={s.btnSecTxt}>Voltar</Text>
                </Pressable>
                <Pressable style={[s.btnConfirm, (entram.length === 0 || aplicando) && { opacity: 0.45 }]} disabled={entram.length === 0 || aplicando}
                  onPress={aplicar} testID="promo-aplicar" accessibilityRole="button" accessibilityState={{ disabled: entram.length === 0 || aplicando, busy: aplicando }}>
                  {aplicando ? <ActivityIndicator size="small" color="#fff" /> : (
                    <><Icon name="check" size={14} color="#fff" /><Text style={s.btnPriTxt}>{agendada ? "Agendar a promoção" : "Ligar a promoção"}</Text></>
                  )}
                </Pressable>
              </>
            )}
            {passo === 4 && (
              <Pressable style={s.btnPri} onPress={onFechar} testID="promo-fechar" accessibilityRole="button"><Text style={s.btnPriTxt}>Fechar</Text></Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 720, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, flexWrap: "wrap",
    backgroundColor: "rgba(0,0,0,0.18)", borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)", gap: 6,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500" },
  stepSep: { width: 24, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 4 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 18, paddingBottom: 12 },
  q: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  t: { fontSize: 12.5, color: Colors.ink3 },
  rot: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  opts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optsCel: { flexDirection: "column" },
  opt: {
    flexGrow: 1, flexBasis: 220, minHeight: 44, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: Colors.bg3, gap: 2,
  },
  opt3: { flexBasis: 180 },
  optCel: { flexBasis: "auto" as any },
  optOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  optTopo: { flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  optTit: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  optConta: { fontSize: 12.5, fontWeight: "600", color: Colors.violet3 },
  optTxt: { fontSize: 12.5, color: Colors.ink3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: Colors.border2, borderRadius: 99, paddingHorizontal: 12, backgroundColor: Colors.bg3 },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipTxt: { fontSize: 13, color: Colors.ink2 },
  busca: { minHeight: 44, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, color: Colors.ink, backgroundColor: Colors.bg3, fontSize: 14 },
  lista: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, overflow: "hidden", backgroundColor: Colors.bg3 },
  linhaSel: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  linhaCheck: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  caixa: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  caixaOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  linhaNome: { flex: 1, fontSize: 13.5, color: Colors.ink, minWidth: 0 },
  campo: { gap: 6 },
  valor: {
    width: 160, minHeight: 48, fontSize: 22, fontWeight: "700", textAlign: "center", color: Colors.ink,
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, backgroundColor: Colors.bg3,
  },
  erroCampo: { fontSize: 12.5, color: Colors.red },
  seg: { flexDirection: "row", alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, overflow: "hidden" },
  segBtn: { minHeight: 40, paddingHorizontal: 14, justifyContent: "center", borderRightWidth: 1, borderRightColor: Colors.border2 },
  segOn: { backgroundColor: Colors.violet },
  segTxt: { fontSize: 13, color: Colors.ink2 },
  datas: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  data: { width: 140 },
  res: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resBox: { flexGrow: 1, flexBasis: 100, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.bg3 },
  resN: { fontSize: 20, fontWeight: "700", color: Colors.ink },
  cab: { minHeight: 32 },
  th: { fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase", color: Colors.ink3, fontWeight: "600" },
  linhaPrevia: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 6, minHeight: 44,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  linhaPreviaCel: { flexDirection: "column", alignItems: "stretch", gap: 4 },
  precos: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  de: { fontSize: 12.5, color: Colors.ink3, textDecorationLine: "line-through" },
  por: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  tag: { alignSelf: "flex-start", fontSize: 11, color: Colors.amber, backgroundColor: Colors.amberD, borderRadius: 99, paddingHorizontal: 7, marginTop: 2, overflow: "hidden" },
  tirar: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  tirarTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "600" },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  linkTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  fim: { alignItems: "center", gap: 10, paddingVertical: 10 },
  ok: { width: 48, height: 48, borderRadius: 999, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  fimTit: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  footer: {
    paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)", backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
  },
  footerInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 120, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  btnPri: { backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 18, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnConfirm: { backgroundColor: "#10b981", minHeight: 44, paddingHorizontal: 18, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.border2, minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});

export default CriarPromocaoModal;
