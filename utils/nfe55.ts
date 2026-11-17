// ============================================================
// AURA. — NF-e 55 de venda: regras puras do assistente (CP4, 14/11/2026).
// Sem React, sem rede: testáveis em __tests__/nfe55Regras.test.ts.
//
//   - formDaPrevia / corpoDoForm: o formulário do assistente ↔ o corpo do
//     POST .../previa e .../emitir (o que vem no corpo vence o cadastro);
//   - campoDoFaltante / passoDoFaltante: os `faltantes` do backend viram
//     campo em amarelo + o passo onde ele mora (nada bloqueia o "Continuar");
//   - lerErroDaEmissao / lerRespostaDaEmissao: 201/202/409/422/503/rede em
//     texto humano para a tela;
//   - notaSugerida / automaticaEspera: a escolha NFC-e ou NF-e na venda
//     concluída (cliente com CNPJ → NF-e; a automática da NFC-e espera).
// ============================================================
import type {
  Previa, CorpoNfe55, Faltante, IndIeDest, ModFrete, RejeicaoAmigavel, RespostaEmissao, ResumoNota,
} from "@/services/nfe55Api";

export type FormNfe55 = {
  documento: string;
  nome: string;
  email: string;
  ie: string;
  indIeDest: IndIeDest;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  codigoMunicipioIbge: string;
  naturezaOperacao: string;
  modFrete: ModFrete;
  transportadoraDocumento: string;
  transportadoraNome: string;
  observacoes: string;
  salvarNoCadastro: boolean;
};

export type CampoForm = keyof FormNfe55 | "itens";

export const NATUREZAS = [
  "Venda de mercadoria",
  "Venda de mercadoria para entrega futura",
  "Venda de mercadoria adquirida de terceiros",
];

export const OPCOES_FRETE: { valor: ModFrete; titulo: string; texto: string }[] = [
  { valor: 9, titulo: "Cliente retira na loja", texto: "Sem frete na nota." },
  { valor: 0, titulo: "A loja entrega (frete por nossa conta)", texto: "O frete da venda sai na nota." },
  { valor: 1, titulo: "Frete por conta do cliente", texto: "O cliente contrata ou paga a transportadora." },
];

export const OPCOES_IE: { valor: IndIeDest; titulo: string; texto: string }[] = [
  { valor: 1, titulo: "Tem IE (contribuinte do ICMS)", texto: "Empresa que compra para revender ou usar e tem cadastro na Sefaz." },
  { valor: 2, titulo: "É isenta de IE", texto: "Tem CNPJ, mas a Sefaz dispensou a inscrição." },
  { valor: 9, titulo: "Não tem IE (não contribuinte)", texto: "Pessoa física, ou empresa só de serviços." },
];

const s = (v: unknown) => (v == null ? "" : String(v));
export const soDigitos = (v: unknown) => s(v).replace(/\D/g, "");

export function formDaPrevia(p: Previa | null | undefined): FormNfe55 {
  const d = p?.destinatario;
  const e = d?.endereco || {};
  const t = p?.frete?.transportadora || null;
  return {
    documento: s(d?.documento),
    nome: s(d?.nome),
    email: s(d?.email),
    ie: s(d?.ie),
    indIeDest: (d?.ind_ie_dest as IndIeDest) || 9,
    cep: s(e.cep),
    logradouro: s(e.logradouro),
    numero: s(e.numero),
    complemento: s(e.complemento),
    bairro: s(e.bairro),
    municipio: s(e.municipio),
    uf: s(e.uf).toUpperCase(),
    codigoMunicipioIbge: s(e.codigo_municipio_ibge),
    naturezaOperacao: s(p?.operacao?.natureza_operacao) || NATUREZAS[0],
    modFrete: (p?.frete?.modalidade ?? 9) as ModFrete,
    transportadoraDocumento: s(t?.documento),
    transportadoraNome: s(t?.nome),
    observacoes: "",
    salvarNoCadastro: !!d?.customer_id,
  };
}

const ou = (v: string) => { const t = v.trim(); return t ? t : undefined; };

/** Corpo do previa/emitir. Campo vazio não vai (o cadastro vale). */
export function corpoDoForm(f: FormNfe55): CorpoNfe55 {
  const endereco = {
    cep: ou(soDigitos(f.cep)), logradouro: ou(f.logradouro), numero: ou(f.numero), complemento: ou(f.complemento),
    bairro: ou(f.bairro), municipio: ou(f.municipio), uf: ou(f.uf.toUpperCase()),
    codigo_municipio_ibge: ou(soDigitos(f.codigoMunicipioIbge)),
  };
  const transportadora = (f.transportadoraDocumento.trim() || f.transportadoraNome.trim())
    ? { documento: ou(soDigitos(f.transportadoraDocumento)), nome: ou(f.transportadoraNome) }
    : null;
  return {
    destinatario: {
      documento: ou(soDigitos(f.documento)),
      nome: ou(f.nome),
      email: ou(f.email),
      ind_ie_dest: f.indIeDest,
      ie: f.indIeDest === 1 ? ou(soDigitos(f.ie)) : f.indIeDest === 2 ? "ISENTO" : undefined,
      endereco,
    },
    natureza_operacao: ou(f.naturezaOperacao),
    frete: { modalidade: f.modFrete, ...(transportadora ? { transportadora } : {}) },
    observacoes: ou(f.observacoes),
    salvar_no_cadastro: f.salvarNoCadastro,
  };
}

const MAPA_CAMPOS: Record<string, CampoForm> = {
  "destinatario.documento": "documento",
  "destinatario.nome": "nome",
  "destinatario.ie": "ie",
  "destinatario.ind_ie_dest": "indIeDest",
  "destinatario.endereco.cep": "cep",
  "destinatario.endereco.logradouro": "logradouro",
  "destinatario.endereco.numero": "numero",
  "destinatario.endereco.bairro": "bairro",
  "destinatario.endereco.municipio": "municipio",
  "destinatario.endereco.uf": "uf",
  "destinatario.endereco.codigo_municipio_ibge": "codigoMunicipioIbge",
  "frete.modalidade": "modFrete",
  "frete.transportadora.documento": "transportadoraDocumento",
  "indicador_presenca": "naturezaOperacao",
};

/** Campo do formulário de um faltante (itens[i].ncm → "itens"). */
export function campoDoFaltante(campo: string): CampoForm | null {
  if (/^itens\[\d+\]/.test(campo)) return "itens";
  return MAPA_CAMPOS[campo] || null;
}

/** Passo onde o faltante se resolve: 1 cliente, 2 itens e entrega. */
export function passoDoFaltante(campo: string): 1 | 2 {
  return campo.startsWith("destinatario.") ? 1 : 2;
}

/** Faltantes por campo do formulário (o primeiro de cada campo). */
export function faltantesPorCampo(faltantes: Faltante[] | null | undefined): Partial<Record<CampoForm, Faltante>> {
  const out: Partial<Record<CampoForm, Faltante>> = {};
  for (const f of faltantes || []) {
    const c = campoDoFaltante(f.campo);
    if (c && !out[c]) out[c] = f;
  }
  return out;
}

/** Faltantes de itens (NCM) por product_id, para marcar a linha. */
export function faltantesDosItens(faltantes: Faltante[] | null | undefined): Faltante[] {
  return (faltantes || []).filter((f) => /^itens\[\d+\]/.test(f.campo));
}

/** Resumo de rodapé: "Faltam CEP e número do endereço". */
export function resumoDosFaltantes(faltantes: Faltante[] | null | undefined, passo?: 1 | 2): string {
  const lista = (faltantes || []).filter((f) => !passo || passoDoFaltante(f.campo) === passo);
  if (!lista.length) return "";
  return lista.length === 1 ? `Falta 1 informação: ${lista[0].mensagem}` : `Faltam ${lista.length} informações (marcadas em amarelo)`;
}

// ── Emissão: resposta e erro em texto humano ─────────────────

export type ResultadoDaTela =
  | { tipo: "pronto"; resposta: RespostaEmissao }
  | { tipo: "aguardando"; titulo: string; texto: string; resposta?: RespostaEmissao }
  | { tipo: "rejeicao"; titulo: string; texto: string; acao: string; tecnico: string | null; quem: RejeicaoAmigavel["quem"] }
  | { tipo: "faltantes"; titulo: string; texto: string; faltantes: Faltante[]; passo: 1 | 2 }
  | { tipo: "conflito"; titulo: string; texto: string; nota: ResumoNota | null }
  | { tipo: "bloqueio"; titulo: string; texto: string; code: string | null }
  | { tipo: "erro"; titulo: string; texto: string };

const TITULO_BLOQUEIO: Record<string, string> = {
  NFE_REGIME_NORMAL_FORA_DO_V1: "Ainda não emitimos NF-e para o regime normal",
  NFE_DIFAL_FORA_DO_V1: "Esta venda pede um cálculo que ainda não fazemos",
  NFE55_UF_NAO_HABILITADA: "NF-e ainda não liberada para o seu estado",
  NFE_CERTIFICADO: "Falta o certificado digital",
  NFE_NAO_CONFIGURADA: "A nota fiscal da loja ainda não está ligada",
  NFE_SEM_PRODUTOS: "Esta venda não tem produtos para a NF-e",
  NFE_DESCONTO_TOTAL: "O desconto cobre todo o valor da venda",
  NFE_EMITENTE_INCOMPLETO: "Faltam dados da sua empresa",
  CNPJ_REQUIRED: "Nota fiscal precisa de CNPJ",
};

/** Título humano de um bloqueio da prévia/emissão pelo código do backend. */
export function tituloDoBloqueio(code: string | null | undefined): string {
  return (code && TITULO_BLOQUEIO[code]) || "Não dá para emitir esta NF-e";
}

/** 201 (autorizada, ou processando/erro que voltam 202) → tela. */
export function lerRespostaDaEmissao(r: RespostaEmissao): ResultadoDaTela {
  if (r.status === "autorizada") return { tipo: "pronto", resposta: r };
  return {
    tipo: "aguardando",
    titulo: "A Sefaz ainda não respondeu",
    texto: (r.error || r.motivo || "A Sefaz demorou para responder.")
      + " A venda está registrada. Toque em \"Tentar de novo\" em instantes: a gente confere a nota pela chave e usa o mesmo número, sem nota repetida.",
    resposta: r,
  };
}

type ErroDeApi = { status?: number; data?: any; message?: string; isNetworkError?: boolean; code?: string | null };

/** ApiError (409/422/502/503/rede) → tela. */
export function lerErroDaEmissao(err: ErroDeApi | null | undefined): ResultadoDaTela {
  const data = (err && err.data) || {};
  const code: string | null = data.code || null;
  const msg: string = data.error || (err && err.message) || "Não deu para emitir a nota agora.";
  if (!err || err.isNetworkError || err.status === 0) {
    return {
      tipo: "aguardando",
      titulo: "Sem resposta do servidor",
      texto: "A nota pode ter saído. Toque em \"Tentar de novo\": a gente confere primeiro pela chave e usa o mesmo número, sem nota repetida.",
    };
  }
  if (err.status === 409 || code === "NOTA_DE_PRODUTOS_JA_EXISTE") {
    return { tipo: "conflito", titulo: "Esta venda já tem nota fiscal", texto: msg, nota: data.nota || null };
  }
  if (code === "NFE_DADOS_FALTANTES") {
    const faltantes: Faltante[] = Array.isArray(data.faltantes) ? data.faltantes : [];
    const passo = faltantes.some((f) => passoDoFaltante(f.campo) === 1) ? 1 : 2;
    return { tipo: "faltantes", titulo: "Falta completar alguns dados", texto: msg, faltantes, passo };
  }
  if (code === "NFE_REJEITADA") {
    const r: RejeicaoAmigavel | undefined = data.rejeicao_amigavel;
    return {
      tipo: "rejeicao",
      titulo: "A Sefaz não aceitou a nota, e dá para resolver",
      texto: (r?.titulo ? r.titulo.replace(/\.?$/, ". ") : "") + "A venda segue registrada e nada foi cobrado de novo.",
      acao: r?.acao || "Confira os dados e tente de novo. A nota sai com o mesmo número.",
      tecnico: data.cStat ? `cStat ${data.cStat}${data.motivo ? " · " + data.motivo : ""}` : (data.motivo || null),
      quem: r?.quem || "aura",
    };
  }
  if (err.status === 503 || code === "NFE_SEFAZ_SEM_RESPOSTA") {
    return { tipo: "aguardando", titulo: "A Sefaz ainda não respondeu", texto: msg };
  }
  if (err.status === 422 || err.status === 404) {
    return { tipo: "bloqueio", titulo: tituloDoBloqueio(code), texto: msg, code };
  }
  return { tipo: "erro", titulo: "Não deu para emitir a nota agora", texto: msg + " A venda está registrada; tente de novo em instantes." };
}

// ── Venda concluída: NFC-e ou NF-e ───────────────────────────

/** Nota de produtos indicada: cliente com CNPJ → NF-e; os demais → NFC-e. */
export function notaSugerida(documentoDoCliente: string | null | undefined): "nfe" | "nfce" {
  return soDigitos(documentoDoCliente).length === 14 ? "nfe" : "nfce";
}

/**
 * A emissão automática da NFC-e espera quando o cliente tem CNPJ (a nota
 * indicada é a NF-e, que a lojista confere no assistente). Sem automática
 * ligada, nada a esperar.
 */
export function automaticaEspera(autoEmitLigada: boolean, documentoDoCliente: string | null | undefined): boolean {
  return !!autoEmitLigada && notaSugerida(documentoDoCliente) === "nfe";
}

// ── formatação ───────────────────────────────────────────────

export function fmtDocumento(v: string | null | undefined): string {
  const d = soDigitos(v);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return s(v);
}
export function fmtCep(v: string | null | undefined): string {
  const d = soDigitos(v);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : s(v);
}
export const fmtChave = (c: string | null | undefined) => soDigitos(c).replace(/(\d{4})(?=\d)/g, "$1 ");
export const brl = (n: number | null | undefined) =>
  "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function rotuloDoFrete(m: ModFrete | number | null | undefined): string {
  const o = OPCOES_FRETE.find((x) => x.valor === m);
  if (o) return o.titulo;
  return m === 2 ? "Frete por conta de terceiros" : m === 3 || m === 4 ? "Transporte próprio" : "Sem frete";
}

export function rotuloDaIe(f: Pick<FormNfe55, "indIeDest" | "ie">): string {
  if (f.indIeDest === 1) return `${f.ie || "—"} (contribuinte)`;
  if (f.indIeDest === 2) return "Isenta";
  return "Não tem (não contribuinte)";
}

// ── CP5 (14/11/2026): prazo de cancelamento da NF-e 55 ───────
// O backend é quem manda (NFE55_CANCEL_DEADLINE_H, padrão 24 h, e recusa
// fora do prazo); a tela usa o mesmo padrão para mostrar o prazo à vista.

export const PRAZO_CANCELAMENTO_NFE_H = 24;

const DIA_MS = 24 * 3600e3;
function diaSP(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function horaSP(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export type PrazoCancelamento = {
  ate: Date | null;
  vencido: boolean;
  /** "até amanhã, 15:51" | "até hoje, 18:00" | "até 16/11, 15:51" */
  ateTexto: string;
  /** "faltam 23 h" | "faltam 40 min" */
  faltaTexto: string;
};

/** Prazo para cancelar: autorização + horas (padrão 24 h). */
export function prazoDoCancelamento(
  autorizadaEm: string | null | undefined,
  agora: number = Date.now(),
  horas: number = PRAZO_CANCELAMENTO_NFE_H,
  cancelavelAte?: string | null,
): PrazoCancelamento {
  const ate = cancelavelAte ? new Date(cancelavelAte) : autorizadaEm ? new Date(new Date(autorizadaEm).getTime() + horas * 3600e3) : null;
  if (!ate || Number.isNaN(ate.getTime())) return { ate: null, vencido: false, ateTexto: "", faltaTexto: "" };
  const vencido = agora > ate.getTime();
  const hoje = diaSP(new Date(agora));
  const amanha = diaSP(new Date(agora + DIA_MS));
  const dia = diaSP(ate);
  const quando = dia === hoje ? "hoje" : dia === amanha ? "amanhã" : dia.slice(0, 5);
  const restanteMin = Math.max(0, Math.round((ate.getTime() - agora) / 60000));
  const faltaTexto = vencido ? "" : restanteMin >= 60 ? `faltam ${Math.floor(restanteMin / 60)} h` : `faltam ${restanteMin} min`;
  return { ate, vencido, ateTexto: `até ${quando}, ${horaSP(ate)}`, faltaTexto };
}

export const TEXTO_PRAZO_VENCIDO =
  "O prazo de 24 h para cancelar já passou. Para desfazer, a saída é uma nota de devolução; seu contador orienta.";

/** Justificativa do cancelamento: 15 a 255 letras (regra da SEFAZ). */
export function justificativaValida(t: string): boolean {
  const n = t.replace(/\s+/g, " ").trim().length;
  return n >= 15 && n <= 255;
}

/** Texto da carta de correção: 15 a 1.000 letras. */
export function textoDaCartaValido(t: string): boolean {
  const n = t.replace(/\s+/g, " ").trim().length;
  return n >= 15 && n <= 1000;
}
