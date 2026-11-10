// ============================================================
// AURA. — NFS-e automática (rotas /companies/:id/nfse/automatica/*)
//
// 10/11/2026 — contrato do Aura-backend#984 (migration 438). A NFS-e sai
// sozinha na venda do Caixa com serviço, na OS entregue e no pagamento
// recebido (crediário). O app só LÊ a situação e oferece as ações:
//
//   GET  /config                         ligada no servidor + opt-in da empresa
//                                        + emite (a loja emite pelo botão)
//   GET  /origem/:tipo/:id               situação das notas da venda/OS
//   POST /origem/:tipo/:id/emitir        "Emitir NFS-e" (idempotente)
//   POST /origem/:tipo/:id/completar     { tomador } e emite
//   POST /origem/:tipo/:id/tentar-de-novo  erro, rejeitada ou cancelada
//   GET  /origem/:tipo/:id/segunda-via   notas emitidas (+ ?formato=pdf)
//
// 10/11/2026 (Aura-backend#989): o "Emitir NFS-e" é MANUAL e independe da
// automática — vale sempre que a loja emite NFS-e (config.emite). A
// automática (config.ativa) só decide se a nota sai sozinha e se o Caixa
// EXIGE o tomador. A situação da origem diz se o botão cabe (pode_emitir).
//
// :tipo = 'venda' | 'os'. O recebimento do crediário não é origem: a nota
// dele é a da venda (o app consulta a venda da compra).
//
// Multi-CNPJ: a nota é da empresa que vendeu, prestou ou recebeu. Quem chama
// passa o company_id DA VENDA/OS, nunca o da visão consolidada.
// ============================================================

import { request } from "./api";

export type OrigemNfse = "venda" | "os";

/** Estado de UMA nota (registro por código de tributação). */
export type EstadoDaNotaNfse =
  | "emitindo" | "emitida" | "pendente_dados" | "erro" | "rejeitada" | "cancelada";

/** Estado resumido da origem (o pior entre as notas). */
export type EstadoDaOrigemNfse =
  | "nenhuma" | "emitindo" | "pendente_dados" | "erro" | "emitida" | "cancelada";

export type AcaoDaOrigemNfse =
  | "emitir" | "aguardar" | "completar_dados" | "tentar_de_novo" | "imprimir_2a_via" | "cadastrar_codigo";

/** Motivos que o backend grava (motivo_codigo). */
export type MotivoNfse =
  | "SEM_TOMADOR" | "TOMADOR_INVALIDO" | "SEM_NOME" | "SEM_CODIGO" | "INESPERADO" | string;

export type NotaDaOrigemNfse = {
  id: string;
  origem_tipo: OrigemNfse;
  origem_id: string;
  ctribnac: string;
  estado: EstadoDaNotaNfse;
  motivo: string | null;
  motivo_codigo: MotivoNfse | null;
  valor: number | null;
  gatilho: string | null;
  nfse_id: string | null;
  nfse_number: string | number | null;
  chave_acesso: string | null;
  emitida_em: string | null;
  atualizado_em: string | null;
};

export type SituacaoNfse = {
  origem: { tipo: OrigemNfse; id: string };
  estado: EstadoDaOrigemNfse;
  acao: AcaoDaOrigemNfse;
  tem_nota: boolean;
  notas: NotaDaOrigemNfse[];
  /** Só nas escritas: frase do resultado (ex.: "Esta venda não tem serviço"). */
  aviso?: string;
  aviso_codigo?: string;
  /** Aura-backend#989 (opcionais: backend anterior não manda). */
  emite?: boolean;
  tem_servico?: boolean;
  /** A loja emite + a origem tem serviço + venda válida / OS entregue:
   *  sem nota ainda, o "Emitir NFS-e" cabe aqui. */
  pode_emitir?: boolean;
};

export type ConfigNfseAutomatica = {
  ligada_no_servidor: boolean;
  tem_config: boolean;
  provider: string | null;
  emissao_automatica: boolean;
  emissao_automatica_desde: string | null;
  /** Servidor ligado E opt-in da empresa: o Caixa passa a exigir o tomador. */
  ativa: boolean;
  /** A loja emite NFS-e pelo botão (is_active + Emissor Nacional ligado),
   *  com ou sem a automática. Ausente = backend anterior (false). */
  emite?: boolean;
};

export type TomadorNfse = { doc: string; nome?: string | null; email?: string | null; fone?: string | null };

export type SegundaViaNfse = {
  notas: Array<{
    nfse_id: string;
    nfse_number: string | number | null;
    chave_acesso: string | null;
    ctribnac: string;
    valor: number | null;
    emitida_em: string | null;
    pdf_path: string;
    xml_path: string;
  }>;
};

function base(companyId: string) {
  return "/companies/" + companyId + "/nfse/automatica";
}

function origem(companyId: string, tipo: OrigemNfse, id: string) {
  return base(companyId) + "/origem/" + tipo + "/" + id;
}

export const nfseAutomaticaApi = {
  config: (companyId: string) =>
    request<ConfigNfseAutomatica>(base(companyId) + "/config", { retry: 1 }),

  situacao: (companyId: string, tipo: OrigemNfse, id: string) =>
    request<SituacaoNfse>(origem(companyId, tipo, id), { retry: 0, timeout: 10000 }),

  emitir: (companyId: string, tipo: OrigemNfse, id: string, tomador?: TomadorNfse | null) =>
    request<SituacaoNfse>(origem(companyId, tipo, id) + "/emitir", {
      method: "POST", body: tomador ? { tomador } : {}, retry: 0, timeout: 30000,
    }),

  completar: (companyId: string, tipo: OrigemNfse, id: string, tomador: TomadorNfse) =>
    request<SituacaoNfse>(origem(companyId, tipo, id) + "/completar", {
      method: "POST", body: { tomador }, retry: 0, timeout: 30000,
    }),

  tentarDeNovo: (companyId: string, tipo: OrigemNfse, id: string) =>
    request<SituacaoNfse>(origem(companyId, tipo, id) + "/tentar-de-novo", {
      method: "POST", body: {}, retry: 0, timeout: 30000,
    }),

  segundaVia: (companyId: string, tipo: OrigemNfse, id: string) =>
    request<SegundaViaNfse>(origem(companyId, tipo, id) + "/segunda-via", { retry: 1 }),

  /** Caminho do PDF (DANFSe) de uma nota da origem — precisa do Bearer. */
  pdfPath: (companyId: string, tipo: OrigemNfse, id: string, nfseId: string) =>
    origem(companyId, tipo, id) + "/segunda-via?formato=pdf&nfse_id=" + encodeURIComponent(nfseId),
};
