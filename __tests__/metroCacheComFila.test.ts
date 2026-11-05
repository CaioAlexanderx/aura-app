// ============================================================================
// AURA. — Fila no cache do Metro (04/11/2026)
//
// O build do Cloudflare morria com EMFILE: o FileStore do Metro grava milhares
// de arquivos de cache ao mesmo tempo. O que este arquivo trava:
//   1. a fila nunca passa do limite de operações simultâneas e termina todas;
//   2. erro de uma operação não trava a fila nem some;
//   3. comFila embrulha get/set no mesmo objeto (instanceof e clear intactos)
//      e não embrulha duas vezes;
//   4. metro.config.js existe, parte do getDefaultConfig do Expo e aplica a
//      fila em todos os cacheStores.
// ============================================================================
import * as fs from "fs";
import * as path from "path";

const { criarFila, comFila, LIMITE_PADRAO } = require("../scripts/filaDoCacheDoMetro");

const tique = () => new Promise<void>((r) => setTimeout(r, 0));

describe("a fila", () => {
  it("nunca passa do limite e termina tudo", async () => {
    const fila = criarFila(8);
    let emVoo = 0;
    let pico = 0;
    const tarefa = (i: number) => async () => {
      emVoo += 1;
      pico = Math.max(pico, emVoo);
      await tique();
      emVoo -= 1;
      return i;
    };
    const resultados = await Promise.all(Array.from({ length: 500 }, (_, i) => fila.executar(tarefa(i))));
    expect(pico).toBe(8);
    expect(resultados).toEqual(Array.from({ length: 500 }, (_, i) => i));
    expect(fila.rodando).toBe(0);
    expect(fila.esperando).toBe(0);
  });

  it("erro de uma operação chega a quem chamou e a fila segue", async () => {
    const fila = criarFila(2);
    const ok = fila.executar(async () => "ok");
    const ruim = fila.executar(async () => { throw new Error("disco cheio"); });
    const depois = fila.executar(async () => "depois");
    await expect(ruim).rejects.toThrow("disco cheio");
    expect(await ok).toBe("ok");
    expect(await depois).toBe("depois");
    expect(fila.rodando).toBe(0);
  });

  it("limite inválido não passa", () => {
    expect(() => criarFila(0)).toThrow();
    expect(() => criarFila(1.5)).toThrow();
    expect(LIMITE_PADRAO).toBe(128);
  });
});

describe("comFila num store", () => {
  class StoreFalso {
    emVoo = 0;
    pico = 0;
    dados = new Map<string, unknown>();
    limpou = false;
    async set(key: string, value: unknown) {
      this.emVoo += 1;
      this.pico = Math.max(this.pico, this.emVoo);
      await tique();
      this.dados.set(key, value);
      this.emVoo -= 1;
    }
    async get(key: string) {
      this.emVoo += 1;
      this.pico = Math.max(this.pico, this.emVoo);
      await tique();
      this.emVoo -= 1;
      return this.dados.get(key) ?? null;
    }
    clear() { this.limpou = true; }
  }

  it("get e set passam pela mesma fila; instanceof e clear continuam", async () => {
    const store = new StoreFalso();
    const mesmo = comFila(store, 16);
    expect(mesmo).toBe(store);
    expect(mesmo instanceof StoreFalso).toBe(true);
    await Promise.all([
      ...Array.from({ length: 300 }, (_, i) => store.set(`k${i}`, i)),
      ...Array.from({ length: 300 }, (_, i) => store.get(`k${i}`)),
    ]);
    expect(store.pico).toBe(16);
    expect(store.dados.size).toBe(300);
    expect(await store.get("k7")).toBe(7);
    store.clear();
    expect(store.limpou).toBe(true);
  });

  it("não embrulha duas vezes nem o que não é store", () => {
    const store = new StoreFalso();
    comFila(store, 4);
    const set1 = store.set;
    comFila(store, 4);
    expect(store.set).toBe(set1);
    expect(comFila(null as any)).toBeNull();
    expect(comFila({ get() {} } as any)).toEqual({ get: expect.any(Function) });
  });
});

describe("metro.config.js", () => {
  it("parte do padrão do Expo e aplica a fila em todos os cacheStores", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "metro.config.js"), "utf8");
    expect(src).toMatch(/require\(['"]expo\/metro-config['"]\)/);
    expect(src).toMatch(/getDefaultConfig\(__dirname\)/);
    expect(src).toMatch(/config\.cacheStores = \(config\.cacheStores \|\| \[\]\)\.map\(\(store\) => comFila\(store\)\)/);
    expect(src).toMatch(/module\.exports = config/);
  });
});
