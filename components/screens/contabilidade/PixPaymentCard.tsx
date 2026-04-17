import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

var isWeb = Platform.OS === "web";

type Props = {
  qrBase64?: string | null;
  pixPayload?: string | null;
  amount?: number;
  dueDate?: string;
  title?: string;
  onPaid?: () => void;
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };

export function PixPaymentCard({ qrBase64, pixPayload, amount, dueDate, title, onPaid }: Props) {
  var [copied, setCopied] = useState(false);

  if (!qrBase64 && !pixPayload) return null;

  function copyPix() {
    if (!pixPayload) return;
    if (isWeb && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(pixPayload).then(function() {
        setCopied(true); toast.success("Codigo Pix copiado!");
        setTimeout(function() { setCopied(false); }, 3000);
      }).catch(function() { toast.error("Erro ao copiar"); });
    } else {
      toast.info("Copie manualmente: " + pixPayload.slice(0, 30) + "...");
    }
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.pixIcon}>
          <Text style={s.pixIconText}>PIX</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title || "Pagamento via Pix"}</Text>
          {dueDate && <Text style={s.due}>Vencimento: {dueDate}</Text>}
        </View>
        {amount != null && amount > 0 && (
          <Text style={s.amount}>{fmt(amount)}</Text>
        )}
      </View>

      {qrBase64 && (
        <View style={s.qrWrap}>
          <Image
            source={{ uri: "data:image/png;base64," + qrBase64 }}
            style={s.qrImage}
            resizeMode="contain"
          />
          <Text style={s.qrCaption}>Escaneie com o app do seu banco</Text>
        </View>
      )}

      {pixPayload && (
        <Pressable onPress={copyPix} style={[s.copyBtn, copied && s.copyBtnDone]}>
          <Icon name={copied ? "check" : "copy"} size={14} color={copied ? Colors.green : Colors.violet3} />
          <Text style={[s.copyText, copied && { color: Colors.green }]}>
            {copied ? "Copiado!" : "Copiar codigo Pix"}
          </Text>
        </Pressable>
      )}

      {pixPayload && (
        <View style={s.payloadWrap}>
          <Text style={s.payloadLabel}>Copia e cola:</Text>
          <Text style={s.payloadText} numberOfLines={2} selectable>{pixPayload}</Text>
        </View>
      )}

      {onPaid && (
        <Pressable onPress={onPaid} style={s.paidBtn}>
          <Icon name="check" size={14} color={Colors.green} />
          <Text style={s.paidText}>Ja paguei</Text>
        </Pressable>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.green + "33", marginTop: 12, marginLeft: 48 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  pixIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  pixIconText: { fontSize: 10, fontWeight: "800", color: Colors.green, letterSpacing: 0.5 },
  title: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  due: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  amount: { fontSize: 20, fontWeight: "800", color: Colors.green },
  qrWrap: { alignItems: "center", marginBottom: 14, gap: 6 },
  qrImage: { width: 180, height: 180, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  qrCaption: { fontSize: 10, color: Colors.ink3 },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border2, marginBottom: 10 },
  copyBtnDone: { backgroundColor: Colors.greenD, borderColor: Colors.green + "44" },
  copyText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  payloadWrap: { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, marginBottom: 12 },
  payloadLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  payloadText: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" },
  paidBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.greenD, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: Colors.green + "44" },
  paidText: { fontSize: 13, color: Colors.green, fontWeight: "600" },
});

export default PixPaymentCard;
