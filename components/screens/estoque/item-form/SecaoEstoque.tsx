// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Estoque"
//
// Unidade, a pergunta "quantidade única ou por cor e tamanho" e, quando
// é por cor e tamanho, os chips das cores/tamanhos MAIS a grade — tudo
// na mesma seção, à vista, sem "isso fica no próximo passo".
//
// A GRADE É ESTADO LOCAL, NOS DOIS MODOS. Digitar 12 numa célula não
// dispara requisição nenhuma: a matriz inteira vai no PUT /variations do
// Salvar (ver ItemFormModal). Foi isto que tirou do caminho o auto-save
// campo a campo que o wizard tinha — e é o que faz o mesmo componente
// servir ao cadastro (onde o produto ainda nem existe) e à edição.
//
// ENTER LOCAL. O painel salva o produto quando se aperta Enter dentro do
// modal, exceto em alvos com `data-enter-local`. Todo input daqui cujo
// Enter quer dizer outra coisa (adicionar tamanho, o Enter que o leitor
// de código de barras manda depois do bipe, andar na grade) leva essa
// marca — senão um bipe salvava o produto no meio do cadastro.
//
// 22/09/2026 — PERFIL MATCON (docs/mockups/matcon-cadastro-produto.html,
// ponto ⑤ e tela 3). A unidade e o "Compro por" saíram daqui para o card
// "Como você vende" (SecaoPreco). O estoque vira a frase "Tenho [x] m² em
// estoque (≈ 64 caixas), e me avise abaixo de [y] m²." em qualquer unidade
// (vírgula só nas fracionadas), e a UNIDADE decide a segunda opção:
// m²/m³ com lote ligado → "Por lote e tonalidade" (só no cadastro: as
// pilhas que já estão na prateleira); o resto → "Por cor e medida" (a
// grade de hoje, com outro nome). Sem lote ligado, a opção de lote nem
// aparece. Sem o perfil, a seção é a de hoje.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { matrixKey } from "@/services/productsVariationsApi";
import { UNITS } from "../types";
import { Campo, Chip, Entrada, MiniBtn, Nota, Radio, Secao, IS_WEB, fr, s } from "./ui";
import { novoCodigoDeBarras } from "./codigoDeBarras";
import { EditorDeCor } from "./EditorDeCor";
import {
  novaLinhaDeLote, statusEstoque, totalDosLotes, lotesParaGravar, usaGradeEmCartoes, totalDasCelulas,
  type CorDoItem, type LinhaDeLote, type StockMode,
} from "./types";
import { PERFIL_PADRAO, type PerfilDoCadastro } from "./perfis";
import { estoqueEmDecimal, parseQtyInput, toPackages, rotuloEmbalagem, fmtQty, nomeDaUnidade, qtdComUnidade } from "@/utils/matconUnits";
import { dividirTamanhos, juntarTamanhos } from "@/utils/dividirTamanhos";
import { rotuloDaLojaNaGrade, rotuloDoMinimo } from "./lojasDoCadastro";


// RN Web transforma em data-enter-local="1" (ver cabeçalho).
const ENTER_LOCAL = { enterLocal: "1" };
// Campo de novo tamanho: o nativeID vira id no DOM (foco e colagem, web).
const ID_NOVO_TAM = "estoque-novo-tamanho";
// Atalhos de um toque ao lado do "+ Tamanho" (p-35). Só fora do Matcon.
export const ATALHOS_DE_TAMANHO: { rotulo: string; acessivel: string; tamanhos: string[] }[] = [
  { rotulo: "P M G GG", acessivel: "Adicionar P, M, G e GG", tamanhos: ["P", "M", "G", "GG"] },
  { rotulo: "34 a 44", acessivel: "Adicionar 34, 36, 38, 40, 42 e 44", tamanhos: ["34", "36", "38", "40", "42", "44"] },
];


type Props = {
  narrow: boolean;
  modoEdicao: boolean;
  unidade: string; onUnidade: (v: string) => void;
  stockMode: StockMode; onStockMode: (v: StockMode) => void;
  estoque: string; onEstoque: (v: string) => void;
  minimo: string; onMinimo: (v: string) => void;
  cores: CorDoItem[]; onCores: (v: CorDoItem[]) => void;
  tamanhos: string[]; onTamanhos: (v: string[]) => void;
  celulas: Record<string, string>; onCelula: (chave: string, v: string) => void;
  barras: Record<string, string>; onBarra: (chave: string, v: string) => void;
  onSubmit: () => void;
  // Texto do modal quando havia cor/tamanho gravado no próprio produto
  // (sem variação). Só aparece no modo "Por cor e tamanho".
  avisoDoPai?: string | null;
  // 22/09/2026 (perfil de cadastro) — tudo opcional, default = a seção de
  // hoje. Só o perfil Matcon lê o que vem abaixo.
  perfil?: PerfilDoCadastro;
  // "(≈ 64 caixas)" ao lado do estoque: a frase "Compro por" do card
  // "Como você vende".
  purchaseUnit?: string | null;
  purchaseFactor?: string;
  // A opção "Por lote e tonalidade" existe? (usaLote: Matcon + lote ligado
  // na config + m²/m³ — e só no cadastro.) Sem ela, a opção some.
  lotesDisponiveis?: boolean;
  lotes?: LinhaDeLote[]; onLotes?: (v: LinhaDeLote[]) => void;
  // 14/11/2026 (CP4b): para a prévia "como sai" do editor de cor.
  nomeDoProduto?: string;
  // 20/11/2026 (em qual loja o produto entra, mockup b e f): com 2 ou mais
  // lojas marcadas, "Quantidade atual" vira uma linha por loja e a grade
  // ganha o seletor "Quantidades de qual loja?". Ausente (o caso de quase
  // todo mundo): a seção é a de hoje, sem mudar nada.
  lojas?: EstoqueDasLojas | null;
};

export type EstoqueDasLojas = {
  /** A loja ativa primeiro. `qtd` é o texto do campo daquela loja. */
  linhas: Array<{ id: string; nome: string; ativa: boolean; qtd: string }>;
  onQtd: (id: string, v: string) => void;
  /** De qual loja a grade mostra as quantidades. */
  gradeDe: string;
  onGradeDe: (id: string) => void;
  /** Total da grade de cada loja, para o "Matriz · 12" do seletor. */
  totais: Record<string, number>;
};

export function SecaoEstoque(p: Props) {
  const [abrirTam, setAbrirTam] = useState(false);
  const [novoTam, setNovoTam] = useState("");
  const [abrirBarras, setAbrirBarras] = useState(false);
  const perfil = p.perfil || PERFIL_PADRAO;
  const lojas = p.lojas && p.lojas.linhas.length >= 2 ? p.lojas : null;
  // p-201: até 560 px a matriz cor × tamanho vira um cartão por cor.
  const { width: larguraDaTela } = useWindowDimensions();
  const emCartoes = usaGradeEmCartoes(larguraDaTela);

  // 18/10/2026 (p-35): "P, M, G" vira três tamanhos (regra de divisão em
  // utils/dividirTamanhos), mesclados sem duplicar e na ordem PP, P, M,
  // G... O campo NÃO fecha: quem cadastra grade digita vários seguidos
  // (como a paleta de cor). Quem fecha é o "+ Tamanho".
  function addTam() {
    const novos = dividirTamanhos(novoTam, perfil.id === "matcon" ? "matcon" : "padrao");
    setNovoTam("");
    focarNovoTam();
    if (!novos.length) return;
    const lista = juntarTamanhos(p.tamanhos, novos);
    if (lista.join("\u0000") !== p.tamanhos.join("\u0000")) p.onTamanhos(lista);
  }
  function faltaAlgum(tamanhos: string[]) {
    const tem = new Set(p.tamanhos.map((t) => t.trim().toLocaleUpperCase("pt-BR")));
    return tamanhos.some((t) => !tem.has(t.toLocaleUpperCase("pt-BR")));
  }
  function focarNovoTam() {
    if (!IS_WEB || typeof document === "undefined") return;
    const el = document.getElementById(ID_NOVO_TAM) as HTMLElement | null;
    if (el && document.activeElement !== el) el.focus();
  }
  // Campo de uma linha no web descarta a quebra de linha do que se cola
  // (coluna de planilha "P↵M↵G" virava "PMG"). Na colagem com quebra de
  // linha, ela vira "; ", que também separa.
  const colarTamRef = useRef<(e: ClipboardEvent) => void>(() => {});
  colarTamRef.current = (e: ClipboardEvent) => {
    const colado = e.clipboardData ? e.clipboardData.getData("text") : "";
    if (!/[\r\n]/.test(colado)) return;
    e.preventDefault();
    const el = e.target as HTMLInputElement;
    const ini = el.selectionStart ?? novoTam.length;
    const fim = el.selectionEnd ?? novoTam.length;
    const meio = colado.split(/\r?\n|\r/).map((x) => x.trim()).filter(Boolean).join("; ");
    setNovoTam(novoTam.slice(0, ini) + meio + novoTam.slice(fim));
  };
  useEffect(() => {
    if (!abrirTam || !IS_WEB || typeof document === "undefined") return;
    const el = document.getElementById(ID_NOVO_TAM);
    if (!el) return;
    const ouvir = (e: Event) => colarTamRef.current(e as ClipboardEvent);
    el.addEventListener("paste", ouvir);
    return () => el.removeEventListener("paste", ouvir);
  }, [abrirTam]);

  const C = p.cores;
  const Z = p.tamanhos;
  const matriz = C.length > 0 && Z.length > 0;
  const umEixo = !matriz && (C.length > 0 || Z.length > 0);

  // Uma linha por combinação cor × tamanho, na ordem da grade.
  const combos = matriz
    ? C.flatMap((c) => Z.map((z) => ({ k: matrixKey(c.hex, z), hex: c.hex, nome: (c.name || c.hex) + " · " + z })))
    : [];
  const barrasPreenchidas = combos.filter((r) => (p.barras[r.k] ?? "").trim() !== "").length;

  // Gerar código de barras (um ou todos os que faltam). Os códigos já na
  // grade entram no "usados" pra nunca sair repetido entre combinações.
  function codigosEmUso() {
    const u = new Set<string>();
    Object.keys(p.barras).forEach((k) => { const v = (p.barras[k] || "").trim(); if (v) u.add(v); });
    return u;
  }
  function gerarBarra(k: string) {
    p.onBarra(k, novoCodigoDeBarras(k, codigosEmUso()));
  }
  function gerarFaltantes(chaves: string[]) {
    const usados = codigosEmUso();
    chaves.forEach((k) => { if (!(p.barras[k] ?? "").trim()) p.onBarra(k, novoCodigoDeBarras(k, usados)); });
  }
  // Grade de um eixo só (só cores ou só tamanhos).
  const linhasUmEixo = umEixo
    ? (C.length ? C.map((c) => ({ k: matrixKey(c.hex, null), nome: c.name || c.hex, hex: c.hex as string | null }))
                : Z.map((z) => ({ k: matrixKey(null, z), nome: z, hex: null as string | null })))
    : [];
  const faltamUmEixo = linhasUmEixo.filter((r) => !(p.barras[r.k] ?? "").trim()).length;

  // Bipou, o leitor manda Enter: pula pro próximo código, pra bipar a
  // grade inteira sem tocar na tela. Só web — o Entrada não repassa ref
  // (React 18), então o foco vai pelo id que o nativeID vira no DOM.
  function focarBarra(i: number) {
    if (!IS_WEB || typeof document === "undefined") return;
    const el = document.getElementById("estoque-barra-" + i) as HTMLElement | null;
    if (el) el.focus();
  }

  // 22/09/2026 (perfil de cadastro). Perfil padrão: nada abaixo muda o
  // render — os 9 chips de UNITS, as duas opções e as duas caixas de hoje.
  const matcon = perfil.vendoPorNoPreco;
  // 23/09/2026 (QA em produção): "un" nas frases do estoque vira "unidade"
  // por extenso — as outras (sc, m²…) já se leem bem do jeito que a loja
  // usa no dia a dia.
  const unidadeFrase = p.unidade === "un" ? "unidade" : p.unidade;
  // Milheiro também vai em decimal aqui: vender 500 tijolos deixa 19,5 mlh
  // no estoque, e a ficha precisa ler e salvar o "19,5" (QA 22/09/2026).
  const fracionado = matcon && estoqueEmDecimal(p.unidade);
  const filtroQtd = (v: string) => (fracionado ? v.replace(/[^0-9.,]/g, "") : v.replace(/\D/g, ""));
  const tecladoQtd = fracionado ? "decimal-pad" : "number-pad";
  const lerQtd = (v: string) => (fracionado ? parseQtyInput(v) : (parseInt(v, 10) || null));
  const fatorNum = p.purchaseFactor ? parseQtyInput(p.purchaseFactor) : null;
  const caixas = (qtd: number) => {
    const pk = fatorNum && qtd > 0 ? toPackages(qtd, fatorNum) : null;
    return pk ? rotuloEmbalagem(pk.packages, p.purchaseUnit) : null;
  };
  const estoqueNum = parseQtyInput(p.estoque || "") || 0;
  const caixasDoEstoque = caixas(estoqueNum);

  // Lote só com a loja pedindo (config) E a unidade certa (m²/m³). "Por cor
  // e medida" some quando o lote aparece — a não ser que o produto já tenha
  // grade: aí a opção fica, pra nunca esconder o que está gravado.
  const comLote = perfil.estoque.lotes && !!p.lotesDisponiveis;
  const comGrade = !comLote || p.stockMode === "variants";
  const lotes = p.lotes || [];
  const lotesValidos = lotesParaGravar(lotes, lerQtd);
  const totalLotes = totalDosLotes(lotes, lerQtd);
  const caixasDosLotes = caixas(totalLotes);

  function mudarLote(id: string, campo: "codigo" | "tonalidade" | "bitola" | "qtd", v: string) {
    p.onLotes?.(lotes.map((l) => (l.id === id ? { ...l, [campo]: campo === "qtd" ? filtroQtd(v) : v } : l)));
  }

  const minimoNaFrase = (
    <Entrada
      value={p.minimo}
      onChangeText={(v: string) => p.onMinimo(filtroQtd(v))}
      onSubmitEditing={p.onSubmit}
      placeholder="0"
      keyboardType={tecladoQtd}
      accessibilityLabel="Estoque mínimo"
      style={fr.fraseInput}
    />
  );

  // 20/11/2026 (mockup b e f): uma linha por loja marcada; o mínimo é um
  // só e vale para todas (D3). Matcon com unidade fracionada aceita vírgula
  // aqui também (filtroQtd).
  function estoquePorLoja(l: EstoqueDasLojas) {
    return (
      <View style={{ marginBottom: 12 }} testID="estoque-por-loja">
        <Campo label="Quantas peças em cada loja?">
          <View style={{ gap: 8 }}>
            {l.linhas.map((linha) => (
              <View key={linha.id} style={st.lojaLinha}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.lojaNome} numberOfLines={2}>{linha.nome}</Text>
                  {!linha.ativa ? <Text style={st.lojaDica}>Pode deixar 0 e transferir depois</Text> : null}
                </View>
                <Entrada
                  testID={"estoque-loja-" + linha.id}
                  value={linha.qtd}
                  onChangeText={(v: string) => l.onQtd(linha.id, filtroQtd(v))}
                  onSubmitEditing={p.onSubmit}
                  placeholder="0"
                  keyboardType={tecladoQtd}
                  selectTextOnFocus
                  accessibilityLabel={"Peças na " + linha.nome}
                  style={st.lojaQtd}
                />
              </View>
            ))}
          </View>
        </Campo>
        <Campo label={rotuloDoMinimo(l.linhas.length)} style={{ marginBottom: 0 }}>
          <Entrada
            value={p.minimo}
            onChangeText={(v: string) => p.onMinimo(filtroQtd(v))}
            onSubmitEditing={p.onSubmit}
            placeholder="0"
            keyboardType={tecladoQtd}
            accessibilityLabel="Estoque mínimo"
            style={{ maxWidth: 120 }}
          />
        </Campo>
      </View>
    );
  }

  // 20/11/2026 (mockup b): a grade é uma só (mesmas cores e tamanhos) e o
  // seletor escolhe de qual loja são as quantidades na tela.
  const seletorDaGrade = lojas && (matriz || umEixo) ? (
    <Campo label="Quantidades de qual loja?">
      <View style={st.seg} testID="grade-seletor-de-loja">
        {lojas.linhas.map((linha) => {
          const on = lojas.gradeDe === linha.id;
          return (
            <Pressable
              key={linha.id}
              testID={"grade-da-loja-" + linha.id}
              onPress={() => lojas.onGradeDe(linha.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[st.segBtn, on && st.segBtnOn]}
            >
              <Text style={[st.segTxt, on && { color: "#fff" }]} numberOfLines={1}>
                {rotuloDaLojaNaGrade(linha.nome, lojas.totais[linha.id] || 0)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Campo>
  ) : null;

  return (
    <Secao
      icon="box"
      titulo="Estoque"
      selo={matcon
        ? statusEstoque(p.stockMode, C, Z, p.estoque, {
            tamanhos: perfil.estoque.rotuloDosTamanhos.toLowerCase(),
            abreviacao: perfil.estoque.abreviacaoDoTamanho,
            lotes: lotesValidos.length,
          })
        : statusEstoque(p.stockMode, C, Z, p.estoque)}
    >
      {!matcon && (
        <Campo label="Unidade de venda">
          <View style={s.chips}>
            {UNITS.map((u) => (
              <Chip key={u} label={u} active={p.unidade === u} onPress={() => p.onUnidade(u)} />
            ))}
          </View>
        </Campo>
      )}

      <Campo label="Como você controla o estoque?">
        {matcon ? (
          <View style={[fr.radios, p.narrow && { flexDirection: "column" }]}>
            <Radio ativo={p.stockMode === "single"} titulo="Quantidade única" descricao="um saldo só" onPress={() => p.onStockMode("single")} />
            {comLote ? (
              <Radio ativo={p.stockMode === "lots"} titulo="Por lote e tonalidade" descricao="cada pilha tem seu saldo" onPress={() => p.onStockMode("lots")} />
            ) : null}
            {comGrade ? (
              <Radio ativo={p.stockMode === "variants"} titulo={perfil.estoque.rotuloDaGrade} descricao="fio, cano, parafuso" onPress={() => p.onStockMode("variants")} />
            ) : null}
          </View>
        ) : (
          <View style={[fr.radios, p.narrow && { flexDirection: "column" }]}>
            <Radio ativo={p.stockMode === "single"} titulo="Quantidade única" onPress={() => p.onStockMode("single")} />
            <Radio ativo={p.stockMode === "variants"} titulo="Por cor e tamanho" onPress={() => p.onStockMode("variants")} />
          </View>
        )}
      </Campo>

      {matcon && p.stockMode === "lots" ? (
        <View style={{ marginBottom: 12 }}>
          <View style={st.grade}>
            {!p.narrow && (
              <View style={[st.linha, st.linhaCab]}>
                <Text style={[st.cab, { flex: 1 }]}>Lote</Text>
                <Text style={[st.cab, { flex: 1 }]}>Tonalidade</Text>
                <Text style={[st.cab, { flex: 0.8 }]}>Bitola</Text>
                <Text style={[st.cab, { flex: 1.1, textAlign: "right" }]}>{"Tenho (" + unidadeFrase + ")"}</Text>
                <View style={{ width: 22 }} />
              </View>
            )}
            {lotes.map((l, i) => {
              const q = lerQtd(l.qtd || "");
              const cx = q ? caixas(q) : null;
              return (
                <View key={l.id} style={[st.linha, p.narrow && { flexWrap: "wrap" as const }]}>
                  <Entrada
                    value={l.codigo}
                    onChangeText={(v: string) => mudarLote(l.id, "codigo", v)}
                    placeholder="Lote"
                    accessibilityLabel={"Lote da linha " + (i + 1)}
                    dataSet={ENTER_LOCAL}
                    style={[p.narrow ? st.loteMeia : { flex: 1 }, st.celula]}
                  />
                  <Entrada
                    value={l.tonalidade}
                    onChangeText={(v: string) => mudarLote(l.id, "tonalidade", v)}
                    placeholder="Tonalidade"
                    accessibilityLabel={"Tonalidade da linha " + (i + 1)}
                    dataSet={ENTER_LOCAL}
                    style={[p.narrow ? st.loteMeia : { flex: 1 }, st.celula]}
                  />
                  <Entrada
                    value={l.bitola}
                    onChangeText={(v: string) => mudarLote(l.id, "bitola", v)}
                    placeholder="Bitola"
                    accessibilityLabel={"Bitola da linha " + (i + 1)}
                    dataSet={ENTER_LOCAL}
                    style={[p.narrow ? st.loteMeia : { flex: 0.8 }, st.celula]}
                  />
                  <View style={p.narrow ? st.loteMeia : { flex: 1.1 }}>
                    <Entrada
                      value={l.qtd}
                      onChangeText={(v: string) => mudarLote(l.id, "qtd", v)}
                      placeholder="0"
                      keyboardType={tecladoQtd}
                      accessibilityLabel={"Quanto tenho na linha " + (i + 1)}
                      dataSet={ENTER_LOCAL}
                      style={[st.celula, { textAlign: "right" }]}
                    />
                    {cx ? <Text style={st.loteCaixas}>{cx}</Text> : null}
                  </View>
                  {lotes.length > 1 ? (
                    <Pressable
                      onPress={() => p.onLotes?.(lotes.filter((x) => x.id !== l.id))}
                      hitSlop={8}
                      style={st.loteRm}
                      accessibilityLabel={"Tirar a linha " + (i + 1)}
                    >
                      <Text style={s.chipRm}>×</Text>
                    </Pressable>
                  ) : <View style={{ width: 22 }} />}
                </View>
              );
            })}
            <View style={[st.linha, { borderBottomWidth: 0 }]}>
              <Chip label="+ outro lote na prateleira" dashed onPress={() => p.onLotes?.([...lotes, novaLinhaDeLote()])} />
            </View>
            <View style={st.loteTotal}>
              <Text style={fr.fraseTxt}>
                {"Total " + fmtQty(totalLotes, unidadeFrase) + " em " + lotesValidos.length + (lotesValidos.length === 1 ? " lote" : " lotes")}
              </Text>
              {caixasDosLotes ? <Text style={fr.fraseMono}>{"(= " + caixasDosLotes + ")"}</Text> : null}
            </View>
          </View>
          <View style={[fr.frase, { marginTop: 8 }]}>
            <Text style={fr.fraseTxt}>Me avise abaixo de</Text>
            {minimoNaFrase}
            <Text style={fr.fraseTxt}>{unidadeFrase + "."}</Text>
          </View>
          <Text style={s.hint}>
            Só o que já está na prateleira hoje. Daqui pra frente o lote entra sozinho quando você importa a nota do fornecedor.
          </Text>
        </View>
      ) : p.stockMode === "single" ? (
        lojas ? estoquePorLoja(lojas) : matcon ? (
          // Perfil Matcon: a frase do mockup em qualquer unidade — com
          // vírgula nas fracionadas (m², kg…), inteira no saco e na barra.
          <View style={{ marginBottom: 12 }}>
            <View style={fr.frase}>
              <Text style={fr.fraseTxt}>Tenho</Text>
              <Entrada
                value={p.estoque}
                onChangeText={(v: string) => p.onEstoque(filtroQtd(v))}
                onSubmitEditing={p.onSubmit}
                placeholder="0"
                keyboardType={tecladoQtd}
                accessibilityLabel="Quanto tenho em estoque"
                style={fr.fraseInput}
              />
              {/* 23/09/2026 (QA em produção): a vírgula ia num Text à parte,
                  e o gap da frase (flex row) abria um espaço visível antes
                  dela ("em estoque , e me avise"). A vírgula agora fecha o
                  texto anterior — do estoque ou da caixa — sem esse espaço. */}
              <Text style={fr.fraseTxt}>{unidadeFrase + " em estoque" + (caixasDoEstoque ? "" : ",")}</Text>
              {caixasDoEstoque ? (
                <Text style={fr.fraseMono}>{"(≈ " + caixasDoEstoque + "),"}</Text>
              ) : null}
              <Text style={fr.fraseTxt}>e me avise abaixo de</Text>
              {minimoNaFrase}
              <Text style={fr.fraseTxt}>{unidadeFrase + "."}</Text>
            </View>
            <Text style={s.hint}>Estoque mínimo. Aparece na aba Alertas.</Text>
          </View>
        ) : (
        <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 0 }]}>
          <Campo label="Quantidade atual" style={{ flex: 1, marginBottom: 0 }}>
            <Entrada
              value={p.estoque}
              onChangeText={(v: string) => p.onEstoque(v.replace(/\D/g, ""))}
              onSubmitEditing={p.onSubmit}
              placeholder="0"
              keyboardType="number-pad"
            />
          </Campo>
          <Campo label="Avisar quando chegar em" style={{ flex: 1, marginBottom: 0 }}>
            <Entrada
              value={p.minimo}
              onChangeText={(v: string) => p.onMinimo(v.replace(/\D/g, ""))}
              onSubmitEditing={p.onSubmit}
              placeholder="0"
              keyboardType="number-pad"
            />
            <Text style={s.hint}>Estoque mínimo. Aparece na aba Alertas.</Text>
          </Campo>
        </View>
        )
      ) : (
        <View>
          {p.avisoDoPai ? (
            <View style={{ marginBottom: 12 }}>
              <Nota>
                <Text style={s.notaTxt}>{p.avisoDoPai}</Text>
              </Nota>
            </View>
          ) : null}

          <View style={[s.linha2, p.narrow && { flexDirection: "column", gap: 0 }]}>
            <Campo label="Cores" style={{ flex: 1 }}>
              {/* 14/11/2026 (CP4a): paleta com nome e busca, nome próprio com
                  amostra e renomear tocando na cor (EditorDeCor.tsx). */}
              <EditorDeCor
                cores={C} onCores={p.onCores} narrow={p.narrow}
                produto={p.nomeDoProduto} tamanhoExemplo={Z[0] || null}
              />
            </Campo>

            <Campo label={perfil.estoque.rotuloDosTamanhos} style={{ flex: 1 }}>
              <View style={s.chips}>
                {Z.map((z) => (
                  <Chip key={z} valor label={z} onRemove={() => p.onTamanhos(Z.filter((x) => x !== z))} removeLabel={"Remover " + z} />
                ))}
                <Chip label={perfil.estoque.botaoDeTamanho} dashed onPress={() => setAbrirTam(!abrirTam)} />
                {/* 18/10/2026 (p-35): grades prontas num toque, mescladas com o
                   que já existe. Fora do Matcon (lá são medidas). Some quando
                   todos os tamanhos do atalho já estão na lista. */}
                {!matcon && ATALHOS_DE_TAMANHO.map((a) => (
                  faltaAlgum(a.tamanhos) ? (
                    <Chip
                      key={a.rotulo}
                      label={a.rotulo}
                      icon="plus"
                      dashed
                      accessibilityLabel={a.acessivel}
                      onPress={() => p.onTamanhos(juntarTamanhos(p.tamanhos, a.tamanhos))}
                    />
                  ) : null
                ))}
              </View>
              {abrirTam && (
                <>
                  <View style={[s.linha2, { marginTop: 8 }]}>
                    <Entrada
                      nativeID={ID_NOVO_TAM}
                      value={novoTam}
                      onChangeText={setNovoTam}
                      onSubmitEditing={addTam}
                      blurOnSubmit={false}
                      placeholder={perfil.estoque.exemploDeTamanho}
                      style={{ flex: 1 }}
                      dataSet={ENTER_LOCAL}
                      autoFocus
                    />
                    <Pressable onPress={addTam} style={st.addBtn} accessibilityLabel="Adicionar tamanho">
                      <Icon name="plus" size={14} color="#fff" />
                    </Pressable>
                  </View>
                  <Text testID="dica-tamanhos" style={[s.hint, st.dicaTam]}>
                    {matcon ? "Separe por vírgula e espaço (1,5 mm, 2,5 mm)" : "Separe por vírgula"}
                  </Text>
                </>
              )}
            </Campo>
          </View>

          {seletorDaGrade}

          {matriz && emCartoes ? (
            <GradeEmCartoes
              cores={C} tamanhos={Z}
              celulas={p.celulas} onCelula={p.onCelula}
              unidade={p.unidade} matcon={matcon}
            />
          ) : null}

          {matriz && !emCartoes && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.grade} contentContainerStyle={{ minWidth: "100%" }}>
              <View>
                <View style={[st.linha, st.linhaCab]}>
                  <Text style={[st.cab, st.colNome]}>Estoque</Text>
                  {Z.map((z) => <Text key={z} style={[st.cab, st.colCelula]}>{z}</Text>)}
                </View>
                {C.map((c) => (
                  <View key={c.hex} style={st.linha}>
                    <View style={[st.colNome, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                      <View style={[st.sw, { backgroundColor: c.hex }]} />
                      <Text style={st.nomeCel} numberOfLines={1}>{c.name || c.hex}</Text>
                    </View>
                    {Z.map((z) => {
                      const k = matrixKey(c.hex, z);
                      return (
                        <Entrada
                          key={k}
                          value={p.celulas[k] ?? ""}
                          onChangeText={(v: string) => p.onCelula(k, v.replace(/\D/g, ""))}
                          placeholder="0"
                          keyboardType="number-pad"
                          selectTextOnFocus
                          accessibilityLabel={"Estoque de " + (c.name || c.hex) + " " + z}
                          dataSet={ENTER_LOCAL}
                          style={[st.colCelula, st.celula]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Códigos de barras por combinação. Na grade cor × tamanho não
              cabem ao lado do estoque; o editor antigo tinha esta lista e
              ela tinha sumido. Fechada por padrão (a maioria não usa), com
              a contagem no cabeçalho pra dizer o que falta sem abrir. */}
          {matriz && (
            <View style={[st.grade, { marginTop: 8 }]}>
              <View style={[st.linha, st.linhaCab, !abrirBarras && { borderBottomWidth: 0 }]}>
                <Pressable
                  onPress={() => setAbrirBarras(!abrirBarras)}
                  style={st.barrasToggle}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: abrirBarras }}
                  accessibilityLabel={"Códigos de barras, " + barrasPreenchidas + " de " + combos.length + " preenchidos"}
                >
                  <Icon name={abrirBarras ? "chevron_down" : "chevron_right"} size={14} color={Colors.ink3} />
                  <Text style={st.barrasTit} numberOfLines={1}>
                    Códigos de barras
                    <Text style={st.barrasConta}>{" · " + barrasPreenchidas + " de " + combos.length + " preenchidos"}</Text>
                  </Text>
                </Pressable>
                {barrasPreenchidas < combos.length && (
                  <View style={st.miniCaixa}>
                    <MiniBtn
                      label={"Gerar os que faltam (" + (combos.length - barrasPreenchidas) + ")"}
                      onPress={() => { gerarFaltantes(combos.map((r) => r.k)); setAbrirBarras(true); }}
                    />
                  </View>
                )}
              </View>
              {abrirBarras && combos.map((r, i) => (
                <View key={r.k} style={[st.linha, p.narrow && st.linhaEmPe]}>
                  <View style={[p.narrow ? null : st.colBarraNome, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                    <View style={[st.sw, { backgroundColor: r.hex }]} />
                    <Text style={st.nomeCel} numberOfLines={1}>{r.nome}</Text>
                  </View>
                  <View style={[st.barraComGerar, p.narrow ? { alignSelf: "stretch" as const } : { flex: 1 }]}>
                    <Entrada
                      nativeID={"estoque-barra-" + i}
                      value={p.barras[r.k] ?? ""}
                      onChangeText={(v: string) => p.onBarra(r.k, v)}
                      onSubmitEditing={() => focarBarra(i + 1)}
                      blurOnSubmit={false}
                      placeholder="Bipe, digite ou gere"
                      accessibilityLabel={"Código de barras de " + r.nome}
                      dataSet={ENTER_LOCAL}
                      style={[{ flex: 1 }, st.celula]}
                    />
                    {!(p.barras[r.k] ?? "").trim() && <MiniBtn label="Gerar" onPress={() => gerarBarra(r.k)} />}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Nenhuma cor nem tamanho ainda: a grade só nasce quando a pessoa
              adiciona. Sem este aviso, salvava-se o produto achando que ela
              aparecia sozinha (INC-2026-10-17-02). */}
          {!matriz && !umEixo && (
            <View style={st.semGrade} testID="estoque-sem-grade">
              <Text style={s.hint}>
                {"Adicione as cores e " + (matcon ? "as medidas" : "os tamanhos") + " acima para preencher o estoque de cada variação."}
              </Text>
            </View>
          )}

          {umEixo && (
            <View style={st.grade}>
              <View style={[st.linha, st.linhaCab]}>
                <Text style={[st.cab, { flex: 1 }]}>{C.length ? "Cor" : (matcon ? "Medida" : "Tamanho")}</Text>
                <Text style={[st.cab, { width: 72 }]}>Estoque</Text>
                {!p.narrow && <Text style={[st.cab, { flex: 1 }]}>Cód. barras</Text>}
                {faltamUmEixo > 0 && (
                  <View style={st.miniCaixa}>
                    <MiniBtn
                      label={p.narrow ? "Gerar códigos (" + faltamUmEixo + ")" : "Gerar os que faltam (" + faltamUmEixo + ")"}
                      onPress={() => gerarFaltantes(linhasUmEixo.map((r) => r.k))}
                    />
                  </View>
                )}
              </View>
              {linhasUmEixo.map((r) => (
                <View key={r.k} style={[st.linha, p.narrow && { flexWrap: "wrap" as const }]}>
                  <View style={{ flex: 1, minWidth: 90, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {r.hex ? <View style={[st.sw, { backgroundColor: r.hex }]} /> : null}
                    <Text style={st.nomeCel} numberOfLines={1}>{r.nome}</Text>
                  </View>
                  <Entrada
                    value={p.celulas[r.k] ?? ""}
                    onChangeText={(v: string) => p.onCelula(r.k, v.replace(/\D/g, ""))}
                    placeholder="0"
                    keyboardType="number-pad"
                    selectTextOnFocus
                          accessibilityLabel={"Estoque de " + r.nome}
                    dataSet={ENTER_LOCAL}
                    style={[{ width: 72 }, st.celula]}
                  />
                  {/* Celular: o código de barras não cabe ao lado — cai para a
                      linha de baixo, inteiro, em vez de sumir. */}
                  <View style={[st.barraComGerar, p.narrow ? { width: "100%" as any } : { flex: 1 }]}>
                    <Entrada
                      value={p.barras[r.k] ?? ""}
                      onChangeText={(v: string) => p.onBarra(r.k, v)}
                      placeholder="Cód. barras: bipe, digite ou gere"
                      accessibilityLabel={"Código de barras de " + r.nome}
                      dataSet={ENTER_LOCAL}
                      style={[{ flex: 1 }, st.celula]}
                    />
                    {!(p.barras[r.k] ?? "").trim() && <MiniBtn label="Gerar" onPress={() => gerarBarra(r.k)} />}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={s.hint}>
            {"Preço é o mesmo para todas. " +
              (p.modoEdicao ? "A grade vai junto no Salvar." : "A grade é criada junto com o produto.")}
          </Text>
          {lojas ? (
            <Text style={s.hint} testID="grade-nota-das-lojas">
              {"As cores e os tamanhos são os mesmos " + (lojas.linhas.length === 2 ? "nas duas lojas" : "nas " + lojas.linhas.length + " lojas") + ". Só a quantidade muda."}
            </Text>
          ) : null}
        </View>
      )}
    </Secao>
  );
}

// ── p-201 · grade em cartões (celular) ──────────────────────
//
// Mockup "Grade no celular" (aprovado em 23/11/2026). Até 560 px a tabela
// cortava a última coluna; aqui cada cor é um cartão com o total dela no
// cabeçalho e os tamanhos numa grade que quebra linha (campo de 44 px,
// tamanho escrito em cima, sem rolar para o lado). O total do produto vem
// acima da lista. As células são as MESMAS da tabela (matrixKey), com o
// mesmo filtro e o mesmo rótulo de acessibilidade: só o desenho muda.
const LARGURA_MIN_DO_TAMANHO = 76;
const VAO_DOS_TAMANHOS = 8;

// "12 peças", "1 par", "6 pares". Fora do Matcon o "un" da grade se lê
// como peça (é o que a seção já diz em "Quantas peças em cada loja?").
export function totalComUnidadeDaGrade(n: number, unidade: string, matcon: boolean): string {
  const u = String(unidade || "").trim();
  if (!matcon && (u === "" || u === "un")) return fmtQty(n) + (n === 1 ? " peça" : " peças");
  return qtdComUnidade(n, u);
}

function GradeEmCartoes(p: {
  cores: CorDoItem[];
  tamanhos: string[];
  celulas: Record<string, string>;
  onCelula: (chave: string, v: string) => void;
  unidade: string;
  matcon: boolean;
}) {
  // Largura medida da área dos tamanhos: decide quantos cabem por linha e
  // dá a todos a mesma largura (a última linha não estica). Antes da
  // primeira medida, flex com base de 76 px.
  const [larg, setLarg] = useState(0);
  const cols = larg > 0 ? Math.max(1, Math.floor((larg + VAO_DOS_TAMANHOS) / (LARGURA_MIN_DO_TAMANHO + VAO_DOS_TAMANHOS))) : 0;
  const larguraDoItem = cols ? { width: Math.floor((larg - VAO_DOS_TAMANHOS * (cols - 1)) / cols) } : st.tamItemFlex;
  const medir = (e: any) => {
    const w = Math.round(e?.nativeEvent?.layout?.width || 0);
    if (w > 0 && w !== larg) setLarg(w);
  };
  const chavesDaCor = (hex: string) => p.tamanhos.map((z) => matrixKey(hex, z));
  const totalDoProduto = totalDasCelulas(p.celulas, p.cores.flatMap((c) => chavesDaCor(c.hex)));

  return (
    <View testID="grade-em-cartoes">
      <View style={st.totalBar}>
        <Text style={st.totalBarTxt}>Total do produto</Text>
        <Text style={st.totalBarNum} testID="grade-total-do-produto">
          {totalComUnidadeDaGrade(totalDoProduto, p.unidade, p.matcon)}
        </Text>
      </View>
      {p.cores.map((c) => {
        const nome = c.name || c.hex;
        return (
          <View key={c.hex} style={st.corCartao} testID={"grade-cartao-" + c.hex} accessibilityLabel={nome}>
            <View style={st.corCab}>
              <View style={[st.sw, { backgroundColor: c.hex }]} />
              <Text style={st.corNome} numberOfLines={1}>{nome}</Text>
              <Text style={st.corTotal} testID={"grade-total-" + c.hex}>
                {totalComUnidadeDaGrade(totalDasCelulas(p.celulas, chavesDaCor(c.hex)), p.unidade, p.matcon)}
              </Text>
            </View>
            <View style={st.corCorpo}>
              <View style={st.tamGrade} onLayout={medir}>
                {p.tamanhos.map((z) => {
                  const k = matrixKey(c.hex, z);
                  const v = p.celulas[k] ?? "";
                  return (
                    <View key={k} style={larguraDoItem}>
                      <Text style={st.tamRotulo} numberOfLines={1}>{z}</Text>
                      <Entrada
                        value={v}
                        onChangeText={(t: string) => p.onCelula(k, t.replace(/\D/g, ""))}
                        placeholder="0"
                        keyboardType="number-pad"
                        selectTextOnFocus
                        accessibilityLabel={"Estoque de " + nome + " " + z}
                        dataSet={ENTER_LOCAL}
                        style={[st.tamCampo, v === "0" && { color: Colors.ink3 }]}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const st = {
  // p-201 · grade em cartões (ver GradeEmCartoes).
  totalBar: {
    flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const,
    gap: 8, paddingHorizontal: 4, paddingTop: 2, paddingBottom: 10,
  },
  totalBarTxt: { fontFamily: Fonts.body, fontSize: 13, color: Colors.ink3 },
  totalBarNum: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: "500" as const, color: Colors.ink },
  corCartao: {
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    backgroundColor: Colors.bg3, overflow: "hidden" as const,
  },
  corCab: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  corNome: { flex: 1, minWidth: 0, fontFamily: Fonts.body, fontSize: 14, fontWeight: "700" as const, color: Colors.ink },
  corTotal: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: "500" as const, color: Colors.violet3, flexShrink: 0 },
  corCorpo: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  tamGrade: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: VAO_DOS_TAMANHOS },
  tamItemFlex: { flexBasis: LARGURA_MIN_DO_TAMANHO, flexGrow: 1 },
  tamRotulo: {
    fontFamily: Fonts.mono, fontSize: 11, fontWeight: "500" as const, letterSpacing: 0.4,
    color: Colors.ink3, marginBottom: 4,
  },
  tamCampo: {
    height: 44, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 11,
    fontFamily: Fonts.mono, fontSize: 16, fontWeight: "500" as const, textAlign: "center" as const,
  },
  // 20/11/2026 (em qual loja o produto entra): linha por loja, 44 px no toque.
  lojaLinha: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10, minHeight: 44,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3,
  },
  lojaNome: { fontSize: 13.5, fontWeight: "600" as const, color: Colors.ink },
  lojaDica: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  lojaQtd: { width: 84, textAlign: "center" as const, fontWeight: "600" as const, flexShrink: 0 },
  seg: {
    flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 2, padding: 2, borderRadius: 9,
    alignSelf: "flex-start" as const, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  segBtn: { minHeight: 44, justifyContent: "center" as const, borderRadius: 7, paddingHorizontal: 12 },
  segBtnOn: { backgroundColor: Colors.violet },
  segTxt: { fontSize: 12.5, fontWeight: "600" as const, color: Colors.ink3 },
  // 22/09/2026 (Matcon M4 no cadastro) — tabela de lotes. A frase e as
  // opções de rádio moraram aqui e foram para ui.tsx (`fr`, `Radio`).
  loteMeia: { width: "46%" as any, flexGrow: 1 },
  loteCaixas: { fontSize: 10, color: Colors.ink3, textAlign: "right" as const, marginTop: 2 },
  loteRm: { width: 22, alignItems: "center" as const, justifyContent: "center" as const, minHeight: 36 },
  loteTotal: {
    flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Colors.violetD,
    borderTopWidth: 1, borderTopColor: Colors.border2,
  },
  grade: {
    marginTop: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: 9,
    backgroundColor: Colors.bg3, overflow: "hidden" as const,
  },
  semGrade: {
    marginTop: 4, borderWidth: 1, borderStyle: "dashed" as const, borderColor: Colors.border2, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  linha: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  // Celular: rótulo em cima, input inteiro embaixo.
  linhaEmPe: { flexDirection: "column" as const, alignItems: "stretch" as const, gap: 4, paddingVertical: 7 },
  linhaCab: { backgroundColor: Colors.bg4 },
  cab: { fontSize: 10.5, letterSpacing: 0.3, textTransform: "uppercase" as const, color: Colors.ink3, fontWeight: "700" as const },
  colNome: { width: 116 },
  colCelula: { width: 56 },
  colBarraNome: { width: 150 },
  celula: { paddingHorizontal: 8, paddingVertical: 6, fontSize: 12.5 },
  nomeCel: { fontSize: 12.5, color: Colors.ink, flexShrink: 1 },
  sw: { width: 12, height: 12, borderRadius: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  barrasToggle: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  // MiniBtn não tem padding vertical: esta caixa dá a altura da linha a ele.
  miniCaixa: { alignSelf: "stretch" as const, flexDirection: "row" as const, minHeight: 30 },
  barraComGerar: { flexDirection: "row" as const, alignItems: "stretch" as const, gap: 6 },
  barrasTit: { flex: 1, fontSize: 12.5, color: Colors.ink, fontWeight: "700" as const, paddingVertical: 4 },
  barrasConta: { color: Colors.ink3, fontWeight: "500" as const },
  addBtn: {
    width: 40, borderRadius: 9, backgroundColor: Colors.violet,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  // Dica do campo de tamanho: ink2 em vez do ink3 da dica comum, para ler
  // bem no tema escuro (token do tema, troca sozinho no claro).
  dicaTam: { color: Colors.ink2 },
};

export default SecaoEstoque;
