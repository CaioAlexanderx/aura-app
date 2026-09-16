// ============================================================
// AURA. -- PDV/Caixa · Barra de ações
// Cliente · Vendedora · Cupom · Troca ou devolução · [Crediário]
//
// 24/04 · theme-aware glass bg + dropdown z-index hardening.
// 05/05 · popover ganha minWidth 320 + right:0.
// 06/05 · scanner não fecha popover após bipe.
// 07/05 · ActTroca — 5º card, F5, sem popover.
// 07/05 · fix scanner: removido mousedown outside-click do ActBarcode.
// 11/05 · ActBarcode redesenhado — scanner GLOBAL, card vira indicador.
// 14/05 · ActCrediario — 6º card opcional (crediario_enabled), F6.
// 16/05 · COMPACT MODE em viewports estreitos (<960px).
// 17/05 · Threshold ajustado para <480px (só mobile portrait).
// 13/06 · ActTroca: label "Trocar" → "Trocar / Devolver".
// 29/08 · ActPerson vira forwardRef e expõe `open()` (PersonPickerHandle) —
//          é o mesmo popover de sempre, só com um jeito do rodapé do carrinho
//          pedir a abertura. Sem isso os avisos "Cliente obrigatório" /
//          "Vendedora obrigatória" continuariam sendo texto morto.
// 29/08 · ActPerson ganha `recentCount`: com a busca vazia, os N primeiros
//          options entram sob "Atendidos recentemente" e o resto sob
//          "Todos os clientes". A ordenação em si vem pronta do usePdvState.
//
// 16/09/2026 (Fase 0 · I0.3) — os cards viram BOTÕES DE TEXTO:
//   - Os cards de 52px tinham ícone grande + rótulo em duas linhas e
//     truncavam em qualquer viewport real ("Selecionar vended…",
//     "Iniciar troca ou dev…"). Pior: o Caio, que conhece o app de cor, não
//     distinguia um ícone do outro — pro lojista era ainda pior.
//   - Agora cada ação é um botão de 40px escrito por extenso, com largura
//     natural (nada de grid de colunas iguais, que era a origem do truncamento)
//     e o atalho F2–F5 ao lado.
//   - O que é obrigatório pela política do Caixa ganha um ponto âmbar até ser
//     preenchido; depois o botão passa a mostrar o valor ("Cliente: Simone").
//   - O leitor de código sai da barra: o estado virou chip na linha da busca
//     (ScannerStatusChip) e sobra aqui só o acesso discreto à digitação manual.
//   - Mobile: Cliente, Vendedora e "Mais…" — Cupom e Troca moram no Mais.
// ============================================================
import { useState, useRef, useEffect, forwardRef, useImperativeHandle, Fragment } from "react";
import { View, Text, Pressable, StyleSheet, Platform, TextInput, ActivityIndicator } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly } from "./types";

// ─── Rótulos ─────────────────────────────────────────────────
// `curto` é o que aparece escrito no botão (largura natural, nunca trunca);
// `longo` é a frase inteira, que vai pro accessibilityLabel e pro tooltip.
export const ACT_LABELS = {
  cliente:   { curto: "Cliente",             longo: "Vincular cliente à venda" },
  vendedora: { curto: "Vendedora",           longo: "Selecionar a vendedora da venda" },
  cupom:     { curto: "Cupom",               longo: "Aplicar cupom de desconto" },
  troca:     { curto: "Troca ou devolução",  longo: "Iniciar uma troca ou devolução" },
  crediario: { curto: "Crediário",           longo: "Parcelar a venda no crediário" },
  leitor:    { curto: "Digitar código",      longo: "Digitar um código de barras à mão (o leitor USB/Bluetooth continua ativo)" },
  mais:      { curto: "Mais…",               longo: "Mais ações do caixa: cupom e troca ou devolução" },
} as const;

/** Botão preenchido mostra o valor: "Cliente: Simone". Vazio, só o rótulo. */
export function rotuloDoBotao(rotulo: string, valor?: string | null): string {
  const v = String(valor || "").trim();
  return v ? rotulo + ": " + v : rotulo;
}

/** Texto lido por leitor de tela / tooltip: frase inteira + atalho. */
export function a11yDoBotao(longo: string, atalho?: string | null, valor?: string | null): string {
  const v = String(valor || "").trim();
  const base = v ? longo + ". Agora: " + v : longo;
  return atalho ? base + " (" + atalho + ")" : base;
}

// ─── Shell do botão de texto ─────────────────────────────────
function ActBtn({
  rotulo, valor, pendente, atalho, onClick, disabled, a11y, ativo, discreto,
}: {
  rotulo: string;
  valor?: string | null;
  /** Obrigatório pela política do Caixa e ainda vazio → ponto âmbar. */
  pendente?: boolean;
  atalho?: string | null;
  onClick?: () => void;
  disabled?: boolean;
  a11y: string;
  ativo?: boolean;
  /** Ação secundária (entrada manual do leitor): sem preenchimento. */
  discreto?: boolean;
}) {
  const temValor = !!String(valor || "").trim();
  const webBox = webOnly({
    background: discreto ? "transparent" : ativo || temValor ? "rgba(124,58,237,0.14)" : Glass.card,
    border: "1px solid " + (discreto ? Glass.lineFaint : ativo || temValor ? "rgba(124,58,237,0.45)" : Glass.lineBorderCard),
    backdropFilter: discreto ? "none" : "blur(10px)",
    WebkitBackdropFilter: discreto ? "none" : "blur(10px)",
    transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <Pressable
      onPress={() => { if (!disabled && onClick) onClick(); }}
      accessibilityLabel={a11y}
      accessibilityRole="button"
      // RNW repassa className; a regra @media (hover: none) que neutraliza o
      // realce de hover em touch vive no CaixaDesignStyle (regra 7 do CLAUDE.md).
      {...(IS_WEB ? ({ className: "caixa-chip" } as any) : {})}
      style={[
        s.btn,
        disabled && s.btnDisabled,
        Platform.OS === "web"
          ? (webBox as any)
          : { backgroundColor: temValor ? Colors.violetD : Colors.bg3, borderWidth: 1, borderColor: temValor ? Colors.border2 : Colors.border },
      ] as any}
    >
      {pendente && (
        <View style={s.pendente}>
          {IS_WEB && (
            <span aria-hidden style={{
              position: "absolute", inset: -2, borderRadius: "50%",
              background: "rgba(245,158,11,0.45)",
              animation: "caixaPulse 2s ease-in-out infinite",
              pointerEvents: "none",
            } as any} />
          )}
        </View>
      )}
      <Text style={[s.rotulo, temValor && s.rotuloComValor, discreto && s.rotuloDiscreto]}>
        {temValor ? rotulo + ":" : rotulo}
      </Text>
      {temValor && (
        <Text numberOfLines={1} style={s.valor}>{String(valor).trim()}</Text>
      )}
      {atalho ? <Text style={s.atalho}>{atalho}</Text> : null}
    </Pressable>
  );
}

// ─── Entrada manual de código (botão F1 e "Mais…" do mobile) ──
function CodigoManualForm({
  onScan, listening, lastCode, onDone, autoFocus = true,
}: {
  onScan: (code: string) => void;
  listening?: boolean;
  lastCode?: string | null;
  onDone?: () => void;
  /** No "Mais…" quem recebe o foco é o campo do cupom, não este. */
  autoFocus?: boolean;
}) {
  const [manual, setManual] = useState("");
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      const el: any = inputRef.current;
      if (el && typeof el.focus === "function") el.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [autoFocus]);

  function submit() {
    const code = manual.trim();
    if (!code) return;
    onScan(code); setManual(""); onDone?.();
  }

  return (
    <>
      <Text style={popS.manualHint}>
        {listening
          ? "O leitor USB/Bluetooth está lendo — pode bipar a qualquer momento. Use este campo só pra digitar um código à mão."
          : "O leitor está pausado enquanto outra janela está aberta. Você ainda pode digitar o código aqui."}
        {lastCode ? " Último código lido: " + lastCode + "." : ""}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          ref={inputRef} value={manual} onChangeText={setManual}
          onSubmitEditing={submit}
          placeholder="Digite o código…" placeholderTextColor={Colors.ink3}
          style={[popS.input, { flex: 1 }] as any} returnKeyType="search"
        />
        <Pressable onPress={submit} disabled={!manual.trim()}
          style={[popS.applyWide, !manual.trim() && { opacity: 0.5 }]}>
          <Text style={popS.applyWideTxt}>Adicionar</Text>
        </Pressable>
      </View>
    </>
  );
}

// ═══════════ 1) Leitor — entrada manual de código ═══════════
// O leitor USB/Bluetooth é global e continua escutando sozinho; o estado dele
// virou chip na linha da busca. Aqui fica só o acesso discreto à digitação
// manual, com o F1 de sempre.
export function ActBarcode({
  onScan, listening = true, lastCode = null,
}: {
  onScan: (code: string) => void;
  listening?: boolean;
  lastCode?: string | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F1") { e.preventDefault(); setOpen(o => !o); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const wrapStyle: any = { position: "relative", zIndex: open ? 500 : 1 };

  return (
    <View style={wrapStyle}>
      <ActBtn
        rotulo={ACT_LABELS.leitor.curto}
        atalho="F1"
        discreto
        ativo={open}
        onClick={() => setOpen(o => !o)}
        a11y={a11yDoBotao(ACT_LABELS.leitor.longo, "F1")}
      />
      {open && (
        <PopShell align="right">
          <View style={popS.scannerHeader}>
            <Text style={popS.title}>Entrada manual</Text>
            <Pressable onPress={() => setOpen(false)} style={popS.closeBtn} accessibilityLabel="Fechar">
              <Icon name="x" size={14} color={Colors.ink3} />
            </Pressable>
          </View>
          <CodigoManualForm onScan={onScan} listening={listening} lastCode={lastCode}
            onDone={() => setOpen(false)} />
        </PopShell>
      )}
    </View>
  );
}

// ═══════════ 2) Person picker (vendedora OR cliente) ═══════════
type PersonKind = "vendedora" | "cliente";

/** Handle imperativo mínimo — só o que o rodapé do carrinho precisa. */
export type PersonPickerHandle = { open: () => void };

type ActPersonProps = {
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
  /** Obrigatório pelas políticas do Caixa (Configurações) e ainda vazio. */
  required?: boolean;
  /** Quantos dos primeiros `options` são "recentes" (só vale com busca vazia). */
  recentCount?: number;
};

export const ActPerson = forwardRef<PersonPickerHandle, ActPersonProps>(function ActPerson({
  kind, shortcut, value, onChange, options,
  onAddNew, fallbackText, searchable, addable, disabled, disabledHint, required, recentCount,
}, handleRef) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [freeText, setFreeText] = useState("");
  const wrapRef = useRef<any>(null);
  const rot = kind === "vendedora" ? ACT_LABELS.vendedora : ACT_LABELS.cliente;

  // Mesma porta que o atalho de teclado já usava — só exposta pra fora.
  useImperativeHandle(handleRef, () => ({
    open: () => {
      if (disabled) return;
      setOpen(true);
      // No mobile o carrinho fica bem abaixo da toolbar: abrir o popover sem
      // trazer o card pra tela deixaria o lojista sem ver onde clicar.
      const el: any = wrapRef.current;
      if (IS_WEB && el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
  }), [disabled]);

  useEffect(() => {
    if (!IS_WEB) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
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

  // 29/08/2026: com busca vazia a lista NÃO é alfabética — o pai manda os
  // recentes primeiro (01/09/2026: agora ordenados pelo servidor, ?sort=recent).
  // `nRecent` marca onde termina esse bloco pra desenhar os dois cabeçalhos.
  // Digitou algo, volta a ser busca pura — sobre a lista INTEIRA, não só sobre
  // o trecho exibido.
  const searching = !!searchable && query.trim().length >= 1;
  const nRecent = searching ? 0 : Math.min(recentCount || 0, options.length);
  // 01/09/2026: o placeholder promete "Nome ou telefone…" mas o filtro só olhava
  // o nome. O subtítulo é o telefone (ou e-mail) — entra na busca.
  const needle = query.trim().toLowerCase();
  const filtered = searching
    ? options.filter(o =>
        o.name.toLowerCase().includes(needle) ||
        (o.subtitle || "").toLowerCase().includes(needle)
      ).slice(0, 8)
    : options.slice(0, nRecent + 10);

  const wrapStyle: any = { position: "relative", opacity: disabled ? 0.5 : 1, zIndex: open ? 500 : 1 };
  const valorNoBotao = disabled ? null : value ? value.name : fallbackText || null;

  return (
    <View style={wrapStyle} ref={wrapRef as any}>
      <ActBtn
        rotulo={rot.curto}
        valor={valorNoBotao}
        pendente={!!required && !value && !disabled}
        atalho={shortcut}
        ativo={open}
        disabled={!!disabled}
        onClick={() => { if (disabled) return; setOpen(o => !o); }}
        a11y={a11yDoBotao(disabled ? disabledHint || rot.longo : rot.longo, shortcut, valorNoBotao)}
      />

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
            {filtered.map((opt, i) => {
              const selected = value && value.id === opt.id;
              return (
                <Fragment key={opt.id}>
                  {nRecent > 0 && i === 0 && (
                    <Text style={popS.section}>Atendidos recentemente</Text>
                  )}
                  {nRecent > 0 && i === nRecent && (
                    <Text style={popS.section}>Todos os clientes</Text>
                  )}
                  <Pressable
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
                </Fragment>
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
              <Text style={popS.removeTxt}>Remover {rot.curto.toLowerCase()}</Text>
            </Pressable>
          )}
        </PopShell>
      )}
    </View>
  );
});

// ─── Formulário do cupom (usado pelo botão Cupom e pelo "Mais…") ──
type CupomProps = {
  value: { code: string; discount: number } | null;
  onChange: (v: { code: string; discount: number } | null) => void;
  onValidate: (code: string) => Promise<{ ok: boolean; code?: string; discount?: number; error?: string }>;
  loading?: boolean;
  onDone?: () => void;
};

function CupomForm({ value, onChange, onValidate, loading, onDone }: CupomProps) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true); setErr("");
    try {
      const res = await onValidate(code.trim().toUpperCase());
      if (res.ok && res.code) {
        onChange({ code: res.code, discount: res.discount || 0 });
        setCode(""); onDone?.();
      } else {
        setErr(res.error || "Código inválido ou expirado");
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao validar cupom");
    } finally { setBusy(false); }
  }

  return (
    <>
      <Text style={popS.title}>Aplicar cupom de desconto</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
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
        <Pressable onPress={() => { onChange(null); onDone?.(); }} style={popS.removeBtn}>
          <Text style={popS.removeTxt}>Remover cupom</Text>
        </Pressable>
      )}
    </>
  );
}

// ═══════════ 3) Cupom ═══════════
export function ActCoupon({ value, onChange, onValidate, loading }: CupomProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<any>(null);

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
      if (e.key === "F4") { e.preventDefault(); setOpen(o => !o); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const wrapStyle: any = { position: "relative", zIndex: open ? 500 : 1 };

  return (
    <View style={wrapStyle} ref={ref as any}>
      <ActBtn
        rotulo={ACT_LABELS.cupom.curto}
        valor={value ? value.code : null}
        atalho="F4"
        ativo={open}
        onClick={() => setOpen(o => !o)}
        a11y={a11yDoBotao(ACT_LABELS.cupom.longo, "F4", value ? value.code : null)}
      />
      {open && (
        <PopShell align="left">
          <CupomForm value={value} onChange={onChange} onValidate={onValidate} loading={loading}
            onDone={() => setOpen(false)} />
        </PopShell>
      )}
    </View>
  );
}

// ═══════════ 4) Troca / Devolução ═══════════
export function ActTroca({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F5") { e.preventDefault(); onOpen(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);

  return (
    <ActBtn
      rotulo={ACT_LABELS.troca.curto}
      atalho="F5"
      onClick={onOpen}
      a11y={a11yDoBotao(ACT_LABELS.troca.longo, "F5")}
    />
  );
}

// ═══════════ 5) Crediário parcelado ═══════════
export function ActCrediario({ onOpen, hasCustomer = false }: { onOpen: () => void; hasCustomer?: boolean }) {
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F6") { e.preventDefault(); onOpen(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);

  return (
    <ActBtn
      rotulo={ACT_LABELS.crediario.curto}
      atalho="F6"
      ativo={hasCustomer}
      onClick={onOpen}
      a11y={a11yDoBotao(ACT_LABELS.crediario.longo, "F6", hasCustomer ? "cliente selecionado" : null)}
    />
  );
}

// ═══════════ 6) "Mais…" — overflow do mobile ═══════════
// Cupom e Troca não cabem escritos numa tela de 390px junto com Cliente e
// Vendedora. Em vez de voltar pros ícones indistinguíveis, eles entram aqui.
export function ActMais({
  coupon, onCouponChange, onValidateCoupon, onTroca, onScan, listening, lastCode,
}: {
  coupon: { code: string; discount: number } | null;
  onCouponChange: (v: { code: string; discount: number } | null) => void;
  onValidateCoupon: CupomProps["onValidate"];
  onTroca: () => void;
  onScan: (code: string) => void;
  listening?: boolean;
  lastCode?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!IS_WEB) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Os atalhos continuam valendo mesmo com as ações dentro do "Mais".
  useEffect(() => {
    if (!IS_WEB) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "F4") { e.preventDefault(); setOpen(true); }
      if (e.key === "F5") { e.preventDefault(); setOpen(false); onTroca(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onTroca]);

  const wrapStyle: any = { position: "relative", zIndex: open ? 500 : 1 };

  return (
    <View style={wrapStyle} ref={ref as any}>
      <ActBtn
        rotulo={ACT_LABELS.mais.curto}
        valor={coupon ? coupon.code : null}
        ativo={open}
        onClick={() => setOpen(o => !o)}
        a11y={a11yDoBotao(ACT_LABELS.mais.longo, null, coupon ? "cupom " + coupon.code : null)}
      />
      {open && (
        <PopShell align="right">
          <CupomForm value={coupon} onChange={onCouponChange} onValidate={onValidateCoupon}
            onDone={() => setOpen(false)} />
          <Pressable
            onPress={() => { setOpen(false); onTroca(); }}
            style={popS.maisRow}
            accessibilityLabel={a11yDoBotao(ACT_LABELS.troca.longo, "F5")}
          >
            <Text style={popS.maisTxt}>{ACT_LABELS.troca.curto}</Text>
            <Text style={s.atalho}>F5</Text>
          </Pressable>
          <View style={popS.maisRow}>
            <Text style={popS.maisTxt}>{ACT_LABELS.leitor.curto}</Text>
            <Text style={s.atalho}>F1</Text>
          </View>
          <CodigoManualForm onScan={onScan} listening={listening} lastCode={lastCode}
            autoFocus={false} onDone={() => setOpen(false)} />
        </PopShell>
      )}
    </View>
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
  btn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    height: 40, paddingHorizontal: 12,
    borderRadius: 10, position: "relative",
    alignSelf: "flex-start",
  },
  btnDisabled: { opacity: 0.55 },
  pendente: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: Colors.amber, position: "relative", flexShrink: 0,
  },
  rotulo: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  rotuloComValor: { color: Colors.ink3, fontWeight: "500" },
  rotuloDiscreto: { color: Colors.ink3, fontWeight: "500", fontSize: 12 },
  valor: { fontSize: 13, color: Colors.ink, fontWeight: "700", maxWidth: 180 },
  atalho: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" as any) : "monospace",
    fontSize: 9, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, backgroundColor: Glass.lineSoft, color: Colors.ink3,
    letterSpacing: 0.4, flexShrink: 0,
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
  section: {
    fontSize: 9, fontWeight: "700", color: Colors.violet3,
    letterSpacing: 1, textTransform: "uppercase",
    marginTop: 8, marginBottom: 2, paddingHorizontal: 10,
  },
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
  maisRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.2)" },
  maisTxt:    { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});

export default null;
