// ============================================================
// AURA. — AddClinicalImageModal (W1-02)
//
// Fluxo de upload de imagem clinica em 2 passos:
// 1. expo-image-picker seleciona foto da biblioteca (base64)
// 2. POST /storage/upload (category=clinical, patient_id, content base64)
//    retorna { key, url } do R2
// 3. POST /dental/patients/:pid/images (metadata: url, image_type,
//    tooth_number, description)
//
// Backend zero mudanca — reusa infra existente (storage.js +
// dentalImages.js). Path final R2: /dental/{company_id}/{patient_id}/
// {uuid}.jpg via generateImageKey().
//
// IMPORTANTE: require expo-image-picker. Rodar localmente:
//   cd ~/aura-app && npm install expo-image-picker
// ============================================================

import { useState } from 'react';
import {
  Modal, View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, Platform, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

interface Props {
  visible: boolean;
  patientId: string;
  patientName?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const IMAGE_TYPES = [
  { value: 'intraoral',   label: 'Intraoral',   hint: 'Foto dentro da boca' },
  { value: 'extraoral',   label: 'Extraoral',   hint: 'Rosto/perfil' },
  { value: 'radiografia', label: 'Radiografia', hint: 'RX panoramico, periapical, etc' },
  { value: 'modelo',      label: 'Modelo',      hint: 'Modelo gesso/digital' },
  { value: 'outro',       label: 'Outro',       hint: 'Sem categoria especifica' },
] as const;

type ImageTypeValue = typeof IMAGE_TYPES[number]['value'];

interface PickedAsset {
  uri: string;
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export function AddClinicalImageModal({ visible, patientId, patientName, onClose, onSaved }: Props) {
  const cid = useAuthStore().company?.id;

  const [asset, setAsset]               = useState<PickedAsset | null>(null);
  const [imageType, setImageType]       = useState<ImageTypeValue>('intraoral');
  const [toothNumber, setToothNumber]   = useState<string>('');
  const [description, setDescription]   = useState<string>('');
  const [uploading, setUploading]       = useState(false);

  async function handlePickImage() {
    try {
      // No web e mobile, expo-image-picker funciona com selector nativo
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const a = result.assets[0];
      if (!a.base64) {
        Alert.alert('Erro', 'Nao foi possivel ler a imagem. Tente outra foto.');
        return;
      }

      setAsset({
        uri:      a.uri,
        base64:   a.base64,
        mimeType: a.mimeType || 'image/jpeg',
        width:    a.width,
        height:   a.height,
        fileSize: a.fileSize,
      });
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Nao foi possivel abrir a galeria.');
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error('Nenhuma imagem selecionada');
      setUploading(true);

      // Passo 1: upload pro R2 via /storage/upload
      // Categoria clinical + patient_id geram key: /dental/{cid}/{pid}/{uuid}.jpg
      const ext = asset.mimeType.split('/')[1] || 'jpg';
      const filename = `clinical_${Date.now()}.${ext}`;

      const uploadRes: any = await request(`/companies/${cid}/storage/upload`, {
        method: 'POST',
        body: {
          content:      asset.base64,
          filename,
          category:     'clinical',
          content_type: asset.mimeType,
          patient_id:   patientId,
        },
      });

      if (!uploadRes?.url) {
        throw new Error('Upload falhou: resposta sem URL');
      }

      // Passo 2: salvar metadata em dental_images
      const meta: any = await request(`/companies/${cid}/dental/patients/${patientId}/images`, {
        method: 'POST',
        body: {
          url:           uploadRes.url,
          thumbnail_url: uploadRes.url,  // R2 sem thumbs por ora, usa a mesma
          file_name:     filename,
          file_size:     asset.fileSize || null,
          image_type:    imageType,
          tooth_number:  toothNumber ? parseInt(toothNumber) : null,
          description:   description.trim() || null,
        },
      });

      return meta;
    },
    onSuccess: () => {
      Alert.alert('Imagem salva', 'Foto clinica registrada com sucesso.');
      onSaved?.();
      reset();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Erro', err?.message || 'Nao foi possivel salvar a imagem.');
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  function reset() {
    setAsset(null);
    setImageType('intraoral');
    setToothNumber('');
    setDescription('');
  }

  function handleClose() {
    if (uploading) return;  // nao fecha durante upload
    reset();
    onClose();
  }

  function handleSave() {
    if (!asset) {
      Alert.alert('Atencao', 'Escolha uma foto antes de salvar.');
      return;
    }
    if (toothNumber) {
      const n = parseInt(toothNumber);
      if (isNaN(n) || n < 11 || n > 85) {
        Alert.alert('Dente invalido', 'Numero do dente deve estar entre 11 e 85 (sistema FDI).');
        return;
      }
    }
    saveMut.mutate();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    >
      <View style={s.modal}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Nova imagem clinica</Text>
            {patientName && <Text style={s.subtitle}>{patientName}</Text>}
          </View>
          <Pressable onPress={handleClose} style={s.closeBtn} disabled={uploading}>
            <Text style={s.closeBtnText}>Cancelar</Text>
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          {/* Preview ou botao escolher */}
          {asset ? (
            <View style={s.previewWrap}>
              <Image source={{ uri: asset.uri }} style={s.preview} resizeMode="contain" />
              <Pressable onPress={handlePickImage} style={s.changeBtn} disabled={uploading}>
                <Text style={s.changeBtnText}>Trocar foto</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={handlePickImage} style={s.pickBtn}>
              <Text style={s.pickIcon}>{'\u{1F4F7}'}</Text>
              <Text style={s.pickLabel}>Escolher foto da galeria</Text>
              <Text style={s.pickHint}>JPG, PNG ou WebP ate ~10 MB</Text>
            </Pressable>
          )}

          {/* Campos de metadata (aparecem apos escolher foto) */}
          {asset && (
            <>
              <View style={{ marginTop: 20 }}>
                <Text style={s.label}>Tipo de imagem</Text>
                <View style={s.typeGrid}>
                  {IMAGE_TYPES.map((t) => (
                    <Pressable
                      key={t.value}
                      onPress={() => setImageType(t.value)}
                      style={[s.typeCard, imageType === t.value && s.typeCardActive]}
                      disabled={uploading}
                    >
                      <Text style={[s.typeLabel, imageType === t.value && s.typeLabelActive]}>
                        {t.label}
                      </Text>
                      <Text style={s.typeHint}>{t.hint}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={s.label}>Dente (opcional, sistema FDI)</Text>
                <TextInput
                  style={s.input}
                  value={toothNumber}
                  onChangeText={setToothNumber}
                  keyboardType="numeric"
                  placeholder="Ex: 11, 26, 48"
                  placeholderTextColor="#64748B"
                  maxLength={2}
                  editable={!uploading}
                />
                <Text style={s.hint}>Numero de 11 a 85 (quadrante + posicao)</Text>
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={s.label}>Descricao (opcional)</Text>
                <TextInput
                  style={[s.input, { minHeight: 70 }]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="Ex: Cavidade oclusal antes da restauracao"
                  placeholderTextColor="#64748B"
                  editable={!uploading}
                />
              </View>

              <View style={s.infoBox}>
                <Text style={s.infoText}>
                  A imagem sera armazenada no R2 (Cloudflare) com acesso
                  restrito a esta empresa. LGPD Art.11: dado de saude
                  sensivel, retido por 5 anos ou conforme legislacao.
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            onPress={handleSave}
            disabled={!asset || uploading}
            style={[s.saveBtn, (!asset || uploading) && { opacity: 0.5 }]}
          >
            {uploading
              ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={s.saveBtnText}>Enviando...</Text>
                </View>
              )
              : <Text style={s.saveBtnText}>Salvar imagem</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ──────── Styles ────────
const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
    gap: 12,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#1E293B', borderRadius: 8 },
  closeBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  body: { flex: 1 },
  bodyContent: { padding: 16 },

  // Picker vazio
  pickBtn: {
    backgroundColor: 'rgba(6,182,212,0.06)',
    borderRadius: 14, padding: 32,
    borderWidth: 1.5, borderColor: 'rgba(6,182,212,0.3)',
    borderStyle: 'dashed',
    alignItems: 'center', gap: 8,
  },
  pickIcon:  { fontSize: 40 },
  pickLabel: { color: '#06B6D4', fontSize: 14, fontWeight: '700' },
  pickHint:  { color: '#64748B', fontSize: 11 },

  // Preview
  previewWrap: { gap: 10, alignItems: 'center' },
  preview: {
    width: '100%', height: 240,
    backgroundColor: '#1E293B', borderRadius: 12,
    borderWidth: 0.5, borderColor: '#334155',
  },
  changeBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#1E293B', borderRadius: 8,
    borderWidth: 0.5, borderColor: '#334155',
  },
  changeBtnText: { color: '#06B6D4', fontSize: 12, fontWeight: '600' },

  label: {
    color: '#94A3B8', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 10,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  hint: { color: '#64748B', fontSize: 10, marginTop: 4 },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: {
    flex: 1, minWidth: '30%',
    padding: 10, borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 0.5, borderColor: '#334155',
  },
  typeCardActive: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderColor: '#06B6D4',
  },
  typeLabel: {
    color: '#E2E8F0', fontSize: 13, fontWeight: '600', marginBottom: 2,
  },
  typeLabelActive: { color: '#06B6D4' },
  typeHint: { color: '#94A3B8', fontSize: 10 },

  // Info + footer
  infoBox: {
    marginTop: 14, padding: 10,
    backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 6,
    borderWidth: 0.5, borderColor: 'rgba(6,182,212,0.2)',
  },
  infoText: { color: '#06B6D4', fontSize: 11, lineHeight: 16 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#1E293B' },
  saveBtn: {
    backgroundColor: '#06B6D4', paddingVertical: 12, borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default AddClinicalImageModal;
