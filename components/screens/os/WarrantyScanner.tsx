// ============================================================
// AURA. — components/screens/os/WarrantyScanner.tsx
//
// Leitor de QR do certificado de garantia, para o PWA. Câmera traseira via
// getUserMedia; decodificação com BarcodeDetector quando o navegador tem
// (Chrome/Android) e jsQR como fallback — o Safari do iPhone não tem
// BarcodeDetector, e é exatamente onde o PWA do lojista roda.
//
// O QR carrega https://getaura.com.br/g/<CÓDIGO>; só o final do caminho
// importa (o backend aceita a URL inteira ou o código puro). Se a câmera
// falhar (permissão, sem câmera), o campo de código digitável resolve.
// ============================================================
import { createElement, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import jsQR from "jsqr";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCode: (raw: string) => void;
};

const IS_WEB = Platform.OS === "web";

export function WarrantyScanner({ visible, onClose, onCode }: Props) {
  const videoRef = useRef<any>(null);
  const [manual, setManual] = useState("");
  const [camError, setCamError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible || !IS_WEB) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let done = false;
    setCamError("");
    setReady(false);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    const detector = "BarcodeDetector" in window
      ? new (window as any).BarcodeDetector({ formats: ["qr_code"] })
      : null;

    function achou(raw: string) {
      if (done || !raw) return;
      done = true;
      onCode(raw);
    }

    async function tick() {
      if (stopped || done) return;
      const video = videoRef.current as HTMLVideoElement | null;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          if (detector) {
            const r = await detector.detect(canvas);
            if (r && r.length) achou(r[0].rawValue);
          } else {
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const q = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (q && q.data) achou(q.data);
          }
        } catch { /* quadro ruim: tenta o próximo */ }
      }
      if (!stopped && !done) raf = requestAnimationFrame(tick);
    }

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("sem câmera"), { name: "NotFoundError" });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current as HTMLVideoElement | null;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        setReady(true);
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        const n = e?.name || "";
        setCamError(
          n === "NotAllowedError" ? "Permissão de câmera negada. Libere a câmera nas configurações do navegador, ou digite o código abaixo."
          : n === "NotFoundError" ? "Nenhuma câmera encontrada. Digite o código abaixo."
          : n === "NotReadableError" ? "A câmera está em uso por outro app. Feche-o ou digite o código abaixo."
          : "Não foi possível abrir a câmera. Digite o código abaixo.",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function enviarManual() {
    const c = manual.trim();
    if (c.length >= 6) onCode(c);
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={440}>
      <View style={s.head}>
        <Icon name="qr_code" size={16} color={Colors.violet3} />
        <Text style={s.title}>Ler QR da garantia</Text>
        <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
      </View>

      <View style={s.body}>
        {IS_WEB && !camError && (
          <View style={s.camBox}>
            {createElement("video", {
              ref: videoRef,
              style: { width: "100%", height: "100%", objectFit: "cover", background: "#000" },
              muted: true,
              playsInline: true,
            })}
            <View style={s.frame} pointerEvents="none" />
            {!ready && <Text style={s.camHint}>Abrindo a câmera…</Text>}
          </View>
        )}
        {!IS_WEB && <Text style={s.err}>A leitura por câmera está disponível na versão web/PWA. Digite o código abaixo.</Text>}
        {!!camError && <Text style={s.err}>{camError}</Text>}

        <Text style={s.label}>Ou digite o código impresso no certificado</Text>
        <View style={s.row}>
          <TextInput
            style={s.input}
            value={manual}
            onChangeText={(v) => setManual(v.toUpperCase())}
            placeholder="K7M4Q9XD"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            onSubmitEditing={enviarManual}
            testID="warranty-code-input"
          />
          <Pressable onPress={enviarManual} style={s.btn} testID="warranty-code-go">
            <Text style={s.btnText}>Validar</Text>
          </Pressable>
        </View>
      </View>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, paddingBottom: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: "800", color: Colors.ink },
  body: { padding: 16, paddingTop: 4, gap: 10 },
  camBox: { height: 280, borderRadius: 14, overflow: "hidden", backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  frame: { position: "absolute", width: 190, height: 190, borderRadius: 18, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)" },
  camHint: { position: "absolute", color: "#fff", fontSize: 12 },
  err: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3, marginTop: 4 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, backgroundColor: Colors.bg2,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: "700", letterSpacing: 2, color: Colors.ink,
  },
  btn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
