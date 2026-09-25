// ============================================================
// app/[slug]/_layout.tsx — a vitrine no endereço que se divulga
//
// `loja.getaura.com.br/sheid-mania`. O backend serve a casca deste app
// naquele endereço e em cada tela da loja (services/vitrineStudioShell.js
// e BE-1: /p/<id>, /c/<categoria>, /finalizar...), e o roteador cai aqui.
//
// POR QUE NA RAIZ: o endereço público não tem prefixo. Um `/loja/<slug>`
// seria mais seguro de rotear, mas devolveria à cliente um endereço com
// uma palavra a mais para ela ler e digitar errado.
//
// O QUE ISSO CAPTURA: `/studio`, `/login`, `/empresas`, `/cardapio`,
// `/acompanhar/<token>` e as outras rotas da raiz são estáticas e vencem
// a dinâmica no Expo Router (__tests__/vitrineStudioRotas.test.ts
// confere com a árvore real de app/). O que sobra — `/qualquer-coisa` —
// vira uma tentativa de abrir uma loja com esse nome, e a tela mostra
// "não achamos essa loja". Num endereço de loja é a resposta certa.
//
// Onda 1B (25/09/2026): era um arquivo só (`app/[slug].tsx`) e a tela
// era só estado. Virou layout: a loja é montada UMA vez aqui e as rotas
// filhas dizem qual tela mostrar — trocar de tela não recarrega a loja
// nem perde a sacola. Ver components/studio/storefront/VitrineNaRota.tsx.
// ============================================================
import { LayoutDaVitrine } from "@/components/studio/storefront/VitrineNaRota";

export default function VitrinePublica() {
  return <LayoutDaVitrine />;
}
