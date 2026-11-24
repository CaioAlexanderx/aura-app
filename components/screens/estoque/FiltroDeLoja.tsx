// ============================================================
// AURA. — Filtro "Loja" e selo da loja dona (18/11/2026, INC-2026-11-18-01)
//
// Usados nas Etiquetas e no Estoque (uma empresa e consolidado), só quando
// a lista mistura lojas do grupo (utils/lojaDona.contextoDeLojas). Sem
// contexto a tela nem chama estes componentes.
//
// Chips em vez de menu suspenso: são duas a poucas lojas, cabem à vista, e
// não há camada flutuante (z-index do RNW) nem hover — o toque basta.
// ============================================================
import { View, Text, Pressable, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  TODAS_AS_LOJAS, TEXTO_TODAS_AS_LOJAS, ROTULO_FILTRO_LOJA,
  type ContextoDeLojas,
} from "@/utils/lojaDona";

type FiltroProps = {
  ctx: ContextoDeLojas;
  value: string;
  onChange: (loja: string) => void;
  /** Prefixo dos testID (ex.: "etiquetas", "estoque"). */
  testIDBase: string;
  style?: StyleProp<ViewStyle>;
};

export function FiltroDeLoja({ ctx, value, onChange, testIDBase, style }: FiltroProps) {
  var opcoes = [{ id: TODAS_AS_LOJAS, nome: TEXTO_TODAS_AS_LOJAS }].concat(ctx.lojas);
  return (
    <View style={[s.linha, style]} testID={testIDBase + "-filtro-loja"} accessibilityRole="radiogroup" accessibilityLabel="Filtrar por loja">
      <Text style={s.rotulo}>{ROTULO_FILTRO_LOJA}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={s.chips}>
        {opcoes.map(function (o) {
          var on = value === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={function () { onChange(o.id); }}
              style={[s.chip, on && s.chipOn]}
              testID={testIDBase + "-loja-" + o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, checked: on }}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]} numberOfLines={1}>{o.nome}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Etiqueta discreta com o nome da loja dona, ao lado do nome do produto. */
export function SeloDaLoja({ nome, testID }: { nome: string | null | undefined; testID?: string }) {
  if (!nome) return null;
  return (
    <View style={s.selo} testID={testID} accessibilityLabel={"Loja: " + nome}>
      <Icon name="store" size={9} color={Colors.ink3} />
      <Text style={s.seloTxt} numberOfLines={1}>{nome}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  rotulo: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chips: { flexDirection: "row", gap: 6, alignItems: "center" },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, maxWidth: 220 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 11.5, color: Colors.ink2, fontWeight: "600" },
  chipTxtOn: { color: "#fff" },
  selo: {
    flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", flexShrink: 1,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, maxWidth: 160,
  },
  seloTxt: { fontSize: 10, color: Colors.ink3, fontWeight: "600", flexShrink: 1 },
});
