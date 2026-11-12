// ============================================================
// TermosRecebeNaAura — mostra o RASCUNHO dos termos (RA-03, 12/11/2026)
//
// Para o passo "Termos e selo" da ativação (RA-06), atrás da flag
// RECEBE_NA_AURA_ENABLED. Enquanto o texto for rascunho, a faixa
// "RASCUNHO PARA REVISÃO JURÍDICA" aparece sempre no topo e a cláusula
// modelo da Asaas que falta aparece como marcador, destacada: ninguém pode
// confundir o rascunho com termo vigente.
// ============================================================
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  TERMOS_RECEBE_STATUS, TERMOS_RECEBE_AVISO_RASCUNHO, termosRecebeNaAura,
} from "@/constants/termosRecebeNaAura";
import { CanaisAsaas } from "@/components/recebe/CanaisAsaas";

type Props = {
  /** Nome do produto, da constante única (RECEBE_NA_AURA_NAME). */
  nomeDoProduto: string;
  testID?: string;
};

export function TermosRecebeNaAura({ nomeDoProduto, testID = "termos-recebe" }: Props) {
  const clausulas = termosRecebeNaAura(nomeDoProduto);
  const rascunho = TERMOS_RECEBE_STATUS === "RASCUNHO_PARA_REVISAO_JURIDICA";
  return (
    <View style={s.caixa} testID={testID}>
      {rascunho && (
        <View style={s.faixa} testID={`${testID}-rascunho`}>
          <Text style={s.faixaTxt}>{TERMOS_RECEBE_AVISO_RASCUNHO}</Text>
        </View>
      )}
      {clausulas.map((c) => (
        <View key={c.id} style={s.clausula} testID={`${testID}-${c.id}`}>
          <Text style={s.titulo}>{c.titulo}</Text>
          {c.id === "canais" ? (
            <CanaisAsaas testID={`${testID}-canais-asaas`} />
          ) : (
            <Text style={[s.texto, c.pendente && s.pendente]} testID={c.pendente ? `${testID}-${c.id}-pendente` : undefined}>
              {c.texto}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { gap: 12 },
  faixa: { borderWidth: 1, borderColor: Colors.amber + "55", backgroundColor: Colors.amber + "14", borderRadius: 10, padding: 10 },
  faixaTxt: { fontSize: 12, fontWeight: "700", color: Colors.amber, lineHeight: 17 },
  clausula: { gap: 4 },
  titulo: { fontSize: 13.5, fontWeight: "800", color: Colors.ink },
  texto: { fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  pendente: { fontStyle: "italic", color: Colors.amber, fontWeight: "700" },
} as any);

export default TermosRecebeNaAura;
