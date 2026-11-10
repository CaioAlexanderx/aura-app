// ============================================================
// AURA. — Telefone: normalizador único (10/11/2026)
//
// Caso real: a lojista digitou o celular com o +55 na frente
// ("5566992384539", 13 dígitos) e o campo cortou em 11 ("55669923845"),
// perdendo o fim do número. O corte vinha de duas coisas: a máscara fazia
// `.slice(0, 11)` antes de olhar o 55, e o `maxLength` do TextInput cortava o
// que foi colado ("+55 (66) 99238-4539" tem 19 caracteres).
//
// Regra (espelho de src/utils/telefone.js no backend):
//   1. só os dígitos contam: +55, parênteses, espaços e hífen saem;
//   2. passou de 11 dígitos:
//        "00" na frente (discagem internacional) sai;
//        "55" na frente (código do país) sai;
//        "0" na frente (tronco) sai e, sobrando 12 ou 13, os dois primeiros
//        são o código da operadora e saem também;
//   3. continuou com mais de 11: NUNCA corta. O valor fica com todos os
//      dígitos e a tela mostra ERRO_TELEFONE_LONGO.
//
// Formato padrão dos cadastros: DDD + número (10 ou 11 dígitos), sem o 55.
// Até 11 dígitos nada muda: um DDD 55 (Santa Maria/RS) legítimo fica intacto.
//
// O limite de tamanho vale DEPOIS de normalizar. No TextInput, use
// TELEFONE_MAX_CARACTERES (folga para colar com +55 e espaços), nunca 15.
// ============================================================

export const TELEFONE_MAX_DIGITOS = 11;

/** maxLength dos campos de telefone: cabe "+55 (66) 99238-4539" colado com folga. */
export const TELEFONE_MAX_CARACTERES = 25;

export const ERRO_TELEFONE_LONGO =
  "Esse número ficou com dígitos a mais. Confira, por favor: é o DDD e o número, como (66) 99238-4539.";

export function digitosDoTelefone(v: string | number | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

export type TelefoneNormalizado = {
  /** DDD + número, só dígitos. Com erro, todos os dígitos (nada cortado). */
  digitos: string;
  erro: string | null;
};

export function normalizarTelefone(v: string | number | null | undefined): TelefoneNormalizado {
  let d = digitosDoTelefone(v);
  if (d.length > TELEFONE_MAX_DIGITOS && d.startsWith("00")) d = d.slice(2);
  if (d.length > TELEFONE_MAX_DIGITOS && d.startsWith("55")) d = d.slice(2);
  if (d.length > TELEFONE_MAX_DIGITOS && d.startsWith("0")) {
    d = d.slice(1);
    if (d.length === 12 || d.length === 13) d = d.slice(2);
  }
  if (d.length > TELEFONE_MAX_DIGITOS) {
    // Nada cortado: devolve todos os dígitos de como veio.
    return { digitos: digitosDoTelefone(v), erro: ERRO_TELEFONE_LONGO };
  }
  return { digitos: d, erro: null };
}

/** Só a mensagem de dígitos a mais (ou null). Campo vazio ou curto não é erro aqui. */
export function erroDoTelefone(v: string | number | null | undefined): string | null {
  return normalizarTelefone(v).erro;
}

/**
 * Máscara "(66) 99238-4539" (celular) ou "(66) 9238-4539" (fixo), aos pedaços
 * enquanto digita. Idempotente. Com dígitos a mais, devolve os dígitos sem
 * máscara (nada some da tela) e a tela mostra ERRO_TELEFONE_LONGO.
 */
export function formatarTelefone(v: string | number | null | undefined): string {
  const { digitos: d, erro } = normalizarTelefone(v);
  if (erro) return d;
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Para o payload: DDD + número só com dígitos (ou "" se vazio). Com erro, não envie. */
export function telefoneParaEnviar(v: string | number | null | undefined): string {
  return normalizarTelefone(v).digitos;
}
