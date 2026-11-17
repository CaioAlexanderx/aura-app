// ============================================================
// Origem do cadastro no app (tq-68, 21/10/2026; b-mk-33, 17/11/2026)
//
// O site (aura-site, js/origem.js) guarda o primeiro toque no localStorage
// do getaura.com.br, que o app (app.getaura.com.br) não enxerga. Desde o
// b-mk-33 (A1) o site passa esse primeiro toque na query dos links para o
// app ("Entrar" e qualquer outro):
//   utm_source, utm_medium, utm_campaign, utm_content, utm_term
//   origem_site    host do site de origem (referrer)
//   origem_pagina  caminho da página de entrada no site
//   origem_data    first_seen_at do site
//
// O app guarda a origem JÁ na primeira tela que abre: app/_layout.tsx chama
// guardarOrigemDaEntrada antes de o router trocar "/" pelo login (a troca
// perde a query); o login e o cadastro chamam de novo. Fica no localStorage
// do app ("aura_origem", 30 dias, com try/catch; sem storage, em memória), e
// o cadastro manda o guardado (origemParaOCadastro). Até 17/11 o cadastro
// lia só a própria URL e o referrer, e quem passava pelo login perdia tudo.
//
// Formato que o backend aceita (src/services/signupOrigem.js, sanitizarOrigem):
//   utm_* (≤ 100), landing_page (só o caminho, ≤ 300), referrer (só o host,
//   de FORA da Aura, ≤ 200), first_seen_at (ISO), ref (indicação, [A-Z0-9-]).
//
// Regra de primeiro toque, a mesma do site:
//   • com UTM, ref ou site de origem: toque completo;
//   • visita direta (b-mk-33 B): só { landing_page, first_seen_at }. A página
//     é a do site quando veio do site (origem_pagina), senão "/login" ou
//     "/register";
//   • um toque válido (menos de 30 dias) não é trocado, com uma exceção: uma
//     visita com UTM, ref ou site de origem substitui uma direta. Nunca o
//     contrário.
// Só nas telas de entrada ("/", "/login", "/register"): vitrine, convite e
// links públicos não viram origem de cadastro.
// Sem e-mail, telefone, IP ou query inteira. O backend sanitiza de novo.
// ============================================================

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

export type OrigemDoCadastro = Partial<Record<UtmKey, string>> & {
  landing_page?: string;
  referrer?: string;
  first_seen_at?: string;
  ref?: string;
};

export const CHAVE_DA_ORIGEM = "aura_origem";
export const VALIDADE_DA_ORIGEM_MS = 30 * 24 * 60 * 60 * 1000;
/** Nomes dos parâmetros que o site põe nos links para o app (js/origem.js). */
export const PARAMS_DO_SITE = { referrer: "origem_site", landing_page: "origem_pagina", first_seen_at: "origem_data" } as const;

const OWN_DOMAIN = "getaura.com.br";
const DIA_MS = 24 * 60 * 60 * 1000;

function limpo(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Código de indicação vindo do link: maiúsculas, só letras, números e
 * hífen, de 3 a 44 caracteres (a mesma regra do backend). Fora disso, "".
 */
export function codigoDoLink(v: unknown): string {
  const bruto = Array.isArray(v) ? v[0] : v;
  const c = limpo(bruto, 200).toUpperCase();
  if (c.length > 44 || !/^[A-Z0-9][A-Z0-9-]{2,}$/.test(c)) return "";
  return c;
}

function ehDaAura(host: string, ownHost: string): boolean {
  const own = String(ownHost || "").toLowerCase();
  return host === own || host === OWN_DOMAIN || host.endsWith("." + OWN_DOMAIN);
}

/** Host do referrer quando ele vem de fora da Aura; "" no resto. */
export function hostDeFora(referrer: string, ownHost: string): string {
  if (!referrer) return "";
  let u: URL;
  try { u = new URL(referrer); } catch { return ""; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  const host = u.hostname.toLowerCase();
  if (!host) return "";
  if (ehDaAura(host, ownHost)) return "";
  return host.slice(0, 200);
}

/** origem_site do link do site: só um host (letras, números, ponto e hífen), de fora da Aura. */
function hostDoSite(v: unknown, ownHost: string): string {
  const h = limpo(v, 200).toLowerCase();
  if (!h || !/^[a-z0-9.-]+$/.test(h)) return "";
  if (ehDaAura(h, ownHost)) return "";
  return h;
}

/** Só o caminho: sem query, sem #, começando por "/". */
function soCaminho(v: unknown): string {
  const p = limpo(v, 300).split("?")[0].split("#")[0];
  if (!p || p[0] !== "/" || p[1] === "/") return "";
  return p;
}

/** Data ISO válida, não no futuro (1 dia de folga) e dentro dos 30 dias; senão "". */
function dataValida(v: unknown, agora: Date): string {
  const s = limpo(v, 40);
  if (!s) return "";
  const t = Date.parse(s);
  if (!isFinite(t)) return "";
  const now = agora.getTime();
  if (t > now + DIA_MS || now - t >= VALIDADE_DA_ORIGEM_MS) return "";
  return new Date(t).toISOString();
}

/** A página de entrada do app numa visita direta: "/register" ou "/login". */
export function paginaDeEntradaDoApp(pathname: string): "/login" | "/register" {
  return /^\/(\(auth\)\/)?register\/?$/i.test(String(pathname || "")) ? "/register" : "/login";
}

/** Tela de entrada do app ("/", "/login", "/register")? Só nelas a origem é guardada. */
export function ehTelaDeEntrada(pathname: string): boolean {
  return /^\/((\(auth\)\/)?(login|register))?\/?$/i.test(String(pathname || "/"));
}

/** O toque diz de onde veio (UTM, ref ou site de origem)? Visita direta não diz. */
export function temSinal(o: OrigemDoCadastro | null | undefined): boolean {
  if (!o || typeof o !== "object") return false;
  if (o.referrer || o.ref) return true;
  return UTM_KEYS.some((k) => !!o[k]);
}

/** Toque guardado ainda dentro dos 30 dias (e não no futuro)? */
export function origemValida(o: OrigemDoCadastro | null | undefined, agora: Date): boolean {
  if (!o || typeof o !== "object" || typeof o.first_seen_at !== "string") return false;
  return !!dataValida(o.first_seen_at, agora);
}

/** Regrava só as chaves e tamanhos do contrato (o localStorage pode ter sido mexido). */
export function limparOrigem(o: unknown): OrigemDoCadastro | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const b = o as Record<string, unknown>;
  const out: OrigemDoCadastro = {};
  for (const k of UTM_KEYS) {
    const v = limpo(b[k], 100);
    if (v) out[k] = v;
  }
  const ref = codigoDoLink(b.ref);
  if (ref) out.ref = ref;
  const rf = limpo(b.referrer, 200).toLowerCase();
  if (rf && /^[a-z0-9.-]+$/.test(rf)) out.referrer = rf;
  const lp = soCaminho(b.landing_page);
  if (lp) out.landing_page = lp;
  const fs = limpo(b.first_seen_at, 40);
  if (fs) out.first_seen_at = fs;
  return Object.keys(out).length ? out : null;
}

/**
 * Origem com sinal lida da URL (utm, ref, origem_* do site) e do referrer.
 * Sem UTM, sem ref e sem site de origem, devolve null.
 */
export function montarOrigem(args: {
  search: string;
  referrer: string;
  pathname: string;
  ownHost: string;
  agora: Date;
}): OrigemDoCadastro | null {
  let params: URLSearchParams;
  try { params = new URLSearchParams(args.search || ""); } catch { return null; }
  const out: OrigemDoCadastro = {};
  for (const k of UTM_KEYS) {
    const v = limpo(params.get(k), 100);
    if (v) out[k] = v;
  }
  const ref = codigoDoLink(params.get("ref") || params.get("codigo"));
  if (ref) out.ref = ref;
  const host = hostDoSite(params.get(PARAMS_DO_SITE.referrer), args.ownHost) || hostDeFora(args.referrer, args.ownHost);
  if (host) out.referrer = host;
  if (!Object.keys(out).length) return null;
  out.landing_page = soCaminho(params.get(PARAMS_DO_SITE.landing_page)) || soCaminho(args.pathname) || "/";
  out.first_seen_at = dataValida(params.get(PARAMS_DO_SITE.first_seen_at), args.agora) || args.agora.toISOString();
  return out;
}

/**
 * Visita direta (b-mk-33 B): só a página de entrada e a data. Vinda do site
 * (origem_pagina), a página e a data são as do site; senão "/login" ou
 * "/register" e agora.
 */
export function montarVisitaDireta(args: { search: string; pathname: string; agora: Date }): OrigemDoCadastro {
  let params: URLSearchParams | null = null;
  try { params = new URLSearchParams(args.search || ""); } catch { params = null; }
  const doSite = params ? soCaminho(params.get(PARAMS_DO_SITE.landing_page)) : "";
  const data = doSite && params ? dataValida(params.get(PARAMS_DO_SITE.first_seen_at), args.agora) : "";
  return {
    landing_page: doSite || paginaDeEntradaDoApp(args.pathname),
    first_seen_at: data || args.agora.toISOString(),
  };
}

/** O que guardar: a nova origem, ou null para manter a guardada. */
export function decidirOrigem(
  existente: OrigemDoCadastro | null,
  nova: OrigemDoCadastro | null,
  agora: Date,
): OrigemDoCadastro | null {
  if (!nova) return null;
  if (origemValida(existente, agora)) {
    if (temSinal(existente) || !temSinal(nova)) return null;
  }
  return nova;
}

// ── armazenamento (localStorage do app, com try/catch) ─────────────
let emMemoria: OrigemDoCadastro | null = null;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function lerGuardada(): OrigemDoCadastro | null {
  const ls = storage();
  if (ls) {
    try {
      const raw = ls.getItem(CHAVE_DA_ORIGEM);
      if (raw) {
        const o = limparOrigem(JSON.parse(raw));
        if (o) return o;
      }
    } catch { /* ilegível ou bloqueado: cai na memória */ }
  }
  return emMemoria;
}

function guardar(o: OrigemDoCadastro): void {
  emMemoria = o;
  const ls = storage();
  if (ls) { try { ls.setItem(CHAVE_DA_ORIGEM, JSON.stringify(o)); } catch { /* fica em memória */ } }
}

/** Só para teste: esquece a origem em memória. */
export function _zerarOrigemEmMemoria(): void { emMemoria = null; }

/**
 * Lê a URL da tela aberta agora e guarda a origem pela regra de primeiro
 * toque. Só no web e só nas telas de entrada. Nunca lança.
 */
export function guardarOrigemDaEntrada(agora: Date = new Date()): void {
  try {
    if (typeof window === "undefined" || !window.location) return;
    const pathname = window.location.pathname || "/";
    if (!ehTelaDeEntrada(pathname)) return;
    const search = window.location.search || "";
    const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
    const ownHost = window.location.hostname || "";
    const nova = montarOrigem({ search, referrer, pathname, ownHost, agora }) || montarVisitaDireta({ search, pathname, agora });
    const decidida = decidirOrigem(lerGuardada(), nova, agora);
    if (decidida) guardar(decidida);
  } catch {
    /* nunca atrapalha a tela */
  }
}

/**
 * A origem que vai no cadastro: guarda a da URL atual (mesma regra) e
 * devolve o primeiro toque guardado, se ainda válido. O código de indicação
 * da URL do cadastro entra quando o guardado não tem um. Fora do web, null.
 */
export function origemParaOCadastro(agora: Date = new Date()): OrigemDoCadastro | null {
  try {
    if (typeof window === "undefined" || !window.location) return null;
    guardarOrigemDaEntrada(agora);
    const g = lerGuardada();
    if (!g || !origemValida(g, agora)) return null;
    const out: OrigemDoCadastro = { ...g };
    if (!out.ref) {
      const params = new URLSearchParams(window.location.search || "");
      const ref = codigoDoLink(params.get("ref") || params.get("codigo"));
      if (ref) out.ref = ref;
    }
    return out;
  } catch {
    return null;
  }
}
