// ============================================================
// Seção de foto do praticante (P6) — preview circular + picker.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { styles } from "./shared-styles";

interface FotoSectionProps {
  photoUrl: string;
  photoLoading: boolean;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
}

export function FotoSection({ photoUrl, photoLoading, onPickPhoto, onRemovePhoto }: FotoSectionProps) {
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
        {photoUrl && !photoUrl.startsWith("http") && (
          <Text style={[styles.note, { color: P.ink3 }]}>
            Prévia local — será salva quando o upload de foto estiver disponível.
          </Text>
        )}
        {photoUrl && (
          <TouchableOpacity onPress={onRemovePhoto} hitSlop={8}>
            <Text style={[styles.note, { color: P.red }]}>Remover foto</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
