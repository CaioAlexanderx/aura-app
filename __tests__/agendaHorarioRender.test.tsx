// ============================================================
// Agenda odonto × horário de funcionamento (mockup do horário, parte 2)
//
// Segura: fundo hachurado + almoço na Semana, dia fechado com "Fechado",
// domingo some se fechado e sem consultas (aparece se abrir), arrastar para
// fora do horário avisa no rótulo e no aviso final (sem bloquear), Dia com
// "Fechado", legenda/link e aviso sem horário salvo.
// react-native mockado com tags simples (padrão de agendaGridRender).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { AgendaDentalWeek } from "@/components/verticals/odonto/AgendaDentalWeek";
import { AgendaDental } from "@/components/verticals/odonto/AgendaDental";
import { ClinicHoursLegend } from "@/components/verticals/odonto/AgendaGridParts";
import { normalizeClinicHours } from "@/utils/clinicHours";

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).toISOString();
const appt = (id: string, name: string, iso: string, dur: number, status: string) => ({
  id, patient_name: name, scheduled_at: iso, duration_min: dur, status, practitioner_id: null,
});

const twoShifts = [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }];
const HOURS = normalizeClinicHours([1, 2, 3, 4, 5].map(w => ({ weekday: w, open: true, shifts: twoShifts })));
const CLINIC = { configured: true, hours: HOURS }; // sáb e dom fechados
const WITH_SUNDAY = {
  configured: true,
  hours: normalizeClinicHours([...HOURS, { weekday: 7, open: true, shifts: [{ start: "08:00", end: "12:00" }] }]),
};

const COL_W = 100;
const HOUR_COL = 52;
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
const byTestId = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll(n => typeof n.type === "string" && (n.props.testID === id || n.props["data-testid"] === id));
const allText = (t: renderer.ReactTestRenderer) => textOf(t.root.findAll(n => (n.type as any) === "Text"));

function fire(type: string, x: number, y: number) {
  act(() => { window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y })); });
}
async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function renderWeek(props: any) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <AgendaDentalWeek anchorDate={new Date(2026, 8, 16)} startHour={7} endHour={19} {...props} />,
      { createNodeMock: nodeMock() },
    );
  });
  return tree;
}

describe("Semana com horário da clínica", () => {
  it("pinta hachura, turnos e almoço; sábado fechado; domingo some", () => {
    const tree = renderWeek({ appointments: [], clinic: CLINIC });
    // seg–sáb: 6 colunas, uma camada de fundo por coluna
    expect(byTestId(tree, "agenda-clinic-bg")).toHaveLength(6);
    expect(byTestId(tree, "agenda-hatch")).toHaveLength(6);
    expect(byTestId(tree, "agenda-band-open")).toHaveLength(10);
    const lunch = byTestId(tree, "agenda-band-lunch");
    expect(lunch).toHaveLength(5);
    expect(textOf(lunch[0])).toBe("Almoço");
    // almoço 12–14 com a grade começando às 7h e 56px/h
    expect(lunch[0].props.style).toEqual(expect.arrayContaining([{ top: 5 * 56, height: 2 * 56 }]));
    // cabeçalho e rótulo do sábado
    expect(textOf(byTestId(tree, "agenda-day-closed-5"))).toBe("Fechado");
    expect(byTestId(tree, "agenda-closed-label")).toHaveLength(1);
    expect(byTestId(tree, "agenda-col-6")).toHaveLength(0);
  });

  it("horas fechadas continuam clicáveis e o rótulo acessível avisa", () => {
    const onSlotPress = jest.fn();
    const tree = renderWeek({ appointments: [], clinic: CLINIC, onSlotPress });
    const slot = tree.root.findAll(n => (n.type as any) === "Pressable" && n.props.accessibilityLabel === "Agendar Seg 14 às 18:30 (fora do horário)");
    expect(slot).toHaveLength(1);
    act(() => { slot[0].props.onPress(); });
    expect(onSlotPress).toHaveBeenCalledWith(new Date(2026, 8, 14, 18, 30));
    expect(tree.root.findAll(n => n.props?.accessibilityLabel === "Agendar Seg 14 às 09:00")).toHaveLength(1);
  });

  it("domingo aparece se abrir, ou se tiver consulta mesmo fechado", () => {
    let tree = renderWeek({ appointments: [], clinic: WITH_SUNDAY });
    expect(byTestId(tree, "agenda-col-6")).toHaveLength(1);
    tree = renderWeek({ appointments: [appt("z", "Zeca Domingo", at(20, 10), 30, "agendado")], clinic: CLINIC });
    expect(byTestId(tree, "agenda-col-6")).toHaveLength(1);
    expect(textOf(byTestId(tree, "agenda-day-closed-6"))).toBe("Fechado · 1 consulta");
  });

  it("sem horário salvo a grade fica lisa (como antes)", () => {
    const tree = renderWeek({ appointments: [], clinic: { configured: false, hours: HOURS } });
    expect(byTestId(tree, "agenda-clinic-bg")).toHaveLength(0);
    expect(allText(tree)).not.toContain("Fechado");
  });

  it("arrastar para fora do horário avisa no rótulo e grava como encaixe", async () => {
    const onReschedule = jest.fn().mockResolvedValue({ status: "ok", conflicts: [], outsideHours: true });
    const tree = renderWeek({ appointments: [appt("ana", "Ana Teste", at(16, 9), 30, "agendado")], clinic: CLINIC, onReschedule });
    const ana = tree.root.find(n => (n.type as any) === "div" && n.props["data-appt-id"] === "ana");
    // Ana (qua, coluna 2) às 9h → topo (9-7)*56 = 112; pega 2px abaixo do topo
    act(() => {
      ana.props.onPointerDown({
        pointerType: "mouse", button: 0, clientX: HOUR_COL + 2 * COL_W + 10, clientY: 114,
        currentTarget: { getBoundingClientRect: () => ({ top: 112 }) }, preventDefault: jest.fn(),
      });
    });
    const y = (18.5 - 7) * 56 + 2; // qui 18:30
    fire("pointermove", HOUR_COL + 3 * COL_W + 10, y);
    const label = tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-label"));
    expect(textOf(label[0])).toBe("Qui 17 · 18:30 · fora do horário");
    const target = tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-target"));
    expect(target[0].props.className).toContain("aag-warn");
    fire("pointerup", HOUR_COL + 3 * COL_W + 10, y);
    await flush();
    expect(onReschedule).toHaveBeenCalledWith("ana", { scheduled_at: at(17, 18, 30) }, { rejectOnConflict: true });
    expect(allText(tree)).toContain("Consulta de Ana movida para qui 17 às 18:30 como encaixe fora do horário");
  });

  it("dentro do horário, o rótulo e o aviso não mudam", async () => {
    const onReschedule = jest.fn().mockResolvedValue({ status: "ok", conflicts: [] });
    const tree = renderWeek({ appointments: [appt("ana", "Ana Teste", at(16, 9), 30, "agendado")], clinic: CLINIC, onReschedule });
    const ana = tree.root.find(n => (n.type as any) === "div" && n.props["data-appt-id"] === "ana");
    act(() => {
      ana.props.onPointerDown({
        pointerType: "mouse", button: 0, clientX: HOUR_COL + 2 * COL_W + 10, clientY: 114,
        currentTarget: { getBoundingClientRect: () => ({ top: 112 }) }, preventDefault: jest.fn(),
      });
    });
    fire("pointermove", HOUR_COL + 3 * COL_W + 10, (10 - 7) * 56 + 2);
    const label = tree.root.findAll(n => (n.type as any) === "div" && String(n.props.className || "").includes("aag-label"));
    expect(textOf(label[0])).toBe("Qui 17 · 10:00");
    fire("pointerup", HOUR_COL + 3 * COL_W + 10, (10 - 7) * 56 + 2);
    await flush();
    const text = allText(tree);
    expect(text).toContain("Consulta de Ana movida para qui 17 às 10:00");
    expect(text).not.toContain("encaixe");
  });
});

describe("Dia com horário da clínica", () => {
  it("dia fechado: hachura, Fechado no cabeçalho e na coluna", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AgendaDental appointments={[]} date={new Date(2026, 8, 19)} startHour={7} endHour={19} clinic={CLINIC} />,
        { createNodeMock: nodeMock() },
      );
    });
    expect(byTestId(tree, "agenda-hatch")).toHaveLength(1);
    expect(byTestId(tree, "agenda-closed-label")).toHaveLength(1);
    expect(allText(tree)).toContain("Fechado · 0 consultas");
  });

  it("dia aberto: turnos e almoço", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AgendaDental appointments={[]} date={new Date(2026, 8, 16)} startHour={7} endHour={19} clinic={CLINIC} />,
        { createNodeMock: nodeMock() },
      );
    });
    expect(byTestId(tree, "agenda-band-open")).toHaveLength(2);
    expect(textOf(byTestId(tree, "agenda-band-lunch"))).toBe("Almoço");
    expect(byTestId(tree, "agenda-closed-label")).toHaveLength(0);
  });
});

describe("Legenda do horário", () => {
  it("com horário: três itens e o link", () => {
    const onOpen = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ClinicHoursLegend configured onOpenSettings={onOpen} />); });
    const text = allText(tree);
    expect(text).toContain("Atendimento");
    expect(text).toContain("Intervalo (almoço)");
    expect(text).toContain("Fechado · ainda clicável");
    const link = byTestId(tree, "agenda-hours-link")[0];
    expect(textOf(link)).toBe("Horário de funcionamento");
    act(() => { link.props.onPress(); });
    expect(onOpen).toHaveBeenCalled();
  });

  it("sem horário: aviso discreto com link para definir", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ClinicHoursLegend configured={false} onOpenSettings={jest.fn()} />); });
    expect(textOf(byTestId(tree, "agenda-hours-link")[0])).toBe("Defina o horário de funcionamento");
    expect(allText(tree)).not.toContain("Atendimento");
  });
});
