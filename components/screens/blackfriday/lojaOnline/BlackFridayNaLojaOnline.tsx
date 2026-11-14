// ============================================================================
// AURA. — Página Black Friday · seção "Black Friday na loja online" (p-120)
//
// Mockup aprovado pelo Caio (14/11/2026): https://claude.ai/artifact/2vZuoRKQpbpYfjxShbqTtL
//
// Logo depois de "Promoção em lote". Dois passos e uma chave:
//   1 Descontos  — quantos produtos estão em promoção (no ar e agendados) e
//                  "Montar descontos": o MESMO assistente da Promoção em lote
//                  (CriarPromocaoModal), já no prazo da Black Friday (27/11
//                  a 30/11). O preço promocional vale no Caixa e na loja.
//   2 Faixa      — o título da faixa entre três opções; o "até N% OFF" é
//                  calculado no servidor e não se edita. "Ver a loja".
//   Chave        — "Mostrar a campanha na loja online". Sem desconto montado
//                  fica desligada (e o servidor recusa com 409, que vira o
//                  texto gentil dele).
// Loja online ainda não publicada: uma ação só, "Configurar a loja online".
// Quem decide se a seção aparece é a página (secoes.ts + useCampanhaDaLoja):
// some no Essencial, sem loja online e no perfil consulta; no consolidado,
// "escolher empresa". Sem hover: tudo visível, alvos de 44 px.
// ============================================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Linking, Platform, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { WebPortal } from "@/components/WebPortal";
import { Aviso } from "@/components/screens/estoque/reajuste/Aviso";
import { CriarPromocaoModal } from "@/components/screens/blackfriday/dePor/CriarPromocaoModal";
import { studioStorefrontUrl } from "@/utils/storefrontUrl";
import type { CampanhaDaLoja } from "@/hooks/useCampanhaDaLoja";
import type { TituloDaCampanha } from "@/services/campanhaLojaApi";
import {
  avisoDeAgendada, mensagemErroCampanha, seloDaCampanha, textoDaChave, textoDaFaixa, textoDosDescontos,
} from "./regrasCampanhaLoja";

type Props = {
  companyId: string;
  campanha: CampanhaDaLoja;
  /** O De/Por recarrega quando o assistente grava (as duas seções mostram as mesmas promoções). */
  onDescontosMudaram?: () => void;
};

export function BlackFridayNaLojaOnline({ companyId, campanha, onDescontosMudaram }: Props) {
  var [aberto, setAberto] = useState(false);
  var [salvando, setSalvando] = useState<null | "chave" | TituloDaCampanha>(null);
  var [erro, setErro] = useState<string | null>(null);
  // No celular o passo quebra em linhas: o número fica no topo, não no meio.
  var estreito = useWindowDimensions().width < 640;
  var e = campanha.estado;
  if (!e) return null;

  if (!e.loja_online.publicada) {
    return (
      <View style={s.vazio} testID="bf-loja-nao-publicada">
        <Text style={[s.t, { flex: 1, minWidth: 200 }]}>
          A sua loja online ainda não está publicada. Publique a loja para mostrar a campanha de Black Friday aos clientes.
        </Text>
        <Pressable style={s.btnP} onPress={function () { router.push("/canal" as any); }} accessibilityRole="button" testID="bf-loja-configurar">
          <Text style={s.btnPTxt}>Configurar a loja online</Text>
        </Pressable>
      </View>
    );
  }

  var selo = seloDaCampanha(e);
  var temDesconto = e.promocoes.no_ar + e.promocoes.agendadas > 0;
  var aviso = avisoDeAgendada(e);

  async function salvar(qual: "chave" | TituloDaCampanha, mudanca: { ativa?: boolean; titulo?: TituloDaCampanha }) {
    if (salvando) return;
    setSalvando(qual);
    setErro(null);
    try {
      await campanha.salvar(mudanca);
    } catch (err: any) {
      setErro(mensagemErroCampanha(err));
      // 409 do servidor: o estado na tela pode estar velho (a promoção acabou).
      campanha.recarregar();
    } finally {
      setSalvando(null);
    }
  }

  function verALoja() {
    if (!e || !e.loja_online.slug) return;
    var url = studioStorefrontUrl(e.loja_online.slug);
    if (Platform.OS === "web" && typeof window !== "undefined") { window.open(url, "_blank", "noopener"); return; }
    Linking.openURL(url).catch(function () {});
  }

  var desligada = !e.pode_ligar && !e.ativa;

  return (
    <View style={{ gap: 12 }} testID="bf-loja-secao">
      <View style={s.topo}>
        <Text style={[s.selo, selo.tom === "no_ar" ? s.seloOk : selo.tom === "agendada" ? s.seloAg : s.seloN]} testID="bf-loja-selo">
          {selo.texto}
        </Text>
      </View>

      <View style={[s.passo, estreito && s.passoCel]} testID="bf-loja-passo-descontos">
        <View style={[s.num, temDesconto && s.numOk]}><Text style={[s.numTxt, temDesconto && { color: "#fff" }]}>{temDesconto ? "✓" : "1"}</Text></View>
        <View style={s.passoCorpo}>
          <Text style={s.passoTit}>Descontos</Text>
          <Text style={s.t} testID="bf-loja-descontos">{textoDosDescontos(e)}</Text>
        </View>
        <Pressable style={temDesconto ? s.btn : s.btnP} onPress={function () { setAberto(true); }} accessibilityRole="button" testID="bf-loja-montar">
          <Text style={temDesconto ? s.btnTxt : s.btnPTxt}>{temDesconto ? "Montar mais descontos" : "Montar descontos"}</Text>
        </Pressable>
      </View>

      <View style={[s.passo, estreito && s.passoCel]} testID="bf-loja-passo-faixa">
        <View style={s.num}><Text style={s.numTxt}>2</Text></View>
        <View style={s.passoCorpo}>
          <Text style={s.passoTit}>Faixa preta na loja</Text>
          <Text style={s.t}>{textoDaFaixa(e)}</Text>
          <View style={s.titulos} accessibilityRole="radiogroup">
            {e.titulos.map(function (t) {
              var on = e!.titulo === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[s.tituloOpt, on && s.tituloOn]}
                  onPress={function () { if (!on) salvar(t.id, { titulo: t.id }); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, busy: salvando === t.id }}
                  testID={"bf-loja-titulo-" + t.id}
                >
                  <Text style={[s.tituloTxt, on && s.tituloTxtOn]}>{t.texto}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {!!e.loja_online.slug && (
          <Pressable style={s.btn} onPress={verALoja} accessibilityRole="link" testID="bf-loja-ver">
            <Text style={s.btnTxt}>Ver a loja</Text>
          </Pressable>
        )}
      </View>

      <View style={s.chave} testID="bf-loja-chave-linha">
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={s.passoTit}>Mostrar a campanha na loja online</Text>
          <Text style={s.t}>{textoDaChave(e)}</Text>
        </View>
        {salvando === "chave"
          ? <ActivityIndicator color={Colors.violet} style={{ width: 52 }} />
          : (
            <Pressable
              onPress={function () { salvar("chave", { ativa: !e!.ativa }); }}
              disabled={desligada}
              style={[s.sw, e.ativa && s.swOn, desligada && { opacity: 0.45 }]}
              accessibilityRole="switch"
              accessibilityLabel="Mostrar a campanha na loja online"
              accessibilityState={{ checked: e.ativa, disabled: desligada }}
              testID="bf-loja-chave"
            >
              <View style={[s.swThumb, e.ativa && s.swThumbOn]} />
            </Pressable>
          )}
      </View>

      {!!aviso && <Aviso tipo="aviso" testID="bf-loja-aviso-agendada">{aviso}</Aviso>}
      {!!erro && <Aviso tipo="erro" testID="bf-loja-erro">{erro}</Aviso>}

      <WebPortal active={aberto}>
        <CriarPromocaoModal
          companyId={companyId}
          prazoInicial="bf"
          titulo="Montar descontos da loja online"
          onFechar={function () { setAberto(false); }}
          onAplicada={function () { campanha.recarregar(); if (onDescontosMudaram) onDescontosMudaram(); }}
        />
      </WebPortal>
    </View>
  );
}

var s = StyleSheet.create({
  t: { fontSize: 13, color: Colors.ink3, lineHeight: 19 },
  topo: { flexDirection: "row" },
  selo: { fontSize: 11.5, fontWeight: "600", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  seloOk: { backgroundColor: Colors.greenD, color: Colors.green },
  seloAg: { backgroundColor: Colors.amberD, color: Colors.amber },
  seloN: { backgroundColor: Colors.violetD, color: Colors.violet3 },
  vazio: {
    borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 12, padding: 16,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14,
  },
  passo: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 14, backgroundColor: Colors.bg2,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12,
  },
  passoCel: { alignItems: "flex-start" },
  passoCorpo: { flex: 1, minWidth: 200, gap: 2 },
  passoTit: { fontSize: 14.5, fontWeight: "700", color: Colors.ink },
  num: { width: 28, height: 28, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violetD },
  numOk: { backgroundColor: Colors.green },
  numTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  titulos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tituloOpt: {
    minHeight: 44, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center",
  },
  tituloOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  tituloTxt: { fontSize: 12.5, color: Colors.ink2 },
  tituloTxtOn: { color: Colors.violet3, fontWeight: "700" },
  chave: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 14, backgroundColor: Colors.bg2,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12,
  },
  sw: { width: 52, height: 30, borderRadius: 99, backgroundColor: Colors.border2, justifyContent: "center", padding: 3 },
  swOn: { backgroundColor: Colors.violet },
  swThumb: { width: 24, height: 24, borderRadius: 99, backgroundColor: "#fff" },
  swThumbOn: { transform: [{ translateX: 22 }] },
  btn: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
    alignItems: "center", justifyContent: "center",
  },
  btnTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  btnP: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  btnPTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
});

export default BlackFridayNaLojaOnline;
