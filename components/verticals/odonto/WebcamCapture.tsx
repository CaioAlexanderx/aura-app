// ============================================================
// WebcamCapture — Captura de foto via webcam (web) ou galeria/camera (mobile)
//
// Modal full-screen com preview da camera + botao capturar.
// Em web usa getUserMedia + canvas pra extrair frame.
// Em mobile (sem getUserMedia confiavel) usa <input type="file" capture="user">
// que abre camera nativa do device.
//
// onCapture(dataUrl: string) recebe a foto em formato base64 PNG.
// Caller decide o que fazer (upload, persistir local, etc).
//
// PR28 (2026-04-28): novo componente. Usado em PatientFormModal,
// PatientHub e ConsultaShell (FAB camera intraoral).
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, Platform, ActivityIndicator, StyleSheet, Image } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { toast } from "@/components/Toast";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  /** Titulo do modal. Default: "Capturar foto" */
  title?: string;
  /** Hint sob o preview. Default: "Posicione o paciente no enquadramento" */
  hint?: string;
  /** "user" = camera frontal (selfie), "environment" = traseira (intraoral). Default: "user" */
  facing?: "user" | "environment";
}

const isWeb = Platform.OS === "web";

export function WebcamCapture({ visible, onClose, onCapture, title, hint, facing = "user" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<"loading" | "live" | "preview" | "error">("loading");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inicializa stream quando modal abre. Em web tenta getUserMedia.
  // Em fallback / mobile, abre file input nativo (capture=user/environment).
  useEffect(() => {
    if (!visible) return;
    if (!isWeb) {
      // Em RN nativo, expoe so file input via dialog (web tambem cobre tablet)
      setStage("live");
      return;
    }
    let cancelled = false;
    setStage("loading");
    setError(null);
    setPreviewUrl(null);

    async function initCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("Webcam nao suportada neste navegador");
        setStage("error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStage("live");
      } catch (e: any) {
        const msg = e?.message || "";
        if (e?.name === "NotAllowedError" || msg.includes("Permission")) {
          setError("Permissao da camera negada. Habilite nas configuracoes do navegador.");
        } else if (e?.name === "NotFoundError") {
          setError("Nenhuma camera encontrada neste dispositivo.");
        } else {
          setError("Nao foi possivel acessar a camera: " + msg);
        }
        setStage("error");
      }
    }
    initCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, facing]);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch {}
    }
  }

  function handleClose() {
    stopStream();
    setStage("loading");
    setPreviewUrl(null);
    onClose();
  }

  function handleCapture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror horizontalmente se for camera frontal (facing user)
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewUrl(dataUrl);
    setStage("preview");
    stopStream();
  }

  function handleConfirm() {
    if (!previewUrl) return;
    onCapture(previewUrl);
    toast.success("Foto capturada");
    handleClose();
  }

  function handleRetake() {
    setPreviewUrl(null);
    setStage("loading");
    // Reabre stream
    setTimeout(() => {
      if (!videoRef.current) return;
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      }).then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStage("live");
      }).catch(() => setStage("error"));
    }, 100);
  }

  // Fallback file input (mobile native ou quando webcam falha)
  function openFileInput() {
    fileInputRef.current?.click();
  }
  function handleFileChange(ev: any) {
    const file = ev?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result?.startsWith("data:image")) {
        setPreviewUrl(result);
        setStage("preview");
        stopStream();
      } else {
        toast.error("Arquivo invalido");
      }
    };
    reader.readAsDataURL(file);
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>{title || "Capturar foto"}</Text>
              {hint && <Text style={s.hint}>{hint}</Text>}
            </View>
            <Pressable onPress={handleClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Preview area */}
          <View style={s.stage}>
            {stage === "loading" && (
              <View style={s.center}>
                <ActivityIndicator color={DentalColors.cyan} size="large" />
                <Text style={s.muted}>Iniciando camera...</Text>
              </View>
            )}

            {stage === "error" && (
              <View style={s.center}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📷</Text>
                <Text style={s.errorText}>{error}</Text>
                {isWeb && (
                  <Pressable onPress={openFileInput} style={s.fallbackBtn}>
                    <Text style={s.fallbackBtnText}>Selecionar arquivo do dispositivo</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Live video (web only) */}
            {isWeb && stage === "live" && (
              <video
                ref={videoRef as any}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  transform: facing === "user" ? "scaleX(-1)" : "none",
                  borderRadius: 12,
                } as any}
              />
            )}

            {/* Preview capturado */}
            {stage === "preview" && previewUrl && (
              <Image source={{ uri: previewUrl }} style={s.previewImg} resizeMode="cover" />
            )}

            {/* Mobile-only fallback: file input direto */}
            {!isWeb && stage === "live" && (
              <View style={s.center}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📸</Text>
                <Pressable onPress={openFileInput} style={s.fallbackBtn}>
                  <Text style={s.fallbackBtnText}>Abrir camera do dispositivo</Text>
                </Pressable>
              </View>
            )}

            {/* Hidden inputs (web only fallback / mobile native) */}
            {isWeb && (
              <>
                <canvas ref={canvasRef as any} style={{ display: "none" } as any} />
                <input
                  ref={fileInputRef as any}
                  type="file"
                  accept="image/*"
                  capture={facing as any}
                  onChange={handleFileChange}
                  style={{ display: "none" } as any}
                />
              </>
            )}
          </View>

          {/* Actions */}
          <View style={s.footer}>
            {stage === "live" && isWeb && (
              <>
                <Pressable onPress={openFileInput} style={s.btnSecondary}>
                  <Text style={s.btnSecondaryText}>📂 Galeria</Text>
                </Pressable>
                <Pressable onPress={handleCapture} style={s.btnCapture}>
                  <Text style={s.btnCaptureText}>📸 Capturar</Text>
                </Pressable>
              </>
            )}
            {stage === "preview" && (
              <>
                <Pressable onPress={handleRetake} style={s.btnSecondary}>
                  <Text style={s.btnSecondaryText}>↻ Refazer</Text>
                </Pressable>
                <Pressable onPress={handleConfirm} style={s.btnConfirm}>
                  <Text style={s.btnConfirmText}>✓ Usar esta foto</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 640, backgroundColor: DentalColors.bg2, borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: DentalColors.border, gap: 12 },
  title: { fontSize: 16, fontWeight: "800", color: DentalColors.ink },
  hint: { fontSize: 11, color: DentalColors.ink3, marginTop: 4 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: DentalColors.ink2, fontSize: 16 },
  stage: { aspectRatio: 4/3, backgroundColor: "#000", margin: 16, borderRadius: 12, overflow: "hidden", position: "relative" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
  muted: { fontSize: 11, color: DentalColors.ink3 },
  errorText: { fontSize: 13, color: DentalColors.amber, textAlign: "center", lineHeight: 18, maxWidth: 320 },
  previewImg: { width: "100%", height: "100%" },
  fallbackBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: DentalColors.cyan, marginTop: 10 },
  fallbackBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: DentalColors.border, justifyContent: "flex-end" },
  btnSecondary: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: DentalColors.border },
  btnSecondaryText: { color: DentalColors.ink2, fontSize: 12, fontWeight: "600" },
  btnCapture: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: DentalColors.cyan, borderWidth: 1, borderColor: DentalColors.cyan },
  btnCaptureText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnConfirm: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: DentalColors.green, borderWidth: 1, borderColor: DentalColors.green },
  btnConfirmText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

export default WebcamCapture;
