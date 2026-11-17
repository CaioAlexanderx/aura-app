// 17/11/2026 (incidente): o assistente da NF-e aberto por cima de uma janela
// (Modal do RN, como o detalhe da venda) não deixava digitar: a armadilha de
// foco da janela de baixo puxava o foco de volta. O assistente agora abre num
// Modal próprio; o campo dele precisa ficar com o foco.
import React from "react";
import { Modal, TextInput, View } from "react-native";
import { JanelaEmpilhada } from "@/components/JanelaEmpilhada";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => { render: (n: React.ReactNode) => void; unmount: () => void } };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

function JanelaDeBaixo({ children }: { children: React.ReactNode }) {
  return (
    <Modal visible transparent>
      <View><TextInput testID="campo-de-baixo" /></View>
      {children}
    </Modal>
  );
}

test("campo da JanelaEmpilhada aberta por cima de outra janela fica com o foco", async () => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  // Como no app: o detalhe da venda abre primeiro; o assistente abre depois,
  // pelo botão "Emitir NF-e", por cima dele.
  await act(async () => { root.render(<JanelaDeBaixo>{null}</JanelaDeBaixo>); });
  await act(async () => {
    root.render(
      <JanelaDeBaixo>
        <JanelaEmpilhada>
          <View><TextInput testID="campo-do-assistente" /></View>
        </JanelaEmpilhada>
      </JanelaDeBaixo>
    );
  });
  const campo = document.querySelector('[data-testid="campo-do-assistente"]') as HTMLInputElement;
  expect(campo).toBeTruthy();
  await act(async () => { campo.focus(); });
  expect(document.activeElement).toBe(campo);
  await act(async () => { root.unmount(); });
});

test("com o WebPortal de antes, o foco voltava para a janela de baixo (o defeito)", async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebPortal } = require("@/components/WebPortal");
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => { root.render(<JanelaDeBaixo>{null}</JanelaDeBaixo>); });
  await act(async () => {
    root.render(
      <JanelaDeBaixo>
        <WebPortal active><View><TextInput testID="campo-no-portal" /></View></WebPortal>
      </JanelaDeBaixo>
    );
  });
  const campo = document.querySelector('[data-testid="campo-no-portal"]') as HTMLInputElement;
  expect(campo).toBeTruthy();
  await act(async () => { campo.focus(); });
  expect(document.activeElement).not.toBe(campo);
  await act(async () => { root.unmount(); });
});
