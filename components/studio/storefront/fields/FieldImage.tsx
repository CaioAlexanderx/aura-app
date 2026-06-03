// ============================================================
// components/studio/storefront/fields/FieldImage.tsx
// Campo type="image" — upload/link de imagem.
//
// PONTO DE PLUGUE ONDA 1 (Agente G):
//   Este componente encapsula toda a lógica do campo image.
//   Para substituir por upload real (file picker → R2), o Agente G
//   reescreve SOMENTE este arquivo. O contrato com o exterior
//   NÃO muda: onChange(url: string) é chamado com a URL pública
//   após upload bem-sucedido.
//
// CONTRATO (não alterar assinatura):
//   props.field      — CustomizationField com type="image"
//   props.value      — string | undefined (URL atual ou undefined)
//   props.onChange   — (url: string) => void  (grava no customization)
//   props.slug       — string (necessário pra montar a URL do endpoint de upload)
//
// COMO O AGENTE G USA:
//   1. Adiciona file picker web (input type=file / expo-image-picker)
//   2. Converte arquivo → base64
//   3. Chama POST /storefront/{slug}/studio/upload com {content_base64, content_type, filename}
//   4. Recebe {url} e chama props.onChange(url)
//   O estado uploading/uploadError é local a este componente.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, TextInput, Platform } from "react-native";
import type { CustomizationField } from "../types";
import { T, sectionLabel } from "../types";

const API_BASE =
  (typeof process !== "undefined" && (process.env as any)?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

export function FieldImage({
  field, value, slug, onChange,
}: {
  field: CustomizationField;
  /** URL pública já enviada, ou undefined/empty se nada enviado ainda */
  value: any;
  /** Slug da loja — necessário para o endpoint de upload */
  slug: string;
  /** Chamado com a URL pública R2 após upload ou com "" para remover */
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Handler de upload (web — file input)
  // AGENTE G: substitua ou estenda esta função para usar expo-image-picker
  // ou adicionar suporte a PDF. O contrato onChange(url) não muda.
  async function handleFileSelect(ev: any) {
    const file: File | undefined = ev?.target?.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Aceitos: PNG, JPG, WEBP");
      return;
    }
    if (file.size > (field.config.max_mb || 15) * 1024 * 1024) {
      setUploadError(`Arquivo grande demais (max ${field.config.max_mb || 15}MB)`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(API_BASE + "/storefront/" + slug + "/studio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_base64: dataUrl.split(",")[1],
          content_type: file.type,
          filename: file.name,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onChange(data.url);
      // limpa o input pra permitir re-upload do mesmo arquivo
      try { ev.target.value = ""; } catch (_) {}
    } catch (e: any) {
      setUploadError(e?.message || "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View>
      <Text style={sectionLabel}>
        {field.label} {field.required && <Text style={{ color: T.red }}>*</Text>}
      </Text>
      {value ? (
        <View style={{ gap: 8 }}>
          {Platform.OS === "web" ? (
            // @ts-ignore - native img on web
            <img
              src={String(value)}
              alt="preview"
              style={{
                width: "100%", maxHeight: 200, objectFit: "contain",
                borderRadius: 8, border: "1px solid " + T.border,
                backgroundColor: T.bg,
              } as any}
            />
          ) : (
            <Text style={{ fontSize: 12, color: T.green }}>Imagem enviada ✓</Text>
          )}
          <Pressable
            onPress={() => { onChange(""); setUploadError(null); }}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
              backgroundColor: "#fee2e2",
            }}
          >
            <Text style={{ color: T.red, fontSize: 11, fontWeight: "700" }}>Remover</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {Platform.OS === "web" ? (
            <View>
              {/* @ts-ignore - native label/input on web */}
              <label
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 6,
                  padding: 20, backgroundColor: T.card,
                  border: "2px dashed " + T.border, borderRadius: 10,
                  cursor: uploading ? "wait" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                } as any}
              >
                <Text style={{ fontSize: 24 }}>{uploading ? "⏳" : "📷"}</Text>
                <Text style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>
                  {uploading ? "Enviando..." : "Escolher foto"}
                </Text>
                <Text style={{ fontSize: 11, color: T.ink3 }}>PNG, JPG ou WEBP até {field.config.max_mb || 15}MB</Text>
                {/* @ts-ignore */}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  style={{ display: "none" } as any}
                />
              </label>
              <Text style={{ fontSize: 10, color: T.ink3, marginTop: 6, textAlign: "center" }}>
                ou cole o link da imagem abaixo
              </Text>
              <TextInput
                value={String(value || "")}
                onChangeText={onChange}
                placeholder="https://..."
                placeholderTextColor={T.ink4}
                style={{
                  backgroundColor: T.card, color: T.ink, padding: 10,
                  borderRadius: 8, fontSize: 12,
                  borderWidth: 1, borderColor: T.border,
                  marginTop: 4,
                }}
              />
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: T.ink3 }}>
                Cole o link da imagem (ou envie por WhatsApp depois)
              </Text>
              <TextInput
                value={String(value || "")}
                onChangeText={onChange}
                placeholder="https://..."
                placeholderTextColor={T.ink4}
                style={{
                  backgroundColor: T.card, color: T.ink, padding: 12,
                  borderRadius: 8, fontSize: 13,
                  borderWidth: 1, borderColor: T.border,
                }}
              />
            </View>
          )}
          {uploadError && (
            <Text style={{ fontSize: 11, color: T.red }}>{uploadError}</Text>
          )}
        </View>
      )}
    </View>
  );
}
