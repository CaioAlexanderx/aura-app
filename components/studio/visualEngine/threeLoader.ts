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

// 27/09/2026 — os loaders de GLB vêm do mesmo r128, em examples/js (o
// formato "script que pendura em THREE", que o r148 removeu — por isso a
// versão é cravada). Só são baixados quando uma spec pede model.kind='glb';
// a caneca procedural continua custando um script só.
const GLTF_LOADER_CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
const DRACO_LOADER_CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js";
export const DRACO_DECODER_PATH = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/";

let loading: Promise<any> | null = null;

function loadScript(url: string, pronto: () => boolean, rotulo: string): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error(rotulo + " disponível apenas no web"));
  }
  if (pronto()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => {
      if (pronto()) resolve();
      else reject(new Error(rotulo + " carregou sem se registrar em THREE"));
    };
    s.onerror = () => reject(new Error("Falha ao carregar " + rotulo + " (CDN)"));
    document.head.appendChild(s);
  });
}

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

let loadingGltf: Promise<any> | null = null;
let loadingDraco: Promise<any> | null = null;

/** `THREE.GLTFLoader` do r128, carregado depois do three e uma vez só. */
export function loadGLTFLoader(): Promise<any> {
  if (!loadingGltf) {
    loadingGltf = loadThree()
      .then((THREE) => loadScript(GLTF_LOADER_CDN, () => !!THREE.GLTFLoader, "GLTFLoader").then(() => THREE.GLTFLoader))
      .catch((e) => { loadingGltf = null; throw e; });
  }
  return loadingGltf;
}

/** `THREE.DRACOLoader` — só quando um GLB exige KHR_draco_mesh_compression. */
export function loadDRACOLoader(): Promise<any> {
  if (!loadingDraco) {
    loadingDraco = loadThree()
      .then((THREE) => loadScript(DRACO_LOADER_CDN, () => !!THREE.DRACOLoader, "DRACOLoader").then(() => THREE.DRACOLoader))
      .catch((e) => { loadingDraco = null; throw e; });
  }
  return loadingDraco;
}
