// 24/10/2026 (tq-91) — link aberto sem sessão volta para a tela pedida depois
// do login. Só caminho interno: nada de open redirect.
import {
  destinoSeguro, guardarDestino, lerDestino, consumirDestino, limparDestino,
  marcarSaidaVoluntaria, VALIDADE_DO_DESTINO_MS, __zerarDestino,
} from "@/utils/destinoDepoisDoLogin";

beforeEach(() => {
  __zerarDestino();
  try { window.sessionStorage.clear(); } catch {}
});

describe("destinoSeguro · caminhos internos aceitos", () => {
  it.each([
    ["/crediario?filtro=atraso", "/crediario?filtro=atraso"],
    ["/crediario?filtro=atraso&empresa=3f2a9c1e-0000-4000-8000-000000000001", "/crediario?filtro=atraso&empresa=3f2a9c1e-0000-4000-8000-000000000001"],
    ["/financeiro", "/financeiro"],
    ["/vendas?tab=ranking#topo", "/vendas?tab=ranking"],
    ["/estoque?busca=camisa%20azul", "/estoque?busca=camisa%20azul"],
    ["/relatorios?volta=http://x", "/relatorios?volta=http://x"], // query é dado da tela, não destino
  ])("%s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});

describe("destinoSeguro · ataques e lixo recusados", () => {
  it.each([
    ["//mal.com"],
    ["//mal.com/crediario"],
    ["https://mal.com"],
    ["http://mal.com/crediario"],
    ["javascript:alert(1)"],
    ["/javascript:alert(1)"],
    ["data:text/html,oi"],
    ["\\\\mal.com"],
    ["/\\mal.com"],
    ["\\/mal.com"],
    ["/%2F%2Fmal.com"],
    ["/%2fmal.com"],
    ["/%5Cmal.com"],
    ["/\t/mal.com"],
    ["/\n/mal.com"],
    [" /crediario"],
    ["/crediario\u0000"],
    ["mal.com"],
    ["crediario"],
    ["/%E0%A4%A"], // escape quebrado
    [""],
    ["/"],
    ["/?empresa=1"],
    ["/login"],
    ["/login?invite_token=x"],
    ["/(auth)/login"],
    ["/register"],
    ["/verify-email"],
    ["/reset-password?token=x"],
    ["/" + "a".repeat(3000)],
  ])("%j", (entrada) => {
    expect(destinoSeguro(entrada)).toBeNull();
  });

  it("não-string", () => {
    expect(destinoSeguro(null)).toBeNull();
    expect(destinoSeguro(undefined)).toBeNull();
    expect(destinoSeguro(42)).toBeNull();
    expect(destinoSeguro({ toString: () => "/crediario" })).toBeNull();
  });
});

describe("guardar, ler e consumir", () => {
  it("guarda caminho + query; o login lê sem apagar; o AuthGuard consome", () => {
    expect(guardarDestino("/crediario?filtro=atraso", 1000)).toBe(true);
    expect(lerDestino(2000)).toBe("/crediario?filtro=atraso");
    expect(lerDestino(3000)).toBe("/crediario?filtro=atraso");
    expect(consumirDestino(4000)).toBe("/crediario?filtro=atraso");
    expect(lerDestino(5000)).toBeNull();
  });

  it("destino inválido não apaga o que já estava guardado (logout recarrega em '/')", () => {
    guardarDestino("/financeiro", 1000);
    expect(guardarDestino("/", 2000)).toBe(false);
    expect(guardarDestino("//mal.com", 2000)).toBe(false);
    expect(lerDestino(3000)).toBe("/financeiro");
  });

  it("vence em 30 minutos", () => {
    guardarDestino("/financeiro", 1000);
    expect(lerDestino(1000 + VALIDADE_DO_DESTINO_MS)).toBe("/financeiro");
    expect(lerDestino(1000 + VALIDADE_DO_DESTINO_MS + 1)).toBeNull();
    expect(lerDestino(1000)).toBeNull(); // vencido foi apagado
  });

  it("sessionStorage mexido à mão é revalidado na leitura", () => {
    window.sessionStorage.setItem("aura_destino_pos_login", JSON.stringify({ caminho: "//mal.com", em: Date.now() }));
    expect(lerDestino()).toBeNull();
    window.sessionStorage.setItem("aura_destino_pos_login", "lixo{");
    expect(lerDestino()).toBeNull();
  });

  it("botão Sair: apaga o destino e não guarda a tela de onde saiu", () => {
    const agora = Date.now();
    guardarDestino("/financeiro", agora);
    marcarSaidaVoluntaria(agora);
    expect(lerDestino(agora)).toBeNull();
    expect(guardarDestino("/configuracoes", agora + 100)).toBe(false);
    // Passada a janela, volta a guardar (no nativo, que não recarrega).
    expect(guardarDestino("/configuracoes", agora + 5000)).toBe(true);
  });

  it("limparDestino apaga", () => {
    guardarDestino("/financeiro");
    limparDestino();
    expect(lerDestino()).toBeNull();
  });
});
