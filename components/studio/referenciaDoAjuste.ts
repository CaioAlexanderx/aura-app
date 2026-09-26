// ============================================================
// components/studio/referenciaDoAjuste.ts
//
// A referência que a cliente anexa ao pedir ajuste na arte (Fase 4 da
// vitrine Studio). O backend guarda junto da nota, sem coluna nova, numa
// última linha "Referência: https://..." (routes/studioApprovalPublic.js,
// notaComReferencia). Até aqui o painel mostrava essa linha como texto
// corrido e a lojista tinha de copiar o endereço (achado A4 do QA).
//
// Esta função separa as duas coisas para o painel mostrar o texto da
// cliente e a referência como link que abre com um toque. Pura, testada
// em __tests__/referenciaDoAjuste.test.ts.
// ============================================================

export type NotaDoAjuste = { texto: string | null; referencia: string | null };

// Só https e sem espaço/aspas/sinais de tag: o mesmo que o backend aceita
// (referenciaValida). Qualquer outra coisa fica como texto, nunca link.
const LINHA_DA_REFERENCIA = /^\s*Referência:\s*(https:\/\/[^\s"'<>]+)\s*$/i;

export function separarReferencia(nota: string | null | undefined): NotaDoAjuste {
  const bruta = String(nota ?? "");
  const linhas = bruta.split(/\r?\n/);
  let ultima = linhas.length - 1;
  while (ultima >= 0 && !linhas[ultima].trim()) ultima--;
  const m = ultima >= 0 ? LINHA_DA_REFERENCIA.exec(linhas[ultima]) : null;
  if (!m) {
    const texto = bruta.trim();
    return { texto: texto || null, referencia: null };
  }
  const texto = linhas.slice(0, ultima).join("\n").trim();
  return { texto: texto || null, referencia: m[1] };
}
