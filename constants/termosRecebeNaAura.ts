// ============================================================
// ⚠️  RASCUNHO PARA REVISÃO JURÍDICA — NÃO PUBLICAR  ⚠️
//
// Termos de uso do Recebe na Aura (RA-03 / card p-97, 12/11/2026).
//
// Este arquivo é TEXTO DE TRABALHO DO PRODUTO. Não foi revisado por
// advogado, não é a versão vigente dos Termos de Uso da Aura
// (getaura.com.br/termos, versão 2) e não pode ser mostrado a lojista
// antes da revisão jurídica e da cláusula modelo oficial da Asaas.
//
// Onde vai aparecer: só no passo "Termos e selo" da ativação do Recebe na
// Aura (RA-06), que fica atrás da flag RECEBE_NA_AURA_ENABLED. O aceite é
// só de quem ativar (decisão do Caio de 09/11), não de todos os clientes.
//
// O que NÃO foi inventado:
//  - A cláusula modelo da Asaas: o playbook exige usá-la ("a Aura não cria
//    documento legal sobre pagamentos"), mas o texto oficial não está no
//    repositório nem em página pública da Asaas encontrada em 12/11/2026.
//    Fica o marcador CLAUSULA_MODELO_ASAAS_PENDENTE até o Caio passar o
//    texto do playbook.
//  - Os canais de atendimento da Asaas: só os confirmados em página
//    oficial (docs.asaas.com/docs/entre-em-contato, 12/11/2026), que são os
//    mesmos que o levantamento cita do playbook. Ouvidoria e outros canais
//    não foram encontrados: não constam.
// ============================================================

export const TERMOS_RECEBE_STATUS = "RASCUNHO_PARA_REVISAO_JURIDICA" as const;

/** Versão do rascunho. A versão de aceite real nasce depois da revisão. */
export const TERMOS_RECEBE_VERSAO = "rascunho-2026-11-12";

export const TERMOS_RECEBE_AVISO_RASCUNHO =
  "RASCUNHO PARA REVISÃO JURÍDICA. Texto de trabalho do produto, ainda sem revisão jurídica e sem a cláusula modelo oficial da Asaas. Não vale como termo aceito.";

/** Marcador exato do lugar da cláusula modelo. Trocar pelo texto oficial. */
export const CLAUSULA_MODELO_ASAAS_PENDENTE = "[cláusula modelo da Asaas — inserir texto oficial]";

/**
 * Texto oficial da cláusula modelo, quando o Caio passar o do playbook.
 * null = ainda não recebido (a tela mostra o marcador).
 */
export const CLAUSULA_MODELO_ASAAS: string | null = null;

// ── Canais de atendimento da Asaas ───────────────────────────
// Fonte: https://docs.asaas.com/docs/entre-em-contato (consultada em
// 12/11/2026). O 0800 aparece lá como WhatsApp, 24 horas, para assuntos de
// conta; o e-mail contato@asaas.com.br é o canal geral. O levantamento do
// Recebe na Aura (09/11) cita os mesmos dois como os que o playbook manda
// mostrar ao cliente final. Não incluir canal que não esteja confirmado.
export type CanalAsaas = {
  tipo: "whatsapp" | "email";
  rotulo: string;
  valor: string;
  /** Link que abre o canal. Só quando confirmado: o link do WhatsApp de um
   *  0800 não está na página oficial, então o WhatsApp vai sem link. */
  link: string | null;
  observacao?: string;
};

export const CANAIS_ASAAS: CanalAsaas[] = [
  {
    tipo: "whatsapp",
    rotulo: "WhatsApp da Asaas",
    valor: "0800 009 0037",
    link: null,
    observacao: "24 horas",
  },
  {
    tipo: "email",
    rotulo: "E-mail da Asaas",
    valor: "contato@asaas.com.br",
    link: "mailto:contato@asaas.com.br",
  },
];

export const CANAIS_ASAAS_FONTE = {
  url: "https://docs.asaas.com/docs/entre-em-contato",
  consultadoEm: "2026-11-12",
};

/** Frase fixa de responsabilidade que acompanha os canais nas telas. */
export function avisoOperacaoAsaas(): string {
  return "A operação financeira é da Asaas. Dúvidas sobre saldo, saque e tarifa: "
    + CANAIS_ASAAS.map((c) => c.valor).join(" ou ") + ".";
}

// ── Cláusulas ─────────────────────────────────────────────────
// As três do card p-97 (parecer preliminar, 09/11): (a) plataforma x
// serviço financeiro; (b) toda decisão financeira é da lojista; (c) a
// comissão da Aura é remuneração pelo uso da plataforma. O produto tem de
// bater com o texto: a Aura nunca decide nem move dinheiro por conta própria.
export type ClausulaTermos = {
  id: "plataforma" | "decisao" | "remuneracao" | "clausula_modelo_asaas" | "canais";
  titulo: string;
  texto: string;
  /** true = trecho que ainda depende de material oficial da Asaas. */
  pendente?: boolean;
};

/**
 * Monta o rascunho com o nome do produto vindo de fora (a constante única
 * RECEBE_NA_AURA_NAME; a Asaas pode recusar o nome e ele muda num lugar só).
 */
export function termosRecebeNaAura(nomeDoProduto: string): ClausulaTermos[] {
  const n = nomeDoProduto;
  const clausulaModelo = CLAUSULA_MODELO_ASAAS || CLAUSULA_MODELO_ASAAS_PENDENTE;
  return [
    {
      id: "plataforma",
      titulo: "1. Quem faz o quê",
      texto:
        `No ${n}, a Aura fornece a plataforma tecnológica: as telas, a integração e os avisos dentro do app. `
        + "O serviço de infraestrutura financeira (a conta de pagamento, o recebimento por Pix e cartão, o saldo e o saque) "
        + "é prestado pela Asaas, instituição que presta o serviço financeiro.",
    },
    {
      id: "decisao",
      titulo: "2. As decisões financeiras são suas",
      texto:
        "Toda decisão financeira é da loja: quando cobrar, quanto cobrar e para quem repassar. "
        + "A Aura não decide nem movimenta dinheiro por conta própria.",
    },
    {
      id: "remuneracao",
      titulo: "3. O que a Aura recebe",
      texto:
        `A taxa da plataforma Aura é a remuneração pelo uso da plataforma do ${n}. `
        + "Ela aparece separada da tarifa da Asaas em cada recebimento.",
    },
    {
      id: "clausula_modelo_asaas",
      titulo: "4. Termos do serviço financeiro da Asaas",
      texto: clausulaModelo,
      pendente: !CLAUSULA_MODELO_ASAAS,
    },
    {
      id: "canais",
      titulo: "5. Atendimento da Asaas",
      texto:
        "Dúvidas sobre o serviço financeiro (saldo, saque, tarifas, contestação) são atendidas pela Asaas: "
        + CANAIS_ASAAS.map((c) => `${c.rotulo}: ${c.valor}${c.observacao ? ` (${c.observacao})` : ""}`).join("; ")
        + ".",
    },
  ];
}

/** Frase do aceite (a do mockup aprovado). */
export const TERMOS_RECEBE_FRASE_ACEITE =
  "Li e aceito os termos do serviço financeiro da Asaas e os termos da Aura.";

/** Verdadeiro só quando nada do texto depende mais de material oficial. */
export function termosRecebeProntosParaRevisaoFinal(): boolean {
  return !!CLAUSULA_MODELO_ASAAS;
}
