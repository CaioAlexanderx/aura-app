// ============================================================
// Leitura rápida: distingue o leitor de código de barras da digitação
// (29/09/2026 — o bipe em sequência ainda travava no Caixa)
//
// O leitor USB/Bluetooth "digita" o código inteiro em poucos milissegundos
// (5–20 ms entre caracteres); uma pessoa leva 100 ms ou mais. Até aqui o
// Caixa só reconhecia a leitura pelo Enter no fim — e muitos leitores vêm
// configurados SEM Enter (ou com Tab). Sem o Enter, o código virava texto na
// busca e o bipe seguinte grudava nele.
//
// Regra: pelo menos MIN_CARACTERES seguidos, todos com no máximo
// LIMITE_ENTRE_TECLAS_MS entre um e outro. A leitura fecha no Enter ou depois
// de OCIOSO_MS sem tecla nova.
//
// 03/10/2026 — soluço. O tempo é medido quando a tecla CHEGA ao código, e num
// Caixa com mais de mil produtos cada caractere refaz o filtro da lista: uma
// tecla atrasava mais de 40 ms e a leitura partia em duas. Na Finesse o
// código 2001485473363 virou "20014" parado na busca e um bipe de
// "85473363", que não existe. Uma rajada que já tem dois caracteres colados
// aguenta uma pausa de até SOLUCO_MS sem recomeçar; a leitura só vale com no
// máximo um soluço a cada MIN_CARACTERES — gente digitando rápido tem pausa
// a cada duas teclas e continua sendo busca.
// ============================================================

export const LIMITE_ENTRE_TECLAS_MS = 40;
export const MIN_CARACTERES = 6;
export const OCIOSO_MS = 120;
export const SOLUCO_MS = 300;

export type DetectorDeLeitura = {
  /** Registra um caractere; devolve true se ele começou uma rajada nova. */
  tecla: (ch: string, agora: number) => boolean;
  /** O código, se o que foi registrado é uma leitura; senão null. */
  leitura: () => string | null;
  reset: () => void;
  tamanho: () => number;
};

export function criarDetector(opts?: { limiteMs?: number; minimo?: number }): DetectorDeLeitura {
  const limite = opts?.limiteMs ?? LIMITE_ENTRE_TECLAS_MS;
  const minimo = opts?.minimo ?? MIN_CARACTERES;
  let chars = "";
  let ultimo = 0;
  let solucos = 0;
  return {
    tecla(ch, agora) {
      const pausa = agora - ultimo;
      const colada = !!chars && pausa <= limite;
      const soluco = !colada && chars.length >= 2 && pausa <= SOLUCO_MS;
      const nova = !colada && !soluco;
      if (nova) { chars = ""; solucos = 0; }
      if (soluco) solucos++;
      chars += ch;
      ultimo = agora;
      return nova;
    },
    leitura() {
      const c = chars.trim();
      return c.length >= minimo && solucos <= Math.floor(c.length / minimo) ? c : null;
    },
    reset() { chars = ""; ultimo = 0; solucos = 0; },
    tamanho() { return chars.length; },
  };
}

/** O scan falhou por conexão/servidor (true) ou o backend respondeu que o
 *  código não existe (false)? O /pdv/scan devolve 404 para código sem
 *  produto, e o 404 chega aqui como erro — sem separar, "não achei" aparecia
 *  como "confira a conexão". */
export function falhaDeConexao(err: any): boolean {
  if (!err || err.isNetworkError) return true;
  const status = Number(err.status) || 0;
  return status === 0 || status >= 500;
}
