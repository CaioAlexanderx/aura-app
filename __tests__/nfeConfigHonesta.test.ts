// ============================================================
// 08/11/2026 — texto honesto do certificado e regime fiscal de verdade
//
//  1. Depois de enviar o A1, a tela não diz mais que a empresa "já pode
//     emitir notas fiscais": sem CSC e inscrição estadual a nota não sai, e
//     quem termina essa parte é a equipe da Aura.
//  2. O RegimeFiscal (Matcon) lê o regime do topo da resposta de
//     GET /nfce/config — o backend o tira de companies.tax_regime e o devolve
//     também para empresa sem nfce_config — e continua salvando só
//     { regime } (o backend não mexe em nenhum outro campo fiscal).
// ============================================================
import fs from "fs";
import path from "path";

const raiz = path.resolve(__dirname, "..");
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), "utf8");

describe("certificado enviado: sem promessa", () => {
  const aba = ler("components/screens/nfe/TabCertificado.tsx");

  it("não diz que a empresa já pode emitir", () => {
    expect(aba).not.toMatch(/já pode emitir notas/);
  });

  it("diz que o certificado foi salvo e o que ainda falta", () => {
    expect(aba).toMatch(/texto="Certificado salvo\. Para emitir notas, ainda falta a equipe da Aura terminar a configuração fiscal da sua empresa \(código CSC e inscrição estadual\)\. A senha não ficou salva\."/);
  });
});

describe("regime fiscal", () => {
  const cfg = ler("components/screens/nfe/TabConfig.tsx");
  const api = ler("services/nfceApi.ts");

  it("lê o regime do topo da resposta antes de config.regime", () => {
    expect(cfg).toMatch(/const regimeAtual = data\?\.regime \|\| data\?\.config\?\.regime \|\| "simples";/);
    expect(api).toMatch(/export type NfceConfigResponse = \{\n  config: NfceConfig \| null;\n(?:  \/\/.*\n)*  regime\?: "simples" \| "presumido" \| "real";/);
  });

  it("salva só o regime, nada mais da config fiscal", () => {
    expect(cfg).toMatch(/nfceApi\.saveConfig\(companyId, \{ regime \}\)/);
  });
});
