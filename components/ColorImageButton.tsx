// ============================================================
// AURA. — ColorImageButton (27/06/2026)
//
// Espelho do VariantImageButton mas com semantica POR COR:
// uma unica foto que se aplica a TODAS as variantes ativas
// daquela cor (independente de tamanho). Bate no novo endpoint
// POST/DELETE /companies/:cid/products/:pid/color-image
// (backend PR fix/davi-variant-consolidation).
//
// Substitui VariantImageButton dentro de ProductVariationsSection
// nos modos `color` e `matrix`. VariantImageButton legado fica
// intacto pra back-compat (ainda exportado, sem usos remanescentes).
//
// Diferencas vs VariantImageButton:
// - Sem prop sizeValue (sempre null no nivel de modelo).
// - Sem isPersisted/onRequestFlush: a cor existe assim que entra no
//   chip (handler addColor dispara scheduleSave imediato); o backend
//   tolera variant_id stale porque resolveVariantsByColor busca
//   pelo atributo Cor diretamente. Se nao houver variantes ainda
//   (cor recem-adicionada sem PUT), o backend devolve 404 e o
//   componente mostra hint "Aguarde — salvando cor...".
// - Callback onUploaded retorna a URL pra o pai propagar em todas as
//   chaves images do matrix daquela cor (color-only: 1 chave; matrix:
//   N chaves, 1 por tamanho).
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
  colorHex: string;            // sempre presente (modo color/matrix)
  imageUrl: string | null;
  size?: number;
  /** Notificacao apos upload bem-sucedido: pai propaga em todas as chaves do matrix da cor. */
  onUploaded?: (url: string) => void;
  /** Notificacao apos delete bem-sucedido. */
  onDeleted?: () => void;
  /** Se a cor ainda nao existe no servidor (sem variantes), opcao de flush. */
  isSaving?: boolean;
  onRequestFlush?: () => Promise<void>;
};

const MAX_SIZE_MB = 5;
const isWeb = Platform.OS === "web";

export function ColorImageButton({
  productId, colorHex, imageUrl,
  size = 28, onUploaded, onDeleted,
  isSaving = false, onRequestFlush,
}: Props) {
  const { company } = useAuthStore();
  const [busy, setBusy] = useState(false);

  function pickFile() {
    if (!isWeb || !company?.id || busy || isSaving) return;
    openPicker();
  }

  function openPicker() {
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

  async function attemptUpload(base64: string, ctype: string): Promise<"ok" | "retry-after-flush" | "error"> {
    try {
      const res = await productsVariationsApi.uploadColorImage(company!.id, productId, {
        color_hex: colorHex,
        content: base64,
        content_type: ctype,
      });
      if (onUploaded) onUploaded(res.image_url);
      toast.success("Foto da cor salva (" + res.variants_affected + " " + (res.variants_affected === 1 ? "variante" : "variantes") + ")");
      return "ok";
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "";
      // Caso "cor recem-adicionada sem variantes ainda no banco": precisa flush.
      if (msg.includes("Nenhuma variante") || /404/.test(String(err?.status || ""))) {
        return "retry-after-flush";
      }
      toast.error(msg || "Erro ao salvar foto");
      return "error";
    }
  }

  async function upload(base64: string, ctype: string) {
    if (!company?.id) return;
    setBusy(true);
    try {
      let outcome = await attemptUpload(base64, ctype);
      if (outcome === "retry-after-flush" && onRequestFlush) {
        try {
          await onRequestFlush();
          outcome = await attemptUpload(base64, ctype);
        } catch (e: any) {
          toast.error("Nao foi possivel salvar a cor. Tente novamente em 1 segundo.");
        }
      } else if (outcome === "retry-after-flush") {
        toast.error("Aguarde — cor ainda sendo salva. Tente novamente em ~1s.");
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
      await productsVariationsApi.deleteColorImage(company.id, productId, { color_hex: colorHex });
      if (onDeleted) onDeleted();
      toast.success("Foto da cor removida");
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao remover foto");
    } finally {
      setBusy(false);
    }
  }

  const radius = size / 2;
  const hasImage = !!imageUrl;
  const isPending = isSaving;
  const a11yLabel = hasImage ? "Foto da cor (trocar)" : "Foto da cor (clique para subir)";

  return (
    <View style={{ width: size, height: size, position: "relative" as any, flexShrink: 0 }}>
      <Pressable
        onPress={pickFile}
        disabled={busy || !isWeb}
        style={[
          s.thumb,
          {
            width: size, height: size, borderRadius: radius,
            backgroundColor: hasImage ? Colors.bg4 : colorHex,
            opacity: isPending && !busy ? 0.45 : 1,
          },
        ]}
        accessibilityLabel={a11yLabel}
        // @ts-ignore — title funciona na web (tooltip nativo)
        title={isPending ? "Aguarde — salvando cor…" : (hasImage ? "Trocar foto da cor" : "Subir foto da cor")}
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
        {(busy || isSaving) && (
          <View style={[s.loadingOverlay, { borderRadius: radius }]}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
      </Pressable>

      {hasImage && !busy && !isPending && (
        <Pressable
          onPress={handleDelete}
          hitSlop={4}
          style={s.removeBtn}
          accessibilityLabel="Remover foto da cor"
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

export default ColorImageButton;
