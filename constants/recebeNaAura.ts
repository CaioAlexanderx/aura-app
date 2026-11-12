// ============================================================
// Recebe na Aura — constantes do app (RA-02, 12/11/2026)
//
// Modelo A: a Asaas presta o serviço financeiro e a Aura integra. Tudo o
// que o lojista vê sobre o produto fica atrás da flag do backend
// RECEBE_NA_AURA_ENABLED (desligada; GET /companies/:id/recebe/status
// responde 404 RECEBE_INDISPONIVEL). Nada daqui aparece sozinho em tela.
//
// NOME EM UM LUGAR SÓ: a Asaas pode recusar "Recebe na Aura" (o playbook
// veta Pay, Bank, Banco, Payments, Financeira, Wallet). Trocar aqui e no
// backend (companyBaasService.RECEBE_NA_AURA_NAME).
// ============================================================

export const RECEBE_NA_AURA_NAME = "Recebe na Aura";

// ── Selo da Asaas ────────────────────────────────────────────
// O playbook da Asaas (enviado só ao parceiro, não está no repositório)
// exige o selo visível na criação da subconta e nos termos e contratos,
// em TRÊS versões, servido pelos links que a própria Asaas fornece. A
// Asaas confere de onde vem a imagem pelo cabeçalho Referer, por isso a
// imagem não pode ir com Referrer-Policy no-referrer.
//
// Os três links oficiais AINDA NÃO ESTÃO AQUI. Não há arquivo do selo no
// repositório, e a documentação pública da Asaas (docs.asaas.com, consultada
// em 12/11/2026) só diz que é obrigatório "evidenciar a marca, os links e
// os textos de responsabilidade do Asaas" em cada ponto de contato, e que
// o material vem no Playbook de adequação. Não inventar logo nem URL:
// quando o Caio passar os três links do playbook, preencher `src` (e `href`,
// se o playbook pedir que o selo leve a algum endereço) e o texto
// alternativo oficial. Enquanto `src` for null, o componente SeloAsaas
// mostra um espaço reservado com o texto de responsabilidade.

export type SeloAsaasVersao = "v1" | "v2" | "v3";

export type SeloAsaasConfig = {
  /** URL oficial da imagem, como a Asaas fornecer. null = ainda não recebida. */
  src: string | null;
  /** Para onde o selo leva ao ser tocado, se o playbook pedir. */
  href: string | null;
  /** Texto alternativo da imagem. */
  alt: string;
  /** Tamanho de exibição, em px (ajustar ao arquivo oficial). */
  width: number;
  height: number;
  /** Onde esta versão deve ser usada, segundo o playbook (a confirmar). */
  uso: string;
};

export const SELO_ASAAS: Record<SeloAsaasVersao, SeloAsaasConfig> = {
  // [inserir link oficial da versão 1 do playbook da Asaas]
  v1: { src: null, href: null, alt: "Selo Asaas", width: 120, height: 40, uso: "a confirmar no playbook" },
  // [inserir link oficial da versão 2 do playbook da Asaas]
  v2: { src: null, href: null, alt: "Selo Asaas", width: 120, height: 40, uso: "a confirmar no playbook" },
  // [inserir link oficial da versão 3 do playbook da Asaas]
  v3: { src: null, href: null, alt: "Selo Asaas", width: 120, height: 40, uso: "a confirmar no playbook" },
};

/** Texto de responsabilidade que acompanha o selo (o do mockup aprovado). */
export const SELO_ASAAS_TEXTO = "Serviço financeiro prestado pela Asaas";

/**
 * Política de Referer da imagem e do link do selo. A Asaas confere a origem
 * pelo Referer: com strict-origin-when-cross-origin ela recebe só a origem
 * (https://app.getaura.com.br), nunca o caminho nem a query (que podem ter
 * token), e nada vai em http. É a mesma política dos cabeçalhos do app
 * (public/_headers), do backend (helmet) e do site. NUNCA "no-referrer".
 */
export const SELO_ASAAS_REFERRER_POLICY = "strict-origin-when-cross-origin" as const;

/** Verdadeiro quando as três versões oficiais já foram preenchidas. */
export function seloAsaasOficialCompleto(): boolean {
  return (Object.keys(SELO_ASAAS) as SeloAsaasVersao[]).every((v) => !!SELO_ASAAS[v].src);
}
