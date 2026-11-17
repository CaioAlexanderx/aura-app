// ============================================================
// `/<slug>/personalizar/<id>` — SÓ o personalizador da peça, para a loja
// comum abrir num quadro (iframe) quando a cliente toca em "Personalizar"
// (p-181, loja única 3.3a). Nenhuma loja chama esta rota ainda: quem
// chama é o p-182, do lado do backend.
//
// O layout (VitrineNaRota.tsx, ehPaginaSemCasca) desenha esta página SEM
// a casca da vitrine Studio: sem cabeçalho, sacola, rodapé nem
// consentimento — a página mãe é a loja.
//
// O contrato das mensagens (postMessage) com a loja, e as origens que ele
// aceita, estão no topo de
// components/studio/storefront/quadro/mensagensDoQuadro.ts.
// ============================================================
import { useLocalSearchParams } from "expo-router";
import { PersonalizadorNoQuadro } from "@/components/studio/storefront/quadro/PersonalizadorNoQuadro";
import { slugDaVitrine } from "@/components/studio/storefront/slugDaVitrine";

export default function PersonalizarNoQuadro() {
  const consulta = useLocalSearchParams<{ slug: string; id: string }>();
  return (
    <PersonalizadorNoQuadro
      slug={slugDaVitrine(consulta.slug)}
      produtoId={String(consulta.id || "")}
      consulta={consulta}
    />
  );
}
