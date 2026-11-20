// ============================================================
// AURA. — Em qual loja o produto entra (20/11/2026)
//
// Contrato: side-session-notes/.../empresa-do-produto/contrato.md (B1).
//   - GET  /companies/:id/products/lojas-para-cadastro
//       lojas do mesmo grupo de :id em que a pessoa mexe no estoque.
//       Menos de 2 lojas: o cadastro esconde o campo e não muda nada no
//       que envia. `estoque_unico` (grupo com estoque único, D12): só o
//       aviso, sem caixas de marcar.
//   - POST /companies/:id/products/:pid/lojas
//       copia o produto :pid (da loja :id) para outras lojas do grupo,
//       cada uma com o seu estoque inicial. Idempotente: loja que já tem
//       o par volta `ja_existia`. Responde 200 mesmo com falha parcial.
//
// Marcar 2 lojas cria UM PRODUTO EM CADA LOJA (D1), nunca um produto
// compartilhado: o app nunca manda is_group_shared.
// ============================================================
import { request } from "@/services/api";

export type LimiteDaLoja = { usados: number; maximo: number | null };

export type LojaParaCadastro = {
  company_id: string;
  nome: string;
  ativa: boolean;
  regime?: string | null;
  limite?: LimiteDaLoja | null;
};

export type RespostaLojasParaCadastro = {
  estoque_unico: boolean;
  lojas: LojaParaCadastro[];
};

export type VarianteDaCopia = { variant_id: string; stock_qty: number };

export type LojaDaCopia = {
  company_id: string;
  stock_qty: number;
  variantes?: VarianteDaCopia[];
};

export type PedidoDeCopia = { lojas: LojaDaCopia[] };

export type CodigoErroDaCopia =
  | "BARCODE_EM_USO"
  | "LIMITE_PLANO"
  | "SEM_ACESSO"
  | string;

export type ResultadoDaCopia = {
  company_id: string;
  nome: string;
  status: "criado" | "ja_existia" | "erro";
  product_id: string | null;
  stock_qty: number;
  avisos?: string[];
  erro?: {
    code: CodigoErroDaCopia;
    message: string;
    produto_conflito?: { id: string; name: string } | null;
  } | null;
};

export type RespostaDaCopia = {
  master_sku: string;
  resultados: ResultadoDaCopia[];
};

const base = (cid: string) => "/companies/" + cid + "/products";

export const lojasDoProdutoApi = {
  lojasParaCadastro(companyId: string) {
    return request<RespostaLojasParaCadastro>(base(companyId) + "/lojas-para-cadastro", { retry: 1 });
  },
  // retry 0: repetir é seguro no servidor (idempotente), mas quem repete é
  // a lojista, pelo "Tentar de novo" — nunca a camada de rede sozinha.
  copiarParaLojas(companyId: string, productId: string, body: PedidoDeCopia) {
    return request<RespostaDaCopia>(base(companyId) + "/" + productId + "/lojas", {
      method: "POST", body, retry: 0, timeout: 60000,
    });
  },
};
