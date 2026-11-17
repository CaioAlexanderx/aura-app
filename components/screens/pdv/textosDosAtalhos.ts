// ============================================================
// Textos do p-155 (17/11/2026): etiquetas de tecla, botão "Atalhos", dica
// da busca e a legenda. Todos aqui, para trocar fácil: as palavras ainda são
// proposta do Caio (mockup "Caixa e Troca", seção 2, tabela "Caixa
// (Parte 1)"). As TECLAS não moram aqui: vêm de utils/atalhosDoCaixa.
//
// Fora da legenda, de propósito: "Quantidade do último item" (Alt+↑ ↓) e
// "Dividir o pagamento" (Alt+P) estão no mockup, mas essas teclas ainda não
// existem no Caixa. Entram aqui quando entrarem em ATALHOS_DO_CAIXA.
// ============================================================
import type { AcaoDoCaixa, TeclaDeCampo } from "@/utils/atalhosDoCaixa";

export type LinhaDaLegenda = {
  texto: string;
  /** Ações do mapa: todas as teclas de cada uma, separadas por "ou". */
  acoes?: AcaoDoCaixa[];
  /** Faixa de ações (Alt+1 a Alt+5): só a primeira e a última, com "a". */
  faixa?: [AcaoDoCaixa, AcaoDoCaixa];
  /** Tecla que o campo trata sozinho. */
  campo?: TeclaDeCampo;
  /** As teclas do campo vão juntas (↑ ↓), sem "ou". */
  juntas?: boolean;
};

export type GrupoDaLegenda = { numero: string; titulo: string; linhas: LinhaDaLegenda[] };

export const TEXTOS_DOS_ATALHOS = {
  botao: "Atalhos",
  botaoA11y: "Ver os atalhos de teclado do Caixa",
  // Dica embaixo da busca, com texto digitado.
  dicaEnter: "coloca na venda",
  dicaSetas: "trocam o destaque",
  dicaEsc: "limpa a busca",
  // Canto do produto destacado.
  adiciona: "adiciona",
  // Legenda.
  titulo: "Atalhos do Caixa",
  subtitulo: "na ordem da venda",
  fechar: "Fechar os atalhos",
  ou: "ou",
  a: "a",
  rodape:
    "O Enter sozinho nunca finaliza a venda: é a tecla que o leitor de código de barras manda. Bipar um produto na tela final também começa a próxima venda.",
};

export const LEGENDA_DOS_ATALHOS: GrupoDaLegenda[] = [
  {
    numero: "1", titulo: "Achar o produto", linhas: [
      { texto: "Buscar produto", acoes: ["busca"] },
      { texto: "Colocar na venda o produto destacado", campo: "adicionarDestacado" },
      { texto: "Trocar o destaque", campo: "trocarDestaque", juntas: true },
      { texto: "Digitar um código à mão", acoes: ["codigoManual"] },
      { texto: "Limpar a busca", campo: "limparBusca" },
    ],
  },
  {
    numero: "2", titulo: "Ajustar a venda", linhas: [
      { texto: "Tirar o último item (duas vezes)", acoes: ["removerUltimo"] },
      { texto: "Desconto", acoes: ["desconto"] },
      { texto: "Cliente", acoes: ["cliente"] },
      { texto: "Vendedora", acoes: ["vendedora"] },
      { texto: "Cupom de desconto", acoes: ["cupom"] },
      { texto: "Troca ou devolução", acoes: ["troca"] },
    ],
  },
  {
    numero: "3", titulo: "Receber", linhas: [
      { texto: "Dinheiro, Pix, Débito, Crédito, Crediário", faixa: ["pagamento1", "pagamento5"] },
      { texto: "Finalizar a venda", acoes: ["finalizar"] },
      { texto: "Confirmar o troco", campo: "confirmarTroco" },
    ],
  },
  {
    numero: "4", titulo: "Depois da venda", linhas: [
      { texto: "Começar a próxima venda", acoes: ["novaVenda"] },
      { texto: "Imprimir o cupom", acoes: ["imprimir"] },
      { texto: "Abrir e fechar esta legenda", acoes: ["legenda"] },
    ],
  },
];
