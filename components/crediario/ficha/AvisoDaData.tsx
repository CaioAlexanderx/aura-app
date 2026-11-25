// ============================================================
// Aviso abaixo do campo de data (Renegociar e Mudar a data) — 24/11/2026
//
// Regras em utils/crediarioDatas.ts (avisoDaData): no Renegociar a data no
// passado aparece em vermelho e o confirmar fica desabilitado; no Mudar a
// data só avisa em âmbar. Nos dois, "Confira o ano" é tocável e preenche o
// campo com a sugestão.
// ============================================================
import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { textoConfiraOAno, type AvisoDaData as Aviso } from "@/utils/crediarioDatas";

export function AvisoDaData({ aviso, onUsarSugestao, testID }: {
  aviso: Aviso;
  /** Recebe a sugestão em dd/mm/aaaa. */
  onUsarSugestao: (sugestaoBr: string) => void;
  testID: string;
}) {
  if (!aviso.texto && !aviso.sugestaoDoAno) return null;
  const erro = aviso.tom === "erro";
  return (
    <View style={{ marginTop: 4 }}>
      {!!aviso.texto && (
        <Text
          style={{ fontFamily: Fonts.body, color: erro ? Colors.red : Colors.amber, fontSize: 12 }}
          accessibilityRole={erro ? "alert" : undefined}
          testID={`${testID}-aviso`}
        >
          {aviso.texto}
        </Text>
      )}
      {!!aviso.sugestaoDoAno && (
        <Pressable
          onPress={() => onUsarSugestao(aviso.sugestaoDoAno as string)}
          style={({ pressed }: any) => [{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          testID={`${testID}-ano`}
        >
          <Text style={{ fontFamily: Fonts.body, fontSize: 12.5, fontWeight: "600", color: Colors.violet3 }}>
            {textoConfiraOAno(aviso.sugestaoDoAno)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
