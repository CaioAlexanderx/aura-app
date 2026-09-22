// ============================================================
// useAtualizarApp — o botão "Atualizar" visto pela interface.
//
// O que aqui segura:
//   1. UM toque resolve: verifica e, se tiver versão nova, já recarrega.
//      Ninguém quer tocar duas vezes para receber o que pediu;
//   2. "já está na versão mais nova" NÃO recarrega — reload à toa em PDV
//      aberto derruba o que o lojista estava digitando;
//   3. quando não dá para verificar (offline, dev), o SEGUNDO toque
//      recarrega na fé: recarregar é inofensivo, e no app instalado não há
//      outra saída (não existe barra de endereço, logo não existe F5);
//   4. toque duplo não dispara duas verificações;
//   5. o TEXTO da linha é daqui, não de cada card — varejo e Karatê têm
//      roupas diferentes e têm de dizer a mesma coisa.
// ============================================================
import { act, renderHook } from "@testing-library/react-native";
import {
  detalheDaAtualizacao,
  rotuloDaAtualizacao,
  useAtualizarApp,
} from "@/hooks/useAtualizarApp";

const mockVerificar = jest.fn();
const mockAtualizar = jest.fn();

jest.mock("@/services/atualizarApp", () => ({
  verificarAtualizacao: (...a: any[]) => mockVerificar(...a),
  atualizarAgora: (...a: any[]) => mockAtualizar(...a),
}));

beforeEach(() => {
  mockVerificar.mockReset();
  mockAtualizar.mockReset().mockResolvedValue(undefined);
});

describe("um toque resolve", () => {
  test("versão nova → estado 'nova' e recarrega", async () => {
    mockVerificar.mockResolvedValue("nova");
    const { result } = renderHook(() => useAtualizarApp());
    expect(result.current.estado).toBe("parado");

    await act(async () => { await result.current.atualizar(); });

    expect(mockVerificar).toHaveBeenCalledTimes(1);
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
    expect(result.current.estado).toBe("nova");
  });

  test("já na última → NÃO recarrega (reload à toa derruba o PDV aberto)", async () => {
    mockVerificar.mockResolvedValue("atualizado");
    const { result } = renderHook(() => useAtualizarApp());

    await act(async () => { await result.current.atualizar(); });

    expect(result.current.estado).toBe("atualizado");
    expect(mockAtualizar).not.toHaveBeenCalled();
    expect(result.current.ocupado).toBe(false);
  });

  test("depois de 'atualizado', tocar de novo verifica outra vez", async () => {
    mockVerificar.mockResolvedValue("atualizado");
    const { result } = renderHook(() => useAtualizarApp());

    await act(async () => { await result.current.atualizar(); });
    mockVerificar.mockResolvedValue("nova");
    await act(async () => { await result.current.atualizar(); });

    expect(mockVerificar).toHaveBeenCalledTimes(2);
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
  });
});

describe("quando não dá para verificar", () => {
  test("primeiro toque só informa; o segundo recarrega na fé", async () => {
    mockVerificar.mockResolvedValue("indisponivel");
    const { result } = renderHook(() => useAtualizarApp());

    await act(async () => { await result.current.atualizar(); });
    expect(result.current.estado).toBe("indisponivel");
    expect(mockAtualizar).not.toHaveBeenCalled();

    await act(async () => { await result.current.atualizar(); });
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
    // e não gastou outra verificação para chegar lá
    expect(mockVerificar).toHaveBeenCalledTimes(1);
  });
});

describe("toque duplo", () => {
  test("não dispara duas verificações", async () => {
    let liberar: (v: string) => void = () => {};
    mockVerificar.mockReturnValue(new Promise<string>((ok) => { liberar = ok; }));
    const { result } = renderHook(() => useAtualizarApp());

    await act(async () => {
      const a = result.current.atualizar();
      const b = result.current.atualizar();
      liberar("atualizado");
      await Promise.all([a, b]);
    });

    expect(mockVerificar).toHaveBeenCalledTimes(1);
  });

  test("ocupado enquanto verifica: o botão fica desabilitado", async () => {
    let liberar: (v: string) => void = () => {};
    mockVerificar.mockReturnValue(new Promise<string>((ok) => { liberar = ok; }));
    const { result } = renderHook(() => useAtualizarApp());

    let emVoo: Promise<void> = Promise.resolve();
    await act(async () => { emVoo = result.current.atualizar(); await Promise.resolve(); });
    expect(result.current.estado).toBe("verificando");
    expect(result.current.ocupado).toBe(true);

    await act(async () => { liberar("atualizado"); await emVoo; });
    expect(result.current.ocupado).toBe(false);
  });
});

describe("desmontar no meio não avisa o React", () => {
  test("verificação que volta depois do unmount não chama setState", async () => {
    let liberar: (v: string) => void = () => {};
    mockVerificar.mockReturnValue(new Promise<string>((ok) => { liberar = ok; }));
    const aviso = jest.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useAtualizarApp());

    let emVoo: Promise<void> = Promise.resolve();
    await act(async () => { emVoo = result.current.atualizar(); await Promise.resolve(); });
    unmount();
    await act(async () => { liberar("nova"); await emVoo; });

    // o reload ainda acontece: o pedido foi do usuário, não da tela
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe("o texto é um só para os dois cards", () => {
  test("cada estado tem a sua frase, e nenhuma fala de versão nova sem ter achado uma", () => {
    expect(detalheDaAtualizacao("parado")).toMatch(/[uú]ltima vers[aã]o publicada/i);
    expect(detalheDaAtualizacao("verificando")).toMatch(/Procurando/i);
    expect(detalheDaAtualizacao("atualizado")).toMatch(/j[aá] est[aá] na vers[aã]o mais nova/i);
    expect(detalheDaAtualizacao("nova")).toMatch(/Recarregando/i);
    expect(detalheDaAtualizacao("indisponivel")).toMatch(/Toque de novo/i);
  });

  test("o rótulo diz 'Recarregar' justamente quando não deu para verificar", () => {
    expect(rotuloDaAtualizacao("parado")).toBe("Atualizar");
    expect(rotuloDaAtualizacao("atualizado")).toBe("Atualizar");
    expect(rotuloDaAtualizacao("verificando")).toBe("...");
    expect(rotuloDaAtualizacao("nova")).toBe("...");
    expect(rotuloDaAtualizacao("indisponivel")).toBe("Recarregar");
  });
});
