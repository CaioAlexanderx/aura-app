// ============================================================================
// AURA. — Nome da loja: uma regra só (21/11/2026)
//
// 1. utils/nomeDaLoja.ts: nome fantasia > razão social > name (sessão
//    antiga/demo), aparado.
// 2. Etiqueta BYTE A BYTE: para toda empresa como o app a guarda hoje
//    (vinda do login, da troca de loja, do /auth/me, de sessão antiga), o
//    nome no topo da etiqueta e o HTML inteiro são os mesmos de origin/main
//    (ba5f3ab6). Os fixtures em __fixtures__/nomeDaLoja/ foram gravados com o
//    nomeDaLoja.ts de origin/main, ANTES desta mudança; nunca os regrave para
//    "fazer o teste passar".
//    Para regravar a partir de uma main sem a mudança:
//    GERAR_FIXTURES_NOME_DA_LOJA=1 npx jest nomeDaLojaUnico
// ============================================================================
import fs from "fs";
import path from "path";
import { buildLabelHtml } from "@/components/screens/estoque/labels/buildLabelHtml";
import { nomeDaLojaDaEmpresa } from "@/components/screens/estoque/labels/nomeDaLoja";

const FIX_DIR = path.join(__dirname, "__fixtures__", "nomeDaLoja");

// Empresa como o store guarda. `name` do login antigo = razão social
// primeiro; da troca de loja = fantasia primeiro.
const EMPRESAS: Record<string, any> = {
  "login-fantasia-diferente": { id: "a", name: "MARIA DA SILVA 12345678900", trade_name: "Layali Perfumaria Árabe", legal_name: "MARIA DA SILVA 12345678900" },
  "troca-de-loja-fantasia-diferente": { id: "a", name: "Layali Perfumaria Árabe", trade_name: "Layali Perfumaria Árabe", legal_name: "MARIA DA SILVA 12345678900" },
  "fantasia-igual-razao": { id: "b", name: "Doce Encanto", trade_name: "Doce Encanto", legal_name: "Doce Encanto" },
  "sem-fantasia": { id: "c", name: "Ana Modas LTDA", trade_name: null, legal_name: "Ana Modas LTDA" },
  "fantasia-vazia": { id: "c", name: "Ana Modas LTDA", trade_name: "", legal_name: "Ana Modas LTDA" },
  "fantasia-so-espacos": { id: "c", name: "Ana Modas LTDA", trade_name: "   ", legal_name: "Ana Modas LTDA" },
  "fantasia-com-espacos-nas-pontas": { id: "d", name: "X LTDA", trade_name: "  Doce Encanto ", legal_name: "X LTDA" },
  "sessao-antiga-so-name": { id: "e", name: "Loja Demo" },
};

const ITENS = [
  { name: "Perfume Árabe 100ml", price: 189.9, barcode: "7891234567895", size: "", color: "", qty: 2 },
  { name: "Vestido Midi", price: 1234.56, barcode: "7891234567896", size: "M", color: "Azul", qty: 1 },
];
const MODELOS: Array<{ nome: string; opts: any }> = [
  { nome: "99x21-barcode", opts: { mode: "barcode", showStoreName: true, labelSize: "99x21" } },
  { nome: "30x25-qr", opts: { mode: "qr", showStoreName: true, labelSize: "30x25" } },
  { nome: "58mm-barcode", opts: { mode: "barcode", showStoreName: true, labelSize: "58mm" } },
];

const arquivo = (empresa: string, modelo: string) => path.join(FIX_DIR, empresa + "." + modelo + ".html");
const nomeArq = (empresa: string) => path.join(FIX_DIR, empresa + ".nome.txt");

if (process.env.GERAR_FIXTURES_NOME_DA_LOJA) {
  test("grava fixtures (GERAR_FIXTURES_NOME_DA_LOJA)", () => {
    fs.mkdirSync(FIX_DIR, { recursive: true });
    Object.keys(EMPRESAS).forEach(function (e) {
      const nome = nomeDaLojaDaEmpresa(EMPRESAS[e]);
      fs.writeFileSync(nomeArq(e), nome);
      MODELOS.forEach(function (m) {
        fs.writeFileSync(arquivo(e, m.nome), buildLabelHtml(ITENS as any, { ...m.opts, storeName: nome }));
      });
    });
  });
} else {
  // Import tardio: o arquivo não existe na main que grava os fixtures.
  const { nomeDaLojaDe, razaoSocialDe } = require("@/utils/nomeDaLoja");

  describe("1. regra", () => {
    test("nome fantasia vence a razão social e o name", () => {
      expect(nomeDaLojaDe(EMPRESAS["login-fantasia-diferente"])).toBe("Layali Perfumaria Árabe");
    });
    test("sem nome fantasia (null, vazio, espaços): razão social", () => {
      expect(nomeDaLojaDe(EMPRESAS["sem-fantasia"])).toBe("Ana Modas LTDA");
      expect(nomeDaLojaDe(EMPRESAS["fantasia-vazia"])).toBe("Ana Modas LTDA");
      expect(nomeDaLojaDe(EMPRESAS["fantasia-so-espacos"])).toBe("Ana Modas LTDA");
    });
    test("sessão antiga, só com name: name", () => {
      expect(nomeDaLojaDe(EMPRESAS["sessao-antiga-so-name"])).toBe("Loja Demo");
    });
    test("sem empresa: vazio (a tela põe o texto dela)", () => {
      expect(nomeDaLojaDe(null)).toBe("");
      expect(nomeDaLojaDe(undefined) || "nossa loja").toBe("nossa loja");
    });
    test("razão social para o que a lei pede", () => {
      expect(razaoSocialDe(EMPRESAS["login-fantasia-diferente"])).toBe("MARIA DA SILVA 12345678900");
    });
  });

  describe("2. etiqueta byte a byte com a main", () => {
    Object.keys(EMPRESAS).forEach(function (e) {
      test(e + ": mesmo nome no topo", () => {
        expect(nomeDaLojaDaEmpresa(EMPRESAS[e])).toBe(fs.readFileSync(nomeArq(e), "utf8"));
        expect(nomeDaLojaDaEmpresa(EMPRESAS[e])).toBe(nomeDaLojaDe(EMPRESAS[e]));
      });
      MODELOS.forEach(function (m) {
        test(e + " -> " + m.nome, () => {
          const html = buildLabelHtml(ITENS as any, { ...m.opts, storeName: nomeDaLojaDaEmpresa(EMPRESAS[e]) });
          expect(html).toBe(fs.readFileSync(arquivo(e, m.nome), "utf8"));
        });
      });
    });
  });
}
