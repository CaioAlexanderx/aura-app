// ============================================================================
// AURA. — Estoque · Ajustar preço em lote (p-52, 30/10/2026)
//
// Mockup aprovado pelo Caio: https://claude.ai/artifact/MNynZQZAE4MVXTsngU3SBX
// Backend: Aura-backend#939 (prévia/aplicar) e #940 (desfazer).
//
// DNA do TrocaModal (CLAUDE.md, armadilha 5), no mesmo formato do
// ImportPlanilhaModal: painel, cabeçalho com ícone + título + frase, barra
// de passos, corpo com rolagem, rodapé com a frase de situação à esquerda e
// as ações à direita.
//   1 O que mudar — modo, aumentar/diminuir, valor, terminação.
//   2 Conferir    — prévia do servidor (nada gravado).
//   3 Pronto      — aplicar, desfazer, reimprimir etiquetas (p-53).
//
// Multi-CNPJ: `companyId` é a empresa ativa (a mesma do resto do Estoque);
// produto de grupo é uma linha só, e o modal avisa que o preço vale para
// todas as lojas do grupo. Renderizado pelo Estoque dentro de WebPortal
// (overlay dentro do shell do RNW fica preso no z-index do pai).
// Sem hover: tudo visível; alvos de 44 px; a 375 px a lista vira cartões.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  priceAdjustmentsApi, type DirecaoReajuste, type ModoReajuste, type RespostaReajuste, type Terminacao,
} from "@/services/priceAdjustmentsApi";
import {
  MAX_PRODUTOS_REAJUSTE, VALOR_INICIAL, contarSemCusto, erroDoValor, montarPedido, plural, produtosQueMudam,
} from "./reajusteRegras";
import { Passo1Modo } from "./Passo1Modo";
import { Passo2Previa } from "./Passo2Previa";

var IS_WEB = Platform.OS === "web";

export type ProdutoParaReajuste = { id: string; cost?: number | null };

type Props = {
  companyId: string;
  produtos: ProdutoParaReajuste[];
  onFechar: () => void;
};

type Passo = 1 | 2 | 3;
var PASSOS: Array<[Passo, string]> = [[1, "O que mudar"], [2, "Conferir"], [3, "Pronto"]];

export function AjustarPrecoModal({ companyId, produtos, onFechar }: Props) {
  var largura = useWindowDimensions().width;
  var estreito = largura < 640;
  var ids = useMemo(function () { return produtos.map(function (p) { return p.id; }); }, [produtos]);
  var semCusto = useMemo(function () { return contarSemCusto(produtos); }, [produtos]);
  var demais = ids.length > MAX_PRODUTOS_REAJUSTE;

  var [passo, setPasso] = useState<Passo>(1);
  var [modo, setModoState] = useState<ModoReajuste>("percent");
  var [direcao, setDirecao] = useState<DirecaoReajuste>("up");
  var [valorTxt, setValorTxt] = useState<string>(VALOR_INICIAL.percent);
  var [terminacao, setTerminacao] = useState<Terminacao>("none");
  var [tentou, setTentou] = useState(false);
  var [carregando, setCarregando] = useState(false);
  var [erro, setErro] = useState<string | null>(null);
  var [previa, setPrevia] = useState<RespostaReajuste | null>(null);
  // Quantos dos marcados são de grupo: vem da primeira prévia (não depende
  // do modo nem do valor), pedida em silêncio ao abrir.
  var [produtosDeGrupo, setProdutosDeGrupo] = useState<number | null>(null);
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  useEffect(function () {
    if (!companyId || ids.length === 0 || demais) return;
    priceAdjustmentsApi.previa(companyId, montarPedido(ids, "percent", "up", VALOR_INICIAL.percent, "none"))
      .then(function (r) { if (vivo.current) setProdutosDeGrupo(r.summary.group_shared || 0); })
      .catch(function () { /* o passo 2 avisa de qualquer forma */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  var erroValor = erroDoValor(modo, direcao, valorTxt);
  var podeVer = !erroValor && !demais && ids.length > 0 && !carregando;

  function setModo(m: ModoReajuste) {
    if (m === modo) return;
    setModoState(m);
    setValorTxt(VALOR_INICIAL[m]);
    setTentou(false);
    setErro(null);
  }

  function verComoFica() {
    setTentou(true);
    if (!podeVer) return;
    setCarregando(true);
    setErro(null);
    priceAdjustmentsApi.previa(companyId, montarPedido(ids, modo, direcao, valorTxt, terminacao))
      .then(function (r) {
        if (!vivo.current) return;
        setPrevia(r);
        setProdutosDeGrupo(r.summary.group_shared || 0);
        setPasso(2);
      })
      .catch(function (e: any) {
        if (!vivo.current) return;
        setErro((e && e.message) || "Não conseguimos calcular agora. Tente de novo em instantes.");
      })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }

  var panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  var sub = passo === 1
    ? "Escolha como mudar o preço. Você confere tudo antes de aplicar."
    : "Confira como fica. Nada foi gravado ainda.";

  var rodape = passo === 1
    ? plural(ids.length, "produto selecionado", "produtos selecionados")
    : previa ? plural(produtosQueMudam(previa.items).length, "produto vai mudar", "produtos vão mudar") : "";

  return (
    <View style={[s.overlay, estreito && { padding: 10 }]} testID="reajuste-modal">
      <Pressable style={s.backdrop} onPress={carregando ? undefined : onFechar} accessibilityLabel="Fechar" />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} accessibilityViewIsModal accessibilityLabel="Ajustar preço">

        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIco}><Icon name="tag" size={16} color="#a78bfa" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>Ajustar preço</Text>
              <Text style={s.headerSub}>{sub}</Text>
            </View>
          </View>
          <Pressable onPress={carregando ? undefined : onFechar} style={s.closeBtn} testID="reajuste-x" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <View style={s.stepBar} accessibilityLabel={"Passo " + passo + " de 3"}>
          {PASSOS.map(function (pp, idx) {
            var n = pp[0];
            var ativo = n === passo;
            var feito = n < passo;
            return (
              <View key={n} style={s.stepItem} testID={"reajuste-passo-" + n}>
                <View style={[s.stepDot, feito && s.stepDotDone, ativo && s.stepDotActive]}>
                  {feito ? <Icon name="check" size={10} color="#fff" /> : <Text style={[s.stepDotTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                </View>
                {(!estreito || ativo) && (
                  <Text style={[s.stepLabel, (ativo || feito) && { color: ativo ? "#a78bfa" : Colors.ink2, fontWeight: ativo ? "700" : "500" }]}>{pp[1]}</Text>
                )}
                {idx < PASSOS.length - 1 && <View style={[s.stepSep, estreito && { width: 16 }, feito && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
              </View>
            );
          })}
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {passo === 1 && (
            <Passo1Modo
              modo={modo}
              direcao={direcao}
              valorTxt={valorTxt}
              terminacao={terminacao}
              erroValor={erroValor}
              mostrarErro={tentou || valorTxt.trim().length > 0}
              semCusto={semCusto}
              produtosDeGrupo={produtosDeGrupo}
              totalSelecionados={ids.length}
              erro={erro}
              estreito={estreito}
              onModo={setModo}
              onDirecao={function (d) { setDirecao(d); setErro(null); }}
              onValor={function (v) { setValorTxt(v); setErro(null); }}
              onTerminacao={setTerminacao}
              onEnviar={verComoFica}
            />
          )}
          {passo === 2 && previa && <Passo2Previa previa={previa} estreito={estreito} />}
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.footerInfo} numberOfLines={2} testID="reajuste-rodape">{rodape}</Text>
          <View style={s.footerActions}>
            {passo === 1 && (
              <>
                <Pressable style={s.btnSec} onPress={onFechar} testID="reajuste-cancelar" accessibilityRole="button">
                  <Text style={s.btnSecTxt}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[s.btnPri, !podeVer && { opacity: 0.45 }]}
                  onPress={verComoFica}
                  disabled={!podeVer}
                  testID="reajuste-ver"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !podeVer, busy: carregando }}
                >
                  {carregando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>Ver como fica</Text>}
                </Pressable>
              </>
            )}
            {passo === 2 && (
              <>
                <Pressable style={s.btnSec} onPress={function () { setPasso(1); }} testID="reajuste-voltar" accessibilityRole="button">
                  <Icon name="arrow_left" size={14} color={Colors.ink} />
                  <Text style={s.btnSecTxt}>Voltar</Text>
                </Pressable>
                <Pressable style={s.btnPri} onPress={onFechar} testID="reajuste-fechar" accessibilityRole="button">
                  <Text style={s.btnPriTxt}>Fechar</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 760, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.18)", borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)", gap: 6,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500" },
  stepSep: { width: 28, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 4 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 18, paddingBottom: 12 },
  footer: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)", backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
  },
  footerInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 140, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  btnPri: {
    backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.border2,
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});

export default AjustarPrecoModal;
