// ============================================================
// VendaMaisConfig — o Venda+ (artboard VendaMais), no lugar da Reativação
//
// Chama de volta quem parou de comprar, com um presente. Escolhe o grupo
// (Sumindo: 31 a 60 dias; Sumiu: mais de 60), o presente, vê quantos podem
// receber e quem vai (quem mais compra primeiro), e manda agora — o botão
// nunca manda para mais gente do que cabe, e o servidor refaz o corte.
// "Todo dia 1º, sozinho" é a automática do mês.
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { useWaPublico, useWaModelos } from "@/hooks/useWaAutomatica";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import { BolhaExemplo, Interruptor, Passo, Pilulas } from "./configUi";
import { podeMandarNovidades } from "./waCorte";
import {
  OPCOES_PRESENTE, OPCOES_SEGMENTO, chaveDoPresente, lerSegmento, modeloDaVenda, presenteDaChave,
  rotuloDoPresente, type PresenteChave, type SegmentoVenda,
} from "./waAutomaticaConfig";
import { renderizar } from "./waMensagem";
import { waMesDoSaldo, type SaldoInfo } from "./waSaldo";
import type { WaStatus } from "@/services/waApi";

interface Props {
  companyId: string;
  auto: UseWaAutomaticas;
  saldo: SaldoInfo | null;
  status: WaStatus | null;
  lojaNome: string;
}

export function VendaMaisConfig({ companyId, auto, saldo, status, lojaNome }: Props) {
  const info = auto.info;
  const lida = info?.autos.venda_mais;
  const cfg = lida?.config || {};
  const segmento = lerSegmento(cfg.segmento);
  const presenteChave = chaveDoPresente(cfg.presente);
  const alt = useAlternarAutomatica(auto);

  const pub = useWaPublico(companyId, "venda_mais", segmento || undefined, lida?.livres ?? null, !!lida && !!segmento, JSON.stringify(cfg));
  const modelos = useWaModelos(companyId, "venda_mais", !!lida);

  if (!info || !lida) {
    return (
      <Text style={s.aviso} testID="wa-venda-indisponivel">
        Não consegui ler o Venda+ agora. Por segurança, nada é ligado nem alterado até eu conseguir.
      </Text>
    );
  }

  const travado = auto.salvando;
  const salvar = (patch: Record<string, any>) => auto.salvarConfig("venda_mais", patch);
  const corte = pub.corte;
  const pode = podeMandarNovidades({ aceiteEm: info.aceiteEm, saldo, status, corte });
  const fora = pub.publico?.fora;

  const comPresente = presenteChave != null && presenteChave !== "nenhum";
  const modelo = segmento ? (modelos.modelos || []).find((m) => m.key === modeloDaVenda(segmento, comPresente)) : null;
  const primeira = corte?.recebem[0]?.nome.split(" ")[0] || undefined;
  const mensagem = modelo?.texto_em_uso
    ? renderizar(modelo.texto_em_uso, {
        "Nome": primeira, "Nome da loja": lojaNome || undefined, "Presente": rotuloDoPresente(cfg.presente) || undefined,
      }, !primeira)
    : null;

  const proximoMes = waMesDoSaldo(undefined).proximo;
  const acabou = !!corte && corte.cabem <= 0 && lida.livres === 0;
  const ligadaAuto = cfg.automatico === true;

  return (
    <View style={{ gap: 14 }} testID="wa-venda-tela">
      <Passo titulo="Quem chamar" sub="Escolha o grupo. Quem recebeu novidade há menos de 7 dias, pediu para não receber ou está sem telefone fica de fora sozinho.">
        <Pilulas<SegmentoVenda>
          idBase="wa-venda-segmento" desabilitado={travado} valor={segmento}
          opcoes={OPCOES_SEGMENTO.map((o) => ({ valor: o.valor, rotulo: `${o.rotulo} · ${o.meta}` }))}
          onPick={(v) => salvar({ segmento: v })}
        />
      </Passo>

      <Passo titulo="Presente">
        <Pilulas<PresenteChave>
          idBase="wa-venda-presente" opcoes={OPCOES_PRESENTE} valor={presenteChave} desabilitado={travado}
          onPick={(v) => salvar({ presente: presenteDaChave(v) })}
        />
      </Passo>

      <Passo titulo={corte ? `${corte.total} podem receber` : "Quem recebe"}>
        {!!fora && (
          <Text style={s.sub} testID="wa-venda-fora">
            {fora.recebeu_ha_menos_de_7_dias ?? 0} receberam novidade há menos de 7 dias · {fora.pediu_para_nao_receber ?? 0} pediram
            para não receber · {fora.sem_telefone ?? 0} sem telefone
          </Text>
        )}
        {pub.carregando && !pub.publico && <ActivityIndicator size="small" color={Colors.violet3} />}
        {!corte && !pub.carregando && (
          <Text style={s.aviso} testID="wa-venda-previa-indisponivel">
            Não consegui calcular quem cabe agora. Por segurança, nada é enviado até eu conseguir.
          </Text>
        )}
        {!!corte && (
          <>
            <Text style={s.tituloMenor}>{lida.livres ?? 0} novidades do Venda+ livres</Text>
            {corte.recebem.map((p) => (
              <View key={p.nome} style={s.pessoa} testID="wa-venda-recebe">
                <Text style={s.pessoaNome}>{p.nome}</Text>
                {!!p.detalhe && <Text style={s.pessoaDet}>{p.detalhe}</Text>}
              </View>
            ))}
            {corte.total > corte.cabem && (
              <Text style={s.sub} testID="wa-venda-resto">
                Vão as {corte.cabem} que mais compravam. As outras {corte.total - corte.cabem} ficam guardadas para o mês
                que vem, ou para quando sobrarem novidades.
              </Text>
            )}
          </>
        )}
      </Passo>

      <BolhaExemplo titulo={primeira ? `Como a ${primeira} vê` : "Como chega (cliente de exemplo)"} mensagem={mensagem} />

      <View style={s.card}>
        {!!pub.enviado && (pub.enviado.enfileiradas ?? 0) > 0 ? (
          <Text style={s.ok} testID="wa-venda-enviado">Pronto. Saem hoje entre 10h e 12h.</Text>
        ) : null}
        {acabou ? (
          <Text style={s.sub} testID="wa-venda-acabou">
            O Venda+ deste mês acabou: nada mais sai até 1º de {proximoMes}. Quem voltar a comprar aparece em Clientes com a
            etiqueta "Voltou".
          </Text>
        ) : (
          <>
            <Pressable
              onPress={() => { pub.enviarAgora(); }}
              disabled={!pode.pode || pub.enviando || travado}
              accessibilityRole="button"
              accessibilityState={{ disabled: !pode.pode || pub.enviando || travado }}
              style={[s.btnPrim, (!pode.pode || pub.enviando || travado) && { opacity: 0.45 }]}
              testID="wa-venda-enviar"
            >
              {pub.enviando && <ActivityIndicator size="small" color="#fff" />}
              <Text style={s.btnPrimTxt}>
                {corte ? `Mandar para as ${corte.cabem} que mais compravam` : "Mandar agora"}
              </Text>
            </Pressable>
            <Text style={s.sub} testID="wa-venda-enviar-nota">
              {pode.pode
                ? `Usa ${corte!.cabem} das novidades do Venda+. O botão nunca manda para mais gente do que cabe.`
                : pode.motivo}
            </Text>
          </>
        )}
        {!!pub.erro && <Text style={s.erro} testID="wa-venda-erro">{pub.erro}</Text>}
      </View>

      <View style={s.card}>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Todo dia 1º, sozinho</Text>
            <Text style={s.sub}>Mesmo grupo e presente, até acabar o que é do Venda+.</Text>
          </View>
          <Interruptor
            ligado={ligadaAuto} desabilitado={travado} rotulo="Todo dia 1º, sozinho"
            testID="wa-venda-auto" onToggle={() => salvar({ automatico: !ligadaAuto })}
          />
        </View>
        <View style={s.linha}>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Venda+ {lida.ligada ? "ligado" : "desligado"}</Text>
          </View>
          <Interruptor
            ligado={lida.ligada} desabilitado={travado}
            rotulo={(lida.ligada ? "Desligar" : "Ligar") + " o Venda+"}
            testID="wa-venda-liga" onToggle={() => alt.alternar("venda_mais")}
          />
        </View>
        {alt.perguntando === "venda_mais" && (
          <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
        )}
        {!!auto.erro && alt.perguntando !== "venda_mais" && <Text style={s.erro}>{auto.erro}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  linha: { flexDirection: "row", alignItems: "center", gap: 10 },
  titulo: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  tituloMenor: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  ok: { fontSize: 12.5, fontWeight: "700", color: Colors.green },
  erro: { fontSize: 12, fontWeight: "600", color: Colors.red, lineHeight: 17 },
  pessoa: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  pessoaNome: { fontSize: 12.5, fontWeight: "700", color: Colors.ink },
  pessoaDet: { fontSize: 11.5, color: Colors.ink3 },
  btnPrim: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48,
    backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 16,
  },
  btnPrimTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
} as any);
