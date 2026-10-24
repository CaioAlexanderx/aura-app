// ============================================================
// AURA. — ?empresa=<company_id> troca a empresa antes da tela (tq-92)
//
// Montado uma vez, no AuthGuard (app/_layout.tsx). Devolve true enquanto a
// troca está pendente ou em curso: o AuthGuard mostra o carregamento neutro
// no lugar da tela, para a loja não ver os números da empresa errada.
//
// - Lê o parâmetro com useGlobalSearchParams: vale para o link aberto com
//   sessão e para a volta do login (tq-91 guarda caminho + query).
// - Tira o parâmetro da URL com history.replaceState (não com setParams,
//   que grava "undefined" na URL; ver memória do Matcon 23/09).
// - Cada id é tratado uma vez por montagem: o estado interno do router ainda
//   guarda o parâmetro depois do replaceState, e isso não pode virar laço.
// - No web o switch recarrega a página na mesma URL (stores/auth,
//   reloadAfterSwitch); no nativo o estado novo basta.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useGlobalSearchParams } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { lerEmpresaDoLink, precisaTrocarEmpresa, urlSemEmpresa, avisoSemAcesso } from "@/utils/empresaPeloLink";

function limparEmpresaDaUrl(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const limpa = urlSemEmpresa(window.location.href);
    if (limpa) window.history.replaceState(window.history.state, "", limpa);
  } catch { /* URL fica com o parâmetro; nada quebra */ }
}

export function useEmpresaPeloLink(): boolean {
  const params = useGlobalSearchParams<{ empresa?: string | string[] }>();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const companyId = useAuthStore((s) => (s.company as any)?.id ?? null);
  const consolidatedView = useAuthStore((s) => s.consolidatedView);
  const tratadas = useRef<Set<string>>(new Set());
  const [trocando, setTrocando] = useState(false);

  const id = lerEmpresaDoLink(params?.empresa);
  const pendente = !!(
    id && token && isHydrated && !tratadas.current.has(id) &&
    precisaTrocarEmpresa(id, { companyId, consolidatedView })
  );

  useEffect(() => {
    if (!id || !token || !isHydrated) return;
    if (tratadas.current.has(id)) return;
    tratadas.current.add(id);
    limparEmpresaDaUrl();
    const st = useAuthStore.getState();
    if (!precisaTrocarEmpresa(id, { companyId: (st.company as any)?.id, consolidatedView: st.consolidatedView })) return;

    let vivo = true;
    let folga: ReturnType<typeof setTimeout> | null = null;
    setTrocando(true);
    st.switchCompany(id)
      .then(() => {
        if (Platform.OS !== "web") { if (vivo) setTrocando(false); return; }
        // Web: a página recarrega em ~200 ms. Se por algum motivo não
        // recarregar, a tela não fica presa no carregamento.
        folga = setTimeout(() => { if (vivo) setTrocando(false); }, 4000);
      })
      .catch((err: any) => {
        if (vivo) setTrocando(false);
        toast.info(avisoSemAcesso(err?.status));
      });
    return () => { vivo = false; if (folga) clearTimeout(folga); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, isHydrated]);

  return pendente || trocando;
}
