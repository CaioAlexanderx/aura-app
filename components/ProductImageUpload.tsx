// ============================================================
// AURA. — ProductImageUpload
// Upload de foto do produto via base64 → R2
// Funciona em web (file input) e mostra preview.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, Image, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  productId: string;
  imageUrl?: string;
  onImageChange?: (url: string | null) => void;
  compact?: boolean;
};

var isWeb = Platform.OS === "web";
var MAX_SIZE_MB = 5;

export function ProductImageUpload({ productId, imageUrl, onImageChange, compact }: Props) {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [uploading, setUploading] = useState(false);
  var [deleting, setDeleting] = useState(false);
  var [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl || null);

  function handlePickFile() {
    if (!isWeb || !company?.id) return;
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = function() {
      var file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error("Imagem muito grande (max " + MAX_SIZE_MB + "MB)");
        return;
      }
      var reader = new FileReader();
      reader.onload = function() {
        var dataUrl = reader.result as string;
        var base64 = dataUrl.split(",")[1];
        var contentType = file.type || "image/jpeg";
        setPreviewUrl(dataUrl);
        uploadImage(base64, contentType);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function uploadImage(base64: string, contentType: string) {
    if (!company?.id) return;
    setUploading(true);
    try {
      var res = await request("/companies/" + company.id + "/products/" + productId + "/image", {
        method: "POST",
        body: { content: base64, content_type: contentType },
      });
      var url = (res as any)?.image_url || "";
      setPreviewUrl(url);
      if (onImageChange) onImageChange(url);
      qc.invalidateQueries({ queryKey: ["products", company.id] });
      toast.success("Foto salva!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar foto");
      setPreviewUrl(imageUrl || null);
    } finally { setUploading(false); }
  }

  async function handleDelete() {
    if (!company?.id) return;
    setDeleting(true);
    try {
      await request("/companies/" + company.id + "/products/" + productId + "/image", { method: "DELETE" });
      setPreviewUrl(null);
      if (onImageChange) onImageChange(null);
      qc.invalidateQueries({ queryKey: ["products", company.id] });
      toast.success("Foto removida");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover foto");
    } finally { setDeleting(false); }
  }

  var size = compact ? 64 : 100;

  return (
    <View style={[s.container, compact && { gap: 8 }]}>
      <Pressable onPress={handlePickFile} disabled={uploading} style={[s.imageBox, { width: size, height: size }]}>
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={{ width: size, height: size, borderRadius: 12 }} resizeMode="cover" />
        ) : (
          <View style={[s.placeholder, { width: size, height: size }]}>
            <Icon name="camera" size={compact ? 18 : 24} color={Colors.ink3} />
            {!compact && <Text style={s.placeholderText}>Foto</Text>}
          </View>
        )}
        {uploading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
      </Pressable>
      {previewUrl && !uploading && (
        <Pressable onPress={handleDelete} disabled={deleting} style={s.deleteBtn}>
          {deleting ? <ActivityIndicator size="small" color={Colors.red} /> : <Icon name="trash" size={12} color={Colors.red} />}
        </Pressable>
      )}
      {!compact && !previewUrl && !uploading && (
        <Text style={s.hint}>JPG, PNG ou WebP{"\n"}Max {MAX_SIZE_MB}MB</Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  container: { alignItems: "center", gap: 6 },
  imageBox: { borderRadius: 12, overflow: "hidden", position: "relative" as any },
  placeholder: {
    backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border, borderStyle: "dashed" as any,
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  placeholderText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  loadingOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "33",
    alignItems: "center", justifyContent: "center",
  },
  hint: { fontSize: 9, color: Colors.ink3, textAlign: "center", lineHeight: 14 },
});

export default ProductImageUpload;
