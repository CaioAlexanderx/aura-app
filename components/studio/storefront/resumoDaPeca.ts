// ============================================================
// components/studio/storefront/resumoDaPeca.ts
//
// A personalização em linguagem de gente (Fase 2 · 25/09/2026).
//
// O dado guarda o VALOR da escolha: `designer`, `adjust`, `m`, `#D62828`.
// A cliente escolheu "Criem a arte pra mim", "Tamanho M", "Rosa". A sacola
// e a mensagem do WhatsApp mostravam o valor — a lojista recebia
// "Serviço de arte: designer" e a cliente lia "M" sem saber de quê
// (JORNADA §4.5, pedidoPeloWhatsApp.ts antes desta fase).
//
// Aqui cada campo vira o NOME que a cliente viu na tela:
//   - opção e cor  → o `label` da escolha (cor sem nome cadastrado fica
//     com o hex: é o que a lojista usa na prensa);
//   - serviço de arte → o nome do caminho ("Envio minha arte e vocês
//     ajustam"); "arte pronta" não vira linha, é o caso comum;
//   - texto → o texto, com a cor da arte (`<campo>_cor`) quando houver;
//   - arte enviada → "Arte enviada" no resumo curto; o endereço do
//     arquivo só na mensagem da lojista (ela abre sem pedir de novo).
// ============================================================
import type { CartLine, StudioStoreProduct } from "./types";
import { ehCampoDeArte, meioEfetivo } from "./precoDaSacola";
import { versoAtivo } from "./versoDoPedido";
import { ART_NONE } from "@/components/studio/artService";

function vazio(v: any): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function rotulo(f: any): string {
  const l = f?.label;
  return typeof l === "string" && l.trim() ? l.trim() : "Personalização";
}

/** A escolha de um campo de opção/cor pelo nome que a cliente viu. */
export function nomeDaEscolha(f: any, valor: any): string | null {
  if (vazio(valor)) return null;
  const choices: any[] = Array.isArray(f?.config?.choices) ? f.config.choices : [];
  const sels = Array.isArray(valor) ? valor : [valor];
  const nomes = sels.map((s) => {
    const c = choices.find((ch) => ch?.value === s || ch?.label === s);
    const l = c && typeof c.label === "string" && c.label.trim() ? c.label.trim() : null;
    return l || String(s);
  });
  return nomes.join(", ");
}

/**
 * O nome de uma cor: o label da escolha quando a lojista cadastrou, senão
 * o hex (em caixa alta, como a lojista lê na prensa).
 */
export function nomeDaCor(f: any, hex: any): string | null {
  if (vazio(hex)) return null;
  const choices: any[] = Array.isArray(f?.config?.choices) ? f.config.choices : [];
  const c = choices.find((ch) => ch?.value === hex || ch?.label === hex);
  if (c && typeof c.label === "string" && c.label.trim() && c.label !== hex) return c.label.trim();
  return String(hex).toUpperCase();
}

export type LinhaDaPersonalizacao = {
  rotulo: string;
  valor: string;
  /** "arquivo" = endereço de arte enviada; o resumo curto não mostra. */
  tipo: "texto" | "escolha" | "cor" | "arquivo" | "arte" | "briefing";
};

/**
 * Cada coisa que a cliente preencheu, com o nome que ela viu, na ordem
 * dos campos. Campo vazio não vira linha.
 */
export function linhasDaPeca(
  produto: Pick<StudioStoreProduct, "customization_config"> | null | undefined,
  valores: Record<string, any> | null | undefined,
): LinhaDaPersonalizacao[] {
  const campos: any[] = (produto?.customization_config?.fields as any[]) || [];
  const v = valores || {};
  const out: LinhaDaPersonalizacao[] = [];
  let briefingVisto = false;
  for (const f of campos) {
    if (!f || !f.id) continue;
    const valor = v[f.id];
    if (ehCampoDeArte(f)) {
      if (vazio(valor)) continue;
      const sels = Array.isArray(valor) ? valor : [valor];
      if (sels.every((s) => s === ART_NONE)) continue;
      const nome = nomeDaEscolha(f, valor);
      if (nome) out.push({ rotulo: rotulo(f), valor: nome, tipo: "arte" });
      continue;
    }
    if (f.id === "art_service_brief") {
      briefingVisto = true;
      if (!vazio(valor)) out.push({ rotulo: "Briefing da arte", valor: String(valor).trim(), tipo: "briefing" });
      continue;
    }
    if (f.type === "image" || f.type === "template") {
      if (typeof valor === "string" && valor.trim()) out.push({ rotulo: rotulo(f), valor: valor.trim(), tipo: "arquivo" });
      continue;
    }
    if (f.type === "color") {
      const nome = nomeDaCor(f, valor);
      if (nome) out.push({ rotulo: rotulo(f), valor: nome, tipo: "cor" });
      continue;
    }
    if (f.type === "option") {
      const nome = nomeDaEscolha(f, valor);
      if (nome) out.push({ rotulo: rotulo(f), valor: nome, tipo: "escolha" });
      continue;
    }
    if (!vazio(valor)) {
      const cor = v[f.id + "_cor"];
      const texto = String(valor).trim();
      out.push({ rotulo: rotulo(f), valor: texto, tipo: "texto" });
      if (!vazio(cor)) out.push({ rotulo: "Cor da arte", valor: String(cor).toUpperCase(), tipo: "cor" });
    }
  }
  // O briefing pode viver só nos valores (config antigo sem o campo): a
  // lojista precisa dele do mesmo jeito.
  if (!briefingVisto && !vazio(v.art_service_brief)) {
    out.push({ rotulo: "Briefing da arte", valor: String(v.art_service_brief).trim(), tipo: "briefing" });
  }
  return out;
}

/**
 * O resumo curto de uma linha, para a sacola e o checkout:
 * "Frente e verso · Arte: Mãe · Envio minha arte e vocês ajustam".
 *
 * Sem endereço de arquivo, sem briefing (é longo, é para a lojista), no
 * máximo quatro pedaços — é um resumo, não a ficha de produção.
 */
export function resumoDaLinha(line: Pick<CartLine, "product" | "values" | "hasBackSelected">): string[] {
  const cfg = line.product?.customization_config;
  const pedacos: string[] = [];
  // "Frente e verso" só quando o verso vai para a produção: escolhido E
  // preenchido (decisão do Caio, 04/09/2026, versoDoPedido.ts) — verso
  // incluso no preço e deixado em branco não é verso.
  if (cfg?.has_back === true && versoAtivo(cfg, line.hasBackSelected, line.values)) pedacos.push("Frente e verso");
  if (cfg?.has_middle === true && meioEfetivo(cfg, line.values?.has_middle_selected)) pedacos.push("Com faixa central");
  let arteEnviada = false;
  for (const l of linhasDaPeca(line.product, line.values)) {
    if (l.tipo === "arquivo") { arteEnviada = true; continue; }
    if (l.tipo === "briefing") continue;
    if (l.tipo === "arte") { pedacos.push(l.valor); continue; }
    if (l.tipo === "cor" && l.rotulo === "Cor da arte") continue;
    // Cor sem nome cadastrado é um hex: serve à lojista (mensagem), não ao
    // resumo da cliente — o mesmo corte do resumo do servidor.
    if (l.tipo === "cor" && /^#[0-9A-F]{3,8}$/i.test(l.valor)) continue;
    pedacos.push(l.tipo === "texto" ? `${l.rotulo}: ${l.valor}` : `${l.rotulo}: ${l.valor}`);
  }
  if (arteEnviada) pedacos.unshift("Sua foto");
  return pedacos.slice(0, 4);
}
