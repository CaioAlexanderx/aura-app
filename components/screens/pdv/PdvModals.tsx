// ============================================================
// PdvModals — centraliza todos os modais do PDV
//
// Antes da decomposição de 14/05/2026, cada modal era renderizado
// duas vezes em pdv.tsx (branch wide + branch mobile). Agora
// vivem aqui e pdv.tsx inclui <PdvModals> uma única vez.
//
// Para adicionar um novo modal ao PDV:
//   1. Adicione o estado e o handler em hooks/usePdvState.ts
//   2. Acrescente o prop aqui em PdvModalsProps
//   3. Renderize o modal dentro do Fragment abaixo
//
// 26/05/2026 (crediario fase 1): onCrediarioConfirm agora recebe
// { installments, first_due_date } para repassar ao POST /pdv/sale.
//
// 13/06/2026 (unify): CrediarioConfirmPayload ampliado com campo `unify?`
// opcional. usePdvState.handleCrediarioConfirm detecta o campo e, após
// a venda ser registrada com installments=1, chama creditApi.applyUnify.
// ============================================================
import { QuickCustomerModal } from "@/components/QuickCustomerModal";
import { VariantPickerModal } from "@/components/VariantPickerModal";
import { TrocaModal } from "@/components/screens/pdv/TrocaModal";
import { OpenCloseCashModal } from "@/components/screens/pdv/OpenCloseCashModal";
import { CashChangeModal } from "@/components/screens/pdv/CashChangeModal";
import { CreditInstallmentModal } from "@/components/screens/pdv/CreditInstallmentModal";
import { AdicionarAComandaModal, FecharComandaModal } from "@/components/screens/pdv/ComandaModals";
import type { Comanda } from "@/utils/comanda";
import type { Product } from "@/components/screens/estoque/types";

// Re-export do tipo do modal para uso em usePdvState
export type { ConfirmPayload as CrediarioConfirmPayload } from "@/components/screens/pdv/CreditInstallmentModal";

export interface PdvModalsProps {
  // ── Cliente rápido
  showNewCustomer:    boolean;
  onCloseNewCustomer: () => void;
  onCustomerCreated:  (c: any) => void;
  // ── Variante de produto
  pendingProduct:        Product | null;
  onVariantSelected:     (v: { id: string; label: string; price: number; stock: number }) => void;
  onClosePendingProduct: () => void;
  /** Código bipado que abriu o seletor (e a variante dele, se o servidor disse). */
  pendingBipe?:          { code: string; variantId?: string } | null;
  /** Bipe com o seletor aberto: confirma o tamanho marcado e segue. */
  onScanAgain?:          (code: string) => void;
  // ── Troca
  showTroca:    boolean;
  companyId:    string;
  products:     Product[];
  onCloseTroca: () => void;
  // ── Abertura / fechamento de caixa
  showCaixaModal: boolean;
  companyName:    string;
  companyCnpj:    string | null;
  sessaoAtiva:    any;
  onCloseCaixa:   () => void;
  onCaixaSuccess: () => void;
  // ── Modal de troco
  showChangeModal:  boolean;
  cashModalAmount:  number;
  cashModalIsSplit: boolean;
  onCancelChange:   () => void;
  onConfirmChange:  () => void;
  // ── Crediário parcelado (14/05/2026 criado; 26/05/2026 fase 1 refatorado; 13/06/2026 unify)
  showCrediario:      boolean;
  customerId:         string | null;
  customerName:       string | null;
  saleTotal:          number;
  onCrediarioConfirm: (payload: import("@/components/screens/pdv/CreditInstallmentModal").ConfirmPayload) => void;
  onCrediarioClose:   () => void;
  // ── Comandas (09/10/2026). Ausente = loja sem comanda, nada é montado.
  comandas?: {
    enabled: boolean;
    showAdicionar: boolean;
    fecharAdicionar: () => void;
    lancando: boolean;
    lancar: (numero: number) => void;
    showFechar: boolean;
    fecharFechar: () => void;
    cobrar: (comanda: Comanda, taxaPct: number) => void;
    recarregarAbertas: () => void;
  };
  cartItemCount?: number;
  cartTotal?: number;
}

export function PdvModals({
  showNewCustomer, onCloseNewCustomer, onCustomerCreated,
  pendingProduct, onVariantSelected, onClosePendingProduct, pendingBipe, onScanAgain,
  showTroca, companyId, products, onCloseTroca,
  showCaixaModal, companyName, companyCnpj, sessaoAtiva, onCloseCaixa, onCaixaSuccess,
  showChangeModal, cashModalAmount, cashModalIsSplit, onCancelChange, onConfirmChange,
  showCrediario, customerId, customerName, saleTotal, onCrediarioConfirm, onCrediarioClose,
  comandas, cartItemCount, cartTotal,
}: PdvModalsProps) {
  return (
    <>
      <QuickCustomerModal
        visible={showNewCustomer}
        onClose={onCloseNewCustomer}
        onCustomerCreated={onCustomerCreated}
      />
      <VariantPickerModal
        visible={!!pendingProduct}
        product={pendingProduct}
        onSelect={onVariantSelected}
        onClose={onClosePendingProduct}
        keyboard
        preselectVariantId={pendingBipe?.variantId || null}
        preselectBarcode={pendingBipe?.code || null}
        onScanAgain={onScanAgain}
      />
      <TrocaModal
        visible={showTroca}
        companyId={companyId}
        products={products}
        onClose={onCloseTroca}
      />
      <OpenCloseCashModal
        visible={showCaixaModal}
        companyId={companyId}
        companyName={companyName}
        companyCnpj={companyCnpj}
        sessaoAtiva={sessaoAtiva}
        onClose={onCloseCaixa}
        onSuccess={onCaixaSuccess}
      />
      <CashChangeModal
        visible={showChangeModal}
        total={cashModalAmount}
        totalLabel={cashModalIsSplit ? "Parcela em dinheiro" : undefined}
        onCancel={onCancelChange}
        onConfirm={onConfirmChange}
      />
      <CreditInstallmentModal
        visible={showCrediario}
        companyId={companyId}
        customerId={customerId || ""}
        customerName={customerName || undefined}
        totalAmount={saleTotal}
        onConfirm={onCrediarioConfirm}
        onClose={onCrediarioClose}
      />
      {comandas && comandas.enabled && !!companyId && (
        <>
          <AdicionarAComandaModal
            visible={comandas.showAdicionar}
            companyId={companyId}
            itemCount={cartItemCount || 0}
            total={cartTotal || 0}
            saving={comandas.lancando}
            onClose={comandas.fecharAdicionar}
            onConfirm={comandas.lancar}
          />
          <FecharComandaModal
            visible={comandas.showFechar}
            companyId={companyId}
            loja={companyName}
            onClose={comandas.fecharFechar}
            onCobrar={comandas.cobrar}
            onMudou={comandas.recarregarAbertas}
          />
        </>
      )}
    </>
  );
}
