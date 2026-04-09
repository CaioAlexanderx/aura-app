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

export function ScannerInput({ onScan, placeholder }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const isWeb = Platform.OS === 'web';

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

      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      videoRef.current = video;

      // Create canvas for frame capture
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
  }, [isWeb]);

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

    // Try BarcodeDetector API (Chrome 83+)
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
      // Fallback: no BarcodeDetector, just show camera and let user type
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
  }, [cameraActive, isWeb]);

  return (
    <View style={z.container}>
      <View style={z.inputRow}>
        <View style={z.inputWrap}>
          <Icon name="search" size={16} color={Colors.ink3} />
          <TextInput
            ref={inputRef}
            style={z.input}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleSubmit}
            placeholder={placeholder || 'Escanear ou digitar codigo...'}
            placeholderTextColor={Colors.ink3}
            autoFocus
            returnKeyType="search"
          />
        </View>
        {isWeb && (
          <Pressable onPress={cameraActive ? stopCamera : startCamera} style={[z.cameraBtn, cameraActive && z.cameraBtnActive]}>
            <Icon name={cameraActive ? 'x' : 'search'} size={18} color={cameraActive ? '#fff' : Colors.violet3} />
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

      <Text style={z.hint}>Scanners USB/Bluetooth funcionam automaticamente ao escanear</Text>
    </View>
  );
}

const z = StyleSheet.create({
  container: { marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 8 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg3, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 12 },
  cameraBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border2 },
  cameraBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  cameraContainer: { marginTop: 12, alignItems: 'center', backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border },
  cameraOverlay: { position: 'absolute', top: '50%', left: 20, right: 20, height: 2 },
  scanLine: { height: 2, backgroundColor: Colors.violet + '66' },
  cameraHint: { fontSize: 11, color: Colors.ink3, marginTop: 8, textAlign: 'center' },
  cameraFallback: { fontSize: 10, color: Colors.amber, marginTop: 4, textAlign: 'center' },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 6, marginLeft: 4 },
});

export default ScannerInput;
