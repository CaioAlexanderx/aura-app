// ============================================================
// components/studio/storefront/produto/regrasDaPagina.ts
//
// As regras da página do produto nova (Fase 3, mockup aprovado
// docs/mockups/studio-vitrine-03-produto.html), fora da tela.
//
// Nenhuma regra de PREÇO nasce aqui. O total e o preço unitário vêm do
// hook (useStorefront: configuringUnitPrice e, com a Fase 2,
// configuringLineTotal), que é a mesma conta do servidor. O que mora
// aqui é o que a página DIZ sobre esses números: a régua da escada, a
// frase "Faltam 3 para pagar", o prazo por faixa, o que falta na peça,
// o aviso de foto pequena, a área de impressão. Tudo puro e com teste
// (__tests__/vitrineStudioPaginaDoProduto.test.ts).
// ============================================================
import type { CustomizationConfig, CustomizationField, QtyTier, StoreRevisions } from "../types";
import { basePriceForQty, matchTier, proximaFaixa, faixaLabel } from "../qtyTiers";
import { isArtSourceType, isArtServiceField, isArtBriefField, sideOf } from "@/components/studio/customizationConfig";
import { dinheiro } from "../moeda";

export type Lado = "front" | "back" | "middle";

// ── Quantidade ───────────────────────────────────────────────

/**
 * O teto do campo de quantidade. Acima disso é lote: a página oferece o
 * "Peça um orçamento em lote" logo embaixo, e três dígitos cabem no
 * campo sem cortar.
 */
export const QTD_MAXIMA = 999;

/** A quantidade que vale: inteiro de 1 a QTD_MAXIMA; lixo vira 1. */
export function quantidadeValida(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(QTD_MAXIMA, n);
}

/**
 * O que o campo mostra enquanto a pessoa digita: só dígitos, no máximo
 * três. Vazio é permitido DURANTE a digitação (apagar o 1 para escrever
 * 50); ao sair do campo, vazio volta a 1 (quantidadeValida).
 */
export function quantidadeDigitada(texto: string): string {
  return String(texto || "").replace(/\D/g, "").replace(/^0+/, "").slice(0, String(QTD_MAXIMA).length);
}

// ── Escada de desconto ───────────────────────────────────────

export type ParadaDaRegua = {
  /** Quantidade da parada (1 e o min_qty de cada faixa). */
  qtd: number;
  /** Preço unitário naquela quantidade, já com os adicionais por unidade. */
  preco: number;
  /** Desconto da faixa, em %; 0 na primeira. */
  pct: number;
  /** A quantidade atual já chegou nesta parada? */
  alcancada: boolean;
};

export type ReguaDaEscada = {
  paradas: ParadaDaRegua[];
  /** Posição do marcador entre 0 (primeira parada) e 1 (última). */
  progresso: number;
};

function faixasOrdenadas(tiers: QtyTier[] | null | undefined): QtyTier[] {
  return (Array.isArray(tiers) ? tiers : [])
    .filter((t) => Number.isFinite(Number(t?.min_qty)) && Number(t.min_qty) > 1)
    .slice()
    .sort((a, b) => Number(a.min_qty) - Number(b.min_qty));
}

/**
 * A régua da escada (Tela 5): uma parada por faixa, mais a de 1 unidade.
 *
 * `adicionalPorUnidade` é a diferença entre o preço unitário do hook e o
 * preço de tabela na quantidade atual — cor, verso, opções. A faixa
 * incide sobre a tabela e os adicionais somam depois (basePriceForQty),
 * então o preço de cada parada é a tabela naquela quantidade mais o
 * mesmo adicional. `null` sem escada: a régua some.
 */
export function reguaDaEscada(
  tiers: QtyTier[] | null | undefined,
  precoDeTabela: number,
  adicionalPorUnidade: number,
  qtd: number,
): ReguaDaEscada | null {
  const faixas = faixasOrdenadas(tiers);
  if (!faixas.length) return null;
  const q = quantidadeValida(qtd);
  const adic = Number(adicionalPorUnidade) || 0;
  const noPonto = (n: number) => Math.round((basePriceForQty(precoDeTabela, tiers, n) + adic) * 100) / 100;
  const paradas: ParadaDaRegua[] = [
    { qtd: 1, preco: noPonto(1), pct: 0, alcancada: true },
    ...faixas.map((t) => ({
      qtd: Number(t.min_qty),
      preco: noPonto(Number(t.min_qty)),
      pct: Number(t.discount_pct) || 0,
      alcancada: q >= Number(t.min_qty),
    })),
  ];
  return { paradas, progresso: progressoNaRegua(paradas.map((p) => p.qtd), q) };
}

/** Paradas igualmente espaçadas; entre duas, o marcador anda proporcional. */
export function progressoNaRegua(paradas: number[], qtd: number): number {
  const k = paradas.length - 1;
  if (k <= 0) return 0;
  if (qtd <= paradas[0]) return 0;
  if (qtd >= paradas[k]) return 1;
  for (let i = 0; i < k; i++) {
    if (qtd < paradas[i + 1]) return (i + (qtd - paradas[i]) / (paradas[i + 1] - paradas[i])) / k;
  }
  return 1;
}

export type FraseDaEscada =
  | { tipo: "leve"; quantidade: number; preco: number }
  | { tipo: "faltam"; faltam: number; quantidade: number; preco: number }
  | { tipo: "menor"; preco: number };

/**
 * A frase única da escada (Tela 5):
 *   - longe da próxima faixa: "Leve 10 e pague R$ 47,41 cada";
 *   - da metade do caminho em diante: "Faltam 3 para pagar R$ 44,91 cada";
 *   - na última faixa: "Você chegou ao menor preço".
 * "Metade" é a quantidade atual já na metade da próxima faixa (e mais de
 * 1): com 1 unidade a frase é sempre o convite, nunca a cobrança.
 */
export function fraseDaEscada(
  tiers: QtyTier[] | null | undefined,
  precoDeTabela: number,
  adicionalPorUnidade: number,
  qtd: number,
): FraseDaEscada | null {
  const faixas = faixasOrdenadas(tiers);
  if (!faixas.length) return null;
  const q = quantidadeValida(qtd);
  const adic = Number(adicionalPorUnidade) || 0;
  const noPonto = (n: number) => Math.round((basePriceForQty(precoDeTabela, tiers, n) + adic) * 100) / 100;
  const prox = proximaFaixa(faixas, q);
  if (!prox) return { tipo: "menor", preco: noPonto(q) };
  const min = Number(prox.min_qty);
  if (q > 1 && q >= min / 2) return { tipo: "faltam", faltam: min - q, quantidade: min, preco: noPonto(min) };
  return { tipo: "leve", quantidade: min, preco: noPonto(min) };
}

/**
 * "Você economiza R$ 42,33 com o desconto de 5%." — a diferença entre a
 * tabela e a faixa, vezes a quantidade. `null` fora de faixa.
 */
export function economiaNaFaixa(
  tiers: QtyTier[] | null | undefined,
  precoDeTabela: number,
  qtd: number,
): { valor: number; pct: number } | null {
  const q = quantidadeValida(qtd);
  const t = matchTier(tiers, q);
  if (!t) return null;
  const base = Number(precoDeTabela) || 0;
  const naFaixa = basePriceForQty(base, tiers, q);
  const valor = Math.round((base - naFaixa) * q * 100) / 100;
  if (!(valor > 0)) return null;
  return { valor, pct: Number(t.discount_pct) || 0 };
}

// ── Prazo ────────────────────────────────────────────────────

/** "1 dia útil" / "5 dias úteis". */
export function textoDeDias(n: number): string {
  return n === 1 ? "1 dia útil" : `${n} dias úteis`;
}

/**
 * Os dias úteis para esta quantidade: o `lead_days` da faixa em que ela
 * cai (a lojista declarou) e, fora de faixa ou sem prazo na faixa, o
 * prazo da loja (`sla.total_estimate_days`). `null` quando nenhum dos
 * dois existe — prazo que o sistema inventa é o que quebra.
 */
export function prazoDaQuantidade(
  tiers: Array<QtyTier & { lead_days?: number | null }> | null | undefined,
  qtd: number,
  prazoDaLoja: number | null | undefined,
): number | null {
  const t = matchTier(tiers, quantidadeValida(qtd)) as (QtyTier & { lead_days?: number | null }) | null;
  const daFaixa = t && t.lead_days != null ? Math.ceil(Number(t.lead_days)) : NaN;
  if (Number.isFinite(daFaixa) && daFaixa > 0) return daFaixa;
  const loja = Math.ceil(Number(prazoDaLoja));
  return Number.isFinite(loja) && loja > 0 ? loja : null;
}

/**
 * "Até 9 un: 3 dias úteis · 10 a 49 un: 5 dias úteis · 50 un ou mais:
 * 8 dias úteis" (Tela 8). Só quando alguma faixa declara prazo próprio:
 * sem isso o prazo é um só e já está no topo da página.
 */
export function linhasDePrazo(
  tiers: Array<QtyTier & { lead_days?: number | null }> | null | undefined,
  prazoDaLoja: number | null | undefined,
): string | null {
  const faixas = faixasOrdenadas(tiers) as Array<QtyTier & { lead_days?: number | null }>;
  if (!faixas.some((t) => t.lead_days != null && Number(t.lead_days) > 0)) return null;
  const partes: string[] = [];
  const primeira = Number(faixas[0].min_qty);
  const antes = prazoDaQuantidade(tiers, 1, prazoDaLoja);
  if (primeira > 1 && antes != null) {
    partes.push(`${primeira - 1 === 1 ? "1 un" : `Até ${primeira - 1} un`}: ${textoDeDias(antes)}`);
  }
  for (const t of faixas) {
    const d = prazoDaQuantidade(tiers, Number(t.min_qty), prazoDaLoja);
    if (d != null) partes.push(`${faixaLabel(t)}: ${textoDeDias(d)}`);
  }
  return partes.length ? partes.join(" · ") : null;
}

// ── O que falta na peça ──────────────────────────────────────

export function nomeDoLado(lado: Lado): string {
  return lado === "back" ? "do verso" : lado === "middle" ? "do meio" : "da frente";
}

export type FaltaNaPeca = {
  /** Uma frase só (Jornada §3, princípio 2): "Falta a arte da frente". */
  frase: string;
  lado: Lado;
  /** O campo que a barra leva ao tocar; null = a seção inteira. */
  campoId: string | null;
  tipo: "arte" | "campo";
};

function preenchido(v: unknown): boolean {
  return !(v == null || (typeof v === "string" && !v.trim()));
}

/**
 * O que falta para a peça poder ir para a sacola, como FRASE e com o
 * lugar para onde a barra leva — ou null quando está tudo pronto.
 *
 * É a mesma regra de validateRequiredFields (useStorefront.ts), que é o
 * espelho do servidor, na mesma ordem: o grupo de origem da arte de cada
 * lado (arquivo OU arte pronta, e "Criem a arte pra mim" dispensa), e
 * depois os obrigatórios que sobram. O teste confere que as duas dizem
 * "falta" nos mesmos casos — se divergissem, a frase sumiria e o botão
 * recusaria mesmo assim.
 */
export function faltaNaPeca(
  cfg: CustomizationConfig | null | undefined,
  values: Record<string, any>,
  versoAtivo: boolean,
  meioAtivo: boolean = false,
): FaltaNaPeca | null {
  if (!cfg?.fields) return null;
  const v = values || {};
  const ativo = (lado: Lado) => (lado === "back" ? versoAtivo : lado === "middle" ? meioAtivo : true);
  const aplicaveis = cfg.fields.filter((f) => ativo(sideOf(f)));
  const arteContratada = aplicaveis.some(
    (f) => (f.config as any)?.is_art_service === true && v[f.id] === "designer",
  );

  for (const lado of ["front", "back", "middle"] as const) {
    const grupo = aplicaveis.filter((f) => isArtSourceType(f.type) && sideOf(f) === lado);
    if (!grupo.some((f) => f.required)) continue;
    if (arteContratada) continue;
    if (grupo.some((f) => preenchido(v[f.id]))) continue;
    const alvo = grupo.find((f) => f.type === "image") || grupo[0];
    return { frase: `Falta a arte ${nomeDoLado(lado)}`, lado, campoId: alvo?.id ?? null, tipo: "arte" };
  }

  for (const f of aplicaveis) {
    if (!f.required) continue;
    if (isArtSourceType(f.type)) continue;
    if (preenchido(v[f.id])) continue;
    const lado = sideOf(f) as Lado;
    const rotulo = String(f.label || "").trim();
    const frase = f.type === "text"
      ? `Falta o texto ${nomeDoLado(lado)}`
      : `Falta escolher ${rotulo ? rotulo.charAt(0).toLowerCase() + rotulo.slice(1) : "uma opção"}`;
    return { frase, lado, campoId: f.id, tipo: "campo" };
  }
  return null;
}

// ── Lados e campos ───────────────────────────────────────────

/**
 * Os lados que a peça tem, na ordem das abas Frente · Verso · Meio. A
 * mesma regra do alternador do LivePreview: segue o PRODUTO (has_back,
 * has_middle), não o template visual.
 */
export function ladosDaPeca(cfg: CustomizationConfig | null | undefined): Lado[] {
  const l: Lado[] = ["front"];
  if (cfg?.has_back === true) l.push("back");
  if (cfg?.has_middle === true) l.push("middle");
  return l;
}

/** O campo de cor que pinta a peça (o mesmo que o LivePreview leva ao 3D). */
export function campoDaCorDaPeca(cfg: CustomizationConfig | null | undefined): CustomizationField | null {
  return cfg?.fields?.find((f) => f.type === "color") || null;
}

/** O campo "Como você quer resolver a arte?", quando a peça tem. */
export function campoDoServicoDeArte(cfg: CustomizationConfig | null | undefined): CustomizationField | null {
  return cfg?.fields?.find((f) => f.type === "option" && isArtServiceField(f)) || null;
}

/**
 * Os campos que moram na aba de um lado: tudo menos o que já tem lugar
 * próprio na página — o serviço de arte e o briefing (seção 3), a cor
 * da peça (seção 2) e as origens de arte (envio e arte pronta, que a
 * aba desenha à parte).
 */
export function camposDoLado(cfg: CustomizationConfig | null | undefined, lado: Lado): CustomizationField[] {
  const cor = campoDaCorDaPeca(cfg);
  return (cfg?.fields || []).filter((f) =>
    sideOf(f) === lado &&
    !isArtSourceType(f.type) &&
    !isArtServiceField(f) &&
    !isArtBriefField(f) &&
    !(f.type === "option" && (f.config as any)?.is_art_service) &&
    f !== cor,
  );
}

/** As origens de arte de um lado: envio de arquivo e arte pronta. */
export function origensDoLado(cfg: CustomizationConfig | null | undefined, lado: Lado) {
  const campos = (cfg?.fields || []).filter((f) => sideOf(f) === lado);
  return {
    envio: campos.find((f) => f.type === "image") || null,
    pronta: campos.find((f) => f.type === "template") || null,
  };
}

/** O lado tem alguma coisa que a cliente preencheu? (o pontinho da aba) */
export function ladoPreenchido(cfg: CustomizationConfig | null | undefined, lado: Lado, values: Record<string, any>): boolean {
  return (cfg?.fields || []).some((f) =>
    sideOf(f) === lado && (f.type === "text" || f.type === "image" || f.type === "template") &&
    !isArtBriefField(f) && preenchido(values?.[f.id]),
  );
}

// ── Aviso de foto pequena ────────────────────────────────────

/**
 * O limiar proposto no mockup (P3): 1200 px no lado maior — metade dos
 * 2400 px que 20 cm pedem a 300 dpi. É aviso, não trava (DEC-11: a
 * triagem da arte é parte do processo da loja).
 */
export const LIMIAR_DE_RESOLUCAO = 1200;

/** Pixels para imprimir `cm` a `dpi` pontos por polegada. */
export function pixelsParaCm(cm: number, dpi: number = 300): number {
  const c = Number(cm);
  return Number.isFinite(c) && c > 0 ? Math.round((c / 2.54) * dpi) : 0;
}

/**
 * O limiar desta peça. Com área de impressão cadastrada, nunca acima do
 * que a própria página pede ("mande com pelo menos N px"): senão uma
 * foto que cumpre o pedido levaria o aviso. Sem área, o proposto.
 */
export function limiarDaPeca(area: AreaDeImpressao | null | undefined): number {
  if (!area) return LIMIAR_DE_RESOLUCAO;
  const pedido = Math.max(area.pxLargura, area.pxAltura);
  return pedido > 0 ? Math.min(LIMIAR_DE_RESOLUCAO, pedido) : LIMIAR_DE_RESOLUCAO;
}

/** Tipos que o navegador consegue medir antes de enviar. PDF não entra. */
export function medivel(tipo: string | null | undefined): boolean {
  return /^image\/(png|jpe?g|webp|gif|bmp)$/i.test(String(tipo || ""));
}

/**
 * O aviso de baixa resolução, medido no navegador ANTES do envio.
 * `null` quando não há o que avisar: PDF (não é medido), dimensões que
 * não chegaram, ou imagem grande o bastante.
 */
export function avisoDeResolucao(
  arquivo: { tipo?: string | null; largura?: number | null; altura?: number | null },
  limiar: number = LIMIAR_DE_RESOLUCAO,
): { ladoMaior: number; limiar: number } | null {
  if (!medivel(arquivo?.tipo)) return null;
  const w = Number(arquivo.largura);
  const h = Number(arquivo.altura);
  if (!(w > 0) || !(h > 0)) return null;
  const ladoMaior = Math.max(w, h);
  return ladoMaior < limiar ? { ladoMaior, limiar } : null;
}

/** A frase do aviso: "Essa foto tem 640 px. Na caneca ela pode sair borrada." */
export function textoDoAvisoDeResolucao(ladoMaior: number, peca: NomeDaPeca): string {
  return `Essa foto tem ${ladoMaior} px. ${peca.feminino ? "Na" : "No"} ${peca.nome} ela pode sair borrada.`;
}

/** "2400 × 2400 px · 1,8 MB" — o que a cliente enviou, em uma linha. */
export function medidasDoArquivo(a: { largura?: number | null; altura?: number | null; bytes?: number | null }): string {
  const partes: string[] = [];
  if (Number(a.largura) > 0 && Number(a.altura) > 0) partes.push(`${a.largura} × ${a.altura} px`);
  const b = Number(a.bytes);
  if (b > 0) {
    partes.push(b >= 1024 * 1024
      ? `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
      : `${Math.max(1, Math.round(b / 1024))} KB`);
  }
  return partes.join(" · ");
}

// ── A peça, em palavras ──────────────────────────────────────

export type NomeDaPeca = { nome: string; feminino: boolean };

const PECA: NomeDaPeca = { nome: "peça", feminino: true };

/**
 * "caneca" a partir de "Canecas": o nome que a página usa em "Sua
 * caneca", "Sobre esta caneca", "Cor da caneca". Só quando o singular é
 * seguro (termina em a ou o); senão "peça" — melhor genérico que errado.
 */
export function nomeDaPeca(categoria: string | null | undefined): NomeDaPeca {
  const bruto = String(categoria || "").trim().toLowerCase();
  if (!bruto || /\s/.test(bruto)) return PECA;
  let s = bruto;
  if (s.endsWith("ões")) s = s.slice(0, -3) + "ão";
  else if (s.endsWith("s") && s.length > 3) s = s.slice(0, -1);
  if (/a$/.test(s)) return { nome: s, feminino: true };
  if (/o$/.test(s)) return { nome: s, feminino: false };
  return PECA;
}

/** "Sua caneca" / "Seu copo". */
export function suaPeca(p: NomeDaPeca): string {
  return (p.feminino ? "Sua " : "Seu ") + p.nome;
}

/** "Sobre esta caneca" / "Sobre este copo". */
export function sobreEstaPeca(p: NomeDaPeca): string {
  return (p.feminino ? "Sobre esta " : "Sobre este ") + p.nome;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * O nome curto do modelo, sem a palavra da categoria: "Caneca Alça
 * Coração" em "Canecas" vira "Alça Coração" — é o que cabe no
 * mini-carrossel e no último nível da trilha. Sem o que tirar, o nome
 * inteiro.
 */
export function nomeCurto(nome: string, categoria: string | null | undefined): string {
  const n = String(nome || "").trim();
  const peca = nomeDaPeca(categoria);
  if (peca === PECA) return n;
  const palavras = n.split(/\s+/);
  if (palavras.length < 2) return n;
  const primeira = semAcento(palavras[0].toLowerCase());
  const alvo = semAcento(peca.nome);
  if (primeira !== alvo && primeira !== alvo + "s") return n;
  let resto = palavras.slice(1);
  // "Caneca de Vidro…" → "Vidro…": o conectivo sozinho não é nome.
  if (resto.length > 1 && /^(de|da|do|com)$/i.test(resto[0])) resto = resto.slice(1);
  const curto = resto.join(" ").trim();
  return curto || n;
}

/**
 * O endereço de retirada em duas partes: "Av Dom Pedro I, 553 - Jardim
 * Colonial" vira o bairro (título da linha: "Retire na loja · Jardim
 * Colonial") e a rua (legenda).
 */
export function enderecoDeRetirada(endereco: string | null | undefined): { bairro: string | null; rua: string } | null {
  const e = String(endereco || "").trim();
  if (!e) return null;
  const partes = e.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) return { bairro: null, rua: e };
  return { bairro: partes[1], rua: partes[0] };
}

/** A promessa de revisão da loja, em uma linha (ex-ProductConfigurator). */
export function notaDeRevisao(r: Partial<StoreRevisions> | null | undefined): string | null {
  if (!r) return null;
  if (r.policy_text) return String(r.policy_text);
  const inc = Number(r.max_included) || 0;
  if (inc <= 0) return "Você aprova o mockup antes de a loja produzir.";
  const extra = Number(r.extra_price) || 0;
  const base = `Você aprova o mockup antes de produzir. ${inc} ${inc === 1 ? "revisão inclusa" : "revisões inclusas"}`;
  return extra > 0 ? `${base}; revisão extra ${dinheiro(extra)}.` : `${base}.`;
}

// ── O que o preço já inclui ──────────────────────────────────

export type Adicional = { nome: string; valor: number; servicoDeArte: boolean };

/**
 * Os adicionais escolhidos, com nome: "ajuste da arte", "verso", a cor
 * com +R$. É o RÓTULO dos números que o hook já somou (choicesDelta,
 * backDelta, middleDelta) — a página não soma nada com isto, só escreve
 * "Inclui verso (+R$ 8,00)". O serviço de arte vem marcado porque a
 * Fase 2 o cobra uma vez por linha, e aí ele não está no unitário.
 */
export function adicionaisDaPeca(
  cfg: CustomizationConfig | null | undefined,
  values: Record<string, any>,
  verso: boolean,
  meio: boolean,
): Adicional[] {
  const out: Adicional[] = [];
  for (const f of cfg?.fields || []) {
    if (f.type !== "option" && f.type !== "color") continue;
    const choices: any[] = Array.isArray((f.config as any)?.choices) ? (f.config as any).choices : [];
    const sel = values?.[f.id];
    if (sel == null || !choices.length) continue;
    for (const s of Array.isArray(sel) ? sel : [sel]) {
      const c = choices.find((ch) => ch.value === s || ch.label === s);
      const d = Number(c?.price_delta);
      if (!c || !Number.isFinite(d) || d === 0) continue;
      const arte = (f.config as any)?.is_art_service === true;
      const nome = arte
        ? (c.value === "designer" ? "criação da arte" : c.value === "adjust" ? "ajuste da arte" : String(c.label || "arte").toLowerCase())
        : f.type === "color" ? `cor ${String(c.label || s)}`.trim() : String(c.label || s);
      out.push({ nome, valor: d, servicoDeArte: arte });
    }
  }
  if (verso && cfg?.has_back === true && cfg.back_charge_enabled === true) {
    const d = Number(cfg.back_price_delta);
    if (Number.isFinite(d) && d > 0) out.push({ nome: "verso", valor: d, servicoDeArte: false });
  }
  if (meio && cfg?.has_middle === true && cfg.middle_charge_enabled === true) {
    const d = Number(cfg.middle_price_delta);
    if (Number.isFinite(d) && d > 0) out.push({ nome: "meio", valor: d, servicoDeArte: false });
  }
  return out;
}

/**
 * "a partir de" no cartão da grade (Tela 9, P10): só quando o preço da
 * vitrine pode mudar na página — escada de desconto ou algum adicional
 * pago (serviço de arte, verso, meio, cor/opção com +R$). Peça de preço
 * único mostra o preço seco: "a partir de" ali seria promessa vazia.
 */
export function precoPodeMudar(p: { customization_config?: CustomizationConfig | null; qty_tiers?: QtyTier[] | null }): boolean {
  if (faixasOrdenadas(p?.qty_tiers).length) return true;
  const cfg = p?.customization_config;
  if (!cfg) return false;
  if (cfg.has_back === true && cfg.back_charge_enabled === true && Number(cfg.back_price_delta) > 0) return true;
  if (cfg.has_middle === true && cfg.middle_charge_enabled === true && Number(cfg.middle_price_delta) > 0) return true;
  return (cfg.fields || []).some((f) =>
    (f.type === "option" || f.type === "color") &&
    Array.isArray((f.config as any)?.choices) &&
    (f.config as any).choices.some((c: any) => Number(c?.price_delta) > 0),
  );
}

// ── Área de impressão ────────────────────────────────────────

export type AreaDeImpressao = {
  larguraCm: number;
  alturaCm: number;
  /** Pixels para sair nítida a 300 dpi. */
  pxLargura: number;
  pxAltura: number;
  origem: "cadastro" | "modelo";
};

function cm(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
}

/**
 * A área de impressão, de UMA fonte (decisão do PO, P1): o cadastro do
 * produto (`customization_config.print_area`) e, sem ele, a área do
 * modelo visual (spec do template). Nada é inventado: sem as duas, null
 * e a página não fala de área.
 */
export function areaDeImpressao(
  cfg: CustomizationConfig | null | undefined,
  areasDoModelo?: Array<{ width_cm?: number; height_cm?: number }> | null,
): AreaDeImpressao | null {
  const pa: any = cfg?.print_area;
  let w = cm(pa?.width_cm);
  let h = cm(pa?.height_cm);
  let origem: AreaDeImpressao["origem"] = "cadastro";
  if (!(w && h)) {
    const a = (areasDoModelo || []).find((x) => cm(x?.width_cm) && cm(x?.height_cm));
    if (!a) return null;
    w = cm(a.width_cm);
    h = cm(a.height_cm);
    origem = "modelo";
  }
  return { larguraCm: w, alturaCm: h, pxLargura: pixelsParaCm(w), pxAltura: pixelsParaCm(h), origem };
}

/** "20 × 9 cm" com vírgula decimal. */
export function textoDaArea(a: AreaDeImpressao): string {
  const f = (n: number) => String(n).replace(".", ",");
  return `${f(a.larguraCm)} × ${f(a.alturaCm)} cm`;
}
