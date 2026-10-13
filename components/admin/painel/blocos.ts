// Apresentação de cada bloco: o que a API não manda (título, seção, largura
// na grade de 12 colunas, tipo de gráfico). A ordem aqui é a ordem na tela.
import type { OpcoesGrafico } from "./Graficos";
import type { BlocoId, TipoGrafico } from "./tipos";

export type SecaoId = "negocio" | "produto" | "operacao";

export type DefinicaoBloco = {
  id: BlocoId;
  titulo: string;
  subtitulo: string;
  secao: SecaoId;
  colunas: 4 | 6 | 12;
  grafico: TipoGrafico;
  opcoes?: OpcoesGrafico;
  legenda?: [string, string];   // linha de 2 séries
};

export var SECOES: { id: SecaoId; titulo: string; nota: string }[] = [
  { id: "negocio", titulo: "Negócio", nota: "" },
  { id: "produto", titulo: "Produto e uso", nota: "Quem entra, o que usa, quando usa" },
  { id: "operacao", titulo: "Operação", nota: "Fiscal, crediário, contatos, frentes" },
];

export var DEFINICOES: DefinicaoBloco[] = [
  // Negócio
  { id: "trials_degrau", titulo: "Trials por degrau", subtitulo: "Cadastros dos últimos 30 dias, sem os dojôs", secao: "negocio", colunas: 6, grafico: "funil" },
  { id: "receita", titulo: "Receita", subtitulo: "MRR real pela Asaas, anual dividido por 12", secao: "negocio", colunas: 6, grafico: "linha" },
  { id: "cadastros", titulo: "Cadastros", subtitulo: "Por semana, últimas 7", secao: "negocio", colunas: 4, grafico: "barras", opcoes: { valores: "max", ultimoClaro: true } },
  { id: "pagantes", titulo: "Pagantes", subtitulo: "Plano e ciclo", secao: "negocio", colunas: 4, grafico: "rosca" },
  { id: "pagantes_sem_venda", titulo: "Pagantes sem venda", subtitulo: "Dias desde a última venda", secao: "negocio", colunas: 4, grafico: "barras_h", opcoes: { max: 90 } },
  { id: "tempo_primeira_venda", titulo: "Tempo até a 1ª venda", subtitulo: "Do cadastro à primeira venda", secao: "negocio", colunas: 4, grafico: "barras" },
  { id: "custos", titulo: "Custos", subtitulo: "Lançamento mensal", secao: "negocio", colunas: 4, grafico: "barras" },
  // Produto e uso
  { id: "acesso", titulo: "Acesso", subtitulo: "Lojas com login na semana · pagantes em destaque", secao: "produto", colunas: 6, grafico: "linha", opcoes: { max: 30 }, legenda: ["Todas as lojas", "Pagantes"] },
  { id: "uso_funcionalidade", titulo: "Uso por funcionalidade", subtitulo: "Lojas que usaram cada módulo em 30 dias", secao: "produto", colunas: 6, grafico: "barras_h", opcoes: { max: 40 } },
  { id: "horario", titulo: "Horário de uso", subtitulo: "Vendas por hora · 30 dias", secao: "produto", colunas: 4, grafico: "barras", opcoes: { valores: "max" } },
  { id: "plataforma", titulo: "Plataforma", subtitulo: "Vendas por dia · 14 dias", secao: "produto", colunas: 4, grafico: "barras", opcoes: { valores: "max" } },
  { id: "adocao", titulo: "Adoção por recurso", subtitulo: "Pagantes que usam · de 18", secao: "produto", colunas: 4, grafico: "barras_h", opcoes: { max: 18 } },
  { id: "telas_visitadas", titulo: "Telas visitadas", subtitulo: "Navegação no app por tela", secao: "produto", colunas: 4, grafico: "barras_h" },
  { id: "etiquetas", titulo: "Etiquetas impressas", subtitulo: "Por loja e modelo", secao: "produto", colunas: 4, grafico: "barras_h" },
  { id: "aurinha", titulo: "Aurinha", subtitulo: "Conversas e resolução", secao: "produto", colunas: 4, grafico: "barras" },
  { id: "nps", titulo: "NPS", subtitulo: "Pesquisa no produto", secao: "produto", colunas: 4, grafico: "barras" },
  // Operação
  { id: "fiscal", titulo: "Fiscal", subtitulo: "NFC-e · 7 dias", secao: "operacao", colunas: 4, grafico: "barras", opcoes: { altura: 80 } },
  { id: "crediario", titulo: "Crediário", subtitulo: "Parcelas vencidas por loja", secao: "operacao", colunas: 4, grafico: "barras_h" },
  { id: "contatos", titulo: "Contatos", subtitulo: "Site hoje · WhatsApp quando a API entrar", secao: "operacao", colunas: 4, grafico: "barras", opcoes: { altura: 80, valores: "max" } },
  { id: "frentes", titulo: "Frentes", subtitulo: "Pagantes e trials por frente", secao: "operacao", colunas: 4, grafico: "barras_h", opcoes: { max: 9 } },
];
