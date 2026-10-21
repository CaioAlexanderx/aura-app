// ============================================================
// Origem do cadastro no app (tq-68, 21/10/2026)
//
// O site (aura-site, js/origem.js) guarda o primeiro toque no localStorage
// do getaura.com.br, que o app (app.getaura.com.br) não enxerga. Quem chega
// direto no cadastro do app trazia a origem só na URL, e ela se perdia.
// Aqui a tela lê, UMA vez ao montar, o mesmo formato que o backend aceita
// (src/services/signupOrigem.js, sanitizarOrigem):
//   utm_source, utm_medium, utm_campaign, utm_content, utm_term (≤ 100)
//   landing_page  só o caminho (sem query nem #), ≤ 300
//   referrer      só o host, e só quando vem de FORA da Aura, ≤ 200
//   first_seen_at ISO do momento em que a tela abriu
//   ref           código de indicação do link (?ref= ou ?codigo=), [A-Z0-9-]
// Mesma regra do site: sem UTM, sem ref e sem referrer de fora, devolve null
// (nada é mandado). O backend sanitiza de novo; aqui só se evita lixo.
// Sem e-mail, telefone, IP ou query inteira.
// ============================================================

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
type UtmKey = (typeof UTM_KEYS)[number];

export type OrigemDoCadastro = Partial<Record<UtmKey, string>> & {
  landing_page?: string;
  referrer?: string;
  first_seen_at?: string;
  ref?: string;
};

const OWN_DOMAIN = "getaura.com.br";

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

/** Host do referrer quando ele vem de fora da Aura; "" no resto. */
export function hostDeFora(referrer: string, ownHost: string): string {
  if (!referrer) return "";
  let u: URL;
  try { u = new URL(referrer); } catch { return ""; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  const host = u.hostname.toLowerCase();
  if (!host) return "";
  const own = String(ownHost || "").toLowerCase();
  if (host === own || host === OWN_DOMAIN || host.endsWith("." + OWN_DOMAIN)) return "";
  return host.slice(0, 200);
}

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
  const host = hostDeFora(args.referrer, args.ownHost);
  if (host) out.referrer = host;
  if (!Object.keys(out).length) return null;
  out.landing_page = (limpo(args.pathname, 300).split("?")[0].split("#")[0]) || "/";
  out.first_seen_at = args.agora.toISOString();
  return out;
}

/** Lê a origem da URL e do referrer do navegador. Fora da web, ou com erro, null. */
export function lerOrigemDoNavegador(agora: Date = new Date()): OrigemDoCadastro | null {
  try {
    if (typeof window === "undefined" || !window.location) return null;
    const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
    return montarOrigem({
      search: window.location.search || "",
      referrer,
      pathname: window.location.pathname || "/",
      ownHost: window.location.hostname || "",
      agora,
    });
  } catch {
    return null;
  }
}
