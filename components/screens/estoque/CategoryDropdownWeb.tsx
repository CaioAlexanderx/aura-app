// ============================================================
// CategoryDropdownWeb — multi-select dropdown de categorias.
// selected = string[] (vazio = "Todos"). Web-only. (Premium v2)
// ============================================================
import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useColors, useThemeStore } from "@/constants/colors";
import { Icon } from "@/components/Icon";

type Props = {
  categories: string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

export function CategoryDropdownWeb({ categories, selected, onChange }: Props) {
  const C = useColors();
  const { isDark } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (Platform.OS !== "web") return null;

  const accent = C.violet;
  const surface = isDark ? "rgba(20,14,38,0.55)" : "rgba(255,255,255,0.70)";
  const border2 = isDark ? "rgba(167,139,250,0.30)" : "rgba(124,58,237,0.20)";

  const toggle = (c: string) => {
    if (selected.includes(c)) onChange(selected.filter(x => x !== c));
    else onChange([...selected, c]);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } as any}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        color: C.ink3, paddingRight: 4, flexShrink: 0,
      } as any}>Categoria</span>
      <div ref={ref} style={{ position: "relative" } as any}>
        <button onClick={() => setOpen(o => !o)} className="aura-est-pressable" style={{
          height: 34, padding: "0 12px 0 11px", borderRadius: 999, cursor: "pointer",
          border: "1px solid " + (selected.length ? accent : border2),
          background: selected.length ? accent + "12" : surface,
          color: selected.length ? accent : C.ink2,
          display: "flex", alignItems: "center", gap: 7,
          fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          boxShadow: selected.length ? "0 4px 12px " + accent + "24" : "none",
        } as any}>
          <Icon name="filter" size={13} color={selected.length ? accent : C.ink2} />
          <span>{selected.length ? selected.length + " categoria" + (selected.length > 1 ? "s" : "") : "Todas as categorias"}</span>
          <Icon name="chevron_down" size={12} color={selected.length ? accent : C.ink2} />
        </button>
        {open && (
          <div className="aura-est-rise" style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, width: 280,
            background: isDark ? "rgba(20,14,38,0.95)" : "rgba(255,255,255,0.98)",
            backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
            border: "1px solid " + border2, borderRadius: 14,
            boxShadow: isDark
              ? "0 24px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(124,58,237,0.30)"
              : "0 24px 60px rgba(40,20,80,0.18), 0 4px 16px rgba(124,58,237,0.18)",
            padding: 6, zIndex: 50, maxHeight: 320, overflowY: "auto",
          } as any}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 10px 6px",
              fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              color: C.ink3,
            } as any}>
              <span>Filtrar categorias</span>
              {selected.length > 0 && (
                <button onClick={() => onChange([])} className="aura-est-pressable" style={{
                  border: "none", background: "transparent", color: accent,
                  fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer",
                  fontFamily: "inherit", padding: 0,
                } as any}>Limpar</button>
              )}
            </div>
            {categories.map(c => {
              const on = selected.includes(c);
              return (
                <button key={c} onClick={() => toggle(c)} className="aura-est-pressable" style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 11,
                  padding: "9px 10px", borderRadius: 9, border: "none", cursor: "pointer",
                  background: on ? accent + "12" : "transparent",
                  color: C.ink, fontFamily: "inherit", textAlign: "left",
                } as any}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: "1.5px solid " + (on ? accent : border2),
                    background: on ? accent : "transparent",
                    display: "grid", placeItems: "center",
                    transition: "all 0.15s",
                  } as any}>
                    {on && <Icon name="check" size={11} color="#fff" />}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: on ? 600 : 500 } as any}>{c}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Selected chips */}
      {selected.map(c => (
        <span key={c} className="aura-est-rise" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 30, padding: "0 6px 0 12px", borderRadius: 999,
          background: accent + "1a", border: "1px solid " + accent + "44",
          color: accent, fontSize: 12.5, fontWeight: 600,
        } as any}>
          {c}
          <button onClick={() => onChange(selected.filter(x => x !== c))} className="aura-est-pressable" style={{
            width: 18, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
            background: isDark ? "rgba(167,139,250,0.20)" : "rgba(124,58,237,0.18)",
            display: "grid", placeItems: "center", color: accent,
          } as any}><Icon name="x" size={10} color={accent} /></button>
        </span>
      ))}
    </div>
  );
}
