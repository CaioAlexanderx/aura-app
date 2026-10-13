// ============================================================
// AURA. — Janela de congelamento de deploy (13/10/2026)
//
// Na Black Friday e no fim de ano o risco não é carga, é indisponibilidade
// pontual num dia em que o lojista não perdoa — e os incidentes recentes
// vieram de deploy. Decisão do plano de 13/10/2026: sem deploy de 24/11 a
// 01/12 e de 20/12 a 02/01, salvo hotfix aprovado pelo Caio.
//
// As datas moram em constants/janelasDeCongelamento.json (inicio e fim
// INCLUSIVOS, "AAAA-MM-DD", dia de Brasília). É um JSON de propósito: o
// guarda do CI (scripts/congelamento.js) lê o mesmo arquivo, então mudar a
// janela é editar UM lugar. Detalhes e como marcar hotfix: docs/CONGELAMENTO.md.
//
// Tudo aqui é puro (a data entra por parâmetro) para o teste não depender do
// relógio. Brasília é UTC-3 fixo desde 2019, então basta deslocar 3h e ler o
// dia em UTC — independe do fuso da máquina do usuário.
// ============================================================
import dados from "@/constants/janelasDeCongelamento.json";

export type JanelaDeCongelamento = {
  /** Primeiro dia congelado, "AAAA-MM-DD" (inclusivo). */
  inicio: string;
  /** Último dia congelado, "AAAA-MM-DD" (inclusivo). */
  fim: string;
  motivo?: string;
};

export const JANELAS_DE_CONGELAMENTO: JanelaDeCongelamento[] = dados.janelas;

const BRASILIA_MS = 3 * 60 * 60 * 1000;

/** Dia de Brasília de um instante, "AAAA-MM-DD". Data inválida → null. */
export function diaDeBrasilia(data: Date): string | null {
  const t = data.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t - BRASILIA_MS).toISOString().slice(0, 10);
}

/** A janela que cobre o dia da `data`, ou null. */
export function janelaEmVigor(
  data: Date,
  janelas: JanelaDeCongelamento[] = JANELAS_DE_CONGELAMENTO,
): JanelaDeCongelamento | null {
  const dia = diaDeBrasilia(data);
  if (!dia) return null;
  return janelas.find((j) => dia >= j.inicio && dia <= j.fim) ?? null;
}

/** true se a `data` cai dentro de alguma janela (bordas inclusivas, Brasília). */
export function emCongelamento(
  data: Date,
  janelas: JanelaDeCongelamento[] = JANELAS_DE_CONGELAMENTO,
): boolean {
  return janelaEmVigor(data, janelas) !== null;
}

/**
 * A janela vigente na `data` ou, se não houver, a próxima que ainda vai
 * começar. null quando todas já passaram.
 */
export function proximaJanela(
  data: Date,
  janelas: JanelaDeCongelamento[] = JANELAS_DE_CONGELAMENTO,
): JanelaDeCongelamento | null {
  const dia = diaDeBrasilia(data);
  if (!dia) return null;
  const futuras = janelas.filter((j) => j.fim >= dia).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  return futuras[0] ?? null;
}

/** "2026-12-01" → "01/12". */
function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Linha discreta para a equipe: "Atualizações pausadas até 01/12 (temporada)".
 * null fora da janela. Quem decide mostrar só para staff é quem chama.
 */
export function avisoDeAtualizacoesPausadas(
  data: Date,
  janelas: JanelaDeCongelamento[] = JANELAS_DE_CONGELAMENTO,
): string | null {
  const j = janelaEmVigor(data, janelas);
  if (!j) return null;
  return `Atualizações pausadas até ${diaMes(j.fim)} (temporada)`;
}
