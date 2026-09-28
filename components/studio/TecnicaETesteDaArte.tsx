// ============================================================
// AURA STUDIO · TecnicaETesteDaArte — duas seções da aba Personalização
// do produto (28/09/2026, formatação da arte)
//
// 1. Técnica de impressão: sublimação, DTF/transfer ou outra. Muda como
//    a arte se mistura à peça na prévia da vitrine (sublimação: o branco
//    da arte vira a cor da peça; DTF: a arte é opaca, o fundo branco sai
//    impresso). Sem escolha, o padrão da peça: caneca → sublimação,
//    camiseta → DTF. Grava em `customization_config.tecnica` pelo mesmo
//    salvamento da aba.
// 2. Testar com uma arte: a lojista escolhe um arquivo do computador e vê
//    na peça do jeito que a cliente vai ver, com o MESMO editor da
//    vitrine (arrastar na peça, encaixe, tamanho, avisos de nitidez e de
//    corte). Nada é enviado nem salvo: o arquivo fica só nesta tela.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { CustomizationConfig } from "@/services/studioApi";
import { LivePreview } from "@/components/studio/storefront/LivePreview";
import { ControlesDaArte, FaixaDaPrevia, useEditorDaArte, useGiroAutomatico } from "@/components/studio/storefront/produto/EditorDaArte";
import type { Tecnica } from "@/components/studio/visualEngine/layoutDaArte";

const TECNICAS: Array<{ v: Tecnica; rotulo: string; explica: string }> = [
  { v: "sublimacao", rotulo: "Sublimação", explica: "A arte entra na peça: o branco da arte vira a cor da peça. Funciona em peça clara." },
  { v: "dtf", rotulo: "DTF / transfer", explica: "A arte é impressa opaca, como está. Se o arquivo tiver fundo branco, ele aparece na peça." },
  { v: "outra", rotulo: "Outra", explica: "A prévia mistura a arte pela luz da peça, como antes." },
];

export function SecaoTecnicaDeImpressao({
  config, onMudar,
}: {
  config: CustomizationConfig;
  onMudar: (t: Tecnica | null) => void;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const atual = (config as any).tecnica as Tecnica | null | undefined;
  const info = TECNICAS.find((x) => x.v === atual);
  return (
    <View style={s.card} testID="secao-tecnica">
      <Text style={s.eyebrow}>TÉCNICA DE IMPRESSÃO</Text>
      <Text style={s.help}>Muda como a arte aparece na prévia da vitrine. Não muda preço nem prazo.</Text>
      <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Técnica de impressão">
        {TECNICAS.map((x) => {
          const sel = atual === x.v;
          return (
            <Pressable
              key={x.v}
              testID={"tecnica-" + x.v}
              onPress={() => onMudar(sel ? null : x.v)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              style={[s.chip, sel && s.chipAtivo]}
            >
              <Text style={[s.chipTxt, sel && s.chipTxtAtivo]}>{x.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.help}>{info ? info.explica : "Sem escolha: caneca usa sublimação e camiseta usa DTF."}</Text>
    </View>
  );
}

export function SecaoTestarComUmaArte({
  config, productId, productName, slug, fotoProduto,
}: {
  config: CustomizationConfig;
  productId: string;
  productName: string;
  slug?: string | null;
  fotoProduto?: string | null;
}) {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const [valores, setValores] = useState<Record<string, any>>({});
  const [nome, setNome] = useState<string | null>(null);
  const [mostrarArea, setMostrarArea] = useState(true);
  const [giro, setGiro] = useGiroAutomatico();
  const input = useRef<any>(null);
  const urlAtual = useRef<string | null>(null);
  useEffect(() => () => { if (urlAtual.current) try { URL.revokeObjectURL(urlAtual.current); } catch { /* nada */ } }, []);

  // O primeiro campo de imagem da frente recebe a arte de teste; o
  // primeiro texto, um nome de exemplo.
  const campoImagem = (config.fields || []).find((f) => f.type === "image" && (f.side || "front") === "front")
    || (config.fields || []).find((f) => f.type === "template" && (f.side || "front") === "front");
  const campoTexto = (config.fields || []).find((f) => f.type === "text" && (f.side || "front") === "front" && f.id !== "art_service_brief");
  const set = (id: string, v: any) => setValores((x) => ({ ...x, [id]: v }));
  const editor = useEditorDaArte({ cfg: config, values: valores, lado: "front", setValor: set, peca: null, mostrarArea });

  if (Platform.OS !== "web") return null;

  function escolheu(ev: any) {
    const file: File | undefined = ev?.target?.files?.[0];
    try { ev.target.value = ""; } catch { /* nada */ }
    if (!file || !campoImagem) return;
    if (urlAtual.current) try { URL.revokeObjectURL(urlAtual.current); } catch { /* nada */ }
    const url = URL.createObjectURL(file);
    urlAtual.current = url;
    setNome(file.name);
    setValores((x) => {
      const out: Record<string, any> = { ...x, [campoImagem.id]: url };
      delete out[campoImagem.id + "_ajuste"];
      if (campoTexto && !out[campoTexto.id]) out[campoTexto.id] = "Helena";
      return out;
    });
  }

  const rotulos: Record<string, string> = {};
  for (const f of config.fields || []) rotulos[f.id] = f.type === "image" || f.type === "template" ? "Imagem" : f.label || f.id;

  return (
    <View style={s.card} testID="secao-testar-arte">
      <Text style={s.eyebrow}>TESTAR COM UMA ARTE</Text>
      <Text style={s.help}>
        Veja uma arte de verdade na peça, do jeito que a cliente vai ver, e ajuste como ela ajustaria. O arquivo fica só nesta tela: não é enviado nem salvo no produto.
      </Text>
      {campoImagem ? (
        <View style={s.linha}>
          {/* @ts-ignore — input nativo do navegador, escondido */}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={escolheu} style={{ display: "none" }} data-testid="arquivo-de-teste" />
          <Pressable onPress={() => { try { input.current?.click(); } catch { /* nada */ } }} style={s.botao} accessibilityRole="button" testID="escolher-arte-de-teste">
            <Text style={s.botaoTxt}>{nome ? "Trocar arquivo" : "Escolher arquivo"}</Text>
          </Pressable>
          {nome ? <Text style={s.help} numberOfLines={1}>{nome} · não é salvo</Text> : null}
        </View>
      ) : (
        <Text style={s.help}>Este produto não tem campo de imagem: dá para testar só o texto.</Text>
      )}
      {!campoImagem && campoTexto && !valores[campoTexto.id] ? (
        <Pressable onPress={() => set(campoTexto.id, "Helena")} style={s.botao} accessibilityRole="button">
          <Text style={s.botaoTxt}>Testar com um nome</Text>
        </Pressable>
      ) : null}
      {nome || (campoTexto && valores[campoTexto.id]) ? (
        <View style={{ gap: 10, alignItems: "center" }}>
          <LivePreview
            config={config}
            values={valores}
            size={320}
            productName={productName}
            showLabel={false}
            slug={slug || undefined}
            productId={productId}
            fotoProduto={fotoProduto}
            giroAutomatico={giro}
            edicao={{ extras: editor.extras, arraste: editor.arraste, editando: editor.editando, informarMotor: editor.informarMotor }}
          />
          <FaixaDaPrevia editor={editor} mostrarArea={mostrarArea} onMostrarArea={setMostrarArea} giro={giro} onGiro={setGiro} tem3D={false} />
          <ControlesDaArte editor={editor} rotulos={rotulos} />
        </View>
      ) : null}
    </View>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    card: { backgroundColor: t.paperCard, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: t.ink5 },
    eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: t.ink3 },
    help: { fontSize: 12.5, color: t.ink3, flexShrink: 1 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev, justifyContent: "center" },
    chipAtivo: { borderColor: t.primary, backgroundColor: t.primarySoft },
    chipTxt: { fontSize: 13.5, fontWeight: "700", color: t.ink2 },
    chipTxtAtivo: { color: t.primary },
    linha: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    botao: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: t.primary, justifyContent: "center" },
    botaoTxt: { fontSize: 13.5, fontWeight: "700", color: t.primary },
  });
}
