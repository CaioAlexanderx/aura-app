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
import { Avatar, Meta, Superficie, BtnPrimario, V, WEB, t } from "./waVidro";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { useWaPublico, useWaModelos } from "@/hooks/useWaAutomatica";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import { BolhaExemplo, Interruptor, Pilulas } from "./configUi";
import { podeMandarNovidades } from "./waCorte";
import {
  OPCOES_PRESENTE, OPCOES_SEGMENTO, chaveDoPresente, lerSegmento, modeloDaVenda, presenteDaChave,
  rotuloDoPresente, type PresenteChave, type SegmentoVenda,
} from "./waAutomaticaConfig";
import { renderizar } from "./waMensagem";
import { ModelosEditaveis } from "./ModelosEditaveis";
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

  const totalVenda = info.divisao.venda_mais ?? 0;
  const usadasVenda = info.usadas.venda_mais ?? 0;
  const livresVenda = lida.livres ?? 0;
  const DESC_SEG: Record<string, string> = { sumindo: "A melhor hora de chamar.", sumiu: "Precisa de um presente maior." };

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }} testID="wa-venda-tela">
      <Superficie variante="glass" raio={30} padding={{ h: 30, v: 26 }} gap={22} style={{ flexGrow: 999, flexShrink: 1, flexBasis: 640 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {OPCOES_SEGMENTO.map((o) => {
            const on = o.valor === segmento;
            return (
              <Pressable
                key={o.valor}
                onPress={() => salvar({ segmento: o.valor })}
                disabled={travado}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: travado }}
                testID={`wa-venda-segmento-${o.valor}`}
                style={[{
                  flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, gap: 6, paddingHorizontal: 22, paddingVertical: 20,
                  borderRadius: 26, borderWidth: 1, borderColor: on ? V.lineOn : V.line,
                  backgroundColor: on ? V.on : V.fill, opacity: travado ? 0.6 : 1,
                } as any, WEB && on ? ({ backgroundImage: "linear-gradient(160deg,rgba(167,139,250,.24),rgba(124,58,237,.1))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)" } as any) : null]}
              >
                <Meta>{o.meta}</Meta>
                <Text style={t(24, V.ink, "800", { letterSpacing: -0.7, lineHeight: 28 })}>{o.rotulo}</Text>
                <Text style={t(14, V.ink2)}>
                  {on && corte ? `${corte.total} clientes. ` : ""}{DESC_SEG[o.valor] || ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={t(17, V.ink, "700")}>Presente</Text>
          <Pilulas<PresenteChave>
            idBase="wa-venda-presente" opcoes={OPCOES_PRESENTE} valor={presenteChave} desabilitado={travado}
            onPick={(v) => salvar({ presente: presenteDaChave(v) })}
          />
        </View>

        <Superficie variante="dry" raio={24} padding={{ h: 20, v: 18 }} gap={14}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={t(15, V.ink2)}>
              <Text style={t(15, V.ink, "700")}>{corte ? `${corte.total} podem receber` : "Quem recebe"}</Text>
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={`${livresVenda} novidades do Venda+ livres`}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {Array.from({ length: Math.max(0, totalVenda) }).map((_, i) => {
                  const usada = i < usadasVenda;
                  return (
                    <View
                      key={i}
                      style={[{ width: 12, height: 26, borderRadius: 999, backgroundColor: usada ? V.track : "#f9a8d4" } as any,
                        WEB && !usada ? ({ backgroundImage: "linear-gradient(180deg,#fde7f3,#f9a8d4)", boxShadow: "0 0 9px rgba(249,168,212,.55)" } as any) : null]}
                    />
                  );
                })}
              </View>
              <Text style={t(14, V.ink2)} testID="wa-venda-livres">{livresVenda} livres</Text>
            </View>
          </View>

          {!!fora && (
            <Text style={t(14, V.ink2)} testID="wa-venda-fora">
              {fora.recebeu_ha_menos_de_7_dias ?? 0} receberam novidade há menos de 7 dias · {fora.pediu_para_nao_receber ?? 0} pediram
              para não receber · {fora.sem_telefone ?? 0} sem telefone
            </Text>
          )}
          {pub.carregando && !pub.publico && <ActivityIndicator size="small" color={V.acc} />}
          {!corte && !pub.carregando && (
            <Text style={s.aviso} testID="wa-venda-previa-indisponivel">
              Não consegui calcular quem cabe agora. Por segurança, nada é enviado até eu conseguir.
            </Text>
          )}
          {!!corte && (
            <>
              <Text style={t(15, V.ink, "700")}>{livresVenda} novidades do Venda+ livres</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {corte.recebem.map((p) => (
                  <View
                    key={p.nome} testID="wa-venda-recebe"
                    style={{
                      flexGrow: 1, flexBasis: 240, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8,
                      borderRadius: 16, borderWidth: 1, borderColor: "rgba(249,168,212,.28)", backgroundColor: "rgba(249,168,212,.1)",
                    }}
                  >
                    <Avatar nome={p.nome} cor="#f9d0e6" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={t(14, V.ink, "700")}>{p.nome}</Text>
                      {!!p.detalhe && <Text style={t(12, V.ink2)}>{p.detalhe}</Text>}
                    </View>
                  </View>
                ))}
              </View>
              {corte.total > corte.cabem && (
                <Text style={t(14, V.ink2)} testID="wa-venda-resto">
                  Vão as {corte.cabem} que mais compravam. As outras {corte.total - corte.cabem} ficam guardadas para o mês
                  que vem, ou para quando sobrarem novidades.
                </Text>
              )}
            </>
          )}
        </Superficie>

        <View>
          <Text style={t(13, V.ink3)}>
            Quem recebeu novidade há menos de 7 dias, pediu para não receber ou está sem telefone fica de fora sozinho.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={t(17, V.ink, "700")}>Quer escrever do seu jeito?</Text>
          <Text style={t(13, V.ink3)}>
            A mensagem nova passa pela aprovação do WhatsApp, que costuma levar algumas horas. Até lá vai a escolhida aqui.
          </Text>
          <ModelosEditaveis
            companyId={companyId} automatica="venda_mais" lojaNome={lojaNome} modelosDoPai={modelos}
            chaves={segmento ? [modeloDaVenda(segmento, comPresente)] : []}
          />
        </View>
      </Superficie>

      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, maxWidth: 420, minWidth: 0, gap: 18 }}>
        <BolhaExemplo
          titulo={primeira ? `Como a ${primeira} vê` : "Como chega (cliente de exemplo)"} mensagem={mensagem} loja={lojaNome}
        />

        {!!pub.enviado && (pub.enviado.enfileiradas ?? 0) > 0 ? (
          <Superficie variante="dry" raio={24} padding={{ h: 18, v: 16 }} gap={6}>
            <Text style={t(17, V.ok, "700")} testID="wa-venda-enviado">Pronto. Saem hoje entre 10h e 12h.</Text>
          </Superficie>
        ) : null}
        {acabou ? (
          <Superficie variante="dry" raio={24} padding={{ h: 18, v: 16 }} gap={6}>
            <Text style={t(14, V.ink2)} testID="wa-venda-acabou">
              O Venda+ deste mês acabou: nada mais sai até 1º de {proximoMes}. Quem voltar a comprar aparece em Clientes com a
              etiqueta "Voltou".
            </Text>
          </Superficie>
        ) : (
          <View style={{ gap: 10, alignItems: "flex-start" }}>
            <BtnPrimario
              onPress={() => { pub.enviarAgora(); }}
              disabled={!pode.pode || pub.enviando || travado}
              carregando={pub.enviando}
              testID="wa-venda-enviar"
            >
              {corte ? `Mandar para as ${corte.cabem} que mais compravam` : "Mandar agora"}
            </BtnPrimario>
            <Text style={t(13, V.ink3)} testID="wa-venda-enviar-nota">
              {pode.pode
                ? `Usa ${corte!.cabem} das novidades do Venda+. O botão nunca manda para mais gente do que cabe.`
                : pode.motivo}
            </Text>
          </View>
        )}
        {!!pub.erro && <Text style={s.erro} testID="wa-venda-erro">{pub.erro}</Text>}

        <Superficie variante="dry" raio={24} padding={{ h: 18, v: 14 }} gap={12}>
          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={t(15, V.ink, "700")}>Todo dia 1º, sozinho</Text>
              <Text style={t(13, V.ink2)}>mesmo grupo e presente, até acabar o que é do Venda+</Text>
            </View>
            <Interruptor
              ligado={ligadaAuto} desabilitado={travado} rotulo="Todo dia 1º, sozinho"
              testID="wa-venda-auto" onToggle={() => salvar({ automatico: !ligadaAuto })}
            />
          </View>
          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={t(15, V.ink, "700")}>Venda+ {lida.ligada ? "ligado" : "desligado"}</Text>
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
        </Superficie>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aviso: { fontSize: 14, fontWeight: "600", color: V.warn, lineHeight: 20 },
  linha: { flexDirection: "row", alignItems: "center", gap: 12 },
  erro: { fontSize: 13, fontWeight: "600", color: V.bad, lineHeight: 18 },
} as any);