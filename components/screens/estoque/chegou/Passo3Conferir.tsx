// ============================================================
// AURA. — "Chegou mercadoria" · Passo 3: conferir linha a linha (A4a, A4b)
//
// Mockup estoque-portas-mockup-17-11.html, parte 4 ("Passo 3 · Conferir
// linha a linha" e "no celular"). As contas e os estados vêm prontos do
// chegouRegras (conferirLinha, resumirConferencia, linhasVisiveis); aqui só
// há tela.
//
// A4a: estados da linha: pronta (com "achado pelo …"), "Confere?" (custo
// bem acima do de costume: pergunta e não trava), sem par (cadastrar novo,
// ligar a um produto ou deixar de fora), quantidade zero (fica de fora
// sozinha, "Dizer quantos") e grade (produto de cores e tamanhos).
//
// A4b: os painéis da linha:
//   - "Produto novo": nome, preço de venda (obrigatório; sugerido pela
//     margem, e digitado sem sugestão por quem não vê custo), categoria,
//     margem e NCM da nota;
//   - "Ligar a um produto": busca; ao ligar, o backend guarda o código do
//     fornecedor; "Trocar produto" usa a mesma busca;
//   - grade: "Quantas chegaram de cada?" (GradeDaEntrada, a mesma escolha
//     da Entrada de mercadoria de hoje);
//   - "Preço dos produtos novos": margem do lote.
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { companiesApi } from "@/services/api";
import { maskCurrency } from "@/utils/masks";
import { fmtQty } from "@/utils/matconUnits";
import { numeroPositivo } from "@/utils/entradaDeMercadoria";
import { GradeDaEntrada } from "@/components/screens/estoque/GradeDaEntrada";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import {
  linhasVisiveis, margemSobreCusto, somaDaGrade, buscarProdutos,
  type LinhaConferida, type ResumoDaConferencia, type DecisaoDaLinha, type AjusteDaLinha, type ProdutoDaLoja,
} from "./chegouRegras";

const brl = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? "—"
    : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "12,50" a partir de 12.5, para o campo com máscara. */
const paraCampo = (n: number | null | undefined) => (Number(n) > 0 ? maskCurrency(String(Math.round(Number(n) * 100))) : "");

type Props = {
  estreito: boolean;
  semCusto: boolean;
  companyId: string;
  /** "Nota 004512 · 14/11" ou o nome da planilha. */
  titulo: string;
  /** Total que o arquivo diz ter (nota); null = não compara. */
  totalEsperado: number | null;
  linhas: LinhaConferida[];
  resumo: ResumoDaConferencia;
  produtos: ProdutoDaLoja[];
  /** Há fornecedor: ligar guarda o código dele. */
  comFornecedor: boolean;
  /** Códigos do fornecedor ainda chegando: a conferência espera. */
  carregando: boolean;
  mostrarTodas: boolean;
  onMostrarTodas: () => void;
  usarMedio: boolean;
  onUsarMedio: (v: boolean) => void;
  margemDosNovos: number;
  onAplicarMargem: (pct: number) => void;
  /** Decisão da linha (n do item); null desfaz. */
  onDecidir: (n: number, d: DecisaoDaLinha | null) => void;
  onAjustar: (n: number, a: Partial<AjusteDaLinha>) => void;
  /** "Cadastrar novo" já preenchido (nome da nota, preço sugerido). */
  novoPara: (l: LinhaConferida) => DecisaoDaLinha;
  /** A6: de onde vieram as linhas (muda o texto da quantidade zero). */
  fonte?: "nota" | "planilha";
  /** A7: o que o servidor recusou em cada linha (n -> motivo). */
  errosDasLinhas?: Record<number, string>;
  /**
   * F2: planilha sem quantidade. Só liga os produtos ao fornecedor, com o
   * custo dela: sem quantidade, sem estoque, sem grade, sem custo médio.
   */
  soLigar?: { fornecedor: string } | null;
};

export function Passo3Conferir(p: Props) {
  const [margemTxt, setMargemTxt] = useState(String(p.margemDosNovos));
  if (p.carregando) {
    return (
      <View style={s.lendo} testID="chegou-conferindo">
        <ActivityIndicator size="small" color={Colors.violet3} />
        <Text style={s.lendoTitulo}>{T.lendoTitulo}</Text>
        <Text style={s.apoio}>{T.lendoTexto}</Text>
      </View>
    );
  }
  const { visiveis, escondidas } = linhasVisiveis(p.linhas, p.mostrarTodas);
  const r = p.resumo;

  const tile = (rotulo: string, valor: string, id: string, cor?: string) => (
    <View style={[s.tile, p.estreito && s.tileEstreito]} key={id} testID={"chegou-resumo-" + id}>
      <Text style={s.tileRotulo}>{rotulo}</Text>
      <Text style={[s.tileValor, cor ? { color: cor } : null]}>{valor}</Text>
    </View>
  );

  if (p.soLigar) {
    const problemas = p.linhas.filter((l) => l.estado === "erro").length;
    return (
      <View style={{ gap: 12 }} testID="chegou-passo-3">
        <View style={s.resumo}>
          <Text style={s.resumoNota}>{p.titulo}</Text>
          <View style={s.faixaAzul} testID="chegou-so-ligar">
            <Icon name="info" size={16} color={Colors.violet3} />
            <Text style={[s.apoio, { flex: 1 }]}>{T.soLigarFaixa(p.soLigar.fornecedor)}</Text>
          </View>
          <View style={s.tiles}>
            {tile(T.soLigarAchados, String(r.prontos), "achados", Colors.green)}
            {tile(T.soLigarCadastrar, String(r.novos), "cadastrar", Colors.violet3)}
            {tile(T.soLigarFalta, String(r.falta), "falta", r.falta ? Colors.amber : undefined)}
            {tile(T.soLigarProblema, String(problemas), "problema", problemas ? Colors.red : undefined)}
          </View>
          {!p.semCusto && r.novos > 0 ? (
            <View style={s.margem} testID="chegou-margem-dos-novos">
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={s.checkTxt}>{T.margemTitulo}</Text>
                <Text style={s.apoioPeq}>{T.margemRotulo}</Text>
              </View>
              <View style={s.comSufixo}>
                <TextInput
                  value={margemTxt}
                  onChangeText={(t) => setMargemTxt(t.replace(/[^\d]/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  style={[s.input, { width: 80 }] as any}
                  accessibilityLabel={T.margemRotulo}
                  testID="chegou-margem-campo"
                />
                <Text style={s.apoio}>%</Text>
              </View>
              <Pressable onPress={() => p.onAplicarMargem(Number(margemTxt) || 0)} style={s.btnSec} accessibilityRole="button" testID="chegou-margem-aplicar">
                <Text style={s.btnSecTxt}>{T.margemAplicar}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {!p.estreito && (
          <View style={s.cabecalho}>
            <Text style={[s.colTxt, s.col1]}>{T.colItemDaLista}</Text>
            {!p.semCusto && <Text style={[s.colTxt, s.col3]}>{T.colCustoDoFornecedor}</Text>}
            <Text style={[s.colTxt, s.col4]} />
          </View>
        )}

        <View style={{ gap: 8 }}>
          {visiveis.map((l) => (
            <LinhaDaConferencia key={l.item.n} l={l} {...p} />
          ))}
        </View>

        {escondidas > 0 && (
          <Pressable onPress={p.onMostrarTodas} style={s.mostrar} accessibilityRole="button" testID="chegou-mostrar-outros">
            <Icon name="chevron_down" size={14} color={Colors.violet3} />
            <Text style={s.mostrarTxt}>{T.mostrarOutros(escondidas)}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }} testID="chegou-passo-3">
      <View style={s.resumo}>
        <Text style={s.resumoNota}>{p.titulo}</Text>
        <View style={s.tiles}>
          {tile(T.resumoItens, String(r.itens), "itens")}
          {tile(T.resumoProntos, String(r.prontos), "prontos", Colors.green)}
          {tile(T.resumoNovos, String(r.novos), "novos", Colors.violet3)}
          {tile(T.resumoFalta, String(r.falta), "falta", r.falta ? Colors.amber : undefined)}
          {tile(T.resumoFora, String(r.fora), "fora")}
          {!p.semCusto && tile(T.resumoTotal, brl(r.totalDosItens), "total")}
        </View>
        {!p.semCusto && p.totalEsperado !== null && r.bate !== null ? (
          <Text style={[s.bate, !r.bate && { color: Colors.amber }]} testID="chegou-total-bate">
            {r.bate ? T.totalBate(brl(p.totalEsperado)) : T.totalNaoBate(brl(r.totalDosItens), brl(p.totalEsperado))}
          </Text>
        ) : null}
        {!p.semCusto && r.novos > 0 ? (
          <View style={s.margem} testID="chegou-margem-dos-novos">
            <View style={{ flex: 1, minWidth: 160 }}>
              <Text style={s.checkTxt}>{T.margemTitulo}</Text>
              <Text style={s.apoioPeq}>{T.margemRotulo}</Text>
            </View>
            <View style={s.comSufixo}>
              <TextInput
                value={margemTxt}
                onChangeText={(t) => setMargemTxt(t.replace(/[^\d]/g, "").slice(0, 4))}
                keyboardType="number-pad"
                style={[s.input, { width: 80 }] as any}
                accessibilityLabel={T.margemRotulo}
                testID="chegou-margem-campo"
              />
              <Text style={s.apoio}>%</Text>
            </View>
            <Pressable
              onPress={() => p.onAplicarMargem(Number(margemTxt) || 0)}
              style={s.btnSec}
              accessibilityRole="button"
              testID="chegou-margem-aplicar"
            >
              <Text style={s.btnSecTxt}>{T.margemAplicar}</Text>
            </Pressable>
          </View>
        ) : null}
        {!p.semCusto ? (
          <Pressable
            style={s.check}
            onPress={() => p.onUsarMedio(!p.usarMedio)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: p.usarMedio }}
            testID="chegou-usar-medio"
          >
            <View style={[s.caixa, !p.usarMedio && s.caixaDesligada]}>{p.usarMedio ? <Icon name="check" size={11} color="#fff" /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.checkTxt}>{T.usarMedio}</Text>
              <Text style={s.apoioPeq}>{T.usarMedioApoio}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {!p.estreito && (
        <View style={s.cabecalho}>
          <Text style={[s.colTxt, s.col1]}>{T.colItem}</Text>
          <Text style={[s.colTxt, s.col2]}>{T.colChegou}</Text>
          {!p.semCusto && <Text style={[s.colTxt, s.col3]}>{T.colCusto}</Text>}
          <Text style={[s.colTxt, s.col4]}>{T.colEstoque}</Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        {visiveis.map((l) => (
          <LinhaDaConferencia key={l.item.n} l={l} {...p} />
        ))}
      </View>

      {escondidas > 0 && (
        <Pressable onPress={p.onMostrarTodas} style={s.mostrar} accessibilityRole="button" testID="chegou-mostrar-outros">
          <Icon name="chevron_down" size={14} color={Colors.violet3} />
          <Text style={s.mostrarTxt}>{T.mostrarOutros(escondidas)}</Text>
        </Pressable>
      )}
    </View>
  );
}

function LinhaDaConferencia(props: Props & { l: LinhaConferida }) {
  const { l, estreito, semCusto, onDecidir, onAjustar, novoPara } = props;
  const soLigar = !!props.soLigar;
  const [corrigindo, setCorrigindo] = useState(false);
  const [custoTxt, setCustoTxt] = useState("");
  const [dizendo, setDizendo] = useState(false);
  const [qtdTxt, setQtdTxt] = useState("");
  const [trocando, setTrocando] = useState(false);
  const n = l.item.n;
  const un = l.produto && l.produto.unit && l.produto.unit !== "un" ? l.produto.unit : "un";
  const cod = l.item.codigoFornecedor ? " · " + T.codigoDoItem(l.item.codigoFornecedor) : "";
  const decisaoTipo = l.decisao ? l.decisao.tipo : null;
  const semDecisao = l.estado === "sem_par" || l.estado === "novo" || l.estado === "ligar"
    || (l.estado === "fora" && decisaoTipo === "fora");
  // Grade: produto de cores e tamanhos que não casou pelo código de UMA variante.
  const usaGrade = !soLigar && !!l.produto && !!l.produto.has_variants
    && (l.estado === "grade" || ((l.estado === "pronta" || l.estado === "confere") && !(l.par && l.par.daVariante && !l.variantes)));
  const ligarAberto = trocando || (l.estado === "ligar");

  let titulo = l.item.descricao;
  if (l.produto) titulo = l.produto.name;
  if (l.estado === "sem_par") titulo = T.semParTitulo;
  if (l.estado === "novo") titulo = T.produtoNovo;
  if (l.estado === "ligar") titulo = T.ligarProduto;

  const tom =
    l.estado === "sem_par" || l.estado === "ligar" || l.estado === "grade" || l.estado === "confere" || (l.estado === "novo" && l.falta)
      ? s.linhaAmbar
      : l.estado === "erro"
        ? s.linhaVermelha
        : l.estado === "fora"
          ? s.linhaApagada
          : l.estado === "novo"
            ? s.linhaVioleta
            : null;

  // Coluna "Estoque e custo médio" (ou o quadro vivo da decisão).
  let direita: ReactNode = null;
  if (l.previa && l.produto && (l.estado === "pronta" || l.estado === "confere")) {
    const pv = l.previa;
    direita = (
      <View style={{ gap: 2 }}>
        <Text style={s.previa}>{T.previaEstoque(fmtQty(pv.estoqueAntes), fmtQty(pv.estoqueDepois), un)}</Text>
        {!semCusto && pv.custoDepois !== null ? <Text style={s.previaPeq}>{T.previaCusto(brl(pv.custoAntes), brl(pv.custoDepois))}</Text> : null}
        {!semCusto && pv.margemDepois !== null ? <Text style={s.previaPeq}>{T.previaMargem(pv.margemAntes, pv.margemDepois)}</Text> : null}
      </View>
    );
  } else if (l.estado === "novo" && !soLigar) {
    direita = <Text style={s.previaPeq}>{T.entraCom(fmtQty(l.quantidade), semCusto ? null : brl(l.custo))}</Text>;
  }

  const vivo =
    decisaoTipo === "novo" ? (soLigar ? T.vivoNovoSoLigar(semCusto ? null : brl(l.custo)) : T.vivoNovo(fmtQty(l.quantidade), semCusto ? null : brl(l.custo)))
      : decisaoTipo === "ligar" ? T.vivoLigar
        : decisaoTipo === "fora" ? (soLigar ? T.vivoForaSoLigar : T.vivoFora)
          : T.semParTexto;

  const botaoDecisao = (tipo: "novo" | "ligar" | "fora", rotulo: string) => {
    const on = decisaoTipo === tipo;
    return (
      <Pressable
        key={tipo}
        onPress={() => {
          if (on) onDecidir(n, null);
          else onDecidir(n, tipo === "novo" ? novoPara(l) : tipo === "ligar" ? { tipo: "ligar", produtoId: null } : { tipo: "fora" });
        }}
        style={[s.btnSec, on && s.btnOn]}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        testID={"chegou-linha-" + n + "-" + tipo}
      >
        <Text style={[s.btnSecTxt, on && { color: "#fff" }]}>{rotulo}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[s.linha, tom, estreito && s.linhaEstreita]} testID={"chegou-linha-" + n} accessibilityLabel={l.estado}>
      <View style={[s.linhaTopo, estreito && { flexDirection: "column", alignItems: "stretch" }]}>
        <View style={[s.col1, { gap: 2 }]}>
          <Text style={[s.titulo, (l.estado === "sem_par" || l.estado === "ligar") && { color: Colors.amber }]} numberOfLines={2}>{titulo}</Text>
          <Text style={s.daNota} numberOfLines={2}>{l.item.descricao + cod}</Text>
          {l.par && (l.estado === "pronta" || l.estado === "confere") ? (
            <Text style={s.achado} testID={"chegou-linha-" + n + "-achado"}>{T.achadoPor[l.par.como]}</Text>
          ) : null}
        </View>
        {soLigar ? null : (
          <View style={[s.col2, estreito && s.colEstreita]}>
            {estreito ? <Text style={s.colTxt}>{T.colChegou}</Text> : null}
            <Text style={[s.qtd, l.estado === "erro" && { color: Colors.red }]}>{fmtQty(l.quantidade)} {un}</Text>
          </View>
        )}
        {!semCusto && (
          <View style={[s.col3, estreito && s.colEstreita]}>
            {estreito ? <Text style={s.colTxt}>{soLigar ? T.colCustoDoFornecedor : T.colCusto}</Text> : null}
            <Text style={s.custo}>{brl(l.custo)}</Text>
            {l.quantidade > 0 ? <Text style={s.previaPeq}>{brl(Math.round(l.quantidade * l.custo * 100) / 100)}</Text> : null}
          </View>
        )}
        <View style={[s.col4, estreito && s.colEstreita]}>
          {direita}
          {(l.estado === "pronta" || l.estado === "confere" || l.estado === "grade") && !trocando ? (
            <Pressable onPress={() => setTrocando(true)} style={[s.btnSec, s.btnPeq]} accessibilityRole="button" testID={"chegou-linha-" + n + "-trocar"}>
              <Text style={s.btnSecTxt}>{T.trocarProduto}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {props.errosDasLinhas && props.errosDasLinhas[n] ? (
        <Text style={[s.avisoTxt, { color: Colors.red }]} testID={"chegou-linha-" + n + "-erro-servidor"}>{props.errosDasLinhas[n]}</Text>
      ) : null}

      {l.estado === "confere" && !semCusto ? (
        <View style={s.acaoBloco} testID={"chegou-linha-" + n + "-confere"}>
          <Text style={s.avisoTxt}>{T.confere(brl(l.custo), brl(l.previa ? l.previa.custoAntes : null))}</Text>
          {corrigindo ? (
            <TextInput
              value={custoTxt}
              onChangeText={(t) => {
                const m = maskCurrency(t);
                setCustoTxt(m);
                const v = numeroPositivo(m);
                if (v) onAjustar(n, { custo: v });
              }}
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              autoFocus
              style={s.input as any}
              accessibilityLabel={T.corrigirCusto}
              testID={"chegou-linha-" + n + "-custo"}
            />
          ) : null}
          <View style={s.acoes}>
            {!corrigindo && (
              <Pressable onPress={() => setCorrigindo(true)} style={s.btnSec} accessibilityRole="button" testID={"chegou-linha-" + n + "-corrigir"}>
                <Text style={s.btnSecTxt}>{T.corrigirCusto}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => onAjustar(n, { custoConferido: true })} style={s.btnSec} accessibilityRole="button" testID={"chegou-linha-" + n + "-esta-certo"}>
              <Text style={s.btnSecTxt}>{T.estaCerto}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {semDecisao ? (
        <View style={s.acaoBloco}>
          <Text style={s.apoio} testID={"chegou-linha-" + n + "-vivo"}>{vivo}</Text>
          <View style={s.acoes}>
            {botaoDecisao("novo", T.cadastrarNovo)}
            {botaoDecisao("ligar", T.ligarProduto)}
            {botaoDecisao("fora", T.deixarDeFora)}
          </View>
        </View>
      ) : null}

      {l.estado === "novo" && l.decisao && l.decisao.tipo === "novo" ? (
        <PainelNovo l={l} decisao={l.decisao} semCusto={semCusto} estreito={estreito} onDecidir={onDecidir} />
      ) : null}

      {ligarAberto ? (
        <PainelLigar
          l={l}
          produtos={props.produtos}
          semCusto={semCusto}
          comFornecedor={props.comFornecedor}
          onEscolher={(id) => { onDecidir(n, { tipo: "ligar", produtoId: id }); setTrocando(false); }}
          onCancelar={trocando ? () => setTrocando(false) : undefined}
        />
      ) : null}

      {usaGrade && l.produto ? (
        <PainelGrade l={l} companyId={props.companyId} produtoId={l.produto.id} onAjustar={onAjustar} />
      ) : null}

      {l.estado === "erro" && soLigar ? (
        <View style={s.acaoBloco} testID={"chegou-linha-" + n + "-erro"}>
          <Text style={[s.avisoTxt, { color: Colors.red }]}>{T.soLigarRepetida(l.repetidaDe || 0)}</Text>
        </View>
      ) : l.estado === "erro" ? (
        <View style={s.acaoBloco} testID={"chegou-linha-" + n + "-erro"}>
          <Text style={[s.avisoTxt, { color: Colors.red }]}>{props.fonte === "planilha" ? T.erroQtdZeroPlanilha : T.erroQtdZero}</Text>
          {dizendo ? (
            <TextInput
              value={qtdTxt}
              onChangeText={(t) => {
                const limpo = t.replace(/[^\d,]/g, "");
                setQtdTxt(limpo);
                const v = numeroPositivo(limpo);
                if (v) onAjustar(n, { quantidade: v });
              }}
              placeholder="0"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              autoFocus
              style={s.input as any}
              accessibilityLabel={T.dizerQuantos}
              testID={"chegou-linha-" + n + "-quantos"}
            />
          ) : (
            <View style={s.acoes}>
              <Pressable onPress={() => setDizendo(true)} style={s.btnSec} accessibilityRole="button" testID={"chegou-linha-" + n + "-dizer-quantos"}>
                <Text style={s.btnSecTxt}>{T.dizerQuantos}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ── Produto novo ─────────────────────────────────────────────
function PainelNovo({ l, decisao, semCusto, estreito, onDecidir }: {
  l: LinhaConferida;
  decisao: Extract<DecisaoDaLinha, { tipo: "novo" }>;
  semCusto: boolean;
  estreito: boolean;
  onDecidir: (n: number, d: DecisaoDaLinha | null) => void;
}) {
  const n = l.item.n;
  // O campo guarda o que foi digitado; a decisão guarda o número.
  const [precoTxt, setPrecoTxt] = useState(paraCampo(decisao.preco));
  const [ultimoPreco, setUltimoPreco] = useState(decisao.preco);
  if (decisao.preco !== ultimoPreco) {
    // "Aplicar" a margem trocou o preço por fora.
    setUltimoPreco(decisao.preco);
    setPrecoTxt(paraCampo(decisao.preco));
  }
  const margem = semCusto ? null : margemSobreCusto(decisao.preco, l.custo);
  const mudar = (d: Partial<Extract<DecisaoDaLinha, { tipo: "novo" }>>) => onDecidir(n, { ...decisao, ...d });
  return (
    <View style={s.painel} testID={"chegou-linha-" + n + "-painel-novo"}>
      <View style={[s.campos, estreito && { flexDirection: "column" }]}>
        <View style={{ flex: 2, minWidth: 0 }}>
          <Text style={s.rotulo}>{T.novoNome}</Text>
          <TextInput
            value={decisao.nome}
            onChangeText={(t) => mudar({ nome: t })}
            style={s.input as any}
            accessibilityLabel={T.novoNome}
            testID={"chegou-linha-" + n + "-novo-nome"}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.rotulo}>{T.novoPreco}</Text>
          <TextInput
            value={precoTxt}
            onChangeText={(t) => {
              const m = maskCurrency(t);
              setPrecoTxt(m);
              const v = numeroPositivo(m);
              setUltimoPreco(v);
              mudar({ preco: v });
            }}
            placeholder="0,00"
            placeholderTextColor={Colors.ink3}
            keyboardType="number-pad"
            style={[s.input, !(Number(decisao.preco) > 0) && s.inputFalta] as any}
            accessibilityLabel={T.novoPreco}
            testID={"chegou-linha-" + n + "-novo-preco"}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.rotulo}>{T.novoCategoria}</Text>
          <TextInput
            value={decisao.categoria || ""}
            onChangeText={(t) => mudar({ categoria: t })}
            placeholder={T.novoCategoriaExemplo}
            placeholderTextColor={Colors.ink3}
            style={s.input as any}
            accessibilityLabel={T.novoCategoria}
            testID={"chegou-linha-" + n + "-novo-categoria"}
          />
        </View>
      </View>
      {!(Number(decisao.preco) > 0) ? <Text style={s.avisoTxt}>{T.novoPrecoFalta}</Text> : null}
      <Text style={s.apoioPeq}>
        {[
          margem !== null ? T.novoMargem(margem) : null,
          l.item.ncm ? T.novoNcm(l.item.ncm) : null,
          estreito ? T.novoCelularApoio : null,
        ].filter(Boolean).join(" · ")}
      </Text>
    </View>
  );
}

// ── Ligar a um produto (e "Trocar produto") ──────────────────
function PainelLigar({ l, produtos, semCusto, comFornecedor, onEscolher, onCancelar }: {
  l: LinhaConferida;
  produtos: ProdutoDaLoja[];
  semCusto: boolean;
  comFornecedor: boolean;
  onEscolher: (produtoId: string) => void;
  onCancelar?: () => void;
}) {
  const n = l.item.n;
  const [busca, setBusca] = useState("");
  const achados = useMemo(() => buscarProdutos(produtos, busca), [busca, produtos]);
  return (
    <View style={s.painel} testID={"chegou-linha-" + n + "-painel-ligar"}>
      <Text style={s.rotulo}>{T.ligarEscolha}</Text>
      <View style={s.buscaBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          autoFocus
          placeholder={T.ligarBusca}
          placeholderTextColor={Colors.ink3}
          style={s.buscaInput as any}
          accessibilityLabel={T.ligarBusca}
          testID={"chegou-linha-" + n + "-ligar-busca"}
        />
        {onCancelar ? (
          <Pressable onPress={onCancelar} accessibilityLabel={T.fechar} testID={"chegou-linha-" + n + "-ligar-fechar"} style={s.fecharPeq}>
            <Icon name="x" size={14} color={Colors.ink3} />
          </Pressable>
        ) : null}
      </View>
      {busca.trim() && achados.length === 0 ? <Text style={s.apoio}>{T.ligarVazio}</Text> : null}
      {achados.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onEscolher(p.id)}
          style={s.achadoLinha}
          accessibilityRole="button"
          testID={"chegou-linha-" + n + "-ligar-" + p.id}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.titulo} numberOfLines={1}>{p.name}</Text>
            <Text style={s.previaPeq}>
              {T.ligarLinha(fmtQty(Number(p.stock) || 0), p.unit && p.unit !== "un" ? p.unit : "un", semCusto || !(Number(p.cost) > 0) ? null : brl(p.cost))}
            </Text>
          </View>
          <Text style={s.previa}>{brl(p.price)}</Text>
        </Pressable>
      ))}
      {comFornecedor && l.item.codigoFornecedor ? <Text style={s.apoioPeq}>{T.ligarCodigo(l.item.codigoFornecedor)}</Text> : null}
    </View>
  );
}

// ── Grade (cores e tamanhos) ─────────────────────────────────
function PainelGrade({ l, companyId, produtoId, onAjustar }: {
  l: LinhaConferida;
  companyId: string;
  produtoId: string;
  onAjustar: (n: number, a: Partial<AjusteDaLinha>) => void;
}) {
  const n = l.item.n;
  // Mesma chave do EntradaMercadoriaModal: o cache é o mesmo.
  const { data, isLoading } = useQuery({
    queryKey: ["estoque-consulta-variantes", companyId, produtoId],
    queryFn: () => companiesApi.variants(companyId, produtoId),
    enabled: !!companyId && !!produtoId,
    staleTime: 30_000,
  });
  const variantes: any[] = Array.isArray((data as any)?.variants) ? (data as any).variants : [];
  const [grade, setGrade] = useState<Record<string, string>>(() => {
    const g: Record<string, string> = {};
    for (const [k, q] of Object.entries(l.variantes || {})) g[k] = fmtQty(q);
    return g;
  });
  const soma = somaDaGrade(Object.fromEntries(Object.entries(grade).map(([k, v]) => [k, numeroPositivo(v) || 0])));
  return (
    <View style={s.painel} testID={"chegou-linha-" + n + "-painel-grade"}>
      {l.estado === "grade" ? <Text style={s.avisoTxt}>{T.gradeTexto}</Text> : null}
      <Text style={s.rotulo}>{T.gradeTitulo}</Text>
      {isLoading ? (
        <Text style={s.apoio}>{T.gradeCarregando}</Text>
      ) : (
        <GradeDaEntrada
          variantes={variantes}
          grade={grade}
          testIDPrefixo={"chegou-linha-" + n + "-grade-"}
          onChange={(g) => {
            setGrade(g);
            const v: Record<string, number> = {};
            for (const k of Object.keys(g)) { const q = numeroPositivo(g[k]); if (q) v[k] = q; }
            onAjustar(n, { variantes: v });
          }}
        />
      )}
      {soma > 0 && l.item.quantidade > 0 && Math.abs(soma - l.item.quantidade) > 0.0005 ? (
        <Text style={s.apoioPeq}>{T.gradeSomaDiferente(fmtQty(soma), fmtQty(l.item.quantidade))}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  lendo: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 12 },
  lendoTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  apoio: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  apoioPeq: { fontSize: 11.5, color: Colors.ink3 },
  resumo: { gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  resumoNota: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  faixaAzul: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.35)", backgroundColor: Colors.violetD,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { minWidth: 110, flexGrow: 1, padding: 10, borderRadius: 10, backgroundColor: Colors.bg4, gap: 2 },
  tileEstreito: { minWidth: "30%" as any },
  tileRotulo: { fontSize: 11, fontWeight: "600", color: Colors.ink3 },
  tileValor: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  bate: { fontSize: 12.5, color: Colors.green, fontWeight: "600" },
  margem: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  comSufixo: { flexDirection: "row", alignItems: "center", gap: 6 },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 44 },
  caixa: { width: 18, height: 18, borderRadius: 5, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", marginTop: 1 },
  caixaDesligada: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border2 },
  checkTxt: { color: Colors.ink2, fontSize: 13 },
  cabecalho: { flexDirection: "row", gap: 12, paddingHorizontal: 14 },
  colTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3 },
  col1: { flex: 2.4, minWidth: 0 },
  col2: { width: 80 },
  col3: { width: 110 },
  col4: { flex: 1.6, minWidth: 0, gap: 6 },
  colEstreita: { width: "100%", flex: undefined, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "baseline" },
  linha: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, gap: 10 },
  linhaEstreita: { padding: 12 },
  linhaAmbar: { borderColor: Colors.amber, backgroundColor: Colors.amberD },
  linhaVermelha: { borderColor: Colors.red, backgroundColor: Colors.redD },
  linhaVioleta: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  linhaApagada: { opacity: 0.75 },
  linhaTopo: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  titulo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  daNota: { fontSize: 11.5, color: Colors.ink3, fontFamily: "monospace" as any },
  achado: { fontSize: 11, fontWeight: "700", color: Colors.green, marginTop: 2 },
  qtd: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  custo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  previa: { fontSize: 12.5, fontWeight: "600", color: Colors.ink },
  previaPeq: { fontSize: 11.5, color: Colors.ink3 },
  acaoBloco: { gap: 8 },
  avisoTxt: { fontSize: 12.5, color: Colors.amber, fontWeight: "600", lineHeight: 18 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnSec: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnPeq: { alignSelf: "flex-start" },
  btnOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg3, minHeight: 44,
  },
  inputFalta: { borderColor: Colors.amber },
  painel: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2 },
  campos: { flexDirection: "row", gap: 10 },
  rotulo: { fontSize: 11.5, fontWeight: "600", color: Colors.ink2, marginBottom: 4 },
  buscaBox: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44,
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, backgroundColor: Colors.bg2,
  },
  buscaInput: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 10, outlineStyle: "none" } as any,
  fecharPeq: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  achadoLinha: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  mostrar: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "center", paddingHorizontal: 12 },
  mostrarTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
});
