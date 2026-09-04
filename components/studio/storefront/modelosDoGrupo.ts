// ============================================================
// components/studio/storefront/modelosDoGrupo.ts
//
// Escolher a caneca vendo as canecas.
//
// ── O QUE ERA ──────────────────────────────────────────────────────────
// Tocar em "Canecas · 9 modelos" abria direto o PRIMEIRO modelo, e os
// outros oito viravam chips de 104px, sem foto, num rolo horizontal.
// Quem queria a branca precisava rolar os chips e adivinhar pelo nome.
//
// Numa loja que vende variação de louça — alça coração, vintage,
// imperial, chopp — a diferença é justamente o que se vende. Se ela não
// é visível, a cliente escolhe sempre a mais barata, e a lojista perde a
// margem das peças especiais.
//
// ── A REGRA QUE IMPORTA ────────────────────────────────────────────────
// Não basta listar: a grade precisa destacar o EIXO QUE VARIA. Se os
// nove modelos custam o mesmo, gritar preço é ruído; se eles diferem em
// cor disponível, é a cor que decide. `eixoQueVaria` responde isso a
// partir dos dados, e não de um palpite fixo.
//
// Fica em módulo, e não na tela, porque é regra — e porque tela que
// importa Icon não carrega no jest.
// ============================================================
import type { StudioStoreProduct } from "./types";

export type EixoQueVaria = "preco" | "cor" | "acabamento";

export type ModeloDoGrupo = {
  produto: StudioStoreProduct;
  /** Quantas cores a cliente pode escolher nesta peça. */
  cores: string[];
  /** A peça tem mockup 3D publicado? */
  tem3D: boolean;
  /** Tem foto de verdade, ou vai cair no cartão com iniciais? */
  temFoto: boolean;
  preco: number;
};

function corDoProduto(p: StudioStoreProduct): string[] {
  const campos = p?.customization_config?.fields || [];
  for (const f of campos) {
    if (f?.type === "color" && Array.isArray(f?.config?.colors) && f.config.colors.length) {
      return f.config.colors.map(String);
    }
  }
  return [];
}

function temFotoDeVerdade(p: StudioStoreProduct): boolean {
  const galeria = (p as any)?.gallery_urls;
  if (Array.isArray(galeria) && galeria.some((u: any) => typeof u === "string" && u.trim())) return true;
  return typeof p?.image_url === "string" && p.image_url.trim().length > 0;
}

/** Lê um modelo do grupo — só o que a grade precisa mostrar. */
export function lerModelo(p: StudioStoreProduct): ModeloDoGrupo {
  return {
    produto: p,
    cores: corDoProduto(p),
    tem3D: Boolean((p as any)?.visual_kind),
    temFoto: temFotoDeVerdade(p),
    preco: Number(p?.price) || 0,
  };
}

/**
 * A ordem da grade.
 *
 * Peça com foto vem primeiro: numa grade de escolha visual, o cartão sem
 * foto é um buraco, e um buraco no início faz a grade inteira parecer
 * quebrada. Dentro de cada grupo, do mais barato ao mais caro — a
 * cliente ancora no preço de entrada e sobe se quiser.
 */
export function modelosOrdenados(produtos: StudioStoreProduct[]): ModeloDoGrupo[] {
  const lista = (Array.isArray(produtos) ? produtos : []).map(lerModelo);
  return lista.sort((a, b) => {
    if (a.temFoto !== b.temFoto) return a.temFoto ? -1 : 1;
    if (a.preco !== b.preco) return a.preco - b.preco;
    return String(a.produto.name).localeCompare(String(b.produto.name), "pt-BR");
  });
}

/**
 * O que de fato distingue estes modelos entre si.
 *
 * Se os preços variam, é preço que a cliente compara. Se não variam mas
 * as cores sim, é cor. Se nem preço nem cor variam, o que resta é o
 * acabamento — e aí a foto e o nome fazem todo o trabalho.
 */
export function eixoQueVaria(modelos: ModeloDoGrupo[]): EixoQueVaria {
  const lista = Array.isArray(modelos) ? modelos : [];
  if (lista.length < 2) return "acabamento";

  const precos = new Set(lista.map((m) => m.preco));
  if (precos.size > 1) return "preco";

  const assinaturas = new Set(lista.map((m) => m.cores.join("|")));
  if (assinaturas.size > 1) return "cor";

  return "acabamento";
}

/**
 * A faixa de preço do grupo, para o cabeçalho da grade.
 *
 * Devolve `null` quando todos custam o mesmo: escrever "de R$ 39,90 a
 * R$ 39,90" é ruído com cara de defeito.
 */
export function faixaDePrecos(modelos: ModeloDoGrupo[]): { min: number; max: number } | null {
  const precos = (modelos || []).map((m) => m.preco).filter((v) => v > 0);
  if (!precos.length) return null;
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  return min === max ? null : { min, max };
}

/**
 * A frase que resume o grupo para a cliente.
 *
 * Sai dos dados: quantos modelos, e quantos deles ela consegue ver em
 * 3D antes de comprar — que é o argumento de venda desta loja.
 */
export function resumoDoGrupo(modelos: ModeloDoGrupo[]): string {
  const n = (modelos || []).length;
  if (!n) return "";
  const com3D = modelos.filter((m) => m.tem3D).length;
  const base = n === 1 ? "1 modelo" : `${n} modelos`;
  if (com3D === 0) return base;
  if (com3D === n) return `${base} · todos com prévia em 3D`;
  return `${base} · ${com3D} com prévia em 3D`;
}
