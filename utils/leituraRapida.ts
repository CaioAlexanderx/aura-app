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
//
// 09/10/2026 — a leitura ainda partia e o código ainda parava na busca. Dois
// defeitos de fundo: (1) o tempo era o da hora em que o código RODAVA
// (Date.now no onChange), então a tela ocupada refazendo a lista esticava a
// pausa entre teclas além de qualquer tolerância; (2) o código inteiro era
// digitado na busca e só depois desfeito. Agora o tempo é o do próprio evento
// de tecla (KeyboardEvent.timeStamp, carimbado na chegada da tecla, não
// quando a tela consegue atendê-la) e, confirmada a rajada no 4º caractere, o
// campo volta ao que era e o resto do código é engolido antes de chegar nele.
// Ver criarLeitorDeCampo.
// ============================================================

export const LIMITE_ENTRE_TECLAS_MS = 40;
export const MIN_CARACTERES = 6;
export const OCIOSO_MS = 120;
export const SOLUCO_MS = 300;
/** Caracteres colados (sem soluço) que bastam para tratar a rajada como leitor
 *  e parar de deixar as teclas chegarem ao campo. */
export const CONFIRMA_CARACTERES = 4;
/** Depois de OCIOSO_MS sem tecla, espera mais isto antes de fechar: se a tela
 *  estava ocupada, as teclas que ficaram na fila entram antes do fechamento. */
export const CONFIRMA_OCIOSO_MS = 30;

export type DetectorDeLeitura = {
  /** Registra um caractere; devolve true se ele começou uma rajada nova. */
  tecla: (ch: string, agora: number) => boolean;
  /** O código, se o que foi registrado é uma leitura; senão null. */
  leitura: () => string | null;
  reset: () => void;
  tamanho: () => number;
  /** O que foi registrado na rajada atual, cru. */
  texto: () => string;
  /** Uma tecla chegando `agora` continuaria a rajada atual (colada ou soluço)? */
  continua: (agora: number) => boolean;
  /** Já dá para afirmar que é o leitor: CONFIRMA_CARACTERES colados, sem soluço. */
  confirmada: () => boolean;
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
    texto() { return chars; },
    continua(agora) {
      if (!chars) return false;
      const pausa = agora - ultimo;
      return pausa <= limite || (chars.length >= 2 && pausa <= SOLUCO_MS);
    },
    confirmada() { return chars.length >= CONFIRMA_CARACTERES && solucos === 0; },
  };
}

/** O mínimo de um KeyboardEvent que o leitor de campo usa (facilita o teste). */
export type TeclaDoCampo = {
  key: string;
  timeStamp: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  preventDefault: () => void;
  stopPropagation?: () => void;
};

export type LeitorDeCampo = {
  /** Chamar no keydown do campo, na fase de captura. */
  tecla: (e: TeclaDoCampo) => void;
  cancelar: () => void;
};

const TECLAS_NEUTRAS = ["Shift", "CapsLock", "NumLock", "Unidentified", "Process"];

/**
 * Leitor de código dentro de um campo de texto (a busca do Caixa).
 *
 * Os primeiros caracteres de uma leitura não têm como ser distinguidos de
 * digitação e chegam ao campo. No CONFIRMA_CARACTERES-ésimo colado o campo
 * volta ao texto de antes da rajada e as teclas seguintes são engolidas
 * (preventDefault): o código nunca fica na busca nem refaz a lista a cada
 * caractere. A leitura fecha no Enter, no Tab ou no silêncio e vai inteira
 * para `onLeitura`. Se a rajada confirmada acabar curta demais para ser um
 * código, o que foi engolido é devolvido ao campo — ninguém perde tecla.
 */
export function criarLeitorDeCampo(p: {
  /** Texto do campo agora (antes de a tecla atual entrar). */
  valor: () => string;
  /** Põe o campo num texto. */
  escrever: (v: string) => void;
  onLeitura: (code: string) => void;
}): LeitorDeCampo {
  const det = criarDetector();
  let antes = "";
  let engolindo = false;
  let timer: any = null;

  function pararTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function fechar(): boolean {
    pararTimer();
    const code = det.leitura();
    if (code) {
      det.reset();
      engolindo = false;
      if (p.valor() !== antes) p.escrever(antes);
      p.onLeitura(code);
      return true;
    }
    if (engolindo) {
      // Rajada confirmada que acabou curta: devolve o que foi engolido.
      const txt = det.texto();
      det.reset();
      engolindo = false;
      p.escrever(antes + txt);
    }
    // Pedaço curto que vazou fica no detector: o resto pode emendar.
    return false;
  }

  function descartar() {
    if (engolindo) fechar();
    pararTimer();
    det.reset();
  }

  return {
    tecla(e) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key;
      if (k === "Enter" || k === "Tab") {
        if (det.leitura()) {
          // Fim da leitura: não é envio da busca nem troca de campo.
          e.preventDefault();
          e.stopPropagation?.();
          fechar();
        } else {
          descartar();
        }
        return;
      }
      if (!k || k.length !== 1) {
        if (TECLAS_NEUTRAS.indexOf(k) < 0) descartar(); // apagou, andou com a seta: é gente
        return;
      }
      if (e.repeat) { descartar(); return; } // tecla segurada repete rápido e não é leitor
      const t = e.timeStamp;
      // Rajada anterior ainda aberta e esta tecla já é outra coisa: fecha antes.
      if (!det.continua(t) && (engolindo || det.leitura())) fechar();
      pararTimer();
      if (det.tecla(k, t)) antes = p.valor();
      if (engolindo || det.confirmada()) {
        e.preventDefault();
        if (!engolindo) { engolindo = true; p.escrever(antes); }
      }
      timer = setTimeout(() => { timer = setTimeout(fechar, CONFIRMA_OCIOSO_MS); }, OCIOSO_MS);
    },
    cancelar() { pararTimer(); det.reset(); engolindo = false; },
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
