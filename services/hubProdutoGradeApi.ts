// ============================================================
// hubProdutoGradeApi — "Produto com fotos e tamanhos" na conversa aberta.
// Contrato: Aura-backend #1142 (contrato-produto-grade.md).
//
//   GET  /companies/:cid/hub/produtos/:pid/grade
//   POST /companies/:cid/hub/conversations/:conv/send         { type: "produto_grade", ... }
//   POST /companies/:cid/hub/conversations/:conv/reservar-pix { message_id }
//
// O app manda a escolha; o texto, as fotos e os botões são montados no
// servidor. Quantidade nunca chega: a grade traz só os tamanhos com peça, com
// `ultimo` quando sobra 1.
// ============================================================
import { request } from "@/services/api";

export interface GradeFoto { url: string; thumb_url?: string | null }
export interface GradeTamanho { tamanho: string; variant_id: string; preco: number; ultimo: boolean }
/** Grade inteira da cor: `disponivel: false` = sem peça (risca e não deixa escolher). */
export interface GradeTamanhoDaGrade { tamanho: string; disponivel: boolean; ultimo: boolean }
export interface GradeCor {
  /** Hex sem # (ou slug do nome). É o `cor` do envio. */
  chave: string;
  /** null = o produto não tem cor. */
  nome: string | null;
  hex: string | null;
  preco: number;
  foto: string | null;
  fotos: GradeFoto[];
  disponivel: boolean;
  /** Só os tamanhos com peça livre. */
  tamanhos: GradeTamanho[];
  /** Grade inteira em ordem (com os sem peça). Servidor antigo não manda: o painel cai para `tamanhos`. */
  todos_tamanhos?: GradeTamanhoDaGrade[];
}
export interface HubProdutoGrade {
  produto: { id: string; nome: string; preco: number; compartilhado?: boolean };
  /** Galeria principal do produto. */
  fotos: GradeFoto[];
  cores: GradeCor[];
  /** false: produto sem variações (cores = []). */
  tem_grade: boolean;
}

export interface EnvioGradeBody {
  type: "produto_grade";
  product_id: string;
  cor?: string;
  /** URLs que a rota da grade devolveu (até 5). */
  fotos: string[];
  perguntar_tamanho: boolean;
}

export const hubProdutoGradeApi = {
  grade: (companyId: string, productId: string) =>
    request<HubProdutoGrade>(`/companies/${companyId}/hub/produtos/${productId}/grade`),
  enviar: (companyId: string, convId: string, body: EnvioGradeBody) =>
    request<{ ok: boolean; wamid: string | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/send`, { method: "POST", body, retry: 0 }
    ),
  reservarEMandarPix: (companyId: string, convId: string, messageId: string) =>
    request<{ ok: boolean; order_id: string; order_number?: number; total: number; wamid: string | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/reservar-pix`, { method: "POST", body: { message_id: messageId, quantity: 1 }, retry: 0 }
    ),
};

/** Sugestão gravada pelo servidor em `metadata.sugestao` da mensagem da cliente. */
export interface SugestaoReserva {
  /** `mandar_pix`: só o Pix (Pedido desligado); `reservar_e_mandar_pix`: reserva pelo pedido do balcão. */
  tipo: "reservar_e_mandar_pix" | "mandar_pix";
  rotulo?: string;
  /** O servidor decide: false = não reserva, só manda o Pix. Ausente (servidor antigo): vale a regra do app. */
  reserva?: boolean;
  product_id: string; variant_id: string; tamanho: string; quantidade: number; preco: number;
  nome?: string; cor?: string | null;
  estado: "pendente" | "sem_estoque" | "feita";
  order_id?: string;
}

/** Frase clara para cada recusa da reserva (409/403/422 do servidor). */
export function mensagemDaReserva(e: any, nome: string): string {
  const cod = String(e?.data?.code || e?.code || "");
  if (cod === "JA_RESERVADO" || e?.status === 409 && /reserv/i.test(String(e?.message))) return `Esta peça já está reservada para ${nome}. O Pix já foi enviado.`;
  if (cod === "JANELA_FECHADA") return "A conversa fechou. Espere a cliente escrever de novo para reservar.";
  if (cod === "SEM_PIX" || cod === "PIX_INVALIDO") return "A loja ainda não tem uma chave Pix válida. Cadastre a chave e tente de novo.";
  if (cod === "PEDIDO_SEM_SALDO") return e?.message || "Não há mais peça livre desse tamanho.";
  return e?.message || "Não foi possível reservar.";
}

export const ehReservaNaoLiberada = (e: any): boolean => e?.status === 403 && String(e?.data?.code || e?.code || "") === "PEDIDO_NAO_LIBERADO";

/** A sugestão reserva? O servidor é a fonte (`reserva` ou `tipo`); sem isso, a regra do app (trava do Pedido). */
export function sugestaoReserva(sg: Pick<SugestaoReserva, "tipo" | "reserva">, regraDoApp: boolean): boolean {
  if (typeof sg.reserva === "boolean") return sg.reserva;
  if (sg.tipo === "mandar_pix") return false;
  return regraDoApp;
}
