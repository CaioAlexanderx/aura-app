// ============================================================
// AURA. — Estoque · ItemFormModal (cadastro aberto de item)
//
// 09/09/2026 — SUBSTITUI O ItemWizardModal, QUE DUROU UM DIA.
//
// O wizard de três passos (#857/#858) estava certo no conteúdo e errado
// no formato. Em uso real, cadastrar ficou MAIS LENTO: três telas, um
// clique entre cada, o produto nascendo no meio do caminho e os
// complementos só depois. E editar não tinha fluxo nenhum — abrir um
// produto pronto num wizard de "passos a concluir" é responder perguntas
// que já têm resposta.
//
// Agora é UMA tela. Tudo à vista, nada bloqueia, um botão só: Salvar.
// Mockup aprovado: Aura/mockup_cadastro_item_v4_aberto.html (v4).
//
// AS TRÊS DECISÕES QUE FAZEM ISSO FUNCIONAR:
//
//   1. UM SALVAR. Os campos ficam em memória e vão num POST (cadastro) ou
//      num PATCH (edição) só. Acabou o auto-save campo a campo do wizard,
//      com "Salvo" piscando a cada blur. O rodapé diz, em uma linha, o
//      que ainda impede o Salvar — nome e preço, só.
//
//   2. A GRADE DE ESTOQUE É LOCAL nos dois modos e vai inteira no PUT
//      /variations do Salvar. Assim o mesmo componente serve ao cadastro
//      (onde o produto ainda não existe) e à edição.
//
//   3. AS FOTOS DO CADASTRO ENTRAM NUMA FILA. Sem id não há upload, então
//      a escolhida fica em memória (base64) e sobe logo depois do POST,
//      uma de cada vez, com "Subindo fotos 2 de 5" no rodapé. A fila roda
//      a partir de um ref: fechar o modal no meio não cancela nada, e
//      falha de uma foto não derruba as outras — vira toast no fim.
//      Na EDIÇÃO a foto continua subindo na hora (o produto existe; fazer
//      a lojista clicar em Salvar pra ver a foto aparecer seria mentira).
//
// Shell copiado do TrocaModal (DNA canônica de modal, CLAUDE.md).
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Platform, Dimensions,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { companiesApi } from "@/services/api";
import { nfceApi } from "@/services/nfceApi";
import { productImagesApi } from "@/services/productImagesApi";
import { productsVariationsApi, matrixKey, type MatrixMap } from "@/services/productsVariationsApi";
import { hexToName } from "@/utils/colorNames";
import type { CategorySelection } from "@/components/catalog/CategoryTreePicker";
import { IS_WEB, webOnly } from "@/components/screens/pdv/types";
import type { Product } from "./types";
import { SecaoItem, type DuplicataRow } from "./item-form/SecaoItem";
import { SecaoPreco } from "./item-form/SecaoPreco";
import { SecaoEstoque } from "./item-form/SecaoEstoque";
import { SecaoDescricao } from "./item-form/SecaoDescricao";
import { SecaoFotos } from "./item-form/SecaoFotos";
import { SecaoCodigos } from "./item-form/SecaoCodigos";
import { CategoriaSheet, useBreadcrumbLabel } from "./item-form/CategorySelector";
import { useGaleriaDoProduto } from "./item-form/GaleriaDeFotos";
import {
  capaDa, chaveDaCor, duracaoParaMinutos, gerarCodigoServico, gravarUltimaCategoria,
  lerDuracaoDoServico, lerUltimaCategoria, mascaraDeValor, matrizDaGrade, motivosQueBloqueiam,
  nomeDoTipo, ordenarFilaDeFotos, preservarValores, resumoDoItem, rotuloDoBotaoSalvar,
  rotuloDoProgresso, subtituloDoModal, textoDeEdicao, textoDoBloqueio, tituloDoModal,
  usaDuasColunas, valorDaMascara,
  type CorDoItem, type FotoPendente, type ItemType, type StockMode,
} from "./item-form/types";

const VAZIO: CategorySelection = { primaryCategoryId: null, alsoInIds: [] };

// A largura manda no layout inteiro: duas colunas no desktop, uma coluna
// em folha de baixo abaixo de 900 (e sempre no nativo).
function useLarguraDaJanela(): number {
  const [w, setW] = useState(
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.innerWidth
      : Dimensions.get("window").width
  );
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  initialType?: ItemType;
  editProduct?: Product | null;
  onSaved?: () => void;
};

export function ItemFormModal({ visible, onClose, initialType = "product", editProduct, onSaved }: Props) {
  const largura = useLarguraDaJanela();
  const duasColunas = usaDuasColunas(largura, IS_WEB);
  const narrow = !duasColunas;

  const qc = useQueryClient();
  const { company } = useAuthStore();
  const { products, addProduct, updateProduct } = useProducts();
  const { byId: categoriaPorId, assignProductCategories } = useCategories();
  const breadcrumbLabel = useBreadcrumbLabel();

  // Alvo da edição: vem da prop, mas o banner de duplicata pode TROCAR
  // pra edição do produto que já existe sem fechar o modal.
  const [alvo, setAlvo] = useState<Product | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const [type, setType] = useState<ItemType>(initialType);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [stockMode, setStockMode] = useState<StockMode>("single");
  const [estoqueTxt, setEstoqueTxt] = useState("");
  const [minimoTxt, setMinimoTxt] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [material, setMaterial] = useState("");
  const [medidas, setMedidas] = useState("");
  const [cuidados, setCuidados] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [ncm, setNcm] = useState("");
  const [cores, setCores] = useState<CorDoItem[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [celulas, setCelulas] = useState<Record<string, string>>({});
  const [barras, setBarras] = useState<Record<string, string>>({});
  const [gradeSuja, setGradeSuja] = useState(false);

  const [selecao, setSelecao] = useState<CategorySelection>(VAZIO);
  const [legado, setLegado] = useState("");
  const [ultimaUsada, setUltimaUsada] = useState(false);
  const [categoriaSuja, setCategoriaSuja] = useState(false);
  const [catSheet, setCatSheet] = useState(false);

  const [duplicatas, setDuplicatas] = useState<DuplicataRow[]>([]);
  const [dupDispensada, setDupDispensada] = useState(false);

  const [pendentes, setPendentes] = useState<FotoPendente[]>([]);
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const modoEdicao = !!alvo;
  const productId = alvo?.id || null;
  const isProduto = type === "product";

  const filaRef = useRef<FotoPendente[]>([]);
  const panelRef = useRef<any>(null);
  // Trava SÍNCRONA do Salvar. No web o Enter chega por dois caminhos (o
  // listener de teclado do painel e o onSubmitEditing do campo) e
  // `salvando` só existe no render seguinte — sem este ref, um Enter
  // criaria o produto duas vezes.
  const salvandoRef = useRef(false);

  // ── config fiscal: a empresa emite NFC-e? ────────────────
  const { data: nfceCfg } = useQuery({
    queryKey: ["nfce-config", company?.id],
    queryFn: () => nfceApi.getConfig(company!.id),
    enabled: !!company?.id && visible,
    staleTime: 300_000,
    retry: 1,
  });
  const emiteNota = !!(nfceCfg as any)?.config?.is_active;

  // ── variações do item em edição ──────────────────────────
  const { data: variacoes } = useQuery({
    queryKey: ["productVariations", company?.id, productId],
    queryFn: () => productsVariationsApi.get(company!.id, productId!),
    enabled: !!company?.id && !!productId && visible,
    staleTime: 30000,
  });
  const variacoesRef = useRef<any>(null);
  useEffect(() => { variacoesRef.current = variacoes || null; }, [variacoes]);

  const hidratou = useRef(false);
  useEffect(() => { hidratou.current = false; }, [productId]);
  useEffect(() => {
    if (!variacoes || hidratou.current) return;
    hidratou.current = true;
    const cs: CorDoItem[] = (variacoes.colors || []).map((c) => ({
      hex: (c.hex || "").toUpperCase(),
      name: c.name || hexToName(c.hex) || c.hex,
    }));
    const zs = variacoes.sizes || [];
    if (!cs.length && !zs.length) return;
    setCores(cs);
    setTamanhos(zs);
    setStockMode("variants");
    // A grade nasce com o que está no banco e daí em diante é local: só
    // o Salvar a manda de volta.
    const cel: Record<string, string> = {};
    Object.keys(variacoes.matrix || {}).forEach((k) => { cel[k] = String((variacoes.matrix || {})[k] ?? 0); });
    setCelulas(cel);
    setBarras({ ...(variacoes.barcodes || {}) });
    setGradeSuja(false);
  }, [variacoes]);

  // ── galeria (só existe com produto persistido) ───────────
  const galeria = useGaleriaDoProduto(productId);
  const capaDoServidor = capaDa(galeria.principal)?.url || null;
  const primeiraPendente = pendentes.find((f) => f.corHex == null);
  const capaUrl = modoEdicao
    ? capaDoServidor
    : (primeiraPendente ? "data:" + primeiraPendente.contentType + ";base64," + primeiraPendente.base64 : null);

  // ── semear / limpar ──────────────────────────────────────
  const semear = useCallback((prod: Product | null, tipo: ItemType) => {
    const t: ItemType = prod ? (prod.unit === "srv" ? "service" : "product") : tipo;
    setAlvo(prod);
    setType(t);
    setNome(prod?.name || "");
    setPreco(prod ? mascaraDeValor(prod.price) : "");
    setCusto(prod ? mascaraDeValor(prod.cost) : "");
    setUnidade(prod && prod.unit && prod.unit !== "srv" ? prod.unit : "un");
    setEstoqueTxt(prod ? String(prod.stock) : "");
    setMinimoTxt(prod ? String(prod.minStock) : "");
    const bruto = prod?.notes || "";
    if (t === "service") {
      // A coluna manda; sem coluna, o sufixo antigo da descrição é lido e
      // migra na próxima gravação. Um sufixo que não vira número
      // ("meio período") FICA na descrição — migrar apagando o que ela
      // escreveu seria pior que não migrar.
      const d = lerDuracaoDoServico(bruto, prod?.durationMinutes ?? null);
      setDescricao(d.descricao);
      setDuracao(d.duracaoTxt);
    } else {
      setDescricao(bruto);
      setDuracao("");
    }
    setMaterial((prod as any)?.material || "");
    setMedidas((prod as any)?.medidas || "");
    setCuidados((prod as any)?.cuidados || "");
    setSku(prod && prod.code && prod.code !== "---" ? prod.code : "");
    setBarcode(prod?.barcode || "");
    setNcm(prod?.ncm || "");
    setCores([]);
    setTamanhos([]);
    setCelulas({});
    setBarras({});
    setGradeSuja(false);
    setStockMode(prod?.has_variants ? "variants" : "single");
    hidratou.current = false;
    setDuplicatas([]);
    setDupDispensada(false);
    setPendentes([]);
    setProgresso(null);
    setSujo(false);
    setCategoriaSuja(false);
    setCatSheet(false);
    setConfirmarSaida(false);

    if (prod) {
      setSelecao(VAZIO);
      setLegado(prod.category || "");
      setUltimaUsada(false);
    } else {
      const u = lerUltimaCategoria(company?.id, t);
      setSelecao(u ? { primaryCategoryId: u.primaryCategoryId, alsoInIds: u.alsoInIds } : VAZIO);
      setLegado(u?.legado || "");
      setUltimaUsada(!!u && (!!u.primaryCategoryId || !!u.legado));
    }
  }, [company?.id]);

  useEffect(() => {
    if (!visible) return;
    semear(editProduct || null, initialType);
    // Semeia UMA vez por abertura: o modal é dono do próprio estado
    // depois disso (salvar invalida a lista de produtos, e a prop
    // editProduct chegaria de volta sobrescrevendo o que está na tela).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── categoria ────────────────────────────────────────────
  const noEscolhido = selecao.primaryCategoryId ? categoriaPorId[selecao.primaryCategoryId] : null;
  const categoriaRotulo = selecao.primaryCategoryId
    ? (breadcrumbLabel(selecao.primaryCategoryId) || noEscolhido?.name || legado)
    : legado;
  const categoriaFinal = noEscolhido ? noEscolhido.name : (legado || (isProduto ? "Produtos" : "Servicos"));
  const categoriaEscolhida = noEscolhido ? noEscolhido.name : (legado || null);
  const categoriasLegado = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products]
  );

  // ── checagem de duplicata ────────────────────────────────
  useEffect(() => {
    const trimmed = nome.trim();
    if (!visible || modoEdicao || !isProduto || dupDispensada || trimmed.length < 2 || !company?.id) {
      setDuplicatas([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await companiesApi.checkDuplicate(company.id, trimmed);
        setDuplicatas((res.duplicates || []) as DuplicataRow[]);
      } catch (_) {
        setDuplicatas([]);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [nome, company?.id, visible, modoEdicao, isProduto, dupDispensada]);

  // ── o que impede salvar ──────────────────────────────────
  const precoNum = valorDaMascara(preco);
  const bloqueios = motivosQueBloqueiam({ nome, preco: precoNum, ncm, isProduto });
  const podeSalvar = bloqueios.length === 0 && !salvando;

  // ── montar o corpo do produto ────────────────────────────
  function montarProduto(id: string): Product {
    const temVariantes = isProduto && stockMode === "variants" && (cores.length > 0 || tamanhos.length > 0);
    return {
      id,
      name: nome.trim(),
      code: sku.trim() || (alvo?.code && alvo.code !== "---" ? alvo.code : "---"),
      barcode: barcode.trim(),
      category: categoriaFinal,
      price: precoNum,
      cost: valorDaMascara(custo),
      // Produto com variantes guarda o estoque NAS variantes (migration
      // que zerou products.stock_qty do pai). Reescrever o total aqui
      // ressuscitaria o estoque fantasma no pai.
      stock: isProduto && !temVariantes ? (parseInt(estoqueTxt, 10) || 0) : 0,
      minStock: isProduto ? (parseInt(minimoTxt, 10) || 0) : 0,
      unit: isProduto ? unidade : "srv",
      brand: alvo?.brand || "",
      // A descrição é só a descrição. A duração tem coluna própria desde
      // a migration 323 — e gravar aqui SEM o sufixo é o que tira o
      // "| Duração: 45 min" do serviço antigo na primeira gravação.
      notes: descricao.trim(),
      durationMinutes: isProduto ? undefined : duracaoParaMinutos(duracao),
      material: isProduto ? material.trim() : "",
      medidas: isProduto ? medidas.trim() : "",
      cuidados: isProduto ? cuidados.trim() : "",
      color: alvo?.color || "",
      size: alvo?.size || "",
      ncm: isProduto ? ncm : "",
    } as Product;
  }

  // ── gravações ────────────────────────────────────────────
  async function salvarVariacoes(id: string): Promise<boolean> {
    if (!company?.id) return false;
    try {
      const anterior = variacoesRef.current || {};
      const matriz: MatrixMap = matrizDaGrade(cores, tamanhos, celulas, anterior.matrix, matrixKey);
      const chaves = Object.keys(matriz);
      // Código de barras: o que está na tela vence; o que não está na
      // tela mas sobreviveu à mudança de cores/tamanhos é preservado.
      const guardados = preservarValores<string>(chaves, anterior.barcodes);
      const doForm: Record<string, string> = {};
      chaves.forEach((k) => { if ((barras[k] || "").trim()) doForm[k] = barras[k].trim(); });
      await productsVariationsApi.save(company.id, id, {
        colors: cores.map((c) => ({ hex: c.hex, name: c.name || null })),
        sizes: tamanhos,
        matrix: matriz,
        barcodes: { ...guardados, ...doForm },
      });
      qc.invalidateQueries({ queryKey: ["productVariations", company.id, id] });
      qc.invalidateQueries({ queryKey: ["products", company.id] });
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar cores e tamanhos");
      return false;
    }
  }

  function vincularCategoria(id: string) {
    if (!selecao.primaryCategoryId) return;
    try {
      assignProductCategories(id, {
        primary_category_id: selecao.primaryCategoryId,
        also_in: selecao.alsoInIds,
      });
    } catch (_) { /* o produto já existe; o vínculo vira pendência */ }
  }

  // A fila roda a partir do ref: fechar o modal no meio não cancela nada,
  // e uma foto que falha não derruba as outras — o toast conta no fim.
  async function subirFila(id: string) {
    const fila = ordenarFilaDeFotos(filaRef.current, cores.map((c) => c.hex));
    filaRef.current = [];
    if (!fila.length || !company?.id) { setProgresso(null); return; }
    let falhas = 0;
    for (let i = 0; i < fila.length; i++) {
      setProgresso({ feitas: i, total: fila.length });
      try {
        await productImagesApi.upload(company.id, id, {
          content: fila[i].base64,
          content_type: fila[i].contentType,
          color_hex: fila[i].corHex ? chaveDaCor(fila[i].corHex) : null,
        });
      } catch (_) {
        falhas++;
      }
    }
    setProgresso(null);
    qc.invalidateQueries({ queryKey: ["productImages", company.id, id] });
    qc.invalidateQueries({ queryKey: ["products", company.id] });
    if (falhas > 0) {
      toast.error(falhas === 1
        ? "Uma foto não subiu. Abra o item e tente de novo."
        : falhas + " fotos não subiram. Abra o item e tente de novo.");
    }
  }

  async function salvar(cadastrarOutro: boolean) {
    if (!podeSalvar || salvandoRef.current) return;
    salvandoRef.current = true;
    setSalvando(true);
    try {
      if (modoEdicao) {
        const ok = await updateProduct(montarProduto(alvo!.id));
        if (!ok) return;
        if (isProduto && gradeSuja && stockMode === "variants") {
          const okVar = await salvarVariacoes(alvo!.id);
          if (!okVar) return;
        }
        if (categoriaSuja) vincularCategoria(alvo!.id);
        gravarUltimaCategoria(company?.id, type, {
          primaryCategoryId: selecao.primaryCategoryId,
          alsoInIds: selecao.alsoInIds,
          legado: categoriaFinal,
        });
        setSujo(false);
        setGradeSuja(false);
        setCategoriaSuja(false);
        onSaved?.();
        onClose();
        return;
      }

      const base = montarProduto(Date.now().toString());
      const corpo: Product = {
        ...base,
        code: isProduto ? base.code : (sku.trim() || gerarCodigoServico()),
      };
      const criado: any = await addProduct(corpo);
      if (!criado?.id) return;

      // Vínculo da árvore: só existe depois que a linha existe.
      vincularCategoria(criado.id);
      gravarUltimaCategoria(company?.id, type, {
        primaryCategoryId: selecao.primaryCategoryId,
        alsoInIds: selecao.alsoInIds,
        legado: categoriaFinal,
      });

      if (isProduto && stockMode === "variants" && (cores.length > 0 || tamanhos.length > 0)) {
        await salvarVariacoes(criado.id);
      }

      onSaved?.();

      filaRef.current = pendentes;
      setPendentes([]);
      await subirFila(criado.id);

      if (cadastrarOutro) {
        const t = type;
        semear(null, t);
        toast.success("Salvo. Próximo item");
      } else {
        onClose();
      }
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  // ── duplicata vira edição do que já existe ───────────────
  function abrirDuplicata(d: DuplicataRow) {
    const existente = products.find((p) => p.id === d.id);
    if (!existente) { toast.error("Produto não encontrado na lista. Recarregue o estoque."); return; }
    semear(existente, "product");
    toast.info("Abrindo " + existente.name);
  }

  // ── sair ─────────────────────────────────────────────────
  const temProgresso = modoEdicao
    ? (sujo || gradeSuja || categoriaSuja)
    : (!!nome.trim() || precoNum > 0 || pendentes.length > 0);

  function pedirFechar() {
    if (temProgresso) setConfirmarSaida(true);
    else onClose();
  }

  // Teclado (web): no cadastro, Enter em qualquer campo de uma linha
  // salva — é o gesto de quem cadastra quarenta peças. Na edição, só
  // Ctrl/Cmd+Enter: lá o Enter pode estar no meio da grade de estoque, e
  // salvar sem querer um produto que já existe é pior que um clique a
  // mais. Escape pede pra fechar (com confirmação se houver o que perder).
  const acoesRef = useRef({
    salvar: (_o: boolean) => {}, fechar: () => {}, fecharSheet: () => {},
    edicao: false, pode: false, sheet: false,
  });
  acoesRef.current = {
    salvar, fechar: pedirFechar, fecharSheet: () => setCatSheet(false),
    edicao: modoEdicao, pode: podeSalvar, sheet: catSheet,
  };
  useEffect(() => {
    if (!visible || !IS_WEB || typeof document === "undefined") return;
    function onKey(e: any) {
      const painel = panelRef.current;
      if (e.key === "Escape") {
        e.preventDefault();
        // A folha de categoria fecha primeiro: Escape fecha uma camada
        // por vez, não o cadastro inteiro.
        if (acoesRef.current.sheet) acoesRef.current.fecharSheet();
        else acoesRef.current.fechar();
        return;
      }
      if (e.key !== "Enter") return;
      if (!painel || typeof painel.contains !== "function" || !painel.contains(e.target)) return;
      if (e.target?.tagName === "TEXTAREA") return;
      if (acoesRef.current.edicao && !(e.ctrlKey || e.metaKey)) return;
      if (!acoesRef.current.pode) return;
      e.preventDefault();
      acoesRef.current.salvar(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  // Celular: o campo em foco rola até o centro, longe do teclado.
  useEffect(() => {
    if (!visible || !IS_WEB || !narrow || typeof document === "undefined") return;
    function onFocusIn(e: any) {
      const t = e?.target;
      const painel = panelRef.current;
      if (!t || !painel || typeof painel.contains !== "function" || !painel.contains(t)) return;
      setTimeout(() => {
        try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) { /* noop */ }
      }, 60);
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [visible, narrow]);

  if (!visible) return null;

  const painelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE
      ? "0 24px 60px -10px rgba(0,0,0,0.7)"
      : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });

  // ── rodapé: o que impede, ou o que vai ser salvo ─────────
  const progressoTxt = progresso ? rotuloDoProgresso(progresso.feitas, progresso.total) : "";
  const bloqueioTxt = textoDoBloqueio(bloqueios);
  const info = progressoTxt
    || bloqueioTxt
    || (modoEdicao
      ? textoDeEdicao(sujo || gradeSuja || categoriaSuja)
      : resumoDoItem({
          nome, preco: precoNum, isProduto, stockMode, cores, tamanhos,
          minutos: duracaoParaMinutos(duracao),
        }));
  const atalho = modoEdicao ? "Ctrl+Enter" : "Enter";

  // Devolve JSX, não um componente: um componente declarado aqui dentro
  // seria um tipo novo a cada render e remontaria o botão no meio do
  // clique.
  function tipoBtn(alvoTipo: ItemType, icone: string, rotulo: string) {
    const ativo = type === alvoTipo;
    const travado = modoEdicao && !ativo;
    return (
      <Pressable
        key={alvoTipo}
        onPress={travado || ativo ? undefined : () => {
          setType(alvoTipo);
          setSujo(true);
          const u = lerUltimaCategoria(company?.id, alvoTipo);
          setSelecao(u ? { primaryCategoryId: u.primaryCategoryId, alsoInIds: u.alsoInIds } : VAZIO);
          setLegado(u?.legado || "");
          setUltimaUsada(!!u && (!!u.primaryCategoryId || !!u.legado));
        }}
        disabled={travado}
        accessibilityLabel={rotulo}
        style={[s.tipoBtn, ativo && s.tipoBtnAtivo, travado && { opacity: 0.45 }, narrow && { flex: 1, justifyContent: "center" }]}
      >
        <Icon name={icone as any} size={13} color={ativo ? "#fff" : Colors.ink3} />
        <Text style={[s.tipoTxt, ativo && { color: "#fff" }]}>{rotulo}</Text>
      </Pressable>
    );
  }

  const secItem = (
    <SecaoItem
      type={type}
      nome={nome}
      onNome={(v) => { setNome(v); setSujo(true); }}
      duplicatas={duplicatas}
      onDupMerge={abrirDuplicata}
      onDupNao={() => { setDupDispensada(true); setDuplicatas([]); }}
      categoriaRotulo={categoriaRotulo}
      categoriaUltimaUsada={ultimaUsada}
      onAbrirCategoria={() => setCatSheet(true)}
      onSubmit={() => { if (!modoEdicao) salvar(false); }}
      autoFocus={!modoEdicao}
      narrow={narrow}
    />
  );

  const secPreco = (
    <SecaoPreco
      type={type}
      narrow={narrow}
      preco={preco} onPreco={(v) => { setPreco(v); setSujo(true); }}
      custo={custo} onCusto={(v) => { setCusto(v); setSujo(true); }}
      duracao={duracao} onDuracao={(v) => { setDuracao(v); setSujo(true); }}
      onSubmit={() => { if (!modoEdicao) salvar(false); }}
    />
  );

  const secEstoque = isProduto ? (
    <SecaoEstoque
      narrow={narrow}
      modoEdicao={modoEdicao}
      unidade={unidade} onUnidade={(v) => { setUnidade(v); setSujo(true); }}
      stockMode={stockMode} onStockMode={(v) => { setStockMode(v); setSujo(true); setGradeSuja(true); }}
      estoque={estoqueTxt} onEstoque={(v) => { setEstoqueTxt(v); setSujo(true); }}
      minimo={minimoTxt} onMinimo={(v) => { setMinimoTxt(v); setSujo(true); }}
      cores={cores} onCores={(v) => { setCores(v); setGradeSuja(true); setSujo(true); }}
      tamanhos={tamanhos} onTamanhos={(v) => { setTamanhos(v); setGradeSuja(true); setSujo(true); }}
      celulas={celulas} onCelula={(k, v) => { setCelulas((c) => ({ ...c, [k]: v })); setGradeSuja(true); setSujo(true); }}
      barras={barras} onBarra={(k, v) => { setBarras((b) => ({ ...b, [k]: v })); setGradeSuja(true); setSujo(true); }}
      onSubmit={() => { if (!modoEdicao) salvar(false); }}
    />
  ) : null;

  const secDescricao = (
    <SecaoDescricao
      type={type}
      narrow={narrow}
      nome={nome}
      preco={precoNum}
      capaUrl={capaUrl}
      descricao={descricao} onDescricao={(v) => { setDescricao(v); setSujo(true); }}
      material={material} onMaterial={(v) => { setMaterial(v); setSujo(true); }}
      medidas={medidas} onMedidas={(v) => { setMedidas(v); setSujo(true); }}
      cuidados={cuidados} onCuidados={(v) => { setCuidados(v); setSujo(true); }}
    />
  );

  const secFotos = (
    <SecaoFotos
      type={type}
      narrow={narrow}
      persistido={modoEdicao}
      galeria={galeria}
      pendentes={pendentes}
      onAdicionarPendente={(corHex, base64, contentType) => {
        setPendentes((f) => [...f, {
          id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7),
          corHex, base64, contentType,
        }]);
      }}
      onRemoverPendente={(id) => setPendentes((f) => f.filter((x) => x.id !== id))}
      onFotoMudou={() => { /* na edição a foto já está salva; nada a marcar */ }}
      cores={stockMode === "variants" ? cores : []}
    />
  );

  const secCodigos = isProduto ? (
    <SecaoCodigos
      type={type}
      emiteNota={emiteNota}
      nome={nome}
      preco={precoNum}
      categoriaEscolhida={categoriaEscolhida}
      material={material}
      cores={stockMode === "variants" ? cores : []}
      tamanhos={stockMode === "variants" ? tamanhos : []}
      sku={sku} onSku={(v) => { setSku(v); setSujo(true); }}
      barcode={barcode} onBarcode={(v) => { setBarcode(v); setSujo(true); }}
      ncm={ncm} onNcm={(v) => { setNcm(v); setSujo(true); }}
    />
  ) : null;

  return (
    <View style={[s.overlay, narrow && s.overlayNarrow]}>
      <Pressable style={s.backdrop} onPress={pedirFechar} />
      <View
        ref={panelRef}
        style={[
          s.panel,
          narrow && s.panelNarrow,
          IS_WEB ? (painelWeb as any) : { backgroundColor: Colors.bg3 },
        ]}
      >
        {/* cabeçalho */}
        <View style={[s.header, narrow && { flexWrap: "wrap" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <View style={s.headerIco}>
              <Icon name={isProduto ? "package" : "star"} size={16} color={Colors.violet3} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle} numberOfLines={1}>{tituloDoModal(type, modoEdicao)}</Text>
              <Text style={s.headerSub} numberOfLines={narrow ? 2 : 1}>{subtituloDoModal(modoEdicao)}</Text>
            </View>
          </View>

          {!narrow && (
            <View style={s.tipo}>
              {modoEdicao && (
                <View style={s.tipoLock}>
                  <Icon name="lock" size={11} color={Colors.ink3} />
                  <Text style={s.tipoLockTxt}>tipo fixo</Text>
                </View>
              )}
              {tipoBtn("product", "package", "Produto")}
              {tipoBtn("service", "star", "Serviço")}
            </View>
          )}

          <Pressable onPress={pedirFechar} style={s.headerBtn} accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>

          {narrow && (
            <View style={[s.tipo, { width: "100%", marginLeft: 0, marginTop: 10 }]}>
              {tipoBtn("product", "package", "Produto")}
              {tipoBtn("service", "star", "Serviço")}
            </View>
          )}
        </View>

        {/* corpo — as seções nunca desmontam; a ScrollView é uma só */}
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {duasColunas ? (
            <View style={s.cols}>
              <View style={s.colEsq}>
                {secItem}
                {secPreco}
                {secEstoque}
                {secDescricao}
              </View>
              <View style={s.colDir}>
                {secFotos}
                {secCodigos}
              </View>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {secItem}
              {secPreco}
              {secEstoque}
              {secFotos}
              {secDescricao}
              {secCodigos}
            </View>
          )}
        </ScrollView>

        {/* rodapé */}
        <View style={[s.footer, narrow && s.footerNarrow]}>
          <View style={s.footerInfoBox}>
            {!!bloqueioTxt && !progressoTxt && <Icon name="alert" size={13} color={Colors.amber} />}
            <Text
              style={[s.footerInfo, !!bloqueioTxt && !progressoTxt && { color: Colors.amber }]}
              numberOfLines={narrow ? 2 : 1}
            >
              {info}
            </Text>
            {!narrow && !progressoTxt && (
              <View style={s.kbd}><Text style={s.kbdTxt}>{atalho + " salva"}</Text></View>
            )}
          </View>

          <View style={[s.footerActions, narrow && { flexDirection: "column", width: "100%" }]}>
            {!narrow && (
              <Pressable style={s.btnSec} onPress={pedirFechar}>
                <Text style={s.btnSecTxt}>Cancelar</Text>
              </Pressable>
            )}
            {!modoEdicao && (
              <Pressable
                style={[s.btnSec, !podeSalvar && { opacity: 0.45 }, narrow && { alignItems: "center" }]}
                onPress={podeSalvar ? () => salvar(true) : undefined}
                disabled={!podeSalvar}
              >
                <Text style={s.btnSecTxt}>Salvar e cadastrar outro</Text>
              </Pressable>
            )}
            <Pressable
              style={[
                modoEdicao ? s.btnPri : s.btnOk,
                !podeSalvar && { opacity: 0.45 },
                narrow && { justifyContent: "center" },
              ]}
              onPress={podeSalvar ? () => salvar(false) : undefined}
              disabled={!podeSalvar}
            >
              {salvando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={s.btnPriTxt}>{rotuloDoBotaoSalvar(type, modoEdicao)}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {catSheet && (
          <CategoriaSheet
            type={type}
            selecao={selecao}
            onChangeSelecao={(v) => { setSelecao(v); setUltimaUsada(false); setCategoriaSuja(true); setSujo(true); }}
            legado={legado}
            onChangeLegado={(v) => { setLegado(v); setUltimaUsada(false); setSujo(true); }}
            categoriasLegado={categoriasLegado}
            onClose={() => setCatSheet(false)}
          />
        )}
      </View>

      {confirmarSaida && (
        <View style={s.exitOverlay}>
          <View style={s.exitCard}>
            <Text style={s.exitTitle}>{modoEdicao ? "Sair sem salvar?" : "Descartar este cadastro?"}</Text>
            <Text style={s.exitMsg}>
              {modoEdicao
                ? "Você tem alterações não salvas."
                : "Você começou a cadastrar um " + nomeDoTipo(type) + ". Se sair agora, o que preencheu será perdido."}
            </Text>
            <View style={s.exitActions}>
              <Pressable style={s.exitStay} onPress={() => setConfirmarSaida(false)}>
                <Text style={s.exitStayTxt}>Continuar</Text>
              </Pressable>
              <Pressable style={s.exitLeave} onPress={() => { setConfirmarSaida(false); onClose(); }}>
                <Text style={s.exitLeaveTxt}>{modoEdicao ? "Sair sem salvar" : "Descartar e sair"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 20,
  },
  overlayNarrow: { padding: 0, justifyContent: "flex-end" },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: {
    width: "100%", maxWidth: 1040, maxHeight: "95%",
    borderRadius: 18, overflow: "hidden", flexDirection: "column",
  },
  panelNarrow: {
    maxWidth: undefined as any, maxHeight: "94%",
    borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: "rgba(124,58,237,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.06)" : "rgba(109,40,217,0.06)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.1)" : "rgba(109,40,217,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  // Tipo: um segmentado pequeno no cabeçalho, não dois cartões grandes.
  tipo: {
    flexDirection: "row", alignItems: "center", gap: 2, padding: 2, borderRadius: 9,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  tipoLock: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 },
  tipoLockTxt: { fontSize: 11, color: Colors.ink3 },
  tipoBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6 },
  tipoBtnAtivo: { backgroundColor: Colors.violet },
  tipoTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink3 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12 },
  cols: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  colEsq: { flex: 1.35, gap: 14, minWidth: 0 },
  colDir: { flex: 1, gap: 14, minWidth: 0 },
  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
    paddingHorizontal: 22, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: IS_DARK_MODE ? "rgba(0,0,0,0.18)" : "rgba(124,58,237,0.04)",
  },
  footerNarrow: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  footerInfoBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  footerInfo: { flexShrink: 1, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  kbd: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, flexShrink: 0,
  },
  kbdTxt: { fontSize: 10.5, color: Colors.ink3 },
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  btnPri: {
    backgroundColor: Colors.violet,
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  btnOk: {
    backgroundColor: "#10b981",
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.06)" : "rgba(109,40,217,0.06)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.1)" : "rgba(109,40,217,0.18)",
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
  exitOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24,
  },
  exitCard: {
    width: "100%", maxWidth: 380, borderRadius: 16, padding: 22,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
  },
  exitTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  exitMsg: { fontSize: 13, color: Colors.ink2, lineHeight: 19, marginBottom: 18 },
  exitActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  exitStay: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "rgba(124,58,237,0.18)", borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
  },
  exitStayTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  exitLeave: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.12)", borderWidth: 1, borderColor: "rgba(239,68,68,0.35)",
  },
  exitLeaveTxt: { fontSize: 13, fontWeight: "700", color: Colors.red },
});

export default ItemFormModal;
