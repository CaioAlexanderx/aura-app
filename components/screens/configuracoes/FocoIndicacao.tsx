import { useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { SpotlightTour, findTourTarget } from "@/components/onboarding/SpotlightTour";
import { tourSelector } from "@/utils/tourTarget";
import { ALVO_INDICACAO } from "@/utils/focoIndicacao";

// ============================================================
// Destaque do cartão "Indique e ganhe" em Configurações (tq-11).
//
// Reutiliza a primitiva SpotlightTour (auto-scroll + spotlight + tooltip
// ancorado). Só abre se o cartão existir de fato na tela: sem alvo (perfil
// ainda carregando, por exemplo) ele espera um pouco e, se o cartão não
// aparecer, não faz nada (nunca cai no modal central).
//
// Some sozinho em poucos segundos; toque fora, Esc ou "Entendi" também
// fecham, o que cobre touch (CLAUDE.md armadilha 7).
// ============================================================

const ESPERA_ALVO_MS = 4000;
const POLL_MS = 150;
export const FOCO_VISIVEL_MS = 7000;

const STEP = {
  id: "configuracoes-indicacao",
  targetSelector: tourSelector(ALVO_INDICACAO),
  title: "Seu código de indicação fica aqui",
  body: "Copie o código ou mande pelo WhatsApp para um lojista que você conhece.",
  position: "top" as const,
};

export function FocoIndicacao({ ativo }: { ativo: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  // Novo pedido de foco (o parâmetro voltou a aparecer): reabre.
  useEffect(() => {
    if (ativo) setDispensado(false);
    else setAberto(false);
  }, [ativo]);

  // Espera o cartão montar antes de abrir.
  useEffect(() => {
    if (!ativo || dispensado || Platform.OS !== "web" || typeof document === "undefined") return;
    let cancelado = false;
    let t: any = null;
    const inicio = Date.now();
    const tenta = () => {
      if (cancelado) return;
      if (findTourTarget([STEP.targetSelector])) { setAberto(true); return; }
      if (Date.now() - inicio < ESPERA_ALVO_MS) t = setTimeout(tenta, POLL_MS);
    };
    tenta();
    return () => { cancelado = true; clearTimeout(t); };
  }, [ativo, dispensado]);

  const fechar = useCallback(() => { setAberto(false); setDispensado(true); }, []);

  // Some sozinho.
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(fechar, FOCO_VISIVEL_MS);
    return () => clearTimeout(t);
  }, [aberto, fechar]);

  if (!aberto) return null;
  return (
    <SpotlightTour
      steps={[STEP]}
      open
      onComplete={fechar}
      onSkip={fechar}
      labels={{ done: "Entendi" }}
      showCounter={false}
      portal
    />
  );
}

export default FocoIndicacao;
