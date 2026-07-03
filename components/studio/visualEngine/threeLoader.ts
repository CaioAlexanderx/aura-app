// ============================================================
// AURA STUDIO · visualEngine/threeLoader — F4
//
// Carrega three.js em runtime via CDN (web-only), sob demanda.
// DECISÃO CONSCIENTE: não adicionamos dep no package.json porque o
// build CF usa `npm ci` e dep nova exige regenerar package-lock.json
// no mesmo commit (armadilha conhecida, 08/06). Migrar pra dep npm
// é follow-up quando o lockfile puder ser regenerado junto.
// r128: mesma versão validada no demo aprovado do escopo.
// ============================================================
const THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

let loading: Promise<any> | null = null;

export function loadThree(): Promise<any> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("three.js disponível apenas no web"));
  }
  const w = window as any;
  if (w.THREE) return Promise.resolve(w.THREE);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = THREE_CDN;
      s.async = true;
      s.onload = () => {
        if (w.THREE) resolve(w.THREE);
        else { loading = null; reject(new Error("three.js carregou sem global THREE")); }
      };
      s.onerror = () => { loading = null; reject(new Error("Falha ao carregar three.js (CDN)")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}
