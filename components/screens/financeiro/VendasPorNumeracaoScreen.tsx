// ============================================================
// AURA. — Financeiro: "Vendas por produto e numeração" (03/11/2026)
//
// Mockup: docs/mockups/relatorio-vendas-por-numeracao.html (telas 1-4).
// Pedido do PO: a quantidade EXATA vendida no período, em tabela (não só
// porcentagem ou gráfico), por modelo, tipo e numeração — "quantos pares de
// cada modelo no mês, quais numerações saíram mais, o que girou" — para
// controlar estoque e planejar compras.
//
// Subtela do Financeiro, como /financeiro/produtos (curva ABC): sem item de
// menu nem `mod` próprio; a barra lateral marca Financeiro pelo prefixo.
// Três visões do MESMO dado (GET /reports/vendas-por-numeracao):
//   - Por modelo: tabela; a linha abre as numerações ("37 → 12, tem 3");
//   - Grade de numeração: modelo × numeração com calor e a linha "Total por
//     numeração" (responde "quais numerações saíram mais");
//   - Por numeração: a resposta curta.
// Giro / Estoque dura / Comprar p/ repor em língua de balcão (legenda).
// "Baixar planilha" (.xlsx, gerada aqui com SheetJS) e "Montar pedido"
// (o repor agrupado pelo fornecedor principal, pronto para o WhatsApp).
//
// Multi-CNPJ: no consolidado o backend soma o grupo; o subtítulo diz
// "todas as lojas". Celular (< 640 px): cartões por modelo com as
// numerações rolando para o lado (tela 4). Nada depende de hover (regra 7).
// Dinheiro respeita o olho de valores ocultos (useValoresOcultos).
// Contas e textos puros em utils/vendasPorNumeracao.ts.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, Modal,
  Platform, Linking, useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { OlhoValores } from "@/components/OlhoValores";
import { useAuthStore } from "@/stores/auth";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import { copyToClipboard } from "@/utils/clipboard";
import { relatoriosApi, type ModeloVendido, type PeriodoDoRelatorio, type VendasPorNumeracao } from "@/services/relatoriosApi";
import {
  PERIODOS, SEM_NUMERACAO, periodoDoLink, classeDeCalor, qtd, brl, textoDura, duraPouco, textoEstoque,
  textoVariacao, dataDoCampo, mascaraData, celula, totaisDaGrade, linhasDaPlanilha, nomeDaPlanilha,
  COLUNAS_DA_PLANILHA, montarPedidos,
} from "@/utils/vendasPorNumeracao";
import { destinoDoVoltar } from "./ProdutosFinanceiroScreen";

type Visao = "modelo" | "grade" | "numeracao";
const VISOES: { key: Visao; rotulo: string }[] = [
  { key: "modelo", rotulo: "Por modelo" },
  { key: "grade", rotulo: "Grade de numeração" },
  { key: "numeracao", rotulo: "Por numeração" },
];

const CALOR = ["transparent", "rgba(124,58,237,0.07)", "rgba(124,58,237,0.16)", "rgba(124,58,237,0.28)", "rgba(124,58,237,0.45)"];
const IS_WEB = Platform.OS === "web";

type Props = {
  // Mesmo par da curva ABC (ProdutosFinanceiroScreen): rota do Financeiro
  // no navegador que monta esta tela e para onde ir sem pilha.
  rotaFinanceiro: string;
  hrefFinanceiro: string;
};

export function VendasPorNumeracaoScreen({ rotaFinanceiro, hrefFinanceiro }: Props) {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ period?: string; de?: string }>();
  const { company, consolidatedView } = useAuthStore();
  const { m } = useValoresOcultos();
  const { width } = useWindowDimensions();
  const celular = width < 640;

  const [periodo, setPeriodo] = useState<PeriodoDoRelatorio>(periodoDoLink(params.period));
  const [deTxt, setDeTxt] = useState("");
  const [ateTxt, setAteTxt] = useState("");
  const [datas, setDatas] = useState<{ start: string; end: string } | null>(null);
  const [visao, setVisao] = useState<Visao>("modelo");
  const [tipo, setTipo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [porCor, setPorCor] = useState(false);
  const [mostrarEstoque, setMostrarEstoque] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [pedidoAberto, setPedidoAberto] = useState(false);

  // Busca vai ao backend (os totais e a campeã seguem o filtro), com folga.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  const pronto = periodo !== "custom" || !!datas;
  const filtros = {
    period: periodo,
    start_date: datas?.start, end_date: datas?.end,
    category: tipo, q: buscaAplicada, por_cor: porCor,
  };
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["vendas-por-numeracao", company?.id, !!consolidatedView, filtros],
    queryFn: () => relatoriosApi.vendasPorNumeracao(company!.id, filtros),
    enabled: !!company?.id && pronto,
    staleTime: 60_000,
    retry: 1,
  });

  function voltar() {
    let rotaAnterior: string | null = null;
    try {
      const state: any = navigation.getState?.();
      if (state && typeof state.index === "number" && state.index > 0) rotaAnterior = state.routes?.[state.index - 1]?.name ?? null;
    } catch { rotaAnterior = null; }
    // Veio da curva ABC ou do Financeiro: volta para lá. Link do e-mail ou
    // histórico vazio: Financeiro (aba de origem quando ?de= informa).
    if (rotaAnterior && rotaAnterior.indexOf(rotaFinanceiro) === 0 && router.canGoBack()) { router.back(); return; }
    const destino = destinoDoVoltar({ rotaAnterior, rotaFinanceiro, hrefFinanceiro, de: typeof params.de === "string" ? params.de : null });
    if (destino.tipo === "back" && router.canGoBack()) router.back();
    else router.replace((destino.tipo === "replace" ? destino.href : hrefFinanceiro) as any);
  }

  function aplicarDatas() {
    const start = dataDoCampo(deTxt);
    const end = dataDoCampo(ateTxt);
    if (!start || !end) { toast.error("Use datas no formato dd/mm/aaaa."); return; }
    if (start > end) { toast.error("A data inicial é depois da final."); return; }
    setDatas({ start, end });
  }

  async function baixarPlanilha() {
    if (!data) return;
    if (!IS_WEB) { toast.error("A planilha baixa no navegador do computador."); return; }
    try {
      // require dentro da função (e não `await import`, que o tsc do repo
      // marca como TS1323): o Metro já empacota o xlsx para a importação de
      // planilha; aqui ele só é avaliado quando a pessoa baixa.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const XLSX: any = require("xlsx");
      const ws = XLSX.utils.json_to_sheet(linhasDaPlanilha(data), { header: [...COLUNAS_DA_PLANILHA] });
      ws["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 13 }, { wch: 8 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendas por numeração");
      XLSX.writeFile(wb, nomeDaPlanilha(data.periodo));
    } catch {
      toast.error("Não conseguimos gerar a planilha. Tente de novo.");
    }
  }

  const status = (error as any)?.data?.code || (error as any)?.code;
  const unidade = data?.unidade || "pares";

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, celular && { padding: 14 }]} testID="vendas-por-numeracao">
      <View style={s.headerRow}>
        <Pressable onPress={voltar} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Voltar para o Financeiro"
          testID="vendas-numeracao-voltar" hitSlop={8}>
          <Icon name="chevron_left" size={14} color={Colors.violet3} />
          <Text style={s.backText}>Financeiro</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <OlhoValores variant="botao" />
      </View>

      <Text style={s.pageTitle}>Vendas por produto e numeração</Text>
      <Text style={s.pageSubtitle}>
        {data ? data.periodo.rotulo + " · " : ""}vendas concluídas, sem trocas e canceladas
        {consolidatedView ? " · todas as lojas" : ""}
      </Text>

      {/* Período e visão */}
      <View style={s.barra}>
        <Segmento opcoes={PERIODOS} valor={periodo} onChange={(p) => { setPeriodo(p as PeriodoDoRelatorio); setAbertos({}); }} testID="vn-periodo" />
        {!celular ? <Segmento opcoes={VISOES} valor={visao} onChange={(v) => setVisao(v as Visao)} testID="vn-visao" /> : null}
        <Pressable onPress={baixarPlanilha} style={[s.btnSec, !data && { opacity: 0.5 }]} disabled={!data}
          accessibilityRole="button" testID="vn-baixar">
          <Icon name="download" size={13} color={Colors.ink2} />
          {!celular ? <Text style={s.btnSecTxt}>Baixar planilha</Text> : null}
        </Pressable>
        <Pressable onPress={() => setPedidoAberto(true)} style={[s.btnSec, !data && { opacity: 0.5 }]} disabled={!data}
          accessibilityRole="button" testID="vn-montar-pedido">
          <Icon name="list" size={13} color={Colors.ink2} />
          <Text style={s.btnSecTxt}>Montar pedido</Text>
        </Pressable>
      </View>
      {celular ? <View style={s.barra}><Segmento opcoes={VISOES.map((v) => ({ ...v, rotulo: v.key === "grade" ? "Grade" : v.key === "numeracao" ? "Numeração" : "Modelo" }))} valor={visao} onChange={(v) => setVisao(v as Visao)} /></View> : null}

      {periodo === "custom" ? (
        <View style={s.barra}>
          <TextInput value={deTxt} onChangeText={(v) => setDeTxt(mascaraData(v))} placeholder="de dd/mm/aaaa" placeholderTextColor={Colors.ink3}
            keyboardType="number-pad" style={[s.input, { width: 130 }] as any} testID="vn-de" />
          <TextInput value={ateTxt} onChangeText={(v) => setAteTxt(mascaraData(v))} placeholder="até dd/mm/aaaa" placeholderTextColor={Colors.ink3}
            keyboardType="number-pad" style={[s.input, { width: 130 }] as any} onSubmitEditing={aplicarDatas} testID="vn-ate" />
          <Pressable onPress={aplicarDatas} style={s.btnPri} testID="vn-aplicar-datas"><Text style={s.btnPriTxt}>Ver</Text></Pressable>
        </View>
      ) : null}

      {/* Filtros */}
      <View style={s.barra}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0, maxWidth: "100%" }}>
          <Chip ativo={!tipo} rotulo="Todos os tipos" onPress={() => setTipo(null)} />
          {(data?.categorias || []).map((c) => <Chip key={c} ativo={tipo === c} rotulo={c} onPress={() => setTipo(tipo === c ? null : c)} />)}
        </ScrollView>
      </View>
      <View style={s.barra}>
        <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar modelo…" placeholderTextColor={Colors.ink3}
          style={[s.input, { flex: 1, minWidth: 160 }] as any} testID="vn-busca" />
        <Chip ativo={porCor} rotulo="Separar por cor" onPress={() => setPorCor(!porCor)} />
        {visao === "grade" ? <Chip ativo={mostrarEstoque} rotulo="Mostrar estoque" onPress={() => setMostrarEstoque(!mostrarEstoque)} /> : null}
        {isFetching && data ? <ActivityIndicator size="small" color={Colors.violet3} /> : null}
      </View>

      {!pronto ? (
        <Text style={s.vazio}>Escolha as datas e toque em Ver.</Text>
      ) : isLoading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>
      ) : isError ? (
        <View style={{ paddingVertical: 24 }}>
          <Text style={s.vazio}>
            {status === "SEM_PERMISSAO_RELATORIO"
              ? "Este relatório é de quem cuida do financeiro da loja."
              : (error as any)?.message || "Não conseguimos carregar o relatório."}
          </Text>
          {status !== "SEM_PERMISSAO_RELATORIO" ? (
            <Pressable onPress={() => refetch()} style={[s.btnSec, { alignSelf: "center", marginTop: 10 }]}><Text style={s.btnSecTxt}>Tentar de novo</Text></Pressable>
          ) : null}
        </View>
      ) : data ? (
        <>
          <Kpis data={data} celular={celular} m={m} />
          {data.modelos.length === 0 ? (
            <Text style={s.vazio} testID="vn-vazio">Nenhuma venda neste período{tipo ? ` em ${tipo}` : ""}.</Text>
          ) : visao === "modelo" ? (
            celular
              ? <CartoesPorModelo data={data} />
              : <TabelaPorModelo data={data} m={m} abertos={abertos} onAlternar={(k) => setAbertos({ ...abertos, [k]: !abertos[k] })} />
          ) : visao === "grade" ? (
            <Grade data={data} mostrarEstoque={mostrarEstoque} />
          ) : (
            <TabelaPorNumeracao data={data} />
          )}
          {data.modelos.length > 0 ? (
            <Text style={s.legenda}>
              Giro: quanto do que você teve foi vendido (vendidos ÷ vendidos + estoque de hoje). "Estoque dura": no ritmo deste
              período. "Comprar p/ repor": o que falta para vender o mesmo de novo (vendidos − estoque de hoje, por numeração).
            </Text>
          ) : null}
        </>
      ) : null}

      <PedidoModal visible={pedidoAberto} data={data || null} onClose={() => setPedidoAberto(false)} unidade={unidade} />
    </ScrollView>
  );
}

// ── Peças ───────────────────────────────────────────────────────

function Segmento({ opcoes, valor, onChange, testID }: { opcoes: { key: string; rotulo: string }[]; valor: string; onChange: (k: string) => void; testID?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxWidth: "100%" }} testID={testID}>
      <View style={s.seg}>
        {opcoes.map((o) => (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.segItem, valor === o.key && s.segOn]}
            accessibilityRole="button" accessibilityState={{ selected: valor === o.key }} testID={testID ? `${testID}-${o.key}` : undefined}>
            <Text style={[s.segTxt, valor === o.key && s.segTxtOn]}>{o.rotulo}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Chip({ ativo, rotulo, onPress }: { ativo: boolean; rotulo: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, ativo && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: ativo }}>
      <Text style={[s.chipTxt, ativo && s.chipTxtOn]}>{rotulo}</Text>
    </Pressable>
  );
}

function Kpis({ data, celular, m }: { data: VendasPorNumeracao; celular: boolean; m: (t: string) => string }) {
  const k = data.kpis;
  const variacao = textoVariacao(k.variacao_pct);
  const cards = [
    { r: `${data.unidade} vendidos`, v: qtd(k.vendidos), s: variacao || " " },
    { r: "Modelos que venderam", v: qtd(k.modelos_venderam), s: `de ${qtd(k.modelos_total)} no estoque` },
    { r: "Numeração campeã", v: k.campea ? k.campea.numeracao : "—", s: k.campea ? `${qtd(k.campea.vendidos)} ${data.unidade} · ${k.campea.pct}%` : "sem numeração cadastrada" },
    { r: "Receita", v: m(brl(k.receita, 0)), s: `ticket por ${singular(data.unidade)} ${m(brl(k.ticket_medio))}` },
  ];
  return (
    <View style={s.kpis} testID="vn-kpis">
      {cards.map((c) => (
        <View key={c.r} style={[s.kpi, { flexBasis: celular ? "47%" : "23%" }]}>
          <Text style={s.kpiR}>{c.r.toUpperCase()}</Text>
          <Text style={s.kpiV}>{c.v}</Text>
          <Text style={s.kpiS} numberOfLines={2}>{c.s}</Text>
        </View>
      ))}
    </View>
  );
}

function singular(u: string) {
  return u === "pares" ? "par" : u === "peças" ? "peça" : "item";
}

const COLS = [
  { k: "nome", r: "Modelo", f: 2.6, l: true },
  { k: "tipo", r: "Tipo", f: 1, l: true },
  { k: "vendidos", r: "Vendidos", f: 1.1 },
  { k: "receita", r: "Receita", f: 1.1 },
  { k: "estoque", r: "Estoque hoje", f: 1 },
  { k: "giro", r: "Giro", f: 0.8 },
  { k: "dura", r: "Estoque dura", f: 1.1 },
  { k: "repor", r: "Comprar p/ repor", f: 1.2 },
];

function chaveDoModelo(md: ModeloVendido) {
  return md.product_id + "|" + (md.cor || "");
}

function TabelaPorModelo({ data, m, abertos, onAlternar }: {
  data: VendasPorNumeracao; m: (t: string) => string; abertos: Record<string, boolean>; onAlternar: (k: string) => void;
}) {
  const max = Math.max(1, ...data.modelos.map((x) => x.vendidos));
  return (
    <ScrollView horizontal style={s.cardTabela} contentContainerStyle={{ minWidth: "100%" }}>
      <View style={{ minWidth: 860, flex: 1 }} testID="vn-tabela-modelo">
        <View style={[s.tr, s.trHead]}>
          {COLS.map((c) => <Text key={c.k} style={[s.th, { flex: c.f, textAlign: c.l ? "left" : "right" }]}>{c.r}</Text>)}
        </View>
        {data.modelos.map((md) => {
          const k = chaveDoModelo(md);
          const aberto = !!abertos[k];
          return (
            <View key={k}>
              <Pressable onPress={() => onAlternar(k)} style={[s.tr, aberto && { backgroundColor: Colors.violetD }]}
                accessibilityRole="button" accessibilityState={{ expanded: aberto }} testID={"vn-modelo-" + md.product_id}>
                <View style={{ flex: 2.6 }}>
                  <Text style={s.tdNome} numberOfLines={1}>{aberto ? "▾ " : "▸ "}{md.nome}{md.cor ? ` · ${md.cor}` : ""}</Text>
                  {md.sku ? <Text style={s.tdSub}>ref. {md.sku}</Text> : null}
                </View>
                <Text style={[s.td, { flex: 1, textAlign: "left" }]} numberOfLines={1}>{md.tipo || "—"}</Text>
                <View style={{ flex: 1.1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                  <View style={[s.barrinha, { width: Math.max(4, Math.round((md.vendidos / max) * 60)) }]} />
                  <Text style={[s.td, s.forte]}>{qtd(md.vendidos)}</Text>
                </View>
                <Text style={[s.td, { flex: 1.1 }]}>{m(brl(md.receita, 0))}</Text>
                <Text style={[s.td, { flex: 1 }]}>{qtd(md.estoque)}</Text>
                <View style={{ flex: 0.8, alignItems: "flex-end" }}>
                  <Text style={[s.pill, md.giro_pct !== null && md.giro_pct >= 60 && s.pillOk]}>{md.giro_pct === null ? "—" : md.giro_pct + "%"}</Text>
                </View>
                <View style={{ flex: 1.1, alignItems: "flex-end" }}>
                  <Text style={[s.pill, duraPouco(md.dura_dias) && s.pillAlerta]}>{textoDura(md.dura_dias)}</Text>
                </View>
                <Text style={[s.td, { flex: 1.2 }, md.repor > 0 && s.forte]}>{qtd(md.repor)}</Text>
              </Pressable>
              {aberto ? (
                <View style={s.gradeLinha} testID={"vn-numeracoes-" + md.product_id}>
                  <Numeracoes md={md} />
                </View>
              ) : null}
            </View>
          );
        })}
        <View style={[s.tr, s.trTotal]}>
          <Text style={[s.td, s.forte, { flex: 2.6, textAlign: "left" }]}>Total ({qtd(data.modelos.length)} modelos)</Text>
          <Text style={[s.td, { flex: 1 }]} />
          <Text style={[s.td, s.forte, { flex: 1.1 }]}>{qtd(data.totais.vendidos)}</Text>
          <Text style={[s.td, s.forte, { flex: 1.1 }]}>{m(brl(data.totais.receita, 0))}</Text>
          <Text style={[s.td, s.forte, { flex: 1 }]}>{qtd(data.totais.estoque)}</Text>
          <Text style={[s.td, s.forte, { flex: 0.8 }]}>{data.totais.giro_pct === null ? "—" : data.totais.giro_pct + "%"}</Text>
          <Text style={[s.td, s.forte, { flex: 1.1 }]}>{textoDura(data.totais.dura_dias)}</Text>
          <Text style={[s.td, s.forte, { flex: 1.2 }]}>{qtd(data.totais.repor)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

/** As numerações de um modelo: vendidos e "tem N"/"acabou"; as duas que mais saíram em destaque. */
function Numeracoes({ md, rolar }: { md: ModeloVendido; rolar?: boolean }) {
  const topo = [...md.numeracoes].sort((a, b) => b.vendidos - a.vendidos).slice(0, 2).filter((n) => n.vendidos > 0).map((n) => n.numeracao);
  const itens = md.numeracoes.map((n) => {
    const acabou = n.estoque <= 0;
    return (
      <View key={n.numeracao} style={[s.num, topo.indexOf(n.numeracao) >= 0 && s.numTop]}>
        <Text style={s.numN}>{n.numeracao}</Text>
        <Text style={s.numQ}>{qtd(n.vendidos)}</Text>
        <Text style={[s.numE, acabou && n.vendidos > 0 && { color: Colors.red, fontWeight: "700" }]}>{textoEstoque(n.estoque)}</Text>
      </View>
    );
  });
  if (!md.numeracoes.length) return <Text style={s.tdSub}>{SEM_NUMERACAO}</Text>;
  return rolar
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{itens}</ScrollView>
    : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{itens}</View>;
}

function CartoesPorModelo({ data }: { data: VendasPorNumeracao }) {
  return (
    <View testID="vn-cartoes">
      {data.modelos.map((md) => (
        <View key={chaveDoModelo(md)} style={s.cartao}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[s.tdNome, { flex: 1 }]} numberOfLines={2}>{md.nome}{md.cor ? ` · ${md.cor}` : ""}</Text>
            <Text style={s.td}><Text style={s.forte}>{qtd(md.vendidos)}</Text> {data.unidade}</Text>
          </View>
          <Text style={s.tdSub}>
            {md.tipo || "Sem tipo"} · tem {qtd(md.estoque)} · giro {md.giro_pct === null ? "—" : md.giro_pct + "%"} ·{" "}
            <Text style={duraPouco(md.dura_dias) ? { color: Colors.amber } : undefined}>dura {textoDura(md.dura_dias)}</Text>
          </Text>
          <View style={{ marginTop: 8 }}><Numeracoes md={md} rolar /></View>
          {md.repor > 0 ? <Text style={[s.tdSub, { marginTop: 6, color: Colors.ink2 }]}>Comprar p/ repor: <Text style={s.forte}>{qtd(md.repor)} {data.unidade}</Text></Text> : null}
        </View>
      ))}
    </View>
  );
}

const ALT = 40;
const ALT_ESTOQUE = 52;
const LARG_CEL = 56;

/** Modelo × numeração. A coluna do modelo fica fixa; as numerações rolam. */
function Grade({ data, mostrarEstoque }: { data: VendasPorNumeracao; mostrarEstoque: boolean }) {
  const cols = data.colunas;
  const t = totaisDaGrade(data.modelos, cols);
  const alt = mostrarEstoque ? ALT_ESTOQUE : ALT;
  return (
    <View style={[s.cardTabela, { flexDirection: "row" }]} testID="vn-grade">
      <View style={{ width: 200, borderRightWidth: 1, borderRightColor: Colors.border }}>
        <View style={[s.gCel, s.trHead, { height: ALT, alignItems: "flex-start" }]}><Text style={s.th}>Modelo</Text></View>
        {data.modelos.map((md) => (
          <View key={chaveDoModelo(md)} style={[s.gCel, { height: alt, alignItems: "flex-start" }]}>
            <Text style={s.tdNome} numberOfLines={1}>{md.nome}{md.cor ? ` · ${md.cor}` : ""}</Text>
          </View>
        ))}
        <View style={[s.gCel, s.trTotal, { height: ALT, alignItems: "flex-start" }]}><Text style={s.forte}>Total por numeração</Text></View>
        <View style={[s.gCel, s.trTotal, { height: ALT, alignItems: "flex-start" }]}><Text style={s.td}>% dos {data.unidade}</Text></View>
      </View>
      <ScrollView horizontal>
        <View>
          <View style={{ flexDirection: "row" }}>
            {cols.map((c) => <View key={c} style={[s.gCel, s.trHead, { width: c === SEM_NUMERACAO ? 96 : LARG_CEL, height: ALT }]}><Text style={s.th} numberOfLines={1}>{c}</Text></View>)}
            <View style={[s.gCel, s.trHead, { width: 64, height: ALT }]}><Text style={s.th}>Total</Text></View>
          </View>
          {data.modelos.map((md) => (
            <View key={chaveDoModelo(md)} style={{ flexDirection: "row" }}>
              {cols.map((c) => {
                const cel = celula(md, c);
                const nivel = classeDeCalor(cel.vendidos, t.maximoCelula);
                return (
                  <View key={c} style={[s.gCel, { width: c === SEM_NUMERACAO ? 96 : LARG_CEL, height: alt, backgroundColor: CALOR[nivel] }]}>
                    <Text style={[s.gNum, nivel === 0 && { color: Colors.ink3, opacity: 0.6 }, nivel >= 3 && { fontWeight: "800" }, nivel === 4 && { color: "#fff" }]}>{qtd(cel.vendidos)}</Text>
                    {mostrarEstoque ? <Text style={[s.gEst, nivel === 4 && { color: "#fff" }]}>{cel.estoque > 0 ? "tem " + qtd(cel.estoque) : "—"}</Text> : null}
                  </View>
                );
              })}
              <View style={[s.gCel, { width: 64, height: alt }]}><Text style={s.forte}>{qtd(md.vendidos)}</Text></View>
            </View>
          ))}
          <View style={{ flexDirection: "row" }}>
            {t.porColuna.map((v, i) => <View key={cols[i]} style={[s.gCel, s.trTotal, { width: cols[i] === SEM_NUMERACAO ? 96 : LARG_CEL, height: ALT }]}><Text style={s.forte}>{qtd(v)}</Text></View>)}
            <View style={[s.gCel, s.trTotal, { width: 64, height: ALT }]}><Text style={s.forte}>{qtd(t.total)}</Text></View>
          </View>
          <View style={{ flexDirection: "row" }}>
            {t.pct.map((v, i) => <View key={cols[i]} style={[s.gCel, s.trTotal, { width: cols[i] === SEM_NUMERACAO ? 96 : LARG_CEL, height: ALT }]}><Text style={[s.td, v === Math.max(...t.pct) && v > 0 && s.forte]}>{v}%</Text></View>)}
            <View style={[s.gCel, s.trTotal, { width: 64, height: ALT }]}><Text style={s.td}>100%</Text></View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function TabelaPorNumeracao({ data }: { data: VendasPorNumeracao }) {
  const max = Math.max(1, ...data.numeracoes.map((n) => n.vendidos));
  return (
    <View style={[s.cardTabela, { maxWidth: 720 }]} testID="vn-tabela-numeracao">
      <View style={[s.tr, s.trHead]}>
        <Text style={[s.th, { flex: 1.2, textAlign: "left" }]}>Numeração</Text>
        <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>{data.unidade} vendidos</Text>
        <Text style={[s.th, { flex: 1, textAlign: "right" }]}>% dos {data.unidade}</Text>
        <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Estoque hoje</Text>
        <Text style={[s.th, { flex: 1.2, textAlign: "right" }]}>Comprar p/ repor</Text>
      </View>
      {data.numeracoes.map((n) => {
        const sem = n.numeracao === SEM_NUMERACAO;
        return (
          <View key={n.numeracao} style={s.tr}>
            <Text style={[s.tdNome, { flex: 1.2 }]}>{n.numeracao}</Text>
            <View style={{ flex: 1.6, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
              {!sem ? <View style={[s.barrinha, { width: Math.max(4, Math.round((n.vendidos / max) * 90)) }]} /> : null}
              <Text style={[s.td, !sem && s.forte]}>{qtd(n.vendidos)}</Text>
            </View>
            <Text style={[s.td, { flex: 1 }]}>{n.pct}%</Text>
            <Text style={[s.td, { flex: 1 }]}>{qtd(n.estoque)}</Text>
            <Text style={[s.td, { flex: 1.2 }, n.repor > 0 && s.forte]}>{sem ? "—" : qtd(n.repor)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PedidoModal({ visible, data, onClose, unidade }: { visible: boolean; data: VendasPorNumeracao | null; onClose: () => void; unidade: string }) {
  const pedidos = useMemo(() => (data ? montarPedidos(data.modelos, unidade) : []), [data, unidade]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.modal} onPress={() => {}} testID="vn-pedido-modal">
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Montar pedido</Text>
              <Text style={s.tdSub}>O "comprar p/ repor" de cada numeração, separado pelo fornecedor principal do produto.</Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fechar" hitSlop={8}><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 460, marginTop: 10 }}>
            {pedidos.length === 0 ? (
              <Text style={s.vazio}>Nada para repor neste período: o estoque cobre o que vendeu.</Text>
            ) : pedidos.map((p) => (
              <View key={p.fornecedor} style={s.pedido} testID={"vn-pedido-" + p.fornecedor}>
                <Text style={s.pedidoTxt} selectable>{p.texto}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <Pressable style={s.btnSec} onPress={async () => {
                    const ok = await copyToClipboard(p.texto);
                    if (ok) toast.success("Pedido copiado"); else toast.error("Não deu para copiar aqui. Selecione o texto e copie.");
                  }}>
                    <Icon name="copy" size={13} color={Colors.ink2} /><Text style={s.btnSecTxt}>Copiar</Text>
                  </Pressable>
                  {p.whatsapp ? (
                    <Pressable style={s.btnPri} onPress={() => Linking.openURL(p.whatsapp!)}>
                      <Icon name="whatsapp" size={13} color="#fff" /><Text style={s.btnPriTxt}>Abrir no WhatsApp</Text>
                    </Pressable>
                  ) : p.fornecedor !== "Sem fornecedor" ? <Text style={[s.tdSub, { alignSelf: "center" }]}>Fornecedor sem WhatsApp cadastrado</Text> : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 1180, alignSelf: "center", width: "100%" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 4, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12.5, color: Colors.ink3, marginBottom: 14 },
  barra: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 },
  seg: { flexDirection: "row", backgroundColor: Colors.bg4, borderRadius: 10, padding: 3 },
  segItem: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8 },
  segOn: { backgroundColor: Colors.bg3 },
  segTxt: { fontSize: 12.5, color: Colors.ink2 },
  segTxtOn: { color: Colors.violet3, fontWeight: "700" },
  chip: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.bg3 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 12, color: Colors.ink2 },
  chipTxtOn: { color: "#fff", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg3 },
  btnSec: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.bg3 },
  btnSecTxt: { fontSize: 12.5, color: Colors.ink2, fontWeight: "600" },
  btnPri: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.violet },
  btnPriTxt: { fontSize: 12.5, color: "#fff", fontWeight: "700" },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  kpi: { flexGrow: 1, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12 },
  kpiR: { fontSize: 10.5, color: Colors.ink3, letterSpacing: 0.5 },
  kpiV: { fontSize: 20, fontWeight: "800", color: Colors.ink, marginTop: 2 },
  kpiS: { fontSize: 11.5, color: Colors.ink3 },
  cardTabela: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  trHead: { backgroundColor: Colors.bg2 },
  trTotal: { backgroundColor: Colors.bg4 },
  th: { fontSize: 10.5, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  td: { fontSize: 13, color: Colors.ink2, textAlign: "right" },
  tdNome: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  tdSub: { fontSize: 11.5, color: Colors.ink3 },
  forte: { fontWeight: "800", color: Colors.ink },
  barrinha: { height: 6, borderRadius: 3, backgroundColor: Colors.violet, opacity: 0.75 },
  pill: { fontSize: 11, color: Colors.ink2, backgroundColor: Colors.bg4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  pillOk: { color: Colors.green, backgroundColor: Colors.greenD },
  pillAlerta: { color: Colors.amber, backgroundColor: Colors.amberD },
  gradeLinha: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.bg2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  num: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, minWidth: 64, alignItems: "center", backgroundColor: Colors.bg3 },
  numTop: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  numN: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  numQ: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  numE: { fontSize: 10.5, color: Colors.ink3 },
  cartao: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  gCel: { paddingHorizontal: 10, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Colors.border },
  gNum: { fontSize: 13, color: Colors.ink },
  gEst: { fontSize: 10, color: Colors.ink3 },
  legenda: { fontSize: 11.5, color: Colors.ink3, marginTop: 10, lineHeight: 17 },
  vazio: { fontSize: 13, color: Colors.ink3, textAlign: "center", paddingVertical: 24 },
  scrim: { flex: 1, backgroundColor: "rgba(10,8,30,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 520, backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  pedido: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: Colors.bg2 },
  pedidoTxt: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
});
