// ============================================================
// AURA. — "Pronto para emitir NFS-e?": regras puras (10/11/2026)
//
// Mockup aprovado: docs/mockups/nfse-configuracao-loja.html. Os ESTADOS
// vêm do backend (GET /companies/:id/nfse/config → nacional.passos, PR
// Aura-backend "configuração da loja passo a passo", migration 441): o
// app não recalcula regra fiscal, só agrupa e pinta.
//
// Direção do dono (10/11/2026): self-service muito simples. O backend
// devolve 7 passos; a tela mostra 4 cartões:
//   1. certificado  ← passo certificado
//   2. dados        ← dados_fiscais + codigo_padrao + serie (um formulário)
//   3. teste        ← teste; a explicação da prefeitura (CNC, Inscrição
//                     Municipal) só aparece quando o teste volta com
//                     E0084/E0116/E0120 (passo prefeitura em "problema")
//   4. ligar        ← ligar (Simples, Retenção do ISSQN e as duas chaves)
//
// "Pronto com aviso" (backend "E0312 só no ambiente de testes"): a nota de
// teste voltou só com um código que é do ambiente de testes do gov.br. O
// passo teste vem "ok" com o campo `aviso` (texto do backend) e o Ligar
// destrava pelo próprio backend (pronta_para_ligar).
// ============================================================

export type EstadoPasso = "ok" | "falta" | "problema" | "travado";
export type ChavePasso = "certificado" | "prefeitura" | "dados_fiscais" | "codigo_padrao" | "serie" | "teste" | "ligar";

export type PassoNfse = {
  estado: EstadoPasso;
  motivo: string;
  codigo?: string | null;
  vale_ate?: string;
  cnpj_do_certificado?: string;
  serie?: string;
  proximo_numero?: string;
  em?: string;
  nfse_id?: string | null;
  faltas?: string[];
  aguardando_aura?: boolean;
  /** passo "ok" com aviso (teste rejeitado só pelo ambiente de testes do gov.br) */
  aviso?: string;
  codigos?: string[];
};

export type SugestaoDaEmpresa = {
  cnpj?: string | null;
  nome?: string | null;
  municipio?: string | null;
  uf?: string | null;
  municipio_ibge?: string | null;
  op_simp_nac?: 1 | 2 | 3 | null;
  reg_ap_trib_sn?: 1 | 2 | 3 | null;
  fonte?: string;
};

export type SituacaoNfse = {
  passos: Record<ChavePasso, PassoNfse>;
  prontos?: number;
  total?: number;
  proximo?: ChavePasso | null;
  base_pronta?: boolean;
  pronta_para_ligar?: boolean;
  emitindo?: boolean;
  producao_liberada?: boolean;
  ligado?: boolean;
  ambiente?: string;
  certificado?: { subject_cn?: string; not_after?: string } | null;
  sugestao?: SugestaoDaEmpresa;
  serie_teste?: string;
};

export type ConfigNfse = {
  provider?: string;
  is_active?: boolean;
  ambiente?: string;
  municipio_ibge?: string | null;
  ctribnac_padrao?: string | null;
  cnbs_padrao?: string | null;
  op_simp_nac?: number | null;
  reg_ap_trib_sn?: number | null;
  p_tot_trib_sn?: number | string | null;
  serie?: string | null;
  next_dps_number?: number | string | null;
  serie_confirmada_em?: string | null;
  inscricao_municipal?: string | null;
  prefeitura_cadastro_confirmado?: "sim" | "nao" | "nao_sei" | null;
  cliente_retem_iss?: boolean | null;
  aliquota_iss_retencao_sn?: number | string | null;
  ultimo_teste_em?: string | null;
  ultimo_teste_status?: "ok" | "rejeitado" | "erro" | null;
  ultimo_teste_codigo?: string | null;
  ultimo_teste_mensagem?: string | null;
  ultimo_teste_nfse_id?: string | null;
  emissao_automatica?: boolean;
  nacional?: SituacaoNfse | null;
};

/** Resposta de GET /companies/:id/nfse/config. */
export type RespostaConfigNfse = {
  config: ConfigNfse | null;
  has_config?: boolean;
  nacional?: SituacaoNfse | null;
};

/** Resultado traduzido do POST /nfse/teste. */
export type ResultadoTeste = {
  /** "aviso" = pode seguir com aviso (ex.: E0312 só no ambiente de testes) */
  status: "ok" | "aviso" | "rejeitado" | "erro";
  passo: ChavePasso;
  codigo: string | null;
  titulo: string;
  mensagem: string;
  caminho: string[];
  aguardando?: boolean;
  aviso?: string;
};

/** A situação vem em config.nacional (loja com config) ou na raiz (sem config). */
export function situacaoDe(r: RespostaConfigNfse | null | undefined): SituacaoNfse | null {
  if (!r) return null;
  return (r.config && r.config.nacional) || r.nacional || null;
}

// ── cartões da tela ────────────────────────────────────────
export const CARTOES = ["certificado", "dados", "teste", "ligar"] as const;
export type Cartao = typeof CARTOES[number];

export const TITULO_DO_CARTAO: Record<Cartao, string> = {
  certificado: "Certificado digital A1",
  dados: "Dados da nota",
  teste: "Nota de teste",
  ligar: "Ligar a NFS-e",
};

const PASSOS_DOS_DADOS: ChavePasso[] = ["dados_fiscais", "codigo_padrao", "serie"];

/** Junta estados: problema > falta > travado > ok. */
export function juntarEstados(estados: EstadoPasso[]): EstadoPasso {
  if (estados.includes("problema")) return "problema";
  if (estados.includes("falta")) return "falta";
  if (estados.includes("travado")) return "travado";
  return "ok";
}

export function estadosDosCartoes(sit: SituacaoNfse | null): Record<Cartao, EstadoPasso> {
  if (!sit || !sit.passos) return { certificado: "falta", dados: "falta", teste: "travado", ligar: "travado" };
  const p = sit.passos;
  return {
    certificado: p.certificado ? p.certificado.estado : "falta",
    dados: juntarEstados(PASSOS_DOS_DADOS.map((k) => (p[k] ? p[k].estado : "falta"))),
    teste: p.teste ? p.teste.estado : "travado",
    ligar: p.ligar ? p.ligar.estado : "travado",
  };
}

/** A explicação da prefeitura só aparece quando o teste voltou com aviso dela. */
export function prefeituraVisivel(sit: SituacaoNfse | null): boolean {
  return !!(sit && sit.passos && sit.passos.prefeitura && sit.passos.prefeitura.estado === "problema");
}

/** Primeiro cartão com problema; senão o primeiro que falta; senão nenhum. */
export function proximoCartao(est: Record<Cartao, EstadoPasso>): Cartao | null {
  return CARTOES.find((c) => est[c] === "problema") || CARTOES.find((c) => est[c] === "falta") || null;
}

export function contarProntos(est: Record<Cartao, EstadoPasso>): number {
  return CARTOES.filter((c) => est[c] === "ok").length;
}

/** Texto do aviso quando o teste conta como pronto com aviso; senão null. */
export function avisoDoTeste(sit: SituacaoNfse | null): string | null {
  const t = sit && sit.passos && sit.passos.teste;
  return t && t.estado === "ok" && t.aviso ? t.aviso : null;
}

export function aguardandoAura(sit: SituacaoNfse | null): boolean {
  return !!(sit && sit.passos && sit.passos.ligar && sit.passos.ligar.aguardando_aura);
}

export function emitindo(sit: SituacaoNfse | null): boolean {
  return !!(sit && (sit.emitindo || (sit.passos && sit.passos.ligar && sit.passos.ligar.estado === "ok")));
}

export type ResumoDaLoja = { tom: "ok" | "aviso" | "erro"; texto: string };

/** Uma linha por loja na visão "Todas as lojas" (e no seletor). */
export function resumoDaLoja(sit: SituacaoNfse | null, automatica = false): ResumoDaLoja {
  if (!sit) return { tom: "aviso", texto: "Ainda não configurada" };
  if (emitindo(sit)) return { tom: "ok", texto: automatica ? "Emitindo · automática" : "Emitindo" };
  if (aguardandoAura(sit)) return { tom: "aviso", texto: "Pronta · a Aura está liberando a produção" };
  const p = sit.passos;
  if (p.prefeitura && p.prefeitura.estado === "problema") {
    return { tom: "erro", texto: "A prefeitura ainda não liberou" + (p.prefeitura.codigo ? " (" + p.prefeitura.codigo + ")" : "") };
  }
  if (p.certificado && p.certificado.estado === "problema") {
    return { tom: "erro", texto: p.certificado.cnpj_do_certificado ? "Certificado de outro CNPJ" : "Certificado com problema" };
  }
  if (p.teste && p.teste.estado === "problema") return { tom: "erro", texto: "A nota de teste voltou com aviso" };
  const falta = CARTOES.length - contarProntos(estadosDosCartoes(sit));
  return { tom: "aviso", texto: falta === 1 ? "Falta 1 passo" : "Faltam " + falta + " passos" };
}

/** Ponto da aba "Emitir NFS-e": verde emitindo, vermelho com problema, âmbar no resto. */
export function pontoDaAbaNfse(sit: SituacaoNfse | null): "ok" | "aviso" | "erro" | undefined {
  if (!sit) return undefined;
  const r = resumoDaLoja(sit);
  return r.tom;
}

// ── números digitados ──────────────────────────────────────

/** "6,54" / "6.54" / "6,54%" → 6.54; null se vazio ou inválido. */
export function lerPercentual(txt: string | null | undefined): number | null {
  let b = String(txt ?? "").replace(/%/g, "").trim();
  if (!b) return null;
  if (b.includes(",")) b = b.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(b)) return null;
  const n = Number(b);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** 6.54 → "6,54" (para o campo). */
export function fmtPercentual(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

/**
 * Faixas de utilização da Série da DPS (Anexo I do leiaute da DPS, campo
 * serie): 1–49999 aplicativo próprio (a Aura); 50000–69999 Emissor Móvel;
 * 70000–79999 Emissor Web; 80000–89999 transcrição manual (Web). A 49999
 * fica reservada à nota de teste da Aura.
 */
export function problemaDaSerie(serie: string): string | null {
  const d = String(serie || "").replace(/\D/g, "");
  if (!d) return "Informe a Série da DPS.";
  const n = parseInt(d, 10);
  if (!n) return "A Série da DPS começa em 1.";
  if (n >= 50000 && n <= 89999) {
    return "Essa série é do site ou do app do gov.br (de 50000 a 89999). Pela Aura a Série da DPS fica entre 1 e 49998, então as notas nunca se encontram.";
  }
  if (n === 49999) return "A série 49999 é reservada para a nota de teste da Aura. Use outra.";
  if (n > 49999) return "A Série da DPS da Aura fica entre 1 e 49998.";
  return null;
}

export type JaEmite = "" | "nao" | "gov" | "outro";

/**
 * O que gravar de série e número a partir da resposta "Já emite NFS-e pelo
 * Emissor Nacional?". Quem emite pelo site/app do gov.br usa outra faixa de
 * série, então a Aura começa na série 1 sem saber o último número de lá.
 */
export function serieENumero(
  jaEmite: JaEmite,
  campos: { serie: string; ultimo: string; continuaNoOutro: boolean; serieDaAura: string }
): { serie: string; next_dps_number?: number } | { erro: string } {
  if (!jaEmite) return { erro: "Conte se você já emite NFS-e pelo Emissor Nacional." };
  if (jaEmite === "nao" || jaEmite === "gov") return { serie: "1" };
  if (campos.continuaNoOutro) {
    const p = problemaDaSerie(campos.serieDaAura);
    if (p) return { erro: p };
    const sa = String(parseInt(campos.serieDaAura.replace(/\D/g, ""), 10));
    const so = String(parseInt(String(campos.serie).replace(/\D/g, ""), 10) || "");
    if (sa === so) return { erro: "Use na Aura uma Série da DPS diferente da do outro sistema." };
    return { serie: sa };
  }
  const p = problemaDaSerie(campos.serie);
  if (p) return { erro: p };
  const ult = parseInt(String(campos.ultimo || "").replace(/\D/g, ""), 10);
  if (!ult) return { erro: "Informe o último Número da DPS emitido, para a Aura continuar sem repetir." };
  return { serie: String(parseInt(campos.serie.replace(/\D/g, ""), 10)), next_dps_number: ult + 1 };
}

/** Texto pronto para pedir o cadastro à prefeitura (E0084/E0120). */
export function textoParaPrefeitura(nome: string, cnpj: string, cidade: string): string {
  return "Olá! Sou da empresa " + (nome || "") + ", CNPJ " + (cnpj || "") + ", prestadora de serviços em "
    + (cidade || "nosso município") + ". Preciso emitir NFS-e pelo Emissor Nacional. Podem, por favor, informar a minha "
    + "Inscrição Municipal e incluir a empresa no Cadastro Nacional de Contribuintes da NFS-e (CNC)? Agradeço desde já.";
}

/** 11222333000181 → 11.222.333/0001-81 */
export function fmtCnpj(v: string | null | undefined): string {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length !== 14) return String(v || "");
  return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
}

/** ISO → "10/11" */
export function fmtDiaMes(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}
