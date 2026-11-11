import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { destinoDoVoltarCatalogo } from "@/utils/voltarDoCatalogo";

// "Voltar" das telas /catalogo/*: ver utils/voltarDoCatalogo.ts.
export function useVoltarDoCatalogo() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ de?: string }>();
  const de = typeof params?.de === "string" ? params.de : null;

  return function voltar() {
    let rotaAnterior: string | null = null;
    try {
      const state: any = (navigation as any)?.getState?.();
      if (state && typeof state.index === "number" && state.index > 0) {
        rotaAnterior = state.routes?.[state.index - 1]?.name ?? null;
      }
    } catch {
      rotaAnterior = null;
    }
    const destino = destinoDoVoltarCatalogo({ rotaAnterior, de });
    if (destino.tipo === "back" && router.canGoBack()) router.back();
    else router.replace((destino.tipo === "replace" ? destino.href : "/estoque") as any);
  };
}

export default useVoltarDoCatalogo;
