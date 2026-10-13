// ============================================================
// AURA. — Estoque › O que vai faltar (13/10/2026)
//
// GET /companies/:id/estoque/ruptura?ate=YYYY-MM-DD&janela=7..90&escopo=grupo
// (Aura-backend#814, src/routes/estoqueRuptura.js).
//
// Loja ou consolidado: o backend decide pelo token (consolidated_view) ou
// por `escopo=grupo`. No consolidado o :id é qualquer loja do grupo — o
// hook manda a principal. Só leitura: nada é gravado.
//
// Contrato exato nas fixtures do backend: tests/fixtures/estoque/
// ruptura.json (loja) e ruptura.grupo.json (consolidado).
// ============================================================
import { request } from "@/services/api";

export type RupturaLoja = { company_id: string; nome: string };

export type RupturaItem = {
  product_id: string;
  variant_id: string | null;
  nome: string;
  variante: string | null;
  codigo: string | null;
  unidade: string | null;
  /** Loja dona do estoque. No consolidado é o que diferencia as linhas. */
  loja?: RupturaLoja | null;
  /** Estoque de grupo: UMA linha, todas as lojas baixam dela. */
  compartilhado?: boolean;
  estoque: number;
  preco: number;
  vendas_na_janela: number;
  dias_com_loja_aberta: number;
  ultima_venda: string | null;
  ritmo_diario: number;
  dias_ate_acabar: number;
  /** 'YYYY-MM-DD' */
  data_prevista: string;
  faltara: boolean;
  demanda_ate_a_data: number;
  unidades_faltantes: number;
  /** Quanto comprar, já com a folga de 20%. */
  sugestao_compra: number;
  valor_em_risco: number;
};

export type RupturaResumo = {
  itens_com_venda: number;
  itens_em_risco: number;
  unidades_faltantes: number;
  valor_em_risco: number;
  sugestao_total: number;
  primeira_ruptura: string | null;
  zerados: number;
  top?: RupturaItem[];
};

export type RupturaResposta = {
  hoje: string;
  ate: string;
  janela_dias: number;
  janela?: { de: string; ate: string };
  folga_pct?: number;
  escopo: "loja" | "grupo";
  empresas: string[];
  itens: RupturaItem[];
  zerados: RupturaItem[];
  resumo: RupturaResumo;
};

export type RupturaParametros = {
  /** 'YYYY-MM-DD'. Ausente: o backend assume 30/11 (ou hoje+30 depois dele). */
  ate?: string;
  janela?: number;
  /** "grupo" força o consolidado; a loja sozinha é o padrão. */
  escopo?: "grupo";
};

export const estoqueRupturaApi = {
  get: function (companyId: string, params: RupturaParametros = {}): Promise<RupturaResposta> {
    const qs: string[] = [];
    if (params.ate) qs.push("ate=" + encodeURIComponent(params.ate));
    if (params.janela) qs.push("janela=" + encodeURIComponent(String(params.janela)));
    if (params.escopo) qs.push("escopo=" + encodeURIComponent(params.escopo));
    return request<RupturaResposta>(
      "/companies/" + companyId + "/estoque/ruptura" + (qs.length ? "?" + qs.join("&") : ""),
      { retry: 1 }
    );
  },
};
