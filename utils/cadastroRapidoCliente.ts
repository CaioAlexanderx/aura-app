// ============================================================
// AURA. — Regra do cadastro rápido de cliente (Caixa e "Indicado por"
// do Matcon), 25/09/2026.
//
// Só o nome é obrigatório, como na página de Clientes. A GF Amorim
// (materiais de construção) vendeu 25 vezes sem conseguir cadastrar um
// cliente: o botão só acendia com data de nascimento e telefone.
//
// Opcional não quer dizer "aceita qualquer coisa": data ou telefone
// começados e não terminados viram erro, em vez de sumirem em silêncio.
// ============================================================

export type CadastroRapidoInput = { name: string; birthDate: string; phone: string };

export type CadastroRapidoResultado =
  | { ok: true; body: { name: string; phone: string | null; birth_date: string | null } }
  | { ok: false; erro: string };

const soDigitos = (v: string) => (v || "").replace(/\D/g, "");

/** DD/MM/AAAA (8 dígitos) → AAAA-MM-DD, ou null se não for uma data real. */
function dataIso(digitos: string): string | null {
  const d = parseInt(digitos.slice(0, 2), 10);
  const m = parseInt(digitos.slice(2, 4), 10);
  const a = parseInt(digitos.slice(4, 8), 10);
  const data = new Date(Date.UTC(a, m - 1, d));
  if (a < 1900 || data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
  return `${digitos.slice(4, 8)}-${digitos.slice(2, 4)}-${digitos.slice(0, 2)}`;
}

export function nomeValido(name: string): boolean {
  return (name || "").trim().length >= 2;
}

export function validarCadastroRapido(input: CadastroRapidoInput): CadastroRapidoResultado {
  const name = (input.name || "").trim();
  if (!nomeValido(name)) return { ok: false, erro: "Informe o nome do cliente" };

  const tel = soDigitos(input.phone);
  if (tel.length > 0 && tel.length < 10) {
    return { ok: false, erro: "Telefone incompleto. Complete com o DDD ou apague o campo." };
  }

  const nasc = soDigitos(input.birthDate);
  let birth_date: string | null = null;
  if (nasc.length > 0) {
    if (nasc.length < 8) return { ok: false, erro: "Data de nascimento incompleta. Complete ou apague o campo." };
    birth_date = dataIso(nasc);
    if (!birth_date) return { ok: false, erro: "Data de nascimento inválida" };
  }

  return { ok: true, body: { name, phone: tel || null, birth_date } };
}
