// ============================================================
// AURA. — Validators de CPF e CNPJ (algoritmo módulo 11 SEFAZ)
//
// CPF: 11 dígitos. Os 2 últimos são DVs calculados via mod 11 com pesos
// 10..2 e 11..2. Rejeita sequências repetidas (000.000.000-00 etc.).
//
// CNPJ: 14 dígitos. Os 2 últimos são DVs calculados via mod 11 com pesos
// 5..2,9..2 e 6..2,9..2. Rejeita repetidos.
//
// Ambos retornam boolean. Não lançam.
// ============================================================

/** Strip não-dígitos. */
export function onlyDigits(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

/** True se string é apenas dígitos repetidos: "00000000000", "11111111111", etc. */
function isAllSameDigit(s: string): boolean {
  return /^(\d)\1+$/.test(s);
}

/** CPF: 11 dígitos com mod 11. */
export function validateCpf(value: string | null | undefined): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11) return false;
  if (isAllSameDigit(c)) return false;

  // 1º DV: pesos 10..2 sobre os 9 primeiros dígitos
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let dv1 = (sum * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  if (dv1 !== parseInt(c[9], 10)) return false;

  // 2º DV: pesos 11..2 sobre os 10 primeiros (incluindo dv1)
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let dv2 = (sum * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  if (dv2 !== parseInt(c[10], 10)) return false;

  return true;
}

/** CNPJ: 14 dígitos com mod 11. */
export function validateCnpj(value: string | null | undefined): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14) return false;
  if (isAllSameDigit(c)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(c[i], 10) * w1[i];
  let dv1 = sum % 11;
  dv1 = dv1 < 2 ? 0 : 11 - dv1;
  if (dv1 !== parseInt(c[12], 10)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(c[i], 10) * w2[i];
  let dv2 = sum % 11;
  dv2 = dv2 < 2 ? 0 : 11 - dv2;
  if (dv2 !== parseInt(c[13], 10)) return false;

  return true;
}

/** Mask CPF visual: "000.000.000-00". Aceita parcial. */
export function maskCpf(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Mask CNPJ visual: "00.000.000/0000-00". Aceita parcial. */
export function maskCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Detecta automaticamente se é CPF ou CNPJ pela contagem de dígitos.
 * 11 → CPF, 14 → CNPJ, outros → null (incompleto).
 */
export function detectDocType(value: string | null | undefined): "cpf" | "cnpj" | null {
  const d = onlyDigits(value);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

/** Valida CPF ou CNPJ baseado no tamanho. */
export function validateCpfOrCnpj(value: string | null | undefined): boolean {
  const t = detectDocType(value);
  if (t === "cpf") return validateCpf(value);
  if (t === "cnpj") return validateCnpj(value);
  return false;
}
