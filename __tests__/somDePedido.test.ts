// ============================================================
// Som de pedido novo (10/09/2026): ligado por padrão, desligável por
// navegador, sem tocar três vezes no mesmo segundo.
// ============================================================
import { somLigado, definirSom, tocarAvisoDePedido, instalarDesbloqueioDoSom, _resetSom } from "@/utils/somDePedido";

function audioFalso() {
  const tocadas: number[] = [];
  const ctx: any = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: jest.fn().mockResolvedValue(undefined),
    createGain: () => ({ connect: jest.fn(), gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() } }),
    createOscillator: () => {
      const osc: any = { type: "", frequency: { value: 0 }, connect: jest.fn(), stop: jest.fn() };
      osc.start = jest.fn(() => tocadas.push(osc.frequency.value));
      return osc;
    },
  };
  (window as any).AudioContext = jest.fn(() => ctx);
  return { ctx, tocadas };
}

beforeEach(() => {
  _resetSom();
  window.localStorage.clear();
  delete (window as any).AudioContext;
});

test("ligado por padrão", () => {
  expect(somLigado()).toBe(true);
});

test("desligar vale para este navegador e silencia o toque", () => {
  audioFalso();
  definirSom(false);
  expect(somLigado()).toBe(false);
  expect(tocarAvisoDePedido(10_000)).toBe(false);
  definirSom(true);
  expect(tocarAvisoDePedido(10_000)).toBe(true);
});

test("toca duas notas, subindo", () => {
  const { tocadas } = audioFalso();
  expect(tocarAvisoDePedido(10_000)).toBe(true);
  expect(tocadas).toEqual([659.25, 880]);
});

test("três pedidos no mesmo segundo tocam uma vez", () => {
  const { tocadas } = audioFalso();
  expect(tocarAvisoDePedido(10_000)).toBe(true);
  expect(tocarAvisoDePedido(11_000)).toBe(false);
  expect(tocarAvisoDePedido(12_500)).toBe(false);
  expect(tocarAvisoDePedido(13_500)).toBe(true);
  expect(tocadas).toHaveLength(4);
});

test("navegador sem WebAudio não quebra", () => {
  expect(tocarAvisoDePedido(10_000)).toBe(false);
});

test("o primeiro clique destrava o áudio suspenso", () => {
  const { ctx } = audioFalso();
  ctx.state = "suspended";
  instalarDesbloqueioDoSom();
  window.dispatchEvent(new Event("pointerdown"));
  expect(ctx.resume).toHaveBeenCalled();
});
