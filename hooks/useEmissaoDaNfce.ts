// ============================================================
// useEmissaoDaNfce (17/11/2026, p-147): o estado da NFC-e de uma chave, lido
// de services/emissaoDaNfce (fora do componente, sobrevive à tela final).
// ============================================================
import { useCallback, useSyncExternalStore } from "react";
import { assinarNota, estadoDaNota, NOTA_PARADA, type EstadoDaNota } from "@/services/emissaoDaNfce";

export function useEmissaoDaNfce(chave: string | null | undefined): EstadoDaNota {
  const assinar = useCallback((fn: () => void) => (chave ? assinarNota(chave, fn) : () => {}), [chave]);
  const ler = useCallback(() => (chave ? estadoDaNota(chave) : NOTA_PARADA), [chave]);
  return useSyncExternalStore(assinar, ler, ler);
}

export default useEmissaoDaNfce;
