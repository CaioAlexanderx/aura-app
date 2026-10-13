// ============================================================
// AURA. — Black Friday › O que vai faltar (13/10/2026)
//
// Primeira seção da página /black-friday (decisão do Caio, 13/10: NÃO é
// aba do Estoque). Aposta de Black Friday (plano de 13/10, prazo 10/11):
// compra de fim de ano se faz em outubro, e a conta sai do que a loja já
// registra — vendas e estoque. Lista o que, no ritmo das últimas semanas,
// acaba antes de uma data (padrão 30/11), quanto comprar (folga de 20%) e
// quanto de venda está em risco. O cálculo é do backend (Aura-backend#814);
// aqui só se apresenta.
//
// Mockup aprovado: docs/mockups/black-friday.html (seção 1).
//
// Decisões:
//   · quem JÁ zerou fica numa seção à parte — não "vai" faltar, já faltou,
//     e afogaria a lista principal de uma loja que vende sem controlar
//     estoque;
//   · item que vendeu e dá conta até a data (`faltara: false`) não entra
//     na lista; entra só na frase do cabeçalho ("dos 6 itens, 4 não
//     chegam");
//   · "Copiar lista de compra" copia TUDO que precisa de compra (zerados +
//     os que vão faltar), não só o que a busca deixou na tela: a busca
//     serve para achar um item, não para recortar o pedido ao fornecedor;
//   · multi-CNPJ: no consolidado vem a coluna da loja dona do estoque; o
//     compartilhado de grupo é uma linha só, marcada como tal.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import { copyText } from "@/utils/clipboard";
import { todayLocalString } from "@/utils/dateOnly";
import { pluralize } from "@/utils/plural";
import { qtdComUnidade } from "@/utils/matconUnits";
import { useRupturaEstoque } from "@/hooks/useRupturaEstoque";
import type { RupturaItem, RupturaResposta } from "@/services/estoqueRupturaApi";
import { fmt } from "@/components/screens/estoque/types";
import {
  JANELAS, JANELA_PADRAO, dataBR, dataAlvoPadrao, diaMes, filtrarPorBusca, itensQueVaoFaltar,
  lerDataAlvo, ordenarPorDataPrevista, presetsDeData, ritmoPorDia, textoListaDeCompra, urgencia,
} from "@/utils/rupturaEstoque";

const TABELA_MIN_W = 900;

function chaveDoItem(i: RupturaItem): string {
  return i.product_id + ":" + (i.variant_id || "p");
}

function textoAcabaEm(i: RupturaItem): string {
  if (i.dias_ate_acabar <= 0) return "hoje";
  return "em " + pluralize(i.dias_ate_acabar, "dia");
}

// ── Cartão do resumo ─────────────────────────────────────────

function Cartao({ rotulo, valor, sub, cor, testID }: { rotulo: string; valor: string; sub?: string; cor?: string; testID: string }) {
  return (
    <View style={s.cartao} testID={testID}>
      <Text style={s.cartaoRotulo}>{rotulo}</Text>
      <Text style={[s.cartaoValor, cor ? { color: cor } : null]} testID={testID + "-valor"}>{valor}</Text>
      {!!sub && <Text style={s.cartaoSub} numberOfLines={2}>{sub}</Text>}
    </View>
  );
}

// ── Linha da lista ───────────────────────────────────────────

type LinhaProps = { item: RupturaItem; zerado: boolean; mostrarLoja: boolean; larga: boolean; m: (t: string) => string };

function LinhaItem({ item, zerado, mostrarLoja, larga, m }: LinhaProps) {
  const urg = urgencia(item.dias_ate_acabar);
  const corAcaba = urg === "alta" ? Colors.red : urg === "media" ? Colors.amber : Colors.ink;
  const estoque = qtdComUnidade(item.estoque, item.unidade);
  const sugestao = "comprar " + qtdComUnidade(item.sugestao_compra, item.unidade);

  const nome = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={s.nome} numberOfLines={2}>{item.nome}</Text>
      {!!item.variante && <Text style={s.variante}>{item.variante}</Text>}
      {!!item.codigo && <Text style={s.codigo}>{item.codigo}</Text>}
    </View>
  );
  const loja = mostrarLoja ? (
    <View style={larga ? s.colLoja : { marginTop: 6, alignItems: "flex-start" }}>
      {!!item.loja?.nome && <View style={s.lojaTag}><Text style={s.lojaTagTxt} numberOfLines={1}>{item.loja.nome}</Text></View>}
      {!!item.compartilhado && <Text style={s.compartilhado}>estoque compartilhado</Text>}
    </View>
  ) : null;
  const acaba = zerado ? (
    <View style={s.seloZerou}><Text style={s.seloZerouTxt}>já zerou</Text></View>
  ) : (
    <View>
      <Text style={[s.acabaData, { color: corAcaba }]}>{diaMes(item.data_prevista)}</Text>
      <Text style={s.acabaSub}>{textoAcabaEm(item)}</Text>
    </View>
  );

  if (larga) {
    return (
      <View style={s.linha} testID={"ruptura-linha-" + chaveDoItem(item)}>
        <View style={s.colProduto}>{nome}</View>
        {mostrarLoja && loja}
        <Text style={[s.colNum, s.colEstoque]}>{estoque}</Text>
        <Text style={[s.colNum, s.colRitmo]}>{ritmoPorDia(item.ritmo_diario)}</Text>
        <View style={s.colAcaba}>{acaba}</View>
        <Text style={[s.colNum, s.colCompra, { color: Colors.violet3, fontWeight: "700" }]}>{sugestao}</Text>
        <Text style={[s.colNum, s.colRisco]}>{m(fmt(item.valor_em_risco))}</Text>
      </View>
    );
  }
  return (
    <View style={s.cartaoItem} testID={"ruptura-linha-" + chaveDoItem(item)}>
      <View style={s.cartaoItemTopo}>
        {nome}
        {acaba}
      </View>
      {loja}
      <View style={s.cartaoItemMeio}>
        <Text style={s.meioTxt}>Estoque <Text style={s.meioNeg}>{estoque}</Text></Text>
        <Text style={s.meioTxt}>Ritmo <Text style={s.meioNeg}>{ritmoPorDia(item.ritmo_diario)}</Text></Text>
      </View>
      <View style={s.cartaoItemBase}>
        <Text style={{ color: Colors.violet3, fontWeight: "700", fontSize: 14 }}>{sugestao}</Text>
        <Text style={s.meioTxt}>{m(fmt(item.valor_em_risco))} em risco</Text>
      </View>
    </View>
  );
}

function CabecalhoTabela({ mostrarLoja }: { mostrarLoja: boolean }) {
  return (
    <View style={s.thead}>
      <Text style={[s.th, s.colProduto]}>Produto</Text>
      {mostrarLoja && <Text style={[s.th, s.colLoja]}>Loja</Text>}
      <Text style={[s.th, s.colNum, s.colEstoque]}>Estoque</Text>
      <Text style={[s.th, s.colNum, s.colRitmo]}>Ritmo</Text>
      <Text style={[s.th, s.colAcaba]}>Acaba em</Text>
      <Text style={[s.th, s.colNum, s.colCompra]}>Sugestão</Text>
      <Text style={[s.th, s.colNum, s.colRisco]}>Em risco</Text>
    </View>
  );
}

// ── Frase do cabeçalho ───────────────────────────────────────

function fraseResumo(r: RupturaResposta): string {
  const { resumo } = r;
  const ate = diaMes(r.ate);
  if (resumo.itens_com_venda === 0) {
    return "Nenhum item vendeu nos últimos " + r.janela_dias + " dias — sem ritmo de venda não há o que projetar.";
  }
  const base = "Dos " + pluralize(resumo.itens_com_venda, "item") + " que venderam nos últimos " + r.janela_dias + " dias, ";
  const zerou = resumo.zerados > 0
    ? (resumo.zerados === 1 ? " e 1 já zerou" : " e " + resumo.zerados + " já zeraram")
    : "";
  if (resumo.itens_em_risco === 0) {
    return base + "nenhum acaba antes de " + ate + zerou + ".";
  }
  const nao = resumo.itens_em_risco === 1 ? "1 não chega" : resumo.itens_em_risco + " não chegam";
  const primeira = resumo.primeira_ruptura ? " A primeira ruptura é em " + diaMes(resumo.primeira_ruptura) + "." : "";
  return base + nao + " até " + ate + " no ritmo atual" + zerou + "." + primeira;
}

// ── Tela ─────────────────────────────────────────────────────

export function OQueVaiFaltar() {
  const hoje = useMemo(() => todayLocalString(), []);
  const presets = useMemo(() => presetsDeData(hoje), [hoje]);
  const { m } = useValoresOcultos();
  const { width } = useWindowDimensions();
  const larga = width >= TABELA_MIN_W;

  const [ate, setAte] = useState<string>(() => dataAlvoPadrao(hoje));
  const [janela, setJanela] = useState<number>(JANELA_PADRAO);
  const [busca, setBusca] = useState("");
  const [modoOutra, setModoOutra] = useState(false);
  const [textoData, setTextoData] = useState("");
  const [erroData, setErroData] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isDemo } = useRupturaEstoque({ ate, janela });

  function aplicarOutraData() {
    const ymd = lerDataAlvo(textoData, hoje);
    if (!ymd) {
      setErroData("Use uma data de hoje até 1 ano à frente, no formato dd/mm/aaaa.");
      return;
    }
    setErroData(null);
    setAte(ymd);
  }

  const mostrarLoja = !!data && data.escopo === "grupo" && [...data.itens, ...data.zerados].some((i) => !!i.loja);
  const lista = useMemo(() => (data ? itensQueVaoFaltar(data) : []), [data]);
  const zerados = useMemo(() => (data ? ordenarPorDataPrevista(data.zerados || []) : []), [data]);
  const listaVista = useMemo(() => filtrarPorBusca(lista, busca), [lista, busca]);
  const zeradosVistos = useMemo(() => filtrarPorBusca(zerados, busca), [zerados, busca]);
  const textoCompra = useMemo(
    () => (data ? textoListaDeCompra(data, { mostrarLoja }) : ""),
    [data, mostrarLoja]
  );
  const qtdLinhasCompra = textoCompra ? textoCompra.split("\n").length - 1 : 0;

  function copiar() {
    if (textoCompra) copyText(textoCompra, "Lista de compra copiada");
  }

  const subtitulo = data ? fraseResumo(data) : isLoading ? "Calculando o ritmo de venda…" : undefined;

  return (
    <View testID="ruptura-secao">
      {!!subtitulo && <Text style={s.frase} testID="ruptura-frase">{subtitulo}</Text>}

      {/* Data-alvo e janela */}
      <View style={s.filtros}>
        <View style={s.filtro}>
          <Text style={s.filtroRotulo}>Até quando</Text>
          <View style={s.chips}>
            {presets.map((p) => {
              const on = !modoOutra && ate === p.ate;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => { setModoOutra(false); setErroData(null); setAte(p.ate); }}
                  style={[s.chip, on && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  testID={"ruptura-alvo-" + p.key}
                >
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{p.label} <Text style={s.chipSub}>{diaMes(p.ate)}</Text></Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setModoOutra(true)}
              style={[s.chip, modoOutra && s.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: modoOutra }}
              testID="ruptura-alvo-outra"
            >
              <Text style={[s.chipTxt, modoOutra && s.chipTxtOn]}>
                {modoOutra && !erroData && textoData ? "Até " + diaMes(ate) : "Outra data…"}
              </Text>
            </Pressable>
          </View>
          {modoOutra && (
            <View style={s.outraLinha}>
              <TextInput
                value={textoData}
                onChangeText={setTextoData}
                onSubmitEditing={aplicarOutraData}
                placeholder="dd/mm/aaaa"
                placeholderTextColor={Colors.ink3}
                style={s.outraInput}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                testID="ruptura-outra-data"
              />
              <Pressable onPress={aplicarOutraData} style={s.outraBtn} testID="ruptura-outra-aplicar">
                <Text style={s.outraBtnTxt}>Aplicar</Text>
              </Pressable>
            </View>
          )}
          {!!erroData && <Text style={s.erroData} testID="ruptura-outra-erro">{erroData}</Text>}
        </View>

        <View style={s.filtro}>
          <Text style={s.filtroRotulo}>Ritmo das últimas</Text>
          <View style={s.chips}>
            {JANELAS.map((j) => {
              const on = janela === j;
              return (
                <Pressable
                  key={j}
                  onPress={() => setJanela(j)}
                  style={[s.chip, on && s.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  testID={"ruptura-janela-" + j}
                >
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{j} dias</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Estados */}
      {isDemo && (
        <View style={s.estado} testID="ruptura-demo">
          <Text style={s.estadoTitulo}>Sem vendas reais para projetar</Text>
          <Text style={s.estadoTxt}>No modo de demonstração não há histórico de venda. Com a sua loja, a lista aparece aqui.</Text>
        </View>
      )}

      {!isDemo && isError && (
        <View style={[s.estado, s.estadoErro]} testID="ruptura-erro">
          <Text style={s.estadoTitulo}>Não consegui calcular o que vai faltar</Text>
          <Text style={s.estadoTxt}>
            {(error as any)?.status === 400 && error?.message
              ? error.message
              : "Algo falhou ao buscar as vendas e o estoque. Nada foi alterado na sua loja — tente de novo em instantes."}
          </Text>
          <Pressable onPress={() => refetch()} style={s.btn} testID="ruptura-tentar-de-novo">
            <Text style={s.btnTxt}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {!isDemo && !isError && !data && (
        <View testID="ruptura-carregando"><ListSkeleton rows={4} showCards /></View>
      )}

      {!isDemo && !isError && !!data && (
        <>
          <View style={s.cartoes}>
            <Cartao testID="ruptura-resumo-itens" rotulo="Itens que vão faltar" valor={String(data.resumo.itens_em_risco)}
              sub={"até " + diaMes(data.ate) + " no ritmo atual"} cor={data.resumo.itens_em_risco > 0 ? Colors.amber : Colors.green} />
            <Cartao testID="ruptura-resumo-risco" rotulo="Valor em risco" valor={m(fmt(data.resumo.valor_em_risco))}
              sub="venda que não acontece sem reposição" cor={data.resumo.valor_em_risco > 0 ? Colors.red : undefined} />
            <Cartao testID="ruptura-resumo-primeira" rotulo="Primeira ruptura"
              valor={data.resumo.primeira_ruptura ? diaMes(data.resumo.primeira_ruptura) : "—"}
              sub={lista[0]?.nome || "nenhuma até " + diaMes(data.ate)} />
            <Cartao testID="ruptura-resumo-zerados" rotulo="Já zerados" valor={String(data.resumo.zerados)}
              sub="venderam na janela e acabaram" cor={data.resumo.zerados > 0 ? Colors.red : undefined} />
          </View>

          {(lista.length > 0 || zerados.length > 0) && (
            <View style={s.barra}>
              <TextInput
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar por nome, variante, código ou loja…"
                placeholderTextColor={Colors.ink3}
                style={s.busca}
                autoCapitalize="none"
                autoCorrect={false}
                testID="ruptura-busca"
              />
              <Pressable
                onPress={copiar}
                disabled={qtdLinhasCompra === 0}
                style={[s.btn, qtdLinhasCompra === 0 && { opacity: 0.4 }]}
                accessibilityRole="button"
                testID="ruptura-copiar"
              >
                <Icon name="clipboard" size={15} color="#fff" />
                <Text style={s.btnTxt}>Copiar lista de compra{qtdLinhasCompra > 0 ? " (" + qtdLinhasCompra + ")" : ""}</Text>
              </Pressable>
            </View>
          )}

          {/* Lista principal */}
          {lista.length === 0 ? (
            <View style={s.estado} testID="ruptura-vazio">
              <View style={s.estadoIcone}><Icon name="check" size={22} color={Colors.green} /></View>
              <Text style={s.estadoTitulo}>
                {data.resumo.itens_com_venda === 0
                  ? "Ainda não há vendas para projetar"
                  : "Nada vai faltar até " + diaMes(data.ate) + " no ritmo atual"}
              </Text>
              <Text style={s.estadoTxt}>
                {data.resumo.itens_com_venda === 0
                  ? "Sem venda nos últimos " + data.janela_dias + " dias não há ritmo para projetar. Tente uma janela maior."
                  : "Todo item que vendeu nos últimos " + data.janela_dias + " dias tem estoque para chegar até lá. Se a data for puxar mais venda que o normal, tente uma janela menor — ela pega o ritmo mais recente."}
              </Text>
            </View>
          ) : listaVista.length === 0 ? (
            <View style={s.estado} testID="ruptura-sem-resultado">
              <Text style={s.estadoTitulo}>Nenhum item com "{busca.trim()}"</Text>
              <Text style={s.estadoTxt}>Confira a grafia ou busque pelo código.</Text>
            </View>
          ) : (
            <View style={s.tabela} testID="ruptura-lista">
              {larga && <CabecalhoTabela mostrarLoja={mostrarLoja} />}
              {listaVista.map((i) => (
                <LinhaItem key={chaveDoItem(i)} item={i} zerado={false} mostrarLoja={mostrarLoja} larga={larga} m={m} />
              ))}
            </View>
          )}

          {/* Já zerou */}
          {zerados.length > 0 && (
            <View testID="ruptura-zerados">
              <View style={s.secao}>
                <Text style={s.secaoTxt}>Já zerou</Text>
                <View style={s.secaoLinha} />
              </View>
              <Text style={s.secaoAjuda}>
                Venderam nos últimos {data.janela_dias} dias e estão com o estoque zerado agora. Ficam à parte: não "vão" faltar, já faltaram.
              </Text>
              {zeradosVistos.length === 0 ? (
                <Text style={s.secaoAjuda}>Nenhum item zerado com "{busca.trim()}".</Text>
              ) : (
                <View style={s.tabela}>
                  {larga && <CabecalhoTabela mostrarLoja={mostrarLoja} />}
                  {zeradosVistos.map((i) => (
                    <LinhaItem key={chaveDoItem(i)} item={i} zerado mostrarLoja={mostrarLoja} larga={larga} m={m} />
                  ))}
                </View>
              )}
            </View>
          )}

          <Text style={s.rodape}>
            Ritmo = unidades vendidas ÷ dias com a loja aberta, nos últimos {data.janela_dias} dias ({dataBR(data.janela?.de)} a {dataBR(data.janela?.ate)}).
            A sugestão de compra já inclui {data.folga_pct ?? 20}% de folga. Nada aqui altera o seu estoque.
          </Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 22, marginBottom: 18, marginTop: 4 },
  filtro: { minWidth: 0 },
  filtroRotulo: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: Colors.ink3, marginBottom: 7 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 13, color: Colors.ink3 },
  chipTxtOn: { color: "#fff", fontWeight: "600" },
  chipSub: { fontSize: 11, opacity: 0.75 },
  outraLinha: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  outraInput: { width: 150, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, color: Colors.ink, fontSize: 14 },
  outraBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  outraBtnTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  erroData: { fontSize: 12, color: Colors.red, marginTop: 6, maxWidth: 360 },

  frase: { fontSize: 14, color: Colors.ink3, lineHeight: 21, marginBottom: 16, maxWidth: 720 },

  cartoes: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  cartao: { flexGrow: 1, flexBasis: 200, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 18, paddingVertical: 16 },
  cartaoRotulo: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: Colors.ink3 },
  cartaoValor: { fontSize: 26, fontWeight: "800", color: Colors.ink, marginTop: 8, letterSpacing: -0.5 },
  cartaoSub: { fontSize: 12, color: Colors.ink3, marginTop: 4 },

  barra: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  busca: { flexGrow: 1, flexBasis: 260, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, color: Colors.ink, fontSize: 14 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.violet },
  btnTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },

  tabela: { borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: "hidden", backgroundColor: Colors.bg3 },
  thead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  th: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: Colors.ink3 },
  linha: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  colProduto: { flex: 2.6, minWidth: 0 },
  colLoja: { flex: 1.4, minWidth: 0 },
  colNum: { textAlign: "right", fontSize: 13.5, color: Colors.ink },
  colEstoque: { flex: 0.8 },
  colRitmo: { flex: 0.8 },
  colAcaba: { flex: 1.1 },
  colCompra: { flex: 1.2 },
  colRisco: { flex: 1.1 },
  nome: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  variante: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  codigo: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  lojaTag: { alignSelf: "flex-start", maxWidth: "100%" as any, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.violetD },
  lojaTagTxt: { fontSize: 11.5, color: Colors.violet3 },
  compartilhado: { fontSize: 10.5, color: Colors.amber, marginTop: 3 },
  acabaData: { fontSize: 14, fontWeight: "700" },
  acabaSub: { fontSize: 11.5, color: Colors.ink3, marginTop: 2 },
  seloZerou: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: Colors.red + "55", backgroundColor: Colors.red + "1f" },
  seloZerouTxt: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.red },

  cartaoItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cartaoItemTopo: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "flex-start" },
  cartaoItemMeio: { flexDirection: "row", gap: 16, marginTop: 10, flexWrap: "wrap" },
  cartaoItemBase: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 },
  meioTxt: { fontSize: 12, color: Colors.ink3 },
  meioNeg: { color: Colors.ink, fontWeight: "600" },

  secao: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 26, marginBottom: 8, paddingHorizontal: 4 },
  secaoTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", color: Colors.ink3 },
  secaoLinha: { flex: 1, height: 1, backgroundColor: Colors.border },
  secaoAjuda: { fontSize: 12.5, color: Colors.ink3, lineHeight: 19, marginBottom: 10, paddingHorizontal: 4, maxWidth: 640 },

  estado: { alignItems: "center", gap: 8, paddingVertical: 40, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, backgroundColor: Colors.bg3 },
  estadoErro: { borderColor: Colors.red + "55" },
  estadoIcone: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.greenD, marginBottom: 4 },
  estadoTitulo: { fontSize: 17, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  estadoTxt: { fontSize: 13.5, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 460 },

  rodape: { fontSize: 11.5, color: Colors.ink3, lineHeight: 17, marginTop: 22, paddingHorizontal: 4, maxWidth: 720 },
});
