// ============================================================
// AURA. — Comandas do Caixa: API client (09/10/2026)
//
// Rotas /companies/:id/comandas/* (Aura-backend, migration 368). A comanda é
// identificada pelo NÚMERO que a loja usa no cartão. Fechar não tem rota: o
// Caixa cobra o consumo como uma venda e manda `comanda_id` no POST da venda
// (hooks/useCart.ts) — o backend fecha a comanda junto.
// ============================================================
import { request } from "./api";
import type { Comanda, ItemParaAComanda } from "@/utils/comanda";

export type ComandaResumo = {
  id: string;
  number: number;
  /** Nome opcional (17/10, tc-01). Ausente/null = só o número. */
  name?: string | null;
  status: string;
  opened_at: string;
  items_count: number;
  subtotal: number;
};

const base = (companyId: string) => "/companies/" + companyId + "/comandas";

export const comandaApi = {
  /** Comandas abertas, com quanto cada uma já consumiu. */
  listOpen: function (companyId: string) {
    return request<{ comandas: ComandaResumo[] }>(base(companyId), { retry: 1 });
  },
  /** A comanda ABERTA com este número (404 se não houver). */
  get: function (companyId: string, number: number) {
    return request<{ comanda: Comanda }>(base(companyId) + "/" + number);
  },
  /** Lança consumo. Abre a comanda se o número ainda não estiver aberto.
   *  `name` (opcional, 17/10): grava na abertura; com a comanda já aberta,
   *  troca o nome. Sem `name` o corpo é o de sempre e o nome fica como está. */
  addItems: function (companyId: string, number: number, items: ItemParaAComanda[], name?: string) {
    return request<{ comanda: Comanda; opened: boolean; added: number }>(
      base(companyId) + "/" + number + "/items",
      { method: "POST", body: name ? { items: items, name: name } : { items: items }, retry: 0 }
    );
  },
  removeItem: function (companyId: string, number: number, itemId: string) {
    return request<{ comanda: Comanda }>(base(companyId) + "/" + number + "/items/" + itemId, { method: "DELETE", retry: 0 });
  },
  cancel: function (companyId: string, number: number) {
    return request<{ ok: boolean; number: number }>(base(companyId) + "/" + number + "/cancel", { method: "POST", retry: 0 });
  },
};
