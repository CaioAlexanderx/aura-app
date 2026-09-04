// ============================================================
// components/studio/storefront/conteudoDoRodape.ts
//
// O que o rodapé da vitrine mostra — as regras, fora da tela.
//
// A loja comum ganhou em 09/2026 um rodapé de três colunas: quem é a
// loja, como ela atende, por onde navegar. A vitrine Studio terminava a
// página no último produto — sem endereço, sem horário, sem CNPJ, sem
// as redes (que chegam no payload desde a S0 e nunca foram desenhadas).
//
// A MESMA regra do resto da vitrine: bloco nasce da config ou não
// existe. Loja sem endereço não mostra uma coluna vazia com um título
// solto; loja sem categoria não mostra "Navegue" em branco.
//
// Aqui se decide O QUE aparece. COMO desenhar é do RodapeDaVitrine.tsx.
// O texto institucional (formas de pagamento e política de troca) não
// se decide aqui nem lá: vem pronto do backend, de um módulo só para as
// duas lojas.
// ============================================================
import type { RedeSocial, StoreCategory, StudioStoreProduct } from "./types";

/** Quantas portas de navegação cabem no rodapé sem virar índice. */
export const MAXIMO_NA_NAVEGACAO = 6;

export type IdentidadeDaLoja = {
  nome: string;
  logoUrl: string | null;
  endereco: string;
  horario: string;
  redes: RedeSocial[];
};

/**
 * Uma porta do rodapé.
 *
 * Carrega o `slug` porque é por ele que a vitrine troca de categoria
 * (a tira da home usa o mesmo caminho): mandar o id daria uma porta que
 * não abre.
 */
export type PortaDoRodape = { id: string; slug: string; nome: string };

export type ConteudoDoRodape = {
  identidade: IdentidadeDaLoja;
  /** Vazio quando a loja não tem categoria com peça à venda. */
  navegacao: PortaDoRodape[];
  /** A linha de baixo, já escrita. */
  linhaLegal: string;
  /** Alguma das três colunas tem conteúdo? */
  temAlgo: boolean;
};

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * As categorias que viram porta no rodapé.
 *
 * Só as de primeiro nível, e só as que têm peça à venda: categoria vazia
 * no rodapé é um caminho que termina em "nenhum produto encontrado" —
 * pior do que não oferecer o caminho.
 */
export function navegacaoDoRodape(
  categorias: StoreCategory[] | undefined,
  produtos: StudioStoreProduct[] | undefined
): PortaDoRodape[] {
  const lista = Array.isArray(categorias) ? categorias : [];
  const itens = Array.isArray(produtos) ? produtos : [];
  if (!lista.length || !itens.length) return [];

  // Um produto conta para a categoria dele e para todas as ancestrais:
  // quem clica em "Canecas" espera achar a caneca que está em
  // "Canecas > Cerâmica".
  const paiDe = new Map<string, string | null>();
  lista.forEach((c) => paiDe.set(String(c.id), c.parent_id ? String(c.parent_id) : null));

  const comPeca = new Set<string>();
  for (const p of itens) {
    let id = p?.category_id != null ? String(p.category_id) : null;
    const visitados = new Set<string>();
    while (id && !visitados.has(id)) {
      visitados.add(id);
      comPeca.add(id);
      id = paiDe.get(id) ?? null;
    }
  }

  return lista
    .filter((c) => !c.parent_id && comPeca.has(String(c.id)))
    .slice(0, MAXIMO_NA_NAVEGACAO)
    .map((c) => ({ id: String(c.id), slug: String(c.slug || ""), nome: c.name }));
}

/**
 * A linha de baixo: © ano, nome da loja e o CNPJ quando existe.
 *
 * O CNPJ chega formatado do backend — formatar de novo aqui daria duas
 * máscaras para o mesmo número.
 */
export function linhaLegal(nome: string, cnpjFormatado: string, ano: number): string {
  const n = texto(nome) || "Loja";
  const c = texto(cnpjFormatado);
  return c ? `© ${ano} ${n} · CNPJ ${c}` : `© ${ano} ${n}`;
}

/**
 * Monta o rodapé inteiro a partir do payload.
 *
 * `agora` é parâmetro para o ano do copyright não depender do relógio da
 * máquina em teste.
 */
export function montarConteudoDoRodape(
  store: any,
  agora: Date = new Date()
): ConteudoDoRodape {
  const site = store?.site || {};
  const redes = Array.isArray(site.redes)
    ? site.redes.filter((r: any) => r && texto(r.url))
    : [];

  const identidade: IdentidadeDaLoja = {
    nome: texto(site.name) || "Loja",
    logoUrl: texto(site.logo_url) || null,
    endereco: texto(site.endereco),
    horario: texto(site.horario_resumo),
    redes,
  };

  const navegacao = navegacaoDoRodape(store?.categories, store?.products);

  const inst = store?.rodape_institucional || null;
  const temInstitucional = Boolean(
    (Array.isArray(inst?.formas) && inst.formas.length) || texto(inst?.politica)
  );

  return {
    identidade,
    navegacao,
    linhaLegal: linhaLegal(identidade.nome, texto(site.cnpj_formatado), agora.getFullYear()),
    // O nome da loja sozinho já é conteúdo: a assinatura embaixo precisa
    // de alguém para assinar. O rodapé só some se não houver payload.
    temAlgo: Boolean(
      texto(site.name) || identidade.endereco || identidade.horario ||
      redes.length || navegacao.length || temInstitucional
    ),
  };
}
