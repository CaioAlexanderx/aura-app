// ============================================================================
// AURA. — Etiquetas: "Minhas medidas" guardadas neste computador (15/10/2026)
//
// A medida livre e o ajuste dela dependem da IMPRESSORA e do rolo daquele
// computador, então ficam no navegador (localStorage), uma chave por empresa
// ativa (multi-CNPJ: cada CNPJ tem a sua lista): aura_label_custom_<empresa>.
// Não vão ao backend — o pdv_settings.label_size continua só com os modelos
// fixos.
//
// Formato: { medidas: CustomLabelSpec[], escolhida: id | null }. A loja salva
// quantas medidas quiser, cada uma com o próprio ajuste; "escolhida" é a
// última medida usada NESTE computador (null = vale o modelo fixo).
//
// Tudo sanitizado na leitura e na escrita: valor fora da faixa volta ao
// limite, lixo é descartado. Sem localStorage (bloqueado, aba privada) nada
// quebra: leitura devolve vazio e escrita devolve `guardou: false` para a
// tela avisar "não consegui guardar neste computador".
//
// 15/10/2026 (decisão do Caio): as medidas passam a ser salvas na CONTA da
// loja (pdv_settings.label_custom_specs, labelAccountSync.ts) e valem para
// todos os computadores; este armazenamento vira CACHE (abrir rápido,
// funcionar sem rede) e a conta vence em conflito. "escolhida" continua
// por computador: é preferência de quem imprime.
//
// Puro, sem React.
// ============================================================================
import { sanitizarMedida, type CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";

export const MINHAS_MEDIDAS_PREFIXO = "aura_label_custom_";

export type MinhasMedidas = { medidas: CustomLabelSpec[]; escolhida: string | null };

function storage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch (e) { /* storage bloqueado */ }
  return null;
}

/** Normaliza o que veio do navegador: só specs válidos, sem id repetido, e
 *  "escolhida" só se apontar para uma medida da lista. */
export function sanitizarMinhasMedidas(raw: any): MinhasMedidas {
  var lista: any[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray(raw.medidas) ? raw.medidas : [];
  var vistos: Record<string, boolean> = {};
  var medidas: CustomLabelSpec[] = [];
  lista.forEach(function (m) {
    var s = sanitizarMedida(m);
    if (!s || vistos[s.id]) return;
    vistos[s.id] = true;
    medidas.push(s);
  });
  var esc = raw && typeof raw === "object" && !Array.isArray(raw) && typeof raw.escolhida === "string" ? raw.escolhida : null;
  return { medidas: medidas, escolhida: esc && vistos[esc] ? esc : null };
}

export function lerMinhasMedidas(companyId: string | null | undefined): MinhasMedidas {
  var vazio: MinhasMedidas = { medidas: [], escolhida: null };
  var st = storage();
  if (!st || !companyId) return vazio;
  try {
    var txt = st.getItem(MINHAS_MEDIDAS_PREFIXO + companyId);
    if (!txt) return vazio;
    return sanitizarMinhasMedidas(JSON.parse(txt));
  } catch (e) { return vazio; }
}

function gravar(companyId: string | null | undefined, dados: MinhasMedidas): boolean {
  var st = storage();
  if (!st || !companyId) return false;
  try {
    var limpo = sanitizarMinhasMedidas(dados);
    if (limpo.medidas.length === 0) st.removeItem(MINHAS_MEDIDAS_PREFIXO + companyId);
    else st.setItem(MINHAS_MEDIDAS_PREFIXO + companyId, JSON.stringify(limpo));
    return true;
  } catch (e) { return false; }
}

export function listarMedidas(companyId: string | null | undefined): CustomLabelSpec[] {
  return lerMinhasMedidas(companyId).medidas;
}

/** Cria ou atualiza (pelo id) uma medida. Devolve a medida sanitizada (null
 *  se for lixo) e se conseguiu guardar neste computador. */
export function salvarMedida(companyId: string | null | undefined, spec: CustomLabelSpec): { medida: CustomLabelSpec | null; guardou: boolean } {
  var medida = sanitizarMedida(spec);
  if (!medida) return { medida: null, guardou: false };
  var atual = lerMinhasMedidas(companyId);
  var achou = false;
  var medidas = atual.medidas.map(function (m) {
    if (m.id !== (medida as CustomLabelSpec).id) return m;
    achou = true;
    return medida as CustomLabelSpec;
  });
  if (!achou) medidas.push(medida);
  return { medida: medida, guardou: gravar(companyId, { medidas: medidas, escolhida: atual.escolhida }) };
}

/** Apaga uma medida; se era a escolhida, volta a valer o modelo fixo. */
export function apagarMedida(companyId: string | null | undefined, id: string): boolean {
  var atual = lerMinhasMedidas(companyId);
  return gravar(companyId, {
    medidas: atual.medidas.filter(function (m) { return m.id !== id; }),
    escolhida: atual.escolhida === id ? null : atual.escolhida,
  });
}

/** Marca a medida usada por último neste computador (null = modelo fixo). */
export function escolherMedida(companyId: string | null | undefined, id: string | null): boolean {
  var atual = lerMinhasMedidas(companyId);
  if (id !== null && !atual.medidas.some(function (m) { return m.id === id; })) return false;
  if (atual.escolhida === id) return true;
  return gravar(companyId, { medidas: atual.medidas, escolhida: id });
}

/** Troca a lista do cache pela lista da conta, mantendo a medida escolhida
 *  neste computador se ela ainda existir. Devolve o que ficou. */
export function substituirMedidas(companyId: string | null | undefined, medidas: CustomLabelSpec[]): MinhasMedidas {
  var atual = lerMinhasMedidas(companyId);
  var limpo = sanitizarMinhasMedidas({ medidas: medidas, escolhida: atual.escolhida });
  gravar(companyId, limpo);
  return limpo;
}

/** A medida escolhida por último neste computador, ou null. */
export function medidaEscolhida(companyId: string | null | undefined): CustomLabelSpec | null {
  var atual = lerMinhasMedidas(companyId);
  if (!atual.escolhida) return null;
  return atual.medidas.find(function (m) { return m.id === atual.escolhida; }) || null;
}
