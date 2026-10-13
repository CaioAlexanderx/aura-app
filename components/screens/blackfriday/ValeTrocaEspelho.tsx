// ============================================================
// AURA. — Vale-troca no cupom: espelho do toggle (13/10/2026)
//
// O interruptor original mora em Configurações › Políticas do Caixa
// (PdvSettingsCard). Aqui ele ganha um espelho para quem está na página da
// temporada: MESMO estado — a preferência por loja de utils/valeTroca
// (lerValeTrocaLigado / salvarValeTrocaLigado, a mesma chave do
// PdvSettingsCard). Ligar aqui liga lá, e vice-versa; as duas telas nunca
// estão montadas ao mesmo tempo, então cada uma lê o valor ao abrir.
//
// O texto é o do PdvSettingsCard, sem novidade: as datas vêm das
// constantes de utils/valeTroca (campanha do ano seguinte = trocar lá).
// ============================================================
import { useState } from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  VALE_TROCA_PRAZO_ATE, VALE_TROCA_VENDAS_ATE, VALE_TROCA_VENDAS_DE,
  formatarDiaBR, lerValeTrocaLigado, salvarValeTrocaLigado,
} from "@/utils/valeTroca";

export function ValeTrocaEspelho({ companyId }: { companyId: string | null | undefined }) {
  const [ligado, setLigado] = useState<boolean>(() => lerValeTrocaLigado(companyId));
  return (
    <View style={s.linha}>
      <Text style={s.texto} testID="vale-troca-texto">
        {"Nas vendas de " + formatarDiaBR(VALE_TROCA_VENDAS_DE) + " a " + formatarDiaBR(VALE_TROCA_VENDAS_ATE) +
          ", o cupom sai com um QR. Quem ganhou o presente troca até " + formatarDiaBR(VALE_TROCA_PRAZO_ATE) +
          " sem o comprador: você bipa o QR no Caixa e a troca abre com a venda carregada. Vale para este computador."}
      </Text>
      <Switch
        testID="toggle-vale-troca-bf"
        value={ligado}
        onValueChange={function (v) {
          setLigado(v);
          salvarValeTrocaLigado(companyId, v);
        }}
        trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
        thumbColor={ligado ? Colors.violet : Colors.ink3}
      />
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: 16 },
  texto: { flex: 1, fontSize: 13, color: Colors.ink3, lineHeight: 20 },
});
