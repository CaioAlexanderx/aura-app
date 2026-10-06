import type { Segmento } from "@/services/primeirosPassosApi";
import { tourSelector } from "@/utils/tourTarget";

// ============================================================
// Primeiros passos por frente — textos e destinos (05/10/2026)
//
// Textos aprovados no mockup docs/mockups/onboarding-por-frente.html
// (coluna 3). As CHAVES vêm do backend (routes/onboardingFirstSteps.js) e
// são estáveis; chave que o app não conhece é ignorada (não quebra).
//
// Cada passo diz:
//   path     — tela alvo (o tour só aparece quando o app chega nela)
//   mod      — chave de módulo da tela alvo (useVisibleModules). Passo cuja
//              tela o plano não libera SOME do cartão (premissa do
//              Essencial: nada de isca nem "faça upgrade"). Sem mod = shell
//              próprio (Studio), que tem gate no _layout.
//   targets  — seletores do alvo, em ordem de preferência (o primeiro
//              visível ganha; o título da tela é o último recurso)
//   tip      — texto do tooltip ancorado no alvo
// ============================================================

export type PassoConfig = {
  title: string;
  desc: string;
  path: string;
  mod?: string;
  targets: string[];
  tip: { title: string; body: string };
};

export type FrenteConfig = {
  /** "Sua Aura já abre como <nome>." — null = "Sua Aura já está pronta." */
  nome: string | null;
  /** Linha "Pronto:" — null = sem linha. */
  pronto: string | null;
  /** Módulos citados na linha "Pronto:"; se algum não estiver visível, a linha some. */
  prontoMods: string[];
  passos: Record<string, PassoConfig>;
};

const t = tourSelector;

const VAREJO_PASSOS: Record<string, PassoConfig> = {
  produtos_cadastrados: {
    title: "Cadastre seus produtos",
    desc: "Um por um ou por planilha.",
    path: "/estoque",
    mod: "estoque",
    targets: [t("estoque.novo_produto")],
    tip: { title: "Seu primeiro produto", body: "Toque em + Produto. Se já tem tudo numa planilha, use o Importar ao lado." },
  },
  primeira_venda: {
    title: "Faça a primeira venda",
    desc: "No Caixa, com PIX, cartão ou crediário.",
    path: "/pdv",
    mod: "pdv",
    targets: [t("pdv.busca")],
    tip: { title: "Sua primeira venda", body: "Busque o produto pelo nome ou pelo código de barras e toque nele pra pôr no carrinho." },
  },
  cliente_cadastrado: {
    title: "Cadastre um cliente",
    desc: "Pra vender fiado e cobrar no WhatsApp.",
    path: "/clientes",
    mod: "clientes",
    targets: [t("clientes.novo")],
    tip: { title: "Seu primeiro cliente", body: "Toque aqui e preencha nome e WhatsApp. O resto pode ficar pra depois." },
  },
};

export const FRENTES: Record<Segmento, FrenteConfig> = {
  otica: {
    nome: "ótica",
    pronto: "Laboratório e Receitas já estão no seu menu.",
    prontoMods: ["otica.laboratorio", "otica.receitas"],
    passos: {
      laboratorio_cadastrado: {
        title: "Cadastre um laboratório parceiro",
        desc: "Nome e prazo de entrega. Leva um minuto.",
        path: "/otica/config",
        mod: "otica.config",
        targets: [t("otica.lab_novo")],
        tip: { title: "Seu laboratório", body: "Toque aqui, coloque o nome e em quantos dias ele entrega. O prazo vira a previsão da OS." },
      },
      primeira_receita: {
        title: "Lance a primeira receita",
        desc: "Na ficha do cliente, com validade.",
        path: "/otica/receitas",
        mod: "otica.receitas",
        targets: [t("otica.nova_receita")],
        tip: { title: "Sua primeira receita", body: "Toque em Nova receita, escolha o cliente e preencha o grau. A validade sai sozinha." },
      },
      primeiro_pedido_de_lente: {
        title: "Abra um pedido de lente",
        desc: "Do balcão ao laboratório, com aviso de pronto.",
        path: "/otica/nova",
        mod: "otica.laboratorio",
        targets: [t("otica.nova_os_titulo")],
        tip: { title: "Seu primeiro pedido de lente", body: "Preencha de cima pra baixo: cliente, receita, armação e lente. Quando o óculos ficar pronto, o cliente recebe o aviso." },
      },
    },
  },
  matcon: {
    nome: "loja de material de construção",
    pronto: "Orçamentos, Entregas e Profissionais Parceiros já estão no seu menu.",
    prontoMods: ["matcon.orcamentos", "matcon.entregas", "matcon.profissionais"],
    passos: {
      produtos_cadastrados: {
        title: "Importe seus produtos",
        desc: "Planilha ou XML do fornecedor, com unidade (m², kg, saco).",
        path: "/estoque",
        mod: "estoque",
        targets: [t("estoque.importar"), t("estoque.novo_produto")],
        tip: { title: "Seus produtos", body: "Toque em Importar e escolha a planilha ou o XML da nota do fornecedor. Você confere tudo antes de gravar." },
      },
      primeiro_orcamento: {
        title: "Faça o primeiro orçamento",
        desc: "Vira venda com um toque.",
        path: "/matcon/orcamentos",
        mod: "matcon.orcamentos",
        targets: [t("matcon.novo_orcamento")],
        tip: { title: "Seu primeiro orçamento", body: "Toque em Novo orçamento: você monta no Caixa e guarda como orçamento. Quando o cliente aprovar, vira venda." },
      },
      entrega_configurada: {
        title: "Defina como você entrega",
        desc: "Taxa, prazo e retirada no balcão.",
        path: "/matcon/config",
        mod: "matcon.config",
        targets: [t("matcon.entrega")],
        tip: { title: "Sua entrega", body: "Diga em quantos dias você entrega. Esse prazo aparece no orçamento e na venda." },
      },
    },
  },
  assistencia: {
    nome: "assistência técnica",
    pronto: "Ordem de Serviço já está no seu menu, em Vendas.",
    prontoMods: ["os"],
    passos: {
      primeira_os: {
        title: "Abra a primeira ordem de serviço",
        desc: "Aparelho, defeito e prazo.",
        path: "/os/nova",
        mod: "os",
        targets: [t("os.nova_titulo")],
        tip: { title: "Sua primeira OS", body: "Preencha cliente, aparelho e defeito. O orçamento pode ficar pra depois, na bancada." },
      },
      termo_de_garantia_preenchido: {
        title: "Escreva seu termo de garantia",
        desc: "Sai impresso junto com a OS.",
        path: "/configuracoes",
        mod: "configuracoes",
        targets: [t("config.termo_garantia")],
        tip: { title: "Seu termo de garantia", body: "Toque aqui e escreva as regras da sua garantia. Elas saem impressas junto com a OS." },
      },
      pecas_ou_servicos_cadastrados: {
        title: "Cadastre peças e serviços",
        desc: "Pra somar na OS e dar baixa no estoque.",
        path: "/estoque",
        mod: "estoque",
        targets: [t("estoque.novo_produto")],
        tip: { title: "Peças e serviços", body: "Toque em + Produto pra cadastrar uma peça ou um serviço. Na OS, eles somam no total e saem do estoque." },
      },
    },
  },
  studio: {
    nome: "ateliê de personalizados",
    pronto: "Você já está no Aura Studio: Catálogo, Produção e Orçamentos.",
    prontoMods: [],
    passos: {
      catalogo_montado: {
        title: "Monte seu catálogo",
        desc: "Camiseta, caneca e o que mais você personaliza.",
        path: "/studio/estoque",
        targets: [t("studio.catalogo_novo"), t("studio.fab"), t("studio.titulo")],
        tip: { title: "Seu catálogo", body: "Toque aqui pra cadastrar a primeira peça que você personaliza." },
      },
      primeiro_orcamento: {
        title: "Faça um orçamento com arte",
        desc: "O cliente vê a peça em 3D no WhatsApp.",
        path: "/studio/gestao/orcamentos",
        targets: [t("studio.novo_orcamento"), t("studio.fab"), t("studio.titulo")],
        tip: { title: "Seu primeiro orçamento", body: "Toque aqui, escolha a peça e coloque a arte. O cliente recebe o vídeo 3D no WhatsApp." },
      },
      primeiro_item_em_producao: {
        title: "Acompanhe a produção",
        desc: "Do \"aguardando arte\" ao \"pronto\".",
        path: "/studio/producao",
        targets: [t("studio.titulo")],
        tip: { title: "Sua produção", body: "Orçamento aprovado cai aqui. Mova o pedido de etapa até o \"pronto\"." },
      },
    },
  },
  varejo: {
    nome: "loja",
    pronto: null,
    prontoMods: [],
    passos: VAREJO_PASSOS,
  },
  outro: {
    nome: null,
    pronto: null,
    prontoMods: [],
    passos: VAREJO_PASSOS,
  },
};

/** Frente de uma empresa sem segment (NULL) usa os passos do varejo. */
export function frenteDe(segment: Segmento | null | undefined): FrenteConfig {
  return (segment && FRENTES[segment]) || FRENTES.varejo;
}

/** "Sua Aura já abre como ótica." / "Sua Aura já está pronta." */
export function tituloDaFrente(segment: Segmento | null | undefined): string {
  const f = frenteDe(segment);
  return f.nome ? "Sua Aura já abre como " + f.nome + "." : "Sua Aura já está pronta.";
}

// Nome da frente para leitura (Configurações e Gestão Aura).
export const SEGMENT_LABEL: Record<Segmento, string> = {
  varejo: "Loja em geral",
  matcon: "Material de construção",
  otica: "Ótica",
  assistencia: "Assistência técnica",
  studio: "Personalizados (Aura Studio)",
  outro: "Outro",
};

export const SEGMENTOS: Segmento[] = ["varejo", "matcon", "otica", "assistencia", "studio", "outro"];
