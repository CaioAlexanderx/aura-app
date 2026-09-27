// ============================================================
// Redes sociais no painel (02/09/2026)
//
// A lojista cadastra Instagram, TikTok e Facebook em "Informações do
// negócio" e cada um vira um ícone no rodapé da loja. O backend
// (Aura-backend, services/redesSociais.js) normaliza o @ — aqui é só o
// campo, e o que este teste guarda é que ele não se perca no caminho:
// estado, recarga da config e envio no salvar.
// ============================================================
import fs from "fs";
import path from "path";
// 27/09/2026: o corpo do salvar e a leitura da config saíram da tela para
// canal/meuSite.ts (QA da Loja Digital). O teste passou a exercitar as
// funções em vez de procurar a linha no fonte.
import { corpoDoMeuSite, formDoMeuSite } from "@/components/screens/canal/meuSite";

const tab = fs.readFileSync(
  path.join(__dirname, "../components/screens/canal/TabMeuSite.tsx"),
  "utf8",
);

describe("os três campos existem e chegam ao backend", () => {
  test.each(["tiktok", "facebook"])("%s tem estado próprio", (rede) => {
    const Rede = rede.charAt(0).toUpperCase() + rede.slice(1);
    expect(tab).toContain(`const [${rede}, set${Rede}] = useState(config.${rede} || "");`);
  });

  test("os três vão no corpo do salvar", () => {
    const corpo = corpoDoMeuSite({ ...formDoMeuSite({}), instagram: " @a ", tiktok: "@b", facebook: "" });
    expect(corpo.instagram).toBe("@a");
    expect(corpo.tiktok).toBe("@b");
    // Vazio vai como null — e vai: chave presente é o que apaga no servidor.
    expect(Object.prototype.hasOwnProperty.call(corpo, "facebook")).toBe(true);
    expect(corpo.facebook).toBeNull();
    expect(tab).toContain("corpoDoMeuSite(formAtual, politicaPadrao)");
  });

  test("recarregar a config repõe os três", () => {
    // Sem isto, abrir a aba de novo mostrava campo vazio e o salvar
    // seguinte apagava o que a lojista tinha cadastrado.
    const f = formDoMeuSite({ instagram: "@a", tiktok: "@b", facebook: "@c" });
    expect([f.instagram, f.tiktok, f.facebook]).toEqual(["@a", "@b", "@c"]);
    expect(tab).toContain("setInstagram(f.instagram);");
    expect(tab).toContain("setTiktok(f.tiktok);");
    expect(tab).toContain("setFacebook(f.facebook);");
    expect(tab).toContain("const f = formDoMeuSite(config, company?.name);");
  });

  test("os campos ficam juntos, e a dica diz o que acontece", () => {
    const i = tab.indexOf('label="Instagram"');
    const t = tab.indexOf('label="TikTok"');
    const f = tab.indexOf('label="Facebook"');
    expect(i).toBeGreaterThan(0);
    expect(t).toBeGreaterThan(i);
    expect(f).toBeGreaterThan(t);
    expect(tab.slice(f, f + 400)).toContain("ícone no rodapé da sua loja");
    // A lojista pode colar o link em vez do @ — o backend aceita os dois.
    expect(tab.slice(f, f + 400)).toContain("o @ ou o link do perfil");
  });
});
