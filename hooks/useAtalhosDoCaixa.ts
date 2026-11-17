// ============================================================
// useAtalhosDoCaixa (17/11/2026, p-153 / A1)
//
// UM listener de teclado para a tela do Caixa inteira, no lugar dos seis que
// moravam dentro dos botões. Lê o mapa de utils/atalhosDoCaixa.
//
// - Fase normal (bolha), na window: a busca e o seletor de tamanho ouvem em
//   captura e chegam antes. Quem já tratou a tecla (e.defaultPrevented) não
//   é atropelado.
// - Montado pela tela do Caixa ANTES de ela escolher entre o Caixa e a tela
//   de venda concluída: as teclas do mapa valem nas duas (na final, o F5 não
//   recarrega mais a página).
// - O estado e as ações são lidos na hora da tecla (ref), sem religar o
//   listener a cada render.
// ============================================================
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  resolverAtalho, focoEmCampo,
  type AcaoDoCaixa, type EstadoDosAtalhos,
} from "@/utils/atalhosDoCaixa";

const IS_WEB = Platform.OS === "web";

export type OpcoesDosAtalhos = {
  /** Estado do Caixa agora (tela final, janela aberta). */
  estado: EstadoDosAtalhos;
  /** Executa a ação. */
  executar: (acao: AcaoDoCaixa) => void;
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
      const decisao = resolverAtalho({
        key: e.key, code: e.code,
        ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
        repeat: e.repeat,
        emCampo: focoEmCampo(e.target),
      }, v.estado);
      if (decisao.segurar) e.preventDefault();
      if (decisao.acao) v.executar(decisao.acao);
    }
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [ativo]);
}

export default useAtalhosDoCaixa;
