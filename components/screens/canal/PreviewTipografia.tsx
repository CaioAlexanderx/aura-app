// ============================================================
// Canal digital · escolher a tipografia da loja VENDO
//
// O seletor mostrava só o nome do par e uma dica ("Serif clássica,
// elegante"). A lojista escolhia no escuro: nome de fonte não diz nada
// para quem não é designer, e "elegante" diz menos ainda.
//
// Aqui cada opção é um pedaço da loja DELA — a cor dela, o logo dela, o
// nome dela — renderizado no par. A pergunta deixa de ser "qual nome
// você prefere" e passa a ser "qual desses parece a sua loja".
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, Image, Platform } from "react-native";
import { TIPOGRAFIAS, cssDeTodasTipografias, type ChaveTipografia } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { useAccent } from "@/contexts/AccentTheme";
import { Colors } from "@/constants/colors";
// `wash` e puro e ja trata hex de 3 digitos e valor invalido — concatenar
// alpha na mao ("cor + 1A") quebra assim que a lojista digita #0AF.
import { wash } from "@/components/studio/storefront/theme";

/** Ordem em que a lojista vê: do mais próximo da marca Aura ao mais distante. */
const ORDEM: ChaveTipografia[] = ["classic", "modern", "editorial", "humanist"];

type Props = {
  valor?: string | null;
  onChange: (v: ChaveTipografia) => void;
  /** Cor da loja — é ela que faz o preview parecer a loja da pessoa. */
  cor: string;
  nomeDaLoja?: string | null;
  logoUrl?: string | null;
};

export function PreviewTipografia({ valor, onChange, cor, nomeDaLoja, logoUrl }: Props) {
  const t = useAccent();
  const escolhida = (ORDEM.includes(valor as ChaveTipografia) ? valor : "classic") as ChaveTipografia;
  const nome = (nomeDaLoja || "").trim() || "Sua loja";

  // O painel carrega as QUATRO famílias — ao contrário da vitrine, que
  // carrega só a escolhida. Sem isto as quatro amostras sairiam na mesma
  // fonte de fallback e o preview mentiria.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("aura-tipografias")) return;
    const link = document.createElement("link");
    link.id = "aura-tipografias";
    link.rel = "stylesheet";
    link.href = cssDeTodasTipografias();
    document.head.appendChild(link);
  }, []);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {ORDEM.map((chave) => {
        const par = TIPOGRAFIAS[chave];
        const sel = chave === escolhida;

        return (
          <Pressable
            key={chave}
            onPress={() => onChange(chave)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`Tipografia ${par.nome}. ${par.hint}`}
            style={{
              flexGrow: 1, flexBasis: 210, minWidth: 200,
              borderRadius: 12, overflow: "hidden",
              borderWidth: sel ? 2 : 1,
              borderColor: sel ? t.primary : Colors.border,
              backgroundColor: Colors.bg3,
            }}
          >
            {/* Mini-hero, na cor da loja */}
            <View style={{ backgroundColor: cor, padding: 12, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.2)" }}
                    resizeMode="contain"
                  />
                ) : null}
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: par.display, color: "#fff", fontSize: 22, lineHeight: 26, flex: 1 }}
                >
                  {nome}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{ fontFamily: par.body, color: "rgba(255,255,255,0.85)", fontSize: 10.5 }}
              >
                Produção em ~3 dias úteis
              </Text>
            </View>

            {/* Uma linha de prateleira: é onde a fonte pequena aparece, e
                é aí que par bonito no título costuma falhar. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
              <View
                style={{
                  width: 40, height: 40, borderRadius: 8,
                  backgroundColor: wash(cor, 0.12),
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: par.display, color: cor, fontSize: 17 }}>CB</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: par.display, color: Colors.ink, fontSize: 14, lineHeight: 17 }}>
                  Camiseta Básica
                </Text>
                <Text style={{ fontFamily: par.body, color: cor, fontSize: 12, fontWeight: "700" }}>
                  R$ 49,90
                </Text>
              </View>
            </View>

            {/* Rodapé do cartão: nome do par + a marca de escolhido */}
            <View
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                gap: 8, paddingHorizontal: 12, paddingVertical: 9,
                borderTopWidth: 1, borderTopColor: Colors.border,
                backgroundColor: sel ? t.primarySoft : "transparent",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "800", color: sel ? t.primary : Colors.ink }}>
                  {par.nome}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 10.5, color: Colors.ink3, marginTop: 1 }}>
                  {par.hint}
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
