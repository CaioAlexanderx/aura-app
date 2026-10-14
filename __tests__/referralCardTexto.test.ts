// ============================================================================
// AURA. — Cartão "Indique e ganhe": texto da campanha (14/10/2026)
//
// O texto antigo prometia 20% de desconto ao indicador, o que nenhum código
// cumpria, e chamava de "Descontos" o que eram cadastros. A promessa agora é
// a aprovada pelo Caio e pela Célia: 1 mês grátis quando o indicado paga a
// primeira mensalidade; o indicado testa 7 dias e tem 20% no primeiro mês.
// Guarda de fonte (o componente puxa expo-font e afins; não renderizamos).
// ============================================================================
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(path.join(__dirname, "..", "components", "ReferralCard.tsx"), "utf8");

describe("ReferralCard: texto da campanha", () => {
  test("descrição promete 1 mês grátis ao indicador e 7 dias + 20% ao indicado", () => {
    expect(SRC).toContain("Indique um lojista e ganhe 1 mês grátis quando ele pagar a primeira mensalidade.");
    expect(SRC).toContain("Quem você indicar testa 7 dias grátis e ganha 20% no primeiro mês.");
  });

  test("não promete mais 20% de desconto ao indicador", () => {
    expect(SRC).not.toContain("Ganhe 20% de desconto indicando amigos");
  });

  test("mensagem de compartilhar leva o código e o link /r/{codigo}", () => {
    expect(SRC).toContain('"Com o meu código " + codigo + " você testa 7 dias grátis e ganha 20% de desconto na primeira mensalidade. "');
    expect(SRC).toContain('"Começa por aqui: https://getaura.com.br/r/" + codigo');
    expect(SRC).toContain("encodeURIComponent(mensagemIndicacao(code))");
  });

  test("rótulos: Cadastros e Pendentes; 'Concluidas' e 'Descontos' saem", () => {
    expect(SRC).toContain("<Text style={s.statLabel}>Cadastros</Text>");
    expect(SRC).toContain("<Text style={s.statLabel}>Pendentes</Text>");
    expect(SRC).not.toContain(">Concluidas<");
    expect(SRC).not.toContain(">Descontos<");
  });
});
