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
// A3 (passo 2), A4a (passo 3, conferência).
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Dimensions } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { FornecedorFormSheet } from "@/components/fornecedores/FornecedorFormSheet";
import { suppliersApi, type Supplier } from "@/services/suppliersApi";
import { dialogoAbertoNaTela } from "@/hooks/useAtalhosDoCaixa";
import { FORM_VAZIO, type FormFornecedor } from "@/utils/fornecedoresUtil";
import { estoqueEntradasApi } from "@/services/estoqueEntradasApi";
import type { Product } from "@/components/screens/estoque/types";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import { Passo1Fornecedor } from "./Passo1Fornecedor";
import { Passo2Origem, type PerguntaDoCnpj } from "./Passo2Origem";
import { lerNota, type NotaLida } from "./lerNota";
import { escolherArquivo, lerTextoDoArquivo, ACEITA_NOTA } from "./escolherArquivo";
import {
  novaChaveDaEntrada, conferirEmitente, nomeDaEscolha, consultaDaNota, entradaAnteriorDaNota,
  type EscolhaDoFornecedor, type FornecedorDaLista,
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

export function ChegouMercadoriaModal({ visible, companyId, lojaNome, products, semCusto, onClose }: Props) {
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

  // ── Arquivo da nota (atalho do passo 1 e origem "Nota" do passo 2) ──
  const abrirNota = useCallback(async () => {
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
      ? !!nota && !arquivoErrado && !lendoNota && escolha !== null && !pergunta && !repetidaPendente && !(consultaNota && procurandoRepetida)
      : false;

  function continuar() {
    if (!podeContinuar) return;
    setPasso((p) => (Math.min(4, p + 1) as Passo));
  }
  function voltar() {
    setPasso((p) => (Math.max(1, p - 1) as Passo));
  }

  const temProgresso = passo < 4 && (!!nota || passo >= 3);
  const pedirFechar = () => {
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

  // ── Barra de passos ──
  const nomeFornecedor = nomeDaEscolha(escolha);
  function rotuloDoPasso(n: Passo): string {
    if (passo > n && n === 1 && nomeFornecedor) return T.passoFeitoFornecedor(nomeFornecedor);
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
  }

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
              />
            )}
          </ScrollView>

          {!novoAberto && (
            <View style={[s.rodape, estreito && s.rodapeEstreito]}>
              <Text style={s.rodapeInfo} numberOfLines={2} testID="chegou-rodape-info">{rodapeInfo}</Text>
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
