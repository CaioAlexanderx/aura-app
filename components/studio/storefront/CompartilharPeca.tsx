// ============================================================
// components/studio/storefront/CompartilharPeca.tsx
//
// Onda 1B: o botão "Compartilhar" no cabeçalho da peça (mockup da
// Fase 1, Tela 2). Celular abre a folha do sistema; computador copia o
// link e avisa "Link da peça copiado". No app nativo, a folha do RN.
//
// O link é o endereço público da peça — loja.getaura.com.br/<slug>/p/<id>
// — porque é nele que o servidor escreve a prévia com foto e preço
// (BE-1). Ver linkDaPeca em rotasDaVitrine.ts.
// ============================================================
import { Platform, Pressable, Share } from "react-native";
import { Icon } from "@/components/Icon";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { useVitrine } from "./ContextoDaVitrine";
import { linkDaPeca, tituloDaPagina } from "./rotasDaVitrine";
import { ambienteDoNavegador, compartilharOuCopiar, metodoDoCompartilhar, type ResultadoDoCompartilhar } from "./compartilhar";
import { medirNaVitrine } from "./eventosDaVitrine";

export function BotaoCompartilhar({ produto }: { produto: { id: string | number; name?: string | null } }) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const v = useVitrine();
  // Fora da casca (não acontece na vitrine) não há slug para montar o link.
  if (!v) return null;
  const store: any = v.sf.store;

  async function compartilhar() {
    if (!v) return;
    const origem = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : null;
    const url = linkDaPeca({
      slug: v.slug,
      id: String(produto.id),
      origem,
      // O payload Studio ainda não traz o endereço canônico (o da loja
      // comum traz `storefront_url`). Quando trouxer, ele vence — é o que
      // faz o domínio próprio da lojista sair no link.
      canonica: store?.storefront_url || store?.site?.storefront_url || null,
    });
    const titulo = tituloDaPagina({ stage: "configure", nomeDaLoja: store?.site?.name, produto: produto.name });

    let r: ResultadoDoCompartilhar;
    if (Platform.OS !== "web") {
      try {
        const feito = await Share.share({ message: url, url, title: titulo });
        r = feito.action === Share.sharedAction ? "compartilhado" : "cancelado";
      } catch { r = "falhou"; }
    } else {
      r = await compartilharOuCopiar({ titulo, url }, ambienteDoNavegador());
      if (r === "copiado") v.avisar("Link da peça copiado", "check");
      else if (r === "falhou") v.avisar("Não deu para copiar o link", "info");
    }
    // Fase 1C: `share` no GA4 (o Pixel não tem evento padrão para isso),
    // atrás do consentimento como os outros — ver eventosDaVitrine.ts.
    const metodo = metodoDoCompartilhar(r);
    if (metodo) {
      medirNaVitrine(store?.site?.rastreadores, {
        nome: "share", metodo, item: { id: String(produto.id), nome: String(produto.name || "") },
      });
    }
  }

  return (
    <Pressable
      onPress={compartilhar}
      accessibilityRole="button"
      accessibilityLabel="Compartilhar"
      hitSlop={4}
      style={({ hovered, pressed }: any) => ({
        width: 44, height: 44, borderRadius: 12, marginRight: -8,
        alignItems: "center", justifyContent: "center",
        backgroundColor: hovered || pressed ? tema.bg3 : "transparent",
      })}
    >
      <Icon name="share" size={20} color={T.ink2} />
    </Pressable>
  );
}
