// ============================================================
// NewAppointmentModal em modo edição (mockup agenda 16/09/2026, aba D).
//  1. Conflito aparece abaixo da hora, com "Usar HH:MM · próximo livre";
//     o botão vira "Salvar como encaixe".
//  2. Mudou o horário: "antes → agora" e "Avisar no WhatsApp".
//  3. Remarcar uma falta manda status=agendado junto com scheduled_at e
//     abre o WhatsApp com o aviso de remarcação no mesmo clique.
//  4. Uma cadeira só: chip fixo "Cadeira 1 · <dentista>".
//  5. Cancelado vira agendamento novo (POST), sem mexer no cancelado.
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
jest.mock("@/services/dentalConfigApi", () => ({ dentalConfigApi: { getSettings: jest.fn(), listPractitioners: jest.fn() } }));

const mockNotify = jest.fn();
jest.mock("@/utils/webAlert", () => ({ notify: (...a: any[]) => mockNotify(...a), confirmAlert: jest.fn() }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Sorriso Duarte" } }),
}));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

const at = (h: number, m = 0) => new Date(2026, 8, 17, h, m).toISOString();
const mockDay = [
  { id: "b", patient_name: "Bruno", scheduled_at: at(14), duration_min: 30, practitioner_id: "p1", status: "agendado" },
  { id: "c", patient_name: "Carla", scheduled_at: at(14, 30), duration_min: 30, practitioner_id: "p1", status: "confirmado" },
  { id: "d", patient_name: "Diego", scheduled_at: at(15), duration_min: 60, practitioner_id: "p1", status: "confirmado" },
];
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    cancelQueries: jest.fn(() => Promise.resolve()),
    getQueriesData: jest.fn(() => []),
    setQueriesData: jest.fn(),
    setQueryData: jest.fn(),
  }),
  useQuery: (opts: any) => {
    const k = opts.queryKey[0];
    if (k === "dental-agenda-day") return { data: { appointments: mockDay } };
    if (k === "dental-settings") return { data: { settings: { chairs_active: [true, false], chair_practitioner_ids: ["p1", null] } } };
    if (k === "dental-practitioners") return { data: { practitioners: [{ id: "p1", name: "Dra. Marina" }] } };
    return { data: undefined };
  },
  useMutation: (opts: any) => ({
    isPending: false,
    mutate: (vars: any, cb: any = {}) => {
      Promise.resolve()
        .then(() => opts.onMutate?.(vars))
        .then(() => opts.mutationFn(vars))
        .then((res: any) => { opts.onSuccess?.(res, vars); cb.onSuccess?.(res); })
        .catch((err: any) => { opts.onError?.(err, vars); cb.onError?.(err); })
        .finally(() => cb.onSettled?.());
    },
  }),
}));

import { NewAppointmentModal } from "@/components/verticals/odonto/NewAppointmentModal";

const appt = {
  id: "ap-1",
  customer_id: "pac-1",
  patient_name: "Igor Martins",
  patient_phone: "(11) 96543-2100",
  scheduled_at: at(16),
  duration_min: 60,
  practitioner_id: "p1",
  chief_complaint: "Avaliação ortodôntica",
  status: "faltou",
};

const one = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false })[0];
const all = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const timeInput = (t: renderer.ReactTestRenderer) => t.root.find((n) => n.type === "input" && n.props["data-testid"] === "appt-time");

async function render(a: any, onSaved = jest.fn()) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<NewAppointmentModal visible appointment={a} onClose={jest.fn()} onSaved={onSaved} />);
  });
  return tree;
}
async function flush(fn: () => void) {
  await act(async () => { fn(); for (let i = 0; i < 5; i++) await Promise.resolve(); });
}

describe("Editar agendamento", () => {
  let openSpy: jest.SpyInstance;
  beforeEach(() => {
    mockRequest.mockReset().mockResolvedValue({ appointment: { id: "ap-1" }, conflicts: [] });
    mockNotify.mockReset();
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => openSpy.mockRestore());

  it("sem mudança: sem conflito, sem antes → agora, Salvar alterações, cadeira fixa", async () => {
    const t = await render(appt);
    expect(all(t, "appt-conflict")).toHaveLength(0);
    expect(all(t, "appt-diff")).toHaveLength(0);
    expect(one(t, "appt-save").props.label).toBe("Salvar alterações");
    expect(one(t, "appt-chair-fixed").props.label).toBe("Cadeira 1 · Dra. Marina");
    t.unmount();
  });

  it("conflito aparece com o próximo livre e vira encaixe", async () => {
    const t = await render(appt);
    await flush(() => timeInput(t).props.onChange({ target: { value: "14:00" } }));
    expect(one(t, "appt-conflict")).toBeTruthy();
    expect(one(t, "appt-save").props.label).toBe("Salvar como encaixe");
    expect(one(t, "appt-use-free").props.label).toBe("Usar 16:00 · próximo livre");
    await flush(() => one(t, "appt-use-free").props.onPress());
    expect(all(t, "appt-conflict")).toHaveLength(0);
    t.unmount();
  });

  it("remarcar falta: antes → agora, volta para agendado e avisa no WhatsApp", async () => {
    const onSaved = jest.fn();
    const t = await render(appt, onSaved);
    await flush(() => timeInput(t).props.onChange({ target: { value: "17:30" } }));
    expect(one(t, "appt-diff")).toBeTruthy();
    expect(one(t, "appt-notify").props.value).toBe(true);
    await flush(() => one(t, "appt-save").props.onPress());

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(openSpy.mock.calls[0][0])).toContain("foi remarcada para quinta, 17/09, às 17:30");
    expect(mockRequest).toHaveBeenCalledWith("/companies/empresa-1/dental/appointments/ap-1", {
      method: "PATCH",
      body: { scheduled_at: at(17, 30), status: "agendado" },
    });
    expect(onSaved).toHaveBeenCalledWith({ id: "ap-1" });
    expect(mockNotify.mock.calls[0][0]).toBe("Consulta de Igor remarcada para qui 17 às 17:30 · WhatsApp aberto com o aviso");
    t.unmount();
  });

  it("sem avisar: desmarcar a caixa não abre o WhatsApp", async () => {
    const t = await render({ ...appt, status: "confirmado" });
    await flush(() => timeInput(t).props.onChange({ target: { value: "17:30" } }));
    await flush(() => one(t, "appt-notify").props.onChange(false));
    await flush(() => one(t, "appt-save").props.onPress());
    expect(openSpy).not.toHaveBeenCalled();
    expect(mockRequest.mock.calls[0][1].body).toEqual({ scheduled_at: at(17, 30) });
    t.unmount();
  });

  it("cancelado: remarcar cria agendamento novo", async () => {
    mockRequest.mockReset().mockResolvedValue({ appointment: { id: "novo" }, conflicts: [] });
    const onSaved = jest.fn();
    const t = await render({ ...appt, status: "cancelado" }, onSaved);
    await flush(() => timeInput(t).props.onChange({ target: { value: "17:30" } }));
    await flush(() => one(t, "appt-notify").props.onChange(false));
    await flush(() => one(t, "appt-save").props.onPress());
    expect(mockRequest.mock.calls[0][0]).toBe("/companies/empresa-1/dental/appointments");
    expect(mockRequest.mock.calls[0][1]).toMatchObject({ method: "POST", body: { patient_id: "pac-1", scheduled_at: at(17, 30), duration_min: 60, practitioner_id: "p1" } });
    expect(onSaved).toHaveBeenCalledWith({ id: "novo" });
    t.unmount();
  });

  it("erro do servidor aparece no modal", async () => {
    const err: any = new Error("Horario em conflito");
    err.data = { error: "Não é possível mudar de \"cancelado\" para \"agendado\"" };
    mockRequest.mockReset().mockRejectedValue(err);
    const t = await render(appt);
    await flush(() => timeInput(t).props.onChange({ target: { value: "17:30" } }));
    await flush(() => one(t, "appt-save").props.onPress());
    expect(one(t, "appt-error").props.children).toBe("Não é possível mudar de \"cancelado\" para \"agendado\"");
    t.unmount();
  });
});
