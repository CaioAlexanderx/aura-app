// ============================================================
// components/studio/storefront/quadro/mensagensDoQuadro.ts
//
// p-181 (loja única 3.3a, 17/11/2026): o CONTRATO entre o personalizador
// no quadro (rota `/<slug>/personalizar/<id>`, PersonalizadorNoQuadro.tsx)
// e a página mãe, a loja comum (HTML do backend). Quem escreve o outro
// lado é o p-182 (`src/templates/storefront/parts/personalizavel.js`).
// Mudou aqui, muda lá — e a `versao` sobe.
//
// ── COMO A LOJA ABRE O QUADRO ─────────────────────────────────────────
//   <iframe src="<host>/<slug>/personalizar/<produto_id>?origem=<origin da loja>
//                &cor=%23RRGGBB&modo=papel|claro|escuro&fonte=<font_family>">
//   - `origem` (recomendado): `location.origin` da loja. Onde o navegador
//     informa os ancestrais (`location.ancestorOrigins`, Chrome e Safari),
//     vale o que ele diz e o parâmetro é ignorado; no Firefox o parâmetro
//     é o que resta (o `document.referrer` é o último recurso).
//   - `cor`, `modo`, `fonte` (opcionais): o tema da loja comum. Sem eles,
//     as cores e a fonte do cadastro da loja (o mesmo digital_channel_config).
//   - `<host>`: o quadro funciona em qualquer host que sirva o app. O
//     recomendado é o PRÓPRIO host da loja (a casca do app servida pelo
//     backend, como a vitrine Studio já é): mesma origem, `frame-src
//     'self'`, e domínio próprio funciona. Servido de app.getaura.com.br,
//     o `_headers` só deixa enquadrar por loja.getaura.com.br.
//
// ── QUEM PODE CONVERSAR ───────────────────────────────────────────────
// Origens aceitas como loja (origensPermitidas):
//   - https://loja.getaura.com.br
//   - a origem do próprio quadro (servido pela loja, é ela mesma)
//   - https://<site.dominio_proprio>, quando o payload de
//     GET /storefront/:slug/studio/products trouxer o domínio próprio
//     ATIVO da loja (o p-182 acrescenta o campo; até lá, domínio próprio
//     só pela mesma origem)
//   - em desenvolvimento (__DEV__), http://localhost e http://127.0.0.1
// Fora disso o quadro não desenha o personalizador ("abre pela loja"),
// não manda nada e ignora tudo o que receber.
//
// Toda mensagem que SAI vai com `targetOrigin` = a origem da loja (nunca
// "*"): se a página mãe não for ela, o navegador descarta. Toda mensagem
// que ENTRA é conferida: `event.source === window.parent`, `event.origin
// === origem da loja` e o envelope abaixo. O resto é ignorado em silêncio.
//
// ── QUADRO → LOJA ─────────────────────────────────────────────────────
// Envelope: { fonte: "aura:personalizador", versao: 1, tipo, ...dados }
//   pronto     { produto_id, nome }
//              A peça abriu. Antes dele a loja mostra o esqueleto dela.
//   confirmou  { produto_id, nome, quantidade, customization, resumo,
//                preco: { unitario, total, fonte }, miniatura, editando }
//              A cliente tocou em "Adicionar à sacola" (ou "Atualizar
//              item") e a peça passou na validação. `customization` é o
//              objeto do item como o pedido da vitrine Studio envia
//              (cotacaoDaSacola.itensDoPedido): { [field.id]: valor,
//              has_back_selected, has_middle_selected }, já validado com
//              as regras de services/personalizavel.js (espelhadas em
//              useStorefront.validateRequiredFields) e, quando a cotação
//              respondeu, também pelo servidor. `preco.fonte` = "servidor"
//              (POST /studio/cotacao) ou "estimativa" (sem rede: a conta
//              local). O preço é só para mostrar: o pedido recota.
//              `resumo` = ["Nome: Ana", "Cor: Branca", ...], para a sacola.
//              `miniatura` = data:image/jpeg;base64,... (o palco, 240 px)
//              ou a URL https da foto da peça, ou null. A loja só deve
//              aceitar `data:image/` ou `https:` num <img>.
//   cancelou   { produto_id }
//              Fechar (×) ou voltar (←). A loja fecha o quadro.
//   erro       { motivo: "loja_indisponivel" | "produto_indisponivel" }
//              A loja leva ao WhatsApp, como faz sem checkout.
//
// ── LOJA → QUADRO ─────────────────────────────────────────────────────
// Envelope: { fonte: "aura:loja", versao: 1, tipo, ...dados }
//   editar     { customization, quantidade }
//              Depois do `pronto`: reabre a peça com o item da sacola
//              ("Editar"). O botão vira "Atualizar item" e o `confirmou`
//              sai com `editando: true`.
//
// Puro: nada aqui toca `window`; quem lê a janela é o componente.
// ============================================================

export const FONTE_DO_QUADRO = "aura:personalizador";
export const FONTE_DA_LOJA = "aura:loja";
export const VERSAO_DO_QUADRO = 1;
export const ORIGEM_DA_LOJA_AURA = "https://loja.getaura.com.br";

export type MotivoDoErro = "loja_indisponivel" | "produto_indisponivel";

export type PrecoConfirmado = { unitario: number; total: number; fonte: "servidor" | "estimativa" };

export type MensagemDoQuadro =
  | { tipo: "pronto"; produto_id: string; nome: string }
  | {
      tipo: "confirmou";
      produto_id: string;
      nome: string;
      quantidade: number;
      customization: Record<string, any>;
      resumo: string[];
      preco: PrecoConfirmado;
      miniatura: string | null;
      editando: boolean;
    }
  | { tipo: "cancelou"; produto_id: string }
  | { tipo: "erro"; motivo: MotivoDoErro };

export type MensagemDaLoja = { tipo: "editar"; customization: Record<string, any>; quantidade: number };

/** O envelope que vai para a loja. */
export function envelope(m: MensagemDoQuadro): Record<string, any> {
  return { fonte: FONTE_DO_QUADRO, versao: VERSAO_DO_QUADRO, ...m };
}

const LOCAL = new Set(["localhost", "127.0.0.1"]);

/**
 * `https://host[:porta]` de uma URL ou origem, ou null. Só https; http
 * apenas para localhost e só com `dev`. Caminho, consulta e usuário saem.
 */
export function normalizarOrigem(valor: unknown, dev = false): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  let u: URL;
  try { u = new URL(valor.trim()); } catch { return null; }
  if (u.username || u.password) return null;
  if (u.protocol === "https:") return u.origin;
  if (u.protocol === "http:" && dev && LOCAL.has(u.hostname)) return u.origin;
  return null;
}

/** Um domínio próprio ("minhaloja.com.br") como origem https, ou null. */
function origemDoDominio(dominio: unknown): string | null {
  if (typeof dominio !== "string") return null;
  const d = dominio.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return null;
  return normalizarOrigem("https://" + d);
}

/** As origens que contam como a loja. Ver o cabeçalho deste arquivo. */
export function origensPermitidas({
  propria, dominioProprio, dev = false,
}: {
  /** A origem do próprio quadro (window.location.origin). */
  propria?: string | null;
  /** `site.dominio_proprio` do payload da loja (ativo), quando vier. */
  dominioProprio?: string | null;
  dev?: boolean;
}): string[] {
  const lista = [ORIGEM_DA_LOJA_AURA, normalizarOrigem(propria, dev), origemDoDominio(dominioProprio)];
  return Array.from(new Set(lista.filter((o): o is string => !!o)));
}

function permitida(origem: string, permitidas: readonly string[], dev: boolean): boolean {
  if (permitidas.includes(origem)) return true;
  // Em desenvolvimento, qualquer porta do localhost (a página de teste).
  if (dev) {
    try { return LOCAL.has(new URL(origem).hostname) && origem.startsWith("http://"); } catch { return false; }
  }
  return false;
}

/**
 * A origem da página mãe, se ela for a loja; senão null.
 *
 * - `ancestrais` (location.ancestorOrigins[0]) é o navegador dizendo quem
 *   enquadrou: quando existe, é a única fonte.
 * - Sem ele, o `?origem=` que a loja passou; por último, o referrer.
 *
 * Um `?origem=` falso não vaza nada: o postMessage vai com essa origem
 * como destino, e o navegador descarta se a mãe for outra.
 */
export function origemDaLoja({
  enquadrado, ancestral, pedida, referrer, permitidas, dev = false,
}: {
  /** window.parent !== window. */
  enquadrado: boolean;
  ancestral?: string | null;
  pedida?: unknown;
  referrer?: string | null;
  permitidas: readonly string[];
  dev?: boolean;
}): string | null {
  if (!enquadrado) return null;
  const candidata = ancestral
    ? normalizarOrigem(ancestral, dev)
    : normalizarOrigem(pedida, dev) || normalizarOrigem(referrer, dev);
  if (!candidata) return null;
  return permitida(candidata, permitidas, dev) ? candidata : null;
}

/**
 * Uma mensagem recebida, se for da loja e no formato do contrato; senão
 * null. `fonteOk` = o `event.source` é a janela mãe (quem chama compara).
 */
export function lerMensagemDaLoja(
  evento: { origin?: string; data?: unknown },
  { origemDaLoja: origem, fonteOk }: { origemDaLoja: string | null; fonteOk: boolean },
): MensagemDaLoja | null {
  if (!origem || !fonteOk || evento.origin !== origem) return null;
  const d: any = evento.data;
  if (!d || typeof d !== "object" || d.fonte !== FONTE_DA_LOJA || d.versao !== VERSAO_DO_QUADRO) return null;
  if (d.tipo === "editar") {
    const c = d.customization;
    if (!c || typeof c !== "object" || Array.isArray(c)) return null;
    const q = Math.floor(Number(d.quantidade));
    return { tipo: "editar", customization: c, quantidade: Number.isFinite(q) && q >= 1 ? Math.min(q, 9999) : 1 };
  }
  return null;
}

// ── O tema vindo da loja ─────────────────────────────────────

export type TemaPedido = { cor: string | null; modo: "papel" | "claro" | "escuro" | null; fonte: string | null };

/** `?cor=&modo=&fonte=` validados. O que não passa vira null (vale o cadastro da loja). */
export function temaDaConsulta(consulta: Record<string, unknown> | null | undefined): TemaPedido {
  const um = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const cor = String(um(consulta?.cor) ?? "").trim();
  const modo = String(um(consulta?.modo) ?? "").trim().toLowerCase();
  const fonte = String(um(consulta?.fonte) ?? "").trim().toLowerCase();
  return {
    cor: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(cor) ? cor : null,
    modo: modo === "papel" || modo === "claro" || modo === "escuro" ? modo : null,
    fonte: /^[a-z0-9_-]{1,40}$/.test(fonte) ? fonte : null,
  };
}
