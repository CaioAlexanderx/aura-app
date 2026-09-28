// ============================================================
// QA fix (LJ-01, 28/09/2026, Studio rodada 3) — mostrarCarregandoSessao.
//
// Achado: abrir app.getaura.com.br/ com sessão válida mostrava o
// FORMULÁRIO de login inteiro por ≥3s antes de ir sozinho pra /studio.
// Causa: hydrate() (stores/auth.ts) só marca isHydrated=true depois de
// esperar /auth/me quando há token salvo — até lá, o <Slot/> do
// app/_layout.tsx renderiza o que bate com "/" nesse meio-tempo.
//
// mostrarCarregandoSessao() decide quando trocar o <Slot/> por um
// carregamento neutro: SÓ na raiz vazia ("/", segments=[]) e só antes de
// hidratar — pra não atrasar nenhuma rota pública (vitrine, aprovação,
// acompanhamento…), que não depende de isHydrated pra renderizar.
// ============================================================
import { mostrarCarregandoSessao } from "@/utils/carregandoSessao";

describe("mostrarCarregandoSessao", () => {
  test("raiz vazia, ainda não hidratou: mostra o carregamento neutro", () => {
    expect(mostrarCarregandoSessao([], false)).toBe(true);
  });

  test("raiz vazia, já hidratou: mostra o Slot normal (o redirect já pode ter rodado)", () => {
    expect(mostrarCarregandoSessao([], true)).toBe(false);
  });

  test("qualquer rota com segmento (login, studio, vitrine pública…): nunca segura, hidratado ou não", () => {
    expect(mostrarCarregandoSessao(["(auth)", "login"], false)).toBe(false);
    expect(mostrarCarregandoSessao(["studio"], false)).toBe(false);
    expect(mostrarCarregandoSessao(["aprovacao", "token123"], false)).toBe(false);
    expect(mostrarCarregandoSessao(["minha-loja"], false)).toBe(false);
  });
});
