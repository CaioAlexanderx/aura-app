import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

/**
 * Banner da categoria — a tira da home.
 *
 * SÓ AS RAÍZES têm banner: a tira mostra o primeiro nível e mais nada,
 * então oferecer o campo numa subcategoria seria pedir trabalho que não
 * aparece em lugar nenhum. Quem decide é a tela; este hook só sobe.
 */

/** O mesmo teto do resto do painel. Acima disso a loja fica lenta. */
export const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/**
 * A medida pedida NAO mora aqui: mora em specsDeImagem.ts, junto das
 * outras. Duas fontes e como o painel passa a pedir 1600x900 e a loja a
 * desenhar outra coisa.
 *
 * E nao BLOQUEAMOS fora da medida — a lojista tira foto no celular, e
 * recortar por ela e pior que aceitar e enquadrar no `cover`.
 */

export type ResultadoUpload = {
  categoria: { id: string; name: string; banner_url: string };
};

export function useBannerDeCategoria() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const subir = useMutation({
    mutationFn: ({ categoriaId, content, content_type }: {
      categoriaId: string; content: string; content_type: string;
    }) =>
      request<ResultadoUpload>(
        `/companies/${cid}/digital-channel/upload-image?type=categoria&categoria_id=${encodeURIComponent(categoriaId)}`,
        { method: "POST", body: { content, content_type } }
      ),
    onSuccess: () => {
      // A árvore carrega banner_url; sem invalidar, a miniatura só
      // apareceria no próximo carregamento da tela.
      qc.invalidateQueries({ queryKey: ["productCategories"] });
      qc.invalidateQueries({ queryKey: ["categoryTree"] });
      toast.success("Banner da categoria enviado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar o banner"),
  });

  const remover = useMutation({
    mutationFn: (categoriaId: string) =>
      request(`/companies/${cid}/product-categories/${categoriaId}`, {
        method: "PATCH",
        body: { banner_url: null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["productCategories"] });
      qc.invalidateQueries({ queryKey: ["categoryTree"] });
      toast.success("Banner removido");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  /**
   * Abre o seletor do sistema e sobe. Só web — é onde o painel roda.
   *
   * O input é criado, usado e REMOVIDO: deixá-lo no DOM acumula um por
   * clique, e o próximo change dispara em todos.
   */
  function escolherEEnviar(categoriaId: string, aoTerminar?: () => void) {
    if (Platform.OS !== "web") return;
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.style.cssText = "position:fixed;top:-100px;left:-100px;opacity:0";
      document.body.appendChild(input);
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        try { document.body.removeChild(input); } catch {}
        if (!file) { aoTerminar?.(); return; }
        if (file.size > TAMANHO_MAXIMO) {
          toast.error("Imagem muito grande (máx. 5MB)");
          aoTerminar?.();
          return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = String(e.target?.result || "").split(",")[1];
          if (!base64) { aoTerminar?.(); return; }
          try {
            await subir.mutateAsync({ categoriaId, content: base64, content_type: file.type });
          } finally {
            aoTerminar?.();
          }
        };
        reader.readAsDataURL(file);
      });
      input.click();
    } catch {
      aoTerminar?.();
    }
  }

  return { escolherEEnviar, remover, enviando: subir.isPending };
}
