// ============================================================
// AURA. — Cadastrar vendedora pelo Caixa (03/11/2026)
//
// Antes, vendedora só se cadastrava em Folha/Equipe. No Caixa, digitar um
// nome novo valia SÓ naquela venda (texto solto em seller_name): não entrava
// no ranking nem na comissão. Agora o seletor F2 oferece "Cadastrar como
// vendedora" (docs/mockups/estoque-entrada-por-fornecedor.html, telas 10-11).
//
// QUEM PODE: dono, admin e quem já cuida da equipe (folha ou configurações).
// Operador(a) de caixa sem essas chaves só usa o nome "só nesta venda":
// vendedora cadastrada entra em comissão e ranking, e liberar isso a
// qualquer operador abriria espaço para vendedora fantasma.
//
// O backend já aceita cadastro só com nome em todos os planos (PLAN-02,
// POST /employees) e devolve 403 { limit, current } no limite do plano.
//
// Puro (sem React/RN/store): o jest carrega direto.
// ============================================================

export function podeCadastrarVendedora(permData: any): boolean {
  if (!permData || permData.is_owner) return true;
  if (permData.role === "owner" || permData.role === "admin") return true;
  const p = permData.permissions;
  if (!p) return true;
  return p.folha === true || p.configuracoes === true;
}

export function nomeDaVendedora(nome: string): string {
  return String(nome || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// Já existe alguém com esse nome (sem acento/caixa)? Evita cadastrar a
// mesma Ana duas vezes por pressa no balcão.
export function vendedoraJaExiste(nome: string, equipe: { id: string; name: string }[]): { id: string; name: string } | null {
  const chave = semAcento(nomeDaVendedora(nome));
  if (!chave) return null;
  return equipe.find((e) => semAcento(nomeDaVendedora(e.name)) === chave) || null;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type LimiteDaEquipe = { limite: number; atual: number };

// 403 do POST /employees com { limit, current }: limite do plano. Outros
// 403 (sem permissão) não são limite.
export function limiteDaEquipe(status: number | undefined, data: any): LimiteDaEquipe | null {
  if (status !== 403 || !data) return null;
  const limite = Number(data.limit);
  if (!Number.isFinite(limite) || limite <= 0) return null;
  const atual = Number(data.current);
  return { limite, atual: Number.isFinite(atual) ? atual : limite };
}

export function textoDoLimite(l: LimiteDaEquipe): string {
  const plural = l.limite === 1 ? "pessoa ativa" : "pessoas ativas";
  return `Seu plano tem até ${l.limite} ${plural} na equipe (você tem ${l.atual}).`;
}
