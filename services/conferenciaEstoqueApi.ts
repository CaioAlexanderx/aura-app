// ============================================================
// AURA. — Conferência de estoque: começar e contar (p-108, entrega B)
//
// Rotas do backend (contrato p-108), :id = a loja que está sendo conferida:
//   POST   /companies/:id/estoque/conferencias                 criar
//   GET    /companies/:id/estoque/conferencias                 listar
//   GET    /companies/:id/estoque/conferencias/:countId        obter
//   PUT    /companies/:id/estoque/conferencias/:countId/itens  registrar item
//   DELETE /companies/:id/estoque/conferencias/:countId/itens/:itemId
//   DELETE /companies/:id/estoque/conferencias/:countId        descartar
//
// Diferenças, aplicar, desfazer e histórico moram em
// services/conferenciaEstoqueResultadoApi.ts (entrega C).
//
// Antes da migration rodar, as rotas respondem 503 MIGRATION_PENDING; antes
// do backend ir ao ar, 404. `lerErroDaConferencia` transforma os dois numa
// mensagem gentil, e a tela não mostra código HTTP.
// ============================================================
import { request } from "@/services/api";

export type TipoDeEscopo = "loja_toda" | "categoria" | "com_estoque";

export type EscopoConferencia = {
  tipo: TipoDeEscopo;
  category_ids?: string[];
};

export type StatusConferencia = "rascunho" | "aplicada" | "desfeita" | "descartada";

export type Conferencia = {
  id: string;
  numero: number | string;
  status: StatusConferencia;
  escopo: EscopoConferencia;
  as_cegas: boolean;
  motivo?: string | null;
  criada_em?: string | null;
  created_at?: string | null;
  aplicada_em?: string | null;
  desfeita_em?: string | null;
  pode_desfazer_ate?: string | null;
  itens_contados?: number | null;
  faltam?: number | null;
  sobram?: number | null;
  batem?: number | null;
  criada_por_nome?: string | null;
};

export type ItemConferencia = {
  id: string;
  product_id: string;
  variant_id: string | null;
  nome: string;
  variante?: string | null;
  codigo?: string | null;
  contado: number | string;
  contado_em?: string | null;
};

export type RespostaConferencia = {
  conferencia: Conferencia;
  itens: ItemConferencia[];
  escopo_total?: number | null;
  transferencias?: any[];
};

export type ModoDeRegistro = "somar" | "definir";

export type RegistroDeItem = {
  product_id: string;
  variant_id?: string | null;
  quantidade: number;
  modo: ModoDeRegistro;
};

export type NovaConferencia = {
  escopo: EscopoConferencia;
  as_cegas?: boolean;
  motivo?: string | null;
};

function base(companyId: string): string {
  return "/companies/" + companyId + "/estoque/conferencias";
}

function qs(params: Record<string, string | number | undefined | null>): string {
  var partes: string[] = [];
  Object.keys(params).forEach(function (k) {
    var v = params[k];
    if (v === undefined || v === null || v === "") return;
    partes.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  });
  return partes.length ? "?" + partes.join("&") : "";
}

/** O GET / pode vir como lista pura ou embrulhada; a tela sempre recebe a lista. */
export function lerListaDeConferencias(r: any): Conferencia[] {
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r.conferencias)) return r.conferencias;
  if (r && Array.isArray(r.itens)) return r.itens;
  return [];
}

/** O PUT itens devolve o item (direto ou em { item }). */
export function lerItemRegistrado(r: any): ItemConferencia | null {
  var it = r && r.item ? r.item : r;
  return it && typeof it.id === "string" ? it : null;
}

export const conferenciaEstoqueApi = {
  /** Sem retry: um POST repetido abriria duas conferências. */
  criar: function (companyId: string, nova: NovaConferencia) {
    return request<{ conferencia: Conferencia }>(base(companyId), {
      method: "POST",
      body: { escopo: nova.escopo, as_cegas: nova.as_cegas !== false, motivo: nova.motivo || null },
      retry: 0,
    });
  },
  listar: async function (companyId: string, filtro: { limit?: number; before?: string | null } = {}) {
    var r = await request<any>(base(companyId) + qs({ limit: filtro.limit, before: filtro.before }), { retry: 1 });
    return lerListaDeConferencias(r);
  },
  obter: function (companyId: string, countId: string) {
    return request<RespostaConferencia>(base(companyId) + "/" + encodeURIComponent(countId), { retry: 1, timeout: 20000 });
  },
  /**
   * Sem retry automático: quem reenvia é a fila da tela (utils/
   * conferenciaContagem.ts), que manda sempre "definir" com o total da
   * linha, para um reenvio nunca contar duas vezes.
   */
  registrarItem: function (companyId: string, countId: string, registro: RegistroDeItem) {
    return request<any>(base(companyId) + "/" + encodeURIComponent(countId) + "/itens", {
      method: "PUT",
      body: {
        product_id: registro.product_id,
        variant_id: registro.variant_id || null,
        quantidade: registro.quantidade,
        modo: registro.modo,
      },
      retry: 0,
      timeout: 15000,
    });
  },
  removerItem: function (companyId: string, countId: string, itemId: string) {
    return request<any>(base(companyId) + "/" + encodeURIComponent(countId) + "/itens/" + encodeURIComponent(itemId), {
      method: "DELETE",
      retry: 0,
      timeout: 15000,
    });
  },
  descartar: function (companyId: string, countId: string) {
    return request<any>(base(companyId) + "/" + encodeURIComponent(countId), { method: "DELETE", retry: 0 });
  },
};

// ── Erros ─────────────────────────────────────────────────

export type TipoDeErro =
  | "em_preparo"   // 503 MIGRATION_PENDING ou 404 (backend ainda sem a rota)
  | "rede"         // sem conexão, timeout ou erro do nosso servidor: tenta de novo
  | "recusado"     // 409: o servidor não aceita este registro (ex.: produto do grupo)
  | "sem_permissao"
  | "nao_encontrada" // 404 da própria conferência (ou do item)
  | "outro";

export type ErroDaConferencia = { tipo: TipoDeErro; mensagem: string };

export const MSG_EM_PREPARO =
  "A conferência de estoque está quase pronta por aqui. Assim que ela chegar à sua loja, você começa por esta tela. Nada do seu estoque mudou.";
export const MSG_REDE =
  "Sem conexão agora. O que você contar fica guardado aqui e vai sozinho quando a internet voltar.";
export const MSG_SEM_PERMISSAO =
  "Seu acesso não inclui a conferência de estoque. Peça para quem cuida da loja liberar o Estoque para você.";

export function codigoDoErro(e: any): string | null {
  return (e && e.data && e.data.code) || null;
}

/** Classifica o erro e devolve um texto para a tela, sem código HTTP. */
export function lerErroDaConferencia(e: any): ErroDaConferencia {
  var status = e && typeof e.status === "number" ? e.status : 0;
  var codigo = codigoDoErro(e);
  var texto = (e && e.data && typeof e.data.error === "string" && e.data.error) || "";
  if (codigo === "MIGRATION_PENDING") return { tipo: "em_preparo", mensagem: MSG_EM_PREPARO };
  // 404 da rota que ainda não existe (catch-all do backend: "Rota nao
  // encontrada", ou corpo vazio). 404 com outro texto é da conferência.
  if (status === 404) {
    if (!texto || /rota n[aã]o encontrada/i.test(texto)) return { tipo: "em_preparo", mensagem: MSG_EM_PREPARO };
    return { tipo: "nao_encontrada", mensagem: "Não achei esta conferência. Ela pode ter sido descartada." };
  }
  if (status === 409) {
    return { tipo: "recusado", mensagem: texto || "Este item não pode entrar nesta conferência." };
  }
  if (status === 403) return { tipo: "sem_permissao", mensagem: texto || MSG_SEM_PERMISSAO };
  if (status === 0 || (e && e.isNetworkError) || status >= 500 || status === 429) {
    return { tipo: "rede", mensagem: MSG_REDE };
  }
  return { tipo: "outro", mensagem: texto || (e && e.message) || "Não deu certo agora. Tente de novo em instantes." };
}
