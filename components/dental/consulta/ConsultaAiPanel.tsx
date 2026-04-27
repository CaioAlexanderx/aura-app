// ============================================================
// ConsultaAiPanel — painel IA REAL do Modo Consulta (PR19).
//
// Substitui o ConsultaAiPanelGated (placeholder PR17). Este
// agora chama o backend POST /dental/ai/consulta de verdade.
//
// Renderiza 4 estados via useAiAccess + useDentalAiSettings:
//   1. Plano abaixo de Expansao  -> CTA upgrade
//   2. Plano OK + ai_enabled=false -> CTA "Ativar nas configuracoes"
//   3. Plano OK + sem consent       -> CTA "Aceite o termo"
//   4. Tudo OK                       -> chat funcional + quota visivel
//
// Apenas intent=qa e suggestion sao disparados aqui.
// brief auto-fire mora em ConsultaIntro (PR19).
// summarize mora no ConsultaEndModal (PR19).
// ============================================================

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { DentalColors } from "@/constants/dental-tokens";
import { useAiAccess } from "@/hooks/useAiAccess";
import { useDentalAiConsulta } from "@/hooks/useDentalAiConsulta";

type Msg = {
  id: string;
  role: "user" | "ai";
  text: string;
  meta?: { intent?: string; tokens?: number; cost?: number; latencyMs?: number };
};

interface Props {
  appointmentId: string;
  patientId: string;
  briefSeed?: string; // mensagem inicial vinda do brief auto na intro
}

function uid(): string {
  return Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

export function ConsultaAiPanel({ appointmentId, patientId, briefSeed }: Props) {
  const access = useAiAccess();
  const router = useRouter();
  const askMut = useDentalAiConsulta();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const seededRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);

  // Seed inicial: brief auto vindo de ConsultaIntro
  useEffect(() => {
    if (seededRef.current || !briefSeed) return;
    seededRef.current = true;
    setMessages([
      { id: uid(), role: "ai", text: briefSeed, meta: { intent: "brief" } },
    ]);
  }, [briefSeed]);

  // ─── Estados gated ───
  if (access.reason === "plan_below_required") {
    return <GatedView title={`IA Aura · plano ${access.requiredPlanLabel}+`}
      desc="Brief pré-consulta inteligente, sugestões em tempo real, perguntas livres e resumo automático. Disponível a partir do plano Expansão."
      icon="🔒" cta={`Ver plano ${access.requiredPlanLabel}`}
      onCta={() => router.push("/(tabs)/configuracoes")}
      footer={`Plano atual: ${access.plan}`} />;
  }
  if (access.reason === "ai_not_enabled") {
    return <GatedView title="IA Aura · ativação pendente"
      desc="Você tem o plano Expansão, mas a IA não foi ativada nas configurações da clínica. Ative para usar brief, sugestões e resumo automático na consulta."
      icon="⚙️" cta="Ir para configurações"
      onCta={() => router.push(access.aiSettingsHref as any)}
      ctaColor={DentalColors.cyan} />;
  }
  if (access.reason === "consent_required") {
    return <GatedView title="IA Aura · termo de uso pendente"
      desc="Pra usar a IA no atendimento é preciso aceitar o termo LGPD sobre envio de dados clínicos ao serviço LLM. Aceite uma única vez nas configurações."
      icon="📜" cta="Revisar e aceitar"
      onCta={() => router.push(access.aiSettingsHref as any)}
      ctaColor={DentalColors.violet} />;
  }
  if (access.reason === "no_company") return null;

  // ─── Estado funcional ───
  function send() {
    const q = input.trim();
    if (!q || askMut.isPending) return;
    const userMsg: Msg = { id: uid(), role: "user", text: q };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    askMut.mutate(
      { intent: "qa", appointmentId, patientId, query: q },
      {
        onSuccess: (res) => {
          setMessages((m) => [...m, {
            id: uid(), role: "ai", text: res.text,
            meta: { intent: res.intent, tokens: res.tokens_in + res.tokens_out, cost: res.cost_usd, latencyMs: res.latency_ms },
          }]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err?.message || "Erro desconhecido";
          setMessages((m) => [...m, { id: uid(), role: "ai", text: "⚠️ " + msg }]);
        },
      }
    );
  }

  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: DentalColors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 9, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" }}>
          ✨ IA Aura · Haiku 4.5
        </Text>
      </View>

      <ScrollView ref={scrollRef} style={{
        flex: 1, backgroundColor: DentalColors.bg2,
        borderWidth: 1, borderColor: DentalColors.border, borderRadius: 8, padding: 8,
      }} contentContainerStyle={{ flexGrow: 1 }}>
        {messages.length === 0 ? (
          <Text style={{ fontSize: 11, color: DentalColors.ink3, fontStyle: "italic" }}>
            Pergunte algo à Aura sobre o paciente, protocolo, dosagem...
            {"\n"}Ex: "Posso usar epinefrina 1:200000 nesse paciente?"
          </Text>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={{
              marginBottom: 8, padding: 8, borderRadius: 6,
              backgroundColor: m.role === "user" ? DentalColors.surface : "rgba(124,58,237,0.06)",
              borderLeftWidth: 2, borderLeftColor: m.role === "user" ? DentalColors.cyan : DentalColors.violet,
            }}>
              <Text style={{
                fontSize: 8, fontWeight: "700", letterSpacing: 1, marginBottom: 3,
                color: m.role === "user" ? DentalColors.cyan : DentalColors.violet,
              }}>
                {m.role === "user" ? "VOCÊ" : `IA · ${m.meta?.intent || "qa"}`}
              </Text>
              <Text style={{ fontSize: 11, color: DentalColors.ink, lineHeight: 16 }}>{m.text}</Text>
              {m.meta?.cost != null ? (
                <Text style={{ fontSize: 8, color: DentalColors.ink3, marginTop: 4 }}>
                  {m.meta.tokens}tk · ${m.meta.cost.toFixed(5)} · {m.meta.latencyMs}ms
                </Text>
              ) : null}
            </View>
          ))
        )}
        {askMut.isPending ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 6 }}>
            <ActivityIndicator color={DentalColors.violet} size="small" />
            <Text style={{ fontSize: 10, color: DentalColors.ink3 }}>Aura pensando...</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder='Pergunte à Aura...'
          placeholderTextColor={DentalColors.ink3}
          editable={!askMut.isPending}
          onSubmitEditing={send}
          returnKeyType="send"
          style={{
            flex: 1, padding: 8, fontSize: 11, color: DentalColors.ink,
            backgroundColor: DentalColors.surface,
            borderWidth: 1, borderColor: DentalColors.border, borderRadius: 6,
          }}
        />
        <Pressable onPress={send} disabled={!input.trim() || askMut.isPending} style={{
          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
          backgroundColor: DentalColors.violet,
          opacity: !input.trim() || askMut.isPending ? 0.5 : 1,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Subcomponente de estado gated ───
function GatedView(props: {
  title: string; desc: string; icon: string;
  cta: string; onCta: () => void; ctaColor?: string;
  footer?: string;
}) {
  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: DentalColors.bg }}>
      <Text style={{
        fontSize: 9, color: DentalColors.ink3, fontWeight: "700",
        letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8,
      }}>
        ✨ IA AURA
      </Text>
      <View style={{
        flex: 1, backgroundColor: DentalColors.bg2,
        borderWidth: 1, borderColor: "rgba(124,58,237,0.30)",
        borderRadius: 10, padding: 16,
        alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <Text style={{ fontSize: 28 }}>{props.icon}</Text>
        <Text style={{ fontSize: 13, color: DentalColors.ink, fontWeight: "700", textAlign: "center" }}>
          {props.title}
        </Text>
        <Text style={{ fontSize: 11, color: DentalColors.ink2, textAlign: "center", lineHeight: 16, maxWidth: 320 }}>
          {props.desc}
        </Text>
        <Pressable onPress={props.onCta} style={{
          backgroundColor: props.ctaColor || DentalColors.violet,
          borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 6,
        }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{props.cta}</Text>
        </Pressable>
        {props.footer ? (
          <Text style={{ fontSize: 9, color: DentalColors.ink3, marginTop: 4 }}>{props.footer}</Text>
        ) : null}
      </View>
    </View>
  );
}
