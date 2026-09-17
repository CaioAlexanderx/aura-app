// ============================================================
// QA odonto (16/09/2026) — PatientFormModal: erros de validacao e
// CPF duplicado.
//
// O que estes testes seguram:
//  1. Nome vazio / CPF invalido / data invalida mostram a mensagem NO
//     PROPRIO CAMPO (nao so no rodape) — o bug de QA era "clico em
//     Cadastrar paciente e nada acontece" porque o erro ficava escondido
//     no rodape de um form longo.
//  2. Data de nascimento no futuro e barrada no cliente, sem round-trip
//     pro backend.
//  3. 409 CPF_DUPLICADO do backend aparece no campo CPF com o nome do
//     dono atual, e oferece "Abrir ficha" (navega + fecha o modal) e
//     "Cadastrar mesmo assim" (reenvia com allow_duplicate_cpf: true).
//  4. 400 BIRTH_DATE_FUTURE do backend (relogio do aparelho errado, por
//     exemplo) cai no campo de data igual a validacao client-side.
//  5. initialName (vindo da busca do NewAppointmentModal) pre-preenche
//     o nome no cadastro rapido.
//
// react-test-renderer direto (mesmo padrao de deixarLojaPronta.test.tsx e
// SemCategoria.test.tsx): react-native mockado com tags simples — usar o
// react-native-web real (via moduleNameMapper) quebra sob react-test-renderer
// porque o Pressable/useHover tenta anexar addEventListener num node que o
// renderer de teste nao hospeda de verdade. testID + findAllByProps pra
// achar os elementos, sem depender de medida de layout real.
//
// IMPORTANTE: `renderer.create()` PRECISA estar dentro de `act()` — sem
// isso o useEffect de prefill/reset do modal (que roda no mount) fica
// pendente e o PRIMEIRO setState feito por um handler synchro (ex:
// handleSubmit chamado direto via .props.onPress()) nao se reflete na
// arvore lida depois. É esse hidden queue que fazia os testes acharem
// "nenhum erro renderizado" mesmo com o state correto por dentro.
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
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 1280, height: 800, scale: 1, fontScale: 1 }),
  Animated: {
    Value: function (this: any, v: number) { this._value = v; },
    timing: () => ({ start: (cb?: any) => cb && cb({ finished: true }) }),
    View: "Animated.View",
  },
}));

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/verticals/odonto/WebcamCapture", () => ({ WebcamCapture: () => null }));

jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "empresa-1" } }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));

// Fake enxuto de useMutation: mutate() roda a mutationFn da ULTIMA
// renderizacao e resolve/rejeita onSuccess/onError, sem cache real —
// suficiente pra exercitar o fluxo de erro/sucesso do formulario.
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: (opts: any) => ({
    isPending: false,
    mutate: () => {
      Promise.resolve()
        .then(() => opts.mutationFn())
        .then((res: any) => opts.onSuccess?.(res))
        .catch((err: any) => opts.onError?.(err));
    },
  }),
}));

import { PatientFormModal } from "@/components/verticals/odonto/PatientFormModal";

function apiError(status: number, data: any) {
  const err: any = new Error(data?.error || "erro");
  err.status = status;
  err.data = data;
  return err;
}

async function createTree(el: React.ReactElement): Promise<renderer.ReactTestRenderer> {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(el);
  });
  return tree;
}

function byTestId(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAllByProps({ testID: id })[0];
}

async function submit(tree: renderer.ReactTestRenderer) {
  await act(async () => {
    byTestId(tree, "patient-form-submit").props.onPress();
    // deixa a promise da mutationFn resolver
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("PatientFormModal — validacao client-side", () => {
  afterEach(() => { mockRequest.mockReset(); mockPush.mockReset(); });

  it("nome vazio mostra erro no proprio campo, nao so no rodape", async () => {
    const tree = await createTree(<PatientFormModal visible={true} onClose={jest.fn()} mode="create" />);
    await submit(tree);
    expect(byTestId(tree, "patient-form-fullname-error").props.children).toBe("Nome é obrigatório");
    expect(byTestId(tree, "patient-form-summary-error")).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("CPF invalido mostra erro no proprio campo e nao chega a chamar a API", async () => {
    const tree = await createTree(<PatientFormModal visible={true} onClose={jest.fn()} mode="create" />);
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    act(() => { byTestId(tree, "patient-form-cpf").props.onChangeText("111.111.111-11"); });
    await submit(tree);
    expect(byTestId(tree, "patient-form-cpf-error").props.children).toBe("CPF inválido");
    expect(mockRequest).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("data de nascimento no futuro e barrada sem round-trip pro backend", async () => {
    const tree = await createTree(<PatientFormModal visible={true} onClose={jest.fn()} mode="create" />);
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    act(() => { byTestId(tree, "patient-form-birthdate").props.onChangeText("10032030"); }); // -> 10/03/2030
    await submit(tree);
    expect(byTestId(tree, "patient-form-birthdate-error").props.children).toBe("Data de nascimento não pode ser no futuro");
    expect(mockRequest).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("data invalida (nao existe no calendario) mostra a mensagem de formato", async () => {
    const tree = await createTree(<PatientFormModal visible={true} onClose={jest.fn()} mode="create" />);
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    act(() => { byTestId(tree, "patient-form-birthdate").props.onChangeText("31042020"); }); // 31/04 nao existe
    await submit(tree);
    expect(byTestId(tree, "patient-form-birthdate-error").props.children).toBe("Data de nascimento inválida (use DD/MM/AAAA)");
    tree.unmount();
  });

  it("corrigir o campo some com o erro daquele campo", async () => {
    const tree = await createTree(<PatientFormModal visible={true} onClose={jest.fn()} mode="create" />);
    await submit(tree);
    expect(byTestId(tree, "patient-form-fullname-error")).toBeTruthy();
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    expect(tree.root.findAllByProps({ testID: "patient-form-fullname-error" }).length).toBe(0);
    tree.unmount();
  });
});

describe("PatientFormModal — CPF duplicado (409)", () => {
  afterEach(() => { mockRequest.mockReset(); mockPush.mockReset(); });

  it("409 CPF_DUPLICADO mostra o nome do dono atual e as duas acoes", async () => {
    mockRequest.mockRejectedValueOnce(
      apiError(409, { error: "Já existe um paciente com este CPF", code: "CPF_DUPLICADO", patient_id: "pac-99", patient_name: "Ana Duplicada" })
    );
    const tree = await createTree(<PatientFormModal visible={true} onClose={jest.fn()} mode="create" />);
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    act(() => { byTestId(tree, "patient-form-cpf").props.onChangeText("52998224725"); }); // CPF valido
    await submit(tree);

    const box = byTestId(tree, "patient-form-cpfdup-box");
    expect(box).toBeTruthy();
    expect(byTestId(tree, "patient-form-cpfdup-open")).toBeTruthy();
    expect(byTestId(tree, "patient-form-cpfdup-force")).toBeTruthy();
    tree.unmount();
  });

  it("'Abrir ficha' fecha o modal e navega para ?open_patient=<id>", async () => {
    mockRequest.mockRejectedValueOnce(
      apiError(409, { error: "dup", code: "CPF_DUPLICADO", patient_id: "pac-99", patient_name: "Ana Duplicada" })
    );
    const onClose = jest.fn();
    const tree = await createTree(<PatientFormModal visible={true} onClose={onClose} mode="create" />);
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    act(() => { byTestId(tree, "patient-form-cpf").props.onChangeText("52998224725"); });
    await submit(tree);

    act(() => { byTestId(tree, "patient-form-cpfdup-open").props.onPress(); });
    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/dental/(clinic)/pacientes?open_patient=pac-99");
    tree.unmount();
  });

  it("'Cadastrar mesmo assim' reenvia com allow_duplicate_cpf: true", async () => {
    mockRequest
      .mockRejectedValueOnce(apiError(409, { error: "dup", code: "CPF_DUPLICADO", patient_id: "pac-99", patient_name: "Ana Duplicada" }))
      .mockResolvedValueOnce({ patient: { id: "pac-novo", full_name: "Maria Teste" } });

    const onSaved = jest.fn();
    const onClose = jest.fn();
    const tree = await createTree(<PatientFormModal visible={true} onClose={onClose} onSaved={onSaved} mode="create" />);
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    act(() => { byTestId(tree, "patient-form-cpf").props.onChangeText("52998224725"); });
    await submit(tree);
    expect(byTestId(tree, "patient-form-cpfdup-box")).toBeTruthy();

    await act(async () => {
      byTestId(tree, "patient-form-cpfdup-force").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const secondCallBody = mockRequest.mock.calls[1][1].body;
    expect(secondCallBody.allow_duplicate_cpf).toBe(true);
    expect(onSaved).toHaveBeenCalledWith({ id: "pac-novo", full_name: "Maria Teste" });
    expect(onClose).toHaveBeenCalled();
    tree.unmount();
  });

  it("400 BIRTH_DATE_FUTURE do backend cai no campo de data (ex: relogio do aparelho errado)", async () => {
    // Data valida e no passado (passa a validacao client-side) — o 400
    // so pode vir de uma divergencia entre o relogio do device e o
    // servidor; mesmo assim tem que cair no campo certo, nao so no rodape.
    mockRequest.mockRejectedValueOnce(apiError(400, { error: "Data no futuro", code: "BIRTH_DATE_FUTURE" }));
    const tree = await createTree(<PatientFormModal visible={true} onClose={jest.fn()} mode="create" />);
    act(() => { byTestId(tree, "patient-form-fullname").props.onChangeText("Maria Teste"); });
    act(() => { byTestId(tree, "patient-form-birthdate").props.onChangeText("01011990"); }); // 01/01/1990
    await submit(tree);
    expect(byTestId(tree, "patient-form-birthdate-error").props.children).toBe("Data de nascimento não pode ser no futuro");
    expect(byTestId(tree, "patient-form-summary-error")).toBeTruthy();
    tree.unmount();
  });
});
