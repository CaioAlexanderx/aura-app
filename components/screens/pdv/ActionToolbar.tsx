// ============================================================
// AURA. -- PDV/Caixa · Action Toolbar (5–6 cards)
// Scanner · Vendedora · Cliente · Cupom · Troca · [Crediário]
//
// 24/04 · theme-aware glass bg + dropdown z-index hardening.
// 05/05 · popover ganha minWidth 320 + right:0.
// 06/05 · scanner não fecha popover após bipe.
// 07/05 · ActTroca — 5º card, F5, sem popover.
// 07/05 · fix scanner: removido mousedown outside-click do ActBarcode.
// 11/05 · ActBarcode redesenhado — scanner GLOBAL, card vira indicador.
// 14/05 · ActCrediario — 6º card opcional (crediario_enabled), F6.
// 16/05 · COMPACT MODE em viewports estreitos (<960px).
// 17/05 · Threshold ajustado para <480px (só mobile portrait). Em viewports
//          médios (480-960px) o grid `auto-fit, minmax(140px, 1fr)` no
//          pdv.tsx quebra cards em 2 linhas automaticamente — não precisa
//          mais colapsar pro modo compact. Caso Davi 13/14".
// ============================================================
import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, TextInput, ActivityIndicator, useWindowDimensions } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly } from "./types";

// ─── Layout breakpoint ───────────────────────────────────────
// Apenas mobile portrait (<480px) colapsa pra icon+shortcut. Acima disso,
// o grid auto-fit do pdv.tsx faz wrap em múltiplas linhas mantendo cards
// horizontais completos com labels K/V legíveis.
function useCompactMode(): boolean {
  const { width } = useWindowDimensions();
  return width < 480;
}

// ─── Shared card shell ───────────────────────────────────────
function ActCard({
  active, empty, children, onClick, scanning, accent, compact,
}: {
  active?: boolean;
  empty?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  scanning?: boolean;
  accent?: string;
  compact?: boolean;
}) {
  const webBox = webOnly({
    background: active ? "rgba(124,58,237,0.14)" : Glass.card,
    border: active ? "1px solid rgba(124,58,237,0.45)" : "1px solid " + Glass.lineBorderCard,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: active ? "0 6px 18px -6px rgba(124,58,237,0.5)" : "none",
    overflow: "hidden",
    transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
    cursor: onClick ? "pointer" : "default",
  });
  return (
    <Pressable onPress={onClick}
      style={[s.actBtn, compact && s.actBtnCompact, active && s.actBtnActive,
              Platform.OS === "web" ? (webBox as any) : null] as any}>
      {IS_WEB && active && (
        <span aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent, " + (accent || "#7c3aed") + ", transparent)",
          pointerEvents: "none",
        } as any} />
      )}
      {IS_WEB && scanning && (
        <span aria-hidden style={{
          position: "absolute", left: 18, width: 20, top: "50%", height: 1.5,
          background: "linear-gradient(90deg, transparent, #34d399, transparent)",
          boxShadow: "0 0 8px #34d399",
          animation: "caixaScanLine 1.4s ease-in-out infinite",
          pointerEvents: "none",
        } as any} />
      )}
      {children}
    </Pressable>
  );
}

function ActBody({ k, v, isActive, isEmpty }: { k: string; v: string; isActive?: boolean; isEmpty?: boolean }) {
  return (
    <View style={s.actBody}>
      <Text style={s.actK} numberOfLines={1}>{k}</Text>
      <Text numberOfLines={1} style={[s.actV, isEmpty && { color: Colors.ink3, fontWeight: "500" }, isActive && { color: IS_DARK_MODE ? "#fff" : Colors.ink }]}>
        {v}
      </Text>
    </View>
  );
}

function ActIco({ active, children, compact }: { active?: boolean; children: React.ReactNode; compact?: boolean }) {
  const webBox = webOnly({
    background: active ? "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(109,40,217,0.2))" : Glass.lineFaint,
    border: active ? "1px solid rgba(167,139,250,0.35)" : "none",
  });
  return (
    <View style={[
      s.actIco,
      compact && s.actIcoCompact,
      Platform.OS === "web" ? (webBox as any) : { backgroundColor: active ? Colors.violetD : Glass.lineFaint }
    ] as any}>
      {children}
    </View>
  );
}

function Shortcut({ k, compact }: { k: string; compact?: boolean }) {
  return <Text style={[s.shortcut, compact && s.shortcutCompact]}>{k}</Text>;
}

// ═══════════ 1) Barcode scanner card ═══════════
export function ActBarcode({
  onScan, listening = true, lastCode = null,
}: {
  onScan: (code: string) => void;
  listening?: boolean;
  lastCode?: string | null;
}) {
  const compact = useCompactMode();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F1") { e.preventDefault(); setOpen(o => !o); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const manualInputRef = useRef<TextInput | null>(null);
  useEffect(() => {
    if (open && manualInputRef.current) {
      const t = setTimeout(() => {
        const el: any = manualInputRef.current;
        if (el && typeof el.focus === "function") el.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const showingLastCode = !!lastCode;
  const active = listening || showingLastCode;
  const wrapStyle: any = { position: "relative", zIndex: open ? 500 : 1 };

  const subtitle = showingLastCode ? lastCode!
    : listening ? "Escutando · pode bipar"
    : "Scanner pausado";

  function submitManual() {
    const code = manual.trim();
    if (!code) return;
    onScan(code); setManual(""); setOpen(false);
  }

  return (
    <View style={wrapStyle}>
      <ActCard active={active} empty={!active} scanning={showingLastCode} compact={compact}
        onClick={() => setOpen(o => !o)}>
        <ActIco active={active} compact={compact}>
          <Icon name="barcode" size={compact ? 20 : 18} color={active ? "#a78bfa" : Colors.ink3} />
          {IS_WEB && listening && !showingLastCode && (
            <span aria-hidden style={{
              position: "absolute", top: -2, right: -2,
              width: 8, height: 8, borderRadius: "50%",
              background: "#22c55e", boxShadow: "0 0 6px #22c55e",
              animation: "caixaPulse 1.6s ease-in-out infinite",
              pointerEvents: "none",
            } as any} />
          )}
        </ActIco>
        {!compact && <ActBody k="Scanner" v={subtitle} isActive={active} isEmpty={!active} />}
        <Shortcut k="F1" compact={compact} />
      </ActCard>
      {open && (
        <PopShell align="left">
          <View style={popS.scannerHeader}>
            <Text style={popS.title}>Entrada manual</Text>
            <Pressable onPress={() => setOpen(false)} style={popS.closeBtn}>
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>
          <Text style={popS.manualHint}>
            Scanner USB/Bluetooth funciona automaticamente — bipe a qualquer momento. Use este campo apenas para digitar um código manualmente.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              ref={manualInputRef} value={manual} onChangeText={setManual}
              onSubmitEditing={submitManual}
              placeholder="Digite o código…" placeholderTextColor={Colors.ink3}
              style={[popS.input, { flex: 1 }] as any} returnKeyType="search"
            />
            <Pressable onPress={submitManual} disabled={!manual.trim()}
              style={[popS.applyWide, !manual.trim() && { opacity: 0.5 }]}>
              <Text style={popS.applyWideTxt}>Adicionar</Text>
            </Pressable>
          </View>
        </PopShell>
      )}
    </View>
  );
}

// ═══════════ 2) Person picker (vendedora OR cliente) ═══════════
type PersonKind = "vendedora" | "cliente";

export function ActPerson({
  kind, shortcut, value, onChange, options,
  onAddNew, fallbackText, searchable, addable, disabled, disabledHint,
}: {
  kind: PersonKind;
  shortcut: string;
  value: { id: string; name: string; subtitle?: string } | null;
  onChange: (v: { id: string; name: string; subtitle?: string } | null) => void;
  options: { id: string; name: string; subtitle?: string }[];
  onAddNew?: () => void;
  fallbackText?: string;
  searchable?: boolean;
  addable?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const compact = useCompactMode();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [freeText, setFreeText] = useState("");
  const ref = useRef<any>(null);
  const label = kind === "vendedora" ? "Vendedora" : "Cliente";
  const placeholder = kind === "vendedora" ? "Selecionar vendedora" : "Vincular cliente";

  useEffect(() => {
    if (!IS_WEB) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === shortcut) {
        if (disabled) return;
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcut, disabled]);

  const active = !!value;
  const filtered = searchable && query.trim().length >= 1
    ? options.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : options.slice(0, 10);

  const wrapStyle: any = { position: "relative", opacity: disabled ? 0.5 : 1, zIndex: open ? 500 : 1 };

  return (
    <View style={wrapStyle} ref={ref as any}>
      <ActCard active={active} empty={!active} compact={compact}
        onClick={() => { if (disabled) return; setOpen(o => !o); }}>
        <ActIco active={active} compact={compact}>
          <Icon name={kind === "vendedora" ? "users" : "user_plus"} size={compact ? 20 : 18} color={active ? "#a78bfa" : Colors.ink3} />
        </ActIco>
        {!compact && (
          <ActBody k={label}
            v={disabled ? (disabledHint || placeholder) : value ? value.name : (fallbackText || placeholder)}
            isActive={active} isEmpty={!active} />
        )}
        <Shortcut k={shortcut} compact={compact} />
      </ActCard>

      {open && !disabled && (
        <PopShell align="left">
          <Text style={popS.title}>{kind === "vendedora" ? "Selecionar vendedora" : "Buscar cliente"}</Text>

          {searchable && (
            <TextInput autoFocus value={query} onChangeText={setQuery}
              placeholder={kind === "vendedora" ? "Digite o nome…" : "Nome ou telefone…"}
              placeholderTextColor={Colors.ink3} style={popS.input as any} />
          )}

          <View style={{ maxHeight: 240, overflow: IS_WEB ? ("auto" as any) : ("scroll" as any) }}>
            {filtered.length === 0 && (
              <Text style={{ padding: 12, fontSize: 11, color: Colors.ink3 }}>
                {options.length === 0 ? "Nenhum registro disponível" : "Nenhum resultado"}
              </Text>
            )}
            {filtered.map(opt => {
              const selected = value && value.id === opt.id;
              return (
                <Pressable key={opt.id}
                  onPress={() => { onChange({ id: opt.id, name: opt.name, subtitle: opt.subtitle }); setOpen(false); setQuery(""); }}
                  style={[popS.item, selected && popS.itemActive]}>
                  <View style={popS.avatar}>
                    <Text style={popS.avatarTxt}>
                      {opt.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={popS.itemName} numberOfLines={1}>{opt.name}</Text>
                    {opt.subtitle ? <Text style={popS.itemSub} numberOfLines={1}>{opt.subtitle}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {kind === "vendedora" && (
            <View style={{ borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.2)", paddingTop: 10, marginTop: 6 }}>
              <Text style={{ fontSize: 10, color: Colors.ink3, marginBottom: 4 }}>ou digite um nome livre:</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TextInput value={freeText} onChangeText={setFreeText}
                  placeholder="Nome da vendedora…" placeholderTextColor={Colors.ink3}
                  style={[popS.input, { flex: 1 }] as any}
                  onSubmitEditing={() => {
                    if (!freeText.trim()) return;
                    onChange({ id: "__free__" + freeText.trim(), name: freeText.trim() });
                    setFreeText(""); setOpen(false);
                  }} />
                <Pressable
                  onPress={() => {
                    if (!freeText.trim()) return;
                    onChange({ id: "__free__" + freeText.trim(), name: freeText.trim() });
                    setFreeText(""); setOpen(false);
                  }}
                  style={popS.applyBtn}>
                  <Icon name="check" size={14} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}

          {addable && onAddNew && (
            <Pressable onPress={() => { onAddNew(); setOpen(false); }} style={popS.addNew}>
              <View style={popS.addIco}>
                <Icon name="plus" size={14} color={Colors.violet3} />
              </View>
              <Text style={popS.addTxt}>Cadastrar novo cliente</Text>
            </Pressable>
          )}

          {value && (
            <Pressable onPress={() => { onChange(null); setOpen(false); }} style={popS.removeBtn}>
              <Text style={popS.removeTxt}>Remover {label.toLowerCase()}</Text>
            </Pressable>
          )}
        </PopShell>
      )}
    </View>
  );
}

// ═══════════ 3) Coupon input card ═══════════
export function ActCoupon({
  value, onChange, onValidate, loading,
}: {
  value: { code: string; discount: number } | null;
  onChange: (v: { code: string; discount: number } | null) => void;
  onValidate: (code: string) => Promise<{ ok: boolean; code?: string; discount?: number; error?: string }>;
  loading?: boolean;
}) {
  const compact = useCompactMode();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!IS_WEB) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setErr(""); }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F4") { e.preventDefault(); setOpen(o => !o); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true); setErr("");
    try {
      const res = await onValidate(code.trim().toUpperCase());
      if (res.ok && res.code) {
        onChange({ code: res.code, discount: res.discount || 0 });
        setOpen(false); setCode("");
      } else {
        setErr(res.error || "Código inválido ou expirado");
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao validar cupom");
    } finally { setBusy(false); }
  }

  const active = !!value;
  const wrapStyle: any = { position: "relative", zIndex: open ? 500 : 1 };

  return (
    <View style={wrapStyle} ref={ref as any}>
      <ActCard active={active} empty={!active} compact={compact} onClick={() => setOpen(o => !o)}>
        <ActIco active={active} compact={compact}>
          <Icon name="tag" size={compact ? 20 : 18} color={active ? "#a78bfa" : Colors.ink3} />
        </ActIco>
        {!compact && <ActBody k="Cupom" v={value ? value.code : "Inserir código"} isActive={active} isEmpty={!active} />}
        <Shortcut k="F4" compact={compact} />
      </ActCard>
      {open && (
        <PopShell align="right">
          <Text style={popS.title}>Aplicar cupom de desconto</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput autoFocus value={code}
              onChangeText={v => { setCode(v.toUpperCase()); setErr(""); }}
              placeholder="DIGITE O CÓDIGO" placeholderTextColor={Colors.ink3}
              style={[popS.input, { flex: 1, letterSpacing: 1.2 }] as any}
              onSubmitEditing={apply} autoCapitalize="characters" />
            <Pressable onPress={apply} disabled={busy || !code.trim()}
              style={[popS.applyWide, (!code.trim() || busy) && { opacity: 0.5 }]}>
              {busy || loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={popS.applyWideTxt}>Aplicar</Text>}
            </Pressable>
          </View>
          {err ? <Text style={[popS.hint, { color: Colors.red }]}>{err}</Text> : null}
          {value && (
            <Pressable onPress={() => { onChange(null); setOpen(false); }} style={popS.removeBtn}>
              <Text style={popS.removeTxt}>Remover cupom</Text>
            </Pressable>
          )}
        </PopShell>
      )}
    </View>
  );
}

// ═══════════ 4) Troca card ═══════════
export function ActTroca({ onOpen }: { onOpen: () => void }) {
  const compact = useCompactMode();
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F5") { e.preventDefault(); onOpen(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);

  return (
    <ActCard onClick={onOpen} compact={compact}>
      <ActIco compact={compact}>
        <Icon name="repeat" size={compact ? 20 : 18} color={Colors.ink3} />
      </ActIco>
      {!compact && <ActBody k="Troca" v="Iniciar troca" isEmpty />}
      <Shortcut k="F5" compact={compact} />
    </ActCard>
  );
}

// ═══════════ 5) Crediário parcelado card ═══════════
export function ActCrediario({
  onOpen, hasCustomer = false,
}: {
  onOpen: () => void;
  hasCustomer?: boolean;
}) {
  const compact = useCompactMode();
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F6") { e.preventDefault(); onOpen(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);

  return (
    <ActCard active={hasCustomer} onClick={onOpen} compact={compact}>
      <ActIco active={hasCustomer} compact={compact}>
        <Icon name="percent" size={compact ? 20 : 18} color={hasCustomer ? "#a78bfa" : Colors.ink3} />
      </ActIco>
      {!compact && (
        <ActBody k="Crediário"
          v={hasCustomer ? "Pronto para parcelar" : "Selecione um cliente"}
          isActive={hasCustomer} isEmpty={!hasCustomer} />
      )}
      <Shortcut k="F6" compact={compact} />
    </ActCard>
  );
}

// ─── Popover container ───────────────────────────────────────
function PopShell({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  const webBox = webOnly({
    background: Glass.pop,
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE
      ? "0 20px 40px -10px rgba(0,0,0,0.6)"
      : "0 20px 40px -10px rgba(124,58,237,0.25)",
    animation: "caixaFadeUp 0.2s cubic-bezier(0.4,0,0.2,1) both",
  });
  return (
    <View style={[
      popS.pop, align === "right" ? popS.popRight : popS.popLeft,
      Platform.OS === "web" ? (webBox as any) : { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2 },
    ]}>{children}</View>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  actBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, paddingHorizontal: 12,
    borderRadius: 12, position: "relative", minWidth: 0,
  },
  actBtnCompact: {
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 4, padding: 8, paddingHorizontal: 8,
    minWidth: 56, minHeight: 64,
  },
  actBtnActive: {
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
  },
  actIco: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, position: "relative",
  },
  actIcoCompact: {
    width: 36, height: 36, borderRadius: 10,
  },
  actBody: { flex: 1, minWidth: 0 },
  actK: {
    fontSize: 9, fontWeight: "700", color: Colors.ink3,
    letterSpacing: 1.1, textTransform: "uppercase", opacity: 0.85,
  },
  actV: {
    fontSize: 12, color: Colors.ink, fontWeight: "600", marginTop: 2,
  },
  shortcut: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" as any) : "monospace",
    fontSize: 9, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, backgroundColor: Glass.lineSoft, color: Colors.ink3,
    letterSpacing: 0.4, flexShrink: 0,
  },
  shortcutCompact: {
    fontSize: 10, paddingHorizontal: 6, paddingVertical: 2,
  },
});

const popS = StyleSheet.create({
  pop: {
    position: "absolute" as any, top: "100%" as any, marginTop: 8,
    padding: 14, borderRadius: 12, zIndex: 999, minWidth: 320, maxWidth: 420,
  },
  popLeft:  { left: 0 as any },
  popRight: { right: 0 as any },
  scannerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  closeBtn: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  manualHint: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 12 },
  title: { fontSize: 10, fontWeight: "700", color: Colors.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 0 },
  input: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: Glass.bgInput, borderWidth: 1, borderColor: Glass.bgInputBorder,
    color: Colors.ink, fontSize: 13, outlineStyle: "none", textTransform: "uppercase" as any,
  } as any,
  item:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 9, paddingHorizontal: 10, borderRadius: 8 },
  itemActive: { backgroundColor: "rgba(124,58,237,0.15)" },
  avatar:     { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarTxt:  { fontSize: 11, color: "#fff", fontWeight: "700" },
  itemName:   { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  itemSub:    { fontSize: 10, color: Colors.ink3, marginTop: 1, fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace" },
  applyBtn:   { width: 38, height: 38, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  applyWide:  { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.violet, justifyContent: "center", alignItems: "center", minWidth: 84 },
  applyWideTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  hint:       { fontSize: 10, color: Colors.ink3, marginTop: 8 },
  addNew:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.2)" },
  addIco:     { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(124,58,237,0.12)", borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(124,58,237,0.4)", alignItems: "center", justifyContent: "center" },
  addTxt:     { color: Colors.violet3, fontSize: 12, fontWeight: "600" },
  removeBtn:  { paddingVertical: 8, alignItems: "center", marginTop: 4 },
  removeTxt:  { color: Colors.red, fontSize: 11, fontWeight: "600" },
});

export default null;
