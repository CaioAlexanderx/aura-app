// ============================================================
// useAtualizarApp + serviço de verdade, com o relógio na janela de
// congelamento (13/10/2026). O outro arquivo de teste do hook mocka o
// serviço; este mocka só o RELOAD e o relógio, para provar a cadeia
// inteira: hash servido ≠ rodando, version.json, e se recarrega ou não.
//
// Os quatro casos que o plano pede: dentro e fora da janela, com e sem
// hotfix — mais o version.json ausente.
// ============================================================
import { act, renderHook } from "@testing-library/react-native";
import { useAtualizarApp } from "@/hooks/useAtualizarApp";

const mockAtualizar = jest.fn();

jest.mock("@/services/atualizarApp", () => ({
  ...jest.requireActual("@/services/atualizarApp"),
  atualizarAgora: (...a: any[]) => mockAtualizar(...a),
}));

const RODANDO = "aaaa1111";
const SERVIDO = "bbbb2222";
const FORA = new Date("2026-10-13T12:00:00-03:00").getTime();
const DENTRO = new Date("2026-11-25T12:00:00-03:00").getTime();

let script: HTMLScriptElement;
const fetchOriginal = (global as any).fetch;

/** `versao === null` = o servidor não tem /version.json (404). */
function servidor(versao: any) {
  (global as any).fetch = jest.fn().mockImplementation(async (url: string) => {
    if (url === "/version.json") {
      return versao === null
        ? { ok: false, text: () => Promise.resolve("") }
        : { ok: true, text: () => Promise.resolve(JSON.stringify(versao)) };
    }
    const html = `<html><script src="/_expo/static/js/web/entry-${SERVIDO}.js"></script></html>`;
    return { ok: true, text: () => Promise.resolve(html) };
  });
}

beforeEach(() => {
  mockAtualizar.mockReset().mockResolvedValue(undefined);
  script = document.createElement("script");
  script.setAttribute("src", `/_expo/static/js/web/entry-${RODANDO}.js`);
  document.head.appendChild(script);
});

afterEach(() => {
  script.remove();
  (global as any).fetch = fetchOriginal;
  jest.restoreAllMocks();
});

async function tocar(agora: number) {
  jest.spyOn(Date, "now").mockReturnValue(agora);
  const { result } = renderHook(() => useAtualizarApp());
  await act(async () => { await result.current.atualizar(); });
  return result.current.estado;
}

describe("useAtualizarApp na janela de congelamento", () => {
  test("fora da janela, sem hotfix: recarrega como sempre", async () => {
    servidor({ hash: SERVIDO, hotfix: false });
    expect(await tocar(FORA)).toBe("nova");
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
  });

  test("fora da janela, com hotfix: recarrega (a marca é irrelevante)", async () => {
    servidor({ hash: SERVIDO, hotfix: true });
    expect(await tocar(FORA)).toBe("nova");
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
  });

  test("dentro da janela, sem hotfix: NÃO recarrega", async () => {
    servidor({ hash: SERVIDO, hotfix: false });
    expect(await tocar(DENTRO)).toBe("pausada");
    expect(mockAtualizar).not.toHaveBeenCalled();
  });

  test("dentro da janela, com hotfix: recarrega", async () => {
    servidor({ hash: SERVIDO, hotfix: true });
    expect(await tocar(DENTRO)).toBe("nova");
    expect(mockAtualizar).toHaveBeenCalledTimes(1);
  });

  test("dentro da janela, sem version.json: NÃO recarrega", async () => {
    servidor(null);
    expect(await tocar(DENTRO)).toBe("pausada");
    expect(mockAtualizar).not.toHaveBeenCalled();
  });
});
