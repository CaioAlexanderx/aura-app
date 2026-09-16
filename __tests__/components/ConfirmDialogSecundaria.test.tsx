// ConfirmDialog · ação secundária (16/09/2026)
// "Devolver ou trocar?": no crediário a confirmação oferece "Trocar tamanho
// ou produto" além de devolver. Quem não passa a ação continua igual.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function botaoSecundario(t: renderer.ReactTestRenderer) {
  return t.root.findAll((n) => n.props?.testID === "confirm-secondary" && typeof n.props?.onPress === "function");
}

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}

it("com a ação secundária: mostra o botão e chama só ela", () => {
  const onSecondary = jest.fn();
  const onConfirm = jest.fn();
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <ConfirmDialog
        visible title="Devolver ou trocar?" message="m"
        confirmLabel="Sim, devolver" onConfirm={onConfirm} onCancel={jest.fn()}
        secondaryLabel="Trocar tamanho ou produto" onSecondary={onSecondary}
      />,
    );
  });
  expect(texto(t.toJSON())).toContain("Trocar tamanho ou produto");
  act(() => botaoSecundario(t)[0].props.onPress());
  expect(onSecondary).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

it("sem a ação secundária: igual a antes", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <ConfirmDialog visible title="Excluir?" message="m" onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
  });
  expect(botaoSecundario(t)).toHaveLength(0);
  expect(texto(t.toJSON())).not.toContain("Trocar");
});
