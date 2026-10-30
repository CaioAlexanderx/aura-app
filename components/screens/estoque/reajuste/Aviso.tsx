// Caixa de aviso do reajuste em lote (cores do repo: âmbar, violeta, verde, vermelho).
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export type TipoAviso = "aviso" | "info" | "ok" | "erro";

export function Aviso({ tipo, children, testID }: { tipo: TipoAviso; children: React.ReactNode; testID?: string }) {
  var cor = tipo === "aviso" ? Colors.amber : tipo === "ok" ? Colors.green : tipo === "erro" ? Colors.red : Colors.violet3;
  var fundo = tipo === "aviso" ? Colors.amberD : tipo === "ok" ? Colors.greenD : tipo === "erro" ? Colors.redD : Colors.violetD;
  var icone = tipo === "ok" ? "check" : tipo === "info" ? "info" : "alert";
  return (
    <View style={[s.caixa, { backgroundColor: fundo, borderColor: cor + "44" }]} testID={testID} accessibilityLiveRegion="polite">
      <Icon name={icone as any} size={16} color={cor} />
      <Text style={s.txt}>{children}</Text>
    </View>
  );
}

var s = StyleSheet.create({
  caixa: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  txt: { flex: 1, fontSize: 13.5, color: Colors.ink, lineHeight: 19 },
});

export default Aviso;
