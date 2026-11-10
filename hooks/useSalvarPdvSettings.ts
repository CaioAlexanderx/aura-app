import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { toast } from "@/components/Toast";

// ============================================================
// AURA. — Gravar pdv_settings sem perder nada no caminho
//
// 10/11/2026 (incidente "a taxa da maquininha não aparece"): 14 lojas com a
// taxa ligada e as alíquotas em 0%. O ciclo de save que o PdvSettingsCard e
// o card da taxa do Studio usavam tinha três jeitos de perder o que a
// lojista digitou:
//   1. `if (saving) return` — uma mudança que chegasse com outro PUT no ar
//      (ex.: sair do crédito e logo do débito) era jogada fora, sem aviso;
//   2. depois do PUT, `setPendingSettings(null)` + `invalidate()` voltavam a
//      tela para o cache VELHO até o GET responder (~400 ms). O próximo save
//      nessa janela partia do velho e regravava a alíquota anterior (0);
//   3. o campo ficava `editable={false}` durante o save e o que se digitava
//      nesse meio-tempo sumia.
//
// Aqui cada mudança entra numa FILA (um PUT por vez, nada é descartado). O
// corpo é montado na hora de enviar: o último salvo (cache) + tudo que ainda
// está pendente — então dois saves seguidos nunca apagam um ao outro. A
// resposta do PUT vira o cache na hora (setQueryData), sem janela de cache
// velho. Na tela vale o otimista (pendente por cima do salvo).
//
// O PUT do backend faz merge com o salvo; o corpo segue sendo o objeto
// inteiro, como antes, para não mudar o contrato de quem já usa.
// ============================================================

type Valor = PdvSettings[keyof PdvSettings] | boolean | number | string | null;

export function useSalvarPdvSettings() {
  const { company } = useAuthStore();
  const { settings: serverSettings, isLoading, error, invalidate } = usePdvSettings();
  const qc = useQueryClient();

  const [pendente, setPendente] = useState<Partial<PdvSettings>>({});
  const [emVoo, setEmVoo] = useState(0);
  const pendenteRef = useRef<Partial<PdvSettings>>({});
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const servidorRef = useRef<PdvSettings>(serverSettings);
  servidorRef.current = serverSettings;

  const display = useMemo(
    () => ({ ...serverSettings, ...pendente }) as PdvSettings,
    [serverSettings, pendente],
  );

  function trocarPendente(novo: Partial<PdvSettings>) {
    pendenteRef.current = novo;
    setPendente(novo);
  }

  function salvar(key: keyof PdvSettings, value: Valor): Promise<boolean> {
    const companyId = company?.id;
    if (!companyId) return Promise.resolve(false);
    const queryKey = ["pdv-settings", companyId];

    trocarPendente({ ...pendenteRef.current, [key]: value } as Partial<PdvSettings>);
    setEmVoo((n) => n + 1);

    const rodada = fila.current.then(async () => {
      // Um PUT anterior já levou esta mudança: nada a enviar.
      if (Object.keys(pendenteRef.current).length === 0) return true;
      const cache = qc.getQueryData<{ settings?: PdvSettings }>(queryKey);
      const corpo = { ...(cache?.settings || servidorRef.current), ...pendenteRef.current } as PdvSettings;
      try {
        const res = await pdvSettingsApi.save(companyId, corpo);
        const salvo = (res && res.settings) || corpo;
        qc.setQueryData(queryKey, (old: any) => ({ ...(old || {}), settings: { ...((old && old.settings) || {}), ...salvo } }));
        // Sai do otimista só o que este PUT levou e não mudou desde então.
        const resto: Record<string, unknown> = { ...pendenteRef.current };
        Object.keys(resto).forEach((k) => { if (resto[k] === (corpo as any)[k]) delete resto[k]; });
        trocarPendente(resto as Partial<PdvSettings>);
        return true;
      } catch (err: any) {
        const resto: Record<string, unknown> = { ...pendenteRef.current };
        if (resto[key as string] === value) delete resto[key as string];
        trocarPendente(resto as Partial<PdvSettings>);
        toast.error((err && err.data && err.data.error) || "Erro ao salvar");
        return false;
      } finally {
        setEmVoo((n) => n - 1);
      }
    });
    fila.current = rodada.catch(() => undefined);
    return rodada;
  }

  return { display, salvar, saving: emVoo > 0, isLoading, error, invalidate };
}
