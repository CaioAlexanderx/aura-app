// ============================================================
// Gestão Aura › Hoje (13/10/2026)
//
// Tela única de blocos que se calculam sozinhos: faixa de indicadores,
// alertas com verbo e três seções (Negócio, Produto e uso, Operação) numa
// grade de 12 colunas. Um card expande por vez, no lugar, e mostra as
// listas por nome de loja. Mockup: docs/mockups/gestao-aura-painel.html.
//
// Os dados vêm de usePainelHoje (GET /admin/painel/*). Estados: carregando,
// erro com "tentar de novo", vazio (nenhum bloco calculado) e o conteúdo.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Dimensions, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { BlocoCard, Pill } from "./BlocoCard";
import { ExtratoBancario } from "./ExtratoOfx";
import { Sparkline } from "./Graficos";
import { CatalogoBlocos, ConversaContatoModal, FichaClienteModal } from "./PainelModais";
import { RegistrarContatoModal } from "./RegistrarContatoModal";
import type { AlvoRegistro } from "./RegistrarContatoModal";
import { EstenderTrialModal } from "./EstenderTrialModal";
import type { AlvoTrial } from "./EstenderTrialModal";
import { ehVerboDeContato, ehVerboDeTrial } from "./registrarContato";
import { DEFINICOES, SECOES } from "./blocos";
import { Paleta } from "./paleta";
import { usePainelHoje } from "./usePainelHoje";
import type { Alerta, Bloco, BlocoId, PainelHoje as PainelHojeDados } from "./tipos";

var GAP = 12;
var FUSO = "America/Sao_Paulo";

function dataPorExtenso(iso: string): string {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "Hoje";
  var txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSO }).replace("-feira", "");
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
function hora(iso: string): string {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

// Quantos itens de largura mínima `min` cabem por linha.
function porLinha(largura: number, min: number, teto: number): number {
  return Math.max(1, Math.min(teto, Math.floor((largura + GAP) / (min + GAP))));
}
function larguraDe(largura: number, n: number): number | string {
  if (n <= 1) return "100%";
  return Math.floor((largura - GAP * (n - 1)) / n);
}

// Receita: a conferência com o extrato vira a seção interativa (OFX), então a
// lista genérica que o backend manda sai do detalhe.
var LISTAS_SUBSTITUIDAS: Partial<Record<BlocoId, string[]>> = { receita: ["Conferência com o extrato"] };

var COR_ALERTA: Record<Alerta["tipo"], { ponto: string; halo: string }> = {
  risco: { ponto: Colors.red, halo: Colors.redD },
  atencao: { ponto: Colors.amber, halo: Colors.amberD },
  bom: { ponto: Colors.green, halo: Colors.greenD },
};

type Dados = ReturnType<typeof usePainelHoje>;

function EstadoDaTela(props: { testID: string; carregando?: boolean; titulo: string; texto?: string; onTentar?: () => void }) {
  return (
    <View testID={props.testID} style={s.estado}>
      {props.carregando ? <ActivityIndicator color={Colors.violet3} /> : <Icon name="alert" size={22} color={Colors.amber} />}
      <Text style={s.estadoTitulo}>{props.titulo}</Text>
      {props.texto ? <Text style={s.estadoTexto}>{props.texto}</Text> : null}
      {props.onTentar ? (
        <Pressable testID="painel-tentar-de-novo" onPress={props.onTentar} style={[s.btn, s.btnPrimario]} accessibilityRole="button">
          <Icon name="refresh" size={13} color="#fff" />
          <Text style={[s.btnText, { color: "#fff" }]}>Tentar de novo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PainelHoje() {
  var dados = usePainelHoje();
  if (dados.carregando) {
    return <EstadoDaTela testID="painel-carregando" carregando titulo="Carregando o painel…" texto="Se o dia ainda não foi calculado, o cálculo leva alguns segundos." />;
  }
  if (dados.erro || !dados.painel) {
    return <EstadoDaTela testID="painel-erro" titulo="Não consegui carregar o painel" texto="Confira a conexão e tente de novo." onTentar={dados.tentarDeNovo} />;
  }
  return <PainelConteudo dados={dados} painel={dados.painel} />;
}

function PainelConteudo(props: { dados: Dados; painel: PainelHojeDados }) {
  var router = useRouter();
  var painel = props.painel;
  var { catalogo, recalcular, salvarLayout, exemplo, vazio } = props.dados;
  var [largura, setLargura] = useState(function() { return Math.max(320, Math.min(1240, Dimensions.get("window").width) - 40); });
  var [aberto, setAberto] = useState<BlocoId | null>(null);
  var [ativos, setAtivos] = useState<BlocoId[]>(props.dados.ativos);
  var [salvando, setSalvando] = useState(false);
  var [catalogoAberto, setCatalogoAberto] = useState(false);
  var [fichaDe, setFichaDe] = useState<string | null>(null);
  var [conversaDe, setConversaDe] = useState<string | null>(null);
  var [registrarDe, setRegistrarDe] = useState<AlvoRegistro | null>(null);
  var [estenderDe, setEstenderDe] = useState<AlvoTrial | null>(null);
  var [recalculando, setRecalculando] = useState(false);
  var cards = useRef<Record<string, any>>({});

  var blocoPorId = useMemo(function() {
    var mapa: Record<string, Bloco> = {};
    painel.blocos.forEach(function(b) { mapa[b.id] = b; });
    return mapa;
  }, [painel]);

  // Ao expandir, o card vai para a largura toda e muda de lugar: rolar até ele.
  useEffect(function() {
    if (!aberto || Platform.OS !== "web") return;
    var t = setTimeout(function() {
      var no = cards.current[aberto as string];
      if (no && typeof no.scrollIntoView === "function") no.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return function() { clearTimeout(t); };
  }, [aberto]);

  function alternar(id: BlocoId) { setAberto(function(atual) { return atual === id ? null : id; }); }

  function abrirBloco(id: BlocoId) {
    if (!DEFINICOES.some(function(d) { return d.id === id; })) return;
    if (ativos.indexOf(id) < 0) setAtivos(ativos.concat([id]));
    setAberto(id);
  }

  // Alerta de uma loja abre a ficha dela; os demais expandem o bloco.
  function aoTocarAlerta(a: Alerta) {
    if (a.company_id) { setFichaDe(a.company_id); return; }
    if (a.bloco) abrirBloco(a.bloco);
  }

  // Verbo de uma loja: contato (Ligar, Oferecer plano, Registrar contato) abre
  // o Registrar contato; "+7 dias" abre a confirmação do teste. Sem a loja
  // (companyId), ou verbo que ainda não existe, avisa "em breve".
  function aoVerbo(verbo: string, loja: string, companyId?: string) {
    if (companyId && ehVerboDeTrial(verbo)) { setEstenderDe({ company_id: companyId, nome: loja }); return; }
    if (companyId && ehVerboDeContato(verbo)) { setRegistrarDe({ company_id: companyId, nome: loja }); return; }
    toast.info("“" + verbo + "” para " + loja + " entra em breve.");
  }

  async function aoRecalcular() {
    setRecalculando(true);
    try {
      var r = await recalcular();
      if (exemplo) toast.info("Dados de exemplo (desenvolvimento): o recálculo só roda com a API.");
      else if (r.erros > 0) toast.error("Recalculado com " + r.erros + (r.erros === 1 ? " erro" : " erros") + ". O que deu certo ficou gravado.");
      else toast.success("Painel recalculado.");
    } catch { toast.error("Não consegui recalcular o painel. Tente de novo."); }
    finally { setRecalculando(false); }
  }

  // PUT /admin/painel/layout; o modal só fecha se o backend aceitou.
  async function aoSalvarCatalogo(novos: BlocoId[]) {
    setSalvando(true);
    try {
      await salvarLayout(novos);
      setAtivos(novos);
      if (aberto && novos.indexOf(aberto) < 0) setAberto(null);
      setCatalogoAberto(false);
      toast.success("Painel salvo.");
    } catch { toast.error("Não consegui salvar o painel. Tente de novo."); }
    finally { setSalvando(false); }
  }

  // Grade de 12 colunas: larguras do bloco no desktop, 2 por linha no tablet, 1 no celular.
  var modo: "desktop" | "tablet" | "celular" = largura >= 980 ? "desktop" : largura > 640 ? "tablet" : "celular";
  function larguraDoCard(colunas: number, estaAberto: boolean): number | string {
    if (estaAberto || modo === "celular") return "100%";
    return larguraDe(largura, modo === "tablet" ? 2 : 12 / colunas);
  }

  var destaques = painel.destaques || [];
  var nDestaques = porLinha(largura, 220, 4);
  var nAlertas = porLinha(largura, 280, 3);
  var botaoReordenar = (
    <Pressable testID="painel-reordenar" disabled style={[s.btn, { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Reordenar blocos (em breve)" accessibilityState={{ disabled: true }}>
      <Text style={s.btnText}>Reordenar</Text>
    </Pressable>
  );

  return (
    <View testID="painel-hoje" onLayout={function(e) { var w = Math.round(e.nativeEvent.layout.width); if (w > 0 && w !== largura) setLargura(w); }}>
      {/* Cabeçalho */}
      <View style={s.hdr}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <Text style={s.rotulo}>Gestão Aura · Hoje</Text>
          <Text style={s.h1}>{dataPorExtenso(painel.calculado_em)}</Text>
          <View style={s.meta}>
            <Text style={s.metaText}>Calculado às <Text style={s.metaForte}>{hora(painel.calculado_em)}</Text></Text>
            <Text style={s.metaText}>Próximo às <Text style={s.metaForte}>{hora(painel.proximo_calculo)}</Text></Text>
            {painel.fontes && painel.fontes.length ? <Text style={s.metaText}>Fontes: <Text style={s.metaForte}>{painel.fontes.join(" · ")}</Text></Text> : null}
            {painel.ao_vivo ? <Pill variacao={{ texto: "calculado agora", tom: "sobe" }} /> : null}
            {exemplo ? <Pill variacao={{ texto: "dados de exemplo · 13/10", tom: "alerta" }} /> : null}
          </View>
        </View>
        <View style={s.acts}>
          <Pressable testID="painel-abrir-catalogo" onPress={function() { setCatalogoAberto(true); }} style={s.btn} accessibilityRole="button">
            <Icon name="plus" size={13} color={Colors.ink} />
            <Text style={s.btnText}>Adicionar bloco</Text>
          </Pressable>
          {Platform.OS === "web"
            ? <div title="Reordenar por arraste chega numa próxima entrega" style={{ display: "flex" }}>{botaoReordenar}</div>
            : botaoReordenar}
          <Pressable testID="painel-recalcular" onPress={aoRecalcular} disabled={recalculando} style={[s.btn, s.btnPrimario]} accessibilityRole="button">
            {recalculando ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="refresh" size={13} color="#fff" />}
            <Text style={[s.btnText, { color: "#fff" }]}>Recalcular</Text>
          </Pressable>
        </View>
      </View>

      {/* Faixa de indicadores */}
      {destaques.length > 0 && (
        <View style={s.faixa} testID="painel-destaques">
          {destaques.map(function(d) {
            return (
              <Pressable
                key={d.id}
                testID={"destaque-" + d.id}
                disabled={!d.bloco}
                onPress={function() { if (d.bloco) abrirBloco(d.bloco); }}
                style={[s.kpi, { width: larguraDe(largura, nDestaques) as any }]}
              >
                <Text style={s.rotulo} numberOfLines={1}>{d.rotulo}</Text>
                <View style={s.kpiCorpo}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.kpiValor} numberOfLines={1}>{d.valor}</Text>
                    <View style={s.kpiNota}>
                      {d.variacao ? <Pill variacao={d.variacao} /> : null}
                      <Text style={s.kpiNotaText} numberOfLines={1}>{d.nota}</Text>
                    </View>
                  </View>
                  <Sparkline valores={d.serie} tom={d.tom} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Alertas com verbo */}
      {painel.alertas.length > 0 && (
        <View style={s.alertas} testID="painel-alertas">
          {painel.alertas.map(function(a, i) {
            var cor = COR_ALERTA[a.tipo] || COR_ALERTA.atencao;
            return (
              <Pressable key={i} testID={"alerta-" + i} onPress={function() { aoTocarAlerta(a); }} style={[s.alerta, { width: larguraDe(largura, nAlertas) as any }]} accessibilityRole="button">
                <View style={[s.alertaHalo, { backgroundColor: cor.halo }]}><View style={[s.alertaPonto, { backgroundColor: cor.ponto }]} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.alertaTitulo}>{a.titulo}</Text>
                  <Text style={s.alertaDetalhe}>{a.detalhe}</Text>
                </View>
                {a.company_id && ehVerboDeContato(a.verbo) ? (
                  // O verbo do alerta de uma loja registra o contato direto.
                  <Pressable
                    testID={"verbo-do-alerta-" + i}
                    onPress={function() { setRegistrarDe({ company_id: a.company_id as string }); }}
                    accessibilityRole="button"
                    accessibilityLabel={a.verbo + ": registrar contato"}
                  >
                    <Text style={s.alertaVerbo}>{a.verbo} →</Text>
                  </Pressable>
                ) : (
                  <Text style={s.alertaVerbo}>{a.verbo} →</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {vazio && (
        <EstadoDaTela
          testID="painel-vazio"
          titulo="Nenhum bloco calculado hoje"
          texto="O cálculo do dia ainda não gravou nenhum bloco. Toque em Recalcular para rodar agora."
        />
      )}

      {/* Seções */}
      {!vazio && SECOES.map(function(sec, si) {
        // Dentro da seção, a ordem é a do layout salvo.
        var defs = DEFINICOES
          .filter(function(d) { return d.secao === sec.id && ativos.indexOf(d.id) >= 0; })
          .sort(function(a, b) { return ativos.indexOf(a.id) - ativos.indexOf(b.id); });
        var ultima = si === SECOES.length - 1;
        if (defs.length === 0 && !ultima) return null;
        return (
          <View key={sec.id} testID={"painel-secao-" + sec.id}>
            <View style={s.sec}>
              <Text style={s.h2}>{sec.titulo}</Text>
              <Text style={s.secNota}>{sec.nota || (defs.length + (defs.length === 1 ? " bloco" : " blocos"))}</Text>
            </View>
            <View style={s.grade}>
              {defs.map(function(def) {
                var estaAberto = aberto === def.id;
                return (
                  <BlocoCard
                    key={def.id}
                    ref={function(no) { cards.current[def.id] = no; }}
                    definicao={def}
                    bloco={blocoPorId[def.id] || null}
                    aberto={estaAberto}
                    largura={larguraDoCard(def.colunas, estaAberto)}
                    onAlternar={function() { alternar(def.id); }}
                    onAbrirLoja={setFichaDe}
                    onAbrirConversa={setConversaDe}
                    onVerbo={aoVerbo}
                    secaoExtra={def.id === "receita" ? <ExtratoBancario /> : undefined}
                    ocultarListas={LISTAS_SUBSTITUIDAS[def.id]}
                  />
                );
              })}
              {ultima && (
                <Pressable testID="painel-adicionar-bloco" onPress={function() { setCatalogoAberto(true); }} style={[s.adicionar, { width: larguraDoCard(4, false) as any }]} accessibilityRole="button">
                  <Icon name="plus" size={14} color={Colors.ink3} />
                  <Text style={s.adicionarText}>Adicionar bloco do catálogo</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      <CatalogoBlocos
        visible={catalogoAberto}
        itens={catalogo}
        ativos={ativos}
        onClose={function() { setCatalogoAberto(false); }}
        onSalvar={aoSalvarCatalogo}
        salvando={salvando}
      />
      <ConversaContatoModal
        conversaId={conversaDe}
        onClose={function() { setConversaDe(null); }}
        // A empresa vinculada abre a ficha dela (a conversa fecha: um modal por vez).
        onAbrirLoja={function(companyId) { setConversaDe(null); setFichaDe(companyId); }}
        onAviso={function(mensagem) { toast.info(mensagem); }}
      />
      <FichaClienteModal
        companyId={fichaDe}
        onClose={function() { setFichaDe(null); }}
        onRegistrarContato={function(companyId) { setRegistrarDe({ company_id: companyId }); }}
        onEstenderTrial={function(companyId, nome) { setEstenderDe({ company_id: companyId, nome: nome }); }}
        onAviso={function(mensagem) { toast.info(mensagem); }}
        // Abre a lista de Clientes já com o painel desta loja (?loja=).
        onAbrirCliente={function(companyId) {
          setFichaDe(null);
          router.push(("/gestao-aura-clientes?loja=" + encodeURIComponent(companyId)) as any);
        }}
      />
      {/* Por cima da ficha: registrar o contato e estender o teste. */}
      <RegistrarContatoModal alvo={registrarDe} onClose={function() { setRegistrarDe(null); }} />
      <EstenderTrialModal alvo={estenderDe} onClose={function() { setEstenderDe(null); }} />
    </View>
  );
}

var s = StyleSheet.create({
  rotulo: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: Colors.ink3 },
  hdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 },
  h1: { fontSize: 26, fontWeight: "800", color: Colors.ink, letterSpacing: -0.4, marginTop: 2 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 4, marginTop: 4 },
  metaText: { fontSize: 13, color: Colors.ink3 },
  metaForte: { fontWeight: "500", color: Colors.ink2 },
  acts: { flexDirection: "row", gap: 8, flexWrap: "wrap", maxWidth: "100%" },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 },
  btnPrimario: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnText: { fontSize: 14, fontWeight: "500", color: Colors.ink },
  faixa: { flexDirection: "row", flexWrap: "wrap", gap: GAP, marginBottom: 14 },
  kpi: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, gap: 6, minWidth: 0 },
  kpiCorpo: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  kpiValor: { fontSize: 30, lineHeight: 32, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  kpiNota: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  kpiNotaText: { flexShrink: 1, fontSize: 12, color: Colors.ink3 },
  alertas: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  alerta: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minWidth: 0 },
  alertaHalo: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  alertaPonto: { width: 10, height: 10, borderRadius: 5 },
  alertaTitulo: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  alertaDetalhe: { fontSize: 12, color: Colors.ink3 },
  alertaVerbo: { fontSize: 14, fontWeight: "600", color: Paleta.accentTexto },
  sec: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 6, marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  secNota: { fontSize: 12, color: Colors.ink3 },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: GAP, marginBottom: 30 },
  adicionar: { minHeight: 150, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 16, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", padding: 16 },
  adicionarText: { fontSize: 14, color: Colors.ink3 },
  estado: { alignItems: "center", gap: 10, paddingVertical: 48, paddingHorizontal: 20, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 },
  estadoTitulo: { fontSize: 16, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  estadoTexto: { fontSize: 13, color: Colors.ink3, textAlign: "center", maxWidth: 420 },
});
