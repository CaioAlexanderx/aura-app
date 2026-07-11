// ============================================================
// AURA KARATÊ — Portal público do sensei (validação de quadro por token)
// URL: /karate/roster-update/:token
// Backend: GET  /public/roster-update/:token
//          POST /public/roster-update/:token
//          GET  /public/roster-update/:token/export (CSV)
//
// PÚBLICA — sem login, sem Authorization. O token opaco é a própria
// autenticação (karate_dojo_roster_validation) e é de USO ÚNICO: o POST
// expira o token no backend, então após confirmar não há como reenviar
// (um novo GET voltaria 410). Usa services/karatePublicApi.ts (mesmo
// fetch cru sem Bearer, padrão dos outros portais públicos do karatê).
//
// app/_layout.tsx precisa reconhecer segments[1]==="roster-update" como
// rota pública do karatê (bypass do AuthGuard) — ver onKaratePublic e
// onPublicMicrosite lá.
//
// ── Polish de apresentação (DESIGN — portal do sensei) ──────────────
// Superfície de maior impacto: primeira impressão da federação com o
// sensei. Só apresentação/motion — nenhuma mudança na lógica de dados,
// no fluxo do token de uso único ou nos estados 404/410/erro/confirmado.
// Apenas `Animated` do RN (sem novas deps); hover é aditivo e só-web
// (padrão components/Button.tsx); respeita prefers-reduced-motion no
// web (padrão components/karate/KarateLoginTransition.tsx).
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
  Linking,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts, KarateShadows, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Motion, webTransition } from "@/constants/motion";
import { BeltBadge } from "@/components/karate/BeltBadge";
import {
  karatePublicApi,
  RosterPractitioner,
  RosterUpdateInput,
  AddPractitionerInput,
} from "@/services/karatePublicApi";

const IS_WEB = Platform.OS === "web";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Faixas oferecidas no cadastro "Adicionar praticante" do portal do sensei.
// Faixas oferecidas no cadastro: todas as NÃO-legadas de KarateBelts.
// Hoje só a Vermelha é isLegacy=true — a Amarela é faixa ATUAL da FPKT e
// deve aparecer. Resultado: branca, amarela, laranja, verde, azul_claro, roxo,
// azul_escuro, marrom, preta.
const NON_LEGACY_BELT_KEYS: BeltKey[] = (Object.keys(KarateBelts) as BeltKey[]).filter(
  (k) => !KarateBelts[k].isLegacy
);

function prefersReducedMotion(): boolean {
  if (!IS_WEB || typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

// ── Botão "Confirmar quadro" — animado, self-contained ─────────────
// Réplica visual do KarateButton (variant="sumi", size="lg") com
// press-feedback (scale) + hover (só web). Local ao arquivo pra evitar
// mexer no componente compartilhado (fora do escopo do polish).
function ConfirmButton({
  label, onPress, loading, disabled, style,
}: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);
  const blocked = !!(disabled || loading);

  const to = (val: number, dur: number) =>
    Animated.timing(scale, { toValue: val, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

  return (
    <AnimatedPressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: !!loading }}
      onPressIn={() => to(0.98, 90)}
      onPressOut={() => to(1, Motion.fast + 40)}
      onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      style={[
        st.confirmBtn,
        { transform: [{ scale }] },
        hovered && !blocked && ({
          backgroundColor: P.ink2,
          ...(IS_WEB ? ({ boxShadow: "0 10px 28px -8px rgba(43,38,32,0.45)" } as any) : null),
        } as any),
        blocked && { opacity: 0.5 },
        IS_WEB ? (webTransition(["transform", "box-shadow", "background-color"], Motion.fast) as any) : null,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color="#fdf8f2" size="small" />
        : <Text style={st.confirmBtnText}>{label}</Text>}
    </AnimatedPressable>
  );
}

// ── Contador "X de Y ativos" com barra fina animada ─────────────────
function ActiveProgress({ active, total }: { active: number; total: number }) {
  const reduced = useMemo(prefersReducedMotion, []);
  const ratio = total > 0 ? active / total : 0;
  const barAnim = useRef(new Animated.Value(reduced ? ratio : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const firstRun = useRef(true);

  useEffect(() => {
    if (reduced) { barAnim.setValue(ratio); return; }
    Animated.timing(barAnim, { toValue: ratio, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (firstRun.current) { firstRun.current = false; return; }
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.14, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [ratio]);

  return (
    <View style={st.progressWrap}>
      <View style={st.progressRow}>
        <Text style={st.countLabel}>
          <Animated.Text style={{ transform: [{ scale: pulse }], color: P.ink2, fontWeight: "800" }}>
            {active}
          </Animated.Text>
          {" "}de {total} praticante{total !== 1 ? "s" : ""} ativo{active !== 1 ? "s" : ""}
        </Text>
      </View>
      <View style={st.progressTrack}>
        <Animated.View
          style={[
            st.progressFill,
            { width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
          ]}
        />
      </View>
    </View>
  );
}

// ── Linha de praticante — entrada com stagger, hover-lift (web),
//    tint animado ativo/inativo, cross-fade do rótulo ─────────────
function PractitionerRow({
  p, isActive, onToggle, index, disabled,
}: { p: RosterPractitioner; isActive: boolean; onToggle: () => void; index: number; disabled?: boolean }) {
  const reduced = useMemo(prefersReducedMotion, []);
  const entryOpacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const entryY = useRef(new Animated.Value(reduced ? 0 : 10)).current;
  const activeAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const [displayActive, setDisplayActive] = useState(isActive);
  const [hovered, setHovered] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (reduced) return;
    const delay = index < 12 ? index * 32 : 0;
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(entryY, { toValue: 0, duration: 300, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (reduced) { activeAnim.setValue(isActive ? 1 : 0); setDisplayActive(isActive); return; }
    Animated.timing(activeAnim, { toValue: isActive ? 1 : 0, duration: Motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.timing(labelOpacity, { toValue: 0, duration: 90, useNativeDriver: false }).start(() => {
      setDisplayActive(isActive);
      Animated.timing(labelOpacity, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });
  }, [isActive]);

  const tintBg = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [P.glass, "rgba(74,122,72,0.06)"] });
  const tintBorder = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [P.border, P.okLine] });

  return (
    <Animated.View style={{ opacity: entryOpacity, transform: [{ translateY: entryY }] }}>
      <Pressable
        onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
        onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      >
        <Animated.View
          style={[
            st.row,
            { backgroundColor: tintBg, borderColor: hovered ? P.primaryLine : tintBorder },
            hovered ? { transform: [{ translateY: -1 }], ...KarateShadows.sm } : null,
            IS_WEB ? (webTransition(["transform", "box-shadow", "border-color"], Motion.fast) as any) : null,
          ]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={st.rowName}>{p.name}</Text>
            <View style={st.rowMeta}>
              {p.karate_registration_number && (
                <Text style={st.rowReg}>Nº {p.karate_registration_number}</Text>
              )}
              <BeltBadge beltLevel={p.belt_name || ""} beltName={p.belt_name || undefined} />
            </View>
          </View>
          <View style={st.switchCol}>
            <Animated.Text
              style={[
                st.switchLabel,
                { color: displayActive ? P.ok : P.ink3, opacity: labelOpacity },
              ]}
            >
              {displayActive ? "Ativo" : "Inativo"}
            </Animated.Text>
            <Switch
              value={isActive}
              onValueChange={onToggle}
              disabled={disabled}
              trackColor={{ false: P.border, true: P.okSoft }}
              thumbColor={isActive ? P.ok : "#fff"}
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Campo com borda animada no foco (busca / nome) ──────────────────
function FocusField({
  icon, value, onChangeText, placeholder, style, inputStyle, accessibilityLabel,
}: {
  icon?: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  style?: any; inputStyle?: any; accessibilityLabel?: string;
}) {
  const focusAnim = useRef(new Animated.Value(0)).current;
  const onFocus = () => Animated.timing(focusAnim, { toValue: 1, duration: Motion.fast, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  const onBlur = () => Animated.timing(focusAnim, { toValue: 0, duration: Motion.fast, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [P.border, P.primary] });

  return (
    <Animated.View style={[style, { borderColor }, IS_WEB ? (webTransition(["border-color"], Motion.fast) as any) : null]}>
      {!!icon && <Icon name={icon} size={16} color={P.ink3} />}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={P.ink4}
        accessibilityLabel={accessibilityLabel}
        style={inputStyle}
      />
    </Animated.View>
  );
}

// ── "Adicionar praticante" — botão que abre o form inline ───────────
function AddPractitionerToggle({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Adicionar praticante"
      onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      style={[
        st.addToggleBtn,
        hovered && !disabled && ({ borderColor: P.primary, backgroundColor: P.primarySoft } as any),
        disabled && { opacity: 0.5 },
        IS_WEB ? (webTransition(["border-color", "background-color"], Motion.fast) as any) : null,
      ]}
    >
      <Icon name="person-add" size={16} color={P.primary} />
      <Text style={st.addToggleBtnText}>Adicionar praticante</Text>
    </Pressable>
  );
}

// ── Form "Adicionar praticante" — seção inline expansível ───────────
// Validação no cliente (nome + faixa + telefone-ou-e-mail), espelhando a
// validação do backend (POST /:token/practitioner) pra dar feedback
// imediato antes de bater na rede. Chips de faixa usam as cores canônicas
// de KarateBelts (mesma paleta do BeltBadge da lista), sem as legadas.
function AddPractitionerForm({
  onSubmit, onCancel, submitting, apiError,
}: {
  onSubmit: (input: AddPractitionerInput) => void;
  onCancel: () => void;
  submitting: boolean;
  apiError?: string | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [beltKey, setBeltKey] = useState<BeltKey | null>(null);
  const [touched, setTouched] = useState(false);

  const nameOk = !!name.trim();
  const beltOk = !!beltKey;
  const contactOk = !!(phone.trim() || email.trim());
  const valid = nameOk && beltOk && contactOk;

  function handleSubmit() {
    setTouched(true);
    if (!valid || submitting) return;
    const belt = beltKey ? KarateBelts[beltKey] : null;
    onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      belt_level: beltKey as string,
      belt_name: belt?.label || (beltKey as string),
    });
  }

  return (
    <View style={st.addCard}>
      <Text style={st.addCardTitle}>Novo praticante</Text>

      <Text style={st.fieldLabel}>Nome *</Text>
      <FocusField
        value={name}
        onChangeText={setName}
        placeholder="Nome completo do praticante"
        accessibilityLabel="Nome do novo praticante"
        style={st.textInputWrap}
        inputStyle={st.textInput}
      />
      {touched && !nameOk && <Text style={st.addFieldError}>Informe o nome do praticante.</Text>}

      <Text style={[st.fieldLabel, { marginTop: 12 }]}>Telefone</Text>
      <FocusField
        value={phone}
        onChangeText={setPhone}
        placeholder="(00) 00000-0000"
        accessibilityLabel="Telefone do novo praticante"
        style={st.textInputWrap}
        inputStyle={st.textInput}
      />

      <Text style={[st.fieldLabel, { marginTop: 12 }]}>E-mail</Text>
      <FocusField
        value={email}
        onChangeText={setEmail}
        placeholder="email@exemplo.com"
        accessibilityLabel="E-mail do novo praticante"
        style={st.textInputWrap}
        inputStyle={st.textInput}
      />
      {touched && !contactOk && (
        <Text style={st.addFieldError}>Informe pelo menos um contato (telefone ou e-mail).</Text>
      )}

      <Text style={[st.fieldLabel, { marginTop: 12 }]}>Faixa *</Text>
      <View style={st.beltChipsRow}>
        {NON_LEGACY_BELT_KEYS.map((key) => {
          const belt = KarateBelts[key];
          const selected = beltKey === key;
          return (
            <Pressable
              key={key}
              onPress={() => setBeltKey(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Faixa ${belt.label}`}
              style={[
                st.beltChip,
                { backgroundColor: belt.color, borderColor: selected ? P.ink : "rgba(0,0,0,0.12)" },
                selected && st.beltChipSelected,
              ]}
            >
              <Text style={[st.beltChipLabel, { color: belt.textColor }]}>{belt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {touched && !beltOk && <Text style={st.addFieldError}>Selecione a faixa do praticante.</Text>}

      {!!apiError && <Text style={st.submitError}>{apiError}</Text>}

      <View style={st.addFormActions}>
        <Pressable
          onPress={submitting ? undefined : onCancel}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Cancelar cadastro de praticante"
          style={[st.addCancelBtn, submitting && { opacity: 0.5 }]}
        >
          <Text style={st.addCancelBtnText}>Cancelar</Text>
        </Pressable>
        <ConfirmButton
          label={submitting ? "Adicionando..." : "Adicionar"}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || (touched && !valid)}
          style={st.addSubmitBtn}
        />
      </View>
    </View>
  );
}

export default function RosterUpdatePortalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = Array.isArray(token) ? token[0] : token || "";

  const [search, setSearch] = useState("");
  const [activeMap, setActiveMap] = useState<Record<string, boolean> | null>(null);
  const [validatedBy, setValidatedBy] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Praticantes cadastrados pelo sensei nesta sessão do portal (POST
  // /:token/practitioner). Somados aos do GET original — o token NÃO é
  // consumido por esse POST, então o sensei pode adicionar vários antes
  // de confirmar o quadro no final.
  const [addedPracticantes, setAddedPracticantes] = useState<RosterPractitioner[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const addFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (addFeedbackTimer.current) clearTimeout(addFeedbackTimer.current);
  }, []);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["karate-roster-update", tokenStr],
    queryFn: () => karatePublicApi.getPublicRoster(tokenStr),
    enabled: !!tokenStr,
    retry: 1,
    staleTime: Infinity, // token de uso único — não faz sentido refazer o GET sozinho
  });

  // Inicializa o mapa de is_active local UMA vez, a partir do valor atual
  // do backend. Depois disso, edições do sensei (toggle) vivem só aqui —
  // não sobrescrevemos com refetch (staleTime:Infinity evita isso também).
  useEffect(() => {
    if (data?.praticantes && activeMap === null) {
      const map: Record<string, boolean> = {};
      for (const p of data.praticantes) map[p.id] = p.is_active;
      setActiveMap(map);
    }
  }, [data, activeMap]);

  const submitMut = useMutation({
    mutationFn: () => {
      const praticantes = [...(data?.praticantes || []), ...addedPracticantes];
      const updates: RosterUpdateInput[] = praticantes.map((p) => ({
        student_id: p.id,
        is_active: activeMap?.[p.id] ?? p.is_active,
      }));
      return karatePublicApi.submitPublicRoster(tokenStr, updates, validatedBy.trim() || undefined);
    },
    onSuccess: () => setConfirmed(true),
  });

  const addMut = useMutation({
    mutationFn: (input: AddPractitionerInput) => karatePublicApi.addPublicPractitioner(tokenStr, input),
    onSuccess: (created) => {
      const newPractitioner: RosterPractitioner = {
        id: created.id,
        name: created.name,
        karate_registration_number: created.karate_registration_number,
        belt_name: created.belt_name,
        is_active: true,
      };
      // Anexa à lista local + já marca ativo no mapa de toggles, refletindo
      // no contador (ActiveProgress) e na linha da lista imediatamente.
      setAddedPracticantes((prev) => [...prev, newPractitioner]);
      setActiveMap((prev) => ({ ...(prev || {}), [newPractitioner.id]: true }));
      setShowAddForm(false);
      setAddFeedback(`${newPractitioner.name} foi adicionado ao quadro.`);
      if (addFeedbackTimer.current) clearTimeout(addFeedbackTimer.current);
      addFeedbackTimer.current = setTimeout(() => setAddFeedback(null), 4000);
    },
  });

  const praticantes: RosterPractitioner[] = [...(data?.praticantes || []), ...addedPracticantes];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return praticantes;
    return praticantes.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.karate_registration_number?.toLowerCase().includes(q)
    );
  }, [praticantes, search]);

  function toggleActive(id: string) {
    if (confirmed) return;
    setActiveMap((prev) => ({ ...(prev || {}), [id]: !(prev?.[id] ?? true) }));
  }

  function handleDownloadCsv() {
    const url = karatePublicApi.getRosterExportUrl(tokenStr);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }

  const activeCount = activeMap ? Object.values(activeMap).filter(Boolean).length : 0;

  // ── Fase da tela (loading / error / confirmed / form) — usada só
  // pra orquestrar as animações de entrada, nada de lógica de dados ──
  const phase: "loading" | "error" | "confirmed" | "form" =
    isLoading ? "loading" : error ? "error" : confirmed ? "confirmed" : "form";

  const reduced = useMemo(prefersReducedMotion, []);

  // Entrada da página (fade + slide-up) — replica a cada troca de fase,
  // dando sensação de "transição de página" entre loading → form/erro
  // e form → confirmado.
  const pageOpacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const pageY = useRef(new Animated.Value(reduced ? 0 : 14)).current;

  // Glyph (ícone de estado) — scale-in ao entrar em erro/confirmado.
  const glyphScale = useRef(new Animated.Value(reduced ? 1 : 0.5)).current;
  // Anel de destaque do sucesso — expande e desvanece uma única vez.
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  // Filete sob o nome do dojô — cresce a partir do centro.
  const ruleWidth = useRef(new Animated.Value(reduced ? 40 : 0)).current;

  useEffect(() => {
    if (phase === "loading") return;

    if (reduced) {
      pageOpacity.setValue(1);
      pageY.setValue(0);
      glyphScale.setValue(1);
      ruleWidth.setValue(40);
      return;
    }

    pageOpacity.setValue(0);
    pageY.setValue(14);
    Animated.parallel([
      Animated.timing(pageOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(pageY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    if (phase === "error" || phase === "confirmed") {
      glyphScale.setValue(0.5);
      if (phase === "confirmed") {
        Animated.spring(glyphScale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: false }).start();
        ringScale.setValue(1);
        ringOpacity.setValue(0.35);
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.8, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]).start();
      } else {
        Animated.timing(glyphScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      }
    }

    if (phase === "form") {
      Animated.timing(ruleWidth, { toValue: 40, duration: 320, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={st.page}>
        <View style={st.loaderBox}>
          <ActivityIndicator color={P.primary} size="large" />
        </View>
      </View>
    );
  }

  // ── Token inválido / expirado / erro genérico ───────────
  if (error) {
    const status = (error as any)?.status;
    const isExpired = status === 410;
    const isInvalid = status === 404;
    return (
      <View style={st.page}>
        <Animated.View style={[st.errorWrap, { opacity: pageOpacity, transform: [{ translateY: pageY }] }]}>
          <Animated.View style={[st.glyph, { backgroundColor: isExpired ? P.warnSoft : P.dangerSoft, transform: [{ scale: glyphScale }] }]}>
            <Icon name={isExpired ? "clock" : "alert-circle"} size={26} color={isExpired ? P.warn : P.danger} />
          </Animated.View>
          <Text style={st.errorTitle}>
            {isExpired ? "Este link expirou" : isInvalid ? "Link inválido" : "Não foi possível carregar"}
          </Text>
          <Text style={st.errorText}>
            {isExpired
              ? "Este link expirou. Peça um novo à federação para atualizar o quadro do seu dojô."
              : isInvalid
              ? "Este link não é válido. Verifique se o endereço foi copiado corretamente ou peça um novo à federação."
              : "Ocorreu um erro ao carregar os dados do seu dojô. Verifique sua conexão e tente novamente."}
          </Text>
          {!isExpired && !isInvalid && (
            <RetryButton onPress={() => refetch()} loading={isRefetching} />
          )}
        </Animated.View>
      </View>
    );
  }

  // ── Confirmação (pós-submit) ─────────────────────────────
  if (confirmed) {
    const applied = submitMut.data?.applied?.length ?? 0;
    return (
      <View style={st.page}>
        <Animated.View style={[st.errorWrap, { opacity: pageOpacity, transform: [{ translateY: pageY }] }]}>
          <View style={st.successGlyphWrap}>
            <Animated.View
              pointerEvents="none"
              style={[st.successRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
            <Animated.View style={[st.glyph, { backgroundColor: P.okSoft, transform: [{ scale: glyphScale }] }]}>
              <Icon name="checkmark-circle" size={26} color={P.ok} />
            </Animated.View>
          </View>
          <Text style={st.errorTitle}>Quadro confirmado, obrigado!</Text>
          <Text style={st.errorText}>
            {applied > 0
              ? `Atualizamos a situação de ${applied} praticante${applied > 1 ? "s" : ""} do ${data?.dojo_nome || "seu dojô"}.`
              : `O quadro do ${data?.dojo_nome || "seu dojô"} foi confirmado sem alterações.`}
            {"\n"}Este link já foi utilizado e não pode ser reenviado.
          </Text>
        </Animated.View>
      </View>
    );
  }

  // ── Formulário principal ─────────────────────────────────
  return (
    <ScrollView style={st.page} contentContainerStyle={st.content}>
      <Animated.View style={{ opacity: pageOpacity, transform: [{ translateY: pageY }] }}>
        <View style={st.header}>
          <Text style={st.eyebrow}>Portal do sensei</Text>
          <Text style={st.dojoName}>{data?.dojo_nome || "Seu dojô"}</Text>
          <Animated.View style={[st.headerRule, { width: ruleWidth }]} />
          <Text style={st.subtitle}>Confirme quem está ativo no seu dojô.</Text>
        </View>

        <FocusField
          icon="search"
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou registro"
          accessibilityLabel="Buscar praticante por nome ou registro"
          style={st.searchBox}
          inputStyle={st.searchInput}
        />

        <ActiveProgress active={activeCount} total={praticantes.length} />

        {addFeedback && (
          <View style={st.addFeedbackBanner}>
            <Icon name="checkmark-circle" size={16} color={P.ok} />
            <Text style={st.addFeedbackText}>{addFeedback}</Text>
          </View>
        )}

        {showAddForm ? (
          <AddPractitionerForm
            submitting={addMut.isPending}
            apiError={addMut.isError ? ((addMut.error as any)?.message || "Erro ao adicionar praticante. Tente novamente.") : null}
            onSubmit={(input) => addMut.mutate(input)}
            onCancel={() => { setShowAddForm(false); addMut.reset(); }}
          />
        ) : (
          <AddPractitionerToggle
            disabled={submitMut.isPending}
            onPress={() => { addMut.reset(); setAddFeedback(null); setShowAddForm(true); }}
          />
        )}

        {filtered.length === 0 ? (
          <View style={st.emptyCard}>
            <Text style={st.emptyText}>Nenhum praticante encontrado.</Text>
          </View>
        ) : (
          filtered.map((p, index) => {
            const isActive = activeMap?.[p.id] ?? p.is_active;
            return (
              <PractitionerRow
                key={p.id}
                p={p}
                isActive={isActive}
                onToggle={() => toggleActive(p.id)}
                index={index}
              />
            );
          })
        )}

        <View style={st.footerCard}>
          <Text style={st.fieldLabel}>Seu nome</Text>
          <FocusField
            value={validatedBy}
            onChangeText={setValidatedBy}
            placeholder="Quem está confirmando o quadro"
            accessibilityLabel="Seu nome, para registro da confirmação"
            style={st.textInputWrap}
            inputStyle={st.textInput}
          />

          {submitMut.isError && (
            <Text style={st.submitError}>
              {(submitMut.error as any)?.message || "Erro ao confirmar o quadro. Tente novamente."}
            </Text>
          )}

          <ConfirmButton
            label={submitMut.isPending ? "Confirmando..." : "Confirmar quadro"}
            onPress={() => submitMut.mutate()}
            loading={submitMut.isPending}
            disabled={submitMut.isPending || praticantes.length === 0}
            style={{ marginTop: 12 }}
          />

          <DownloadCsvButton onPress={handleDownloadCsv} />
        </View>

        <View style={st.footer}>
          <Text style={st.footerText}>Portal do sensei · Aura Karatê</Text>
          <Text style={st.footerTextSmall}>Em caso de dúvidas, entre em contato com a federação.</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ── "Tentar novamente" — hover só web ───────────────────────────────
function RetryButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Tentar novamente"
      onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      style={[
        st.retryBtn,
        hovered && !loading && ({ backgroundColor: P.ink2 } as any),
        IS_WEB ? (webTransition(["background-color"], Motion.fast) as any) : null,
      ]}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={st.retryBtnText}>Tentar novamente</Text>}
    </Pressable>
  );
}

// ── "Baixar planilha (CSV)" — hover só web ──────────────────────────
function DownloadCsvButton({ onPress }: { onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Baixar planilha CSV"
      onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      style={[
        st.csvBtn,
        hovered && ({ opacity: 0.72 } as any),
        IS_WEB ? (webTransition(["opacity"], Motion.fast) as any) : null,
      ]}
    >
      <Icon name="download" size={16} color={P.primary} />
      <Text style={st.csvBtnText}>Baixar planilha (CSV)</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.bg },
  content: { padding: 20, paddingTop: 32, paddingBottom: 56, maxWidth: 640, alignSelf: "center", width: "100%" },

  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 60 },

  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60, paddingHorizontal: 24, maxWidth: 440, alignSelf: "center" },
  glyph: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  successGlyphWrap: { alignItems: "center", justifyContent: "center" },
  successRing: { position: "absolute", width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: P.ok },
  errorTitle: { fontFamily: KarateFonts.heading, fontSize: 20, color: P.ink, textAlign: "center" },
  errorText: { fontSize: 13, color: P.ink3, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: P.ink, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  retryBtnText: { color: "#fdf8f2", fontSize: 14, fontWeight: "700" },

  header: { alignItems: "center", paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: P.border, marginBottom: 22 },
  eyebrow: { fontSize: 11, color: P.primary, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  dojoName: { fontFamily: KarateFonts.heading, fontSize: 26, color: P.ink, marginTop: 9, textAlign: "center" },
  headerRule: { height: 2, borderRadius: 1, backgroundColor: P.primary, marginTop: 12, alignSelf: "center" },
  subtitle: { fontSize: 13, color: P.ink3, marginTop: 12, textAlign: "center" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },

  progressWrap: { marginBottom: 14, gap: 6 },
  progressRow: { flexDirection: "row", alignItems: "center" },
  countLabel: { fontSize: 11.5, color: P.ink3, fontWeight: "600" },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: P.border, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: P.ok },

  emptyCard: { backgroundColor: P.glass, borderRadius: KarateRadius.md, padding: 20, borderWidth: 1, borderColor: P.border, alignItems: "center" },
  emptyText: { fontSize: 13, color: P.ink3 },

  addFeedbackBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.okSoft, borderWidth: 1, borderColor: P.okLine, borderRadius: KarateRadius.md, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  addFeedbackText: { fontSize: 12.5, color: P.ink, fontWeight: "600", flex: 1 },

  addToggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.md, backgroundColor: P.glass, paddingVertical: 12, marginBottom: 14 },
  addToggleBtnText: { fontSize: 13.5, fontWeight: "700", color: P.primary },

  addCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 16, marginBottom: 14 },
  addCardTitle: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink, marginBottom: 12 },
  addFieldError: { fontSize: 11.5, color: P.danger, marginTop: 6 },

  beltChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  beltChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1 },
  beltChipSelected: { borderWidth: 2, ...KarateShadows.sm },
  beltChipLabel: { fontSize: 12.5, fontWeight: "700" },

  addFormActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  addCancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  addCancelBtnText: { fontSize: 13.5, fontWeight: "700", color: P.ink3 },
  addSubmitBtn: { paddingVertical: 12, paddingHorizontal: 22 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: KarateRadius.md, borderWidth: 1, padding: 14, marginBottom: 8 },
  rowName: { fontSize: 14.5, fontWeight: "700", color: P.ink },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rowReg: { fontFamily: KarateFonts.mono, fontSize: 11.5, color: P.ink3 },
  switchCol: { alignItems: "center", gap: 4 },
  switchLabel: { fontSize: 10.5, fontWeight: "700" },

  footerCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 16, marginTop: 16 },
  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: P.ink2, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  textInputWrap: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm },
  textInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },
  submitError: { fontSize: 12, color: P.danger, marginTop: 10, textAlign: "center" },

  confirmBtn: { borderRadius: KarateRadius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", backgroundColor: P.ink, paddingVertical: 14, paddingHorizontal: 28 },
  confirmBtnText: { fontWeight: "700", letterSpacing: 0.2, color: "#fdf8f2", fontSize: 17 },

  csvBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, marginTop: 10 },
  csvBtnText: { fontSize: 13, fontWeight: "700", color: P.primary },

  footer: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: P.border, alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, color: P.ink3, fontWeight: "600" },
  footerTextSmall: { fontSize: 10, color: P.ink4, textAlign: "center", maxWidth: 320 },
});
