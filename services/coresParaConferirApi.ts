// ============================================================
// AURA. — Nomes de cor para conferir (CP5 da revisão de cores, 14/11/2026)
// Backend: src/routes/productColorNames.js (Aura-backend#1030).
// ============================================================
import { request } from "@/services/api";

export type ItemDoGrupo = { product_id: string; product_name: string; company_id: string; hex: string };

export type GrupoParaConferir = {
  chave: string;
  /** "AZUL ESCUR" — o que está gravado (ou no sufixo). */
  pedaco: string;
  /** cortado = 10 letras ou mais; maiusculo = inteiro em maiúsculas. */
  tipo: "cortado" | "maiusculo";
  hex: string;
  /** O que sai hoje no Caixa, na nota, no cupom e na vitrine. */
  hoje: string;
  variantes: number;
  produtos: number;
  itens: ItemDoGrupo[];
  sugestao: { nome: string; fonte: "loja" | "paleta" | "caixa_de_frase" } | null;
  opcoes: string[];
  /** Só estes entram no "Confirmar todas" (decisão 4 do Caio). */
  unica_da_paleta: boolean;
};

export type CoresParaConferir = { grupos: GrupoParaConferir[]; total_grupos: number; total_variantes: number };

export var coresParaConferirApi = {
  listar: function(companyId: string) {
    return request<CoresParaConferir>("/companies/" + companyId + "/products/cores-para-conferir", { retry: 1 });
  },
  confirmar: function(companyId: string, itens: Array<{ product_id: string; hex: string; nome: string }>) {
    return request<{ variantes: number; itens: number; recusados: number }>(
      "/companies/" + companyId + "/products/cores-para-conferir/confirmar",
      { method: "POST", body: { itens: itens }, retry: 0 }
    );
  },
};
