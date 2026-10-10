// ============================================================
// AURA. — Comandas do Caixa: o que o Caixa faz com elas (09/10/2026)
//
// Dois movimentos, e nenhum deles é uma venda:
//   · lançar  — o carrinho vai para a comanda N e o balcão fica limpo para
//               o próximo cliente;
//   · cobrar  — o consumo da comanda N volta para o carrinho (com a taxa de
//               serviço, se o operador marcou) e a venda segue como qualquer
//               outra. O useCart guarda qual comanda é e manda `comanda_id`
//               no POST da venda; o backend fecha a comanda junto.
//
// Desistir de cobrar ("Cancelar" no aviso do carrinho) só limpa o carrinho:
// a comanda continua aberta, do jeito que estava.
// ============================================================
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/Toast";
import { comandaApi } from "@/services/comandaApi";
import { chaveDasComandas } from "@/components/screens/pdv/ComandaModals";
import { textoDoErro } from "@/components/screens/pdv/erroNoCaixa";
import { itensParaAComanda, linhasParaOCarrinho, type Comanda, type ItemDoCarrinho } from "@/utils/comanda";
import type { ComandaNoCarrinho } from "@/hooks/useCart";

type ProdutoDoCatalogo = { id: string; price: number; cardPrice?: number | null };

export type UseComandaNoCaixaParams = {
  companyId: string | null | undefined;
  /** pdv_settings.comanda_enabled. */
  enabled: boolean;
  isDemo?: boolean;
  cart: ItemDoCarrinho[];
  comanda: ComandaNoCarrinho | null;
  setComanda: (c: ComandaNoCarrinho | null) => void;
  /** Zera o balcão (carrinho, cliente, desconto, dividido). */
  limpar: () => void;
  addToCart: (p: any) => void;
  setQty: (key: string, qty: number) => void;
  products: ProdutoDoCatalogo[];
};

function fmt(v: number): string {
  return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function useComandaNoCaixa(p: UseComandaNoCaixaParams) {
  const qc = useQueryClient();
  const [showAdicionar, setShowAdicionar] = useState(false);
  const [showFechar, setShowFechar] = useState(false);
  const [lancando, setLancando] = useState(false);

  function recarregarAbertas() {
    if (p.companyId) qc.invalidateQueries({ queryKey: chaveDasComandas(p.companyId) });
  }

  function abrirAdicionar() {
    if (p.cart.length === 0) { toast.info("Adicione produtos antes de mandar para a comanda"); return; }
    if (p.comanda) { toast.info("Este carrinho já é a comanda " + p.comanda.number + ". Finalize ou cancele a cobrança."); return; }
    setShowAdicionar(true);
  }

  function lancar(numero: number) {
    if (!p.companyId || lancando) return;
    if (p.isDemo) { toast.info("Comandas não funcionam na conta de demonstração"); return; }
    const itens = itensParaAComanda(p.cart);
    if (itens.length === 0) return;
    setLancando(true);
    comandaApi.addItems(p.companyId, numero, itens)
      .then(function (r) {
        toast.success(
          (r.opened ? "Comanda " + numero + " aberta" : "Lançado na comanda " + numero) +
          " · total " + fmt(r.comanda.subtotal)
        );
        setShowAdicionar(false);
        p.limpar();
        recarregarAbertas();
      })
      .catch(function (e: any) {
        toast.error(e?.data?.code === "COMANDA_DISABLED"
          ? "As comandas estão desligadas nas configurações do Caixa."
          : textoDoErro(e, "Não deu para lançar na comanda. Tente de novo."));
      })
      .finally(function () { setLancando(false); });
  }

  /** O consumo da comanda vira o carrinho. O que estava no balcão sai: a
   *  venda que fecha a comanda tem que ser a comanda e mais nada. */
  function cobrar(c: Comanda, taxaPct: number) {
    p.limpar();
    linhasParaOCarrinho(c, taxaPct).forEach(function (l) {
      const doCatalogo = p.products.find(function (x) { return x.id === l.key.split("__")[0]; });
      p.addToCart({
        id: l.key, name: l.name, price: l.price, unit: l.unit,
        cardPrice: doCatalogo?.cardPrice ?? null,
        refPrice: doCatalogo ? doCatalogo.price : undefined,
      });
      p.setQty(l.key, l.qty);
    });
    p.setComanda({ id: c.id, number: c.number, feePct: taxaPct });
    setShowFechar(false);
    toast.success("Comanda " + c.number + " no carrinho. Escolha o pagamento e finalize.");
  }

  /** Desiste de cobrar: o carrinho sai, a comanda continua aberta. */
  function cancelarCobranca() {
    const n = p.comanda?.number;
    p.limpar();
    if (n != null) toast.info("A comanda " + n + " continua aberta");
  }

  return {
    enabled: p.enabled,
    showAdicionar, abrirAdicionar, fecharAdicionar: () => setShowAdicionar(false),
    showFechar, abrirFechar: () => setShowFechar(true), fecharFechar: () => setShowFechar(false),
    lancando, lancar, cobrar, cancelarCobranca, recarregarAbertas,
  };
}
