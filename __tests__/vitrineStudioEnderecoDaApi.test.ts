// ============================================================
// A vitrine fala com um domínio NOSSO (04/09/2026)
//
// Em 02/09 o domínio público do Railway — o nome que o PROVEDOR dá à
// nossa aplicação — passou a devolver 503 enquanto a aplicação continuava
// viva em `loja.getaura.com.br`. Todas as lojas abriam e nada que
// dependesse da API funcionava. O backend aprendeu a lição naquele dia; o
// app continuou com o nome do provedor como valor de reserva em mais de
// quarenta arquivos.
//
// Isso ficou invisível enquanto a vitrine morava em `app.getaura.com.br`,
// que não tem CSP. Servida em `loja.getaura.com.br`, um endereço fora da
// lista não é lentidão: é a loja em branco. Foi assim que apareceu —
// "Failed to fetch" na primeira visita, com o console apontando o
// domínio do provedor.
// ============================================================
import { enderecoDaApi, API_DA_AURA } from "@/components/studio/storefront/enderecoDaApi";

describe("o endereço da API da vitrine", () => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = original;
  });

  test("a reserva é um domínio nosso, não o do provedor", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(enderecoDaApi()).toBe(API_DA_AURA);
    expect(enderecoDaApi()).toContain("api.getaura.com.br");
    expect(enderecoDaApi()).not.toContain("railway.app");
  });

  test("a variável de ambiente continua vencendo", () => {
    // Um ambiente de teste precisa poder apontar para outro lugar.
    process.env.EXPO_PUBLIC_API_URL = "https://staging.example.com/api/v1";
    expect(enderecoDaApi()).toBe("https://staging.example.com/api/v1");
  });

  test("variável vazia cai na reserva em vez de montar URL quebrada", () => {
    process.env.EXPO_PUBLIC_API_URL = "   ";
    expect(enderecoDaApi()).toBe(API_DA_AURA);
  });
});

describe("ninguém na vitrine escreve o endereço à mão", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..", "components", "studio", "storefront");

  function arquivosDaVitrine(): string[] {
    const saida: string[] = [];
    const anda = (dir: string) => {
      for (const nome of fs.readdirSync(dir)) {
        const p = path.join(dir, nome);
        if (fs.statSync(p).isDirectory()) anda(p);
        else if (/\.tsx?$/.test(nome)) saida.push(p);
      }
    };
    anda(RAIZ);
    return saida;
  }

  test("o nome do provedor não aparece em arquivo nenhum da vitrine", () => {
    const culpados = arquivosDaVitrine().filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      // O próprio módulo cita o domínio no comentário que conta a história.
      if (path.basename(f) === "enderecoDaApi.ts") return false;
      return s.includes("up.railway.app");
    });
    expect(culpados.map((f) => path.basename(f))).toEqual([]);
  });

  test("quem fala com a API pega o endereço do módulo", () => {
    // Três cópias da mesma constante são três lugares para esquecer de
    // mudar — foi assim que o nome do provedor chegou a quarenta
    // arquivos.
    const usam = arquivosDaVitrine().filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      return /const API_BASE\s*=/.test(s);
    });
    expect(usam.length).toBeGreaterThan(0);
    for (const f of usam) {
      const s = fs.readFileSync(f, "utf8");
      expect(s).toContain("enderecoDaApi()");
      expect(s).not.toContain("EXPO_PUBLIC_API_URL");
    }
  });
});
