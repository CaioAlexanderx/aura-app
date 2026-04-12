import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { referralsApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

export function ReferralCard() {
  const { user, isDemo, token } = useAuthStore();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [loading, setLoading] = useState(false);

  const emailVerified = !!(user as any)?.email_verified;

  useEffect(() => {
    if (!token || isDemo) return;
    loadReferrals();
  }, [token]);

  async function loadReferrals() {
    try {
      const data = await referralsApi.mine();
      setCode(data.code?.code || null);
      setStats(data.stats || { total: 0, completed: 0, pending: 0 });
    } catch {}
  }

  async function generateCode() {
    if (!emailVerified) {
      toast.error("Verifique seu e-mail antes de gerar um codigo de indicacao.");
      return;
    }
    setLoading(true);
    try {
      const data = await referralsApi.generate();
      setCode(data.code);
      toast.success("Codigo de indicacao gerado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar codigo");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!code) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(code);
      toast.success("Codigo copiado!");
    }
  }

  function shareWhatsApp() {
    if (!code) return;
    const msg = encodeURIComponent(
      "Oi! Estou usando a Aura pra gerenciar meu negocio e esta sendo incrivel. " +
      "Vou te dar 20% de desconto no primeiro mes.\n\n" +
      "Use o codigo " + code + " ou acesse:\n" +
      "https://getaura.com.br/r/" + code
    );
    const url = "https://wa.me/?text=" + msg;
    if (Platform.OS === "web") window.open(url, "_blank");
  }

  if (isDemo) {
    return (
      <View style={s.card}>
        <View style={s.header}>
          <Icon name="star" size={20} color={Colors.violet3} />
          <Text style={s.title}>Indique e ganhe</Text>
        </View>
        <Text style={s.desc}>
          Ganhe 20% de desconto indicando amigos. Quem voce indicar tambem ganha 20% no primeiro mes.
        </Text>
        <View style={s.codeBox}>
          <Text style={s.codeLabel}>Seu codigo</Text>
          <Text style={s.codeValue}>REF-DEMO</Text>
        </View>
        <Text style={s.demoNote}>Disponivel com conta real</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Icon name="star" size={20} color={Colors.violet3} />
        <Text style={s.title}>Indique e ganhe</Text>
      </View>
      <Text style={s.desc}>
        Ganhe 20% de desconto indicando amigos. Quem voce indicar tambem ganha 20% no primeiro mes.
      </Text>

      {code ? (
        <>
          <View style={s.codeBox}>
            <Text style={s.codeLabel}>Seu codigo</Text>
            <Text style={s.codeValue}>{code}</Text>
          </View>
          <View style={s.actions}>
            <Pressable onPress={copyCode} style={s.actionBtn}>
              <Icon name="clipboard" size={14} color={Colors.violet3} />
              <Text style={s.actionText}>Copiar</Text>
            </Pressable>
            <Pressable onPress={shareWhatsApp} style={[s.actionBtn, s.whatsBtn]}>
              <Icon name="message" size={14} color="#25D366" />
              <Text style={[s.actionText, { color: "#25D366" }]}>WhatsApp</Text>
            </Pressable>
          </View>
          {stats.total > 0 && (
            <View style={s.statsRow}>
              <View style={s.stat}><Text style={s.statNum}>{stats.completed}</Text><Text style={s.statLabel}>Concluidas</Text></View>
              <View style={s.stat}><Text style={s.statNum}>{stats.pending}</Text><Text style={s.statLabel}>Pendentes</Text></View>
              <View style={s.stat}><Text style={[s.statNum, { color: Colors.green }]}>{stats.completed}</Text><Text style={s.statLabel}>Descontos</Text></View>
            </View>
          )}
        </>
      ) : (
        <>
          {!emailVerified && (
            <View style={s.verifyNote}>
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={s.verifyNoteText}>Verifique seu e-mail para liberar as indicacoes.</Text>
            </View>
          )}
          <Pressable onPress={generateCode} style={[s.generateBtn, !emailVerified && { opacity: 0.6 }]} disabled={loading}>
            <Text style={s.generateText}>{loading ? "Gerando..." : "Gerar meu codigo"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  codeBox: { backgroundColor: Colors.violetD, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: Colors.border2 },
  codeLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  codeValue: { fontSize: 22, fontWeight: "800", color: Colors.violet3, letterSpacing: 2 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  whatsBtn: { borderColor: "#25D366" + "44" },
  actionText: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", backgroundColor: Colors.bg4, borderRadius: 10, padding: 10 },
  statNum: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  generateBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  generateText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  demoNote: { fontSize: 11, color: Colors.ink3, textAlign: "center", fontStyle: "italic", marginTop: 8 },
  verifyNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.amberD, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.amber + "33" },
  verifyNoteText: { fontSize: 12, color: Colors.amber, fontWeight: "500", flex: 1 },
});
