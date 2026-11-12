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
// O texto é o do PdvSettingsCard (TEXTO_DO_VALE_TROCA).
//
// 12/11/2026: o vale vale o ano todo e, ligado, mostra o MESMO campo de
// prazo em dias (ValeTrocaPrazoCampo) — escolher aqui grava
// vale_troca_prazo_dias pelo mesmo caminho do interruptor.
// ============================================================
import { useState } from "react";
import { View, Text, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { TEXTO_DO_VALE_TROCA, lerPrazoDoValeEmDias, lerValeTrocaLigado } from "@/utils/valeTroca";
import { ValeTrocaPrazoCampo } from "@/components/screens/configuracoes/ValeTrocaPrazoCampo";

export function ValeTrocaEspelho({ companyId }: { companyId: string | null | undefined }) {
  const { settings, isLoading, invalidate } = usePdvSettings();
  const [pendente, setPendente] = useState<PdvSettings | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Durante o save vale o valor otimista, como no PdvSettingsCard.
  const exibido = pendente || settings;
  const ligado = lerValeTrocaLigado(companyId, exibido);

  function alternar(v: boolean) {
    return gravar({ vale_troca_enabled: v });
  }

  async function gravar(mudanca: Partial<PdvSettings>) {
    if (!companyId || salvando) return;
    const proximo = { ...exibido, ...mudanca } as PdvSettings;
    setPendente(proximo);
    setSalvando(true);
    try {
      await pdvSettingsApi.save(companyId, proximo);
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
    <View>
      <View style={s.linha}>
        <Text style={s.texto} testID="vale-troca-texto">{TEXTO_DO_VALE_TROCA}</Text>
        <Switch
          testID="toggle-vale-troca-bf"
          value={ligado}
          onValueChange={alternar}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={ligado ? Colors.violet : Colors.ink3}
          disabled={salvando}
        />
      </View>
      {ligado && (
        <ValeTrocaPrazoCampo
          dias={lerPrazoDoValeEmDias(exibido)}
          onEscolher={(d) => { gravar({ vale_troca_prazo_dias: d }); }}
          disabled={salvando}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: 16 },
  texto: { flex: 1, fontSize: 13, color: Colors.ink3, lineHeight: 20 },
});
