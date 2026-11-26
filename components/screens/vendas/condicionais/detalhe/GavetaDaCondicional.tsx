// ============================================================
// AURA. — Vendas › Condicionais: detalhe e decisão por peça (C10, 26/11/2026)
//
// Mockup aprovado em 25/11 (condicional/mockup.html, tela 4), no contêiner do
// GavetaDoPedido (ResponsiveSheet: diálogo no computador, folha de baixo no
// celular; cabeçalho fixo, conteúdo que rola, rodapé fixo).
//
//   · Cada peça: Ficou · Voltou · Ainda com ela. Bipar marca Voltou.
//   · Voltou com defeito ou sem etiqueta: caixa de marcar; a peça vai para
//     Peças para resolver (não volta ao estoque sozinha) e depois aparece a
//     nota "1 peça foi para Peças para resolver".
//   · Resumo ao vivo e botão único que muda: Cobrar no Caixa · Salvar
//     devolução · Tudo devolvido. Peças já decididas ficam travadas.
//   · Nova data, cancelar (só se nada foi decidido), preço de hoje ao lado do
//     da retirada, reimprimir o comprovante e WhatsApp.
//
// O detalhe vem de GET /companies/:id/condicionais/:cid na loja DONA da
// condicional (consolidado incluso). As escritas são as do C9
// (Aura-backend#1115) e moram em hooks/useCondicional.ts.
//
// FORA por enquanto:
//   · (C12, feito) "Cobrar no Caixa": a prop `onCobrar` recebe a condicional e
//     os ids das peças que ficaram; antes de sair, salva as que voltaram.
//   · "Acrescentar peça": o passo de peças da Nova condicional (C6) ainda não
//     está no main; o hook já tem `acrescentar`.
//   · "Ver a lista" de Peças para resolver (C16): só aparece com
//     `onVerPecasParaResolver`.
// ============================================================
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { Colors, CondicionalCores as CD } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { ScannerInput } from "@/components/ScannerInput";
import { brl } from "@/components/screens/vendas/editarVendaUtils";
import { dataCurtaComPonto } from "../regrasDasCondicionais";
import { idsParaCobrar } from "@/utils/condicionalNoCaixa";
import { SeloDaSituacao, SeloDaLoja } from "../AbaCondicionais";
import { LembrarCondicional } from "../LembrarCondicional";
import { NovaDataDaCondicional } from "./NovaDataDaCondicional";
import { AcrescentarPecas } from "./AcrescentarPecas";
import { useAuthStore } from "@/stores/auth";
import { normalizeBrPhone } from "@/utils/whatsapp";
import { pdvApi } from "@/services/pdvApi";
import { abrirWhatsappDaCondicional } from "@/utils/condicionalWhatsapp";
import { imprimirComprovanteDaCondicional, type FormatoDoComprovante } from "@/services/imprimirCondicional";
import { formatarTelefone } from "@/utils/telefone";
import {
  useCondicionalDetalhe, useDecidirCondicional, type DetalheDaCondicional, type PecaDaCondicional,
} from "@/hooks/useCondicional";
import type { LinhaDaCondicional } from "@/hooks/useCondicionais";
import {
  TEXTOS_DO_DETALHE as T, TEXTOS_FORA_DO_MOCKUP as F, COBRAR_NO_CAIXA_PRONTO, detalheDaPeca, iniciais, marcaDe,
  marcasParaSalvar, nadaMaisDesde, notaDePecasParaResolver, notaDePreco, pc, pecaViva, pecasParaResolver,
  resumoAoVivo, saiuEm, textoDaPecaTravada, textoDoEvento, type Marca, type Marcas,
} from "./regrasDoDetalhe";

type Props = {
  /** A linha da lista que foi aberta (null = gaveta fechada). */
  linha: LinhaDaCondicional | null;
  hoje: string;
  mostrarLoja: boolean;
  onClose: () => void;
  /** C12: abre o Caixa com as peças que ficaram (ids). Sem ele, o botão não existe. */
  onCobrar?: (c: DetalheDaCondicional, itemIds: string[]) => void;
  /** C16: abre a lista de Peças para resolver. Sem ele, o link não existe. */
  onVerPecasParaResolver?: () => void;
  /** "Ver a C-0029" no aviso de peça sem unidade livre dentro de "Acrescentar peça". */
  onVerCondicional?: (condicionalId: string, companyId?: string | null) => void;
};

export function GavetaDaCondicional({ linha, hoje, mostrarLoja, onClose, onCobrar, onVerPecasParaResolver, onVerCondicional }: Props) {
  const companyId = linha?.company_id;
  const { condicional: c, isLoading, error, refetch } = useCondicionalDetalhe(companyId, linha?.id);
  const acoes = useDecidirCondicional(companyId, linha?.id);
  const lojaDoAuth = useAuthStore((s: any) => s.company?.name) as string | undefined;

  const [marcas, setMarcas] = useState<Marcas>({});
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [bipeAviso, setBipeAviso] = useState<string | null>(null);
  const [confirmaCancelar, setConfirmaCancelar] = useState(false);
  const [novaData, setNovaData] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  const [escolhendoFormato, setEscolhendoFormato] = useState(false);
  const [acrescentando, setAcrescentando] = useState(false);

  const vivo = useMemo(() => c || null, [c]);
  const resumo = useMemo(() => (vivo ? resumoAoVivo(vivo, marcas) : null), [vivo, marcas]);
  if (!linha) return null;

  const status = String(vivo?.status || linha.status);
  const aberta = status === "aberta";
  const situacao = String(vivo?.situacao || linha.situacao);
  const numero = vivo?.numero_exibicao || linha.numero_exibicao;
  const nome = vivo?.customer_name ?? linha.customer_name;
  const telefone = vivo?.customer_phone ?? linha.customer_phone;
  const faltaCobrar = situacao === "a_cobrar";
  const lojaNome = linha.company_name || lojaDoAuth || "";

  function marcar(i: PecaDaCondicional, m: Marca) {
    setErroDaAcao(null);
    setMarcas((x) => ({ ...x, [i.id]: m }));
  }

  async function executar(fn: () => Promise<unknown>, ok?: string) {
    setErroDaAcao(null);
    try {
      await fn();
      if (ok) toast.success(ok);
      return true;
    } catch (err: any) {
      setErroDaAcao((err && err.message) || F.erroGenerico);
      return false;
    }
  }

  /** Tira só as marcas que foram gravadas: os "Ficou" locais continuam. */
  function tirarMarcas(ids: string[]) {
    setMarcas((x) => { const n = { ...x }; ids.forEach((i) => { delete n[i]; }); return n; });
  }

  async function salvarDevolucao() {
    if (!vivo) return;
    const feitas = marcasParaSalvar(vivo, marcas);
    if (!feitas.length) return;
    const okk = await executar(() => acoes.marcar(feitas), F.salvou);
    if (okk) tirarMarcas(feitas.map((x) => x.item_id));
  }

  /** C12: as peças que voltaram são gravadas antes (senão a condicional não
   *  fecha com a venda); as que ficaram vão no Caixa, que não grava nada até concluir. */
  async function cobrarNoCaixa() {
    if (!vivo || !resumo || !onCobrar) return;
    const ids = idsParaCobrar(vivo, resumo.ficou.map((i) => i.id));
    if (!ids.length) return;
    const feitas = marcasParaSalvar(vivo, marcas);
    if (feitas.length) {
      const okk = await executar(() => acoes.marcar(feitas), F.salvou);
      if (!okk) return;
      tirarMarcas(feitas.map((x) => x.item_id));
    }
    onCobrar(vivo, ids);
  }

  async function tudoDevolvido() {
    if (!vivo || !resumo) return;
    // Com defeito entre as peças o PATCH leva as notas; o servidor encerra
    // sozinho quando nada mais está com ela. Sem defeito: a rota própria.
    const okk = resumo.defeitos.length
      ? await executar(() => acoes.marcar(marcasParaSalvar(vivo, marcas)), F.encerrou)
      : await executar(() => acoes.tudoDevolvido(), F.encerrou);
    if (okk) tirarMarcas(marcasParaSalvar(vivo, marcas).map((x) => x.item_id));
  }

  async function aoBipar(code: string) {
    if (!vivo || !companyId) return;
    setBipeAviso(null);
    try {
      const r: any = await pdvApi.scan(companyId, code);
      const produtoId = r?.product?.id;
      if (!produtoId || r?.match === "none") { setBipeAviso(F.bipeNaoAchou); return; }
      const variante = r?.variant_id || null;
      const alvo = vivo.items.find((i) =>
        pecaViva(i) && marcaDe(marcas, i).st !== "voltou" && i.product_id === produtoId && (!variante || !i.variant_id || i.variant_id === variante));
      if (!alvo) { setBipeAviso(F.semBipe); return; }
      marcar(alvo, { ...marcaDe(marcas, alvo), st: "voltou" });
    } catch {
      setBipeAviso(F.bipeNaoAchou);
    }
  }

  async function cancelar() {
    const okk = await executar(() => acoes.cancelar(), F.canceladaOk);
    if (okk) { setConfirmaCancelar(false); onClose(); }
  }

  function imprimir(formato: FormatoDoComprovante) {
    if (!companyId || !linha) return;
    setEscolhendoFormato(false);
    // Direto do clique, antes de qualquer await (a janela precisa abrir aqui).
    imprimirComprovanteDaCondicional(companyId, linha.id, formato).then((r: any) => {
      if (r && r.ok === false && r.error) toast.error(r.error);
    }).catch(() => toast.error(F.erroGenerico));
  }

  function whatsapp() {
    if (!vivo) return;
    if (!abrirWhatsappDaCondicional(vivo, lojaNome)) toast.error("Esta cliente não tem um WhatsApp válido cadastrado.");
  }

  const paraResolver = vivo ? pecasParaResolver(vivo) : 0;
  const podeCancelar = !!vivo && aberta && vivo.items.length > 0 && vivo.items.every((i) => i.situacao === "com_cliente");
  const atrasada = situacao === "atrasada";
  const temFone = !!normalizeBrPhone(telefone);
  const linhaParaLembrar: LinhaDaCondicional = { ...linha, ...(vivo as any), pecas_com_cliente: vivo?.resumo.com_cliente ?? linha.pecas_com_cliente, company_name: linha.company_name } as any;
  const historico = vivo ? vivo.events.map((e) => textoDoEvento(e, vivo)).filter(Boolean) as string[] : [];
  const mostraHistorico = historico.length > 1 || (!aberta && historico.length > 0);
  const nResolver = vivo ? vivo.items.filter((i) => i.situacao === "voltou_defeito" && !i.resolved_at).length : 0;

  return (
    <ResponsiveSheet visible={!!linha} onClose={onClose} maxWidth={520}>
      <View style={s.cab}>
        <View style={s.cabIcone}><Icon name="hanger" size={16} color={CD.cdInk} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo} numberOfLines={1} testID="cond-titulo">{T.titulo + " " + numero}</Text>
          <Text style={s.sub} numberOfLines={1}>{[nome, telefone ? formatarTelefone(telefone) : ""].filter(Boolean).join(" · ")}</Text>
          {mostrarLoja && !!linha.company_name && <SeloDaLoja nome={linha.company_name} />}
        </View>
        <Pressable onPress={onClose} style={s.fechar} accessibilityRole="button" accessibilityLabel={T.fechar} testID="cond-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled">
        {isLoading && !vivo ? (
          <View style={s.carregando} testID="cond-carregando">
            <ActivityIndicator color={Colors.violet3} />
            <Text style={s.sub}>{F.carregando}</Text>
          </View>
        ) : error && !vivo ? (
          <View testID="cond-erro" accessibilityRole="alert">
            <Text style={s.erro}>{F.erroAoBuscar}</Text>
            <Button title={F.tentarDeNovo} size="sm" variant="ghost" onPress={() => refetch()} style={s.botao44} testID="cond-tentar" />
          </View>
        ) : vivo ? (
          <>
            <View style={s.meta}>
              <SeloDaSituacao situacao={situacao} />
              {vivo.parcial && aberta && <View style={s.parcial}><Text style={s.parcialTxt}>Parcial</Text></View>}
              <Text style={s.metaTxt}>Saiu {saiuEm(vivo.created_at)}{vivo.seller_name ? " · " + vivo.seller_name : ""}</Text>
              {!aberta ? (
                <Text style={s.metaTxt}>{status === "cancelada" ? F.cancelada : "Concluída"}{(vivo.closed_at || vivo.cancelled_at) ? " em " + dataCurtaComPonto(String(vivo.closed_at || vivo.cancelled_at).slice(0, 10)).split(", ").pop() : ""}</Text>
              ) : faltaCobrar ? (
                <Text style={s.metaTxt}>Nada mais com ela desde <Text style={s.forte}>{nadaMaisDesde(vivo)}</Text></Text>
              ) : (
                <Text style={s.metaTxt}>Volta até <Text style={s.forte}>{atrasada ? "era " : ""}{dataCurtaComPonto(vivo.due_date)}</Text></Text>
              )}
              {aberta && !faltaCobrar && (
                <Pressable onPress={() => setNovaData(true)} style={s.link} accessibilityRole="button" testID="cond-nova-data-abrir">
                  <Text style={s.linkTxt}>{T.novaData}</Text>
                </Pressable>
              )}
            </View>

            {faltaCobrar && (
              <View style={[s.nota, s.notaFc]} testID="cond-nota-falta-cobrar">
                <Icon name="coin" size={16} color={CD.fcIc} />
                <Text style={s.notaTxt}>
                  <Text style={s.forte}>Ela já decidiu tudo. </Text>
                  {notaFaltaCobrar(vivo)}
                </Text>
              </View>
            )}

            {atrasada && aberta && (
              <View style={[s.nota, s.notaBad]} testID="cond-nota-atrasada">
                <Icon name="clock" size={16} color={CD.badInk} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.notaTxt}>
                    <Text style={s.forte}>{`Passou ${vivo.dias_de_atraso === 1 ? "1 dia" : vivo.dias_de_atraso + " dias"} do combinado.`}</Text>
                    {' Acontece. Um lembrete gentil costuma resolver. Se ela decidir ficar com as peças, marque "Ficou" e cobre no Caixa.'}
                  </Text>
                  <View style={s.acoesNota}>
                    {temFone && <Button title={T.lembrar} icon="whatsapp" size="sm" variant="ghost" onPress={() => setLembrar(true)} style={s.botao44} testID="cond-lembrar" />}
                    <Button title={T.novaData} icon="calendar" size="sm" variant="ghost" onPress={() => setNovaData(true)} style={s.botao44} testID="cond-nova-data-nota" />
                  </View>
                </View>
              </View>
            )}

            {confirmaCancelar && (
              <View style={[s.nota, s.notaBad]} testID="cond-cancelar-confirma">
                <Icon name="alert" size={16} color={CD.badInk} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.notaTxt}>
                    <Text style={s.forte}>{`Cancelar a condicional ${numero}?`}</Text>
                    {` Use quando ela foi aberta por engano e as peças não saíram da loja. ${vivo.items.length === 1 ? "A peça volta" : `As ${vivo.items.length} peças voltam`} a ficar ${vivo.items.length === 1 ? "livre" : "livres"} e nada é cobrado. Se as peças saíram e voltaram, prefira marcar "Voltou".`}
                  </Text>
                  <View style={s.acoesNota}>
                    <Button title={T.cancelarConfirma} size="sm" variant="danger" onPress={cancelar} loading={acoes.salvando} style={s.botao44} testID="cond-cancelar-sim" />
                    <Button title={T.manter} size="sm" variant="ghost" onPress={() => setConfirmaCancelar(false)} disabled={acoes.salvando} style={s.botao44} testID="cond-cancelar-nao" />
                  </View>
                </View>
              </View>
            )}

            {aberta && !faltaCobrar && vivo.items.some(pecaViva) && (
              <View style={s.bipe} testID="cond-bipe">
                <ScannerInput onScan={(r) => aoBipar(r.code)} placeholder={T.bipe} testID="cond-bipe-campo" />
                {!!bipeAviso && <Text style={s.erro} testID="cond-bipe-aviso">{bipeAviso}</Text>}
              </View>
            )}

            {acrescentando && aberta && !!companyId && (
              <AcrescentarPecas
                companyId={companyId}
                acrescentar={acoes.acrescentar}
                onFechar={() => setAcrescentando(false)}
                onVerCondicional={onVerCondicional}
              />
            )}

            {vivo.items.map((i) => (
              <Peca key={i.id} peca={i} aberta={aberta} marca={marcaDe(marcas, i)} hoje={hoje} onMarcar={(m) => marcar(i, m)} />
            ))}

            {nResolver > 0 && (
              <View style={s.nota} testID="cond-para-resolver">
                <Icon name="alert" size={16} color={CD.warnInk} />
                <Text style={[s.notaTxt, { flex: 1 }]}>{notaDePecasParaResolver(nResolver)}</Text>
                {!!onVerPecasParaResolver && (
                  <Pressable onPress={onVerPecasParaResolver} style={s.link} accessibilityRole="button" testID="cond-ver-resolver">
                    <Text style={s.linkTxt}>{T.verLista}</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={s.links}>
              {aberta && !acrescentando && (
                <Pressable onPress={() => setAcrescentando(true)} style={s.link} accessibilityRole="button" testID="cond-acrescentar-abrir">
                  <Text style={s.linkTxt}>{T.acrescentar}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setEscolhendoFormato((v) => !v)} style={s.link} accessibilityRole="button" testID="cond-reimprimir">
                <Text style={s.linkTxt}>{T.reimprimir}</Text>
              </Pressable>
              {escolhendoFormato && (
                <>
                  <Pressable onPress={() => imprimir("a4")} style={s.link} accessibilityRole="button" testID="cond-imprimir-a4"><Text style={s.linkTxt}>{T.folhaA4}</Text></Pressable>
                  <Pressable onPress={() => imprimir("bobina")} style={s.link} accessibilityRole="button" testID="cond-imprimir-bobina"><Text style={s.linkTxt}>{T.bobina}</Text></Pressable>
                </>
              )}
              {temFone && (
                <Pressable onPress={whatsapp} style={s.link} accessibilityRole="button" testID="cond-whatsapp">
                  <Text style={s.linkTxt}>{T.whatsapp}</Text>
                </Pressable>
              )}
              {podeCancelar && !confirmaCancelar && (
                <Pressable onPress={() => setConfirmaCancelar(true)} style={s.link} accessibilityRole="button" testID="cond-cancelar">
                  <Text style={[s.linkTxt, { color: CD.badInk }]}>{T.cancelarLink}</Text>
                </Pressable>
              )}
            </View>

            {mostraHistorico && (
              <View testID="cond-historico">
                <Text style={s.secao}>{T.oQueAconteceu}</Text>
                {historico.map((h, k) => <Text key={k} style={s.hist}>{"• " + h}</Text>)}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {!!vivo && resumo && (
        <View style={s.rodape} testID="cond-rodape">
          {!!erroDaAcao && <Text style={s.erro} testID="cond-erro-acao" accessibilityRole="alert">{erroDaAcao}</Text>}
          <View style={s.rodapeLinha}>
            <View style={s.info}>
              <Text style={s.infoTitulo} testID="cond-resumo-titulo">{resumo.titulo}</Text>
              {!!resumo.sub && <Text style={s.infoSub} testID="cond-resumo-sub">{resumo.sub}</Text>}
            </View>
            {resumo.acao === "cobrar" && COBRAR_NO_CAIXA_PRONTO && !!onCobrar && (
              <Button title={T.cobrarNoCaixa} icon="cart" variant="primary" disabled={resumo.desligado} loading={acoes.salvando} onPress={cobrarNoCaixa} style={s.botao44} testID="cond-cobrar" />
            )}
            {resumo.acao === "salvar" && (
              <Button title={T.salvarDevolucao} icon="check" variant="success" loading={acoes.salvando} onPress={salvarDevolucao} style={s.botao44} testID="cond-salvar" />
            )}
            {resumo.acao === "tudo" && (
              <Button title={T.tudoDevolvido} icon="check" variant="success" loading={acoes.salvando} onPress={tudoDevolvido} style={s.botao44} testID="cond-tudo" />
            )}
          </View>
        </View>
      )}

      {novaData && !!vivo && (
        <NovaDataDaCondicional
          numero={numero}
          cliente={nome}
          prazoAtual={vivo.due_date}
          hoje={hoje}
          onSalvar={async (dia) => { await acoes.mudarPrazo(dia); toast.success(F.novaDataOk); }}
          onClose={() => setNovaData(false)}
        />
      )}
      <LembrarCondicional linha={lembrar ? linhaParaLembrar : null} onClose={() => setLembrar(false)} />
    </ResponsiveSheet>
  );
}

/** "A peça que ficou…" sem artigo, para não errar o gênero. */
function notaFaltaCobrar(c: DetalheDaCondicional): string {
  const f = c.items.filter((i) => i.situacao === "ficou" && !i.sale_id);
  const v = c.items.filter((i) => i.situacao === "voltou" || i.situacao === "voltou_defeito");
  const ficou = f.length === 1 ? `${f[0].product_name} ficou com ela` : `${pc(f.length)} ficaram com ela`;
  const voltou = v.length ? ` e ${v.length === 1 ? "a outra peça voltou" : `as outras ${v.length} peças voltaram`}` : "";
  return `${ficou}${voltou}. Falta só passar no Caixa. Não conta como atrasada.`;
}

type PecaProps = {
  peca: PecaDaCondicional;
  aberta: boolean;
  marca: Marca;
  hoje: string;
  onMarcar: (m: Marca) => void;
};

function Peca({ peca: i, aberta, marca, hoje, onMarcar }: PecaProps) {
  const viva = aberta && pecaViva(i);
  const travada = textoDaPecaTravada(i, hoje);
  const nota = viva ? notaDePreco(i) : null;
  const st = viva ? marca.st : null;
  const pendente = !viva && i.situacao === "ficou" && !i.sale_id && aberta;
  const detalhe = detalheDaPeca(i);
  return (
    <View style={[s.item, st === "ficou" && s.itemFicou, st === "voltou" && s.itemVoltou, pendente && s.itemPendente]} testID={"cond-peca-" + i.id}>
      <View style={s.itemTopo}>
        <View style={s.thumb}><Text style={s.thumbTxt}>{iniciais(i.product_name)}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.itemNome} numberOfLines={2}>{i.product_name}</Text>
          {!!detalhe && <Text style={s.sub}>{detalhe}</Text>}
        </View>
        <Text style={s.preco}>{brl(i.unit_price)}</Text>
      </View>

      {viva ? (
        <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel={i.product_name}>
          <Opcao on={marca.st === "ficou"} tom="f" label={T.ficou} onPress={() => onMarcar({ st: "ficou" })} testID={"cond-ficou-" + i.id} />
          <Opcao on={marca.st === "voltou"} tom="v" label={T.voltou} onPress={() => onMarcar({ ...marca, st: "voltou" })} testID={"cond-voltou-" + i.id} />
          <Opcao on={marca.st === "com"} tom="c" label={T.aindaComEla} onPress={() => onMarcar({ st: "com" })} testID={"cond-com-" + i.id} />
        </View>
      ) : (
        <View style={s.travada} testID={"cond-travada-" + i.id}>
          <Icon name={travada.tom === "ficou" ? "bag" : "check"} size={14} color={Colors.ink2} />
          <Text style={s.travadaTxt}>{travada.texto}</Text>
        </View>
      )}

      {viva && marca.st === "voltou" && (
        <>
          <Pressable
            onPress={() => onMarcar({ ...marca, defeito: !marca.defeito })}
            style={s.ck}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!marca.defeito }}
            testID={"cond-defeito-" + i.id}
          >
            <View style={[s.caixa, !!marca.defeito && s.caixaOn]}>
              {!!marca.defeito && <Icon name="check" size={12} color="#fff" />}
            </View>
            <Text style={s.ckTxt}>{T.defeito}</Text>
          </Pressable>
          {!!marca.defeito && (
            <View style={[s.nota, s.notaWarn]}>
              <Icon name="alert" size={16} color={CD.warnInk} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.notaTxt}><Text style={s.forte}>{T.defeitoAviso}</Text>{T.defeitoAvisoResto}</Text>
                <Text style={s.rotulo}>{T.defeitoNota}</Text>
                <TextInput
                  value={marca.nota || ""}
                  onChangeText={(v) => onMarcar({ ...marca, nota: v })}
                  maxLength={500}
                  style={s.input}
                  accessibilityLabel={T.defeitoNota}
                  testID={"cond-defeito-nota-" + i.id}
                />
              </View>
            </View>
          )}
        </>
      )}
      {!!nota && (
        <View style={s.nota} testID={"cond-preco-" + i.id}>
          <Icon name="coin" size={16} color={CD.fcIc} />
          <Text style={[s.notaTxt, { flex: 1 }]}>{nota}</Text>
        </View>
      )}
    </View>
  );
}

function Opcao({ on, tom, label, onPress, testID }: { on: boolean; tom: "f" | "v" | "c"; label: string; onPress: () => void; testID: string }) {
  const cor = tom === "f" ? Colors.violet : tom === "v" ? CD.okInk : CD.cd;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, checked: on }}
      style={[s.opcao, on && { backgroundColor: cor, borderColor: cor }]}
      testID={testID}
    >
      <Text style={[s.opcaoTxt, on && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  cab: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cabIcone: { width: 32, height: 32, borderRadius: 9, backgroundColor: CD.cdBg, borderWidth: 1, borderStyle: "dashed", borderColor: CD.cdLine, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 17, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 12.5, color: Colors.ink3, marginTop: 2 },
  fechar: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  corpo: { paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  carregando: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  erro: { fontSize: 12.5, color: Colors.red, fontWeight: "600" },
  forte: { color: Colors.ink, fontWeight: "700" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  metaTxt: { fontSize: 12.5, color: Colors.ink2 },
  parcial: { minHeight: 22, paddingHorizontal: 9, justifyContent: "center", borderRadius: 99, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  parcialTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  link: { minHeight: 44, paddingHorizontal: 6, justifyContent: "center" },
  linkTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  links: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, marginTop: 2 },
  nota: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  notaFc: { borderColor: CD.fcLine, backgroundColor: CD.fcBg },
  notaBad: { borderColor: CD.badLine, backgroundColor: CD.badBg },
  notaWarn: { borderColor: CD.warnLine, backgroundColor: CD.warnBg },
  notaTxt: { fontSize: 13, lineHeight: 19, color: Colors.ink2 },
  acoesNota: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  bipe: { gap: 6 },
  item: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, gap: 10, backgroundColor: Colors.bg3 },
  itemFicou: { borderColor: Colors.violet },
  itemVoltou: { borderColor: CD.okLine },
  itemPendente: { borderColor: CD.fcLine },
  itemTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  thumbTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  itemNome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  preco: { fontSize: 13.5, fontWeight: "700", color: Colors.ink, fontFamily: "monospace" as any },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  opcao: { flexGrow: 1, flexBasis: 90, minHeight: 44, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  opcaoTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2, textAlign: "center" },
  travada: { flexDirection: "row", alignItems: "center", gap: 8, padding: 9, borderRadius: 9, backgroundColor: Colors.bg4 },
  travadaTxt: { flex: 1, fontSize: 13, color: Colors.ink2 },
  ck: { flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 44, paddingVertical: 4 },
  caixa: { width: 22, height: 22, marginTop: 1, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  caixaOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  ckTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.ink2 },
  rotulo: { fontSize: 12, fontWeight: "700", color: Colors.ink3, marginTop: 8, marginBottom: 4 },
  input: { minHeight: 44, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, fontSize: 14, color: Colors.ink },
  secao: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: Colors.ink3, marginTop: 6, marginBottom: 6 },
  hist: { fontSize: 12.5, lineHeight: 19, color: Colors.ink2 },
  rodape: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
  rodapeLinha: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  info: { flex: 1, flexBasis: 160, minWidth: 0 },
  infoTitulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  infoSub: { fontSize: 12.5, color: Colors.ink3, marginTop: 1 },
  botao44: { minHeight: 44 },
});
