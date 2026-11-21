// Modelo desenhado com as variáveis destacadas em roxo ("O que está em roxo
// muda sozinho para cada cliente."). Usado no "Salvar como modelo" e na
// lista de Configurações.
import { Text, View, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { partesDoModelo, VARIAVEIS } from "@/utils/crediarioMensagem";

const ROTULO: Record<string, string> = Object.fromEntries(VARIAVEIS.map((v) => [v.chave, v.chave]));

export function TextoComVariaveis({ body, numberOfLines, verde, testID }: {
  body: string; numberOfLines?: number; verde?: boolean; testID?: string;
}) {
  return (
    <View style={[st.box, verde && st.boxVerde]} testID={testID}>
      <Text style={st.txt} numberOfLines={numberOfLines}>
        {partesDoModelo(body).map((p, i) =>
          p.tipo === "variavel"
            ? <Text key={i} style={st.var}>{` ${ROTULO[p.valor] || p.valor} `}</Text>
            : <Text key={i}>{p.valor}</Text>
        )}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  box: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 11, backgroundColor: Colors.bg4 },
  boxVerde: { backgroundColor: Colors.greenD, borderColor: Colors.green + "44" },
  txt: { fontSize: 13, lineHeight: 20, color: Colors.ink },
  var: { backgroundColor: Colors.violetD, color: Colors.violet3, fontWeight: "700", fontSize: 12, borderRadius: 6 },
});
