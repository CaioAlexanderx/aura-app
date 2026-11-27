// ============================================================
// Hub — para onde vai o "Fazer um orçamento novo" da folha de orçamentos.
// Cada frente tem o seu: Personalizados (Orçamentos 3D) ou Matcon. A tela lê os
// módulos visíveis da loja; sem nenhum dos dois (ex.: Ótica, que não tem
// tela de orçamento própria), devolve null e o link some.
// ============================================================
import { useVisibleModules } from "@/hooks/useVisibleModules";

export function useOrcamentoNovo(): string | null {
  const mods = useVisibleModules();
  if (mods.has("personalizados.orcamentos")) return "/personalizados/orcamentos";
  if (mods.has("matcon.orcamentos")) return "/matcon/orcamentos";
  return null;
}