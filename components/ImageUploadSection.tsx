import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";

type Props = {
  productId: string;
  currentImageUrl?: string | null;
  onImageChange?: (url: string | null) => void;
};

export function ImageUploadSection({ productId, currentImageUrl, onImageChange }: Props) {
  const { company, token } = useAuthStore();
  const [imageUrl, setImageUrl] = useState(currentImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const isWeb = Platform.OS === "web";

  async function handlePickImage() {
    if (!isWeb || typeof document === "undefined") { toast.info("Upload disponivel na versao web"); return; }
    if (!company?.id || !token) { toast.error("Sessao expirada"); return; }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.style.cssText = "position:fixed;top:-100px;opacity:0";
    document.body.appendChild(input);

    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no maximo 5MB"); return; }

      setUploading(true);
      try {
        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // Remove data:image/... prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(`${BASE_URL}/companies/${company.id}/products/${productId}/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ content: base64, content_type: file.type }),
        });

        const data = await res.json();
        if (res.ok && data.image_url) {
          setImageUrl(data.image_url);
          onImageChange?.(data.image_url);
          toast.success("Imagem salva!");
        } else {
          toast.error(data.error || "Erro ao salvar imagem");
        }
      } catch {
        toast.error("Erro ao fazer upload");
      } finally { setUploading(false); }
    };

    input.click();
  }

  async function handleRemoveImage() {
    if (!company?.id || !token) return;
    try {
      await fetch(`${BASE_URL}/companies/${company.id}/products/${productId}/image`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      setImageUrl(null);
      onImageChange?.(null);
      toast.success("Imagem removida");
    } catch { toast.error("Erro ao remover"); }
  }

  return (
    <View style={s.container}>
      <Text style={s.label}>Foto do produto</Text>
      <View style={s.content}>
        {imageUrl ? (
          <View style={s.previewWrap}>
            {isWeb ? (
              <img src={imageUrl} alt="Produto" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12 } as any} />
            ) : (
              <View style={s.placeholder}><Icon name="package" size={28} color={Colors.violet3} /></View>
            )}
            <View style={s.previewActions}>
              <Pressable onPress={handlePickImage} disabled={uploading} style={s.changeBtn}>
                <Icon name="upload" size={13} color={Colors.violet3} />
                <Text style={s.changeBtnText}>Trocar</Text>
              </Pressable>
              <Pressable onPress={handleRemoveImage} style={s.removeBtn}>
                <Text style={s.removeBtnText}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={handlePickImage} disabled={uploading} style={s.uploadArea}>
            {uploading ? (
              <ActivityIndicator color={Colors.violet3} />
            ) : (
              <>
                <View style={s.uploadIcon}>
                  <Icon name="upload" size={22} color={Colors.violet3} />
                </View>
                <Text style={s.uploadText}>Adicionar foto</Text>
                <Text style={s.uploadHint}>JPEG, PNG ou WebP (max 5MB)</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  content: {},
  previewWrap: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  placeholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  previewActions: { gap: 8 },
  changeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border2 },
  changeBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  removeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  removeBtnText: { fontSize: 11, color: Colors.red, fontWeight: "500" },
  uploadArea: { alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 12, padding: 24, borderWidth: 1.5, borderColor: Colors.border2, borderStyle: "dashed" as any },
  uploadIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  uploadText: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  uploadHint: { fontSize: 10, color: Colors.ink3 },
});

export default ImageUploadSection;
