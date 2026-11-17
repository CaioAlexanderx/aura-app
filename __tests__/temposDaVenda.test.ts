// p-152 (17/11/2026): tempos da venda medidos no app.
import {
  __zerarTemposParaTestes, aoAdicionarItem, aoFinalizar, aoNovaVenda, aoResponder,
  definirEnvioDosTempos, marcarEntrada, type TempoDaVenda,
} from "@/services/temposDaVenda";

let relogio = 0;
let enviados: TempoDaVenda[] = [];
beforeEach(() => {
  relogio = 1000;
  __zerarTemposParaTestes(() => relogio);
  enviados = [];
  definirEnvioDosTempos((l) => { enviados.push(...l); });
});

test("venda aceita: atendimento, espera e tempo parado, mandados na Nova venda", () => {
  marcarEntrada("leitor"); aoAdicionarItem();
  relogio += 4000; marcarEntrada("leitor"); aoAdicionarItem();
  relogio += 2000; aoFinalizar(2);
  relogio += 3100; aoResponder(true, "venda-1");
  expect(enviados).toHaveLength(0); // ainda na tela final
  relogio += 1500; aoNovaVenda(false);
  expect(enviados).toHaveLength(1);
  expect(enviados[0]).toMatchObject({ sale_id: "venda-1", atendimento_ms: 6000, espera_ms: 3100, ocioso_ms: 1500, itens: 2, entrada: "leitor", ok: true });
});

test("leitor e grade na mesma venda: misto", () => {
  marcarEntrada("leitor"); aoAdicionarItem();
  marcarEntrada("grade"); aoAdicionarItem();
  aoFinalizar(2); aoResponder(true, "v"); aoNovaVenda(false);
  expect(enviados[0].entrada).toBe("misto");
});

test("recusada: manda na hora com ok=false; o atendimento segue do mesmo primeiro item", () => {
  aoAdicionarItem();
  relogio += 1000; aoFinalizar(1);
  relogio += 500; aoResponder(false, null);
  expect(enviados[0]).toMatchObject({ ok: false, espera_ms: 500, atendimento_ms: 1000, ocioso_ms: null });
  relogio += 2000; aoFinalizar(1);
  relogio += 300; aoResponder(true, "v");
  aoNovaVenda(false);
  expect(enviados[1]).toMatchObject({ ok: true, atendimento_ms: 3500 });
});

test("Limpar sem venda não manda nada; venda nova com itens da espera começa a contar já", () => {
  aoAdicionarItem(); aoNovaVenda(false);
  expect(enviados).toHaveLength(0);
  aoFinalizar(1); aoResponder(true, "v1");
  relogio += 100; aoNovaVenda(true);
  relogio += 700; aoFinalizar(1); aoResponder(true, "v2"); aoNovaVenda(false);
  expect(enviados[1].atendimento_ms).toBe(700);
});

test("erro no envio não sai daqui", () => {
  definirEnvioDosTempos(() => { throw new Error("rede"); });
  aoAdicionarItem(); aoFinalizar(1);
  expect(() => aoResponder(false, null)).not.toThrow();
});
