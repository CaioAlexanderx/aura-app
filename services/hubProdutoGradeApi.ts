// ============================================================
// hubProdutoGradeApi — "Produto com fotos e tamanhos" na conversa aberta.
//
// Isolado de hubApi porque o contrato do backend (contrato-produto-grade.md)
// ainda estava sendo fechado quando a tela foi feita. Só este arquivo conhece
// os caminhos e os formatos; se o contrato mudar, muda aqui.
//
//   GET  /companies/:cid/hub/catalogo/:pid/grade
//   POST /companies/:cid/hub/conversations/:conv/send   { type: "produto_grade", ... }
//   POST /companies/:cid/hub/conversations/:conv/reservar-pix
//
// O app manda ids e a escolha; o texto, as fotos e os botões são montados no
// servidor a partir do cadastro (product_images, product_variants.image_url,
// product_variant_values com estoque > 0). Quantidade nunca vai à cliente.
// ============================================================
import { request } from "@/services/api";

export interface GradeFoto { id: string; url: string }
export interface GradeTamanho { label: string; qty: number }
export interface GradeCor {
  /** Chave estável da cor (a mesma que volta no envio). */
  key: string;
  label: string;
  /** #rrggbb quando a cor tem. */
  hex: string | null;
  fotos: GradeFoto[];
  tamanhos: GradeTamanho[];
}
export interface HubProdutoGrade {
  product: { id: string; name: string; price: number; image_url: string | null };
  /** Produto sem cor: uma cor só, sem rótulo. */
  tem_cor: boolean;
  cores: GradeCor[];
  /** Galeria do produto (vale para a cor que não tem foto própria). */
  fotos: GradeFoto[];
}

export interface EnvioGradeBody {
  type: "produto_grade";
  product_id: string;
  color_key: string | null;
  photo_ids: string[];
  /** Pergunta "Qual tamanho?" com botões de resposta. */
  perguntar_tamanho: boolean;
}

export interface ReservaPixBody { product_id: string; color_key: string | null; size: string }

export const hubProdutoGradeApi = {
  grade: (companyId: string, productId: string) =>
    request<HubProdutoGrade>(`/companies/${companyId}/hub/catalogo/${productId}/grade`),
  enviar: (companyId: string, convId: string, body: EnvioGradeBody) =>
    request<{ ok: boolean; wamid: string | null }>(
      `/companies/${companyId}/hub/conversations/${convId}/send`, { method: "POST", body, retry: 0 }
    ),
  reservarEMandarPix: (companyId: string, convId: string, body: ReservaPixBody) =>
    request<{ ok: boolean }>(
      `/companies/${companyId}/hub/conversations/${convId}/reservar-pix`, { method: "POST", body, retry: 0 }
    ),
};
