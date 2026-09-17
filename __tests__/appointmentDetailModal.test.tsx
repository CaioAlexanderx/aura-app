// ============================================================
// AppointmentDetailModal (mockup agenda 16/09/2026, aba C) — render.
//
// O que estes testes seguram:
//  1. Um único botão principal por status; "Editar / remarcar" some
//     quando o principal já é "Remarcar"; "Cancelar" não fica no rodapé.
//  2. Faixa de alergia antes dos dados.
//  3. Clicar no principal manda o PATCH do próximo status.
//  4. Selo de status abre os 8 status; "Cancelado" leva ao modal com
//     motivo, que só libera o botão vermelho com motivo escolhido e envia
//     cancel_reason (e abre o WhatsApp no mesmo clique).
//  5. WhatsApp mostra a prévia ancorada; "Concluir atendimento" oferece
//     concluir agora ou pedir assinatura.
//
// Mesmo padrão de patientFormModalErros.test.tsx: react-native mockado com
// tags simples, testID + findAllByProps({deep:false}).
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
  Image: "Image",
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
  useWindowDimensions: () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
}));

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/verticals/odonto/SignatureRequestModal", () => ({
  SignatureRequestModal: ({ visible }: any) => (visible ? "signature-open" : null),
}));
jest.mock("@/components/verticals/odonto/NewPatientModal", () => ({ NewPatientModal: () => null }));
jest.mock("@/services/dentalConfigApi", () => ({ dentalConfigApi: { getSettings: jest.fn(), listPractitioners: jest.fn() } }));

const mockNotify = jest.fn();
jest.mock("@/utils/webAlert", () => ({ notify: (...a: any[]) => mockNotify(...a), confirmAlert: jest.fn() }));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1", name: "Sorriso Duarte" } }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

let mockAppt: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    cancelQueries: jest.fn(() => Promise.resolve()),
    getQueriesData: jest.fn(() => []),
    setQueriesData: jest.fn(),
    setQueryData: jest.fn(),
  }),
  useQuery: (opts: any) =>
    opts.queryKey[0] === "dental-appointment"
      ? { data: mockAppt ? { appointment: mockAppt } : undefined, isLoading: false }
      : { data: undefined, isLoading: false },
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

import { AppointmentDetailModal } from "@/components/verticals/odonto/AppointmentDetailModal";

const base = {
  id: "ap-1",
  customer_id: "pac-1",
  patient_name: "Ana Paula Ribeiro",
  patient_phone: "(11) 98765-4321",
  allergies: "Penicilina e látex",
  scheduled_at: new Date(2026, 8, 17, 15, 0).toISOString(),
  duration_min: 60,
  chief_complaint: "Clareamento · sessão 2",
  status: "agendado",
  procedures: [],
};

async function open(status: string, extra: any = {}) {
  mockAppt = { ...base, status, ...extra };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<AppointmentDetailModal visible appointmentId="ap-1" onClose={jest.fn()} />);
  });
  return tree;
}

const one = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false })[0];
const all = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
/** O Modal aberto renderiza a View do cartão com esse testID. */
const shown = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.type === "View" && n.props.testID === id).length > 0;
async function press(t: renderer.ReactTestRenderer, id: string) {
  await act(async () => {
    one(t, id).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AppointmentDetailModal", () => {
  let openSpy: jest.SpyInstance;
  beforeEach(() => {
    mockRequest.mockReset().mockResolvedValue({ appointment: {}, conflicts: [] });
    mockPush.mockReset();
    mockNotify.mockReset();
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => openSpy.mockRestore());

  it("agendado: principal Confirmar presença, Editar do lado, sem Cancelar no rodapé, alergia no topo", async () => {
    const t = await open("agendado");
    expect(one(t, "detail-primary").props.label).toBe("Confirmar presença");
    expect(one(t, "detail-edit").props.label).toBe("Editar / remarcar");
    expect(all(t, "more-cancel")).toHaveLength(0);
    expect(one(t, "detail-allergy")).toBeTruthy();
    t.unmount();
  });

  it("principal manda o PATCH do próximo status", async () => {
    const t = await open("agendado");
    await press(t, "detail-primary");
    expect(mockRequest).toHaveBeenCalledWith(
      "/companies/empresa-1/dental/appointments/ap-1",
      { method: "PATCH", body: { status: "confirmado" } },
    );
    t.unmount();
  });

  it("confirmado: Iniciar atendimento muda o status e abre o modo consulta", async () => {
    const t = await open("confirmado");
    expect(one(t, "detail-primary").props.label).toBe("Iniciar atendimento");
    await press(t, "detail-primary");
    expect(mockRequest.mock.calls[0][1]).toEqual({ method: "PATCH", body: { status: "em_atendimento" } });
    expect(mockPush).toHaveBeenCalledWith("/dental/consulta/ap-1");
    t.unmount();
  });

  it("faltou: principal vira Remarcar e o Editar some", async () => {
    const t = await open("faltou");
    expect(one(t, "detail-primary").props.label).toBe("Remarcar");
    expect(all(t, "detail-edit")).toHaveLength(0);
    t.unmount();
  });

  it("em atendimento: Concluir oferece concluir agora ou pedir assinatura", async () => {
    const t = await open("em_atendimento");
    expect(one(t, "detail-primary").props.label).toBe("Concluir atendimento");
    await press(t, "detail-primary");
    expect(one(t, "detail-conclude")).toBeTruthy();
    await press(t, "detail-conclude-now");
    expect(mockRequest.mock.calls[0][1]).toEqual({ method: "PATCH", body: { status: "concluido" } });
    t.unmount();
  });

  it("assinatura continua disponível ao concluir", async () => {
    const t = await open("em_atendimento");
    await press(t, "detail-primary");
    await press(t, "detail-conclude-sign");
    expect(t.root.findAll((n) => (n.children as any[]).includes("signature-open"))).not.toHaveLength(0);
    t.unmount();
  });

  it("WhatsApp mostra a prévia ancorada com a mensagem pronta", async () => {
    const t = await open("agendado");
    expect(all(t, "detail-wa-preview")).toHaveLength(0);
    await press(t, "detail-wa");
    expect(one(t, "detail-wa-preview").props.title).toBe("Mensagem pronta · (11) 98765-4321");
    await press(t, "detail-wa-open");
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/5511987654321?text="), "_blank", "noopener");
    t.unmount();
  });

  it("selo abre os 8 status; Cancelado exige motivo e grava cancel_reason", async () => {
    const t = await open("agendado");
    await press(t, "detail-status");
    const opts = t.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("status-opt-"), { deep: false });
    expect(opts).toHaveLength(8);
    await press(t, "status-opt-cancelado");
    expect(shown(t, "cancel-modal")).toBe(true);
    expect(shown(t, "detail-modal")).toBe(false);
    expect(one(t, "cancel-confirm").props.disabled).toBe(true);

    await press(t, "cancel-reason-outro");
    expect(one(t, "cancel-confirm").props.disabled).toBe(true);
    await press(t, "cancel-reason-sem_resposta");
    expect(one(t, "cancel-confirm").props.disabled).toBe(false);

    await press(t, "cancel-confirm");
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(openSpy.mock.calls[0][0])).toContain("liberei o horário");
    expect(mockRequest).toHaveBeenCalledWith(
      "/companies/empresa-1/dental/appointments/ap-1",
      { method: "PATCH", body: { status: "cancelado", cancel_reason: "Paciente não respondeu" } },
    );
    t.unmount();
  });

  it("Cancelar consulta fica no menu ⋯", async () => {
    const t = await open("confirmado");
    await press(t, "detail-more");
    await press(t, "more-cancel");
    expect(shown(t, "cancel-modal")).toBe(true);
    expect(shown(t, "detail-modal")).toBe(false);
    t.unmount();
  });

  it("transição recusada mostra a mensagem do servidor", async () => {
    const err: any = new Error("Não é possível mudar de \"concluido\" para \"faltou\"");
    err.status = 400;
    err.data = { code: "INVALID_TRANSITION", error: "Não é possível mudar de \"concluido\" para \"faltou\"" };
    mockRequest.mockReset().mockRejectedValue(err);
    const t = await open("concluido");
    await press(t, "detail-status");
    await press(t, "status-opt-faltou");
    expect(mockNotify).toHaveBeenCalledWith("Não foi possível salvar", "Não é possível mudar de \"concluido\" para \"faltou\"");
    t.unmount();
  });
});
