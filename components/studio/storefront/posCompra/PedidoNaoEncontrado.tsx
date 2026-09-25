// ============================================================
// components/studio/storefront/posCompra/PedidoNaoEncontrado.tsx
//
// Link inválido, expirado ou que não carregou (mockup da Fase 4, Tela 7).
// Troca o "🔍 Não encontramos esta encomenda" cru e o cartão genérico das
// páginas de antes por um texto com a voz da loja, sem emoji — e sempre
// um caminho: falar com a loja no WhatsApp ou voltar para a loja.
//
// Quem chega aqui pelo endereço da loja com um token que não existe não
// tem pedido para ler a marca. A marca vem então da própria loja
// (useMarcaPeloSlug): o slug resolveu, só o pedido não — o caso comum de
// link velho ou copiado pela metade.
// ============================================================
import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import type { MarcaDaLoja } from "@/services/studioApi";
import { enderecoDaApi } from "../enderecoDaApi";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto } from "../TipografiaVitrine";
import { Botao, MolduraDaLoja, Selo, Titulo, abrirFora } from "./MolduraDaLoja";
import { linkDoWhatsAppDoPedido, nomeDaLoja } from "./posCompra";

export type MotivoDoErro = "nao_encontrado" | "expirado" | "rede";

/**
 * A marca da loja pelo slug, para a página de erro do endereço da loja.
 * Lê o mesmo payload da vitrine (`site`); só roda quando `ativo`.
 */
export function useMarcaPeloSlug(slug: string | null | undefined, ativo: boolean): MarcaDaLoja | null {
  const [marca, setMarca] = useState<MarcaDaLoja | null>(null);
  useEffect(() => {
    if (!ativo || !slug) return;
    let vivo = true;
    fetch(enderecoDaApi() + "/storefront/" + encodeURIComponent(slug) + "/studio/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const site = d?.site;
        if (!vivo || !site) return;
        setMarca({
          slug: String(slug).toLowerCase(),
          nome: site.name || null,
          logo_url: site.logo_url || null,
          primary_color: site.primary_color || null,
          font_family: site.font_family || null,
          whatsapp: site.whatsapp || null,
          vitrine_v2: site.vitrine_v2 === true,
        });
      })
      .catch(() => { /* sem marca: a página de erro fala com a voz da Aura */ });
    return () => { vivo = false; };
  }, [slug, ativo]);
  return marca;
}

const TEXTOS: Record<MotivoDoErro, { titulo: string; corpo: (loja: string) => string }> = {
  nao_encontrado: {
    titulo: "Não encontramos esse pedido",
    corpo: (loja) => `Esse link pode ter expirado ou faltar algum caractere. ${loja} resolve rapidinho pelo WhatsApp.`,
  },
  expirado: {
    titulo: "Este link de aprovação expirou",
    corpo: (loja) => `Sem problema: ${loja} manda um link novo pelo WhatsApp.`,
  },
  rede: {
    titulo: "Não conseguimos abrir seu pedido agora",
    corpo: () => "Pode ser a conexão. Tente de novo em instantes.",
  },
};

export function PedidoNaoEncontrado({
  marca, motivo = "nao_encontrado", pedido, onTentarDeNovo, titulo,
}: {
  marca?: MarcaDaLoja | null;
  motivo?: MotivoDoErro;
  /** Número do pedido, quando se sabe (vai na mensagem do WhatsApp). */
  pedido?: string | null;
  onTentarDeNovo?: () => void;
  /** O título da aba. */
  titulo?: string;
}) {
  const nome = nomeDaLoja(marca, "Aura");
  // "Sheid Mania resolve..." — sem artigo: "a" ou "o" depende do nome
  // que a lojista escolheu, e errar o gênero da loja na cara dela é pior
  // que não usar artigo. Sem a loja, "A loja resolve...".
  const aLoja = marca?.nome ? marca.nome : "A loja";
  const t = TEXTOS[motivo];
  const whats = linkDoWhatsAppDoPedido(marca?.whatsapp, pedido);
  return (
    <MolduraDaLoja marca={marca} nome={marca?.nome ? nome : "Aura"} titulo={titulo || (marca?.nome ? `Pedido · ${marca.nome}` : "Pedido")}>
      <Corpo
        titulo={t.titulo}
        texto={t.corpo(aLoja)}
        whats={whats}
        nomeCurto={marca?.nome || null}
        slug={marca?.slug || null}
        onTentarDeNovo={motivo === "rede" ? onTentarDeNovo : undefined}
      />
    </MolduraDaLoja>
  );
}

function Corpo({
  titulo, texto, whats, nomeCurto, slug, onTentarDeNovo,
}: {
  titulo: string;
  texto: string;
  whats: string | null;
  nomeCurto: string | null;
  slug: string | null;
  onTentarDeNovo?: () => void;
}) {
  const tema = useTemaDaVitrine();
  return (
    <View
      testID="pos-compra-erro"
      style={{ flexGrow: 1, minHeight: 420, alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 30, gap: 14 }}
    >
      <Selo icone="alert_circle" tipo="erro" />
      <Titulo tamanho={20} centro>{titulo}</Titulo>
      <Texto style={{ textAlign: "center", color: tema.ink2, fontSize: 15, lineHeight: 23, maxWidth: 380 }}>{texto}</Texto>
      <View style={{ width: "100%", maxWidth: 320, gap: 10, marginTop: 6 }}>
        {onTentarDeNovo ? <Botao icone="refresh" rotulo="Tentar de novo" onPress={onTentarDeNovo} /> : null}
        {whats ? (
          <Botao
            tipo="whatsapp"
            icone="whatsapp"
            rotulo={nomeCurto ? `Falar com ${nomeCurto} no WhatsApp` : "Falar com a loja no WhatsApp"}
            onPress={() => abrirFora(whats)}
          />
        ) : null}
        {slug ? (
          <Botao tipo="secundario" rotulo="Ir para a loja" onPress={() => router.replace(("/" + slug) as any)} />
        ) : null}
      </View>
    </View>
  );
}
