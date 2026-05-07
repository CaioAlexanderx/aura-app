import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Image, Platform, TextInput, Modal } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { generateBarcodeSVG, generateQRSVGUrl, generateProductCode, generatePrintHTML } from "@/utils/codeGen";
import { toast } from "@/components/Toast";

type Props = {
  code: string;
  productName: string;
  price: number;
  onCodeChange: (code: string) => void;
  onFormatChange?: (format: 'barcode' | 'qr') => void;
};

export function BarcodeQRSection({ code, productName, price, onCodeChange, onFormatChange }: Props) {
  const [format, setFormat] = useState<'barcode' | 'qr'>('barcode');
  const [showPreview, setShowPreview] = useState(false);
  const isWeb = Platform.OS === 'web';

  // 07/05: scanner popup pra cadastrar produtos que ja chegam com codigo
  // de barras (EAN). Renderizado via Modal (portal RN) pra escapar de
  // stacking context da secao parent — antes o popup ficava coberto
  // pela secao seguinte do form ("Cores e Tamanhos").
  const [scanOpen, setScanOpen] = useState(false);
  const [scanText, setScanText] = useState('');
  const scanInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!scanOpen) return;
    const t = setTimeout(() => { scanInputRef.current?.focus(); }, 120);
    return () => clearTimeout(t);
  }, [scanOpen]);

  function closeScan() {
    setScanOpen(false);
    setScanText('');
  }

  function applyScan() {
    const cleaned = (scanText || '').trim();
    if (!cleaned) return;
    onCodeChange(cleaned);
    setShowPreview(true);
    closeScan();
    toast.success('Codigo capturado: ' + cleaned);
  }

  function handleGenerate() {
    const newCode = generateProductCode();
    onCodeChange(newCode);
    setShowPreview(true);
    toast.success('Codigo gerado: ' + newCode);
  }

  function handleFormatToggle(f: 'barcode' | 'qr') {
    setFormat(f);
    onFormatChange?.(f);
    if (code) setShowPreview(true);
  }

  function handlePrint() {
    if (!code || !isWeb) return;
    const html = generatePrintHTML([{ name: productName || 'Produto', code, price: price || 0, type: format }]);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  const barcodeSvg = code ? generateBarcodeSVG(code, 260, 70) : '';
  const barcodeSrc = code ? `data:image/svg+xml;base64,${btoa(barcodeSvg)}` : '';
  const qrSrc = code ? generateQRSVGUrl(code, 160) : '';

  return (
    <View style={s.container}>
      <Text style={s.title}>Codigo de barras / QR Code</Text>

      {/* Format toggle */}
      <View style={s.toggleRow}>
        <Pressable onPress={() => handleFormatToggle('barcode')} style={[s.toggleBtn, format === 'barcode' && s.toggleActive]}>
          <Text style={[s.toggleText, format === 'barcode' && s.toggleTextActive]}>Codigo de barras</Text>
        </Pressable>
        <Pressable onPress={() => handleFormatToggle('qr')} style={[s.toggleBtn, format === 'qr' && s.toggleActive]}>
          <Text style={[s.toggleText, format === 'qr' && s.toggleTextActive]}>QR Code</Text>
        </Pressable>
      </View>

      {/* Code input + scan + generate */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={(v) => { onCodeChange(v); if (v) setShowPreview(true); }}
          placeholder="Bipe, digite ou gere o codigo"
          placeholderTextColor={Colors.ink3}
        />
        <Pressable
          onPress={() => setScanOpen(true)}
          style={[s.scanBtn, scanOpen && s.scanBtnActive]}
          accessibilityLabel="Bipar codigo de barras"
        >
          <Icon name="barcode" size={16} color={scanOpen ? '#fff' : Colors.violet3} />
        </Pressable>
        <Pressable onPress={handleGenerate} style={s.genBtn}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={s.genText}>Gerar</Text>
        </Pressable>
      </View>

      {/* Modal pra escapar do stacking context — popup era coberto pela secao seguinte */}
      <Modal visible={scanOpen} transparent animationType="fade" onRequestClose={closeScan}>
        <Pressable style={s.scanBackdrop} onPress={closeScan}>
          <Pressable style={s.scanModalCard} onPress={(e) => e?.stopPropagation?.()}>
            <View style={s.scanModalHeader}>
              <Text style={s.scanModalTitle}>Bipar / digitar codigo</Text>
              <Pressable onPress={closeScan} style={s.scanModalClose}>
                <Text style={s.scanModalCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={s.scanInputRow}>
              <Icon name="barcode" size={18} color={Colors.violet3} />
              <TextInput
                ref={scanInputRef}
                style={s.scanInput}
                placeholder="Bipe ou digite o codigo..."
                placeholderTextColor={Colors.ink3}
                value={scanText}
                onChangeText={setScanText}
                onSubmitEditing={applyScan}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
            <Text style={s.scanPopHint}>
              Aponte o leitor USB e dispare, ou digite manualmente. Pressione Enter ou clique Aplicar pra confirmar.
            </Text>
            <View style={s.scanModalActions}>
              <Pressable onPress={closeScan} style={s.scanCancelBtn}>
                <Text style={s.scanCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={applyScan}
                disabled={!scanText.trim()}
                style={[s.scanApply, !scanText.trim() && { opacity: 0.4 }]}
              >
                <Text style={s.scanApplyTxt}>Aplicar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Preview */}
      {showPreview && code && (
        <View style={s.preview}>
          {format === 'barcode' && barcodeSrc ? (
            <Image source={{ uri: barcodeSrc }} style={{ width: 260, height: 70 }} resizeMode="contain" />
          ) : qrSrc ? (
            <Image source={{ uri: qrSrc }} style={{ width: 160, height: 160 }} resizeMode="contain" />
          ) : null}
          <View style={s.previewActions}>
            {isWeb && (
              <Pressable onPress={handlePrint} style={s.printBtn}>
                <Icon name="file_text" size={14} color={Colors.violet3} />
                <Text style={s.printText}>Imprimir etiqueta</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  title: { fontSize: 12, fontWeight: '600', color: Colors.ink3, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleRow: { flexDirection: 'row', gap: 6, marginBottom: 12, backgroundColor: Colors.bg, borderRadius: 10, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: Colors.violet },
  toggleText: { fontSize: 12, color: Colors.ink3, fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: Colors.bg, borderRadius: 10, padding: 10, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  genBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  genText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  scanBtn: { width: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.violetD, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  scanBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  scanBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scanModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    padding: 18,
    ...(Platform.OS === 'web' ? { boxShadow: '0 20px 60px -10px rgba(0,0,0,0.5)' } as any : {}),
  } as any,
  scanModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  scanModalTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.ink,
    letterSpacing: 0.2,
  },
  scanModalClose: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.bg4,
    alignItems: 'center', justifyContent: 'center',
  },
  scanModalCloseText: { fontSize: 16, color: Colors.ink3, fontWeight: '600' },
  scanInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.4)',
  },
  scanInput: {
    flex: 1, fontSize: 14, color: Colors.ink, fontWeight: '500',
    paddingVertical: 11,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  } as any,
  scanModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  scanCancelBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  scanCancelText: { fontSize: 12, color: Colors.ink3, fontWeight: '600' },
  scanApply: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  scanApplyTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  scanPopHint: { fontSize: 11, color: Colors.ink3, marginTop: 8, lineHeight: 15 },
  preview: { marginTop: 14, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 16 },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  printText: { fontSize: 11, color: Colors.violet3, fontWeight: '500' },
});

export default BarcodeQRSection;
