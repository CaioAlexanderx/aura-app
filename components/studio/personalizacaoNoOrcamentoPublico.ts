// ============================================================
// components/studio/personalizacaoNoOrcamentoPublico.ts
//
// As etiquetas da personalização de cada item na página pública do
// orçamento (/orcamento/[token]), 25/11/2026 (QA do Caio, 24/11).
//
// O `customization` do item guarda a arte por ID DE CAMPO da
// personalização do produto (orcamentoVideo/pecaDoOrcamento.ts). A página
// mostrava "chave: valor" — o cliente lia o id do campo e o endereço cru
// da imagem. Agora:
//   - o rótulo vem dos campos do produto que o GET público devolve em
//     `customization_fields` (aura-backend, studioQuotePublic.js). Sem o
//     campo (backend antigo, item livre), vale o rotuloDaChave de sempre,
//     que já conhece as chaves laterais e cai na própria chave;
//   - imagem (URL) não vira texto: vai "Rótulo: Arte enviada";
//   - cor (hex) segue com a bolinha e o rótulo;
//   - objeto (ajuste de tamanho e posição) é dado da oficina: some.
// ============================================================
import { rotuloDaChave, valorDaChave } from "@/components/studio/customizationConfig";

export type CampoDoOrcamentoPublico = { id?: string | null; label?: string | null; type?: string | null };

export type EtiquetaDaPersonalizacao = {
  chave: string;
  texto: string;
  /** Hex da bolinha quando o valor é uma cor. */
  cor: string | null;
};

const MAX_ETIQUETAS = 4;
const MAX_VALOR = 40;

function ehHex(v: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(v.trim());
}

/** Endereço de arquivo (imagem enviada, prévia): nunca vira texto para o cliente. */
export function ehEnderecoDeArquivo(v: string): boolean {
  const s = v.trim();
  return /^(https?:)?\/\//i.test(s) || /^(data|blob):/i.test(s);
}

function valorEmTexto(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "boolean") return valorDaChave(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null;
  if (typeof v === "string") return v.trim() ? v.trim() : null;
  if (Array.isArray(v)) {
    const partes = v
      .filter((x) => typeof x === "string" || typeof x === "number")
      .map((x) => String(x).trim())
      .filter(Boolean);
    return partes.length ? partes.join(", ") : null;
  }
  return null; // objeto: ajuste da arte, dado da oficina
}

export function etiquetasDaPersonalizacao(
  customization: unknown,
  campos?: CampoDoOrcamentoPublico[] | null,
): EtiquetaDaPersonalizacao[] {
  if (!customization || typeof customization !== "object" || Array.isArray(customization)) return [];
  const porId: Record<string, { label?: string; type?: string }> = {};
  for (const c of Array.isArray(campos) ? campos : []) {
    if (c && typeof c.id === "string" && c.id) {
      porId[c.id] = {
        label: typeof c.label === "string" && c.label.trim() ? c.label.trim() : undefined,
        type: typeof c.type === "string" ? c.type : undefined,
      };
    }
  }
  const out: EtiquetaDaPersonalizacao[] = [];
  for (const [chave, bruto] of Object.entries(customization as Record<string, unknown>)) {
    if (out.length >= MAX_ETIQUETAS) break;
    const valor = valorEmTexto(bruto);
    if (valor === null) continue;
    const rotulo = rotuloDaChave(chave, porId, bruto);
    if (ehHex(valor)) {
      out.push({ chave, texto: rotulo, cor: valor });
    } else if (ehEnderecoDeArquivo(valor)) {
      out.push({ chave, texto: /enviada/i.test(rotulo) ? rotulo : `${rotulo}: Arte enviada`, cor: null });
    } else {
      out.push({ chave, texto: `${rotulo}: ${valor.slice(0, MAX_VALOR)}`, cor: null });
    }
  }
  return out;
}
