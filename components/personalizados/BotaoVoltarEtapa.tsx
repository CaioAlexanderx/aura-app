// ============================================================
// AURA. — Personalizados: "Voltar para …" (25/11/2026)
//
// O botão que devolve o pedido UMA etapa, no cartão da Fila de produção e no
// detalhe do pedido do Negócio. Na fusão o arrasto do Studio saiu (mockup
// p-131: "sem arrastar: o cartão anda pelo botão") e o cartão só andava para
// a frente; este botão é o caminho de volta.
//
//   - DISCRETO. Secundário, sem cor de ação: quem pinta é quem monta (o
//     cartão e o detalhe têm cada um o seu botão secundário). Alvo de 44 px,
//     sempre visível, sem hover.
//   - CONFIRMA AO SAIR DE "EM PRODUÇÃO" E DE "PRONTO". A pergunta abre dentro
//     da própria tela, por WebPortal (dentro do shell o z-index:0 do
//     react-native-web prende position:fixed), com "Cancelar" e "Voltar".
//     Das outras etapas, volta direto.
//   - QUEM GRAVA É QUEM MONTA. `onVoltar(destino)` chama a mesma rota e o
//     mesmo recarregar do avançar.
//
// Regras sem tela: regrasDaProducao.ts (ETAPA_ANTERIOR).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { WebPortal } from "@/components/WebPortal";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioProductionStatus } from "@/services/studioApi";
import { ALVO_DE_TOQUE, botaoDoRodape, folhaDeBaixo, useModalNoCelular } from "@/components/studio/modalNoCelular";
import { etapaAnterior, perguntaDoVoltar, textoDoVoltar, voltarPedeConfirmacao } from "@/components/personalizados/regrasDaProducao";

type Props = {
  /** A etapa em que o pedido está. Sem anterior (primeira, entregue, cancelado), nada aparece. */
  etapaAtual: string | null | undefined;
  onVoltar: (destino: StudioProductionStatus) => void;
  /**
   * Base dos testIDs: `<id>` no botão, `<id>-confirmacao`, `-pergunta`,
   * `-confirmar` e `-cancelar` na confirmação. (Não se chama testID para o
   * teste achar o Pressable, e não este componente.)
   */
  idDeTeste: string;
  /** Nome do cliente, para o leitor de tela. */
  nome?: string;
  disabled?: boolean;
  estilo?: any;
  estiloDoTexto?: any;
  /** Algo antes do texto (o ícone do detalhe). */
  antes?: React.ReactNode;
};

export function BotaoVoltarEtapa({ etapaAtual, onVoltar, idDeTeste, nome, disabled, estilo, estiloDoTexto, antes }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const celular = useModalNoCelular();
  const folha = folhaDeBaixo(celular);
  const btnFolha = botaoDoRodape(celular);
  const [perguntando, setPerguntando] = useState(false);

  const anterior = etapaAnterior(etapaAtual);
  if (!anterior) return null;
  const texto = textoDoVoltar(anterior);

  const tocar = () => {
    if (voltarPedeConfirmacao(etapaAtual)) setPerguntando(true);
    else onVoltar(anterior.key);
  };
  const confirmar = () => {
    setPerguntando(false);
    onVoltar(anterior.key);
  };

  return (
    <>
      <Pressable
        style={[s.botao, estilo]}
        onPress={tocar}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={nome ? `${texto}: pedido de ${nome}` : texto}
        testID={idDeTeste}
      >
        {antes}
        <Text style={[s.botaoTxt, estiloDoTexto]}>{texto}</Text>
      </Pressable>

      <WebPortal active={perguntando}>
        <View style={[s.fundo, folha.fundo]} testID={`${idDeTeste}-confirmacao`}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPerguntando(false)} accessibilityLabel="Cancelar" />
          <View style={[s.caixa, folha.caixa]} accessibilityRole="alert">
            <Text style={s.pergunta} testID={`${idDeTeste}-pergunta`}>{perguntaDoVoltar(anterior)}</Text>
            <View style={s.rodape}>
              <Pressable
                style={[s.cancelar, btnFolha]}
                onPress={() => setPerguntando(false)}
                accessibilityRole="button"
                testID={`${idDeTeste}-cancelar`}
              >
                <Text style={s.cancelarTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.confirmar, btnFolha]}
                onPress={confirmar}
                accessibilityRole="button"
                testID={`${idDeTeste}-confirmar`}
              >
                <Text style={s.confirmarTxt}>Voltar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </WebPortal>
    </>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    // Secundário e sem cor de ação. 44 px: alvo de toque.
    botao: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: ALVO_DE_TOQUE, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "transparent" },
    botaoTxt: { fontSize: 12, fontWeight: "600", color: t.ink3, textAlign: "center" },

    // O contêiner do WebPortal é um <div> fixo, sem flex: o fundo se estica sozinho.
    fundo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
    caixa: { backgroundColor: t.paperCardElev, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420 },
    pergunta: { fontSize: 16, fontWeight: "800", color: t.ink },
    rodape: { flexDirection: "row", gap: 8, marginTop: 16, justifyContent: "flex-end" },
    cancelar: { minHeight: ALVO_DE_TOQUE, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.bgSoft },
    cancelarTxt: { color: t.ink2, fontWeight: "600" },
    confirmar: { minHeight: ALVO_DE_TOQUE, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.primary },
    confirmarTxt: { color: "#fff", fontWeight: "700" },
  });
}

export default BotaoVoltarEtapa;
