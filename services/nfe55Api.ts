// ============================================================
// AURA. — NF-e modelo 55 de VENDA (emissão própria). 14/11/2026 — CP4.
// Rotas do backend (Aura-backend#1017 e #1018), sempre na loja DA VENDA
// (multi-CNPJ: no consolidado, o company_id da venda):
//   GET|POST /companies/:id/nfe55/venda/:saleId/previa
//   POST     /companies/:id/nfe55/venda/:saleId/emitir
//   GET      /companies/:id/nfe55/:emissaoId/danfe.pdf   (Bearer → blob)
//   GET      /companies/:id/nfe55/:emissaoId/xml         (Bearer → blob)
//   POST     /companies/:id/nfe55/:emissaoId/enviar-email
// ============================================================
import { request } from "./api";

export type Faltante = {
  campo: string;
  mensagem: string;
  tipo: "faltando" | "invalido";
  product_id?: string | null;
};

export type EnderecoNfe = {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  codigo_municipio_ibge?: string | null;
};

export type IndIeDest = 1 | 2 | 9;

export type DestinatarioPrevia = {
  documento: string | null;
  nome: string | null;
  ie: string | null;
  ind_ie_dest: IndIeDest;
  email: string | null;
  endereco: EnderecoNfe;
  origem?: { cadastro: boolean; ibge: string | null };
  customer_id?: string | null;
};

export type ItemPrevia = {
  product_id: string | null;
  nome: string;
  ncm: string | null;
  cest: string | null;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_bruto: number;
  desconto: number;
  frete: number;
  valor_total: number;
  cfop: string;
  csosn: string;
  origem: number;
};

export type ModFrete = 0 | 1 | 2 | 3 | 4 | 9;

export type Transportadora = {
  documento?: string | null;
  nome?: string | null;
  ie?: string | null;
  endereco?: string | null;
  municipio?: string | null;
  uf?: string | null;
};

export type ResumoNota = {
  id: string;
  tipo: string;
  numero: number | null;
  serie: number | null;
  status: string;
  chave_acesso: string | null;
};

export type Previa = {
  pode_emitir: boolean;
  bloqueio: { code: string; error: string } | null;
  faltantes: Faltante[];
  nota_existente: ResumoNota | null;
  nota_pendente: ResumoNota | null;
  ambiente?: "homologacao" | "producao";
  destinatario?: DestinatarioPrevia;
  operacao?: {
    natureza_operacao: string;
    uf_emitente: string;
    uf_destino: string | null;
    id_dest: 1 | 2;
    ind_final: 0 | 1;
    ind_ie_dest: IndIeDest;
    ind_pres: number;
  };
  itens?: ItemPrevia[];
  pagamentos?: { forma: string; tPag: string; valor: number; a_prazo: boolean }[];
  totais?: { produtos: number; desconto: number; frete: number; nota: number };
  frete?: { modalidade: ModFrete; transportadora: Transportadora | null };
  servicos_fora_da_nota?: { itens: number };
};

export type CorpoNfe55 = {
  destinatario?: {
    documento?: string;
    nome?: string;
    ie?: string;
    ind_ie_dest?: IndIeDest;
    email?: string;
    telefone?: string;
    endereco?: EnderecoNfe;
  };
  natureza_operacao?: string;
  frete?: { modalidade: ModFrete; transportadora?: Transportadora | null };
  observacoes?: string;
  salvar_no_cadastro?: boolean;
  indicador_presenca?: number;
  consumidor_final?: boolean | null;
};

export type RejeicaoAmigavel = {
  cStat: string | null;
  titulo: string;
  acao: string;
  quem: "lojista" | "config" | "aura" | "sefaz";
  conhecida: boolean;
};

export type NotaNfe55 = {
  id: string;
  numero: number;
  serie: number;
  status: string;
  chave_acesso: string | null;
  protocolo: string | null;
  total_nfce?: number;
  authorized_at?: string | null;
  customer_name?: string | null;
};

export type RespostaEmissao = {
  nfe: NotaNfe55;
  status: "autorizada" | "rejeitada" | "processando" | "erro";
  chave_acesso: string | null;
  protocolo: string | null;
  numero: number;
  serie: number;
  cStat: string | null;
  motivo: string | null;
  ambiente: "homologacao" | "producao";
  code?: string;
  error?: string;
  recuperada?: boolean;
  cadastro?: { salvo: boolean; ignored_fields?: string[]; motivo?: string };
  rejeicao_amigavel?: RejeicaoAmigavel;
};

const base = (companyId: string) => "/companies/" + companyId + "/nfe55";

export const nfe55Api = {
  previa: (companyId: string, saleId: string, corpo?: CorpoNfe55) =>
    corpo
      ? request<Previa>(base(companyId) + "/venda/" + saleId + "/previa", { method: "POST", body: corpo, retry: 0, timeout: 20000 })
      : request<Previa>(base(companyId) + "/venda/" + saleId + "/previa", { retry: 1, timeout: 20000 }),

  // 30 s: a emissão espera a SEFAZ (síncrona). retry 0: nunca repetir sozinho.
  emitir: (companyId: string, saleId: string, corpo: CorpoNfe55) =>
    request<RespostaEmissao>(base(companyId) + "/venda/" + saleId + "/emitir", { method: "POST", body: corpo, retry: 0, timeout: 45000 }),

  enviarEmail: (companyId: string, emissaoId: string, email?: string) =>
    request<{ enviado: boolean; para: string; enviado_em: string }>(
      base(companyId) + "/" + emissaoId + "/enviar-email",
      { method: "POST", body: email ? { email } : {}, retry: 0, timeout: 30000 }
    ),

  danfePath: (companyId: string, emissaoId: string) => base(companyId) + "/" + emissaoId + "/danfe.pdf",
  xmlPath: (companyId: string, emissaoId: string) => base(companyId) + "/" + emissaoId + "/xml",
};
