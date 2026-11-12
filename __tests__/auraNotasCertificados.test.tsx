// ============================================================
// Gestão Aura > Aura Notas (12/11/2026) — render da lista e do detalhe.
//
// O que estes testes seguram:
//  1. empresa só com certificado aparece com "Só certificado — NFC-e não
//     configurada"; quem tem NFS-e mostra "NFS-e"; certificado perto de
//     vencer e vencido têm rótulo próprio; certificado antigo pede o A1 de novo;
//  2. empresa sem NFC-e não mostra CSC/estatísticas da NFC-e no cartão;
//  3. o detalhe mostra a lista de requisitos de NFC-e e NFS-e;
//  4. mudar a série da NFS-e abre a confirmação com o aviso de número
//     repetido, e só depois o PUT sai com confirmar_numeracao;
//  5. o Remover de quem usa NFS-e avisa que o certificado sai e a NFS-e para.
//
// Mesmo padrão de appointmentDetailModal.test.tsx: react-native mockado com
// tags simples, testID + findAllByProps({deep:false}).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Switch: "Switch",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
}));

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/helpers", () => ({ IS_WIDE: false }));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock("@/components/Toast", () => ({
  toast: {
    success: (...a: any[]) => mockToast.success(...a),
    error: (...a: any[]) => mockToast.error(...a),
    info: (...a: any[]) => mockToast.info(...a),
  },
}));

const mockRequest = jest.fn();
jest.mock("@/services/api", () => {
  class ApiError extends Error { data: any; constructor(m: string, _s?: number, d?: any) { super(m); this.data = d; } }
  return { request: (...a: any[]) => mockRequest(...a), ApiError };
});

let mockLista: any = { companies: [] };
let mockDetalhe: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: (opts: any) =>
    opts.queryKey[0] === "aura-notas-companies"
      ? { data: mockLista, isLoading: false, isError: false, refetch: jest.fn() }
      : { data: mockDetalhe, isLoading: false, isError: false, refetch: jest.fn() },
  useMutation: (opts: any) => ({
    isPending: false,
    mutate: (vars: any) => {
      Promise.resolve()
        .then(() => opts.mutationFn(vars))
        .then((res: any) => opts.onSuccess?.(res, vars))
        .catch((err: any) => opts.onError?.(err, vars));
    },
  }),
}));

import { AuraNotasAdmin } from "@/components/admin/AuraNotasAdmin";
import { rotulosDaEmpresa, precisaConfirmar, textoRemover } from "@/components/admin/auraNotasRotulos";

const base = {
  cnpj: "11222333000181", ambiente: null, provider: null, provider_efetivo: "nuvemfiscal",
  engine_capable: false, csc_ok: false, serie_sefaz_sp: null, last_emission: null,
  stats_30d: { total: 0, engine: 0, gateway: 0, fallbacks: 0 }, breaker_open: false,
  uf: "SP", municipio: "São Paulo", faltas: { nfce: 3, nfse: 2 },
};
const cert = (dias: number) => ({
  subject_cn: "EMPRESA TESTE:11222333000181", not_after: "2026-12-01T00:00:00Z", days_left: dias,
  vencido: dias < 0, vence_em_breve: dias >= 0 && dias <= 30,
});
const SO_CERT = { ...base, company_id: "c-so-cert", name: "Empresa Só Certificado", cert: cert(10), na_lista_por: "certificado", nfce_configurada: false, nfse_configurada: false, nfse: null, certificado_fontes: ["cofre"] };
const SO_NFSE = { ...base, company_id: "c-so-nfse", name: "Empresa Só NFS-e", cert: cert(200), na_lista_por: "certificado", nfce_configurada: false, nfse_configurada: true, nfse: { provider: "nacional", ambiente: "producao_restrita", ativa: false, municipio_ibge: "3550308" }, certificado_fontes: ["cofre"] };
const VENCIDO = { ...base, company_id: "c-vencido", name: "Empresa Vencida", cert: cert(-3), nfce_configurada: true, nfse_configurada: false, nfse: null, certificado_fontes: ["cofre"], csc_ok: true, ambiente: "producao" };
const ANTIGO = { ...base, company_id: "c-antigo", name: "Empresa Antiga", cert: null, nfce_configurada: false, nfse_configurada: false, nfse: null, certificado_fontes: ["nuvem_fiscal_legado"] };

const req = (chave: string, estado: string) => ({ chave, rotulo: chave, estado, detalhe: "detalhe " + chave });
const DETALHE_SO_NFSE = {
  company: { legal_name: "Empresa Só NFS-e LTDA", trade_name: "Empresa Só NFS-e", cnpj: "11222333000181", address_street: null, address_number: null, address_district: null, address_city: "São Paulo", address_state: "SP", address_zip: null, ibge_code: "3550308", inscricao_estadual: null, tax_regime: "simples_nacional" },
  config: { ambiente: null, uf: null, provider: null, serie_nfce: null, next_number: null, serie_sefaz_sp: null, next_number_sefaz_sp: null, csc_id: null, csc_ok: false, is_active: null },
  cert: { ...cert(200), not_before: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
  stats_30d: base.stats_30d, breaker_open: false,
  nfce_configurada: false, nfse_configurada: true, certificado_fontes: ["cofre"], ufs_atendidas: ["AP", "MG", "RJ", "SP"],
  nfse: { provider: "nacional", ambiente: "producao_restrita", is_active: false, serie: "1", next_dps_number: "1", municipio_ibge: "3550308", ctribnac_padrao: "010501", cnbs_padrao: null, op_simp_nac: 3, reg_ap_trib_sn: 1, p_tot_trib_sn: 6, default_iss_rate: null, inscricao_municipal: null, outro_emissor: false, outro_emissor_serie: null, outro_emissor_ultimo_numero: null, ultimo_teste_status: null, ultimo_teste_mensagem: null },
  requisitos: {
    nfce: { configurada: false, pronta: false, itens: [req("certificado", "ok"), req("inscricao_estadual", "falta"), req("csc", "falta")] },
    nfse: { configurada: true, apta: false, pendencias: [], itens: [req("certificado", "ok"), req("inscricao_municipal", "opcional"), req("ativa", "falta")] },
  },
};

const one = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false })[0];
const all = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
function texto(n: any): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  return (n.children || []).map(texto).join("");
}
const textos = (t: renderer.ReactTestRenderer) => t.root.findAll((n) => (n.type as unknown) === "Text").map(texto);
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

async function montar() {
  let t!: renderer.ReactTestRenderer;
  await act(async () => { t = renderer.create(<AuraNotasAdmin />); });
  return t;
}

beforeEach(() => {
  mockRequest.mockReset().mockResolvedValue({ ok: true });
  mockToast.success.mockReset(); mockToast.error.mockReset(); mockToast.info.mockReset();
  mockLista = { companies: [SO_CERT, SO_NFSE, VENCIDO, ANTIGO] };
  mockDetalhe = DETALHE_SO_NFSE;
});

describe("Aura Notas — lista com os rótulos", () => {
  it("cada caso mostra o rótulo do que tem e do que falta", async () => {
    const t = await montar();
    const card = (id: string) => one(t, "aura-notas-card-" + id);
    const rotulosDe = (id: string) => card(id).findAll((n: any) => (n.type as unknown) === "View" && String(n.props.testID || "").startsWith("aura-notas-rotulo-")).map((n: any) => texto(n));

    expect(rotulosDe("c-so-cert")).toEqual(["Só certificado — NFC-e não configurada", "Certificado vence em 10 dias"]);
    expect(rotulosDe("c-so-nfse")).toEqual(["Só certificado — NFC-e não configurada", "NFS-e"]);
    expect(rotulosDe("c-vencido")).toEqual(["Certificado vencido"]);
    expect(rotulosDe("c-antigo")).toEqual(["NFC-e não configurada", "Certificado antigo (Nuvem Fiscal) — pedir o A1 de novo"]);
    t.unmount();
  });

  it("empresa sem NFC-e não mostra CSC nem estatísticas da NFC-e no cartão", async () => {
    const t = await montar();
    const doCartao = (id: string) => one(t, "aura-notas-card-" + id).findAll((n: any) => (n.type as unknown) === "Text").map(texto);
    expect(doCartao("c-so-cert").join("|")).not.toMatch(/CSC|30d total|Sem emissões/);
    expect(doCartao("c-so-cert")).toContain("Sem NFC-e");
    expect(doCartao("c-vencido").join("|")).toMatch(/CSC/);
    expect(texto(one(t, "aura-notas-faltas-c-so-nfse"))).toBe("NFC-e: 3 itens faltam · NFS-e: 2 itens faltam");
    t.unmount();
  });
});

describe("Aura Notas — detalhe", () => {
  async function abrir() {
    const t = await montar();
    await act(async () => { one(t, "aura-notas-card-c-so-nfse").props.onPress(); await flush(); });
    return t;
  }

  it("mostra os requisitos de NFC-e e NFS-e", async () => {
    const t = await abrir();
    expect(one(t, "aura-notas-requisitos")).toBeTruthy();
    expect(all(t, "req-nfce-csc")).toHaveLength(1);
    expect(texto(one(t, "req-nfce-csc"))).toMatch(/falta/);
    expect(texto(one(t, "req-nfse-inscricao_municipal"))).toMatch(/opcional/);
    expect(one(t, "aura-notas-nfse")).toBeTruthy();
    t.unmount();
  });

  it("mudar a série da NFS-e pede confirmação antes de salvar", async () => {
    const t = await abrir();
    const serie = one(t, "aura-notas-nfse").findAll((n: any) => (n.type as unknown) === "TextInput" && n.props.value === "1")[0];
    await act(async () => { serie.props.onChangeText("3"); });
    await act(async () => { one(t, "aura-notas-salvar-nfse").props.onPress(); await flush(); });
    expect(mockRequest).not.toHaveBeenCalled();
    expect(textos(t).join("|")).toMatch(/número repetido/);
    const confirmar = t.root.findAll((n) => (n.type as unknown) === "Pressable" && texto(n) === "Confirmar e salvar")[0];
    await act(async () => { confirmar.props.onPress(); await flush(); });
    expect(mockRequest).toHaveBeenCalledWith(
      "/admin/aura-notas/c-so-nfse/nfse",
      expect.objectContaining({ method: "PUT", body: { serie: "3", confirmar_producao: false, confirmar_numeracao: true } }),
    );
    t.unmount();
  });
});

describe("auraNotasRotulos", () => {
  it("rótulos com backend antigo (sem os campos novos) não inventam nada", () => {
    const antigo: any = { ...base, company_id: "x", name: "x", cert: { subject_cn: "x", not_after: "2027-01-01", days_left: 90 } };
    delete antigo.faltas;
    expect(rotulosDaEmpresa(antigo)).toEqual([]);
  });
  it("1 dia e hoje", () => {
    expect(rotulosDaEmpresa({ ...(SO_CERT as any), cert: cert(1) }).map((r) => r.texto)).toContain("Certificado vence em 1 dia");
    expect(rotulosDaEmpresa({ ...(SO_CERT as any), cert: cert(0) }).map((r) => r.texto)).toContain("Certificado vence hoje");
  });
  it("confirmação: produção e numeração, mesmo valor não pede", () => {
    expect(precisaConfirmar({ ambienteAntes: "homologacao", ambienteDepois: "producao", serieAntes: 2, serieDepois: 2, numeroAntes: 5, numeroDepois: 5 }))
      .toEqual({ producao: true, numeracao: false });
    expect(precisaConfirmar({ ambienteAntes: "producao", ambienteDepois: "producao", serieAntes: 2, serieDepois: "3", numeroAntes: 5, numeroDepois: 5 }))
      .toEqual({ producao: false, numeracao: true });
    expect(precisaConfirmar({ ambienteAntes: null, ambienteDepois: "homologacao", serieAntes: null, serieDepois: null, numeroAntes: null, numeroDepois: null }))
      .toEqual({ producao: false, numeracao: false });
  });
  it("Remover de quem usa NFS-e avisa que o certificado sai e a NFS-e para", () => {
    expect(textoRemover("Loja", true)).toMatch(/certificado A1 também é o da NFS-e.*NFS-e para de emitir/);
    expect(textoRemover("Loja", false)).not.toMatch(/NFS-e/);
  });
});
