// ============================================================
// AURA. — Porta das telas da conferência de estoque (p-108)
//
// 1. Refaz o /auth/me ao abrir (armadilha 1 do CLAUDE.md: plano e
//    módulos do JWT podem estar velhos) e só decide depois dele.
// 2. Sem o módulo `conferencia_estoque` (permissão ou override), volta para
//    o Painel — quem digitou a URL de uma tela que o menu não mostra não
//    fica nela. Mesmo desenho da Black Friday (<Redirect>, que espera a
//    navegação estar pronta).
// 3. No consolidado multi-CNPJ, pergunta qual loja antes (a conferência é
//    sempre de uma loja: cada loja tem o seu estoque).
// ============================================================
import { useEffect, useState, type ReactNode } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";

export const MOD_CONFERENCIA = "conferencia_estoque";

/** true depois que o /auth/me desta abertura voltou (ou falhou: segue com o que tem). */
export function useMeAtualizado(): boolean {
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const token = useAuthStore((s) => s.token);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!token) { setPronto(true); return undefined; }
    Promise.resolve()
      .then(() => refreshMe())
      .catch(() => {})
      .then(() => { if (vivo) setPronto(true); });
    return () => { vivo = false; };
  }, [token, refreshMe]);
  return pronto;
}

export function PortaDaConferencia({ children }: { children: ReactNode }) {
  const meAtualizado = useMeAtualizado();
  const prontos = useVisibleModulesProntos();
  const visiveis = useVisibleModules();

  if (!meAtualizado || !prontos) return null;
  if (!visiveis.has(MOD_CONFERENCIA)) return <Redirect href={"/" as any} />;
  return (
    <RequireCompanyScope context={MOD_CONFERENCIA} actionLabel="conferir o estoque">
      {children}
    </RequireCompanyScope>
  );
}
