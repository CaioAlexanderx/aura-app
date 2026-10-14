// Apresentação de cada bloco: o que a API não manda (título, seção, largura
// na grade de 12 colunas, tipo de gráfico). A ordem aqui é a ordem na tela.
import type { OpcoesGrafico } from "./Graficos";
import type { BlocoId, ItemCatalogo, TipoGrafico } from "./tipos";

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
  { id: "checkin", titulo: "Check-in", subtitulo: "Cadastros novos: produto em 24 h, venda em 7 dias, regra de parada", secao: "negocio", colunas: 4, grafico: "barras" },
  { id: "tempo_primeira_venda", titulo: "Tempo até a 1ª venda", subtitulo: "Do cadastro à primeira venda", secao: "negocio", colunas: 4, grafico: "barras" },
  { id: "custos", titulo: "Custos", subtitulo: "Lançamento mensal", secao: "negocio", colunas: 4, grafico: "barras" },
  // Produto e uso
  { id: "acesso", titulo: "Acesso", subtitulo: "Lojas com login na semana · pagantes em destaque", secao: "produto", colunas: 6, grafico: "linha", legenda: ["Todas as lojas", "Pagantes"] },
  { id: "uso_funcionalidade", titulo: "Uso por funcionalidade", subtitulo: "Lojas que usaram cada módulo em 30 dias", secao: "produto", colunas: 6, grafico: "barras_h" },
  { id: "horario", titulo: "Horário de uso", subtitulo: "Vendas por hora · 30 dias", secao: "produto", colunas: 4, grafico: "barras", opcoes: { valores: "max" } },
  { id: "plataforma", titulo: "Plataforma", subtitulo: "Vendas por dia · 14 dias", secao: "produto", colunas: 4, grafico: "barras", opcoes: { valores: "max" } },
  { id: "adocao", titulo: "Adoção por recurso", subtitulo: "Pagantes que usam cada recurso", secao: "produto", colunas: 4, grafico: "barras_h" },
  { id: "telas_visitadas", titulo: "Telas visitadas", subtitulo: "Navegação no app por tela", secao: "produto", colunas: 4, grafico: "barras_h" },
  { id: "etiquetas", titulo: "Etiquetas impressas", subtitulo: "Por loja e modelo", secao: "produto", colunas: 4, grafico: "barras_h" },
  { id: "aurinha", titulo: "Aurinha", subtitulo: "Conversas e resolução", secao: "produto", colunas: 4, grafico: "barras" },
  { id: "nps", titulo: "NPS", subtitulo: "Pesquisa no produto", secao: "produto", colunas: 4, grafico: "barras" },
  // Operação
  { id: "fiscal", titulo: "Fiscal", subtitulo: "NFC-e · 7 dias", secao: "operacao", colunas: 4, grafico: "barras", opcoes: { altura: 80 } },
  { id: "crediario", titulo: "Crediário", subtitulo: "Parcelas vencidas por loja", secao: "operacao", colunas: 4, grafico: "barras_h" },
  { id: "contatos", titulo: "Contatos", subtitulo: "Site hoje · WhatsApp quando a API entrar", secao: "operacao", colunas: 4, grafico: "barras", opcoes: { altura: 80, valores: "max" } },
  { id: "frentes", titulo: "Frentes", subtitulo: "Contas por frente", secao: "operacao", colunas: 4, grafico: "barras_h" },
];

// Catálogo: o que dá para ligar. Em produção a lista de blocos que o backend
// conhece vem de GET /layout (adaptadores.montarCatalogo); o que está aqui e
// o backend não calcula aparece como "em construção".
export var CATALOGO: ItemCatalogo[] = [
  { id: "trials_degrau", titulo: "Trials por degrau", fonte: "clients-360" },
  { id: "receita", titulo: "Receita", fonte: "Asaas + OFX" },
  { id: "cadastros", titulo: "Cadastros", fonte: "companies por semana" },
  { id: "pagantes", titulo: "Pagantes", fonte: "plano e ciclo" },
  { id: "pagantes_sem_venda", titulo: "Pagantes sem venda", fonte: "sales por loja" },
  { id: "checkin", titulo: "Check-in", fonte: "companies, products e sales dos cadastros novos" },
  { id: "acesso", titulo: "Acesso", fonte: "audit_log login" },
  { id: "uso_funcionalidade", titulo: "Uso por funcionalidade", fonte: "tabelas por módulo" },
  { id: "horario", titulo: "Horário de uso", fonte: "sales por hora" },
  { id: "plataforma", titulo: "Plataforma", fonte: "sales por dia + canary" },
  { id: "adocao", titulo: "Adoção por recurso", fonte: "pagantes por módulo" },
  { id: "fiscal", titulo: "Fiscal", fonte: "NFC-e emitidas e rejeitadas" },
  { id: "crediario", titulo: "Crediário", fonte: "parcelas vencidas" },
  { id: "contatos", titulo: "Contatos", fonte: "formulário do site" },
  { id: "frentes", titulo: "Frentes", fonte: "companies por frente" },
  { id: "telas_visitadas", titulo: "Telas visitadas", fonte: "navegação enviada pelo app" },
  { id: "etiquetas", titulo: "Etiquetas impressas", fonte: "precisa de contador", aviso: true },
  { id: "tempo_primeira_venda", titulo: "Tempo até a 1ª venda", fonte: "sales, companies" },
  { id: "aurinha", titulo: "Aurinha", fonte: "depois do piloto" },
  { id: "custos", titulo: "Custos", fonte: "lançamento mensal" },
  { id: "nps", titulo: "NPS", fonte: "sem pesquisa no produto", aviso: true, em_construcao: true },
];
