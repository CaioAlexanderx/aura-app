// ============================================================
// components/studio/storefront/versoDoPedido.ts
//
// O verso só existe quando a cliente o escolheu E preencheu.
//
// ── O QUE ACONTECIA ────────────────────────────────────────────────────
// Em peça com verso incluso no preço (sem cobrança extra), o verso era
// tratado como "selecionado" por padrão. O pedido chegava ao painel com
// "Personalizar o verso: Sim" e a ficha mandava prensar um verso que a
// cliente nunca tocou. Achado do QA de 04/09/2026; decisão do Caio: só
// existe quando selecionado pela cliente e preenchido.
//
// ── A REGRA ────────────────────────────────────────────────────────────
// Verso ativo = a peça tem verso
//             E (se o verso é cobrado à parte, ela ligou a chave)
//             E pelo menos um campo do verso tem valor.
//
// A cobrança do verso (`backDelta`) continua olhando só a chave: cobrar
// é uma coisa, produzir é outra. Esta regra decide o que vai PRODUZIR.
// ============================================================
import type { CustomizationConfig } from "./types";
import { sideOf } from "@/components/studio/customizationConfig";

function temValor(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Algum campo do verso foi preenchido? */
export function versoPreenchido(
  cfg: CustomizationConfig | null | undefined,
  values: Record<string, any> | null | undefined
): boolean {
  const campos = cfg?.fields || [];
  const v = values || {};
  return campos.some((f: any) => sideOf(f) === "back" && temValor(v[f.id]));
}

/**
 * O verso vai para a produção?
 *
 * `escolhido` é a chave que a cliente liga quando o verso é cobrado à
 * parte. Quando não é cobrado, não há chave — e é aí que o padrão antigo
 * mandava "Sim" para todo pedido.
 */
export function versoAtivo(
  cfg: CustomizationConfig | null | undefined,
  escolhido: boolean | undefined,
  values: Record<string, any> | null | undefined
): boolean {
  if (!cfg || cfg.has_back !== true) return false;
  if (cfg.back_charge_enabled === true && escolhido !== true) return false;
  return versoPreenchido(cfg, values);
}
