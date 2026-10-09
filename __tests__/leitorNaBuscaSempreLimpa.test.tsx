// 09/10/2026 — o leitor ainda escrevia na busca do Caixa e a leitura ainda
// partia ("20014" parado na busca + bipe de "85473363"). O tempo entre teclas
// era medido quando o código rodava; com a tela ocupada refazendo a lista, a
// pausa esticava além de qualquer tolerância. Agora o tempo é o do próprio
// evento de tecla e, confirmada a rajada, o resto do código nem chega ao
// campo: a busca fica sempre limpa e o código vai inteiro para o carrinho.
import React from "react";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const act = (React as any).act as (fn: () => void) => void;
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };

jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { criarLeitorDeCampo, TeclaDoCampo } from "@/utils/leituraRapida";
import { SearchBox } from "@/components/screens/pdv/SearchBox";

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

// Campo de mentira: a tecla entra no texto se ninguém a segurou.
function campo() {
  const c = {
    texto: "",
    lidos: [] as string[],
    historico: [] as string[], // tudo que o campo já mostrou
    enviados: [] as string[],  // Enter que passou (envio da busca)
    leitor: null as any,
    tecla(key: string, timeStamp: number, extra: Partial<TeclaDoCampo> = {}) {
      let segurou = false;
      c.leitor.tecla({ key, timeStamp, preventDefault: () => { segurou = true; }, ...extra });
      if (segurou) return;
      if (key.length === 1) { c.texto += key; c.historico.push(c.texto); }
      else if (key === "Enter") c.enviados.push(c.texto);
      else if (key === "Backspace") { c.texto = c.texto.slice(0, -1); c.historico.push(c.texto); }
    },
    digitar(txt: string, inicio: number, passo: number) {
      let t = inicio;
      for (const ch of txt) { c.tecla(ch, t); t += passo; }
      return t - passo;
    },
  };
  c.leitor = criarLeitorDeCampo({
    valor: () => c.texto,
    escrever: (v) => { c.texto = v; c.historico.push(v); },
    onLeitura: (code) => c.lidos.push(code),
  });
  return c;
}

describe("criarLeitorDeCampo", () => {
  it("leitura com Enter: código inteiro, campo limpo, Enter não envia a busca", () => {
    const c = campo();
    const fim = c.digitar("2001485473363", 1000, 8);
    c.tecla("Enter", fim + 8);
    expect(c.lidos).toEqual(["2001485473363"]);
    expect(c.texto).toBe("");
    expect(c.enviados).toEqual([]);
  });

  it("só os 3 primeiros caracteres chegam a aparecer no campo", () => {
    const c = campo();
    c.digitar("2001485473363", 1000, 8);
    const maisLongo = Math.max(...c.historico.map((h) => h.length));
    expect(maisLongo).toBe(3);
    expect(c.texto).toBe("");
  });

  it("leitura sem Enter fecha sozinha no silêncio", () => {
    const c = campo();
    c.digitar("7891234567895", 1000, 10);
    expect(c.lidos).toEqual([]);
    jest.advanceTimersByTime(200);
    expect(c.lidos).toEqual(["7891234567895"]);
    expect(c.texto).toBe("");
  });

  it("leitura com Tab no fim", () => {
    const c = campo();
    const fim = c.digitar("7891234567895", 1000, 10);
    let segurou = false;
    c.leitor.tecla({ key: "Tab", timeStamp: fim + 10, preventDefault: () => { segurou = true; } });
    expect(segurou).toBe(true);
    expect(c.lidos).toEqual(["7891234567895"]);
  });

  it("Finesse: a tela demora a atender as teclas, mas o horário do evento manda", () => {
    // As teclas chegaram a cada 8 ms; o código só as atendeu centenas de ms
    // depois (relógio de parede avança entre uma chamada e outra). Como o
    // leitor usa o timeStamp do evento, a leitura não parte.
    const c = campo();
    let t = 1000;
    for (const ch of "2001485473363") {
      c.tecla(ch, t);
      t += 8;
      jest.advanceTimersByTime(0);
    }
    c.tecla("Enter", t);
    expect(c.lidos).toEqual(["2001485473363"]);
    expect(c.texto).toBe("");
  });

  it("dois bipes em sequência, sem ninguém limpar a busca", () => {
    const c = campo();
    let fim = c.digitar("7891234567895", 1000, 10);
    c.tecla("Enter", fim + 10);
    fim = c.digitar("7890000000017", fim + 900, 10);
    c.tecla("Enter", fim + 10);
    expect(c.lidos).toEqual(["7891234567895", "7890000000017"]);
    expect(c.texto).toBe("");
  });

  it("dois bipes sem Enter, o segundo antes de o primeiro fechar pelo tempo", () => {
    const c = campo();
    const fim = c.digitar("7891234567895", 1000, 10);
    // nenhum timer rodou (tela ocupada); o segundo bipe chega 400 ms depois
    c.digitar("7890000000017", fim + 400, 10);
    jest.advanceTimersByTime(200);
    expect(c.lidos).toEqual(["7891234567895", "7890000000017"]);
    expect(c.texto).toBe("");
  });

  it("texto que a pessoa já tinha digitado fica; o código sai", () => {
    const c = campo();
    const fim = c.digitar("blusa", 1000, 180);
    const f2 = c.digitar("7891234567895", fim + 1500, 10);
    c.tecla("Enter", f2 + 10);
    expect(c.lidos).toEqual(["7891234567895"]);
    expect(c.texto).toBe("blusa");
  });

  it("soluço do leitor no meio do código não parte a leitura", () => {
    const c = campo();
    const a = c.digitar("20014", 1000, 10);
    const b = c.digitar("85473363", a + 150, 10);
    c.tecla("Enter", b + 10);
    expect(c.lidos).toEqual(["2001485473363"]);
    expect(c.texto).toBe("");
  });

  it("digitação normal continua sendo busca e o Enter envia", () => {
    const c = campo();
    const fim = c.digitar("camiseta", 1000, 170);
    c.tecla("Enter", fim + 300);
    jest.advanceTimersByTime(500);
    expect(c.lidos).toEqual([]);
    expect(c.texto).toBe("camiseta");
    expect(c.enviados).toEqual(["camiseta"]);
  });

  it("código digitado à mão (devagar) + Enter é busca, não leitura", () => {
    const c = campo();
    const fim = c.digitar("7891234567895", 1000, 150);
    c.tecla("Enter", fim + 200);
    expect(c.lidos).toEqual([]);
    expect(c.enviados).toEqual(["7891234567895"]);
  });

  it("rajada curta que foi engolida volta para o campo — ninguém perde tecla", () => {
    const c = campo();
    c.digitar("asdfg", 1000, 15); // 5 teclas esmagadas: confirma no 4º, mas é curto
    jest.advanceTimersByTime(200);
    expect(c.lidos).toEqual([]);
    expect(c.texto).toBe("asdfg");
  });

  it("tecla segurada (repetição) não vira leitura", () => {
    const c = campo();
    c.tecla("1", 1000);
    for (let i = 1; i < 12; i++) c.tecla("1", 1000 + i * 30, { repeat: true });
    jest.advanceTimersByTime(300);
    expect(c.lidos).toEqual([]);
  });

  it("atalho com Ctrl não entra na rajada", () => {
    const c = campo();
    for (let i = 0; i < 8; i++) c.leitor.tecla({ key: "v", timeStamp: 1000 + i * 5, ctrlKey: true, preventDefault: () => {} });
    jest.advanceTimersByTime(300);
    expect(c.lidos).toEqual([]);
  });
});

// A busca de verdade, no DOM, como no Caixa.
describe("SearchBox no navegador", () => {
  let host: HTMLDivElement;
  let root: Root;
  const onScan = jest.fn();
  const onSubmit = jest.fn();
  const valores: string[] = [];

  function Busca() {
    const [v, setV] = React.useState("");
    valores.push(v);
    return <SearchBox value={v} onChange={setV} onScan={onScan} onSubmit={onSubmit} />;
  }

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    onScan.mockClear(); onSubmit.mockClear(); valores.length = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(<Busca />); });
  });
  afterEach(() => { act(() => { root.unmount(); }); host.remove(); });

  const input = () => host.querySelector("input") as HTMLInputElement;
  const setNativo = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

  // Uma tecla como o navegador entrega: keydown e, se ninguém segurou, o texto muda.
  function tecla(key: string, timeStamp: number) {
    const el = input();
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    Object.defineProperty(ev, "timeStamp", { value: timeStamp });
    let passou = true;
    act(() => { passou = el.dispatchEvent(ev); });
    if (passou && key.length === 1) {
      act(() => {
        setNativo.call(el, el.value + key);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    return passou;
  }

  it("bipe com o cursor na busca: vai para onScan e a busca fica limpa", () => {
    let t = 5000;
    for (const ch of "2001485473363") { tecla(ch, t); t += 8; }
    const passou = tecla("Enter", t);
    expect(passou).toBe(false);
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("2001485473363");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input().value).toBe("");
    // a busca nunca mostrou mais que os 3 primeiros caracteres
    expect(Math.max(...valores.map((v) => v.length))).toBe(3);
  });

  it("bipe sem Enter, depois digitação normal", () => {
    let t = 5000;
    for (const ch of "7891234567895") { tecla(ch, t); t += 10; }
    act(() => { jest.advanceTimersByTime(200); });
    expect(onScan).toHaveBeenCalledWith("7891234567895");
    expect(input().value).toBe("");

    t += 2000;
    for (const ch of "blusa") { tecla(ch, t); t += 160; }
    act(() => { jest.advanceTimersByTime(500); });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(input().value).toBe("blusa");
  });
});
