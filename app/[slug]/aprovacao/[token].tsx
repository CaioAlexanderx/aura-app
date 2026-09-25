// ============================================================
// `/<slug>/aprovacao/<token>` — aprovar a arte no endereço da loja, com a
// marca dela (Fase 4 · decisão do PO Q9). Era rota reservada da Fase 1B
// (levava à home); o servidor já serve a casca aqui (BE-1).
//
// O layout (VitrineNaRota.tsx, ehPaginaDoPosCompra) desenha esta página
// SEM a casca da loja: ela tem o próprio payload com a marca.
// ============================================================
import { useLocalSearchParams } from "expo-router";
import { useEntradaPeloPosCompra } from "@/components/studio/storefront/VitrineNaRota";
import { PaginaDaAprovacao } from "@/components/studio/storefront/posCompra/PaginasDoPosCompra";
import { slugDaVitrine } from "@/components/studio/storefront/slugDaVitrine";

export default function AprovacaoNaLoja() {
  const params = useLocalSearchParams<{ slug: string; token: string }>();
  const slug = slugDaVitrine(params.slug);
  useEntradaPeloPosCompra(slug);
  return <PaginaDaAprovacao slug={slug} token={String(params.token || "")} />;
}
