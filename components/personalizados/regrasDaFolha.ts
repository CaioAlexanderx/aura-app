// ============================================================
// AURA. — Personalizados: regras da folha "Recolher a arte e o texto" (p-176)
//
// O Caixa do Negócio não pede o texto nem a arte na hora da venda. A venda
// de peça personalizável cai em "Aguardando personalização" e a lojista
// registra depois, por esta folha, a arte e o texto de cada peça.
//
// Contrato (backend#1051, p-177):
//   GET  /companies/:id/studio/orders/:oid/personalizacao
//        { order, itens: [{ id, product_name, quantity, is_personalizable,
//          customization_config, customization, tem_personalizacao }],
//          faltam: [ids] }
//   POST a mesma rota, { itens: [{ id, customization }], avancar }
//        customization é o objeto plano { [field.id]: valor }; a arte é a
//        URL do POST /studio/upload-mockup.
//        422 FALTA_PERSONALIZACAO com `faltam`: nada foi gravado.
//
// Aqui ficam só as regras, sem tela. A folha: FolhaDeRecolher.tsx.
// ============================================================
import type { CustomizationField, ItemDaPersonalizacao } from "@/services/studioApi";

export type Valores = Record<string, Record<string, any>>;

/**
 * Campo de reserva para a peça personalizável sem campos cadastrados
 * (produto antigo ou config apagada). O backend, sem os campos do produto,
 * conta qualquer texto: com ele a lojista não fica presa.
 */
export const CAMPO_SEM_CADASTRO: CustomizationField = {
  id: "texto",
  type: "text",
  label: "Texto ou recado da arte",
  required: false,
  config: { max_chars: 300 },
} as CustomizationField;

/** As peças que pedem arte e texto. As outras do pedido não aparecem. */
export function pecasDaFolha(itens: ItemDaPersonalizacao[] | null | undefined): ItemDaPersonalizacao[] {
  return (itens || []).filter((i) => i && i.is_personalizable);
}

/** Os campos que a folha desenha para a peça. */
export function camposDaPeca(item: ItemDaPersonalizacao): CustomizationField[] {
  const campos = item.customization_config?.fields;
  return Array.isArray(campos) && campos.length ? campos : [CAMPO_SEM_CADASTRO];
}

/** O que já está gravado em cada peça, para a folha abrir preenchida. */
export function valoresIniciais(itens: ItemDaPersonalizacao[]): Valores {
  const v: Valores = {};
  for (const i of pecasDaFolha(itens)) {
    v[i.id] = i.customization && typeof i.customization === "object" ? { ...i.customization } : {};
  }
  return v;
}

function preenchido(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "boolean") return false;
  return true;
}

/**
 * A peça tem arte ou texto? A mesma conta do backend (temPersonalizacao):
 * com os campos do produto, um campo do produto preenchido; sem eles,
 * qualquer texto.
 */
export function pecaPreenchida(item: ItemDaPersonalizacao, valores: Record<string, any> | undefined): boolean {
  const v = valores || {};
  const campos = item.customization_config?.fields;
  if (Array.isArray(campos) && campos.length) {
    return campos.some((f) => f && f.id != null && preenchido(v[f.id]));
  }
  return Object.values(v).some((x) => typeof x === "string" && x.trim() !== "");
}

/** Ids das peças ainda sem nada, na ordem do pedido. */
export function pecasQueFaltam(itens: ItemDaPersonalizacao[], valores: Valores): string[] {
  return pecasDaFolha(itens).filter((i) => !pecaPreenchida(i, valores[i.id])).map((i) => i.id);
}

/**
 * O corpo do POST. Só as peças personalizáveis; campo vazio sai do objeto
 * (apagar o texto na folha apaga no pedido, porque o backend troca o objeto
 * inteiro).
 */
export function corpoDoSalvar(
  itens: ItemDaPersonalizacao[],
  valores: Valores,
  avancar: boolean,
): { itens: Array<{ id: string; customization: Record<string, any> }>; avancar: boolean } {
  return {
    itens: pecasDaFolha(itens).map((i) => {
      const limpo: Record<string, any> = {};
      for (const [k, x] of Object.entries(valores[i.id] || {})) {
        if (x === null || x === undefined) continue;
        if (typeof x === "string" && x.trim() === "") continue;
        limpo[k] = x;
      }
      return { id: String(i.id), customization: limpo };
    }),
    avancar,
  };
}

/** O 422 da rota: os ids que faltam. `null` quando o erro é outro. */
export function faltamDoErro(e: any): string[] | null {
  const status = e?.status ?? e?.statusCode;
  const codigo = e?.data?.code;
  if (status !== 422 && codigo !== "FALTA_PERSONALIZACAO") return null;
  const lista = e?.data?.faltam;
  return Array.isArray(lista) ? lista.map(String) : [];
}

/** O nome que a folha usa para a peça: "2 × Caneca com nome". */
export function nomeDaPeca(item: Pick<ItemDaPersonalizacao, "product_name" | "quantity">): string {
  const nome = (item.product_name || "").trim() || "Peça sem nome";
  const q = Number(item.quantity);
  return Number.isFinite(q) && q > 0 ? `${Number.isInteger(q) ? q : String(q).replace(".", ",")} × ${nome}` : nome;
}

function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** "Falta a arte ou o texto de 1 × Caneca e 2 × Camiseta." */
export function fraseDoQueFalta(itens: ItemDaPersonalizacao[], faltam: string[]): string {
  const porId = new Map(itens.map((i) => [String(i.id), i]));
  const nomes = faltam.map((id) => porId.get(String(id))).filter(Boolean).map((i) => nomeDaPeca(i!));
  if (nomes.length === 0) return "Falta a arte ou o texto de alguma peça.";
  return `Falta a arte ou o texto de ${juntar(nomes)}.`;
}

/** Texto do erro que não é o 422, na voz da casa. */
export function mensagemDoErro(e: any, padrao: string): string {
  const codigo = e?.data?.code;
  if (codigo === "MARKETPLACE_USA_OUTRA_ROTA") {
    return "Este pedido veio de um marketplace e a arte dele é recolhida por outra tela.";
  }
  if (codigo === "order_cancelled") return "Este pedido foi cancelado e não volta para a produção.";
  if ((e?.status ?? e?.statusCode) === 404) return "Não achamos este pedido nesta loja.";
  return e?.data?.error || e?.message || padrao;
}
