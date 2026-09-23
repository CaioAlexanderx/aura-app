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
// ============================================================
import { useState } from "react";
import { Platform } from "react-native";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { buildImportExtras, csvTextToMatrix, rowsFromMatrix } from "@/utils/importPlanilha";

export type ServerImportEntity = "products" | "customers" | "transactions";

export type ServerImportResult = { imported: number; skipped: number; errors: string[] };

const ROUTE_MAP: Record<string, string> = {
  products: "products/import",
  customers: "customers/import",
  transactions: "transactions/import",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 6000; // mesmo limite do backend

async function readFileAsMatrix(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const xlsxLib = await import("xlsx");
    const wb = xlsxLib.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const ws = wb.Sheets[sheetName];
    // raw:true preserva número como número (preço 7.44 não vira "7,44"
    // de texto formatado errado); defval:'' pra célula vazia não sumir
    // e a matriz manter o mesmo número de colunas em toda linha.
    return xlsxLib.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
  }
  const text = await file.text();
  return csvTextToMatrix(text);
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
        let matrix: unknown[][];
        try {
          matrix = await readFileAsMatrix(file);
        } catch {
          toast.error("Não conseguimos ler essa planilha. Confira se é um arquivo Excel (.xlsx) ou CSV válido.");
          return;
        }

        const rows = rowsFromMatrix(matrix);
        if (rows.length === 0) {
          toast.error("Não encontramos dados pra importar. Confira se a planilha tem um cabeçalho com os nomes das colunas.");
          return;
        }
        if (rows.length > MAX_ROWS) {
          toast.error(`A planilha tem ${rows.length} linhas; o limite por importação é ${MAX_ROWS}. Divida em partes menores.`);
          return;
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
