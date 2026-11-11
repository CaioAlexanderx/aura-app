// ============================================================================
// AURA. — Estoque · Transferir para outra loja (10/11/2026)
//
// Decisão do Caio (sem mockup; padrão visual dos modais do Estoque): lojas com
// mais de um CNPJ no grupo, cada uma com o seu estoque, mandam peças de uma
// loja para outra pela barra da seleção. Caso real: loja de moda com quase
// 10 mil variantes redistribuindo peças para uma loja nova.
//
// DNA do TrocaModal (CLAUDE.md, armadilha 5), no formato do AjustarPrecoModal:
// painel, cabeçalho com ícone + título + frase, barra de passos, corpo com
// rolagem, rodapé com a frase de situação à esquerda e as ações à direita.
//   1 Quantidades — loja de destino + quanto vai de cada item (vazio = nada).
//                   Produto com grade abre um campo por cor/tamanho.
//   2 Conferir    — N itens, X peças, de A para B; aviso de que o produto que
//                   não existe no destino é criado lá com os mesmos dados.
//
// Envio: POST /companies/:origem/estoque/transferencias, até 1.000 itens por
// chamada (MAX_ITENS_POR_LOTE); seleção maior vai em lotes, um depois do
// outro, com o progresso no rodapé. ESTOQUE_INSUFICIENTE volta ao passo 1
// com as linhas em vermelho e o disponível que o servidor mandou.
//
// Aura-backend#994: só variantes ativas aparecem (o backend recusa as
// inativas); produto com variante ativa só manda linhas por variante (sem
// variante ativa, vai pelo produto). GRADE_DIFERENTE, QUANTIDADE_INVALIDA
// (serviço) e ITEM_NAO_ENCONTRADO marcam as linhas citadas; com
// motivo 'informe_a_variante' a grade do produto abre. TENTE_DE_NOVO
// (deadlock) tenta 1 vez de novo com o mesmo corpo; SCHEMA_PENDENTE avisa.
//
// Renderizado pelo Estoque dentro de WebPortal (overlay dentro do shell do
// RNW fica preso no z-index do pai). Sem hover: tudo visível; alvos de 44 px;
// abaixo de 640 px cada linha empilha.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { companiesApi } from "@/services/api";
import { rotuloDaVariante } from "@/components/screens/estoque/VariantesConsulta";
import { estoqueTransferenciasApi, codigoDoErro, type PedidoTransferencia } from "@/services/estoqueTransferenciasApi";
import {
  MAX_ITENS_POR_LOTE, chaveDaLinha, dividirEmLotes, itensDoErro, itensSemEstoque, mensagemDoErro, plural,
  problemaDaLinha, temMotivo, textoDoTudo, textoDosNumeros, validar, type LinhaTransferencia,
} from "@/utils/transferenciaEstoque";
import { productMatchesSearch } from "@/utils/productSearch";
import { fmtQty } from "@/utils/matconUnits";

var IS_WEB = Platform.OS === "web";
var POR_PAGINA = 50;
var ABRIR_SOZINHO_ATE = 5; // até 5 produtos com grade, as variantes já abrem
var BUSCA_A_PARTIR_DE = 8;

export type ProdutoParaTransferir = {
  id: string;
  name: string;
  stock: number;
  unit?: string | null;
  has_variants?: boolean;
  sku?: string | null;
  code?: string | null;
  barcode?: string | null;
  category?: string | null;
};

export type LojaOpcao = { id: string; nome: string };

/** `ativa: false` = inativa (o backend recusa): fica fora do modal. */
export type VarianteDaOrigem = { id: string; rotulo: string; estoque: number; ativa?: boolean };

type Props = {
  origem: LojaOpcao;
  /** Outras lojas do grupo que o usuário acessa (sem a origem). */
  destinos: LojaOpcao[];
  produtos: ProdutoParaTransferir[];
  onFechar: () => void;
  /** Algum lote entrou: o Estoque recarrega a lista. */
  onEstoqueMudou?: () => void;
  /** Tudo enviado. */
  onConcluido?: (numeros: Array<string | number>, pecas: number, destino: LojaOpcao) => void;
  /** Injetável nos testes. Padrão: GET /companies/:origem/products/:id/variants. */
  buscarVariantes?: (productId: string) => Promise<VarianteDaOrigem[]>;
  /**
   * p-108 (conferência): quantidades já preenchidas, por chaveDaLinha
   * ("p:<produto>" ou "v:<produto>:<variante>"). O produto com grade que
   * tem variante preenchida abre sozinho. Sem a prop, nada muda.
   */
  quantidadesIniciais?: Record<string, string>;
  /** p-108: liga a transferência à conferência (vai como stock_count_id). */
  stockCountId?: string | null;
};

type EstadoGrade = { estado: "carregando" | "ok" | "erro"; linhas: LinhaTransferencia[]; inativas: number };

type Passo = 1 | 2;
var PASSOS: Array<[Passo, string]> = [[1, "Quantidades"], [2, "Conferir"]];

function unidadeDe(p: ProdutoParaTransferir): string {
  return String(p.unit || "un");
}

export function TransferirModal({ origem, destinos, produtos, onFechar, onEstoqueMudou, onConcluido, buscarVariantes, quantidadesIniciais, stockCountId }: Props) {
  var largura = useWindowDimensions().width;
  var estreito = largura < 640;
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  var buscar = buscarVariantes || function (productId: string) {
    return companiesApi.variants(origem.id, productId).then(function (r: any) {
      var lista: any[] = Array.isArray(r && r.variants) ? r.variants : [];
      return lista
        .filter(function (v) { return !!v; })
        .map(function (v) {
          return { id: String(v.id), rotulo: rotuloDaVariante(v), estoque: parseFloat(v.stock_qty) || 0, ativa: v.is_active !== false };
        });
    });
  };

  var [passo, setPasso] = useState<Passo>(1);
  var [destinoId, setDestinoId] = useState<string | null>(destinos.length === 1 ? destinos[0].id : null);
  var [quantidades, setQuantidades] = useState<Record<string, string>>(function () { return quantidadesIniciais ? { ...quantidadesIniciais } : {}; });
  var [grades, setGrades] = useState<Record<string, EstadoGrade>>({});
  var [abertos, setAbertos] = useState<Record<string, boolean>>({});
  var [busca, setBusca] = useState("");
  var [limite, setLimite] = useState(POR_PAGINA);
  var [tentou, setTentou] = useState(false);
  // ESTOQUE_INSUFICIENTE: `semEstoque` marca a linha até a pessoa mexer;
  // `dispServidor` guarda o disponível que o servidor mandou (vale depois).
  var [semEstoque, setSemEstoque] = useState<Record<string, number | null>>({});
  var [dispServidor, setDispServidor] = useState<Record<string, number>>({});
  var [observacao, setObservacao] = useState("");
  var [enviando, setEnviando] = useState<{ lote: number; de: number } | null>(null);
  var [erroEnvio, setErroEnvio] = useState<string | null>(null);
  var [jaEnviados, setJaEnviados] = useState<Array<string | number>>([]);
  // Produtos que não estão mais na lista (já foram num lote anterior).
  var [enviadas, setEnviadas] = useState<Record<string, boolean>>({});
  // Linhas que o backend recusou por outro motivo (grade diferente, serviço,
  // não encontrado): chave → texto. Some quando a pessoa mexe na linha.
  var [problemas, setProblemas] = useState<Record<string, string>>({});
  // ITEM_NAO_ENCONTRADO/informe_a_variante: o produto tem grade mesmo sem
  // has_variants na lista local; passa a ir por variante.
  var [forcarGrade, setForcarGrade] = useState<Record<string, boolean>>({});
  function emGrade(p: ProdutoParaTransferir): boolean { return !!p.has_variants || !!forcarGrade[p.id]; }

  var destino = destinos.find(function (d) { return d.id === destinoId; }) || null;

  var comGrade = useMemo(function () { return produtos.filter(function (p) { return !!p.has_variants; }); }, [produtos]);

  function carregarGrade(p: ProdutoParaTransferir): Promise<void> {
    setGrades(function (g) { return { ...g, [p.id]: { estado: "carregando", linhas: g[p.id] ? g[p.id].linhas : [], inativas: g[p.id] ? g[p.id].inativas : 0 } }; });
    return buscar(p.id)
      .then(function (todas) {
        if (!vivo.current) return;
        var vs = todas.filter(function (v) { return v.ativa !== false; });
        var inativas = todas.length - vs.length;
        var linhas: LinhaTransferencia[] = vs.map(function (v) {
          return {
            chave: chaveDaLinha(p.id, v.id), product_id: p.id, variant_id: v.id, nome: p.name,
            rotulo: v.rotulo, disponivel: v.estoque, unidade: unidadeDe(p),
          };
        });
        setGrades(function (g) { return { ...g, [p.id]: { estado: "ok", linhas: linhas, inativas: inativas } }; });
      })
      .catch(function () {
        if (!vivo.current) return;
        setGrades(function (g) { return { ...g, [p.id]: { estado: "erro", linhas: [], inativas: 0 } }; });
      });
  }

  function abrir(p: ProdutoParaTransferir) {
    var aberto = !!abertos[p.id];
    setAbertos(function (a) { return { ...a, [p.id]: !aberto }; });
    if (!aberto && (!grades[p.id] || grades[p.id].estado === "erro")) carregarGrade(p);
  }

  // Poucos produtos com grade: as variantes já abrem (é o caso comum).
  // Muitos produtos com grade e quantidades já preenchidas (conferência):
  // abrem só os que têm variante preenchida, 4 carregando por vez.
  useEffect(function () {
    if (comGrade.length === 0) return;
    if (comGrade.length <= ABRIR_SOZINHO_ATE) {
      var a: Record<string, boolean> = {};
      comGrade.forEach(function (p) { a[p.id] = true; carregarGrade(p); });
      setAbertos(a);
      return;
    }
    if (!quantidadesIniciais) return;
    var chaves = Object.keys(quantidadesIniciais);
    var preenchidos = comGrade.filter(function (p) {
      return chaves.some(function (k) { return k.indexOf("v:" + p.id + ":") === 0; });
    });
    if (preenchidos.length === 0) return;
    var ab: Record<string, boolean> = {};
    preenchidos.forEach(function (p) { ab[p.id] = true; });
    setAbertos(ab);
    var fila = preenchidos.slice();
    function proximo(): Promise<void> {
      var p = fila.shift();
      if (!p || !vivo.current) return Promise.resolve();
      return carregarGrade(p).then(proximo);
    }
    proximo(); proximo(); proximo(); proximo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  var [abrindoTodos, setAbrindoTodos] = useState(false);
  function abrirTodos() {
    if (abrindoTodos) return;
    var faltam = comGrade.filter(function (p) { return !grades[p.id] || grades[p.id].estado === "erro"; });
    var a: Record<string, boolean> = { ...abertos };
    comGrade.forEach(function (p) { a[p.id] = true; });
    setAbertos(a);
    if (faltam.length === 0) return;
    setAbrindoTodos(true);
    // 4 por vez: catálogo grande não dispara mil requisições juntas.
    var fila = faltam.slice();
    function proximo(): Promise<void> {
      var p = fila.shift();
      if (!p || !vivo.current) return Promise.resolve();
      return carregarGrade(p).then(proximo);
    }
    Promise.all([proximo(), proximo(), proximo(), proximo()]).finally(function () { if (vivo.current) setAbrindoTodos(false); });
  }

  function semVarianteAtiva(g: EstadoGrade | undefined): boolean {
    return !!g && g.estado === "ok" && g.linhas.length === 0;
  }

  // Todas as linhas que valem: produto simples + variantes carregadas.
  var linhas = useMemo(function () {
    var out: LinhaTransferencia[] = [];
    produtos.forEach(function (p) {
      var g = grades[p.id];
      // Produto com grade só manda linhas por variante; enquanto a grade não
      // carrega, ele não manda nada. Sem variante ativa, vai pelo produto.
      if (emGrade(p) && !semVarianteAtiva(g)) {
        if (g) g.linhas.forEach(function (l) { if (!enviadas[l.chave]) out.push(l); });
      } else {
        var chave = chaveDaLinha(p.id, null);
        if (!enviadas[chave]) {
          out.push({ chave: chave, product_id: p.id, variant_id: null, nome: p.name, rotulo: null, disponivel: Number(p.stock) || 0, unidade: unidadeDe(p) });
        }
      }
    });
    // O servidor disse quanto tem agora: vale mais que a lista local.
    return out.map(function (l) {
      var d = dispServidor[l.chave];
      return d != null ? { ...l, disponivel: d } : l;
    });
  }, [produtos, grades, enviadas, dispServidor, forcarGrade]);

  var validacao = useMemo(function () { return validar(linhas, quantidades); }, [linhas, quantidades]);
  var nItens = validacao.itens.length;
  var temErro = Object.keys(validacao.erros).length > 0;
  var lotes = Math.max(1, Math.ceil(nItens / MAX_ITENS_POR_LOTE));

  function erroDaLinha(chave: string): string | null {
    if (problemas[chave] && !validacao.erros[chave]) return problemas[chave];
    if (semEstoque[chave] !== undefined && !validacao.erros[chave]) {
      // Linha que o servidor recusou: segue marcada até a pessoa mexer.
      var d = semEstoque[chave];
      return d == null ? "Não tem essa quantidade nesta loja agora." : "Disponível agora: " + textoDoTudo(d) + ".";
    }
    if (!tentou && !quantidades[chave]) return null;
    return validacao.erros[chave] || null;
  }

  function digitar(chave: string, v: string) {
    setQuantidades(function (q) { return { ...q, [chave]: v }; });
    if (semEstoque[chave] !== undefined) {
      setSemEstoque(function (m) { var n = { ...m }; delete n[chave]; return n; });
    }
    if (problemas[chave]) {
      setProblemas(function (m) { var n = { ...m }; delete n[chave]; return n; });
    }
    setErroEnvio(null);
  }

  function tudo(l: LinhaTransferencia) { digitar(l.chave, textoDoTudo(l.disponivel)); }

  function tudoDoProduto(p: ProdutoParaTransferir) {
    var g = grades[p.id];
    if (!g) return;
    var q = { ...quantidades };
    g.linhas.forEach(function (l) { if (!enviadas[l.chave]) q[l.chave] = textoDoTudo(dispServidor[l.chave] != null ? dispServidor[l.chave] : l.disponivel); });
    setQuantidades(q);
  }

  var podeRevisar = !!destino && nItens > 0 && !temErro;

  function revisar() {
    setTentou(true);
    if (!podeRevisar) return;
    setErroEnvio(null);
    setPasso(2);
  }

  function confirmar() {
    if (!destino || nItens === 0 || enviando) return;
    var partes = dividirEmLotes(validacao.itens, MAX_ITENS_POR_LOTE);
    var numeros: Array<string | number> = [];
    var pecasTotal = 0;
    var obs = observacao.trim() || null;
    setErroEnvio(null);
    setJaEnviados([]);
    setProblemas({});

    // TENTE_DE_NOVO (deadlock no banco): 1 tentativa a mais, mesmo corpo.
    function criar(i: number, tentativa: number): Promise<any> {
      var corpo: PedidoTransferencia = { destino_company_id: destino!.id, itens: partes[i], observacao: obs };
      if (stockCountId) corpo.stock_count_id = stockCountId;
      return estoqueTransferenciasApi.criar(origem.id, corpo).catch(function (e: any) {
        if (tentativa === 0 && codigoDoErro(e) === "TENTE_DE_NOVO") return criar(i, 1);
        throw e;
      });
    }

    function enviar(i: number): Promise<void> {
      if (i >= partes.length) return Promise.resolve();
      if (vivo.current) setEnviando({ lote: i + 1, de: partes.length });
      return criar(i, 0)
        .then(function (r) {
          var t = r && r.transferencia;
          numeros.push(t ? t.numero : "?");
          // Peças: o que o servidor gravou (total_pecas); sem ele, o que foi pedido.
          var pedidas = partes[i].reduce(function (a, it) { return a + it.quantidade; }, 0);
          pecasTotal += t && t.total_pecas != null && !isNaN(Number(t.total_pecas)) ? Number(t.total_pecas) : pedidas;
          // O lote entrou: tira as linhas dele da tela (não vão de novo).
          var feitas: Record<string, boolean> = {};
          partes[i].forEach(function (it) { feitas[chaveDaLinha(it.product_id, it.variant_id)] = true; });
          if (vivo.current) {
            setEnviadas(function (e) { return { ...e, ...feitas }; });
            setJaEnviados(numeros.slice());
          }
          return enviar(i + 1);
        });
    }

    enviar(0)
      .then(function () {
        if (onEstoqueMudou) onEstoqueMudou();
        if (onConcluido) onConcluido(numeros, Math.round(pecasTotal * 1000) / 1000, destino!);
      })
      .catch(function (e: any) {
        if (numeros.length > 0 && onEstoqueMudou) onEstoqueMudou();
        if (!vivo.current) return;
        var code = codigoDoErro(e);
        if (code === "ESTOQUE_INSUFICIENTE") {
          var falta = itensSemEstoque(e);
          setSemEstoque(falta);
          var disp: Record<string, number> = {};
          Object.keys(falta).forEach(function (k) { if (falta[k] != null) disp[k] = falta[k] as number; });
          setDispServidor(function (x) { return { ...x, ...disp }; });
          // Abre o produto da variante marcada, para a linha aparecer.
          var a: Record<string, boolean> = {};
          Object.keys(falta).forEach(function (k) { if (k.indexOf("v:") === 0) a[k.split(":")[1]] = true; });
          setAbertos(function (x) { return { ...x, ...a }; });
          setPasso(1);
        } else if (code === "GRADE_DIFERENTE" || code === "QUANTIDADE_INVALIDA" || code === "ITEM_NAO_ENCONTRADO") {
          var citados = itensDoErro(e);
          var motivoGeral = e && e.data && e.data.motivo ? String(e.data.motivo) : null;
          var marcas: Record<string, string> = {};
          var abrirP: Record<string, boolean> = {};
          var gradeNova: Record<string, boolean> = {};
          citados.forEach(function (it) {
            var motivo = it.motivo || motivoGeral;
            var txt = problemaDaLinha(code, motivo, destino!.nome);
            if (txt) marcas[it.chave] = txt;
            abrirP[it.product_id] = true;
            if (motivo === "informe_a_variante") gradeNova[it.product_id] = true;
          });
          setProblemas(marcas);
          setAbertos(function (x) { return { ...x, ...abrirP }; });
          if (Object.keys(gradeNova).length > 0) {
            setForcarGrade(function (x) { return { ...x, ...gradeNova }; });
            produtos.forEach(function (p) { if (gradeNova[p.id]) carregarGrade(p); });
          }
          if (citados.length > 0 || temMotivo(e, "informe_a_variante")) setPasso(1);
        }
        setErroEnvio(mensagemDoErro(code, e, destino!.nome));
      })
      .finally(function () { if (vivo.current) setEnviando(null); });
  }

  // ── Lista visível (busca + paginação) ─────────────────────────────
  var filtrados = useMemo(function () {
    var q = busca.trim();
    var base = produtos.filter(function (p) {
      if (emGrade(p) && !semVarianteAtiva(grades[p.id])) {
        var g = grades[p.id];
        // Grade carregada e toda enviada: some.
        return !(g && g.estado === "ok" && g.linhas.length > 0 && g.linhas.every(function (l) { return enviadas[l.chave]; }));
      }
      return !enviadas[chaveDaLinha(p.id, null)];
    });
    if (!q) return base;
    return base.filter(function (p) {
      return productMatchesSearch({ name: p.name, barcode: p.barcode || "", sku: p.sku || "", code: p.code || "", category: p.category || "" } as any, q);
    });
  }, [produtos, busca, grades, enviadas, forcarGrade]);
  var visiveis = filtrados.slice(0, limite);

  var ocupado = !!enviando;
  var fechar = ocupado ? undefined : onFechar;

  var sub = passo === 1
    ? "De " + origem.nome + " para outra loja do grupo. Deixe vazio o que não vai."
    : "Confira antes de transferir. Nada foi mudado ainda.";

  var rodape = enviando
    ? "Enviando lote " + enviando.lote + " de " + enviando.de + "…"
    : nItens === 0
      ? plural(produtos.length, "produto selecionado", "produtos selecionados")
      : plural(nItens, "item", "itens") + " · " + plural(validacao.pecas, "peça", "peças");

  var panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  function campo(l: LinhaTransferencia, rotulo: string, sub2: string | null) {
    var erro = erroDaLinha(l.chave);
    return (
      <View key={l.chave} style={[s.linha, estreito && s.linhaEstreita, !!erro && s.linhaErro]} testID={"transferir-linha-" + l.chave}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.linhaNome} numberOfLines={2}>{rotulo}</Text>
          {sub2 ? <Text style={s.linhaSub} numberOfLines={1}>{sub2}</Text> : null}
          {erro ? <Text style={s.linhaErroTxt} testID={"transferir-erro-" + l.chave}>{erro}</Text> : null}
        </View>
        <View style={[s.linhaAcoes, estreito && { alignSelf: "stretch", justifyContent: "space-between" }]}>
          <Text style={s.disp} testID={"transferir-disp-" + l.chave}>Tem {fmtQty(l.disponivel)}</Text>
          <TextInput
            value={quantidades[l.chave] || ""}
            onChangeText={function (v) { digitar(l.chave, v); }}
            placeholder="0"
            placeholderTextColor={Colors.ink3}
            keyboardType="decimal-pad"
            editable={!ocupado}
            style={[s.qtd, !!erro && { borderColor: Colors.red }] as any}
            accessibilityLabel={"Quantidade de " + rotulo}
            testID={"transferir-qtd-" + l.chave}
          />
          <Pressable
            onPress={function () { tudo(l); }}
            disabled={ocupado || !(l.disponivel > 0)}
            style={[s.tudo, !(l.disponivel > 0) && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel={"Transferir tudo de " + rotulo}
            testID={"transferir-tudo-" + l.chave}
          >
            <Text style={s.tudoTxt}>Tudo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function produto(p: ProdutoParaTransferir) {
    var codigo = p.sku || p.code || p.barcode || null;
    var g = grades[p.id];
    if (!emGrade(p) || semVarianteAtiva(g)) {
      var chave = chaveDaLinha(p.id, null);
      var l = linhas.find(function (x) { return x.chave === chave; });
      var nota = semVarianteAtiva(g) ? "Sem tamanhos e cores ativos: vai pelo produto" : null;
      return l ? campo(l, p.name, nota ? (codigo ? codigo + " · " : "") + nota : codigo) : null;
    }
    var aberto = !!abertos[p.id];
    var linhasDaGrade = linhas.filter(function (x) { return x.product_id === p.id; });
    var naGrade = g && g.estado === "ok" ? linhasDaGrade.reduce(function (a, x) { return a + x.disponivel; }, 0) : Number(p.stock) || 0;
    return (
      <View key={p.id} style={[s.grade, !!problemas[chaveDaLinha(p.id, null)] && s.linhaErro]} testID={"transferir-produto-" + p.id}>
        <Pressable onPress={function () { abrir(p); }} style={s.gradeHead} accessibilityRole="button"
          accessibilityState={{ expanded: aberto }} testID={"transferir-abrir-" + p.id}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.linhaNome} numberOfLines={2}>{p.name}</Text>
            <Text style={s.linhaSub} numberOfLines={1}>{(codigo ? codigo + " · " : "") + "Tem " + fmtQty(naGrade) + " em tamanhos e cores"}</Text>
          </View>
          <Text style={s.gradeToggle}>{aberto ? "Fechar" : "Tamanhos e cores"}</Text>
        </Pressable>
        {problemas[chaveDaLinha(p.id, null)] ? (
          <Text style={[s.linhaErroTxt, { paddingHorizontal: 12 }]} testID={"transferir-erro-produto-" + p.id}>{problemas[chaveDaLinha(p.id, null)]}</Text>
        ) : null}
        {aberto && g && g.estado === "carregando" && (
          <View style={s.gradeAviso}><ActivityIndicator size="small" color={Colors.violet3} /><Text style={s.linhaSub}>Carregando tamanhos e cores…</Text></View>
        )}
        {aberto && g && g.estado === "erro" && (
          <Pressable onPress={function () { carregarGrade(p); }} style={s.gradeAviso} testID={"transferir-grade-erro-" + p.id}>
            <Text style={s.linhaErroTxt}>Não conseguimos carregar os tamanhos e cores. Toque para tentar de novo.</Text>
          </Pressable>
        )}
        {aberto && g && g.estado === "ok" && (
          <View style={{ gap: 6 }}>
            {linhasDaGrade.length === 0 && <Text style={[s.linhaSub, { paddingHorizontal: 12, paddingBottom: 10 }]}>Sem tamanhos e cores ativos.</Text>}
            {linhasDaGrade.length > 1 && (
              <Pressable onPress={function () { tudoDoProduto(p); }} disabled={ocupado} style={s.tudoGrade}
                accessibilityRole="button" testID={"transferir-tudo-produto-" + p.id}>
                <Text style={s.tudoTxt}>Tudo em todos os tamanhos e cores</Text>
              </Pressable>
            )}
            {linhasDaGrade.map(function (x) { return campo(x, x.rotulo || "Variante", null); })}
            {g.inativas > 0 && (
              <Text style={[s.linhaSub, { paddingHorizontal: 12 }]} testID={"transferir-inativas-" + p.id}>
                {plural(g.inativas, "tamanho/cor inativo não aparece", "tamanhos/cores inativos não aparecem") + " (não dá para transferir)."}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[s.overlay, estreito && { padding: 10 }]} testID="transferir-modal">
      <Pressable style={s.backdrop} onPress={fechar} accessibilityLabel="Fechar" />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} accessibilityViewIsModal accessibilityLabel="Transferir para outra loja">

        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIco}><Text style={s.headerIcoTxt}>⇄</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>Transferir para outra loja</Text>
              <Text style={s.headerSub}>{sub}</Text>
            </View>
          </View>
          <Pressable onPress={fechar} disabled={ocupado} style={s.closeBtn} testID="transferir-x" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <View style={s.stepBar} accessibilityLabel={"Passo " + passo + " de 2"}>
          {PASSOS.map(function (pp, idx) {
            var n = pp[0];
            var ativo = n === passo;
            var feito = n < passo;
            return (
              <View key={n} style={s.stepItem} testID={"transferir-passo-" + n}>
                <View style={[s.stepDot, feito && s.stepDotDone, ativo && s.stepDotActive]}>
                  {feito ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                </View>
                <Text style={[s.stepLabel, (ativo || feito) && { color: ativo ? "#a78bfa" : Colors.ink2, fontWeight: ativo ? "700" : "500" }]}>{pp[1]}</Text>
                {idx < PASSOS.length - 1 && <View style={[s.stepSep, feito && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
              </View>
            );
          })}
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {jaEnviados.length > 0 && !!erroEnvio && (
            <View style={[s.aviso, s.avisoOk]} testID="transferir-ja-enviados">
              <Text style={s.avisoTxt}>
                {"Já foram: transferência " + textoDosNumeros(jaEnviados) + ". Esses itens saíram da lista; o que ficou abaixo ainda não foi."}
              </Text>
            </View>
          )}
          {!!erroEnvio && (
            <View style={[s.aviso, s.avisoErro]} testID="transferir-erro-envio" accessibilityLiveRegion="polite">
              <Text style={s.avisoTxt}>{erroEnvio}</Text>
            </View>
          )}

          {passo === 1 && (
            <>
              <Text style={s.label}>Para qual loja?</Text>
              <View style={s.destinos}>
                {destinos.map(function (d) {
                  var on = d.id === destinoId;
                  return (
                    <Pressable key={d.id} onPress={function () { setDestinoId(d.id); setErroEnvio(null); }} disabled={ocupado}
                      style={[s.destino, on && s.destinoOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}
                      testID={"transferir-destino-" + d.id}>
                      <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
                      <Text style={[s.destinoTxt, on && { color: Colors.ink, fontWeight: "700" }]} numberOfLines={1}>{d.nome}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {tentou && !destino && <Text style={s.linhaErroTxt} testID="transferir-erro-destino">Escolha a loja que vai receber.</Text>}

              <View style={s.listaHead}>
                <Text style={[s.label, { marginTop: 0, marginBottom: 0, flex: 1 }]}>Quanto vai de cada item</Text>
                {comGrade.length > ABRIR_SOZINHO_ATE && (
                  <Pressable onPress={abrirTodos} disabled={abrindoTodos || ocupado} style={s.linkBtn} accessibilityRole="button" testID="transferir-abrir-todos">
                    {abrindoTodos ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Text style={s.linkTxt}>Abrir tamanhos e cores de todos</Text>}
                  </Pressable>
                )}
              </View>
              {produtos.length > BUSCA_A_PARTIR_DE && (
                <TextInput value={busca} onChangeText={function (v) { setBusca(v); setLimite(POR_PAGINA); }}
                  placeholder="Buscar na seleção por nome ou código…" placeholderTextColor={Colors.ink3}
                  style={s.busca as any} testID="transferir-busca" />
              )}
              {tentou && nItens === 0 && !temErro && (
                <Text style={[s.linhaErroTxt, { marginBottom: 8 }]} testID="transferir-erro-vazio">Digite a quantidade de pelo menos um item.</Text>
              )}
              <View style={{ gap: 8 }}>
                {visiveis.map(produto)}
                {filtrados.length === 0 && <Text style={s.linhaSub} testID="transferir-busca-vazia">Nenhum item da seleção com essa busca.</Text>}
              </View>
              {filtrados.length > visiveis.length && (
                <Pressable onPress={function () { setLimite(limite + POR_PAGINA); }} style={s.mais} accessibilityRole="button" testID="transferir-mais">
                  <Text style={s.linkTxt}>{"Mostrar mais (" + (filtrados.length - visiveis.length).toLocaleString("pt-BR") + " restantes)"}</Text>
                </Pressable>
              )}
            </>
          )}

          {passo === 2 && destino && (
            <View testID="transferir-resumo">
              <View style={s.resumo}>
                <Text style={s.resumoNum} testID="transferir-resumo-total">
                  {plural(nItens, "item", "itens") + " · " + plural(validacao.pecas, "peça", "peças")}
                </Text>
                <View style={s.rota}>
                  <Text style={s.rotaLoja} numberOfLines={1}>{origem.nome}</Text>
                  <Icon name="arrow_right" size={14} color={Colors.violet3} />
                  <Text style={s.rotaLoja} numberOfLines={1}>{destino.nome}</Text>
                </View>
                <Text style={s.linhaSub} testID="transferir-resumo-rota">{"De " + origem.nome + " para " + destino.nome}</Text>
              </View>
              <View style={[s.aviso, s.avisoInfo]} testID="transferir-aviso-cria">
                <Text style={s.avisoTxt}>
                  {"Sai do estoque de " + origem.nome + " e entra no de " + destino.nome + ". Produto que ainda não existe em " + destino.nome + " é criado lá com os mesmos dados do cadastro (nome, preço, códigos, categoria e foto)."}
                </Text>
              </View>
              {lotes > 1 && (
                <View style={[s.aviso, s.avisoInfo]} testID="transferir-aviso-lotes">
                  <Text style={s.avisoTxt}>
                    {"São muitos itens: vai em " + lotes + " partes de até " + MAX_ITENS_POR_LOTE.toLocaleString("pt-BR") + ", uma depois da outra. Cada parte vira uma transferência no histórico."}
                  </Text>
                </View>
              )}
              {enviando && (
                <View style={s.progresso} testID="transferir-progresso">
                  <View style={[s.progressoBarra, { width: (Math.round(((enviando.lote - 1) / enviando.de) * 100) + "%") as any }]} />
                </View>
              )}
              <Text style={s.label}>Observação (opcional)</Text>
              <TextInput value={observacao} onChangeText={setObservacao} editable={!ocupado}
                placeholder="Ex.: abertura da loja nova" placeholderTextColor={Colors.ink3}
                style={s.busca as any} maxLength={300} testID="transferir-observacao" />
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.footerInfo} numberOfLines={2} testID="transferir-rodape">{rodape}</Text>
          <View style={s.footerActions}>
            {passo === 1 && (
              <>
                <Pressable style={s.btnSec} onPress={onFechar} testID="transferir-cancelar" accessibilityRole="button">
                  <Text style={s.btnSecTxt}>Cancelar</Text>
                </Pressable>
                <Pressable style={[s.btnPri, !podeRevisar && { opacity: 0.45 }]} onPress={revisar}
                  testID="transferir-revisar" accessibilityRole="button" accessibilityState={{ disabled: !podeRevisar }}>
                  <Text style={s.btnPriTxt}>Conferir</Text>
                </Pressable>
              </>
            )}
            {passo === 2 && (
              <>
                <Pressable style={[s.btnSec, ocupado && { opacity: 0.45 }]} onPress={ocupado ? undefined : function () { setPasso(1); setErroEnvio(null); }}
                  disabled={ocupado} testID="transferir-voltar" accessibilityRole="button">
                  <Icon name="arrow_left" size={14} color={Colors.ink} />
                  <Text style={s.btnSecTxt}>Voltar</Text>
                </Pressable>
                <Pressable style={[s.btnConfirm, ocupado && { opacity: 0.7 }]} onPress={ocupado ? undefined : confirmar} disabled={ocupado}
                  testID="transferir-confirmar" accessibilityRole="button" accessibilityState={{ busy: ocupado }}>
                  {ocupado ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Icon name="check" size={14} color="#fff" />
                      <Text style={s.btnPriTxt}>{"Transferir " + plural(validacao.pecas, "peça", "peças")}</Text>
                    </>
                  )}
                </Pressable>
              </>
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
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 760, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerIcoTxt: { color: "#a78bfa", fontSize: 16, fontWeight: "800" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.18)", borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)", gap: 6,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500" },
  stepSep: { width: 28, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 4 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 18, paddingBottom: 12 },
  label: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2, marginTop: 4, marginBottom: 8 },
  destinos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  destino: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, maxWidth: "100%",
  },
  destinoOn: { borderColor: Colors.violet, backgroundColor: "rgba(124,58,237,0.12)" },
  destinoTxt: { fontSize: 13.5, color: Colors.ink2, flexShrink: 1 },
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: Colors.violet },
  radioDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: Colors.violet },
  listaHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 8, flexWrap: "wrap" },
  linkBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  linkTxt: { color: Colors.violet3, fontSize: 12.5, fontWeight: "700" },
  busca: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2, minHeight: 44, marginBottom: 10,
  },
  linha: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  linhaEstreita: { flexDirection: "column", alignItems: "flex-start" },
  linhaErro: { borderColor: Colors.red, backgroundColor: Colors.redD },
  linhaNome: { fontSize: 13.5, color: Colors.ink, fontWeight: "600" },
  linhaSub: { fontSize: 11.5, color: Colors.ink3, marginTop: 2 },
  linhaErroTxt: { fontSize: 12, color: Colors.red, marginTop: 4, fontWeight: "600" },
  linhaAcoes: { flexDirection: "row", alignItems: "center", gap: 8 },
  disp: { fontSize: 12, color: Colors.ink3, minWidth: 56, textAlign: "right" },
  qtd: {
    width: 76, minHeight: 44, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 10,
    fontSize: 15, color: Colors.ink, backgroundColor: Colors.bg3, textAlign: "center",
  },
  tudo: {
    minHeight: 44, minWidth: 56, paddingHorizontal: 10, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", backgroundColor: "rgba(124,58,237,0.08)",
  },
  tudoTxt: { color: Colors.violet3, fontSize: 12.5, fontWeight: "700" },
  tudoGrade: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  grade: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", gap: 6, paddingBottom: 6 },
  gradeHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 52 },
  gradeToggle: { color: Colors.violet3, fontSize: 12.5, fontWeight: "700" },
  gradeAviso: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10, minHeight: 44 },
  mais: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, marginTop: 8 },
  resumo: {
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)", backgroundColor: "rgba(124,58,237,0.08)",
    padding: 16, gap: 8, marginBottom: 12,
  },
  resumoNum: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  rota: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rotaLoja: { fontSize: 14, fontWeight: "700", color: Colors.ink2, flexShrink: 1 },
  aviso: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  avisoInfo: { backgroundColor: Colors.violetD, borderColor: "rgba(124,58,237,0.3)" },
  avisoErro: { backgroundColor: Colors.redD, borderColor: Colors.red },
  avisoOk: { backgroundColor: Colors.greenD, borderColor: Colors.green },
  avisoTxt: { fontSize: 13.5, color: Colors.ink, lineHeight: 19 },
  progresso: { height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 12 },
  progressoBarra: { height: 6, backgroundColor: Colors.violet },
  footer: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)", backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
  },
  footerInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 140, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  btnPri: {
    backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnConfirm: {
    backgroundColor: "#10b981", minHeight: 44, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.border2,
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});

export default TransferirModal;
