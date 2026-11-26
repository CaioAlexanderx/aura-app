// ============================================================
// AniversarioConfig — a tela do Aniversário (artboard Aniversario)
//
// 01 o jeito de falar · 02 o presente · 03 quando sai · prévia "Cabem N de
// M aniversariantes" (quem fica de fora apagado; "Trazer N do Venda+") ·
// a mensagem como a cliente vê · ligar/desligar.
// Cada toque grava no servidor e a tela relê (nada otimista).
// ============================================================
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { useWaPublico, useWaModelos } from "@/hooks/useWaAutomatica";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import {
  BolhaExemplo, Interruptor, Passo, Pilulas, PreviaCorteView,
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

export function AniversarioConfig({ companyId, auto, lojaNome }: Props) {
  const info = auto.info;
  const lida = info?.autos.aniversario;
  const cfg = lida?.config || {};
  const tom = lerTom(cfg.tom);
  const quando = lerQuando(cfg.quando);
  const presenteChave = chaveDoPresente(cfg.presente);
  const alt = useAlternarAutomatica(auto);

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
  const mensagem = modelo?.texto_em_uso
    ? renderizar(modelo.texto_em_uso, {
        "Nome": primeira, "Nome da loja": lojaNome || undefined,
        "Presente": rotuloDoPresente(cfg.presente) || undefined,
      })
    : null;

  const trazer = quantoTrazer(pub.corte, info.divisao, info.usadas, "aniversario");
  const ligada = lida.ligada;

  return (
    <View style={{ gap: 14 }} testID="wa-aniv-tela">
      <Passo n="01" titulo="O jeito de falar">
        <Pilulas<TomAniversario>
          idBase="wa-aniv-tom" opcoes={OPCOES_TOM} valor={tom} desabilitado={travado}
          onPick={(v) => salvar({ tom: v })}
        />
      </Passo>

      <Passo n="02" titulo="O presente" sub="O cupom nasce sozinho no dia: um por cliente, vale 15 dias, na loja e no site.">
        <Pilulas<PresenteChave>
          idBase="wa-aniv-presente" opcoes={OPCOES_PRESENTE} valor={presenteChave} desabilitado={travado}
          onPick={(v) => salvar(patchDePresente(v, quando))}
        />
      </Passo>

      <Passo n="03" titulo="Quando sai" sub="Uma mensagem só por aniversário, sempre às 10h. Quem pediu para não receber fica de fora sozinho. Sem presente, só sai no dia.">
        <Pilulas<QuandoAniversario>
          idBase="wa-aniv-quando" opcoes={OPCOES_QUANDO} valor={quando}
          desabilitado={travado || !quando}
          onPick={(v) => { if (quandoPermitido(v, comPresente)) salvar({ quando: v }); }}
        />
        {!comPresente && (
          <Text style={s.sub} testID="wa-aniv-quando-nota">Para sair antes do dia, escolha um presente.</Text>
        )}
      </Passo>

      <Passo
        titulo={nomeDoMes(null)}
        sub={pub.corte
          ? `${pub.corte.total} aniversariantes com WhatsApp · 1 mensagem cada`
          : undefined}
      >
        <PreviaCorteView
          idBase="wa-aniv" corte={pub.corte} substantivo="aniversariantes" dono="o Aniversário"
          reserva={lida.livres} trazer={trazer} trazendo={travado}
          onTrazer={() => {
            const prox = trazerDoVendaMais(info.divisao, info.usadas, "aniversario", trazer);
            if (prox) auto.aplicarDivisao(prox).then(() => pub.recarregar());
          }}
        />
      </Passo>

      <BolhaExemplo titulo="Como a cliente vê" mensagem={mensagem} />

      <Passo
        titulo="Quer escrever do seu jeito?"
        sub="A mensagem nova passa pela aprovação do WhatsApp, que costuma levar algumas horas. Até lá vai a escolhida aqui."
      >
        <ModelosEditaveis
          companyId={companyId} automatica="aniversario" lojaNome={lojaNome} modelosDoPai={modelos}
          chaves={tom && quando ? [modeloDoAniversario(tom, comPresente, quando)] : []}
        />
      </Passo>

      <View style={s.card}>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Ligar o aniversário</Text>
            <Text style={s.sub}>Desligar é a qualquer hora, e para na mesma hora.</Text>
          </View>
          <Interruptor
            ligado={ligada} desabilitado={travado} rotulo={(ligada ? "Desligar" : "Ligar") + " o aniversário"}
            testID="wa-aniv-liga" onToggle={() => alt.alternar("aniversario")}
          />
        </View>
        {alt.perguntando === "aniversario" && (
          <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
        )}
        {!!auto.erro && alt.perguntando !== "aniversario" && <Text style={s.erro}>{auto.erro}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  linha: { flexDirection: "row", alignItems: "center", gap: 10 },
  titulo: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  erro: { fontSize: 12, fontWeight: "600", color: Colors.red, lineHeight: 17 },
  pilulas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
} as any);
