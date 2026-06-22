// ============================================================
// Microsite bootstrap — reescrita de URL do {slug}.getaura.com.br
//
// EFEITO COLATERAL (sem export útil): importado como PRIMEIRO import do
// app/_layout.tsx, roda quando o módulo de rota é carregado — ANTES do
// Expo Router montar o container e ler a URL inicial.
//
// No web + host de microsite: deriva o slug do subdomínio e reescreve o
// caminho LIMPO (ex.: /dojo) para a forma interna (/karate/{slug}/dojo) via
// history.replaceState (API estável — não mexe no interno do Expo Router).
// Assim o link divulgado fica limpo e o router renderiza a tela certa, sem
// flash. No nativo (sem window) é no-op. Idempotente (paths já internos passam).
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { slugFromHost, micrositeTargetPath } = require("./micrositeCore");

if (typeof window !== "undefined" && window.location && window.history) {
  try {
    const slug = slugFromHost(window.location.hostname);
    if (slug) {
      const target = micrositeTargetPath(slug, window.location.pathname);
      if (target !== window.location.pathname) {
        window.history.replaceState(
          null,
          "",
          target + window.location.search + window.location.hash
        );
      }
    }
  } catch {
    /* nunca bloqueia o boot do app */
  }
}

export {};
