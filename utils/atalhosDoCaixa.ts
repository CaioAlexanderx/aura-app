// ============================================================
// Atalhos do Caixa num mapa só (17/11/2026, p-153 / A1; teclas novas p-154 / A2)
//
// Antes cada tecla morava dentro do botão (6 listeners espalhados pela barra
// de ações e pela busca). Quando a barra não estava na tela, a tecla voltava
// a ser do navegador: na tela de venda concluída o F5 recarregava a página.
// E nenhum listener olhava se havia janela aberta: com a Troca aberta, F2/F3
// abriam o seletor por baixo dela.
//
// Agora: esta tabela é a única fonte (o listener lê daqui; etiquetas e
// legenda vão ler também), e `resolverAtalho` decide, sem DOM, o que uma
// tecla faz no estado atual do Caixa. Quem escuta é hooks/useAtalhosDoCaixa.
//
// Regras fixas (decisões do Caio, 17/11):
//   - Teclas fixas; o lojista não escolhe.
//   - F1–F5 e Ctrl/⌘+K ficam como estão; cada ação ganha uma alternativa com
//     Alt (⌥ no Mac) ou Ctrl/⌘, porque no Mac e em muito notebook a tecla F
//     pede Fn.
//   - Finalizar é F9 ou Ctrl/⌘+Enter, NUNCA Enter sozinho: o leitor de
//     código de barras manda Enter no fim de cada bipe.
//   - Nunca tecla solta (letra ou número) fora de campo, nunca Tab. Os dois
//     detectores do leitor ignoram tecla com Ctrl/Alt/Meta, então um atalho
//     com modificador nunca dispara no meio de uma rajada.
//   - Enter e Esc sozinhos só valem onde o leitor está desligado: na tela de
//     venda concluída (Nova venda) e, o Esc, para fechar popover/janela. O
//     Enter do troco mora no CashChangeModal, com a mesma guarda do seletor
//     de tamanho (250 ms depois de abrir, sem `repeat`, sem rajada).
//   - Alt exige altKey && !ctrlKey: no teclado ABNT2 o AltGr chega como
//     Ctrl+Alt (AltGr+Q é a barra "/").
//   - Alt compara por e.code (posição da tecla): no Mac ⌥+letra muda o
//     e.key ("⌥C" chega como "ç").
// ============================================================

export type AcaoDoCaixa =
  | "codigoManual"
  | "vendedora"
  | "cliente"
  | "cupom"
  | "troca"
  | "busca"
  | "desconto"
  | "removerUltimo"
  | "finalizar"
  | "pagamento1" | "pagamento2" | "pagamento3" | "pagamento4" | "pagamento5"
  | "fechar"
  | "novaVenda"
  | "imprimir";

/** Uma combinação de teclas. `code` é o KeyboardEvent.code. */
export type Combinacao =
  /** Tecla de função sozinha (F1…). */
  | { tipo: "funcao"; code: string }
  /** Alt (⌥) + tecla, sem Ctrl. */
  | { tipo: "alt"; code: string }
  /** Ctrl (Windows) ou ⌘ (Mac) + tecla, sem Alt. */
  | { tipo: "ctrlOuCmd"; code: string }
  /** Enter ou Esc sem modificador. Só onde o leitor não lê (ver regras). */
  | { tipo: "solta"; code: string };

/** Onde o atalho vale: no Caixa (carrinho e grade) ou na venda concluída. */
export type OndeVale = "caixa" | "telaFinal";

export type AtalhoDoCaixa = {
  acao: AcaoDoCaixa;
  /** A primeira é a principal; as outras, alternativas. */
  teclas: Combinacao[];
  /** O que a ação faz, para leitor de tela, etiqueta e legenda. */
  texto: string;
  onde: OndeVale;
  /** Só com item no carrinho. */
  comItens?: boolean;
  /** Vale também com janela aberta por cima do Caixa (o Esc que fecha). */
  comJanela?: boolean;
};

const F = (code: string): Combinacao => ({ tipo: "funcao", code });
const ALT = (code: string): Combinacao => ({ tipo: "alt", code });
const CMD = (code: string): Combinacao => ({ tipo: "ctrlOuCmd", code });
const SOLTA = (code: string): Combinacao => ({ tipo: "solta", code });

/** Mapa de teclas do Caixa (tabela 1.4 do mapa de 17/11). */
export const ATALHOS_DO_CAIXA: AtalhoDoCaixa[] = [
  { acao: "codigoManual", onde: "caixa", teclas: [F("F1"), ALT("KeyM")], texto: "Digitar código à mão" },
  { acao: "vendedora",    onde: "caixa", teclas: [F("F2"), ALT("KeyV")], texto: "Vendedora" },
  { acao: "cliente",      onde: "caixa", teclas: [F("F3"), ALT("KeyC")], texto: "Cliente" },
  { acao: "cupom",        onde: "caixa", teclas: [F("F4"), ALT("KeyU")], texto: "Cupom de desconto" },
  { acao: "troca",        onde: "caixa", teclas: [F("F5"), ALT("KeyT")], texto: "Troca ou devolução" },
  { acao: "busca",        onde: "caixa", teclas: [F("F6"), CMD("KeyK")], texto: "Buscar produto" },
  { acao: "desconto",     onde: "caixa", comItens: true, teclas: [F("F7"), ALT("KeyS")], texto: "Desconto" },
  { acao: "removerUltimo", onde: "caixa", comItens: true, teclas: [F("F8"), ALT("KeyX")], texto: "Tirar o último item (duas vezes)" },
  { acao: "finalizar",    onde: "caixa", comItens: true, teclas: [F("F9"), CMD("Enter"), CMD("NumpadEnter")], texto: "Finalizar a venda" },
  // Ordem de PAYMENTS (hooks/useCart): Dinheiro, PIX, Débito, Crédito, Crediário.
  { acao: "pagamento1",   onde: "caixa", comItens: true, teclas: [ALT("Digit1"), ALT("Numpad1")], texto: "Dinheiro" },
  { acao: "pagamento2",   onde: "caixa", comItens: true, teclas: [ALT("Digit2"), ALT("Numpad2")], texto: "PIX" },
  { acao: "pagamento3",   onde: "caixa", comItens: true, teclas: [ALT("Digit3"), ALT("Numpad3")], texto: "Débito" },
  { acao: "pagamento4",   onde: "caixa", comItens: true, teclas: [ALT("Digit4"), ALT("Numpad4")], texto: "Crédito" },
  { acao: "pagamento5",   onde: "caixa", comItens: true, teclas: [ALT("Digit5"), ALT("Numpad5")], texto: "Crediário" },
  { acao: "fechar",       onde: "caixa", comJanela: true, teclas: [SOLTA("Escape")], texto: "Fechar" },
  { acao: "novaVenda",    onde: "telaFinal", teclas: [SOLTA("Enter"), SOLTA("NumpadEnter"), SOLTA("Escape"), F("F9")], texto: "Começar a próxima venda" },
  { acao: "imprimir",     onde: "telaFinal", teclas: [CMD("KeyP")], texto: "Imprimir o cupom" },
];

/** A ordem das formas de pagamento no Alt+1…5. */
export const PAGAMENTO_DO_ATALHO: Record<string, number> = {
  pagamento1: 0, pagamento2: 1, pagamento3: 2, pagamento4: 3, pagamento5: 4,
};

/** Na tela final, Enter/Esc/F9 só valem depois disto (o Enter que confirmou
 *  o troco, o F9 segurado ou o CR+LF do leitor não pulam a tela). */
export const TELA_FINAL_GUARDA_MS = 250;

/** O que o Caixa está mostrando, do ponto de vista dos atalhos. */
export type EstadoDosAtalhos = {
  /** Tela de venda concluída na frente (a barra e a busca não estão montadas). */
  telaFinal: boolean;
  /** Alguma janela por cima do Caixa: Troca, troco, seletor de tamanho,
   *  cadastro rápido, abrir/fechar caixa, comandas, crediário… */
  janelaAberta: boolean;
  /** Carrinho com pelo menos um item (padrão: true). */
  temItens?: boolean;
  /** Quando a tela final apareceu (ms, mesmo relógio de `agora`). */
  telaFinalDesde?: number | null;
};

/** O pedaço do KeyboardEvent que importa (dá para testar sem DOM). */
export type TeclaDoCaixa = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  /** O foco está num campo de texto (input, textarea, select, contenteditable). */
  emCampo?: boolean;
  /** O foco está num botão ou link: o Enter é dele (aperta o botão). */
  emBotao?: boolean;
};

export type DecisaoDoAtalho = {
  /** A ação a executar agora (null = nenhuma). */
  acao: AcaoDoCaixa | null;
  /** Segurar a tecla (preventDefault) já: é do Caixa, mesmo sem ação agora.
   *  Com `segurar` false e uma ação, quem executa decide (o Esc só é
   *  segurado se fechou alguma coisa). */
  segurar: boolean;
};

const NADA: DecisaoDoAtalho = { acao: null, segurar: false };

/** A letra/dígito que a tecla física `code` produz sem modificador. */
function caractereDoCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^(Digit|Numpad)[0-9]$/.test(code)) return code.slice(-1);
  return null;
}

/** e.code às vezes falta (teclado virtual, navegador antigo): cai no e.key. */
function codeDaTecla(t: TeclaDoCaixa): string {
  if (t.code) return t.code;
  const k = t.key || "";
  if (/^F([1-9]|1[0-2])$/.test(k)) return k;
  if (/^[a-z]$/i.test(k)) return "Key" + k.toUpperCase();
  if (/^[0-9]$/.test(k)) return "Digit" + k;
  if (k === "Esc") return "Escape";
  return k;
}

function casa(c: Combinacao, t: TeclaDoCaixa): boolean {
  const code = codeDaTecla(t);
  const ctrl = !!t.ctrlKey, alt = !!t.altKey, meta = !!t.metaKey;
  if (c.tipo === "funcao") {
    return !ctrl && !alt && !meta && (code === c.code || t.key === c.code);
  }
  if (c.tipo === "solta") {
    return !ctrl && !alt && !meta && !t.shiftKey && code === c.code;
  }
  if (c.tipo === "alt") {
    // AltGr = Ctrl+Alt no Windows: nunca é atalho.
    if (!alt || ctrl || meta || code !== c.code) return false;
    // Dentro de um campo, ⌥+letra no Mac escreve um caractere ("⌥C" = "ç"):
    // aí a tecla é do texto, não do Caixa. No Windows o Alt não escreve nada
    // e o e.key é a própria letra.
    const base = caractereDoCode(c.code);
    if (t.emCampo && base && (t.key || "").length === 1 && t.key.toLowerCase() !== base) return false;
    return true;
  }
  // Ctrl/⌘: compara pela letra que saiu (layout do teclado) ou pela posição.
  if (!(ctrl || meta) || alt) return false;
  const base = caractereDoCode(c.code);
  return code === c.code || (!!base && (t.key || "").toLowerCase() === base);
}

/** O atalho da tabela que esta tecla aciona em `onde`, ou null. */
export function atalhoDaTecla(
  t: TeclaDoCaixa, onde: OndeVale = "caixa", mapa: AtalhoDoCaixa[] = ATALHOS_DO_CAIXA,
): { atalho: AtalhoDoCaixa; combinacao: Combinacao } | null {
  for (const a of mapa) {
    if (a.onde !== onde) continue;
    for (const c of a.teclas) {
      if (casa(c, t)) return { atalho: a, combinacao: c };
    }
  }
  return null;
}

/** Tecla de função que o mapa usa em algum lugar (F1…F9). */
function ehTeclaFDoMapa(t: TeclaDoCaixa, mapa: AtalhoDoCaixa[]): boolean {
  return mapa.some(a => a.teclas.some(c => c.tipo === "funcao" && casa(c, t)));
}

/**
 * O que a tecla faz no estado atual do Caixa.
 *
 * - Tecla de função do mapa: sempre segurada na tela do Caixa (inclusive na
 *   tela final e com janela aberta — o F5 não recarrega a página no meio da
 *   venda). Só age onde vale e com o Caixa livre.
 * - Alt e Ctrl/⌘: só seguram quando agem. Com janela aberta a tecla segue
 *   para quem estiver nela.
 * - Esc: vai para "fechar" (popover ou janela) e só é segurado se fechou.
 * - Tela final: Enter/Esc/F9 começam a próxima venda depois de
 *   TELA_FINAL_GUARDA_MS, fora de campo e (o Enter) fora de botão.
 * - Tecla segurada (repeat): segura e não repete a ação.
 */
export function resolverAtalho(
  t: TeclaDoCaixa,
  estado: EstadoDosAtalhos,
  agora: number = Date.now(),
  mapa: AtalhoDoCaixa[] = ATALHOS_DO_CAIXA,
): DecisaoDoAtalho {
  const onde: OndeVale = estado.telaFinal ? "telaFinal" : "caixa";
  const achado = atalhoDaTecla(t, onde, mapa);
  const seguraF: DecisaoDoAtalho = ehTeclaFDoMapa(t, mapa) ? { acao: null, segurar: true } : NADA;
  if (!achado) return seguraF;
  const { atalho, combinacao } = achado;
  const funcao = combinacao.tipo === "funcao";
  const solta = combinacao.tipo === "solta";

  if (onde === "telaFinal") {
    // Janela por cima da tela final: a tecla é dela.
    if (estado.janelaAberta) return seguraF;
    if (solta) {
      // Enter num campo é do campo; num botão, aperta o botão. Esc num
      // campo também fica com ele.
      if (t.emCampo) return NADA;
      if (t.emBotao && combinacao.code !== "Escape") return NADA;
    }
    if (t.repeat) return { acao: null, segurar: funcao || solta };
    if (atalho.acao === "novaVenda") {
      const desde = estado.telaFinalDesde;
      if (desde != null && agora - desde < TELA_FINAL_GUARDA_MS) return { acao: null, segurar: true };
    }
    return { acao: atalho.acao, segurar: true };
  }

  if (estado.janelaAberta && !atalho.comJanela) return funcao ? { acao: null, segurar: true } : NADA;
  if (atalho.comItens && estado.temItens === false) return funcao ? { acao: null, segurar: true } : NADA;
  if (t.repeat) return { acao: null, segurar: funcao || !solta };
  return { acao: atalho.acao, segurar: !solta };
}

/** Foco num campo de texto? (input, textarea, select, contenteditable) */
export function focoEmCampo(alvo: EventTarget | null | undefined): boolean {
  const el = alvo as HTMLElement | null | undefined;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!el.isContentEditable;
}

/** Foco num botão ou link (o Enter aperta ele)? */
export function focoEmBotao(alvo: EventTarget | null | undefined): boolean {
  const el = alvo as HTMLElement | null | undefined;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "a") return true;
  const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : null;
  return role === "button" || role === "link";
}

/**
 * Confirmação em dois toques (F8 / Alt+X tiram o último item): o primeiro
 * arma, o segundo dentro de `janelaMs` confirma — a mesma regra da lixeira do
 * carrinho (dois cliques em 2 s). Outro item no meio desarma.
 */
export function criarDoisToques(janelaMs = 2000) {
  let armado: { id: string; em: number } | null = null;
  return {
    tocar(id: string, agora: number): "armou" | "confirmou" {
      if (armado && armado.id === id && agora - armado.em <= janelaMs) {
        armado = null;
        return "confirmou";
      }
      armado = { id, em: agora };
      return "armou";
    },
    desarmar() { armado = null; },
    armadoEm(): string | null { return armado ? armado.id : null; },
  };
}
