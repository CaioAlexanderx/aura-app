// ============================================================
// AURA. — Estoque · "Chegou mercadoria" (shell do wizard)
//
// Estimativa p-171, Fase 3. Mockup aprovado: estoque-portas-mockup-17-11.html,
// parte 4. Padrão TrocaModal (DNA canônica de wizards, armadilha 5 do
// CLAUDE.md): cabeçalho com ícone, título e a loja que recebe; barra de
// quatro passos (no celular, "Passo n de 4"); corpo; rodapé com a frase da
// situação à esquerda e as ações à direita. Esc fecha pelo mesmo caminho do X.
//
// Abre por WebPortal (memória app#917: overlay dentro do shell fica preso no
// z-index do react-native-web).
//
// A `idempotency_key` nasce UMA vez ao abrir (como na TrocaModal) e vai no
// POST /products/stock-receipts do A7 (Aura-backend#1056): a mesma chave
// chegando de novo devolve o resultado guardado e não soma nada.
//
// A entrada é sempre de uma loja só (company.id). O wizard não abre no
// consolidado: quem decide é a porta (A8), que fica para depois. Nesta leva
// (A1–A4a) o wizard existe no código e não tem porta: ninguém o vê.
//
// Cards: A1 (shell + passo 1), A2 (novo fornecedor dentro do passo),
// A3 (passo 2), A4a e A4b (passo 3, conferência), A5 (passo 3, digitar),
// A6 (planilha, que cai na mesma conferência) e A7 (gravar e Pronto).
//
// A7: "Dar entrada" grava pelo POST /products/stock-receipts com a chave
// desta abertura (gravarEntrada.ts): divide acima de 300 linhas, repete com a
// MESMA chave quando a resposta não chega, e a parte que já entrou não soma
// em dobro ao tentar de novo. Desvio do Matcon (pendência 4): com
// matcon_enabled, a nota abre o DanfeImportModal de hoje, sem mudança.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Dimensions, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { FornecedorFormSheet } from "@/components/fornecedores/FornecedorFormSheet";
import { suppliersApi, type Supplier } from "@/services/suppliersApi";
import { dialogoAbertoNaTela } from "@/hooks/useAtalhosDoCaixa";
import { FORM_VAZIO, type FormFornecedor } from "@/utils/fornecedoresUtil";
import { estoqueEntradasApi } from "@/services/estoqueEntradasApi";
import { companiesApi } from "@/services/api";
import { toast } from "@/components/Toast";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { readMatconSettings } from "@/constants/matcon";
import { DanfeImportModal } from "@/components/screens/estoque/DanfeImportModal";
import type { Product } from "@/components/screens/estoque/types";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import { Passo1Fornecedor } from "./Passo1Fornecedor";
import { Passo2Origem, type PerguntaDoCnpj } from "./Passo2Origem";
import { Passo3Conferir } from "./Passo3Conferir";
import { Passo4Pronto } from "./Passo4Pronto";
import { Passo3Digitar } from "./Passo3Digitar";
import { conferirDigitadas, type LinhaDigitada } from "./digitarRegras";
import { itensDaPlanilha, baixarModeloDeEntrada } from "./origemPlanilha";
import { lerArquivoPlanilha } from "@/hooks/useServerImport";
import {
  itensDaConferencia, resolverVariantes, montarCorpos, gravarEntrada, errosPorLinha, deveRepetir,
  resumoDoPronto, csvDosQueFaltam, type RespostaDaEntrada, type ItemDaEntrada,
} from "./gravarEntrada";
import { lerNota, type NotaLida } from "./lerNota";
import { escolherArquivo, lerTextoDoArquivo, ACEITA_NOTA } from "./escolherArquivo";
import {
  novaChaveDaEntrada, conferirEmitente, nomeDaEscolha, consultaDaNota, entradaAnteriorDaNota,
  indexarProdutos, conferirLinha, resumirConferencia, motivoDoRodape, decisaoDeNovo, diaMes,
  aplicarMargemAosNovos, MARGEM_PADRAO_DOS_NOVOS,
  type EscolhaDoFornecedor, type FornecedorDaLista, type DecisaoDaLinha, type AjusteDaLinha, type ItemParaConferir,
} from "./chegouRegras";

type Passo = 1 | 2 | 3 | 4;

type Props = {
  visible: boolean;
  companyId: string;
  /** Nome da loja que recebe ("Entrada na loja [loja]"). */
  lojaNome?: string | null;
  /** Produtos da loja (useProducts), para a conferência do passo 3. */
  products: Product[];
  /** Quem não vê custo dá entrada sem custo (o backend também corta). */
  semCusto: boolean;
  onClose: () => void;
  /** A7: a entrada gravou (inteira ou em parte). */
  onFeito?: (respostas: RespostaDaEntrada[]) => void;
  /** A7: "Ver os produtos novos" (ids cadastrados agora). Sem a prop, o botão some. */
  onVerNovos?: (ids: string[]) => void;
};

const IS_WEB = Platform.OS === "web";

// Mesma régua do ItemFormModal: no web, a largura da janela (o
// useWindowDimensions do RNW não acompanha o jsdom dos testes).
function useLarguraDaJanela(): number {
  const [w, setW] = useState(
    IS_WEB && typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width,
  );
  useEffect(() => {
    if (!IS_WEB || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

export function ChegouMercadoriaModal({ visible, companyId, lojaNome, products, semCusto, onClose, onFeito, onVerNovos }: Props) {
  const estreito = useLarguraDaJanela() < 640;
  const qc = useQueryClient();

  const [passo, setPasso] = useState<Passo>(1);
  const [chave, setChave] = useState("");
  const [escolha, setEscolha] = useState<EscolhaDoFornecedor>(null);
  // Formulário "Novo fornecedor" no lugar do miolo (padrão p-167 da Troca).
  const [novoFornecedor, setNovoFornecedor] = useState<{ inicial: FormFornecedor | null } | null>(null);
  const [nota, setNota] = useState<NotaLida | null>(null);
  const [arquivoErrado, setArquivoErrado] = useState(false);
  const [lendoNota, setLendoNota] = useState(false);
  const [perguntaSair, setPerguntaSair] = useState(false);
  // Respostas do passo 2, presas à nota e ao fornecedor da hora: trocou um
  // dos dois, a pergunta volta.
  const [cnpjRespondido, setCnpjRespondido] = useState<string | null>(null);
  const [repetidaVista, setRepetidaVista] = useState<string | null>(null);
  // Passo 3: decisões e ajustes por linha (n do item), "Usar o custo médio"
  // e "Mostrar os outros n".
  const [decisoes, setDecisoes] = useState<Record<number, DecisaoDaLinha>>({});
  const [ajustes, setAjustes] = useState<Record<number, AjusteDaLinha>>({});
  const [usarMedio, setUsarMedio] = useState(true);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  // A4b: margem do lote para o preço sugerido dos produtos novos.
  const [margemDosNovos, setMargemDosNovos] = useState(MARGEM_PADRAO_DOS_NOVOS);
  // A7: gravando, o que o servidor recusou por linha, as respostas, a parte
  // que não entrou e o desvio do Matcon.
  const [gravando, setGravando] = useState<{ feitos: number; total: number } | null>(null);
  const [errosDasLinhas, setErrosDasLinhas] = useState<Record<number, string>>({});
  const [respostas, setRespostas] = useState<RespostaDaEntrada[] | null>(null);
  const [falha, setFalha] = useState<{ feitos: number; total: number } | null>(null);
  const [pendentes, setPendentes] = useState<ItemDaEntrada[]>([]);
  const [danfeMatcon, setDanfeMatcon] = useState(false);
  // A5: de onde vêm os itens (a nota lida ou a lista digitada).
  const [origem, setOrigem] = useState<"nota" | "digitar" | "planilha">("nota");
  // A6: a planilha lida (ou a que não deu para ler).
  const [planilha, setPlanilha] = useState<{ nome: string; itens: ItemParaConferir[] } | null>(null);
  const [planilhaIlegivel, setPlanilhaIlegivel] = useState(false);
  const [digitadas, setDigitadas] = useState<LinhaDigitada[]>([]);
  const [numeroDigitado, setNumeroDigitado] = useState("");

  // Zera tudo ao fechar; a chave nasce ao abrir.
  useEffect(() => {
    if (!visible) {
      setPasso(1);
      setChave("");
      setEscolha(null);
      setNovoFornecedor(null);
      setNota(null);
      setArquivoErrado(false);
      setLendoNota(false);
      setPerguntaSair(false);
      setCnpjRespondido(null);
      setRepetidaVista(null);
      setUsarMedio(true);
      setMargemDosNovos(MARGEM_PADRAO_DOS_NOVOS);
      setGravando(null);
      setErrosDasLinhas({});
      setRespostas(null);
      setFalha(null);
      setPendentes([]);
      setDanfeMatcon(false);
      setOrigem("nota");
      setPlanilha(null);
      setPlanilhaIlegivel(false);
      setDigitadas([]);
      setNumeroDigitado("");
    } else {
      setChave(novaChaveDaEntrada());
    }
  }, [visible]);

  const { data: dadosFornecedores, isLoading: carregandoFornecedores, isError: erroFornecedores } = useQuery({
    queryKey: ["suppliers", companyId],
    queryFn: () => suppliersApi.list(companyId),
    enabled: visible && !!companyId,
    staleTime: 60_000,
  });
  const fornecedores = (dadosFornecedores?.suppliers || []) as FornecedorDaLista[];
  const fornecedoresRef = useRef(fornecedores);
  fornecedoresRef.current = fornecedores;

  // Pendência 4: no Matcon a nota segue pelo DanfeImportModal (custo da nota).
  const { settings: pdvDaLoja } = usePdvSettings();
  const matcon = readMatconSettings(pdvDaLoja as any).matcon_enabled;
  const matconRef = useRef(matcon);
  matconRef.current = matcon;

  // ── Arquivo da nota (atalho do passo 1 e origem "Nota" do passo 2) ──
  const abrirNota = useCallback(async () => {
    if (matconRef.current) { setDanfeMatcon(true); return; }
    const arquivo = await escolherArquivo(ACEITA_NOTA);
    if (!arquivo) return;
    setLendoNota(true);
    try {
      const texto = await lerTextoDoArquivo(arquivo);
      const r = lerNota(texto, arquivo.name);
      if (!r.ok) {
        setNota(null);
        setArquivoErrado(true);
      } else {
        setArquivoErrado(false);
        setNota(r.nota);
        setOrigem("nota");
        setPlanilha(null);
        setPlanilhaIlegivel(false);
        // Sem escolha ainda (atalho): a Aura ACHA pelo CNPJ. Com escolha, nunca
        // troca sozinha: o passo 2 pergunta (pendência 2).
        setEscolha((atual) => {
          if (atual !== null) return atual;
          const c = conferirEmitente(r.nota.emitente, null, fornecedoresRef.current);
          return c.tipo === "achou" ? { tipo: "existente", fornecedor: c.fornecedor } : null;
        });
      }
    } catch {
      setNota(null);
      setArquivoErrado(true);
    } finally {
      setLendoNota(false);
      setPasso((p) => (p < 2 ? 2 : p));
    }
  }, []);

  // ── A6 · planilha ──
  async function abrirPlanilha() {
    const arquivo = await escolherArquivo(".xlsx,.xls,.csv,.tsv,.txt");
    if (!arquivo) return;
    try {
      const leitura = await lerArquivoPlanilha(arquivo);
      const r = itensDaPlanilha(leitura.matrix);
      if (!r.ok) throw new Error("ilegivel");
      setPlanilha({ nome: arquivo.name, itens: r.itens });
      setPlanilhaIlegivel(false);
      setNota(null);
      setArquivoErrado(false);
      setOrigem("planilha");
    } catch {
      setPlanilha(null);
      setPlanilhaIlegivel(true);
    }
  }

  function escolherFornecedor(f: FornecedorDaLista) {
    setEscolha({ tipo: "existente", fornecedor: f });
  }

  function aoSalvarFornecedor(s: Supplier) {
    qc.invalidateQueries({ queryKey: ["suppliers", companyId] });
    setEscolha({ tipo: "existente", fornecedor: s as FornecedorDaLista });
    setNovoFornecedor(null);
    if (passo === 1) setPasso(2);
  }

  function aoUsarExistente(e: { id: string; name: string }) {
    const daLista = fornecedores.find((f) => f.id === e.id);
    setEscolha({ tipo: "existente", fornecedor: daLista || ({ id: e.id, name: e.name, cnpj: null } as FornecedorDaLista) });
    setNovoFornecedor(null);
    if (passo === 1) setPasso(2);
  }

  // ── Passo 2 · nota de outro CNPJ (pendência 2) e nota repetida (B3) ──
  const chaveDaNota = nota ? (nota.chave || nota.numero + "|" + (nota.emitente.cnpj || "")) : "";
  const ehPlanilha = origem === "planilha" && !!planilha;
  const chaveDaFonte = ehPlanilha ? "planilha|" + planilha!.nome + "|" + planilha!.itens.length : chaveDaNota;
  const chaveDaEscolha = escolha === null ? "nada" : escolha.tipo === "sem" ? "sem" : escolha.fornecedor.id;
  const respostaAtual = chaveDaNota + "|" + chaveDaEscolha;
  const conferencia = nota && !arquivoErrado ? conferirEmitente(nota.emitente, escolha, fornecedores) : { tipo: "ok" as const };
  // A lista chegou depois da nota (atalho do passo 1): a Aura acha pelo CNPJ.
  const achouId = conferencia.tipo === "achou" ? conferencia.fornecedor.id : null;
  useEffect(() => {
    if (conferencia.tipo === "achou") setEscolha({ tipo: "existente", fornecedor: conferencia.fornecedor });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achouId]);
  const pergunta: PerguntaDoCnpj | null = conferencia.tipo === "perguntar" && cnpjRespondido !== respostaAtual
    ? { atual: conferencia.atual, achado: conferencia.achado }
    : null;

  const consultaNota = passo === 2 && escolha !== null && !pergunta ? consultaDaNota(nota, escolha) : null;
  const { data: dadosRepetida, isLoading: procurandoRepetida } = useQuery({
    queryKey: ["stock-receipts-nota", companyId, consultaNota?.nfe_key, consultaNota?.invoice_number, consultaNota?.supplier_id],
    queryFn: () => estoqueEntradasApi.notaJaLancada(companyId, consultaNota!),
    enabled: visible && !!consultaNota,
    staleTime: 30_000,
    retry: false,
  });
  // Consulta que falhou não trava ninguém: sem resposta, sem aviso.
  const anterior = consultaNota ? entradaAnteriorDaNota(dadosRepetida) : null;
  const repetidaPendente = !!anterior && repetidaVista !== respostaAtual;

  // ── Passo 3 · conferência (A4a) ──
  // Outra nota: decisões e ajustes da anterior não valem mais.
  useEffect(() => {
    setDecisoes({});
    setAjustes({});
    setMostrarTodas(false);
  }, [chaveDaFonte]);
  const fornecedorId = escolha && escolha.tipo === "existente" ? escolha.fornecedor.id : null;
  const { data: dadosCodigos, isLoading: carregandoCodigos } = useQuery({
    queryKey: ["supplier-codes", companyId, fornecedorId],
    queryFn: () => estoqueEntradasApi.codigosDoFornecedor(companyId, fornecedorId!),
    enabled: visible && passo === 3 && !!fornecedorId,
    staleTime: 60_000,
    retry: false,
  });
  const codigos = fornecedorId ? (dadosCodigos?.map || null) : null;
  const indice = useMemo(() => indexarProdutos(products), [products]);
  const linhas = useMemo(
    () => {
      const itens = ehPlanilha ? planilha!.itens : nota ? nota.itens : [];
      return itens.map((item) => conferirLinha(item, {
        indice, codigos, decisao: decisoes[item.n], ajuste: ajustes[item.n], semCusto,
      }));
    },
    [nota, planilha, ehPlanilha, indice, codigos, decisoes, ajustes, semCusto],
  );
  const resumo = useMemo(() => resumirConferencia(linhas, !ehPlanilha && nota ? nota.totalDosProdutos : null), [linhas, nota, ehPlanilha]);
  const motivo = motivoDoRodape(linhas, resumo);
  // A5: a lista digitada.
  const ehDigitar = origem === "digitar";
  const digitada = useMemo(() => conferirDigitadas(digitadas, indice.porId, semCusto), [digitadas, indice, semCusto]);
  const podeDarEntrada = ehDigitar ? digitada.podeDarEntrada : resumo.podeDarEntrada;
  const quantasEntram = ehDigitar ? digitada.itens.length : resumo.entram;

  function decidir(n: number, d: DecisaoDaLinha | null) {
    setDecisoes((atual) => {
      const novo = { ...atual };
      if (d) novo[n] = d; else delete novo[n];
      return novo;
    });
  }
  function aplicarMargem(pct: number) {
    setMargemDosNovos(pct);
    const custos: Record<number, number> = {};
    for (const l of linhas) custos[l.item.n] = l.custo;
    setDecisoes((atual) => aplicarMargemAosNovos(atual, custos, pct));
  }
  function ajustar(n: number, a: Partial<AjusteDaLinha>) {
    setAjustes((atual) => ({ ...atual, [n]: { ...(atual[n] || {}), ...a } }));
    setErrosDasLinhas((atual) => {
      if (!atual[n]) return atual;
      const b = { ...atual };
      delete b[n];
      return b;
    });
  }

  // ── A7 · gravar ──
  function invalidarDepoisDaEntrada() {
    for (const k of ["products", "productsAggregated", "stock-receipts-nota", "supplier-codes", "product-suppliers", "product-purchases", "estoque-consulta-variantes"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
    qc.invalidateQueries({ queryKey: ["suppliers", companyId] });
  }

  async function darEntrada() {
    if (!podeDarEntrada || gravando) return;
    setErrosDasLinhas({});
    let itens = ehDigitar ? digitada.itens : itensDaConferencia(linhas, semCusto);
    if (!itens.length) return;
    setGravando({ feitos: 0, total: itens.length });
    const rv = await resolverVariantes(itens, (pid) => companiesApi.variants(companyId, pid));
    if (rv.semVariante.length) {
      setGravando(null);
      setAjustes((atual) => {
        const b = { ...atual };
        for (const n of rv.semVariante) b[n] = { ...(b[n] || {}), forcarGrade: true };
        return b;
      });
      setErrosDasLinhas(Object.fromEntries(rv.semVariante.map((n) => [n, T.erroVariante])));
      toast.error(T.erroVariante);
      return;
    }
    itens = rv.itens;
    const partes = montarCorpos(itens, {
      chave,
      origem: ehDigitar ? "digitar" : ehPlanilha ? "planilha" : "nota",
      fornecedorId,
      numeroDaNota: ehDigitar ? numeroDigitado.trim() || null : !ehPlanilha && nota ? nota.numero || null : null,
      chaveDaNota: ehDigitar || ehPlanilha ? null : nota ? nota.chave : null,
      usarMedio,
    });
    const total = itens.length;
    const r = await gravarEntrada(
      partes,
      (corpo) => estoqueEntradasApi.darEntrada(companyId, corpo),
      (feitos) => setGravando({ feitos, total }),
    );
    setGravando(null);
    if (r.ok) {
      setRespostas(r.respostas);
      setFalha(null);
      setPendentes([]);
      setPasso(4);
      invalidarDepoisDaEntrada();
      onFeito?.(r.respostas);
      return;
    }
    if (r.itensFeitos > 0) {
      // Parte entrou: o que entrou fica; o resto espera "Dar entrada nos y".
      setRespostas(r.respostas);
      setFalha({ feitos: r.itensFeitos, total });
      setPendentes(itens.slice(r.itensFeitos));
      setPasso(4);
      invalidarDepoisDaEntrada();
      onFeito?.(r.respostas);
      return;
    }
    const e: any = r.erro;
    const code = e && e.data && e.data.code;
    if (e && e.status === 400 && code === "LINHAS_COM_ERRO") {
      setErrosDasLinhas(errosPorLinha(e, r.parteComErro));
      toast.error(T.erroLinhas);
    } else if (e && e.status === 403 && code === "LIMITE_DO_PLANO") {
      toast.error(T.erroLimite(Number(e.data.limit) || 0));
    } else if (e && e.status === 503) {
      toast.error(T.erroIndisponivel);
    } else if (deveRepetir(e)) {
      toast.error(T.erroSemResposta);
    } else {
      toast.error((e && e.message) || T.erroGenerico);
    }
  }

  function baixarPendentes() {
    if (typeof document === "undefined" || !pendentes.length) return;
    try {
      const blob = new Blob(["\uFEFF" + csvDosQueFaltam(pendentes)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chegou-mercadoria-faltam.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  }

  function usarAchado(f: FornecedorDaLista) {
    setEscolha({ tipo: "existente", fornecedor: f });
  }
  function manterFornecedor() {
    const mantida: EscolhaDoFornecedor = escolha ?? { tipo: "sem" };
    setEscolha(mantida);
    setCnpjRespondido(chaveDaNota + "|" + (mantida.tipo === "sem" ? "sem" : mantida.fornecedor.id));
  }
  function cadastrarEmitente() {
    if (!nota) return;
    setNovoFornecedor({
      inicial: { ...FORM_VAZIO, name: nota.emitente.nome || "", cnpj: nota.emitente.cnpj || "", phone: nota.emitente.telefone || "" },
    });
  }

  // ── Navegação ──
  const podeContinuar = passo === 1
    ? escolha !== null
    : passo === 2
      ? ehPlanilha || !!nota && !arquivoErrado && !lendoNota && escolha !== null && !pergunta && !repetidaPendente && !(consultaNota && procurandoRepetida)
      : false;

  function continuar() {
    if (!podeContinuar) return;
    setPasso((p) => (Math.min(4, p + 1) as Passo));
  }
  function voltar() {
    setPasso((p) => (Math.max(1, p - 1) as Passo));
  }

  const temProgresso = passo < 4 && (!!nota || !!planilha || passo >= 3);
  const pedirFechar = () => {
    if (gravando) return;
    if (temProgresso) setPerguntaSair(true);
    else onClose();
  };

  // Esc: pergunta aberta → fica; formulário aberto → volta para a lista;
  // senão, o mesmo caminho do X. Janela de diálogo por cima: o Esc é dela.
  const novoAberto = !!novoFornecedor;
  const escRef = useRef({ pedirFechar, perguntaSair, novoAberto });
  escRef.current = { pedirFechar, perguntaSair, novoAberto };
  useEffect(() => {
    if (!visible || !IS_WEB || typeof window === "undefined") return;
    function aoTecla(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
      if (dialogoAbertoNaTela()) return;
      e.preventDefault();
      if (escRef.current.perguntaSair) setPerguntaSair(false);
      else if (escRef.current.novoAberto) setNovoFornecedor(null);
      else escRef.current.pedirFechar();
    }
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [visible]);

  if (!visible) return null;

  // Pendência 4: Matcon segue pelo modal de hoje, sem mudança.
  if (danfeMatcon) {
    return (
      <WebPortal active={visible}>
        <DanfeImportModal
          visible
          companyId={companyId}
          onClose={() => { setDanfeMatcon(false); onClose(); }}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ["products"] }); }}
        />
      </WebPortal>
    );
  }

  // ── Barra de passos ──
  const nomeFornecedor = nomeDaEscolha(escolha);
  function rotuloDoPasso(n: Passo): string {
    if (passo > n && n === 1 && nomeFornecedor) return T.passoFeitoFornecedor(nomeFornecedor);
    if (passo > n && n === 2 && ehDigitar) return T.passoFeitoDigitar;
    if (passo > n && n === 2 && ehPlanilha) return T.passoFeitoPlanilha;
    if (passo > n && n === 2 && nota && nota.numero) return T.passoFeitoNota(nota.numero);
    return T.passos[n];
  }

  // ── Rodapé ──
  let rodapeInfo = "";
  if (passo === 1) {
    rodapeInfo = escolha === null
      ? T.rodapeSemEscolha
      : escolha.tipo === "sem" ? T.rodapeSemFornecedor : T.rodapeFornecedor(escolha.fornecedor.name);
  } else if (passo === 2) {
    rodapeInfo = T.rodapePdf;
  } else if (passo === 3 && ehDigitar) {
    rodapeInfo = digitada.faltam > 0
      ? T.digitarFaltam(digitada.faltam)
      : T.digitarRodape(digitada.itens.length, semCusto || !digitada.total ? null : "R$ " + digitada.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  } else if (passo === 3) {
    rodapeInfo =
      motivo.tipo === "faltam" ? (estreito ? T.rodapeFaltaCelular(motivo.n) : T.rodapeFaltam(motivo.n))
        : motivo.tipo === "falta_ligar" ? (estreito ? T.rodapeFaltaCelular(1) : T.rodapeFaltaLigar(motivo.nome))
          : motivo.tipo === "falta_grade" ? (estreito ? T.rodapeFaltaCelular(1) : T.rodapeFaltaGrade(motivo.nome))
            : motivo.tipo === "nada" ? T.rodapeNada
              : ehPlanilha ? T.planilhaLida(planilha!.nome, planilha!.itens.length)
                : nota ? T.resumoNota(nota.numero || "—", diaMes(nota.emitidaEm)) : "";
  }
  const rodapeTravado = passo === 3 && (ehDigitar ? digitada.faltam > 0 : resumo.falta > 0);
  const pronto = respostas ? resumoDoPronto(respostas) : null;
  if (passo === 4) rodapeInfo = falha ? "" : T.prontoSemDobro;
  if (gravando) rodapeInfo = T.gravandoTitulo;
  const idsNovos = (respostas || []).flatMap((r) => (r.lines || []).filter((l) => l.created).map((l) => l.product_id));
  const fora = ehDigitar ? [] : linhas
    .filter((l) => l.estado === "fora" || l.estado === "erro")
    .map((l) => ({ nome: l.item.descricao, motivo: l.estado === "erro" ? T.motivoQtdZero : T.motivoFora }));

  const painelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : { backgroundColor: Colors.bg3 };

  return (
    <WebPortal active={visible}>
      <View style={[s.overlay, estreito && s.overlayEstreito]} testID="chegou-mercadoria">
        <Pressable style={s.fundo} onPress={pedirFechar} accessibilityLabel={T.fechar} />
        <View style={[s.painel, estreito && s.painelEstreito, painelWeb as any]}>

          <View style={s.cabecalho}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <View style={s.cabecalhoIco}><Icon name="truck" size={16} color={Colors.violet3} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.titulo}>{T.titulo}</Text>
                <Text style={s.subtitulo} numberOfLines={1} testID="chegou-loja">
                  {lojaNome ? (estreito ? lojaNome : T.subtitulo(lojaNome)) : T.subtituloSemLoja}
                </Text>
              </View>
            </View>
            <Pressable onPress={pedirFechar} style={s.fechar} accessibilityLabel={T.fechar} testID="chegou-fechar">
              <Icon name="x" size={16} color={Colors.ink3} />
            </Pressable>
          </View>

          {estreito ? (
            <View style={s.barraCelular}>
              <Text style={s.barraCelularTxt} testID="chegou-passo-celular">{T.passoCelular(passo, T.passos[passo])}</Text>
            </View>
          ) : (
            <View style={s.barra} testID="chegou-barra-passos">
              {([1, 2, 3, 4] as const).map((n, i) => {
                const feito = passo > n;
                const ativo = passo === n;
                return (
                  <View key={n} style={s.passoItem}>
                    <View style={[s.bolinha, feito && s.bolinhaFeita, ativo && s.bolinhaAtiva]}>
                      {feito
                        ? <Icon name="check" size={10} color="#fff" />
                        : <Text style={[s.bolinhaTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                    </View>
                    <Text
                      style={[s.passoRotulo, (ativo || feito) && { color: ativo ? Colors.violet3 : Colors.ink2, fontWeight: ativo ? "700" : "500" }]}
                      numberOfLines={1}
                    >
                      {rotuloDoPasso(n)}
                    </Text>
                    {i < 3 && <View style={[s.separador, feito && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
                  </View>
                );
              })}
            </View>
          )}

          {novoFornecedor && (
            <ScrollView style={s.corpo} contentContainerStyle={s.corpoConteudo} keyboardShouldPersistTaps="handled">
              <Pressable onPress={() => setNovoFornecedor(null)} style={s.voltarLista} accessibilityRole="button" testID="chegou-voltar-lista">
                <Icon name="chevron_left" size={14} color={Colors.violet3} />
                <Text style={s.voltarListaTxt}>{T.voltarParaLista}</Text>
              </Pressable>
              <FornecedorFormSheet
                visible
                companyId={companyId}
                supplier={null}
                inicial={novoFornecedor.inicial}
                onClose={() => setNovoFornecedor(null)}
                onSalvo={aoSalvarFornecedor}
                onAbrirExistente={() => {}}
                noPasso={{
                  rotuloSalvar: T.novoSalvar,
                  rotuloVoltar: T.voltar,
                  rotuloUsar: T.usarExistente,
                  rodape: T.novoRodape,
                  rodapeExistente: T.existenteRodape,
                  onVoltar: () => setNovoFornecedor(null),
                  onUsarExistente: aoUsarExistente,
                }}
              />
            </ScrollView>
          )}

          <ScrollView
            // Escondido, não desmontado, com o formulário aberto: a busca fica no lugar.
            style={[s.corpo, novoAberto && s.escondido]}
            contentContainerStyle={s.corpoConteudo}
            keyboardShouldPersistTaps="handled"
          >
            {passo === 1 && (
              <Passo1Fornecedor
                fornecedores={fornecedores}
                carregando={carregandoFornecedores}
                erro={erroFornecedores}
                escolha={escolha}
                estreito={estreito}
                lendoNota={lendoNota}
                onEscolher={escolherFornecedor}
                onSemFornecedor={() => { setEscolha({ tipo: "sem" }); setPasso(2); }}
                onNovoFornecedor={() => setNovoFornecedor({ inicial: null })}
                onTenhoANota={abrirNota}
              />
            )}
            {gravando ? (
              <View style={s.gravando} testID="chegou-gravando">
                <ActivityIndicator size="small" color={Colors.violet3} />
                <Text style={s.gravandoTitulo}>{T.gravandoTitulo}</Text>
                <Text style={s.gravandoTexto}>{T.gravandoTexto(gravando.feitos, gravando.total)}</Text>
              </View>
            ) : null}
            {passo === 4 && pronto && !gravando && (
              <Passo4Pronto
                estreito={estreito}
                semCusto={semCusto}
                numeroDaNota={ehDigitar ? numeroDigitado.trim() || null : !ehPlanilha && nota ? nota.numero || null : null}
                resumo={pronto}
                fora={fora}
                falha={falha}
                onRepetir={darEntrada}
                onBaixar={IS_WEB ? baixarPendentes : undefined}
              />
            )}
            {passo === 3 && ehDigitar && !gravando && (
              <Passo3Digitar
                estreito={estreito}
                semCusto={semCusto}
                companyId={companyId}
                produtos={products}
                porId={indice.porId}
                linhas={digitadas}
                onMudar={(ls) => { setDigitadas(ls); setErrosDasLinhas({}); }}
                numeroDaNota={numeroDigitado}
                onNumeroDaNota={setNumeroDigitado}
                errosDasLinhas={errosDasLinhas}
              />
            )}
            {passo === 3 && !ehDigitar && (ehPlanilha || nota) && !gravando && (
              <Passo3Conferir
                estreito={estreito}
                semCusto={semCusto}
                companyId={companyId}
                titulo={ehPlanilha ? T.planilhaLida(planilha!.nome, planilha!.itens.length) : T.resumoNota(nota!.numero || "—", diaMes(nota!.emitidaEm))}
                totalEsperado={ehPlanilha ? null : nota!.totalDosProdutos}
                fonte={ehPlanilha ? "planilha" : "nota"}
                produtos={products}
                comFornecedor={!!fornecedorId}
                margemDosNovos={margemDosNovos}
                onAplicarMargem={aplicarMargem}
                linhas={linhas}
                resumo={resumo}
                carregando={!!fornecedorId && carregandoCodigos}
                mostrarTodas={mostrarTodas}
                onMostrarTodas={() => setMostrarTodas(true)}
                usarMedio={usarMedio}
                onUsarMedio={setUsarMedio}
                onDecidir={decidir}
                onAjustar={ajustar}
                errosDasLinhas={errosDasLinhas}
                novoPara={(l) => decisaoDeNovo({ ...l.item, custoUnitario: l.custo }, semCusto, margemDosNovos)}
              />
            )}
            {passo === 2 && (
              <Passo2Origem
                estreito={estreito}
                nota={nota}
                arquivoErrado={arquivoErrado}
                lendoNota={lendoNota}
                pergunta={pergunta}
                anterior={repetidaPendente ? anterior : null}
                onNota={abrirNota}
                onUsarAchado={usarAchado}
                onCadastrarEmitente={cadastrarEmitente}
                onManter={manterFornecedor}
                onSeguirMesmoAssim={() => setRepetidaVista(respostaAtual)}
                onDigitar={() => { setOrigem("digitar"); setPasso(3); }}
                planilha={ehPlanilha ? { nome: planilha!.nome, itens: planilha!.itens.length } : null}
                planilhaIlegivel={planilhaIlegivel}
                onPlanilha={abrirPlanilha}
                onBaixarModelo={IS_WEB ? baixarModeloDeEntrada : undefined}
              />
            )}
          </ScrollView>

          {!novoAberto && (
            <View style={[s.rodape, estreito && s.rodapeEstreito]}>
              {rodapeTravado ? (
                <View style={s.rodapeTravado} testID="chegou-rodape-travado">
                  <Icon name="alert" size={15} color={Colors.amber} />
                  <Text style={s.rodapeTravadoTxt} numberOfLines={2} testID="chegou-rodape-info">{rodapeInfo}</Text>
                </View>
              ) : (
                <Text style={s.rodapeInfo} numberOfLines={2} testID="chegou-rodape-info">{rodapeInfo}</Text>
              )}
              <View style={s.rodapeAcoes}>
                {passo === 1 ? (
                  <Pressable style={s.btnSec} onPress={pedirFechar} testID="chegou-cancelar">
                    <Text style={s.btnSecTxt}>{T.cancelar}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={s.btnSec} onPress={voltar} testID="chegou-voltar">
                    <Text style={s.btnSecTxt}>{T.voltar}</Text>
                  </Pressable>
                )}
                {passo < 3 && (
                  <Pressable
                    style={[s.btnPri, !podeContinuar && { opacity: 0.45 }]}
                    onPress={podeContinuar ? continuar : undefined}
                    disabled={!podeContinuar}
                    accessibilityState={{ disabled: !podeContinuar }}
                    testID="chegou-continuar"
                  >
                    <Text style={s.btnPriTxt}>{T.continuar}</Text>
                  </Pressable>
                )}
                {passo === 3 && (
                  <Pressable
                    style={[s.btnConfirmar, (!podeDarEntrada || !!gravando) && { opacity: 0.45 }]}
                    onPress={podeDarEntrada && !gravando ? darEntrada : undefined}
                    disabled={!podeDarEntrada || !!gravando}
                    accessibilityState={{ disabled: !podeDarEntrada || !!gravando }}
                    testID="chegou-dar-entrada"
                  >
                    {gravando ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="check" size={14} color="#fff" />}
                    <Text style={s.btnPriTxt}>{estreito ? T.darEntradaCelular : T.darEntrada(quantasEntram)}</Text>
                  </Pressable>
                )}
                {passo === 4 && pronto && !falha && idsNovos.length > 0 && onVerNovos ? (
                  <Pressable style={s.btnSec} onPress={() => onVerNovos(idsNovos)} testID="chegou-ver-novos">
                    <Text style={s.btnSecTxt}>{estreito ? T.verNovosCelular : T.verNovos}</Text>
                  </Pressable>
                ) : null}
                {passo === 4 && (
                  <Pressable style={s.btnPri} onPress={onClose} disabled={!!gravando} testID="chegou-fechar-pronto">
                    <Text style={s.btnPriTxt}>{T.fechar}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>

        {perguntaSair && (
          <View style={s.sairFundo}>
            <View style={s.sairCartao} testID="chegou-pergunta-sair">
              <Text style={s.sairTitulo}>{T.sairTitulo}</Text>
              <Text style={s.sairTexto}>{T.sairTexto}</Text>
              <View style={s.sairAcoes}>
                <Pressable style={s.sairFicar} onPress={() => setPerguntaSair(false)} testID="chegou-sair-ficar">
                  <Text style={s.sairFicarTxt}>{T.sairFicar}</Text>
                </Pressable>
                <Pressable style={s.sairSair} onPress={() => { setPerguntaSair(false); onClose(); }} testID="chegou-sair-sair">
                  <Text style={s.sairSairTxt}>{T.sairSair}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </WebPortal>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 20,
  },
  overlayEstreito: { padding: 0, justifyContent: "flex-end" },
  fundo: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  painel: { width: "100%", maxWidth: 1040, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  painelEstreito: { maxHeight: "100%", height: "100%", borderRadius: 0 },
  cabecalho: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  cabecalhoIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  subtitulo: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  fechar: {
    width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border,
  },
  barra: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6,
    paddingHorizontal: 22, paddingVertical: 14,
    backgroundColor: IS_DARK_MODE ? "rgba(0,0,0,0.18)" : Colors.bg4,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)",
  },
  barraCelular: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: IS_DARK_MODE ? "rgba(0,0,0,0.18)" : Colors.bg4,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)",
  },
  barraCelularTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  passoItem: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 260 },
  bolinha: {
    width: 24, height: 24, borderRadius: 999, alignItems: "center", justifyContent: "center", flexShrink: 0,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  bolinhaAtiva: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  bolinhaFeita: { backgroundColor: "#059669", borderColor: "#059669" },
  bolinhaTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  passoRotulo: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500", flexShrink: 1 },
  separador: { width: 24, height: 1.5, backgroundColor: Colors.border2, marginHorizontal: 4 },
  corpo: { flex: 1 },
  gravando: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 12 },
  gravandoTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  gravandoTexto: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18, textAlign: "center", maxWidth: 460 },
  escondido: { display: "none" },
  corpoConteudo: { padding: 22, paddingBottom: 12 },
  voltarLista: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, alignSelf: "flex-start" },
  voltarListaTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  rodape: {
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: IS_DARK_MODE ? "rgba(0,0,0,0.18)" : Colors.bg4,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  rodapeEstreito: { paddingHorizontal: 16, flexWrap: "wrap" },
  rodapeInfo: { flex: 1, minWidth: 160, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  rodapeAcoes: { flexDirection: "row", gap: 8, flexShrink: 0 },
  rodapeTravado: { flex: 1, minWidth: 160, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rodapeTravadoTxt: { flex: 1, fontSize: 13, color: Colors.amber, fontWeight: "700", lineHeight: 18 },
  btnConfirmar: {
    backgroundColor: "#059669", minHeight: 44, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnPri: {
    backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  sairFundo: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24,
  },
  sairCartao: { width: "100%", maxWidth: 380, borderRadius: 16, padding: 22, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2 },
  sairTitulo: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  sairTexto: { fontSize: 13, color: Colors.ink2, lineHeight: 19, marginBottom: 18 },
  sairAcoes: { flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  sairFicar: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet },
  sairFicarTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  sairSair: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red },
  sairSairTxt: { fontSize: 13, fontWeight: "700", color: Colors.red },
});

export default ChegouMercadoriaModal;
