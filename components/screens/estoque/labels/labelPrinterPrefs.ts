// ============================================================================
// AURA. — Etiquetas: calibração da impressora por computador (13/10/2026)
//
// Modo contínuo, passo entre linhas e deslocamento vertical dependem da
// IMPRESSORA ligada naquele computador (driver, sensor, mídia), não da loja:
// por isso ficam no navegador (localStorage, uma chave por empresa), e não no
// pdv_settings como o modelo e o deslocamento horizontal. Cada modelo de
// etiqueta guarda a sua calibração — o passo de um não serve para o outro.
//
// Sem nada salvo (ou sem localStorage) devolve o padrão: tudo desligado, e o
// HTML da etiqueta sai byte a byte igual ao de sempre.
//
// Puro, sem React — testável direto e usado por PrintLabels.tsx.
// ============================================================================

import {
  LABEL_SIZE_PRESETS, labelSupportsCalibration, labelRowPitchMm, labelOffsetYMm,
  type LabelSizeKey,
} from "@/components/screens/estoque/labels/buildLabelHtml";

export type LabelPrinterPrefs = {
  /** "Minha impressora está em modo contínuo". */
  continuous: boolean;
  /** Passo entre linhas (mm). Padrão = o do modelo. */
  rowPitchMm: number;
  /** Deslocamento vertical (mm, positivo desce). */
  offsetYMm: number;
};

var STORAGE_PREFIX = "aura_label_printer_";

export function defaultLabelPrinterPrefs(size: LabelSizeKey): LabelPrinterPrefs {
  return { continuous: false, rowPitchMm: LABEL_SIZE_PRESETS[size].pageHeightMm, offsetYMm: 0 };
}

/** Normaliza o que veio do navegador: faixa, décimos e modelo sem calibração. */
export function sanitizeLabelPrinterPrefs(size: LabelSizeKey, raw: any): LabelPrinterPrefs {
  var def = defaultLabelPrinterPrefs(size);
  if (!raw || typeof raw !== "object" || !labelSupportsCalibration(size)) return def;
  return {
    continuous: raw.continuous === true,
    rowPitchMm: labelRowPitchMm(size, raw.rowPitchMm),
    offsetYMm: labelOffsetYMm(size, raw.offsetYMm),
  };
}

export function isDefaultLabelPrinterPrefs(size: LabelSizeKey, prefs: LabelPrinterPrefs): boolean {
  var def = defaultLabelPrinterPrefs(size);
  return !prefs.continuous && prefs.rowPitchMm === def.rowPitchMm && prefs.offsetYMm === 0;
}

function storage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch (e) { /* storage bloqueado */ }
  return null;
}

function readAll(companyId: string): Record<string, any> {
  var st = storage();
  if (!st) return {};
  try {
    var parsed = JSON.parse(st.getItem(STORAGE_PREFIX + companyId) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) { return {}; }
}

export function loadLabelPrinterPrefs(companyId: string | null | undefined, size: LabelSizeKey): LabelPrinterPrefs {
  if (!companyId) return defaultLabelPrinterPrefs(size);
  return sanitizeLabelPrinterPrefs(size, readAll(companyId)[size]);
}

export function saveLabelPrinterPrefs(companyId: string | null | undefined, size: LabelSizeKey, prefs: LabelPrinterPrefs): void {
  var st = storage();
  if (!st || !companyId) return;
  try {
    var all = readAll(companyId);
    var clean = sanitizeLabelPrinterPrefs(size, prefs);
    if (isDefaultLabelPrinterPrefs(size, clean)) delete all[size]; else all[size] = clean;
    if (Object.keys(all).length === 0) st.removeItem(STORAGE_PREFIX + companyId);
    else st.setItem(STORAGE_PREFIX + companyId, JSON.stringify(all));
  } catch (e) { /* sem storage: vale só nesta visita */ }
}

/** Só o que difere do padrão vai para o buildLabelHtml — no padrão, nenhuma
 *  opção nova é passada e o HTML não muda. */
export function labelPrinterBuildOptions(size: LabelSizeKey, prefs: LabelPrinterPrefs): { continuous?: boolean; rowPitchMm?: number; offsetYMm?: number } {
  var clean = sanitizeLabelPrinterPrefs(size, prefs);
  var out: { continuous?: boolean; rowPitchMm?: number; offsetYMm?: number } = {};
  if (clean.continuous) out.continuous = true;
  if (clean.rowPitchMm !== LABEL_SIZE_PRESETS[size].pageHeightMm) out.rowPitchMm = clean.rowPitchMm;
  if (clean.offsetYMm !== 0) out.offsetYMm = clean.offsetYMm;
  return out;
}
