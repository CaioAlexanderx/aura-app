import { useState, useEffect, useRef } from "react";
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

  // 07/05: scanner popup pra cadastrar produtos que ja chegam com codigo
  // de barras (EAN). USB scanner emite keypresses + Enter, entao o input
  // com autoFocus + onSubmitEditing captura tudo. Tambem aceita digitar.
  const [scanOpen, setScanOpen] = useState(false);
  const [scanText, setScanText] = useState('');
  const scanPopRef = useRef<any>(null);
  const scanInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!scanOpen || !isWeb) return;
    function onDoc(e: MouseEvent) {
      if (scanPopRef.current && !scanPopRef.current.contains(e.target)) {
        setScanOpen(false);
        setScanText('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [scanOpen, isWeb]);

  useEffect(() => {
    if (!scanOpen) return;
    const t = setTimeout(() => { scanInputRef.current?.focus(); }, 80);
    return () => clearTimeout(t);
  }, [scanOpen]);

  function applyScan() {
    const cleaned = (scanText || '').trim();
    if (!cleaned) return;
    onCodeChange(cleaned);
    setShowPreview(true);
    setScanOpen(false);
    setScanText('');
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
      <View style={s.inputRow} ref={scanPopRef as any}>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={(v) => { onCodeChange(v); if (v) setShowPreview(true); }}
          placeholder="Bipe, digite ou gere o codigo"
          placeholderTextColor={Colors.ink3}
        />
        <Pressable
          onPress={() => setScanOpen(o => !o)}
          style={[s.scanBtn, scanOpen && s.scanBtnActive]}
          accessibilityLabel="Bipar codigo de barras"
        >
          <Icon name="barcode" size={16} color={scanOpen ? '#fff' : Colors.violet3} />
        </Pressable>
        <Pressable onPress={handleGenerate} style={s.genBtn}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={s.genText}>Gerar</Text>
        </Pressable>

        {scanOpen && (
          <View style={s.scanPop}>
            <Text style={s.scanPopTitle}>Bipar / digitar codigo</Text>
            <View style={s.scanInputRow}>
              <Icon name="barcode" size={16} color={Colors.violet3} />
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
              <Pressable
                onPress={applyScan}
                disabled={!scanText.trim()}
                style={[s.scanApply, !scanText.trim() && { opacity: 0.4 }]}
              >
                <Text style={s.scanApplyTxt}>Aplicar</Text>
              </Pressable>
            </View>
            <Text style={s.scanPopHint}>
              Aponte o leitor USB e dispare. Tambem aceita digitar manualmente.
            </Text>
          </View>
        )}
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
  inputRow: { flexDirection: 'row', gap: 8, position: 'relative' as any, zIndex: 30 },
  input: { flex: 1, backgroundColor: Colors.bg, borderRadius: 10, padding: 10, fontSize: 13, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  genBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  genText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  scanBtn: { width: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.violetD, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  scanBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  scanPop: {
    position: 'absolute' as any,
    top: 50,
    right: 0,
    width: 320,
    maxWidth: '100%' as any,
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    padding: 12,
    zIndex: 999,
    ...(Platform.OS === 'web' ? { boxShadow: '0 20px 40px -10px rgba(124,58,237,0.25)' } as any : {}),
  } as any,
  scanPopTitle: {
    fontSize: 10, fontWeight: '700', color: Colors.ink3,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  scanInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.4)',
  },
  scanInput: {
    flex: 1, fontSize: 13, color: Colors.ink, fontWeight: '500',
    paddingVertical: 9,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  } as any,
  scanApply: { backgroundColor: Colors.violet, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6 },
  scanApplyTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  scanPopHint: { fontSize: 10, color: Colors.ink3, marginTop: 6, lineHeight: 14 },
  preview: { marginTop: 14, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 16 },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  printText: { fontSize: 11, color: Colors.violet3, fontWeight: '500' },
});

export default BarcodeQRSection;
