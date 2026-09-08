// ============================================================
// AURA. — Estoque · ItemWizardModal (Novo item)
//
// 08/09/2026 — substitui AddProductForm (751 linhas) + AddServiceForm
// (201). Um modal só, três passos, para produto E serviço, para criar
// E editar. Mockup aprovado: Aura/mockup_cadastro_item_v1.html (v3).
// Shell copiado do TrocaModal (DNA canônica de wizard).
//
// As duas decisões que mudam a vida de quem cadastra 40 peças:
//
//   1. UM JEITO SÓ DE SALVAR. Ao criar, o item nasce no fim do passo 2
//      (botão verde "Criar produto"). Daí em diante — e em toda edição —
//      cada campo salva sozinho ao sair dele, com "Salvo" no cartão e no
//      rodapé. Não existe "Salvar alterações" competindo com auto-save.
//
//   2. CORES E TAMANHOS NO PASSO 2. As listas ficam em memória e vão
//      para PUT /variations logo depois do create. O passo 3 mostra a
//      grade (estoque, código e foto de cada uma).
//
// 09/09/2026 — as duas limitações da rodada anterior caíram (backend
// #684, migration 323):
//
//   - FOTO. Deixou de ser uma por cor: são até quatro por cor e quatro
//     na galeria principal, com capa reordenável (item-wizard/
//     GaleriaDeFotos.tsx). A posição 0 continua espelhando o image_url
//     que a vitrine, o PDV e o catálogo do WhatsApp sempre leram.
//   - DURAÇÃO. Virou coluna (`products.duration_minutes`). Não se
//     escreve mais "… | Duração: 45 min" no fim da descrição; o texto
//     antigo continua sendo LIDO na edição e migra para a coluna na
//     gravação seguinte (lerDuracaoDoServico em item-wizard/types.ts).
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
import { productsVariationsApi, matrixKey, type MatrixMap } from "@/services/productsVariationsApi";
import { hexToName } from "@/utils/colorNames";
import type { CategorySelection } from "@/components/catalog/CategoryTreePicker";
import { IS_WEB, webOnly } from "@/components/screens/pdv/types";
import type { Product } from "./types";
import { Step1Basico, type DuplicataRow } from "./item-wizard/Step1Basico";
import { Step2PrecoEstoque } from "./item-wizard/Step2PrecoEstoque";
import { Step3Complementos } from "./item-wizard/Step3Complementos";
import { CategoriaSheet, useBreadcrumbLabel } from "./item-wizard/CategorySelector";
import { rotuloSalvando } from "./item-wizard/ui";
import {
  calcMargem, duracaoParaMinutos, faltaNcm, fmtBRL, gerarCodigoServico, gravarUltimaCategoria,
  lerDuracaoDoServico, lerUltimaCategoria, mascaraDeValor, matrizZerada, minutosParaRotulo,
  nomeDoTipo, passoClicavel, podeAvancar, preservarValores, rotulosDosPassos, subtituloDoPasso,
  tituloDoModal, valorDaMascara,
  type CardKey, type ItemType, type SaveState, type StockMode, type WizardColor, type WizardStep,
} from "./item-wizard/types";

const VAZIO: CategorySelection = { primaryCategoryId: null, alsoInIds: [] };

// Celular = web estreito (< 640) ou nativo. O painel vira folha de baixo,
// "Voltar" sobe pro cabeçalho e o rodapé empilha um botão principal só.
function useNarrow(): boolean {
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
  return Platform.OS !== "web" || w < 640;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  initialType?: ItemType;
  editProduct?: Product | null;
  onSaved?: () => void;
};

export function ItemWizardModal({ visible, onClose, initialType = "product", editProduct, onSaved }: Props) {
  const narrow = useNarrow();
  const qc = useQueryClient();
  const { company } = useAuthStore();
  const { products, addProduct, updateProduct } = useProducts();
  const { byId: categoriaPorId, assignProductCategories } = useCategories();
  const breadcrumbLabel = useBreadcrumbLabel();

  // Alvo da edição: vem da prop, mas o banner de duplicata pode TROCAR pra
  // edição do produto que já existe sem fechar o modal.
  const [alvo, setAlvo] = useState<Product | null>(null);
  const [criadoId, setCriadoId] = useState<string | null>(null);
  const [recemCriado, setRecemCriado] = useState(false);
  const [criando, setCriando] = useState(false);

  const [step, setStep] = useState<WizardStep>(1);
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
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [cores, setCores] = useState<WizardColor[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);

  const [selecao, setSelecao] = useState<CategorySelection>(VAZIO);
  const [legado, setLegado] = useState("");
  const [ultimaUsada, setUltimaUsada] = useState(false);
  const [catSheet, setCatSheet] = useState(false);

  const [duplicatas, setDuplicatas] = useState<DuplicataRow[]>([]);
  const [dupDispensada, setDupDispensada] = useState(false);

  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  const [cardSave, setCardSave] = useState<Record<string, SaveState>>({});
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  const modoEdicao = !!alvo;
  const productId = alvo?.id || criadoId;
  const persistido = !!productId;
  const liberado = modoEdicao || recemCriado;
  const isProduto = type === "product";

  const salvarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variacoesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<any>(null);

  // ── config fiscal: a empresa emite NFC-e? ────────────────
  // Mesma chave de cache do SaleDetailModal — config muda quase nunca.
  const { data: nfceCfg } = useQuery({
    queryKey: ["nfce-config", company?.id],
    queryFn: () => nfceApi.getConfig(company!.id),
    enabled: !!company?.id && visible,
    staleTime: 300_000,
    retry: 1,
  });
  const emiteNota = !!(nfceCfg as any)?.config?.is_active;

  // ── variações do item já persistido ──────────────────────
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
    const cs: WizardColor[] = (variacoes.colors || []).map((c) => ({
      hex: (c.hex || "").toUpperCase(),
      name: c.name || hexToName(c.hex) || c.hex,
    }));
    const zs = variacoes.sizes || [];
    if (cs.length || zs.length) {
      setCores(cs);
      setTamanhos(zs);
      setStockMode("variants");
    }
  }, [variacoes]);

  // ── semear / limpar ──────────────────────────────────────
  const semear = useCallback((prod: Product | null, tipo: ItemType) => {
    const t: ItemType = prod ? (prod.unit === "srv" ? "service" : "product") : tipo;
    setAlvo(prod);
    setCriadoId(null);
    setRecemCriado(false);
    setStep(1);
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
    setImagemUrl((prod as any)?.image_url || null);
    setCores([]);
    setTamanhos([]);
    setStockMode(prod?.has_variants ? "variants" : "single");
    hidratou.current = false;
    setDuplicatas([]);
    setDupDispensada(false);
    setAberto({});
    setCardSave({});
    setSaveState(null);
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
    // depois disso (o auto-save invalida a lista de produtos, e a prop
    // editProduct chegaria de volta sobrescrevendo o que está na tela).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => {
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    if (variacoesTimer.current) clearTimeout(variacoesTimer.current);
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

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
    if (!visible || modoEdicao || recemCriado || !isProduto || dupDispensada || trimmed.length < 2 || !company?.id) {
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
  }, [nome, company?.id, visible, modoEdicao, recemCriado, isProduto, dupDispensada]);

  // ── montar o corpo do produto ────────────────────────────
  function montarProduto(id: string): Product {
    const temVariantes = cores.length > 0 || tamanhos.length > 0;
    return {
      id,
      name: nome.trim(),
      code: sku.trim() || (alvo?.code && alvo.code !== "---" ? alvo.code : "---"),
      barcode: barcode.trim(),
      category: categoriaFinal,
      price: valorDaMascara(preco),
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

  // ── auto-save ────────────────────────────────────────────
  function marcarSalvo(card?: CardKey) {
    setSaveState("done");
    if (card) setCardSave((s) => ({ ...s, [card]: "done" }));
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => { setSaveState(null); setCardSave({}); }, 2500);
  }

  function agendarSalvar(card?: CardKey) {
    if (!productId) return;
    setSaveState("busy");
    if (card) setCardSave((s) => ({ ...s, [card]: "busy" }));
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(async () => {
      // "Salvo" so depois da resposta. Em falha o toast do hook ja avisou;
      // aqui basta apagar o "Salvando…" para nao ficar preso na tela.
      const ok = await updateProduct(montarProduto(productId), { silent: true });
      if (ok) marcarSalvo(card);
      else { setSaveState(null); if (card) setCardSave((s) => ({ ...s, [card]: null })); }
    }, 600);
  }

  function agendarSalvarVariacoes(nextCores: WizardColor[], nextTamanhos: string[]) {
    if (!productId || !company?.id) return;
    setSaveState("busy");
    setCardSave((s) => ({ ...s, var: "busy" }));
    if (variacoesTimer.current) clearTimeout(variacoesTimer.current);
    variacoesTimer.current = setTimeout(async () => {
      try {
        const zerada = matrizZerada(nextCores, nextTamanhos, matrixKey);
        const chaves = Object.keys(zerada);
        const anterior = variacoesRef.current || {};
        const matriz: MatrixMap = {};
        chaves.forEach((k) => { matriz[k] = (anterior.matrix || {})[k] ?? 0; });
        await productsVariationsApi.save(company.id, productId, {
          colors: nextCores.map((c) => ({ hex: c.hex, name: c.name || null })),
          sizes: nextTamanhos,
          matrix: matriz,
          barcodes: preservarValores<string>(chaves, anterior.barcodes),
        });
        qc.invalidateQueries({ queryKey: ["productVariations", company.id, productId] });
        qc.invalidateQueries({ queryKey: ["products", company.id] });
        marcarSalvo("var");
      } catch (e: any) {
        setSaveState(null);
        setCardSave((s) => ({ ...s, var: null }));
        toast.error(e?.message || "Erro ao salvar cores e tamanhos");
      }
    }, 600);
  }

  function trocarCores(next: WizardColor[]) { setCores(next); agendarSalvarVariacoes(next, tamanhos); }
  function trocarTamanhos(next: string[]) { setTamanhos(next); agendarSalvarVariacoes(cores, next); }

  // ── criar ────────────────────────────────────────────────
  async function criar() {
    if (!nome.trim()) { toast.error("Preencha o nome do " + nomeDoTipo(type)); return; }
    if (valorDaMascara(preco) <= 0) { toast.error("Preencha o preço de venda"); return; }
    if (isProduto && ncm && ncm.length !== 8) {
      toast.error("NCM deve ter 8 dígitos numericos (ou ficar vazio)");
      return;
    }
    setCriando(true);
    try {
      const base = montarProduto(Date.now().toString());
      const corpo: Product = {
        ...base,
        code: isProduto ? base.code : (sku.trim() || gerarCodigoServico()),
      };
      const criadoRow: any = await addProduct(corpo);
      if (!criadoRow?.id) return;

      setCriadoId(criadoRow.id);
      setRecemCriado(true);

      // Vínculo da árvore: só existe depois que a linha existe.
      if (selecao.primaryCategoryId) {
        try {
          assignProductCategories(criadoRow.id, {
            primary_category_id: selecao.primaryCategoryId,
            also_in: selecao.alsoInIds,
          });
        } catch (_) { /* o produto já existe; o vínculo vira pendência */ }
      }
      gravarUltimaCategoria(company?.id, type, {
        primaryCategoryId: selecao.primaryCategoryId,
        alsoInIds: selecao.alsoInIds,
        legado: categoriaFinal,
      });

      if (isProduto && (cores.length > 0 || tamanhos.length > 0) && company?.id) {
        try {
          await productsVariationsApi.save(company.id, criadoRow.id, {
            colors: cores.map((c) => ({ hex: c.hex, name: c.name || null })),
            sizes: tamanhos,
            matrix: matrizZerada(cores, tamanhos, matrixKey),
            barcodes: {},
          });
          hidratou.current = true;
          qc.invalidateQueries({ queryKey: ["productVariations", company.id, criadoRow.id] });
        } catch (e: any) {
          toast.error("Item criado, mas as cores e tamanhos não salvaram. Tente de novo no passo 3.");
        }
      }

      setStep(3);
      setAberto({
        photo: true,
        var: isProduto && stockMode === "variants",
        codes: isProduto && faltaNcm(ncm, emiteNota),
      });
      onSaved?.();
    } finally {
      setCriando(false);
    }
  }

  // ── navegação ────────────────────────────────────────────
  const precoNum = valorDaMascara(preco);
  const custoNum = valorDaMascara(custo);
  const podeSeguir = podeAvancar(step, { nome, preco: precoNum });

  function avancar() {
    if (step === 1) { if (podeSeguir) setStep(2); return; }
    if (step === 2) {
      if (liberado) setStep(3);
      else if (podeSeguir && !criando) criar();
    }
  }
  function voltar() { setStep((n) => (Math.max(1, n - 1) as WizardStep)); }
  function irPara(n: WizardStep) { if (passoClicavel(n, step, liberado)) setStep(n); }

  function concluir() { onSaved?.(); onClose(); }

  function cadastrarOutro() {
    onSaved?.();
    const t = type;
    semear(null, t);
    toast.success("Salvo. Próximo item");
  }

  function abrirDuplicata(d: DuplicataRow) {
    const existente = products.find((p) => p.id === d.id);
    if (!existente) { toast.error("Produto não encontrado na lista. Recarregue o estoque."); return; }
    semear(existente, "product");
    setStep(3);
    setAberto({ var: true });
    toast.info("Abrindo " + existente.name);
  }

  const temProgresso = !persistido && (!!nome.trim() || precoNum > 0);
  function pedirFechar() {
    if (temProgresso) setConfirmarSaida(true);
    else onClose();
  }

  // Celular: o campo em foco rola até o centro, longe do teclado.
  useEffect(() => {
    if (!visible || !IS_WEB || !narrow || typeof document === "undefined") return;
    function onFocusIn(e: any) {
      const t = e?.target;
      const panel = panelRef.current;
      if (!t || !panel || typeof panel.contains !== "function" || !panel.contains(t)) return;
      setTimeout(() => {
        try { t.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) { /* noop */ }
      }, 60);
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [visible, narrow]);

  if (!visible) return null;

  const rotulos = rotulosDosPassos(type);
  const painelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE
      ? "0 24px 60px -10px rgba(0,0,0,0.7)"
      : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });

  // ── rodapé ───────────────────────────────────────────────
  let info = "";
  if (step === 1) {
    info = nome.trim()
      ? nome.trim() + " · " + (isProduto ? "Produto" : "Serviço") + (categoriaRotulo ? " · " + categoriaRotulo : "")
      : "Nome e tipo bastam para seguir";
  } else if (step === 2) {
    if (precoNum <= 0) info = "Preço é o único obrigatório aqui";
    else if (isProduto) {
      const m = calcMargem(precoNum, custoNum);
      info = m.estado === "ok" || m.estado === "neg"
        ? "Margem " + m.pct + "% · " + (stockMode === "variants"
            ? cores.length + " cores · " + tamanhos.length + " tamanhos"
            : "quantidade única")
        : fmtBRL(precoNum) + " por unidade";
    } else {
      const rotuloDur = minutosParaRotulo(duracaoParaMinutos(duracao));
      info = fmtBRL(precoNum) + (rotuloDur ? " · " + rotuloDur : "");
    }
  } else {
    info = "Nada aqui é obrigatório";
  }
  if (persistido && saveState) info = rotuloSalvando(saveState);

  const btnPrincipal = step === 3
    ? { label: "Concluir", verde: true, onPress: concluir, off: false }
    : step === 2 && !liberado
      ? { label: criando ? "Criando…" : "Criar " + nomeDoTipo(type), verde: true, onPress: criar, off: !podeSeguir || criando }
      : { label: "Continuar →", verde: false, onPress: avancar, off: !podeSeguir && step === 1 };

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
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            {narrow && step > 1 ? (
              <Pressable onPress={voltar} style={s.headerBtn} accessibilityLabel="Voltar">
                <Icon name="arrow_left" size={16} color={Colors.ink3} />
              </Pressable>
            ) : (
              <View style={s.headerIco}>
                <Icon name={isProduto ? "package" : "star"} size={16} color={Colors.violet3} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle} numberOfLines={1}>
                {tituloDoModal(type, modoEdicao, recemCriado)}
              </Text>
              <Text style={s.headerSub} numberOfLines={1}>{subtituloDoPasso(step, type)}</Text>
            </View>
          </View>
          <Pressable onPress={pedirFechar} style={s.headerBtn} accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {/* barra de passos */}
        <View style={s.stepBar}>
          {([1, 2, 3] as WizardStep[]).map((n, idx) => {
            const ativo = step === n;
            const feito = step > n || (liberado && !ativo);
            const clicavel = passoClicavel(n, step, liberado);
            return (
              <View key={n} style={s.stepItem}>
                <Pressable
                  onPress={clicavel ? () => irPara(n) : undefined}
                  disabled={!clicavel}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  accessibilityLabel={rotulos[n - 1]}
                >
                  <View style={[s.stepDot, feito && s.stepDotDone, ativo && s.stepDotActive]}>
                    {feito
                      ? <Icon name="check" size={10} color="#fff" />
                      : <Text style={[s.stepDotTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  {(!narrow || ativo) && (
                    <Text
                      style={[s.stepLabel, ativo && { color: Colors.violet3, fontWeight: "700" }, feito && !ativo && { color: Colors.ink2 }]}
                      numberOfLines={1}
                    >
                      {rotulos[n - 1]}
                    </Text>
                  )}
                </Pressable>
                {idx < 2 && <View style={[s.stepSep, step > n && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
              </View>
            );
          })}
        </View>

        {/* corpo */}
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <Step1Basico
              type={type}
              travado={modoEdicao || recemCriado}
              nome={nome}
              onNome={setNome}
              onTipo={(t) => {
                if (modoEdicao || recemCriado || t === type) return;
                setType(t);
                const u = lerUltimaCategoria(company?.id, t);
                setSelecao(u ? { primaryCategoryId: u.primaryCategoryId, alsoInIds: u.alsoInIds } : VAZIO);
                setLegado(u?.legado || "");
                setUltimaUsada(!!u && (!!u.primaryCategoryId || !!u.legado));
              }}
              duplicatas={duplicatas}
              onDupMerge={abrirDuplicata}
              onDupNao={() => { setDupDispensada(true); setDuplicatas([]); }}
              categoriaRotulo={categoriaRotulo}
              categoriaUltimaUsada={ultimaUsada}
              onAbrirCategoria={() => setCatSheet(true)}
              onSubmit={avancar}
              onBlur={() => agendarSalvar()}
              autoFocus={!modoEdicao}
              narrow={narrow}
            />
          )}

          {step === 2 && (
            <Step2PrecoEstoque
              type={type}
              narrow={narrow}
              preco={preco} onPreco={setPreco}
              custo={custo} onCusto={setCusto}
              unidade={unidade} onUnidade={setUnidade}
              stockMode={stockMode} onStockMode={setStockMode}
              estoque={estoqueTxt} onEstoque={setEstoqueTxt}
              minimo={minimoTxt} onMinimo={setMinimoTxt}
              cores={cores} onCores={trocarCores}
              tamanhos={tamanhos} onTamanhos={trocarTamanhos}
              duracao={duracao} onDuracao={setDuracao}
              onSubmit={avancar}
              onBlur={() => agendarSalvar()}
            />
          )}

          {step === 3 && (
            persistido ? (
              <Step3Complementos
                type={type}
                narrow={narrow}
                productId={productId as string}
                recemCriado={recemCriado}
                emiteNota={emiteNota}
                aberto={aberto}
                onToggle={(k) => setAberto((a) => ({ ...a, [k]: !a[k] }))}
                cardSave={cardSave}
                nome={nome}
                preco={preco}
                imagemUrl={imagemUrl}
                // A capa vem da galeria; o modal só reflete na prévia da
                // loja. Sem "Salvo" aqui: hidratar não é salvar.
                onCapaPrincipal={setImagemUrl}
                onFotoMudou={() => marcarSalvo("photo")}
                cores={cores}
                tamanhos={tamanhos}
                stockMode={stockMode}
                corPai={stockMode === "single" ? (alvo?.color || null) : null}
                tamanhoPai={stockMode === "single" ? (alvo?.size || null) : null}
                estoquePai={stockMode === "single" ? (alvo?.stock ?? null) : null}
                descricao={descricao} onDescricao={setDescricao}
                material={material} onMaterial={setMaterial}
                medidas={medidas} onMedidas={setMedidas}
                cuidados={cuidados} onCuidados={setCuidados}
                sku={sku} onSku={setSku}
                barcode={barcode} onBarcode={setBarcode}
                ncm={ncm} onNcm={setNcm}
                categoriaEscolhida={categoriaEscolhida}
                onIrParaPasso2={() => setStep(2)}
                onBlur={(card) => agendarSalvar(card)}
              />
            ) : (
              <View style={{ paddingVertical: 30, alignItems: "center", gap: 10 }}>
                <ActivityIndicator size="small" color={Colors.violet3} />
                <Text style={s.headerSub}>Crie o item no passo 2 para liberar os complementos.</Text>
              </View>
            )
          )}
        </ScrollView>

        {/* rodapé */}
        <View style={[s.footer, narrow && s.footerNarrow]}>
          <Text style={[s.footerInfo, persistido && saveState === "done" && { color: Colors.green, fontWeight: "700" }]} numberOfLines={narrow ? 2 : 1}>
            {info}
          </Text>
          <View style={[s.footerActions, narrow && { flexDirection: "column", width: "100%" }]}>
            {step > 1 && !narrow && (
              <Pressable style={s.btnSec} onPress={voltar}>
                <Text style={s.btnSecTxt}>← Voltar</Text>
              </Pressable>
            )}
            {step === 3 && recemCriado && (
              <Pressable style={[s.btnSec, narrow && { alignItems: "center" }]} onPress={cadastrarOutro}>
                <Text style={s.btnSecTxt}>Concluir e cadastrar outro</Text>
              </Pressable>
            )}
            <Pressable
              style={[
                btnPrincipal.verde ? s.btnOk : s.btnPri,
                btnPrincipal.off && { opacity: 0.45 },
                narrow && { justifyContent: "center" },
              ]}
              onPress={btnPrincipal.off ? undefined : btnPrincipal.onPress}
              disabled={btnPrincipal.off}
            >
              {criando && step === 2 ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  {btnPrincipal.verde && <Icon name="check" size={14} color="#fff" />}
                  <Text style={s.btnPriTxt}>{btnPrincipal.label}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {catSheet && (
          <CategoriaSheet
            type={type}
            selecao={selecao}
            onChangeSelecao={(v) => { setSelecao(v); setUltimaUsada(false); if (persistido) agendarSalvar(); }}
            legado={legado}
            onChangeLegado={(v) => { setLegado(v); setUltimaUsada(false); if (persistido) agendarSalvar(); }}
            categoriasLegado={categoriasLegado}
            productId={productId || undefined}
            onClose={() => setCatSheet(false)}
          />
        )}
      </View>

      {confirmarSaida && (
        <View style={s.exitOverlay}>
          <View style={s.exitCard}>
            <Text style={s.exitTitle}>Descartar este cadastro?</Text>
            <Text style={s.exitMsg}>
              {"Você começou a cadastrar um " + nomeDoTipo(type) + ". Se sair agora, o que preencheu será perdido."}
            </Text>
            <View style={s.exitActions}>
              <Pressable style={s.exitStay} onPress={() => setConfirmarSaida(false)}>
                <Text style={s.exitStayTxt}>Continuar</Text>
              </Pressable>
              <Pressable style={s.exitLeave} onPress={() => { setConfirmarSaida(false); onClose(); }}>
                <Text style={s.exitLeaveTxt}>Descartar e sair</Text>
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
    width: "100%", maxWidth: 720, maxHeight: "94%",
    borderRadius: 18, overflow: "hidden", flexDirection: "column",
  },
  panelNarrow: {
    maxWidth: undefined as any, maxHeight: "93%",
    borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 13,
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
  stepBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 22, paddingVertical: 12,
    backgroundColor: IS_DARK_MODE ? "rgba(0,0,0,0.18)" : "rgba(124,58,237,0.04)",
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)",
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.06)" : "rgba(109,40,217,0.06)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.1)" : "rgba(109,40,217,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500" },
  stepSep: {
    width: 28, height: 1.5, marginHorizontal: 4,
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.1)" : "rgba(109,40,217,0.18)",
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 12 },
  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
    paddingHorizontal: 22, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: IS_DARK_MODE ? "rgba(0,0,0,0.18)" : "rgba(124,58,237,0.04)",
  },
  footerNarrow: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  footerInfo: { flex: 1, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
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

export default ItemWizardModal;
