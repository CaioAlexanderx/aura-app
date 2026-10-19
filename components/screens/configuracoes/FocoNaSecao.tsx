import { useEffect, useState, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { SpotlightTour, findTourTarget } from "@/components/onboarding/SpotlightTour";
import { tourSelector } from "@/utils/tourTarget";
import type { SecaoComFoco } from "@/utils/focoNaSecao";

// ============================================================
// Destaque de uma seção de Configurações (/configuracoes?foco=<chave>).
//
// Nasceu para o cartão "Indique e ganhe" (tq-11, app#1070) e virou
// genérico no card p-19 (18/10/2026): recebe a seção do registro
// (utils/focoNaSecao.ts) e reutiliza a primitiva SpotlightTour
// (auto-scroll + spotlight + tooltip ancorado).
//
// Só abre se a seção existir de fato na tela: sem alvo (perfil ou cartão
// ainda carregando, por exemplo) ele espera um pouco e, se a seção não
// aparecer, não faz nada (nunca cai no modal central).
//
// Some sozinho em poucos segundos; toque fora, Esc ou "Entendi" também
// fecham, o que cobre touch (CLAUDE.md armadilha 7).
// ============================================================

// Algumas seções moram dentro de cartões que carregam os próprios dados
// (Políticas do Caixa, por exemplo): a espera cobre esse segundo carregamento.
const ESPERA_ALVO_MS = 6000;
const POLL_MS = 150;
export const FOCO_VISIVEL_MS = 7000;

export function FocoNaSecao({ secao }: { secao: SecaoComFoco | null }) {
  const [aberto, setAberto] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const chave = secao ? secao.chave : null;

  const step = useMemo(() => (secao ? {
    id: "configuracoes-foco-" + secao.chave,
    targetSelector: tourSelector(secao.alvo),
    title: secao.titulo,
    body: secao.texto,
    position: "top" as const,
  } : null), [secao]);

  // Novo pedido de foco (o parâmetro mudou ou voltou a aparecer): recomeça.
  useEffect(() => {
    setAberto(false);
    setDispensado(false);
  }, [chave]);

  // Espera a seção montar antes de abrir.
  useEffect(() => {
    if (!step || dispensado || Platform.OS !== "web" || typeof document === "undefined") return;
    let cancelado = false;
    let t: any = null;
    const inicio = Date.now();
    const tenta = () => {
      if (cancelado) return;
      if (findTourTarget([step.targetSelector])) { setAberto(true); return; }
      if (Date.now() - inicio < ESPERA_ALVO_MS) t = setTimeout(tenta, POLL_MS);
    };
    tenta();
    return () => { cancelado = true; clearTimeout(t); };
  }, [step, dispensado]);

  const fechar = useCallback(() => { setAberto(false); setDispensado(true); }, []);

  // Some sozinho.
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(fechar, FOCO_VISIVEL_MS);
    return () => clearTimeout(t);
  }, [aberto, fechar]);

  if (!aberto || !step) return null;
  return (
    <SpotlightTour
      steps={[step]}
      open
      onComplete={fechar}
      onSkip={fechar}
      labels={{ done: "Entendi" }}
      showCounter={false}
      portal
    />
  );
}

export default FocoNaSecao;
