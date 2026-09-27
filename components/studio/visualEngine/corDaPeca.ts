// ============================================================
// components/studio/visualEngine/corDaPeca.ts
// 27/09/2026 — a cor da PEÇA escolhida pelo cliente, num lugar só.
//
// Era `corDaLouca`, função local do LivePreview, e só alimentava o 3D.
// O 2D (EnginePreview e o próprio LivePreview) chamava `composeView` sem
// a cor: a camiseta vetorial ficava bege com "preto" escolhido. A regra
// é a mesma para os dois motores — e para o painel e a vitrine — então
// sai do componente e vira módulo puro.
//
// Não há campo de cor, ou nada escolhido: devolve undefined e o motor usa
// o próprio default, como antes.
// ============================================================

type ConfigComCampos = { fields?: Array<{ id: string; type: string }> | null } | null | undefined;

export function corDaPeca(cfg: ConfigComCampos, values: Record<string, any> | null | undefined): string | undefined {
  const campo = cfg?.fields?.find((f) => f.type === "color");
  if (!campo) return undefined;
  const v = values?.[campo.id];
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : undefined;
}
