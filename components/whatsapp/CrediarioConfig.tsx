// ============================================================
// CrediarioConfig — o Crediário (artboard Crediario): cobrar, vender, mensagens
//
// 01 Cobrar: avisos de parcela nos pontos escolhidos. Usam os AVISOS do mês;
//    se acabarem, cada aviso vira "Cobrar pelo meu WhatsApp" (de graça).
// 02 Vender: oferta uma vez por mês para quem paga em dia e tem limite
//    livre; usa as novidades guardadas para o Crediário. Quem tem mais
//    limite livre vem primeiro. "Mandar para as N agora" nunca passa do que cabe.
// 03 Mensagens: o que o cliente lê (4 modelos), com o estado de aprovação.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { tourTarget } from "@/utils/tourTarget";
import { ANIM_TRACA, Avatar, BtnPrimario, Superficie, V, WEB, ESCURO, estiloBolha, t } from "./waVidro";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { useWaPublico, useWaModelos } from "@/hooks/useWaAutomatica";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import { Interruptor, PreviaCorteView, Secao } from "./configUi";
import { ModelosEditaveis } from "./ModelosEditaveis";
import { podeMandarNovidades, quantoTrazer, trazerDoVendaMais } from "./waCorte";
import { PONTOS_ROTULO, alternarPonto, lerPontos } from "./waAutomaticaConfig";
import { renderizar } from "./waMensagem";
import { type SaldoInfo } from "./waSaldo";
import type { WaStatus } from "@/services/waApi";

interface Props {
  companyId: string;
  auto: UseWaAutomaticas;
  saldo: SaldoInfo | null;
  status: WaStatus | null;
  lojaNome: string;
}

export function CrediarioConfig({ companyId, auto, saldo, status, lojaNome }: Props) {
  const info = auto.info;
  const cobrar = info?.autos.crediario_cobrar;
  const vender = info?.autos.crediario_vender;
  const pontos = lerPontos(cobrar?.config?.pontos);
  const alt = useAlternarAutomatica(auto);

  const pubCobrar = useWaPublico(companyId, "crediario_cobrar", undefined, null, !!cobrar, JSON.stringify(cobrar?.config || {}));
  const pubVender = useWaPublico(companyId, "crediario_vender", undefined, vender?.livres ?? null, !!vender, JSON.stringify(vender?.config || {}));
  const modelos = useWaModelos(companyId, "crediario", !!info);

  if (!info || !cobrar || !vender) {
    return (
      <Text style={s.aviso} testID="wa-cred-indisponivel">
        Não consegui ler o Crediário agora. Por segurança, nada é ligado nem alterado até eu conseguir.
      </Text>
    );
  }

  const travado = auto.salvando;
  const amanha = pubCobrar.publico?.amanha;
  const itens = Array.isArray(amanha?.itens) ? amanha!.itens! : [];
  const foraCobrar = (pubCobrar.publico?.fora_lista || []).filter((p) => p && p.nome);
  const corte = pubVender.corte;
  const trazer = quantoTrazer(corte, info.divisao, info.usadas, "crediario");
  const pode = podeMandarNovidades({ aceiteEm: info.aceiteEm, saldo, status, corte });

  const modeloOferta = (modelos.modelos || []).find((m) => m.key === "cred_oferta");
  const primeira = corte?.recebem[0]?.nome.split(" ")[0] || undefined;
  const mensagemOferta = modeloOferta?.texto_em_uso
    ? renderizar(modeloOferta.texto_em_uso, { "Nome": primeira, "Nome da loja": lojaNome || undefined }, !primeira)
    : null;

  const avisosTxt = saldo
    ? `Usam os avisos do mês: ${saldo.avisos.livres}. Se acabarem, cada aviso vira um botão "Cobrar pelo meu WhatsApp", de graça.`
    : 'Usam os avisos do mês. Se acabarem, cada aviso vira um botão "Cobrar pelo meu WhatsApp", de graça.';

  const ultimoOn = PONTOS_ROTULO.reduce((acc, p, idx) => (pontos?.[p.k] ? idx : acc), -1);
  const preenchido = ultimoOn < 0 ? 0 : Math.round((ultimoOn / Math.max(PONTOS_ROTULO.length - 1, 1)) * 100);

  return (
    <View style={{ gap: 28 }} testID="wa-cred-tela">
      <Secao
        variante="glass" meta="01 · Cobrar" titulo="Avisos de parcela" sub={`Toque nos pontos da linha para escolher quando avisar. ${avisosTxt}`}
        direita={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={t(15, cobrar.ligada ? V.ok : V.ink2, "700")}>{cobrar.ligada ? "Ligado" : "Desligado"}</Text>
            <Interruptor
              ligado={cobrar.ligada} desabilitado={travado} rotulo={(cobrar.ligada ? "Desligar" : "Ligar") + " os avisos de parcela"}
              testID="wa-cred-cobrar-liga" onToggle={() => alt.alternar("crediario_cobrar")}
            />
          </View>
        }
      >
        <View {...tourTarget("wa.crediario.linha")} style={{ position: "relative", flexDirection: "row", justifyContent: "space-between", gap: 8, paddingBottom: 4 }}>
          <View
            pointerEvents="none"
            style={[{ position: "absolute", left: 55, right: 55, top: 10, height: 2, backgroundColor: V.track } as any,
              WEB ? ({ backgroundImage: `linear-gradient(90deg,#a78bfa 0%,#a78bfa ${preenchido}%,${V.track} ${preenchido}%)`, ...ANIM_TRACA } as any) : null]}
          />
          {PONTOS_ROTULO.map(({ k, rotulo }) => {
            const on = !!pontos?.[k];
            const off = travado || !pontos;
            return (
              <Pressable
                key={k}
                onPress={() => pontos && auto.salvarConfig("crediario_cobrar", { pontos: alternarPonto(pontos, k) })}
                disabled={off}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: off }}
                testID={`wa-cred-ponto-${k}`}
                style={{ flex: 1, minWidth: 64, alignItems: "center", gap: 10, minHeight: 44, opacity: off ? 0.6 : 1 }}
              >
                <View
                  style={[{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    borderColor: on ? "#e9e3ff" : V.chkLine, backgroundColor: on ? "#a78bfa" : (ESCURO ? "#120b2c" : "#ffffff"),
                  } as any, WEB && on ? ({ backgroundImage: "radial-gradient(circle at 35% 35%,#f3efff,#a78bfa)", boxShadow: "0 0 0 6px rgba(167,139,250,.18)" } as any) : null]}
                />
                <Text style={t(14, on ? V.ink : V.ink3, "600", { textAlign: "center" })}>{rotulo}</Text>
              </Pressable>
            );
          })}
        </View>

        {pubCobrar.carregando && !pubCobrar.publico && <ActivityIndicator size="small" color={V.acc} />}
        {typeof amanha?.saem === "number" && (
          <Superficie variante="dry" raio={24} padding={{ h: 20, v: 18 }} gap={12}>
            <View testID="wa-cred-amanha" style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <Text style={t(17, V.ink, "700")}>
                  Amanhã, às 9h, {amanha.saem === 1 ? "sai 1 aviso" : `saem ${amanha.saem} avisos`}
                </Text>
                <Text style={t(13, V.ink3)}>Quem já pagou some da lista sozinho.</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {itens.map((p) => (
                  <View key={`${p.nome}-${p.ponto}`} style={{ flexGrow: 1, flexBasis: 260, flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <Avatar nome={p.nome || ""} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={t(15, V.ink, "700")}>{p.nome}</Text>
                      {!!p.detalhe && <Text style={t(13, V.ink2)}>{p.detalhe}{p.ponto ? ` · ${p.ponto}` : ""}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </View>
            {foraCobrar.length > 0 && (
              <Text style={t(14, V.ink2)} testID="wa-cred-fora">
                {foraCobrar.length === 1 ? "1 cliente fica de fora: " : `${foraCobrar.length} clientes ficam de fora: `}
                {foraCobrar.map((p) => `${p.nome} (${motivoFora(p.motivo)})`).join(", ")}.
              </Text>
            )}
          </Superficie>
        )}
        {typeof amanha?.saem !== "number" && foraCobrar.length > 0 && (
          <Text style={t(14, V.ink2)} testID="wa-cred-fora">
            {foraCobrar.length === 1 ? "1 cliente fica de fora: " : `${foraCobrar.length} clientes ficam de fora: `}
            {foraCobrar.map((p) => `${p.nome} (${motivoFora(p.motivo)})`).join(", ")}.
          </Text>
        )}
        {alt.perguntando === "crediario_cobrar" && (
          <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
        )}
      </Secao>

      <Secao
        meta="02 · Vender"
        titulo={corte ? `${corte.total} clientes pagam em dia e têm limite livre` : "Clientes que pagam em dia"}
        sub="Uma oferta por mês lembra que o crediário está ali. Esta usa as novidades do mês guardadas para o Crediário."
        direita={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={t(14, V.ink2)}>Oferta {vender.ligada ? "ligada" : "desligada"}</Text>
            <Interruptor
              ligado={vender.ligada} desabilitado={travado} rotulo={(vender.ligada ? "Desligar" : "Ligar") + " a oferta do Crediário"}
              testID="wa-cred-vender-liga" onToggle={() => alt.alternar("crediario_vender")}
            />
          </View>
        }
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 }}>
            <PreviaCorteView
              idBase="wa-cred" companyId={companyId} corte={corte} substantivo="clientes" dono="o Crediário" estilo="linhas"
              reserva={vender.livres} trazer={trazer} trazendo={travado}
              onTrazer={() => {
                const prox = trazerDoVendaMais(info.divisao, info.usadas, "crediario", trazer);
                if (prox) auto.aplicarDivisao(prox).then(() => pubVender.recarregar());
              }}
            />
          </View>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 340, maxWidth: 440, minWidth: 0, gap: 14 }}>
            {!!mensagemOferta && (
              <View style={[estiloBolha(), { alignSelf: "stretch", maxWidth: "100%", paddingTop: 12, paddingBottom: 10 }]} testID="wa-config-bolha">
                <Text style={t(15, V.ink, "400", { lineHeight: 22 })}>{mensagemOferta}</Text>
                <Text style={t(12, V.ink3, "400", { marginTop: 6 })}>Para não receber mais, responda SAIR.</Text>
                <Text style={t(12, V.ink3, "400", { marginTop: 4, textAlign: "right" })}>prévia</Text>
              </View>
            )}
            {!!pubVender.enviado && (pubVender.enviado.enfileiradas ?? 0) > 0 && (
              <Text style={t(14, V.ok, "700")} testID="wa-cred-enviado">Pronto. A oferta sai ainda hoje.</Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <BtnPrimario
                onPress={() => { pubVender.enviarAgora(); }}
                disabled={!pode.pode || pubVender.enviando || travado}
                carregando={pubVender.enviando}
                testID="wa-cred-enviar"
              >
                {corte ? `Mandar para as ${corte.cabem} agora` : "Mandar agora"}
              </BtnPrimario>
              <Text style={t(13, V.ink3, "400", { flexShrink: 1 })} testID="wa-cred-enviar-nota">
                {pode.pode
                  ? `Usa ${corte!.cabem} · ficam ${Math.max(0, (vender.livres ?? 0) - corte!.cabem)} do Crediário.`
                  : pode.motivo}
              </Text>
            </View>
            {!!pubVender.erro && <Text style={s.erro}>{pubVender.erro}</Text>}
          </View>
        </View>
        {alt.perguntando === "crediario_vender" && (
          <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
        )}
        {!!auto.erro && !alt.perguntando && <Text style={s.erro}>{auto.erro}</Text>}
      </Secao>

      <Secao
        meta="03 · Mensagens" titulo="O que o cliente lê"
        sub="Todas vêm prontas. Se você mudar um texto, ele passa pela aprovação do WhatsApp, que costuma levar algumas horas. Até lá continua indo o anterior."
      >
        <ModelosEditaveis companyId={companyId} automatica="crediario" lojaNome={lojaNome} modelosDoPai={modelos} />
      </Secao>
    </View>
  );
}
function motivoFora(m: string | null | undefined): string {
  if (m === "SEM_TELEFONE") return "sem telefone";
  if (m === "OPT_OUT") return "pediu para não receber";
  if (m === "RECEBEU_HA_MENOS_DE_7_DIAS") return "recebeu há menos de 7 dias";
  return "fora da lista";
}

const s = StyleSheet.create({
  aviso: { fontSize: 14, fontWeight: "600", color: V.warn, lineHeight: 20 },
  erro: { fontSize: 13, fontWeight: "600", color: V.bad, lineHeight: 18 },
} as any);