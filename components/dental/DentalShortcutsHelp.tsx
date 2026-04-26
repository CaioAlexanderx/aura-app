import { Platform } from "react-native";
import { DENTAL_SHORTCUTS_HELP } from "@/components/dental/useDentalShortcuts";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// DentalShortcutsHelp — modal overlay listando os atalhos de
// teclado disponiveis no shell dental. Web only.
//
// Aberto por:
//   - `?` (handled em useDentalShortcuts)
//   - Clique no hint do rodape do shell (planejado, opcional)
//
// Fechado por:
//   - `Esc` (handled em useDentalShortcuts)
//   - Clique fora
//   - Botao Entendi
// ============================================================

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DentalShortcutsHelp({ open, onClose }: Props) {
  if (!open || Platform.OS !== "web") return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      } as any}
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: DentalColors.bg2,
          border: "1px solid " + DentalColors.border,
          borderRadius: 18, padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          color: DentalColors.ink,
        } as any}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 } as any}>
          <div>
            <div style={{
              fontSize: 9, color: DentalColors.ink3, fontWeight: 700,
              letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
            } as any}>NAVEGAÇÃO RÁPIDA</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 } as any}>Atalhos de teclado</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid " + DentalColors.border,
              color: DentalColors.ink2, borderRadius: 8,
              padding: "4px 10px", fontSize: 12, cursor: "pointer",
            } as any}
          >Fechar</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 } as any}>
          {DENTAL_SHORTCUTS_HELP.map((s) => (
            <div key={s.keys + s.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid " + DentalColors.border,
            } as any}>
              <span style={{ fontSize: 13, color: DentalColors.ink2 } as any}>{s.label}</span>
              <kbd style={{
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                fontSize: 11, fontWeight: 700,
                color: DentalColors.cyan,
                background: DentalColors.cyanDim,
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid " + DentalColors.cyanBorder,
                letterSpacing: 0.5,
              } as any}>{s.keys}</kbd>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 16, paddingTop: 14,
          borderTop: "1px solid " + DentalColors.border,
          fontSize: 11, color: DentalColors.ink3, lineHeight: 1.5,
        } as any}>
          Os atalhos não disparam quando você está digitando em
          formulários. Pressione <kbd style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 } as any}>?</kbd> a
          qualquer momento para reabrir esta janela.
        </div>
      </div>
    </div>
  );
}

export default DentalShortcutsHelp;
