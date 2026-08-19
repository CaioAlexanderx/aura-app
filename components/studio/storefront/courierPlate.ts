// ============================================================
// components/studio/storefront/courierPlate.ts
// S8 — placa do entregador na retirada por app.
//
// ESPELHO de normalizePlate em src/services/courierPickup.js
// (aura-backend). O servidor revalida sempre; isto existe para o cliente
// ver o erro ANTES de mandar o pedido, e para exibir a placa formatada
// enquanto ele digita.
//
// Placa brasileira: antiga ABC1234 e Mercosul ABC1D23. Motos seguem o
// mesmo formato.
// ============================================================

const PLATE_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/** Placa normalizada (caixa alta, sem separador) ou null se inválida. */
export function normalizePlate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const clean = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return PLATE_RE.test(clean) ? clean : null;
}

/**
 * Máscara de digitação: ABC-1234.
 *
 * Só formata, nunca recusa — quem recusa é normalizePlate no envio. Uma
 * máscara que bloqueia caractere "errado" trava o cliente que digitou um
 * dígito a mais e tenta corrigir.
 */
export function maskPlate(raw: string): string {
  const clean = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (clean.length <= 3) return clean;
  return clean.slice(0, 3) + "-" + clean.slice(3);
}
