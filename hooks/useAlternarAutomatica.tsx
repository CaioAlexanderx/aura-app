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
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
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
