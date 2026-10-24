import React from "react";
import renderer, { act } from "react-test-renderer";

import { ResultadoImportacaoModal } from "@/components/screens/financeiro/ResultadoImportacaoModal";

const base = {
  visible: true, titulo: "Importação concluída",
  resumo: "Importei 12 lançamentos. 3 linhas ficaram de fora, e aqui estão as primeiras com o motivo.",
  motivos: ["Linha 2: valor invalido ''"], oferecerAjuda: true,
  onPedirAjuda: jest.fn(), onFechar: jest.fn(),
};

function montar(extra: any = {}) {
  let t: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<ResultadoImportacaoModal {...base} {...extra} />); });
  return t!;
}
function porTestId(t: renderer.ReactTestRenderer, id: string) {
  return t.root.findAll((n) => n.props.testID === id, { deep: false });
}
function textos(t: renderer.ReactTestRenderer): string {
  return JSON.stringify(t.toJSON());
}

describe("ResultadoImportacaoModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mostra resumo, motivos, texto de escopo e o botão Pedir ao Time Aura", () => {
    const t = montar();
    const j = textos(t);
    expect(j).toContain(base.resumo);
    expect(j).toContain("Linha 2: valor invalido ''");
    expect(j).toContain("Esta tela importa receitas e despesas. Se o seu arquivo é de crediário ou de clientes, a gente ajuda a trazer.");
    expect(j).toContain("Pedir ao Time Aura");
    const [botao] = porTestId(t, "resultado-importacao-ajuda");
    act(() => { botao.props.onPress(); });
    expect(base.onPedirAjuda).toHaveBeenCalled();
  });

  it("sem convite quando tudo entrou", () => {
    const t = montar({ motivos: [], oferecerAjuda: false });
    expect(porTestId(t, "resultado-importacao-ajuda")).toHaveLength(0);
    expect(textos(t)).not.toContain("Pedir ao Time Aura");
  });

  it("fecha", () => {
    const t = montar();
    const [fechar] = porTestId(t, "resultado-importacao-fechar");
    act(() => { fechar.props.onPress(); });
    expect(base.onFechar).toHaveBeenCalled();
  });
});
