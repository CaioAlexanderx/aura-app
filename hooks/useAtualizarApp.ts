// ============================================================
// AURA. — useAtualizarApp: o botão "Atualizar" para a interface
//
// Criado: 22/09/2026 (PWA — botão de atualizar)
//
// Embrulho em React de services/atualizarApp.ts. Um toque só: verifica e,
// se tiver versão nova, já recarrega — ninguém quer tocar duas vezes para
// receber o que pediu.
//
// Dois detalhes que vieram do uso e não da teoria:
//
//  1. quando NÃO dá para verificar (offline, dev, fetch bloqueado) o
//     usuário continua com um app possivelmente velho na mão e sem F5.
//     Então o segundo toque recarrega na fé — recarregar é inofensivo, e
//     deixar a pessoa sem saída não é;
//  2. o texto é daqui, não de cada card. O varejo é violeta e o Karatê é
//     Shoji, então a ROUPA é de cada um (dois componentes honestos, como
//     no guia do iPhone), mas a FRASE é uma só, senão as duas versam
//     diferente sobre a mesma coisa em duas semanas.
//
// 13/10/2026 — janela de congelamento: dentro dela uma versão nova que não
// é hotfix vira "pausada" (services/atualizarApp) e NÃO recarrega. O segundo
// toque de "indisponivel" continua recarregando na fé: é pedido explícito de
// quem está sem saída, e sem hash não há versão nova para decidir sobre.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import {
  atualizarAgora,
  verificarAtualizacao,
  type ResultadoDaVerificacao,
} from "@/services/atualizarApp";

export type EstadoDaAtualizacao = "parado" | "verificando" | ResultadoDaVerificacao;

export type UsoDeAtualizarApp = {
  estado: EstadoDaAtualizacao;
  /** Verifica e, se houver versão nova, recarrega. */
  atualizar: () => Promise<void>;
  /** Trabalhando: desabilita o botão. */
  ocupado: boolean;
};

/** Frase de apoio da linha. Uma só, para os dois cards. */
export function detalheDaAtualizacao(estado: EstadoDaAtualizacao): string {
  switch (estado) {
    case "verificando":
      return "Procurando uma versão mais nova...";
    case "nova":
      return "Versão nova encontrada. Recarregando...";
    case "atualizado":
      return "Você já está na versão mais nova.";
    case "pausada":
      // Janela de congelamento: o lojista não sabe que existe, e para ele a
      // versão liberada é a que ele tem. A explicação é só da equipe
      // (hooks/useAvisoDeCongelamento).
      return "Você já está na versão mais nova.";
    case "indisponivel":
      return "Não deu para verificar agora. Toque de novo para recarregar.";
    default:
      return "Recarrega o app com a última versão publicada.";
  }
}

/** Rótulo do botão da linha. Uma só, para os dois cards. */
export function rotuloDaAtualizacao(estado: EstadoDaAtualizacao): string {
  if (estado === "verificando" || estado === "nova") return "...";
  if (estado === "indisponivel") return "Recarregar";
  return "Atualizar";
}

export function useAtualizarApp(): UsoDeAtualizarApp {
  const [estado, setEstado] = useState<EstadoDaAtualizacao>("parado");
  const agora = useRef<EstadoDaAtualizacao>("parado");
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const poe = useCallback((e: EstadoDaAtualizacao) => {
    agora.current = e;
    if (vivo.current) setEstado(e);
  }, []);

  const atualizar = useCallback(async () => {
    if (agora.current === "verificando" || agora.current === "nova") return;
    // Segundo toque depois de um "não deu para verificar": recarrega na fé.
    if (agora.current === "indisponivel") {
      poe("nova");
      await atualizarAgora();
      return;
    }
    poe("verificando");
    const r = await verificarAtualizacao();
    poe(r);
    if (r === "nova") await atualizarAgora();
  }, [poe]);

  return { estado, atualizar, ocupado: estado === "verificando" || estado === "nova" };
}
