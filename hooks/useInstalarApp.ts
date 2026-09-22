// ============================================================
// AURA. — useInstalarApp: o estado de "instalar como app" para a interface
//
// Criado: 22/09/2026 (PWA Fase 1)
//
// Embrulho em React de services/instalarApp.ts. O card do Painel
// (components/InstallBanner.tsx) e o de Configurações
// (components/screens/configuracoes/AuraNoCelularCard.tsx) leem daqui, e
// ninguém detecta plataforma na mão.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import {
  aoMudar,
  dispensar,
  ENDERECO_DO_PAINEL,
  estadoDaInstalacao,
  estaDispensado,
  instalar,
  type EstadoDaInstalacao,
} from "@/services/instalarApp";

export type UsoDeInstalarApp = EstadoDaInstalacao & {
  /** "Agora não" ainda vale (14 dias). */
  dispensado: boolean;
  /** Chama o convite nativo (Android/desktop). Sem convite, "indisponivel". */
  instalar: () => Promise<"aceito" | "recusado" | "indisponivel">;
  /** Esconde o convite por 14 dias. */
  dispensar: () => void;
  enderecoDoPainel: string;
};

export function useInstalarApp(): UsoDeInstalarApp {
  const [estado, setEstado] = useState<EstadoDaInstalacao>(() => estadoDaInstalacao());
  const [dispensado, setDispensado] = useState<boolean>(() => estaDispensado());

  useEffect(() => aoMudar(() => setEstado(estadoDaInstalacao())), []);

  const instalarAgora = useCallback(async () => {
    const resultado = await instalar();
    setEstado(estadoDaInstalacao());
    return resultado;
  }, []);

  const dispensarAgora = useCallback(() => {
    dispensar();
    setDispensado(true);
  }, []);

  return { ...estado, dispensado, instalar: instalarAgora, dispensar: dispensarAgora, enderecoDoPainel: ENDERECO_DO_PAINEL };
}
