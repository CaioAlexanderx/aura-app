// ============================================================
// Canal digital · o que a lojista precisa subir, e em que formato
//
// Nenhum campo de upload do painel dizia tamanho, proporção ou peso. A
// lojista subia o que tinha e descobria o resultado na loja — logo
// esticado, banner com o texto cortado no mobile, foto de 4 MB deixando
// a vitrine lenta.
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
    resumo: "512×512px · PNG com fundo transparente · até 2 MB",
    detalhes: [
      "Quadrado, 512×512px ou maior",
      "PNG com fundo transparente — o logo assenta sobre a cor da loja",
      "Sem moldura branca em volta: ela aparece como um quadrado no hero",
    ],
  },
  banner: {
    resumo: "1600×600px (16:6) · JPG · até 2 MB · texto à esquerda",
    detalhes: [
      "1600×600px — a mesma proporção 16:6 do quadro na loja",
      "JPG até 2 MB; imagem pesada atrasa a primeira tela",
      "Deixe o lado esquerdo mais limpo: é onde o texto entra",
      "No celular o quadro vira 4:3 e corta as laterais — nada essencial nas bordas",
    ],
  },
  produto: {
    resumo: "1000×1000px · JPG ou PNG · até 10 MB · até 5 por produto",
    detalhes: [
      "Quadrada, 1000×1000px ou maior",
      "A peça inteira no quadro — a loja não corta, mas também não inventa o que ficou de fora",
      "Fundo limpo (parede, chão, cabide) e luz do dia bastam; estúdio não é necessário",
      "Até 5 fotos por produto viram carrossel no cartão",
    ],
  },
  capa: {
    resumo: "1600×900px · JPG · até 2 MB",
    detalhes: [
      "1600×900px, paisagem",
      "Entra atrás do hero com um véu da cor da loja por cima",
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
      acao: semFoto > 0
        ? `${semFoto} ${semFoto === 1 ? "produto está" : "produtos estão"} sem foto e ${semFoto === 1 ? "aparece" : "aparecem"} com as iniciais no lugar da peça.`
        : "Todos os produtos da vitrine têm foto.",
      // Vitrine vazia não é "feito" — é "nem começou".
      feito: total > 0 && semFoto === 0,
      medida: total > 0 ? `${comFoto} de ${total} com foto` : "nenhum produto na vitrine ainda",
      spec: SPECS.produto,
    },
    {
      chave: "logo",
      titulo: "Logo da loja",
      acao: e.logoUrl
        ? "Logo no ar, no topo e no hero."
        : "Sem logo, o hero mostra só o nome escrito.",
      feito: !!e.logoUrl,
      spec: SPECS.logo,
    },
    {
      chave: "cor",
      titulo: "Cor da marca",
      acao: (e.corPrimaria || "").toLowerCase() !== COR_PADRAO
        ? "Cor escolhida — ela atravessa a loja inteira."
        : "A loja está no violeta da Aura. Use o conta-gotas para pegar a cor do seu logo.",
      feito: !!e.corPrimaria && e.corPrimaria.toLowerCase() !== COR_PADRAO,
    },
    {
      chave: "banner",
      titulo: "Banner do topo",
      acao: (e.banners || []).length > 0
        ? "Banner próprio no ar."
        : "Sem banner, a loja usa um gerado na sua cor — funciona, mas o seu deixa a loja parecer sua.",
      feito: (e.banners || []).length > 0,
      spec: SPECS.banner,
    },
    {
      chave: "voz",
      titulo: "Aviso e contato",
      acao: e.anuncio || e.whatsapp
        ? "Sua loja fala com quem chega."
        : "Uma linha de aviso (frete, prazo, promoção) e o WhatsApp no ar. É o que loja grande tem e loja nova esquece.",
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
