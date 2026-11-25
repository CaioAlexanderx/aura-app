// ============================================================
// AURA. — Personalizados: "Falta receber" ao entregar (p-185, 25/11/2026)
//
// Decisão do Caio (D6): o saldo do pedido de orçamento é baixado na Produção.
// Tocar "Marcar como entregue" com dinheiro faltando abre este aviso antes de
// entregar, com "Receber agora" (abre a baixa; depois de receber, entrega) e
// "Entregar mesmo assim" (entrega sem receber).
//
// Mesmo padrão da confirmação do "Voltar para …" (BotaoVoltarEtapa): dentro
// da própria tela, por WebPortal (o z-index:0 do react-native-web prende
// position:fixed dentro do shell), folha de baixo no celular, botões de
// 44 px. Tocar fora fecha sem fazer nada.
// ============================================================
import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { WebPortal } from "@/components/WebPortal";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { ALVO_DE_TOQUE, botaoDoRodape, folhaDeBaixo, useModalNoCelular } from "@/components/studio/modalNoCelular";
import { reais } from "@/components/studio/pagamentoDoPedido";

type Props = {
  /** O que falta receber; null fecha o aviso. */
  falta: number | null;
  onReceber: () => void;
  onEntregar: () => void;
  onFechar: () => void;
  /** Base dos testIDs: `<id>`, `-texto`, `-receber`, `-entregar`. */
  idDeTeste: string;
};

export function AvisoFaltaReceber({ falta, onReceber, onEntregar, onFechar, idDeTeste }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const celular = useModalNoCelular();
  const folha = folhaDeBaixo(celular);
  const btnFolha = botaoDoRodape(celular);
  const aberto = falta !== null;

  return (
    <WebPortal active={aberto}>
      <View style={[s.fundo, folha.fundo]} testID={idDeTeste}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} accessibilityLabel="Cancelar" />
        <View style={[s.caixa, folha.caixa]} accessibilityRole="alert">
          <Text style={s.pergunta} testID={`${idDeTeste}-texto`}>Falta receber {reais(falta)}</Text>
          <View style={s.rodape}>
            <Pressable
              style={[s.secundario, btnFolha]}
              onPress={onEntregar}
              accessibilityRole="button"
              testID={`${idDeTeste}-entregar`}
            >
              <Text style={s.secundarioTxt}>Entregar mesmo assim</Text>
            </Pressable>
            <Pressable
              style={[s.principal, btnFolha]}
              onPress={onReceber}
              accessibilityRole="button"
              testID={`${idDeTeste}-receber`}
            >
              <Text style={s.principalTxt}>Receber agora</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </WebPortal>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    fundo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
    caixa: { backgroundColor: t.paperCardElev, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420 },
    pergunta: { fontSize: 16, fontWeight: "800", color: t.ink },
    rodape: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, justifyContent: "flex-end" },
    secundario: { minHeight: ALVO_DE_TOQUE, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.bgSoft },
    secundarioTxt: { color: t.ink2, fontWeight: "600" },
    principal: { minHeight: ALVO_DE_TOQUE, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.primary },
    principalTxt: { color: "#fff", fontWeight: "700" },
  });
}

export default AvisoFaltaReceber;
