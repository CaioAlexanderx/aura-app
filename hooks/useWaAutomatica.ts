// useWaAutomatica — a prévia (quem cabe) de UMA automática, o envio agora e
// os modelos de mensagem. Nada otimista: a tela só muda com a resposta do
// servidor. Resposta torta = `corte` em null e a tela trava o envio.
import { useCallback, useEffect, useState } from "react";
import {
  waConfigApi, erroConfig, type WaAutoKey, type WaEnviarAgoraRaw, type WaModeloRaw, type WaPublicoRaw,
} from "@/services/waConfigApi";
import { waCorte, type Corte } from "@/components/whatsapp/waCorte";

export function useWaPublico(
  companyId: string | null | undefined, key: WaAutoKey, segmento: string | undefined,
  livres: number | null | undefined, enabled: boolean = true,
  /** Muda quando a config muda (a prévia depende dela): refaz a leitura. */
  versao: string = "",
) {
  const [publico, setPublico] = useState<WaPublicoRaw | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<WaEnviarAgoraRaw | null>(null);
  const ativo = !!companyId && enabled;

  const recarregar = useCallback(async () => {
    if (!ativo) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const r = await waConfigApi.getPublico(companyId as string, key, segmento);
      setPublico(r && typeof r === "object" ? r : null);
      setFalhou(!r || typeof r !== "object");
    } catch {
      setPublico(null);
      setFalhou(true);
    } finally {
      setCarregando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, companyId, key, segmento, versao]);

  useEffect(() => { setEnviado(null); recarregar(); }, [recarregar]);

  const corte: Corte | null = waCorte(publico, livres);

  /** Manda agora. O servidor refaz o corte; a lista da tela não é aceita. */
  const enviarAgora = useCallback(async (): Promise<boolean> => {
    if (!ativo || enviando) return false;
    setEnviando(true);
    setErro(null);
    try {
      setEnviado(await waConfigApi.enviarAgora(companyId as string, key, segmento));
      await recarregar();
      return true;
    } catch (e: any) {
      setErro(erroConfig(e).message);
      return false;
    } finally {
      setEnviando(false);
    }
  }, [ativo, enviando, companyId, key, segmento, recarregar]);

  return { publico, corte, carregando, falhou, enviando, erro, enviado, recarregar, enviarAgora };
}
export type UseWaPublico = ReturnType<typeof useWaPublico>;

/** Os modelos de mensagem (o texto que o cliente lê), com o estado de aprovação. */
export function useWaModelos(companyId: string | null | undefined, automatica: string, enabled: boolean = true) {
  const [modelos, setModelos] = useState<WaModeloRaw[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const ativo = !!companyId && enabled;

  const recarregar = useCallback(async () => {
    if (!ativo) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const r = await waConfigApi.getModelos(companyId as string, automatica);
      setModelos(Array.isArray(r?.data) ? (r.data as WaModeloRaw[]) : null);
    } catch {
      setModelos(null);
    } finally {
      setCarregando(false);
    }
  }, [ativo, companyId, automatica]);

  useEffect(() => { recarregar(); }, [recarregar]);

  return { modelos, carregando, recarregar };
}
export type UseWaModelos = ReturnType<typeof useWaModelos>;
