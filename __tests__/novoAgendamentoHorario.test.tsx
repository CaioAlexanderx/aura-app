// ============================================================
// NewAppointmentModal × horário de funcionamento (mockup do horário, parte 2)
//  1. Novo agendamento começa com a duração padrão da clínica
//     (45 → chip; 20 → "Outra"); editar mantém a duração da consulta.
//  2. Horário fora do turno mostra o aviso âmbar e salva normalmente;
//     voltar para dentro do turno some com o aviso.
//  3. Sem horário salvo: sem aviso, duração 60.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
  useWindowDimensions: () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
}));

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/verticals/odonto/NewPatientModal", () => ({ NewPatientModal: () => null }));
jest.mock("@/services/dentalConfigApi", () => ({
  dentalConfigApi: { getSettings: jest.fn(), listPractitioners: jest.fn(), getHours: jest.fn() },
}));

const mockNotify = jest.fn();
jest.mock("@/utils/webAlert", () => ({ notify: (...a: any[]) => mockNotify(...a), confirmAlert: jest.fn() }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = { company: { id: "empresa-1", name: "Sorriso Duarte" } };
    return sel ? sel(st) : st;
  },
}));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

let mockHours: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: (opts: any) => {
    const k = opts.queryKey[0];
    if (k === "dental-hours") return { data: mockHours, isLoading: false };
    if (k === "dental-agenda-day") return { data: { appointments: [] } };
    if (k === "dental-settings") return { data: { settings: { chairs_active: [true], chair_practitioner_ids: ["p1"] } } };
    if (k === "dental-practitioners") return { data: { practitioners: [{ id: "p1", name: "Dra. Marina" }] } };
    return { data: undefined };
  },
  useMutation: (opts: any) => ({
    isPending: false,
    mutate: (vars: any, cb: any = {}) => {
      Promise.resolve()
        .then(() => opts.mutationFn(vars))
        .then((res: any) => { opts.onSuccess?.(res, vars); cb.onSuccess?.(res); })
        .catch((err: any) => { opts.onError?.(err, vars); cb.onError?.(err); });
    },
  }),
}));

import { NewAppointmentModal } from "@/components/verticals/odonto/NewAppointmentModal";

const shifts = [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }];
const configured = (interval: number | null) => ({
  configured: true,
  default_interval_min: interval,
  hours: [1, 2, 3, 4, 5].map((w) => ({ weekday: w, open: true, shifts })),
});

const one = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false })[0];
const all = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const timeInput = (t: renderer.ReactTestRenderer) => t.root.find((n) => n.type === "input" && n.props["data-testid"] === "appt-time");

async function render(props: any) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<NewAppointmentModal visible onClose={jest.fn()} {...props} />);
  });
  return tree;
}
async function flush(fn: () => void) {
  await act(async () => { fn(); for (let i = 0; i < 5; i++) await Promise.resolve(); });
}

// 14/09/2026 = segunda
const mon = (h: number, m = 0) => new Date(2026, 8, 14, h, m).toISOString();
const patient = { id: "pac-1", name: "Igor Martins", phone: "(11) 96543-2100" };

describe("Novo agendamento × horário da clínica", () => {
  beforeEach(() => {
    mockRequest.mockReset().mockResolvedValue({ appointment: { id: "novo" }, conflicts: [], outside_hours: true });
    mockNotify.mockReset();
  });

  it("duração padrão da clínica: 45 vira o chip marcado", async () => {
    mockHours = configured(45);
    const t = await render({ initialDateTime: mon(9) });
    expect(one(t, "appt-dur-45").props.on).toBe(true);
    expect(one(t, "appt-dur-60").props.on).toBe(false);
    expect(all(t, "appt-outside-hours")).toHaveLength(0);
    t.unmount();
  });

  it("duração padrão fora dos chips vai para Outra", async () => {
    mockHours = configured(20);
    const t = await render({ initialDateTime: mon(9) });
    expect(one(t, "appt-dur-custom").props.value).toBe("20");
    t.unmount();
  });

  it("editar mantém a duração da consulta", async () => {
    mockHours = configured(45);
    const t = await render({
      appointment: { id: "ap-1", customer_id: "pac-1", patient_name: "Igor", scheduled_at: mon(9), duration_min: 90, practitioner_id: "p1", status: "agendado" },
    });
    expect(one(t, "appt-dur-90").props.on).toBe(true);
    t.unmount();
  });

  it("fora do horário: aviso âmbar, salva normalmente como encaixe", async () => {
    mockHours = configured(30);
    const onSaved = jest.fn();
    const t = await render({ initialDateTime: mon(18, 30), initialPatient: patient, onSaved });
    const warn = one(t, "appt-outside-hours");
    expect(warn).toBeTruthy();
    const text = t.root.findAll((n) => (n.type as any) === "Text").map((n) => n.props.children).flat().join("");
    expect(text).toContain("Fora do horário de funcionamento — será marcado como encaixe");
    expect(one(t, "appt-save").props.label).toBe("Agendar");

    // 11:45 + 30 min passa do fim do turno → ainda fora
    await flush(() => timeInput(t).props.onChange({ target: { value: "11:45" } }));
    expect(all(t, "appt-outside-hours")).toHaveLength(1);
    // almoço
    await flush(() => timeInput(t).props.onChange({ target: { value: "12:30" } }));
    expect(all(t, "appt-outside-hours")).toHaveLength(1);
    // dentro do turno → some
    await flush(() => timeInput(t).props.onChange({ target: { value: "10:00" } }));
    expect(all(t, "appt-outside-hours")).toHaveLength(0);

    await flush(() => timeInput(t).props.onChange({ target: { value: "18:30" } }));
    await flush(() => one(t, "appt-save").props.onPress());
    expect(mockRequest).toHaveBeenCalledWith(
      "/companies/empresa-1/dental/appointments",
      expect.objectContaining({ method: "POST", body: expect.objectContaining({ duration_min: 30, scheduled_at: mon(18, 30) }) }),
    );
    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining("como encaixe"));
    expect(onSaved).toHaveBeenCalledWith({ id: "novo" });
    t.unmount();
  });

  it("sem horário salvo: sem aviso e 60 min", async () => {
    mockHours = { configured: false, default_interval_min: 30, hours: [] };
    const t = await render({ initialDateTime: mon(22) });
    expect(all(t, "appt-outside-hours")).toHaveLength(0);
    expect(one(t, "appt-dur-60").props.on).toBe(true);
    t.unmount();
  });
});
