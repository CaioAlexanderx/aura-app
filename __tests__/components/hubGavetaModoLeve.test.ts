// Gaveta do celular (EnvioRapido): no modo leve usa V.solidLeve, lido na hora; no normal segue V.solid.
describe("fundoGaveta", () => {
  const carrega = (leve: boolean) => {
    let mod: any;
    // jsdom nao tem backdrop-filter nem muitos nucleos: simula um aparelho bom para o modo normal valer
    (window as any).CSS = { supports: () => true };
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8, configurable: true });
    jest.isolateModules(() => {
      try { if (leve) sessionStorage.setItem("aura-lite", "1"); else sessionStorage.setItem("aura-lite", "0"); } catch { /* ok */ }
      mod = require("@/components/whatsapp/waVisual");
    });
    return mod;
  };
  afterEach(() => { try { sessionStorage.removeItem("aura-lite"); } catch { /* ok */ } });

  it("modo normal: V.solid, sem gradiente", () => {
    const { fundoGaveta, V, modoLeve } = carrega(false);
    expect(modoLeve()).toBe(false);
    const f = fundoGaveta();
    expect(f.backgroundColor).toBe(V.solid);
    expect(f.backgroundImage).toBeUndefined();
  });

  it("modo leve: V.solidLeve (com o gradiente quando o tema tem)", () => {
    const { fundoGaveta, V, modoLeve } = carrega(true);
    expect(modoLeve()).toBe(true);
    const f = fundoGaveta();
    expect(f.backgroundColor).toBe(V.solidLeve);
    if (V.solidLeveGrad) expect(f.backgroundImage).toBe(V.solidLeveGrad);
    else expect(f.backgroundImage).toBeUndefined();
  });

  it("V.solidLeve: escuro #161324 com gradiente #1f1a30 a #0d0b18; claro igual ao V.solid", () => {
    const { V } = carrega(false);
    if (V.solidLeveGrad) {
      expect(V.solidLeve).toBe("#161324");
      expect(V.solidLeveGrad).toBe("linear-gradient(160deg,#1f1a30,#0d0b18)");
    } else {
      expect(V.solidLeve).toBe(V.solid);
    }
  });
});
