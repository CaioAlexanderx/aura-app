// ============================================================
// components/studio/mockupPorProduto/SecaoMockupPorProduto.tsx
//
// "Mockup por produto" na aba Aparência do painel Studio (28/09/2026).
//
// Pedido do PO: no lugar da fileira de ~13 chips por produto (um por
// modelo publicado), um seletor único por linha e um pré-visualizador.
// Mockup aprovado: docs/mockups/studio-aparencia-seletor-de-mockup.html.
//
//   - Cada linha: foto, nome (2 linhas), selo da situação ("Vinculado ·
//     3D", "Sem mockup", "Mockup na foto") e o seletor fechado com
//     miniatura, nome e 3D/2D do modelo atual.
//   - Prévia: coluna presa à direita no desktop; quadro preso no topo,
//     que pode ser recolhido, quando a seção é estreita. Acompanha o
//     produto em foco (linha clicada ou seletor aberto).
//   - Salvamento por linha: só a linha salvando fica ocupada; "Modelo
//     salvo" some em 2,5 s; erro volta a escolha e oferece tentar de novo.
//   - Com mais de 8 produtos: busca e filtro.
//
// A empresa é a do contexto (`company.id` do auth store), como a aba
// sempre fez: no consolidado multi-CNPJ, a Aparência é da loja aberta.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { studioVisualApi, type VisualTemplate } from "@/services/studioVisualApi";
import { request } from "@/services/api";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { Icon } from "@/components/Icon";
import { invalidateProductTemplate } from "@/components/studio/visualEngine/EnginePreview";
import { MiniaturaDoModelo } from "./MiniaturaDoModelo";
import { PreviaDoModelo } from "./PreviaDoModelo";
import { SeletorDeModelo, type Ancora } from "./SeletorDeModelo";
import { useSpecsDosModelos } from "./useSpecsDosModelos";
import {
  contarComModelo, filtrarProdutos, lerProduto, opcoesDoSeletor, rotuloDoSeletor, situacaoDoProduto,
  LIMITE_SEM_BUSCA, type FiltroDoMockup, type ProdutoDoMockup,
} from "./regras";

const WEB = Platform.OS === "web";

/** Equivalente em JS do `@media (hover: none)`: sem mouse, o caminho é o do toque. */
export function useSemHover(): boolean {
  const [semHover, setSemHover] = useState(!WEB);
  useEffect(() => {
    if (!WEB || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none)");
    const aplicar = () => setSemHover(!!mq.matches);
    aplicar();
    if (mq.addEventListener) {
      mq.addEventListener("change", aplicar);
      return () => mq.removeEventListener("change", aplicar);
    }
    (mq as any).addListener?.(aplicar);
    return () => (mq as any).removeListener?.(aplicar);
  }, []);
  return semHover;
}

function sem<T extends Record<string, any>>(o: T, k: string): T {
  if (!(k in o)) return o;
  const c = { ...o };
  delete c[k];
  return c;
}

function iniciais(nome: string) {
  return nome.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase()).join("");
}

export function SecaoMockupPorProduto({ companyId }: { companyId: string }) {
  const T = useStudioTokens() as any;
  const { width: larguraDaJanela } = useWindowDimensions();
  const [largura, setLargura] = useState(0);

  const [produtos, setProdutos] = useState<ProdutoDoMockup[] | null>(null);
  const [templates, setTemplates] = useState<VisualTemplate[] | null>(null);
  const [erroModelos, setErroModelos] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const [vinculos, setVinculos] = useState<Record<string, string | null>>({});
  const vinculosRef = useRef(vinculos);
  vinculosRef.current = vinculos;
  const [foco, setFoco] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<Record<string, true>>({});
  const [salvo, setSalvo] = useState<Record<string, true>>({});
  // pid → modelo que não salvou (o "Tentar de novo" repete a mesma escolha).
  const [falhou, setFalhou] = useState<Record<string, string | null>>({});
  const [anuncio, setAnuncio] = useState("");

  const [aberto, setAberto] = useState<string | null>(null);
  const abertoRef = useRef<string | null>(null);
  abertoRef.current = aberto;
  const [ativo, setAtivo] = useState(0);
  const [candidato, setCandidato] = useState<string | null | undefined>(undefined);
  const [modoToque, setModoToque] = useState(false);
  const [ancora, setAncora] = useState<Ancora | null>(null);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroDoMockup>("todos");
  const [recolhida, setRecolhida] = useState(false);

  const semHover = useSemHover();
  const ultimoPonteiro = useRef("mouse");
  const gatilhos = useRef<Record<string, any>>({});
  const timersSalvo = useRef<Record<string, any>>({});
  const vivo = useRef(true);
  useEffect(() => () => {
    vivo.current = false;
    Object.values(timersSalvo.current).forEach((t) => clearTimeout(t));
  }, []);

  // ── Dados ───────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    let ok = true;
    // A MESMA rota que o Configurador usa: a genérica filtra por
    // vertical=varejo e devolve vazio em conta Studio.
    request<{ products: any[] }>(
      "/companies/" + companyId + "/studio/products?limit=200",
      { method: "GET", retry: 1, timeout: 8000 },
    )
      .then((r) => {
        if (!ok) return;
        const lidos = (r?.products || []).filter((p: any) => p.is_personalizable).map(lerProduto);
        setProdutos(lidos);
        const inicial: Record<string, string | null> = {};
        lidos.forEach((p) => { inicial[p.id] = p.visual_template_key; });
        setVinculos(inicial);
        setFoco((f) => f || lidos[0]?.id || null);
      })
      .catch(() => { if (ok) setProdutos([]); });
    return () => { ok = false; };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let ok = true;
    setErroModelos(false);
    setTemplates(null);
    studioVisualApi.listVisualTemplates(companyId)
      .then((r) => { if (ok) setTemplates(r?.templates || []); })
      .catch(() => { if (ok) { setErroModelos(true); setTemplates([]); } });
    return () => { ok = false; };
  }, [companyId, tentativa]);

  const specs = useSpecsDosModelos(companyId, templates);
  const opcoes = useMemo(() => opcoesDoSeletor(templates || []), [templates]);

  // ── Layout ──────────────────────────────────────────────
  // Medido no contêiner, não na janela: a aba mora ao lado da barra do painel.
  const empilhado = largura > 0 && largura < 900;
  const linhaEmpilhada = largura > 0 && largura < 540;
  const folha = larguraDaJanela <= 640;
  const pad = largura > 0 && largura < 540 ? 14 : 18;

  // ── Salvar ──────────────────────────────────────────────
  const anunciar = useCallback((t: string) => {
    setAnuncio("");
    setTimeout(() => { if (vivo.current) setAnuncio(t); }, 30);
  }, []);

  const vincular = useCallback(async (pid: string, key: string | null) => {
    const antes = vinculosRef.current[pid] ?? null;
    setFalhou((f) => sem(f, pid));
    if (antes === key) return;
    const nome = produtos?.find((p) => p.id === pid)?.name || "";
    setVinculos((v) => ({ ...v, [pid]: key }));
    setSalvando((s) => ({ ...s, [pid]: true }));
    setSalvo((s) => sem(s, pid));
    try {
      await studioVisualApi.setProductVisualTemplate(companyId, pid, key);
      // O preview do PDV guarda o modelo por produto: esquece o antigo.
      invalidateProductTemplate(companyId, pid);
      if (!vivo.current) return;
      setSalvo((s) => ({ ...s, [pid]: true }));
      anunciar("Modelo salvo para " + nome);
      clearTimeout(timersSalvo.current[pid]);
      timersSalvo.current[pid] = setTimeout(() => { if (vivo.current) setSalvo((s) => sem(s, pid)); }, 2500);
    } catch {
      if (!vivo.current) return;
      // Volta ao que era: mostrar vinculado o que não salvou faria a
      // lojista contar com uma prévia que a vitrine não tem. E avisa.
      setVinculos((v) => ({ ...v, [pid]: antes }));
      setFalhou((f) => ({ ...f, [pid]: key }));
      anunciar("Não salvou o modelo de " + nome + ". A escolha anterior voltou.");
    } finally {
      if (vivo.current) setSalvando((s) => sem(s, pid));
    }
  }, [companyId, produtos, anunciar]);

  // ── Seletor ─────────────────────────────────────────────
  function abrir(pid: string) {
    if (salvando[pid]) return;
    if (abertoRef.current === pid) { fechar(true); return; }
    const g = gatilhos.current[pid];
    let a: Ancora | null = null;
    try {
      const r = g?.getBoundingClientRect?.();
      if (r) a = { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width };
    } catch (_e) {}
    const atual = vinculosRef.current[pid] ?? null;
    setAncora(a);
    setFoco(pid);
    setModoToque(folha || semHover || ultimoPonteiro.current === "touch" || ultimoPonteiro.current === "pen");
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.key === atual)));
    setCandidato(atual);
    setAberto(pid);
  }

  const fechar = useCallback((devolverFoco: boolean) => {
    const pid = abertoRef.current;
    if (!pid) return;
    abertoRef.current = null;
    setAberto(null);
    setCandidato(undefined);
    if (devolverFoco) {
      const g = gatilhos.current[pid];
      setTimeout(() => { try { g?.focus?.({ preventScroll: true }); } catch (_e) {} }, 0);
    }
  }, []);

  const confirmar = useCallback((key: string | null) => {
    const pid = abertoRef.current;
    if (!pid) return;
    fechar(true);
    vincular(pid, key);
  }, [fechar, vincular]);

  const moverAtivo = useCallback((i: number, previa: boolean) => {
    setAtivo(i);
    if (previa) setCandidato(opcoes[i]?.key ?? null);
  }, [opcoes]);

  const voltarAoAtual = useCallback(() => {
    const pid = abertoRef.current;
    if (!pid) return;
    const atual = vinculosRef.current[pid] ?? null;
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.key === atual)));
    setCandidato(atual);
  }, [opcoes]);

  // ── Cartão ──────────────────────────────────────────────
  const cartao = {
    backgroundColor: T.paperCard, borderRadius: 16, borderWidth: 1, borderColor: T.ink5, padding: pad,
  } as const;

  const cabecalho = (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: "700", color: T.ink }}>Mockup por produto</Text>
        {produtos && templates && templates.length > 0 && produtos.length > 0 ? (
          <Text style={{ fontSize: 12.5, color: T.ink3 }} testID="contagem">
            <Text style={{ fontWeight: "700", color: T.ink }}>
              {contarComModelo(produtos, vinculos)} de {produtos.length}
            </Text>{" "}com modelo
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 13, lineHeight: 19, color: T.ink2, maxWidth: 640 }}>
        O modelo é a peça que a sua cliente gira na loja, com a arte dela aplicada, antes de pagar. Escolha um
        para cada produto. Sem modelo, a loja mostra a foto do produto com a arte por cima, sem girar.
      </Text>
    </View>
  );

  const regiaoViva = (
    <Text
      aria-live="polite"
      testID="anuncio"
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
    >
      {anuncio}
    </Text>
  );

  // ── Estados sem lista ───────────────────────────────────
  if (templates === null || produtos === null) {
    return (
      <View style={cartao} onLayout={(e) => setLargura(e.nativeEvent.layout.width)} testID="mockup-carregando">
        {cabecalho}
        <View style={{ marginTop: 16, gap: 8 }} aria-busy aria-label="Carregando os modelos">
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 72, borderRadius: 14, backgroundColor: T.bgSoft }} />
          ))}
        </View>
      </View>
    );
  }

  if (erroModelos || templates.length === 0 || produtos.length === 0) {
    let titulo = "Nenhum modelo publicado ainda. A Aura mantém esta lista.";
    let texto = "Enquanto isso, a loja mostra a foto de cada produto com a arte por cima. Se quiser, marque o Mockup na foto na aba Personalização do produto.";
    if (erroModelos) {
      titulo = "Não foi possível carregar os modelos agora.";
      texto = "Confira a conexão e tente de novo.";
    } else if (produtos.length === 0) {
      titulo = "Nenhum produto personalizável ainda.";
      texto = "Marque um produto como personalizável no Estoque para escolher o modelo dele aqui.";
    }
    return (
      <View style={cartao} onLayout={(e) => setLargura(e.nativeEvent.layout.width)} testID="mockup-vazio">
        {cabecalho}
        <View
          style={{
            marginTop: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: T.ink4, borderRadius: 14,
            paddingVertical: 28, paddingHorizontal: 20, alignItems: "center", gap: 6,
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
            <Icon name={erroModelos ? "alert_circle" : "box"} size={22} color={T.infoInk} />
          </View>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: T.ink, textAlign: "center" }} testID="mockup-vazio-titulo">{titulo}</Text>
          <Text style={{ fontSize: 13, color: T.ink3, textAlign: "center", maxWidth: 460 }}>{texto}</Text>
          {erroModelos ? (
            <Pressable onPress={() => setTentativa((n) => n + 1)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}>
              <Text style={{ fontWeight: "700", color: T.infoInk }}>Tentar de novo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Lista e prévia ──────────────────────────────────────
  const pFoco = produtos.find((p) => p.id === foco) || produtos[0];
  const atualFoco = vinculos[pFoco.id] ?? null;
  let keyDaPrevia = atualFoco;
  let provisorio = false;
  if (aberto === pFoco.id && candidato !== undefined) {
    keyDaPrevia = candidato;
    provisorio = keyDaPrevia !== atualFoco;
  }
  const tDaPrevia = keyDaPrevia ? templates.find((t) => t.key === keyDaPrevia) || null : null;
  const specDaPrevia = tDaPrevia ? specs[tDaPrevia.key] : null;

  const visiveis = filtrarProdutos(produtos, vinculos, busca, filtro);
  const comBusca = produtos.length > LIMITE_SEM_BUSCA;
  const com = contarComModelo(produtos, vinculos);
  const produtoAberto = aberto ? produtos.find((p) => p.id === aberto) || null : null;
  const folhaAberta = !!aberto && folha;

  const previa = (
    <PreviaDoModelo
      produto={pFoco}
      template={tDaPrevia}
      spec={specDaPrevia}
      provisorio={provisorio}
      compacto={empilhado}
      recolhida={empilhado && recolhida}
      onRecolher={() => setRecolhida((r) => !r)}
      pausar3D={folhaAberta}
      T={T}
      testID="previa"
    />
  );

  const filtros = comBusca ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
      <View style={{ flexGrow: 1, flexBasis: 220, minWidth: 0, justifyContent: "center" }}>
        <View style={{ position: "absolute", left: 11, zIndex: 1 }} pointerEvents="none">
          <Icon name="search" size={16} color={T.ink3} />
        </View>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar produto"
          placeholderTextColor={T.ink3}
          accessibilityLabel="Buscar produto pelo nome"
          testID="busca"
          style={{
            minHeight: linhaEmpilhada ? 44 : 40, borderRadius: 10, borderWidth: 1.5, borderColor: T.ink5,
            backgroundColor: T.paperCardElev, paddingLeft: 34, paddingRight: 12, color: T.ink, fontSize: 14,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Filtrar produtos">
        {([["todos", "Todos", produtos.length], ["sem", "Sem modelo", produtos.length - com], ["com", "Com modelo", com]] as const).map(([id, rotulo, n]) => {
          const on = filtro === id;
          return (
            <Pressable
              key={id}
              onPress={() => setFiltro(id)}
              accessibilityRole="button"
              aria-pressed={on}
              testID={"filtro-" + id}
              style={{
                minHeight: linhaEmpilhada ? 44 : 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999,
                borderWidth: 1.5, borderColor: on ? T.primary : T.ink5, backgroundColor: on ? T.primaryGhost : "transparent",
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: on ? T.infoInk : T.ink2 }}>
                {rotulo} <Text style={{ fontWeight: "500", color: on ? T.infoInk : T.ink3 }}>{n}</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  const linhas = visiveis.length === 0 ? (
    <View style={{ paddingVertical: 22, alignItems: "center", gap: 4 }} testID="lista-vazia">
      <Text style={{ color: T.ink3, textAlign: "center" }}>
        Nenhum produto encontrado{busca.trim() ? " com “" + busca.trim() + "”" : " neste filtro"}.
      </Text>
      <Pressable
        onPress={() => { setBusca(""); setFiltro("todos"); }}
        accessibilityRole="button"
        style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
      >
        <Text style={{ fontWeight: "700", color: T.infoInk, textDecorationLine: "underline" }}>Limpar busca e filtro</Text>
      </Pressable>
    </View>
  ) : visiveis.map((p, idx) => {
    const key = vinculos[p.id] ?? null;
    const sit = situacaoDoProduto(p, key, templates);
    const rot = rotuloDoSeletor(p, key, templates, key ? specs[key] : null);
    const emFoco = pFoco.id === p.id;
    const ocupado = !!salvando[p.id];
    const deuErro = Object.prototype.hasOwnProperty.call(falhou, p.id);
    const selo = sit.situacao === "vinculado"
      ? { bg: T.successSoft, cor: T.successInk, borda: "transparent" }
      : sit.situacao === "foto"
        ? { bg: T.accentSoft, cor: T.accentInk, borda: "transparent" }
        : { bg: "transparent", cor: T.ink3, borda: T.ink5 };
    const lado = linhaEmpilhada ? 44 : 52;

    const gatilho = (
      <View
        style={linhaEmpilhada ? { width: "100%" } : { width: 280, flexShrink: 0 }}
        {...({ onPointerDown: (e: any) => { ultimoPonteiro.current = e?.nativeEvent?.pointerType || e?.pointerType || "mouse"; } } as any)}
      >
        <Pressable
          ref={(el: any) => { gatilhos.current[p.id] = el; }}
          onPress={() => abrir(p.id)}
          onFocus={() => { if (!abertoRef.current) setFoco(p.id); }}
          onKeyDown={(e: any) => {
            const k = e?.key ?? e?.nativeEvent?.key;
            if ((k === "ArrowDown" || k === "ArrowUp") && !abertoRef.current) { e.preventDefault?.(); abrir(p.id); }
          }}
          accessibilityRole="button"
          accessibilityLabel={"Modelo de " + p.name + ": " + rot.nome + (ocupado ? ", salvando" : "")}
          aria-expanded={aberto === p.id}
          // `disabled` do RNW vira aria-disabled e bloqueia o toque; o
          // tabIndex fixo mantém o foco do teclado aqui enquanto salva.
          disabled={ocupado}
          tabIndex={0}
          aria-busy={ocupado}
          {...({ "aria-haspopup": "listbox" } as any)}
          testID={"seletor-" + p.id}
          style={({ hovered, focused }: any) => ({
            flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50,
            paddingVertical: 5, paddingLeft: 5, paddingRight: 10, borderRadius: 12,
            borderWidth: 1.5,
            borderColor: aberto === p.id ? T.primary : hovered && !ocupado ? T.ink4 : T.ink5,
            backgroundColor: T.paperCardElev,
            ...(focused ? { outlineColor: T.primary2 || T.primary, outlineStyle: "solid", outlineWidth: 2, outlineOffset: 2 } : {}),
            ...(ocupado ? { cursor: "progress" } : {}),
          })}
        >
          <MiniaturaDoModelo
            template={rot.template}
            spec={rot.template ? specs[rot.template.key] : null}
            foto={rot.tipo === "FOTO" ? p.foto : null}
            T={T}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "650" as any, color: T.ink }} testID={"seletor-nome-" + p.id}>{rot.nome}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
              {rot.tipo && !ocupado ? (
                <View style={{ borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: rot.tipo === "FOTO" ? T.accentSoft : T.primarySoft }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: rot.tipo === "FOTO" ? T.accentInk : T.infoInk }}>{rot.tipo}</Text>
                </View>
              ) : null}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, color: T.ink3 }} testID={"seletor-meta-" + p.id}>
                {ocupado ? "Salvando…" : rot.meta}
              </Text>
            </View>
          </View>
          {ocupado
            ? <ActivityIndicator size="small" color={T.primary} />
            : <Icon name={aberto === p.id ? "chevron_up" : "chevron_down"} size={18} color={T.ink3} />}
        </Pressable>
      </View>
    );

    const miniatura = (
      <View
        style={{
          width: lado, height: lado, borderRadius: linhaEmpilhada ? 10 : 12, overflow: "hidden",
          alignItems: "center", justifyContent: "center",
          backgroundColor: p.foto ? "#ECEAE4" : T.bgSoft,
          borderWidth: p.foto ? 0 : 1.5, borderStyle: "dashed", borderColor: T.ink4,
        }}
        aria-hidden
      >
        {p.foto
          ? <Image source={{ uri: p.foto }} style={{ width: lado, height: lado }} resizeMode="cover" />
          : <Text style={{ fontSize: 13, fontWeight: "800", color: T.ink3 }}>{iniciais(p.name)}</Text>}
      </View>
    );

    const info = (
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "650" as any, lineHeight: 17.5, color: T.ink }}>{p.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
          <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: selo.bg, borderWidth: 1, borderColor: selo.borda }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: selo.cor }} testID={"selo-" + p.id}>{sit.rotulo}</Text>
          </View>
          {!p.foto ? <Text style={{ fontSize: 11.5, color: T.ink3 }}>Sem foto</Text> : null}
          {salvo[p.id] ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Icon name="check" size={13} color={T.successInk} />
              <Text style={{ fontSize: 11.5, fontWeight: "600", color: T.successInk }} testID={"salvo-" + p.id}>Modelo salvo</Text>
            </View>
          ) : null}
        </View>
      </View>
    );

    const erro = deuErro ? (
      <View
        role="alert"
        testID={"erro-" + p.id}
        style={{
          flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8,
          marginLeft: linhaEmpilhada ? 0 : lado + 12,
          backgroundColor: T.dangerSoft, borderRadius: 10, paddingLeft: 10, paddingRight: 4, paddingVertical: 2,
        }}
      >
        <Icon name="alert_circle" size={15} color={T.dangerInk} />
        <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "700", color: T.dangerInk }}>Não salvou, tente de novo.</Text>
        <Pressable
          onPress={() => { setFoco(p.id); vincular(p.id, falhou[p.id]); }}
          accessibilityRole="button"
          testID={"tentar-" + p.id}
          style={{ minHeight: linhaEmpilhada ? 44 : 32, justifyContent: "center", paddingHorizontal: 8 }}
        >
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: T.dangerInk, textDecorationLine: "underline" }}>Tentar de novo</Text>
        </Pressable>
      </View>
    ) : null;

    return (
      <Pressable
        key={p.id}
        onPress={() => setFoco(p.id)}
        focusable={false}
        testID={"linha-" + p.id}
        style={({ hovered }: any) => ({
          position: "relative", padding: linhaEmpilhada ? 8 : 10, borderRadius: 14, borderWidth: 1.5,
          borderColor: emFoco ? T.primarySoft : "transparent",
          backgroundColor: emFoco || hovered ? T.primaryGhost : "transparent",
          borderTopColor: emFoco ? T.primarySoft : idx > 0 ? T.ink5 : "transparent",
          ...(WEB ? { cursor: "pointer" } : {}),
        })}
      >
        {emFoco ? (
          <View style={{ position: "absolute", left: -1.5, top: 14, bottom: 14, width: 3, borderRadius: 3, backgroundColor: T.accent }} />
        ) : null}
        {linhaEmpilhada ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>{miniatura}{info}</View>
            {gatilho}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>{miniatura}{info}{gatilho}</View>
        )}
        {erro}
      </Pressable>
    );
  });

  const colunaPrevia = (
    <View
      style={[
        empilhado
          ? { marginHorizontal: -pad, paddingHorizontal: pad, paddingTop: 8, paddingBottom: 10, backgroundColor: T.paperCard, zIndex: 6 }
          : { width: largura >= 1100 ? 380 : 320, flexShrink: 0, alignSelf: "flex-start" },
        (WEB ? { position: "sticky", top: empilhado ? 0 : 16 } : null) as any,
      ]}
      testID="coluna-previa"
    >
      {previa}
    </View>
  );

  return (
    <View style={cartao} onLayout={(e) => setLargura(e.nativeEvent.layout.width)} testID="mockup-por-produto">
      {cabecalho}
      {regiaoViva}
      <View style={{ marginTop: 16, flexDirection: empilhado ? "column" : "row", gap: empilhado ? 12 : 20, alignItems: empilhado ? "stretch" : "flex-start" }}>
        {empilhado ? colunaPrevia : null}
        <View style={{ flex: empilhado ? undefined : 1, minWidth: 0 }}>
          {filtros}
          <View style={{ gap: 4 }} testID="lista-de-produtos">{linhas}</View>
        </View>
        {empilhado ? null : colunaPrevia}
      </View>

      {produtoAberto ? (
        <SeletorDeModelo
          produto={produtoAberto}
          opcoes={opcoes}
          atual={vinculos[produtoAberto.id] ?? null}
          specs={specs}
          folha={folha}
          modoToque={modoToque}
          ancora={ancora}
          ativo={ativo}
          candidato={candidato}
          onAtivo={moverAtivo}
          onSair={voltarAoAtual}
          onConfirmar={confirmar}
          onFechar={fechar}
          previaDaFolha={folha ? (
            <PreviaDoModelo
              produto={produtoAberto}
              template={tDaPrevia}
              spec={specDaPrevia}
              provisorio={provisorio}
              naFolha
              T={T}
              testID="previa-folha"
            />
          ) : null}
          T={T}
        />
      ) : null}
    </View>
  );
}

export default SecaoMockupPorProduto;
