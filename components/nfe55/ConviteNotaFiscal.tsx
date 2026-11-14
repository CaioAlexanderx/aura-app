// ============================================================
// AURA. — Convite para ligar a nota fiscal (CP4b, 14/11/2026).
// Venda concluída numa loja sem a nota fiscal ativa (mockup "Venda
// concluída: notas", caso 4): convite, nunca bloqueio. Antes, esta loja
// via "Emitir NFC-e" e uma falha ao tocar (o NfceActions não olhava
// is_active). "Ligar a nota fiscal" leva a Notas › Certificado A1.
// ============================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";

const PASSOS = [
  ["1 · Certificado digital", "O arquivo A1 que o contador usa."],
  ["2 · Código da Sefaz (CSC)", "Pedido no site da Sefaz, a gente mostra onde."],
  ["3 · Teste", "Uma nota de teste, sem valor, para conferir."],
];

export function ConviteNotaFiscal({ testID = "convite-nota-fiscal" }: { testID?: string }) {
  const [fechado, setFechado] = useState(false);
  if (fechado) return null;
  return (
    <View style={c.box} testID={testID}>
      <Text style={c.t}>Quer emitir nota fiscal pelas suas vendas?</Text>
      <Text style={c.s}>A venda já está registrada. Se quiser, ligamos a nota fiscal da loja e ela passa a sair daqui, com um toque. Esta venda também pode ganhar a nota depois.</Text>
      <View style={c.passos}>
        {PASSOS.map(([t, s]) => (
          <View key={t} style={c.passo}><Text style={c.passoT}>{t}</Text><Text style={c.passoS}>{s}</Text></View>
        ))}
      </View>
      <View style={c.acoes}>
        <Pressable style={[c.btn, c.btnPri]} onPress={() => router.push("/nfe?tab=certificado" as any)} accessibilityRole="button" testID={testID + "-ligar"}>
          <Text style={c.btnPriT}>Ligar a nota fiscal</Text>
        </Pressable>
        <Pressable style={c.btn} onPress={() => setFechado(true)} accessibilityRole="button" testID={testID + "-agora-nao"}>
          <Text style={c.btnT}>Agora não</Text>
        </Pressable>
      </View>
      <Text style={c.nota}>Vende serviço? A nota de serviço (NFS-e) se liga no mesmo lugar.</Text>
    </View>
  );
}

const c = StyleSheet.create({
  box: { width: "100%", borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD, padding: 14, gap: 10 },
  t: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  s: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  passos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  passo: { flexGrow: 1, flexBasis: 120, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8 },
  passoT: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  passoS: { fontSize: 11.5, color: Colors.ink2 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { flexGrow: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  btnPri: { flexGrow: 2, backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnT: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  btnPriT: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  nota: { fontSize: 11.5, color: Colors.ink2 },
});
