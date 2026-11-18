// 17/11/2026: o diálogo "Nova data" do pedido abre por cima da gaveta do
// pedido, que é um ResponsiveSheet (Modal do RN), e tem o campo "Outra data".
// No WebPortal o foco voltava para a janela de baixo (INC-2026-11-17-01); o
// diálogo usa a JanelaEmpilhada e o campo dele precisa ficar com o foco.
// Mesmo modelo de Nfe55WizardFocoDentroDeJanela.test.tsx, com o diálogo de
// verdade.
import React from "react";
import { Modal, TextInput, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/services/api", () => ({ request: jest.fn(() => Promise.resolve({})) }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ token: "t", company: { id: "c1" }, consolidatedView: false }) }));

import { NovaDataDoPedido } from "@/components/screens/vendas/pedidos/NovaDataDoPedido";
import { hojeEmSaoPaulo, somarDias } from "@/components/screens/vendas/pedidos/regrasDosPedidos";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => { render: (n: React.ReactNode) => void; unmount: () => void } };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

const HOJE = hojeEmSaoPaulo();

/** A gaveta do pedido: um Modal com um campo, como o ResponsiveSheet. */
function Gaveta({ children }: { children: React.ReactNode }) {
  return (
    <Modal visible transparent>
      <View><TextInput testID="campo-da-gaveta" /></View>
      {children}
    </Modal>
  );
}

test("o campo Outra data do diálogo aberto por cima da gaveta fica com o foco", async () => {
  const qc = new QueryClient();
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  // Data prometida que não é escolha rápida: o diálogo abre em "Outra data",
  // com o campo preenchido.
  const pedido = { id: "o1", company_id: "c2", order_number: "P-0012", customer_name: "Marina", promised_date: somarDias(HOJE, 12) };
  await act(async () => { root.render(<QueryClientProvider client={qc}><Gaveta>{null}</Gaveta></QueryClientProvider>); });
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Gaveta>
          <NovaDataDoPedido pedido={pedido} hoje={HOJE} onClose={() => {}} />
        </Gaveta>
      </QueryClientProvider>
    );
  });
  const campo = document.querySelector('[data-testid="nova-data-campo"]') as HTMLInputElement;
  expect(campo).toBeTruthy();
  expect(campo.value).toBe(pedido.promised_date.slice(8, 10) + "/" + pedido.promised_date.slice(5, 7) + "/" + pedido.promised_date.slice(0, 4));
  const deBaixo = document.querySelector('[data-testid="campo-da-gaveta"]') as HTMLInputElement;
  await act(async () => { deBaixo.blur(); campo.focus(); });
  expect(document.activeElement).toBe(campo);
  await act(async () => { root.unmount(); });
});
