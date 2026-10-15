// ============================================================================
// AURA. — Etiquetas: configuração de impressão salva na CONTA (15/10/2026)
//
// Pedido do Caio: "Podemos salvar a configuração de impressora na conta?
// Para não perder a configuração." Decisões: (1) salva na conta da loja;
// (2) vale para a LOJA INTEIRA, em todos os computadores. Loja com duas
// impressoras que erram diferente cria duas medidas ("40x25 balcão" e
// "40x25 estoque").
//
// Fonte: pdv_settings da empresa ativa (Aura-backend routes/pdvSettings.js):
//   - label_custom_specs  — as medidas próprias (até 20)
//   - label_printer_prefs — a calibração dos modelos fixos, por modelo
// null = a loja nunca salvou na conta; lista/objeto (mesmo vazio) = a conta
// é a fonte e vence o navegador. Chave AUSENTE no GET = backend antigo: o app
// segue só no navegador, como antes (nada quebra).
//
// O navegador (customLabelStorage / labelPrinterPrefs) vira CACHE: a tela
// abre com ele (rápido, funciona sem rede) e troca pelo da conta quando o GET
// volta.
//
// Migração única: conta com null + navegador com dado válido + navegador
// ainda não migrado => sobe o do navegador uma vez e marca a migração neste
// navegador (aura_label_conta_migrada_<empresa>). Nunca sobrescreve dado da
// conta com dado do navegador.
//
// A medida escolhida por último continua por computador (preferência de
// quem imprime): fica só no navegador.
//
// Puro, sem React.
// ============================================================================
import type { CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";
import { sanitizarMinhasMedidas } from "@/components/screens/estoque/labels/customLabelStorage";
import { sanitizeLabelPrinterPrefsMap, type LabelPrinterPrefsMap } from "@/components/screens/estoque/labels/labelPrinterPrefs";

export const CHAVE_MEDIDAS = "label_custom_specs";
export const CHAVE_CALIBRACAO = "label_printer_prefs";
/** Limite do backend (pdvSettings.js LABEL_CUSTOM_MAX_SPECS). */
export const MAX_MEDIDAS_NA_CONTA = 20;
export const MIGRACAO_PREFIXO = "aura_label_conta_migrada_";

export type PatchEtiquetaNaConta = {
  label_custom_specs?: CustomLabelSpec[];
  label_printer_prefs?: LabelPrinterPrefsMap;
};

function isObj(v: any): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** O backend já conhece as chaves? (GET devolve as duas, mesmo null.) */
export function contaGuardaEtiquetas(settings: any): boolean {
  return isObj(settings) && CHAVE_MEDIDAS in settings && CHAVE_CALIBRACAO in settings;
}

/** Medidas da conta, ou null se a conta nunca salvou (ou backend antigo). */
export function medidasDaConta(settings: any): CustomLabelSpec[] | null {
  if (!isObj(settings) || !Array.isArray(settings[CHAVE_MEDIDAS])) return null;
  return sanitizarMinhasMedidas(settings[CHAVE_MEDIDAS]).medidas.slice(0, MAX_MEDIDAS_NA_CONTA);
}

/** Calibração da conta, ou null se a conta nunca salvou (ou backend antigo). */
export function calibracaoDaConta(settings: any): LabelPrinterPrefsMap | null {
  if (!isObj(settings) || !isObj(settings[CHAVE_CALIBRACAO])) return null;
  return sanitizeLabelPrinterPrefsMap(settings[CHAVE_CALIBRACAO]);
}

/** O que sobe para a conta: specs limpos, sem repetidos, até 20. */
export function medidasParaConta(medidas: CustomLabelSpec[]): CustomLabelSpec[] {
  return sanitizarMinhasMedidas(medidas).medidas.slice(0, MAX_MEDIDAS_NA_CONTA);
}

export function calibracaoParaConta(map: LabelPrinterPrefsMap): LabelPrinterPrefsMap {
  return sanitizeLabelPrinterPrefsMap(map);
}

// ----- marca da migração (por empresa, neste navegador) -----

function storage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch (e) { /* storage bloqueado */ }
  return null;
}

function lerMarcas(companyId: string): Record<string, boolean> {
  var st = storage();
  if (!st) return {};
  try {
    var v = JSON.parse(st.getItem(MIGRACAO_PREFIXO + companyId) || "{}");
    return isObj(v) ? v : {};
  } catch (e) { return {}; }
}

export function migracaoFeita(companyId: string, chave: string): boolean {
  return lerMarcas(companyId)[chave] === true;
}

export function marcarMigracao(companyId: string, chave: string): void {
  var st = storage();
  if (!st) return;
  try {
    var m = lerMarcas(companyId);
    m[chave] = true;
    st.setItem(MIGRACAO_PREFIXO + companyId, JSON.stringify(m));
  } catch (e) { /* sem storage: tenta de novo na próxima visita */ }
}

// ----- decisão ao carregar -----

export type PlanoDaConta =
  | { modo: "navegador" }
  | {
      modo: "conta";
      /** Lista da conta (vence o navegador) ou null = segue o navegador. */
      medidas: CustomLabelSpec[] | null;
      calibracao: LabelPrinterPrefsMap | null;
      /** Migração única: o que subir do navegador (vazio = nada). */
      subir: PatchEtiquetaNaConta;
      /** Chaves sem nada para subir e sem migração marcada: marcar já. */
      marcarSemSubir: string[];
    };

/** Decide, a partir do GET de pdv_settings e do que o navegador tem, de onde
 *  vêm as medidas e a calibração e o que migrar. Nunca sobe dado do
 *  navegador por cima de dado da conta. */
export function planoDaConta(
  companyId: string,
  settings: any,
  local: { medidas: CustomLabelSpec[]; calibracao: LabelPrinterPrefsMap },
): PlanoDaConta {
  if (!contaGuardaEtiquetas(settings)) return { modo: "navegador" };
  var medidas = medidasDaConta(settings);
  var calibracao = calibracaoDaConta(settings);
  var subir: PatchEtiquetaNaConta = {};
  var marcarSemSubir: string[] = [];

  if (medidas === null && !migracaoFeita(companyId, CHAVE_MEDIDAS)) {
    var lm = medidasParaConta(local.medidas);
    if (lm.length > 0) subir.label_custom_specs = lm;
    else marcarSemSubir.push(CHAVE_MEDIDAS);
  }
  if (calibracao === null && !migracaoFeita(companyId, CHAVE_CALIBRACAO)) {
    var lc = calibracaoParaConta(local.calibracao);
    if (Object.keys(lc).length > 0) subir.label_printer_prefs = lc;
    else marcarSemSubir.push(CHAVE_CALIBRACAO);
  }
  return { modo: "conta", medidas: medidas, calibracao: calibracao, subir: subir, marcarSemSubir: marcarSemSubir };
}

// ----- gravação com debounce curto -----

export type GravadorDaConta = {
  /** Junta o patch ao pendente da empresa e grava depois de `atrasoMs`. */
  agendar: (companyId: string, patch: PatchEtiquetaNaConta) => void;
  /** Grava já o que estiver pendente (ex.: ao sair da tela). */
  descarregar: () => void;
};

/** Debounce por empresa: cada chave guarda só o último valor (é sempre o
 *  estado inteiro: a lista toda, o mapa todo). Falhou => `aoFalhar` (aviso
 *  discreto na tela); o valor local fica como está. */
export function criarGravadorDaConta(opts: {
  salvar: (companyId: string, patch: PatchEtiquetaNaConta) => Promise<any>;
  aoFalhar?: (companyId: string, erro: any) => void;
  aoGravar?: (companyId: string, resposta: any) => void;
  atrasoMs?: number;
}): GravadorDaConta {
  var atraso = opts.atrasoMs == null ? 600 : opts.atrasoMs;
  var pendentes: Record<string, PatchEtiquetaNaConta> = {};
  var timers: Record<string, any> = {};

  function gravar(companyId: string) {
    var patch = pendentes[companyId];
    delete pendentes[companyId];
    if (timers[companyId]) { clearTimeout(timers[companyId]); delete timers[companyId]; }
    if (!patch || Object.keys(patch).length === 0) return;
    var p: Promise<any>;
    try { p = opts.salvar(companyId, patch); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(
      function(res) { if (opts.aoGravar) opts.aoGravar(companyId, res); },
      function(err) { if (opts.aoFalhar) opts.aoFalhar(companyId, err); },
    );
  }

  return {
    agendar: function(companyId, patch) {
      if (!companyId) return;
      pendentes[companyId] = Object.assign({}, pendentes[companyId] || {}, patch);
      if (timers[companyId]) clearTimeout(timers[companyId]);
      timers[companyId] = setTimeout(function() { gravar(companyId); }, atraso);
    },
    descarregar: function() {
      Object.keys(pendentes).forEach(gravar);
    },
  };
}
