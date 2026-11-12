// ─── Aura Notas: rótulos e textos da tela da equipe (12/11/2026) ──────────────
// Funções puras (testáveis sem render). Decisão do Caio (12/11/2026): toda
// empresa com certificado A1 aparece no Aura Notas, com um rótulo claro do
// que ela tem e do que falta.
import type { AuraNotasCompany, EstadoRequisito, FonteCertificado } from "@/services/auraNotasApi";

export type TomRotulo = "ok" | "info" | "aviso" | "perigo";
export type Rotulo = { chave: string; texto: string; tom: TomRotulo };

/** "vence hoje" / "vence em 1 dia" / "vence em N dias". */
export function textoVencimento(dias: number): string {
  if (dias <= 0) return "Certificado vence hoje";
  return "Certificado vence em " + dias + (dias === 1 ? " dia" : " dias");
}

/** Rótulos do cartão da lista. A ordem é a de leitura: o que é, depois o alerta. */
export function rotulosDaEmpresa(c: AuraNotasCompany): Rotulo[] {
  var out: Rotulo[] = [];
  var fontes: FonteCertificado[] = c.certificado_fontes || (c.cert ? ["cofre"] : []);
  var temCofre = fontes.indexOf("cofre") >= 0 || !!c.cert;

  // nfce_configurada só vem do backend novo; ausente = empresa com nfce_config (lista antiga)
  if (c.nfce_configurada === false) {
    if (temCofre) out.push({ chave: "so_certificado", texto: "Só certificado — NFC-e não configurada", tom: "info" });
    else out.push({ chave: "sem_nfce", texto: "NFC-e não configurada", tom: "info" });
  }
  if (!temCofre && fontes.length) {
    var antigo = fontes.indexOf("nuvem_fiscal_legado") >= 0
      ? "Certificado antigo (Nuvem Fiscal) — pedir o A1 de novo"
      : "Certificado antigo — pedir o A1 de novo";
    out.push({ chave: "certificado_antigo", texto: antigo, tom: "aviso" });
  }
  if (c.nfse_configurada) {
    var ativa = !!(c.nfse && c.nfse.ativa);
    out.push({ chave: "nfse", texto: ativa ? "NFS-e ativa" : "NFS-e", tom: ativa ? "ok" : "info" });
  }
  if (c.cert) {
    var dias = c.cert.days_left;
    var vencido = c.cert.vencido != null ? c.cert.vencido : (dias != null && dias < 0);
    var breve = c.cert.vence_em_breve != null ? c.cert.vence_em_breve : (dias != null && dias >= 0 && dias <= 30);
    if (vencido) out.push({ chave: "cert_vencido", texto: "Certificado vencido", tom: "perigo" });
    else if (breve && dias != null) out.push({ chave: "cert_vence", texto: textoVencimento(dias), tom: "aviso" });
  }
  return out;
}

/** Símbolo e texto curto de cada estado de requisito. */
export var ESTADO_REQUISITO: Record<EstadoRequisito, { simbolo: string; texto: string; tom: TomRotulo }> = {
  ok: { simbolo: "✓", texto: "ok", tom: "ok" },
  falta: { simbolo: "•", texto: "falta", tom: "aviso" },
  problema: { simbolo: "!", texto: "precisa de atenção", tom: "perigo" },
  aviso: { simbolo: "i", texto: "vale conferir", tom: "aviso" },
  opcional: { simbolo: "–", texto: "opcional", tom: "info" },
};

function normNumero(v: any): string | null {
  if (v == null || v === "") return null;
  var d = String(v).replace(/\D/g, "");
  if (!d) return null;
  return String(parseInt(d, 10));
}

/**
 * O que pede confirmação explícita antes de salvar (mesma régua do backend):
 * ir para produção e mudar série ou próximo número.
 */
export function precisaConfirmar(p: {
  ambienteAntes: string | null | undefined; ambienteDepois: string | null | undefined;
  serieAntes: string | number | null | undefined; serieDepois: string | number | null | undefined;
  numeroAntes: string | number | null | undefined; numeroDepois: string | number | null | undefined;
}): { producao: boolean; numeracao: boolean } {
  var producao = p.ambienteDepois === "producao" && p.ambienteAntes !== "producao";
  var sd = normNumero(p.serieDepois);
  var nd = normNumero(p.numeroDepois);
  var mudaSerie = sd != null && sd !== normNumero(p.serieAntes);
  var mudaNumero = nd != null && nd !== normNumero(p.numeroAntes);
  return { producao: producao, numeracao: mudaSerie || mudaNumero };
}

/** Texto da confirmação (gentil, com o risco dito com clareza). */
export function textoConfirmacao(doc: "NFC-e" | "NFS-e", c: { producao: boolean; numeracao: boolean }): string {
  var partes: string[] = [];
  if (c.producao) partes.push("Em produção as " + doc + " passam a valer de verdade, com valor fiscal.");
  if (c.numeracao) {
    partes.push("Mudar a série ou o próximo número pode repetir um número que já foi usado, e "
      + (doc === "NFC-e" ? "a SEFAZ" : "o gov.br") + " recusa nota com número repetido. Confira com a loja o último número emitido antes de seguir.");
  }
  return partes.join(" ");
}

/** Mensagem do "Remover", com o aviso do certificado quando a empresa usa NFS-e. */
export function textoRemover(nome: string, usaNfse: boolean): string {
  var base = "Isso remove a configuração de NFC-e do Aura Notas (dados de emissão, CSC e certificado A1) de " + nome
    + ". A empresa continua funcionando normalmente: login, vendas e cadastro não mudam.";
  if (usaNfse) {
    base += " Atenção: o certificado A1 também é o da NFS-e desta empresa. Ele sai junto, e a NFS-e para de emitir até um certificado novo ser enviado.";
  }
  return base + " Não dá para desfazer; para voltar, é preciso configurar de novo.";
}
