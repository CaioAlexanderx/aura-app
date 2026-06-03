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
import { View, Text, Pressable, Platform, ActivityIndicator } from "react-native";
import type { CustomizationField } from "../types";
import { T, sectionLabel } from "../types";

const API_BASE =
  (typeof process !== "undefined" && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

// Formatos suportados: pdf + rasters. Fallback quando field.config.formats não vier.
const DEFAULT_FORMATS = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
const FORMAT_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
};

function buildAccept(formats: string[]): string {
  return formats.join(",");
}

function buildFormatLabel(formats: string[]): string {
  const labels = [...new Set(formats.map((f) => FORMAT_LABELS[f] ?? f.split("/")[1].toUpperCase()))];
  return labels.join(", ");
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

      // Validação de formato
      if (!allowedFormats.includes(file.type)) {
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
      <Text style={sectionLabel}>
        {field.label}{" "}
        {field.required && <Text style={{ color: T.red }}>*</Text>}
      </Text>

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
              <Text style={{ fontSize: 16 }}>🖼️</Text>
              <Text style={{ fontSize: 12, color: T.green, fontWeight: "700", flex: 1 }}>
                Imagem enviada com sucesso
              </Text>
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
              <Text style={{ fontSize: 18 }}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: T.green, fontWeight: "700" }}>
                  Arquivo enviado
                </Text>
                {uploadedMeta?.name && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: T.ink3,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {uploadedMeta.name}
                  </Text>
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
                    color: T.primary,
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
              <Text style={{ color: T.red, fontSize: 11, fontWeight: "700" }}>Remover</Text>
            </Pressable>
          </View>

          {/* Spinner de troca */}
          {uploading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color={T.primary} />
              <Text style={{ fontSize: 11, color: T.ink3 }}>Enviando novo arquivo…</Text>
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
                <Text style={{ fontSize: 28 }}>📁</Text>
              )}
              <Text
                style={{
                  fontSize: 13,
                  color: T.ink,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {uploading ? "Enviando…" : "Escolher arquivo de arte"}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: T.ink3,
                  textAlign: "center",
                }}
              >
                {formatLabel} · Máx {maxMb} MB
              </Text>
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
              <Text style={{ fontSize: 12, color: T.ink3, lineHeight: 18 }}>
                Envie a arte pelo WhatsApp após confirmar o pedido, ou acesse esta
                página pelo navegador do computador para fazer upload direto.
              </Text>
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
              <Text style={{ fontSize: 15 }}>⚠️</Text>
              <Text style={{ fontSize: 12, color: T.red, flex: 1 }}>{uploadError}</Text>
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
