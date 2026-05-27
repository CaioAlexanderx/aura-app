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
// ============================================================
import { QuickCustomerModal } from "@/components/QuickCustomerModal";
import { VariantPickerModal } from "@/components/VariantPickerModal";
import { TrocaModal } from "@/components/screens/pdv/TrocaModal";
import { OpenCloseCashModal } from "@/components/screens/pdv/OpenCloseCashModal";
import { CashChangeModal } from "@/components/screens/pdv/CashChangeModal";
import { CreditInstallmentModal } from "@/components/screens/pdv/CreditInstallmentModal";
import type { Product } from "@/components/screens/estoque/types";

export type CrediarioConfirmPayload = {
  installments: number;
  first_due_date: string;
};

export interface PdvModalsProps {
  // ── Cliente rápido
  showNewCustomer:    boolean;
  onCloseNewCustomer: () => void;
  onCustomerCreated:  (c: any) => void;
  // ── Variante de produto
  pendingProduct:        Product | null;
  onVariantSelected:     (v: { id: string; label: string; price: number; stock: number }) => void;
  onClosePendingProduct: () => void;
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
  // ── Crediário parcelado (14/05/2026 criado; 26/05/2026 fase 1 refatorado)
  showCrediario:      boolean;
  customerId:         string | null;
  customerName:       string | null;
  saleTotal:          number;
  onCrediarioConfirm: (payload: CrediarioConfirmPayload) => void;
  onCrediarioClose:   () => void;
}

export function PdvModals({
  showNewCustomer, onCloseNewCustomer, onCustomerCreated,
  pendingProduct, onVariantSelected, onClosePendingProduct,
  showTroca, companyId, products, onCloseTroca,
  showCaixaModal, companyName, companyCnpj, sessaoAtiva, onCloseCaixa, onCaixaSuccess,
  showChangeModal, cashModalAmount, cashModalIsSplit, onCancelChange, onConfirmChange,
  showCrediario, customerId, customerName, saleTotal, onCrediarioConfirm, onCrediarioClose,
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
    </>
  );
}
