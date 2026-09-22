// ============================================================
// AURA. — instalar o painel como app (PWA): a lógica, sem React
//
// Criado: 22/09/2026 (PWA Fase 1)
//
// Uma fonte só para três perguntas que a interface faz:
//
//   1. Já está instalado?     → o painel abriu pelo ícone da tela inicial
//                               (display-mode: standalone) e não pela aba
//                               do navegador.
//   2. Dá para instalar?      → o navegador ofereceu o convite nativo
//                               (evento `beforeinstallprompt`: Chrome e
//                               derivados, no Android e no computador).
//   3. É iPhone/iPad?         → a Apple não tem convite. A interface
//                               mostra o guia (Compartilhar › Adicionar à
//                               Tela de Início) em vez de um botão morto.
//
// O convite do Chrome dispara UMA vez por carregamento, cedo, às vezes
// antes de qualquer componente montar. Por isso public/index.html guarda o
// evento em window.__auraConvite assim que ele nasce, e este módulo o lê
// daqui; sem isso o botão "Instalar" só apareceria em recarregamentos em
// que o React ganhasse a corrida.
//
// Sem `react-native` aqui de propósito: web-only por natureza, e testável
// em jsdom sem mock nenhum (hooks/useInstalarApp.ts embrulha em React).
// ============================================================

export type PlataformaDeInstalacao = "android" | "iphone" | "desktop" | "indisponivel";

export type EstadoDaInstalacao = {
  /** Abriu pelo ícone (standalone), não pela aba do navegador. */
  instalado: boolean;
  /** O navegador ofereceu o convite nativo e ele ainda não foi usado. */
  podeInstalar: boolean;
  /** iPhone/iPad fora do app: mostrar o guia, não um botão. */
  ehIphone: boolean;
  plataforma: PlataformaDeInstalacao;
};

type EventoDeConvite = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const ENDERECO_DO_PAINEL = "app.getaura.com.br";
export const DIAS_DE_DISPENSA = 14;
const CHAVE_DISPENSA = "aura.instalarApp.dispensadoAte";

function temJanela(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

let convite: EventoDeConvite | null = null;
let escutando = false;
const ouvintes = new Set<() => void>();

function avisar(): void {
  ouvintes.forEach((f) => {
    try { f(); } catch { /* um ouvinte quebrado não derruba os outros */ }
  });
}

/** iPhone/iPad. O iPadOS 13+ se apresenta como Mac; o toque entrega. */
export function ehIos(ua: string, maxTouchPoints: number = 0, platform: string = ""): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Mac/i.test(platform) && maxTouchPoints > 1;
}

/** Abriu como app (tela cheia), não como aba. */
export function estaInstalado(w: any = temJanela() ? window : undefined): boolean {
  if (!w) return false;
  try {
    if (typeof w.matchMedia === "function" && w.matchMedia("(display-mode: standalone)")?.matches) return true;
  } catch { /* matchMedia ausente ou quebrado: cai no navigator.standalone */ }
  return w.navigator?.standalone === true;
}

// Handlers com nome (e não arrow inline) para _resetParaTestes conseguir
// removê-los: com anônimos, cada reinício empilharia mais um ouvinte na
// janela e o mesmo evento avisaria N vezes.
function aoChegarConvite(e: Event): void {
  // Sem isto o Chrome mostra a própria barrinha de "adicionar à tela
  // inicial" na hora que quiser; com isto, quem decide o momento é o card.
  e.preventDefault();
  convite = e as EventoDeConvite;
  (window as any).__auraConvite = convite;
  avisar();
}

function aoSerInstalado(): void {
  convite = null;
  (window as any).__auraConvite = null;
  avisar();
}

let consultaDeModo: MediaQueryList | null = null;

/** O que o index.html guardou antes de o JS do app carregar. */
function adotarConviteGuardado(): void {
  if (convite || !temJanela()) return;
  const guardado = (window as any).__auraConvite;
  if (guardado && typeof guardado.prompt === "function") convite = guardado;
}

function garantirEscuta(): void {
  if (escutando || !temJanela()) return;
  escutando = true;

  adotarConviteGuardado();
  window.addEventListener("beforeinstallprompt", aoChegarConvite);
  window.addEventListener("appinstalled", aoSerInstalado);

  try {
    consultaDeModo = typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
    if (consultaDeModo && typeof consultaDeModo.addEventListener === "function") consultaDeModo.addEventListener("change", avisar);
  } catch { /* sem matchMedia não há transição de modo para escutar */ }
}

export function estadoDaInstalacao(): EstadoDaInstalacao {
  garantirEscuta();
  adotarConviteGuardado();
  if (!temJanela()) return { instalado: false, podeInstalar: false, ehIphone: false, plataforma: "indisponivel" };

  const instalado = estaInstalado();
  const nav: any = navigator;
  const ua: string = nav?.userAgent || "";
  const ios = ehIos(ua, nav?.maxTouchPoints || 0, nav?.platform || "");
  const plataforma: PlataformaDeInstalacao = ios ? "iphone" : /Android/i.test(ua) ? "android" : "desktop";

  return {
    instalado,
    podeInstalar: !instalado && !!convite,
    ehIphone: ios && !instalado,
    plataforma,
  };
}

/**
 * Chama o convite nativo. O evento só serve uma vez: aceito ou recusado,
 * o Chrome não o dispara de novo neste carregamento.
 */
export async function instalar(): Promise<"aceito" | "recusado" | "indisponivel"> {
  garantirEscuta();
  adotarConviteGuardado();
  const ev = convite;
  if (!ev) return "indisponivel";
  convite = null;
  if (temJanela()) (window as any).__auraConvite = null;
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    return outcome === "accepted" ? "aceito" : "recusado";
  } catch {
    return "indisponivel";
  } finally {
    avisar();
  }
}

/** Avisa quando o estado muda (convite chegou, app foi instalado, modo mudou). */
export function aoMudar(f: () => void): () => void {
  garantirEscuta();
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

// ------------------------------------------------------------
// "Agora não": esconde o convite por DIAS_DE_DISPENSA. localStorage pode
// não existir, estar bloqueado ou lançar (modo privado, cota): toda leitura
// e escrita cai para "não dispensado" em vez de quebrar o Painel.
// ------------------------------------------------------------
function storagePadrao(): Storage | null {
  try { return temJanela() ? window.localStorage : null; } catch { return null; }
}

export function estaDispensado(agora: number = Date.now(), s: Storage | null = storagePadrao()): boolean {
  try {
    const v = s?.getItem(CHAVE_DISPENSA);
    if (!v) return false;
    const ate = Date.parse(v);
    return Number.isFinite(ate) && ate > agora;
  } catch {
    return false;
  }
}

export function dispensar(agora: number = Date.now(), s: Storage | null = storagePadrao()): void {
  try {
    s?.setItem(CHAVE_DISPENSA, new Date(agora + DIAS_DE_DISPENSA * 864e5).toISOString());
  } catch { /* sem storage, o convite volta no próximo carregamento; aceitável */ }
}

/** Só para testes: volta ao estado de módulo recém-carregado. */
export function _resetParaTestes(): void {
  if (temJanela()) {
    window.removeEventListener("beforeinstallprompt", aoChegarConvite);
    window.removeEventListener("appinstalled", aoSerInstalado);
    try { consultaDeModo?.removeEventListener?.("change", avisar); } catch { /* já sem matchMedia */ }
    (window as any).__auraConvite = null;
  }
  consultaDeModo = null;
  convite = null;
  escutando = false;
  ouvintes.clear();
  // "Recém-carregado" inclui estar escutando (ver o rodapé do módulo).
  garantirEscuta();
}

// Arma os ouvintes na carga do módulo, não no primeiro uso: o convite do
// Chrome pode nascer entre o bundle carregar e o primeiro componente
// montar. Junto com o que o index.html guarda, nenhum dos dois momentos
// escapa.
garantirEscuta();
