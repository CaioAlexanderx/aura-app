// ============================================================
// AURA. — Financeiro › Relatórios (p-115a, 13/11/2026)
//
// Quinta aba do Financeiro. O primeiro relatório é o de Produtos: modelos
// prontos (chips), a frase-resposta, 3 números, o aviso de custo e a tabela.
// Desenho aprovado pelo Caio em 13/11 (artifact XgRj3CtckE9qrEquqKK5qH).
//
// - Relê o /auth/me ao abrir (armadilha 1 do CLAUDE.md: plano stale no JWT).
// - Multi-CNPJ: no "Todas as lojas" a API soma o grupo (escopo=grupo), a
//   coluna Loja entra e o compartilhado aparece uma vez.
// - Quem não vê custo: some os modelos e as colunas de custo (pode_ver_custo
//   da resposta, a regra podeVerCusto do app e o 403 RELATORIO_SEM_CUSTO).
// - p-115b: o painel "Ajustar o relatório" (AjustarRelatorio.tsx: filtros,
//   colunas, ordem, agrupar) e o último modelo lembrado por usuário/empresa.
// - p-116: Baixar PDF / Baixar planilha (BaixarRelatorio.tsx), com todas
//   as linhas do filtro (todas=1).
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useEstoqueConsulta } from "@/hooks/useEstoqueConsulta";
import { useEstadoDoRelatorio, useRelatorioProdutos } from "@/hooks/useRelatorioProdutos";
import { maskDateBR, brDateToISO } from "@/utils/mask";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ResultadoDoRelatorio } from "./ResultadoDoRelatorio";
import { AjustarRelatorio, type CategoriaDoPainel } from "./AjustarRelatorio";
import { useCategories } from "@/hooks/useCategories";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { BaixarRelatorio } from "./BaixarRelatorio";
import { formatarCnpj, TETO_DO_ARQUIVO, type Empresa } from "@/utils/relatorioArquivo";
import {
  MODELOS, PERIODOS, MODELO_INICIAL, modelosVisiveis, colunasVisiveis, ordemEfetiva, faixaDoPeriodo,
  fraseResposta, kpisDoModelo, avisoDeCobertura, hojeSP, textoDaFrase, chaveDoModeloLembrado,
  type PeriodoRelatorio,
} from "@/utils/relatorioProdutos";

var LARGURA_COMPACTA = 600;

type Props = {
  /** Para onde "Cadastrar custos" leva. null = sem link (Studio, ou sem acesso ao Estoque). */
  hrefCustos?: string | null;
};

export function TabRelatorios({ hrefCustos }: Props) {
  var { width } = useWindowDimensions();
  var compacto = width < LARGURA_COMPACTA;

  // Armadilha 1: plano e módulos do JWT podem estar velhos.
  var refreshMe = useAuthStore(function(st: any) { return st.refreshMe; });
  useEffect(function() {
    if (typeof refreshMe !== "function") return;
    try { Promise.resolve(refreshMe()).catch(function() {}); } catch (_) { /* segue com o que tem */ }
  }, [refreshMe]);

  // Enquanto a permissão do membro carrega, não busca: sairia sem custo e
  // buscaria de novo logo depois.
  var { semCusto: semCustoPelaPermissao, carregando: permissaoCarregando } = useEstoqueConsulta();
  var [custoNegado, setCustoNegado] = useState(false);
  var [modelosSemCusto, setModelosSemCusto] = useState<string[] | null>(null);
  var podeVerCusto = !semCustoPelaPermissao && !custoNegado;

  // p-115b: o último modelo, por usuário e por empresa (ou consolidado).
  var userId = useAuthStore(function(a: any) { return a.user && a.user.id; });
  var companyId = useAuthStore(function(a: any) { return a.company && a.company.id; });
  var consolidatedView = useAuthStore(function(a: any) { return !!a.consolidatedView; });
  var chaveLembrada = chaveDoModeloLembrado(userId, consolidatedView ? "todas" : companyId);
  var st = useEstadoDoRelatorio(chaveLembrada);
  var estado = st.estado;
  var hoje = useMemo(function() { return hojeSP(); }, []);

  // Personalizado incompleto ou inválido: a tela segue no último período válido.
  var faixaAgora = faixaDoPeriodo(st.periodo, hoje, brDateToISO(st.deBR), brDateToISO(st.ateBR));
  var ultimaFaixa = useRef<{ de: string; ate: string; periodo: PeriodoRelatorio } | null>(null);
  if ("de" in faixaAgora) ultimaFaixa.current = { de: faixaAgora.de, ate: faixaAgora.ate, periodo: st.periodo };
  var faixa = ultimaFaixa.current;

  var r = useRelatorioProdutos({ estado: estado, faixa: faixa, podeVerCusto: podeVerCusto, habilitado: !permissaoCarregando });

  // Custo cortado pelo backend (consolidado com loja restrita, ou 403).
  useEffect(function() {
    if (r.resposta && r.resposta.pode_ver_custo === false && !custoNegado) setCustoNegado(true);
  }, [r.resposta, custoNegado]);
  useEffect(function() {
    if (r.erro && r.erro.code === "RELATORIO_SEM_CUSTO") {
      setCustoNegado(true);
      if (r.erro.modelosSemCusto) setModelosSemCusto(r.erro.modelosSemCusto);
    }
  }, [r.erro]);

  var modelos = modelosVisiveis(podeVerCusto, modelosSemCusto);
  // Escolhido (ou lembrado) um modelo de custo e a pessoa não vê custo: cai
  // em Mais vendidos. Espera a permissão do membro chegar (enquanto carrega,
  // semCusto é true por precaução) e não grava: a lembrança fica.
  useEffect(function() {
    if (permissaoCarregando) return;
    if (estado.escolha !== "personalizado" && modelos.indexOf(estado.escolha) < 0) {
      st.despachar({ type: "modelo", modelo: MODELO_INICIAL });
    }
  }, [estado.escolha, podeVerCusto, modelosSemCusto, permissaoCarregando]); // eslint-disable-line react-hooks/exhaustive-deps

  var consolidado = r.resposta ? r.resposta.escopo === "grupo" : r.consolidado;
  var cols = colunasVisiveis(estado, { podeVerCusto: podeVerCusto, consolidado: consolidado });
  var ordem = ordemEfetiva(estado, podeVerCusto);

  var ctx = r.resposta ? {
    escolha: estado.escolha,
    periodo: faixa ? faixa.periodo : st.periodo,
    linhas: r.linhas,
    total: r.resposta.total_linhas,
    totais: r.resposta.totais,
    cobertura: r.resposta.cobertura_custo,
    filtros: estado.filtros,
    podeVerCusto: podeVerCusto && r.resposta.pode_ver_custo !== false,
  } : null;
  var frase = ctx ? fraseResposta(ctx) : null;
  var kpis = ctx ? kpisDoModelo(ctx) : [];
  // Categoria: a árvore de product_categories da loja ativa, com as subcategorias.
  var { flattened: categoriasFlat } = useCategories();
  var categorias: CategoriaDoPainel[] = useMemo(function() {
    return (categoriasFlat || []).map(function(fc) {
      return {
        id: fc.category.id,
        nome: fc.category.name,
        nivel: Math.max(0, fc.breadcrumb.length - 1),
        caminho: fc.breadcrumb.map(function(b) { return b.name; }).join(" › "),
      };
    });
  }, [categoriasFlat]);

  // p-116: quem emite e de quem é o documento. No consolidado, o grupo.
  var { profile } = useCompanyProfile();
  var nomeDoUsuario = useAuthStore(function(a: any) { return (a.user && (a.user.name || a.user.email)) || ""; });
  var nomeDaEmpresa = useAuthStore(function(a: any) { return (a.company && a.company.name) || ""; });
  var companyCount = useAuthStore(function(a: any) { return a.companyCount || 0; });
  var pf: any = profile || {};
  var empresa: Empresa = consolidado
    ? { razaoSocial: pf.trade_name || pf.legal_name || nomeDaEmpresa, cnpj: "", loja: "Todas as lojas" + (companyCount > 1 ? " (" + companyCount + ")" : ""), logoUrl: pf.logo_url || null }
    : {
      razaoSocial: pf.legal_name || pf.trade_name || nomeDaEmpresa,
      cnpj: formatarCnpj(pf.cnpj),
      loja: pf.trade_name && pf.trade_name !== pf.legal_name ? pf.trade_name : "",
      logoUrl: pf.logo_url || null,
    };
  var nomeDaCategoria = estado.filtros.categoria
    ? ((categorias.find(function(c) { return c.id === estado.filtros.categoria || c.nome === estado.filtros.categoria; }) || { caminho: estado.filtros.categoria } as any).caminho)
    : null;

  var aviso = r.resposta ? avisoDeCobertura(cols, r.resposta.cobertura_custo, r.resposta.total_linhas, podeVerCusto) : null;

  var chips = (
    <>
      {modelos.map(function(m) {
        var on = estado.escolha === m;
        return (
          <Pressable
            key={m}
            testID={"relatorio-modelo-" + m}
            onPress={function() { st.escolherModelo(m); }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && s.chipOn]}
          >
            <Text style={[s.chipTexto, on && s.chipTextoOn]}>{MODELOS[m].rotulo}</Text>
          </Pressable>
        );
      })}
      <Pressable
        testID="relatorio-modelo-personalizado"
        onPress={function() { st.despachar({ type: "personalizado" }); }}
        accessibilityRole="button"
        accessibilityState={{ selected: estado.escolha === "personalizado" }}
        style={[s.chip, s.chipTracejado, estado.escolha === "personalizado" && s.chipPersonalizadoOn]}
      >
        <Text style={[s.chipTexto, estado.escolha === "personalizado" && { color: Colors.violet3, fontWeight: "700" }]}>Personalizado</Text>
      </Pressable>
    </>
  );

  return (
    <View testID="relatorios-tab" style={{ gap: 14 }}>
      <View style={[s.topo, compacto && { flexDirection: "column", alignItems: "stretch" }]}>
        <View style={{ flex: compacto ? undefined : 1 }}>
          <Text style={s.titulo}>Relatórios</Text>
          <Text style={s.subtitulo}>Escolha o que quer ver ou comece por um modelo pronto.</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={s.seg} accessibilityRole="tablist">
            {PERIODOS.map(function(p, i) {
              var on = st.periodo === p.key;
              return (
                <Pressable
                  key={p.key}
                  testID={"relatorio-periodo-" + p.key}
                  onPress={function() { st.setPeriodo(p.key); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[s.segBtn, i < PERIODOS.length - 1 && s.segDivisor, on && { backgroundColor: Colors.violet }]}
                >
                  <Text style={[s.segTexto, on && { color: "#fff", fontWeight: "600" }]}>{p.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {st.periodo === "personalizado" && (
        <View>
          <View style={[s.datas, compacto && { flexDirection: "column", alignItems: "stretch" }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rotuloPequeno}>De</Text>
              <TextInput testID="relatorio-de" style={s.input} value={st.deBR} onChangeText={function(v) { st.setDeBR(maskDateBR(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} accessibilityLabel="Data inicial do relatório" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rotuloPequeno}>Até</Text>
              <TextInput testID="relatorio-ate" style={s.input} value={st.ateBR} onChangeText={function(v) { st.setAteBR(maskDateBR(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} accessibilityLabel="Data final do relatório" />
            </View>
          </View>
          {"erro" in faixaAgora && <Text style={s.avisoData}>{faixaAgora.erro}</Text>}
          {"incompleto" in faixaAgora && <Text style={s.dicaData}>Preencha as duas datas. Até lá, o relatório segue no período anterior.</Text>}
        </View>
      )}

      <View>
        <Text style={s.rotuloPequeno}>Relatório de Produtos · modelos prontos</Text>
        {compacto ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsLinha} testID="relatorio-modelos">
            {chips}
          </ScrollView>
        ) : (
          <View style={[s.chipsLinha, { flexWrap: "wrap" }]} testID="relatorio-modelos">{chips}</View>
        )}
      </View>

      <AjustarRelatorio
        estado={estado}
        despachar={st.despachar}
        colunasVisiveis={cols}
        ordem={ordem}
        podeVerCusto={podeVerCusto}
        consolidado={consolidado}
        categorias={categorias}
        abertoNoInicio={!compacto}
        compacto={compacto}
      />

      {r.erro && !r.carregando && <ErroDoRelatorio erro={r.erro} onTentar={r.tentarDeNovo} />}

      {(r.carregando || permissaoCarregando) && <ListSkeleton rows={5} />}

      {!r.carregando && r.resposta && frase && (
        <>
          <View style={s.resposta} testID="relatorio-frase" accessibilityLabel={textoDaFrase(frase)}>
            <Text style={[s.respostaTexto, compacto && { fontSize: 17 }]}>
              {frase.partes.map(function(p, i) {
                return <Text key={i} style={p.b ? { fontWeight: "700", color: Colors.violet3 } : null}>{p.t}</Text>;
              })}
            </Text>
            <Text style={s.respostaSub}>{frase.sub}</Text>
          </View>

          <View style={[s.kpis, compacto && { gap: 6 }]} testID="relatorio-kpis">
            {kpis.map(function(k) {
              return (
                <View key={k.rotulo} style={[s.kpi, compacto && { paddingHorizontal: 9, paddingVertical: 8 }]}>
                  <Text style={[s.kpiRotulo, compacto && { fontSize: 11 }]} numberOfLines={2}>{k.rotulo}</Text>
                  <Text style={[s.kpiValor, compacto && { fontSize: 15 }]} numberOfLines={1} adjustsFontSizeToFit>{k.valor}</Text>
                </View>
              );
            })}
          </View>

          {!!aviso && (
            <View style={s.aviso} testID="relatorio-aviso-custo">
              <Text style={s.avisoTexto}>
                {aviso}
                {!!hrefCustos && (
                  <>
                    {" "}
                    <Text
                      testID="relatorio-cadastrar-custos"
                      accessibilityRole="link"
                      onPress={function() { router.push(hrefCustos as any); }}
                      style={s.avisoLink}
                    >
                      Cadastrar custos
                    </Text>
                  </>
                )}
              </Text>
            </View>
          )}

          {r.resposta.total_linhas > 0 && (
            <ResultadoDoRelatorio
              linhas={r.linhas}
              colunas={cols}
              ordem={ordem}
              direcao={estado.direcao}
              agrupar={estado.agrupar}
              hoje={r.resposta.periodo ? r.resposta.periodo.hoje : hoje}
              total={r.resposta.total_linhas}
              compacto={compacto}
              onOrdenar={function(o) { st.despachar({ type: "ordenar", ordem: o }); }}
              temMais={r.temMais}
              carregandoMais={r.carregandoMais}
              onMostrarMais={r.mostrarMais}
            />
          )}

          {r.resposta.total_linhas > 0 && (
            <>
              {r.resposta.total_linhas > TETO_DO_ARQUIVO && (
                <Text style={s.dicaData} testID="relatorio-arquivo-teto">
                  O arquivo leva as primeiras {TETO_DO_ARQUIVO.toLocaleString("pt-BR")} linhas de {r.resposta.total_linhas.toLocaleString("pt-BR")}.
                </Text>
              )}
              <BaixarRelatorio
                companyId={companyId}
                estado={estado}
                faixa={faixa}
                podeVerCusto={podeVerCusto && r.resposta.pode_ver_custo !== false}
                consolidado={consolidado}
                empresa={empresa}
                emitidoPor={nomeDoUsuario}
                nomeDaCategoria={nomeDaCategoria}
                hoje={r.resposta.periodo ? r.resposta.periodo.hoje : hoje}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

function ErroDoRelatorio({ erro, onTentar }: { erro: NonNullable<ReturnType<typeof useRelatorioProdutos>["erro"]>; onTentar: () => void }) {
  // 403 de custo: a tela já se ajustou sozinha (efeito acima) e refaz a busca.
  if (erro.code === "RELATORIO_SEM_CUSTO") return null;
  var titulo = erro.code === "ESTOQUE_SO_CONSULTA"
    ? "Este acesso é só para consultar o estoque."
    : erro.code === "RELATORIO_PARAMETRO"
    ? (erro.mensagem || "Não deu para montar o relatório com essas escolhas.")
    : "Não conseguimos montar o relatório agora.";
  var podeTentar = erro.code !== "ESTOQUE_SO_CONSULTA" && erro.code !== "RELATORIO_PARAMETRO";
  return (
    <View style={s.erro} testID="relatorio-erro">
      <Text style={s.erroTitulo}>{titulo}</Text>
      {podeTentar && <Text style={s.erroSub}>Pode ser uma instabilidade rápida. Tente de novo em instantes.</Text>}
      {podeTentar && (
        <Pressable onPress={onTentar} accessibilityRole="button" style={s.erroBtn} testID="relatorio-tentar">
          <Text style={s.erroBtnTexto}>Tentar de novo</Text>
        </Pressable>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  topo: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  titulo: { fontSize: 20, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  subtitulo: { fontSize: 13, color: Colors.ink3, marginTop: 2 },
  seg: { flexDirection: "row", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, overflow: "hidden", backgroundColor: Colors.bg3 },
  segBtn: { paddingHorizontal: 11, minHeight: 36, justifyContent: "center" },
  segDivisor: { borderRightWidth: 1, borderRightColor: Colors.border },
  segTexto: { fontSize: 13, color: Colors.ink2 },
  datas: { flexDirection: "row", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2 },
  input: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, textAlign: "center" },
  avisoData: { fontSize: 12, color: Colors.amber, fontWeight: "600", marginTop: 6, marginLeft: 4 },
  dicaData: { fontSize: 12, color: Colors.ink3, marginTop: 6, marginLeft: 4 },
  rotuloPequeno: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase", color: Colors.ink3, marginBottom: 7 },
  chipsLinha: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  chip: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, borderRadius: 99, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTracejado: { borderStyle: "dashed" },
  chipPersonalizadoOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipTexto: { fontSize: 13, color: Colors.ink2 },
  chipTextoOn: { color: "#fff", fontWeight: "700" },
  resposta: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  respostaTexto: { fontSize: 19, lineHeight: 26, color: Colors.ink },
  respostaSub: { fontSize: 12.5, color: Colors.ink3, marginTop: 6 },
  kpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, minWidth: 0, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  kpiRotulo: { fontSize: 12, color: Colors.ink3 },
  kpiValor: { fontSize: 20, fontWeight: "700", color: Colors.ink, marginTop: 2 },
  aviso: { backgroundColor: Colors.amberD, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  avisoTexto: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  avisoLink: { color: Colors.violet3, fontWeight: "700" },
  erro: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 16, gap: 6 },
  erroTitulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  erroSub: { fontSize: 12.5, color: Colors.ink3 },
  erroBtn: { alignSelf: "flex-start", marginTop: 6, borderRadius: 10, paddingHorizontal: 14, minHeight: 40, justifyContent: "center", backgroundColor: Colors.violet },
  erroBtnTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
