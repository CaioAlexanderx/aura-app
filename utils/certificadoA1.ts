// ============================================================
// AURA. — Certificado A1 pelo próprio cliente (14/10/2026)
//
// Regras puras da aba "Certificado A1" do painel de Notas fiscais
// (components/screens/nfe/TabCertificado.tsx). Nada de tela, rede ou estado
// aqui: estado do certificado, texto de cada erro do servidor, link de ajuda
// pelo WhatsApp e validação do arquivo antes de enviar.
//
// SEGREDO: este arquivo nunca recebe senha nem o conteúdo do .pfx (só nome e
// tamanho do arquivo). O link do WhatsApp leva só empresa e CNPJ.
// ============================================================
import { maskCnpj } from "@/utils/masks";

// ── contrato com o backend (/companies/:id/fiscal-certificate) ──
export type CertInfo = {
  subject_cn: string;
  not_before: string | null;
  not_after: string;
  days_left: number | null;
  updated_at?: string | null;
};

// ── limites ─────────────────────────────────────────────────
/** Mesmo limite do servidor (256 KB decodificado). Um .pfx real tem 3 a 10 KB. */
export const TAMANHO_MAX_BYTES = 256 * 1024;
/** Faltando menos que isso, a aba avisa (âmbar). */
export const DIAS_PARA_AVISAR = 30;
/** Número da Aura no WhatsApp (decisão do Caio, 14/10/2026). */
export const WHATSAPP_AURA = "5511956305269";

// ── estado do certificado ───────────────────────────────────
export type EstadoCertificado = "sem" | "valido" | "vencendo" | "vencido";

/**
 * Estado a partir do que o servidor devolve. `days_left` vem do servidor
 * (Math.floor da diferença): 0 = vence nas próximas 24 h, negativo = vencido.
 * Sem `days_left`, cai na data (`not_after`) comparada com `agora`.
 */
export function estadoDoCertificado(cert: CertInfo | null | undefined, agora: Date = new Date()): EstadoCertificado {
  if (!cert) return "sem";
  let dias: number | null = typeof cert.days_left === "number" && isFinite(cert.days_left) ? cert.days_left : null;
  if (dias === null && cert.not_after) {
    const fim = new Date(cert.not_after).getTime();
    if (isFinite(fim)) dias = Math.floor((fim - agora.getTime()) / 86400000);
  }
  if (dias === null) return "valido"; // sem prazo legível: não alarmar à toa
  if (dias < 0) return "vencido";
  if (dias < DIAS_PARA_AVISAR) return "vencendo";
  return "valido";
}

/** "faltam 290 dias", "falta 1 dia", "vence hoje", "venceu há 32 dias". */
export function textoDoPrazo(diasRestantes: number | null | undefined): string {
  if (typeof diasRestantes !== "number" || !isFinite(diasRestantes)) return "";
  if (diasRestantes < 0) {
    const n = Math.abs(diasRestantes);
    return n === 1 ? "venceu há 1 dia" : "venceu há " + n + " dias";
  }
  if (diasRestantes === 0) return "vence hoje";
  return diasRestantes === 1 ? "falta 1 dia" : "faltam " + diasRestantes + " dias";
}

const FUSO = "America/Sao_Paulo";

/** "12/03/2026" no fuso do lojista. Vazio se a data não for válida. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "Válido de 12/03/2026 a 12/03/2027" (ou só "Válido até ..." sem a data inicial). */
export function periodoDeValidade(cert: Pick<CertInfo, "not_before" | "not_after">): string {
  const ini = formatarData(cert.not_before);
  const fim = formatarData(cert.not_after);
  if (!fim) return "";
  return ini ? "Válido de " + ini + " a " + fim : "Válido até " + fim;
}

/** ICP-Brasil usa "RAZAO SOCIAL:12345678000190" no CN; mostra só a razão social. */
export function titularLegivel(subjectCn: string | null | undefined): string {
  const cn = String(subjectCn || "").trim();
  return cn.replace(/:\s*\d{11,14}\s*$/, "").trim() || cn;
}

/** 14 dígitos (ou formatado) → 00.000.000/0000-00. Vazio fica vazio. */
export function formatarCnpj(v: string | null | undefined): string {
  const digitos = String(v || "").replace(/\D/g, "");
  return digitos ? maskCnpj(digitos) : "";
}

// ── ajuda pelo WhatsApp ─────────────────────────────────────
export type TipoAjuda = "cadastrar" | "renovar";

/**
 * Texto pronto da conversa. Só diz que o cliente quer ajuda (empresa e CNPJ).
 * Nunca leva arquivo nem senha, e a tela avisa para não mandar nenhum dos dois.
 */
export function mensagemDeAjuda(empresa: { nome: string; cnpj?: string | null }, tipo: TipoAjuda = "cadastrar"): string {
  const acao = tipo === "renovar" ? "renovar o certificado digital A1" : "cadastrar o certificado digital A1";
  const nome = String(empresa.nome || "").trim() || "minha empresa";
  const cnpj = formatarCnpj(empresa.cnpj);
  return "Olá! Quero ajuda para " + acao + " da minha empresa na Aura. Empresa: " + nome + (cnpj ? " (CNPJ " + cnpj + ")" : "") + ".";
}

export function linkDeAjuda(empresa: { nome: string; cnpj?: string | null }, tipo: TipoAjuda = "cadastrar"): string {
  return "https://wa.me/" + WHATSAPP_AURA + "?text=" + encodeURIComponent(mensagemDeAjuda(empresa, tipo));
}

// ── arquivo escolhido (validação no aparelho, antes de enviar) ──
export type ValidacaoArquivo = { ok: true } | { ok: false; motivo: string };

export function extensaoValida(nome: string | null | undefined): boolean {
  return /\.(pfx|p12)$/i.test(String(nome || "").trim());
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return bytes + " bytes";
  return Math.round(bytes / 1024) + " KB";
}

export function validarArquivo(arq: { name?: string | null; size?: number | null }): ValidacaoArquivo {
  if (!extensaoValida(arq.name)) {
    return { ok: false, motivo: "Escolha o arquivo do certificado A1, que termina em .pfx ou .p12." };
  }
  const tam = typeof arq.size === "number" ? arq.size : 0;
  if (tam <= 0) {
    return { ok: false, motivo: "Este arquivo está vazio. Escolha o arquivo do certificado A1, que termina em .pfx ou .p12." };
  }
  if (tam > TAMANHO_MAX_BYTES) {
    return {
      ok: false,
      motivo: "Este arquivo tem " + formatarTamanho(tam) + " e o limite é " + formatarTamanho(TAMANHO_MAX_BYTES) + ". Confira se escolheu o arquivo .pfx certo do certificado.",
    };
  }
  return { ok: true };
}

/** readAsDataURL devolve "data:...;base64,XXXX": fica só o payload base64. */
export function base64DoDataUrl(dataUrl: string | null | undefined): string {
  const s = String(dataUrl || "");
  const i = s.indexOf(",");
  return (i >= 0 ? s.slice(i + 1) : s).replace(/\s+/g, "");
}

// ── erros do servidor → o que mostrar e onde ────────────────
export type CampoDoErro = "arquivo" | "senha" | "geral";
export type ErroDeEnvio = { campo: CampoDoErro; texto: string; code: string | null };

type ErroBruto = { status?: number | null; code?: string | null; message?: string | null; data?: any; isNetworkError?: boolean | null } | null | undefined;

const GENERICO = "Não foi possível enviar o certificado agora. Tente de novo em instantes ou chame a Aura.";

/**
 * Traduz a falha do envio na mensagem do mockup aprovado. O `code` do corpo da
 * resposta (data.code) manda; sem ele, cai no status HTTP. Mensagem do servidor
 * só entra como último recurso (o backend devolve texto amigável em português).
 */
export function erroDeEnvio(err: ErroBruto, empresa?: { nome?: string | null; cnpj?: string | null }): ErroDeEnvio {
  const status = err && typeof err.status === "number" ? err.status : 0;
  const code = String((err && err.data && err.data.code) || (err && err.code) || "") || null;
  const nome = String((empresa && empresa.nome) || "").trim();
  const cnpj = formatarCnpj(empresa && empresa.cnpj);
  const daEmpresa = nome ? nome + (cnpj ? " (CNPJ " + cnpj + ")" : "") : (cnpj ? "CNPJ " + cnpj : "a empresa ativa");

  switch (code) {
    case "CERT_SENHA_INCORRETA":
      return { campo: "senha", code, texto: "A senha está incorreta. Confira e tente de novo. Se não lembra, a Aura pode te ajudar." };
    case "CERT_VENCIDO":
      return { campo: "arquivo", code, texto: "Este certificado já está vencido. Peça a renovação a quem emitiu o certificado e envie o arquivo novo." };
    case "CERT_AINDA_NAO_VALIDO":
      return { campo: "arquivo", code, texto: "Este certificado ainda não começou a valer. Envie um certificado que esteja dentro da validade." };
    case "CERT_ARQUIVO_INVALIDO":
    case "CERT_ARQUIVO_OBRIGATORIO":
      return { campo: "arquivo", code, texto: "Não conseguimos ler este arquivo. Escolha o arquivo do certificado A1, que termina em .pfx ou .p12." };
    case "CERT_CNPJ_DIVERGENTE":
      return { campo: "arquivo", code, texto: "O CNPJ deste certificado é diferente do CNPJ da empresa ativa, " + daEmpresa + ". Envie o certificado desta empresa." };
    case "CERT_SEM_CNPJ":
      return { campo: "arquivo", code, texto: "Este certificado não é de empresa (e-CNPJ). Envie o certificado A1 do CNPJ da empresa ativa." };
    case "EMPRESA_SEM_CNPJ":
      return { campo: "geral", code, texto: "Falta o CNPJ no cadastro da empresa. Complete o cadastro da empresa e envie o certificado de novo." };
    case "CERT_SENHA_OBRIGATORIA":
      return { campo: "senha", code, texto: "Digite a senha do certificado." };
    case "CERT_GRANDE_DEMAIS":
      return { campo: "arquivo", code, texto: "O arquivo é grande demais para ser um certificado A1. Confira se escolheu o arquivo .pfx certo." };
    case "APENAS_DONO":
      return { campo: "geral", code, texto: "Só o dono da empresa pode enviar o certificado digital. Peça ao dono para fazer o envio." };
    case "CERT_MUITAS_TENTATIVAS":
      return { campo: "geral", code, texto: "Muitas tentativas de envio seguidas. Aguarde alguns minutos e tente de novo, ou chame a Aura." };
    case "CERT_INDISPONIVEL":
      return { campo: "geral", code, texto: "O envio de certificado está indisponível agora. Chame a Aura que a equipe cadastra com você." };
    default:
      break;
  }

  if (status === 413) return { campo: "arquivo", code, texto: "O arquivo é grande demais para ser um certificado A1. Confira se escolheu o arquivo .pfx certo." };
  if (status === 429) return { campo: "geral", code, texto: "Muitas tentativas de envio seguidas. Aguarde alguns minutos e tente de novo, ou chame a Aura." };
  if (status === 503) return { campo: "geral", code, texto: "O envio de certificado está indisponível agora. Chame a Aura que a equipe cadastra com você." };
  if (status === 403) return { campo: "geral", code, texto: "Só o dono da empresa pode enviar o certificado digital. Peça ao dono para fazer o envio." };

  if (err && (err.isNetworkError || status === 0)) {
    // Timeout do nosso lado não prova que falhou: o servidor pode ter gravado.
    if (code === "timeout") {
      return { campo: "geral", code, texto: "Não recebemos resposta a tempo. O certificado pode ter sido cadastrado: confira a situação aqui na aba antes de enviar de novo." };
    }
    return { campo: "geral", code, texto: "Sem conexão com a Aura. Confira sua internet e tente de novo." };
  }

  const doServidor = err && typeof err.message === "string" ? err.message.trim() : "";
  return { campo: "geral", code, texto: doServidor && doServidor.length <= 200 && status > 0 && status < 500 ? doServidor : GENERICO };
}

// ── ponto colorido da aba (espelha o estado) ────────────────
export type PontoDaAba = "ok" | "aviso" | "erro";

/** Sem certificado e vencendo: âmbar; vencido: vermelho; válido: verde. */
export function pontoDaAba(estado: EstadoCertificado): PontoDaAba {
  if (estado === "valido") return "ok";
  if (estado === "vencido") return "erro";
  return "aviso";
}

/** Falha ao CARREGAR a situação do certificado (GET). Sempre tratável, nunca em branco. */
export function textoErroDeCarregamento(err: ErroBruto): string {
  if (err && (err.isNetworkError || err.status === 0)) {
    return "Sem conexão com a Aura. Confira sua internet e tente de novo.";
  }
  return "Não conseguimos carregar a situação do certificado agora. Tente de novo em instantes ou chame a Aura.";
}
