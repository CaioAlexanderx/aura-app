// ============================================================
// AniversarioConfig — a tela do Aniversário (artboard Aniversario)
//
// 01 o jeito de falar · 02 o presente · 03 quando sai · prévia "Cabem N de
// M aniversariantes" (quem fica de fora apagado; "Trazer N do Venda+") ·
// a mensagem como a cliente vê · ligar/desligar.
// Cada toque grava no servidor e a tela relê (nada otimista).
// ============================================================
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Superficie, BtnPrimario, Lnk, V, t } from "./waVidro";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { useWaPublico, useWaModelos } from "@/hooks/useWaAutomatica";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import {
  BolhaExemplo, CaixaPrevia, Interruptor, Passo, Pilulas, PreviaCorteView,
} from "./configUi";
import { quantoTrazer, trazerDoVendaMais } from "./waCorte";
import {
  OPCOES_PRESENTE, OPCOES_QUANDO, OPCOES_TOM, chaveDoPresente, lerQuando, lerTom, modeloDoAniversario,
  nomeDoMes, patchDePresente, quandoPermitido, rotuloDoPresente, type PresenteChave, type QuandoAniversario, type TomAniversario,
} from "./waAutomaticaConfig";
import { renderizar } from "./waMensagem";
import { ModelosEditaveis } from "./ModelosEditaveis";

interface Props {
  companyId: string;
  auto: UseWaAutomaticas;
  lojaNome: string;
}

function diaMes(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function AniversarioConfig({ companyId, auto, lojaNome }: Props) {
  const info = auto.info;
  const lida = info?.autos.aniversario;
  const cfg = lida?.config || {};
  const tom = lerTom(cfg.tom);
  const quando = lerQuando(cfg.quando);
  const presenteChave = chaveDoPresente(cfg.presente);
  const alt = useAlternarAutomatica(auto);
  const [escrevendo, setEscrevendo] = useState(false);

  const pub = useWaPublico(companyId, "aniversario", undefined, lida?.livres ?? null, !!lida, JSON.stringify(cfg));
  const modelos = useWaModelos(companyId, "aniversario", !!lida);

  if (!info || !lida) {
    return (
      <Text style={s.aviso} testID="wa-aniv-indisponivel">
        Não consegui ler o Aniversário agora. Por segurança, nada é ligado nem alterado até eu conseguir.
      </Text>
    );
  }

  const travado = auto.salvando;
  const salvar = (patch: Record<string, any>) => auto.salvarConfig("aniversario", patch);

  // A mensagem como a cliente vê: o modelo do tom e do presente, com a primeira aniversariante.
  const comPresente = presenteChave != null && presenteChave !== "nenhum";
  const modelo = tom && quando ? (modelos.modelos || []).find((m) => m.key === modeloDoAniversario(tom, comPresente, quando)) : null;
  const primeira = pub.corte?.recebem[0]?.nome.split(" ")[0] || undefined;
  // O cupom nasce no dia do aniversário e vale 15 dias; o código é PARABENS-<NOME>.
  const hoje = new Date();
  const validade = diaMes(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 15));
  const codigo = `PARABENS-${semAcento(primeira || "") || "CLIENTE"}`;
  const mensagem = modelo?.texto_em_uso
    ? renderizar(modelo.texto_em_uso, {
        "Nome": primeira, "Nome da loja": lojaNome || undefined,
        "Presente": rotuloDoPresente(cfg.presente) || undefined,
        "Validade": validade, "Código": codigo,
      }, !primeira)
    : null;

  const trazer = quantoTrazer(pub.corte, info.divisao, info.usadas, "aniversario");
  const ligada = lida.ligada;

  if (escrevendo) {
    return (
      <ModelosEditaveis
        companyId={companyId} automatica="aniversario" lojaNome={lojaNome} modelosDoPai={modelos}
        chaves={tom && quando ? [modeloDoAniversario(tom, comPresente, quando)] : []}
        editorDireto onFecharEditor={() => setEscrevendo(false)}
      />
    );
  }

  const primeiroNome = primeira;
  const presente = comPresente && cfg.presente ? { de: primeiroNome || "cliente", rotulo: rotuloDoPresente(cfg.presente) || "", codigo, validade } : null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }} testID="wa-aniv-tela">
      <Superficie variante="glass" raio={30} padding={{ h: 30, v: 8 }} gap={0} style={{ flexGrow: 999, flexShrink: 1, flexBasis: 620, paddingBottom: 26 }}>
        <Passo n="01" titulo="O jeito de falar" primeiro>
          <Pilulas<TomAniversario>
            rotulo="Jeito de falar" idBase="wa-aniv-tom" opcoes={OPCOES_TOM} valor={tom} desabilitado={travado}
            onPick={(v) => salvar({ tom: v })}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 4 }}>
            <Text style={t(13, V.ink3)}>Quer escrever do seu jeito?</Text>
            <Lnk onPress={() => setEscrevendo(true)} testID="wa-aniv-escrever" style={{ minHeight: 32 }}>Escrever a minha</Lnk>
            <Text style={[t(13, V.ink3), { flexBasis: "100%" }]}>A mensagem nova passa pela aprovação do WhatsApp, que costuma levar algumas horas. Até lá vai a escolhida aqui.</Text>
          </View>
        </Passo>

        <Passo n="02" titulo="O presente" sub="O cupom nasce sozinho no dia: um por cliente, vale 15 dias, na loja e no site.">
          <Pilulas<PresenteChave>
            rotulo="Presente" idBase="wa-aniv-presente" opcoes={OPCOES_PRESENTE} valor={presenteChave} desabilitado={travado}
            onPick={(v) => salvar(patchDePresente(v, quando))}
          />
        </Passo>

        <Passo n="03" titulo="Quando sai" sub="Uma mensagem só por aniversário, sempre às 10h. Quem pediu para não receber fica de fora sozinho. Sem presente, só sai no dia.">
          <Pilulas<QuandoAniversario>
            rotulo="Quando sai" idBase="wa-aniv-quando" opcoes={OPCOES_QUANDO} valor={quando} comCheck
            desabilitado={travado || !quando}
            onPick={(v) => { if (quandoPermitido(v, comPresente)) salvar({ quando: v }); }}
          />
          {!comPresente && (
            <Text style={t(13, V.ink3)} testID="wa-aniv-quando-nota">Para sair antes do dia, escolha um presente.</Text>
          )}
        </Passo>

        <CaixaPrevia
          meta={nomeDoMes(null)}
          direita={pub.corte ? `${pub.corte.total} aniversariantes com WhatsApp · 1 mensagem cada` : undefined}
        >
          <PreviaCorteView
            idBase="wa-aniv" companyId={companyId} corte={pub.corte} substantivo="aniversariantes" dono="o Aniversário" estilo="avatares"
            reserva={lida.livres} trazer={trazer} trazendo={travado}
            onTrazer={() => {
              const prox = trazerDoVendaMais(info.divisao, info.usadas, "aniversario", trazer);
              if (prox) auto.aplicarDivisao(prox).then(() => pub.recarregar());
            }}
          />
        </CaixaPrevia>


      </Superficie>

      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, maxWidth: 420, minWidth: 0, gap: 18 }}>
        <BolhaExemplo
          titulo={primeira ? `Como a ${primeira} vê · ${diaMes(hoje)}, 10h` : "Como chega (cliente de exemplo)"} mensagem={mensagem}
          loja={lojaNome} presente={presente}
        />

        <View style={{ gap: 10, alignItems: "flex-start" }}>
          {ligada ? (
            <Superficie variante="dry" raio={24} padding={{ h: 18, v: 14 }} gap={10} style={{ alignSelf: "stretch" }}>
              <View style={s.linha}>
                <View style={{ flex: 1 }}>
                  <Text style={t(15, V.ink, "700")}>Aniversário ligado</Text>
                  <Text style={t(13, V.ink2)}>Desligar é a qualquer hora, e para na mesma hora.</Text>
                </View>
                <Interruptor
                  ligado={ligada} desabilitado={travado} rotulo="Desligar o aniversário"
                  testID="wa-aniv-liga" onToggle={() => alt.alternar("aniversario")}
                />
              </View>
            </Superficie>
          ) : (
            <>
              <BtnPrimario testID="wa-aniv-liga" disabled={travado} onPress={() => alt.alternar("aniversario")}>
                Ligar o aniversário
              </BtnPrimario>
              <Text style={t(13, V.ink3)}>Desligar é a qualquer hora, e para na mesma hora.</Text>
            </>
          )}
          {alt.perguntando === "aniversario" && (
            <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
          )}
          {!!auto.erro && alt.perguntando !== "aniversario" && <Text style={s.erro}>{auto.erro}</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { fontSize: 14, fontWeight: "600", color: V.warn, lineHeight: 20 },
  linha: { flexDirection: "row", alignItems: "center", gap: 10 },
  erro: { fontSize: 13, fontWeight: "600", color: V.bad, lineHeight: 18 },
} as any);
