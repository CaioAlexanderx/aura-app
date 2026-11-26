// useWaAutomaticas — divisão das novidades e liga/desliga das três automáticas.
//
// Nada é otimista: o toque vai ao servidor e a tela só muda com a
// resposta (ou com a releitura). Erro, rota ausente ou resposta torta
// deixam `info` em null e a tela trava. Mensagem de erro do servidor
// (ex.: divisão acima do saldo) volta em `erro`, em português.
import { useCallback, useEffect, useState } from "react";
import { waConfigApi, type WaAutoKey } from "@/services/waConfigApi";
import { mapWaError } from "@/components/whatsapp/waGuards";
import { ajustarParte, divisaoValida, lerAutomaticas, type AutomaticasInfo, type Partes } from "@/components/whatsapp/waDivisao";

export interface UseWaAutomaticas {
  info: AutomaticasInfo | null;
  carregando: boolean;
  falhou: boolean;
  salvando: boolean;
  erro: string | null;
  recarregar: () => void;
  /** +1 / −1 numa parte. `total` = saldo de novidades do mês. */
  ajustar: (key: WaAutoKey, delta: 1 | -1, total: number) => Promise<void>;
  ligar: (key: WaAutoKey, ligada: boolean) => Promise<boolean>;
  aplicarDivisao: (prox: Partes, total: number) => Promise<boolean>;
}

export function useWaAutomaticas(companyId: string | null | undefined, enabled: boolean = true): UseWaAutomaticas {
  const [info, setInfo] = useState<AutomaticasInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = !!companyId && enabled;

  const recarregar = useCallback(async () => {
    if (!ativo) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const lido = lerAutomaticas(await waConfigApi.getAutomaticas(companyId as string));
      setInfo(lido);
      setFalhou(lido == null);
    } catch {
      setInfo(null);
      setFalhou(true);
    } finally {
      setCarregando(false);
    }
  }, [ativo, companyId]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const aplicar = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setSalvando(true);
    setErro(null);
    try {
      await fn();
      // Quem manda é o servidor: relê em vez de confiar no que a tela supõe.
      const lido = lerAutomaticas(await waConfigApi.getAutomaticas(companyId as string));
      setInfo(lido);
      setFalhou(lido == null);
      return lido != null;
    } catch (e: any) {
      setErro(mapWaError(e).message);
      return false;
    } finally {
      setSalvando(false);
    }
  }, [companyId]);

  const ajustar = useCallback(async (key: WaAutoKey, delta: 1 | -1, total: number) => {
    if (!info || salvando || !ativo) return;
    const prox = ajustarParte(info.divisao, info.usadas, key, delta, total);
    if (prox === info.divisao) return; // toque travado: nem chega ao servidor
    await aplicar(() => waConfigApi.putDivisao(companyId as string, prox));
  }, [info, salvando, ativo, aplicar, companyId]);

  /** Grava uma divisão inteira (ex.: "Trazer 3 do Venda+"). Confere a regra antes de ir ao servidor. */
  const aplicarDivisao = useCallback(async (prox: Partes, total: number) => {
    if (!info || salvando || !ativo) return false;
    if (!divisaoValida(prox, info.usadas, total)) return false;
    return aplicar(() => waConfigApi.putDivisao(companyId as string, prox));
  }, [info, salvando, ativo, aplicar, companyId]);

  const ligar = useCallback(async (key: WaAutoKey, ligada: boolean) => {
    if (!info || salvando || !ativo) return false;
    return aplicar(() => waConfigApi.setLigada(companyId as string, key, ligada));
  }, [info, salvando, ativo, aplicar, companyId]);

  return { info, carregando, falhou, salvando, erro, recarregar, ajustar, ligar, aplicarDivisao };
}
