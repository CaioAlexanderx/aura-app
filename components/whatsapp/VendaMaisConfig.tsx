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
import { animVai, Avatar, Meta, Superficie, BtnPrimario, V, WEB, t } from "./waVidro";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { useWaPublico, useWaModelos } from "@/hooks/useWaAutomatica";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import { BolhaExemplo, Interruptor, LinkPacote, Pilulas } from "./configUi";
import { podeMandarNovidades } from "./waCorte";
import {
  OPCOES_PRESENTE, OPCOES_SEGMENTO, chaveDoPresente, lerSegmento, modeloDaVenda, presenteDaChave,
  rotuloDoPresente, type PresenteChave, type SegmentoVenda,
} from "./waAutomaticaConfig";
import { renderizar } from "./waMensagem";
import { useSetas } from "./waTeclado";
import { mesPorExtenso } from "./waRotulos";
import { pluralize } from "@/utils/plural";
import { waMesDoSaldo, type SaldoInfo } from "./waSaldo";
import type { WaStatus } from "@/services/waApi";

interface Props {
  companyId: string;
  auto: UseWaAutomaticas;
  saldo: SaldoInfo | null;
  status: WaStatus | null;
  lojaNome: string;
}

/** "1 pediu" / "2 pediram". */
function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function VendaMaisConfig({ companyId, auto, saldo, status, lojaNome }: Props) {
  const info = auto.info;
  const lida = info?.autos.venda_mais;
  const cfg = lida?.config || {};
  const segmento = lerSegmento(cfg.segmento);
  const presenteChave = chaveDoPresente(cfg.presente);
  const alt = useAlternarAutomatica(auto);
  // Sumindo / Sumiu: escolha única (radiogroup); as setas movem e escolhem.
  const setasSeg = useSetas({
    qtd: OPCOES_SEGMENTO.length, ativo: OPCOES_SEGMENTO.findIndex((o) => o.valor === segmento), ativarAoMover: true,
    desabilitados: auto.salvando ? OPCOES_SEGMENTO.map(() => true) : undefined,
    aoMover: (i) => { if (!auto.salvando) auto.salvarConfig("venda_mais", { segmento: OPCOES_SEGMENTO[i].valor }); },
  });

  const pub = useWaPublico(companyId, "venda_mais", segmento || undefined, lida?.livres ?? null, !!lida && !!segmento, JSON.stringify(cfg));
  // O outro grupo também mostra a contagem ("18 clientes" / "23 clientes").
  const outroSeg: SegmentoVenda = segmento === "sumiu" ? "sumindo" : "sumiu";
  const pubOutro = useWaPublico(companyId, "venda_mais", outroSeg, lida?.livres ?? null, !!lida && !!segmento, JSON.stringify(cfg));
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
  const corteBruto = pub.corte;
  const fora: any = pub.publico?.fora;

  const comPresente = presenteChave != null && presenteChave !== "nenhum";
  const modelo = segmento ? (modelos.modelos || []).find((m) => m.key === modeloDaVenda(segmento, comPresente)) : null;
  // O texto aprovado nunca perde o trecho da última compra: quem não tem a peça (e o mês) não entra na lista
  // e conta em "ficam de fora · sem a peça da última compra" (o servidor manda o motivo SEM_PECA_ULTIMA_COMPRA).
  const textoDoModelo = modelo?.texto_em_uso || "";
  const exigePeca = /\{Última compra\}/.test(textoDoModelo);
  const exigeMes = /\{Mês da última compra\}/.test(textoDoModelo);
  const mesDe = (p: { mesUltimaCompra?: string; ultimaCompra?: string }) => mesPorExtenso(p.mesUltimaCompra) || mesPorExtenso(p.ultimaCompra);
  const completa = (p: { ultimaPeca?: string; mesUltimaCompra?: string; ultimaCompra?: string }) => (!exigePeca || !!p.ultimaPeca) && (!exigeMes || !!mesDe(p));
  const semPecaLocal = corteBruto ? [...corteBruto.recebem, ...corteBruto.ficam].filter((p) => !completa(p)).length : 0;
  const foraSemPeca = (Number(fora?.sem_peca_ultima_compra) || 0) + semPecaLocal;
  const corte = corteBruto
    ? (() => {
        const ok = corteBruto.recebem.filter(completa);
        return { ...corteBruto, recebem: ok, ficam: corteBruto.ficam.filter(completa), total: Math.max(0, corteBruto.total - semPecaLocal), cabem: Math.min(corteBruto.cabem, ok.length) };
      })()
    : corteBruto;
  const pode = corte && corte.cabem <= 0 && semPecaLocal > 0
    ? { pode: false, motivo: "Nenhuma cliente com a peça da última compra para mandar agora." }
    : podeMandarNovidades({ aceiteEm: info.aceiteEm, saldo, status, corte });
  const primeira = corte?.recebem[0]?.nome.split(" ")[0] || undefined;
  // O presente vale 15 dias a partir do envio.
  const hoje = new Date();
  const validade = (() => { const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 15); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  // `{Última compra}` é a peça (`ultima_peca`) e `{Mês da última compra}` o nome do mês ("agosto").
  // A prévia usa a primeira cliente completa; sem nenhuma, o exemplo (marcado como exemplo).
  const primeiraPessoa = corte?.recebem[0];
  const peca = primeiraPessoa?.ultimaPeca;
  const mesCompra = primeiraPessoa ? mesDe(primeiraPessoa) : null;
  const mensagem = modelo?.texto_em_uso
    ? renderizar(textoDoModelo, {
        "Nome": primeira, "Nome da loja": lojaNome || undefined, "Presente": rotuloDoPresente(cfg.presente) || undefined,
        "Validade": validade,
        "Última compra": peca,
        "Mês da última compra": mesCompra || undefined,
      }, !primeira)
    : null;

  const proximoMes = waMesDoSaldo(undefined).proximo;
  const acabou = !!corte && corte.cabem <= 0 && lida.livres === 0;
  const ligadaAuto = cfg.automatico === true;

  const totalVenda = info.divisao.venda_mais ?? 0;
  const usadasVenda = info.usadas.venda_mais ?? 0;
  const livresVenda = lida.livres ?? 0;
  const contagem = (n: number | null | undefined) => (typeof n === "number" ? `${n} ${n === 1 ? "cliente" : "clientes"}. ` : "");
  const DESC_SEG: Record<string, string> = { sumindo: "A melhor hora de chamar.", sumiu: "Precisa de um presente maior." };

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }} testID="wa-venda-tela">
      <Superficie variante="glass" raio={30} padding={{ h: 30, v: 26 }} gap={22} style={{ flexGrow: 999, flexShrink: 1, flexBasis: 640 }}>
        <View accessibilityRole="radiogroup" aria-label="Quem chamar" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {OPCOES_SEGMENTO.map((o, idx) => {
            const on = o.valor === segmento;
            const nav = setasSeg.propsDoItem(idx);
            return (
              <Pressable
                key={o.valor}
                ref={nav.innerRef as any}
                {...({ tabIndex: nav.tabIndex, onKeyDown: nav.onKeyDown, onFocus: nav.onFocus, "aria-checked": on } as any)}
                onPress={() => salvar({ segmento: o.valor })}
                disabled={travado}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, selected: on, disabled: travado }}
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
                  {contagem(o.valor === segmento ? corte?.total : pubOutro.corte?.total)}{DESC_SEG[o.valor] || ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={t(17, V.ink, "700")}>Presente</Text>
          <Pilulas<PresenteChave>
            rotulo="Presente" idBase="wa-venda-presente" opcoes={OPCOES_PRESENTE} valor={presenteChave} desabilitado={travado}
            onPick={(v) => salvar({ presente: presenteDaChave(v) })}
          />
        </View>

        <Superficie variante="dry" raio={24} padding={{ h: 20, v: 18 }} gap={14}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={t(15, V.ink2)}>
              <Text style={t(15, V.ink, "700")}>{corte ? (corte.total === 1 ? "1 pode receber" : `${corte.total} podem receber`) : "Quem recebe"}</Text>
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={`${pluralize(livresVenda, "novidade")} do Venda+ ${livresVenda === 1 ? "livre" : "livres"}`}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {Array.from({ length: Math.max(0, totalVenda) }).map((_, i) => {
                  const usada = i < usadasVenda;
                  // depois de mandar, as cápsulas que viraram mensagem saem (vai)
                  const foi = !!pub.enviado && (pub.enviado.enfileiradas ?? 0) > 0 && !usada && i - usadasVenda < (pub.enviado.enfileiradas ?? 0);
                  return (
                    <View
                      key={i}
                      style={[{ width: 12, height: 26, borderRadius: 999, backgroundColor: usada ? V.track : "#f9a8d4" } as any,
                        WEB && !usada ? ({ backgroundImage: "linear-gradient(180deg,#fde7f3,#f9a8d4)", boxShadow: "0 0 9px rgba(249,168,212,.55)" } as any) : null, foi ? animVai(i - usadasVenda) : null]}
                    />
                  );
                })}
              </View>
              <Text style={t(14, V.ink2)} testID="wa-venda-livres">{livresVenda === 1 ? "1 livre" : `${livresVenda} livres`}</Text>
            </View>
          </View>

          {(!!fora || foraSemPeca > 0) && (
            <Text style={t(14, V.ink2)} testID="wa-venda-fora">
              {plural(fora?.recebeu_ha_menos_de_7_dias ?? 0, "recebeu", "receberam")} novidade há menos de 7 dias · {plural(fora?.pediu_para_nao_receber ?? 0, "pediu", "pediram")}{" "}
              para não receber · {fora?.sem_telefone ?? 0} sem telefone{foraSemPeca > 0 ? ` · ${foraSemPeca} sem a peça da última compra` : ""}
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
              <Text style={t(15, V.ink, "700")}>{pluralize(livresVenda, "novidade")} do Venda+ {livresVenda === 1 ? "livre" : "livres"}</Text>
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
              {corte.total > corte.cabem && !!companyId && <LinkPacote companyId={companyId} />}
              {corte.total > corte.cabem && (
                <Text style={t(14, V.ink2)} testID="wa-venda-resto">
                  {corte.cabem === 0
                    ? (corte.total === 1 ? "A cliente fica guardada" : `As ${corte.total} ficam guardadas`)
                    : `${corte.cabem === 1 ? "Vai 1 cliente, a que mais comprava." : `Vão as ${corte.cabem} que mais compravam.`} ${corte.total - corte.cabem === 1 ? "A outra fica guardada" : `As outras ${corte.total - corte.cabem} ficam guardadas`}`}{" "}
                  para o mês que vem, ou para quando sobrarem novidades.
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

      </Superficie>

      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, maxWidth: 420, minWidth: 0, gap: 18 }}>
        <BolhaExemplo
          titulo={primeira ? `Como chega para ${primeira}` : "Como chega (cliente de exemplo)"} mensagem={mensagem} loja={lojaNome}
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
              rotuloCurto={corte && corte.cabem > 0 ? (corte.cabem === 1 ? `Mandar para ${primeira}` : `Mandar para as ${corte.cabem}`) : undefined}
              onPress={() => { pub.enviarAgora(); }}
              disabled={!pode.pode || pub.enviando || travado}
              carregando={pub.enviando}
              testID="wa-venda-enviar"
            >
              {corte && corte.cabem > 0 ? (corte.cabem === 1 && primeira ? `Mandar para ${primeira}` : `Mandar para as ${corte.cabem} que mais compravam`) : "Mandar agora"}
            </BtnPrimario>
            <Text style={t(13, V.ink3)} testID="wa-venda-enviar-nota">
              {pode.pode
                ? `Usa ${pluralize(corte!.cabem, "novidade")} do Venda+. O botão nunca manda para mais gente do que cabe.`
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
              ligado={lida.ligada && ligadaAuto} desabilitado={travado} rotulo="Mandar sozinho todo dia 1º"
              testID="wa-venda-auto"
              onToggle={async () => {
                // Um interruptor só: ligar = Venda+ ligado e todo dia 1º; desligar = os dois.
                if (lida.ligada && ligadaAuto) {
                  await salvar({ automatico: false });
                  if (lida.ligada) await alt.alternar("venda_mais");
                  return;
                }
                if (!ligadaAuto) await salvar({ automatico: true });
                if (!lida.ligada) await alt.alternar("venda_mais");
              }}
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