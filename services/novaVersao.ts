// ============================================================
// AURA. — nova versão do painel: descobrir que um deploy saiu
//
// Criado: 22/09/2026 (PWA Fase 2)
//
// O painel instalado fica aberto por dias. Sem isto, um deploy na
// segunda só chega no lojista quando ele fecha e reabre — e ele não fecha.
//
// Como sabe: o index.html que o Expo exporta aponta para scripts com HASH
// no nome (/_expo/static/js/...). Se o index.html do servidor aponta para
// hashes diferentes dos que a página em execução carregou, houve deploy.
// Sem rota nova, sem arquivo de versão para alguém esquecer de atualizar.
//
// Como NÃO faz: nunca recarrega sozinho. No meio de uma venda no Caixa
// isso seria um desastre. Avisa uma vez (barra fixa embaixo,
// components/NovaVersaoBanner.tsx) e fica quieto até o toque.
//
// Sem `react-native` de propósito: web-only por natureza e testável em
// jsdom com fetch e timers falsos.
// ============================================================

/** A cada quanto tempo perguntar ao servidor, com a tela visível. */
export const INTERVALO_MS = 10 * 60_000;
/** Ao voltar para a aba, não repetir a checagem antes disto. */
export const INTERVALO_MINIMO_MS = 60_000;

const PADRAO_DE_SCRIPT = /\/_expo\/static\/js\/[^"'\s>]+\.js/g;

function temJanela(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Os scripts com hash que um HTML referencia, como uma chave estável. */
export function assinaturaDoHtml(html: string): string | null {
  const achados = String(html || "").match(PADRAO_DE_SCRIPT);
  if (!achados || achados.length === 0) return null;
  return Array.from(new Set(achados)).sort().join("|");
}

/** A assinatura da página que está rodando agora. */
export function assinaturaAtual(doc: Document | undefined = temJanela() ? document : undefined): string | null {
  if (!doc) return null;
  const srcs: string[] = [];
  const scripts = doc.querySelectorAll ? doc.querySelectorAll("script[src]") : ([] as any);
  for (let i = 0; i < scripts.length; i++) {
    const src = (scripts[i] as HTMLScriptElement).getAttribute("src") || "";
    srcs.push(src);
  }
  return assinaturaDoHtml(srcs.join("\n"));
}

/** Busca o index.html de agora, sem cache. null se a rede falhar ou não houver assinatura. */
export async function buscarAssinaturaDoServidor(
  fetchFn?: typeof fetch,
  url: string = "/",
): Promise<string | null> {
  // O padrão é resolvido aqui dentro, não na assinatura: `fetch` pode não
  // existir (jsdom, navegador velho) e um `fetch.bind` no parâmetro
  // estouraria antes de qualquer try.
  const f = fetchFn ?? (temJanela() && typeof fetch === "function" ? fetch.bind(window) : undefined);
  if (!f) return null;
  try {
    const r = await f(url, { cache: "no-store", credentials: "same-origin", headers: { Accept: "text/html" } });
    if (!r.ok) return null;
    return assinaturaDoHtml(await r.text());
  } catch {
    return null;
  }
}

export function haNovaVersao(atual: string | null, servidor: string | null): boolean {
  return !!atual && !!servidor && atual !== servidor;
}

type OpcoesDaVigilancia = {
  aoDetectar: () => void;
  intervaloMs?: number;
  intervaloMinimoMs?: number;
  doc?: Document;
  fetchFn?: typeof fetch;
  agora?: () => number;
};

/**
 * Fica de olho no servidor enquanto a tela está visível. Chama `aoDetectar`
 * UMA vez e para. Devolve a função que cancela.
 */
export function iniciarVigilancia(opts: OpcoesDaVigilancia): () => void {
  const doc = opts.doc ?? (temJanela() ? document : undefined);
  if (!doc) return () => {};

  const intervalo = opts.intervaloMs ?? INTERVALO_MS;
  const minimo = opts.intervaloMinimoMs ?? INTERVALO_MINIMO_MS;
  const agora = opts.agora ?? Date.now;
  const atual = assinaturaAtual(doc);
  // Sem assinatura na própria página (dev server, teste) não há o que comparar.
  if (!atual) return () => {};

  let ativo = true;
  let ultimaChecagem = 0;
  let checando = false;

  async function checar(): Promise<void> {
    if (!ativo || checando) return;
    if (doc!.visibilityState && doc!.visibilityState !== "visible") return;
    checando = true;
    ultimaChecagem = agora();
    try {
      const servidor = await buscarAssinaturaDoServidor(opts.fetchFn, "/");
      if (ativo && haNovaVersao(atual, servidor)) {
        parar();
        opts.aoDetectar();
      }
    } finally {
      checando = false;
    }
  }

  function aoMudarVisibilidade(): void {
    if (doc!.visibilityState === "visible" && agora() - ultimaChecagem >= minimo) void checar();
  }

  const timer = setInterval(() => { void checar(); }, intervalo);
  doc.addEventListener("visibilitychange", aoMudarVisibilidade);

  function parar(): void {
    if (!ativo) return;
    ativo = false;
    clearInterval(timer);
    doc!.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }

  return parar;
}
