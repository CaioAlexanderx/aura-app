// ============================================================
// Black Friday › Placar do dia no WhatsApp (13/10/2026)
//
// Aura-backend#816: GET/PUT /companies/:id/placar-do-dia e o template
// `placar_dia` (POST /whatsapp/templates { preset }). O cartão mostra o
// estado do GET, o que falta para o placar chegar (com a saída de cada
// item), o toggle "enviar" e o "ano todo". Só o dono mexe.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a) } }));
jest.mock("@/services/placarApi", () => ({ placarApi: { get: jest.fn(), save: jest.fn() } }));
jest.mock("@/services/waApi", () => ({ waApi: { createTemplate: jest.fn() } }));

import { PlacarDoDiaCard } from "@/components/screens/blackfriday/PlacarDoDiaCard";
import { placarApi } from "@/services/placarApi";
import { waApi } from "@/services/waApi";
import { toast } from "@/components/Toast";

const api = placarApi as unknown as Record<string, jest.Mock>;
const wa = waApi as unknown as Record<string, jest.Mock>;
const CID = "00000000-0000-0000-0000-0000000000c1";

const ESTADO = (extra: any = {}) => ({
  enabled: false,
  always: false,
  season: { starts_at: "2026-11-01", ends_at: "2027-01-31" },
  in_season_today: false,
  whatsapp_connected: true,
  owner_phone_present: true,
  template_name: "placar_dia",
  template_approved: true,
  ...extra,
});

jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue(ESTADO());
  api.save.mockImplementation(async (_cid: string, body: any) => ESTADO({ enabled: body.enabled, always: body.always ?? false }));
  wa.createTemplate.mockResolvedValue({ name: "placar_dia", language: "pt_BR" });
});

async function flush(vezes = 4) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount(props: { isOwner?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <PlacarDoDiaCard companyId={CID} isOwner={props.isOwner !== false} />
      </QueryClientProvider>,
    );
  });
  await flush();
  return tree!;
}

const byTestId = (tree: renderer.ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }, { deep: false });
const existe = (tree: renderer.ReactTestRenderer, id: string) => byTestId(tree, id).length > 0;
function plano(no: any): string {
  if (no == null) return "";
  if (typeof no === "string") return no;
  if (Array.isArray(no)) return no.map(plano).join("");
  return plano(no.children);
}
const text = (tree: renderer.ReactTestRenderer) => plano(tree.toJSON());

async function press(tree: renderer.ReactTestRenderer, id: string) {
  const alvo = byTestId(tree, id);
  if (!alvo.length) throw new Error("testID não encontrado: " + id);
  await act(async () => { alvo[0].props.onPress(); });
  await flush();
}
async function alternar(tree: renderer.ReactTestRenderer, id: string, valor: boolean) {
  const alvo = byTestId(tree, id);
  if (!alvo.length) throw new Error("testID não encontrado: " + id);
  await act(async () => { alvo[0].props.onValueChange(valor); });
  await flush();
}

describe("estado", () => {
  it("lê o GET e mostra desligado, com a temporada", async () => {
    const tree = await mount();
    expect(api.get).toHaveBeenCalledWith(CID);
    expect(text(tree)).toContain("Placar do dia no WhatsApp");
    expect(plano(byTestId(tree, "placar-situacao")[0])).toBe("Desligado");
    expect(byTestId(tree, "placar-toggle")[0].props.value).toBe(false);
    expect(byTestId(tree, "placar-ano-todo")[0].props.value).toBe(false);
    expect(text(tree)).toContain("01/11/2026 a 31/01/2027");
    // tudo em ordem: sem lista de pendências
    expect(existe(tree, "placar-pronto")).toBe(true);
    expect(existe(tree, "placar-faltas")).toBe(false);
    tree.unmount();
  });

  it("ligado dentro da temporada, fora dela e o ano todo", async () => {
    api.get.mockResolvedValue(ESTADO({ enabled: true, in_season_today: true }));
    let tree = await mount();
    expect(plano(byTestId(tree, "placar-situacao")[0])).toBe("Ligado — dentro da temporada");
    tree.unmount();

    api.get.mockResolvedValue(ESTADO({ enabled: true, in_season_today: false }));
    tree = await mount();
    expect(plano(byTestId(tree, "placar-situacao")[0])).toBe("Ligado — fora da temporada, volta em 01/11/2026");
    tree.unmount();

    api.get.mockResolvedValue(ESTADO({ enabled: true, always: true }));
    tree = await mount();
    expect(plano(byTestId(tree, "placar-situacao")[0])).toBe("Ligado o ano todo");
    expect(byTestId(tree, "placar-ano-todo")[0].props.value).toBe(true);
    tree.unmount();
  });

  it("503 (migration pendente) vira 'disponível em breve'", async () => {
    api.get.mockRejectedValue({ status: 503, data: { code: "MIGRATION_PENDING" } });
    const tree = await mount();
    expect(existe(tree, "placar-em-breve")).toBe(true);
    expect(existe(tree, "placar-toggle")).toBe(false);
    tree.unmount();
  });

  it("erro de rede mostra 'tentar de novo'", async () => {
    api.get.mockRejectedValueOnce(new Error("boom"));
    const tree = await mount();
    expect(existe(tree, "placar-erro")).toBe(true);
    api.get.mockResolvedValue(ESTADO());
    await press(tree, "placar-tentar-de-novo");
    expect(existe(tree, "placar-toggle")).toBe(true);
    tree.unmount();
  });
});

describe("o que falta", () => {
  it("sem WhatsApp: leva à aba Conexão e trava o template", async () => {
    api.get.mockResolvedValue(ESTADO({ whatsapp_connected: false, template_approved: false }));
    const tree = await mount();
    expect(existe(tree, "placar-faltas")).toBe(true);
    expect(existe(tree, "placar-falta-whatsapp")).toBe(true);
    expect(existe(tree, "placar-falta-telefone")).toBe(false);
    expect(existe(tree, "placar-falta-template")).toBe(true);
    expect(text(tree)).toContain("Conecte o WhatsApp primeiro");
    expect(byTestId(tree, "placar-criar-template")[0].props.disabled).toBe(true);

    await press(tree, "placar-conectar-whatsapp");
    expect(mockPush).toHaveBeenCalledWith("/whatsapp");
    tree.unmount();
  });

  it("sem telefone do dono: explica que é o do cadastro e oferece falar com a Aura", async () => {
    api.get.mockResolvedValue(ESTADO({ owner_phone_present: false }));
    const tree = await mount();
    expect(existe(tree, "placar-falta-telefone")).toBe(true);
    expect(text(tree)).toContain("celular do cadastro da conta");
    expect(existe(tree, "placar-cadastrar-telefone")).toBe(true);
    expect(existe(tree, "placar-pronto")).toBe(false);
    tree.unmount();
  });

  it("ligado com algo faltando avisa que o placar ainda não chega", async () => {
    api.get.mockResolvedValue(ESTADO({ enabled: true, template_approved: false }));
    const tree = await mount();
    expect(text(tree)).toContain("O placar ainda não chega. Falta:");
    tree.unmount();
  });

  it("criar o modelo: POST /whatsapp/templates { preset: placar_dia } e recarrega o estado", async () => {
    api.get.mockResolvedValue(ESTADO({ template_approved: false }));
    const tree = await mount();
    expect(byTestId(tree, "placar-criar-template")[0].props.disabled).toBe(false);
    const chamadasAntes = api.get.mock.calls.length;
    await press(tree, "placar-criar-template");
    expect(wa.createTemplate).toHaveBeenCalledWith(CID, { preset: "placar_dia" });
    expect(toast.success).toHaveBeenCalled();
    expect(existe(tree, "placar-aviso")).toBe(true);
    expect(text(tree)).toContain("até 24 horas");
    expect(api.get.mock.calls.length).toBeGreaterThan(chamadasAntes);
    tree.unmount();
  });

  it("erro ao criar o modelo mostra a mensagem do WhatsApp", async () => {
    api.get.mockResolvedValue(ESTADO({ template_approved: false }));
    wa.createTemplate.mockRejectedValue({ status: 409, data: { code: "NAO_CONECTADO", error: "O WhatsApp ainda não está conectado." } });
    const tree = await mount();
    await press(tree, "placar-criar-template");
    expect(existe(tree, "placar-aviso-erro")).toBe(true);
    expect(text(tree)).toContain("O WhatsApp ainda não está conectado.");
    tree.unmount();
  });
});

describe("toggles", () => {
  it("ligar manda { enabled: true } e o cartão passa a mostrar o novo estado", async () => {
    const tree = await mount();
    await alternar(tree, "placar-toggle", true);
    expect(api.save).toHaveBeenCalledWith(CID, { enabled: true });
    expect(byTestId(tree, "placar-toggle")[0].props.value).toBe(true);
    tree.unmount();
  });

  it("'o ano todo' manda enabled junto com always", async () => {
    api.get.mockResolvedValue(ESTADO({ enabled: true }));
    const tree = await mount();
    await alternar(tree, "placar-ano-todo", true);
    expect(api.save).toHaveBeenCalledWith(CID, { enabled: true, always: true });
    expect(byTestId(tree, "placar-ano-todo")[0].props.value).toBe(true);
    tree.unmount();
  });

  it("403 do servidor vira a frase do dono", async () => {
    api.save.mockRejectedValue({ status: 403, data: { code: "PLACAR_FORBIDDEN" } });
    const tree = await mount();
    await alternar(tree, "placar-toggle", true);
    expect(text(tree)).toContain("Só o dono da conta liga ou desliga o placar do dia.");
    tree.unmount();
  });
});

describe("quem não é dono", () => {
  it("vê o estado, mas não vê os controles nem as ações", async () => {
    api.get.mockResolvedValue(ESTADO({ enabled: true, always: true, whatsapp_connected: false, owner_phone_present: false, template_approved: false }));
    const tree = await mount({ isOwner: false });
    expect(existe(tree, "placar-toggle")).toBe(false);
    expect(existe(tree, "placar-ano-todo")).toBe(false);
    expect(plano(byTestId(tree, "placar-situacao")[0])).toBe("Ligado o ano todo");
    expect(existe(tree, "placar-so-dono")).toBe(true);
    expect(existe(tree, "placar-faltas")).toBe(true);
    expect(existe(tree, "placar-conectar-whatsapp")).toBe(false);
    expect(existe(tree, "placar-criar-template")).toBe(false);
    expect(existe(tree, "placar-cadastrar-telefone")).toBe(false);
    tree.unmount();
  });
});
