// ============================================================
// app/cardapio/studio/[slug].tsx
//
// O endereço de dentro de casa da vitrine. O público é
// `loja.getaura.com.br/<slug>`, servido por `app/[slug].tsx` — os dois
// abrem a MESMA tela (components/studio/storefront/PaginaDaVitrine.tsx).
//
// Este caminho fica de pé porque é por ele que se abre a vitrine direto
// no app, sem passar pelo backend: preview do painel, dev server, e
// qualquer link antigo. "cardápio" numa loja de canecas parece
// restaurante, e por isso ele deixou de ser o endereço que se divulga.
// ============================================================
import { useLocalSearchParams } from "expo-router";
import { PaginaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { slugDaVitrine } from "@/components/studio/storefront/slugDaVitrine";

export default function StudioStorefrontPage() {
  const params = useLocalSearchParams<{ slug: string }>();
  return <PaginaDaVitrine slug={slugDaVitrine(params.slug)} />;
}
