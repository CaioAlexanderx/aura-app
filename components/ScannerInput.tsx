// ============================================================
// AURA. — ScannerInput (redesign 22/04)
//
// fix(câmera): facingMode 'environment' era constraint exato — lançava
// OverconstrainedError em dispositivos sem câmera traseira (desktops).
// Trocado por { ideal: 'environment' } para fallback gracioso.
// fix(scanFrame): usava state `scanning` (stale closure) — loop nunca
// rodava ao abrir câmera. Substituído por isScanningRef.
//
// 16/05/2026 (Davi mobile): botão da câmera estava sumindo em narrow
// viewport (mobile web e telas <480px). Causas e correções:
// • cameraBtn agora flexShrink:0 — nunca encolhe nem sai do layout.
// • Em narrow (<480px) o botão fica 40×40 (era 48×48) — economiza
//   espaço sem perder o ícone.
// • Em native (Expo mobile) onde BarcodeDetector não existe, o botão
//   continua aparecendo mas mostra toast informativo dizendo pra usar
//   scanner USB/teclado.
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, useWindowDimensions } from "react-native";
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
  const [isFocused, setIsFocused] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const isScanningRef = useRef(false);

  // Narrow viewport detection — mobile/small monitors get tighter layout
  const { width: vw } = useWindowDimensions();
  const isNarrow = vw < 480;

  function handleSubmit() {
    const code = inputValue.trim();
    if (!code) return;
    onScan({ code, source: 'scanner' });
    setInputValue('');
    inputRef.current?.focus();
  }

  function scanFrame() {
    if (!videoRef.current || !canvasRef.current || !isScanningRef.current) return;
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
        if (isScanningRef.current) animRef.current = requestAnimationFrame(scanFrame);
      }).catch(() => {
        if (isScanningRef.current) animRef.current = requestAnimationFrame(scanFrame);
      });
    } else {
      if (isScanningRef.current) animRef.current = requestAnimationFrame(scanFrame);
    }
  }

  const startCamera = useCallback(async () => {
    if (!isWeb || typeof navigator === 'undefined') {
      toast.info('Câmera disponível no navegador. Use Chrome no celular ou um scanner USB.');
      return;
    }
    // Detecta suporte ao BarcodeDetector antes de pedir permissão da câmera
    if (typeof window !== 'undefined' && !('BarcodeDetector' in window)) {
      toast.info('Seu navegador não detecta códigos automaticamente. Recomendamos Chrome ou Edge.');
      // Continua mesmo assim — alguns navegadores podem ler manualmente
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      await video.play();
      videoRef.current = video;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvasRef.current = canvas;

      isScanningRef.current = true;
      setCameraActive(true);
      scanFrame();
    } catch (err: any) {
      const name = err?.name || '';
      const msg =
        name === 'OverconstrainedError' ? 'Nenhuma câmera compatível encontrada.' :
        name === 'NotAllowedError'      ? 'Permissão de câmera negada. Verifique as configurações do navegador.' :
        name === 'NotFoundError'        ? 'Nenhuma câmera detectada neste dispositivo.' :
        name === 'NotReadableError'     ? 'Câmera em uso por outro app. Feche e tente novamente.' :
        'Não foi possível acessar a câmera (' + (name || 'erro desconhecido') + ').';
      console.warn('[ScannerInput] startCamera error:', name, err?.message);
      toast.error(msg);
    }
  }, []);

  function stopCamera() {
    isScanningRef.current = false;
    setCameraActive(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    videoRef.current = null;
  }

  useEffect(() => { return () => { stopCamera(); }; }, []);

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

  useEffect(() => {
    if (!isWeb || !isFocused) return;
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

  // Tamanho do botão da câmera adaptativo
  const camBtnSize = isNarrow ? 40 : 48;

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
            Scanners USB/Bluetooth funcionam automaticamente ao escanear. Também aceita digitação manual ou leitura por câmera (botão à direita).
          </Text>
        </View>
      )}

      {/* Input + camera (camera sempre visivel em web; em native mostra toast informativo) */}
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
            placeholder={placeholder || 'Bipe o código ou digite...'}
            placeholderTextColor={Colors.ink3}
            autoFocus
            returnKeyType="search"
          />
        </View>
        {/* Botão da câmera: SEMPRE renderizado (web ativa de fato, native mostra toast).
            flexShrink:0 + width fixo garante que nunca é cortado em narrow viewport. */}
        <Pressable
          onPress={cameraActive ? stopCamera : startCamera}
          style={[
            z.cameraBtn,
            { width: camBtnSize, height: camBtnSize },
            cameraActive && z.cameraBtnActive,
          ]}
          accessibilityLabel={cameraActive ? "Fechar câmera" : "Ler código com a câmera"}
        >
          <Icon
            name={cameraActive ? 'x' : 'camera'}
            size={isNarrow ? 16 : 18}
            color={cameraActive ? '#fff' : Colors.violet3}
          />
        </Pressable>
      </View>

      {cameraActive && isWeb && (
        <View style={z.cameraContainer}>
          <div id="aura-scanner-feed" style={{ width: '100%', maxWidth: 400, borderRadius: 12, overflow: 'hidden', position: 'relative' } as any}>
            <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 } as any}>Carregando câmera...</div>
          </div>
          <View style={z.cameraOverlay}>
            <View style={z.scanLine} />
          </View>
          <Text style={z.cameraHint}>Aponte para o código de barras ou QR Code</Text>
          {!('BarcodeDetector' in (typeof window !== 'undefined' ? window : {})) && (
            <Text style={z.cameraFallback}>Seu navegador não suporta leitura automática. Use Chrome para melhor experiência.</Text>
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
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg3, borderRadius: 12,
    paddingHorizontal: 14, borderWidth: 1.5, borderColor: Colors.border,
    minWidth: 0,
    ...(isWeb ? { transition: 'border-color 0.15s ease, box-shadow 0.15s ease' } as any : {}),
  },
  inputWrapFocused: {
    borderColor: Colors.violet3,
    ...(isWeb ? { boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.15)' } as any : {}),
  },
  input: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 13, fontWeight: '500', minWidth: 0 },
  // flexShrink: 0 garante que o botão nunca é cortado mesmo em viewport ultra-narrow.
  cameraBtn: {
    borderRadius: 12,
    backgroundColor: Colors.violetD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
    flexShrink: 0,
  },
  cameraBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  cameraContainer: { marginTop: 12, alignItems: 'center', backgroundColor: Colors.bg3, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border },
  cameraOverlay: { position: 'absolute', top: '50%', left: 20, right: 20, height: 2 },
  scanLine: { height: 2, backgroundColor: Colors.violet + '66' },
  cameraHint: { fontSize: 11, color: Colors.ink3, marginTop: 8, textAlign: 'center' },
  cameraFallback: { fontSize: 10, color: Colors.amber, marginTop: 4, textAlign: 'center' },
});

export default ScannerInput;
