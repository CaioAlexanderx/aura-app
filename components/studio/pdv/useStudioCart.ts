// ============================================================
// AURA STUDIO · PDV — hook do carrinho (Fase 6)
// Dois caminhos: personalizável (abre configurador → addCustom) e
// comum (addSimple direto). Espelha a lógica do caixa.tsx atual.
//
// QUICK-ADD (agent/pdv):
//   addSimple  → kind = 'quick'        (1 toque, sem modal)
//   addCustom  → kind = 'personalizado' (passou pelo StageConfigure)
//
// 05/06/2026 (paridade Negócio):
//   setQtyTo    → define a quantidade ABSOLUTA (campo digitável entre as setas)
//   setUnitPrice→ preço de venda livre (lápis). product.price (tabela) fica intacto.
//   subtotal    → agora usa o preço de venda efetivo (unitPrice ?? price).
// ============================================================
import { useState, useCallback, useMemo } from "react";
import type { CartLine, StudioProduct } from "./types";

function newLineId() {
  return String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7);
}

/** Preço de venda efetivo: lápis (unitPrice) sobrescreve o de tabela. */
function salePrice(l: CartLine): number {
  return l.unitPrice != null && l.unitPrice >= 0 ? l.unitPrice : l.product.price;
}

export function useStudioCart() {
  const [cart, setCart] = useState<CartLine[]>([]);

  /** Adiciona produto sem personalização (quick-add 1 toque). */
  const addSimple = useCallback((p: StudioProduct) => {
    setCart((prev) => {
      // Agrupa apenas itens quick do mesmo produto (personalizados sempre criam linha nova)
      const existing = prev.find(
        (l) => l.product.id === p.id && l.kind === 'quick'
      );
      if (existing) {
        return prev.map((l) =>
          l.lineId === existing.lineId ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        { lineId: newLineId(), product: p, qty: 1, values: {}, kind: 'quick' },
      ];
    });
  }, []);

  /** Adiciona / edita item personalizado (saiu do StageConfigure). */
  const addCustom = useCallback(
    (
      p: StudioProduct,
      values: Record<string, any>,
      qty: number,
      editLineId?: string | null,
    ) => {
      setCart((prev) => {
        if (editLineId) {
          return prev.map((l) =>
            l.lineId === editLineId
              ? { ...l, qty, values, kind: 'personalizado' }
              : l
          );
        }
        return [
          ...prev,
          { lineId: newLineId(), product: p, qty, values, kind: 'personalizado' },
        ];
      });
    },
    [],
  );

  /** Ajuste relativo (−/+) usado pelos botões de stepper. */
  const setQty = useCallback((lineId: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.lineId !== lineId) return [l];
        const q = l.qty + delta;
        return q <= 0 ? [] : [{ ...l, qty: q }];
      })
    );
  }, []);

  /** Quantidade absoluta (campo digitável). Mínimo 1; ≤ 0 mantém a linha. */
  const setQtyTo = useCallback((lineId: string, qty: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const q = Math.max(1, Math.floor(Number(qty) || 0));
        return { ...l, qty: q };
      })
    );
  }, []);

  /** Preço de venda livre (lápis). product.price (tabela) permanece intacto. */
  const setUnitPrice = useCallback((lineId: string, price: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        if (!isFinite(price) || price < 0) return l;
        return { ...l, unitPrice: Math.round(price * 100) / 100 };
      })
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setCart([]), []);

  const subtotal = useMemo(
    () => cart.reduce((a, l) => a + salePrice(l) * l.qty, 0),
    [cart],
  );
  const count = useMemo(() => cart.reduce((a, l) => a + l.qty, 0), [cart]);

  /** Itens que passaram pelo StageConfigure (kind='personalizado'). */
  const customCount = useMemo(
    () =>
      cart
        .filter((l) => l.kind === 'personalizado')
        .reduce((a, l) => a + l.qty, 0),
    [cart],
  );

  /** Itens adicionados via quick-add. */
  const quickCount = useMemo(
    () =>
      cart
        .filter((l) => l.kind === 'quick')
        .reduce((a, l) => a + l.qty, 0),
    [cart],
  );

  return {
    cart,
    addSimple,
    addCustom,
    setQty,
    setQtyTo,
    setUnitPrice,
    removeLine,
    clear,
    subtotal,
    count,
    customCount,
    quickCount,
  };
}
