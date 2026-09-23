// ============================================================
// AURA. — Import de planilha (Estoque/Clientes/Lançamentos)
//
// Antes só lia CSV/TSV/TXT assumindo cabeçalho na linha 1. A primeira
// cliente de material de construção mandou um .xlsx com 3 linhas de
// título ("ATUALIZADO EM: ...", "TABELA DE PREÇO", linha vazia) antes
// do cabeçalho de verdade — o parser antigo tentava usar a linha de
// título como header e a importação vinha vazia.
//
// Agora: lê .xlsx/.xls (lib xlsx, mesmo padrão do import da federação
// em app/karate/(federation)/importacao) OU csv/tsv/txt, monta uma
// MATRIZ (array de arrays) e usa a mesma função pura pra achar a linha
// de cabeçalho (utils/importPlanilha.ts, sem depender de React/RN —
// ver o comentário lá em cima do motivo).
//
// A lógica virou hook pra ser reaproveitada em dois lugares: o botão
// do estado vazio do Estoque (ServerImport.tsx) e o botão "Importar
// planilha" na barra de ações (ao lado de "Importar DANFE"), pedido
// depois que a cliente com 11 produtos já cadastrados não conseguia
// achar como importar (o estado vazio só aparece com 0 produtos).
//
// 23/09/2026 (QA): PRODUTOS saíram deste hook — agora têm prévia antes de
// gravar e relatório depois (hooks/useImportProdutos.ts +
// ImportPlanilhaModal). Aqui ficam clientes e lançamentos, com o mesmo
// comportamento de antes, e a leitura do arquivo (lerArquivoPlanilha),
// compartilhada com a importação de produtos.
// ============================================================
import { useState } from "react";
import { Platform } from "react-native";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { buildImportExtras, csvTextToMatrixComLinhas, escolherAba, rowsFromMatrix, type AbaPlanilha } from "@/utils/importPlanilha";

export type ServerImportEntity = "products" | "customers" | "transactions";

export type ServerImportResult = { imported: number; skipped: number; errors: string[] };

const ROUTE_MAP: Record<string, string> = {
  products: "products/import",
  customers: "customers/import",
  transactions: "transactions/import",
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_ROWS = 6000; // mesmo limite do backend

export type LeituraPlanilha = {
  matrix: unknown[][];
  nomeAba?: string;
  primeiraAba?: boolean;
  /** Linha do arquivo (1 = primeira) do índice i da matriz — a prévia da
   *  importação aponta "linha 235" como o lojista vê no Excel. */
  linhaDoArquivo: (i: number) => number;
};

export async function lerArquivoPlanilha(file: File): Promise<LeituraPlanilha> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const xlsxLib = await import("xlsx");
    const wb = xlsxLib.read(buf, { type: "array" });
    // Planilha real de cliente veio com 3 abas — "Gráf1" (gráfico, 1
    // linha), "Gráf2" (2 mil linhas só de número) e só a 3ª com os
    // dados de verdade. Ler sempre SheetNames[0] importava a aba de
    // gráfico e não trazia produto nenhum — monta a matriz de TODAS as
    // abas e deixa escolherAba decidir qual usar (ver utils/importPlanilha).
    const abas: AbaPlanilha[] = wb.SheetNames.map(nome => ({
      nome,
      // raw:true preserva número como número (preço 7.44 não vira
      // "7,44" de texto formatado errado); defval:'' pra célula vazia
      // não sumir e a matriz manter o mesmo número de colunas em
      // toda linha.
      matriz: xlsxLib.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: "" }) as unknown[][],
    }));
    const escolhida = escolherAba(abas);
    if (!escolhida) return { matrix: [], linhaDoArquivo: i => i + 1 };
    // sheet_to_json(header:1) mantém as linhas vazias (conferido com a
    // planilha real da cliente: 2.051 linhas, a 3ª vazia) e começa no
    // início do intervalo da aba — normalmente A1, mas não sempre.
    let inicio = 0;
    try {
      const ref = wb.Sheets[escolhida.nome]["!ref"];
      if (ref) inicio = xlsxLib.utils.decode_range(ref).s.r;
    } catch { inicio = 0; }
    return {
      matrix: escolhida.matriz,
      nomeAba: escolhida.nome,
      primeiraAba: wb.SheetNames[0] === escolhida.nome,
      linhaDoArquivo: i => inicio + i + 1,
    };
  }
  const text = await file.text();
  const { matriz, linhas } = csvTextToMatrixComLinhas(text);
  return { matrix: matriz, linhaDoArquivo: i => linhas[i] ?? i + 1 };
}

export function useServerImport(entity: ServerImportEntity, onComplete?: (result: ServerImportResult) => void) {
  const { company, token } = useAuthStore();
  const [loading, setLoading] = useState(false);

  function handleImport() {
    if (Platform.OS !== "web") {
      toast.error("Importação de planilha disponível apenas no navegador (web)");
      return;
    }
    if (!company?.id) {
      toast.error("Sua conta não está associada a uma empresa. Contate o administrador.");
      return;
    }
    if (!token) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.tsv,.txt,.xlsx,.xls";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_SIZE) { toast.error("Arquivo muito grande (max 5MB)"); return; }

      setLoading(true);
      try {
        let leitura: LeituraPlanilha;
        try {
          leitura = await lerArquivoPlanilha(file);
        } catch {
          toast.error("Não conseguimos ler essa planilha. Confira se é um arquivo Excel (.xlsx) ou CSV válido.");
          return;
        }

        const rows = rowsFromMatrix(leitura.matrix);
        if (rows.length === 0) {
          toast.error("Não encontramos dados pra importar. Confira se a planilha tem um cabeçalho com os nomes das colunas.");
          return;
        }
        if (rows.length > MAX_ROWS) {
          toast.error(`A planilha tem ${rows.length} linhas; o limite por importação é ${MAX_ROWS}. Divida em partes menores.`);
          return;
        }

        // Planilha com mais de uma aba (gráfico, rascunho...) e os
        // dados não estavam na primeira — avisa qual aba foi lida,
        // pra não parecer mágica quando o resumo bater com outra coisa.
        if (leitura.nomeAba && !leitura.primeiraAba) {
          toast.info(`Lemos a aba "${leitura.nomeAba}"`);
        }

        const route = ROUTE_MAP[entity] || `${entity}/import`;
        const res = await fetch(`${BASE_URL}/companies/${company.id}/${route}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rows }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erro ${res.status}`);
        }

        const data = await res.json();
        const imported = data.saved || data.imported || data.created || 0;
        const skipped = data.duplicates_skipped || 0;
        const errorCount = data.error_count || 0;
        const skippedMsg = skipped > 0 ? `, ${skipped} já existe${skipped > 1 ? "m" : ""} na loja` : "";
        toast.success(`${imported} importados${skippedMsg}${errorCount > 0 ? `, ${errorCount} com erro` : ""}`);
        buildImportExtras(data).forEach(msg => toast.info(msg));
        onComplete?.({ imported, skipped, errors: data.errors || [] });
      } catch (err: any) {
        toast.error(err?.message || "Erro ao importar arquivo");
      } finally {
        setLoading(false);
      }
    };
    input.click();
  }

  return { loading, handleImport };
}
