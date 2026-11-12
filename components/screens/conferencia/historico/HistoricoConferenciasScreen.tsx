// ============================================================
// AURA. — Conferência de estoque · Histórico e desfazer (p-108, entrega C)
//
// Mockup aprovado: claude.ai/artifact/NYmEGh4GYjWYjz5krAUTbk ("Últimas
// conferências" e "Desfazer a conferência").
//
//   · conferências da loja, mais recentes primeiro: em andamento (rascunho),
//     ajustadas, desfeitas e descartadas, cada uma com o resumo;
//   · Desfazer até 7 dias depois de ajustar, só para quem edita o estoque,
//     com o ConfirmDialog do app num WebPortal. A tela mostra até quando;
//     passado o prazo, o botão some e fica o texto;
//   · no consolidado multi-CNPJ (sem ?loja=), a pessoa escolhe a loja.
//
// Antes do backend no ar: 503 MIGRATION_PENDING / 404 viram texto gentil.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import {
  conferenciaEstoqueResultadoApi, mensagemDaConferencia,
  type ConferenciaNoHistorico,
} from "@/services/conferenciaEstoqueResultadoApi";
import { useConferenciaContexto } from "@/hooks/useConferenciaResultado";
import {
  DIAS_PARA_DESFAZER, ROTULO_STATUS, brl, dataCurta, dataEHora, desfazerAte, itens as nItens,
  podeDesfazerAgora, qtd, rotuloDoEscopo,
} from "@/utils/conferenciaResultado";
import { Aviso, Botao, Cartao, Selo, ui } from "@/components/screens/conferencia/diferencas/ui";
import { NavDaConferencia } from "@/components/screens/conferencia/NavDaConferencia";

var POR_PAGINA = 20;

type Props = { lojaDaRota?: string | null; agora?: () => Date };

function sufixoLoja(loja: string | null | undefined): string {
  return loja ? "?loja=" + encodeURIComponent(loja) : "";
}

export function HistoricoConferenciasScreen({ lojaDaRota, agora }: Props) {
  var [lojaEscolhida, setLojaEscolhida] = useState<string | null>(null);
  var ctx = useConferenciaContexto(lojaDaRota || lojaEscolhida);
  var companyId = ctx.companyId;
  var lojaDosLinks = lojaDaRota || lojaEscolhida;
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  var [lista, setLista] = useState<ConferenciaNoHistorico[]>([]);
  var [carregando, setCarregando] = useState(true);
  var [carregandoMais, setCarregandoMais] = useState(false);
  var [temMais, setTemMais] = useState(false);
  var [cursor, setCursor] = useState<string | null>(null);
  var [erro, setErro] = useState<string | null>(null);

  var [desfazerDe, setDesfazerDe] = useState<ConferenciaNoHistorico | null>(null);
  var [desfazendo, setDesfazendo] = useState<string | null>(null);
  var [erroDesfazer, setErroDesfazer] = useState<{ id: string; msg: string } | null>(null);

  var carregar = useCallback(function () {
    if (!companyId) { setCarregando(false); setLista([]); return Promise.resolve(); }
    setCarregando(true);
    setErro(null);
    return conferenciaEstoqueResultadoApi.historico(companyId, { limit: POR_PAGINA })
      .then(function (r) {
        if (!vivo.current) return;
        setLista(r.conferencias);
        setCursor(r.proximo);
        setTemMais(!!r.proximo);
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErro(mensagemDaConferencia(e, "lista"));
      })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }, [companyId]);

  useEffect(function () { carregar(); }, [carregar]);

  function carregarMais() {
    if (!companyId || carregandoMais || !cursor) return;
    setCarregandoMais(true);
    conferenciaEstoqueResultadoApi.historico(companyId, { limit: POR_PAGINA, before: cursor })
      .then(function (r) {
        if (!vivo.current) return;
        var ids: Record<string, boolean> = {};
        lista.forEach(function (c) { ids[c.id] = true; });
        var novas = r.conferencias.filter(function (c) { return !ids[c.id]; });
        setLista(lista.concat(novas));
        setCursor(r.proximo);
        setTemMais(novas.length > 0 && !!r.proximo);
      })
      .catch(function (e) { if (vivo.current) toast.error(mensagemDaConferencia(e, "lista")); })
      .finally(function () { if (vivo.current) setCarregandoMais(false); });
  }

  function desfazer() {
    var alvo = desfazerDe;
    setDesfazerDe(null);
    if (!alvo || !companyId || desfazendo) return;
    var c: ConferenciaNoHistorico = alvo;
    setDesfazendo(c.id);
    setErroDesfazer(null);
    conferenciaEstoqueResultadoApi.desfazer(companyId, c.id)
      .then(function (r) {
        if (!vivo.current) return;
        toast.success("Conferência nº " + c.numero + " desfeita. O estoque voltou ao que era.");
        var nova = r && r.conferencia ? r.conferencia : null;
        setLista(function (l) {
          return l.map(function (x) {
            if (x.id !== c.id) return x;
            return nova ? { ...x, ...nova } : { ...x, status: "desfeita", desfeita_em: new Date().toISOString() };
          });
        });
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErroDesfazer({ id: c.id, msg: mensagemDaConferencia(e, "desfazer") });
        if (e && e.status === 409) carregar();
      })
      .finally(function () { if (vivo.current) setDesfazendo(null); });
  }

  function irPara(caminho: string) { router.push(caminho as any); }

  var hoje = agora ? agora() : new Date();

  // Quem não vê custo recebe valor_* nulos: some o valor, nunca "R$ 0".
  function textoDoValor(c: ConferenciaNoHistorico): string {
    if (ctx.semCusto) return "";
    var partes: string[] = [];
    if (c.valor_faltam != null) partes.push(brl(c.valor_faltam) + " de falta");
    if (c.valor_sobram != null) partes.push(brl(c.valor_sobram) + " de sobra");
    return partes.length ? " · a custo: " + partes.join(", ") : "";
  }

  function cartao(c: ConferenciaNoHistorico) {
    var ate = desfazerAte(c);
    var dentro = podeDesfazerAgora(c, hoje);
    var quando = c.aplicada_em || c.criada_em || c.created_at || null;
    var difs = (Number(c.faltam) || 0) + (Number(c.sobram) || 0);
    var partes: string[] = [];
    if (c.itens_contados != null) partes.push(qtd(Number(c.itens_contados)) + " contados");
    if (c.faltam != null || c.sobram != null) partes.push(difs === 1 ? "1 diferença" : qtd(difs) + " diferenças");
    if (c.criada_por_nome) partes.push("por " + c.criada_por_nome);
    var seloTipo = c.status === "aplicada" ? "verde" : c.status === "rascunho" ? "ambar" : "neutro";
    return (
      <Cartao key={c.id} testID={"hist-conf-" + c.id}>
        <View style={[ui.linhaFlex, { justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.nome}>{"Conferência nº " + c.numero + (quando ? " · " + dataCurta(quando) : "")}</Text>
            <Text style={ui.nota}>{rotuloDoEscopo(c.escopo)}</Text>
          </View>
          <Selo tipo={seloTipo as any} testID={"hist-status-" + c.id}>{ROTULO_STATUS[c.status] || c.status}</Selo>
        </View>
        {partes.length > 0 ? <Text style={[ui.nota, { marginTop: 4 }]} testID={"hist-resumo-" + c.id}>{partes.join(" · ")}</Text> : null}
        {(c.faltam != null || c.sobram != null) ? (
          <Text style={[ui.nota, { marginTop: 2 }]} testID={"hist-faltam-sobram-" + c.id}>
            {"Faltaram " + qtd(Number(c.faltam) || 0) + " · sobraram " + qtd(Number(c.sobram) || 0) + textoDoValor(c)}
          </Text>
        ) : null}
        {c.motivo ? <Text style={[ui.nota, { marginTop: 2 }]}>{"Motivo: " + c.motivo}</Text> : null}

        {c.status === "rascunho" ? (
          <View style={[ui.acoes, { marginTop: 10, justifyContent: "flex-start" }]}>
            <Botao pequeno tipo="secundario" rotulo="Continuar contando"
              onPress={function () { irPara("/conferencia-estoque/" + encodeURIComponent(c.id) + sufixoLoja(lojaDosLinks)); }} testID={"hist-continuar-" + c.id} />
            <Botao pequeno tipo="secundario" rotulo="Ver diferenças"
              onPress={function () { irPara("/conferencia-estoque/" + encodeURIComponent(c.id) + "/diferencas" + sufixoLoja(lojaDosLinks)); }} testID={"hist-diferencas-" + c.id} />
          </View>
        ) : null}

        {c.status === "aplicada" ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {dentro && ate ? (
              <Text style={ui.nota} testID={"hist-prazo-" + c.id}>{"Dá para desfazer até " + dataEHora(ate.toISOString()) + "."}</Text>
            ) : (
              <Text style={ui.nota} testID={"hist-prazo-acabou-" + c.id}>
                {"O prazo de " + DIAS_PARA_DESFAZER + " dias para desfazer acabou" + (ate ? " em " + dataCurta(ate.toISOString()) : "") + ". Os ajustes continuam valendo, e a conferência segue registrada aqui."}
              </Text>
            )}
            <View style={[ui.acoes, { justifyContent: "flex-start" }]}>
              <Botao pequeno tipo="secundario" rotulo="Ver diferenças"
                onPress={function () { irPara("/conferencia-estoque/" + encodeURIComponent(c.id) + "/diferencas" + sufixoLoja(lojaDosLinks)); }} testID={"hist-diferencas-" + c.id} />
              {dentro && ctx.podeEditar ? (
                <Botao pequeno tipo="perigo" rotulo="Desfazer" ocupado={desfazendo === c.id}
                  onPress={function () { setErroDesfazer(null); setDesfazerDe(c); }} testID={"hist-desfazer-" + c.id} />
              ) : null}
            </View>
            {dentro && !ctx.podeEditar && !ctx.carregandoPermissao ? (
              <Text style={ui.nota} testID={"hist-so-quem-edita-" + c.id}>Quem pode editar o estoque consegue desfazer.</Text>
            ) : null}
          </View>
        ) : null}

        {c.status === "desfeita" ? (
          <Text style={[ui.nota, { marginTop: 8 }]} testID={"hist-desfeita-" + c.id}>
            {"Desfeita" + (c.desfeita_em ? " em " + dataCurta(c.desfeita_em) : "") + ". O estoque voltou ao que era, e a conferência segue registrada aqui."}
          </Text>
        ) : null}

        {erroDesfazer && erroDesfazer.id === c.id ? (
          <View style={{ marginTop: 8 }}><Aviso tipo="erro" testID={"hist-erro-desfazer-" + c.id}>{erroDesfazer.msg}</Aviso></View>
        ) : null}
      </Cartao>
    );
  }

  return (
    <View style={ui.tela}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={ui.conteudo} testID="hist-tela">
        <NavDaConferencia
          voltar={{ rotulo: "Voltar à conferência", destino: "/conferencia-estoque" + sufixoLoja(lojaDosLinks), testID: "hist-voltar" }}
          testIDEstoque="hist-ir-estoque"
        />
        <Text style={ui.titulo}>Histórico de conferências</Text>
        <Text style={ui.sub} testID="hist-sub">
          {"Cada conferência ajustada fica registrada aqui; em “Ver diferenças” você vê o que mudou em cada item. Se precisar, dá para desfazer a conferência inteira por " + DIAS_PARA_DESFAZER + " dias."}
        </Text>

        {!lojaDaRota && ctx.lojasParaEscolher.length > 0 ? (
          <Cartao testID="hist-escolher-loja">
            <Text style={ui.h3}>De qual loja?</Text>
            <Text style={ui.nota}>Cada loja tem o seu estoque e as suas conferências.</Text>
            <View style={[ui.linhaFlex, { marginTop: 10 }]}>
              {ctx.lojasParaEscolher.map(function (l) {
                var on = l.id === lojaEscolhida;
                return (
                  <Pressable key={l.id} onPress={function () { setLojaEscolhida(l.id); }}
                    style={[s.loja, on && s.lojaOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    testID={"hist-loja-" + l.id}>
                    <Text style={[s.lojaTxt, on && { color: Colors.ink, fontWeight: "700" }]} numberOfLines={1}>{l.nome}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Cartao>
        ) : null}

        {!companyId ? null : carregando ? (
          <View style={{ alignItems: "center", padding: 24 }} testID="hist-carregando">
            <ActivityIndicator color={Colors.violet3} />
          </View>
        ) : erro ? (
          <View style={{ gap: 10 }}>
            <Aviso tipo="erro" testID="hist-erro">{erro}</Aviso>
            <View style={ui.acoes}><Botao tipo="secundario" rotulo="Tentar de novo" onPress={function () { carregar(); }} testID="hist-tentar" /></View>
          </View>
        ) : lista.length === 0 ? (
          <Aviso tipo="info" testID="hist-vazio">
            Nenhuma conferência nesta loja ainda. Quando você conferir o estoque, ela aparece aqui com o que mudou.
          </Aviso>
        ) : (
          <View style={{ gap: 12 }} testID="hist-lista">
            {lista.map(cartao)}
            {temMais ? (
              <View style={{ alignItems: "center" }}>
                <Botao tipo="secundario" rotulo="Carregar mais" onPress={carregarMais} ocupado={carregandoMais} testID="hist-mais" />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <WebPortal active={!!desfazerDe}>
        <ConfirmDialog
          visible={!!desfazerDe}
          title={desfazerDe ? "Desfazer a conferência nº " + desfazerDe.numero + "?" : "Desfazer a conferência?"}
          message={"Vamos devolver ao estoque a diferença que esta conferência ajustou, item por item"
            + (desfazerDe && (desfazerDe.faltam != null || desfazerDe.sobram != null)
              ? " (" + nItens((Number(desfazerDe.faltam) || 0) + (Number(desfazerDe.sobram) || 0)) + ")" : "")
            + ". As vendas feitas desde então ficam mantidas. A conferência continua registrada aqui, marcada como desfeita. Só dá para desfazer uma vez."}
          confirmLabel="Desfazer"
          cancelLabel="Manter o ajuste"
          destructive
          onConfirm={desfazer}
          onCancel={function () { setDesfazerDe(null); }}
        />
      </WebPortal>
    </View>
  );
}

var s = StyleSheet.create({
  nome: { fontSize: 14.5, fontWeight: "700", color: Colors.ink },
  loja: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, maxWidth: "100%",
  },
  lojaOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  lojaTxt: { fontSize: 13.5, color: Colors.ink2 },
});

export default HistoricoConferenciasScreen;
