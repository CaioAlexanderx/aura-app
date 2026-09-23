// ============================================================
// AURA. — Importação de produtos por planilha: prévia -> gravar -> relatório
//
// QA de 23/09/2026: escolher o arquivo já gravava os produtos, sem prévia
// nem confirmação, e o relatório era um toast de 3 s com texto errado.
// Agora:
//   1. "lendo"      — lê a planilha (aba/cabeçalho como antes, em
//                     utils/importPlanilha) e chama o import com
//                     dry_run:true, que NÃO grava (Aura-backend#739);
//   2. "conferindo" — ImportPlanilhaModal mostra o que vai entrar, o que
//                     fica de fora e por quê. Nada grava aqui;
//   3. "gravando"   — só depois do toque em "Importar N produtos";
//   4. "pronto"     — o mesmo modal vira o relatório e fica aberto até o
//                     lojista fechar (com a lista das linhas que não
//                     entraram para baixar).
//
// Multi-CNPJ: a importação é sempre da empresa selecionada (company.id),
// como antes. No consolidado o Estoque mostra a visão agregada e não tem
// botão de importar.
// ============================================================
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { downloadCSV } from "@/utils/csv";
import { lerLinhasDaMatriz } from "@/utils/importPlanilha";
import {
  gerarCsvProblemas,
  montarResultadoImport,
  montarResumoImport,
  type ContextoLeitura,
  type RespostaImport,
  type ResultadoImport,
  type ResumoImport,
} from "@/utils/importPrevia";
import { lerArquivoPlanilha, MAX_FILE_SIZE, MAX_ROWS } from "@/hooks/useServerImport";

export type FaseImport = "fechado" | "lendo" | "conferindo" | "gravando" | "pronto";

// Deixa o navegador pintar o "carregando" antes da leitura do .xlsx, que
// roda na thread da tela.
function proximoQuadro(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 30));
}

export function useImportProdutos(onComplete?: (resultado: ResultadoImport) => void) {
  const { company, token } = useAuthStore();
  const [fase, setFase] = useState<FaseImport>("fechado");
  const [resumo, setResumo] = useState<ResumoImport | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const rowsRef = useRef<Record<string, string>[]>([]);
  const ctxRef = useRef<ContextoLeitura | null>(null);
  // Cada leitura ganha um número; se o lojista cancelar enquanto a prévia
  // roda, a resposta que chegar depois é descartada.
  const tentativaRef = useRef(0);

  const reset = useCallback(() => {
    tentativaRef.current += 1;
    rowsRef.current = [];
    ctxRef.current = null;
    setResumo(null);
    setResultado(null);
    setErro(null);
    setNomeArquivo(null);
    setFase("fechado");
  }, []);

  async function postar(corpo: Record<string, unknown>): Promise<RespostaImport> {
    const res = await fetch(`${BASE_URL}/companies/${company!.id}/products/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any)?.error || `Erro ${res.status}`);
    return data as RespostaImport;
  }

  async function prepararPrevia(file: File) {
    const minha = ++tentativaRef.current;
    const ainda = () => tentativaRef.current === minha;
    setNomeArquivo(file.name);
    setResumo(null);
    setResultado(null);
    setErro(null);
    setFase("lendo");
    await proximoQuadro();

    let leitura;
    try {
      leitura = await lerArquivoPlanilha(file);
    } catch {
      if (!ainda()) return;
      toast.error("Não conseguimos ler essa planilha. Confira se é um arquivo do Excel (.xlsx) ou CSV.");
      reset();
      return;
    }
    if (!ainda()) return;

    const lidas = lerLinhasDaMatriz(leitura.matrix, leitura.linhaDoArquivo);
    if (lidas.rows.length === 0) {
      toast.error("Não encontramos produtos nessa planilha. Confira se ela tem uma linha com os nomes das colunas (NOME, PREÇO…).");
      reset();
      return;
    }
    if (lidas.rows.length > MAX_ROWS) {
      toast.error(`A planilha tem ${lidas.rows.length} linhas; o máximo por importação é ${MAX_ROWS}. Divida em partes menores.`);
      reset();
      return;
    }

    const ctx: ContextoLeitura = {
      nomeAba: leitura.nomeAba || null,
      abaNaoEaPrimeira: !!leitura.nomeAba && leitura.primeiraAba === false,
      nomeArquivo: file.name,
      cabecalho: lidas.cabecalho,
      linhas: lidas.linhas,
      linhaCabecalho: lidas.linhaCabecalho,
      rows: lidas.rows,
    };

    try {
      const resp = await postar({ rows: lidas.rows, dry_run: true });
      if (!ainda()) return;
      rowsRef.current = lidas.rows;
      ctxRef.current = ctx;
      setResumo(montarResumoImport(resp, ctx));
      setFase("conferindo");
    } catch (e: any) {
      if (!ainda()) return;
      toast.error(e?.message || "Não conseguimos conferir a planilha. Tente de novo.");
      reset();
    }
  }

  function escolherArquivo() {
    if (Platform.OS !== "web") {
      toast.error("A importação de planilha funciona no navegador do computador.");
      return;
    }
    if (!company?.id) {
      toast.error("Sua conta não está ligada a uma empresa. Fale com o suporte.");
      return;
    }
    if (!token) return;
    if (fase === "lendo" || fase === "gravando") return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv,.tsv,.txt";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_SIZE) { toast.error("Arquivo muito grande (máximo 5 MB)."); return; }
      void prepararPrevia(file);
    };
    input.click();
  }

  async function importar() {
    if (fase !== "conferindo" || !resumo || !ctxRef.current) return;
    if (resumo.aImportar <= 0) return;
    const minha = tentativaRef.current;
    setErro(null);
    setFase("gravando");
    try {
      const resp = await postar({
        rows: rowsRef.current,
        // O mapa que a prévia mostrou — grava exatamente o que foi conferido.
        ...(Object.keys(resumo.mapaColunas).length > 0 ? { column_map: resumo.mapaColunas } : {}),
      });
      if (tentativaRef.current !== minha) return;
      const r = montarResultadoImport(resp, resumo, ctxRef.current);
      setResultado(r);
      setFase("pronto");
      toast.success(r.gravados === 1 ? "1 produto importado" : `${r.gravados} produtos importados`);
      onComplete?.(r);
    } catch (e: any) {
      if (tentativaRef.current !== minha) return;
      setErro(e?.message || "Não conseguimos gravar os produtos. Nada foi importado; tente de novo.");
      setFase("conferindo");
    }
  }

  function fechar() {
    // Gravando: o pedido já foi; fechar agora esconderia o resultado.
    if (fase === "gravando") return;
    reset();
  }

  function baixarProblemas() {
    const base = resultado || resumo;
    if (!base) return;
    const hoje = new Date().toISOString().slice(0, 10);
    downloadCSV(gerarCsvProblemas(base), `linhas-que-nao-entraram-${hoje}.csv`);
  }

  return {
    fase,
    aberto: fase !== "fechado",
    ocupado: fase === "lendo" || fase === "gravando",
    resumo,
    resultado,
    erro,
    nomeArquivo,
    escolherArquivo,
    importar,
    fechar,
    baixarProblemas,
  };
}

export type ImportProdutosController = ReturnType<typeof useImportProdutos>;
