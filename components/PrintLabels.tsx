import { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { companiesApi, pdvSettingsApi } from "@/services/api";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { lerConfigDoCartao, precoNoCartaoDoItem } from "@/utils/precoNoCartao";
import { readMatconSettings } from "@/constants/matcon";
import { ehIphoneInstalado } from "@/services/instalarApp";
import { avisarImpressaoNoIphone } from "@/components/ImpressaoNoIphone";
import { hexToName } from "@/utils/colorNames";
import {
  buildLabelHtml, buildLabelName, validateLabelItems, isValidEAN13, generateEAN13, LABEL_SIZE_PRESETS, LABEL_SIZE_KEYS, DEFAULT_LABEL_SIZE,
  buildLabelTestHtml, buildLabelPreviewHtml, labelPreviewGeometry, labelSupportsCalibration, buildCustomLabelTestHtml,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import {
  loadLabelPrinterPrefs, saveLabelPrinterPrefs, defaultLabelPrinterPrefs, labelPrinterBuildOptions, loadAllLabelPrinterPrefs, saveAllLabelPrinterPrefs,
  sanitizeLabelPrinterPrefs, isDefaultLabelPrinterPrefs, type LabelPrinterPrefs, type LabelPrinterPrefsMap,
} from "@/components/screens/estoque/labels/labelPrinterPrefs";
// 15/10/2026: medidas e calibração salvas na CONTA (pdv_settings).
import {
  planoDaConta, criarGravadorDaConta, marcarMigracao, medidasParaConta, calibracaoParaConta, MAX_MEDIDAS_NA_CONTA,
  CHAVE_MEDIDAS, CHAVE_CALIBRACAO, type PatchEtiquetaNaConta,
} from "@/components/screens/estoque/labels/labelAccountSync";
import { LabelPrinterCalibration, mmBr } from "@/components/screens/estoque/labels/LabelPrinterCalibration";
import { LabelPreviewModal } from "@/components/screens/estoque/labels/LabelPreviewModal";
import { WebPortal } from "@/components/WebPortal";
import { defaultLabelQty, unitLabelForList } from "@/components/screens/estoque/labels/labelDefaults";
// 30/10/2026 (card p-72): variantes de varios produtos numa chamada (p-73).
import { buscarVariantesEmLote, emPedacos, comLimite, MAX_IDS_POR_LOTE, CONCORRENCIA_POR_PRODUTO } from "@/components/screens/estoque/labels/variantesEmLote";
// 30/10/2026 (card p-75): gerar código para quem está sem código (p-74).
import { sondarGerarCodigos, gerarCodigos, alvosSemCodigo, chaveDoAlvo, type AlvoCodigo, type ResultadoGerar } from "@/components/screens/estoque/labels/gerarCodigos";
// 15/10/2026: "Minha medida" (medida livre em mm, por computador).
import { customLabelPreset, rotuloDaMedida, mmTxt, type CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";
import { nomeDaLojaDaEmpresa, mostrarNomeDaLoja } from "@/components/screens/estoque/labels/nomeDaLoja";
import { lerMinhasMedidas, salvarMedida, apagarMedida, escolherMedida, substituirMedidas } from "@/components/screens/estoque/labels/customLabelStorage";
import { MinhaMedidaWizard } from "@/components/screens/estoque/labels/MinhaMedidaWizard";
import { DesenhoDaEtiquetaLinha } from "@/components/screens/estoque/DesenhoDaEtiquetaLinha";
import {
  filtrarEtiquetas, categoriasDe, filtrosAtivos, lerOrdemEtiquetas, salvarOrdemEtiquetas,
  lerSoComEstoque, salvarSoComEstoque, variantesParaMarcar, estoqueDaVariante, FILTRO_PADRAO,
  produtoSemCodigo, varianteSemCodigo,
  ORDENS_ETIQUETAS, PERIODOS, diaParaBr, hojeEmSaoPaulo, diasComCadastro, marcasDoCalendario, type PeriodoCadastro,
} from "@/utils/etiquetasFiltro";
import { CalendarioDoDia } from "@/components/CalendarioDoDia";
import type { OrdemEstoque } from "@/utils/productSort";
import type { LabelItem, InvalidCodeItem, LabelSizeKey } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { Product } from "@/components/screens/estoque/types";

type Props = {
  products: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  // 18/10/2026 (card p-36): quem abre Configurações vê o "mudar" na linha do
  // desenho. Vem do Estoque (useVisibleModules), que já tem o QueryClient.
  podeMudarDesenho?: boolean;
};

type EAN13Entry = { name: string; originalCode: string; generated: string; productId?: string; variantId?: string };

var SIZE_ATTRS = new Set(["tamanho", "size", "tam", "tam.", "variacao", "variacao", "medida", "numero", "num", "numeracao", "n"]);
var COLOR_ATTRS = new Set(["cor", "color", "colour"]);

function variantSizeColor(v: any): { size: string; color: string } {
  var size = ""; var color = "";
  var attrs = v.attributes || [];
  for (var a of attrs) {
    var val = String(a.value || "").trim();
    if (!val) continue;
    var attr = (a.attribute || a.attribute_name || "").toLowerCase().trim();
    if (SIZE_ATTRS.has(attr) && !size) size = val;
    else if ((COLOR_ATTRS.has(attr) || /^#[0-9a-fA-F]{6}$/.test(val)) && !color) color = val;
  }
  if (!size) {
    for (var b of attrs) {
      var bval = String(b.value || "").trim();
      if (!bval) continue;
      var battr = (b.attribute || b.attribute_name || "").toLowerCase().trim();
      if (COLOR_ATTRS.has(battr)) continue;
      if (/^#[0-9a-fA-F]{6}$/.test(bval)) continue;
      size = bval;
      break;
    }
  }
  return { size: size, color: color };
}

var COLOR_NAME_TO_HEX: Record<string, string> = {
  preto: "#000000", branco: "#ffffff", vermelho: "#ef4444", azul: "#3b82f6",
  verde: "#22c55e", amarelo: "#eab308", rosa: "#ec4899", roxo: "#8b5cf6",
  laranja: "#f97316", marrom: "#92400e", bege: "#d4b896", cinza: "#6b7280",
  prata: "#c0c0c0", dourado: "#d4a017", nude: "#e8c4a0", caramelo: "#c68e4e",
  "bordo": "#800020", vinho: "#722f37", "azul escuro": "#1e3a5f", "verde agua": "#7fffd4",
};

// 22/10/2026: código interno (SKU) do produto, o mesmo que o Estoque mostra
// na coluna de código. Só o desenho "tag vertical" imprime ("Cód: 221");
// os outros desenhos ignoram o campo e saem byte a byte como antes.
function skuDoProduto(p: Product): string {
  return String((p as any).sku || p.code || "").trim();
}

// 30/10/2026: estoque na lista ("12,5 em estoque").
function numBr(n: number): string {
  return String(Math.round(Number(n) * 1000) / 1000).replace(".", ",");
}

function colorNameToHex(name: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(name)) return name;
  var hexMatch = name.match(/#[0-9a-fA-F]{6}/);
  if (hexMatch) return hexMatch[0];
  return COLOR_NAME_TO_HEX[name.toLowerCase().trim()] || null;
}

var LABEL_SIZE_STORAGE_KEY = "aura_label_print_size";
var LABEL_SIZE_OPTIONS: LabelSizeKey[] = LABEL_SIZE_KEYS;

// Toggle manual com memoria: le a ultima escolha do navegador (web only).
// Sem preferencia salva ainda -> cai no DEFAULT_LABEL_SIZE (99x21, formato
// atual da Finesse), entao clientes existentes nao mudam de comportamento.
function loadStoredLabelSize(): LabelSizeKey {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    var stored = window.localStorage.getItem(LABEL_SIZE_STORAGE_KEY);
    if (stored && (LABEL_SIZE_KEYS as string[]).indexOf(stored) >= 0) return stored as LabelSizeKey;
  }
  return DEFAULT_LABEL_SIZE;
}

// 30/10/2026 (QA a 375 px): no celular a barra de impressao vira um bloco do
// proprio shell, entre a area que rola e a barra de navegacao de baixo
// (app/(tabs)/_layout.tsx, ramo "Web narrow": topbar, div que rola com a
// <PageTransition>, <MBar/>). Por que nao position:fixed/sticky aqui dentro:
// · a div da PageTransition fica com transform (animacao com `forwards`), que
//   vira o bloco de referencia do fixed — ele andaria junto com a pagina;
// · a ScrollView do Estoque tem overflow proprio e cresce com o conteudo, entao
//   o sticky gruda nela e nunca na tela;
// · um portal no document.body ficaria por cima de tudo do app (cada View do
//   RNW nasce com z-index 0), inclusive do menu "Mais" da barra de baixo.
// Como irma da area que rola, a barra fica sempre logo acima da barra de
// navegacao (sem precisar saber a altura dela), a area que rola encolhe e o
// ultimo item da lista nunca fica escondido atras da barra. Fora desse shell
// (nativo, testes), devolve null e a barra fica no fim da tela, como antes.
export function acharVagaDaBarraNoCelular(el: any): { pai: HTMLElement; antes: Node | null } | null {
  if (!el || typeof el.closest !== "function" || typeof window === "undefined" || typeof window.getComputedStyle !== "function") return null;
  var transicao = el.closest(".aura-page-enter") as HTMLElement | null;
  var rolagem = transicao ? transicao.parentElement : null;
  var shell = rolagem ? rolagem.parentElement : null;
  if (!rolagem || !shell) return null;
  var estiloRolagem = window.getComputedStyle(rolagem);
  var rola = [estiloRolagem.overflowY, estiloRolagem.overflow].some(function(v) { return v === "auto" || v === "scroll"; });
  if (!rola) return null;
  var estiloShell = window.getComputedStyle(shell);
  if (estiloShell.display !== "flex" || estiloShell.flexDirection !== "column") return null;
  return { pai: shell, antes: rolagem.nextSibling };
}

export function PrintLabels({ products: produtosDoEstoque, selectedIds, onSelectionChange, podeMudarDesenho }: Props) {
  var { company, token } = useAuthStore();
  // 30/10/2026 (card p-75): codigo gerado aqui entra na hora (produto ->
  // barcode); a lista do Estoque pega o mesmo valor do cadastro ao recarregar.
  var [codigosGerados, setCodigosGerados] = useState<Record<string, string>>({});
  var products = useMemo(function() {
    if (Object.keys(codigosGerados).length === 0) return produtosDoEstoque;
    return produtosDoEstoque.map(function(p) { return codigosGerados[p.id] && !p.barcode ? { ...p, barcode: codigosGerados[p.id] } : p; });
  }, [produtosDoEstoque, codigosGerados]);
  // 22/09/2026 (preco no cartao): so a opcao da loja — desligada, nada muda.
  var { settings: pdvSettings } = usePdvSettings();
  var cartaoCfg = lerConfigDoCartao(pdvSettings);
  // 23/09/2026 (QA etiquetas): quantidade padrao = 1 pra fracionado/milheiro
  // SO com Matcon ligado — restricao do Caio (loja sem Matcon, incl. kg/L,
  // mantem o padrao de sempre = estoque).
  var matconEnabled = readMatconSettings(pdvSettings).matcon_enabled;
  // 18/10/2026 (card f1-16): desenho da etiqueta escolhido em Configuracoes
  // (pdv_settings.label_design). null/ausente = o padrao do modelo — o
  // buildLabelHtml sai byte a byte como antes da opcao.
  var labelDesign = pdvSettings.label_design;
  var [mode, setMode] = useState<"barcode" | "qr">("barcode");
  var [labelSize, setLabelSizeState] = useState<LabelSizeKey>(loadStoredLabelSize);
  var labelPreset = LABEL_SIZE_PRESETS[labelSize];
  // 24/09/2026: o modelo escolhido vira PRE-DEFINICAO DA LOJA
  // (pdv_settings.label_size) — vale em qualquer computador/celular da loja,
  // nao so no navegador onde foi escolhido. O localStorage continua como
  // espelho/fallback (loja que nunca salvou, ou sem conexao).
  function setLabelSize(key: LabelSizeKey) {
    setLabelSizeState(key);
    setSizeMenuOpen(false);
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try { window.localStorage.setItem(LABEL_SIZE_STORAGE_KEY, key); } catch (e) { /* sem storage */ }
    }
    if (company?.id) {
      pdvSettingsApi.save(company.id, { label_size: key } as any).then(function() {
        toast.success("Modelo " + LABEL_SIZE_PRESETS[key].uiLabel + " salvo como padrão da loja");
      }).catch(function() {
        toast.error("Não foi possível salvar o modelo como padrão — vale só neste navegador");
      });
    }
  }
  var [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  var [search, setSearch] = useState("");
  // 25/09/2026: filtros das etiquetas (utils/etiquetasFiltro). A ordem fica
  // lembrada no navegador; periodo/categoria/estoque recomecam a cada visita.
  var [ordem, setOrdemState] = useState<OrdemEstoque>(lerOrdemEtiquetas);
  var [periodo, setPeriodoState] = useState<PeriodoCadastro>("todos");
  // 25/09/2026: um dia escolhido no calendario (periodo "dia"). O app e PWA:
  // o calendario e o nosso (components/CalendarioDoDia, react-native-calendars),
  // igual em todo aparelho — o <input type=date> escondido nao abria de forma
  // confiavel no iPhone.
  var [dia, setDia] = useState<string | null>(null);
  function setPeriodo(pp: PeriodoCadastro) { setPeriodoState(pp); if (pp !== "dia") setDia(null); }
  function escolherDia(iso: string) {
    if (iso) { setDia(iso); setPeriodoState("dia"); }
    else setPeriodo("todos");
    setMenuFiltro(null);
  }
  var [categoria, setCategoria] = useState<string | null>(null);
  // 30/10/2026 (card p-71): "Só com estoque" ligado por padrão e lembrado
  // neste computador. Desligado mostra também os sem estoque.
  var [soComEstoque, setSoComEstoqueState] = useState<boolean>(lerSoComEstoque);
  function setSoComEstoque(v: boolean) { setSoComEstoqueState(v); salvarSoComEstoque(v); }
  // Categoria, Cadastrados e Ordenar ficam num único botão Filtros.
  var [filtrosAbertos, setFiltrosAbertos] = useState(false);
  var [menuFiltro, setMenuFiltro] = useState<"ordem" | "categoria" | "calendario" | null>(null);
  function setOrdem(o: OrdemEstoque) { setOrdemState(o); salvarOrdemEtiquetas(o); setMenuFiltro(null); }
  var [quantities, setQuantities] = useState<Record<string, number>>({});
  // 24/10/2026: null = a lojista nao mexeu no toggle neste modelo; vale o
  // padrao (desligado; ligado so na tag vertical — nomeDaLoja.ts).
  var [escolhaNomeDaLoja, setEscolhaNomeDaLoja] = useState<boolean | null>(null);
  var [variantCache, setVariantCache] = useState<Record<string, any[]>>({});
  var [selectedVariants, setSelectedVariants] = useState<Record<string, Set<string>>>({});
  var [includeParentInPrint, setIncludeParentInPrint] = useState<Record<string, boolean>>({});
  var [invalidCodes, setInvalidCodes] = useState<InvalidCodeItem[]>([]);

  // EAN-13 generation state
  var [showEan13Panel, setShowEan13Panel] = useState(false);
  var [ean13GenList, setEan13GenList] = useState<EAN13Entry[]>([]);
  var [pendingPrintItems, setPendingPrintItems] = useState<LabelItem[]>([]);

  var isWeb = Platform.OS === "web";
  // 24/10/2026: nome fantasia; backend antigo (sem trade_name) usa company.name.
  var storeName = nomeDaLojaDaEmpresa(company);

  // 26/08/2026: calibracao de offset por loja (causa raiz do corte recorrente
  // da Finesse — o ajuste vivia so no dialogo do Chrome e evaporava). O valor
  // persiste em pdv_settings.label_offset_mm; 0 = neutro (comportamento antigo).
  var [labelOffsetMm, setLabelOffsetMm] = useState(0);
  // 15/10/2026: o mesmo GET traz as medidas e a calibracao salvas na conta;
  // quem processa e o efeito de sincronia mais abaixo (contaLida).
  var [contaLida, setContaLida] = useState<{ cid: string; settings: any } | null>(null);
  useEffect(function() {
    setContaLida(null);
    if (!isWeb || !company?.id) return;
    var cid = company.id;
    pdvSettingsApi.get(cid).then(function(res) {
      var v = Number(res.settings && res.settings.label_offset_mm);
      if (Number.isFinite(v)) setLabelOffsetMm(v);
      // Modelo salvo da loja vence a escolha antiga do navegador.
      var sz = res.settings && (res.settings as any).label_size;
      if (sz && (LABEL_SIZE_KEYS as string[]).indexOf(sz) >= 0) setLabelSizeState(sz as LabelSizeKey);
      setContaLida({ cid: cid, settings: res && res.settings });
    }).catch(function() { /* sem calibracao salva -> neutro; medidas seguem no navegador */ });
  }, [isWeb, company?.id]);

  // A pagina de impressao (blob) envia o ajuste do slider via postMessage.
  // Validar forma + faixa: qualquer janela pode postar mensagem.
  useEffect(function() {
    if (!isWeb || !company?.id) return;
    var cid = company.id;
    function onMessage(e: MessageEvent) {
      var d: any = e.data;
      if (!d || d.type !== "aura:label-offset") return;
      var v = Number(d.value);
      if (!Number.isFinite(v) || v < -8 || v > 5) return;
      setLabelOffsetMm(v);
      pdvSettingsApi.save(cid, { label_offset_mm: v }).then(function() {
        toast.success("Calibração de etiqueta salva para a loja (" + v + "mm)");
      }).catch(function() {
        toast.error("Não foi possível salvar a calibração — o ajuste vale só para esta impressão");
      });
    }
    window.addEventListener("message", onMessage);
    return function() { window.removeEventListener("message", onMessage); };
  }, [isWeb, company?.id]);

  // 13/10/2026 (Divina D'Lux / Elgin L42 Pro): calibracao da IMPRESSORA —
  // modo continuo, passo entre linhas e deslocamento vertical. Fica neste
  // computador (localStorage por empresa e por modelo), nao no pdv_settings:
  // a impressora e do PC. So os modelos com vao entre linhas; no padrao nada
  // e passado ao buildLabelHtml e a etiqueta sai igual a de sempre.
  // 15/10/2026 — "Minha medida": a loja salva quantas medidas quiser, cada
  // uma com o proprio ajuste, NESTE computador e por empresa ativa
  // (customLabelStorage). medidaAtiva != null = a impressao usa a medida
  // livre; null = o modelo fixo de sempre (pdv_settings.label_size so
  // conhece os fixos). Medida que o navegador nao deixou guardar fica so
  // nesta visita (estado).
  // 15/10/2026 (pedido do Caio, "para nao perder a configuracao"): medidas e
  // calibracao passam a ter a CONTA como fonte (pdv_settings
  // label_custom_specs / label_printer_prefs, labelAccountSync.ts) e valem
  // para a loja inteira. O navegador vira cache: a tela abre com ele e troca
  // pelo da conta quando o GET volta. Backend sem as chaves (naConta=false):
  // tudo segue so no navegador, como antes. A medida escolhida por ultimo
  // continua por computador (preferencia de quem imprime).
  var [medidas, setMedidas] = useState<CustomLabelSpec[]>([]);
  var [medidaAtiva, setMedidaAtiva] = useState<CustomLabelSpec | null>(null);
  var [wizardMedida, setWizardMedida] = useState<{ inicial: CustomLabelSpec | null } | null>(null);
  var [apagandoMedida, setApagandoMedida] = useState<string | null>(null);
  var [naConta, setNaConta] = useState(false);
  // Espelhos para montar o estado INTEIRO que sobe para a conta (lista toda,
  // mapa de calibracao todo) sem depender do ciclo do setState.
  var medidasRef = useRef<CustomLabelSpec[]>([]);
  var calibracaoRef = useRef<LabelPrinterPrefsMap>({});
  var cidRef = useRef<string | null>(null);
  cidRef.current = company?.id || null;
  var gravadorRef = useRef<ReturnType<typeof criarGravadorDaConta> | null>(null);
  if (!gravadorRef.current) {
    gravadorRef.current = criarGravadorDaConta({
      salvar: function(cid, patch) { return pdvSettingsApi.saveLabelConfig(cid, patch); },
      aoFalhar: function() { toast.warning("Não deu para salvar na conta, tente de novo"); },
    });
  }
  // Saiu da tela com gravacao pendente: grava ja (nao perde o ultimo toque).
  useEffect(function() { return function() { if (gravadorRef.current) gravadorRef.current.descarregar(); }; }, []);
  function gravarNaConta(patch: PatchEtiquetaNaConta) {
    if (!naConta || !company?.id || !gravadorRef.current) return;
    gravadorRef.current.agendar(company.id, patch);
  }
  function mudarMedidas(lista: CustomLabelSpec[]) {
    medidasRef.current = lista;
    setMedidas(lista);
  }

  useEffect(function() {
    setNaConta(false);
    if (!isWeb) return;
    var lido = lerMinhasMedidas(company?.id);
    mudarMedidas(lido.medidas);
    setMedidaAtiva(lido.escolhida ? lido.medidas.find(function(m) { return m.id === lido.escolhida; }) || null : null);
    calibracaoRef.current = loadAllLabelPrinterPrefs(company?.id);
  }, [isWeb, company?.id]);

  // Sincronia com a conta (depois do GET de pdv_settings).
  useEffect(function() {
    if (!isWeb || !contaLida || contaLida.cid !== company?.id) return;
    var cid = contaLida.cid;
    var plano = planoDaConta(cid, contaLida.settings, { medidas: medidasRef.current, calibracao: calibracaoRef.current });
    if (plano.modo !== "conta") return; // backend antigo: so navegador
    setNaConta(true);
    if (plano.medidas) {
      // A conta vence: o cache do navegador vira a lista da conta.
      var ficou = substituirMedidas(cid, plano.medidas);
      mudarMedidas(ficou.medidas);
      setMedidaAtiva(ficou.escolhida ? ficou.medidas.find(function(m) { return m.id === ficou.escolhida; }) || null : null);
    }
    if (plano.calibracao) {
      saveAllLabelPrinterPrefs(cid, plano.calibracao);
      calibracaoRef.current = plano.calibracao;
      setPrinterPrefsState(sanitizeLabelPrinterPrefs(labelSize, plano.calibracao[labelSize]));
    }
    plano.marcarSemSubir.forEach(function(ch) { marcarMigracao(cid, ch); });
    var subir = plano.subir;
    if (Object.keys(subir).length > 0) {
      // Migracao unica: so sobe o que a conta ainda nao tem (null).
      pdvSettingsApi.saveLabelConfig(cid, subir).then(function() {
        if (subir.label_custom_specs) marcarMigracao(cid, CHAVE_MEDIDAS);
        if (subir.label_printer_prefs) marcarMigracao(cid, CHAVE_CALIBRACAO);
      }).catch(function() { /* tenta de novo na proxima visita */ });
    }
  }, [isWeb, contaLida, company?.id]);

  var nomeDoModelo = medidaAtiva ? rotuloDaMedida(medidaAtiva) : labelPreset.uiLabel;
  var showStoreName = mostrarNomeDaLoja(escolhaNomeDaLoja, medidaAtiva, mode);
  // Trocou de modelo ou de medida: o toggle volta ao padrao daquele modelo.
  var idDaMedidaAtiva = medidaAtiva ? medidaAtiva.id : null;
  useEffect(function() { setEscolhaNomeDaLoja(null); }, [labelSize, idDaMedidaAtiva]);
  var customOpts = medidaAtiva ? { customSpec: medidaAtiva } : {};
  var ondeFica = naConta ? "da conta" : "deste computador";

  function escolherModeloFixo(key: LabelSizeKey) {
    if (medidaAtiva) { setMedidaAtiva(null); escolherMedida(company?.id, null); }
    setLabelSize(key);
  }
  function escolherMinhaMedida(m: CustomLabelSpec) {
    setMedidaAtiva(m);
    setSizeMenuOpen(false);
    escolherMedida(company?.id, m.id);
  }
  function abrirNovaMedida() {
    setSizeMenuOpen(false);
    if (naConta && medidasRef.current.length >= MAX_MEDIDAS_NA_CONTA) {
      toast.warning("A conta guarda até " + MAX_MEDIDAS_NA_CONTA + " medidas. Apague uma que não usa para criar outra.");
      return;
    }
    setWizardMedida({ inicial: null });
  }
  function salvarMinhaMedida(m: CustomLabelSpec): boolean {
    var r = salvarMedida(company?.id, m);
    var salva = r.medida || m;
    var achou = false;
    var lista = medidasRef.current.map(function(x) { if (x.id !== salva.id) return x; achou = true; return salva; });
    if (!achou) lista = lista.concat([salva]);
    mudarMedidas(lista);
    setMedidaAtiva(salva);
    escolherMedida(company?.id, salva.id);
    if (naConta) {
      gravarNaConta({ label_custom_specs: medidasParaConta(lista) });
      return true; // vai para a conta; se a rede falhar, o aviso aparece
    }
    if (!r.guardou) toast.error("Não consegui guardar a medida neste computador — ela vale até você fechar a Aura");
    return r.guardou;
  }
  function confirmarApagarMedida(id: string) {
    var guardou = apagarMedida(company?.id, id);
    var lista = medidasRef.current.filter(function(x) { return x.id !== id; });
    mudarMedidas(lista);
    if (medidaAtiva && medidaAtiva.id === id) setMedidaAtiva(null);
    setApagandoMedida(null);
    if (naConta) {
      gravarNaConta({ label_custom_specs: medidasParaConta(lista) });
      toast.success("Medida apagada");
    } else if (guardou) toast.success("Medida apagada deste computador");
  }

  var temCalibracao = isWeb && !medidaAtiva && labelSupportsCalibration(labelSize);
  var [printerPrefs, setPrinterPrefsState] = useState<LabelPrinterPrefs>(function() { return defaultLabelPrinterPrefs(labelSize); });
  useEffect(function() {
    setPrinterPrefsState(isWeb ? loadLabelPrinterPrefs(company?.id, labelSize) : defaultLabelPrinterPrefs(labelSize));
  }, [isWeb, company?.id, labelSize]);
  function setPrinterPrefs(next: LabelPrinterPrefs) {
    setPrinterPrefsState(next);
    saveLabelPrinterPrefs(company?.id, labelSize, next);
    var mapa: LabelPrinterPrefsMap = Object.assign({}, calibracaoRef.current);
    var limpo = sanitizeLabelPrinterPrefs(labelSize, next);
    if (isDefaultLabelPrinterPrefs(labelSize, limpo)) delete mapa[labelSize]; else mapa[labelSize] = limpo;
    calibracaoRef.current = mapa;
    gravarNaConta({ label_printer_prefs: calibracaoParaConta(mapa) });
  }
  var printerOpts = temCalibracao ? labelPrinterBuildOptions(labelSize, printerPrefs) : {};
  var [preview, setPreview] = useState<{ html: string; widthMm: number; heightMm: number; labels: number } | null>(null);

  var productsWithCode = useMemo(
    function() { return products.filter(function(p) { return p.barcode || p.code; }); }, [products]);

  var filtroAtual = { busca: search, ordem: ordem, periodo: periodo, dia: dia, categoria: categoria, soComEstoque: soComEstoque };
  var filtered = useMemo(function() {
    return filtrarEtiquetas(productsWithCode, filtroAtual);
  }, [productsWithCode, search, ordem, periodo, dia, categoria, soComEstoque]);
  var categorias = useMemo(function() { return categoriasDe(productsWithCode); }, [productsWithCode]);
  var diasCadastro = useMemo(function() { return diasComCadastro(productsWithCode); }, [productsWithCode]);
  var nFiltros = filtrosAtivos(filtroAtual);
  function limparFiltros() {
    setPeriodo("todos"); setCategoria(null); setMenuFiltro(null);
    if (ordem !== FILTRO_PADRAO.ordem) { setOrdemState(FILTRO_PADRAO.ordem); salvarOrdemEtiquetas(FILTRO_PADRAO.ordem); }
  }

  function getQty(key: string) { return quantities[key] || 1; }
  function setQty(key: string, n: number) { setQuantities(function(prev) { return { ...prev, [key]: Math.max(1, Math.min(999, n)) }; }); }

  // 30/10/2026 (card p-72): variantes carregadas ao abrir ("Ver variantes"),
  // ao marcar e, com o backend novo (p-73), em lote para a lista visivel.
  // Carregar NAO marca: so marca quem foi marcado (marcarAoCarregar).
  // Backend antigo: uma chamada por produto, no maximo 4 ao mesmo tempo.
  var loteRef = useRef<"desconhecido" | "sim" | "nao">("desconhecido");
  var carregandoRef = useRef<Set<string>>(new Set());
  var marcarAoCarregarRef = useRef<Set<string>>(new Set());
  var soComEstoqueRef = useRef(soComEstoque);
  soComEstoqueRef.current = soComEstoque;
  // Empresa ativa (multi-CNPJ): trocou de empresa, nada carregado vale.
  var cidDoCacheRef = useRef<string | null>(company?.id || null);
  if (cidDoCacheRef.current !== (company?.id || null)) {
    cidDoCacheRef.current = company?.id || null;
    loteRef.current = "desconhecido";
    carregandoRef.current = new Set();
    marcarAoCarregarRef.current = new Set();
  }

  function aplicarVariantes(cid: string, mapa: Record<string, any[]>) {
    if (cid !== cidDoCacheRef.current) return; // resposta de outra empresa
    var ativos: Record<string, any[]> = {};
    var newQtys: Record<string, number> = {};
    Object.keys(mapa).forEach(function(pid) {
      carregandoRef.current.delete(pid);
      var active = (mapa[pid] || []).filter(function(v: any) { return v.is_active !== false; });
      ativos[pid] = active;
      var prod = products.find(function(pr) { return pr.id === pid; });
      var productUnit = prod ? prod.unit : undefined;
      // Quantidade de hoje: o estoque da variante (sem estoque = 1), com a
      // excecao de unidade fracionada/milheiro do Matcon.
      active.forEach(function(v: any) { var stock = parseInt(v.stock_qty) || 1; newQtys[pid + "__" + v.id] = defaultLabelQty(productUnit, stock, matconEnabled); });
    });
    setVariantCache(function(prev) { return { ...prev, ...ativos }; });
    setQuantities(function(prev) {
      var n = { ...prev };
      Object.keys(newQtys).forEach(function(k) { if (n[k] == null) n[k] = newQtys[k]; });
      return n;
    });
    Object.keys(ativos).forEach(function(pid) {
      if (!marcarAoCarregarRef.current.has(pid)) return;
      marcarAoCarregarRef.current.delete(pid);
      if (ativos[pid].length > 0) marcarVariantesPadrao(pid, ativos[pid], soComEstoqueRef.current);
    });
  }

  function carregarVariantes(ids: string[], soEmLote?: boolean) {
    var cid = company?.id;
    if (!cid) return;
    var faltam = ids.filter(function(id) {
      if (variantCache[id] || carregandoRef.current.has(id)) return false;
      var pr = products.find(function(x) { return x.id === id; });
      return !!(pr && pr.has_variants);
    });
    if (faltam.length === 0) return;
    if (loteRef.current === "nao") {
      if (soEmLote) return;
      porProduto(cid, faltam);
      return;
    }
    faltam.forEach(function(id) { carregandoRef.current.add(id); });
    emPedacos(faltam, MAX_IDS_POR_LOTE).forEach(function(pedaco) {
      buscarVariantesEmLote(cid as string, pedaco).then(function(mapa) {
        loteRef.current = "sim";
        aplicarVariantes(cid as string, mapa);
      }).catch(function() {
        // Rota ausente (backend antigo) ou falha: caminho por produto.
        loteRef.current = "nao";
        pedaco.forEach(function(id) { carregandoRef.current.delete(id); });
        if (cid !== cidDoCacheRef.current) return;
        var pedidos = soEmLote ? pedaco.filter(function(id) { return marcarAoCarregarRef.current.has(id) || abertosRef.current[id]; }) : pedaco;
        if (pedidos.length > 0) porProduto(cid as string, pedidos);
      });
    });
  }

  function porProduto(cid: string, ids: string[]) {
    ids.forEach(function(id) { carregandoRef.current.add(id); });
    comLimite(ids.map(function(id) {
      return function() {
        return companiesApi.variants(cid, id).then(function(res: any) {
          aplicarVariantes(cid, { [id]: (res && res.variants) || [] });
        }).catch(function() { aplicarVariantes(cid, { [id]: [] }); });
      };
    }), CONCORRENCIA_POR_PRODUTO);
  }

  function fetchVariantsIfNeeded(productId: string) { carregarVariantes([productId]); }

  function marcarVariantesPadrao(productId: string, active: any[], comEstoque: boolean) {
    // p-75: variante sem codigo (nem o produto tem) nao vem marcada.
    var dono = products.find(function(pr) { return pr.id === productId; });
    var comCodigo = dono ? active.filter(function(v: any) { return !varianteSemCodigo(v, dono as Product); }) : active;
    var varIds = new Set(variantesParaMarcar(comCodigo, comEstoque));
    setSelectedVariants(function(prev) { return { ...prev, [productId]: varIds }; });
  }

  // "Ver variantes": abre o produto sem marcar.
  var [abertos, setAbertos] = useState<Record<string, boolean>>({});
  var abertosRef = useRef(abertos);
  abertosRef.current = abertos;
  function alternarAberto(id: string) {
    var abrir = !abertos[id];
    setAbertos(function(prev) { return { ...prev, [id]: abrir }; });
    if (abrir) fetchVariantsIfNeeded(id);
  }

  // Lista visivel: com o lote disponivel, as variantes chegam antes do toque
  // (o estoque de cada uma ja aparece ao abrir). Sem lote, so sob demanda.
  var idsComVariantesVisiveis = filtered.filter(function(p) { return p.has_variants; }).map(function(p) { return p.id; }).join(",");
  useEffect(function() {
    if (!idsComVariantesVisiveis) return;
    carregarVariantes(idsComVariantesVisiveis.split(","), true);
  }, [idsComVariantesVisiveis, company?.id]);

  function desmarcarProduto(id: string) {
    marcarAoCarregarRef.current.delete(id);
    setSelectedVariants(function(prev) { var n = { ...prev }; delete n[id]; return n; });
    setIncludeParentInPrint(function(prev) { var n = { ...prev }; delete n[id]; return n; });
  }

  function marcarProduto(id: string) {
    var p = products.find(function(pr) { return pr.id === id; });
    if (p && p.has_variants) {
      // Variantes ja carregadas: marca o padrao ja; senao, ao chegar.
      if (variantCache[id]) { if (variantCache[id].length > 0) marcarVariantesPadrao(id, variantCache[id], soComEstoque); }
      else { marcarAoCarregarRef.current.add(id); fetchVariantsIfNeeded(id); }
    }
    if (!quantities[id] && p) setQty(id, defaultLabelQty(p.unit, p.stock, matconEnabled));
  }

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(function(i) { return i !== id; }));
      desmarcarProduto(id);
    } else {
      onSelectionChange([...selectedIds, id]);
      marcarProduto(id);
      var p = products.find(function(pr) { return pr.id === id; });
      if (p && p.has_variants) setAbertos(function(prev) { return { ...prev, [id]: true }; });
    }
  }

  // Marca/desmarca o produto pela etiqueta do pai; nao mexe nas variantes.
  function toggleIncludeParent(productId: string) {
    var liga = !includeParentInPrint[productId];
    setIncludeParentInPrint(function(prev) { return { ...prev, [productId]: liga }; });
    var vars = selectedVariants[productId];
    if (liga && !selectedIds.includes(productId)) {
      setSelectedVariants(function(prev) { return { ...prev, [productId]: prev[productId] || new Set() }; });
      onSelectionChange([...selectedIds, productId]);
    } else if (!liga && selectedIds.includes(productId) && (!vars || vars.size === 0)) {
      onSelectionChange(selectedIds.filter(function(i) { return i !== productId; }));
    }
  }

  // Marcar uma variante na mao marca o produto; desmarcar a ultima (sem a
  // etiqueta do pai) desmarca o produto.
  function toggleVariant(productId: string, variantId: string) {
    var current = new Set(selectedIds.includes(productId) ? (selectedVariants[productId] || []) : []);
    if (current.has(variantId)) current.delete(variantId); else current.add(variantId);
    setSelectedVariants(function(prev) { return { ...prev, [productId]: current }; });
    if (current.size > 0 && !selectedIds.includes(productId)) {
      marcarAoCarregarRef.current.delete(productId);
      onSelectionChange([...selectedIds, productId]);
    } else if (current.size === 0 && selectedIds.includes(productId) && !includeParentInPrint[productId]) {
      onSelectionChange(selectedIds.filter(function(i) { return i !== productId; }));
    }
  }

  // "Marcar todos" vale so para o que esta na lista (com o interruptor
  // ligado, as variantes com estoque).
  function toggleAll() {
    var ids = marcaveis.map(function(p) { return p.id; });
    if (ids.every(function(id) { return selectedIds.includes(id); })) {
      onSelectionChange(selectedIds.filter(function(id) { return !ids.includes(id); }));
      ids.forEach(desmarcarProduto);
    } else {
      var novos = ids.filter(function(id) { return !selectedIds.includes(id); });
      onSelectionChange(selectedIds.concat(novos));
      var semCache = novos.filter(function(id) {
        var p = products.find(function(pr) { return pr.id === id; });
        return !!(p && p.has_variants && !variantCache[id]);
      });
      semCache.forEach(function(id) { marcarAoCarregarRef.current.add(id); });
      novos.forEach(function(id) {
        var p = products.find(function(pr) { return pr.id === id; });
        if (p && p.has_variants && variantCache[id] && variantCache[id].length > 0) marcarVariantesPadrao(id, variantCache[id], soComEstoque);
        if (!quantities[id] && p) setQty(id, defaultLabelQty(p.unit, p.stock, matconEnabled));
      });
      carregarVariantes(semCache);
    }
  }

  var totalLabels = useMemo(function() {
    var total = 0;
    selectedIds.forEach(function(id) {
      var variants = variantCache[id] || []; var selVars = selectedVariants[id];
      var hasAnyVariant = variants.length > 0;
      if (hasAnyVariant) {
        if (selVars && selVars.size > 0) { selVars.forEach(function(vid) { total += getQty(id + "__" + vid); }); }
        if (includeParentInPrint[id]) { total += getQty(id); }
      } else {
        total += getQty(id);
      }
    });
    return total;
  }, [selectedIds, quantities, selectedVariants, variantCache, includeParentInPrint]);

  // ── Sem codigo (30/10/2026, card p-75) ─────────────────────
  // Produto sem codigo de barras e sem SKU nao sai na etiqueta: aparece como
  // "Sem codigo", fica fora do Marcar todos e ganha "Gerar codigo".
  function ehSimples(p: Product) { return !p.has_variants || (!!variantCache[p.id] && variantCache[p.id].length === 0); }
  function marcavel(p: Product) { return !(ehSimples(p) && produtoSemCodigo(p)); }
  var marcaveis = filtered.filter(marcavel);
  function nomeDaVariante(p: any, v: any) { var sc = variantSizeColor(v); return buildLabelName(p.name, sc.size, sc.color); }

  // A rota existe (backend p-74) e a pessoa pode editar produto? Sem isso o
  // botao nao aparece. So pergunta quando ha alguem sem codigo.
  var [podeGerar, setPodeGerar] = useState(false);
  var temSemCodigo = useMemo(function() { return products.some(produtoSemCodigo); }, [products]);
  useEffect(function() {
    setPodeGerar(false);
    if (!company?.id || !temSemCodigo) return;
    var cid = company.id; var vivo = true;
    sondarGerarCodigos(cid).then(function(ok) { if (vivo && cid === cidDoCacheRef.current) setPodeGerar(ok); });
    return function() { vivo = false; };
  }, [company?.id, temSemCodigo]);

  // Escopo do "Gerar codigo de todos": o que a busca, a categoria e o periodo
  // mostram, com ou sem estoque (a escolha fica no modal).
  var listaSemFiltroDeEstoque = useMemo(function() {
    return soComEstoque ? filtrarEtiquetas(productsWithCode, { ...filtroAtual, soComEstoque: false }) : filtered;
  }, [productsWithCode, search, ordem, periodo, dia, categoria, soComEstoque, filtered]);
  var alvosDoEscopo = useMemo(function() { return alvosSemCodigo(listaSemFiltroDeEstoque, variantCache, nomeDaVariante); }, [listaSemFiltroDeEstoque, variantCache]);
  var produtosSemCodigoNaLista = useMemo(function() {
    var ids = new Set(alvosSemCodigo(filtered, variantCache, nomeDaVariante).map(function(a) { return a.product_id; }));
    return ids.size;
  }, [filtered, variantCache]);

  type ModalCodigo = { unico: AlvoCodigo | null; opcao: "com" | "todos"; previa: ResultadoGerar | null; carregando: boolean; gravando: boolean; erro: string | null };
  var [modalCodigo, setModalCodigo] = useState<ModalCodigo | null>(null);
  var previaPedida = useRef(0);
  function alvosDoModal(m: ModalCodigo): AlvoCodigo[] {
    if (m.unico) return [m.unico];
    return m.opcao === "com" ? alvosDoEscopo.filter(function(a) { return a.comEstoque; }) : alvosDoEscopo;
  }
  function pedirPrevia(m: ModalCodigo) {
    var cid = company?.id; if (!cid) return;
    var alvos = alvosDoModal(m);
    var n = ++previaPedida.current;
    setModalCodigo({ ...m, previa: null, carregando: alvos.length > 0, erro: null });
    if (alvos.length === 0) return;
    // A previa mostra os primeiros; os outros saem na mesma sequencia.
    gerarCodigos(cid, alvos.slice(0, 500), true).then(function(r) {
      if (n !== previaPedida.current) return;
      setModalCodigo(function(prev) { return prev ? { ...prev, previa: r, carregando: false } : prev; });
    }).catch(function(e: any) {
      if (n !== previaPedida.current) return;
      if (e && e.status === 403) setPodeGerar(false);
      setModalCodigo(function(prev) { return prev ? { ...prev, carregando: false, erro: e && e.status === 403 ? "Só quem pode editar produtos consegue gerar códigos. Peça para o responsável pela loja." : "Não consegui preparar os códigos agora. Tente de novo em instantes." } : prev; });
    });
  }
  function abrirGerarUm(a: AlvoCodigo) { pedirPrevia({ unico: a, opcao: "todos", previa: null, carregando: true, gravando: false, erro: null }); }
  function abrirGerarTodos() {
    var temCom = alvosDoEscopo.some(function(a) { return a.comEstoque; });
    pedirPrevia({ unico: null, opcao: temCom ? "com" : "todos", previa: null, carregando: true, gravando: false, erro: null });
  }
  function aplicarCodigos(itens: Array<{ product_id: string; variant_id: string | null; barcode: string }>) {
    var deProduto: Record<string, string> = {};
    var deVariante: Record<string, Record<string, string>> = {};
    itens.forEach(function(it) {
      if (!it || !it.barcode) return;
      if (it.variant_id) { (deVariante[it.product_id] = deVariante[it.product_id] || {})[it.variant_id] = it.barcode; }
      else deProduto[it.product_id] = it.barcode;
    });
    if (Object.keys(deProduto).length) setCodigosGerados(function(prev) { return { ...prev, ...deProduto }; });
    if (Object.keys(deVariante).length) {
      setVariantCache(function(prev) {
        var n = { ...prev };
        Object.keys(deVariante).forEach(function(pid) {
          if (!n[pid]) return;
          n[pid] = n[pid].map(function(v: any) { var b = deVariante[pid][v.id]; return b && !v.barcode ? { ...v, barcode: b } : v; });
        });
        return n;
      });
    }
  }
  function gravarCodigos() {
    var cid = company?.id; if (!cid || !modalCodigo) return;
    var m = modalCodigo;
    var alvos = alvosDoModal(m);
    if (alvos.length === 0) return;
    setModalCodigo({ ...m, gravando: true, erro: null });
    gerarCodigos(cid, alvos, false).then(function(r) {
      aplicarCodigos(r.items);
      setModalCodigo(null);
      var n = r.items.length;
      if (n === 1 && m.unico) toast.success("Código " + r.items[0].barcode + " guardado no cadastro de " + m.unico.nome + ".");
      else if (n > 0) toast.success(n + (n === 1 ? " código gerado e guardado" : " códigos gerados e guardados") + " no cadastro.");
      else toast.info("Esses produtos já tinham código. Nada mudou.");
    }).catch(function(e: any) {
      if (e && e.status === 403) setPodeGerar(false);
      setModalCodigo(function(prev) { return prev ? { ...prev, gravando: false, erro: e && e.status === 403 ? "Só quem pode editar produtos consegue gerar códigos. Peça para o responsável pela loja." : "Não consegui guardar os códigos. Nada foi perdido; tente de novo." } : prev; });
    });
  }

  // "Mostrar" do aviso de marcados fora da lista: tira busca e filtros (sem
  // mexer na escolha lembrada do interruptor).
  function mostrarTudo() {
    setSearch(""); setPeriodo("todos"); setCategoria(null); setMenuFiltro(null);
    setSoComEstoqueState(false);
  }

  // Modal aberto (para o JSX nao perder o tipo dentro das funcoes).
  var mc = modalCodigo as ModalCodigo; // so usado com modalCodigo != null

  // Barra fixa (p-72): quantos produtos entram no total e quantos marcados
  // estao fora da lista por causa do filtro (continuam no total).
  var idsNaLista = useMemo(function() { return new Set(filtered.map(function(p) { return p.id; })); }, [filtered]);
  var produtosNoTotal = selectedIds.filter(function(id) { return products.some(function(pr) { return pr.id === id; }); }).length;
  var foraDaLista = selectedIds.filter(function(id) { return !idsNaLista.has(id) && products.some(function(pr) { return pr.id === id; }); }).length;
  var larguraTela = useWindowDimensions().width;
  var estreita = larguraTela < 520;

  // 30/10/2026 (QA a 375 px): no celular a barra vai para a vaga do shell
  // (ver acharVagaDaBarraNoCelular). No desktop nada muda: sticky no fim.
  var raizRef = useRef<any>(null);
  var [vagaDaBarra, setVagaDaBarra] = useState<HTMLElement | null>(null);
  useEffect(function() {
    if (!isWeb || !estreita || typeof document === "undefined") { setVagaDaBarra(null); return; }
    var vaga = acharVagaDaBarraNoCelular(raizRef.current);
    if (!vaga) { setVagaDaBarra(null); return; }
    var div = document.createElement("div");
    div.className = "aura-etiquetas-barra";
    div.style.flexShrink = "0";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    vaga.pai.insertBefore(div, vaga.antes);
    setVagaDaBarra(div);
    return function() {
      setVagaDaBarra(null);
      try { if (div.parentNode) div.parentNode.removeChild(div); } catch {}
    };
  }, [isWeb, estreita]);

  // 22/09/2026 (preco no cartao): com a opcao da loja ligada, toda etiqueta
  // sai com os dois precos (sem opcao de esconder). `comCartao` devolve {}
  // com ela desligada — o LabelItem e o de sempre.
  function comCartao(preco: number, p: Product): { cardPrice?: number } {
    var card = precoNoCartaoDoItem(preco, { price: p.price, cardPrice: p.cardPrice }, cartaoCfg);
    return card != null ? { cardPrice: card } : {};
  }

  // 23/09/2026 (QA etiquetas, item 4): mesmo calculo do comCartao, so pra
  // exibir na lista (discreto, ao lado do preco em dinheiro) — nao entra na
  // etiqueta impressa (isso ja e o comCartao acima).
  function cardPriceFor(preco: number, p: Product): number | null {
    return precoNoCartaoDoItem(preco, { price: p.price, cardPrice: p.cardPrice }, cartaoCfg);
  }

  // Monta a lista de LabelItems a partir da selecao atual
  function buildItems(): LabelItem[] | null {
    var items: LabelItem[] = [];
    selectedIds.forEach(function(id) {
      var p = products.find(function(pr) { return pr.id === id; });
      if (!p || !(p.barcode || p.code)) return;
      var variants = variantCache[id] || []; var selVars = selectedVariants[id];
      var hasAnyVariant = variants.length > 0;

      if (hasAnyVariant) {
        if (includeParentInPrint[id]) {
          items.push({ name: p.name, price: p.price, barcode: p.barcode || p.code, size: p.size || "", color: p.color || "", qty: getQty(id), productId: id, sku: skuDoProduto(p), ...comCartao(p.price, p) });
        }
        if (selVars && selVars.size > 0) {
          variants.forEach(function(v: any) {
            if (!selVars.has(v.id)) return;
            var sc = variantSizeColor(v);
            var effectivePrice = v.price_override ? parseFloat(v.price_override) : p.price;
            var effectiveBarcode = v.barcode || p.barcode || p.code;
            items.push({ name: p.name, price: effectivePrice, barcode: effectiveBarcode, size: sc.size, color: sc.color, qty: getQty(id + "__" + v.id), productId: id, variantId: v.id, sku: skuDoProduto(p as Product), ...comCartao(effectivePrice, p as Product) });
          });
        }
      } else {
        items.push({ name: p.name, price: p.price, barcode: p.barcode || p.code, size: p.size || "", color: p.color || "", qty: getQty(id), productId: id, sku: skuDoProduto(p), ...comCartao(p.price, p) });
      }
    });
    return items;
  }

  // Executa a impressao com os itens ja prontos (barcodes validos EAN-13)
  // `medida` (opcional): a medida livre recem-salva no wizard, antes de o
  // estado medidaAtiva atualizar. Sem medida livre as opcoes sao as de sempre.
  function doPrint(items: LabelItem[], medida?: CustomLabelSpec) {
    // So um spec de verdade (nunca o evento de um onPress repassado).
    var medidaNova = medida && typeof medida === "object" && typeof (medida as any).larguraMm === "number" ? medida : null;
    var cOpts = medidaNova ? { customSpec: medidaNova } : customOpts;
    // Medida recem-salva no wizard (outra que a ativa): vale o padrao dela.
    var nomeLigado = medidaNova && (!medidaAtiva || medidaAtiva.id !== medidaNova.id)
      ? mostrarNomeDaLoja(null, medidaNova, mode)
      : showStoreName;
    var html = buildLabelHtml(items, { mode: mode, storeName: storeName, showStoreName: nomeLigado, labelSize: labelSize, offsetMm: labelOffsetMm, design: labelDesign, ...printerOpts, ...cOpts });
    abrirImpressao(html, totalLabels + " etiqueta(s) abertas para impressão");
  }

  // 13/10/2026: linha de teste — produto de exemplo com marcas de calibracao,
  // pra acertar a impressora gastando 1 ou 2 linhas em vez de um rolo.
  function handleTestPrint(rows: number) {
    if (!isWeb) return;
    var html = buildLabelTestHtml({ mode: mode, storeName: storeName, showStoreName: showStoreName, labelSize: labelSize, offsetMm: labelOffsetMm, design: labelDesign, ...printerOpts, rows: rows });
    abrirImpressao(html, (rows > 1 ? rows + " linhas" : "Linha") + " de teste aberta" + (rows > 1 ? "s" : "") + " para impressão");
  }

  function abrirImpressao(html: string, aviso: string) {
    try {
      // 22/09/2026 (PWA Fase 2): no iPhone com a Aura instalada a janela de
      // impressão é morta; explica o caminho pelo Safari em vez de abrir nada.
      if (ehIphoneInstalado()) { avisarImpressaoNoIphone(); return; }
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var w = window.open(url, "_blank");
      if (!w) { var w2 = window.open("", "_blank"); if (w2) { w2.document.write(html); w2.document.close(); } else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; } }
      toast.success(aviso);
    } catch (err) { console.error("[PrintLabels] Error:", err); toast.error("Erro ao gerar etiquetas"); }
  }

  function handlePrint(medida?: CustomLabelSpec) {
    if (!isWeb || !company?.id || !token || selectedIds.length === 0) { toast.error("Selecione pelo menos um produto"); return; }

    // Reset paineis anteriores
    setInvalidCodes([]);
    setShowEan13Panel(false);

    var items = buildItems();
    if (!items || items.length === 0) { toast.error("Nenhum item selecionado. Marque o produto pai ou pelo menos uma variante."); return; }

    // 1. Validacao: codigos placeholder/vazios — bloqueia impressao
    var invalid = validateLabelItems(items);
    if (invalid.length > 0) {
      setInvalidCodes(invalid);
      toast.error(invalid.length + " produto(s) com código inválido — corrija antes de imprimir");
      return;
    }

    // 2. Verificacao EAN-13: produtos sem EAN-13 valido recebem codigo gerado
    var noEan13 = items.filter(function(item) { return !isValidEAN13(item.barcode); });
    if (noEan13.length > 0) {
      // 08/06/2026: gera EAN-13 deterministico e PERSISTE no cadastro (ver
      // handleConfirmEan13). Seed = codigo atual (barcode||name = SKU), a MESMA
      // formula de sempre. Isso e proposital: produtos ANTIGOS geram exatamente
      // o mesmo codigo que ja foi impresso -> etiquetas ja coladas continuam
      // validas assim que o codigo for gravado; NADA muda para o cliente, sem
      // necessidade de reimprimir. A unica novidade e a gravacao no cadastro.
      // O codigo vai SEMPRE para a coluna barcode (scanner); o SKU nunca muda.
      // Dedup por identidade (produto/variante) so para gravar no item certo.
      var seen = new Set<string>();
      var genList: EAN13Entry[] = [];
      noEan13.forEach(function(item) {
        var identity = item.variantId || item.productId || item.barcode || item.name;
        if (seen.has(identity)) return;
        seen.add(identity);
        genList.push({
          name: buildLabelName(item.name, item.size, item.color),
          originalCode: item.barcode,
          generated: generateEAN13(item.barcode || item.name),
          productId: item.productId,
          variantId: item.variantId,
        });
      });
      setPendingPrintItems(items);
      setEan13GenList(genList);
      setShowEan13Panel(true);
      return;
    }

    // Todos tem EAN-13 valido — imprime direto
    doPrint(items, medida);
  }

  // 13/10/2026: pre-visualizacao em escala real da 1a pagina, sem imprimir e
  // sem gravar nada. Produto sem EAN-13 aparece com o codigo que a impressao
  // vai gerar (mesma formula deterministica do handlePrint); gravar no
  // cadastro continua sendo so no "Imprimir".
  function handlePreview() {
    if (!isWeb || selectedIds.length === 0) { toast.error("Selecione pelo menos um produto"); return; }
    setInvalidCodes([]);
    var items = buildItems();
    if (!items || items.length === 0) { toast.error("Nenhum item selecionado. Marque o produto pai ou pelo menos uma variante."); return; }
    var invalid = validateLabelItems(items);
    if (invalid.length > 0) {
      setInvalidCodes(invalid);
      toast.error(invalid.length + " produto(s) com código inválido — corrija antes de imprimir");
      return;
    }
    var shown = items.map(function(item) {
      return isValidEAN13(item.barcode) ? item : { ...item, barcode: generateEAN13(item.barcode || item.name) };
    });
    var opts = { mode: mode, storeName: storeName, showStoreName: showStoreName, labelSize: labelSize, offsetMm: labelOffsetMm, design: labelDesign, ...printerOpts, ...customOpts };
    var geo = labelPreviewGeometry(shown, opts);
    setPreview({ html: buildLabelPreviewHtml(shown, opts), widthMm: geo.widthMm, heightMm: geo.heightMm, labels: geo.labels });
  }

  // Confirma a geracao de EAN-13 e imprime substituindo os codigos
  async function handleConfirmEan13() {
    // Mapeia o codigo gerado por IDENTIDADE (variante ou produto).
    var codeByIdentity: Record<string, string> = {};
    ean13GenList.forEach(function(g) {
      var identity = g.variantId || g.productId || g.originalCode;
      if (identity) codeByIdentity[identity] = g.generated;
    });

    var resolvedItems = pendingPrintItems.map(function(item) {
      if (isValidEAN13(item.barcode)) return item;
      var identity = item.variantId || item.productId || item.barcode;
      var gen = identity ? codeByIdentity[identity] : undefined;
      return gen ? { ...item, barcode: gen } : item;
    });

    // 08/06/2026: persiste o codigo gerado no cadastro (produto OU variante)
    // ANTES de imprimir. Sem isso o EAN-13 existe so na etiqueta e o PDV nao
    // encontra o item ao bipar (busca casa em products.barcode / variant.barcode).
    if (company?.id) {
      var cid = company.id;
      var saves = ean13GenList
        .filter(function(g) { return !!g.productId; })
        .map(function(g) {
          return g.variantId
            ? companiesApi.updateVariant(cid, g.productId as string, g.variantId, { barcode: g.generated })
            : companiesApi.updateProduct(cid, g.productId as string, { barcode: g.generated });
        });
      if (saves.length > 0) {
        try {
          await Promise.all(saves);
          toast.success(saves.length + " código(s) gravado(s) no cadastro");
        } catch (err) {
          console.error("[PrintLabels] Falha ao salvar EAN-13 gerado:", err);
          toast.error("Etiquetas geradas, mas falhou ao gravar o código no cadastro — o PDV pode não reconhecer ao bipar.");
        }
      }
    }

    setShowEan13Panel(false);
    doPrint(resolvedItems);
  }

  // Ilustracao do wizard com um produto de verdade (o 1o marcado), se houver.
  function exemploDaEtiqueta() {
    var p = products.find(function(pr) { return selectedIds.includes(pr.id); });
    if (!p) return undefined;
    var variacao = [p.size, p.color && !/^#/.test(p.color) ? p.color : ""].filter(Boolean).join(" · ");
    return { nome: p.name, variacao: variacao, preco: "R$ " + Number(p.price || 0).toFixed(2).replace(".", ","), codigo: String(p.barcode || p.code || "") };
  }

  function renderColorIndicator(colorVal: string) {
    if (!colorVal) return null;
    var hex = colorNameToHex(colorVal);
    if (hex) return <View style={[s.colorDot, { backgroundColor: hex }]} />;
    return <Text style={s.colorBadge}>{colorVal}</Text>;
  }

  // Indicador visual de validade EAN-13 para exibir na lista
  function renderEan13Badge(code: string) {
    if (!code) return null;
    var valid = isValidEAN13(code);
    return (
      <View style={[s.ean13Badge, valid ? s.ean13BadgeOk : s.ean13BadgeWarn]}>
        <Text style={[s.ean13BadgeText, valid ? s.ean13BadgeTextOk : s.ean13BadgeTextWarn]}>
          {valid ? "EAN-13" : "Sem EAN-13"}
        </Text>
      </View>
    );
  }

  var allSelected = marcaveis.length > 0 && marcaveis.every(function(p) { return selectedIds.includes(p.id); });

  // Barra de impressao (p-72). Na vaga do shell (celular) perde o sticky, as
  // margens negativas e os cantos: e uma faixa de largura total.
  var barraNoShell = !!vagaDaBarra;
  var barraDeImpressao = (
      <View style={[s.barra, isWeb && !barraNoShell && s.barraFixa, estreita && s.barraEstreita, barraNoShell && s.barraNoShell]} testID="etiquetas-barra">
        <View style={s.barraTot}>
          <Text style={s.barraTotTxt} testID="etiquetas-total">{totalLabels} {totalLabels === 1 ? "etiqueta" : "etiquetas"}</Text>
          <Text style={s.barraSub} numberOfLines={2}>{produtosNoTotal > 0 ? produtosNoTotal + (produtosNoTotal === 1 ? " produto" : " produtos") + (foraDaLista > 0 ? " · " + foraDaLista + " fora da lista" : "") : "Marque os produtos que quer imprimir"}</Text>
        </View>
        <View style={[s.barraBotoes, estreita && s.barraBotoesEstreita]}>
          {isWeb && (
            <Pressable onPress={handlePreview} style={[s.previewBtn, estreita && { flex: 1 }, totalLabels === 0 && { opacity: 0.5 }]} disabled={totalLabels === 0} testID="etiquetas-ver-tamanho-real" accessibilityRole="button">
              <Icon name="search" size={14} color={Colors.violet3} />
              <Text style={s.previewBtnText}>Ver no tamanho real</Text>
            </Pressable>
          )}
          <Pressable onPress={function() { handlePrint(); }} style={[s.printBtn, estreita && { flex: 1 }, totalLabels === 0 && { opacity: 0.5 }]} disabled={totalLabels === 0} testID="etiquetas-imprimir" accessibilityRole="button">
            <Icon name="file_text" size={16} color="#fff" />
            <Text style={s.printBtnText}>{totalLabels > 0 ? "Imprimir " + totalLabels + (totalLabels === 1 ? " etiqueta" : " etiquetas") : "Imprimir"}</Text>
          </Pressable>
        </View>
      </View>
  );

  return (
    <View style={s.container} ref={raizRef}>
      <View style={s.header} testID="etiquetas-cabecalho">
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.title}>Etiquetas {nomeDoModelo} — Padrão EAN-13</Text>
          <Text style={s.hint}>Selecione os produtos. Produto com código válido mas fora do padrão de código de barras (EAN-13) recebe um código interno automaticamente; sem nenhum código válido cadastrado, corrija no Estoque antes de imprimir.</Text>
        </View>
        <View style={{ gap: 6, alignItems: "flex-end" }}>
          <View style={s.modeToggle}>
            <Pressable onPress={function() { setMode("barcode"); }} style={[s.modeBtn, mode === "barcode" && s.modeBtnActive]}><Text style={[s.modeText, mode === "barcode" && s.modeTextActive]}>EAN-13</Text></Pressable>
            <Pressable onPress={function() { setMode("qr"); }} style={[s.modeBtn, mode === "qr" && s.modeBtnActive]}><Text style={[s.modeText, mode === "qr" && s.modeTextActive]}>QR Code</Text></Pressable>
          </View>
          {/* 24/09/2026: modelo de etiqueta em lista suspensa (com 3+ modelos
              os botoes lado a lado estouravam a largura). A escolha fica
              salva como padrao da loja. */}
          <View style={s.sizeSelect}>
            <Pressable
              onPress={function() { setSizeMenuOpen(!sizeMenuOpen); }}
              style={s.sizeSelectBtn}
              accessibilityRole="button"
              accessibilityState={{ expanded: sizeMenuOpen }}
              accessibilityLabel={"Modelo de etiqueta: " + nomeDoModelo}
            >
              <Text style={s.sizeSelectLbl}>Modelo:</Text>
              <Text style={s.sizeSelectVal} numberOfLines={1}>{nomeDoModelo}</Text>
              <Icon name={sizeMenuOpen ? "chevron_up" : "chevron_down"} size={12} color={Colors.ink3} />
            </Pressable>
            {sizeMenuOpen && (
              <View style={s.sizeMenu}>
                {LABEL_SIZE_OPTIONS.map(function(key) {
                  var active = !medidaAtiva && labelSize === key;
                  return (
                    <Pressable key={key} onPress={function() { escolherModeloFixo(key); }} style={[s.sizeMenuItem, active && s.sizeMenuItemActive]} accessibilityRole="menuitem">
                      <Text style={[s.sizeMenuTxt, active && s.sizeMenuTxtActive]}>{LABEL_SIZE_PRESETS[key].uiLabel}</Text>
                      {active && <Icon name="check" size={12} color={Colors.violet3} />}
                    </Pressable>
                  );
                })}
                {/* 15/10/2026: "Minha medida". Lapis e lixeira sempre
                    visiveis (nada de hover-reveal), alvos de 44 px. */}
                {isWeb && <View style={s.sizeMenuSep} />}
                {isWeb && medidas.map(function(m) {
                  var active = !!medidaAtiva && medidaAtiva.id === m.id;
                  if (apagandoMedida === m.id) {
                    return (
                      <View key={m.id} style={s.medidaConfirma} testID={"etiquetas-medida-confirma-" + m.id}>
                        <Text style={s.medidaConfirmaTxt}>Apagar “{rotuloDaMedida(m)}” {ondeFica}?{naConta ? " Some em todos os computadores da loja." : ""}</Text>
                        <View style={s.medidaConfirmaAcoes}>
                          <Pressable onPress={function() { setApagandoMedida(null); }} style={s.medidaConfirmaBtn} testID="etiquetas-medida-apagar-cancelar"><Text style={s.medidaConfirmaBtnTxt}>Cancelar</Text></Pressable>
                          <Pressable onPress={function() { confirmarApagarMedida(m.id); }} style={[s.medidaConfirmaBtn, s.medidaConfirmaBtnApagar]} testID="etiquetas-medida-apagar-sim"><Text style={[s.medidaConfirmaBtnTxt, { color: Colors.red }]}>Apagar</Text></Pressable>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View key={m.id} style={[s.medidaRow, active && s.sizeMenuItemActive]}>
                      <Pressable onPress={function() { escolherMinhaMedida(m); }} style={s.medidaPick} accessibilityRole="menuitem" testID={"etiquetas-medida-" + m.id}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.sizeMenuTxt, active && s.sizeMenuTxtActive]} numberOfLines={1}>{rotuloDaMedida(m)}</Text>
                          <Text style={s.medidaSub} numberOfLines={1}>{m.nome ? mmTxt(m.larguraMm) + " x " + mmTxt(m.alturaMm) + " mm · " : ""}{m.colunas > 1 ? m.colunas + " lado a lado · " : ""}{naConta ? "ajuste salvo na conta" : "ajuste guardado neste computador"}</Text>
                        </View>
                        {active && <Icon name="check" size={12} color={Colors.violet3} />}
                      </Pressable>
                      <Pressable onPress={function() { setSizeMenuOpen(false); setWizardMedida({ inicial: m }); }} style={s.medidaIcone} accessibilityRole="button" accessibilityLabel={"Editar " + rotuloDaMedida(m)} testID={"etiquetas-medida-editar-" + m.id}>
                        <Icon name="pencil" size={16} color={Colors.violet3} />
                      </Pressable>
                      <Pressable onPress={function() { setApagandoMedida(m.id); }} style={s.medidaIcone} accessibilityRole="button" accessibilityLabel={"Apagar " + rotuloDaMedida(m)} testID={"etiquetas-medida-apagar-" + m.id}>
                        <Icon name="trash" size={16} color={Colors.ink3} />
                      </Pressable>
                    </View>
                  );
                })}
                {isWeb && (
                  <Pressable onPress={abrirNovaMedida} style={s.medidaNova} accessibilityRole="menuitem" testID="etiquetas-minha-medida">
                    <Icon name="plus" size={14} color={Colors.violet3} />
                    <Text style={s.medidaNovaTxt}>Minha medida</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 18/10/2026 (card p-36): o desenho que sai na impressão deste modelo
          e o atalho para a escolha (Configurações › Políticas do Caixa). */}
      <DesenhoDaEtiquetaLinha labelSize={labelSize} labelDesign={labelDesign} medida={medidaAtiva} podeMudar={podeMudarDesenho === true} />

      {storeName ? (
        <Pressable testID="etiquetas-nome-da-loja" accessibilityRole="checkbox" accessibilityState={{ checked: showStoreName }} onPress={function() { setEscolhaNomeDaLoja(!showStoreName); }} style={s.storeToggle}>
          <View style={[s.checkbox, showStoreName && s.checkboxSelected]}>{showStoreName && <Icon name="check" size={10} color="#fff" />}</View>
          <Text style={s.storeToggleText}>Incluir nome da loja no topo: <Text style={s.storeTogglePreview}>{storeName.toUpperCase()}</Text></Text>
        </Pressable>
      ) : null}

      {temCalibracao && (
        <LabelPrinterCalibration labelSize={labelSize} prefs={printerPrefs} onChange={setPrinterPrefs} onTest={handleTestPrint} naConta={naConta} />
      )}

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput style={s.searchInput} placeholder="Buscar por nome ou código" placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
          {search.length > 0 && <Pressable onPress={function() { setSearch(""); }} accessibilityLabel="Limpar a busca"><Icon name="x" size={12} color={Colors.ink3} /></Pressable>}
        </View>
        {/* 30/10/2026 (card p-71): Categoria, Cadastrados e Ordenar num único
            botão. O número diz quantos fogem do padrão. */}
        <Pressable
          onPress={function() { setFiltrosAbertos(!filtrosAbertos); setMenuFiltro(null); }}
          style={[s.filtrosBtn, (filtrosAbertos || nFiltros > 0) && s.filtroBtnOn]}
          testID="etiquetas-filtros-botao"
          accessibilityRole="button"
          accessibilityState={{ expanded: filtrosAbertos }}
          accessibilityLabel={nFiltros > 0 ? "Filtros, " + nFiltros + " em uso" : "Filtros"}
        >
          <Text style={s.filtrosBtnTxt}>Filtros</Text>
          {nFiltros > 0 && <View style={s.filtrosBadge} testID="etiquetas-filtros-contador"><Text style={s.filtrosBadgeTxt}>{nFiltros}</Text></View>}
        </Pressable>
      </View>

      {filtrosAbertos && (
        <View style={s.filtros} testID="etiquetas-filtros">
        <View style={[s.filtroGrupo, { zIndex: 2 }]} testID="etiquetas-grupo-cadastrados">
          <Text style={s.filtroRotulo}>Cadastrados:</Text>
          <View style={s.calWrap}>
            <Pressable
              onPress={function() { setMenuFiltro(menuFiltro === "calendario" ? null : "calendario"); }}
              style={[s.chip, s.calBtn, periodo === "dia" && s.chipOn]}
              testID="etiquetas-calendario"
              accessibilityRole="button"
              accessibilityLabel={periodo === "dia" && dia ? "Cadastrados em " + diaParaBr(dia) + ". Trocar o dia" : "Escolher um dia de cadastro"}
              accessibilityState={{ selected: periodo === "dia", expanded: menuFiltro === "calendario" }}
            >
              <Icon name="calendar" size={13} color={periodo === "dia" ? "#fff" : Colors.ink2} />
              {periodo === "dia" && dia ? <Text style={[s.chipTxt, s.chipTxtOn]}>{diaParaBr(dia)}</Text> : null}
            </Pressable>
            {menuFiltro === "calendario" && (
              <View style={s.calPainel}>
                <CalendarioDoDia
                  testID="etiquetas-calendario-painel"
                  value={dia}
                  maxDate={hojeEmSaoPaulo()}
                  marcas={marcasDoCalendario(diasCadastro, dia, { ponto: Colors.violet3, selecionado: Colors.violet })}
                  legenda="dia com produto cadastrado"
                  onEscolher={escolherDia}
                  onLimpar={function() { escolherDia(""); }}
                />
              </View>
            )}
          </View>
          {PERIODOS.map(function(pp) {
            var on = periodo === pp.key;
            return (
              <Pressable key={pp.key} onPress={function() { setPeriodo(pp.key); }} style={[s.chip, on && s.chipOn]} testID={"etiquetas-periodo-" + pp.key} accessibilityState={{ selected: on }}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{pp.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.filtroGrupo}>
          <View style={s.filtroMenuWrap}>
            <Pressable onPress={function() { setMenuFiltro(menuFiltro === "ordem" ? null : "ordem"); }} style={s.filtroBtn} testID="etiquetas-ordem" accessibilityLabel="Ordenar etiquetas">
              <Text style={s.filtroRotulo}>Ordenar:</Text>
              <Text style={s.filtroValor}>{(ORDENS_ETIQUETAS.find(function(o) { return o.key === ordem; }) || ORDENS_ETIQUETAS[0]).label}</Text>
              <Icon name={menuFiltro === "ordem" ? "chevron_up" : "chevron_down"} size={11} color={Colors.ink3} />
            </Pressable>
            {menuFiltro === "ordem" && (
              <View style={s.filtroMenu}>
                {ORDENS_ETIQUETAS.map(function(o) {
                  var on = ordem === o.key;
                  return (
                    <Pressable key={o.key} onPress={function() { setOrdem(o.key); }} style={[s.sizeMenuItem, on && s.sizeMenuItemActive]} testID={"etiquetas-ordem-" + o.key}>
                      <Text style={[s.sizeMenuTxt, on && s.sizeMenuTxtActive]}>{o.label}</Text>
                      {on && <Icon name="check" size={12} color={Colors.violet3} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {categorias.length > 0 && (
            <View style={s.filtroMenuWrap}>
              <Pressable onPress={function() { setMenuFiltro(menuFiltro === "categoria" ? null : "categoria"); }} style={[s.filtroBtn, !!categoria && s.filtroBtnOn]} testID="etiquetas-categoria" accessibilityLabel="Filtrar por categoria">
                <Text style={s.filtroRotulo}>Categoria:</Text>
                <Text style={s.filtroValor} numberOfLines={1}>{categoria || "Todas"}</Text>
                <Icon name={menuFiltro === "categoria" ? "chevron_up" : "chevron_down"} size={11} color={Colors.ink3} />
              </Pressable>
              {menuFiltro === "categoria" && (
                <ScrollView style={[s.filtroMenu, { maxHeight: 280 }]} nestedScrollEnabled>
                  {([null] as (string | null)[]).concat(categorias).map(function(c) {
                    var on = categoria === c;
                    return (
                      <Pressable key={c || "__todas"} onPress={function() { setCategoria(c); setMenuFiltro(null); }} style={[s.sizeMenuItem, on && s.sizeMenuItemActive]} testID={"etiquetas-categoria-" + (c || "todas")}>
                        <Text style={[s.sizeMenuTxt, on && s.sizeMenuTxtActive]} numberOfLines={1}>{c || "Todas"}</Text>
                        {on && <Icon name="check" size={12} color={Colors.violet3} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {nFiltros > 0 && (
            <Pressable onPress={limparFiltros} style={s.limpar} testID="etiquetas-limpar-filtros">
              <Text style={s.limparTxt}>Limpar filtros</Text>
            </Pressable>
          )}
        </View>
        </View>
      )}

      {/* Interruptor à vista + quantos aparecem + Marcar todos (o que está na lista). */}
      <View style={s.linhaEstoque}>
        <Pressable
          onPress={function() { setSoComEstoque(!soComEstoque); }}
          style={s.interruptor}
          testID="etiquetas-com-estoque"
          accessibilityRole="switch"
          accessibilityState={{ checked: soComEstoque }}
          accessibilityLabel="Só com estoque"
        >
          <View style={[s.trilho, soComEstoque && s.trilhoOn]}><View style={[s.bolinha, soComEstoque && s.bolinhaOn]} /></View>
          <Text style={s.interruptorTxt}>Só com estoque</Text>
        </Pressable>
        <Text style={s.filtroResumo} testID="etiquetas-resumo-filtro">
          {filtered.length < productsWithCode.length ? filtered.length + " de " + productsWithCode.length + " produtos" : filtered.length + (filtered.length === 1 ? " produto" : " produtos")}
        </Text>
        {marcaveis.length > 0 && (
          <Pressable onPress={toggleAll} style={s.marcarTodos} testID="etiquetas-marcar-todos" accessibilityRole="button">
            <Text style={s.marcarTodosTxt}>{allSelected ? "Desmarcar todos" : "Marcar todos"}</Text>
          </Pressable>
        )}
      </View>

      {produtosSemCodigoNaLista > 0 && (
        <View style={[s.aviso, s.avisoAmbar]} testID="etiquetas-aviso-sem-codigo">
          <Text style={s.avisoTxt}>{produtosSemCodigoNaLista === 1 ? "1 produto está sem código e não sai na etiqueta." : produtosSemCodigoNaLista + " produtos estão sem código e não saem na etiqueta."}</Text>
          {podeGerar && (
            <Pressable onPress={abrirGerarTodos} style={s.avisoBtn} testID="etiquetas-gerar-todos" accessibilityRole="button">
              <Text style={s.avisoBtnTxt}>{alvosDoEscopo.length === 1 ? "Gerar código" : "Gerar código de todos"}</Text>
            </Pressable>
          )}
        </View>
      )}
      {foraDaLista > 0 && (
        <View style={[s.aviso, s.avisoVioleta]} testID="etiquetas-aviso-fora-da-lista">
          <Text style={s.avisoTxt}>{foraDaLista === 1 ? "1 produto marcado está fora da lista" : foraDaLista + " produtos marcados estão fora da lista"} por causa do filtro. Eles entram no total.</Text>
          <Pressable onPress={mostrarTudo} style={s.avisoBtn} testID="etiquetas-mostrar-fora" accessibilityRole="button">
            <Text style={s.avisoBtnTxt}>Mostrar</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={s.list} nestedScrollEnabled>
        {filtered.length === 0 && (
          <View style={s.empty} testID="etiquetas-lista-vazia">
            <Text style={s.emptyText}>{productsWithCode.length === 0 ? "Nenhum produto com código cadastrado" : soComEstoque && !search && nFiltros === 0 ? "Nenhum produto com estoque." : "Nenhum produto encontrado."}</Text>
            {productsWithCode.length > 0 && soComEstoque && (
              <Pressable onPress={function() { setSoComEstoque(false); }} style={s.emptyBtn} testID="etiquetas-mostrar-sem-estoque">
                <Text style={s.emptyBtnTxt}>Mostrar também os sem estoque</Text>
              </Pressable>
            )}
          </View>
        )}
        {filtered.map(function(p) {
          var sel = selectedIds.includes(p.id);
          var productCode = p.barcode || p.code;

          if (!p.has_variants || (variantCache[p.id] && variantCache[p.id].length === 0)) {
            var qty = getQty(p.id);
            var labelPreview = buildLabelName(p.name, p.size || "", p.color || "");
            var cardPriceDisplay = cartaoCfg.enabled ? cardPriceFor(p.price, p) : null;
            var semCod = produtoSemCodigo(p);
            return (
              <View key={p.id} style={[s.item, sel && s.itemSelected]}>
                <Pressable onPress={function() { if (!semCod || sel) toggleSelect(p.id); }} style={s.itemLeft} testID={"etiquetas-marcar-" + p.id} accessibilityRole="checkbox" accessibilityState={{ checked: sel, disabled: semCod && !sel }}>
                  <View style={[s.checkbox, sel && s.checkboxSelected, semCod && !sel && s.checkboxDesligado]}>{sel && <Icon name="check" size={10} color="#fff" />}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={s.itemName} numberOfLines={1}>{labelPreview}</Text>
                      {p.has_variants && <Text style={s.varBadge}>V</Text>}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                      {semCod
                        ? <Text style={s.semCodigoPill} testID={"etiquetas-sem-codigo-" + p.id}>Sem código</Text>
                        : null}
                      <Text style={s.itemCode} numberOfLines={1}>{semCod ? "" : productCode + " | "}{p.stock} {unitLabelForList(p.unit)}</Text>
                      {renderColorIndicator(p.color)}
                      {p.size ? <Text style={s.sizeBadge}>{p.size}</Text> : null}
                      {!semCod && renderEan13Badge(productCode)}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
                    {cardPriceDisplay != null && <Text style={s.itemCardPriceHint}>cartão R$ {cardPriceDisplay.toFixed(2).replace(".", ",")}</Text>}
                  </View>
                </Pressable>
                {semCod && podeGerar && (
                  <View style={s.gerarLinha}>
                    <Pressable onPress={function() { abrirGerarUm({ product_id: p.id, variant_id: null, nome: p.name, comEstoque: p.stock > 0 }); }} style={s.gerarBtn} testID={"etiquetas-gerar-" + p.id} accessibilityRole="button" accessibilityLabel={"Gerar código para " + p.name}>
                      <Text style={s.gerarBtnTxt}>Gerar código</Text>
                    </Pressable>
                  </View>
                )}
                {sel && (
                  <View style={s.qtyRow}>
                    <Pressable onPress={function() { setQty(p.id, qty - 1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>{"<"}</Text></Pressable>
                    <TextInput style={s.qtyInput} value={String(qty)} onChangeText={function(v) { var n = parseInt(v); if (!isNaN(n)) setQty(p.id, n); }} keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                    <Pressable onPress={function() { setQty(p.id, qty + 1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>{"›"}</Text></Pressable>
                    <Text style={s.qtyLabel}>etiq.</Text>
                  </View>
                )}
              </View>
            );
          }

          // 30/10/2026 (card p-72): produto com variantes. A linha abre sem
          // marcar ("Ver variantes"); o quadradinho marca as variantes
          // visiveis (com o interruptor ligado, so as com estoque).
          var carregado = !!variantCache[p.id];
          var variants = variantCache[p.id] || [];
          var selVars: Set<string> = sel ? (selectedVariants[p.id] || new Set()) : new Set();
          var parentChecked = sel && !!includeParentInPrint[p.id];
          var visiveis = variants.filter(function(v: any) { return !soComEstoque || estoqueDaVariante(v) > 0 || selVars.has(v.id); });
          var escondidas = variants.length - visiveis.length;
          var nMarcadas = visiveis.filter(function(v: any) { return selVars.has(v.id); }).length;
          var estado: "none" | "some" | "all" = !sel ? "none" : !carregado ? "all" : nMarcadas === 0 ? (parentChecked ? "some" : "none") : nMarcadas >= visiveis.length ? "all" : "some";
          var aberto = !!abertos[p.id];
          var parentLabelPreview = buildLabelName(p.name, p.size || "", p.color || "");
          var parentQty = getQty(p.id);
          var parentCardPriceDisplay = cartaoCfg.enabled ? cardPriceFor(p.price, p) : null;
          var acoesDoPai = (
            <>
              <View style={[s.colDireita, estreita && s.colDireitaEstreita]}>
                <Text style={[s.estoquePill, p.stock > 0 ? s.estoqueOk : s.estoqueZero]}>{p.stock > 0 ? numBr(p.stock) + " em estoque" : "sem estoque"}</Text>
                <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
              </View>
              <Pressable onPress={function() { alternarAberto(p.id); }} style={[s.verVariantes, estreita && s.verVariantesEstreita]} testID={"etiquetas-ver-variantes-" + p.id} accessibilityRole="button" accessibilityState={{ expanded: aberto }}>
                <Text style={s.verVariantesTxt}>{aberto ? "Fechar" : "Ver variantes"}</Text>
              </Pressable>
            </>
          );
          return (
            <View key={p.id} style={[s.item, sel && s.itemSelected]} testID={"etiquetas-produto-" + p.id}>
              <View style={s.parentRow}>
                <Pressable
                  onPress={function() { toggleSelect(p.id); }}
                  style={s.checkHit}
                  testID={"etiquetas-marcar-" + p.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: estado === "all" ? true : estado === "some" ? "mixed" : false }}
                  accessibilityLabel={"Marcar " + p.name}
                >
                  <View style={[s.checkbox, estado === "all" && s.checkboxSelected, estado === "some" && s.checkboxMeio]}>
                    {estado === "all" ? <Icon name="check" size={10} color="#fff" /> : estado === "some" ? <Text style={s.checkboxMeioTxt}>–</Text> : null}
                  </View>
                </Pressable>
                <Pressable onPress={function() { alternarAberto(p.id); }} style={{ flex: 1, minWidth: 0 }} testID={"etiquetas-nome-" + p.id} accessibilityRole="button" accessibilityLabel={(aberto ? "Fechar as variantes de " : "Ver as variantes de ") + p.name}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {renderColorIndicator(p.color)}
                    <Text style={[s.itemName, estreita && s.nomeQueEncolhe]} numberOfLines={1}>{parentLabelPreview}</Text>
                    <Text style={s.varBadge}>V</Text>
                    {p.size ? <Text style={s.sizeBadge}>{p.size}</Text> : null}
                  </View>
                  <Text style={s.variantHint} numberOfLines={1}>
                    {produtoSemCodigo(p) ? "Sem código" : productCode}{carregado ? " · " + visiveis.length + (visiveis.length === 1 ? " variante" : " variantes") : ""}{sel && carregado ? " · " + nMarcadas + (nMarcadas === 1 ? " marcada" : " marcadas") + (parentChecked ? " + etiqueta do pai" : "") : ""}
                  </Text>
                </Pressable>
                {!estreita && acoesDoPai}
              </View>
              {/* 30/10/2026 (QA 375 px): no celular selo, preço e "Ver
                  variantes" descem para uma segunda linha, e o nome fica com
                  a largura toda (antes virava "V…"). */}
              {estreita && <View style={s.acoesDoPaiEstreita} testID={"etiquetas-acoes-" + p.id}>{acoesDoPai}</View>}

              {aberto && (
                <View style={s.varsPainel} testID={"etiquetas-variantes-" + p.id}>
                  {!carregado && <Text style={s.varsAviso}>Carregando as variantes…</Text>}

                  {carregado && (
                    <View style={[s.variantRow, parentChecked && s.variantRowSelected, s.parentSelfRow]}>
                      <Pressable onPress={function() { if (!produtoSemCodigo(p) || parentChecked) toggleIncludeParent(p.id); }} style={s.variantLeft} testID={"etiquetas-pai-" + p.id} accessibilityRole="checkbox" accessibilityState={{ checked: parentChecked, disabled: produtoSemCodigo(p) && !parentChecked }}>
                        <View style={[s.checkboxSmall, parentChecked && s.checkboxSmallSelected]}>{parentChecked && <Icon name="check" size={8} color="#fff" />}</View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            {renderColorIndicator(p.color)}
                            <Text style={s.variantName} numberOfLines={1}>{parentLabelPreview}</Text>
                            <Text style={s.parentSelfBadge}>PAI</Text>
                            {p.size ? <Text style={s.sizeBadge}>{p.size}</Text> : null}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                            <Text style={s.variantMeta}>{produtoSemCodigo(p) ? "Sem código" : productCode} | {p.stock} {unitLabelForList(p.unit)}</Text>
                            {!produtoSemCodigo(p) && renderEan13Badge(productCode)}
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={s.variantPrice}>R$ {p.price.toFixed(2).replace(".", ",")}</Text>
                          {parentCardPriceDisplay != null && <Text style={s.variantCardPriceHint}>cartão R$ {parentCardPriceDisplay.toFixed(2).replace(".", ",")}</Text>}
                        </View>
                      </Pressable>
                      {parentChecked && (
                        <View style={s.qtyRowVariant}>
                          <Pressable onPress={function() { setQty(p.id, parentQty - 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"<"}</Text></Pressable>
                          <TextInput style={s.qtyInputSmall} value={String(parentQty)} onChangeText={function(val) { var n = parseInt(val); if (!isNaN(n)) setQty(p.id, n); }} keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                          <Pressable onPress={function() { setQty(p.id, parentQty + 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"›"}</Text></Pressable>
                          <Text style={s.qtyLabel}>etiq.</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {visiveis.map(function(v: any) {
                    var vsel = selVars.has(v.id);
                    var vkey = p.id + "__" + v.id;
                    var vqty = getQty(vkey);
                    var sc = variantSizeColor(v);
                    var vlabel = buildLabelName(p.name, sc.size, sc.color);
                    var effectivePrice = v.price_override ? parseFloat(v.price_override) : p.price;
                    var vBarcode = v.barcode || p.barcode || p.code;
                    var vEstoque = estoqueDaVariante(v);
                    var vSemCod = varianteSemCodigo(v, p);
                    var vCardPriceDisplay = cartaoCfg.enabled ? cardPriceFor(effectivePrice, p as Product) : null;
                    return (
                      <View key={v.id} style={[s.variantRow, vsel && s.variantRowSelected, vEstoque <= 0 && !vsel && s.variantZero]}>
                        <Pressable onPress={function() { if (!vSemCod || vsel) toggleVariant(p.id, v.id); }} style={s.variantLeft} testID={"etiquetas-variante-" + v.id} accessibilityRole="checkbox" accessibilityState={{ checked: vsel, disabled: vSemCod && !vsel }}>
                          <View style={[s.checkboxSmall, vsel && s.checkboxSmallSelected, vSemCod && !vsel && s.checkboxDesligado]}>{vsel && <Icon name="check" size={8} color="#fff" />}</View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              {renderColorIndicator(sc.color)}
                              <Text style={s.variantName} numberOfLines={1}>{vlabel}</Text>
                              {sc.size ? <Text style={s.sizeBadge}>{sc.size}</Text> : null}
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                              {vSemCod ? <Text style={s.semCodigoPill} testID={"etiquetas-sem-codigo-" + v.id}>Sem código</Text> : <Text style={s.variantMeta}>{vBarcode}</Text>}
                              {!vSemCod && renderEan13Badge(vBarcode)}
                            </View>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 2 }}>
                            <Text style={[s.estoquePill, vEstoque > 0 ? s.estoqueOk : s.estoqueZero]} testID={"etiquetas-estoque-variante-" + v.id}>{vEstoque > 0 ? numBr(vEstoque) + " em estoque" : "sem estoque"}</Text>
                            <Text style={s.variantPrice}>R$ {effectivePrice.toFixed(2).replace(".", ",")}</Text>
                            {vCardPriceDisplay != null && <Text style={s.variantCardPriceHint}>cartão R$ {vCardPriceDisplay.toFixed(2).replace(".", ",")}</Text>}
                          </View>
                        </Pressable>
                        {vSemCod && podeGerar && (
                          <View style={s.gerarLinha}>
                            <Pressable onPress={function() { abrirGerarUm({ product_id: p.id, variant_id: v.id, nome: vlabel, comEstoque: vEstoque > 0 }); }} style={s.gerarBtn} testID={"etiquetas-gerar-" + v.id} accessibilityRole="button" accessibilityLabel={"Gerar código para " + vlabel}>
                              <Text style={s.gerarBtnTxt}>Gerar código</Text>
                            </Pressable>
                          </View>
                        )}
                        {vsel && (
                          <View style={s.qtyRowVariant}>
                            <Pressable onPress={function() { setQty(vkey, vqty - 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"<"}</Text></Pressable>
                            <TextInput style={s.qtyInputSmall} value={String(vqty)} onChangeText={function(val) { var n = parseInt(val); if (!isNaN(n)) setQty(vkey, n); }} keyboardType="number-pad" maxLength={3} selectTextOnFocus />
                            <Pressable onPress={function() { setQty(vkey, vqty + 1); }} style={s.qtyBtnSmall}><Text style={s.qtyBtnText}>{"›"}</Text></Pressable>
                            <Text style={s.qtyLabel}>etiq.</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {carregado && escondidas > 0 && (
                    <Text style={s.varsAviso}>{escondidas === 1 ? "1 variante sem estoque não aparece" : escondidas + " variantes sem estoque não aparecem"}. Para ver, desligue “Só com estoque”.</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Painel: codigos placeholder invalidos */}
      {invalidCodes.length > 0 && (
        <View style={s.invalidPanel}>
          <View style={s.invalidHeader}>
            <Icon name="alert" size={16} color={Colors.red} />
            <Text style={s.invalidTitle}>
              {invalidCodes.length} produto{invalidCodes.length > 1 ? "s" : ""} sem código válido — corrija antes de imprimir
            </Text>
            <Pressable onPress={function() { setInvalidCodes([]); }} style={s.invalidClose}>
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>
          <Text style={s.invalidHint}>
            Códigos como "...", "-", "0000" ou muito curtos geram barras ilegíveis no scanner. Cadastre o código de barras ou um código interno no produto, no Estoque, antes de imprimir.
          </Text>
          <ScrollView style={s.invalidList} nestedScrollEnabled>
            {invalidCodes.map(function(item, idx) {
              return (
                <View key={idx} style={s.invalidRow}>
                  <Text style={s.invalidName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.invalidCode}>{item.code}</Text>
                  <Text style={s.invalidReason}>{item.reason}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Painel: geracao de EAN-13 para produtos sem codigo valido */}
      {showEan13Panel && (
        <View style={s.ean13Panel}>
          <View style={s.ean13Header}>
            <Icon name="alert" size={16} color={Colors.amber} />
            <Text style={s.ean13Title}>
              {ean13GenList.length} produto{ean13GenList.length > 1 ? "s" : ""} sem EAN-13 valido
            </Text>
            <Pressable onPress={function() { setShowEan13Panel(false); }} style={s.invalidClose}>
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>
          <Text style={s.ean13Hint}>
            Um EAN-13 interno sera gerado automaticamente (prefixo 200 — uso interno GS1, sem registro). O mesmo produto sempre gera o mesmo codigo. O codigo gerado sera salvo no cadastro (campo de codigo de barras); o SKU nao muda.
          </Text>
          <ScrollView style={s.ean13List} nestedScrollEnabled>
            {ean13GenList.map(function(entry, idx) {
              return (
                <View key={idx} style={s.ean13Row}>
                  <Text style={s.ean13ItemName} numberOfLines={1}>{entry.name}</Text>
                  <Text style={s.ean13OldCode} numberOfLines={1}>{entry.originalCode || "(sem código)"}</Text>
                  <Text style={s.ean13Arrow}>{"→"}</Text>
                  <Text style={s.ean13NewCode}>{entry.generated}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={s.ean13Actions}>
            <Pressable onPress={function() { setShowEan13Panel(false); }} style={s.ean13CancelBtn}>
              <Text style={s.ean13CancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleConfirmEan13} style={s.ean13ConfirmBtn}>
              <Icon name="file_text" size={14} color="#fff" />
              <Text style={s.ean13ConfirmText}>Usar estes códigos e Imprimir</Text>
            </Pressable>
          </View>
        </View>
      )}

      {modalCodigo && mc && (
        // WebPortal: a aba vive dentro do shell (z-index 0 do RNW prenderia o
        // modal embaixo da pagina); mesmo padrao da previa em tamanho real.
        <WebPortal active>
          <View style={s.modalFundo}>
            <View style={s.modalCaixa} testID="etiquetas-modal-codigo">
              <Text style={s.modalTitulo}>{mc.unico ? "Gerar código de barras" : "Gerar código de barras"}</Text>
              <Text style={s.modalTexto}>A Aura cria um código para {mc.unico ? "este produto" : "cada produto"} e guarda no cadastro. Depois é só bipar no Caixa. Os produtos que já têm código não mudam.</Text>
              {!mc.unico && (function() {
                var nCom = alvosDoEscopo.filter(function(a) { return a.comEstoque; }).length;
                var nTodos = alvosDoEscopo.length;
                var opcoes: Array<{ k: "com" | "todos"; t: string; d: string }> = [];
                if (nCom > 0) opcoes.push({ k: "com", t: nCom === 1 ? "Só o que tem estoque (1)" : "Só os " + nCom + " com estoque", d: "O que está em estoque e vai para a etiqueta. Recomendado." });
                opcoes.push({ k: "todos", t: nTodos === 1 ? "O produto sem código" : "Todos os " + nTodos + " sem código", d: "Inclui os sem estoque, para deixar o cadastro completo." });
                return opcoes.map(function(o) {
                  var on = mc.opcao === o.k;
                  return (
                    <Pressable key={o.k} onPress={function() { if (!on && !mc.gravando) pedirPrevia({ ...mc, opcao: o.k }); }} style={[s.opcao, on && s.opcaoOn]} testID={"etiquetas-gerar-opcao-" + o.k} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                      <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioMiolo} />}</View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.opcaoTitulo}>{o.t}</Text>
                        <Text style={s.opcaoTexto}>{o.d}</Text>
                      </View>
                    </Pressable>
                  );
                });
              })()}
              <View style={s.previa} testID="etiquetas-previa-codigos">
                {mc.carregando ? (
                  <Text style={s.opcaoTexto}>Preparando os códigos…</Text>
                ) : mc.previa ? (
                  <View style={{ gap: 3 }}>
                    <Text style={s.opcaoTexto}>{mc.previa.items.length > 0 ? "Antes de guardar, veja os códigos:" : "Esses produtos já têm código. Nada a gerar."}</Text>
                    {mc.previa.items.slice(0, 4).map(function(it) {
                      var alvo = alvosDoModal(mc).find(function(a) { return chaveDoAlvo(a) === chaveDoAlvo(it); });
                      return (
                        <View key={chaveDoAlvo(it)} style={s.previaLinha}>
                          <Text style={s.previaNome} numberOfLines={1}>{alvo ? alvo.nome : "Produto"}</Text>
                          <Text style={s.previaCodigo}>{it.barcode}</Text>
                        </View>
                      );
                    })}
                    {alvosDoModal(mc).length > 4 && mc.previa.items.length > 0 && (
                      <Text style={s.opcaoTexto}>e mais {alvosDoModal(mc).length - Math.min(4, mc.previa.items.length)} produtos</Text>
                    )}
                  </View>
                ) : null}
                {mc.erro && <Text style={s.modalErro}>{mc.erro}</Text>}
              </View>
              <View style={s.modalAcoes}>
                <Pressable onPress={function() { setModalCodigo(null); }} disabled={mc.gravando} style={s.modalBtn} testID="etiquetas-gerar-agora-nao"><Text style={s.modalBtnTxt}>Agora não</Text></Pressable>
                <Pressable
                  onPress={gravarCodigos}
                  disabled={mc.carregando || mc.gravando || !mc.previa || mc.previa.items.length === 0}
                  style={[s.modalBtn, s.modalBtnP, (mc.carregando || mc.gravando || !mc.previa || mc.previa.items.length === 0) && { opacity: 0.5 }]}
                  testID="etiquetas-gerar-guardar"
                >
                  <Text style={[s.modalBtnTxt, { color: "#fff" }]}>{mc.gravando ? "Guardando…" : "Gerar e guardar"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </WebPortal>
      )}
      {preview && (
        <LabelPreviewModal
          html={preview.html}
          widthMm={preview.widthMm}
          heightMm={preview.heightMm}
          labels={preview.labels}
          totalLabels={totalLabels}
          continuous={!!printerOpts.continuous}
          onClose={function() { setPreview(null); }}
          onPrint={function() { setPreview(null); handlePrint(); }}
        />
      )}
      {wizardMedida && (
        <MinhaMedidaWizard
          key={wizardMedida.inicial ? wizardMedida.inicial.id : "nova"}
          inicial={wizardMedida.inicial}
          exemplo={exemploDaEtiqueta()}
          onImprimirTeste={function(m) { abrirImpressao(buildCustomLabelTestHtml(m), "Teste de posição aberto para impressão"); }}
          onSalvar={salvarMinhaMedida}
          naConta={naConta}
          onFechar={function() { setWizardMedida(null); }}
          onImprimirAgora={function(m) {
            setWizardMedida(null);
            if (totalLabels === 0) { toast.info("Medida pronta. Marque os produtos e toque em Imprimir."); return; }
            handlePrint(m);
          }}
        />
      )}
      <View style={s.setupHint}>
        <Icon name="alert" size={12} color={Colors.amber} />
        <Text style={s.setupText}>Chrome: Ctrl+P, papel {medidaAtiva ? mmTxt(customLabelPreset(medidaAtiva).pageWidthMm) + "x" + mmTxt(customLabelPreset(medidaAtiva).pageHeightMm) + "mm" : printerOpts.continuous ? labelPreset.pageWidthMm + "mm de largura e a altura do trabalho inteiro (passo de " + mmBr(printerPrefs.rowPitchMm) + " × número de linhas; a página de impressão mostra a medida)" : labelPreset.pageWidthMm + "x" + (printerOpts.rowPitchMm != null ? printerOpts.rowPitchMm : labelPreset.pageHeightMm) + "mm"}, Margens: Nenhuma, Escala: 100%. A quantidade padrão é baseada no estoque de cada variante{matconEnabled ? ", exceto em unidades fracionadas (m, m², m³, kg, L, ton) e milheiro, que começam em 1" : ""}.</Text>
      </View>

      {/* 30/10/2026 (card p-72): total e Imprimir sempre à vista, presos
          embaixo enquanto a lista rola. Em tela estreita, largura total; no
          celular (QA 375 px), a barra mora na vaga do shell, logo acima da
          barra de navegação de baixo (ver acharVagaDaBarraNoCelular). */}
      {vagaDaBarra ? require("react-dom").createPortal(barraDeImpressao, vagaDaBarra) : barraDeImpressao}
    </View>
  );
}

var s = StyleSheet.create({
  container: { gap: 12 },
  // 25/09/2026: zIndex no CABECALHO, nao so no menu. No web o RNW da a cada
  // View o seu proprio z-index: 0, entao o zIndex 30 do menu de modelo so
  // valia dentro do cabecalho — a busca e o "Selecionar todos" (translucido),
  // que vem depois, eram pintados por cima da lista de modelos aberta.
  header: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, position: "relative", zIndex: 10 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  modeToggle: { flexDirection: "row", gap: 4, backgroundColor: Colors.bg, borderRadius: 8, padding: 3 },
  modeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  modeBtnActive: { backgroundColor: Colors.violet },
  modeText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  modeTextActive: { color: "#fff", fontWeight: "600" },
  sizeSelect: { position: "relative", zIndex: 20, minWidth: 220 },
  sizeSelectBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border },
  sizeSelectLbl: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  sizeSelectVal: { flex: 1, fontSize: 11.5, color: Colors.ink, fontWeight: "600" },
  sizeMenu: { position: "absolute", top: "100%", right: 0, left: 0, marginTop: 4, backgroundColor: Colors.bg3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, paddingVertical: 4, zIndex: 30 },
  sizeMenuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 12 },
  sizeMenuItemActive: { backgroundColor: Colors.violetD },
  sizeMenuTxt: { fontSize: 12, color: Colors.ink2 },
  sizeMenuTxtActive: { color: Colors.violet3, fontWeight: "700" },
  // "Minha medida" (15/10/2026): alvos de 44 px, lapis/lixeira sempre visiveis.
  sizeMenuSep: { height: 1, backgroundColor: Colors.border, marginVertical: 4, marginHorizontal: 6 },
  medidaRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  medidaPick: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 4 },
  medidaSub: { fontSize: 10.5, color: Colors.ink3, marginTop: 1 },
  medidaIcone: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  medidaNova: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12 },
  medidaNovaTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "700" },
  medidaConfirma: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, backgroundColor: Colors.redD },
  medidaConfirmaTxt: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  medidaConfirmaAcoes: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  medidaConfirmaBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", backgroundColor: Colors.bg3 },
  medidaConfirmaBtnApagar: { borderColor: Colors.red + "66" },
  medidaConfirmaBtnTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
  storeToggle: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  storeToggleText: { fontSize: 12, color: Colors.ink2, flex: 1 },
  storeTogglePreview: { fontWeight: "700", color: Colors.violet3, letterSpacing: 0.5 },
  toolbar: { flexDirection: "row", gap: 8, alignItems: "center" },
  // Filtros (25/09/2026). zIndex abaixo do cabecalho (10) e acima da lista:
  // os menus de Ordenar/Categoria abrem por cima dos produtos (mesma
  // armadilha do menu de modelo: o RNW da z-index 0 a cada View).
  filtros: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, position: "relative", zIndex: 5, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 10 },
  // Botão Filtros (30/10/2026, p-71): alvo de 40 px, número em bolinha.
  filtrosBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 14, minHeight: 40, borderWidth: 1, borderColor: Colors.border },
  filtrosBtnTxt: { fontSize: 12.5, color: Colors.ink, fontWeight: "600" },
  filtrosBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  filtrosBadgeTxt: { fontSize: 11, color: "#fff", fontWeight: "700" },
  linhaEstoque: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  interruptor: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  interruptorTxt: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  trilho: { width: 36, height: 20, borderRadius: 10, backgroundColor: Colors.border2, justifyContent: "center", paddingHorizontal: 2 },
  trilhoOn: { backgroundColor: Colors.violet },
  bolinha: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  bolinhaOn: { alignSelf: "flex-end" },
  marcarTodos: { marginLeft: "auto", minHeight: 36, justifyContent: "center", paddingHorizontal: 6 },
  marcarTodosTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "700" },
  filtroGrupo: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  filtroRotulo: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  filtroValor: { fontSize: 11.5, color: Colors.ink, fontWeight: "600", maxWidth: 160 },
  filtroMenuWrap: { position: "relative", zIndex: 6 },
  filtroBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border },
  filtroBtnOn: { borderColor: Colors.violet },
  filtroMenu: { position: "absolute", top: "100%", left: 0, minWidth: 190, marginTop: 4, backgroundColor: Colors.bg3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, paddingVertical: 4, zIndex: 30 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 11.5, color: Colors.ink2, fontWeight: "600" },
  chipTxtOn: { color: "#fff" },
  calWrap: { position: "relative", zIndex: 7 },
  calBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  calPainel: { position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 30 },
  limpar: { paddingHorizontal: 8, paddingVertical: 6 },
  limparTxt: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700" },
  filtroResumo: { fontSize: 12, color: Colors.ink3 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink } as any,
  list: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, maxHeight: 520 },
  item: { borderRadius: 10, backgroundColor: Colors.bg, overflow: "hidden", marginBottom: 3 },
  itemSelected: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  parentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkboxSmall: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxSmallSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  itemCode: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" as any },
  itemPrice: { fontSize: 13, color: Colors.green, fontWeight: "700", flexShrink: 0 },
  // 23/09/2026 (QA etiquetas, item 4): preco no cartao na lista, discreto —
  // so aparece com a opcao ligada, embaixo do preco em dinheiro.
  itemCardPriceHint: { fontSize: 10, color: Colors.ink3, fontWeight: "600", marginTop: 1 },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
  empty: { alignItems: "center", paddingBottom: 12 },
  emptyBtn: { borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg, paddingHorizontal: 14, minHeight: 40, justifyContent: "center" },
  emptyBtnTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "700" },
  colorDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  colorBadge: { fontSize: 9, fontWeight: "600", color: Colors.ink2, backgroundColor: Colors.bg4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  sizeBadge: { fontSize: 9, fontWeight: "700", color: Colors.violet3, backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  varBadge: { fontSize: 8, fontWeight: "700", color: "#06b6d4", backgroundColor: "rgba(6,182,212,0.12)", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: "hidden" },
  parentSelfBadge: { fontSize: 8, fontWeight: "800", color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, overflow: "hidden", letterSpacing: 0.3 },
  parentSelfRow: { borderLeftColor: "#f59e0b" + "55" },
  variantHint: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  toggleAllVarsBtn: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  toggleAllVarsText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  variantRow: { marginHorizontal: 8, marginBottom: 3, borderRadius: 8, backgroundColor: Colors.bg, overflow: "hidden", borderLeftWidth: 3, borderLeftColor: "transparent" },
  variantRowSelected: { borderLeftColor: Colors.violet, backgroundColor: Colors.bg + "cc" },
  variantLeft: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10 },
  variantName: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  variantMeta: { fontSize: 9, color: Colors.ink3, fontFamily: "monospace" as any, marginTop: 1 },
  variantPrice: { fontSize: 12, color: Colors.green, fontWeight: "700", flexShrink: 0 },
  variantCardPriceHint: { fontSize: 9, color: Colors.ink3, fontWeight: "600", marginTop: 1 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingBottom: 8, paddingLeft: 40 },
  qtyRowVariant: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingBottom: 6, paddingLeft: 34 },
  qtyBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  qtyBtnSmall: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 14, color: Colors.violet3, fontWeight: "700" },
  qtyInput: { width: 48, height: 28, borderRadius: 7, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border2, textAlign: "center", fontSize: 13, fontWeight: "700", color: Colors.ink, paddingVertical: 0 } as any,
  qtyInputSmall: { width: 40, height: 24, borderRadius: 6, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border2, textAlign: "center", fontSize: 12, fontWeight: "700", color: Colors.ink, paddingVertical: 0 } as any,
  qtyLabel: { fontSize: 10, color: Colors.ink3, marginLeft: 2 },
  printBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, minHeight: 44 },
  printBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  // Barra fixa (30/10/2026, p-72).
  barra: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2, paddingVertical: 10, paddingHorizontal: 12, zIndex: 4 },
  barraFixa: { position: "sticky" as any, bottom: 0 },
  barraEstreita: { flexDirection: "column", alignItems: "stretch", borderRadius: 0, marginHorizontal: -16, paddingHorizontal: 16 },
  // Na vaga do shell (celular, QA 375 px): faixa de largura total colada na
  // barra de navegacao de baixo, so com a linha de cima.
  barraNoShell: { marginHorizontal: 0, borderWidth: 0, borderTopWidth: 1, borderRadius: 0, paddingVertical: 10, paddingHorizontal: 16 },
  barraTot: { flex: 1, minWidth: 0 },
  barraTotTxt: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  barraSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  barraBotoes: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  barraBotoesEstreita: { width: "100%" },
  // Linha do produto com variantes (p-72).
  checkHit: { width: 36, minHeight: 40, alignItems: "flex-start", justifyContent: "center" },
  checkboxMeio: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  checkboxMeioTxt: { fontSize: 13, lineHeight: 14, color: Colors.violet3, fontWeight: "800" },
  colDireita: { alignItems: "flex-end", gap: 2, marginLeft: 8 },
  estoquePill: { fontSize: 10.5, fontWeight: "600", paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99, overflow: "hidden" },
  estoqueOk: { color: Colors.green, backgroundColor: "rgba(34,197,94,0.12)" },
  estoqueZero: { color: Colors.amber, backgroundColor: "rgba(245,158,11,0.15)" },
  verVariantes: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8, marginLeft: 4 },
  verVariantesTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "700" },
  // Celular (QA 375 px): segunda linha alinhada com o nome (10 de respiro +
  // 36 do quadradinho), selo e preco lado a lado, "Ver variantes" na direita.
  nomeQueEncolhe: { flexShrink: 1, minWidth: 0 },
  acoesDoPaiEstreita: { flexDirection: "row", alignItems: "center", paddingLeft: 46, paddingRight: 10, paddingBottom: 6, marginTop: -4 },
  colDireitaEstreita: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 0 },
  verVariantesEstreita: { marginLeft: "auto" as any, paddingRight: 0 },
  varsPainel: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 6, paddingBottom: 4 },
  varsAviso: { fontSize: 11.5, color: Colors.ink3, paddingHorizontal: 12, paddingVertical: 6 },
  variantZero: { opacity: 0.7 },
  // Sem codigo e Gerar codigo (30/10/2026, p-75).
  semCodigoPill: { fontSize: 10, fontWeight: "700", color: Colors.amber, backgroundColor: "rgba(245,158,11,0.15)", paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99, overflow: "hidden" },
  checkboxDesligado: { opacity: 0.35 },
  gerarLinha: { flexDirection: "row", paddingLeft: 40, paddingRight: 10, paddingBottom: 8 },
  gerarBtn: { borderWidth: 1, borderColor: Colors.violet, borderRadius: 8, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  gerarBtnTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "700" },
  aviso: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  avisoAmbar: { backgroundColor: Colors.amberD },
  avisoVioleta: { backgroundColor: Colors.violetD },
  avisoTxt: { flex: 1, minWidth: 180, fontSize: 12.5, color: Colors.ink },
  avisoBtn: { minHeight: 36, justifyContent: "center", paddingHorizontal: 6 },
  avisoBtnTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "700" },
  modalFundo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,8,22,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalCaixa: { width: "100%", maxWidth: 440, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, padding: 18, gap: 12 },
  modalTitulo: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  modalTexto: { fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  opcao: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, backgroundColor: Colors.bg },
  opcaoOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  opcaoTitulo: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  opcaoTexto: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.ink3, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioOn: { borderColor: Colors.violet },
  radioMiolo: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.violet },
  previa: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, backgroundColor: Colors.bg, minHeight: 44 },
  previaLinha: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  previaNome: { flex: 1, minWidth: 0, fontSize: 12.5, color: Colors.ink, fontWeight: "600" },
  previaCodigo: { fontSize: 12, color: Colors.ink2, fontFamily: "monospace" as any },
  modalErro: { fontSize: 12.5, color: Colors.red, marginTop: 6 },
  modalAcoes: { flexDirection: "row", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  modalBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", backgroundColor: Colors.bg },
  modalBtnP: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  modalBtnTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  previewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 44, borderWidth: 1, borderColor: Colors.border2 },
  previewBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  setupHint: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.amber + "33" },
  setupText: { fontSize: 10, color: Colors.amber, flex: 1, lineHeight: 16 },
  // Painel codigos invalidos (placeholder)
  invalidPanel: { backgroundColor: Colors.redD, borderRadius: 12, borderWidth: 1, borderColor: Colors.red + "44", padding: 12, gap: 8 },
  invalidHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  invalidTitle: { fontSize: 13, color: Colors.red, fontWeight: "700", flex: 1 },
  invalidClose: { padding: 4, borderRadius: 6 },
  invalidHint: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },
  invalidList: { maxHeight: 160, borderRadius: 8, backgroundColor: Colors.bg, padding: 4 },
  invalidRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  invalidName: { fontSize: 11, color: Colors.ink, fontWeight: "600", flex: 1 },
  invalidCode: { fontSize: 10, color: Colors.red, fontFamily: "monospace" as any, fontWeight: "700", backgroundColor: Colors.redD, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  invalidReason: { fontSize: 10, color: Colors.ink3, flex: 1.5 },
  // Badge EAN-13 na lista
  ean13Badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  ean13BadgeOk: { backgroundColor: "rgba(34,197,94,0.12)" },
  ean13BadgeWarn: { backgroundColor: "rgba(245,158,11,0.15)" },
  ean13BadgeText: { fontSize: 8, fontWeight: "700" },
  ean13BadgeTextOk: { color: Colors.green },
  ean13BadgeTextWarn: { color: Colors.amber },
  // Painel geracao EAN-13
  ean13Panel: { backgroundColor: Colors.amberD, borderRadius: 12, borderWidth: 1, borderColor: Colors.amber + "55", padding: 12, gap: 8 },
  ean13Header: { flexDirection: "row", alignItems: "center", gap: 8 },
  ean13Title: { fontSize: 13, color: Colors.amber, fontWeight: "700", flex: 1 },
  ean13Hint: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },
  ean13List: { maxHeight: 150, borderRadius: 8, backgroundColor: Colors.bg, padding: 4 },
  ean13Row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ean13ItemName: { fontSize: 11, color: Colors.ink, fontWeight: "600", flex: 1.5, minWidth: 0 },
  ean13OldCode: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" as any, flex: 1, minWidth: 0 },
  ean13Arrow: { fontSize: 12, color: Colors.ink3 },
  ean13NewCode: { fontSize: 10, color: Colors.green, fontFamily: "monospace" as any, fontWeight: "700", backgroundColor: "rgba(34,197,94,0.1)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ean13Actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" },
  ean13CancelBtn: { backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  ean13CancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  ean13ConfirmBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  ean13ConfirmText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default PrintLabels;
