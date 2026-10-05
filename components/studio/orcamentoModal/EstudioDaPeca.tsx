// ============================================================
// components/studio/orcamentoModal/EstudioDaPeca.tsx
//
// A peça aberta no orçamento vira um estúdio (29/09/2026). Pedido do PO:
// "O destaque do orçamento é o vídeo. Ele precisa estar em primeiro
// plano, com a opção de enviar a arte. Não precisa de campo de texto."
//
// Mockup aprovado: docs/mockups/studio-orcamento-video-primeiro-plano.html
//
//   - a prévia 3D grande, girando: é o giro de 7 s que vai no vídeo, com
//     TODAS as artes da peça ao mesmo tempo (PalcoDaPeca);
//   - os lugares da arte como cartões de envio, só os que o produto e o
//     modelo têm (artesPorLado.ladosDaPeca): tocar ou arrastar, miniatura,
//     trocar e remover; na caneca, "Frente e verso | Estendida" — a
//     estendida dá a volta inteira e substitui as duas;
//   - tamanho e posição por lado (o ajuste do #1013, por lado), ou a
//     POSIÇÃO LIVRE (29/09/2026, arteLivre.ts): a arte em qualquer lugar
//     do painel inteiro do lado, arrastada direto na peça 3D, com alça ou
//     pinça para o tamanho, botões e teclado; a prévia da peça vai para a
//     ficha (orcamento_previa_<lado>), que não representa posição livre;
//   - a cor da peça, se o produto tiver cor.
//
// Tudo vai para o `customization` do item (artesPorLado.customizacaoComArtes)
// no formato do pedido: aprovar o orçamento leva as artes para a Produção.
// Multi-CNPJ: o envio da imagem usa a empresa do orçamento (`cid`).
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import type { VisualTemplate, VisualTemplateSpec } from "@/services/studioVisualApi";
import { pickImageBase64, uploadStudioMockup, fileToBase64Web } from "@/services/studioUploadApi";
import { formaDaMiniaturaDoModelo } from "@/components/studio/mockupPorProduto/MiniaturaDoModelo";
import { areaDoLadoNoModelo, areaParaPintar } from "@/components/studio/visualEngine/areasDaPeca";
import { painelLivre } from "@/components/studio/visualEngine/painelDaPeca";
import { coresDaPeca } from "@/components/studio/orcamentoVideo/pecaDoOrcamento";
import { ESCALA_MIN, ESCALA_MAX } from "@/components/studio/orcamentoVideo/tamanhoDaArte";
import {
  artesDoItem, customizacaoComArtes, motorDasArtes, ladosDaPeca, ladosEmUso, ajustarLado, ajusteDoLado,
  comImagem, livreDoLado, comLivre, comPrevia, ROTULO_DO_LADO, DO_LADO,
  type ArtesDaPeca, type LadoDaArte,
} from "@/components/studio/orcamentoVideo/artesPorLado";
import {
  alvoDoToque, distanciaAoCentro, moverLivre, escalarLivre, girarLivre, centralizar, encaixarNoPainel,
  escalaMaxima, livreDaArea, PASSO_DA_ROTACAO, ESCALA_LIVRE_MIN,
  type AjusteLivre,
} from "@/components/studio/orcamentoVideo/arteLivre";
import { PalcoDaPeca, type VistaDoPalco, type ArrasteNoPainel, type ToqueNoPainel, type ApiDoPalco } from "./PalcoDaPeca";
import { Botao, Rotulo, type Tema } from "./ui";

const TIPOS_ACEITOS = "image/png,image/jpeg,image/webp";

type Imagem = { base64: string; content_type: string };
type Envio = { estado: "enviando" | "erro"; img: Imagem; mensagem?: string };

type Props = {
  tema: Tema;
  cid: string | null;
  /** A chave da peça no modal: trocar de peça recomeça o estúdio. */
  chave: string;
  customization: Record<string, any> | null;
  cfg: any;
  /** Modelo efetivo da peça (o do item ou o do produto). */
  template: VisualTemplate | null;
  spec: VisualTemplateSpec | null;
  editavel: boolean;
  onMudar: (customization: Record<string, any>) => void;
};

export function EstudioDaPeca({ tema, cid, chave, customization, cfg, template, spec, editavel, onMudar }: Props) {
  const { t, estreito, escuro } = tema;
  const tem3d = !!(template && template.kind === "model3d" && spec);
  const specDoPalco = tem3d ? spec : null;
  const lados = useMemo(() => ladosDaPeca(cfg, specDoPalco), [cfg, specDoPalco]);

  // As artes vivem aqui enquanto a peça está aberta: a estendida guarda
  // frente e verso (que saem do item) para voltarem se a lojista desistir.
  const [artes, setArtes] = useState<ArtesDaPeca>(() => artesDoItem(cfg, customization));
  useEffect(() => { setArtes(artesDoItem(cfg, customization)); }, [chave, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const [envios, setEnvios] = useState<Partial<Record<LadoDaArte, Envio>>>({});
  const emUso = ladosEmUso(artes, lados);
  const [ativo, setAtivo] = useState<LadoDaArte>(() => emUso.find((l) => artes.imagens[l]) || emUso[0]);
  const [vista, setVista] = useState<VistaDoPalco>({ area: null, n: 0 });
  const ativoValido: LadoDaArte = emUso.includes(ativo) ? ativo : emUso[0];

  const forma = template && specDoPalco ? formaDaMiniaturaDoModelo(template, specDoPalco) : null;
  const peca = forma === "caneca" || forma === "camiseta" ? forma : null;

  // ── Posição livre (29/09/2026) ─────────────────────────────
  // O lado ativo na posição livre, com arte, numa peça 3D: a arte vai
  // para o painel inteiro e a lojista arruma direto na peça.
  const urlAtiva = artes.imagens[ativoValido] || null;
  const livreAtivo = tem3d && editavel && urlAtiva ? livreDoLado(artes, ativoValido) : null;
  const areaAtiva = specDoPalco ? areaDoLadoNoModelo(specDoPalco, ativoValido) : null;
  const painel = useMemo(() => (specDoPalco && areaAtiva ? painelLivre(specDoPalco, areaAtiva) : null), [specDoPalco, areaAtiva]);
  const aspArte = useAspecto(urlAtiva);
  const aspPainel = painel ? painel.aspecto : 1;
  const editandoLivre = !!(livreAtivo && painel);

  const motor = useMemo(
    () => motorDasArtes(cfg, customization, artes, specDoPalco, peca, editandoLivre ? ativoValido : null),
    [cfg, customization, artes, specDoPalco, peca, editandoLivre, ativoValido],
  );
  const cores = coresDaPeca(cfg);

  // O customization mais recente: o fim de um envio (assíncrono) escreve
  // sobre o que está no item agora, não sobre o de quando começou.
  const custRef = useRef(customization);
  custRef.current = customization;
  // O `artes` mais recente: o fim de um envio (ou de um arraste) não
  // sobrescreve o que a lojista mudou nesse meio-tempo.
  const artesRef = useRef(artes);
  artesRef.current = artes;
  function mudar(novo: ArtesDaPeca) {
    artesRef.current = novo;
    setArtes(novo);
    onMudar(customizacaoComArtes(cfg, custRef.current, novo));
  }

  function virarPara(lado: LadoDaArte, livre = !!livreDoLado(artesRef.current, lado)) {
    setAtivo(lado);
    const area = specDoPalco ? areaDoLadoNoModelo(specDoPalco, lado) : null;
    // A estendida não tem "de frente": a peça continua girando. Na posição
    // livre ela para de frente para o meio da volta, para a lojista arrumar.
    setVista((v) => ({ area: lado === "middle" && !livre ? null : area, n: v.n + 1 }));
  }

  // ── Envio da imagem ────────────────────────────────────────
  // O `artes` mais recente, para o fim de um envio não sobrescrever o que
  // a lojista mudou enquanto a imagem subia.
  async function enviar(lado: LadoDaArte, img: Imagem) {
    if (!cid) return;
    setEnvios((e) => ({ ...e, [lado]: { estado: "enviando", img } }));
    virarPara(lado);
    try {
      const up = await uploadStudioMockup(cid, { content_base64: img.base64, content_type: img.content_type, kind: "customization" });
      if (!up?.url) throw new Error("O envio não devolveu o endereço da imagem");
      setEnvios((e) => { const n = { ...e }; delete n[lado]; return n; });
      mudar(comImagem(artesRef.current, lado, up.url));
    } catch (e: any) {
      const mensagem = e?.data?.error || e?.message || "A conexão caiu no meio do envio";
      setEnvios((x) => ({ ...x, [lado]: { estado: "erro", img, mensagem } }));
    }
  }
  async function escolher(lado: LadoDaArte) {
    try {
      const img = await pickImageBase64(TIPOS_ACEITOS);
      if (img) enviar(lado, img);
    } catch (e: any) {
      toast.error(e?.message || "Não deu para abrir a imagem");
    }
  }
  async function soltou(lado: LadoDaArte, file: File) {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast.error("Envie uma imagem PNG, JPG ou WEBP"); return; }
    try {
      const { base64, content_type } = await fileToBase64Web(file);
      enviar(lado, { base64, content_type });
    } catch (e: any) {
      toast.error(e?.message || "Não deu para ler a imagem");
    }
  }

  // O arraste na peça: mexe só no estado local enquanto o dedo anda (a
  // textura repinta), e grava no item quando solta.
  const livreRef = useRef({ lado: ativoValido, a: livreAtivo, asp: aspArte, aspP: aspPainel });
  livreRef.current = { lado: ativoValido, a: livreAtivo, asp: aspArte, aspP: aspPainel };
  const gesto = useRef<{ modo: "mover" | "escala" | "pinca" | null; u0: number; v0: number; d0: number; a0: AjusteLivre | null; mexeu: boolean }>({ modo: null, u0: 0, v0: 0, d0: 1, a0: null, mexeu: false });
  const dedos = useRef(new Map<number, ToqueNoPainel>());
  function gravarLivre(a: AjusteLivre, noItem: boolean) {
    const novo = comLivre(artesRef.current, livreRef.current.lado, a);
    if (noItem) mudar(novo);
    else { artesRef.current = novo; setArtes(novo); }
  }
  const arrasteLivre = useMemo<ArrasteNoPainel>(() => ({
    tocar(p, e) {
      const L = livreRef.current;
      const g = gesto.current;
      if (!L.a || !p) return false;
      // Segundo dedo sobre a arte que o primeiro pegou: pinça.
      if (dedos.current.size >= 1 && g.modo && g.a0) {
        dedos.current.set(e.pointerId, p);
        const [a, b] = Array.from(dedos.current.values());
        if (a && b) Object.assign(g, { modo: "pinca", a0: L.a, d0: Math.max(1e-3, Math.hypot(a.u - b.u, (a.v - b.v) * L.aspP)) });
        return true;
      }
      // A folga é de TELA: 22 px no mouse e 30 no dedo.
      const px = (e as any).pointerType === "touch" ? 30 : 22;
      const folga = p.pxPorU && p.pxPorU > 0 ? px / p.pxPorU : 0.03;
      const alvo = alvoDoToque(L.a, L.asp, L.aspP, p.u, p.v, folga);
      if (!alvo) return false;
      dedos.current.set(e.pointerId, p);
      if (alvo === "canto") Object.assign(g, { modo: "escala", a0: L.a, d0: Math.max(1e-3, distanciaAoCentro(L.a, L.aspP, p.u, p.v)), mexeu: false });
      else Object.assign(g, { modo: "mover", a0: L.a, u0: p.u, v0: p.v, mexeu: false });
      return true;
    },
    mover(p, e) {
      const L = livreRef.current;
      const g = gesto.current;
      if (!p || !g.modo || !g.a0) return;
      if (dedos.current.has(e.pointerId)) dedos.current.set(e.pointerId, p);
      const teto = escalaMaxima(L.asp, L.aspP);
      let novo: AjusteLivre;
      if (g.modo === "pinca") {
        const [a, b] = Array.from(dedos.current.values());
        if (!a || !b) return;
        novo = escalarLivre(g.a0, Math.hypot(a.u - b.u, (a.v - b.v) * L.aspP) / g.d0, teto);
      } else if (g.modo === "escala") {
        novo = escalarLivre(g.a0, distanciaAoCentro(g.a0, L.aspP, p.u, p.v) / g.d0, teto);
      } else {
        novo = moverLivre(g.a0, p.u - g.u0, p.v - g.v0);
        // Gruda no meio do painel (a linha do peito, o centro da caneca).
        if (Math.abs(novo.u - 0.5) < 0.012) novo = { ...novo, u: 0.5 };
      }
      g.mexeu = true;
      gravarLivre(novo, false);
    },
    soltar(e) {
      dedos.current.delete(e.pointerId);
      const g = gesto.current;
      if (dedos.current.size === 0) {
        if (g.mexeu) mudar(artesRef.current);
        Object.assign(g, { modo: null, a0: null, mexeu: false });
        return false;
      }
      // Sobrou um dedo depois da pinça: volta a mover a partir dele.
      const [a] = Array.from(dedos.current.values());
      const atual = livreDoLado(artesRef.current, livreRef.current.lado);
      if (a && atual) Object.assign(g, { modo: "mover", a0: atual, u0: a.u, v0: a.v });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Botões e teclado da posição livre.
  const livreAcoes = {
    mover: (du: number, dv: number) => { if (livreAtivo) gravarLivre(moverLivre(livreAtivo, du, dv), true); },
    escalar: (f: number) => { if (livreAtivo) gravarLivre(escalarLivre(livreAtivo, f, escalaMaxima(aspArte, aspPainel)), true); },
    girar: (g: number) => { if (livreAtivo) gravarLivre(girarLivre(livreAtivo, g), true); },
    centralizar: () => { if (livreAtivo) gravarLivre(centralizar(livreAtivo), true); },
    encaixar: () => { if (livreAtivo) gravarLivre(encaixarNoPainel(aspArte, aspPainel), true); },
  };
  function teclaLivre(ev: { key: string; shiftKey?: boolean; preventDefault?: () => void }) {
    if (!livreAtivo) return;
    const p = ev.shiftKey ? 0.05 : 0.01;
    const setas: Record<string, [number, number]> = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] };
    let feito = true;
    if (setas[ev.key]) livreAcoes.mover(setas[ev.key][0], setas[ev.key][1]);
    else if (ev.key === "+" || ev.key === "=") livreAcoes.escalar(1.05);
    else if (ev.key === "-" || ev.key === "_") livreAcoes.escalar(1 / 1.05);
    else if (ev.key === "]") livreAcoes.girar(PASSO_DA_ROTACAO);
    else if (ev.key === "[") livreAcoes.girar(-PASSO_DA_ROTACAO);
    else feito = false;
    if (feito) ev.preventDefault?.();
  }

  // Entrar na posição livre: a arte começa onde o encaixe da área a punha.
  function liberar(lado: LadoDaArte) {
    const area = specDoPalco ? areaDoLadoNoModelo(specDoPalco, lado) : null;
    const pn = specDoPalco && area ? painelLivre(specDoPalco, area) : null;
    if (!pn) return;
    const au = (areaParaPintar(specDoPalco!.areas as any, area!, (specDoPalco as any).model?.kind === "glb") as any)?.uv || null;
    const a = au ? livreDaArea(ajusteDoLado(artes, lado), au, pn.uv, aspArte, pn.aspecto) : encaixarNoPainel(aspArte, pn.aspecto);
    mudar(comLivre(artes, lado, a));
    virarPara(lado, true);
  }

  // ── A prévia da peça para a ficha ──────────────────────────
  // A ficha em cm não representa posição livre: vai a foto da peça, de
  // frente para o lado, sem as alças. Tirada 1,5 s depois da última mexida,
  // só quando a peça está parada de frente para o lado.
  const palcoApi = useRef<ApiDoPalco | null>(null);
  const motorLimpo = useMemo(
    () => (editandoLivre ? motorDasArtes(cfg, customization, artes, specDoPalco, peca) : motor),
    [editandoLivre, motor, cfg, customization, artes, specDoPalco, peca],
  );
  const motorLimpoRef = useRef(motorLimpo);
  motorLimpoRef.current = motorLimpo;
  const semPrevia = !!(livreAtivo && !artes.previas?.[ativoValido]);
  const deFrente = !!(vista.area && vista.area === areaAtiva);
  const chaveDaPrevia = livreAtivo ? JSON.stringify([ativoValido, livreAtivo, urlAtiva, artes.cor]) : "";
  useEffect(() => {
    if (!semPrevia || !deFrente || !cid || Platform.OS !== "web") return;
    const lado = ativoValido;
    const chave = chaveDaPrevia;
    let vivo = true;
    const t = setTimeout(async () => {
      const api = palcoApi.current;
      if (!api || gesto.current.modo) return;
      try {
        const m = motorLimpoRef.current;
        const png = await api.previa(m.values, m.opts);
        const prefixo = "data:image/png;base64,";
        const base64 = png && png.startsWith(prefixo) ? png.slice(prefixo.length) : null;
        if (!base64 || !vivo) return;
        const up = await uploadStudioMockup(cid, { content_base64: base64, content_type: "image/png", kind: "customization" });
        const atual = livreDoLado(artesRef.current, lado);
        const ainda = !!atual && JSON.stringify([lado, atual, artesRef.current.imagens[lado] || null, artesRef.current.cor]) === chave;
        if (up?.url && ainda) mudar(comPrevia(artesRef.current, lado, up.url));
      } catch {
        // Sem prévia, a ficha diz "posição livre, veja a prévia" e a lojista
        // confere pelo orçamento; nada a avisar aqui.
      }
    }, 1500);
    return () => { vivo = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semPrevia, deFrente, chaveDaPrevia, cid]);

  const alturaDoPalco = estreito ? 300 : 380;
  const comArte = emUso.some((l) => !!artes.imagens[l]);
  const temVerso = lados.faces.includes("back");
  const vistas: LadoDaArte[] = artes.estendida && lados.estendida ? [] : lados.faces;

  return (
    <View style={{ gap: 12 }} testID="estudio-da-peca">
      {/* O vídeo em primeiro plano */}
      <View
        style={{
          height: alturaDoPalco, borderRadius: 14, overflow: "hidden", borderWidth: 1,
          borderColor: escuro ? "#3B4A63" : t.ink5, backgroundColor: "#F1ECE4",
        }}
        testID="palco-da-peca"
        {...(editandoLivre && Platform.OS === "web" ? ({
          focusable: true,
          accessibilityLabel: "Peça em 3D: arraste a arte; setas movem, mais e menos mudam o tamanho, colchetes giram",
          onKeyDown: (e: any) => teclaLivre({ key: e.nativeEvent?.key ?? e.key, shiftKey: e.nativeEvent?.shiftKey ?? e.shiftKey, preventDefault: () => e.preventDefault?.() }),
        } as any) : {})}
      >
        {tem3d && Platform.OS === "web" ? (
          <PalcoDaPeca
            spec={specDoPalco!} values={motor.values} opts={motor.opts} altura={alturaDoPalco} vista={vista} backdrop="#FBF8F3"
            painel={editandoLivre ? painel!.uv : null} arraste={editandoLivre ? arrasteLivre : null} apiRef={palcoApi}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 6 }}>
            <Icon name="box" size={26} color="#6B6257" />
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#3F3A33", textAlign: "center" }}>
              {Platform.OS !== "web" ? "A prévia 3D abre na versão web" : "Esta peça não tem modelo 3D"}
            </Text>
            <Text style={{ fontSize: 12.5, color: "#6B6257", textAlign: "center", maxWidth: 360 }}>
              {Platform.OS !== "web"
                ? "As artes que você enviar aqui vão no orçamento do mesmo jeito."
                : "Vai a foto da peça com a arte. Para o vídeo, escolha um modelo 3D em Modelo do mockup, logo abaixo."}
            </Text>
          </View>
        )}
        {tem3d ? (
          <>
            <View pointerEvents="none" style={{ position: "absolute", left: 12, top: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(15,23,42,0.78)", borderRadius: 999, paddingVertical: 5, paddingLeft: 8, paddingRight: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F472B6" }} />
              <Text style={{ color: "#F8FAFC", fontSize: 12, fontWeight: "700" }}>Prévia ao vivo · é o vídeo de 7 s</Text>
            </View>
            <Pressable
              onPress={() => setVista((v) => (v.area ? { area: null, n: v.n + 1 } : { area: specDoPalco ? areaDoLadoNoModelo(specDoPalco, ativoValido === "middle" ? "front" : ativoValido) : null, n: v.n + 1 }))}
              accessibilityRole="button"
              accessibilityLabel={vista.area ? "Girar a peça de novo" : "Parar o giro"}
              testID="palco-girar"
              style={{ position: "absolute", right: 12, top: 12, minHeight: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.92)", flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {vista.area ? <Icon name="play" size={14} color="#0F172A" /> : null}
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#0F172A" }}>{vista.area ? "Girar" : "Parar"}</Text>
            </Pressable>
            {!comArte ? (
              <View pointerEvents="none" style={{ position: "absolute", top: 56, left: 0, right: 0, alignItems: "center" }}>
                <Text style={{ backgroundColor: "rgba(255,255,255,0.92)", color: "#334155", fontSize: 12.5, fontWeight: "600", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, overflow: "hidden" }}>
                  Sem arte ainda: o vídeo mostra a peça lisa
                </Text>
              </View>
            ) : null}
            {vistas.length > 1 ? (
              <View style={{ position: "absolute", bottom: 12, left: 0, right: 0, alignItems: "center" }}>
                <View style={{ flexDirection: "row", gap: 4, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, padding: 4 }} accessibilityRole={"radiogroup" as any} accessibilityLabel="Virar a peça para">
                  {vistas.map((l) => {
                    const sel = !!vista.area && ativoValido === l;
                    return (
                      <Pressable
                        key={l}
                        onPress={() => virarPara(l)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: sel }}
                        testID={"vista-" + l}
                        style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: sel ? "#0F172A" : "transparent" }}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: "700", color: sel ? "#FFFFFF" : "#334155" }}>{ROTULO_DO_LADO[l]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      {tem3d ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4 }}>
          <Icon name="camera" size={14} color={t.ink3} />
          <Text style={{ fontSize: 12, color: t.ink3, flex: 1 }} numberOfLines={estreito ? 1 : undefined} testID="ajuda-do-giro">{estreito ? "O cliente recebe este giro em vídeo." : "O cliente recebe este giro em vídeo no WhatsApp, com a sua marca."}</Text>
        </View>
      ) : null}

      {/* Os lugares da arte */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <View style={{ flexShrink: 1, flexBasis: 260, flexGrow: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink }}>Artes da peça</Text>
          <Text style={{ fontSize: 12, color: t.ink3 }} numberOfLines={estreito ? 1 : undefined} testID="ajuda-das-artes">
            {estreito
              ? "Uma imagem por lugar. PNG sem fundo fica melhor."
              : "Uma imagem por lugar. PNG com fundo transparente fica melhor; o texto com a fonte do cliente vai dentro da imagem."}
          </Text>
        </View>
        {lados.estendida ? (
          <View style={{ flexDirection: "row", backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5, borderRadius: 12, padding: 3, gap: 2 }} accessibilityRole={"radiogroup" as any} accessibilityLabel="Como a peça é impressa">
            {([[false, temVerso ? "Frente e verso" : "Frente"], [true, "Estendida"]] as const).map(([est, rotulo]) => {
              const sel = artes.estendida === est;
              return (
                <Pressable
                  key={rotulo}
                  onPress={() => {
                    if (!editavel || sel) return;
                    const novo = { ...artes, estendida: est };
                    mudar(novo);
                    const primeiro = ladosEmUso(novo, lados)[0];
                    setAtivo(primeiro);
                    setVista((v) => ({ area: null, n: v.n + 1 }));
                  }}
                  disabled={!editavel}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel, disabled: !editavel }}
                  testID={est ? "modo-estendida" : "modo-faces"}
                  style={{ minHeight: estreito ? 40 : 36, paddingHorizontal: 12, borderRadius: 9, justifyContent: "center", backgroundColor: sel ? t.paperCardElev : "transparent", opacity: !editavel && !sel ? 0.5 : 1 }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: sel ? t.ink : t.ink2 }}>{rotulo}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      {artes.estendida && lados.estendida ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: t.infoSoft, borderRadius: 10, padding: 10 }}>
          <Icon name="info" size={14} color={t.infoInk} />
          <Text style={{ fontSize: 12, color: t.infoInk, flex: 1 }}>
            A estendida dá a volta inteira na caneca e substitui frente e verso.{artes.imagens.front || artes.imagens.back ? " As artes da frente e do verso ficam guardadas enquanto a peça estiver aberta." : ""}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: estreito ? 8 : 10 }} testID="lugares-da-arte">
        {emUso.map((l) => (
          <CartaoDoLugar
            key={l}
            tema={tema}
            lado={l}
            medida={medidaDoLado(cfg, l)}
            url={artes.imagens[l] || null}
            envio={envios[l] || null}
            ativo={ativoValido === l && !!artes.imagens[l]}
            unico={emUso.length === 1}
            editavel={editavel}
            onEscolher={() => escolher(l)}
            onSoltar={(f) => soltou(l, f)}
            onAtivar={() => virarPara(l)}
            onRemover={() => mudar(comImagem(artes, l, null))}
            onTentar={() => { const e = envios[l]; if (e) enviar(l, e.img); }}
            onCancelar={() => setEnvios((e) => { const n = { ...e }; delete n[l]; return n; })}
          />
        ))}
      </View>

      {editavel && artes.imagens[ativoValido] ? (
        <AjusteDoLugar
          tema={tema} lado={ativoValido} artes={artes} onMudar={(n) => { mudar(n); virarPara(ativoValido); }}
          podeLivre={!!(tem3d && painel)} livre={livreAtivo} teto={escalaMaxima(aspArte, aspPainel)}
          onLiberar={() => liberar(ativoValido)} acoes={livreAcoes}
        />
      ) : null}

      {cores.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Rotulo t={t}>Cor da peça</Rotulo>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {cores.map((c) => {
              const sel = (artes.cor || "").toLowerCase() === c.hex.toLowerCase();
              return (
                <Pressable
                  key={c.hex}
                  disabled={!editavel}
                  onPress={() => mudar({ ...artes, cor: c.hex, previas: {} })}
                  accessibilityRole="radio"
                  accessibilityLabel={c.nome}
                  accessibilityState={{ checked: sel, disabled: !editavel }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 6, minHeight: estreito ? 40 : 36, paddingLeft: 5, paddingRight: 12,
                    borderRadius: 999, borderWidth: 1.5, borderColor: sel ? t.accent : t.ink5, backgroundColor: t.paperCardElev,
                  }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.hex, borderWidth: 1, borderColor: "rgba(15,23,42,0.18)" }} />
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: sel ? t.ink : t.ink2 }}>{c.nome}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** "9 × 9,7 cm" do cadastro do produto (a área de impressão do lado). */
function medidaDoLado(cfg: any, lado: LadoDaArte): string | null {
  const pa = lado === "back" ? cfg?.back_print_area || cfg?.print_area : lado === "middle" ? cfg?.middle_print_area : cfg?.print_area;
  const w = Number(pa?.width_cm), h = Number(pa?.height_cm);
  if (!(w > 0 && h > 0)) return lado === "middle" ? "volta inteira" : null;
  const cm = (n: number) => String(n).replace(".", ",");
  return `${lado === "middle" ? "volta inteira · " : ""}${cm(w)} × ${cm(h)} cm`;
}

// ── Cartão de um lugar ───────────────────────────────────────
function CartaoDoLugar({
  tema, lado, medida, url, envio, ativo, unico, editavel,
  onEscolher, onSoltar, onAtivar, onRemover, onTentar, onCancelar,
}: {
  tema: Tema; lado: LadoDaArte; medida: string | null; url: string | null; envio: Envio | null;
  ativo: boolean; unico: boolean; editavel: boolean;
  onEscolher: () => void; onSoltar: (f: File) => void; onAtivar: () => void; onRemover: () => void;
  onTentar: () => void; onCancelar: () => void;
}) {
  const { t, estreito } = tema;
  const ref = useRef<any>(null);
  const [sobre, setSobre] = useState(false);
  const soltarRef = useRef(onSoltar);
  soltarRef.current = onSoltar;

  // Arrastar e soltar (web): o arquivo vai para este lugar.
  useEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (Platform.OS !== "web" || !el || !editavel || typeof el.addEventListener !== "function") return;
    const over = (e: DragEvent) => { e.preventDefault(); setSobre(true); };
    const sai = () => setSobre(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setSobre(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) soltarRef.current(f);
    };
    el.addEventListener("dragover", over);
    el.addEventListener("dragleave", sai);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("dragleave", sai);
      el.removeEventListener("drop", drop);
    };
  }, [editavel]);

  const previa = envio ? `data:${envio.img.content_type};base64,${envio.img.base64}` : null;
  const erro = envio?.estado === "erro";
  const enviando = envio?.estado === "enviando";
  const alturaDaImagem = unico ? 96 : estreito ? 92 : 108;

  return (
    <View
      ref={ref}
      testID={"lugar-" + lado}
      style={{
        flexGrow: 1, flexBasis: unico ? "100%" : estreito ? 140 : 190, minWidth: 0,
        borderWidth: 1.5, borderStyle: sobre ? "dashed" : "solid",
        borderColor: sobre ? t.primary : erro ? t.danger : ativo ? t.accent : t.ink5,
        borderRadius: 12, backgroundColor: sobre ? t.primaryGhost : t.paperCardElev, padding: estreito ? 8 : 10, gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "800", color: t.ink }}>{ROTULO_DO_LADO[lado]}</Text>
        {medida && !estreito ? <Text numberOfLines={1} style={{ fontSize: 11.5, color: t.ink3, flexShrink: 1 }}>{medida}</Text> : null}
        <View style={{ flex: 1 }} />
        {ativo && editavel ? (
          <Text style={{ fontSize: 10.5, fontWeight: "800", color: t.accentInk, backgroundColor: t.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" }}>Ajustando</Text>
        ) : url && !envio ? <Icon name="check" size={14} color={t.success} /> : null}
      </View>

      {enviando ? (
        <>
          <Xadrez altura={alturaDaImagem}>
            {previa ? <Image source={{ uri: previa }} style={{ width: "92%", height: "86%", opacity: 0.45 }} resizeMode="contain" /> : null}
            <View style={{ position: "absolute", alignItems: "center", gap: 4 }}><ActivityIndicator color={t.primary} /></View>
          </Xadrez>
          <Text style={{ fontSize: 11.5, color: t.ink3 }}>Enviando a arte {DO_LADO[lado]}…</Text>
          <Botao tema={tema} tipo="sec" pequeno rotulo="Cancelar" onPress={onCancelar} testID={"cancelar-" + lado} />
        </>
      ) : erro ? (
        <>
          <View accessibilityRole="alert" style={{ minHeight: alturaDaImagem, borderRadius: 9, backgroundColor: t.dangerSoft, padding: 10, justifyContent: "center", gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="alert-circle" size={14} color={t.dangerInk} />
              <Text style={{ fontSize: 13, fontWeight: "800", color: t.dangerInk }}>Não deu para enviar</Text>
            </View>
            <Text style={{ fontSize: 12, color: t.dangerInk }}>{envio?.mensagem || "A imagem não foi salva."}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Botao tema={tema} tipo="pri" pequeno rotulo="Tentar de novo" onPress={onTentar} flex testID={"tentar-" + lado} />
            <Botao tema={tema} tipo="sec" pequeno rotulo="Outra imagem" onPress={onEscolher} flex />
          </View>
        </>
      ) : url ? (
        <>
          <Pressable onPress={onAtivar} accessibilityRole="button" accessibilityLabel={`Ver e ajustar a arte ${DO_LADO[lado]}`} testID={"ativar-" + lado}>
            <Xadrez altura={alturaDaImagem}>
              <Image source={{ uri: url }} style={{ width: "92%", height: "86%" }} resizeMode="contain" accessibilityLabel={`Arte ${DO_LADO[lado]}`} />
            </Xadrez>
          </Pressable>
          {editavel ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Botao tema={tema} tipo="sec" pequeno icone="refresh" rotulo="Trocar" accessibilityLabel={`Trocar a arte ${DO_LADO[lado]}`} onPress={onEscolher} flex testID={"trocar-" + lado} />
              <Pressable
                onPress={onRemover}
                accessibilityRole="button"
                accessibilityLabel={`Remover a arte ${DO_LADO[lado]}`}
                testID={"remover-" + lado}
                style={{ width: estreito ? 44 : 36, height: estreito ? 44 : 36, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="trash" size={15} color={t.ink} />
              </Pressable>
            </View>
          ) : null}
        </>
      ) : editavel ? (
        <Pressable
          onPress={onEscolher}
          accessibilityRole="button"
          accessibilityLabel={`Enviar a arte ${DO_LADO[lado]}`}
          testID={"enviar-" + lado}
          style={{
            minHeight: unico ? 120 : estreito ? 132 : 150, borderWidth: 2, borderStyle: "dashed", borderColor: t.ink5, borderRadius: 10,
            backgroundColor: t.bgSoft, alignItems: "center", justifyContent: "center", gap: 4, padding: 12,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.primaryGhost, alignItems: "center", justifyContent: "center" }}>
            <Icon name="upload" size={18} color={t.primary} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: "700", color: t.ink2, textAlign: "center" }}>Enviar a arte {DO_LADO[lado]}</Text>
          <Text style={{ fontSize: 11.5, color: t.ink3, textAlign: "center" }}>{Platform.OS === "web" ? "Toque ou arraste a imagem" : "Toque para escolher"}{"\n"}PNG, JPG ou WEBP</Text>
        </Pressable>
      ) : (
        <View style={{ minHeight: 60, borderRadius: 10, backgroundColor: t.bgSoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 12, color: t.ink3 }}>Sem arte</Text>
        </View>
      )}
    </View>
  );
}

/** Fundo xadrez: a transparência do PNG aparece. */
function Xadrez({ altura, children }: { altura: number; children?: React.ReactNode }) {
  const web = Platform.OS === "web";
  return (
    <View
      style={{
        height: altura, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF",
        ...(web ? ({
          backgroundImage: "linear-gradient(45deg,#E7E5E0 25%,transparent 25%),linear-gradient(-45deg,#E7E5E0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#E7E5E0 75%),linear-gradient(-45deg,transparent 75%,#E7E5E0 75%)",
          backgroundSize: "14px 14px",
          backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
        } as any) : {}),
      }}
    >
      {children}
    </View>
  );
}

/**
 * Altura ÷ largura da imagem (1 até saber). A posição livre usa para a
 * caixa da arte, o "Encaixar no painel" e o teto do tamanho.
 */
function useAspecto(url: string | null): number {
  const [asp, setAsp] = useState<{ url: string | null; a: number }>({ url: null, a: 1 });
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    try {
      const getSize = (Image as any).getSize;
      if (typeof getSize === "function") {
        getSize(url, (w: number, h: number) => { if (vivo && w > 0 && h > 0) setAsp({ url, a: h / w }); }, () => {});
      }
    } catch {
      // Sem medida, vale 1 (quadrada): só a caixa do toque fica aproximada.
    }
    return () => { vivo = false; };
  }, [url]);
  return asp.url === url ? asp.a : 1;
}

type AcoesLivres = {
  mover: (du: number, dv: number) => void;
  escalar: (f: number) => void;
  girar: (graus: number) => void;
  centralizar: () => void;
  encaixar: () => void;
};

// ── Tamanho e posição de um lugar ────────────────────────────
// Dois modos: na ÁREA de impressão (o encaixe do #1013, com margem) ou
// LIVRE na peça (29/09/2026): a arte em qualquer lugar do painel inteiro,
// arrastada direto na prévia 3D. Nada de centímetros na tela.
function AjusteDoLugar({
  tema, lado, artes, onMudar, podeLivre, livre, teto, onLiberar, acoes,
}: {
  tema: Tema; lado: LadoDaArte; artes: ArtesDaPeca; onMudar: (a: ArtesDaPeca) => void;
  podeLivre: boolean; livre: AjusteLivre | null; teto: number; onLiberar: () => void; acoes: AcoesLivres;
}) {
  const { t, estreito } = tema;
  const aj = ajusteDoLado(artes, lado);
  const auto = !artes.ajustes[lado];
  // Na posição livre os alvos são sempre de 44 px (arrastar é o principal,
  // os botões são a alternativa de quem não arrasta).
  const lado2 = estreito || livre ? 44 : 36;
  const quadrado = (icone: string | null, rotulo: string, f: () => void, off = false, testID?: string, glifo?: string) => (
    <Pressable
      key={rotulo}
      onPress={off ? undefined : f}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      testID={testID}
      style={{ minWidth: lado2, height: lado2, paddingHorizontal: glifo ? 8 : 0, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev, alignItems: "center", justifyContent: "center", opacity: off ? 0.45 : 1 }}
    >
      {icone ? <Icon name={icone as any} size={15} color={t.ink} /> : <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink }}>{glifo}</Text>}
    </Pressable>
  );
  const texto = (rotulo: string, f: () => void, testID: string, destaque = false) => (
    <Pressable
      key={testID}
      onPress={f}
      accessibilityRole="button"
      testID={testID}
      style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: destaque ? t.primary : t.ink5, backgroundColor: t.paperCardElev, justifyContent: "center" }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: destaque ? t.primary : t.ink }}>{rotulo}</Text>
    </Pressable>
  );
  const mover = (eixo: "dx" | "dy", passo: number) => onMudar(ajustarLado(artes, lado, { [eixo]: Math.round((aj[eixo] + passo) * 100) / 100 }));

  const modos = podeLivre ? (
    <View style={{ flexDirection: "row", backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5, borderRadius: 12, padding: 3, gap: 2, alignSelf: "flex-start" }} accessibilityRole={"radiogroup" as any} accessibilityLabel="Onde a arte fica">
      {([[false, "Na área de impressão"], [true, "Livre na peça"]] as const).map(([ehLivre, rotulo]) => {
        const sel = !!livre === ehLivre;
        return (
          <Pressable
            key={rotulo}
            onPress={() => { if (sel) return; if (ehLivre) onLiberar(); else onMudar(ajustarLado(artes, lado, null)); }}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            testID={ehLivre ? "modo-livre" : "modo-area"}
            style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 9, justifyContent: "center", backgroundColor: sel ? t.paperCardElev : "transparent" }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: sel ? t.ink : t.ink2 }}>{rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  if (livre) {
    const passo = 0.02;
    return (
      <View style={{ borderWidth: 1, borderColor: t.ink5, borderRadius: 12, backgroundColor: t.paperCard, padding: estreito ? 10 : 12, gap: 10 }} testID="ajuste-do-lugar">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink }}>Tamanho e posição · {ROTULO_DO_LADO[lado]}</Text>
          <Text style={{ fontSize: 12, color: t.ink3, flexShrink: 1 }}>Livre: a arte vai a qualquer lugar da peça, até a borda.</Text>
        </View>
        {modos}
        <Text style={{ fontSize: 12, color: t.ink3 }} testID="dica-livre">
          {Platform.OS === "web"
            ? "Arraste a arte na peça; fora dela, a peça gira. Puxe um canto (ou use dois dedos) para o tamanho. No teclado: setas, + e −, [ e ]."
            : "Use os botões para posicionar a arte."}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Rotulo t={t}>Tamanho</Rotulo>
            {quadrado("minus", "Diminuir a arte", () => acoes.escalar(1 / 1.1), livre.escala <= ESCALA_LIVRE_MIN, "livre-menor")}
            <Text style={{ minWidth: 44, textAlign: "center", fontWeight: "800", fontSize: 13, color: t.ink }} testID="livre-escala">{Math.round(livre.escala * 100)}%</Text>
            {quadrado("plus", "Aumentar a arte", () => acoes.escalar(1.1), livre.escala >= teto, "livre-maior")}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Rotulo t={t}>Posição</Rotulo>
            {quadrado("arrow_left", "Mover a arte para a esquerda", () => acoes.mover(-passo, 0), false, "livre-esquerda")}
            {quadrado("chevron_up", "Mover a arte para cima", () => acoes.mover(0, -passo), false, "livre-cima")}
            {quadrado("chevron_down", "Mover a arte para baixo", () => acoes.mover(0, passo), false, "livre-baixo")}
            {quadrado("arrow_right", "Mover a arte para a direita", () => acoes.mover(passo, 0), false, "livre-direita")}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Rotulo t={t}>Girar</Rotulo>
            {quadrado(null, `Girar a arte ${PASSO_DA_ROTACAO}° para a esquerda`, () => acoes.girar(-PASSO_DA_ROTACAO), false, "livre-girar-esq", `↺ ${PASSO_DA_ROTACAO}°`)}
            {quadrado(null, `Girar a arte ${PASSO_DA_ROTACAO}° para a direita`, () => acoes.girar(PASSO_DA_ROTACAO), false, "livre-girar-dir", `↻ ${PASSO_DA_ROTACAO}°`)}
            {livre.rotacao ? <Text style={{ fontSize: 12, color: t.ink3 }} testID="livre-rotacao">{String(livre.rotacao).replace(".", ",")}°</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {texto("Centralizar", acoes.centralizar, "livre-centralizar")}
          {texto("Encaixar no painel", acoes.encaixar, "livre-encaixar", true)}
        </View>
      </View>
    );
  }

  return (
    <View style={{ borderWidth: 1, borderColor: t.ink5, borderRadius: 12, backgroundColor: t.paperCard, padding: estreito ? 10 : 12, gap: 8 }} testID="ajuste-do-lugar">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink }}>Tamanho e posição · {ROTULO_DO_LADO[lado]}</Text>
        <Text style={{ fontSize: 12, color: t.ink3, flexShrink: 1 }}>{auto ? "Automático: a arte ocupa a área de impressão, dentro da margem." : "Ajustado por você."}</Text>
        {!auto ? (
          <Pressable onPress={() => onMudar(ajustarLado(artes, lado, null))} accessibilityRole="button" style={{ marginLeft: "auto", minHeight: 32, justifyContent: "center" }} testID="ajuste-automatico">
            <Text style={{ fontSize: 12, fontWeight: "700", color: t.primary }}>Voltar ao automático</Text>
          </Pressable>
        ) : null}
      </View>
      {modos}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Rotulo t={t}>Tamanho</Rotulo>
          {quadrado("minus", "Diminuir a arte", () => onMudar(ajustarLado(artes, lado, { escala: Math.round((aj.escala - 0.1) * 10) / 10 })), aj.escala <= ESCALA_MIN, "ajuste-menor")}
          <Text style={{ minWidth: 44, textAlign: "center", fontWeight: "800", fontSize: 13, color: t.ink }} testID="ajuste-escala">{Math.round(aj.escala * 100)}%</Text>
          {quadrado("plus", "Aumentar a arte", () => onMudar(ajustarLado(artes, lado, { escala: Math.round((aj.escala + 0.1) * 10) / 10 })), aj.escala >= ESCALA_MAX, "ajuste-maior")}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Rotulo t={t}>Posição</Rotulo>
          {quadrado("arrow_left", "Mover a arte para a esquerda", () => mover("dx", -0.05))}
          {quadrado("chevron_up", "Mover a arte para cima", () => mover("dy", -0.05))}
          {quadrado("chevron_down", "Mover a arte para baixo", () => mover("dy", 0.05))}
          {quadrado("arrow_right", "Mover a arte para a direita", () => mover("dx", 0.05))}
        </View>
      </View>
    </View>
  );
}

export default EstudioDaPeca;
