// ============================================================
// AutomaticasCard — "Mensagens que trabalham sozinhas"
//
// 1. A divisão das novidades do mês: cada automática (Aniversário, Venda+,
//    oferta do Crediário) tem um dono para cada novidade. + e − por
//    automática; o + trava quando não sobra novidade sem dono e o − trava
//    no que já foi usado. O servidor recusa o que a tela deixasse passar.
// 2. Um cartão por automática, com o liga/desliga. Na primeira que se
//    liga, a pergunta do aceite: "Seus clientes aceitaram receber
//    novidades da loja pelo WhatsApp?" — grava a data (a mesma
//    declaração de marketing que a aba Conexão já guardava).
//
// Sem saldo ou sem automáticas lidas do servidor, tudo trava.
// ============================================================
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { birthdayApi } from "@/services/birthdayApi";
import type { WaStatus } from "@/services/waApi";
import type { SaldoInfo } from "./waSaldo";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { mapWaError, waMarketingConsentOk } from "./waGuards";
import {
  AUTO_KEYS, COR_AUTO, ROTULO_AUTO, podeDarMais, podeTirar, semDono, type AutoKey,
} from "./waDivisao";

interface Props {
  companyId: string;
  saldo: SaldoInfo | null;
  auto: UseWaAutomaticas;
  status: WaStatus | null;
  /** O aceite mudou: o pai recarrega o /status. */
  onStatusChanged: () => void;
  /** Abre a configuração da automática (Aniversário, Venda+, Crediário). */
  onAjustar?: (key: AutoKey) => void;
}

const DESC: Record<AutoKey, { desc: string; linhas: string[] }> = {
  aniversario: {
    desc: "Manda parabéns com presente no dia.",
    linhas: ["Sai às 10h, no dia do aniversário", "Quem pediu para não receber fica de fora"],
  },
  vendamais: {
    desc: "Chama de volta quem parou de comprar.",
    linhas: ["Todo dia 1º, para quem sumiu", "Começa por quem mais comprava"],
  },
  crediario: {
    desc: "Oferta para quem paga em dia e tem limite livre.",
    linhas: ["Uma vez por mês, no dia 10", "Começa por quem tem mais limite livre"],
  },
};

export function AutomaticasCard({ companyId, saldo, auto, status, onStatusChanged, onAjustar }: Props) {
  const [perguntando, setPerguntando] = useState<AutoKey | null>(null);
  const [gravandoAceite, setGravandoAceite] = useState(false);
  const [erroAceite, setErroAceite] = useState<string | null>(null);

  const info = auto.info;
  const total = saldo ? saldo.novidades.total : null;
  const aceitou = waMarketingConsentOk(status);

  const confirmarAceite = useCallback(async () => {
    const key = perguntando;
    if (!key) return;
    setGravandoAceite(true);
    setErroAceite(null);
    try {
      await birthdayApi.saveSettings(companyId, { wa_marketing_consent: true });
      onStatusChanged();
      setPerguntando(null);
      await auto.ligar(key, true);
    } catch (e: any) {
      setErroAceite(mapWaError(e).message);
    } finally {
      setGravandoAceite(false);
    }
  }, [perguntando, companyId, onStatusChanged, auto]);

  const alternar = useCallback((key: AutoKey) => {
    if (!info) return;
    if (info.ligadas[key]) { auto.ligar(key, false); return; }
    if (!aceitou) { setPerguntando(key); return; }
    auto.ligar(key, true);
  }, [info, aceitou, auto]);

  if (auto.carregando && !info) {
    return (
      <View style={s.card} testID="wa-auto-carregando">
        <ActivityIndicator size="small" color={Colors.violet3} />
      </View>
    );
  }

  if (!info || total == null) {
    return (
      <View style={s.card} testID="wa-auto-indisponivel">
        <View style={s.linha}>
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.aviso}>
            Não consegui ler as mensagens automáticas agora. Por segurança, nada é ligado nem
            alterado até eu conseguir.
          </Text>
        </View>
        <Pressable onPress={() => { auto.recarregar(); }} accessibilityRole="button" style={s.btnLink} testID="wa-auto-tentar-de-novo">
          <Text style={s.btnLinkTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  const livres = semDono(info.divisao, total);
  const travado = auto.salvando;

  // Um quadradinho por novidade: da cor do dono, apagado se já foi usada, vazio se sem dono.
  const caps: { key: string; cor: string; usada: boolean; livre: boolean }[] = [];
  AUTO_KEYS.forEach((k) => {
    for (let j = 0; j < info.divisao[k]; j++) {
      caps.push({ key: `${k}-${j}`, cor: COR_AUTO[k], usada: j < info.usadas[k], livre: false });
    }
  });
  for (let j = 0; j < Math.max(0, livres); j++) caps.push({ key: `livre-${j}`, cor: "transparent", usada: false, livre: true });

  return (
    <View style={{ gap: 14 }} testID="wa-auto-bloco">
      <View style={s.card} testID="wa-auto-divisao">
        <Text style={s.titulo}>Cada novidade tem um dono</Text>
        <Text style={s.sub}>
          A Aura já dividiu as {total}. Mude com + e −; a soma nunca passa do que o plano tem. A
          parte apagada de cada cor já foi usada.
        </Text>

        <View style={s.caps} accessibilityLabel={`Das ${total} novidades: ` + AUTO_KEYS.map((k) => `${ROTULO_AUTO[k]} ${info.divisao[k]}`).join(", ")}>
          {caps.map((c) => (
            <View
              key={c.key}
              style={[s.cap, c.livre ? s.capLivre : { backgroundColor: c.cor }, c.usada && { opacity: 0.35 }]}
            />
          ))}
        </View>

        <View style={s.rows}>
          {AUTO_KEYS.map((k) => {
            const menos = !travado && podeTirar(info.divisao, info.usadas, k);
            const mais = !travado && podeDarMais(info.divisao, k, total);
            return (
              <View key={k} style={s.row} testID={`wa-auto-divisao-${k}`}>
                <View style={[s.bolinha, { backgroundColor: COR_AUTO[k] }]} />
                <Text style={s.rowRotulo}>{ROTULO_AUTO[k]}</Text>
                <Pressable
                  onPress={() => auto.ajustar(k, -1, total)}
                  disabled={!menos}
                  accessibilityRole="button"
                  accessibilityLabel={`Tirar 1 de ${ROTULO_AUTO[k]}`}
                  accessibilityState={{ disabled: !menos }}
                  style={[s.passo, !menos && s.passoOff]}
                  testID={`wa-auto-menos-${k}`}
                >
                  <Text style={s.passoTxt}>−</Text>
                </Pressable>
                <Text style={s.rowN} testID={`wa-auto-n-${k}`}>{info.divisao[k]}</Text>
                <Pressable
                  onPress={() => auto.ajustar(k, 1, total)}
                  disabled={!mais}
                  accessibilityRole="button"
                  accessibilityLabel={`Dar mais 1 para ${ROTULO_AUTO[k]}`}
                  accessibilityState={{ disabled: !mais }}
                  style={[s.passo, !mais && s.passoOff]}
                  testID={`wa-auto-mais-${k}`}
                >
                  <Text style={s.passoTxt}>+</Text>
                </Pressable>
                <Text style={s.rowUsadas}>{info.usadas[k]} usadas</Text>
              </View>
            );
          })}
        </View>

        <Text style={s.resumo} testID="wa-auto-livres">
          {livres} livres de {total}
          {livres <= 0 ? ". As " + total + " já têm dono. Para dar mais a um, tire de outro." : ""}
        </Text>
        {!!auto.erro && <Text style={s.erro} testID="wa-auto-erro">{auto.erro}</Text>}
      </View>

      {AUTO_KEYS.map((k) => {
        const ligada = info.ligadas[k];
        const restam = Math.max(0, info.divisao[k] - info.usadas[k]);
        const linhas = info.linhas[k].length ? info.linhas[k] : DESC[k].linhas;
        return (
          <View key={k} style={s.card} testID={`wa-auto-cartao-${k}`}>
            <View style={s.cartaoTopo}>
              <View style={[s.bolinha, { backgroundColor: COR_AUTO[k] }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.titulo}>{ROTULO_AUTO[k]}</Text>
                <Text style={s.sub}>{DESC[k].desc}</Text>
              </View>
              <Pressable
                onPress={() => alternar(k)}
                disabled={travado}
                accessibilityRole="switch"
                accessibilityState={{ checked: ligada, disabled: travado }}
                accessibilityLabel={(ligada ? "Desligar " : "Ligar ") + ROTULO_AUTO[k]}
                style={[s.sw, ligada && s.swOn, travado && { opacity: 0.6 }]}
                testID={`wa-auto-liga-${k}`}
              >
                <View style={[s.swBolinha, ligada && s.swBolinhaOn]} />
              </Pressable>
            </View>
            {linhas.map((l) => (
              <View key={l} style={s.linha}>
                <Text style={s.ponto}>•</Text>
                <Text style={s.linhaTxt}>{l}</Text>
              </View>
            ))}
            <View style={s.rodape}>
              <Text style={[s.estado, { color: ligada ? Colors.green : Colors.ink3 }]} testID={`wa-auto-estado-${k}`}>
                {ligada ? `Ligado · ${restam} de ${info.divisao[k]} livres este mês` : "Desligado · nada sai"}
              </Text>
              {!!onAjustar && (
                <Pressable onPress={() => onAjustar(k)} accessibilityRole="button" style={s.btnLink} testID={`wa-auto-ajustar-${k}`}>
                  <Text style={s.btnLinkTxt}>Ajustar</Text>
                </Pressable>
              )}
            </View>

            {perguntando === k && (
              <View style={s.aceite} testID="wa-auto-aceite">
                <Text style={s.aceiteTitulo}>Seus clientes aceitaram receber novidades da loja pelo WhatsApp?</Text>
                <View style={s.aceiteBotoes}>
                  <Pressable
                    onPress={confirmarAceite}
                    disabled={gravandoAceite}
                    accessibilityRole="button"
                    style={[s.btnPrim, gravandoAceite && { opacity: 0.6 }]}
                    testID="wa-auto-aceite-sim"
                  >
                    {gravandoAceite && <ActivityIndicator size="small" color="#fff" />}
                    <Text style={s.btnPrimTxt}>Sim, aceitaram</Text>
                  </Pressable>
                  <Pressable onPress={() => { setPerguntando(null); setErroAceite(null); }} accessibilityRole="button" style={s.btnSec} testID="wa-auto-aceite-nao">
                    <Text style={s.btnSecTxt}>Ainda não</Text>
                  </Pressable>
                </View>
                <Text style={s.sub}>Pergunta feita uma vez só. Quem pedir para sair deixa de receber sozinho.</Text>
                {!!erroAceite && <Text style={s.erro}>{erroAceite}</Text>}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  titulo: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  caps: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  cap: { width: 22, height: 14, borderRadius: 4 },
  capLivre: { borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2 },
  rows: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexWrap: "wrap" },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  rowRotulo: { flex: 1, minWidth: 110, fontSize: 13, fontWeight: "700", color: Colors.ink },
  passo: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  passoOff: { opacity: 0.35 },
  passoTxt: { fontSize: 18, fontWeight: "800", color: Colors.violet3 },
  rowN: { minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: "800", color: Colors.ink },
  rowUsadas: { fontSize: 11, color: Colors.ink3, minWidth: 64 },
  resumo: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  erro: { fontSize: 12, fontWeight: "600", color: Colors.red, lineHeight: 17 },
  aviso: { flex: 1, fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  ponto: { fontSize: 12, color: Colors.ink3 },
  linhaTxt: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  cartaoTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  rodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  estado: { fontSize: 12, fontWeight: "700" },
  sw: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border2, justifyContent: "center", padding: 2 },
  swOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  swBolinha: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.ink3 },
  swBolinhaOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
  btnLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4, alignSelf: "flex-start" },
  btnLinkTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  aceite: { backgroundColor: Colors.violetD, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, padding: 12, gap: 8 },
  aceiteTitulo: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  aceiteBotoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnPrim: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44,
    backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14,
  },
  btnPrimTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  btnSec: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  btnSecTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
} as any);
