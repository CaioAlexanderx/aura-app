// ============================================================
// AURA. -- PDV/Caixa · Action Toolbar (4 cards)
// Scanner · Vendedora · Cliente · Cupom
// Each card follows the Claude Design "act-btn" pattern from the mockup.
// ============================================================
import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ScannerInput } from "@/components/ScannerInput";
import { IS_WEB, webOnly } from "./types";

// ─── Shared card shell ───────────────────────────────────────
function ActCard({
  active,
  empty,
  children,
  onClick,
  scanning,
  accent,
}: {
  active?: boolean;
  empty?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  scanning?: boolean;
  accent?: string;
}) {
  const webBox = webOnly({
    background: active ? "rgba(124,58,237,0.14)" : "rgba(14,18,40,0.55)",
    border: active ? "1px solid rgba(124,58,237,0.45)" : "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: active ? "0 6px 18px -6px rgba(124,58,237,0.5)" : "none",
    overflow: "hidden",
    transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
    cursor: onClick ? "pointer" : "default",
  });
  return (
    <Pressable onPress={onClick} style={[s.actBtn, active && s.actBtnActive, Platform.OS === "web" ? (webBox as any) : null] as any}>
      {IS_WEB && active && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, " + (accent || "#7c3aed") + ", transparent)",
            pointerEvents: "none",
          } as any}
        />
      )}
      {IS_WEB && scanning && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 18,
            width: 20,
            top: "50%",
            height: 1.5,
            background: "linear-gradient(90deg, transparent, #34d399, transparent)",
            boxShadow: "0 0 8px #34d399",
            animation: "caixaScanLine 1.4s ease-in-out infinite",
            pointerEvents: "none",
          } as any}
        />
      )}
      {children}
    </Pressable>
  );
}

function ActBody({ k, v, isActive, isEmpty }: { k: string; v: string; isActive?: boolean; isEmpty?: boolean }) {
  return (
    <View style={s.actBody}>
      <Text style={s.actK}>{k}</Text>
      <Text numberOfLines={1} style={[s.actV, isEmpty && { color: Colors.ink3, fontWeight: "500" }, isActive && { color: "#fff" }]}>
        {v}
      </Text>
    </View>
  );
}

function ActIco({ active, children }: { active?: boolean; children: React.ReactNode }) {
  const webBox = webOnly({
    background: active ? "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(109,40,217,0.2))" : "rgba(255,255,255,0.04)",
    border: active ? "1px solid rgba(167,139,250,0.35)" : "none",
  });
  return <View style={[s.actIco, Platform.OS === "web" ? (webBox as any) : { backgroundColor: active ? Colors.violetD : "rgba(255,255,255,0.04)" }] as any}>{children}</View>;
}

function Shortcut({ k }: { k: string }) {
  return <Text style={s.shortcut}>{k}</Text>;
}

// ═══════════ 1) Barcode scanner card ═══════════
export function ActBarcode({ onScan }: { onScan: (code: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!IS_WEB) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // F1 shortcut: toggle scanner popover
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F1") {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const active = !!lastCode || scanning;

  return (
    <View style={{ position: "relative" }} ref={ref as any}>
      <ActCard active={active} empty={!active} scanning={scanning} onClick={() => setOpen(o => !o)}>
        <ActIco active={active}>
          <Icon name="barcode" size={18} color={active ? "#a78bfa" : "#a0a0b8"} />
        </ActIco>
        <ActBody k="Leitor · código de barras" v={scanning ? "Escaneando…" : (lastCode || "Aponte ou digite")} isActive={active} isEmpty={!active} />
        <Shortcut k="F1" />
      </ActCard>
      {open && (
        <PopShell>
          <Text style={popS.title}>Bipar código de barras</Text>
          <ScannerInput
            placeholder="Bipe ou digite o código…"
            onScan={r => {
              setScanning(true);
              setLastCode(r.code);
              onScan(r.code);
              setTimeout(() => setScanning(false), 600);
              setOpen(false);
            }}
          />
        </PopShell>
      )}
    </View>
  );
}

// ═══════════ 2) Person picker (vendedora OR cliente) ═══════════
type PersonKind = "vendedora" | "cliente";

export function ActPerson({
  kind,
  shortcut,
  value,
  onChange,
  options,
  onAddNew,
  fallbackText,
  searchable,
  addable,
  disabled,
  disabledHint,
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

  return (
    <View style={{ position: "relative", opacity: disabled ? 0.5 : 1 }} ref={ref as any}>
      <ActCard
        active={active}
        empty={!active}
        onClick={() => {
          if (disabled) return;
          setOpen(o => !o);
        }}
      >
        <ActIco active={active}>
          <Icon name={kind === "vendedora" ? "users" : "user_plus"} size={18} color={active ? "#a78bfa" : "#a0a0b8"} />
        </ActIco>
        <ActBody
          k={label}
          v={disabled ? (disabledHint || placeholder) : value ? value.name : (fallbackText || placeholder)}
          isActive={active}
          isEmpty={!active}
        />
        <Shortcut k={shortcut} />
      </ActCard>

      {open && !disabled && (
        <PopShell>
          <Text style={popS.title}>{kind === "vendedora" ? "Selecionar vendedora" : "Buscar cliente"}</Text>

          {searchable && (
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={kind === "vendedora" ? "Digite o nome…" : "Nome ou telefone…"}
              placeholderTextColor={Colors.ink3}
              style={popS.input as any}
            />
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
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    onChange({ id: opt.id, name: opt.name, subtitle: opt.subtitle });
                    setOpen(false);
                    setQuery("");
                  }}
                  style={[popS.item, selected && popS.itemActive]}
                >
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
              <Text style={{ fontSize: 10, color: Colors.ink3, marginBottom: 4 }}>
                ou digite um nome livre:
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TextInput
                  value={freeText}
                  onChangeText={setFreeText}
                  placeholder="Nome da vendedora…"
                  placeholderTextColor={Colors.ink3}
                  style={[popS.input, { flex: 1 }] as any}
                  onSubmitEditing={() => {
                    if (!freeText.trim()) return;
                    onChange({ id: "__free__" + freeText.trim(), name: freeText.trim() });
                    setFreeText("");
                    setOpen(false);
                  }}
                />
                <Pressable
                  onPress={() => {
                    if (!freeText.trim()) return;
                    onChange({ id: "__free__" + freeText.trim(), name: freeText.trim() });
                    setFreeText("");
                    setOpen(false);
                  }}
                  style={popS.applyBtn}
                >
                  <Icon name="check" size={14} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}

          {addable && onAddNew && (
            <Pressable
              onPress={() => {
                onAddNew();
                setOpen(false);
              }}
              style={popS.addNew}
            >
              <View style={popS.addIco}>
                <Icon name="plus" size={14} color={Colors.violet3} />
              </View>
              <Text style={popS.addTxt}>Cadastrar novo cliente</Text>
            </Pressable>
          )}

          {value && (
            <Pressable
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
              style={popS.removeBtn}
            >
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
  value,
  onChange,
  onValidate,
  loading,
}: {
  value: { code: string; discount: number } | null;
  onChange: (v: { code: string; discount: number } | null) => void;
  onValidate: (code: string) => Promise<{ ok: boolean; code?: string; discount?: number; error?: string }>;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!IS_WEB) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setErr("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F4") {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const res = await onValidate(code.trim().toUpperCase());
      if (res.ok && res.code) {
        onChange({ code: res.code, discount: res.discount || 0 });
        setOpen(false);
        setCode("");
      } else {
        setErr(res.error || "Código inválido ou expirado");
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao validar cupom");
    } finally {
      setBusy(false);
    }
  }

  const active = !!value;

  return (
    <View style={{ position: "relative" }} ref={ref as any}>
      <ActCard active={active} empty={!active} onClick={() => setOpen(o => !o)}>
        <ActIco active={active}>
          <Icon name="tag" size={18} color={active ? "#a78bfa" : "#a0a0b8"} />
        </ActIco>
        <ActBody k="Cupom de desconto" v={value ? value.code : "Inserir código"} isActive={active} isEmpty={!active} />
        <Shortcut k="F4" />
      </ActCard>
      {open && (
        <PopShell>
          <Text style={popS.title}>Aplicar cupom de desconto</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              autoFocus
              value={code}
              onChangeText={v => {
                setCode(v.toUpperCase());
                setErr("");
              }}
              placeholder="DIGITE O CÓDIGO"
              placeholderTextColor={Colors.ink3}
              style={[popS.input, { flex: 1, letterSpacing: 1.2 }] as any}
              onSubmitEditing={apply}
              autoCapitalize="characters"
            />
            <Pressable onPress={apply} disabled={busy || !code.trim()} style={[popS.applyWide, (!code.trim() || busy) && { opacity: 0.5 }]}>
              {busy || loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={popS.applyWideTxt}>Aplicar</Text>}
            </Pressable>
          </View>
          {err ? <Text style={[popS.hint, { color: Colors.red }]}>{err}</Text> : null}
          {value && (
            <Pressable
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
              style={popS.removeBtn}
            >
              <Text style={popS.removeTxt}>Remover cupom</Text>
            </Pressable>
          )}
        </PopShell>
      )}
    </View>
  );
}

// ─── Popover container ───────────────────────────────────────
function PopShell({ children }: { children: React.ReactNode }) {
  const webBox = webOnly({
    background: "rgba(11,15,34,0.96)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6)",
    animation: "caixaFadeUp 0.2s cubic-bezier(0.4,0,0.2,1) both",
  });
  return (
    <View
      style={[
        popS.pop,
        Platform.OS === "web" ? (webBox as any) : { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2 },
      ]}
    >
      {children}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  actBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    position: "relative",
    minWidth: 0,
  },
  actBtnActive: {
    // handled by webBox on web, fallback for native
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  actIco: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actBody: { flex: 1, minWidth: 0 },
  actK: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(170,160,235,0.55)",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  actV: {
    fontSize: 13,
    color: Colors.ink,
    fontWeight: "600",
    marginTop: 2,
  },
  shortcut: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" as any) : "monospace",
    fontSize: 9,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "rgba(170,160,235,0.55)",
    letterSpacing: 0.4,
  },
});

const popS = StyleSheet.create({
  pop: {
    position: "absolute" as any,
    top: "100%" as any,
    left: 0 as any,
    right: 0 as any,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    zIndex: 20,
  },
  title: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(170,160,235,0.6)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(5,6,15,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    fontSize: 13,
    outlineStyle: "none",
    textTransform: "uppercase" as any,
  } as any,
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  itemActive: { backgroundColor: "rgba(124,58,237,0.15)" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarTxt: { fontSize: 11, color: "#fff", fontWeight: "700" },
  itemName: { fontSize: 13, color: "#fff", fontWeight: "600" },
  itemSub: {
    fontSize: 10,
    color: Colors.ink3,
    marginTop: 1,
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
  },
  applyBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  applyWide: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.violet,
    justifyContent: "center",
    alignItems: "center",
  },
  applyWideTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 8 },
  addNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.2)",
  },
  addIco: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(124,58,237,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTxt: { color: Colors.violet3, fontSize: 12, fontWeight: "600" },
  removeBtn: { paddingVertical: 8, alignItems: "center", marginTop: 4 },
  removeTxt: { color: Colors.red, fontSize: 11, fontWeight: "600" },
});

export default null;
