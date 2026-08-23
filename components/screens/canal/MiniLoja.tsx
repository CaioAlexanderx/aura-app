// ============================================================
// Canal digital · a loja da pessoa, pequena e ao vivo
//
// O feedback que gerou este arquivo: "é mais fácil notar as mudanças
// olhando o preview do que lendo o menu". Vale para a cor, para o estilo
// dos cards e para a tipografia — todo controle da aba Design mostrava o
// NOME da opção e nunca o efeito dela.
//
// Aqui a loja dela é desenhada em miniatura, com a cor, o logo, o nome e
// a fonte que estiverem selecionados no momento. Mexeu no controle, a
// loja muda na frente dela.
//
// Não é um mockup genérico: usa uma foto real do catálogo quando existe,
// porque a diferença entre "Editorial" e "Imagem" É a foto — com um
// retângulo cinza os três estilos parecem iguais, que foi exatamente a
// queixa.
// ============================================================
import { View, Text, Image, Platform } from "react-native";
import { tipografiaDaLoja } from "@/constants/fonts";
import { Colors } from "@/constants/colors";
import { iniciais, degrauDaCapa } from "@/components/studio/storefront/capaModel";
import { wash, corLegivelSobre } from "@/components/studio/storefront/theme";

export type EstiloCartao = "editorial" | "minimal" | "image-heavy";

export type ProdutoDemo = {
  nome: string;
  preco: number;
  foto?: string | null;
};

/** O produto que aparece quando a loja ainda não tem catálogo. */
export const PRODUTO_EXEMPLO: ProdutoDemo = { nome: "Camiseta Básica", preco: 49.9, foto: null };

type Props = {
  cor: string;
  corDestaque?: string;
  fonte?: string | null;
  estiloCartao?: EstiloCartao;
  nomeDaLoja?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  produtos?: ProdutoDemo[];
  /** Quantos cartões desenhar na prateleira. */
  colunas?: number;
  /** Só a prateleira, sem o hero — usado nas amostras de estilo de cartão. */
  semHero?: boolean;
  /** Escala geral; 1 = tamanho de leitura confortável no painel. */
  escala?: number;
};

export function MiniLoja({
  cor, corDestaque, fonte, estiloCartao = "editorial",
  nomeDaLoja, tagline, logoUrl, produtos, colunas = 3, semHero, escala = 1,
}: Props) {
  const tipo = tipografiaDaLoja(fonte);
  const nome = (nomeDaLoja || "").trim() || "Sua loja";
  const lista = (produtos && produtos.length ? produtos : [PRODUTO_EXEMPLO]).slice(0, colunas);
  // Repete o catálogo curto para a prateleira não ficar meio vazia — uma
  // loja de 1 produto ainda precisa mostrar como a GRADE fica.
  const naGrade: ProdutoDemo[] = [];
  for (let i = 0; i < colunas; i++) naGrade.push(lista[i % lista.length]);

  const px = (n: number) => Math.round(n * escala);

  return (
    <View
      style={{
        borderRadius: px(10),
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: "#FFFFFF",
      }}
    >
      {!semHero ? (
        <View
          style={[
            { paddingHorizontal: px(12), paddingVertical: px(13), gap: px(5) },
            Platform.OS === "web"
              ? ({ background: `linear-gradient(135deg, ${cor}, ${corDestaque || cor})` } as any)
              : { backgroundColor: cor },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: px(7) }}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={{
                  width: px(22), height: px(22), borderRadius: px(5),
                  backgroundColor: "rgba(255,255,255,0.2)",
                }}
                resizeMode="contain"
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={{ fontFamily: tipo.display, color: "#fff", fontSize: px(19), lineHeight: px(23), flex: 1 }}
            >
              {nome}
            </Text>
          </View>
          {tagline ? (
            <Text numberOfLines={1} style={{ fontFamily: tipo.body, color: "rgba(255,255,255,0.88)", fontSize: px(10) }}>
              {tagline}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          gap: px(estiloCartao === "minimal" ? 6 : 8),
          padding: px(10),
          backgroundColor: "#FFFFFF",
        }}
      >
        {naGrade.map((p, i) => (
          <CartaoMini
            key={i}
            produto={p}
            estilo={estiloCartao}
            cor={cor}
            fonteDisplay={tipo.display}
            fonteCorpo={tipo.body}
            escala={escala}
          />
        ))}
      </View>
    </View>
  );
}

function CartaoMini({
  produto, estilo, cor, fonteDisplay, fonteCorpo, escala,
}: {
  produto: ProdutoDemo;
  estilo: EstiloCartao;
  cor: string;
  fonteDisplay: string;
  fonteCorpo: string;
  escala: number;
}) {
  const px = (n: number) => Math.round(n * escala);
  const sobreposto = estilo === "image-heavy";
  const compacto = estilo === "minimal";

  // As três proporções que o ProductCard usa de verdade. É o que faz a
  // amostra valer alguma coisa: se o thumbnail não distingue os estilos,
  // o seletor não distingue nada.
  const proporcao = compacto ? 3 / 4 : 1;

  return (
    <View
      style={{
        flex: 1,
        borderRadius: px(compacto ? 4 : 8),
        overflow: sobreposto ? "hidden" : "visible",
        borderWidth: sobreposto ? 0 : 1,
        borderColor: Colors.border,
        backgroundColor: "#FFFFFF",
        padding: sobreposto ? 0 : px(5),
        gap: sobreposto ? 0 : px(4),
      }}
    >
      <Foto
        produto={produto}
        cor={cor}
        proporcao={proporcao}
        fonteDisplay={fonteDisplay}
        raio={px(sobreposto ? 8 : compacto ? 3 : 6)}
        // Só o "Imagem" sangra a foto. Nos outros dois a peça aparece
        // inteira — é o guardrail da vitrine. Quem escolhe "Imagem" está
        // optando pelo corte em troca de impacto, e é essa escolha que o
        // seletor precisa deixar visível.
        preencher={sobreposto}
      />

      <View
        style={[
          { gap: px(2), paddingHorizontal: px(1) },
          sobreposto
            ? ({
                position: "absolute", left: 0, right: 0, bottom: 0,
                paddingHorizontal: px(7), paddingVertical: px(6),
                ...(Platform.OS === "web"
                  ? ({ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.3) 62%, transparent)" } as any)
                  : { backgroundColor: "rgba(0,0,0,0.55)" }),
              } as any)
            : null,
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            // No minimal o nome sai na SANS, menor: é o estilo que existe
            // pra caber mais produto, e serifada grande briga com isso.
            fontFamily: compacto ? fonteCorpo : fonteDisplay,
            fontSize: px(compacto ? 8.5 : 10),
            lineHeight: px(compacto ? 11 : 13),
            fontWeight: compacto ? "500" : "400",
            color: sobreposto ? "#fff" : "#171A18",
          }}
        >
          {produto.nome}
        </Text>
        <Text
          style={{
            fontFamily: fonteCorpo,
            fontSize: px(compacto ? 8 : 9),
            fontWeight: "800",
            color: sobreposto ? "#fff" : cor,
          }}
        >
          R$ {produto.preco.toFixed(2).replace(".", ",")}
        </Text>
      </View>
    </View>
  );
}

function Foto({
  produto, cor, proporcao, fonteDisplay, raio, preencher,
}: {
  produto: ProdutoDemo;
  cor: string;
  proporcao: number;
  fonteDisplay: string;
  raio: number;
  preencher?: boolean;
}) {
  const base: any = { width: "100%", aspectRatio: proporcao, borderRadius: raio, overflow: "hidden" };

  if (produto.foto) {
    return (
      <View style={[base, { backgroundColor: "#F4F4F2", alignItems: "center", justifyContent: "center" }]}>
        <Image
          source={{ uri: produto.foto }}
          style={{ width: "100%", height: "100%", padding: preencher ? 0 : "5%" }}
          resizeMode={preencher ? "cover" : "contain"}
        />
      </View>
    );
  }

  // Sem foto, a capa composta — a mesma da loja, então o preview também
  // mostra como ficam os produtos que a lojista ainda não fotografou.
  return (
    <View
      style={[
        base,
        {
          backgroundColor: wash(cor, degrauDaCapa(produto.nome)),
          alignItems: "center", justifyContent: "center",
        },
      ]}
    >
      <Text style={{ fontFamily: fonteDisplay, fontSize: raio * 2.6, color: corLegivelSobre(cor, "#FFFFFF") }}>
        {iniciais(produto.nome)}
      </Text>
    </View>
  );
}
