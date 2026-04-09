import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, Platform, TextInput } from "react-native";
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

      {/* Code input + generate */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={(v) => { onCodeChange(v); if (v) setShowPreview(true); }}
          placeholder="Codigo do produto"
          placeholderTextColor={Colors.ink3}
        />
        <Pressable onPress={handleGenerate} style={s.genBtn}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={s.genText}>Gerar</Text>
        </Pressable>
      </View>

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
  preview: { marginTop: 14, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 16 },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  printText: { fontSize: 11, color: Colors.violet3, fontWeight: '500' },
});

export default BarcodeQRSection;
