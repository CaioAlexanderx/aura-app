// useAlternarAutomatica — liga/desliga uma automática, com a pergunta do aceite.
//
// Ao ligar a PRIMEIRA automática (sem a declaração de aceite gravada), a
// lojista responde "Seus clientes aceitaram receber novidades da loja
// pelo WhatsApp?". "Sim" grava a declaração (a mesma do cartão da aba
// Conexão: wa_marketing_consent) e só então liga; "Ainda não" não liga
// nada. Desligar é sempre direto. Usado pelo cartão das Automáticas e
// pelas telas de cada automática, para a pergunta ser uma só.
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { birthdayApi } from "@/services/birthdayApi";
import type { WaStatus } from "@/services/waApi";
import type { WaAutoKey } from "@/services/waConfigApi";
import { mapWaError, waMarketingConsentOk } from "@/components/whatsapp/waGuards";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";

interface Args {
  companyId: string;
  auto: UseWaAutomaticas;
  status: WaStatus | null;
  onStatusChanged: () => void;
}

export function useAlternarAutomatica({ companyId, auto, status, onStatusChanged }: Args) {
  const [perguntando, setPerguntando] = useState<WaAutoKey | null>(null);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aceitou = waMarketingConsentOk(status);

  const alternar = useCallback((key: WaAutoKey) => {
    const info = auto.info;
    if (!info) return; // sem leitura do servidor, nada liga
    if (info.ligadas[key]) { auto.ligar(key, false); return; }
    if (!aceitou) { setPerguntando(key); return; }
    auto.ligar(key, true);
  }, [auto, aceitou]);

  const confirmar = useCallback(async () => {
    const key = perguntando;
    if (!key) return;
    setGravando(true);
    setErro(null);
    try {
      await birthdayApi.saveSettings(companyId, { wa_marketing_consent: true });
      onStatusChanged();
      setPerguntando(null);
      await auto.ligar(key, true);
    } catch (e: any) {
      setErro(mapWaError(e).message);
    } finally {
      setGravando(false);
    }
  }, [perguntando, companyId, onStatusChanged, auto]);

  const recusar = useCallback(() => { setPerguntando(null); setErro(null); }, []);

  return { alternar, perguntando, confirmar, recusar, gravando, erro };
}

export function AceiteNovidadesPergunta(
  { gravando, erro, onSim, onNao }: { gravando: boolean; erro: string | null; onSim: () => void; onNao: () => void }
) {
  return (
    <View style={s.aceite} testID="wa-auto-aceite">
      <Text style={s.titulo}>Seus clientes aceitaram receber novidades da loja pelo WhatsApp?</Text>
      <View style={s.botoes}>
        <Pressable
          onPress={onSim}
          disabled={gravando}
          accessibilityRole="button"
          style={[s.btnPrim, gravando && { opacity: 0.6 }]}
          testID="wa-auto-aceite-sim"
        >
          {gravando && <ActivityIndicator size="small" color="#fff" />}
          <Text style={s.btnPrimTxt}>Sim, aceitaram</Text>
        </Pressable>
        <Pressable onPress={onNao} accessibilityRole="button" style={s.btnSec} testID="wa-auto-aceite-nao">
          <Text style={s.btnSecTxt}>Ainda não</Text>
        </Pressable>
      </View>
      <Text style={s.sub}>Pergunta feita uma vez só. Quem pedir para sair deixa de receber sozinho.</Text>
      {!!erro && <Text style={s.erro}>{erro}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  aceite: { backgroundColor: Colors.violetD, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, padding: 12, gap: 8 },
  titulo: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  erro: { fontSize: 12, fontWeight: "600", color: Colors.red, lineHeight: 17 },
  botoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnPrim: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44,
    backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14,
  },
  btnPrimTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  btnSec: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  btnSecTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
} as any);
