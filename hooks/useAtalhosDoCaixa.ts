// ============================================================
// useAtalhosDoCaixa (17/11/2026, p-153 / A1; p-154 / A2)
//
// UM listener de teclado para a tela do Caixa inteira, no lugar dos seis que
// moravam dentro dos botões. Lê o mapa de utils/atalhosDoCaixa.
//
// - Fase normal (bolha), na window: a busca, o seletor de tamanho e o troco
//   ouvem em captura e chegam antes. Quem já tratou a tecla
//   (e.defaultPrevented) não é atropelado.
// - Montado pela tela do Caixa ANTES de ela escolher entre o Caixa e a tela
//   de venda concluída: as teclas do mapa valem nas duas (na final, o F5 não
//   recarrega mais a página).
// - O estado e as ações são lidos na hora da tecla (ref), sem religar o
//   listener a cada render.
// ============================================================
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  resolverAtalho, focoEmCampo, focoEmBotao,
  type AcaoDoCaixa, type EstadoDosAtalhos,
} from "@/utils/atalhosDoCaixa";

const IS_WEB = Platform.OS === "web";

export type OpcoesDosAtalhos = {
  /** Estado do Caixa agora (tela final, janela aberta, carrinho). Uma função
   *  é lida na hora da tecla. */
  estado: EstadoDosAtalhos | (() => EstadoDosAtalhos);
  /** Executa a ação. Devolver true segura a tecla quando o mapa deixou a
   *  decisão para quem executa (o Esc só é segurado se fechou algo). */
  executar: (acao: AcaoDoCaixa) => boolean | void;
  /** false = não escuta (padrão true). */
  ativo?: boolean;
};

export function useAtalhosDoCaixa(opcoes: OpcoesDosAtalhos) {
  const vivo = useRef(opcoes);
  vivo.current = opcoes;
  const ativo = opcoes.ativo !== false;

  useEffect(() => {
    if (!IS_WEB || !ativo || typeof window === "undefined") return;
    function aoTecla(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const v = vivo.current;
      const estado = typeof v.estado === "function" ? v.estado() : v.estado;
      const decisao = resolverAtalho({
        key: e.key, code: e.code,
        ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
        repeat: e.repeat,
        emCampo: focoEmCampo(e.target),
        emBotao: focoEmBotao(e.target),
      }, estado, Date.now());
      if (decisao.segurar) e.preventDefault();
      if (decisao.acao) {
        const feito = v.executar(decisao.acao);
        if (feito === true && !decisao.segurar) e.preventDefault();
      }
    }
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [ativo]);
}

/** Há uma janela de diálogo (Modal do react-native-web) aberta na página? */
export function dialogoAbertoNaTela(): boolean {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
  return !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

export default useAtalhosDoCaixa;
