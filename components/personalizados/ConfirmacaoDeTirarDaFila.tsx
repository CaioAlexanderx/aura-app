// ============================================================
// AURA. — Personalizados: pergunta do "Tirar da fila" (C1)
//
// Duas caixas no mesmo molde da confirmação de voltar etapa (BotaoVoltarEtapa):
// por WebPortal, porque dentro do shell o z-index:0 do react-native-web prende
// qualquer position:fixed.
//   - modo "pergunta": "Tirar da fila? A venda e o dinheiro continuam como estão.";
//   - modo "recebimento": o backend recusou (TEM_RECEBIMENTO); avisa e oferece
//     ir para o cancelamento do pedido.
// ============================================================
import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { reais } from "@/components/studio/pagamentoDoPedido";
import { WebPortal } from "@/components/WebPortal";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { ALVO_DE_TOQUE, botaoDoRodape, folhaDeBaixo, useModalNoCelular } from "@/components/studio/modalNoCelular";
import { TEXTO_DE_TIRAR_DA_FILA as T, tituloDoRecebimento } from "@/components/personalizados/tirarDaFila";

type Props = {
  modo: "pergunta" | "recebimento" | null;
  trabalhando?: boolean;
  /** Quanto já entrou (R$), para o aviso do modo "recebimento". */
  recebido?: number | null;
  idDeTeste: string;
  onConfirmar: () => void;
  onIrParaCancelamento: () => void;
  onFechar: () => void;
};

export function ConfirmacaoDeTirarDaFila({ modo, trabalhando, recebido, idDeTeste, onConfirmar, onIrParaCancelamento, onFechar }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const celular = useModalNoCelular();
  const folha = folhaDeBaixo(celular);
  const btn = botaoDoRodape(celular);
  const recebimento = modo === "recebimento";
  return (
    <WebPortal active={!!modo}>
      <View style={[s.fundo, folha.fundo]} testID={`${idDeTeste}-${recebimento ? "recebimento" : "confirmacao"}`}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} accessibilityLabel="Cancelar" />
        <View style={[s.caixa, folha.caixa]} accessibilityRole="alert">
          <Text style={s.pergunta} testID={`${idDeTeste}-pergunta`}>{recebimento ? tituloDoRecebimento(recebido, reais) : T.titulo}</Text>
          <Text style={s.corpo}>{recebimento ? T.temRecebimentoCorpo : T.corpo}</Text>
          <View style={s.rodape}>
            <Pressable style={[s.cancelar, btn]} onPress={onFechar} accessibilityRole="button" testID={`${idDeTeste}-cancelar`}>
              <Text style={s.cancelarTxt}>{recebimento ? "Fechar" : "Cancelar"}</Text>
            </Pressable>
            {recebimento ? (
              <Pressable style={[s.confirmar, btn]} onPress={onIrParaCancelamento} accessibilityRole="button" testID={`${idDeTeste}-ir-cancelamento`}>
                <Text style={s.confirmarTxt}>{T.irParaCancelamento}</Text>
              </Pressable>
            ) : (
              <Pressable style={[s.confirmar, btn]} onPress={onConfirmar} disabled={trabalhando} accessibilityRole="button" testID={`${idDeTeste}-confirmar`}>
                <Text style={s.confirmarTxt}>{trabalhando ? "Tirando…" : T.confirmar}</Text>
              </Pressable>
            )}
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
    corpo: { fontSize: 13, color: t.ink3, lineHeight: 20, marginTop: 8 },
    rodape: { flexDirection: "row", gap: 8, marginTop: 16, justifyContent: "flex-end", flexWrap: "wrap" },
    cancelar: { minHeight: ALVO_DE_TOQUE, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.bgSoft },
    cancelarTxt: { color: t.ink2, fontWeight: "600" },
    confirmar: { minHeight: ALVO_DE_TOQUE, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.primary },
    confirmarTxt: { color: "#fff", fontWeight: "700", textAlign: "center" },
  });
}

export default ConfirmacaoDeTirarDaFila;
