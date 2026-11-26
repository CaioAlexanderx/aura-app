// useClientesPrevia — 3 clientes reais da loja para a prévia do Editor.
// Crediário: parcelas em aberto. Aniversário e Venda+: os primeiros do corte.
// Qualquer falha devolve lista vazia: o Editor mostra um cliente de exemplo,
// dizendo que é exemplo.
import { useEffect, useState } from "react";
import { creditApi } from "@/services/creditApi";
import { waConfigApi } from "@/services/waConfigApi";
import { clientesDasParcelas, clientesDoCorte, type ClientePrevia } from "@/components/whatsapp/waPreviaClientes";

export function useClientesPrevia(
  companyId: string | null | undefined,
  automatica: "aniversario" | "venda_mais" | "crediario" | string,
  lojaNome: string,
  enabled: boolean = true,
): ClientePrevia[] {
  const [lista, setLista] = useState<ClientePrevia[]>([]);

  useEffect(() => {
    let vivo = true;
    if (!companyId || !enabled) return;
    (async () => {
      try {
        if (automatica === "crediario") {
          const r = await creditApi.listInstallments(companyId, { status: "pending", limit: 12 });
          if (vivo) setLista(clientesDasParcelas(r?.data, lojaNome));
        } else if (automatica === "aniversario" || automatica === "venda_mais") {
          const r = await waConfigApi.getPublico(companyId, automatica);
          if (vivo) setLista(clientesDoCorte(r?.vao, lojaNome));
        }
      } catch {
        if (vivo) setLista([]);
      }
    })();
    return () => { vivo = false; };
  }, [companyId, automatica, lojaNome, enabled]);

  return lista;
}
