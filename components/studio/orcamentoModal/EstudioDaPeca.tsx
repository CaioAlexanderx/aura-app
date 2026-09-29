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
//   - tamanho e posição por lado (o ajuste do #1013, por lado);
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
import { areaDoLadoNoModelo } from "@/components/studio/visualEngine/areasDaPeca";
import { coresDaPeca } from "@/components/studio/orcamentoVideo/pecaDoOrcamento";
import { ESCALA_MIN, ESCALA_MAX } from "@/components/studio/orcamentoVideo/tamanhoDaArte";
import {
  artesDoItem, customizacaoComArtes, motorDasArtes, ladosDaPeca, ladosEmUso, ajustarLado, ajusteDoLado,
  comImagem, ROTULO_DO_LADO, DO_LADO,
  type ArtesDaPeca, type LadoDaArte,
} from "@/components/studio/orcamentoVideo/artesPorLado";
import { PalcoDaPeca, type VistaDoPalco } from "./PalcoDaPeca";
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
  const motor = useMemo(
    () => motorDasArtes(cfg, customization, artes, specDoPalco, peca),
    [cfg, customization, artes, specDoPalco, peca],
  );
  const cores = coresDaPeca(cfg);

  // O customization mais recente: o fim de um envio (assíncrono) escreve
  // sobre o que está no item agora, não sobre o de quando começou.
  const custRef = useRef(customization);
  custRef.current = customization;
  function mudar(novo: ArtesDaPeca) {
    setArtes(novo);
    onMudar(customizacaoComArtes(cfg, custRef.current, novo));
  }

  function virarPara(lado: LadoDaArte) {
    setAtivo(lado);
    const area = specDoPalco ? areaDoLadoNoModelo(specDoPalco, lado) : null;
    // A estendida não tem "de frente": a peça continua girando.
    setVista((v) => ({ area: lado === "middle" ? null : area, n: v.n + 1 }));
  }

  // ── Envio da imagem ────────────────────────────────────────
  // O `artes` mais recente, para o fim de um envio não sobrescrever o que
  // a lojista mudou enquanto a imagem subia.
  const artesRef = useRef(artes);
  artesRef.current = artes;
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
      >
        {tem3d && Platform.OS === "web" ? (
          <PalcoDaPeca spec={specDoPalco!} values={motor.values} opts={motor.opts} altura={alturaDoPalco} vista={vista} backdrop="#FBF8F3" />
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
          <Text style={{ fontSize: 12, color: t.ink3, flex: 1 }}>O cliente recebe este giro em vídeo no WhatsApp, com a sua marca.</Text>
        </View>
      ) : null}

      {/* Os lugares da arte */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <View style={{ flexShrink: 1, flexBasis: 260, flexGrow: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink }}>Artes da peça</Text>
          <Text style={{ fontSize: 12, color: t.ink3 }}>
            Uma imagem por lugar. PNG com fundo transparente fica melhor; o texto com a fonte do cliente vai dentro da imagem.
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
        <AjusteDoLugar tema={tema} lado={ativoValido} artes={artes} onMudar={(n) => { mudar(n); virarPara(ativoValido); }} />
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
                  onPress={() => mudar({ ...artes, cor: c.hex })}
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

// ── Tamanho e posição de um lugar ────────────────────────────
function AjusteDoLugar({ tema, lado, artes, onMudar }: { tema: Tema; lado: LadoDaArte; artes: ArtesDaPeca; onMudar: (a: ArtesDaPeca) => void }) {
  const { t, estreito } = tema;
  const aj = ajusteDoLado(artes, lado);
  const auto = !artes.ajustes[lado];
  const lado2 = estreito ? 44 : 36;
  const quadrado = (icone: string, rotulo: string, f: () => void, off = false, testID?: string) => (
    <Pressable
      key={rotulo}
      onPress={off ? undefined : f}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      testID={testID}
      style={{ width: lado2, height: lado2, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev, alignItems: "center", justifyContent: "center", opacity: off ? 0.45 : 1 }}
    >
      <Icon name={icone as any} size={15} color={t.ink} />
    </Pressable>
  );
  const mover = (eixo: "dx" | "dy", passo: number) => onMudar(ajustarLado(artes, lado, { [eixo]: Math.round((aj[eixo] + passo) * 100) / 100 }));
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
