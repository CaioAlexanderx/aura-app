// ============================================================
// components/studio/storefront/fields/FieldImage.tsx
// Campo type="image" — upload real de arte client-side.
//
// CONTRATO (imutável — Agente J consome onChange(url)):
//   props.field      — CustomizationField com type="image"
//   props.value      — string | undefined  (URL pública atual ou undefined)
//   props.onChange   — (url: string) => void  (grava no customization)
//   props.slug       — string  (monta URL do endpoint de upload)
//
// UPLOAD:
//   POST /storefront/{slug}/studio/upload
//   body: { content_base64, content_type, filename }
//   resp: { url: string }   → onChange(url)
//
// Nota: useStorefront expõe sf.uploadImage() mas FieldImage só recebe
// onChange (sem acesso ao sf inteiro), portanto o POST é feito aqui mesmo,
// seguindo exatamente a mesma lógica de useStorefront.uploadImage.
// ============================================================
import { useState, useRef, useCallback } from "react";
import { formatoAceito } from "../formatoDeArquivo";
import { View, Pressable, Platform, ActivityIndicator } from "react-native";
import type { CustomizationField } from "../types";
import { sectionLabel } from "../types";
import { usePaletaDaVitrine } from "../TemaDaVitrine";

import { Texto } from "../TipografiaVitrine";
import { enderecoDaApi } from "../enderecoDaApi";

const API_BASE = enderecoDaApi();

// Formatos suportados: pdf + rasters. Fallback quando field.config.formats não vier.
const DEFAULT_FORMATS = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
const FORMAT_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
};

// `formats` deveria ser sempre MIME ("image/png"), mas na pratica ha
// produtos gravados com a extensao solta ("png"). Nesses, o split("/")[1]
// devolvia undefined e o .toUpperCase() derrubava a VITRINE INTEIRA no
// ErrorBoundary — o cliente clicava em "Personalizar" e via tela de erro,
// sem nenhuma pista de que era so um rotulo de formato. Aqui os dois
// formatos sao aceitos, e o que nao der pra entender e simplesmente
// ignorado: rotulo feio e problema pequeno, loja fora do ar nao e.
function normalizaFormato(f: unknown): { mime: string | null; ext: string | null } {
  const s = typeof f === "string" ? f.trim() : "";
  if (!s) return { mime: null, ext: null };
  if (s.includes("/")) {
    const parte = s.split("/")[1] || "";
    return { mime: s, ext: parte || null };
  }
  return { mime: null, ext: s.replace(/^\./, "") || null };
}

function buildAccept(formats: string[]): string {
  // O atributo accept entende MIME ("image/png") e extensao com ponto
  // (".png") — nunca "png" solto, que o navegador descarta.
  const partes = (formats || [])
    .map((f) => {
      const { mime, ext } = normalizaFormato(f);
      if (mime) return mime;
      return ext ? "." + ext.toLowerCase() : null;
    })
    .filter(Boolean) as string[];
  // HEIC (decisao do Caio, 04/09/2026): a foto do iPhone chega como HEIC
  // so quando o campo NAO declara `image/*`. Com `image/*` na lista, o
  // proprio Safari converte para JPEG no envio — sem servidor, sem
  // biblioteca nativa. Entra sempre que algum formato de imagem e aceito;
  // um campo so-PDF continua so-PDF.
  const aceitaImagem = partes.some((p) => p.startsWith("image/") || /^\.(png|jpe?g|webp|gif)$/i.test(p));
  if (aceitaImagem && !partes.includes("image/*")) partes.push("image/*");
  return [...new Set(partes)].join(",");
}

function buildFormatLabel(formats: string[]): string {
  const labels = (formats || [])
    .map((f) => {
      if (typeof f === "string" && FORMAT_LABELS[f]) return FORMAT_LABELS[f];
      const { ext } = normalizaFormato(f);
      if (!ext) return null;
      return FORMAT_LABELS["image/" + ext.toLowerCase()] ?? ext.toUpperCase();
    })
    .filter(Boolean) as string[];
  return [...new Set(labels)].join(", ");
}

function isPdf(contentType: string): boolean {
  return contentType === "application/pdf";
}

function isRaster(contentType: string): boolean {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(contentType);
}

// ----------------------------------------------------------------
// FieldImage
// ----------------------------------------------------------------
export function FieldImage({
  field, value, slug, onChange,
}: {
  field: CustomizationField;
  value: any;
  slug: string;
  onChange: (url: string) => void;
}) {
  const T = usePaletaDaVitrine();
  // --- estado local ---
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // guarda o content_type e nome do arquivo que foi enviado (para UI do chip PDF)
  const [uploadedMeta, setUploadedMeta] = useState<{ name: string; type: string } | null>(null);
  const inputRef = useRef<any>(null);

  // reduceMotion: respeita prefers-reduced-motion via CSS quando possível;
  // ActivityIndicator já é silencioso em acessibilidade.

  // --- derivações de config ---
  const maxMb: number = field.config?.max_mb ?? 15;
  const allowedFormats: string[] = (() => {
    const cf = field.config?.formats;
    if (Array.isArray(cf) && cf.length > 0) return cf;
    return DEFAULT_FORMATS;
  })();
  const acceptAttr = buildAccept(allowedFormats);
  const formatLabel = buildFormatLabel(allowedFormats);

  // --- handler principal ---
  const handleFileSelect = useCallback(
    async (ev: any) => {
      const file: File | undefined = ev?.target?.files?.[0];
      if (!file) return;

      // Validação de formato — MIME ou extensão, tanto faz como a lojista
      // gravou. Ver formatoDeArquivo.ts: a comparação crua recusava um
      // PNG perfeito numa loja configurada com ["png","jpg","pdf"].
      if (!formatoAceito(allowedFormats, file.type, file.name)) {
        setUploadError(`Formato inválido. Aceitos: ${formatLabel}`);
        try { ev.target.value = ""; } catch (_) {}
        return;
      }
      // Validação de tamanho
      if (file.size > maxMb * 1024 * 1024) {
        setUploadError(`Arquivo grande demais (máx ${maxMb} MB)`);
        try { ev.target.value = ""; } catch (_) {}
        return;
      }

      setUploading(true);
      setUploadError(null);

      try {
        // Lê como base64
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
          reader.readAsDataURL(file);
        });

        // POST para o backend
        const res = await fetch(
          `${API_BASE}/storefront/${slug}/studio/upload`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content_base64: dataUrl.split(",")[1],
              content_type: file.type,
              filename: file.name,
            }),
          }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.url) throw new Error("Resposta inesperada do servidor");

        setUploadedMeta({ name: file.name, type: file.type });
        onChange(data.url);
      } catch (e: any) {
        setUploadError(e?.message || "Erro no upload. Tente novamente.");
      } finally {
        setUploading(false);
        // limpa input para permitir re-seleção do mesmo arquivo
        try { ev.target.value = ""; } catch (_) {}
      }
    },
    [allowedFormats, formatLabel, maxMb, onChange, slug]
  );

  // --- acionar o file picker programaticamente (botão "trocar arquivo") ---
  const triggerPicker = useCallback(() => {
    if (inputRef.current) {
      try { inputRef.current.click(); } catch (_) {}
    }
  }, []);

  // --- remover ---
  const handleRemove = useCallback(() => {
    onChange("");
    setUploadedMeta(null);
    setUploadError(null);
  }, [onChange]);

  // ================================================================
  // Render
  // ================================================================
  const hasValue = Boolean(value && String(value).length > 0);
  // Determina se o arquivo enviado é PDF ou raster
  // (uploadedMeta tem o type do arquivo; se veio de uma URL já salva sem meta, infer pelo .pdf)
  const isPdfFile =
    (uploadedMeta && isPdf(uploadedMeta.type)) ||
    (!uploadedMeta && hasValue && String(value).toLowerCase().endsWith(".pdf"));
  const isRasterFile =
    (uploadedMeta && isRaster(uploadedMeta.type)) ||
    (!uploadedMeta && hasValue && !String(value).toLowerCase().endsWith(".pdf"));

  return (
    <View>
      {/* Label */}
      <Texto style={sectionLabel}>
        {field.label}{" "}
        {field.required && <Texto style={{ color: T.red }}>*</Texto>}
      </Texto>

      {/* ---- Estado: ARQUIVO ENVIADO ---- */}
      {hasValue && (
        <View style={{ gap: 8, marginTop: 6 }}>
          {/* Thumbnail para raster */}
          {isRasterFile && Platform.OS === "web" && (
            // @ts-ignore — native img on web
            <img
              src={String(value)}
              alt="preview da arte"
              style={{
                width: "100%",
                maxHeight: 200,
                objectFit: "contain",
                borderRadius: 8,
                border: "1px solid " + T.border,
                backgroundColor: T.bg,
              } as any}
            />
          )}
          {isRasterFile && Platform.OS !== "web" && (
            <View
              style={{
                padding: 10,
                backgroundColor: T.card,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: T.green,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Texto style={{ fontSize: 16 }}>🖼️</Texto>
              <Texto style={{ fontSize: 12, color: T.green, fontWeight: "700", flex: 1 }}>
                Imagem enviada com sucesso
              </Texto>
            </View>
          )}

          {/* Chip para PDF */}
          {isPdfFile && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 10,
                backgroundColor: "#f0fdf4",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: T.green,
              }}
            >
              <Texto style={{ fontSize: 18 }}>📄</Texto>
              <View style={{ flex: 1 }}>
                <Texto style={{ fontSize: 12, color: T.green, fontWeight: "700" }}>
                  Arquivo enviado
                </Texto>
                {uploadedMeta?.name && (
                  <Texto
                    style={{
                      fontSize: 11,
                      color: T.ink3,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {uploadedMeta.name}
                  </Texto>
                )}
              </View>
              {/* Link para abrir o PDF */}
              {Platform.OS === "web" && (
                // @ts-ignore — native anchor on web
                <a
                  href={String(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    color: T.primaryTexto,
                    fontWeight: "700",
                    textDecoration: "underline",
                    whiteSpace: "nowrap",
                  } as any}
                >
                  Abrir
                </a>
              )}
            </View>
          )}

          {/* Ações: trocar / remover */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Platform.OS === "web" && (
              <>
                {/* Botão "Trocar arquivo" — aciona o mesmo input hidden */}
                {/* @ts-ignore */}
                <label
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    backgroundColor: T.card,
                    border: "1px solid " + T.border,
                    cursor: uploading ? "wait" : "pointer",
                    fontSize: 11,
                    fontWeight: "700",
                    color: T.ink2,
                    opacity: uploading ? 0.5 : 1,
                  } as any}
                >
                  {uploading ? "Enviando…" : "Trocar arquivo"}
                  {/* @ts-ignore */}
                  <input
                    type="file"
                    accept={acceptAttr}
                    onChange={handleFileSelect}
                    disabled={uploading}
                    style={{ display: "none" } as any}
                  />
                </label>
              </>
            )}
            <Pressable
              onPress={handleRemove}
              disabled={uploading}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: "#fee2e2",
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <Texto style={{ color: T.red, fontSize: 11, fontWeight: "700" }}>Remover</Texto>
            </Pressable>
          </View>

          {/* Spinner de troca */}
          {uploading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color={T.primary} />
              <Texto style={{ fontSize: 11, color: T.ink3 }}>Enviando novo arquivo…</Texto>
            </View>
          )}
        </View>
      )}

      {/* ---- Estado: SEM ARQUIVO (picker) ---- */}
      {!hasValue && (
        <View style={{ gap: 8, marginTop: 6 }}>
          {Platform.OS === "web" ? (
            // @ts-ignore — native label/input on web
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 24,
                backgroundColor: T.card,
                border: uploadError
                  ? "2px dashed " + T.red
                  : "2px dashed " + T.border,
                borderRadius: 10,
                cursor: uploading ? "wait" : "pointer",
                opacity: uploading ? 0.7 : 1,
                transition: "border-color 0.2s",
              } as any}
            >
              {uploading ? (
                <ActivityIndicator size="large" color={T.primary} />
              ) : (
                <Texto style={{ fontSize: 28 }}>📁</Texto>
              )}
              <Texto
                style={{
                  fontSize: 13,
                  color: T.ink,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {uploading ? "Enviando…" : "Escolher arquivo de arte"}
              </Texto>
              <Texto
                style={{
                  fontSize: 11,
                  color: T.ink3,
                  textAlign: "center",
                }}
              >
                {formatLabel} · Máx {maxMb} MB
              </Texto>
              {/* @ts-ignore */}
              <input
                ref={inputRef}
                type="file"
                accept={acceptAttr}
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ display: "none" } as any}
              />
            </label>
          ) : (
            /* Native (RN) — sem suporte a file picker nativo aqui;
               orientar o usuário a enviar pelo WhatsApp (comportamento legado). */
            <View
              style={{
                padding: 14,
                backgroundColor: T.card,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: T.border,
              }}
            >
              <Texto style={{ fontSize: 12, color: T.ink3, lineHeight: 18 }}>
                Envie a arte pelo WhatsApp após confirmar o pedido, ou acesse esta
                página pelo navegador do computador para fazer upload direto.
              </Texto>
            </View>
          )}

          {/* ---- Estado: ERRO ---- */}
          {uploadError && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 10,
                backgroundColor: "#fff1f2",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#fecdd3",
              }}
            >
              <Texto style={{ fontSize: 15 }}>⚠️</Texto>
              <Texto style={{ fontSize: 12, color: T.red, flex: 1 }}>{uploadError}</Texto>
              {/* Retry: reabre o picker */}
              {Platform.OS === "web" && (
                // @ts-ignore
                <label
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: T.red,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#fff",
                    whiteSpace: "nowrap",
                  } as any}
                >
                  Tentar novamente
                  {/* @ts-ignore */}
                  <input
                    type="file"
                    accept={acceptAttr}
                    onChange={(ev) => {
                      setUploadError(null);
                      handleFileSelect(ev);
                    }}
                    disabled={uploading}
                    style={{ display: "none" } as any}
                  />
                </label>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
