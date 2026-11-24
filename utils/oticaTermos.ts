// ============================================================
// AURA. — Ótica: termos da venda por loja (p-207, 23/11/2026)
//
// O texto é da LOJA. O Aura só oferece o campo e imprime o que ela
// escreveu nas duas vias da OS; em branco, a folha sai sem o quadro.
// Mesmas regras do servidor (Aura-backend, src/routes/otica.js): quebras
// de linha ficam, \r\n vira \n, pontas aparadas, 3+ linhas vazias viram
// uma, teto de 4000 letras.
// ============================================================
import type { OticaSettings } from "@/services/oticaApi";

export const TERMOS_MAX = 4000;

// O campo só aparece quando o GET de configurações traz a chave: é o
// servidor dizendo que já guarda os termos. Sem ela (backend antigo), a
// tela fica como era e o app não manda nada.
export function termosAceitos(settings: Partial<OticaSettings> | null | undefined): boolean {
  return !!settings && typeof settings.sale_terms === "string";
}

export function normalizarTermos(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function termosLongos(raw: string | null | undefined): boolean {
  return normalizarTermos(raw).length > TERMOS_MAX;
}
