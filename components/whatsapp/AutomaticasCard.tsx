// ============================================================
// AutomaticasCard — "Mensagens que trabalham sozinhas"
//
// 1. A divisão das novidades do mês: cada automática (Aniversário, Venda+,
//    oferta do Crediário) tem um dono para cada novidade. + e − por
//    automática; o + trava quando não sobra novidade sem dono e o − trava
//    no que já foi usado. O servidor recusa o que a tela deixasse passar.
// 2. Um cartão por automática, com o liga/desliga. Ao ligar uma que gasta
//    novidades sem o aceite gravado, a pergunta: "Seus clientes aceitaram
//    receber novidades da loja pelo WhatsApp?" (uma vez só).
// 3. As cobranças do crediário usam os AVISOS, não as novidades.
//
// Sem as automáticas lidas do servidor, tudo trava.
// ============================================================
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { animCai, Lnk, Meta, Passo44, Superficie, Sw, V, t } from "./waVidro";

import { LinkPacote } from "./configUi";
import { nomeDoMes } from "./waAutomaticaConfig";
import { Icon } from "@/components/Icon";
import type { WaAutoKey } from "@/services/waConfigApi";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { AceiteNovidadesPergunta, useAlternarAutomatica } from "@/hooks/useAlternarAutomatica";
import {
  AUTOMATICA_DA_PARTE, AUTO_KEYS, COR_AUTO, ROTULO_AUTO, podeDarMais, podeTirar, semDono,
} from "./waDivisao";

interface Props {
  auto: UseWaAutomaticas;
  /** Para o link de adicionar novidades quando a divisão está cheia. */
  companyId?: string | null;
  /** Abre a configuração da automática (Aniversário, Venda+, Crediário). */
  onAjustar?: (key: WaAutoKey) => void;
}

const DESC: Record<WaAutoKey, { titulo: string; desc: string; linhas: string[]; cor: string }> = {
  aniversario: {
    titulo: "Aniversário", cor: COR_AUTO.aniversario,
    desc: "Manda parabéns, com ou sem presente.",
    linhas: ["Sai às 10h: no dia, 3 dias antes ou na semana, você escolhe", "Sem presente, só no dia", "Quem pediu para não receber fica de fora"],
  },
  venda_mais: {
    titulo: "Venda+", cor: COR_AUTO.venda_mais,
    desc: "Chama de volta quem parou de comprar.",
    linhas: ["Começa por quem mais comprava", "Quem pediu para não receber fica de fora"],
  },
  crediario_vender: {
    titulo: "Crediário: vender", cor: COR_AUTO.crediario,
    desc: "Oferta para quem paga em dia e tem limite livre.",
    linhas: ["Uma vez por mês", "Começa por quem tem mais limite livre"],
  },
  crediario_cobrar: {
    titulo: "Crediário: cobrar", cor: Colors.violet3,
    desc: "Avisa as parcelas que vencem. Usa os avisos do mês, não as novidades.",
    linhas: ["Se os avisos acabarem, a cobrança passa para o seu WhatsApp, de graça"],
  },
};

const ORDEM: WaAutoKey[] = ["aniversario", "venda_mais", "crediario_vender", "crediario_cobrar"];

export function AutomaticasCard({ auto, companyId, onAjustar }: Props) {
  const info = auto.info;
  const alt = useAlternarAutomatica(auto);
  // Onde foi o último toque: a frase de erro do servidor aparece NESSE cartão
  // (ao lado do interruptor ou do + e −), nunca num rodapé distante.
  const [ultimo, setUltimo] = useState<string | null>(null);

  if (auto.carregando && !info) {
    return (
      <Superficie variante="glass" raio={30} padding={26} testID="wa-auto-carregando">
        <ActivityIndicator size="small" color={V.acc} />
      </Superficie>
    );
  }

  if (!info) {
    return (
      <Superficie variante="glass" raio={30} padding={26} gap={10} testID="wa-auto-indisponivel">
        <View style={s.linha}>
          <Icon name="alert" size={13} color={V.warn} />
          <Text style={s.aviso}>
            Não consegui ler as mensagens automáticas agora. Por segurança, nada é ligado nem
            alterado até eu conseguir.
          </Text>
        </View>
        <Lnk onPress={() => { auto.recarregar(); }} testID="wa-auto-tentar-de-novo">Tentar de novo</Lnk>
      </Superficie>
    );
  }
  const total = info.total;
  const livres = semDono(info.divisao, total);
  // "livres" do mockup = novidades que ainda não foram usadas (igual ao topo), não as sem dono.
  const usadasTotal = AUTO_KEYS.reduce((acc, k) => acc + (info.usadas[k] || 0), 0);
  const livresTotal = Math.max(0, total - usadasTotal);
  const travado = auto.salvando;

  // Um quadradinho por novidade: da cor do dono, apagado se já foi usada, vazio se sem dono.
  const caps: { key: string; cor: string; usada: boolean; livre: boolean }[] = [];
  AUTO_KEYS.forEach((k) => {
    for (let j = 0; j < info.divisao[k]; j++) {
      caps.push({ key: `${k}-${j}`, cor: COR_AUTO[k], usada: j < info.usadas[k], livre: false });
    }
  });
  for (let j = 0; j < Math.max(0, livres); j++) caps.push({ key: `livre-${j}`, cor: "transparent", usada: false, livre: true });

  const cartoes = ORDEM.filter((k) => k !== "crediario_cobrar");

  return (
    <View style={{ gap: 28 }} testID="wa-auto-bloco">
      <Superficie variante="glass" raio={30} padding={{ h: 30, v: 26 }} gap={20} testID="wa-auto-divisao" tour="wa.divisao">
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <View style={{ gap: 4, flexShrink: 1, flexGrow: 1, flexBasis: 300 }}>
            <Meta>{nomeDoMes(info.mes)} · {total} novidades no seu plano</Meta>
            <Text style={t(28, V.ink, "800", { letterSpacing: -0.9, lineHeight: 32 })}>
              Cada novidade tem um dono<Text style={{ color: V.acc2 }}>.</Text>
            </Text>
            <Text style={[t(15, V.ink2), { maxWidth: 740 }]}>
              A Aura já dividiu as {total}. Mude com + e −; a soma nunca passa do que o plano tem. A
              parte apagada de cada cor já foi usada.
            </Text>
          </View>
          <Text style={t(15, V.ink2)} testID="wa-auto-livres">
            <Text style={t(22, V.ink, "800")}>{livresTotal}</Text> {livresTotal === 1 ? "livre" : "livres"} de {total}
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityLabel={`Das ${total} novidades: ` + AUTO_KEYS.map((k) => `${ROTULO_AUTO[k]} ${info.divisao[k]}`).join(", ")}>
          {caps.map((c, i) => (
            <View
              key={c.key}
              style={[{ width: 22, height: 40, borderRadius: 999 } as any,
                c.livre
                  ? { backgroundColor: V.capFree, borderWidth: 1.5, borderStyle: "dashed", borderColor: V.capFreeLine }
                  : { backgroundColor: c.cor },
                c.usada && { opacity: 0.32 }, animCai(i)]}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {AUTO_KEYS.map((k) => {
            const menos = !travado && podeTirar(info.divisao, info.usadas, k);
            const mais = !travado && podeDarMais(info.divisao, k, total);
            return (
              <Superficie key={k} variante="dry" raio={22} padding={{ h: 16, v: 14 }} gap={10} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 240 }}>
                <View testID={`wa-auto-divisao-${k}`} style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: COR_AUTO[k] }} />
                    <Text style={t(15, V.ink, "700")}>{ROTULO_AUTO[k]}</Text>
                  </View>
                  <Text style={t(13, V.ink2, "400", { minHeight: 38 })}>{DESC_DIVISAO[k]}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Passo44
                      simbolo="−" rotulo={`Tirar 1 de ${ROTULO_AUTO[k]}`} disabled={!menos}
                      onPress={() => { setUltimo("divisao"); auto.ajustar(k, -1); }} testID={`wa-auto-menos-${k}`}
                    />
                    <View
                      testID={`wa-auto-valor-${k}`}
                      style={{ alignItems: "center" }}
                      {...({
                        role: "spinbutton", tabIndex: travado ? -1 : 0,
                        "aria-label": `Novidades de ${ROTULO_AUTO[k]}`, "aria-valuenow": info.divisao[k],
                        "aria-valuemin": info.usadas[k], "aria-valuemax": info.divisao[k] + Math.max(0, livres),
                        "aria-valuetext": `${info.divisao[k]} novidades, ${info.usadas[k]} já usadas`,
                        // ↑ ↓ mudam o valor (as mesmas travas do + e do −)
                        onKeyDown: (e: any) => {
                          if (e?.key === "ArrowUp" && mais) { e.preventDefault?.(); setUltimo("divisao"); auto.ajustar(k, 1); }
                          else if (e?.key === "ArrowDown" && menos) { e.preventDefault?.(); setUltimo("divisao"); auto.ajustar(k, -1); }
                        },
                      } as any)}
                    >
                      <Text style={t(24, V.ink, "800", { lineHeight: 26 })} testID={`wa-auto-n-${k}`}>{info.divisao[k]}</Text>
                      <Text style={t(12, V.ink3)}>{info.usadas[k] === 1 ? "1 usada" : `${info.usadas[k]} usadas`}</Text>
                    </View>
                    <Passo44
                      simbolo="+" rotulo={`Dar mais 1 para ${ROTULO_AUTO[k]}`} disabled={!mais}
                      onPress={() => { setUltimo("divisao"); auto.ajustar(k, 1); }} testID={`wa-auto-mais-${k}`}
                    />
                  </View>
                </View>
              </Superficie>
            );
          })}
        </View>
        {livres <= 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 0 }}>
            <Text style={t(14, V.ink2)}>
              <Text style={t(14, V.warn, "700")}>As {total} já têm dono.</Text> Para dar mais a um, tire de outro.
            </Text>
            {!!companyId && <LinkPacote companyId={companyId} />}
          </View>
        )}
        {!!auto.erro && ultimo === "divisao" && <Text style={s.erro} testID="wa-auto-erro">{auto.erro}</Text>}
      </Superficie>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
        {cartoes.map((k) => <CartaoAuto key={k} k={k} />)}
      </View>

      <CartaoAuto k="crediario_cobrar" tira />
    </View>
  );

  function CartaoAuto({ k, tira }: { k: WaAutoKey; tira?: boolean }) {
    const lida = info!.autos[k];
    const ligada = lida?.ligada === true;
    const d = DESC[k];
    const linhas = lida?.resumo ? [lida.resumo, ...d.linhas] : d.linhas;
    const usaNovidades = k !== "crediario_cobrar";
    const estado = !lida
      ? "Indisponível"
      : ligada
        ? (usaNovidades ? `Ligado · ${lida.livres ?? 0} de ${info!.divisao[parteDe(k)]} livres este mês` : "Ligado")
        : "Desligado · nada sai";
    const sw = (
      <Sw
        ligado={ligada} desabilitado={travado || !lida}
        rotulo={(ligada ? "Desligar " : "Ligar ") + d.titulo} testID={`wa-auto-liga-${k}`} tour={k === "aniversario" ? "wa.auto.aniversario" : undefined}
        onPress={() => { setUltimo(k); alt.alternar(k); }}
      />
    );
    const erros = (
      <>
        {!!auto.erro && ultimo === k && alt.perguntando !== k && <Text style={s.erro} testID={`wa-auto-erro-${k}`}>{auto.erro}</Text>}
        {alt.perguntando === k && (
          <AceiteNovidadesPergunta gravando={alt.gravando} erro={auto.erro} onSim={alt.confirmar} onNao={alt.recusar} />
        )}
      </>
    );
    if (tira) {
      // "Cobranças do crediário": a faixa do mockup, com o liga/desliga que a loja já usa.
      return (
        <Superficie variante="dry" raio={24} padding={{ h: 22, v: 16 }} gap={10} testID={`wa-auto-cartao-${k}`}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={t(16, V.ok, "800")}>✓</Text>
              <Text style={t(15, V.ink, "700")}>Cobranças do crediário</Text>
            </View>
            <Text style={[t(14, V.ink2), { flexShrink: 1, flexGrow: 1, flexBasis: 260 }]}>{d.desc} {d.linhas[0]}.</Text>
            <Text style={t(13, ligada ? V.ok : V.ink3, "600")} testID={`wa-auto-estado-${k}`}>{estado}</Text>
            {sw}
            {!!onAjustar && <Lnk onPress={() => onAjustar(k)} testID={`wa-auto-ajustar-${k}`}>Ajustar</Lnk>}
          </View>
          {erros}
        </Superficie>
      );
    }
    return (
      <Superficie variante="solid" raio={28} padding={22} gap={14} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300 }} testID={`wa-auto-cartao-${k}`}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: d.cor }} />
              <Text style={t(20, V.ink, "800", { letterSpacing: -0.4, lineHeight: 26 })}>{d.titulo}</Text>
            </View>
            <Text style={t(14, V.ink2)}>{d.desc}</Text>
          </View>
          {sw}
        </View>
        {erros}
        <View style={{ gap: 6 }}>
          {linhas.map((l) => (
            <View key={l} style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
              <Text style={t(14, V.ink3)}>•</Text>
              <Text style={[t(14, V.ink2), { flex: 1 }]}>{l}</Text>
            </View>
          ))}
        </View>
        <View
          style={{
            marginTop: "auto" as any, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8,
            paddingTop: 12, borderTopWidth: 1, borderTopColor: V.rule,
          }}
        >
          <Text style={t(13, ligada ? V.ok : V.ink3, "600")} testID={`wa-auto-estado-${k}`}>{estado}</Text>
          {!!onAjustar && <Lnk onPress={() => onAjustar(k)} testID={`wa-auto-ajustar-${k}`}>Ajustar</Lnk>}
        </View>
      </Superficie>
    );
  }
}
function parteDe(k: WaAutoKey): "aniversario" | "venda_mais" | "crediario" {
  const par = (Object.keys(AUTOMATICA_DA_PARTE) as ("aniversario" | "venda_mais" | "crediario")[]).find((p) => AUTOMATICA_DA_PARTE[p] === k);
  return par || "crediario";
}

const DESC_DIVISAO: Record<"aniversario" | "venda_mais" | "crediario", string> = {
  aniversario: "Parabéns com presente no dia",
  venda_mais: "Convite para quem sumiu voltar",
  crediario: "Oferta para quem tem limite livre",
};

const s = StyleSheet.create({
  card: { backgroundColor: "transparent", gap: 10 },
  aviso: { flex: 1, fontSize: 14, fontWeight: "600", color: V.warn, lineHeight: 20 },
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  erro: { fontSize: 13, fontWeight: "600", color: V.bad, lineHeight: 18 },
} as any);