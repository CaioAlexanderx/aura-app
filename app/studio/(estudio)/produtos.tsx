// ============================================================
// AURA STUDIO · /studio/produtos (REDIRECT pra /studio/estoque)
//
// 26/05/2026 — Integração final pós-Sprints 1-4.
// O fluxo de cadastro + personalização + ficha técnica + templates
// foi unificado em /studio/estoque (drawer com 4 tabs). Esta rota
// vira redirect pra compat backward — caches do shell ou links
// antigos continuam funcionando, mas o destino é a tela master.
// ============================================================
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function StudioProdutosRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/studio/estoque");
  }, [router]);
  return null;
}
