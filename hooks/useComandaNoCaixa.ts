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
//
// 17/10/2026 (tc-02): o painel das abertas (ComandasAbertasPanel) entra por
// "Comandas (N)" no rodapé. "Cobrar" dele abre a conferência já com a
// comanda; "Lançar mais" abre o modal de lançar já com o número.
//
// 17/10/2026 (tc-04): "Dividir a conta" no modal de cobrar. O consumo vira
// o carrinho do mesmo jeito e o dividido do Caixa já nasce com uma parte por
// pessoa (`dividir`, o dividirPagamento do useCart): uma venda só, com um
// pagamento por pessoa.
//
// "Alguns itens" (mesmo card): só os itens marcados viram o carrinho, e a
// venda leva os ids deles (ComandaNoCarrinho.itemIds/itemQty). A comanda
// continua aberta com o resto. Com o backend que sabe cobrar em partes
// (`parcial` na comanda), "Cobrar tudo" também manda os ids que estavam na
// tela: item lançado por outro caixa nesse meio tempo fica na comanda em vez
// de ser fechado sem ter sido cobrado.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/Toast";
import { comandaApi } from "@/services/comandaApi";
import { chaveDasComandas } from "@/components/screens/pdv/ComandaModals";
import { textoDoErro } from "@/components/screens/pdv/erroNoCaixa";
import {
  itensParaAComanda, linhasParaOCarrinho, nomeDaComanda, rotuloDaComanda, cobraEmPartes, comandaSoComOsItens, itensCobrados,
  type Comanda, type ItemDoCarrinho, type OpcoesDaCobranca, type ParteDaConta,
} from "@/utils/comanda";
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
  /** Liga o dividido do carrinho com estas partes (useCart.dividirPagamento).
   *  Sem ele, "Dividir a conta" cobra como "Cobrar tudo". */
  dividir?: (partes: ParteDaConta[]) => void;
};


function fmt(v: number): string {
  return "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function useComandaNoCaixa(p: UseComandaNoCaixaParams) {
  const qc = useQueryClient();
  const [showAdicionar, setShowAdicionar] = useState(false);
  const [showFechar, setShowFechar] = useState(false);
  const [lancando, setLancando] = useState(false);
  // Painel das abertas (17/10, tc-02). Dele saem "Lançar mais" e "Cobrar",
  // que abrem os modais de sempre já com o número da comanda escolhida.
  const [showPainel, setShowPainel] = useState(false);
  const [numeroParaLancar, setNumeroParaLancar] = useState<number | null>(null);
  const [numeroParaCobrar, setNumeroParaCobrar] = useState<number | null>(null);

  function recarregarAbertas() {
    if (p.companyId) qc.invalidateQueries({ queryKey: chaveDasComandas(p.companyId) });
  }

  // O carrinho largou a comanda (venda feita, cobrança cancelada): a
  // contagem do botão "Comandas" tem que acompanhar.
  const comandaId = p.comanda ? p.comanda.id : null;
  const comandaAnterior = useRef<string | null>(comandaId);
  useEffect(function () {
    if (comandaAnterior.current && !comandaId) recarregarAbertas();
    comandaAnterior.current = comandaId;
  }, [comandaId]);

  /** Pode mandar o carrinho para uma comanda? Senão avisa e diz não. */
  function podeLancar(): boolean {
    if (p.cart.length === 0) { toast.info("Adicione produtos antes de mandar para a comanda"); return false; }
    if (p.comanda) { toast.info("Este carrinho já é a comanda " + rotuloDaComanda(p.comanda.number, p.comanda.name) + ". Finalize ou cancele a cobrança."); return false; }
    return true;
  }

  function abrirAdicionar() {
    if (!podeLancar()) return;
    setNumeroParaLancar(null);
    setShowAdicionar(true);
  }

  /** "Lançar mais" do painel. Carrinho vazio (decisão do Caio, 17/10): fecha
   *  o painel e lembra o caminho, sem estado novo. */
  function lancarMais(c: { number: number }) {
    if (p.cart.length === 0) {
      setShowPainel(false);
      toast.info("Adicione os produtos e toque em Adicionar à comanda");
      return;
    }
    if (!podeLancar()) return;
    setShowPainel(false);
    setNumeroParaLancar(c.number);
    setShowAdicionar(true);
  }

  /** "Cobrar" do painel: a conferência de sempre (taxa, imprimir, tirar
   *  item), já com esta comanda. De lá o "Cobrar" chama `cobrar`. */
  function cobrarDoPainel(c: { number: number }) {
    setShowPainel(false);
    setNumeroParaCobrar(c.number);
    setShowFechar(true);
  }

  /** `nome` (17/10, tc-01) é opcional: vazio não manda nada e o nome que a
   *  comanda já tinha fica. */
  function lancar(numero: number, nome?: string) {
    if (!p.companyId || lancando) return;
    if (p.isDemo) { toast.info("Comandas não funcionam na conta de demonstração"); return; }
    const itens = itensParaAComanda(p.cart);
    if (itens.length === 0) return;
    const n = nomeDaComanda(nome);
    setLancando(true);
    (n ? comandaApi.addItems(p.companyId, numero, itens, n) : comandaApi.addItems(p.companyId, numero, itens))
      .then(function (r) {
        // backend antigo devolve sem name: o aviso fica só com o número
        const rotulo = rotuloDaComanda(numero, r.comanda?.name);
        toast.success(
          (r.opened ? "Comanda " + rotulo + " aberta" : "Lançado na comanda " + rotulo) +
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
  function cobrar(c: Comanda, taxaPct: number, opcoes?: OpcoesDaCobranca) {
    // "Alguns itens": o carrinho é só a parte marcada (a taxa sai sobre ela).
    const sel = opcoes && opcoes.itens ? itensCobrados(c, opcoes.itens) : null;
    if (sel && sel.ids.length === 0) return;
    const parte = sel && opcoes && opcoes.itens ? comandaSoComOsItens(c, opcoes.itens) : c;
    // Com o backend da 392 a venda sempre diz quais itens cobra: "Cobrar
    // tudo" manda os que estavam na tela.
    const ids = sel ? sel.ids : (cobraEmPartes(c) ? (c.items || []).map(function (it) { return it.id; }) : []);
    const qtd = sel ? sel.qtd : {};
    const ehParte = !!sel && (sel.ids.length < (c.items || []).length || Object.keys(sel.qtd).length > 0);

    p.limpar();
    linhasParaOCarrinho(parte, taxaPct).forEach(function (l) {
      const doCatalogo = p.products.find(function (x) { return x.id === l.key.split("__")[0]; });
      p.addToCart({
        id: l.key, name: l.name, price: l.price, unit: l.unit,
        cardPrice: doCatalogo?.cardPrice ?? null,
        refPrice: doCatalogo ? doCatalogo.price : undefined,
      });
      p.setQty(l.key, l.qty);
    });
    p.setComanda({
      id: c.id, number: c.number, feePct: taxaPct,
      ...(c.name ? { name: c.name } : {}),
      ...(ids.length > 0 ? { itemIds: ids } : {}),
      ...(Object.keys(qtd).length > 0 ? { itemQty: qtd } : {}),
    });
    setShowFechar(false);
    if (ehParte) {
      const n = parte.items.length;
      toast.success(
        "Comanda " + rotuloDaComanda(c.number, c.name) + ": " + n + (n === 1 ? " item" : " itens") +
        " no carrinho. O resto continua na comanda."
      );
      return;
    }
    const partes = opcoes && opcoes.partes ? opcoes.partes : [];
    if (partes.length > 1 && p.dividir) {
      p.dividir(partes);
      toast.success("Comanda " + rotuloDaComanda(c.number, c.name) + " no carrinho, dividida em " + partes.length + ". Confira e finalize.");
      return;
    }
    toast.success("Comanda " + rotuloDaComanda(c.number, c.name) + " no carrinho. Escolha o pagamento e finalize.");
  }

  /** Desiste de cobrar: o carrinho sai, a comanda continua aberta. */
  function cancelarCobranca() {
    const c = p.comanda;
    p.limpar();
    if (c) toast.info("A comanda " + rotuloDaComanda(c.number, c.name) + " continua aberta");
  }

  return {
    enabled: p.enabled,
    showAdicionar, abrirAdicionar, fecharAdicionar: () => setShowAdicionar(false),
    showFechar, abrirFechar: () => { setNumeroParaCobrar(null); setShowFechar(true); }, fecharFechar: () => setShowFechar(false),
    showPainel, abrirPainel: () => setShowPainel(true), fecharPainel: () => setShowPainel(false),
    numeroParaLancar, numeroParaCobrar, lancarMais, cobrarDoPainel,
    lancando, lancar, cobrar, cancelarCobranca, recarregarAbertas,
  };
}
