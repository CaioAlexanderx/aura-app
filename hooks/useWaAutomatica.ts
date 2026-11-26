// useWaAutomatica — escolhas e prévia (quem cabe) de UMA automática, e os
// modelos de mensagem. Nada otimista: a tela só muda com a resposta do
// servidor. Resposta torta = `previa` em null e a tela trava o envio.
import { useCallback, useEffect, useState } from "react";
import { waConfigApi, type WaAutoKey, type WaModeloRaw, type WaPreviaRaw } from "@/services/waConfigApi";
import { mapWaError } from "@/components/whatsapp/waGuards";
import { waCorte, type Corte, type PessoaPrevia } from "@/components/whatsapp/waCorte";

export interface Detalhe {
  config: Record<string, any>;
  previa: WaPreviaRaw | null;
}

/** Corte já calculado para a prévia, ou null se o servidor não mandou o suficiente. */
export function corteDaPrevia(previa: WaPreviaRaw | null | undefined, porClienteLocal?: number | null): Corte | null {
  if (!previa) return null;
  const pessoas: PessoaPrevia[] = (previa.pessoas || [])
    .filter((p) => p && typeof p.nome === "string")
    .map((p) => ({ nome: String(p.nome), detalhe: typeof p.detalhe === "string" ? p.detalhe : "" }));
  const por = typeof previa.por_cliente === "number" ? previa.por_cliente : porClienteLocal ?? 1;
  return waCorte({ pessoas, total: previa.total, reserva: previa.reserva, porCliente: por });
}

export function useWaAutomatica(companyId: string | null | undefined, key: WaAutoKey, enabled: boolean = true) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<number | null>(null);
  const ativo = !!companyId && enabled;

  const aplicar = (r: any): boolean => {
    if (!r || typeof r !== "object") { setDetalhe(null); setFalhou(true); return false; }
    setDetalhe({ config: r.config && typeof r.config === "object" ? r.config : {}, previa: r.previa || null });
    setFalhou(false);
    return true;
  };

  const recarregar = useCallback(async () => {
    if (!ativo) { setCarregando(false); return; }
    setCarregando(true);
    try {
      aplicar(await waConfigApi.getAutomatica(companyId as string, key));
    } catch {
      setDetalhe(null);
      setFalhou(true);
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, companyId, key]);

  useEffect(() => { setEnviado(null); recarregar(); }, [recarregar]);

  const salvarConfig = useCallback(async (patch: Record<string, any>) => {
    if (!ativo || salvando) return false;
    setSalvando(true);
    setErro(null);
    try {
      return aplicar(await waConfigApi.putConfig(companyId as string, key, patch));
    } catch (e: any) {
      setErro(mapWaError(e).message);
      return false;
    } finally {
      setSalvando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, salvando, companyId, key]);

  const enviarAgora = useCallback(async (quantidade: number) => {
    if (!ativo || salvando || !(quantidade > 0)) return false;
    setSalvando(true);
    setErro(null);
    try {
      const r = await waConfigApi.enviarAgora(companyId as string, key, quantidade);
      setEnviado(typeof r?.enfileiradas === "number" ? r.enfileiradas : quantidade);
      await recarregar();
      return true;
    } catch (e: any) {
      setErro(mapWaError(e).message);
      return false;
    } finally {
      setSalvando(false);
    }
  }, [ativo, salvando, companyId, key, recarregar]);

  return { detalhe, carregando, falhou, salvando, erro, enviado, recarregar, salvarConfig, enviarAgora };
}

export type UseWaAutomatica = ReturnType<typeof useWaAutomatica>;

/** Os modelos de mensagem (o texto que o cliente lê), com o estado de aprovação. */
export function useWaModelos(companyId: string | null | undefined, enabled: boolean = true) {
  const [modelos, setModelos] = useState<WaModeloRaw[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const ativo = !!companyId && enabled;

  const recarregar = useCallback(async () => {
    if (!ativo) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const r = await waConfigApi.getModelos(companyId as string);
      setModelos(Array.isArray(r?.data) ? (r.data as WaModeloRaw[]) : null);
    } catch {
      setModelos(null);
    } finally {
      setCarregando(false);
    }
  }, [ativo, companyId]);

  useEffect(() => { recarregar(); }, [recarregar]);

  return { modelos, carregando, recarregar };
}
export type UseWaModelos = ReturnType<typeof useWaModelos>;
