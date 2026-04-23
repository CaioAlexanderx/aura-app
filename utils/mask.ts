// ============================================================
// AURA. — Utilitarios de mascara de input
// Masks manuais sem dependencia de lib externa.
// ============================================================

// CPF: 000.000.000-00
export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.replace(/(\d{3})(\d+)/, "$1.$2");
  if (digits.length <= 9) return digits.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, "$1.$2.$3-$4");
}

// Telefone: (00) 00000-0000 (celular) ou (00) 0000-0000 (fixo)
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Data BR: DD/MM/AAAA
export function maskDateBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Converte DD/MM/AAAA em YYYY-MM-DD (ISO date) ou null se invalido
export function brDateToISO(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = parseInt(dd), month = parseInt(mm), year = parseInt(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// Converte YYYY-MM-DD em DD/MM/AAAA (pra pre-popular campos)
export function isoToBRDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Remove mask de CPF/telefone (so digitos)
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Valida CPF (algoritmo dos digitos verificadores)
export function isValidCpf(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(digits[10]);
}

// Cria Date local a partir de strings de date (YYYY-MM-DD) e time (HH:MM),
// retorna ISO UTC correspondente. Evita problema de timezone quando o BE
// interpreta string naive como UTC (transforma em 06:00 SP quando user digitou 09:00).
export function localDateTimeToISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mn] = timeStr.split(":").map(Number);
  const local = new Date(y, (m || 1) - 1, d || 1, h || 0, mn || 0, 0);
  return local.toISOString();
}
