// ============================================================
// Seção de foto do praticante (P6) — preview circular + picker.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
//
// Mudanças (feat/karate-foto-upload-real):
//   • onPickFile(file: File) — expõe o File escolhido ao shell para upload
//   • fileToBase64() — helper exportado: lê File via FileReader e retorna
//     base64 puro (sem prefixo "data:…;base64,") + content_type
//   • Preview imediato via createObjectURL continua funcionando
//   • Removida nota "Prévia local — será salva quando o upload estiver
//     disponível" (agora o upload é real)
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { styles } from "./shared-styles";

// ─────────────────────────────────────────────────────────────────
// Helper: lê um File da Web API e retorna base64 puro + content_type.
// Exportado para o shell (PraticanteFichaModal) usar no handleSave.
// ─────────────────────────────────────────────────────────────────
export function fileToBase64(
  file: File
): Promise<{ content: string; content_type: "image/jpeg" | "image/png" | "image/webp" }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/jpeg;base64,/9j/4AAQ…" → "/9j/4AAQ…"
      const content = result.split(",")[1];
      const raw = file.type || "image/jpeg";
      const content_type = (
        ["image/jpeg", "image/png", "image/webp"].includes(raw) ? raw : "image/jpeg"
      ) as "image/jpeg" | "image/png" | "image/webp";
      resolve({ content, content_type });
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
    reader.readAsDataURL(file);
  });
}

interface FotoSectionProps {
  photoUrl: string;
  photoLoading: boolean;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  /** Callback chamado com o File escolhido (web), para o shell fazer upload. */
  onPickFile?: (file: File) => void;
}

export function FotoSection({
  photoUrl,
  photoLoading,
  onPickPhoto,
  onRemovePhoto,
  onPickFile: _onPickFile, // recebido pelo shell, mas o trigger do picker fica em onPickPhoto
}: FotoSectionProps) {
  return (
    <View style={styles.photoRow}>
      <View style={styles.photoPreview}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photoImg} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Icon name="user" size={28} color={P.ink4} />
          </View>
        )}
        {photoLoading && (
          <View style={styles.photoOverlay}>
            <ActivityIndicator color={P.red} size="small" />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.label}>Foto</Text>
        <TouchableOpacity
          style={styles.photoBtn}
          onPress={onPickPhoto}
          disabled={photoLoading}
          activeOpacity={0.7}
          accessibilityLabel={photoUrl ? "Trocar foto" : "Adicionar foto"}
        >
          <Icon name="camera" size={14} color={P.ink2} />
          <Text style={styles.photoBtnTxt}>{photoUrl ? "Trocar foto" : "Adicionar foto"}</Text>
        </TouchableOpacity>
        {photoUrl && (
          <TouchableOpacity onPress={onRemovePhoto} hitSlop={8}>
            <Text style={[styles.note, { color: P.red }]}>Remover foto</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
