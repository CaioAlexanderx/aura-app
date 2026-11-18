// 17/11/2026 (mesmo defeito do INC-2026-11-17-01): "Cancelar" e "Corrigir
// texto" da NF-e abrem de dentro do detalhe da venda (Vendas), que é um
// ResponsiveSheet, ou seja, um Modal do react-native-web. No WebPortal, o
// campo do motivo e o da carta perdiam o foco para a janela de baixo e não
// dava para digitar. Os diálogos agora abrem numa JanelaEmpilhada; o campo
// precisa ficar com o foco. Modelo: Nfe55WizardFocoDentroDeJanela.test.tsx.
import React from "react";
import { Modal, TextInput, View } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/nfe55Api", () => ({ nfe55Api: { cancelar: jest.fn(), cartaCorrecao: jest.fn() } }));

import { AcoesDeEventosNfe } from "@/components/nfe55/EventosNfe";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => { render: (n: React.ReactNode) => void; unmount: () => void } };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

// 14/11/2026 15:51 em São Paulo; uma hora depois, dentro do prazo de cancelar.
const NOTA = { id: "em-15", numero: 15, authorized_at: "2026-11-14T18:51:00Z", status: "autorizada" };
const UMA_HORA_DEPOIS = Date.parse("2026-11-14T19:51:00Z");

// O detalhe da venda: um Modal com campo, como o ResponsiveSheet.
function DetalheDaVenda({ children }: { children: React.ReactNode }) {
  return (
    <Modal visible transparent>
      <View><TextInput testID="campo-do-detalhe" /></View>
      {children}
    </Modal>
  );
}

const el = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

async function abrirPeloDetalhe(botao: string) {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  // Como no app: o detalhe da venda abre primeiro (sem as ações)...
  await act(async () => { root.render(<DetalheDaVenda>{null}</DetalheDaVenda>); });
  // ...depois aparecem as ações da nota, e o diálogo só abre no clique.
  await act(async () => {
    root.render(
      <DetalheDaVenda>
        <AcoesDeEventosNfe companyId="loja-a" nota={NOTA} agora={UMA_HORA_DEPOIS} />
      </DetalheDaVenda>
    );
  });
  const b = el(botao);
  expect(b).toBeTruthy();
  await act(async () => { b!.click(); });
  return root;
}

function campoDoDialogo(dialogo: string, id: string): HTMLElement {
  expect(el(dialogo)).toBeTruthy();
  const campo = el(id);
  expect(campo).toBeTruthy();
  return campo!;
}

test("Cancelar a NF-e aberto pelo detalhe da venda: o campo do motivo fica com o foco", async () => {
  const root = await abrirPeloDetalhe("nfe-cancelar");
  const campo = campoDoDialogo("nfe-cancelar-dialogo", "nfe-cancelar-motivo");
  await act(async () => { campo.focus(); });
  expect(document.activeElement).toBe(campo);
  await act(async () => { root.unmount(); });
});

test("Corrigir texto aberto pelo detalhe da venda: o campo da carta fica com o foco", async () => {
  const root = await abrirPeloDetalhe("nfe-corrigir");
  const campo = campoDoDialogo("nfe-carta-dialogo", "nfe-carta-texto");
  await act(async () => { campo.focus(); });
  expect(document.activeElement).toBe(campo);
  await act(async () => { root.unmount(); });
});
