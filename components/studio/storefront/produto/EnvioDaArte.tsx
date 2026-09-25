// ============================================================
// components/studio/storefront/produto/EnvioDaArte.tsx
//
// O envio da arte na página nova (Tela 3): a caixa tracejada, o
// "Enviando… 55%" com cancelar, o arquivo enviado com medidas, Trocar e
// Remover — e o AVISO DE FOTO PEQUENA, medido no navegador ANTES de
// subir (a foto de 600 px que ia sair borrada era descoberta pela
// lojista, dias depois, na triagem).
//
// A REGRA é a do FieldImage: os mesmos formatos (formatoAceito, aceite
// do HEIC do iPhone via image/*), o mesmo teto em MB, a mesma rota de
// upload e o mesmo valor gravado no campo (a URL pública). Muda o
// desenho e entra o que o FieldImage não tinha: progresso, cancelar e a
// medida da imagem. O aviso não bloqueia (DEC-11): a cliente escolhe
// mandar outra ou pedir o ajuste.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import type { CustomizationField } from "../types";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";
import { wash } from "../theme";
import { Icon } from "@/components/Icon";
import { enderecoDaApi } from "../enderecoDaApi";
import { formatoAceito } from "../formatoDeArquivo";
import { buildAccept, buildFormatLabel } from "../fields/FieldImage";
import { dinheiro } from "../moeda";
import {
  avisoDeResolucao, medivel, medidasDoArquivo, textoDoAvisoDeResolucao,
  nomeDoLado, type Lado, type NomeDaPeca,
} from "./regrasDaPagina";
import { Botao, borda2, transicao } from "./kitDaPagina";

const FORMATOS_PADRAO = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

export type EstadoDoEnvio = "vazio" | "enviando" | "pronto";

type Meta = { nome: string; tipo: string; bytes: number; largura: number | null; altura: number | null; previa: string | null };

/**
 * O que se sabe de cada arquivo enviado, pela URL. Módulo e não estado:
 * trocar de modelo remonta o campo (o id muda) e leva a URL junto
 * (transportarValores) — as medidas vão junto com ela.
 */
const metaPorUrl = new Map<string, Meta>();

/** Mede a imagem no navegador. PDF e o que não abrir: sem medida. */
function medir(file: File): Promise<{ largura: number; altura: number } | null> {
  if (Platform.OS !== "web" || typeof window === "undefined" || !medivel(file.type)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let url = "";
    try { url = URL.createObjectURL(file); } catch { resolve(null); return; }
    const img = new (window as any).Image();
    const fim = (r: { largura: number; altura: number } | null) => {
      try { URL.revokeObjectURL(url); } catch { /* nada */ }
      resolve(r);
    };
    const relogio = setTimeout(() => fim(null), 4000);
    img.onload = () => { clearTimeout(relogio); fim(img.naturalWidth > 0 ? { largura: img.naturalWidth, altura: img.naturalHeight } : null); };
    img.onerror = () => { clearTimeout(relogio); fim(null); };
    img.src = url;
  });
}

function lerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = () => reject(new Error("Erro ao ler o arquivo"));
    r.readAsDataURL(file);
  });
}

/** POST do upload com progresso (XHR) — a mesma rota e o mesmo corpo do FieldImage. */
function subir(url: string, corpo: string, onProgresso: (pct: number) => void): { promessa: Promise<any>; cancelar: () => void } {
  if (typeof XMLHttpRequest === "undefined") {
    const c = typeof AbortController !== "undefined" ? new AbortController() : null;
    return {
      promessa: fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, signal: c?.signal }).then((r) => r.json()),
      cancelar: () => c?.abort(),
    };
  }
  const xhr = new XMLHttpRequest();
  const promessa = new Promise<any>((resolve, reject) => {
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgresso(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try { resolve(JSON.parse(xhr.responseText || "{}")); } catch { reject(new Error("Resposta inesperada do servidor")); }
    };
    xhr.onerror = () => reject(new Error("Erro no upload. Tente novamente."));
    xhr.onabort = () => reject(Object.assign(new Error("cancelado"), { cancelado: true }));
    xhr.send(corpo);
  });
  return { promessa, cancelar: () => xhr.abort() };
}

export function EnvioDaArte({
  field, value, slug, lado, peca, limiar, desktop, onChange, onEstado,
  pedirAjuste, jaPediuAjuste, destacar,
}: {
  field: CustomizationField;
  value: any;
  slug: string;
  lado: Lado;
  peca: NomeDaPeca;
  limiar: number;
  desktop: boolean;
  onChange: (url: string) => void;
  onEstado?: (e: EstadoDoEnvio) => void;
  /** "Pedir ajuste · +R$ 10,00" no aviso: troca o caminho da arte. */
  pedirAjuste?: { preco: number; onPress: () => void } | null;
  jaPediuAjuste?: boolean;
  /** Muda quando a barra manda a cliente até aqui: a caixa acende. */
  destacar?: boolean;
}) {
  const t = useTemaDaVitrine();
  const input = useRef<any>(null);
  const envio = useRef<{ cancelar: () => void } | null>(null);
  const [enviando, setEnviando] = useState<{ nome: string; pct: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, setVersao] = useState(0);

  const formatos: string[] = Array.isArray(field.config?.formats) && field.config.formats.length ? field.config.formats : FORMATOS_PADRAO;
  const maxMb: number = field.config?.max_mb ?? 15;
  const rotuloFormatos = buildFormatLabel(formatos).replace(/, ([^,]*)$/, " ou $1");
  const url = typeof value === "string" ? value : "";
  const meta = url ? metaPorUrl.get(url) || null : null;
  const aviso = meta ? avisoDeResolucao({ tipo: meta.tipo, largura: meta.largura, altura: meta.altura }, limiar) : null;

  const estado: EstadoDoEnvio = enviando ? "enviando" : url ? "pronto" : "vazio";
  useEffect(() => { onEstado?.(estado); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { envio.current?.cancelar(); }, []);

  function abrir() {
    try { input.current?.click(); } catch { /* sem seletor */ }
  }

  async function escolheu(ev: any) {
    const file: File | undefined = ev?.target?.files?.[0];
    try { ev.target.value = ""; } catch { /* nada */ }
    if (!file) return;
    if (!formatoAceito(formatos, file.type, file.name)) { setErro(`Formato inválido. Aceitos: ${rotuloFormatos}`); return; }
    if (file.size > maxMb * 1024 * 1024) { setErro(`Arquivo grande demais (máx ${maxMb} MB)`); return; }
    setErro(null);
    setEnviando({ nome: file.name, pct: 4 });
    try {
      const [medida, base64] = await Promise.all([medir(file), lerBase64(file)]);
      const s = subir(
        `${enderecoDaApi()}/storefront/${slug}/studio/upload`,
        JSON.stringify({ content_base64: base64, content_type: file.type, filename: file.name }),
        (pct) => setEnviando((e) => (e ? { ...e, pct: Math.max(e.pct, Math.min(99, pct)) } : e)),
      );
      envio.current = s;
      const data = await s.promessa;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Resposta inesperada do servidor");
      // A miniatura sai do próprio arquivo (o navegador já o tem): aparece
      // na hora, mesmo que a URL pública demore a responder.
      let previa: string | null = null;
      try { if (medivel(file.type) && typeof URL !== "undefined" && URL.createObjectURL) previa = URL.createObjectURL(file); } catch { previa = null; }
      metaPorUrl.set(String(data.url), {
        nome: file.name, tipo: file.type, bytes: file.size,
        largura: medida?.largura ?? null, altura: medida?.altura ?? null, previa,
      });
      setVersao((v) => v + 1);
      onChange(String(data.url));
    } catch (e: any) {
      if (!e?.cancelado) setErro(e?.message || "Erro no upload. Tente novamente.");
    } finally {
      envio.current = null;
      setEnviando(null);
    }
  }

  function cancelar() {
    envio.current?.cancelar();
    envio.current = null;
    setEnviando(null);
  }

  const seletor = Platform.OS === "web" ? (
    // @ts-ignore — input nativo do navegador, escondido (o mesmo do FieldImage)
    <input ref={input} type="file" accept={buildAccept(formatos)} onChange={escolheu} style={{ display: "none" }} data-testid={"envio-" + field.id} />
  ) : null;

  const anel = destacar ? ({ boxShadow: `0 0 0 5px ${wash(t.amber, 0.14)}, 0 0 0 6px ${t.amber}` } as any) : null;

  if (estado === "vazio") {
    return (
      <View style={{ gap: 8 }}>
        {seletor}
        <Pressable
          onPress={abrir}
          accessibilityRole="button"
          accessibilityLabel={`Enviar a arte ${nomeDoLado(lado)}`}
          style={({ hovered }: any) => [
            {
              width: "100%", borderWidth: 1.5, borderStyle: "dashed", borderRadius: 14,
              borderColor: hovered ? t.marcaTexto : borda2(t),
              backgroundColor: hovered ? t.marcaWash : t.bg2,
              paddingVertical: 20, paddingHorizontal: 16, alignItems: "center", gap: 4,
            },
            Platform.OS === "web" ? anel : null,
            transicao("border-color, background-color, box-shadow", 300),
          ]}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.marcaWashForte, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
            <Icon name="upload" size={24} color={t.marcaTexto} />
          </View>
          <Texto style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>Enviar a arte {nomeDoLado(lado)}</Texto>
          <Texto style={{ fontSize: 12.5, color: t.ink3, textAlign: "center" }}>{rotuloFormatos} · até {maxMb} MB</Texto>
          <Texto style={{ fontSize: 12.5, color: t.ink3, textAlign: "center", maxWidth: 260 }}>
            Ela aparece {peca.feminino ? "na" : "no"} {peca.nome} {desktop ? "ao lado" : "lá em cima"} assim que chegar.
          </Texto>
        </Pressable>
        {erro ? <Nota tom="erro" texto={erro} /> : null}
      </View>
    );
  }

  if (estado === "enviando" && enviando) {
    return (
      <View style={[cartao(t), { flexDirection: "row", alignItems: "center", gap: 12 }]}>
        {seletor}
        <View style={miniatura(t)}><Icon name="image" size={24} color={t.ink3} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Texto numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>{enviando.nome}</Texto>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Enviando a arte"
            accessibilityValue={{ min: 0, max: 100, now: enviando.pct }}
            style={{ height: 6, borderRadius: 3, backgroundColor: t.bg4, overflow: "hidden" }}
          >
            <View style={[{ height: "100%", width: `${enviando.pct}%`, backgroundColor: t.marcaFill, borderRadius: 3 }, transicao("width", 120)]} />
          </View>
          <Texto style={{ fontSize: 12.5, color: t.ink3 }}>Enviando… <Numero style={{ fontSize: 12.5 }}>{enviando.pct}%</Numero></Texto>
        </View>
        <Pressable onPress={cancelar} accessibilityRole="button" accessibilityLabel="Cancelar o envio" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
          <Icon name="x" size={20} color={t.ink} />
        </Pressable>
      </View>
    );
  }

  const ehPdf = /\.pdf($|\?)/i.test(url) || meta?.tipo === "application/pdf";
  return (
    <View style={[cartao(t), { gap: 10 }]}>
      {seletor}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={miniatura(t)}>
          {ehPdf ? <Icon name="file_text" size={24} color={t.ink3} /> : (
            <Image source={{ uri: meta?.previa || url }} resizeMode="contain" style={{ width: "86%", height: "86%" }} accessibilityLabel="A arte enviada" />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Texto numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>{meta?.nome || "Arte enviada"}</Texto>
          {meta ? <Numero style={{ fontSize: 12.5, color: t.ink3 }}>{medidasDoArquivo(meta)}</Numero> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="check" size={15} color={t.green} />
          <Texto style={{ fontSize: 12, fontWeight: "600", color: t.green }}>Enviada</Texto>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!aviso && Platform.OS === "web" ? <Botao pequeno tipo="secundario" icone="refresh" rotulo="Trocar" rotuloAcessivel="Trocar a arte" onPress={abrir} /> : null}
        <Botao pequeno tipo="fantasma" icone="trash" rotulo="Remover" rotuloAcessivel="Remover a arte" onPress={() => { setErro(null); onChange(""); }} />
      </View>
      {aviso ? (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, backgroundColor: wash(t.amber, 0.12) }}>
          <View style={{ marginTop: 2 }}><Icon name="alert" size={16} color={t.amber} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Texto style={{ fontSize: 13.5, lineHeight: 19, color: t.amber }}>
              {textoDoAvisoDeResolucao(aviso.ladoMaior, peca)} Mande uma maior ou peça para a loja ajustar.
            </Texto>
            {jaPediuAjuste ? (
              <Texto style={{ fontSize: 13.5, lineHeight: 19, color: t.amber }}>
                Você já pediu o ajuste: a loja melhora o que der e mostra no mockup antes de produzir.
              </Texto>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {Platform.OS === "web" ? <Botao pequeno tipo="secundario" rotulo="Mandar outra" onPress={abrir} /> : null}
              {pedirAjuste && !jaPediuAjuste ? (
                <Botao pequeno tipo="secundario" rotulo={`Pedir ajuste · +${dinheiro(pedirAjuste.preco)}`} onPress={pedirAjuste.onPress} />
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      {erro ? <Nota tom="erro" texto={erro} /> : null}
    </View>
  );
}

function cartao(t: ReturnType<typeof useTemaDaVitrine>): any {
  return { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg2 };
}
function miniatura(t: ReturnType<typeof useTemaDaVitrine>): any {
  return { width: 60, height: 60, borderRadius: 10, backgroundColor: t.bg2, borderWidth: 1, borderColor: t.border, alignItems: "center", justifyContent: "center", overflow: "hidden" };
}

function Nota({ tom, texto }: { tom: "erro"; texto: string }) {
  const t = useTemaDaVitrine();
  const cor = tom === "erro" ? t.red : t.amber;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: wash(cor, 0.08) }}>
      <Icon name="alert" size={16} color={cor} />
      <Texto style={{ flex: 1, fontSize: 12.5, color: cor }}>{texto}</Texto>
    </View>
  );
}
