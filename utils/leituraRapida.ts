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
// ============================================================

export const LIMITE_ENTRE_TECLAS_MS = 40;
export const MIN_CARACTERES = 6;
export const OCIOSO_MS = 120;

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
  return {
    tecla(ch, agora) {
      const nova = !chars || agora - ultimo > limite;
      if (nova) chars = "";
      chars += ch;
      ultimo = agora;
      return nova;
    },
    leitura() {
      const c = chars.trim();
      return c.length >= minimo ? c : null;
    },
    reset() { chars = ""; ultimo = 0; },
    tamanho() { return chars.length; },
  };
}
