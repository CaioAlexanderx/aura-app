// ============================================================
// AURA. — atualizarApp: "estou rodando a última versão?" (22/09/2026)
//
// O PROBLEMA que isto resolve, e por que ele piorou com o PWA:
// o Cloudflare Pages troca o bundle a cada deploy, mas a aba (ou o app
// instalado) continua com o JS que baixou quando abriu. No navegador o
// lojista aperta F5 e pronto. No app instalado NÃO EXISTE F5: a janela é
// só a nossa, sem barra de endereço e sem botão de recarregar. Quem abriu
// o app na segunda pode ficar dias com o bundle da segunda.
//
// COMO SABEMOS a versão (a mesma leitura do components/UpdateBanner.tsx,
// agora em um lugar só, para não existir uma terceira cópia):
//   - versão RODANDO   = hash do entry-<hash>.js na script tag do documento
//   - versão SERVIDA   = hash do entry-<hash>.js no HTML de "/" (no-store)
//   - diferentes → tem versão nova; iguais → já está na última.
//
// ⚠️ O QUE ISTO **NÃO** É: o aviso automático de nova versão. Aquele
// (UpdateBanner) segue desligado desde 11/07/2026, e por um motivo que não
// mudou: o bundle é ÚNICO para toda a Aura, então um deploy do Karatê
// muda o hash do lojista de varejo também, e ele via o toast o dia inteiro
// sem nada do produto dele ter mudado. A correção estrutural continua
// sendo o backend expor um /version dizendo QUAL vertical mudou. Até lá o
// caminho é este: o usuário pede a atualização quando quer, custo zero de
// ruído.
//
// 13/10/2026 — JANELA DE CONGELAMENTO. Dentro das janelas de utils/
// janelaDeCongelamento.ts (Black Friday e fim de ano) uma versão nova só
// vale se o build a marcou como hotfix: o build grava dist/version.json
// (scripts/congelamento.js gerar-versao) com { hash, hotfix }. Sem o
// arquivo, ou com hash que não bate com o servido, vale "não é hotfix" — na
// dúvida, congelado. Fora da janela nada disso é lido: comportamento igual
// ao de antes. Ver docs/CONGELAMENTO.md.
// ============================================================
import { emCongelamento } from "@/utils/janelaDeCongelamento";

/** Hash do bundle dentro do HTML servido por "/". */
export const ENTRY_RE = /\/_expo\/static\/js\/web\/entry-([a-f0-9]+)\.js/;
/** Hash no src de uma script tag já carregada (pode ser caminho relativo). */
export const ENTRY_SRC_RE = /entry-([a-f0-9]+)\.js/;

/** Onde o build publica a marca de versão (hotfix ou não). */
export const VERSION_URL = "/version.json";

/** Quanto esperamos pelo update() do service worker antes de recarregar. */
export const LIMITE_DO_SW_MS = 2500;

export type ResultadoDaVerificacao =
  /** já está rodando o que o servidor serve */
  | "atualizado"
  /** o servidor serve outro bundle */
  | "nova"
  /** há bundle novo, mas estamos em congelamento e ele não é hotfix: fica quieto */
  | "pausada"
  /** não deu para comparar: sem hash (dev), offline, fetch bloqueado */
  | "indisponivel";

/** Injeção para os testes; em produção sai tudo de `window`. */
export type DependenciasDaAtualizacao = {
  w?: any;
  buscar?: (entrada: any, init?: any) => Promise<any>;
  /** "Agora", para os testes da janela de congelamento. */
  agora?: Date;
};

function janela(deps?: DependenciasDaAtualizacao): any {
  if (deps && "w" in deps) return deps.w;
  return typeof window === "undefined" ? null : window;
}

/** Hash do bundle que ESTÁ rodando nesta aba/app. `null` no nativo e no dev. */
export function hashCarregado(deps?: DependenciasDaAtualizacao): string | null {
  const doc = janela(deps)?.document;
  if (!doc || typeof doc.querySelectorAll !== "function") return null;
  try {
    for (const sc of Array.from(doc.querySelectorAll("script[src]")) as any[]) {
      const m = String(sc.getAttribute("src") || "").match(ENTRY_SRC_RE);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

/** Hash do bundle que o servidor está SERVINDO agora. `null` se não deu. */
export async function hashServido(deps?: DependenciasDaAtualizacao): Promise<string | null> {
  const w = janela(deps);
  const buscar =
    deps && "buscar" in deps
      ? deps.buscar
      : typeof w?.fetch === "function"
        ? w.fetch.bind(w)
        : null;
  if (!buscar) return null;
  try {
    const res = await buscar("/", { cache: "no-store" });
    if (!res || !res.ok) return null;
    const html = await res.text();
    const m = String(html).match(ENTRY_RE);
    return m ? m[1] : null;
  } catch {
    // offline ou transiente: silêncio, quem chamou decide o que dizer.
    return null;
  }
}

/**
 * O bundle servido foi marcado como hotfix no build? `false` quando o
 * arquivo não existe, não é JSON, não diz `hotfix: true` ou é de outro
 * bundle (o hash amarra a marca: um version.json velho, de cache de borda
 * ou de deploy no meio, nunca libera um bundle que não é o dele).
 */
export async function hotfixServido(
  hashDoBundleServido: string,
  deps?: DependenciasDaAtualizacao,
): Promise<boolean> {
  const w = janela(deps);
  const buscar =
    deps && "buscar" in deps
      ? deps.buscar
      : typeof w?.fetch === "function"
        ? w.fetch.bind(w)
        : null;
  if (!buscar) return false;
  try {
    const res = await buscar(VERSION_URL, { cache: "no-store" });
    if (!res || !res.ok) return false;
    const v = JSON.parse(await res.text());
    return v?.hotfix === true && v?.hash === hashDoBundleServido;
  } catch {
    return false;
  }
}

/**
 * Este bundle servido pode substituir o que está rodando? Fora da janela de
 * congelamento sempre (nem lê o version.json); dentro, só se for hotfix.
 */
export async function atualizacaoLiberada(
  hashDoBundleServido: string,
  deps?: DependenciasDaAtualizacao,
): Promise<boolean> {
  const agora = deps?.agora ?? new Date(Date.now());
  if (!emCongelamento(agora)) return true;
  return hotfixServido(hashDoBundleServido, deps);
}

export async function verificarAtualizacao(
  deps?: DependenciasDaAtualizacao,
): Promise<ResultadoDaVerificacao> {
  const carregado = hashCarregado(deps);
  // Sem hash não há comparação honesta (Expo em dev, nativo). Melhor dizer
  // "não deu" do que inventar um "tem versão nova" e recarregar à toa.
  if (!carregado) return "indisponivel";
  const servido = await hashServido(deps);
  if (!servido) return "indisponivel";
  if (servido === carregado) return "atualizado";
  return (await atualizacaoLiberada(servido, deps)) ? "nova" : "pausada";
}

function comLimite<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((ok) => setTimeout(() => ok(null), ms)),
  ]);
}

/**
 * Recarrega com a versão nova. O sw.js não guarda o bundle (decisão de
 * 10/09/2026: só Web Push e a página offline), então o reload já basta —
 * mas pedimos update() ao registro para não ficar com um sw.js velho
 * quando o deploy mexeu nele. Com limite de tempo: rede ruim não pode
 * segurar o reload que o usuário pediu.
 */
export async function atualizarAgora(deps?: DependenciasDaAtualizacao): Promise<void> {
  const w = janela(deps);
  if (!w) return;
  try {
    const sw = w.navigator?.serviceWorker;
    if (sw && typeof sw.getRegistration === "function") {
      const reg = await comLimite(Promise.resolve(sw.getRegistration()), LIMITE_DO_SW_MS);
      if (reg && typeof reg.update === "function") {
        await comLimite(Promise.resolve(reg.update()), LIMITE_DO_SW_MS);
      }
    }
  } catch {}
  try {
    w.location.reload();
  } catch {}
}
