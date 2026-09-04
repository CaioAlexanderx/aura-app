// ============================================================
// app/[slug].tsx — a vitrine no endereço que se divulga
//
// `loja.getaura.com.br/sheid-mania`. O backend serve a casca deste app
// naquele endereço (services/vitrineStudioShell.js) e o roteador cai
// aqui, porque o caminho tem um segmento só.
//
// POR QUE NA RAIZ: o endereço público não tem prefixo. Um `/loja/<slug>`
// seria mais seguro de rotear, mas devolveria à cliente um endereço com
// uma palavra a mais para ela ler e digitar errado.
//
// O QUE ISSO CAPTURA: só caminhos de um segmento que não sejam uma rota
// declarada. `/studio`, `/login`, `/empresas`, `/cardapio` e as outras
// são estáticas e vencem a dinâmica no Expo Router. O que sobra —
// `/qualquer-coisa` — vira uma tentativa de abrir uma loja com esse
// nome, e a tela mostra "loja não encontrada". Num endereço de loja é
// exatamente a resposta certa.
// ============================================================
import { useLocalSearchParams } from "expo-router";
import { PaginaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { slugDaVitrine } from "@/components/studio/storefront/slugDaVitrine";

export default function VitrinePublica() {
  const params = useLocalSearchParams<{ slug: string }>();
  // O slug injetado pelo backend vence o do caminho: ele é o que o
  // servidor sabe, e sobrevive a qualquer diferença entre o endereço
  // visível e a rota que casou.
  return <PaginaDaVitrine slug={slugDaVitrine(params.slug)} />;
}
