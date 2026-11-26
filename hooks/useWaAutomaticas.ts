// useWaAutomaticas — divisão das novidades, liga/desliga e escolhas das
// automáticas (contrato do agente B).
//
// Nada é otimista: o toque vai ao servidor e a tela só muda com a releitura
// do GET /automaticas. Erro, rota ausente ou resposta torta deixam `info`
// em null e a tela trava. A frase de erro do servidor (já em português)
// volta em `erro`; o código (ex.: SEM_ACEITE_NOVIDADES) volta no resultado.
import { useCallback, useEffect, useState } from "react";
import { waConfigApi, erroConfig, type WaAutoKey } from "@/services/waConfigApi";
import {
  AUTOMATICA_DA_PARTE, ajustarParte, divisaoValida, lerAutomaticas,
  type AutoKey, type AutomaticasInfo, type Partes,
} from "@/components/whatsapp/waDivisao";

export interface ResultadoEscrita { ok: boolean; code: string | null }

export interface UseWaAutomaticas {
  info: AutomaticasInfo | null;
  carregando: boolean;
  falhou: boolean;
  salvando: boolean;
  erro: string | null;
  recarregar: () => void;
  /** +1 / −1 numa parte. */
  ajustar: (parte: AutoKey, delta: 1 | -1) => Promise<void>;
  /** Grava uma divisão inteira (ex.: "Trazer 3 do Venda+"). */
  aplicarDivisao: (prox: Partes) => Promise<boolean>;
  /** Liga/desliga. `aceite` reenvia o PUT depois da pergunta. */
  ligar: (key: WaAutoKey, ligada: boolean, aceite?: boolean) => Promise<ResultadoEscrita>;
  /** Muda só a config (mantém ligada como está). */
  salvarConfig: (key: WaAutoKey, config: Record<string, any>) => Promise<ResultadoEscrita>;
}

export function useWaAutomaticas(companyId: string | null | undefined, enabled: boolean = true): UseWaAutomaticas {
  const [info, setInfo] = useState<AutomaticasInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = !!companyId && enabled;

  const ler = useCallback(async () => {
    const lido = lerAutomaticas(await waConfigApi.getAutomaticas(companyId as string));
    setInfo(lido);
    setFalhou(lido == null);
    return lido;
  }, [companyId]);

  const recarregar = useCallback(async () => {
    if (!ativo) { setCarregando(false); return; }
    setCarregando(true);
    try {
      await ler();
    } catch {
      setInfo(null);
      setFalhou(true);
    } finally {
      setCarregando(false);
    }
  }, [ativo, ler]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const escrever = useCallback(async (fn: () => Promise<unknown>): Promise<ResultadoEscrita> => {
    setSalvando(true);
    setErro(null);
    try {
      await fn();
    } catch (e: any) {
      const er = erroConfig(e);
      setErro(er.message);
      setSalvando(false);
      return { ok: false, code: er.code };
    }
    try {
      // Quem manda é o servidor: relê em vez de confiar no que a tela supõe.
      const lido = await ler();
      setSalvando(false);
      return { ok: lido != null, code: null };
    } catch {
      setInfo(null);
      setFalhou(true);
      setSalvando(false);
      return { ok: false, code: null };
    }
  }, [ler]);

  const aplicarDivisao = useCallback(async (prox: Partes) => {
    if (!info || salvando || !ativo) return false;
    if (!divisaoValida(prox, info.usadas, info.total)) return false; // nem chega ao servidor
    return (await escrever(() => waConfigApi.putDivisao(companyId as string, prox))).ok;
  }, [info, salvando, ativo, escrever, companyId]);

  const ajustar = useCallback(async (parte: AutoKey, delta: 1 | -1) => {
    if (!info || salvando || !ativo) return;
    const prox = ajustarParte(info.divisao, info.usadas, parte, delta, info.total);
    if (prox === info.divisao) return; // toque travado
    await aplicarDivisao(prox);
  }, [info, salvando, ativo, aplicarDivisao]);

  const ligar = useCallback(async (key: WaAutoKey, ligada: boolean, aceite?: boolean) => {
    if (!info || salvando || !ativo) return { ok: false, code: null };
    const r = await escrever(() =>
      waConfigApi.putAutomatica(companyId as string, key, { ligada, ...(aceite ? { aceite_novidades: true } : {}) }));
    // O servidor pede a pergunta: não é erro de tela, é o passo seguinte.
    if (r.code === "SEM_ACEITE_NOVIDADES") setErro(null);
    return r;
  }, [info, salvando, ativo, escrever, companyId]);

  const salvarConfig = useCallback(async (key: WaAutoKey, config: Record<string, any>) => {
    if (!info || salvando || !ativo) return { ok: false, code: null };
    const ligada = info.autos[key]?.ligada === true;
    return escrever(() => waConfigApi.putAutomatica(companyId as string, key, { ligada, config }));
  }, [info, salvando, ativo, escrever, companyId]);

  return { info, carregando, falhou, salvando, erro, recarregar, ajustar, aplicarDivisao, ligar, salvarConfig };
}

/** A automática de cada parte (útil para o "Ligado · N de M livres"). */
export function autoDaParte(parte: AutoKey): WaAutoKey {
  return AUTOMATICA_DA_PARTE[parte];
}
