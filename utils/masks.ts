// ============================================================
// AURA. — Máscaras de input para formulários PT-BR
// Funções idempotentes: aplicar a mesma máscara duas vezes não muda o resultado.
// Todas trabalham com strings, retornam strings, e ignoram caracteres invalidos.
// ============================================================

/** Máscara de telefone celular ou fixo: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX */
export function maskPhone(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  // 11 dígitos: celular com 9
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Máscara de CPF: 000.000.000-00 */
export function maskCpf(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Máscara de CNPJ: 00.000.000/0000-00 */
export function maskCnpj(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Máscara CPF/CNPJ adaptativa: até 11 dígitos vira CPF, acima vira CNPJ */
export function maskCpfCnpj(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length <= 11 ? maskCpf(value) : maskCnpj(value);
}

/** Máscara de data PT-BR: DD/MM/AAAA */
export function maskDateBr(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Converte DD/MM/AAAA → AAAA-MM-DD. Retorna null se incompleta ou inválida. */
export function brDateToIso(value: string): string | null {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const day   = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year  = parseInt(yyyy, 10);
  if (day < 1 || day > 31)  return null;
  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 2100) return null;
  // Validação básica via Date — pega 31/02 etc.
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Devolve só os dígitos da string. Util pra payloads que esperam telefone/CPF cru. */
export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}
