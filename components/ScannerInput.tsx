// ============================================================
// AURA. — ScannerInput (redesign 22/04)
// Separacao visual forte do campo de busca. Features UX:
// - Label "SCANNER" em caps violeta (claro = nao e busca)
// - Icone barcode (nao search) + borda accent violeta
// - Glow/ring violeta quando focado (comunicando "ouvindo")
// - Dot verde pulsante no topo quando focado (pronto p/ bipe)
// - Placeholder direto: "Bipe o codigo ou digite..."
// - Camera com icone proprio (camera, nao search)
// - Hint textual substituido por tooltip discreto no info icon
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

type ScanResult = { code: string; source: 'scanner' | 'camera' | 'manual' };
type Props = {
  onScan: (result: ScanResult) => void;
  placeholder?: string;
};

var isWeb = Platform.OS === 'web';

export function ScannerInput({ onScan, placeholder }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  // Handle barcode scanner input (USB scanners type + Enter)
  function handleSubmit() {
    const code = inputValue.trim();
    if (!code) return;
    onScan({ code, source: 'scanner' });
    setInputValue('');
    inputRef.current?.focus();
  }

  // Camera QR scanning
  const startCamera = useCallback(async () => {
    if (!isWeb || typeof navigator === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      videoRef.current = video;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvasRef.current = canvas;

      setCameraActive(true);
      setScanning(true);
      scanFrame();
    } catch (err) {
      toast.error('Nao foi possivel acessar a camera. Verifique as permissoes.');
    }
  }, []);

  function scanFrame() {
    if (!videoRef.current || !canvasRef.current || !scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39']
      });
      detector.detect(canvas).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          onScan({ code, source: 'camera' });
          toast.success(`Codigo detectado: ${code}`);
          stopCamera();
          return;
        }
        if (scanning) animRef.current = requestAnimationFrame(scanFrame);
      }).catch(() => {
        if (scanning) animRef.current = requestAnimationFrame(scanFrame);
      });
    } else {
      animRef.current = requestAnimationFrame(scanFrame);
    }
  }

  function stopCamera() {
    setScanning(false);
    setCameraActive(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    videoRef.current = null;
  }

  useEffect(() => { return () => { stopCamera(); }; }, []);

  // Render camera feed into a container
  useEffect(() => {
    if (!cameraActive || !isWeb || !videoRef.current) return;
    const container = document.getElementById('aura-scanner-feed');
    if (container && videoRef.current) {
      videoRef.current.style.width = '100%';
      videoRef.current.style.borderRadius = '12px';
      container.innerHTML = '';
      container.appendChild(videoRef.current);
    }
  }, [cameraActive]);

  // Pulse animation for "ready" dot (web only; subtle on native)
  useEffect(() => {
    if (!isWeb || !isFocused) return;
    // Inject a one-time CSS keyframe for the pulse
    var styleId = 'aura-scanner-pulse-kf';
    if (!document.getElementById(styleId)) {
      var style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = '@keyframes auraPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }';
      document.head.appendChild(style);
    }
  }, [isFocused]);

  var readyDotStyle: any = isWeb && isFocused
    ? { animation: 'auraPulse 1.4s ease-in-out infinite' }
    : {};

  return (
    <View style={z.container}>
      {/* Header: label + status + tooltip */}
      <View style={z.header}>
        <View style={z.labelGroup}>
          <Icon name="barcode" size={12} color={Colors.violet3} />
          <Text style={z.label}>SCANNER</Text>
          {isFocused && (
            <View style={z.readyGroup}>
              <View style={[z.readyDot, readyDotStyle]} />
              <Text style={z.readyText}>pronto</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => setShowHint(!showHint)}
          onHoverIn={isWeb ? () => setShowHint(true) : undefined}
          onHoverOut={isWeb ? () => setShowHint(false) : undefined}
          style={z.infoBtn}
        >
          <Icon name="info" size={13} color={Colors.ink3} />
        </Pressable>
      </View>

      {showHint && (
        <View style={z.hintBox}>
          <Text style={z.hintText}>
            Scanners USB/Bluetooth funcionam automaticamente ao escanear. Tambem aceita digitacao manual.
          </Text>
        </View>
      )}

      {/* Input + camera */}
      <View style={z.inputRow}>
        <View style={[z.inputWrap, isFocused && z.inputWrapFocused]}>
          <Icon name="barcode" size={18} color={isFocused ? Colors.violet3 : Colors.ink3} />
          <TextInput
            ref={inputRef}
            style={z.input}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleSubmit}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || 'Bipe o codigo ou digite...'}
            placeholderTextColor={Colors.ink3}
            autoFocus
            returnKeyType="search"
          />
        </View>
        {isWeb && (
          <Pressable
            onPress={cameraActive ? stopCamera : startCamera}
            style={[z.cameraBtn, cameraActive && z.cameraBtnActive]}
          >
            <Icon name={cameraActive ? 'x' : 'camera'} size={18} color={cameraActive ? '#fff' : Colors.violet3} />
          </Pressable>
        )}
      </View>

      {cameraActive && isWeb && (
        <View style={z.cameraContainer}>
          <div id="aura-scanner-feed" style={{ width: '100%', maxWidth: 400, borderRadius: 12, overflow: 'hidden', position: 'relative' } as any}>
            <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 } as any}>Carregando camera...</div>
          </div>
          <View style={z.cameraOverlay}>
            <View style={z.scanLine} />
          </View>
          <Text style={z.cameraHint}>Aponte para o codigo de barras ou QR Code</Text>
          {!('BarcodeDetector' in (typeof window !== 'undefined' ? window : {})) && (
            <Text style={z.cameraFallback}>Seu navegador nao suporta leitura automatica. Use Chrome para melhor experiencia.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const z = StyleSheet.create({
  container: { marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontWeight: '700', color: Colors.violet3, letterSpacing: 1.2 },
  readyGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  readyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  readyText: { fontSize: 9, fontWeight: '600', color: '#22c55e', letterSpacing: 0.6 },
  infoBtn: { padding: 4, borderRadius: 4 },
  hintBox: { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  hintText: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  inputRow: { flexDirection: 'row', gap: 8 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg3, borderRadius: 12,
    paddingHorizontal: 14, borderWidth: 1.5, borderColor: Colors.border,
    ...(isWeb ? { transition: 'border-color 0.15s ease, box-shadow 0.15s ease' } as any : {}),
  },
  inputWrapFocused: {
    borderColor: Colors.violet3,
    ...(isWeb ? { boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.15)' } as any : {}),
  },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 13, fontWeight: '500' },
  cameraBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: Colors.violetD, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border2,
  },
  cameraBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  cameraContainer: { marginTop: 12, alignItems: 'center', backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border },
  cameraOverlay: { position: 'absolute', top: '50%', left: 20, right: 20, height: 2 },
  scanLine: { height: 2, backgroundColor: Colors.violet + '66' },
  cameraHint: { fontSize: 11, color: Colors.ink3, marginTop: 8, textAlign: 'center' },
  cameraFallback: { fontSize: 10, color: Colors.amber, marginTop: 4, textAlign: 'center' },
});

export default ScannerInput;
