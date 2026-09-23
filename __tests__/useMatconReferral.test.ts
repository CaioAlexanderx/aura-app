// ============================================================
// Matcon M3 — useMatconReferral (docs/CONTRACT_MATCON.md, seção M3).
//
// Cobre:
//   - pontosPrevistos(1220.58) com matcon_points_per_100=10 → 120
//     (floor(1220.58/100) × 10 = floor(12.2058) × 10 = 12 × 10)
//   - clube desligado: pontosPrevistos sempre 0 e search() não chama
//     matconApi.searchProfessionals (o convite nem existe fora do toggle).
// ============================================================
import { renderHook, act } from "@testing-library/react-native";
import { useMatconReferral } from "@/hooks/useMatconReferral";

const mockSearchProfessionals = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: {
    searchProfessionals: (...args: any[]) => mockSearchProfessionals(...args),
  },
}));

describe("useMatconReferral", () => {
  beforeEach(() => {
    mockSearchProfessionals.mockReset();
    mockSearchProfessionals.mockResolvedValue({ professionals: [] });
  });

  it("pontosPrevistos(1220.58) com 10 pontos a cada R$100 → 120", () => {
    const { result } = renderHook(() =>
      useMatconReferral({ companyId: "empresa-1", matconEnabled: true, clubEnabled: true, pointsPer100: 10 })
    );
    expect(result.current.pontosPrevistos(1220.58)).toBe(120);
  });

  it("clube desligado: pontosPrevistos é sempre 0 e search não chama a API", () => {
    const { result } = renderHook(() =>
      useMatconReferral({ companyId: "empresa-1", matconEnabled: true, clubEnabled: false, pointsPer100: 10 })
    );
    expect(result.current.pontosPrevistos(1220.58)).toBe(0);

    act(() => { result.current.search("nivaldo"); });
    expect(mockSearchProfessionals).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  it("matcon desligado (mesmo com clube on) também zera pontos e não busca", () => {
    const { result } = renderHook(() =>
      useMatconReferral({ companyId: "empresa-1", matconEnabled: false, clubEnabled: true, pointsPer100: 10 })
    );
    expect(result.current.pontosPrevistos(1220.58)).toBe(0);

    act(() => { result.current.search("nivaldo"); });
    expect(mockSearchProfessionals).not.toHaveBeenCalled();
  });

  // QA 23/09/2026: busca que falha ≠ busca sem resultado.
  it("busca que falhou liga searchError; a próxima busca e o clear desligam", async () => {
    jest.useFakeTimers();
    mockSearchProfessionals.mockRejectedValueOnce(Object.assign(new Error("Rota nao encontrada"), { status: 404 }));
    const { result } = renderHook(() =>
      useMatconReferral({ companyId: "empresa-1", matconEnabled: true, clubEnabled: true, pointsPer100: 10 })
    );
    act(() => { result.current.search("nivaldo"); });
    await act(async () => { jest.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.searchError).toBe(true);
    expect(result.current.searching).toBe(false);
    expect(result.current.results).toEqual([]);

    act(() => { result.current.search("niv"); });
    expect(result.current.searchError).toBe(false);
    act(() => { result.current.clear(); });
    expect(result.current.searchError).toBe(false);
    jest.useRealTimers();
  });
});
