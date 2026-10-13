// ============================================================
// AURA. — Vale-troca no cupom: espelho do toggle (13/10/2026)
//
// O interruptor original mora em Configurações › Políticas do Caixa
// (PdvSettingsCard). Aqui ele ganha um espelho para quem está na página da
// temporada: MESMO estado e MESMO caminho — usePdvSettings para ler
// (pdv_settings.vale_troca_enabled, Aura-backend#813; com o valor antigo do
// navegador valendo até a loja migrar, utils/valeTroca.ts) e
// pdvSettingsApi.save com o objeto inteiro para gravar, como o card faz.
// Ligar aqui liga lá: as duas telas leem a mesma query ["pdv-settings", id].
//
// O texto é o do PdvSettingsCard. As datas vêm das constantes de
// utils/valeTroca (campanha do ano seguinte = trocar lá).
// ============================================================
import { useState } from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import {
  VALE_TROCA_PRAZO_ATE, VALE_TROCA_VENDAS_ATE, VALE_TROCA_VENDAS_DE,
  formatarDiaBR, lerValeTrocaLigado, marcarValeTrocaMigrado,
} from "@/utils/valeTroca";

export function ValeTrocaEspelho({ companyId }: { companyId: string | null | undefined }) {
  const { settings, isLoading, invalidate } = usePdvSettings();
  const [pendente, setPendente] = useState<PdvSettings | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Durante o save vale o valor otimista, como no PdvSettingsCard.
  const exibido = pendente || settings;
  const ligado = lerValeTrocaLigado(companyId, exibido);

  async function alternar(v: boolean) {
    if (!companyId || salvando) return;
    const proximo = { ...exibido, vale_troca_enabled: v } as PdvSettings;
    setPendente(proximo);
    setSalvando(true);
    try {
      await pdvSettingsApi.save(companyId, proximo);
      // O servidor passou a ser a fonte: o valor antigo do navegador não conta mais.
      marcarValeTrocaMigrado(companyId);
      invalidate();
      setPendente(null);
    } catch (err: any) {
      setPendente(null);
      toast.error((err && err.data && err.data.error) || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) {
    return <ActivityIndicator testID="vale-troca-carregando" color={Colors.violet3} style={{ marginVertical: 8 }} />;
  }

  return (
    <View style={s.linha}>
      <Text style={s.texto} testID="vale-troca-texto">
        {"Nas vendas de " + formatarDiaBR(VALE_TROCA_VENDAS_DE) + " a " + formatarDiaBR(VALE_TROCA_VENDAS_ATE) +
          ", o cupom sai com um QR. Quem ganhou o presente troca até " + formatarDiaBR(VALE_TROCA_PRAZO_ATE) +
          " sem o comprador: você bipa o QR no Caixa e a troca abre com a venda carregada. Vale para todos os computadores da loja."}
      </Text>
      <Switch
        testID="toggle-vale-troca-bf"
        value={ligado}
        onValueChange={alternar}
        trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
        thumbColor={ligado ? Colors.violet : Colors.ink3}
        disabled={salvando}
      />
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: 16 },
  texto: { flex: 1, fontSize: 13, color: Colors.ink3, lineHeight: 20 },
});
