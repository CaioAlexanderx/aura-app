// ============================================================
// AURA. — W2-04: Modal de coleta de TCLE (template -> form -> assinatura)
//
// Maquina de estados em um unico modal:
//
//   pick    -> seleciona template (lista por categoria, system + custom)
//   fill    -> preenche placeholders dinamicos
//   sign    -> gera documento + token, mostra QR + WhatsApp + polling status
//   signed  -> sucesso, fecha em 2.5s
//   expired -> link expirou (10min), oferece gerar novo (volta pro fill)
//
// Reusa visual do SignatureRequestModal (W1-04) — mesma sheet bottom,
// header com x, footer com botao fechar/voltar.
//
// Endpoints:
//   GET  /companies/:cid/dental/consent/templates
//   POST /companies/:cid/dental/consent/documents
//   GET  /dental/consent/sign/:token/status (publico)
//
// Backend ja faz tudo: render markdown, gerar token, persistir IP+UA
// ao receber WS, transicionar pra signed. UI e thin layer.
// ============================================================

import { useEffect, useState, useRef, useMemo } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, ActivityIndicator,
  Image, Linking, Platform, ScrollView, TextInput,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";

// ── Types ─────────────────────────────────────────────────

interface Props {
  visible: boolean;
  patientId: string | null;
  patientName?: string;
  patientPhone?: string;
  appointmentId?: string | null;
  onClose: () => void;
  onSigned?: () => void;
}

interface ConsentTemplate {
  id: string;
  code: string;
  title: string;
  category: string;
  body_md: string;
  placeholders: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface ConsentDocument {
  id: string;
  token: string;
  expires_at?: string;
  token_expires_at: string;
  title: string;
  category: string;
  status: string;
}

interface CreateDocResponse {
  document: ConsentDocument;
  token: string;
  expires_at: string;
  expires_in: number;
  qr_payload: string;
}

interface StatusPayload {
  token: string;
  document_id: string;
  signed: boolean;
  signed_at: string | null;
  patient_connected: boolean;
  status: "signed" | "patient_connected" | "waiting" | "expired" | "void";
}

type Mode = "pick" | "fill" | "sign";

// ── Categoria -> label legivel + icone ────────────────────

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  cirurgia:    { label: "Cirurgia",       emoji: "🪥" },
  endodontia:  { label: "Endodontia",     emoji: "🦷" },
  implante:    { label: "Implante",       emoji: "🔩" },
  ortodontia:  { label: "Ortodontia",     emoji: "🪞" },
  estetica:    { label: "Estetica",       emoji: "✨" },
  periodontia: { label: "Periodontia",    emoji: "🌿" },
  protese:     { label: "Protese",        emoji: "👑" },
  generico:    { label: "Generico",       emoji: "📋" },
  lgpd:        { label: "LGPD / Imagem",  emoji: "🛡️" },
};

// ── Placeholder -> rotulo amigavel ────────────────────────

const PLACEHOLDER_LABELS: Record<string, { label: string; hint?: string; long?: boolean }> = {
  nome_paciente:    { label: "Nome do paciente",      hint: "Auto-preenchido do cadastro" },
  nome_dentista:    { label: "Nome do dentista",      hint: "Profissional responsavel" },
  cro:              { label: "CRO",                   hint: "Numero do registro" },
  dente:            { label: "Dente(s)",              hint: "Ex: 36, ou 16 e 17" },
  procedimento:     { label: "Procedimento",          hint: "Descricao curta" },
  data:             { label: "Data",                  hint: "Auto-preenchido (hoje)" },
  riscos:           { label: "Riscos especificos",    long: true, hint: "Riscos do caso (opcional)" },
  observacoes:      { label: "Observacoes",           long: true },
  valor_estimado:   { label: "Valor estimado (R$)",   hint: "Apenas numeros, ex: 1500" },
  nome_clinica:     { label: "Nome da clinica",       hint: "Auto-preenchido se vazio" },
};

const AUTO_FILLED = new Set(["nome_paciente", "data"]); // BE faz auto-fill

// ──────────────────────────────────────────────────────────

export function ConsentCollectModal({
  visible, patientId, patientName, patientPhone, appointmentId, onClose, onSigned,
}: Props) {
  const cid = useAuthStore().company?.id;
  const company = useAuthStore().company as any;

  const [mode, setMode] = useState<Mode>("pick");
  const [selectedTpl, setSelectedTpl] = useState<ConsentTemplate | null>(null);
  const [filled, setFilled] = useState<Record<string, string>>({});
  const [docData, setDocData] = useState<CreateDocResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(600);
  const [copied, setCopied] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset quando modal fecha ──
  useEffect(() => {
    if (!visible) {
      setMode("pick");
      setSelectedTpl(null);
      setFilled({});
      setDocData(null);
      setSecondsLeft(600);
      setCopied(false);
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    }
  }, [visible]);

  // ── Lista templates (carrega so quando modal abre em pick) ──
  const tplQuery = useQuery({
    queryKey: ["consent-templates", cid],
    queryFn: () =>
      request<{ total: number; templates: ConsentTemplate[] }>(
        `/companies/${cid}/dental/consent/templates`,
        { retry: 1 }
      ),
    enabled: !!cid && visible && mode === "pick",
    staleTime: 60000,
  });

  // ── Cria documento (gera token) ──
  const createMut = useMutation({
    mutationFn: () =>
      request<CreateDocResponse>(
        `/companies/${cid}/dental/consent/documents`,
        {
          method: "POST",
          body: {
            template_id: selectedTpl?.id,
            customer_id: patientId,
            placeholders_filled: filled,
            appointment_id: appointmentId || null,
          },
          retry: 0,
        }
      ),
    onSuccess: (data) => {
      setDocData(data);
      setSecondsLeft(data.expires_in || 600);
      setMode("sign");
    },
  });

  // ── Polling status (2s) quando em sign ──
  const statusQuery = useQuery({
    queryKey: ["consent-status", docData?.token],
    queryFn: () =>
      request<StatusPayload>(`/dental/consent/sign/${docData!.token}/status`, {
        token: null, retry: 0,
      }),
    enabled: !!docData?.token && visible && mode === "sign" && secondsLeft > 0,
    refetchInterval: 2000,
    staleTime: 0,
  });

  const status = statusQuery.data?.status || "waiting";
  const signed = statusQuery.data?.signed || false;

  // ── Countdown ──
  useEffect(() => {
    if (mode !== "sign" || !docData) return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [mode, docData]);

  // ── Auto-close apos assinar ──
  useEffect(() => {
    if (signed && !closeTimer.current) {
      onSigned?.();
      closeTimer.current = setTimeout(() => onClose(), 2500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed]);

  // ── Helpers ──
  function formatTimer(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function selectTemplate(tpl: ConsentTemplate) {
    setSelectedTpl(tpl);
    // Pre-preenche valores conhecidos
    const initial: Record<string, string> = {};
    if (patientName) initial.nome_paciente = patientName;
    if (company?.name || company?.legal_name || company?.trade_name) {
      initial.nome_clinica = company.trade_name || company.legal_name || company.name || "";
    }
    setFilled(initial);
    setMode("fill");
  }

  function backToPick() {
    setMode("pick");
    setSelectedTpl(null);
    setFilled({});
  }

  function backToFill() {
    setDocData(null);
    setMode("fill");
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  const url = docData?.qr_payload || "";
  const qrSrc = url
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=240x240&margin=10&bgcolor=ffffff&color=1e1e2e`
    : "";

  function handleCopy() {
    if (!url) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleWhatsApp() {
    if (!url || !selectedTpl) return;
    const greeting = patientName ? `, ${patientName}` : "";
    const msg = encodeURIComponent(
      `Ola${greeting}! Por favor leia e assine o termo de consentimento para "${selectedTpl.title}":\n\n${url}\n\nLink valido por 10 minutos.`
    );
    const phone = (patientPhone || "").replace(/\D/g, "");
    const wa = phone
      ? `https://wa.me/55${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    Linking.openURL(wa).catch(() => {});
  }

  // ── Templates agrupados por categoria ──
  const templates = tplQuery.data?.templates || [];
  const grouped = useMemo(() => {
    const g: Record<string, ConsentTemplate[]> = {};
    for (const t of templates) {
      if (!g[t.category]) g[t.category] = [];
      g[t.category].push(t);
    }
    return g;
  }, [templates]);

  // ── Validacao do form ──
  const requiredPlaceholders = useMemo(() => {
    if (!selectedTpl) return [];
    return selectedTpl.placeholders.filter(p => !AUTO_FILLED.has(p));
  }, [selectedTpl]);

  const formValid = useMemo(() => {
    if (!selectedTpl) return false;
    // Permite vazio em "riscos" e "observacoes" (sao opcionais)
    const optional = new Set(["riscos", "observacoes"]);
    return requiredPlaceholders.every(p =>
      optional.has(p) || (filled[p] && filled[p].trim().length > 0)
    );
  }, [selectedTpl, requiredPlaceholders, filled]);

  const expired = mode === "sign" && secondsLeft === 0 && !signed;

  // ────────────────────────────────────────────────────────
  // Render por modo
  // ────────────────────────────────────────────────────────

  function renderHeader() {
    let title = "Coletar TCLE";
    let sub = patientName ? `Paciente: ${patientName}` : "Termo de consentimento";

    if (mode === "fill" && selectedTpl) {
      title = selectedTpl.title;
      sub = "Preencha os campos abaixo";
    } else if (mode === "sign") {
      title = "Pronto pra assinar";
      sub = "Compartilhe o link com o paciente";
    }

    return (
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <Text style={s.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Icon name="x" size={20} color={Colors.ink3} />
        </Pressable>
      </View>
    );
  }

  function renderPick() {
    if (tplQuery.isLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator color={Colors.violet3} size="large" />
          <Text style={s.hint}>Carregando templates...</Text>
        </View>
      );
    }

    if (tplQuery.isError) {
      return (
        <View style={s.center}>
          <Icon name="alert" size={32} color="#EF4444" />
          <Text style={s.errText}>Nao foi possivel carregar os templates.</Text>
          <Pressable onPress={() => tplQuery.refetch()} style={[s.btn, s.btnPrimary, { marginTop: 12 }]}>
            <Text style={s.btnPrimaryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }

    const categories = Object.keys(grouped).sort();

    return (
      <View style={{ gap: 12 }}>
        <Text style={s.helperText}>
          Escolha um modelo. Voce podera personalizar antes de enviar pro paciente.
        </Text>
        {categories.map(cat => {
          const meta = CATEGORY_META[cat] || { label: cat, emoji: "📄" };
          const items = grouped[cat];
          return (
            <View key={cat}>
              <Text style={s.catLabel}>
                {meta.emoji}  {meta.label}
              </Text>
              {items.map(tpl => (
                <Pressable
                  key={tpl.id}
                  onPress={() => selectTemplate(tpl)}
                  style={s.tplCard}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.tplTitle}>{tpl.title}</Text>
                    <Text style={s.tplBadge}>
                      {tpl.is_system ? "Aura" : "Personalizado"}
                    </Text>
                  </View>
                  <Icon name="chevron_right" size={16} color={Colors.ink3} />
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    );
  }

  function renderFill() {
    if (!selectedTpl) return null;

    return (
      <View style={{ gap: 12 }}>
        <Text style={s.helperText}>
          Preencha os dados do termo. Campos marcados com * sao obrigatorios.
        </Text>

        {requiredPlaceholders.map(key => {
          const meta = PLACEHOLDER_LABELS[key] || { label: key };
          const isOptional = key === "riscos" || key === "observacoes";
          return (
            <View key={key} style={s.fieldGroup}>
              <Text style={s.fieldLabel}>
                {meta.label}{!isOptional && " *"}
              </Text>
              {meta.hint && <Text style={s.fieldHint}>{meta.hint}</Text>}
              <TextInput
                value={filled[key] || ""}
                onChangeText={(v) => setFilled(prev => ({ ...prev, [key]: v }))}
                style={[s.input, meta.long && s.inputLong]}
                multiline={meta.long}
                placeholder={isOptional ? "(opcional)" : ""}
                placeholderTextColor={Colors.ink3}
              />
            </View>
          );
        })}

        {createMut.isError && (
          <View style={s.errBox}>
            <Icon name="alert" size={14} color="#EF4444" />
            <Text style={s.errBoxText}>
              {(createMut.error as any)?.message || "Erro ao gerar documento"}
            </Text>
          </View>
        )}
      </View>
    );
  }

  function renderSign() {
    if (signed) {
      return (
        <View style={s.center}>
          <View style={s.successCircle}>
            <Icon name="check" size={32} color="#fff" />
          </View>
          <Text style={s.successTitle}>Termo assinado!</Text>
          <Text style={s.hint}>
            O documento foi salvo no historico do paciente.
          </Text>
        </View>
      );
    }

    if (expired) {
      return (
        <View style={s.center}>
          <Icon name="alert" size={32} color="#F59E0B" />
          <Text style={s.errText}>Link expirou sem ser usado.</Text>
          <Pressable onPress={backToFill} style={[s.btn, s.btnPrimary, { marginTop: 12 }]}>
            <Text style={s.btnPrimaryText}>Gerar novo link</Text>
          </Pressable>
        </View>
      );
    }

    if (!docData) return null;

    return (
      <View style={{ gap: 14 }}>
        {/* Status pill */}
        <View style={[s.statusBox, status === "patient_connected" && s.statusBoxActive]}>
          <View style={s.statusDot}>
            <View style={[s.dot, status === "patient_connected" && s.dotPulse]} />
          </View>
          <Text style={s.statusText}>
            {status === "patient_connected"
              ? "Paciente esta lendo o termo agora..."
              : "Aguardando paciente abrir o link..."}
          </Text>
        </View>

        {/* QR */}
        <View style={s.qrWrap}>
          {qrSrc ? <Image source={{ uri: qrSrc }} style={s.qr} resizeMode="contain" /> : null}
          <Text style={s.qrCaption}>
            Aponte a camera do paciente pra este codigo
          </Text>
        </View>

        {/* Timer */}
        <View style={s.timerRow}>
          <Icon name="clock" size={14} color={secondsLeft < 60 ? "#EF4444" : Colors.ink3} />
          <Text style={[s.timerText, secondsLeft < 60 && { color: "#EF4444", fontWeight: "700" }]}>
            Valido por {formatTimer(secondsLeft)}
          </Text>
        </View>

        {/* URL */}
        <View style={s.urlBox}>
          <Text style={s.urlText} numberOfLines={2} selectable>{url}</Text>
        </View>

        {/* Acoes */}
        <View style={s.actions}>
          <Pressable onPress={handleCopy} style={[s.btn, s.btnGhost]}>
            <Icon name="copy" size={14} color={Colors.ink} />
            <Text style={s.btnGhostText}>{copied ? "Copiado!" : "Copiar"}</Text>
          </Pressable>
          <Pressable onPress={handleWhatsApp} style={[s.btn, s.btnWhatsApp]}>
            <Icon name="message" size={14} color="#fff" />
            <Text style={s.btnPrimaryText}>WhatsApp</Text>
          </Pressable>
        </View>

        <Text style={s.note}>
          O paciente vai ler o termo, marcar a confirmacao LGPD e assinar com o dedo.
        </Text>
      </View>
    );
  }

  function renderFooter() {
    if (mode === "pick") {
      return (
        <View style={s.footer}>
          <Pressable onPress={onClose} style={[s.btn, s.btnClose]}>
            <Text style={s.btnGhostText}>Fechar</Text>
          </Pressable>
        </View>
      );
    }

    if (mode === "fill") {
      return (
        <View style={s.footerRow}>
          <Pressable onPress={backToPick} style={[s.btn, s.btnGhost, { flex: 0, paddingHorizontal: 16 }]}>
            <Icon name="arrow_left" size={14} color={Colors.ink} />
            <Text style={s.btnGhostText}>Voltar</Text>
          </Pressable>
          <Pressable
            onPress={() => createMut.mutate()}
            style={[s.btn, s.btnPrimary, !formValid && { opacity: 0.5 }]}
            disabled={!formValid || createMut.isPending}
          >
            {createMut.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={s.btnPrimaryText}>Gerar link de assinatura</Text>
                <Icon name="arrow_right" size={14} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      );
    }

    // mode === "sign"
    return (
      <View style={s.footer}>
        <Pressable onPress={onClose} style={[s.btn, s.btnClose]}>
          <Text style={s.btnGhostText}>{signed ? "Fechar" : "Fechar"}</Text>
        </Pressable>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {renderHeader()}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
            {mode === "pick" && renderPick()}
            {mode === "fill" && renderFill()}
            {mode === "sign" && renderSign()}
          </ScrollView>

          {renderFooter()}
        </View>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.bg2 || "#0f0f1e",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "92%",
    borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 3 },

  body: { padding: 18, paddingBottom: 26 },
  center: { alignItems: "center", paddingVertical: 28, gap: 10 },
  hint: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  errText: { fontSize: 13, color: Colors.ink, textAlign: "center", fontWeight: "500" },

  helperText: {
    fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 4,
  },

  // ── Pick ──
  catLabel: {
    fontSize: 11, color: Colors.violet3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.6,
    marginTop: 14, marginBottom: 6,
  },
  tplCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg3, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 6,
  },
  tplTitle: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  tplBadge: {
    fontSize: 10, color: Colors.ink3, marginTop: 2,
    textTransform: "uppercase", letterSpacing: 0.4, fontWeight: "600",
  },

  // ── Fill ──
  fieldGroup: { gap: 4, marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  fieldHint: { fontSize: 10, color: Colors.ink3, marginBottom: 4 },
  input: {
    backgroundColor: Colors.bg3, borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.ink, fontSize: 13,
  } as any,
  inputLong: { minHeight: 70, textAlignVertical: "top" } as any,

  errBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.3)", borderWidth: 1,
    borderRadius: 8, padding: 10,
  },
  errBoxText: { flex: 1, fontSize: 12, color: "#EF4444" },

  // ── Sign ──
  statusBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.bg3, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusBoxActive: {
    backgroundColor: "rgba(16,185,129,0.08)",
    borderColor: "rgba(16,185,129,0.4)",
  },
  statusDot: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  dotPulse: { backgroundColor: "#10B981" },
  statusText: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "500" },

  qrWrap: { alignItems: "center", paddingVertical: 8, gap: 8 },
  qr: { width: 240, height: 240, backgroundColor: "#fff", borderRadius: 12 },
  qrCaption: { fontSize: 11, color: Colors.ink3, textAlign: "center" },

  timerRow: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
  },
  timerText: { fontSize: 12, color: Colors.ink3 },

  urlBox: {
    backgroundColor: Colors.bg3, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  urlText: {
    fontSize: 11, color: "#06B6D4",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },

  actions: { flexDirection: "row", gap: 8 },
  note: {
    fontSize: 11, color: Colors.ink3, textAlign: "center",
    marginTop: 4, lineHeight: 16, fontStyle: "italic",
  },

  successCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
  },
  successTitle: { fontSize: 16, fontWeight: "700", color: "#10B981" },

  // ── Botoes ──
  btn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  btnPrimary: { backgroundColor: Colors.violet || "#6d28d9" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnGhost: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  btnWhatsApp: { backgroundColor: "#25D366" },
  btnClose: {
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: Colors.border,
  },

  footer: {
    padding: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  footerRow: {
    flexDirection: "row", gap: 8,
    padding: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
});

export default ConsentCollectModal;
