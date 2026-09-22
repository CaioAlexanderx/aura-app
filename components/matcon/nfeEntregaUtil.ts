// ============================================================
// AURA. — Matcon: NF-e que nasce da entrega (M2 — fiscal do Simples)
//
// 22/09/2026. Funções puras, sem React — usadas por
// components/matcon/EmitirNfeEntregaSheet.tsx e testadas isoladas em
// __tests__/nfeEntregaUtil.test.ts.
//
// Casamento item×produto: `deliveries.items[]` (docs/CONTRACT_MATCON.md
// §M1/§M2) agora carrega `product_id` (da sale_item) e `unit_price` (preço
// DA VENDA, não o preço atual do cadastro). Casa por `product_id` quando
// ele existir; só cai pro nome normalizado (trim + lowercase) quando
// `product_id` é null — item avulso de venda, sem produto no catálogo.
// Item sem produto casado fica de fora das contas de peso/CEST (não tem
// como confirmar) mas SEMPRE entra na nota com `item.unit_price` (preço
// já é da venda, não depende do produto).
// ============================================================
import type { Delivery, DeliveryItem } from "@/services/matconApi";
import type { EmitBody, NfceEmissionItem, NfeTransporte } from "@/services/nfceApi";
import type { Product } from "@/components/screens/estoque/types";

/** Como o vendedor respondeu as três frases da folha "Como vai o material". */
export type NfeEntregaForm = {
  /** Nome de quem recebe a nota — vem da entrega, editável na folha. */
  customerName: string;
  /** CPF ou CNPJ do destinatário, só dígitos (a entrega não carrega isso). */
  customerDoc: string;
  /** "Entrego com meu caminhão" — true = frete próprio (modalidade 0). */
  fretePropio: boolean;
  /** Só lido quando fretePropio=false: quem leva. */
  quemRetira: "cliente" | "transportadora";
  /** Só lido quando quemRetira="transportadora". */
  transportadoraNome: string;
  /** "São [3] volumes" — texto editável (aceita vazio). */
  volumes: string;
  /** "...com [412] kg." — texto editável, pré-preenchido por pesoDaEntrega. */
  pesoKg: string;
  /** Placa do veículo — opcional. */
  placa: string;
  /** UF da placa — opcional. */
  ufPlaca: string;
};

function normalizarNome(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

function apenasDigitos(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

/**
 * Casa um item da entrega com o produto do catálogo: por `product_id`
 * quando o item traz um (fonte de verdade — dois produtos podem ter o
 * mesmo nome); só cai pro nome normalizado quando `product_id` é null
 * (item avulso, sem cadastro).
 */
export function encontrarProdutoDoItem(item: { product_id?: string | null; name: string }, products: Product[]): Product | null {
  if (item.product_id != null) {
    return products.find((p) => p.id === item.product_id) || null;
  }
  const alvo = normalizarNome(item.name);
  if (!alvo) return null;
  return products.find((p) => normalizarNome(p.name) === alvo) || null;
}

/**
 * Peso da entrega, em kg, 3 casas decimais — soma `weight_kg × quantity`
 * só dos itens cujo produto correspondente tem peso cadastrado. Item sem
 * produto casado ou sem peso é ignorado (nunca vira NaN nem derruba a
 * soma dos outros).
 */
export function pesoDaEntrega(items: DeliveryItem[] | null | undefined, products: Product[]): number {
  let total = 0;
  for (const item of items || []) {
    const produto = encontrarProdutoDoItem(item, products);
    const peso = produto?.weightKg;
    if (peso == null || !(peso > 0)) continue;
    const qty = Number(item.quantity) || 0;
    total += peso * qty;
  }
  return Math.round(total * 1000) / 1000;
}

/**
 * Itens da entrega cujo produto correspondente existe e está sem CEST —
 * é a lista que alimenta o aviso âmbar "N itens sem código fiscal" e o
 * selo "SEM CÓDIGO" por linha. Item sem produto casado não entra (não dá
 * pra afirmar que falta CEST de um produto que a folha não identificou).
 */
export function itensSemCest(items: DeliveryItem[] | null | undefined, products: Product[]): DeliveryItem[] {
  return (items || []).filter((item) => {
    const produto = encontrarProdutoDoItem(item, products);
    if (!produto) return false;
    return !(produto.cest || "").trim();
  });
}

/** Form inicial da folha: nome da entrega, frete próprio ligado (o padrão de 9 em 10 entregas do bairro), peso somado dos itens que têm peso, 1 volume por item da entrega. */
export function formInicialNfeEntrega(delivery: Delivery, products: Product[]): NfeEntregaForm {
  const peso = pesoDaEntrega(delivery.items, products);
  return {
    customerName: delivery.customer_name || "",
    customerDoc: "",
    fretePropio: true,
    quemRetira: "cliente",
    transportadoraNome: "",
    volumes: String(Math.max(1, (delivery.items || []).length)),
    pesoKg: peso > 0 ? String(peso) : "",
    placa: "",
    ufPlaca: "",
  };
}

/**
 * Monta o EmitBody da NF-e da entrega: itens (product_id e unit_price do
 * próprio item — preço da venda; cest/origem/icms_st_paid do produto
 * casado), vínculo com a entrega/venda e o bloco de transporte traduzido
 * da frase do form.
 * modalidade: fretePropio → 0; desligado + "cliente retira" → 9;
 * desligado + "transportadora" → 1 (nome vai em transportadora_nome).
 */
export function montarEmitBody(delivery: Delivery, products: Product[], form: NfeEntregaForm): EmitBody {
  const items: NfceEmissionItem[] = (delivery.items || []).map((item) => {
    const produto = encontrarProdutoDoItem(item, products);
    return {
      product_id: item.product_id ?? produto?.id ?? null,
      name: item.name,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || undefined,
      unit_price: Number(item.unit_price) || 0,
      cest: produto?.cest ?? null,
      origem: produto?.origem ?? null,
      icms_st_paid: produto?.icmsStPaid ?? null,
    };
  });

  const doc = apenasDigitos(form.customerDoc);
  const isCnpj = doc.length > 11;

  const modalidade: 0 | 1 | 9 = form.fretePropio ? 0 : form.quemRetira === "cliente" ? 9 : 1;
  const transportadoraNome = form.fretePropio
    ? "própria"
    : form.quemRetira === "transportadora"
      ? form.transportadoraNome.trim() || null
      : null;

  const volumesNum = parseInt(String(form.volumes).trim(), 10);
  const pesoNum = Number(String(form.pesoKg).trim().replace(",", "."));

  const transporte: NfeTransporte = {
    modalidade,
    volumes: Number.isFinite(volumesNum) && volumesNum > 0 ? volumesNum : null,
    peso_bruto_kg: Number.isFinite(pesoNum) && pesoNum > 0 ? pesoNum : null,
    peso_liquido_kg: Number.isFinite(pesoNum) && pesoNum > 0 ? pesoNum : null,
    transportadora_nome: transportadoraNome,
    placa: form.placa.trim() || null,
    uf_placa: form.ufPlaca.trim() || null,
  };

  return {
    items,
    tipo: "nfe",
    customer_name: form.customerName.trim() || delivery.customer_name || undefined,
    customer_cpf: doc && !isCnpj ? doc : undefined,
    recipient_cnpj: doc && isCnpj ? doc : undefined,
    sale_id: delivery.sale_id,
    delivery_id: delivery.id,
    transporte,
  };
}
