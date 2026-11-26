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
import { Colors } from "@/constants/colors";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { useWaPublico, useWaModelos } from "@/hooks/useWaAutomatica";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import { BolhaExemplo, Interruptor, Passo, PilulaToggle, PreviaCorteView } from "./configUi";
import { ModelosEditaveis } from "./ModelosEditaveis";
import { podeMandarNovidades, quantoTrazer, trazerDoVendaMais } from "./waCorte";
import { PONTOS_ROTULO, alternarPonto, lerPontos } from "./waAutomaticaConfig";
import { renderizar } from "./waMensagem";
import { waNumeroEmAtencao, type SaldoInfo } from "./waSaldo";
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
  const pode = podeMandarNovidades({
    aceiteEm: info.aceiteEm,
    numeroEmAtencao: waNumeroEmAtencao(status),
    novidadesEsgotadas: saldo ? saldo.novidades.esgotado : null,
    textoEsgotado: saldo?.novidades.textoEsgotado,
    corte,
  });

  const modeloOferta = (modelos.modelos || []).find((m) => m.key === "cred_oferta");
  const primeira = corte?.recebem[0]?.nome.split(" ")[0] || undefined;
  const mensagemOferta = modeloOferta?.texto_em_uso
    ? renderizar(modeloOferta.texto_em_uso, { "Nome": primeira, "Nome da loja": lojaNome || undefined })
    : null;

  const avisosTxt = saldo
    ? `Usam os avisos do mês: ${saldo.avisos.livres}. Se acabarem, cada aviso vira um botão "Cobrar pelo meu WhatsApp", de graça.`
    : 'Usam os avisos do mês. Se acabarem, cada aviso vira um botão "Cobrar pelo meu WhatsApp", de graça.';

  return (
    <View style={{ gap: 14 }} testID="wa-cred-tela">
      <Passo n="01 · COBRAR" titulo="Avisos de parcela" sub={`Toque nos pontos da linha para escolher quando avisar. ${avisosTxt}`}>
        <View style={s.linha}>
          <Text style={s.titulo}>{cobrar.ligada ? "Ligado" : "Desligado"}</Text>
          <Interruptor
            ligado={cobrar.ligada} desabilitado={travado} rotulo={(cobrar.ligada ? "Desligar" : "Ligar") + " os avisos de parcela"}
            testID="wa-cred-cobrar-liga" onToggle={() => alt.alternar("crediario_cobrar")}
          />
        </View>
        <View style={s.pilulas}>
          {PONTOS_ROTULO.map(({ k, rotulo }) => (
            <PilulaToggle
              key={k} rotulo={rotulo} ligada={!!pontos?.[k]} desabilitado={travado || !pontos}
              testID={`wa-cred-ponto-${k}`}
              onToggle={() => pontos && auto.salvarConfig("crediario_cobrar", { pontos: alternarPonto(pontos, k) })}
            />
          ))}
        </View>

        {pubCobrar.carregando && !pubCobrar.publico && <ActivityIndicator size="small" color={Colors.violet3} />}
        {typeof amanha?.saem === "number" && (
          <View style={{ gap: 6 }} testID="wa-cred-amanha">
            <Text style={s.tituloMenor}>
              Amanhã, às 9h, {amanha.saem === 1 ? "sai 1 aviso" : `saem ${amanha.saem} avisos`}
            </Text>
            <Text style={s.sub}>Quem já pagou some da lista sozinho.</Text>
            {itens.map((p) => (
              <View key={`${p.nome}-${p.ponto}`} style={s.pessoa}>
                <Text style={s.pessoaNome}>{p.nome}</Text>
                {!!p.detalhe && <Text style={s.pessoaDet}>{p.detalhe}{p.ponto ? ` · ${p.ponto}` : ""}</Text>}
              </View>
            ))}
          </View>
        )}
        {foraCobrar.length > 0 && (
          <Text style={s.sub} testID="wa-cred-fora">
            {foraCobrar.length === 1 ? "1 cliente fica de fora: " : `${foraCobrar.length} clientes ficam de fora: `}
            {foraCobrar.map((p) => `${p.nome} (${motivoFora(p.motivo)})`).join(", ")}.
          </Text>
        )}
        {alt.perguntando === "crediario_cobrar" && (
          <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
        )}
      </Passo>

      <Passo
        n="02 · VENDER"
        titulo={corte ? `${corte.total} clientes pagam em dia e têm limite livre` : "Clientes que pagam em dia"}
        sub="Uma oferta por mês lembra que o crediário está ali. Esta usa as novidades do mês guardadas para o Crediário."
      >
        <PreviaCorteView
          idBase="wa-cred" corte={corte} substantivo="clientes" dono="o Crediário"
          reserva={vender.livres} trazer={trazer} trazendo={travado}
          onTrazer={() => {
            const prox = trazerDoVendaMais(info.divisao, info.usadas, "crediario", trazer);
            if (prox) auto.aplicarDivisao(prox).then(() => pubVender.recarregar());
          }}
        />
        <BolhaExemplo titulo="Prévia" mensagem={mensagemOferta} />
        {!!pubVender.enviado && (pubVender.enviado.enfileiradas ?? 0) > 0 && (
          <Text style={s.ok} testID="wa-cred-enviado">Pronto. A oferta sai ainda hoje.</Text>
        )}
        <Pressable
          onPress={() => { pubVender.enviarAgora(); }}
          disabled={!pode.pode || pubVender.enviando || travado}
          accessibilityRole="button"
          accessibilityState={{ disabled: !pode.pode || pubVender.enviando || travado }}
          style={[s.btnPrim, (!pode.pode || pubVender.enviando || travado) && { opacity: 0.45 }]}
          testID="wa-cred-enviar"
        >
          {pubVender.enviando && <ActivityIndicator size="small" color="#fff" />}
          <Text style={s.btnPrimTxt}>{corte ? `Mandar para as ${corte.cabem} agora` : "Mandar agora"}</Text>
        </Pressable>
        <Text style={s.sub} testID="wa-cred-enviar-nota">
          {pode.pode
            ? `Usa ${corte!.cabem} · ficam ${Math.max(0, (vender.livres ?? 0) - corte!.cabem)} do Crediário.`
            : pode.motivo}
        </Text>
        {!!pubVender.erro && <Text style={s.erro}>{pubVender.erro}</Text>}

        <View style={s.linha}>
          <Text style={s.titulo}>Oferta {vender.ligada ? "ligada" : "desligada"}</Text>
          <Interruptor
            ligado={vender.ligada} desabilitado={travado} rotulo={(vender.ligada ? "Desligar" : "Ligar") + " a oferta do Crediário"}
            testID="wa-cred-vender-liga" onToggle={() => alt.alternar("crediario_vender")}
          />
        </View>
        {alt.perguntando === "crediario_vender" && (
          <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
        )}
        {!!auto.erro && !alt.perguntando && <Text style={s.erro}>{auto.erro}</Text>}
      </Passo>

      <Passo
        n="03 · MENSAGENS" titulo="O que o cliente lê"
        sub="Todas vêm prontas. Se você mudar um texto, ele passa pela aprovação do WhatsApp, que costuma levar algumas horas. Até lá continua indo o anterior."
      >
        <ModelosEditaveis companyId={companyId} automatica="crediario" lojaNome={lojaNome} modelosDoPai={modelos} />
      </Passo>
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
  aviso: { fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  linha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  titulo: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  tituloMenor: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  ok: { fontSize: 12.5, fontWeight: "700", color: Colors.green },
  erro: { fontSize: 12, fontWeight: "600", color: Colors.red, lineHeight: 17 },
  pilulas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pessoa: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  pessoaNome: { fontSize: 12.5, fontWeight: "700", color: Colors.ink },
  pessoaDet: { fontSize: 11.5, color: Colors.ink3 },
  btnPrim: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48,
    backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 16,
  },
  btnPrimTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
} as any);
