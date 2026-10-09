// 29/09/2026 — o bipe em sequência ainda travava no Caixa: o código ia para
// a busca e o próximo bipe grudava nele até o lojista apagar. Causas: leitor
// configurado sem Enter (nada reconhecia a leitura) e código lido não
// encontrado (ia de propósito para a busca). O leitor agora é reconhecido
// pela velocidade — rajada de ≥ 6 caracteres a ≤ 40 ms — com ou sem Enter,
// dentro e fora da busca.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { criarDetector, falhaDeConexao } from "@/utils/leituraRapida";
import { SearchBox } from "@/components/screens/pdv/SearchBox";
import { useGlobalBarcodeScanner } from "@/hooks/useGlobalBarcodeScanner";

let agora = 1_000_000;
beforeEach(() => {
  jest.useFakeTimers();
  agora = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe("criarDetector", () => {
  it("rajada rápida longa é leitura; digitação lenta ou curta não", () => {
    const d = criarDetector();
    "7891234567895".split("").forEach((c, i) => d.tecla(c, 1000 + i * 10));
    expect(d.leitura()).toBe("7891234567895");

    const h = criarDetector();
    "camisa".split("").forEach((c, i) => h.tecla(c, 1000 + i * 180));
    expect(h.leitura()).toBeNull();

    const curta = criarDetector();
    "12345".split("").forEach((c, i) => curta.tecla(c, 1000 + i * 10));
    expect(curta.leitura()).toBeNull();
  });

  it("uma pausa no meio começa uma rajada nova", () => {
    const d = criarDetector();
    "abc".split("").forEach((c, i) => d.tecla(c, 1000 + i * 150));
    const nova = d.tecla("7", 2000);
    expect(nova).toBe(true);
    "891234567".split("").forEach((c, i) => d.tecla(c, 2010 + i * 10));
    expect(d.leitura()).toBe("7891234567");
  });
});

// 03/10/2026 — Finesse: o código 2001485473363 partiu em "20014" (parado na
// busca) + bipe de "85473363". Uma tecla atrasou mais que o limite no meio
// da leitura.
describe("criarDetector · soluço no meio da leitura", () => {
  const teclar = (d: ReturnType<typeof criarDetector>, texto: string, inicio: number, passo: number) => {
    let t = inicio;
    const novas: boolean[] = [];
    for (const c of texto) { novas.push(d.tecla(c, t)); t += passo; }
    return { fim: t - passo, novas };
  };

  it("uma pausa curta não parte o código em dois", () => {
    const d = criarDetector();
    const a = teclar(d, "20014", 1000, 10);
    const b = teclar(d, "85473363", a.fim + 90, 10);
    expect(b.novas[0]).toBe(false);
    expect(d.leitura()).toBe("2001485473363");
  });

  it("pausa maior que o tempo de fechar a rajada ainda emenda", () => {
    const d = criarDetector();
    const a = teclar(d, "20014", 1000, 10);
    expect(d.leitura()).toBeNull(); // o temporizador fecharia aqui, sem leitura
    teclar(d, "85473363", a.fim + 250, 10);
    expect(d.leitura()).toBe("2001485473363");
  });

  it("pausa longa começa de novo", () => {
    const d = criarDetector();
    const a = teclar(d, "20014", 1000, 10);
    const b = teclar(d, "85473363", a.fim + 800, 10);
    expect(b.novas[0]).toBe(true);
    expect(d.leitura()).toBe("85473363");
  });

  it("gente digitando rápido, com teclas coladas aos pares, continua sendo busca", () => {
    const d = criarDetector();
    let t = 1000;
    for (const par of ["ca", "mi", "sa", "ve", "rd", "e "]) {
      d.tecla(par[0], t); t += 30;
      d.tecla(par[1], t); t += 110;
    }
    expect(d.leitura()).toBeNull();
  });
});

describe("falhaDeConexao", () => {
  it("404 do scan é código inexistente, não problema de conexão", () => {
    expect(falhaDeConexao({ status: 404 })).toBe(false);
    expect(falhaDeConexao({ status: 400 })).toBe(false);
  });
  it("sem resposta, timeout e erro do servidor são conexão", () => {
    expect(falhaDeConexao({ status: 0, isNetworkError: true })).toBe(true);
    expect(falhaDeConexao({ status: 500 })).toBe(true);
    expect(falhaDeConexao(new Error("x"))).toBe(true);
    expect(falhaDeConexao(undefined)).toBe(true);
  });
});

// Busca controlada, como no Caixa.
function Busca({ onScan, onSubmit }: { onScan: (c: string) => void; onSubmit?: (v: string) => void }) {
  const [v, setV] = React.useState("");
  return <SearchBox value={v} onChange={setV} onScan={onScan} onSubmit={onSubmit} />;
}

function digitar(t: renderer.ReactTestRenderer, texto: string, intervaloMs: number) {
  for (const c of texto) {
    const input = t.root.findByType(TextInput);
    act(() => { input.props.onChangeText(String(input.props.value || "") + c); });
    agora += intervaloMs;
  }
}
const valor = (t: renderer.ReactTestRenderer) => t.root.findByType(TextInput).props.value;

describe("SearchBox · leitor dentro da busca", () => {
  it("sem Enter: dois bipes seguidos lançam os dois e o campo fica limpo", () => {
    const onScan = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Busca onScan={onScan} />); });

    digitar(t, "7891234567895", 10);
    act(() => { jest.advanceTimersByTime(150); });
    expect(onScan).toHaveBeenLastCalledWith("7891234567895");
    expect(valor(t)).toBe("");

    agora += 2000;
    digitar(t, "7890000000017", 10);
    act(() => { jest.advanceTimersByTime(150); });
    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenLastCalledWith("7890000000017");
    expect(valor(t)).toBe("");
  });

  it("leitura com soluço no meio: lança o código inteiro e não deixa pedaço na busca", () => {
    const onScan = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Busca onScan={onScan} />); });

    digitar(t, "20014", 10);
    agora += 200;
    act(() => { jest.advanceTimersByTime(200); }); // o temporizador fecha sem leitura
    expect(onScan).not.toHaveBeenCalled();
    digitar(t, "85473363", 10);
    act(() => { jest.advanceTimersByTime(150); });

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("2001485473363");
    expect(valor(t)).toBe("");
  });

  it("com Enter: lança na hora e não vira busca", () => {
    const onScan = jest.fn();
    const onSubmit = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Busca onScan={onScan} onSubmit={onSubmit} />); });
    digitar(t, "7891234567895", 8);
    act(() => { t.root.findByType(TextInput).props.onSubmitEditing({ nativeEvent: { text: "7891234567895" } }); });
    expect(onScan).toHaveBeenCalledWith("7891234567895");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(valor(t)).toBe("");
  });

  it("bipe com texto já digitado: o código sai e o texto da pessoa fica", () => {
    const onScan = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Busca onScan={onScan} />); });
    digitar(t, "blusa", 200);
    agora += 1000;
    digitar(t, "7891234567895", 10);
    act(() => { jest.advanceTimersByTime(150); });
    expect(onScan).toHaveBeenCalledWith("7891234567895");
    expect(valor(t)).toBe("blusa");
  });

  it("digitação normal continua sendo busca (Enter vai para onSubmit)", () => {
    const onScan = jest.fn();
    const onSubmit = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Busca onScan={onScan} onSubmit={onSubmit} />); });
    digitar(t, "camiseta", 180);
    act(() => { jest.advanceTimersByTime(500); });
    expect(onScan).not.toHaveBeenCalled();
    expect(valor(t)).toBe("camiseta");
    act(() => { t.root.findByType(TextInput).props.onSubmitEditing({ nativeEvent: { text: "camiseta" } }); });
    expect(onSubmit).toHaveBeenCalledWith("camiseta");
  });
});

function Leitor({ onScan }: { onScan: (c: string) => void }) {
  useGlobalBarcodeScanner({ onScan });
  return null;
}
function tecla(key: string) {
  // 09/10/2026: o leitor global mede o tempo pelo timeStamp do evento.
  const ev = new KeyboardEvent("keydown", { key });
  Object.defineProperty(ev, "timeStamp", { value: agora });
  act(() => { window.dispatchEvent(ev); });
}
function bipar(codigo: string, fim?: "Enter" | "Tab") {
  for (const c of codigo) { tecla(c); agora += 10; }
  if (fim) tecla(fim);
}

describe("useGlobalBarcodeScanner · leitor fora dos campos", () => {
  it("leitor sem Enter: lê pela rajada, em sequência", () => {
    const onScan = jest.fn();
    act(() => { renderer.create(<Leitor onScan={onScan} />); });
    bipar("7891234567895");
    act(() => { jest.advanceTimersByTime(150); });
    agora += 1000;
    bipar("7890000000017");
    act(() => { jest.advanceTimersByTime(150); });
    expect(onScan.mock.calls.map((c) => c[0])).toEqual(["7891234567895", "7890000000017"]);
  });

  it("leitor sem Enter com soluço no meio: lê o código inteiro", () => {
    const onScan = jest.fn();
    act(() => { renderer.create(<Leitor onScan={onScan} />); });
    bipar("20014");
    agora += 200;
    act(() => { jest.advanceTimersByTime(200); });
    bipar("85473363");
    act(() => { jest.advanceTimersByTime(150); });
    expect(onScan.mock.calls.map((c) => c[0])).toEqual(["2001485473363"]);
  });

  it("com Enter lê uma vez só (o temporizador não dispara de novo)", () => {
    const onScan = jest.fn();
    act(() => { renderer.create(<Leitor onScan={onScan} />); });
    bipar("7891234567895", "Enter");
    act(() => { jest.advanceTimersByTime(300); });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("7891234567895");
  });

  it("com Tab no fim também lê", () => {
    const onScan = jest.fn();
    act(() => { renderer.create(<Leitor onScan={onScan} />); });
    bipar("7891234567895", "Tab");
    act(() => { jest.advanceTimersByTime(300); });
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("digitação humana fora de campo não vira leitura", () => {
    const onScan = jest.fn();
    act(() => { renderer.create(<Leitor onScan={onScan} />); });
    for (const c of "abcdefgh") { tecla(c); agora += 200; }
    act(() => { jest.advanceTimersByTime(500); });
    expect(onScan).not.toHaveBeenCalled();
  });
});
