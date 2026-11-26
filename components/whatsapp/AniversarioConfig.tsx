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
  BolhaExemplo, Interruptor, Passo, PilulaToggle, Pilulas, PreviaCorteView,
} from "./configUi";
import { quantoTrazer, trazerDoVendaMais } from "./waCorte";
import {
  OPCOES_PRESENTE, OPCOES_TOM, alternarPasso, chaveDoPresente, lerPassos, lerTom, modeloDoAniversario,
  nomeDoMes, presenteDaChave, quantosPassos, rotuloDoPresente, type PresenteChave, type TomAniversario,
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
  const passos = lerPassos(cfg.passos);
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
  const modelo = tom ? (modelos.modelos || []).find((m) => m.key === modeloDoAniversario(tom, comPresente)) : null;
  const primeira = pub.corte?.recebem[0]?.nome.split(" ")[0] || undefined;
  const mensagem = modelo?.texto_em_uso
    ? renderizar(modelo.texto_em_uso, {
        "Nome": primeira, "Nome da loja": lojaNome || undefined,
        "Presente": rotuloDoPresente(cfg.presente) || undefined,
      })
    : null;

  const trazer = quantoTrazer(pub.corte, info.divisao, info.usadas, "aniversario");
  const porCliente = passos ? quantosPassos(passos) : null;
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
          onPick={(v) => salvar({ presente: presenteDaChave(v) })}
        />
      </Passo>

      <Passo n="03" titulo="Quando sai" sub="Sempre às 10h. Quem pediu para não receber fica de fora sozinho.">
        <View style={s.pilulas}>
          {([
            ["antes", "Uma semana antes"], ["dia", "No dia"], ["depois", "3 dias depois, se não usou"],
          ] as const).map(([k, rotulo]) => (
            <PilulaToggle
              key={k} rotulo={rotulo} ligada={!!passos?.[k]} desabilitado={travado || !passos}
              testID={`wa-aniv-passo-${k}`}
              onToggle={() => passos && salvar({ passos: alternarPasso(passos, k) })}
            />
          ))}
        </View>
      </Passo>

      <Passo
        titulo={nomeDoMes(null)}
        sub={pub.corte
          ? `${pub.corte.total} aniversariantes com WhatsApp · ${porCliente === 1 ? "1 mensagem cada" : `${porCliente ?? "?"} mensagens cada`}`
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
          chaves={[tom ? modeloDoAniversario(tom, comPresente) : "", "aniv_antes", "aniv_depois"].filter(Boolean)}
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
