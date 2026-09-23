// ============================================================
// AURA. -- Testes: ordenação "Últimos adicionados" do Estoque (QA
// producao 23/09/2026, item 10 -- ordenava em ordem alfabética em vez de
// data de cadastro decrescente).
// ============================================================
import { compareByRecent } from "@/utils/productSort";

describe("compareByRecent", () => {
  test("mais recente primeiro (created_at desc)", () => {
    const antigo = { id: "a", created_at: "2026-01-01T10:00:00Z" };
    const recente = { id: "b", created_at: "2026-09-23T10:00:00Z" };
    const arr = [antigo, recente].sort(compareByRecent);
    expect(arr.map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("produto importado em lote (mesmo created_at) -- desempata por id, ordem deterministica", () => {
    const mesmoInstante = "2026-09-23T10:00:00Z";
    const a = { id: "zzz", created_at: mesmoInstante };
    const b = { id: "aaa", created_at: mesmoInstante };
    const r1 = [a, b].sort(compareByRecent).map((p) => p.id);
    const r2 = [b, a].sort(compareByRecent).map((p) => p.id);
    expect(r1).toEqual(r2);
    expect(r1).toEqual(["aaa", "zzz"]);
  });

  test("created_at ausente (produto legado) vai pro fim, sem quebrar o sort", () => {
    const semData = { id: "a", created_at: null };
    const comData = { id: "b", created_at: "2026-09-23T10:00:00Z" };
    const arr = [semData, comData].sort(compareByRecent);
    expect(arr.map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("nome nao influencia a ordem (era o bug -- ordenava alfabetico)", () => {
    const zProduto = { id: "1", name: "Zebra", created_at: "2026-09-23T10:00:00Z" };
    const aProduto = { id: "2", name: "Abacate", created_at: "2026-01-01T10:00:00Z" };
    const arr = [aProduto, zProduto].sort(compareByRecent);
    // "Zebra" e mais recente que "Abacate" -- tem que vir primeiro mesmo
    // sendo alfabeticamente depois.
    expect(arr.map((p) => p.name)).toEqual(["Zebra", "Abacate"]);
  });
});
