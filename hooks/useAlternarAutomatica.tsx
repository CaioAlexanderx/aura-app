// useAlternarAutomatica — liga/desliga uma automática, com a pergunta do aceite.
//
// Ao ligar uma automática que gasta novidades sem o aceite gravado, a
// lojista responde "Seus clientes aceitaram receber novidades da loja
// pelo WhatsApp?". "Sim" reenvia o PUT com `aceite_novidades: true`
// (o servidor grava a data, uma vez, e liga); "Ainda não" não liga nada.
// A pergunta aparece de duas formas, as duas pelo mesmo caminho: a tela já
// sabe que o aceite não existe (`aceite_novidades_em` nulo), ou o servidor
// responde 409 SEM_ACEITE_NOVIDADES. Desligar é sempre direto.
// `crediario_cobrar` usa avisos e nunca pergunta.
import React, { useCallback, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Pilula, Superficie, V, t } from "@/components/whatsapp/waVidro";
import type { WaAutoKey } from "@/services/waConfigApi";
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";

export function useAlternarAutomatica(auto: UseWaAutomaticas) {
  const [perguntando, setPerguntando] = useState<WaAutoKey | null>(null);
  const [gravando, setGravando] = useState(false);

  const alternar = useCallback(async (key: WaAutoKey) => {
    const info = auto.info;
    if (!info) return; // sem leitura do servidor, nada liga
    if (info.autos[key]?.ligada) { await auto.ligar(key, false); return; }
    if (key !== "crediario_cobrar" && !info.aceiteEm) { setPerguntando(key); return; }
    const r = await auto.ligar(key, true);
    if (!r.ok && r.code === "SEM_ACEITE_NOVIDADES") setPerguntando(key);
  }, [auto]);

  const confirmar = useCallback(async () => {
    const key = perguntando;
    if (!key) return;
    setGravando(true);
    const r = await auto.ligar(key, true, true);
    setGravando(false);
    if (r.ok) setPerguntando(null);
  }, [perguntando, auto]);

  const recusar = useCallback(() => setPerguntando(null), []);

  return { alternar, perguntando, confirmar, recusar, gravando };
}

export function AceiteNovidadesPergunta(
  { gravando, erro, onSim, onNao }: { gravando: boolean; erro: string | null; onSim: () => void; onNao: () => void }
) {
  return (
    <Superficie variante="dry" raio={20} padding={14} gap={10} testID="wa-auto-aceite">
      <Text style={t(14, V.ink)}>Seus clientes aceitaram receber novidades da loja pelo WhatsApp?</Text>
      <View style={s.botoes}>
        <Pilula ligada onPress={onSim} disabled={gravando} testID="wa-auto-aceite-sim">
          {gravando && <ActivityIndicator size="small" color={V.acc} />}
          <Text style={t(14, V.onTxt, "600")}>Sim, aceitaram</Text>
        </Pilula>
        <Pilula onPress={onNao} testID="wa-auto-aceite-nao">
          <Text style={t(14, V.ink, "600")}>Ainda não</Text>
        </Pilula>
      </View>
      <Text style={t(12, V.ink3)}>Pergunta feita uma vez só. Quem pedir para sair deixa de receber sozinho.</Text>
      {!!erro && <Text style={s.erro}>{erro}</Text>}
    </Superficie>
  );
}

const s = StyleSheet.create({
  erro: { fontSize: 13, fontWeight: "600", color: V.bad, lineHeight: 18 },
  botoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
} as any);