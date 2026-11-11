// ============================================================
// AURA. — Conferência de estoque · Diferenças, ajustar e transferir
// (p-108, entrega C, 11/11/2026)
//
// Mockup aprovado pelo Caio: claude.ai/artifact/NYmEGh4GYjWYjz5krAUTbk
// (etapas 3 "Diferenças" e 4 "Ajustado").
//
//   · resumo: batem, faltam (peças), sobram (peças), não contados; falta e
//     sobra a custo, e quantos itens ficaram fora por não ter custo (some
//     para quem não vê custo, como no Estoque);
//   · listas por grupo; "batem" e "não contados" abrem num toque;
//   · "zerar não contados" só por escolha explícita, começa desmarcado;
//   · Ajustar: só quem edita o estoque, com o ConfirmDialog do app num
//     WebPortal (nunca confirm()). A regra do backend soma ou tira só a
//     diferença do que o sistema tinha no bipe, então a venda feita depois
//     da contagem fica mantida — a confirmação diz isso;
//   · Transferir (ajuste de escopo do Caio, 11/11): só com 2+ lojas
//     (lojasDaTransferencia) e para quem edita o estoque. Escolhe os itens
//     (as sobras já vêm marcadas) e abre o TransferirModal do Estoque
//     pré-preenchido, mandando stock_count_id. Antes ou depois de ajustar.
//
// Antes do backend no ar: 503 MIGRATION_PENDING / 404 viram texto gentil.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import { TransferirModal } from "@/components/screens/estoque/transferencia/TransferirModal";
import {
  conferenciaEstoqueResultadoApi, mensagemDaConferencia, MSG_SO_QUEM_EDITA,
  type Conferencia, type ItemDiferenca, type RespostaDiferencas, type TransferenciaDaConferencia,
} from "@/services/conferenciaEstoqueResultadoApi";
import { useConferenciaContexto } from "@/hooks/useConferenciaResultado";
import {
  DIAS_PARA_DESFAZER, brl, chaveDoItem, comSinal, dataCurta, dataEHora, desfazerAte, itens as nItens,
  montarTransferencia, pecas, podeDesfazerAgora, qtd, rotuloDoEscopo, somaDasPecas,
} from "@/utils/conferenciaResultado";
import { plural as pluralQtd, textoDosNumeros } from "@/utils/transferenciaEstoque";
import { Aviso, Botao, Cartao, Marcar, Selo, ui } from "./ui";

type Props = { countId: string; lojaDaRota?: string | null };

function sufixoLoja(loja: string | null | undefined): string {
  return loja ? "?loja=" + encodeURIComponent(loja) : "";
}

export function DiferencasScreen({ countId, lojaDaRota }: Props) {
  var ctx = useConferenciaContexto(lojaDaRota);
  var companyId = ctx.companyId;
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  var [carregando, setCarregando] = useState(true);
  var [erro, setErro] = useState<string | null>(null);
  var [conf, setConf] = useState<Conferencia | null>(null);
  var [transferencias, setTransferencias] = useState<TransferenciaDaConferencia[]>([]);
  var [dif, setDif] = useState<RespostaDiferencas | null>(null);

  var [zerar, setZerar] = useState(false);
  var [confirmar, setConfirmar] = useState(false);
  var [aplicando, setAplicando] = useState(false);
  var [erroAplicar, setErroAplicar] = useState<string | null>(null);
  var [ajustadosAgora, setAjustadosAgora] = useState<number | null>(null);

  var [verBatem, setVerBatem] = useState(false);
  var [verNaoContados, setVerNaoContados] = useState(false);

  var [escolhendo, setEscolhendo] = useState(false);
  var [escolhidos, setEscolhidos] = useState<Record<string, boolean>>({});
  var [transferirAberto, setTransferirAberto] = useState(false);
  var [aberturas, setAberturas] = useState(0);

  var carregar = useCallback(function (silencioso?: boolean) {
    if (!companyId) { setCarregando(false); return Promise.resolve(); }
    if (!silencioso) setCarregando(true);
    setErro(null);
    return Promise.all([
      conferenciaEstoqueResultadoApi.obter(companyId, countId),
      conferenciaEstoqueResultadoApi.diferencas(companyId, countId),
    ])
      .then(function (r) {
        if (!vivo.current) return;
        setConf(r[0] && r[0].conferencia ? r[0].conferencia : null);
        setTransferencias(Array.isArray(r[0] && r[0].transferencias) ? (r[0].transferencias as TransferenciaDaConferencia[]) : []);
        setDif(r[1]);
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErro(mensagemDaConferencia(e, "carregar"));
      })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }, [companyId, countId]);

  useEffect(function () { carregar(); }, [carregar]);

  var grupos = useMemo(function () {
    var out = { faltam: [] as ItemDiferenca[], sobram: [] as ItemDiferenca[], batem: [] as ItemDiferenca[] };
    (dif ? dif.itens : []).forEach(function (it) { out[it.grupo].push(it); });
    return out;
  }, [dif]);

  var naoContados = dif ? dif.nao_contados : [];
  var zeraveis = naoContados.filter(function (n) { return n.estoque_atual !== 0; });
  var status = conf ? conf.status : null;
  var rascunho = status === "rascunho";
  var aAjustar = grupos.faltam.length + grupos.sobram.length + (zerar ? zeraveis.length : 0);

  var lojas = ctx.lojasTransferencia;
  var podeTransferir = !!lojas && ctx.podeEditar && (status === "rascunho" || status === "aplicada")
    && (grupos.faltam.length + grupos.sobram.length + grupos.batem.length) > 0;

  // ── Ajustar ──────────────────────────────────────────────────
  function aplicar() {
    if (!companyId || aplicando) return;
    setConfirmar(false);
    setAplicando(true);
    setErroAplicar(null);
    var esperado = aAjustar;
    conferenciaEstoqueResultadoApi.aplicar(companyId, countId, { zerar_nao_contados: zerar })
      .then(function (r) {
        if (!vivo.current) return;
        var n = r && r.itens_ajustados != null && isFinite(Number(r.itens_ajustados)) ? Number(r.itens_ajustados) : esperado;
        setAjustadosAgora(n);
        if (r && r.conferencia) setConf(r.conferencia);
        return carregar(true);
      })
      .catch(function (e) {
        if (!vivo.current) return;
        setErroAplicar(mensagemDaConferencia(e, "aplicar"));
        // 409: já foi ajustada (clique duplo, outro aparelho) — mostra o estado real.
        if (e && e.status === 409) carregar(true);
      })
      .finally(function () { if (vivo.current) setAplicando(false); });
  }

  // ── Transferir ───────────────────────────────────────────────
  function comecarEscolha() {
    var m: Record<string, boolean> = {};
    grupos.sobram.forEach(function (it) { m[chaveDoItem(it)] = true; });
    setEscolhidos(m);
    setEscolhendo(true);
  }
  function alternar(it: ItemDiferenca) {
    var k = chaveDoItem(it);
    setEscolhidos(function (m) { var n = { ...m }; if (n[k]) delete n[k]; else n[k] = true; return n; });
  }
  function marcarSobras() {
    setEscolhidos(function (m) {
      var n = { ...m };
      grupos.sobram.forEach(function (it) { n[chaveDoItem(it)] = true; });
      return n;
    });
  }
  var listaEscolhida = useMemo(function () {
    return (dif ? dif.itens : []).filter(function (it) { return !!escolhidos[chaveDoItem(it)]; });
  }, [dif, escolhidos]);
  var transferencia = useMemo(function () { return montarTransferencia(listaEscolhida); }, [listaEscolhida]);

  function abrirTransferir() {
    if (listaEscolhida.length === 0) return;
    setAberturas(function (n) { return n + 1; });
    setTransferirAberto(true);
  }

  function irPara(caminho: string) { router.push(caminho as any); }

  // ── Render ───────────────────────────────────────────────────
  function linha(it: ItemDiferenca) {
    var k = chaveDoItem(it);
    var mudou = Math.abs(it.estoque_atual - it.estoque_no_bipe) > 1e-9;
    var cor = it.diferenca < 0 ? Colors.red : it.diferenca > 0 ? Colors.green : Colors.ink3;
    var corpo = (
      <View style={s.linhaCorpo}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nome} numberOfLines={2}>{it.nome}</Text>
          <Text style={ui.nota} testID={"dif-sub-" + k}>
            {(it.variante ? it.variante + " · " : "") + "sistema " + qtd(it.estoque_no_bipe) + ", contado " + qtd(it.contado)}
          </Text>
          {mudou ? (
            <Text style={ui.nota} testID={"dif-mudou-" + k}>
              {"Agora tem " + qtd(it.estoque_atual) + ": mudou depois que você contou, e isso fica mantido."}
            </Text>
          ) : null}
        </View>
        <Text style={[s.num, { color: cor }]} testID={"dif-num-" + k}>{comSinal(it.diferenca)}</Text>
      </View>
    );
    return (
      <View key={k} style={s.linha} testID={"dif-item-" + k}>
        {escolhendo ? (
          <Marcar marcado={!!escolhidos[k]} onPress={function () { alternar(it); }}
            rotulo={"Transferir " + it.nome + (it.variante ? " " + it.variante : "")} testID={"dif-escolher-" + k}>
            {corpo}
          </Marcar>
        ) : corpo}
      </View>
    );
  }

  function grupo(titulo: string, lista: ItemDiferenca[], testID: string) {
    if (lista.length === 0) return null;
    return (
      <Cartao style={{ paddingHorizontal: 4, paddingVertical: 4 }} testID={testID}>
        <Text style={[ui.h3, { paddingHorizontal: 10, paddingTop: 8 }]}>{titulo}</Text>
        {lista.map(linha)}
      </Cartao>
    );
  }

  var cabecalho = (
    <View>
      <Pressable onPress={function () { irPara("/conferencia-estoque" + sufixoLoja(lojaDaRota)); }} style={ui.voltar}
        accessibilityRole="link" testID="dif-voltar-lista">
        <Text style={ui.voltarTxt}>‹ Conferências</Text>
      </Pressable>
      <View style={[ui.linhaFlex, { justifyContent: "space-between" }]}>
        <Text style={ui.titulo}>Diferenças</Text>
        {status === "aplicada" ? <Selo tipo="verde" testID="dif-status">Ajustada</Selo>
          : status === "desfeita" ? <Selo tipo="neutro" testID="dif-status">Desfeita</Selo>
          : status === "descartada" ? <Selo tipo="neutro" testID="dif-status">Descartada</Selo>
          : status === "rascunho" ? <Selo tipo="ambar" testID="dif-status">Rascunho salvo</Selo> : null}
      </View>
      {conf ? (
        <Text style={ui.sub} testID="dif-subtitulo">
          {"Conferência nº " + conf.numero + " · " + rotuloDoEscopo(conf.escopo) + (ctx.nomeDaLoja ? " · " + ctx.nomeDaLoja : "")}
        </Text>
      ) : null}
    </View>
  );

  if (!companyId) {
    return (
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} testID="dif-tela">
        {cabecalho}
        <Aviso tipo="info" testID="dif-sem-loja">
          Você está vendo todas as lojas juntas. Abra esta conferência a partir da loja em que ela foi feita.
        </Aviso>
      </ScrollView>
    );
  }

  if (carregando) {
    return (
      <View style={[ui.tela, { alignItems: "center", justifyContent: "center", padding: 24 }]} testID="dif-carregando">
        <ActivityIndicator color={Colors.violet3} />
        <Text style={[ui.nota, { marginTop: 10 }]}>Comparando a contagem com o sistema…</Text>
      </View>
    );
  }

  if (erro || !dif || !conf) {
    return (
      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} testID="dif-tela">
        {cabecalho}
        <Aviso tipo="erro" testID="dif-erro">{erro || "Não conseguimos abrir esta conferência agora."}</Aviso>
        <View style={ui.acoes}>
          <Botao tipo="secundario" rotulo="Tentar de novo" onPress={function () { carregar(); }} testID="dif-tentar" />
        </View>
      </ScrollView>
    );
  }

  var r = dif.resumo;
  var pecasF = somaDasPecas(grupos.faltam);
  var pecasS = somaDasPecas(grupos.sobram);
  var ate = desfazerAte(conf);
  var aindaDesfaz = podeDesfazerAgora(conf);

  return (
    <View style={ui.tela}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[ui.conteudo, escolhendo && { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled" testID="dif-tela">
        {cabecalho}

        {/* Ajustado (agora ou antes) */}
        {status === "aplicada" ? (
          <Aviso tipo="ok" testID="dif-ajustado">
            <Text style={[ui.avisoTxt, { fontWeight: "700" }]}>
              {ajustadosAgora != null ? "Estoque ajustado em " + nItens(ajustadosAgora) + "." : "Esta conferência já ajustou o estoque."}
            </Text>
            <Text style={[ui.nota, { marginTop: 6 }]}>
              {"Cada ajuste foi lançado no histórico do produto como “Conferência nº " + conf.numero + "”."
                + (aindaDesfaz && ate ? " Você pode desfazer tudo até " + dataEHora(ate.toISOString()) + ", no histórico." : "")}
            </Text>
          </Aviso>
        ) : null}
        {status === "desfeita" ? (
          <Aviso tipo="info" testID="dif-desfeita">
            {"Conferência desfeita" + (conf.desfeita_em ? " em " + dataCurta(conf.desfeita_em) : "") + ". O estoque voltou ao que era; os lançamentos continuam no histórico do produto, marcados como desfeitos."}
          </Aviso>
        ) : null}

        {/* Resumo */}
        <View style={s.resumo} testID="dif-resumo">
          <View style={s.resumoCel}><Text style={s.resumoNum} testID="dif-resumo-batem">{qtd(r.batem)}</Text><Text style={ui.nota}>batem</Text></View>
          <View style={s.resumoCel}><Text style={[s.resumoNum, { color: Colors.red }]} testID="dif-resumo-faltam">{qtd(r.faltam)}</Text><Text style={ui.nota}>{"faltam · " + pecas(pecasF)}</Text></View>
          <View style={s.resumoCel}><Text style={[s.resumoNum, { color: Colors.green }]} testID="dif-resumo-sobram">{qtd(r.sobram)}</Text><Text style={ui.nota}>{"sobram · " + pecas(pecasS)}</Text></View>
          <View style={s.resumoCel}><Text style={s.resumoNum} testID="dif-resumo-nao-contados">{qtd(r.nao_contados)}</Text><Text style={ui.nota}>não contados</Text></View>
        </View>

        {!ctx.semCusto ? (
          <Cartao testID="dif-custo">
            <View style={ui.linhaFlex}>
              <Selo tipo="vermelho" testID="dif-valor-faltam">{"Falta a custo: " + brl(r.valor_faltam || 0)}</Selo>
              <Selo tipo="verde" testID="dif-valor-sobram">{"Sobra a custo: " + brl(r.valor_sobram || 0)}</Selo>
            </View>
            <Text style={[ui.nota, { marginTop: 8 }]} testID="dif-sem-custo">
              {r.itens_sem_custo > 0
                ? (r.itens_sem_custo === 1 ? "1 item sem custo cadastrado ficou fora desta conta." : qtd(r.itens_sem_custo) + " itens sem custo cadastrado ficaram fora desta conta.")
                : "Todos os itens têm custo cadastrado."}
            </Text>
          </Cartao>
        ) : null}

        {dif.itens.length === 0 ? (
          <Aviso tipo="info" testID="dif-vazia">Nada foi contado nesta conferência ainda. Volte para a contagem e bipe ou busque os itens.</Aviso>
        ) : null}

        {(grupos.faltam.length + grupos.sobram.length) > 0 ? (
          <Text style={ui.nota} testID="dif-nota-venda">
            A venda feita depois que você contou cada item é mantida: a Aura só soma ou tira a diferença.
          </Text>
        ) : null}

        {grupo("Faltam", grupos.faltam, "dif-grupo-faltam")}
        {grupo("Sobram", grupos.sobram, "dif-grupo-sobram")}

        {grupos.batem.length > 0 ? (
          verBatem || escolhendo ? grupo("Batem", grupos.batem, "dif-grupo-batem") : (
            <Pressable onPress={function () { setVerBatem(true); }} style={ui.voltar} accessibilityRole="button" testID="dif-ver-batem">
              <Text style={ui.voltarTxt}>{"Ver os " + qtd(grupos.batem.length) + " que batem"}</Text>
            </Pressable>
          )
        ) : null}

        {/* Zerar não contados: só por escolha, desmarcado */}
        {rascunho && naoContados.length > 0 && ctx.podeEditar && !escolhendo ? (
          <Cartao testID="dif-zerar-cartao">
            <Marcar marcado={zerar} onPress={function () { setZerar(!zerar); }} rotulo="Zerar o que não apareceu" testID="dif-zerar">
              <Text style={s.nome}>Contei tudo: zerar o que não apareceu</Text>
              <Text style={ui.nota}>
                {(naoContados.length === 1 ? "1 item não contado." : qtd(naoContados.length) + " itens não contados.") + " Se não marcar, ficam como estão."}
              </Text>
            </Marcar>
            {zerar ? (
              <View style={{ marginTop: 8 }}>
                <Selo tipo="ambar" testID="dif-zerar-aviso">{"Esses itens vão para 0. Dá para desfazer por " + DIAS_PARA_DESFAZER + " dias."}</Selo>
              </View>
            ) : null}
          </Cartao>
        ) : null}

        {naoContados.length > 0 ? (
          verNaoContados ? (
            <Cartao testID="dif-grupo-nao-contados">
              <Text style={ui.h3}>Não contados</Text>
              {naoContados.map(function (n) {
                var k = chaveDoItem(n);
                return (
                  <Text key={k} style={[ui.nota, { paddingVertical: 4 }]} testID={"dif-nao-contado-" + k}>
                    {n.nome + (n.variante ? " · " + n.variante : "") + " · tem " + qtd(n.estoque_atual) + " no sistema"}
                  </Text>
                );
              })}
            </Cartao>
          ) : (
            <Pressable onPress={function () { setVerNaoContados(true); }} style={ui.voltar} accessibilityRole="button" testID="dif-ver-nao-contados">
              <Text style={ui.voltarTxt}>{"Ver os " + qtd(naoContados.length) + " não contados"}</Text>
            </Pressable>
          )
        ) : null}

        {conf.motivo ? (
          <Cartao testID="dif-motivo">
            <Text style={ui.nota}>MOTIVO</Text>
            <Text style={[s.nome, { marginTop: 4 }]}>{conf.motivo}</Text>
          </Cartao>
        ) : null}

        {/* Transferir entre lojas */}
        {podeTransferir && !escolhendo ? (
          <Cartao testID="dif-transferir-cartao">
            <Text style={ui.h3}>Mandar para outra loja</Text>
            <Text style={ui.nota}>
              Sobrou peça aqui e falta em outra loja do grupo? Escolha os itens e transfira sem sair da conferência. As sobras já vêm marcadas.
            </Text>
            <View style={{ marginTop: 10 }}>
              <Botao tipo="secundario" rotulo="Escolher itens para transferir" onPress={comecarEscolha} testID="dif-transferir" />
            </View>
          </Cartao>
        ) : null}
        {transferencias.length > 0 ? (
          <Text style={ui.nota} testID="dif-transferencias">
            {"Transferências desta conferência: " + transferencias.map(function (t) {
              return "nº " + t.numero + (t.destino_nome ? " para " + t.destino_nome : "") + (t.total_pecas != null ? " (" + pecas(Number(t.total_pecas)) + ")" : "");
            }).join(", ") + "."}
          </Text>
        ) : null}

        {!!erroAplicar && <Aviso tipo="erro" testID="dif-erro-aplicar">{erroAplicar}</Aviso>}

        {/* Ações */}
        {rascunho && !escolhendo ? (
          <View style={ui.acoes}>
            <Botao tipo="secundario" rotulo="Voltar e contar mais"
              onPress={function () { irPara("/conferencia-estoque/" + encodeURIComponent(countId) + sufixoLoja(lojaDaRota)); }} testID="dif-contar-mais" />
            {ctx.podeEditar ? (
              <Botao rotulo={"Ajustar " + nItens(aAjustar)} onPress={function () { setConfirmar(true); }}
                desabilitado={aAjustar === 0} ocupado={aplicando} testID="dif-ajustar" />
            ) : null}
          </View>
        ) : null}
        {rascunho && !ctx.podeEditar && !ctx.carregandoPermissao ? (
          <Text style={ui.nota} testID="dif-so-quem-edita">{MSG_SO_QUEM_EDITA}</Text>
        ) : null}
        {!rascunho && !escolhendo ? (
          <View style={ui.acoes}>
            <Botao tipo="secundario" rotulo="Ver histórico" onPress={function () { irPara("/conferencia-estoque/historico" + sufixoLoja(lojaDaRota)); }} testID="dif-historico" />
            <Botao rotulo="Nova conferência" onPress={function () { irPara("/conferencia-estoque" + sufixoLoja(lojaDaRota)); }} testID="dif-nova" />
          </View>
        ) : null}
      </ScrollView>

      {/* Barra da escolha para transferir: sempre visível, sem hover */}
      {escolhendo ? (
        <View style={s.barra} testID="dif-barra-transferir">
          <Text style={[ui.nota, { flexBasis: "100%" }]} testID="dif-barra-texto">
            {listaEscolhida.length === 0 ? "Toque nos itens que vão para outra loja." : nItens(listaEscolhida.length) + " para transferir"}
          </Text>
          {grupos.sobram.length > 0 ? (
            <Botao tipo="secundario" pequeno rotulo="Marcar as sobras" onPress={marcarSobras} testID="dif-marcar-sobras" />
          ) : null}
          <View style={{ flex: 1 }} />
          <Botao tipo="secundario" pequeno rotulo="Cancelar" onPress={function () { setEscolhendo(false); setEscolhidos({}); }} testID="dif-cancelar-escolha" />
          <Botao pequeno rotulo={"Transferir " + nItens(listaEscolhida.length)} onPress={abrirTransferir}
            desabilitado={listaEscolhida.length === 0} testID="dif-abrir-transferir" />
        </View>
      ) : null}

      <WebPortal active={confirmar}>
        <ConfirmDialog
          visible={confirmar}
          title="Ajustar o estoque?"
          message={"Vamos ajustar " + nItens(aAjustar) + " pela sua contagem. As vendas feitas depois que você contou cada item ficam mantidas: a Aura só soma ou tira a diferença."
            + (zerar && zeraveis.length > 0 ? " " + (zeraveis.length === 1 ? "1 item não contado vai" : qtd(zeraveis.length) + " itens não contados vão") + " para 0." : "")
            + " Cada ajuste vai para o histórico do produto, e dá para desfazer por " + DIAS_PARA_DESFAZER + " dias."}
          confirmLabel="Ajustar"
          cancelLabel="Agora não"
          destructive={false}
          onConfirm={aplicar}
          onCancel={function () { setConfirmar(false); }}
        />
      </WebPortal>

      <WebPortal active={transferirAberto && !!lojas}>
        <TransferirModal
          key={"transferir-" + aberturas}
          origem={lojas ? lojas.origem : { id: "", nome: "" }}
          destinos={lojas ? lojas.destinos : []}
          produtos={transferencia.produtos}
          quantidadesIniciais={transferencia.quantidades}
          stockCountId={countId}
          onFechar={function () { setTransferirAberto(false); }}
          onEstoqueMudou={function () { carregar(true); }}
          onConcluido={function (numeros, pecasTotal, destino) {
            toast.success((numeros.length > 1 ? "Transferências " : "Transferência ") + textoDosNumeros(numeros)
              + (numeros.length > 1 ? " feitas: " : " feita: ") + pluralQtd(pecasTotal, "peça", "peças") + " para " + destino.nome);
            setTransferirAberto(false);
            setEscolhendo(false);
            setEscolhidos({});
          }}
        />
      </WebPortal>
    </View>
  );
}

var s = StyleSheet.create({
  resumo: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resumoCel: { flexGrow: 1, flexBasis: 140, backgroundColor: Colors.bg4, borderRadius: 12, padding: 10, minWidth: 0 },
  resumoNum: { fontSize: 24, fontWeight: "700", color: Colors.ink },
  linha: { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8 },
  linhaCorpo: { flexDirection: "row", alignItems: "center", gap: 10 },
  nome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  num: { fontSize: 15, fontWeight: "700", textAlign: "right", minWidth: 44 },
  barra: {
    position: "absolute" as any, left: 0, right: 0, bottom: 0,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.bg3,
    borderTopWidth: 1, borderTopColor: Colors.border2,
  },
});

export default DiferencasScreen;
