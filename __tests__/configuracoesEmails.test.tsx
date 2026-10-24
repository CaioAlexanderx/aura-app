// ============================================================
// Configurações › E-mails (tq-89 + app do tq-90, 24/10/2026)
//
// Aura-backend#896: /companies/:id/emails. Só o dono vê; o cartão da loja
// online some sem loja online (e no Essencial); blocos do relatório seguem o
// plano; "Entregue" só quando a API manda; interruptores otimistas que voltam
// se a API falhar; "Me enviar um agora" com o limite de 3 por dia.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/services/emailsApi", () => ({
  emailsApi: { get: jest.fn(), salvar: jest.fn(), adicionarEndereco: jest.fn(), removerEndereco: jest.fn(), ultimos: jest.fn(), enviarAgora: jest.fn() },
}));
const mockRequest = jest.fn();
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
let mockVisiveis = new Set<string>();
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => mockVisiveis }));
let mockAuth: any = {};
jest.mock("@/stores/auth", () => {
  const useAuthStore: any = (sel?: any) => (typeof sel === "function" ? sel(mockAuth) : mockAuth);
  useAuthStore.getState = () => mockAuth;
  return { useAuthStore };
});

import { SecaoEmails, EmailsSection, podeVerEmails, situacaoExibida, textoQuando, opcoesComAtual } from "@/components/screens/configuracoes/EmailsSection";
import { emailsApi } from "@/services/emailsApi";
import { toast } from "@/components/Toast";
import { secaoDoFoco, alvoDaSecao, rotaDeConfiguracoesNaSecao } from "@/utils/focoNaSecao";

const api = emailsApi as unknown as Record<string, jest.Mock>;
const CID = "00000000-0000-0000-0000-0000000000e1";
const TODOS = ["vendas", "mais_vendidos", "pagamentos_estoque", "crediario", "equipe_margem", "clientes", "loja_online"];

const ESTADO = (extra: any = {}) => ({
  remetente: "contato@getaura.com.br",
  plano: "negocio",
  sempre_enviamos: ["cobranca", "seguranca"],
  blocos: TODOS,
  blocos_do_plano: TODOS,
  enderecos: [
    { id: null, email: "maria@loja.com.br", principal: true, confirmado: true, confirmado_em: null, confirmacao_enviada_em: null },
  ],
  preferencias: {
    relatorio: { ligado: true, explicito: false, dia: 1, hora: 8, versao: "completa", blocos: TODOS, destinatarios: null, destinatarios_efetivos: ["maria@loja.com.br"] },
    ajuda: { ligado: true, explicito: false },
    acompanhamento: { ligado: true, explicito: false },
    novidades: { ligado: true, explicito: false },
    pedido_loja: { ligado: true, explicito: false, pedido_destino: "equipe", destinatarios: null, destinatarios_efetivos: ["maria@loja.com.br"], pedido_destino_escolhido: false },
  },
  limites: { enderecos_extras: 5, relatorio_agora_por_dia: 3 },
  ...extra,
});

const ULTIMOS = (emails: any[] = [], webhook_ligado = false) => ({ dias: 30, webhook_ligado, emails });

function apiError(status: number, message: string, code?: string) {
  const e: any = new Error(message);
  e.status = status;
  e.data = code ? { code, error: message } : { error: message };
  return e;
}

jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  mockVisiveis = new Set(["configuracoes"]);
  mockAuth = { company: { id: CID, plan: "negocio", member_role: "owner" }, isStaff: false, consolidatedView: false };
  api.get.mockResolvedValue(ESTADO());
  api.ultimos.mockResolvedValue(ULTIMOS());
  api.salvar.mockImplementation(async () => ESTADO());
  mockRequest.mockResolvedValue({ exists: true, is_published: true });
});

async function flush(vezes = 5) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount(el: React.ReactElement = <SecaoEmails />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
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
}

describe("funções puras", () => {
  it("podeVerEmails: dono e equipe Aura sim; funcionário e admin da loja não", () => {
    expect(podeVerEmails("owner", false)).toBe(true);
    expect(podeVerEmails("funcionario", false)).toBe(false);
    expect(podeVerEmails("member", false)).toBe(false);
    expect(podeVerEmails("admin", false)).toBe(false);
    expect(podeVerEmails("funcionario", true)).toBe(true);
  });
  it("situacaoExibida nunca inventa Entregue", () => {
    expect(situacaoExibida("entregue")).toBe("entregue");
    expect(situacaoExibida("enviado")).toBe("enviado");
    expect(situacaoExibida("delivered")).toBe("enviado");
    expect(situacaoExibida(undefined)).toBe("enviado");
    expect(situacaoExibida("devolvido")).toBe("devolvido");
    expect(situacaoExibida("falhou")).toBe("falhou");
  });
  it("textoQuando e opções curtas sem sábado", () => {
    expect(textoQuando(1, 8)).toBe("toda segunda-feira, às 8h");
    expect(textoQuando(0, 18)).toBe("todo domingo, às 18h");
    expect(opcoesComAtual([1, 5, 0], 5)).toEqual([1, 5, 0]);
    expect(opcoesComAtual([1, 5, 0], 3)).toEqual([1, 5, 0, 3]);
  });
  it("?foco=emails está registrado", () => {
    expect(secaoDoFoco("emails")?.chave).toBe("emails");
    expect(alvoDaSecao("emails")).toBe("configuracoes.emails");
    expect(rotaDeConfiguracoesNaSecao("emails")).toBe("/configuracoes?foco=emails");
  });
});

describe("quem vê", () => {
  it("o dono vê a seção da empresa ativa, com os cartões do mock", async () => {
    const tree = await mount();
    expect(api.get).toHaveBeenCalledWith(CID);
    expect(existe(tree, "emails-secao")).toBe(true);
    const t = text(tree);
    expect(t).toContain("Para onde vão os avisos");
    expect(t).toContain("Relatório da semana");
    expect(t).toContain("Cobrança e conta");
    expect(t).toContain("Sempre enviamos");
    expect(t).toContain("Ajuda e acompanhamento");
    expect(t).toContain("Novidades da Aura");
    expect(t).toContain("Últimos e-mails enviados");
    expect(t).toContain("maria@loja.com.br");
    // Sem "Ver um exemplo": o backend não tem rota pública de exemplo.
    expect(t).not.toContain("Ver um exemplo");
    tree.unmount();
  });

  it("funcionário não vê nada e a tela nem chama a API", async () => {
    mockAuth.company.member_role = "funcionario";
    const tree = await mount();
    expect(existe(tree, "emails-secao")).toBe(false);
    expect(tree.toJSON()).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("equipe Aura (staff) vê", async () => {
    mockAuth.company.member_role = "funcionario";
    mockAuth.isStaff = true;
    const tree = await mount();
    expect(existe(tree, "emails-secao")).toBe(true);
    tree.unmount();
  });

  it("no consolidado a seção não monta (Configurações mostra o aviso de escolher a empresa)", async () => {
    mockAuth = { company: null, isStaff: false, consolidatedView: true };
    const tree = await mount();
    expect(tree.toJSON()).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    tree.unmount();
  });

  it("se o backend recusar (403), a seção some", async () => {
    api.get.mockRejectedValue(apiError(403, "Só o dono da conta mexe nos e-mails.", "EMAILS_FORBIDDEN"));
    const tree = await mount();
    expect(existe(tree, "emails-secao")).toBe(false);
    tree.unmount();
  });

  it("migration pendente: disponível em breve", async () => {
    api.get.mockRejectedValue(apiError(503, "E-mails indisponíveis", "MIGRATION_PENDING"));
    const tree = await mount();
    expect(existe(tree, "emails-em-breve")).toBe(true);
    tree.unmount();
  });
});

describe("o que o plano não tem some", () => {
  it("com loja online publicada aparece o cartão do pedido novo", async () => {
    mockVisiveis = new Set(["configuracoes", "canal"]);
    const tree = await mount();
    expect(mockRequest).toHaveBeenCalledWith("/companies/" + CID + "/digital-channel");
    expect(existe(tree, "emails-pedido-loja")).toBe(true);
    expect(text(tree)).toContain("Pedido novo na loja online");
    tree.unmount();
  });

  it("sem loja online publicada o cartão some", async () => {
    mockVisiveis = new Set(["configuracoes", "canal"]);
    mockRequest.mockResolvedValue({ exists: true, is_published: false });
    const tree = await mount();
    expect(existe(tree, "emails-pedido-loja")).toBe(false);
    expect(text(tree)).not.toContain("Pedido novo na loja online");
    tree.unmount();
  });

  it("no Essencial (sem o módulo da loja) o cartão some, sem cadeado, e nem consulta a vitrine", async () => {
    mockAuth.company.plan = "essencial";
    api.get.mockResolvedValue(ESTADO({ plano: "essencial", blocos_do_plano: ["vendas", "mais_vendidos", "pagamentos_estoque"] }));
    const tree = await mount();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(existe(tree, "emails-pedido-loja")).toBe(false);
    expect(text(tree)).not.toContain("Pedido novo na loja online");
    // blocos do relatório: só os 3 do Essencial
    expect(existe(tree, "emails-bloco-vendas")).toBe(true);
    expect(existe(tree, "emails-bloco-pagamentos_estoque")).toBe(true);
    expect(existe(tree, "emails-bloco-crediario")).toBe(false);
    expect(existe(tree, "emails-bloco-loja_online")).toBe(false);
    expect(text(tree)).not.toContain("A partir do plano");
    tree.unmount();
  });

  it("desligar um bloco guarda os do plano maior que a tela não mostra", async () => {
    api.get.mockResolvedValue(ESTADO({ plano: "essencial", blocos_do_plano: ["vendas", "mais_vendidos", "pagamentos_estoque"] }));
    const tree = await mount();
    await press(tree, "emails-bloco-mais_vendidos");
    expect(api.salvar).toHaveBeenCalledWith(CID, { relatorio: { blocos: TODOS.filter((b) => b !== "mais_vendidos") } });
    tree.unmount();
  });
});

describe("últimos e-mails", () => {
  it("'Entregue' só quando vem da API", async () => {
    api.ultimos.mockResolvedValue(ULTIMOS([
      { id: "a", data: "2026-10-20T11:00:00Z", assunto: "Sua semana na loja", tipo: "relatorio_semanal", categoria: "relatorio", destinatario: "maria@loja.com.br", situacao: "enviado" },
      { id: "b", data: "2026-10-19T11:00:00Z", assunto: "Recebi seu pagamento", tipo: "cobranca_recibo", categoria: "cobranca", destinatario: "maria@loja.com.br", situacao: "falhou" },
    ]));
    let tree = await mount();
    expect(plano(byTestId(tree, "emails-situacao-a")[0])).toBe("Enviado");
    expect(plano(byTestId(tree, "emails-situacao-b")[0])).toBe("Falhou");
    expect(text(tree)).not.toContain("Entregue");
    expect(text(tree)).toContain("20/10");
    tree.unmount();

    api.ultimos.mockResolvedValue(ULTIMOS([
      { id: "c", data: "2026-10-20T11:00:00Z", assunto: "Sua semana na loja", tipo: "relatorio_semanal", categoria: "relatorio", destinatario: "maria@loja.com.br", situacao: "entregue" },
      { id: "d", data: "2026-10-18T11:00:00Z", assunto: "Já fez a primeira venda?", tipo: "ajuda_primeira_venda", categoria: "ajuda", destinatario: "maria@loja.com.br", situacao: "devolvido" },
    ], true));
    tree = await mount();
    expect(plano(byTestId(tree, "emails-situacao-c")[0])).toBe("Entregue");
    expect(plano(byTestId(tree, "emails-situacao-d")[0])).toBe("Devolvido");
    expect(plano(byTestId(tree, "emails-ultimos-nota")[0])).toContain("confira se o endereço está certo");
    tree.unmount();
  });

  it("sem e-mails no período, avisa", async () => {
    const tree = await mount();
    expect(existe(tree, "emails-ultimos-vazio")).toBe(true);
    tree.unmount();
  });
});

describe("salvamento otimista", () => {
  it("o interruptor muda na hora e volta se a API falhar, com toast", async () => {
    let falhar: (e: any) => void = () => {};
    api.salvar.mockImplementation(() => new Promise((_r, rej) => { falhar = rej; }));
    const tree = await mount();
    expect(byTestId(tree, "emails-novidades")[0].props.value).toBe(true);
    await alternar(tree, "emails-novidades", false);
    await flush(); // a API ainda não respondeu
    expect(api.salvar).toHaveBeenCalledWith(CID, { novidades: { ligado: false } });
    expect(byTestId(tree, "emails-novidades")[0].props.value).toBe(false);
    await act(async () => { falhar(apiError(500, "erro")); });
    await flush();
    expect(byTestId(tree, "emails-novidades")[0].props.value).toBe(true);
    expect(toast.error).toHaveBeenCalled();
    tree.unmount();
  });

  it("desligar o relatório esconde dia, horário e blocos", async () => {
    api.salvar.mockImplementation(async () => {
      const e = ESTADO();
      e.preferencias.relatorio.ligado = false;
      return e;
    });
    const tree = await mount();
    expect(existe(tree, "emails-relatorio-corpo")).toBe(true);
    await alternar(tree, "emails-relatorio", false);
    await flush();
    expect(existe(tree, "emails-relatorio-corpo")).toBe(false);
    tree.unmount();
  });

  it("dia e horário: só segunda, sexta e domingo; 7h, 8h, 9h e 18h", async () => {
    const tree = await mount();
    expect(existe(tree, "emails-dia-1")).toBe(true);
    expect(existe(tree, "emails-dia-5")).toBe(true);
    expect(existe(tree, "emails-dia-0")).toBe(true);
    expect(existe(tree, "emails-dia-6")).toBe(false);
    [7, 8, 9, 18].forEach((h) => expect(existe(tree, "emails-hora-" + h)).toBe(true));
    await press(tree, "emails-dia-5");
    expect(api.salvar).toHaveBeenCalledWith(CID, { relatorio: { dia: 5 } });
    tree.unmount();
  });
});

describe("endereços", () => {
  it("adiciona um extra e mostra 'Falta confirmar'", async () => {
    const depois = ESTADO({
      enderecos: [
        ...ESTADO().enderecos,
        { id: "11111111-1111-1111-1111-111111111111", email: "financeiro@loja.com.br", principal: false, confirmado: false, confirmado_em: null, confirmacao_enviada_em: "2026-10-24T12:00:00Z" },
      ],
    });
    api.adicionarEndereco.mockResolvedValue({ endereco: { id: "11111111-1111-1111-1111-111111111111", email: "financeiro@loja.com.br", confirmado: false }, confirmacao: "sent", estado: depois });
    const tree = await mount();
    await press(tree, "emails-adicionar");
    await act(async () => { byTestId(tree, "emails-novo-input")[0].props.onChangeText("financeiro@loja.com.br"); });
    await press(tree, "emails-novo-enviar");
    expect(api.adicionarEndereco).toHaveBeenCalledWith(CID, "financeiro@loja.com.br");
    expect(existe(tree, "emails-falta-confirmar-financeiro@loja.com.br")).toBe(true);
    expect(plano(byTestId(tree, "emails-aviso-endereco")[0])).toContain("Só passa a receber depois de confirmar");
    // extra sem confirmar não entra em "Quem recebe"
    expect(existe(tree, "emails-destinatario-financeiro@loja.com.br")).toBe(false);
    tree.unmount();
  });
});

describe("Me enviar um agora", () => {
  it("manda e conta quantos restam", async () => {
    api.enviarAgora.mockResolvedValue({ ok: true, para: "maria@loja.com.br", restantes: 2 });
    const tree = await mount();
    await press(tree, "emails-enviar-agora");
    expect(api.enviarAgora).toHaveBeenCalledWith(CID);
    expect(toast.success).toHaveBeenCalled();
    expect(plano(byTestId(tree, "emails-agora-restantes")[0])).toContain("mais 2 hoje");
    tree.unmount();
  });

  it("no limite de 3 por dia mostra a mensagem e trava o botão", async () => {
    api.enviarAgora.mockRejectedValue(apiError(429, "Dá para pedir até 3 relatórios por dia. Tente amanhã.", "LIMITE_DIARIO"));
    const tree = await mount();
    await press(tree, "emails-enviar-agora");
    expect(plano(byTestId(tree, "emails-agora-limite")[0])).toBe("Dá para pedir até 3 relatórios por dia. Tente amanhã.");
    expect(byTestId(tree, "emails-enviar-agora")[0].props.disabled).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
    tree.unmount();
  });
});

describe("EmailsSection direto", () => {
  it("monta com companyId explícito", async () => {
    const tree = await mount(<EmailsSection companyId={CID} />);
    expect(existe(tree, "emails-secao")).toBe(true);
    tree.unmount();
  });
});
