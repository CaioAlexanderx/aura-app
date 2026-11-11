// ============================================================
// AURA. — Conferência de estoque · peças visuais do resultado (p-108, C)
//
// Cartão, aviso, selo e botões das telas de Diferenças e Histórico, no
// desenho do mockup aprovado (claude.ai/artifact/NYmEGh4GYjWYjz5krAUTbk).
// Tema do app (Colors); sem hover: tudo visível, alvos de 44 px.
// ============================================================
import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";

export function Cartao({ children, style, testID }: { children: React.ReactNode; style?: any; testID?: string }) {
  return <View style={[ui.cartao, style]} testID={testID}>{children}</View>;
}

export type TipoAviso = "info" | "erro" | "ok" | "atencao";

export function Aviso({ tipo, children, testID }: { tipo: TipoAviso; children: React.ReactNode; testID?: string }) {
  var cor = tipo === "erro" ? ui.avisoErro : tipo === "ok" ? ui.avisoOk : tipo === "atencao" ? ui.avisoAtencao : ui.avisoInfo;
  return (
    <View style={[ui.aviso, cor]} testID={testID} accessibilityLiveRegion="polite">
      {typeof children === "string" ? <Text style={ui.avisoTxt}>{children}</Text> : children}
    </View>
  );
}

export type TipoSelo = "neutro" | "verde" | "vermelho" | "ambar" | "violeta";

export function Selo({ tipo, children, testID }: { tipo: TipoSelo; children: string; testID?: string }) {
  var fundo = tipo === "verde" ? Colors.greenD : tipo === "vermelho" ? Colors.redD : tipo === "ambar" ? Colors.amberD : tipo === "violeta" ? Colors.violetD : Colors.bg4;
  var cor = tipo === "verde" ? Colors.green : tipo === "vermelho" ? Colors.red : tipo === "ambar" ? Colors.amber : tipo === "violeta" ? Colors.violet3 : Colors.ink3;
  return (
    <View style={[ui.selo, { backgroundColor: fundo }]} testID={testID}>
      <Text style={[ui.seloTxt, { color: cor }]}>{children}</Text>
    </View>
  );
}

type PropsBotao = {
  rotulo: string;
  onPress: () => void;
  tipo?: "primario" | "secundario" | "perigo";
  desabilitado?: boolean;
  ocupado?: boolean;
  testID?: string;
  pequeno?: boolean;
};

export function Botao({ rotulo, onPress, tipo = "primario", desabilitado, ocupado, testID, pequeno }: PropsBotao) {
  var off = !!desabilitado || !!ocupado;
  var estilo = tipo === "secundario" ? ui.btnSec : tipo === "perigo" ? ui.btnPerigo : ui.btnPri;
  var txt = tipo === "secundario" ? ui.btnSecTxt : ui.btnPriTxt;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={[ui.btn, estilo, pequeno && ui.btnPequeno, off && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: !!ocupado }}
      testID={testID}
    >
      {ocupado ? <ActivityIndicator size="small" color={tipo === "secundario" ? Colors.violet3 : "#fff"} /> : <Text style={txt}>{rotulo}</Text>}
    </Pressable>
  );
}

/** Caixa de marcar: Pressable com papel de checkbox (sem input do navegador). */
export function Marcar({ marcado, onPress, rotulo, testID, children }: {
  marcado: boolean; onPress: () => void; rotulo: string; testID?: string; children?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={ui.marcarLinha} accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }} accessibilityLabel={rotulo} testID={testID}>
      <View style={[ui.caixa, marcado && ui.caixaOn]}>
        {marcado ? <Text style={ui.caixaCheck}>✓</Text> : null}
      </View>
      {children ? <View style={{ flex: 1, minWidth: 0 }}>{children}</View> : null}
    </Pressable>
  );
}

export var ui = StyleSheet.create({
  // Transparente, como as telas de começar e contar: o fundo vem da pilha
  // (fundoDaPilhaDaConferencia), igual ao resto do app nos dois temas.
  tela: { flex: 1, backgroundColor: "transparent" },
  conteudo: { padding: 16, paddingBottom: 48, gap: 12, width: "100%", maxWidth: 760, alignSelf: "center" },
  voltar: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  voltarTxt: { color: Colors.violet3, fontSize: 13.5, fontWeight: "700" },
  titulo: { fontSize: 24, fontWeight: "700", color: Colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: Colors.ink3, marginTop: 2 },
  cartao: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, minWidth: 0,
  },
  h3: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 6 },
  nota: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18 },
  linhaFlex: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  aviso: { borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  avisoInfo: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  avisoErro: { backgroundColor: Colors.redD, borderColor: Colors.red },
  avisoOk: { backgroundColor: Colors.greenD, borderColor: "transparent" },
  avisoAtencao: { backgroundColor: Colors.amberD, borderColor: "transparent" },
  avisoTxt: { fontSize: 13.5, color: Colors.ink, lineHeight: 19 },
  selo: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  seloTxt: { fontSize: 12, fontWeight: "600" },
  btn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  btnPequeno: { minHeight: 40, paddingHorizontal: 12, borderRadius: 10 },
  btnPri: { backgroundColor: Colors.violet },
  btnPerigo: { backgroundColor: Colors.red },
  btnSec: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  btnPriTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSecTxt: { color: Colors.violet3, fontSize: 14, fontWeight: "700" },
  acoes: { flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" },
  marcarLinha: { flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 44, paddingVertical: 4 },
  caixa: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.ink3, marginTop: 2,
    alignItems: "center", justifyContent: "center",
  },
  caixaOn: { borderColor: Colors.violet, backgroundColor: Colors.violet },
  caixaCheck: { color: "#fff", fontSize: 13, fontWeight: "800", lineHeight: 15 },
});
