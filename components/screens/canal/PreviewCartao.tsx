// ============================================================
// Canal digital · escolher o estilo do cartão VENDO
//
// O seletor era três chips de texto: "Foto + nome serif", "Compacto, sem
// destaque", "Foto cheia, info overlay". Ninguém que não seja designer
// decide com isso — e a queixa foi exatamente essa ("o estilo dos cards
// pouco ou nada muda").
//
// Agora cada opção é a prateleira dela renderizada, com produto e foto da
// própria loja. A diferença entre os três aparece no thumbnail; se não
// aparecesse, o estilo não existiria de verdade.
// ============================================================
import { View, Text, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { useAccent } from "@/contexts/AccentTheme";
import { Colors } from "@/constants/colors";
import { MiniLoja, type EstiloCartao, type ProdutoDemo } from "./MiniLoja";

const OPCOES: Array<{ chave: EstiloCartao; nome: string; hint: string }> = [
  { chave: "editorial", nome: "Editorial", hint: "Peça inteira, nome em serifada. O padrão." },
  { chave: "minimal", nome: "Minimal", hint: "Retrato 3:4 e mais produto por linha." },
  { chave: "image-heavy", nome: "Imagem", hint: "Foto sangrada, preço por cima. Corta a peça." },
];

type Props = {
  valor?: string | null;
  onChange: (v: EstiloCartao) => void;
  cor: string;
  fonte?: string | null;
  produtos?: ProdutoDemo[];
};

export function PreviewCartao({ valor, onChange, cor, fonte, produtos }: Props) {
  const t = useAccent();
  const escolhido = (OPCOES.some((o) => o.chave === valor) ? valor : "editorial") as EstiloCartao;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {OPCOES.map((o) => {
        const sel = o.chave === escolhido;
        return (
          <Pressable
            key={o.chave}
            onPress={() => onChange(o.chave)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`Estilo ${o.nome}. ${o.hint}`}
            style={{
              flexGrow: 1, flexBasis: 190, minWidth: 170,
              borderRadius: 12, overflow: "hidden",
              borderWidth: sel ? 2 : 1,
              borderColor: sel ? t.primary : Colors.border,
              backgroundColor: Colors.bg3,
            }}
          >
            <View style={{ padding: 8 }}>
              {/* Só a prateleira: o hero é igual nos três e roubaria a
                  atenção do que está sendo escolhido. */}
              <MiniLoja
                cor={cor}
                fonte={fonte}
                estiloCartao={o.chave}
                produtos={produtos}
                colunas={o.chave === "minimal" ? 3 : 2}
                semHero
                escala={0.95}
              />
            </View>

            <View
              style={{
                flexDirection: "row", alignItems: "center", gap: 8,
                paddingHorizontal: 11, paddingVertical: 9,
                borderTopWidth: 1, borderTopColor: Colors.border,
                backgroundColor: sel ? t.primarySoft : "transparent",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "800", color: sel ? t.primary : Colors.ink }}>
                  {o.nome}
                </Text>
                <Text numberOfLines={2} style={{ fontSize: 10.5, color: Colors.ink3, marginTop: 1 }}>
                  {o.hint}
                </Text>
              </View>
              {sel ? <Icon name="check-circle" size={16} color={t.primary} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
