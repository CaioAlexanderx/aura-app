import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { referralsApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { tourTarget } from "@/utils/tourTarget";
import { ALVO_INDICACAO } from "@/utils/focoIndicacao";
import { comoFuncionaIndicacao, descricaoIndicacao, mensagemIndicacao } from "@/utils/indicacaoCampanha";

// 14/10/2026 (campanha de indicação, aprovada pelo Caio e pela Célia): o
// indicador ganha 1 mês grátis quando o indicado paga a primeira mensalidade;
// o indicado testa 7 dias e tem 20% no primeiro mês. Antes o texto prometia
// 20% ao indicador, o que nenhum código cumpria.
// 28/10/2026: a frase mora em utils/indicacaoCampanha (DESCRICAO_INDICACAO) e
// leva o texto da Black Friday até 30/11/2026 23:59:59 BRT.

// 25/10/2026 (tom das mensagens, extra 2): "Como funciona" recolhível com as
// regras que valem hoje (COMO_FUNCIONA_INDICACAO, utils/mensagensDoApp).
// 28/10/2026: até 30/11/2026 23:59:59 BRT os itens são os da Black Friday
// (utils/indicacaoCampanha); depois voltam sozinhos aos de hoje.
function ComoFunciona({ regras }: { regras: readonly string[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <View style={s.comoWrap}>
      <Pressable
        testID="indicacao-como-funciona"
        onPress={() => setAberto((v) => !v)}
        style={[s.comoBtn, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
      >
        <Text style={s.comoBtnText}>Como funciona</Text>
        <Icon name={aberto ? "chevron_up" : "chevron_down"} size={14} color={Colors.violet3} />
      </Pressable>
      {aberto && (
        <View testID="indicacao-regras" style={s.comoLista}>
          {regras.map((regra) => (
            <View key={regra} style={s.comoItem}>
              <Text style={s.comoBullet}>•</Text>
              <Text style={s.comoTexto}>{regra}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function ReferralCard() {
  const { user, isDemo, token } = useAuthStore();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [loading, setLoading] = useState(false);

  const emailVerified = !!(user as any)?.email_verified;
  const agora = new Date();
  const regras = comoFuncionaIndicacao(agora);
  const descricao = descricaoIndicacao(agora);

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
      toast.error("Verifique seu e-mail antes de gerar um código de indicação.");
      return;
    }
    setLoading(true);
    try {
      const data = await referralsApi.generate();
      setCode(data.code);
      toast.success("Código de indicação gerado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar código");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!code) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(code);
      toast.success("Código copiado!");
    }
  }

  function shareWhatsApp() {
    if (!code) return;
    const msg = encodeURIComponent(mensagemIndicacao(code, new Date()));
    const url = "https://wa.me/?text=" + msg;
    if (Platform.OS === "web") window.open(url, "_blank");
  }

  if (isDemo) {
    return (
      <View style={s.card} {...tourTarget(ALVO_INDICACAO)}>
        <View style={s.header}>
          <Icon name="star" size={20} color={Colors.violet3} />
          <Text style={s.title}>Indique e ganhe</Text>
        </View>
        <Text testID="indicacao-descricao" style={s.desc}>{descricao}</Text>
        <ComoFunciona regras={regras} />
        <View style={s.codeBox}>
          <Text style={s.codeLabel}>Seu código</Text>
          <Text style={s.codeValue}>REF-DEMO</Text>
        </View>
        <Text style={s.demoNote}>Disponível com conta real</Text>
      </View>
    );
  }

  return (
    <View style={s.card} {...tourTarget(ALVO_INDICACAO)}>
      <View style={s.header}>
        <Icon name="star" size={20} color={Colors.violet3} />
        <Text style={s.title}>Indique e ganhe</Text>
      </View>
      <Text testID="indicacao-descricao" style={s.desc}>{descricao}</Text>
      <ComoFunciona regras={regras} />

      {code ? (
        <>
          <View style={s.codeBox}>
            <Text style={s.codeLabel}>Seu código</Text>
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
              {/* "Cadastros" = quem entrou pelo seu código; "Pendentes" = aguardando
                  a primeira mensalidade. Sem "Descontos" até a recompensa existir. */}
              <View style={s.stat}><Text style={s.statNum}>{stats.total}</Text><Text style={s.statLabel}>Cadastros</Text></View>
              <View style={s.stat}><Text style={s.statNum}>{stats.pending}</Text><Text style={s.statLabel}>Pendentes</Text></View>
            </View>
          )}
        </>
      ) : (
        <>
          {!emailVerified && (
            <View style={s.verifyNote}>
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={s.verifyNoteText}>Verifique seu e-mail para liberar as indicações.</Text>
            </View>
          )}
          <Pressable onPress={generateCode} style={[s.generateBtn, !emailVerified && { opacity: 0.6 }]} disabled={loading}>
            <Text style={s.generateText}>{loading ? "Gerando..." : "Gerar meu código"}</Text>
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
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 8 },
  comoWrap: { marginBottom: 16 },
  comoBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  comoBtnText: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  comoLista: { marginTop: 6, gap: 6, backgroundColor: Colors.bg4, borderRadius: 10, padding: 12 },
  comoItem: { flexDirection: "row", gap: 6 },
  comoBullet: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  comoTexto: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 18 },
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
