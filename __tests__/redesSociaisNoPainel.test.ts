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
    expect(tab).toContain("instagram: instagram.trim() || null,");
    expect(tab).toContain("tiktok: tiktok.trim() || null,");
    expect(tab).toContain("facebook: facebook.trim() || null,");
  });

  test("recarregar a config repõe os três", () => {
    // Sem isto, abrir a aba de novo mostrava campo vazio e o salvar
    // seguinte apagava o que a lojista tinha cadastrado.
    expect(tab).toContain('setInstagram(config.instagram || "");');
    expect(tab).toContain('setTiktok(config.tiktok || "");');
    expect(tab).toContain('setFacebook(config.facebook || "");');
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
