import { useState, useRef, useEffect } from "react";
import { View, Text, Modal, Pressable, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioColors, StudioGradients } from "@/constants/studio-tokens";
import { toast } from "@/components/Toast";

type Props = {
  visible: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    description?: string | null;
    price?: number;
    image_url?: string | null;
  };
  shop: {
    name: string;
    slug: string;          // pra gerar deep link
    logo_url?: string | null;
  };
};

export function PreviewWhatsAppModal({ visible, onClose, product, shop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    generateCard();
  }, [visible, product.id]);

  async function generateCard() {
    setGenerating(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado");

      // 1. Fundo: gradient brand (navy → magenta diagonal)
      const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
      grad.addColorStop(0, StudioGradients.brand[0]);
      grad.addColorStop(1, StudioGradients.brand[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);

      // 2. Foto do produto (centralizada, 800x800)
      if (product.image_url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = product.image_url!;
        });
        // Card branco arredondado
        ctx.fillStyle = "#fff";
        roundRect(ctx, 140, 360, 800, 800, 32);
        ctx.fill();
        // Foto cover dentro do card
        ctx.save();
        roundRect(ctx, 160, 380, 760, 760, 24);
        ctx.clip();
        const aspect = img.width / img.height;
        let dw = 760, dh = 760;
        if (aspect > 1) { dh = 760 / aspect; } else { dw = 760 * aspect; }
        ctx.drawImage(img, 160 + (760 - dw) / 2, 380 + (760 - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        // Placeholder
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        roundRect(ctx, 140, 360, 800, 800, 32);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 80px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎨", 540, 800);
      }

      // 3. Header com nome da loja
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(shop.name.toUpperCase(), 80, 140);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "20px sans-serif";
      ctx.fillText("AURA STUDIO · PERSONALIZADOS", 80, 180);

      // 4. Nome do produto + preço
      ctx.fillStyle = "#fff";
      ctx.font = "bold 72px serif";
      ctx.textAlign = "center";
      // Quebrar em até 2 linhas
      const lines = wrapText(ctx, product.name, 900, 72);
      lines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, 540, 1280 + i * 80);
      });

      if (product.price) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 56px sans-serif";
        ctx.fillText("R$ " + Number(product.price).toFixed(2).replace(".", ","), 540, 1500);
      }

      // 5. CTA + link
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "28px sans-serif";
      ctx.fillText("Personalize do seu jeito 🎨", 540, 1620);
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("loja.getaura.com.br/" + shop.slug + "/studio", 540, 1680);

      // 6. Aura logo no rodapé
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "20px sans-serif";
      ctx.fillText("✨ AURA", 540, 1840);

      const url = canvas.toDataURL("image/png", 0.95);
      setDataUrl(url);
    } catch (e: any) {
      toast.error("Erro ao gerar preview: " + (e?.message || "tente de novo"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${product.name.replace(/\s+/g, "-")}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: product.name,
          text: `Confira ${product.name} — personalize do seu jeito!`,
          files: [file],
        });
      } else {
        // Fallback: download
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${product.name.replace(/\s+/g, "-")}.png`;
        a.click();
        toast.success("✨ Imagem baixada — compartilhe no WhatsApp!");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Erro ao compartilhar");
    }
  }

  // Helpers
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      if (ctx.measureText(test).width > maxWidth) {
        if (current) lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  if (!visible) return null;
  if (Platform.OS !== "web") {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={s.overlay}>
          <View style={s.card}>
            <Text style={s.title}>Preview WhatsApp</Text>
            <Text style={s.desc}>Disponível apenas no navegador.</Text>
            <Pressable onPress={onClose} style={s.btnClose}><Text style={s.btnCloseTxt}>Fechar</Text></Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.eyebrow}>PREVIEW WHATSAPP</Text>
          <Text style={s.title}>Compartilhe seu produto</Text>
          {generating ? (
            <View style={s.previewBox}>
              <ActivityIndicator color={StudioColors.primary} size="large" />
              <Text style={s.desc}>Gerando cartão...</Text>
            </View>
          ) : dataUrl ? (
            // @ts-ignore - native img on web
            <img src={dataUrl} alt="preview" style={{ width: 270, height: 480, borderRadius: 12, marginVertical: 16 } as any} />
          ) : null}
          <View style={s.actions}>
            <Pressable onPress={onClose} style={s.btnSec}><Text style={s.btnSecTxt}>Cancelar</Text></Pressable>
            <Pressable onPress={handleShare} disabled={!dataUrl} style={[s.btnPri, !dataUrl && { opacity: 0.5 }]}>
              <Icon name="external-link" size={14} color="#fff" />
              <Text style={s.btnPriTxt}>Compartilhar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.7)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { backgroundColor: StudioColors.paperCardElev, borderRadius: 18, padding: 24, maxWidth: 360, width: "100%", alignItems: "center" },
  eyebrow: { fontSize: 11, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 20, color: StudioColors.ink, fontWeight: "800", marginTop: 6 },
  desc: { fontSize: 13, color: StudioColors.ink3, marginTop: 12, textAlign: "center" },
  previewBox: { width: 270, height: 480, backgroundColor: StudioColors.bgSoft, borderRadius: 12, alignItems: "center", justifyContent: "center", marginVertical: 16, gap: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btnPri: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: StudioColors.primary, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10 },
  btnPriTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  btnSec: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: StudioColors.ink5 },
  btnSecTxt: { color: StudioColors.ink2, fontSize: 13, fontWeight: "700" },
  btnClose: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, backgroundColor: StudioColors.primary, marginTop: 12 },
  btnCloseTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
});

export default PreviewWhatsAppModal;
