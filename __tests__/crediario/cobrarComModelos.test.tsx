// ============================================================
// Prévia do Cobrar com modelos (21/11/2026).
//
// 1. abre no padrão da situação da parcela, já preenchido;
// 2. tocar em outro modelo troca o texto;
// 3. digitar vale só para esta mensagem: aparece o aviso e "· editado";
//    "Voltar ao texto do modelo" desfaz;
// 4. "Salvar como modelo" mostra o modelo com as variáveis e entrega ao pai
//    o texto com {nome}/{valor}…, não os dados da Maria;
// 5. sem chave Pix: o parágrafo sai e aparece o aviso do mockup;
// 6. sem `modelos`, o modal de sempre (initialMessage, sem fileira).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));

import { CobrancaPreviewModal } from "@/components/crediario/CobrancaPreviewModal";
import { MODELOS_DA_AURA, preencher, type DadosDaMensagem } from "@/utils/crediarioMensagem";

const MARIA: DadosDaMensagem = {
  nome: "Maria", loja: "Boutique Flor de Lis", valor: "R$ 153,40", vencimento: "10/11", parcela: "2/3",
  dias: "11", saldo: "R$ 306,80", pix: "11987654321",
};

async function flush() {
  await act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); });
}
const porId = (tree: any, id: string) => tree.root.findAllByProps({ testID: id })[0];
const tem = (tree: any, id: string) => tree.root.findAllByProps({ testID: id }).length > 0;
const texto = (tree: any) => porId(tree, "cobranca-mensagem").props.value as string;

function montar(extra: any = {}) {
  const BASE = {
    visible: true, recipientName: "Maria Aparecida Souza", phone: "11987654321",
    valorLabel: "R$ 153,40", valorDesc: "Parcela 2/3 · venceu 10/11 · 11 dias de atraso",
    initialMessage: "", onClose: jest.fn(),
    modelos: MODELOS_DA_AURA, modelosDaAura: true, dados: MARIA, situacao: "em_atraso" as const,
  };
  return renderer.create(<CobrancaPreviewModal {...BASE} {...extra} />);
}

describe("prévia do Cobrar com modelos", () => {
  it("abre no padrão da situação (em atraso → Passou do dia), preenchido", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "cobranca-modelos")).toBe(true);
    expect(texto(tree)).toBe(preencher(MODELOS_DA_AURA[2].body, MARIA).texto);
    expect(texto(tree)).toContain("que venceu dia 10/11");
    expect(JSON.stringify(tree.toJSON())).toContain("prontos da Aura");
    tree.unmount();
  });

  it("QA P2: o telefone aparece formatado", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    const txt = JSON.stringify(tree.toJSON());
    // no cabeçalho da prévia (a mensagem pode trazer a chave Pix crua)
    expect(txt).toContain('" · ","(11) 98765-4321"');
    expect(txt).not.toContain('" · ","11987654321"');
    tree.unmount();
  });

  it("tocar em outro modelo troca o texto", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    await act(async () => { porId(tree, "cobranca-modelo-aura:vamos_combinar").props.onPress(); });
    expect(texto(tree)).toContain("hoje o valor em aberto é R$ 306,80");
    tree.unmount();
  });

  it("editar vale só desta vez; Voltar ao texto do modelo desfaz", async () => {
    let tree: any;
    await act(async () => { tree = montar(); });
    const original = texto(tree);
    expect(tem(tree, "cobranca-editado")).toBe(false);
    await act(async () => { porId(tree, "cobranca-mensagem").props.onChangeText(original + "\n\nAh, chegou coleção nova!"); });
    expect(tem(tree, "cobranca-editado")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("Vale só para esta mensagem");
    expect(JSON.stringify(tree.toJSON())).toContain(" · editado");
    await act(async () => { porId(tree, "cobranca-voltar-modelo").props.onPress(); });
    expect(texto(tree)).toBe(original);
    expect(tem(tree, "cobranca-editado")).toBe(false);
    tree.unmount();
  });

  it("Salvar como modelo: mostra as variáveis e grava o texto com elas", async () => {
    const onSalvarModelo = jest.fn((_como: any, _base: any, m: any) =>
      Promise.resolve({ id: "novo-1", name: m.name, body: m.body, situation: m.situation, is_default: !!m.situation, origin: "loja" as const }));
    let tree: any;
    await act(async () => { tree = montar({ onSalvarModelo }); });
    const original = texto(tree);
    await act(async () => { porId(tree, "cobranca-mensagem").props.onChangeText(original + "\n\nAh, chegou coleção nova!"); });
    await act(async () => { porId(tree, "cobranca-salvar-modelo").props.onPress(); });
    expect(tem(tree, "salvar-modelo")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("Seu modelo vai ficar assim");
    expect(tem(tree, "salvar-modelo-previa")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("Para outra cliente, sairia assim");
    expect(JSON.stringify(tree.toJSON())).toContain("Joana");

    await act(async () => { porId(tree, "salvar-modelo-nome").props.onChangeText("Passou do dia + novidade"); });
    await act(async () => { await porId(tree, "salvar-modelo-novo").props.onPress(); });
    await flush();
    expect(onSalvarModelo).toHaveBeenCalledTimes(1);
    const [como, base, m] = onSalvarModelo.mock.calls[0];
    expect(como).toBe("novo");
    expect(base.id).toBe("aura:passou_do_dia");
    expect(m).toEqual({
      name: "Passou do dia + novidade",
      body: MODELOS_DA_AURA[2].body + "\n\nAh, chegou coleção nova!",
      // O seletor abre na situação do modelo de base: é o que vale.
      situation: "em_atraso",
    });
    expect(m.body).not.toContain("Maria");
    // De volta à prévia, sem aviso de edição: o texto é o do modelo salvo.
    expect(tem(tree, "salvar-modelo")).toBe(false);
    expect(tem(tree, "cobranca-editado")).toBe(false);
    tree.unmount();
  });

  it('Salvar como novo com o mesmo nome vira "Nome (2)"; "Não usar sozinho" tira o padrão', async () => {
    const onSalvarModelo = jest.fn((_como: any, _base: any, _m: any) => Promise.resolve(null));
    let tree: any;
    await act(async () => { tree = montar({ onSalvarModelo }); });
    await act(async () => { porId(tree, "cobranca-mensagem").props.onChangeText(texto(tree) + " Beijo!"); });
    await act(async () => { porId(tree, "cobranca-salvar-modelo").props.onPress(); });
    expect(porId(tree, "salvar-modelo-sit-em_atraso").props.accessibilityState).toEqual({ selected: true });
    await act(async () => { porId(tree, "salvar-modelo-sit-livre").props.onPress(); });
    await act(async () => { await porId(tree, "salvar-modelo-novo").props.onPress(); });
    expect(onSalvarModelo.mock.calls[0][2]).toMatchObject({ name: "Passou do dia (2)", situation: null });
    tree.unmount();
  });

  it("cliente sem parcela aberta abre no modelo do saldo (Vamos combinar)", async () => {
    let tree: any;
    await act(async () => {
      tree = montar({ dados: { nome: "Maria", loja: "Loja", saldo: "R$ 50,00", pix: "x" }, situacao: "a_vencer" });
    });
    expect(texto(tree)).toContain("hoje o valor em aberto é R$ 50,00");
    tree.unmount();
  });

  it("modelo que ficaria vazio não abre: usa o texto de reserva e nunca envia vazio", async () => {
    const vazio = [{ id: "v", name: "Só parcela", body: "Parcela {parcela} de {valor}.", situation: "a_vencer", is_default: true, origin: "loja" }];
    let tree: any;
    await act(async () => {
      tree = montar({ modelos: vazio, modelosDaAura: false, initialMessage: "Texto de reserva",
        dados: { nome: "Maria", loja: "Loja", saldo: "R$ 50,00" } });
    });
    expect(texto(tree)).toBe("Texto de reserva");
    await act(async () => { porId(tree, "cobranca-mensagem").props.onChangeText("   "); });
    expect(porId(tree, "cobranca-enviar-whatsapp").props.disabled).toBe(true);
    tree.unmount();
  });

  it("sem chave Pix: tira o parágrafo e avisa", async () => {
    let tree: any;
    await act(async () => { tree = montar({ dados: { ...MARIA, pix: null }, situacao: "a_vencer" }); });
    expect(texto(tree)).not.toContain("Pix");
    expect(JSON.stringify(tree.toJSON())).toContain("Sem chave Pix cadastrada: tirei essa parte do texto.");
    tree.unmount();
  });

  it("sem modelos: o modal de sempre", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <CobrancaPreviewModal visible recipientName="Ana" phone="11" initialMessage="Olá, Ana!" onClose={jest.fn()} />
      );
    });
    expect(tem(tree, "cobranca-modelos")).toBe(false);
    expect(texto(tree)).toBe("Olá, Ana!");
    await act(async () => { porId(tree, "cobranca-mensagem").props.onChangeText("Outro texto"); });
    expect(tem(tree, "cobranca-editado")).toBe(false);
    tree.unmount();
  });
});
