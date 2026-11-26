// ============================================================
// AURA. — Nova condicional · prazo de devolução (C7)
//
// 1, 2, 3 ou 7 dias, ou outra data. O backend aceita de hoje a 30 dias
// (COND_DATA); sem data ele usa o prazo padrão da loja
// (`condicional_prazo_padrao`, 1 a 30, padrão 3). Datas em AAAA-MM-DD no
// fuso de São Paulo. Funções puras.
// ============================================================

export const DIAS_DO_PRAZO = [1, 2, 3, 7] as const;
export const PRAZO_MAXIMO_DIAS = 30;
export const PRAZO_PADRAO_DIAS = 3;

const SEMANA_CURTA = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

export function somarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "qui., 26/11" (o formato dos chips e do rodapé do mockup). */
export function diaCurto(iso: string): string {
  const dia = new Date(iso + "T12:00:00Z").getUTCDay();
  return `${SEMANA_CURTA[dia]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** A data está entre hoje e hoje + 30 dias? */
export function dataDentroDoPrazo(iso: string | null | undefined, hoje: string): boolean {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return iso >= hoje && iso <= somarDias(hoje, PRAZO_MAXIMO_DIAS);
}

export type PrazoEscolhido = { dias: 1 | 2 | 3 | 7 | 0; data: string };

/** O prazo padrão da loja (1 a 30 dias) vira o chip certo, ou "Outra data". */
export function prazoInicial(hoje: string, padraoDias?: unknown): PrazoEscolhido {
  const n = Math.floor(Number(padraoDias));
  const dias = Number.isFinite(n) && n >= 1 && n <= PRAZO_MAXIMO_DIAS ? n : PRAZO_PADRAO_DIAS;
  const data = somarDias(hoje, dias);
  return { dias: (DIAS_DO_PRAZO as readonly number[]).includes(dias) ? (dias as 1 | 2 | 3 | 7) : 0, data };
}
