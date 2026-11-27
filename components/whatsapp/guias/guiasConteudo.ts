// ============================================================
// guiasConteudo — os três guias do WhatsApp: texto FINAL e alvo de cada balão
//
// Fonte: artboard GuiaPassos (texto, alvo, botão de cada passo) e GuiaExecucao
// (o balão que executa: `exec`). Nada aqui desenha; o motor (GuiaTour) lê isto.
//
//   alvo      chave data-tour (utils/tourTarget). Sem `alvo` e com `centro`: balão no meio.
//   aba       aba/seção da tela a abrir ANTES de procurar o alvo.
//   pula      passo que não faz sentido agora (ex.: número já conectado): é pulado.
//   completo  o ESTADO real que dá o passo por cumprido (o motor avança quando ele
//             vira verdadeiro, nunca pelo clique).
//   exec      o balão executa a ação da tela (ver GuiaExec).
// ============================================================
import type { UseWaAutomaticas } from "@/hooks/useWaAutomaticas";
import type { SaldoInfo } from "../waSaldo";
import type { WaStatus } from "@/services/waApi";

export type AbaGuia = "conversas" | "automaticas" | "venda_mais" | "config";
/**
 * Onde a tela precisa estar antes de procurar o alvo. `sub` é a página de dentro de "Automáticas"
 * (Aniversário e Crediário abrem por "Ajustar" no cartão, não por subaba de Configurações).
 */
export interface DestinoAba { aba: AbaGuia; secao?: "conexao"; sub?: "aniversario" | "crediario" | null }

/** O que o guia precisa saber da tela (a tela do WhatsApp monta e entrega). */
export interface GuiaCtx {
  companyId: string;
  lojaNome: string;
  status: WaStatus | null;
  conectado: boolean;
  telefone: string;
  auto: UseWaAutomaticas;
  saldo: SaldoInfo | null;
  /** Aba Conversas disponível (módulo de atendimento visível). */
  hubVisible: boolean;
  /** Celular (até 768 px): o guia 1 vira um passo só. */
  celular: boolean;
  /** Produtos mandados numa conversa desde que a tela abriu (sobe, nunca desce). */
  produtosEnviados: number;
  irPara: (d: DestinoAba) => void;
}

export type ExecKind = "antes" | "aguardar" | "conectado" | "aniversario" | "cobranca" | "venda" | "pronto" | "produto";

export interface PassoGuia {
  id: string;
  alvo?: string;
  centro?: boolean;
  aba?: DestinoAba;
  titulo: string;
  corpo: string;
  /** Rótulo do botão que avança (padrão: "Próximo"; no último, "Entendi"). */
  cta?: string;
  exec?: ExecKind;
  /** Deixa o toque passar pelo buraco até o alvo (o botão real continua clicável). */
  interativo?: boolean;
  pula?: (c: GuiaCtx) => boolean;
  completo?: (c: GuiaCtx) => boolean;
  /** Procura o alvo por mais tempo (a tela acabou de trocar de aba). */
  espera?: number;
  /** O balão não pode cobrir o menu lateral (fica ao lado do alvo, encolhendo se preciso). */
  evitaMenu?: boolean;
  /** Só roda com uma conversa aberta: sem o alvo, o guia fica pendente (artboard GuiaExecucao) em vez de pular. */
  exigeConversa?: boolean;
}

export interface Guia {
  n: 1 | 2 | 3;
  meta: string;
  titulo: string;
  passos: PassoGuia[];
}

const cobrancaLigada = (c: GuiaCtx) => c.auto.info?.autos.crediario_cobrar?.ligada === true;
const aniversarioLigado = (c: GuiaCtx) => c.auto.info?.autos.aniversario?.ligada === true;

export function guia1(celular: boolean): Guia {
  if (celular) {
    return {
      n: 1, meta: "Guia 1 · conectar", titulo: "Conectar o número da loja",
      passos: [{
        id: "g1-celular", alvo: "wa.conexao", aba: { aba: "config", secao: "conexao" }, espera: 4000,
        titulo: "Conecte pelo computador",
        corpo: "Conecte pelo computador, a janela do Facebook não abre no celular.",
        cta: "Entendi",
      }],
    };
  }
  // GuiaExecucao, guia 1: UM balão com as duas conferências e o botão verde, depois "esperando", depois "ligado".
  return {
    n: 1, meta: "Guia 1 · conectar", titulo: "Conectar o número da loja",
    passos: [
      {
        id: "g1-antes", alvo: "wa.conexao", aba: { aba: "config", secao: "conexao" }, espera: 4000, exec: "antes",
        titulo: "Antes de começar",
        corpo: "Tenha à mão o celular com o WhatsApp da loja e o acesso ao Facebook da loja. O número continua funcionando no celular, como hoje.",
        pula: (c) => c.conectado,
      },
      {
        id: "g1-aguardando", alvo: "wa.conectar", exec: "aguardar", interativo: true,
        titulo: "Siga o que aparece no celular",
        corpo: "Na janela, escolha o WhatsApp Business que a loja já usa. O celular pede uma confirmação: faça por lá e volte para esta tela.",
        pula: (c) => c.conectado,
        completo: (c) => c.conectado,
      },
      {
        id: "g1-saldos", alvo: "wa.saldos", exec: "conectado", espera: 6000, aba: { aba: "config", secao: "conexao" },
        titulo: "Número conectado",
        corpo: "Aqui ficam os saldos do mês: avisos, novidades e conversas da Aurinha. Responder clientes numa conversa aberta não gasta nada.",
        cta: "Ligar as automáticas",
      },
    ],
  };
}

export function guia2(): Guia {
  return {
    n: 2, meta: "Guia 2 · automáticas", titulo: "Ligar as mensagens automáticas",
    passos: [
      {
        id: "g2-saldos", alvo: "wa.saldos", aba: { aba: "automaticas", sub: null }, espera: 4000,
        titulo: "Três saldos, cada um no seu limite",
        corpo: "Avisos cobram e lembram. Novidades vendem. Conversas da Aurinha respondem sozinhas. Quando um acaba, só ele para.",
      },
      {
        id: "g2-divisao", alvo: "wa.divisao",
        titulo: "As 10 novidades já vêm divididas",
        corpo: "Aniversário 4, Venda+ 4 e Crediário 2. Use + e − para mudar; a soma nunca passa de 10.",
      },
      {
        id: "g2-aniversario", alvo: "wa.auto.aniversario", exec: "aniversario", interativo: true,
        titulo: "Um toque liga",
        corpo: "Mensagem, presente e dia já vêm prontos. Na primeira vez a Aura pergunta se seus clientes aceitaram receber novidades.",
        completo: aniversarioLigado,
      },
      {
        id: "g2-cobranca", alvo: "wa.crediario.linha", aba: { aba: "automaticas", sub: "crediario" }, espera: 5000, exec: "cobranca", interativo: true,
        titulo: "Escolha quando cobrar",
        corpo: "Toque nos pontos da linha: antes do vencimento, no dia ou depois. Quem já pagou sai da lista sozinho.",
        completo: cobrancaLigada,
      },
      {
        id: "g2-venda", alvo: "wa.auto.venda_mais", aba: { aba: "automaticas", sub: null }, espera: 4000, exec: "venda", interativo: true,
        titulo: "Venda+ todo dia 1º",
        corpo: "A Aura chama de volta quem parou de comprar, começando por quem mais comprava.",
        completo: (c) => c.auto.info?.autos.venda_mais?.ligada === true,
      },
      {
        id: "g2-editar", alvo: "wa.editar", aba: { aba: "automaticas", sub: "crediario" }, espera: 5000,
        titulo: "Quer escrever do seu jeito?",
        corpo: "Em Editar você muda o texto. A Aura confere as regras do WhatsApp e corrige com um toque.",
      },
      {
        id: "g2-pronto", alvo: "wa.auto.cartoes", aba: { aba: "automaticas", sub: null }, espera: 4000, exec: "pronto",
        titulo: "Pronto",
        corpo: "",
        cta: "Ver como usar a conversa",
      },
    ],
  };
}

export function guia3(): Guia {
  return {
    n: 3, meta: "Guia 3 · conversa", titulo: "Como usar a conversa",
    passos: [
      {
        id: "g3-lista", alvo: "wa.lista", aba: { aba: "conversas" }, espera: 4000,
        titulo: "Suas conversas",
        corpo: "Busque por nome, telefone ou produto. As etiquetas separam quem pediu orçamento, quem está pagando e quem compra no crediário.",
      },
      {
        id: "g3-janela", alvo: "wa.janela", exigeConversa: true,
        titulo: "Conversa aberta não gasta",
        corpo: "Depois que a cliente escreve, você tem um dia para responder à vontade sem usar saldo. O relógio mostra até quando.",
      },
      {
        id: "g3-acoes", alvo: "wa.acoes", exec: "produto", interativo: true, evitaMenu: true,
        titulo: "Mande sem sair da conversa",
        corpo: "Produto, orçamento, Pix, link da loja, foto e etiqueta: um toque abre, outro manda.",
      },
      {
        id: "g3-microfone", alvo: "wa.microfone",
        titulo: "Áudio também vai",
        corpo: "Toque no microfone para gravar e de novo para mandar.",
      },
      {
        id: "g3-cadastro", alvo: "wa.ligar_cadastro",
        titulo: "Quem é essa cliente?",
        corpo: "Se o telefone já está no cadastro, a Aura pergunta. \"É ela\" junta a conversa com as compras, o crediário e o aniversário.",
      },
      {
        id: "g3-convite", alvo: "wa.convite",
        titulo: "Conversa fechou?",
        corpo: "Um dia sem resposta da cliente fecha a conversa. Para chamar de novo, a Aura usa um convite pronto, que gasta 1 aviso. O saldo aparece antes de mandar.",
        cta: "Entendi",
      },
    ],
  };
}

export function guiaDe(n: 1 | 2 | 3, celular: boolean): Guia {
  return n === 1 ? guia1(celular) : n === 2 ? guia2() : guia3();
}

/** O que o menu mostra de cada guia (texto do artboard GuiaCentral). */
export const MENU_GUIAS: { n: 1 | 2 | 3; titulo: string; sub: (celular: boolean) => string }[] = [
  { n: 1, titulo: "Conectar o número da loja", sub: (cel) => cel ? "No computador · uns 3 minutos · precisa do celular da loja" : "3 passos · uns 3 minutos · precisa do celular da loja" },
  { n: 2, titulo: "Ligar as mensagens automáticas", sub: () => "7 passos · 1 minuto · aniversário, crediário e Venda+" },
  { n: 3, titulo: "Como usar a conversa", sub: () => "6 passos · 1 minuto" },
];
