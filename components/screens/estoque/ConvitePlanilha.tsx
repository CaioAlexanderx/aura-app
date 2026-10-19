// ============================================================
// AURA. — Convite "Importar sua planilha" no Estoque (19/10/2026, tq-31)
//
// Quem respondeu "Planilha" (até 300 produtos) no check-in chega ao Estoque
// com ?importar=planilha. O seletor de arquivo do navegador só abre com um
// toque da pessoa, então a tela mostra este convite no fluxo, com o mesmo
// "Escolher planilha" da importação de sempre (useImportProdutos).
//
//   · Derivado do parâmetro, sem estado próprio na chegada e sem limpar a
//     URL no mount: robusto à montagem dupla (PageTransition, troca de tema
//     — a segunda montagem, a visível, ainda vê o parâmetro).
//   · "Agora não" e "Escolher planilha" encerram o convite na SESSÃO
//     (sessionStorage, decisão da Nina): não volta ao remontar nem se o
//     check-in mandar ?importar=planilha de novo. Sem storage (privado,
//     nativo, bloqueado), vale só enquanto a tela está montada; nunca quebra.
//   · "Baixar modelo" (tq-36) entrega a planilha modelo e NÃO encerra o convite.
//   · Só então o parâmetro sai da URL. O setParams com undefined vira a
//     string "undefined", que querImportarPlanilha rejeita.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTO_CONVITE_PLANILHA, querImportarPlanilha } from "@/utils/checkinDestino";
import { BaixarModelo } from "./BaixarModelo";

export const CHAVE_CONVITE_PLANILHA = "aura_convite_planilha_encerrado";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function conviteEncerradoNaSessao(): boolean {
  try { return storage()?.getItem(CHAVE_CONVITE_PLANILHA) === "1"; } catch { return false; }
}

export function encerrarConviteNaSessao(): void {
  try { storage()?.setItem(CHAVE_CONVITE_PLANILHA, "1"); } catch {}
}

type Props = {
  /** Valor de `importar` na URL do Estoque. */
  importar: string | string[] | null | undefined;
  /** Esconde sem encerrar (visão consolidada, importação já aberta). */
  escondido?: boolean;
  ocupado?: boolean;
  /** Abre o seletor de arquivo (useImportProdutos.escolherArquivo). */
  onEscolher: () => void;
};

export function ConvitePlanilha({ importar, escondido, ocupado, onEscolher }: Props) {
  const [encerrado, setEncerrado] = useState(conviteEncerradoNaSessao);

  if (escondido || encerrado || !querImportarPlanilha(importar)) return null;

  function encerrar() {
    encerrarConviteNaSessao();
    setEncerrado(true);
    try { router.setParams({ importar: undefined } as any); } catch {}
  }

  function escolher() {
    // O seletor abre no MESMO toque (o navegador exige o gesto); depois encerra.
    onEscolher();
    encerrar();
  }

  return (
    <View style={s.card} testID="estoque-convite-planilha">
      <View style={s.icone}><Icon name="upload" size={18} color={Colors.violet3} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.titulo}>{TEXTO_CONVITE_PLANILHA.titulo}</Text>
        <Text style={s.sub}>{TEXTO_CONVITE_PLANILHA.sub}</Text>
      </View>
      <Pressable
        onPress={escolher}
        disabled={ocupado}
        accessibilityRole="button"
        style={[s.botao, ocupado && { opacity: 0.6 }]}
        testID="estoque-convite-planilha-escolher"
      >
        <Text style={s.botaoTxt}>Escolher planilha</Text>
      </Pressable>
      {/* Baixar o modelo NÃO encerra o convite: a pessoa baixa, preenche e volta para escolher. */}
      <BaixarModelo testID="estoque-convite-planilha-modelo" />
      <Pressable onPress={encerrar} accessibilityRole="button" style={s.agoraNao} testID="estoque-convite-planilha-fechar">
        <Text style={[s.sub, { textDecorationLine: "underline", marginTop: 0 }]}>Agora não</Text>
      </Pressable>
    </View>
  );
}

// Sem hover: o estado dos botões é permanente (CLAUDE.md, armadilha 7).
const s = StyleSheet.create({
  card: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12,
    backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16,
  },
  icone: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  titulo: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  botao: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  botaoTxt: { fontSize: 12, color: "#fff", fontWeight: "700" },
  agoraNao: { padding: 8, minHeight: 36, justifyContent: "center" },
});

export default ConvitePlanilha;
