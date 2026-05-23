// ============================================================
// AURA. — VariantImageButton (23/05/2026)
//
// Botao circular (~30px) no inicio de cada linha de variante.
// - Sem foto: mostra ícone de camera sobre o swatch da cor (ou
//   violet quando size-only). Click = file picker.
// - Com foto: mostra a foto como thumb circular. Click = trocar.
//   X pequeno no canto superior direito = remover.
//
// Identifica a variante pela combinacao (color_hex, size_value) —
// o backend resolve o variant_id ativo (sobrevive ao soft-delete+
// INSERT do auto-save). NAO entra no PUT /variations: chamada
// direta em POST/DELETE /variant-image.
//
// Reutiliza padrao web file picker de ProductImageUpload.tsx.
// ============================================================
import { useState } from "react";
import { View, Image, Pressable, ActivityIndicator, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import productsVariationsApi from "@/services/productsVariationsApi";

type Props = {
  productId: string;
  /** Hex da cor da variante (null em size-only). Identifica variante junto com sizeValue. */
  colorHex: string | null;
  /** Tamanho da variante (null em color-only). */
  sizeValue: string | null;
  /** URL atual da foto (vem do GET /variations.images map). */
  imageUrl: string | null;
  /** Cor de fundo do placeholder quando NAO ha foto.
   *  Em color/matrix mode passa o hex; em size-only passa Colors.violet. */
  fallbackColor: string;
  /** Tamanho do botao em px. Padrao 28. */
  size?: number;
  /** Notificacao apos upload bem-sucedido (atualiza state pai). */
  onUploaded?: (url: string) => void;
  /** Notificacao apos delete bem-sucedido. */
  onDeleted?: () => void;
};

const MAX_SIZE_MB = 5;
const isWeb = Platform.OS === "web";

export function VariantImageButton({
  productId, colorHex, sizeValue, imageUrl, fallbackColor,
  size = 28, onUploaded, onDeleted,
}: Props) {
  const { company } = useAuthStore();
  const [busy, setBusy] = useState(false);

  function pickFile() {
    if (!isWeb || !company?.id || busy) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = function() {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error("Imagem muito grande (max " + MAX_SIZE_MB + "MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        const ctype = file.type || "image/jpeg";
        upload(base64, ctype);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function upload(base64: string, ctype: string) {
    if (!company?.id) return;
    setBusy(true);
    try {
      const res = await productsVariationsApi.uploadImage(company.id, productId, {
        color_hex: colorHex,
        size_value: sizeValue,
        content: base64,
        content_type: ctype,
      });
      if (onUploaded) onUploaded(res.image_url);
      toast.success("Foto da variante salva");
    } catch (err: any) {
      // Erro mais comum: variante ainda nao existe no banco (auto-save
      // ainda nao rodou apos adicionar cor/tamanho). Mensagem amigavel.
      const msg = err?.data?.error || err?.message || "";
      if (msg.includes("nao encontrada") || /404/.test(String(err?.status || ""))) {
        toast.error("Salve a variante antes de subir foto (aguarde alguns segundos)");
      } else {
        toast.error(msg || "Erro ao salvar foto");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(e: any) {
    e.stopPropagation();
    if (!company?.id || busy) return;
    setBusy(true);
    try {
      await productsVariationsApi.deleteImage(company.id, productId, {
        color_hex: colorHex,
        size_value: sizeValue,
      });
      if (onDeleted) onDeleted();
      toast.success("Foto removida");
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao remover foto");
    } finally {
      setBusy(false);
    }
  }

  const radius = size / 2;
  const hasImage = !!imageUrl;

  return (
    <View style={{ width: size, height: size, position: "relative" as any, flexShrink: 0 }}>
      <Pressable
        onPress={pickFile}
        disabled={busy || !isWeb}
        style={[
          s.thumb,
          {
            width: size, height: size, borderRadius: radius,
            backgroundColor: hasImage ? Colors.bg4 : fallbackColor,
          },
        ]}
        accessibilityLabel="Foto da variante"
      >
        {hasImage ? (
          <Image
            source={{ uri: imageUrl as string }}
            style={{ width: size, height: size, borderRadius: radius }}
            resizeMode="cover"
          />
        ) : (
          <Icon name="camera" size={Math.max(10, size * 0.4)} color="rgba(255,255,255,0.85)" />
        )}
        {busy && (
          <View style={[s.loadingOverlay, { borderRadius: radius }]}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
      </Pressable>

      {hasImage && !busy && (
        <Pressable
          onPress={handleDelete}
          hitSlop={4}
          style={s.removeBtn}
          accessibilityLabel="Remover foto da variante"
        >
          <Icon name="x" size={8} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  thumb: {
    overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  loadingOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  removeBtn: {
    position: "absolute" as any, top: -4, right: -4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: "#dc2626",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#fff",
  },
});

export default VariantImageButton;
