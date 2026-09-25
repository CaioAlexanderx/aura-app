// A sacola: `/<slug>/sacola` (Fase 2). Com a chave `vitrine_v2`, abre a
// loja com a gaveta da sacola aberta; sem ela, a home, como antes. Ver
// SacolaNaRota em VitrineNaRota.tsx.
import { SacolaNaRota } from "@/components/studio/storefront/VitrineNaRota";

export default function SacolaDaLoja() {
  return <SacolaNaRota />;
}
