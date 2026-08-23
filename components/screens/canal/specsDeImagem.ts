// ============================================================
// Canal digital · o que a lojista precisa subir, e em que formato
//
// Nenhum campo de upload do painel dizia tamanho, proporção ou peso. A
// lojista subia o que tinha e descobria o resultado na loja.
//
// COMO ESCREVER AQUI: o texto fala COM a lojista sobre o que ELA faz —
// "Envie a foto de 8 produtos", não "8 produtos aparecem com as iniciais
// no lugar da peça". Nada de termo interno ("hero", "vitrine", "capa
// composta"), nada de explicar o mecanismo, nada de sermão. Se a frase
// só faz sentido pra quem leu o código, ela está errada.
//
// As specs moram aqui porque duas telas precisam delas: o campo de
// upload (na hora de subir) e o checklist (na hora de planejar).
// ============================================================

export type SpecDeImagem = {
  /** Uma linha, mostrada embaixo do campo. */
  resumo: string;
  /** Detalhes, mostrados no checklist. */
  detalhes: string[];
};

export const SPECS: Record<"logo" | "banner" | "produto" | "capa", SpecDeImagem> = {
  logo: {
    resumo: "PNG com fundo transparente, quadrado, 512×512px",
    detalhes: [
      "Salve em PNG com fundo transparente — se o fundo for branco, aparece um quadrado branco em volta do seu logo",
      "Quadrado, 512×512px ou maior",
      "Sem moldura e sem borda em volta",
    ],
  },
  banner: {
    resumo: "1600×600px, JPG, até 2 MB",
    detalhes: [
      "Use 1600×600px — é a proporção do espaço na sua loja",
      "Deixe o lado esquerdo mais vazio: é onde entra o texto",
      "No celular as laterais são cortadas, então não coloque nada importante nas pontas",
      "Até 2 MB — imagem pesada deixa sua loja lenta pra abrir",
    ],
  },
  produto: {
    resumo: "Foto quadrada, 1000×1000px, até 5 por produto",
    detalhes: [
      "Fotografe a peça inteira, sem cortar",
      "Quadrada, 1000×1000px ou maior",
      "Parede, chão ou cabide já servem de fundo — não precisa de estúdio",
      "Prefira luz do dia, perto de uma janela",
      "Você pode enviar até 5 fotos do mesmo produto",
    ],
  },
  capa: {
    resumo: "1600×900px, JPG, até 2 MB",
    detalhes: [
      "Use 1600×900px, deitada",
      "Ela fica atrás do nome da sua loja, com um véu da sua cor por cima",
    ],
  },
};

// ── Checklist ───────────────────────────────────────────

export type ItemChecklist = {
  chave: string;
  titulo: string;
  /** O que fazer, em uma frase, na voz de quem vai fazer. */
  acao: string;
  feito: boolean;
  /** "12 de 30 com foto" — só onde faz sentido medir. */
  medida?: string | null;
  spec?: SpecDeImagem;
};

export type EstadoDaLoja = {
  logoUrl?: string | null;
  corPrimaria?: string | null;
  banners?: unknown[];
  anuncio?: string | null;
  tagline?: string | null;
  whatsapp?: string | null;
  produtosTotal?: number;
  produtosComFoto?: number;
};

/** A cor que vem por padrão — se não mudou, a lojista ainda não escolheu. */
export const COR_PADRAO = "#7c3aed";

/**
 * O checklist, em ordem de impacto na aparência da loja.
 *
 * Foto vem primeiro porque é o item que mais muda a vitrine e o único que
 * nenhum guardrail resolve sozinho: a capa composta salva a grade, mas
 * ninguém compra uma peça que não viu.
 */
export function montarChecklist(e: EstadoDaLoja): ItemChecklist[] {
  const total = e.produtosTotal || 0;
  const comFoto = e.produtosComFoto || 0;
  const semFoto = Math.max(0, total - comFoto);

  return [
    {
      chave: "fotos",
      titulo: "Fotos dos produtos",
      acao:
        total === 0
          ? "Cadastre seus produtos e envie uma foto de cada um."
          : semFoto > 0
            ? `Envie a foto de ${semFoto} ${semFoto === 1 ? "produto" : "produtos"}. Sem foto, o cliente não vê o que está comprando.`
            : "Todos os seus produtos têm foto.",
      // Vitrine vazia não é "feito" — é "nem começou".
      feito: total > 0 && semFoto === 0,
      medida: total > 0 ? `${comFoto} de ${total}` : null,
      spec: SPECS.produto,
    },
    {
      chave: "logo",
      titulo: "Logo da loja",
      acao: e.logoUrl
        ? "Seu logo aparece no topo da loja."
        : "Envie seu logo. Sem ele, a loja mostra só o nome escrito.",
      feito: !!e.logoUrl,
      spec: SPECS.logo,
    },
    {
      chave: "cor",
      titulo: "Cor da sua marca",
      acao:
        (e.corPrimaria || "").toLowerCase() !== COR_PADRAO
          ? "Sua loja usa a sua cor nos botões e nos preços."
          : "Escolha a cor da sua marca. Use o conta-gotas para pegar a cor do seu logo.",
      feito: !!e.corPrimaria && e.corPrimaria.toLowerCase() !== COR_PADRAO,
    },
    {
      chave: "banner",
      titulo: "Banner do topo",
      acao: (e.banners || []).length > 0
        ? "Seu banner está no ar."
        : "Envie um banner com sua campanha ou sua melhor peça. Até lá, usamos um na sua cor.",
      feito: (e.banners || []).length > 0,
      spec: SPECS.banner,
    },
    {
      chave: "voz",
      titulo: "Aviso e WhatsApp",
      acao: e.anuncio || e.whatsapp
        ? "Seu aviso e seu WhatsApp estão na loja."
        : "Escreva um aviso curto (frete, prazo ou promoção) e confirme seu WhatsApp, para o cliente tirar dúvidas antes de comprar.",
      feito: !!(e.anuncio || e.whatsapp),
    },
  ];
}

/** Quantos itens já estão prontos — vira a barra de progresso. */
export function progresso(itens: ItemChecklist[]): { feitos: number; total: number; pct: number } {
  const feitos = itens.filter((i) => i.feito).length;
  const total = itens.length;
  return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 };
}
