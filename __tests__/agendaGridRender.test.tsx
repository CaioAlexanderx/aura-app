// ============================================================
// Agenda odonto — grade Semana/Dia (mockup 16/09/2026)
//
// Segura: cancelado fora da grade, bloco de 30 min em uma linha com o nome,
// consulta fora de 07–19h aparece (grade estica), status travado não arrasta,
// celular não arrasta, e o gesto completo: arrastar → PATCH com
// reject_on_conflict → aviso com Desfazer; soltar sobre outro paciente →
// "Encaixar" → PATCH sem reject_on_conflict.
// react-native mockado com tags simples (padrão de patientFormModalErros).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

let mockWidth = 1280;
jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { AgendaDentalWeek } from "@/components/verticals/odonto/AgendaDentalWeek";
import { AgendaDental } from "@/components/verticals/odonto/AgendaDental";

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).toISOString();
const appt = (id: string, name: string, iso: string, dur: number, status: string, extra: any = {}) => ({
  id, patient_name: name, scheduled_at: iso, duration_min: dur, status, practitioner_id: null, ...extra,
});

const WEEK = [
  appt("ana", "Ana Teste", at(16, 9), 30, "agendado"),
  appt("bruno", "Bruno Cedo", at(15, 6, 30), 30, "confirmado"),
  appt("carla", "Carla Cancelada", at(17, 10), 30, "cancelado"),
  appt("diego", "Diego Canal", at(16, 10, 30), 90, "em_atendimento"),
  appt("eva", "Eva Tarde", at(17, 14, 30), 60, "confirmado"),
];

const COL_W = 100;
const HOUR_COL = 52;
// Colunas (View com ref, testID agenda-col-N): COL_W px cada, topo em 0.
function nodeMock() {
  return (el: any) => {
    const i = Number(String(el.props?.testID || "").replace("agenda-col-", ""));
    return { getBoundingClientRect: () => ({ left: HOUR_COL + i * COL_W, right: HOUR_COL + (i + 1) * COL_W, top: 0 }) };
  };
}

function textOf(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return textOf(node.children);
}

function blocks(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll(n => (n.type as any) === "div" && n.props["data-appt-id"] !== undefined);
}
const block = (tree: renderer.ReactTestRenderer, id: string) =>
  blocks(tree).find(b => b.props["data-appt-id"] === id)!;

function fire(type: string, x: number, y: number) {
  act(() => { window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y })); });
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => { mockWidth = 1280; });

describe("Semana", () => {
  function renderWeek(onReschedule?: any) {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AgendaDentalWeek appointments={WEEK as any} anchorDate={new Date(2026, 8, 16)} onReschedule={onReschedule} />,
        { createNodeMock: nodeMock() },
      );
    });
    return tree;
  }

  it("não desenha cancelado; mostra consulta das 6h30 e 30 min numa linha com nome", () => {
    const tree = renderWeek(jest.fn());
    expect(blocks(tree).map(b => b.props["data-appt-id"]).sort()).toEqual(["ana", "bruno", "diego", "eva"]);
    const ana = block(tree, "ana");
    expect(ana.props.className).toContain("aag-t1");
    expect(ana.props.className).toContain("aag-dashed");
    expect(textOf(ana)).toContain("09:00");
    expect(textOf(ana)).toContain("Ana Teste");
    const hours = tree.root.findAll(n => (n.type as any) === "Text").map(textOf);
    expect(hours).toContain("06:00");
    expect(textOf(tree.root.findAll(n => (n.type as any) === "Text"))).toContain("Cancelados ficam fora da grade");
  });

  it("status travado não arrasta; sem onReschedule nada arrasta", () => {
    let tree = renderWeek(jest.fn());
    expect(block(tree, "ana").props.className).toContain("aag-movable");
    expect(block(tree, "diego").props.className).not.toContain("aag-movable");
    expect(block(tree, "diego").props.onPointerDown).toBeUndefined();
    tree = renderWeek(undefined);
    expect(block(tree, "ana").props.className).not.toContain("aag-movable");
  });

  it("arrastar grava com reject_on_conflict e oferece Desfazer", async () => {
    const onReschedule = jest.fn().mockResolvedValue({ status: "ok", conflicts: [] });
    const onPress = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AgendaDentalWeek appointments={WEEK as any} anchorDate={new Date(2026, 8, 16)} onReschedule={onReschedule} onAppointmentPress={onPress} />,
        { createNodeMock: nodeMock() },
      );
    });
    // grade começa às 6h (Bruno 06:30); Ana (qua = coluna 2) às 9h → topo 168
    const ana = block(tree, "ana");
    const down = { pointerType: "mouse", button: 0, clientX: HOUR_COL + 2 * COL_W + 10, clientY: 170, currentTarget: { getBoundingClientRect: () => ({ top: 168 }) }, preventDefault: jest.fn() };
    act(() => { ana.props.onPointerDown(down); });
    // qui (coluna 3), 13h00: 2px abaixo do topo pego
    fire("pointermove", HOUR_COL + 3 * COL_W + 10, (13 - 6) * 56 + 2);
    const label = tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-label"));
    expect(textOf(label[0])).toBe("Qui 17 · 13:00");
    expect(block(tree, "ana").props.className).toContain("aag-src");
    fire("pointerup", HOUR_COL + 3 * COL_W + 10, (13 - 6) * 56 + 2);
    await flush();

    expect(onReschedule).toHaveBeenCalledWith("ana", { scheduled_at: at(17, 13) }, { rejectOnConflict: true });
    // o click que segue o pointerup não abre o detalhe
    act(() => { block(tree, "ana").props.onClick(); });
    expect(onPress).not.toHaveBeenCalled();

    const texts = textOf(tree.root.findAll(n => (n.type as any) === "Text"));
    expect(texts).toContain("Consulta de Ana movida para qui 17 às 13:00");
    const undo = tree.root.findAll(n => (n.type as any) === "Pressable" && textOf(n) === "Desfazer");
    expect(undo).toHaveLength(1);
    await act(async () => { await undo[0].props.onPress(); });
    expect(onReschedule).toHaveBeenLastCalledWith("ana", { scheduled_at: at(16, 9) }, { rejectOnConflict: false });
  });

  it("soltar sobre outro paciente pergunta; Encaixar grava sem reject_on_conflict", async () => {
    const onReschedule = jest.fn().mockResolvedValue({ status: "ok", conflicts: [] });
    const tree = renderWeek(onReschedule);
    const ana = block(tree, "ana");
    act(() => {
      ana.props.onPointerDown({ pointerType: "mouse", button: 0, clientX: 262, clientY: 168, currentTarget: { getBoundingClientRect: () => ({ top: 168 }) } });
    });
    const y = (14 * 60 + 45 - 6 * 60) / 60 * 56; // qui 14:45, dentro da Eva (14:30–15:30)
    fire("pointermove", HOUR_COL + 3 * COL_W + 5, y);
    fire("pointerup", HOUR_COL + 3 * COL_W + 5, y);
    await flush();
    expect(onReschedule).not.toHaveBeenCalled();
    const texts = textOf(tree.root.findAll(n => (n.type as any) === "Text"));
    expect(texts).toContain("Esse horário já tem Eva (14:30–15:30).");
    expect(textOf(tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-label"))))
      .toBe("Qui 17 · 14:45 · sobre Eva");

    const fit = tree.root.findAll(n => (n.type as any) === "Pressable" && textOf(n) === "Encaixar")[0];
    await act(async () => { fit.props.onPress(); });
    await flush();
    expect(onReschedule).toHaveBeenCalledWith("ana", { scheduled_at: at(17, 14, 45) }, { rejectOnConflict: false });
    expect(textOf(tree.root.findAll(n => (n.type as any) === "Text"))).toContain("como encaixe");
  });

  it("409 do servidor abre o aviso; erro de rede mostra erro", async () => {
    const onReschedule = jest.fn()
      .mockResolvedValueOnce({ status: "conflict", conflicts: [{ id: "x", patient_name: "Zeca Outro", scheduled_at: at(18, 9), duration_min: 30 }] })
      .mockResolvedValueOnce({ status: "error", message: "Sem conexão" });
    const tree = renderWeek(onReschedule);
    const drag = (toCol: number, h: number) => {
      act(() => {
        block(tree, "ana").props.onPointerDown({ pointerType: "mouse", button: 0, clientX: 262, clientY: 168, currentTarget: { getBoundingClientRect: () => ({ top: 168 }) } });
      });
      fire("pointermove", HOUR_COL + toCol * COL_W + 5, (h - 6) * 56);
      fire("pointerup", HOUR_COL + toCol * COL_W + 5, (h - 6) * 56);
    };
    drag(4, 9);
    await flush();
    expect(textOf(tree.root.findAll(n => (n.type as any) === "Text"))).toContain("Esse horário já tem Zeca (09:00–09:30).");
    const naoMover = tree.root.findAll(n => (n.type as any) === "Pressable" && textOf(n) === "Não mover")[0];
    act(() => { naoMover.props.onPress(); });
    drag(4, 11);
    await flush();
    expect(textOf(tree.root.findAll(n => (n.type as any) === "Text"))).toContain("Sem conexão");
  });

  it("toque não arrasta e Esc cancela", () => {
    const onReschedule = jest.fn();
    const tree = renderWeek(onReschedule);
    act(() => {
      block(tree, "ana").props.onPointerDown({ pointerType: "touch", button: 0, clientX: 262, clientY: 168, currentTarget: {} });
    });
    fire("pointermove", 400, 500);
    expect(tree.root.findAll(n => String(n.props?.className || "").includes("aag-target"))).toHaveLength(0);

    act(() => {
      block(tree, "ana").props.onPointerDown({ pointerType: "mouse", button: 0, clientX: 262, clientY: 168, currentTarget: { getBoundingClientRect: () => ({ top: 168 }) } });
    });
    fire("pointermove", 400, 500);
    expect(tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-target"))).toHaveLength(1);
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-target"))).toHaveLength(0);
    fire("pointerup", 400, 500);
    expect(onReschedule).not.toHaveBeenCalled();
  });

  it("redimensionar pela borda muda só a duração", async () => {
    const onReschedule = jest.fn().mockResolvedValue({ status: "ok", conflicts: [] });
    const tree = renderWeek(onReschedule);
    const rs = block(tree, "ana").findAll(n => (n.type as any) === "div" && n.props.className === "aag-rs")[0];
    const stop = jest.fn();
    act(() => {
      rs.props.onPointerDown({ pointerType: "mouse", button: 0, clientX: 262, clientY: 194, currentTarget: {}, stopPropagation: stop });
    });
    expect(stop).toHaveBeenCalled();
    const y = (9.75 - 6) * 56; // fim 09:45
    fire("pointermove", 262, y);
    expect(textOf(tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-label"))))
      .toBe("45 min · 09:00–09:45");
    fire("pointerup", 262, y);
    await flush();
    expect(onReschedule).toHaveBeenCalledWith("ana", { duration_min: 45 }, { rejectOnConflict: true });
  });
});

describe("Dia", () => {
  const DAY = [
    appt("a1", "Ana Paula", at(16, 7, 30), 60, "confirmado", { patient_phone: "(11) 98765-4321", chief_complaint: "Clareamento", allergies: "Penicilina", chair: "Cadeira 1" }),
    appt("a2", "Beto Encaixe", at(16, 7, 45), 30, "agendado", { chair: "Cadeira 1" }),
    appt("a3", "Caio Cancelado", at(16, 9), 30, "cancelado", { chair: "Cadeira 1" }),
  ];

  it("linha do tempo: duas consultas na mesma hora, hora 07:30 certa, procedimento/telefone/alergia", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AgendaDental appointments={DAY as any} chairs={[{ label: "Cadeira 1" }]} date={new Date(2026, 8, 16)} onReschedule={jest.fn()} />,
        { createNodeMock: nodeMock() },
      );
    });
    expect(blocks(tree).map(b => b.props["data-appt-id"]).sort()).toEqual(["a1", "a2"]);
    const a1 = textOf(block(tree, "a1"));
    expect(a1).toContain("07:30–08:30");
    expect(a1).toContain("Clareamento · (11) 98765-4321");
    expect(a1).toContain("Alergia: Penicilina");
    expect(block(tree, "a1").props.style.width).toBe("calc(50% - 4px)");
    expect(block(tree, "a1").props.className).toContain("aag-movable");
  });

  it("celular: sem arrastar, toque abre o detalhe", () => {
    mockWidth = 375;
    const onPress = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AgendaDental appointments={DAY as any} date={new Date(2026, 8, 16)} onReschedule={jest.fn()} onAppointmentPress={onPress} />,
        { createNodeMock: nodeMock() },
      );
    });
    const b = block(tree, "a1");
    expect(b.props.className).not.toContain("aag-movable");
    expect(b.props.onPointerDown).toBeUndefined();
    act(() => { b.props.onClick(); });
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
    expect(textOf(tree.root.findAll(n => (n.type as any) === "Text"))).toContain("Toque numa consulta");
  });

  it("trocar de cadeira manda o dentista da cadeira nova; cadeira sem dentista não recebe", async () => {
    const onReschedule = jest.fn().mockResolvedValue({ status: "ok", conflicts: [] });
    const chairs = [
      { label: "Cadeira 1 - Dra. Marina", practitionerId: "p1" },
      { label: "Cadeira 2 - Dr. Paulo", practitionerId: "p2" },
      { label: "Cadeira 3" },
    ];
    const appts = [appt("m1", "Marcos", at(16, 10), 30, "agendado", { practitioner_id: "p1" })];
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AgendaDental appointments={appts as any} chairs={chairs} date={new Date(2026, 8, 16)} onReschedule={onReschedule} />,
        { createNodeMock: nodeMock() },
      );
    });
    const top = (10 - 7) * 76;
    const start = () => act(() => {
      block(tree, "m1").props.onPointerDown({ pointerType: "mouse", button: 0, clientX: 60, clientY: top, currentTarget: { getBoundingClientRect: () => ({ top }) } });
    });
    // cadeira 3 (sem dentista): fica na cadeira 1
    start();
    fire("pointermove", HOUR_COL + 2 * COL_W + 5, (11 - 7) * 76);
    fire("pointerup", HOUR_COL + 2 * COL_W + 5, (11 - 7) * 76);
    await flush();
    expect(onReschedule).toHaveBeenLastCalledWith("m1", { scheduled_at: at(16, 11) }, { rejectOnConflict: true });
    // cadeira 2
    start();
    fire("pointermove", HOUR_COL + COL_W + 5, top);
    fire("pointerup", HOUR_COL + COL_W + 5, top);
    await flush();
    expect(onReschedule).toHaveBeenLastCalledWith("m1", { scheduled_at: at(16, 10), practitioner_id: "p2" }, { rejectOnConflict: true });
  });
});
