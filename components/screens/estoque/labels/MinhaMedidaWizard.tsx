// ============================================================================
// AURA. — Etiquetas: wizard "Minha medida" (15/10/2026)
//
// Mockup aprovado pelo Caio: docs/mockups/etiqueta-self-service.html.
// Padrão TrocaModal (CLAUDE.md, armadilha 5): cabeçalho, passos numerados no
// topo (os já feitos são clicáveis), um assunto por passo, Voltar/Continuar
// no rodapé.
//   1 Medida — atalhos, largura/altura (aceita vírgula), colunas, espaços com
//     "Não sei, usar o padrão", rolo em escala que muda ao vivo, aviso de
//     etiqueta estreita, erro de limite no campo.
//   2 Teste — imprime a moldura de teste com a impressão que o app já usa.
//   3 Ajuste — "Como saiu o teste?": 4 direções (0,5 mm por toque, sentido
//     contrário ao erro), ajuste fino de 0,1 mm, limite ±8 mm. A moldura
//     deslocada é ILUSTRATIVA (decisão do Caio): quem diz como saiu é o
//     lojista pelos botões.
//   4 Pronto — resumo com "Alterar" por item e "Imprimir etiquetas agora".
//
// Touch: nada de hover; alvos de 44 px ou mais; no celular o rolo fica fixo
// no topo do passo 1. Só web (a impressão de etiqueta é web). WebPortal: a
// aba vive dentro do shell e o z-index: 0 do RNW prenderia o overlay.
// ============================================================================
import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import {
  MEDIDA_PADRAO, etiquetaPequenaDemais, nomeDaMedida, mmTxt, novoIdMedida, type CustomLabelSpec,
} from "@/components/screens/estoque/labels/customLabel";
import {
  ATALHOS_MEDIDA, ROTULO_DIRECAO, corrigirDirecao, ajusteFino, mensagemMovimento, sinalMm, textoAjuste,
  textoColunas, textoEspacos, espacosNoPadrao, medidaDosCampos, textosDaMedida, desenhoDoRolo,
  type Ajuste, type Direcao, type TextosMedida, type CampoMedida, type ExemploDeEtiqueta,
} from "@/components/screens/estoque/labels/minhaMedidaRegras";

type Props = {
  /** Medida a editar (lápis no seletor); null = "+ Minha medida". */
  inicial: CustomLabelSpec | null;
  /** Produto de verdade para a ilustração (o 1o marcado), se houver. */
  exemplo?: ExemploDeEtiqueta;
  onImprimirTeste: (spec: CustomLabelSpec) => void;
  /** Salva a medida; devolve se conseguiu guardar neste computador. */
  onSalvar: (spec: CustomLabelSpec) => boolean;
  onFechar: () => void;
  onImprimirAgora: (spec: CustomLabelSpec) => void;
};

type Passo = 1 | 2 | 3 | 4;
var PASSOS: Array<[Passo, string]> = [[1, "Medida"], [2, "Teste"], [3, "Ajuste"], [4, "Pronto"]];
/** Exemplo fixo de etiqueta torta para a ilustração do passo 3. */
var ERRO_ILUSTRATIVO: Ajuste = { x: -2, y: -1 };

function Svg({ html, testID }: { html: string; testID?: string }) {
  if (Platform.OS !== "web") return null;
  return React.createElement("div", { "data-testid": testID, style: { width: "100%" }, dangerouslySetInnerHTML: { __html: html } });
}

function Nota({ tipo, icone, children, testID }: { tipo: "dica" | "aviso" | "ok" | "info"; icone: string; children: React.ReactNode; testID?: string }) {
  var cor = tipo === "aviso" ? Colors.amber : tipo === "ok" ? Colors.green : tipo === "dica" ? Colors.violet3 : Colors.ink2;
  return (
    <View style={[s.nota, tipo === "aviso" ? s.notaAviso : tipo === "ok" ? s.notaOk : tipo === "dica" ? s.notaDica : s.notaInfo]} testID={testID} accessibilityLiveRegion="polite">
      <Icon name={icone as any} size={18} color={cor} />
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

export function MinhaMedidaWizard({ inicial, exemplo, onImprimirTeste, onSalvar, onFechar, onImprimirAgora }: Props) {
  var dim = useWindowDimensions();
  var estreito = dim.width < 700;

  var [base] = useState<CustomLabelSpec>(function () {
    return inicial ? { ...inicial } : { id: novoIdMedida(), ...MEDIDA_PADRAO };
  });
  var editando = !!inicial;
  var [passo, setPasso] = useState<Passo>(1);
  var [txt, setTxt] = useState<TextosMedida>(function () { return textosDaMedida(base); });
  var [colunas, setColunas] = useState<number>(base.colunas);
  var [ajuste, setAjuste] = useState<Ajuste>({ x: base.ajusteXMm, y: base.ajusteYMm });
  var [testeEnviado, setTesteEnviado] = useState(false);
  var [testeDeNovo, setTesteDeNovo] = useState(false);
  var [msg3, setMsg3] = useState<{ tipo: "limite" | "movi"; texto: string } | null>(null);
  var [origem3, setOrigem3] = useState<Ajuste>({ x: base.ajusteXMm, y: base.ajusteYMm });
  var [finoAberto, setFinoAberto] = useState(false);
  var [ajudaAberta, setAjudaAberta] = useState(false);
  var [guardou, setGuardou] = useState(true);

  var lido = useMemo(function () { return medidaDosCampos(base, txt, colunas); }, [base, txt, colunas]);
  // Enquanto o lojista digita um valor inválido, a ilustração fica na última medida válida.
  var ultima = useRef<CustomLabelSpec>(base);
  if (lido.spec) ultima.current = lido.spec;
  var medida = ultima.current;
  var final: CustomLabelSpec = { ...medida, ajusteXMm: ajuste.x, ajusteYMm: ajuste.y };

  function irPara(p: Passo) {
    if (p === 3 && passo !== 3) { setOrigem3(ajuste); setMsg3(null); setTesteDeNovo(false); }
    setPasso(p);
  }
  function campo(c: CampoMedida, v: string) { setTxt(function (t) { return { ...t, [c]: v }; }); }
  function atalho(w: number, h: number) { setTxt(function (t) { return { ...t, largura: mmTxt(w), altura: mmTxt(h) }; }); setColunas(1); }
  function escolherColunas(n: number) {
    setColunas(n);
    if (n > 1 && medidaDosCampos(base, txt, 2).erros.espacoLado) campo("espacoLado", String(MEDIDA_PADRAO.espacoLadoMm));
  }
  function usarPadrao() { setTxt(function (t) { return { ...t, espacoLado: String(MEDIDA_PADRAO.espacoLadoMm), espacoLinha: String(MEDIDA_PADRAO.espacoLinhaMm) }; }); }
  function corrigir(d: Direcao) {
    var r = corrigirDirecao(ajuste, d);
    setAjuste(r.ajuste);
    setMsg3(r.noLimite ? { tipo: "limite", texto: "" } : { tipo: "movi", texto: mensagemMovimento(d) });
  }
  function fino(eixo: "x" | "y", delta: number) {
    var r = ajusteFino(ajuste, eixo, delta);
    setAjuste(r.ajuste);
    setMsg3(r.noLimite ? { tipo: "limite", texto: "" } : null);
  }
  function ficouCerto() {
    setGuardou(onSalvar(final));
    setPasso(4);
  }

  if (Platform.OS !== "web" || typeof document === "undefined") return null;

  // ----- passo 1 -----
  var pequena = !lido.erros.largura && etiquetaPequenaDemais(medida);
  var noPadrao = !lido.erros.espacoLado && !lido.erros.espacoLinha && espacosNoPadrao({ colunas: colunas, espacoLadoMm: medida.espacoLadoMm, espacoLinhaMm: medida.espacoLinhaMm });

  function inputMm(c: CampoMedida, rotulo: string, desligado?: boolean) {
    var erro = lido.erros[c];
    return (
      <View style={s.field}>
        <Text style={s.fieldLbl} nativeID={"rot-" + c}>{rotulo}</Text>
        <View style={[s.inp, !!erro && s.inpErro, desligado && s.inpOff]}>
          <TextInput
            value={txt[c]}
            onChangeText={function (v) { campo(c, v); }}
            editable={!desligado}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={[s.inpTxt, desligado && { color: Colors.ink3 }]}
            accessibilityLabel={rotulo + " em milímetros"}
            testID={"medida-" + c}
          />
          <Text style={s.inpUn}>mm</Text>
        </View>
        {!!erro && <Text style={s.erro} testID={"medida-erro-" + c} accessibilityLiveRegion="polite">{erro}</Text>}
      </View>
    );
  }

  var previa1 = (
    <View style={s.prevCard}>
      <View style={s.prevTit}><Text style={s.prevTitTxt}>Assim vai ficar o seu rolo</Text><Text style={s.prevTitTxt}>{mmTxt(medida.larguraMm)} x {mmTxt(medida.alturaMm)} mm</Text></View>
      <Svg testID="medida-rolo" html={desenhoDoRolo({ ...medida, colunas: colunas, cotas: true, linhas: estreito ? 2 : undefined, alturaMaxPx: estreito ? 190 : 400, larguraMinima: estreito ? 60 : 70, exemplo: exemplo })} />
      {!estreito && <Text style={s.prevCap}>Ilustração em escala. O nome, o tamanho, o preço e o código de barras se ajustam sozinhos ao espaço.</Text>}
    </View>
  );

  var form1 = (
    <View>
      <View style={s.grp}>
        <Text style={s.lbl}>Atalhos</Text>
        <View style={s.chips}>
          {ATALHOS_MEDIDA.map(function (a) {
            var on = colunas === 1 && !lido.erros.largura && !lido.erros.altura && medida.larguraMm === a[0] && medida.alturaMm === a[1];
            return (
              <Pressable key={a.join("x")} onPress={function () { atalho(a[0], a[1]); }} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }} testID={"medida-atalho-" + a.join("x")}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{a[0]} x {a[1]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={s.grp}>
        <View style={s.fields2}>{inputMm("largura", "Largura")}{inputMm("altura", "Altura")}</View>
        {pequena && (
          <Nota tipo="aviso" icone="alert" testID="medida-aviso-estreita">
            <Text style={s.notaTxt}><Text style={s.b}>Etiqueta estreita.</Text> Com menos de 25 mm de largura o código de barras pode não ser lido pelo leitor. Aumente a largura ou use uma etiqueta de 30 mm.</Text>
            <Pressable onPress={function () { campo("largura", "30"); }} style={s.btnNota} testID="medida-usar-30">
              <Text style={s.btnNotaTxt}>Usar 30 mm de largura</Text>
            </Pressable>
          </Nota>
        )}
        <Nota tipo="dica" icone="ruler"><Text style={s.notaTxt}><Text style={s.b}>Meça só a etiqueta,</Text> sem o papel em volta.</Text></Nota>
      </View>
      <View style={s.grp}>
        <Text style={s.lbl}>Quantas etiquetas lado a lado no rolo?</Text>
        <View style={s.cols}>
          {[1, 2, 3].map(function (n) {
            var on = colunas === n;
            return (
              <Pressable key={n} onPress={function () { escolherColunas(n); }} style={[s.colBtn, on && s.colBtnOn]} accessibilityRole="button" accessibilityState={{ selected: on }} testID={"medida-colunas-" + n}>
                <View style={s.colGlyph}>{Array.from({ length: n }).map(function (_, i) { return <View key={i} style={[s.colGlyphBox, { width: n === 1 ? 20 : n === 2 ? 14 : 10 }, on && s.colGlyphBoxOn]} />; })}</View>
                <Text style={[s.colBtnN, on && s.colBtnTxtOn]}>{n}</Text>
                <Text style={[s.colBtnSub, on && s.colBtnTxtOn]}>{n === 1 ? "só uma" : "lado a lado"}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={s.grp}>
        <Text style={s.lbl}>Espaço entre uma etiqueta e outra</Text>
        <Text style={s.hint}>É a faixa de papel liso que fica entre duas etiquetas.</Text>
        <View style={s.fields2}>{inputMm("espacoLado", "Lado a lado", colunas === 1)}{inputMm("espacoLinha", "De cima para baixo")}</View>
        {colunas === 1 && <Text style={[s.hint, { marginTop: 6 }]}>“Lado a lado” só vale com 2 ou 3 etiquetas no rolo.</Text>}
        <Pressable onPress={usarPadrao} disabled={noPadrao} style={s.linkBtn} testID="medida-usar-padrao" accessibilityRole="button" accessibilityState={{ disabled: noPadrao }}>
          {noPadrao && <Icon name="check" size={16} color={Colors.green} />}
          <Text style={[s.linkBtnTxt, noPadrao && { color: Colors.green }]}>{noPadrao ? "Usando o padrão" : "Não sei, usar o padrão"}</Text>
        </Pressable>
      </View>
    </View>
  );

  // ----- passo 2 -----
  var muitas = colunas > 1 ? "Sai uma linha inteira, com " + colunas + " etiquetas de teste. Olhe a da esquerda." : "Gasta só uma etiqueta.";
  var corpo2 = (
    <View style={estreito ? undefined : s.split}>
      <View style={estreito ? s.prevTopo : s.splitPrev}>
        <View style={s.prevCard}>
          <View style={s.prevTit}><Text style={s.prevTitTxt}>O que vai sair</Text><Text style={s.prevTitTxt}>{mmTxt(medida.larguraMm)} x {mmTxt(medida.alturaMm)} mm</Text></View>
          <Svg html={desenhoDoRolo({ ...medida, modo: "teste", linhas: 2, larguraMinima: 64, alturaMaxPx: estreito ? 170 : 340 })} />
          <Text style={s.prevCap}>Moldura · Cruz no centro · Setas nas bordas</Text>
        </View>
      </View>
      <View style={estreito ? undefined : s.splitForm}>
        <Text style={s.bigcall}>Repare se a moldura ficou dentro da etiqueta.</Text>
        {[
          <Text key="1" style={s.explTxt}>Toque em <Text style={s.b}>Imprimir teste</Text>. {muitas}</Text>,
          <Text key="2" style={s.explTxt}>Olhe a etiqueta que saiu: a moldura e a cruz devem ficar <Text style={s.b}>bem no meio</Text>, com a borda em volta inteira.</Text>,
          <Text key="3" style={s.explTxt}>Se ficou torta, sem problema: no próximo passo a gente corrige.</Text>,
        ].map(function (t, i) {
          return <View key={i} style={s.expl}><View style={s.explN}><Text style={s.explNTxt}>{i + 1}</Text></View>{t}</View>;
        })}
        <Pressable onPress={function () { onImprimirTeste(final); setTesteEnviado(true); }} style={[s.btn, s.btnPri, s.btnBig]} testID="medida-imprimir-teste" accessibilityRole="button">
          <Icon name="print" size={22} color="#fff" />
          <Text style={[s.btnPriTxt, { fontSize: 17 }]}>Imprimir teste</Text>
        </Pressable>
        {testeEnviado && (
          <Nota tipo="ok" icone="check" testID="medida-teste-enviado"><Text style={s.notaTxt}><Text style={s.b}>Teste enviado.</Text> Pegue a etiqueta que saiu e olhe a moldura.</Text></Nota>
        )}
        <Pressable onPress={function () { setAjudaAberta(!ajudaAberta); }} style={s.details} accessibilityRole="button" accessibilityState={{ expanded: ajudaAberta }}>
          <Icon name="info" size={16} color={Colors.ink2} />
          <Text style={s.detailsTxt}>Não saiu nada?</Text>
          <Icon name={ajudaAberta ? "chevron_up" : "chevron_down"} size={16} color={Colors.ink3} />
        </Pressable>
        {ajudaAberta && <Text style={[s.hint, { paddingHorizontal: 4, paddingTop: 6 }]}>Confira se a impressora está ligada e se é a escolhida na janela de impressão. Se o rolo estiver errado, a etiqueta pode sair em branco; nesse caso, refaça o teste.</Text>}
      </View>
    </View>
  );

  // ----- passo 3 -----
  var dx = Math.round((ERRO_ILUSTRATIVO.x + ajuste.x - origem3.x) * 10) / 10;
  var dy = Math.round((ERRO_ILUSTRATIVO.y + ajuste.y - origem3.y) * 10) / 10;
  var certo = Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25;
  function dirBtn(d: Direcao, icone: string) {
    return (
      <Pressable onPress={function () { corrigir(d); }} style={s.dp} accessibilityRole="button" accessibilityLabel={ROTULO_DIRECAO[d]} testID={"medida-dir-" + d}>
        <Icon name={icone as any} size={24} color={Colors.violet3} />
        <Text style={s.dpTxt}>{ROTULO_DIRECAO[d]}</Text>
      </Pressable>
    );
  }
  function linhaFina(eixo: "x" | "y", nome: string, sub: string) {
    var v = eixo === "x" ? ajuste.x : ajuste.y;
    return (
      <View style={s.fineRow}>
        <View style={{ flex: 1 }}><Text style={s.fineNm}>{nome}</Text><Text style={s.hint}>{sub}</Text></View>
        <View style={s.stp}>
          <Pressable onPress={function () { fino(eixo, -0.1); }} style={s.stpBtn} accessibilityRole="button" accessibilityLabel={nome + " menos 0,1 milímetro"} testID={"medida-fino-" + eixo + "-menos"}><Text style={s.stpBtnTxt}>−</Text></Pressable>
          <Text style={s.stpVal} testID={"medida-fino-" + eixo + "-valor"}>{sinalMm(v)} mm</Text>
          <Pressable onPress={function () { fino(eixo, 0.1); }} style={s.stpBtn} accessibilityRole="button" accessibilityLabel={nome + " mais 0,1 milímetro"} testID={"medida-fino-" + eixo + "-mais"}><Text style={s.stpBtnTxt}>+</Text></Pressable>
        </View>
      </View>
    );
  }
  var status3 = msg3 && msg3.tipo === "limite"
    ? <Nota tipo="aviso" icone="alert" testID="medida-limite"><Text style={s.notaTxt}><Text style={s.b}>Chegou no limite de 8 mm.</Text> Se ainda está torta, confira o tamanho da etiqueta no passo 1 e se o rolo está bem encaixado na impressora.</Text></Nota>
    : certo
      ? <Nota tipo="ok" icone="check"><Text style={s.notaTxt}><Text style={s.b}>A moldura está no lugar certo.</Text> Se na sua etiqueta também ficou assim, toque em <Text style={s.b}>Ficou certo</Text>. Para conferir de verdade, use <Text style={s.b}>Imprimir de novo</Text>.</Text></Nota>
      : msg3
        ? <Nota tipo="info" icone="info" testID="medida-movi"><Text style={s.notaTxt}>{msg3.texto}</Text></Nota>
        : <Nota tipo="info" icone="info"><Text style={s.notaTxt}>A ilustração mostra um exemplo de etiqueta que saiu torta. Toque no lado para onde a <Text style={s.b}>sua</Text> moldura foi.</Text></Nota>;
  var corpo3 = (
    <View style={estreito ? undefined : s.split}>
      <View style={estreito ? s.prevTopo : s.splitPrev}>
        <View style={s.prevCard}>
          <View style={s.prevTit}><Text style={s.prevTitTxt}>Sua etiqueta de teste</Text><Text style={s.prevTitTxt}>{mmTxt(medida.larguraMm)} x {mmTxt(medida.alturaMm)} mm</Text></View>
          <Svg testID="medida-moldura" html={desenhoDoRolo({ ...medida, modo: "teste", linhas: 2, dx: dx, dy: dy, certo: certo, fantasma: true, larguraMinima: 64, alturaMaxPx: estreito ? 120 : 340 })} />
          <Text style={s.prevCap}>Violeta: moldura impressa · Verde tracejado: onde deveria ficar</Text>
        </View>
      </View>
      <View style={estreito ? undefined : s.splitForm}>
        <View style={{ marginBottom: 10 }}>{status3}</View>
        <View style={s.dpad}>
          <View style={s.dpCel} />{dirBtn("cima", "chevron_up")}<View style={s.dpCel} />
          {dirBtn("esquerda", "chevron_left")}<View style={[s.dpCel, s.dpMeio]}><View style={s.dpGlyph} /></View>{dirBtn("direita", "chevron_right")}
          <View style={s.dpCel} />{dirBtn("baixo", "chevron_down")}<View style={s.dpCel} />
        </View>
        <Pressable onPress={function () { setFinoAberto(!finoAberto); }} style={s.details} accessibilityRole="button" accessibilityState={{ expanded: finoAberto }} testID="medida-ajuste-fino">
          <Icon name="settings" size={16} color={Colors.ink2} />
          <Text style={s.detailsTxt}>Ajuste fino</Text>
          <Icon name={finoAberto ? "chevron_up" : "chevron_down"} size={16} color={Colors.ink3} />
        </Pressable>
        {finoAberto && (
          <View style={s.fineBox}>
            <Text style={s.hint}>Passos de 0,1 mm. Os números mostram quanto a impressão está deslocada.</Text>
            {linhaFina("x", "Horizontal", "+ para a direita · − para a esquerda")}
            {linhaFina("y", "Vertical", "+ para baixo · − para cima")}
          </View>
        )}
        <Pressable onPress={function () { onImprimirTeste(final); setTesteDeNovo(true); }} style={[s.btn, { marginTop: 14 }]} testID="medida-imprimir-de-novo" accessibilityRole="button">
          <Icon name="print" size={18} color={Colors.ink} />
          <Text style={s.btnTxt}>Imprimir de novo</Text>
        </Pressable>
        {testeDeNovo && (
          <Nota tipo="ok" icone="check"><Text style={s.notaTxt}><Text style={s.b}>Teste enviado.</Text> Saiu com o ajuste de hoje ({textoAjuste(ajuste)}). Pegue a etiqueta que saiu e olhe a moldura.</Text></Nota>
        )}
        <Pressable onPress={function () { setAjuste({ x: 0, y: 0 }); setMsg3(null); }} style={[s.linkBtn, { alignSelf: "center" }]} testID="medida-voltar-padrao" accessibilityRole="button">
          <Icon name="rotate_ccw" size={15} color={Colors.ink3} />
          <Text style={[s.linkBtnTxt, { color: Colors.ink3, fontWeight: "600" }]}>Voltar ao padrão</Text>
        </Pressable>
      </View>
    </View>
  );

  // ----- passo 4 -----
  function linhaResumo(rotulo: string, valor: string, alvo: Passo, id: string) {
    return (
      <View style={s.sumRow}>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={s.sumRot}>{rotulo}</Text><Text style={s.sumVal} testID={"medida-resumo-" + id}>{valor}</Text></View>
        <Pressable onPress={function () { irPara(alvo); }} style={s.alterar} accessibilityRole="button" accessibilityLabel={"Alterar " + rotulo.toLowerCase()} testID={"medida-alterar-" + id}>
          <Icon name="pencil" size={14} color={Colors.violet3} />
          <Text style={s.linkBtnTxt}>Alterar</Text>
        </Pressable>
      </View>
    );
  }
  var corpo4 = (
    <View>
      <View style={s.done}>
        <View style={s.bigOk}><Icon name="check" size={30} color={Colors.green} /></View>
        <Text style={s.doneTit}>{guardou ? "Sua etiqueta " + mmTxt(medida.larguraMm) + " x " + mmTxt(medida.alturaMm) + " mm está salva neste computador" : "Sua etiqueta " + mmTxt(medida.larguraMm) + " x " + mmTxt(medida.alturaMm) + " mm está pronta"}</Text>
        <Text style={[s.hint, { textAlign: "center" }]}>Ela já aparece na lista de modelos como “{nomeDaMedida(medida)}”.</Text>
      </View>
      {!guardou && (
        <Nota tipo="aviso" icone="alert" testID="medida-nao-guardou"><Text style={s.notaTxt}><Text style={s.b}>Não consegui guardar neste computador.</Text> O navegador bloqueou o armazenamento: a medida vale até você fechar a Aura.</Text></Nota>
      )}
      <View style={estreito ? undefined : s.split}>
        <View style={estreito ? { marginBottom: 10 } : s.splitPrev}>
          <View style={s.prevCard}>
            <Svg html={desenhoDoRolo({ ...medida, linhas: 2, larguraMinima: 60, alturaMaxPx: estreito ? 150 : 300, exemplo: exemplo })} />
            <Text style={s.prevCap}>Prévia ilustrativa</Text>
          </View>
        </View>
        <View style={estreito ? undefined : s.splitForm}>
          <View style={s.sum}>
            {linhaResumo("Tamanho", mmTxt(medida.larguraMm) + " x " + mmTxt(medida.alturaMm) + " mm", 1, "tamanho")}
            {linhaResumo("No rolo", textoColunas(medida.colunas), 1, "rolo")}
            {linhaResumo("Espaço entre etiquetas", textoEspacos(medida), 1, "espaco")}
            {linhaResumo("Ajuste da impressão", textoAjuste(ajuste), 3, "ajuste")}
          </View>
          <Nota tipo="info" icone="info"><Text style={s.notaTxt}>O ajuste fica <Text style={s.b}>neste computador</Text>, porque a impressora é do computador. Em outro computador, é só repetir o teste (leva 1 minuto).</Text></Nota>
        </View>
      </View>
    </View>
  );

  // ----- rodapé -----
  var rodape: React.ReactNode;
  if (passo === 1) {
    rodape = (
      <>
        <Pressable onPress={onFechar} style={[s.btn, s.btnVoltar]} testID="medida-cancelar"><Text style={s.btnTxt}>Cancelar</Text></Pressable>
        <Pressable onPress={function () { if (lido.spec) irPara(2); }} disabled={!lido.spec} style={[s.btn, s.btnPri, s.btnFlex, !lido.spec && s.btnOff]} testID="medida-continuar" accessibilityState={{ disabled: !lido.spec }}>
          <Text style={s.btnPriTxt}>Continuar</Text><Icon name="arrow_right" size={16} color="#fff" />
        </Pressable>
      </>
    );
  } else if (passo === 2) {
    rodape = (
      <>
        <Pressable onPress={function () { irPara(1); }} style={[s.btn, s.btnVoltar]} testID="medida-voltar"><Icon name="arrow_left" size={16} color={Colors.ink} /><Text style={s.btnTxt}>Voltar</Text></Pressable>
        <Pressable onPress={function () { irPara(3); }} style={[s.btn, s.btnPri, s.btnFlex]} testID="medida-ja-imprimi"><Text style={s.btnPriTxt}>Já imprimi, continuar</Text><Icon name="arrow_right" size={16} color="#fff" /></Pressable>
      </>
    );
  } else if (passo === 3) {
    rodape = (
      <>
        <Pressable onPress={function () { irPara(2); }} style={[s.btn, s.btnVoltar]} testID="medida-voltar"><Icon name="arrow_left" size={16} color={Colors.ink} /><Text style={s.btnTxt}>Voltar</Text></Pressable>
        <Pressable onPress={ficouCerto} style={[s.btn, s.btnOk, s.btnFlex]} testID="medida-ficou-certo"><Icon name="check" size={18} color="#fff" /><Text style={s.btnPriTxt}>Ficou certo</Text></Pressable>
      </>
    );
  } else {
    rodape = (
      <>
        <Pressable onPress={onFechar} style={[s.btn, s.btnVoltar]} testID="medida-fechar"><Text style={s.btnTxt}>Fechar</Text></Pressable>
        <Pressable onPress={function () { onImprimirAgora(final); }} style={[s.btn, s.btnPri, s.btnFlex]} testID="medida-imprimir-agora"><Icon name="print" size={18} color="#fff" /><Text style={s.btnPriTxt}>Imprimir etiquetas agora</Text></Pressable>
      </>
    );
  }

  var cabecalhoPasso = passo === 1
    ? { t: "Qual é o tamanho da sua etiqueta?", d: "Comece por um atalho ou digite a medida em milímetros (mm)." }
    : passo === 2
      ? { t: "Imprima uma etiqueta de teste", d: "Vamos conferir se a impressão cai no lugar certo. É rápido." }
      : passo === 3
        ? { t: "Como saiu o teste?", d: "Olhe a etiqueta que saiu e toque no lado para onde a moldura foi. Cada toque corrige 0,5 mm no sentido contrário." }
        : null;

  var painel = (
    <View style={[s.painel, estreito ? s.painelCel : s.painelPc]} testID="medida-wizard" accessibilityViewIsModal accessibilityLabel="Minha medida de etiqueta">
      <View style={s.head}>
        <View style={s.headIco}><Icon name="ruler" size={16} color={Colors.violet3} /></View>
        <Text style={s.headTit}>{editando ? "Editar minha etiqueta" : "Minha medida de etiqueta"}</Text>
        <Pressable onPress={onFechar} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar" testID="medida-x"><Icon name="x" size={18} color={Colors.ink3} /></Pressable>
      </View>
      <View style={s.stepBar} accessibilityLabel="Passos">
        {PASSOS.map(function (pp, idx) {
          var k = pp[0], feito = k < passo, atual = k === passo;
          return (
            <View key={k} style={s.stepItem}>
              {idx > 0 && <View style={[s.stepSep, (feito || atual) && s.stepSepOn]} />}
              <Pressable onPress={feito ? function () { irPara(k); } : undefined} disabled={!feito} style={s.stepBtn} accessibilityRole="button" accessibilityLabel={feito ? "Voltar ao passo " + k + ": " + pp[1] : pp[1]} accessibilityState={{ selected: atual, disabled: !feito }} testID={"medida-passo-" + k}>
                <View style={[s.dot, feito && s.dotFeito, atual && s.dotAtual]}>
                  {feito ? <Icon name="check" size={14} color={Colors.violet3} /> : <Text style={[s.dotTxt, atual && { color: "#fff" }]}>{k}</Text>}
                </View>
                <Text style={[s.stepLbl, (atual || feito) && s.stepLblOn]}>{pp[1]}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      {/* No celular o rolo do passo 1 fica fixo no topo (fora da rolagem). */}
      {estreito && passo === 1 && <View style={s.prevFixo}>{previa1}</View>}
      <ScrollView style={s.body} contentContainerStyle={s.bodyIn} keyboardShouldPersistTaps="handled">
        {cabecalhoPasso && (
          <View style={{ marginBottom: 12 }}>
            <Text style={s.stepH} accessibilityRole="header">{cabecalhoPasso.t}</Text>
            <Text style={s.stepP}>{cabecalhoPasso.d}</Text>
          </View>
        )}
        {passo === 1 && (estreito ? form1 : (
          <View style={s.split}><View style={s.splitForm}>{form1}</View><View style={s.splitPrev}>{previa1}</View></View>
        ))}
        {passo === 2 && corpo2}
        {passo === 3 && corpo3}
        {passo === 4 && corpo4}
      </ScrollView>
      <View style={s.foot}>{rodape}</View>
    </View>
  );

  return (
    <WebPortal active>
      {React.createElement("div", {
        style: {
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50000, display: "flex",
          alignItems: estreito ? "flex-end" : "center", justifyContent: "center", background: "rgba(2,6,23,0.55)",
        },
      }, painel)}
    </WebPortal>
  );
}

var s = StyleSheet.create({
  painel: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, overflow: "hidden", flexDirection: "column" },
  painelPc: { width: "94%", maxWidth: 820, height: "92%", maxHeight: 720, borderRadius: 16 },
  painelCel: { width: "100%", height: "95%", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  headIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  headTit: { flex: 1, fontSize: 16, fontWeight: "800", color: Colors.ink },
  fechar: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepBar: { flexDirection: "row", paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepItem: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
  stepSep: { position: "absolute", top: 21, right: "50%", width: "100%", height: 2, backgroundColor: Colors.border },
  stepSepOn: { backgroundColor: Colors.violet },
  stepBtn: { flex: 1, alignItems: "center", gap: 4, minHeight: 44, paddingTop: 5 },
  dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  dotAtual: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  dotFeito: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  dotTxt: { fontSize: 14, fontWeight: "800", color: Colors.ink3 },
  stepLbl: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  stepLblOn: { color: Colors.ink },
  prevFixo: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  body: { flex: 1 },
  bodyIn: { padding: 18, paddingBottom: 24 },
  stepH: { fontSize: 20, fontWeight: "800", color: Colors.ink, lineHeight: 26 },
  stepP: { fontSize: 14, color: Colors.ink3, marginTop: 4 },
  split: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  splitForm: { flex: 1, minWidth: 0 },
  splitPrev: { flex: 1.08, minWidth: 0 },
  prevTopo: { marginBottom: 12 },
  prevCard: { backgroundColor: "#f6f4fc", borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.18)", padding: 10, gap: 4 },
  prevTit: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  prevTitTxt: { fontSize: 11.5, fontWeight: "700", color: "#6b6585", textTransform: "uppercase", letterSpacing: 0.4 },
  prevCap: { fontSize: 12, color: "#6b6585", textAlign: "center" },
  grp: { marginBottom: 16 },
  lbl: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 6 },
  hint: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: Colors.bg3, justifyContent: "center" },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipTxt: { fontSize: 15, fontWeight: "700", color: Colors.ink2 },
  chipTxtOn: { color: Colors.violet3 },
  fields2: { flexDirection: "row", gap: 12 },
  field: { flex: 1, minWidth: 0, gap: 6 },
  fieldLbl: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  inp: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 12, backgroundColor: Colors.bg, minHeight: 52, paddingHorizontal: 12 },
  inpErro: { borderColor: Colors.red },
  inpOff: { opacity: 0.55 },
  inpTxt: { flex: 1, minWidth: 0, fontSize: 19, fontWeight: "700", color: Colors.ink, paddingVertical: 8, outlineStyle: "none" } as any,
  inpUn: { fontSize: 14, fontWeight: "700", color: Colors.ink3, marginLeft: 6 },
  erro: { fontSize: 13, fontWeight: "600", color: Colors.red },
  nota: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 10, borderWidth: 1 },
  notaDica: { backgroundColor: Colors.violetD, borderColor: "transparent" },
  notaAviso: { backgroundColor: Colors.amberD, borderColor: Colors.amber + "55" },
  notaOk: { backgroundColor: Colors.greenD, borderColor: Colors.green + "55" },
  notaInfo: { backgroundColor: Colors.bg4, borderColor: "transparent" },
  notaTxt: { fontSize: 13.5, color: Colors.ink, lineHeight: 19 },
  b: { fontWeight: "800" },
  btnNota: { alignSelf: "flex-start", marginTop: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.amber + "88", backgroundColor: Colors.bg3, justifyContent: "center" },
  btnNotaTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  cols: { flexDirection: "row", gap: 8 },
  colBtn: { flex: 1, minHeight: 76, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6 },
  colBtnOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  colGlyph: { flexDirection: "row", gap: 3, height: 20 },
  colGlyphBox: { height: 20, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.ink3 },
  colGlyphBoxOn: { borderColor: Colors.violet3, backgroundColor: Colors.violet + "33" },
  colBtnN: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  colBtnSub: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  colBtnTxtOn: { color: Colors.violet3 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingVertical: 8, alignSelf: "flex-start" },
  linkBtnTxt: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  bigcall: { fontSize: 19, fontWeight: "800", color: Colors.ink, lineHeight: 25, marginBottom: 10 },
  expl: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  explN: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  explNTxt: { fontSize: 13, fontWeight: "800", color: Colors.violet3 },
  explTxt: { flex: 1, fontSize: 14.5, color: Colors.ink, lineHeight: 20 },
  details: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, marginTop: 12 },
  detailsTxt: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.ink },
  dpad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  dpCel: { width: "32%", minHeight: 76 },
  dpMeio: { alignItems: "center", justifyContent: "center" },
  dpGlyph: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.ink3 },
  dp: { width: "32%", minHeight: 76, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", gap: 4, padding: 6 },
  dpTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink, textAlign: "center", lineHeight: 16 },
  fineBox: { paddingHorizontal: 4, paddingTop: 8, gap: 4 },
  fineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  fineNm: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  stp: { flexDirection: "row", alignItems: "center", gap: 8 },
  stpBtn: { width: 46, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border2, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
  stpBtnTxt: { fontSize: 22, fontWeight: "700", color: Colors.violet3 },
  stpVal: { minWidth: 84, textAlign: "center", fontSize: 16, fontWeight: "700", color: Colors.ink },
  done: { alignItems: "center", paddingBottom: 8, gap: 4 },
  bigOk: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  doneTit: { fontSize: 20, fontWeight: "800", color: Colors.ink, textAlign: "center", lineHeight: 26 },
  sum: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, overflow: "hidden" },
  sumRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sumRot: { fontSize: 12, color: Colors.ink3 },
  sumVal: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  alterar: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, paddingHorizontal: 6 },
  foot: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnTxt: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  btnVoltar: { minWidth: 110 },
  btnFlex: { flex: 1 },
  btnPri: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnOk: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  btnPriTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  btnBig: { minHeight: 60, marginTop: 6 },
  btnOff: { opacity: 0.45 },
});

export default MinhaMedidaWizard;
