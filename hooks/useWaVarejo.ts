// ============================================================
// useWaVarejo — o WhatsApp REAL da loja (Fase 6i)
//
// A aba WhatsApp do varejo era maquete (useWhatsApp, MOCK_*). Este hook
// é o outro lado: status, templates e fila vindos do backend de verdade,
// nas mesmas rotas /companies/:id/whatsapp/* que o dojô já usa.
//
// Duas regras que valem mais que a ergonomia:
//
// 1. Falhar carregando o status deixa `status` em null — e null bloqueia
//    TODO envio automático (waAutoBlockers devolve SEM_STATUS). O lado
//    certo do erro é não enviar.
// 2. 409 NAO_CONECTADO não é erro de tela: é a loja ainda não ter
//    conectado o número. Vira estado vazio com orientação, nunca um
//    alerta vermelho com código.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { waApi, WaOutboxItem, WaStatus, WaTemplate } from "@/services/waApi";
import { mapWaError } from "@/components/whatsapp/waGuards";

export interface UseWaVarejo {
  status: WaStatus | null;
  statusLoading: boolean;
  templates: WaTemplate[];
  templatesLoading: boolean;
  templatesNotConnected: boolean;
  templatesError: string | null;
  outbox: WaOutboxItem[];
  outboxLoading: boolean;
  outboxNotConnected: boolean;
  outboxError: string | null;
  reloadStatus: () => void;
  reloadTemplates: () => void;
  reloadOutbox: () => void;
  reloadAll: () => void;
}

export function useWaVarejo(companyId: string | null | undefined, enabled: boolean = true): UseWaVarejo {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesNotConnected, setTemplatesNotConnected] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [outbox, setOutbox] = useState<WaOutboxItem[]>([]);
  const [outboxLoading, setOutboxLoading] = useState(true);
  const [outboxNotConnected, setOutboxNotConnected] = useState(false);
  const [outboxError, setOutboxError] = useState<string | null>(null);

  const ativo = !!companyId && enabled;

  const reloadStatus = useCallback(async () => {
    if (!ativo) { setStatusLoading(false); return; }
    setStatusLoading(true);
    try {
      setStatus(await waApi.getStatus(companyId as string));
    } catch {
      // null bloqueia o automático — é exatamente o que queremos aqui.
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [ativo, companyId]);

  const reloadTemplates = useCallback(async () => {
    if (!ativo) { setTemplatesLoading(false); return; }
    setTemplatesLoading(true);
    setTemplatesError(null);
    setTemplatesNotConnected(false);
    try {
      const res = await waApi.listTemplates(companyId as string);
      setTemplates(res?.data || []);
    } catch (e: any) {
      const mapped = mapWaError(e);
      if (mapped.code === "NAO_CONECTADO") setTemplatesNotConnected(true);
      else setTemplatesError(mapped.message);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [ativo, companyId]);

  const reloadOutbox = useCallback(async () => {
    if (!ativo) { setOutboxLoading(false); return; }
    setOutboxLoading(true);
    setOutboxError(null);
    setOutboxNotConnected(false);
    try {
      const res = await waApi.listOutbox(companyId as string);
      setOutbox(res?.data || []);
    } catch (e: any) {
      const mapped = mapWaError(e);
      if (mapped.code === "NAO_CONECTADO") setOutboxNotConnected(true);
      else setOutboxError(mapped.message);
      setOutbox([]);
    } finally {
      setOutboxLoading(false);
    }
  }, [ativo, companyId]);

  const reloadAll = useCallback(() => {
    reloadStatus();
    reloadTemplates();
    reloadOutbox();
  }, [reloadStatus, reloadTemplates, reloadOutbox]);

  useEffect(() => { reloadStatus(); }, [reloadStatus]);
  useEffect(() => { reloadTemplates(); }, [reloadTemplates]);
  useEffect(() => { reloadOutbox(); }, [reloadOutbox]);

  return {
    status, statusLoading,
    templates, templatesLoading, templatesNotConnected, templatesError,
    outbox, outboxLoading, outboxNotConnected, outboxError,
    reloadStatus, reloadTemplates, reloadOutbox, reloadAll,
  };
}
